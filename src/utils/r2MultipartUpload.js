import {
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';

/**
 * Resumable-style upload of large files (long videos) to Cloudflare R2 over the
 * S3 API.
 *
 * - Files above `multipartThreshold` are sent as an S3 multipart upload:
 *   fixed-size parts (R2 requires every part except the last to be the same
 *   size, minimum 5 MiB), a few in parallel, each retried with backoff, so a
 *   network blip costs one part instead of the whole video. Progress is
 *   reported as parts finish.
 * - Only one part is read into memory per worker (`Blob.slice`), never the
 *   whole file.
 * - If the bucket's CORS policy does not allow multipart from the browser
 *   (POST not allowed, or the `ETag` response header not exposed), the upload
 *   falls back to a single PUT, which is what the rest of Content Studio uses.
 * - Passing an AbortSignal cancels in-flight requests and aborts the multipart
 *   upload on R2 so no orphaned parts are left behind.
 */

export const MIB = 1024 * 1024;
export const DEFAULT_PART_SIZE = 8 * MIB;
export const DEFAULT_MULTIPART_THRESHOLD = 16 * MIB;
export const DEFAULT_CONCURRENCY = 4;
export const DEFAULT_MAX_RETRIES = 3;
const R2_MIN_PART_SIZE = 5 * MIB;
const S3_MAX_PARTS = 10000;

export class UploadCancelledError extends Error {
  constructor() {
    super('Upload cancelled.');
    this.name = 'UploadCancelledError';
  }
}

class MultipartUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MultipartUnavailableError';
  }
}

const throwIfAborted = (signal) => {
  if (signal?.aborted) throw new UploadCancelledError();
};

const isAbortError = (err, signal) =>
  signal?.aborted || err?.name === 'AbortError' || err?.name === 'UploadCancelledError';

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadCancelledError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new UploadCancelledError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

const readBytes = async (blob) => new Uint8Array(await blob.arrayBuffer());

/** Part size that keeps the upload under S3's 10,000-part limit. */
export const choosePartSize = (totalBytes, preferred = DEFAULT_PART_SIZE) => {
  let size = Math.max(preferred, R2_MIN_PART_SIZE);
  while (Math.ceil(totalBytes / size) > S3_MAX_PARTS) size *= 2;
  return size;
};

/**
 * Uploads `blob` to `bucket`/`key`.
 *
 * @param {object} options
 * @param {import('@aws-sdk/client-s3').S3Client} options.client
 * @param {string} options.bucket
 * @param {string} options.key
 * @param {Blob} options.blob
 * @param {string} options.contentType
 * @param {string} [options.cacheControl]
 * @param {(progress: { loaded: number, total: number, indeterminate: boolean }) => void} [options.onProgress]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ method: 'multipart' | 'single' }>}
 */
export const uploadBlobToR2 = async ({
  client,
  bucket,
  key,
  blob,
  contentType,
  cacheControl,
  onProgress,
  signal,
  partSize = DEFAULT_PART_SIZE,
  multipartThreshold = DEFAULT_MULTIPART_THRESHOLD,
  concurrency = DEFAULT_CONCURRENCY,
  maxRetries = DEFAULT_MAX_RETRIES,
  retryBaseDelayMs = 800,
}) => {
  const total = blob.size;
  const report = (loaded, indeterminate = false) => {
    if (onProgress) onProgress({ loaded, total, indeterminate });
  };
  const send = (command) => client.send(command, { abortSignal: signal });

  const putSingle = async () => {
    throwIfAborted(signal);
    report(0, true);
    try {
      await send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: await readBytes(blob),
        ContentType: contentType,
        CacheControl: cacheControl,
      }));
    } catch (err) {
      if (isAbortError(err, signal)) throw new UploadCancelledError();
      throw err;
    }
    report(total);
    return { method: 'single' };
  };

  if (total <= multipartThreshold) return putSingle();

  throwIfAborted(signal);
  report(0);

  let uploadId;
  try {
    const created = await send(new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      CacheControl: cacheControl,
    }));
    uploadId = created?.UploadId;
    if (!uploadId) throw new MultipartUnavailableError('R2 did not return an upload id.');
  } catch (err) {
    if (isAbortError(err, signal)) throw new UploadCancelledError();
    // Typically the bucket CORS policy does not allow POST from this origin.
    console.warn('Multipart upload unavailable, falling back to a single PUT:', err);
    return putSingle();
  }

  const size = choosePartSize(total, partSize);
  const partCount = Math.ceil(total / size);
  const etags = new Array(partCount);
  let loaded = 0;
  let nextPart = 0;
  let firstError = null;
  // Stops the other workers as soon as one part fails for good, and cancels
  // their in-flight requests.
  const poolController = new AbortController();
  const onOuterAbort = () => poolController.abort();
  signal?.addEventListener('abort', onOuterAbort, { once: true });

  const uploadPart = async (index) => {
    const start = index * size;
    const end = Math.min(start + size, total);
    const body = await readBytes(blob.slice(start, end));
    for (let attempt = 0; ; attempt += 1) {
      if (poolController.signal.aborted) throw signal?.aborted ? new UploadCancelledError() : firstError;
      try {
        const result = await client.send(new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: index + 1,
          Body: body,
        }), { abortSignal: poolController.signal });
        if (!result?.ETag) {
          throw new MultipartUnavailableError('R2 accepted the part but the browser cannot read its ETag (bucket CORS must expose the ETag header).');
        }
        etags[index] = result.ETag;
        loaded += end - start;
        report(loaded);
        return;
      } catch (err) {
        if (signal?.aborted) throw new UploadCancelledError();
        if (poolController.signal.aborted) throw firstError || err;
        if (err instanceof MultipartUnavailableError || attempt >= maxRetries) throw err;
        const delay = retryBaseDelayMs * 2 ** attempt * (0.75 + Math.random() * 0.5);
        console.warn(`Part ${index + 1}/${partCount} failed (attempt ${attempt + 1}), retrying in ${Math.round(delay)} ms:`, err);
        await sleep(delay, poolController.signal).catch(() => {
          throw signal?.aborted ? new UploadCancelledError() : firstError || err;
        });
      }
    }
  };

  const worker = async () => {
    while (!poolController.signal.aborted) {
      const index = nextPart;
      if (index >= partCount) return;
      nextPart += 1;
      try {
        await uploadPart(index);
      } catch (err) {
        if (!firstError) firstError = err;
        poolController.abort();
        return;
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, partCount) }, worker));
    if (signal?.aborted) throw new UploadCancelledError();
    if (firstError) throw firstError;

    await send(new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: etags.map((ETag, index) => ({ ETag, PartNumber: index + 1 })),
      },
    }));
    report(total);
    return { method: 'multipart' };
  } catch (err) {
    // Best effort: free the uploaded parts on R2 (also covered by the bucket's
    // default lifecycle rule for incomplete multipart uploads).
    try {
      await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }));
    } catch (abortErr) {
      console.warn('Could not abort the multipart upload:', abortErr);
    }
    if (isAbortError(err, signal)) throw new UploadCancelledError();
    if (err instanceof MultipartUnavailableError) {
      console.warn('Multipart upload unavailable, falling back to a single PUT:', err);
      return putSingle();
    }
    throw err;
  } finally {
    signal?.removeEventListener('abort', onOuterAbort);
  }
};
