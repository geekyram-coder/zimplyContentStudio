import React, { useState } from 'react';
import { Film, Eye, EyeOff, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { supabase, ensureSession } from '../supabaseClient';
import { deleteCheatStudyObjects } from '../utils/cheatStudyMedia';
import { formatBytes, formatDuration } from '../utils/videoProcessing';

const displayTitle = (video) => video.title || 'Untitled short';

const toNonNegativeInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

function ShortVideoCard({ video, onChanged, onError }) {
  const [busy, setBusy] = useState('');
  const [sortOrder, setSortOrder] = useState(String(video.sort_order ?? 0));
  const [isPlaying, setIsPlaying] = useState(false);

  const update = async (patch, label) => {
    setBusy(label);
    try {
      await ensureSession();
      const { error } = await supabase.from('cheat_study_videos').update(patch).eq('id', video.id);
      if (error) throw error;
      onChanged();
    } catch (err) {
      console.error('Cheat Study update failed:', err);
      onError(err.message || 'Could not update the video.');
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

  const remove = async () => {
    if (!window.confirm(`Delete "${displayTitle(video)}"? It disappears from the app and its files are removed from storage.`)) return;
    setBusy('delete');
    try {
      await ensureSession();
      const { error } = await supabase.from('cheat_study_videos').delete().eq('id', video.id);
      if (error) throw error;
      const failed = await deleteCheatStudyObjects([video.video_r2_key, video.poster_r2_key]);
      onChanged();
      if (failed.length > 0) onError(`Deleted the video, but these files could not be removed from R2: ${failed.join(', ')}`);
    } catch (err) {
      console.error('Cheat Study delete failed:', err);
      onError(err.message || 'Could not delete the video.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ width: '100%', aspectRatio: '9 / 16', borderRadius: 'var(--radius-md)', overflow: 'hidden', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isPlaying ? (
          <video src={video.video_url} poster={video.poster_url || undefined} controls autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <button type="button" onClick={() => setIsPlaying(true)} title="Play" style={{ width: '100%', height: '100%', border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }}>
            {video.poster_url ? (
              <img src={video.poster_url} alt={displayTitle(video)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <Film size={48} color="#94a3b8" />
            )}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>{displayTitle(video)}</h3>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '1rem', whiteSpace: 'nowrap', backgroundColor: video.is_published ? '#ecfdf5' : '#f1f5f9', color: video.is_published ? 'var(--success)' : 'var(--text-muted)' }}>
          {video.is_published ? 'Published' : 'Draft'}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Ages {Array.isArray(video.applicable_ages) && video.applicable_ages.length > 0 ? video.applicable_ages.join(', ') : 'all'}{video.subject ? ` • ${video.subject}` : ''} • {video.duration_ms ? formatDuration(video.duration_ms) : '--:--'} • {video.file_size_bytes ? formatBytes(video.file_size_bytes) : 'size unknown'} • {video.like_count} likes
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <label htmlFor={`sort-${video.id}`} style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Sort</label>
        <input id={`sort-${video.id}`} type="number" min="0" step="1" className="form-input" style={{ padding: '0.4rem 0.6rem', width: '90px' }} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} onBlur={saveSortOrder} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} disabled={!!busy} />
        {busy === 'sort' && <Loader2 className="animate-spin" size={16} />}
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

export default function ShortVideoList({ videos, loading, error, onRefresh, onError }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', margin: 0 }}>Shorts in Cheat Study ({videos.length})</h2>
        <button type="button" onClick={onRefresh} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', cursor: 'pointer', color: 'var(--text-main)', fontWeight: 600 }}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} /> Refresh
        </button>
      </div>

      {error ? (
        <div style={{ backgroundColor: '#fef2f2', color: 'var(--error)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid #fecaca' }}>{error}</div>
      ) : loading && videos.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)' }}>Loading shorts...</div>
      ) : videos.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)' }}>
          <Film size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
          <h3>No shorts yet</h3>
          <p>Upload a video above and it will show up in the app's Cheat Study screen.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
          {videos.map((video) => (
            <ShortVideoCard key={`${video.id}-${video.updated_at}`} video={video} onChanged={onRefresh} onError={onError} />
          ))}
        </div>
      )}
    </div>
  );
}
