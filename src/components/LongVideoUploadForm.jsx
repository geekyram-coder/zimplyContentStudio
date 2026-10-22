import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UploadCloud, CheckCircle, Loader2, AlertTriangle, Film, X, Camera } from 'lucide-react';
import { supabase, ensureSession } from '../supabaseClient';
import {
  uploadLongVideo,
  uploadLongVideoPoster,
  deleteLongVideoObjects,
  probePublicVideo,
  LONG_VIDEO_PUBLIC_BASE_URL,
} from '../utils/longVideoMedia';
import { UploadCancelledError } from '../utils/r2MultipartUpload';
import {
  LONG_VIDEO_MAX_BYTES,
  LONG_VIDEO_POSTER_MAX_BYTES,
  LONG_VIDEO_TITLE_MAX_LENGTH,
  inspectLongVideo,
  captureVideoFrame,
  longVideoWarnings,
} from '../utils/longVideoProcessing';
import { isMp4File, formatBytes, formatDuration } from '../utils/videoProcessing';

const newVideoId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

// "Velcro_Story.mp4" -> "Velcro Story"
const titleFromFileName = (name) =>
  String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LONG_VIDEO_TITLE_MAX_LENGTH);

const IDLE_PROGRESS = { loaded: 0, total: 0, indeterminate: false };

