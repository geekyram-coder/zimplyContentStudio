/**
 * Browser-side helpers for Cheat Study shorts uploads.
 *
 * The app plays every short in a 9:16 portrait frame (authored at 720 x 1280)
 * with expo-av on iOS and Android, so MP4 is the only accepted container.
 */

export const SHORT_VIDEO_MIME_TYPE = 'video/mp4';
export const SHORT_VIDEO_MAX_BYTES = 200 * 1024 * 1024; // 200 MB
export const SHORT_POSTER_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const PORTRAIT_ASPECT = 9 / 16;
const ASPECT_TOLERANCE = 0.02;
const VIDEO_EVENT_TIMEOUT_MS = 15000;
const POSTER_JPEG_QUALITY = 0.85;

export const isMp4File = (file) =>
  !!file && (file.type === SHORT_VIDEO_MIME_TYPE || /\.mp4$/i.test(file.name));

export const isPortraitShort = (width, height) =>
  width > 0 && height > 0 && Math.abs(width / height - PORTRAIT_ASPECT) <= ASPECT_TOLERANCE;

export const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

export const formatDuration = (milliseconds) => {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '0:00';
  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

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
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Poster export failed'))), type, quality);
  });

// Draws the very first frame, which is what the app shows while the short
// loads, so the hand-off from poster to video has no visible jump.
const captureFirstFrame = async (video) => {
  if (!video.videoWidth || !video.videoHeight) return null;
  try {
    video.currentTime = 0;
    await waitForEvent(video, 'seeked', () => !video.seeking && video.readyState >= 2);
  } catch {
    // Some browsers do not fire `seeked` when already at 0; the decoded
    // frame from `loadeddata` is the first frame in that case.
  }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvasToBlob(canvas, 'image/jpeg', POSTER_JPEG_QUALITY);
};

/**
 * Reads duration and dimensions from a local video file and captures its
 * first frame as a JPEG poster.
 *
 * @param {File} file
 * @returns {Promise<{ durationMs: number|null, width: number|null, height: number|null, posterBlob: Blob|null, decodeError: string|null }>}
 */
export const inspectShortVideo = async (file) => {
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
      posterBlob = await captureFirstFrame(video);
      if (!posterBlob) decodeError = 'No video track could be decoded in this browser.';
    } catch (err) {
      decodeError = err.message || 'The first frame could not be captured.';
    }

    return { durationMs, width, height, posterBlob, decodeError };
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
};
