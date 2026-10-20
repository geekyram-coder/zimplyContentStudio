import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, uploadFileToR2 } from '../r2Client';

// Same bucket that r2Client.js uploads QuickBook media into.
const R2_BUCKET = 'zimply-content';
const VIDEO_PREFIX = 'cheat_study_videos';
const POSTER_PREFIX = `${VIDEO_PREFIX}/posters`;

const extensionFor = (fileOrBlob, fallback) => {
  const name = typeof fileOrBlob?.name === 'string' ? fileOrBlob.name : '';
  const match = name.match(/\.([a-z0-9]+)$/i);
  if (match) return match[1].toLowerCase();
  if (fileOrBlob?.type === 'image/png') return 'png';
  if (fileOrBlob?.type === 'image/jpeg') return 'jpg';
  return fallback;
};

// Object keys are derived from the row id, so each upload is a fresh,
// never-overwritten object (safe to cache forever at the CDN).
export const cheatStudyVideoKey = (videoId) => `${VIDEO_PREFIX}/${videoId}.mp4`;
export const cheatStudyPosterKey = (videoId, posterBlob) =>
  `${POSTER_PREFIX}/${videoId}.${extensionFor(posterBlob, 'jpg')}`;

/** Uploads a short's MP4 to R2 and returns { key, url }. */
export const uploadCheatStudyVideo = async (videoId, file) => {
  const key = cheatStudyVideoKey(videoId);
  const url = await uploadFileToR2(file, key, 'video/mp4');
  return { key, url };
};

/** Uploads a short's poster image to R2 and returns { key, url }. */
export const uploadCheatStudyPoster = async (videoId, posterBlob) => {
  const key = cheatStudyPosterKey(videoId, posterBlob);
  const url = await uploadFileToR2(posterBlob, key, posterBlob.type || 'image/jpeg');
  return { key, url };
};

/**
 * Best-effort removal of R2 objects (used to clean up after a failed save or
 * when a short is deleted). Never throws; returns the keys that failed.
 */
export const deleteCheatStudyObjects = async (keys) => {
  const failed = [];
  for (const key of keys.filter(Boolean)) {
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    } catch (err) {
      console.error(`Could not delete R2 object ${key}:`, err);
      failed.push(key);
    }
  }
  return failed;
};
