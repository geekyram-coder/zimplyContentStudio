import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, LogOut, BookOpen, Volume2 } from 'lucide-react';

export default function QuickBookViewPage({ onLogout }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quickbook, setQuickbook] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchQuickbookAndPages() {
      setLoading(true);
      
      const { data: qbData, error: qbError } = await supabase
        .from('quickbooks')
        .select('*')
        .eq('id', id)
        .single();
        
      if (qbError) {
        console.error('Error fetching quickbook:', qbError);
      } else {
        setQuickbook(qbData);
        
        const { data: pagesData, error: pagesError } = await supabase
          .from('quickbook_pages')
          .select('*')
          .eq('quickbook_id', id)
          .order('page_index', { ascending: true });
          
        if (pagesError) {
          console.error('Error fetching pages:', pagesError);
        } else {
          setPages(pagesData || []);
        }
      }
      
      setLoading(false);
    }

    fetchQuickbookAndPages();
  }, [id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="glass" style={{ margin: '1.5rem', padding: '1rem 2rem', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontFamily: 'inherit' }}>
            <ArrowLeft size={20} /> Back
          </button>
          <div style={{ height: '24px', width: '1px', backgroundColor: '#e2e8f0' }}></div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>{quickbook ? quickbook.title : 'Loading...'}</h1>
        </div>
        
        <button 
          onClick={onLogout}
          style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
        >
          <LogOut size={20} />
        </button>
      </header>

      <main style={{ flex: 1, padding: '0 1.5rem 2rem 1.5rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--text-muted)' }}>Loading quickbook pages...</div>
        ) : !quickbook ? (
          <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--error)' }}>Quickbook not found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h2 style={{ margin: '0 0 1rem 0' }}>{quickbook.title}</h2>
              <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)' }}><strong>Description:</strong> {quickbook.description}</p>
              <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <span><strong>Format:</strong> {quickbook.format_type}</span>
                <span><strong>Vibe:</strong> {quickbook.vibe}</span>
                <span><strong>Difficulty:</strong> {quickbook.difficulty}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {pages.map((page) => (
                <div key={page.id} className="glass-card" style={{ display: 'flex', padding: '1.5rem', gap: '2rem', alignItems: 'center' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>
                    {page.page_index}
                  </div>
                  
                  <div style={{ flex: 1, fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {Array.isArray(page.left_text) 
                      ? page.left_text.filter(item => !item.isMask).map((item, i) => (
                          <div key={i} dangerouslySetInnerHTML={{ __html: item.text }} />
                        ))
                      : String(page.left_text)}
                  </div>

                  {page.image_url && (
                    <div style={{ width: '300px', height: '300px', flexShrink: 0, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      <img src={page.image_url} alt={`Page ${page.page_index}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}

                  <div style={{ flex: 1, fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {Array.isArray(page.right_text) 
                      ? page.right_text.filter(item => !item.isMask).map((item, i) => (
                          <div key={i} dangerouslySetInnerHTML={{ __html: item.text }} />
                        ))
                      : String(page.right_text)}
                  </div>

                  {page.audio_url && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                      <Volume2 size={24} color="var(--primary)" />
                      <audio controls src={page.audio_url} style={{ width: '200px' }}></audio>
                    </div>
                  )}
                </div>
              ))}
              
              {pages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No pages found for this quickbook.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
