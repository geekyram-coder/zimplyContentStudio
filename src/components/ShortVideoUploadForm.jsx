import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UploadCloud, CheckCircle, Loader2, AlertTriangle, Film } from 'lucide-react';
import { supabase, ensureSession } from '../supabaseClient';
import {
  uploadCheatStudyVideo,
  uploadCheatStudyPoster,
  deleteCheatStudyObjects,
} from '../utils/cheatStudyMedia';
import {
  SHORT_VIDEO_MAX_BYTES,
  SHORT_POSTER_MAX_BYTES,
  inspectShortVideo,
  isMp4File,
  isPortraitShort,
  formatBytes,
  formatDuration,
} from '../utils/videoProcessing';

const SHORT_SUBJECTS = ['Science', 'Computer Science', 'History', 'Geography', 'Life Skills', 'Gen. Knowledge', 'Social Studies', 'English'];

// The age groups Content Studio publishes for. A new short is pre-filled
// with all of them; narrow it down to e.g. [8, 9, 10].
const AGE_GROUPS = [5, 6, 7, 8, 9, 10];
const ALL_AGES_TEXT = `[${AGE_GROUPS.join(', ')}]`;

const EMPTY_FORM = {
  agesText: ALL_AGES_TEXT,
  title: '',
  subject: '',
  description: '',
  likeCount: '',
  sortOrder: '',
  isPublished: true,
};

// Accepts "[8, 9, 10]" or "8, 9, 10". Returns { ages } or { error }.
const parseAges = (text) => {
  const body = String(text || '').trim().replace(/^\[/, '').replace(/\]$/, '').trim();
  if (!body) return { error: 'Please enter at least one age group, e.g. [8, 9, 10].' };
  const parts = body.split(/[\s,]+/).filter(Boolean);
  const ages = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part) || !AGE_GROUPS.includes(Number(part))) {
      return { error: `"${part}" is not an age group. Use ages from ${AGE_GROUPS[0]} to ${AGE_GROUPS[AGE_GROUPS.length - 1]}, e.g. [8, 9, 10].` };
    }
    if (!ages.includes(Number(part))) ages.push(Number(part));
  }
  return { ages: ages.sort((a, b) => a - b) };
};

// Optional whole numbers: blank means the default (0); anything else must be >= 0.
const toOptionalNonNegativeInt = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return 0;
  if (!/^\d+$/.test(text)) return null;
  return Number.parseInt(text, 10);
};

const newVideoId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

