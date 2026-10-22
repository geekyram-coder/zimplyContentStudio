import React, { useState } from 'react';
import { Film, Eye, EyeOff, Trash2, Loader2, RefreshCw, Pencil, Check, X, Link2 } from 'lucide-react';
import { supabase, ensureSession } from '../supabaseClient';
import { deleteLongVideoObjects } from '../utils/longVideoMedia';
import { LONG_VIDEO_TITLE_MAX_LENGTH } from '../utils/longVideoProcessing';
import { formatBytes, formatDuration } from '../utils/videoProcessing';

const toNonNegativeInt = (value) => {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  return Number.parseInt(text, 10);
};

function LongVideoCard({ video, onChanged, onError }) {
  const [busy, setBusy] = useState('');
  const [sortOrder, setSortOrder] = useState(String(video.sort_order ?? 0));
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(video.title);
  const [copied, setCopied] = useState(false);

  const update = async (patch, label) => {
    setBusy(label);
    try {
      await ensureSession();
      const { error } = await supabase.from('long_videos').update(patch).eq('id', video.id);
      if (error) throw error;
      onChanged();
      return true;
    } catch (err) {
      console.error('Long video update failed:', err);
      onError(err.message || 'Could not update the video.');
      return false;
    } finally {
      setBusy('');
    }
  };

  const saveSortOrder = () => {
    const next = toNonNegativeInt(sortOrder);
    if (next === null) {
      setSortOrder(String(video.sort_order ?? 0));
      onError('Sort order must be a whole number of 0 or more.');
      return;
    }
    if (next !== video.sort_order) update({ sort_order: next }, 'sort');
  };

  const saveTitle = async () => {
    const next = titleDraft.trim();
    if (!next) {
      onError('The title cannot be empty.');
      return;
    }
    if (next.length > LONG_VIDEO_TITLE_MAX_LENGTH) {
      onError(`The title can be at most ${LONG_VIDEO_TITLE_MAX_LENGTH} characters.`);
      return;
    }
    if (next === video.title) {
      setIsEditingTitle(false);
      return;
    }
    if (await update({ title: next }, 'title')) setIsEditingTitle(false);
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(video.video_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      onError(`Could not copy. The video URL is ${video.video_url}`);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${video.title}"? It disappears from the app and its files are removed from storage.`)) return;
    setBusy('delete');
    try {
      await ensureSession();
      const { error } = await supabase.from('long_videos').delete().eq('id', video.id);
      if (error) throw error;
      const failed = await deleteLongVideoObjects([video.video_r2_key, video.poster_r2_key]);
      onChanged();
      if (failed.length > 0) onError(`Deleted the video, but these files could not be removed from R2: ${failed.join(', ')}`);
    } catch (err) {
      console.error('Long video delete failed:', err);
      onError(err.message || 'Could not delete the video.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--radius-md)', overflow: 'hidden', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isPlaying ? (
          <video src={video.video_url} poster={video.poster_url || undefined} controls autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <button type="button" onClick={() => setIsPlaying(true)} title="Play" style={{ width: '100%', height: '100%', border: 'none', padding: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {video.poster_url ? (
              <img src={video.poster_url} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <Film size={48} color="#94a3b8" />
            )}
          </button>
        )}
      </div>

      {isEditingTitle ? (
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <input
            type="text"
            className="form-input"
            style={{ padding: '0.4rem 0.6rem' }}
            value={titleDraft}
            maxLength={LONG_VIDEO_TITLE_MAX_LENGTH}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTitle();
              if (e.key === 'Escape') { setTitleDraft(video.title); setIsEditingTitle(false); }
            }}
            disabled={!!busy}
            autoFocus
            aria-label="Video title"
          />
          <button type="button" onClick={saveTitle} disabled={!!busy} title="Save title" style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.45rem', cursor: 'pointer', display: 'flex' }}>
            {busy === 'title' ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
          </button>
          <button type="button" onClick={() => { setTitleDraft(video.title); setIsEditingTitle(false); }} disabled={!!busy} title="Cancel" style={{ background: '#f1f5f9', color: 'var(--text-main)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.45rem', cursor: 'pointer', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {video.title}
            <button type="button" onClick={() => setIsEditingTitle(true)} disabled={!!busy} title="Rename" style={{ background: 'transparent', border: 'none', padding: '0.15rem', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
              <Pencil size={14} />
            </button>
          </h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '1rem', whiteSpace: 'nowrap', backgroundColor: video.is_published ? '#ecfdf5' : '#f1f5f9', color: video.is_published ? 'var(--success)' : 'var(--text-muted)' }}>
            {video.is_published ? 'Published' : 'Draft'}
          </span>
        </div>
      )}

      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        {video.duration_ms ? formatDuration(video.duration_ms) : '--:--'} • {video.width && video.height ? `${video.width} x ${video.height}` : 'size unknown'} • {video.file_size_bytes ? formatBytes(video.file_size_bytes) : 'file size unknown'} • {new Date(video.created_at).toLocaleDateString()}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <label htmlFor={`long-sort-${video.id}`} style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Sort</label>
        <input id={`long-sort-${video.id}`} type="number" min="0" step="1" className="form-input" style={{ padding: '0.4rem 0.6rem', width: '90px' }} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} onBlur={saveSortOrder} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} disabled={!!busy} />
        {busy === 'sort' && <Loader2 className="animate-spin" size={16} />}
        <button type="button" onClick={copyUrl} title={video.video_url} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
          {copied ? <Check size={14} /> : <Link2 size={14} />} {copied ? 'Copied' : 'Copy URL'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" onClick={() => update({ is_published: !video.is_published }, 'publish')} disabled={!!busy} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', backgroundColor: video.is_published ? '#f1f5f9' : 'var(--primary)', color: video.is_published ? 'var(--text-main)' : 'white', border: 'none', padding: '0.5rem', borderRadius: 'var(--radius-sm)', cursor: busy ? 'not-allowed' : 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
          {busy === 'publish' ? <Loader2 className="animate-spin" size={16} /> : video.is_published ? <EyeOff size={16} /> : <Eye size={16} />}
          {video.is_published ? 'Unpublish' : 'Publish'}
        </button>
        <button type="button" onClick={remove} disabled={!!busy} title="Delete" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', cursor: busy ? 'not-allowed' : 'pointer' }}>
          {busy === 'delete' ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
        </button>
      </div>
    </div>
  );
}

export default function LongVideoList({ videos, loading, error, onRefresh, onError }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', margin: 0 }}>Long Videos ({videos.length})</h2>
        <button type="button" onClick={onRefresh} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', cursor: 'pointer', color: 'var(--text-main)', fontWeight: 600 }}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} /> Refresh
        </button>
      </div>

      {error ? (
        <div style={{ backgroundColor: '#fef2f2', color: 'var(--error)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid #fecaca' }}>{error}</div>
      ) : loading && videos.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)' }}>Loading long videos...</div>
      ) : videos.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)' }}>
          <Film size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
          <h3>No long videos yet</h3>
          <p>Upload a video above and it will be saved for the app.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {videos.map((video) => (
            <LongVideoCard key={`${video.id}-${video.updated_at}`} video={video} onChanged={onRefresh} onError={onError} />
          ))}
        </div>
      )}
    </div>
  );
}
