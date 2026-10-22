import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LogOut } from 'lucide-react';
import { supabase, ensureSession } from '../supabaseClient';
import LongVideoUploadForm from '../components/LongVideoUploadForm';
import LongVideoList from '../components/LongVideoList';

export default function LongVideosPage({ onLogout }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [actionError, setActionError] = useState('');

  const fetchVideos = useCallback(async () => {
    try {
      // Signed in as the admin so drafts are listed too (RLS hides them otherwise).
      await ensureSession();
      const { data, error } = await supabase
        .from('long_videos')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setVideos(data || []);
      setListError('');
    } catch (err) {
      console.error('Error fetching long videos:', err);
      setListError(err.message || 'Could not load the long videos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const refresh = useCallback(() => {
    setActionError('');
    setLoading(true);
    fetchVideos();
  }, [fetchVideos]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="glass" style={{ margin: '1.5rem', padding: '1rem 2rem', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/" style={{ color: 'var(--text-main)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={20} /> Back to Dashboard
          </Link>
          <div style={{ height: '24px', width: '1px', backgroundColor: '#e2e8f0' }}></div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>Long Videos</h1>
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
          >
            <LogOut size={20} />
          </button>
        )}
      </header>

      <main style={{ flex: 1, padding: '0 1.5rem 2rem 1.5rem', maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="animate-fade-in delay-1">
          <LongVideoUploadForm onUploaded={refresh} />
        </div>

        <div className="animate-fade-in delay-2">
          {actionError && (
            <div style={{ backgroundColor: '#fef2f2', color: 'var(--error)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid #fecaca', marginBottom: '1rem' }}>
              {actionError}
            </div>
          )}
          <LongVideoList videos={videos} loading={loading} error={listError} onRefresh={refresh} onError={setActionError} />
        </div>
      </main>
    </div>
  );
}