export default function LongVideoUploadForm({ onUploaded }) {
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [details, setDetails] = useState(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [customPoster, setCustomPoster] = useState(null);
  const [customPosterLabel, setCustomPosterLabel] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(IDLE_PROGRESS);
  const [successMsg, setSuccessMsg] = useState('');
  const [warningMsg, setWarningMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const videoInputRef = useRef(null);
  const posterInputRef = useRef(null);
  const previewVideoRef = useRef(null);
  const abortRef = useRef(null);

  const posterBlob = customPoster || details?.posterBlob || null;
  const posterPreviewUrl = useMemo(() => (posterBlob ? URL.createObjectURL(posterBlob) : ''), [posterBlob]);

  useEffect(() => () => {
    if (posterPreviewUrl) URL.revokeObjectURL(posterPreviewUrl);
  }, [posterPreviewUrl]);

  useEffect(() => () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
  }, [videoPreviewUrl]);

  // Leaving the page mid-upload would orphan a half-finished upload.
  useEffect(() => {
    if (!isUploading) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isUploading]);

  // Cancel any in-flight upload if the page is closed from inside the app.
  useEffect(() => () => abortRef.current?.abort(), []);

  const resetFiles = () => {
    setVideoFile(null);
    setVideoPreviewUrl('');
    setDetails(null);
    setCustomPoster(null);
    setCustomPosterLabel('');
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (posterInputRef.current) posterInputRef.current.value = '';
  };

  const selectVideo = async (file) => {
    setErrorMsg('');
    setSuccessMsg('');
    setWarningMsg('');
    if (!file) return;
    if (!isMp4File(file)) {
      setErrorMsg('Please choose an MP4 video (.mp4, H.264). Other formats do not play reliably on every phone.');
      return;
    }
    if (file.size > LONG_VIDEO_MAX_BYTES) {
      setErrorMsg(`This video is ${formatBytes(file.size)}. The limit is ${formatBytes(LONG_VIDEO_MAX_BYTES)}.`);
      return;
    }

    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
    setDetails(null);
    setCustomPoster(null);
    setCustomPosterLabel('');
    if (!titleTouched || !title.trim()) {
      setTitle(titleFromFileName(file.name));
      setTitleTouched(false);
    }

    setIsInspecting(true);
    try {
      setDetails(await inspectLongVideo(file));
    } catch (err) {
      setDetails({ durationMs: null, width: null, height: null, posterBlob: null, decodeError: err.message });
    } finally {
      setIsInspecting(false);
    }
  };

  const selectPoster = (file) => {
    setErrorMsg('');
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      setErrorMsg('The thumbnail must be a PNG or JPEG image.');
      return;
    }
    if (file.size > LONG_VIDEO_POSTER_MAX_BYTES) {
      setErrorMsg(`The thumbnail is ${formatBytes(file.size)}. The limit is ${formatBytes(LONG_VIDEO_POSTER_MAX_BYTES)}.`);
      return;
    }
    setCustomPoster(file);
    setCustomPosterLabel('Uploaded thumbnail');
  };

  const captureCurrentFrameAsThumbnail = async () => {
    setErrorMsg('');
    try {
      const blob = await captureVideoFrame(previewVideoRef.current);
      if (!blob) throw new Error('Play or seek the preview to a frame first.');
      setCustomPoster(blob);
      setCustomPosterLabel(`Frame at ${formatDuration((previewVideoRef.current?.currentTime || 0) * 1000)}`);
    } catch (err) {
      setErrorMsg(err.message || 'Could not capture that frame.');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) selectVideo(file);
  };

  const validate = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return 'Please enter a title for the video.';
    if (cleanTitle.length > LONG_VIDEO_TITLE_MAX_LENGTH) return `The title can be at most ${LONG_VIDEO_TITLE_MAX_LENGTH} characters.`;
    if (!videoFile) return 'Please choose the video to upload.';
    if (isInspecting) return 'Still reading the video, please wait a moment.';
    return null;
  };

  const cancelUpload = () => {
    if (abortRef.current) {
      setStatus('Cancelling...');
      abortRef.current.abort();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setErrorMsg(problem);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsUploading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setWarningMsg('');
    setProgress({ loaded: 0, total: videoFile.size, indeterminate: false });

    const videoId = newVideoId();
    const uploadedKeys = [];
    const cleanTitle = title.trim();
    let saved = false;

    try {
      await ensureSession();

      setStatus(`Uploading video (${formatBytes(videoFile.size)})`);
      const video = await uploadLongVideo(videoId, videoFile, { onProgress: setProgress, signal: controller.signal });
      uploadedKeys.push(video.key);

      let poster = null;
      if (posterBlob) {
        setStatus('Uploading thumbnail');
        poster = await uploadLongVideoPoster(videoId, posterBlob, { signal: controller.signal });
        uploadedKeys.push(poster.key);
      }

      if (controller.signal.aborted) throw new UploadCancelledError();
      setStatus('Saving to Supabase');
      const { error } = await supabase.from('long_videos').insert({
        id: videoId,
        title: cleanTitle,
        video_url: video.url,
        video_r2_key: video.key,
        poster_url: poster ? poster.url : null,
        poster_r2_key: poster ? poster.key : null,
        mime_type: 'video/mp4',
        duration_ms: details?.durationMs ?? null,
        width: details?.width ?? null,
        height: details?.height ?? null,
        file_size_bytes: videoFile.size,
      });
      if (error) throw error;
      saved = true;

      setSuccessMsg(`Uploaded "${cleanTitle}" and published it to the app.`);
      setTitle('');
      setTitleTouched(false);
      resetFiles();
      if (onUploaded) onUploaded();

      // Confirm the file is reachable on the public domain the app will use.
      setStatus('Checking the public link');
      const probe = await probePublicVideo(video.url);
      if (!probe.ok) {
        setWarningMsg(`Saved, but ${LONG_VIDEO_PUBLIC_BASE_URL} is not serving the video yet (${probe.error}) The app cannot play it until the custom domain is connected to the R2 bucket in Cloudflare. Nothing needs to be re-uploaded once it is.`);
      }
    } catch (err) {
      const cancelled = err instanceof UploadCancelledError || controller.signal.aborted;
      if (!cancelled) console.error('Long video upload failed:', err);
      if (!saved && uploadedKeys.length > 0) {
        setStatus('Cleaning up partial upload');
        await deleteLongVideoObjects(uploadedKeys);
      }
      setErrorMsg(cancelled ? 'Upload cancelled. Nothing was saved.' : (err.message || 'An error occurred during upload.'));
    } finally {
      abortRef.current = null;
      setStatus('');
      setProgress(IDLE_PROGRESS);
      setIsUploading(false);
    }
  };

  const warnings = videoFile && details
    ? longVideoWarnings({ width: details.width, height: details.height, durationMs: details.durationMs, sizeBytes: videoFile.size })
    : [];
  const percent = progress.total > 0 ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : 0;
  const showProgress = isUploading && status.startsWith('Uploading video');
  const titleLength = title.trim().length;

  return (
    <div className="glass-card" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <UploadCloud size={24} color="var(--primary)" />
        <h2 style={{ margin: 0, color: 'var(--text-main)' }}>Upload Long Video</h2>
      </div>

      {successMsg && (
        <div className="animate-fade-in" style={{ backgroundColor: '#ecfdf5', color: 'var(--success)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #10b98140' }}>
          <CheckCircle size={20} />
          {successMsg}
        </div>
      )}

      {warningMsg && (
        <div className="animate-fade-in" style={{ backgroundColor: '#fffbeb', color: '#b45309', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', border: '1px solid #fde68a' }}>
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <span>{warningMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="animate-fade-in" style={{ backgroundColor: '#fef2f2', color: 'var(--error)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', border: '1px solid #fecaca' }}>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="long-video-title">Title <span style={{ color: 'var(--error)' }}>*</span></label>
              <input
                id="long-video-title"
                type="text"
                className="form-input"
                value={title}
                maxLength={LONG_VIDEO_TITLE_MAX_LENGTH}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleTouched(true);
                }}
                placeholder="e.g. The Accidental Popsicle"
                disabled={isUploading}
              />
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Shown to kids in the app. {titleLength}/{LONG_VIDEO_TITLE_MAX_LENGTH}
              </p>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Video file <span style={{ color: 'var(--error)' }}>*</span> (MP4, landscape, 1280 x 720 recommended)</label>
              <div
                style={{ border: `2px dashed ${isDragging ? 'var(--primary)' : '#cbd5e1'}`, borderRadius: 'var(--radius-md)', padding: '1.5rem', textAlign: 'center', backgroundColor: isDragging ? '#f0f9ff' : '#f8fafc', transition: 'all 0.3s' }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={handleDrop}
              >
                <input ref={videoInputRef} type="file" id="long-video-upload" accept="video/mp4,.mp4" style={{ display: 'none' }} onChange={(e) => selectVideo(e.target.files?.[0])} disabled={isUploading} />
                <label htmlFor="long-video-upload" style={{ cursor: isUploading ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ backgroundColor: '#e2e8f0', padding: '1rem', borderRadius: '50%' }}>
                    <Film size={28} color="#64748b" />
                  </div>
                  <div>
                    <span style={{ color: 'var(--primary)', fontWeight: '600' }}>Click to choose</span> or drag and drop
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      {videoFile ? `${videoFile.name} • ${formatBytes(videoFile.size)}` : 'One .mp4 file. About 6 MB per minute at 720p is ideal.'}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {videoFile && details && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div><strong>Duration:</strong> {details.durationMs ? formatDuration(details.durationMs) : 'Unknown'} • <strong>Resolution:</strong> {details.width && details.height ? `${details.width} x ${details.height}` : 'Unknown'} • <strong>Size:</strong> {formatBytes(videoFile.size)}</div>
                {warnings.map((w) => (
                  <div key={w} style={{ display: 'flex', gap: '0.35rem', color: '#b45309' }}>
                    <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                    <span>{w}</span>
                  </div>
                ))}
                {details.decodeError && (
                  <div style={{ display: 'flex', gap: '0.35rem', color: '#b45309' }}>
                    <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                    <span>{details.decodeError} Check that it is an H.264 MP4 so it plays on every phone, or upload a thumbnail yourself.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {videoFile ? (
              <>
                <div>
                  <video ref={previewVideoRef} src={videoPreviewUrl} controls muted playsInline style={{ width: '100%', aspectRatio: '16 / 9', backgroundColor: '#000', borderRadius: 'var(--radius-sm)', objectFit: 'contain' }} />
                  <button type="button" onClick={captureCurrentFrameAsThumbnail} disabled={isUploading} style={{ marginTop: '0.4rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'transparent', border: 'none', padding: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', cursor: isUploading ? 'not-allowed' : 'pointer' }}>
                    <Camera size={14} /> Use the current frame as the thumbnail
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ width: '220px', flexShrink: 0, aspectRatio: '16 / 9', backgroundColor: '#0f172a', borderRadius: 'var(--radius-sm)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                    {isInspecting ? <Loader2 className="animate-spin" size={20} /> : posterPreviewUrl ? <img src={posterPreviewUrl} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : 'No thumbnail'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <strong style={{ color: 'var(--text-main)' }}>Thumbnail</strong>
                    <span>{customPoster ? customPosterLabel : 'Picked automatically from the video'}</span>
                    <input ref={posterInputRef} type="file" id="long-video-poster-upload" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => selectPoster(e.target.files?.[0])} disabled={isUploading} />
                    <label htmlFor="long-video-poster-upload" style={{ fontWeight: 600, color: 'var(--primary)', cursor: isUploading ? 'not-allowed' : 'pointer' }}>Upload an image instead</label>
                    {customPoster && !isUploading && (
                      <button type="button" onClick={() => { setCustomPoster(null); setCustomPosterLabel(''); if (posterInputRef.current) posterInputRef.current.value = ''; }} style={{ textAlign: 'left', background: 'transparent', border: 'none', padding: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}>
                        Back to automatic thumbnail
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ width: '100%', aspectRatio: '16 / 9', backgroundColor: '#f1f5f9', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                The preview appears here
              </div>
            )}
          </div>
        </div>

        {showProgress && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ height: '10px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: progress.indeterminate ? '100%' : `${percent}%`, background: 'linear-gradient(135deg, var(--primary), var(--secondary))', opacity: progress.indeterminate ? 0.5 : 1, transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>{progress.indeterminate ? 'Uploading in one piece...' : `${formatBytes(progress.loaded)} of ${formatBytes(progress.total)}`}</span>
              {!progress.indeterminate && <span>{percent}%</span>}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button type="submit" className="btn-primary" style={{ flex: 1, padding: '1rem' }} disabled={isUploading || isInspecting}>
            {isUploading ? (
              <><Loader2 className="animate-spin" size={20} /> {status ? `${status}...` : 'Uploading...'}</>
            ) : 'Upload Long Video'}
          </button>
          {isUploading && status.startsWith('Uploading') && (
            <button type="button" onClick={cancelUpload} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', padding: '0 1.25rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700 }}>
              <X size={18} /> Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
