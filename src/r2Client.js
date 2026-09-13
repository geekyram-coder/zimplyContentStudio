import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const R2_ACCOUNT_ID = '330822ed628fddd0c6c00a5f735dfa0e';
const R2_BUCKET = 'zimply-content';
const R2_PUBLIC_BASE_URL = 'https://pub-1b2343fe4c1146e7ab127260912cbc58.r2.dev';

export const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: '2d1d67f3391eae8c4f9d9ce8eb82e41a',
    secretAccessKey: 'e841739228ad6bd5ee52cb30f3517a0f14b99231085d643185b82be3a2f9c37e',
  },
  forcePathStyle: true,
});

/**
 * Uploads a file (File or Blob) to R2 and returns the public URL.
 */
export const uploadFileToR2 = async (fileOrBlob, key, contentType) => {
  const arrayBuffer = await fileOrBlob.arrayBuffer();
  const bodyData = new Uint8Array(arrayBuffer);

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: bodyData,
    ContentType: contentType || fileOrBlob.type,
  });

  await s3Client.send(command);

  return `${R2_PUBLIC_BASE_URL}/${key}`;
};
