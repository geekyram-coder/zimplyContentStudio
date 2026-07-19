import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, LogOut, Layers } from 'lucide-react';

export default function DecksPage({ onLogout }) {
  const { subject, age } = useParams();
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDecks() {
      setLoading(true);
      const { data, error } = await supabase
        .from('flashcard_decks')
        .select('*')
        .eq('subject', subject)
        .contains('applicable_ages', [parseInt(age)])
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching decks:', error);
      } else {
        setDecks(data || []);
      }
      setLoading(false);
    }

    fetchDecks();
  }, [subject, age]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="glass" style={{ margin: '1.5rem', padding: '1rem 2rem', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/" style={{ color: 'var(--text-main)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={20} /> Back to Dashboard
          </Link>
          <div style={{ height: '24px', width: '1px', backgroundColor: '#e2e8f0' }}></div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>{subject} Flashcards (Age {age})</h1>
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
          <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--text-muted)' }}>Loading decks...</div>
        ) : decks.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--text-muted)' }}>
            <Layers size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
            <h3>No decks found</h3>
            <p>Upload some flashcards for {subject} Age {age} to see them here.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {decks.map(deck => (
              <Link 
                to={`/deck/${deck.id}`} 
                key={deck.id} 
                className="glass-card" 
                style={{ textDecoration: 'none', color: 'inherit', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: 'var(--radius-md)', overflow: 'hidden', backgroundColor: '#f1f5f9' }}>
                  {deck.thumbnail_url ? (
                    <img src={deck.thumbnail_url} alt={deck.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Layers size={32} color="#cbd5e1" />
                    </div>
                  )}
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', textAlign: 'center' }}>{deck.title}</h3>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
