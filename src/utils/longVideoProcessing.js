/**
 * Browser-side helpers for long-format video uploads.
 *
 * The app plays long videos as landscape MP4 (H.264 + AAC). The recommended
 * export is 1280 x 720 at roughly 6 MB per minute (a 3 minute video is about
 * 15-20 MB), which looks sharp on phones and tablets and keeps kids' mobile
 * data use low. Larger files are accepted but flagged.
 */

export const LONG_VIDEO_MIME_TYPE = 'video/mp4';
export const LONG_VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB hard limit
export const LONG_VIDEO_POSTER_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const LONG_VIDEO_TITLE_MAX_LENGTH = 200;

// Soft guidance only (shown as a warning, never blocks an upload).
export const RECOMMENDED_MAX_WIDTH = 1280;
export const RECOMMENDED_MAX_MBPS = 1.5; // total bitrate, video + audio

const VIDEO_EVENT_TIMEOUT_MS = 20000;
const POSTER_MAX_WIDTH = 1280;
const POSTER_JPEG_QUALITY = 0.85;

const waitForEvent = (target, eventName, isAlreadyDone) =>
  new Promise((resolve, reject) => {
    if (isAlreadyDone && isAlreadyDone()) {
      resolve();
      return;
    }
    const cleanup = () => {
      clearTimeout(timer);
      target.removeEventListener(eventName, onDone);
      target.removeEventListener('error', onError);
    };
    const onDone = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('This browser could not decode the video.'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for the video (${eventName}).`));
    }, VIDEO_EVENT_TIMEOUT_MS);
    target.addEventListener(eventName, onDone, { once: true });
    target.addEventListener('error', onError, { once: true });
  });

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Thumbnail export failed'))), type, quality);
  });

/**
 * Draws the frame currently shown by `video` into a JPEG (max 1280 px wide).
 * Works on any <video> playing a local (blob:) URL.
 */
export const captureVideoFrame = async (video) => {
  if (!video?.videoWidth || !video?.videoHeight) return null;
  const scale = Math.min(1, POSTER_MAX_WIDTH / video.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvasToBlob(canvas, 'image/jpeg', POSTER_JPEG_QUALITY);
};

// Long videos usually open on a black or fading frame, so the automatic
// thumbnail is taken a little way in (15% of the way, between 1 and 8 s).
export const defaultThumbnailTime = (durationSeconds) => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  return Math.min(Math.max(durationSeconds * 0.15, 1), 8, durationSeconds / 2);
};

/**
 * Reads duration and dimensions from a local video file and captures a
 * thumbnail.
 *
 * @param {File} file
 * @returns {Promise<{ durationMs: number|null, width: number|null, height: number|null, posterBlob: Blob|null, decodeError: string|null }>}
 */
export const inspectLongVideo = async (file) => {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  try {
    await waitForEvent(video, 'loadedmetadata', () => video.readyState >= 1);
    const durationMs = Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null;
    const width = video.videoWidth || null;
    const height = video.videoHeight || null;

    let posterBlob = null;
    let decodeError = null;
    try {
      await waitForEvent(video, 'loadeddata', () => video.readyState >= 2);
      const target = defaultThumbnailTime(video.duration);
      if (target > 0) {
        video.currentTime = target;
        await waitForEvent(video, 'seeked', () => !video.seeking && Math.abs(video.currentTime - target) < 0.05);
      }
      posterBlob = await captureVideoFrame(video);
      if (!posterBlob) decodeError = 'No video track could be decoded in this browser.';
    } catch (err) {
      decodeError = err.message || 'The thumbnail could not be captured.';
    }

    return { durationMs, width, height, posterBlob, decodeError };
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
};

/** Average bitrate in megabits per second, or null when unknown. */
export const averageMbps = (bytes, durationMs) =>
  Number.isFinite(bytes) && Number.isFinite(durationMs) && durationMs > 0
    ? (bytes * 8) / (durationMs / 1000) / 1e6
    : null;

/** Human-readable warnings about size/format; empty when the file is app-ready. */
export const longVideoWarnings = ({ width, height, durationMs, sizeBytes }) => {
  const warnings = [];
  if (width && height && width < height) {
    warnings.push('This video is portrait. Long videos play in landscape (16:9); portrait videos belong in Shorts.');
  }
  if (width && width > RECOMMENDED_MAX_WIDTH) {
    warnings.push(`This video is ${width} x ${height}. A 1280 x 720 export looks just as good on phones and is much smaller to stream.`);
  }
  const mbps = averageMbps(sizeBytes, durationMs);
  if (mbps && mbps > RECOMMENDED_MAX_MBPS) {
    const mbPerMinute = sizeBytes / 1024 / 1024 / (durationMs / 60000);
    warnings.push(`This file uses about ${mbPerMinute.toFixed(1)} MB per minute (${mbps.toFixed(1)} Mbps). The recommended 720p export is about 6 MB per minute, which saves kids' mobile data.`);
  }
  return warnings;
};