export default function ShortVideoUploadForm({ onUploaded }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [details, setDetails] = useState(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [customPoster, setCustomPoster] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const videoInputRef = useRef(null);
  const posterInputRef = useRef(null);

  const posterBlob = customPoster || details?.posterBlob || null;

  const posterPreviewUrl = useMemo(() => (posterBlob ? URL.createObjectURL(posterBlob) : ''), [posterBlob]);

  useEffect(() => () => {
    if (posterPreviewUrl) URL.revokeObjectURL(posterPreviewUrl);
  }, [posterPreviewUrl]);

  useEffect(() => () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
  }, [videoPreviewUrl]);

  const updateField = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetFiles = () => {
    setVideoFile(null);
    setVideoPreviewUrl('');
    setDetails(null);
    setCustomPoster(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (posterInputRef.current) posterInputRef.current.value = '';
  };

  const selectVideo = async (file) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!file) return;
    if (!isMp4File(file)) {
      setErrorMsg('Please choose an MP4 video (.mp4). Other formats do not play reliably on every phone.');
      return;
    }
    if (file.size > SHORT_VIDEO_MAX_BYTES) {
      setErrorMsg(`This video is ${formatBytes(file.size)}. The limit is ${formatBytes(SHORT_VIDEO_MAX_BYTES)}.`);
      return;
    }

    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
    setDetails(null);
    setCustomPoster(null);

    setIsInspecting(true);
    try {
      setDetails(await inspectShortVideo(file));
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
      setErrorMsg('The poster must be a PNG or JPEG image.');
      return;
    }
    if (file.size > SHORT_POSTER_MAX_BYTES) {
      setErrorMsg(`The poster is ${formatBytes(file.size)}. The limit is ${formatBytes(SHORT_POSTER_MAX_BYTES)}.`);
      return;
    }
    setCustomPoster(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) selectVideo(file);
  };

  const validate = () => {
    if (!videoFile) return 'Please choose the short video to upload.';
    if (isInspecting) return 'Still reading the video, please wait a moment.';
    const { error: agesError } = parseAges(form.agesText);
    if (agesError) return agesError;
    if (toOptionalNonNegativeInt(form.likeCount) === null) return 'Like count must be a whole number of 0 or more (or left empty).';
    if (toOptionalNonNegativeInt(form.sortOrder) === null) return 'Sort order must be a whole number of 0 or more (or left empty).';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setErrorMsg(problem);
      return;
    }

    setIsUploading(true);
    setErrorMsg('');
    setSuccessMsg('');
    const videoId = newVideoId();
    const uploadedKeys = [];
    const { ages } = parseAges(form.agesText);
    const title = form.title.trim();

    try {
      await ensureSession();

      setStatus(`Uploading video (${formatBytes(videoFile.size)}) to Cloudflare R2...`);
      const video = await uploadCheatStudyVideo(videoId, videoFile);
      uploadedKeys.push(video.key);

      let poster = null;
      if (posterBlob) {
        setStatus('Uploading poster...');
        poster = await uploadCheatStudyPoster(videoId, posterBlob);
        uploadedKeys.push(poster.key);
      }

      setStatus('Saving to Supabase...');
      const { error } = await supabase.from('cheat_study_videos').insert({
        id: videoId,
        applicable_ages: ages,
        title: title || null,
        subject: form.subject.trim() || null,
        description: form.description.trim() || null,
        video_url: video.url,
        video_r2_key: video.key,
        poster_url: poster ? poster.url : null,
        poster_r2_key: poster ? poster.key : null,
        mime_type: 'video/mp4',
        duration_ms: details?.durationMs ?? null,
        width: details?.width ?? null,
        height: details?.height ?? null,
        file_size_bytes: videoFile.size,
        like_count: toOptionalNonNegativeInt(form.likeCount),
        sort_order: toOptionalNonNegativeInt(form.sortOrder),
        is_published: form.isPublished,
      });
      if (error) throw error;

      setSuccessMsg(`Uploaded ${title ? `"${title}"` : 'the short'} for ages ${ages.join(', ')}${form.isPublished ? ' and published it to Cheat Study' : ' as a draft'}.`);
      setForm(EMPTY_FORM);
      resetFiles();
      if (onUploaded) onUploaded();
    } catch (err) {
      console.error('Cheat Study upload failed:', err);
      if (uploadedKeys.length > 0) {
        setStatus('Cleaning up partial upload...');
        await deleteCheatStudyObjects(uploadedKeys);
      }
      setErrorMsg(err.message || 'An error occurred during upload.');
    } finally {
      setStatus('');
      setIsUploading(false);
    }
  };

  const agesCheck = parseAges(form.agesText);
  const isPortrait = details?.width && details?.height ? isPortraitShort(details.width, details.height) : true;

  return (
    <div className="glass-card" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <UploadCloud size={24} color="var(--primary)" />
        <h2 style={{ margin: 0, color: 'var(--text-main)' }}>Upload Shorts Video</h2>
      </div>

      {successMsg && (
        <div className="animate-fade-in" style={{ backgroundColor: '#ecfdf5', color: 'var(--success)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #10b98140' }}>
          <CheckCircle size={20} />
          {successMsg}
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
              <label className="form-label" htmlFor="short-ages">Age groups <span style={{ color: 'var(--error)' }}>*</span></label>
              <input id="short-ages" type="text" className="form-input" style={{ fontFamily: 'monospace', borderColor: agesCheck.error ? 'var(--error)' : undefined }} value={form.agesText} onChange={updateField('agesText')} placeholder={ALL_AGES_TEXT} disabled={isUploading} />
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: agesCheck.error ? 'var(--error)' : 'var(--text-muted)' }}>
                {agesCheck.error || `Kids aged ${agesCheck.ages.join(', ')} will see this short. Pre-filled with every age group; change it to e.g. [8, 9, 10].`}
              </p>
            </div>

            <details style={{ border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', backgroundColor: '#f8fafc' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)' }}>Optional details</summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="short-title">Title</label>
                  <input id="short-title" type="text" className="form-input" value={form.title} onChange={updateField('title')} placeholder="e.g. Why is the sky blue?" disabled={isUploading} />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="short-subject">Subject (shown on the chip in the app)</label>
                  <input id="short-subject" type="text" className="form-input" list="short-subjects" value={form.subject} onChange={updateField('subject')} placeholder="e.g. Science" disabled={isUploading} />
                  <datalist id="short-subjects">
                    {SHORT_SUBJECTS.map((s) => <option key={s} value={s} />)}
                  </datalist>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="short-description">Description</label>
                  <textarea id="short-description" className="form-input" style={{ minHeight: '80px', resize: 'vertical' }} value={form.description} onChange={updateField('description')} disabled={isUploading} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="short-likes">Starting like count</label>
                    <input id="short-likes" type="number" min="0" step="1" className="form-input" value={form.likeCount} onChange={updateField('likeCount')} placeholder="0" disabled={isUploading} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="short-sort">Sort order</label>
                    <input id="short-sort" type="number" min="0" step="1" className="form-input" value={form.sortOrder} onChange={updateField('sortOrder')} placeholder="0" disabled={isUploading} />
                  </div>
                </div>
                <p style={{ margin: '-0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Lower sort order shows first in the app. Ties show the newest upload first.</p>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.isPublished} onChange={updateField('isPublished')} disabled={isUploading} />
                  Publish immediately (uncheck to save as a draft the app will not show)
                </label>
              </div>
            </details>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Video file <span style={{ color: 'var(--error)' }}>*</span> (MP4, 9:16 portrait, 720 x 1280 recommended)</label>
              <div
                style={{ border: `2px dashed ${isDragging ? 'var(--primary)' : '#cbd5e1'}`, borderRadius: 'var(--radius-md)', padding: '1.5rem', textAlign: 'center', backgroundColor: isDragging ? '#f0f9ff' : '#f8fafc', transition: 'all 0.3s' }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={handleDrop}
              >
                <input ref={videoInputRef} type="file" id="short-video-upload" accept="video/mp4,.mp4" style={{ display: 'none' }} onChange={(e) => selectVideo(e.target.files?.[0])} disabled={isUploading} />
                <label htmlFor="short-video-upload" style={{ cursor: isUploading ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ backgroundColor: '#e2e8f0', padding: '1rem', borderRadius: '50%' }}>
                    <Film size={28} color="#64748b" />
                  </div>
                  <div>
                    <span style={{ color: 'var(--primary)', fontWeight: '600' }}>Click to choose</span> or drag and drop
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      {videoFile ? `${videoFile.name} • ${formatBytes(videoFile.size)}` : `One .mp4 file, up to ${formatBytes(SHORT_VIDEO_MAX_BYTES)}`}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {videoFile && (
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ width: '160px', flexShrink: 0 }}>
                  <video src={videoPreviewUrl} controls muted playsInline style={{ width: '160px', aspectRatio: '9 / 16', backgroundColor: '#000', borderRadius: 'var(--radius-sm)', objectFit: 'contain' }} />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.25rem' }}>Video</div>
                </div>
                <div style={{ width: '160px', flexShrink: 0 }}>
                  <div style={{ width: '160px', aspectRatio: '9 / 16', backgroundColor: '#0f172a', borderRadius: 'var(--radius-sm)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                    {isInspecting ? <Loader2 className="animate-spin" size={20} /> : posterPreviewUrl ? <img src={posterPreviewUrl} alt="Poster" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : 'No poster'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.25rem' }}>{customPoster ? 'Custom poster' : 'Poster (first frame)'}</div>
                  <input ref={posterInputRef} type="file" id="short-poster-upload" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => selectPoster(e.target.files?.[0])} disabled={isUploading} />
                  <label htmlFor="short-poster-upload" style={{ display: 'block', textAlign: 'center', marginTop: '0.25rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>Replace poster</label>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {details && (
                    <>
                      <div><strong>Duration:</strong> {details.durationMs ? formatDuration(details.durationMs) : 'Unknown'}</div>
                      <div><strong>Size:</strong> {details.width && details.height ? `${details.width} x ${details.height}` : 'Unknown'}</div>
                    </>
                  )}
                  {details && !isPortrait && (
                    <div style={{ display: 'flex', gap: '0.35rem', color: '#b45309' }}>
                      <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                      <span>This video is not 9:16 portrait. The app will show it with black bars.</span>
                    </div>
                  )}
                  {details?.decodeError && (
                    <div style={{ display: 'flex', gap: '0.35rem', color: '#b45309' }}>
                      <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                      <span>{details.decodeError} Check that it is H.264 MP4 so it plays on every phone, or add a poster image yourself.</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <button type="submit" className="btn-primary" style={{ width: '100%', padding: '1rem', marginTop: '1.5rem' }} disabled={isUploading || isInspecting}>
          {isUploading ? (
            <><Loader2 className="animate-spin" size={20} /> {status || 'Uploading...'}</>
          ) : 'Upload Shorts Video'}
        </button>
      </form>
    </div>
  );
}
