import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../r2Client';
import { uploadBlobToR2 } from './r2MultipartUpload';

/**
 * R2 storage for long-format videos.
 *
 * Same bucket and credentials as the rest of Content Studio, but long videos
 * are served from the Kid Monk custom domain instead of the rate-limited
 * r2.dev development URL. `storage.kidmonk.in` is already connected to the
 * `zimply-content` bucket as an R2 custom domain (R2 > zimply-content >
 * Settings > Custom Domains), so it serves every object in the bucket through
 * the Cloudflare cache. Override with VITE_LONG_VIDEO_PUBLIC_BASE_URL if a
 * different host is used.
 */

const R2_ACCOUNT_ID = '330822ed628fddd0c6c00a5f735dfa0e';
const R2_BUCKET = 'zimply-content';
const VIDEO_PREFIX = 'long_videos';
const POSTER_PREFIX = `${VIDEO_PREFIX}/posters`;

export const LONG_VIDEO_PUBLIC_BASE_URL = String(
  import.meta.env?.VITE_LONG_VIDEO_PUBLIC_BASE_URL || 'https://storage.kidmonk.in',
).replace(/\/+$/, '');

// Every key is derived from the row id, so an object is never overwritten and
// is safe to cache for a year at the edge and on the phone.
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

// Dedicated client for long uploads. It reuses the Content Studio R2
// credentials, and only sends checksums when an operation requires them,
// which keeps multipart uploads compatible with R2.
const longVideoS3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: s3Client.config.credentials,
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const extensionFor = (fileOrBlob, fallback) => {
  if (fileOrBlob?.type === 'image/png') return 'png';
  if (fileOrBlob?.type === 'image/jpeg') return 'jpg';
  const name = typeof fileOrBlob?.name === 'string' ? fileOrBlob.name : '';
  const match = name.match(/\.(png|jpe?g)$/i);
  if (match) return match[1].toLowerCase() === 'png' ? 'png' : 'jpg';
  return fallback;
};

export const longVideoKey = (videoId) => `${VIDEO_PREFIX}/${videoId}.mp4`;
export const longVideoPosterKey = (videoId, posterBlob) =>
  `${POSTER_PREFIX}/${videoId}.${extensionFor(posterBlob, 'jpg')}`;
export const longVideoPublicUrl = (key) => `${LONG_VIDEO_PUBLIC_BASE_URL}/${key}`;

/**
 * Uploads a long video MP4 to R2 and returns { key, url }.
 *
 * @param {string} videoId
 * @param {File} file
 * @param {{ onProgress?: Function, signal?: AbortSignal }} [options]
 */
export const uploadLongVideo = async (videoId, file, { onProgress, signal } = {}) => {
  const key = longVideoKey(videoId);
  await uploadBlobToR2({
    client: longVideoS3Client,
    bucket: R2_BUCKET,
    key,
    blob: file,
    contentType: 'video/mp4',
    cacheControl: IMMUTABLE_CACHE_CONTROL,
    onProgress,
    signal,
  });
  return { key, url: longVideoPublicUrl(key) };
};

/** Uploads a long video's thumbnail to R2 and returns { key, url }. */
export const uploadLongVideoPoster = async (videoId, posterBlob, { signal } = {}) => {
  const key = longVideoPosterKey(videoId, posterBlob);
  await uploadBlobToR2({
    client: longVideoS3Client,
    bucket: R2_BUCKET,
    key,
    blob: posterBlob,
    contentType: posterBlob.type || 'image/jpeg',
    cacheControl: IMMUTABLE_CACHE_CONTROL,
    signal,
  });
  return { key, url: longVideoPublicUrl(key) };
};

/**
 * Best-effort removal of R2 objects (after a failed save, or when a long video
 * is deleted). Never throws; returns the keys that could not be removed.
 */
export const deleteLongVideoObjects = async (keys) => {
  const failed = [];
  for (const key of keys.filter(Boolean)) {
    try {
      await longVideoS3Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    } catch (err) {
      console.error(`Could not delete R2 object ${key}:`, err);
      failed.push(key);
    }
  }
  return failed;
};

/**
 * Checks that the public URL actually serves a playable video (i.e. the custom
 * domain is connected to the bucket). Uses a <video> element, so it does not
 * depend on CORS. Resolves { ok, error }.
 */
export const probePublicVideo = (url, timeoutMs = 20000) =>
  new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, error: 'Timed out waiting for the video.' }), timeoutMs);
    video.addEventListener('loadedmetadata', () => finish({ ok: true, error: null }), { once: true });
    video.addEventListener('error', () => finish({ ok: false, error: 'The public URL did not return a playable video.' }), { once: true });
    video.src = url;
  });
