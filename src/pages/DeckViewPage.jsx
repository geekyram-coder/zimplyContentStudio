import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, LogOut } from 'lucide-react';

export default function DeckViewPage({ onLogout }) {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDeckAndCards() {
      setLoading(true);
      
      const { data: deckData, error: deckError } = await supabase
        .from('flashcard_decks')
        .select('*')
        .eq('id', deckId)
        .single();
        
      if (deckError) {
        console.error('Error fetching deck:', deckError);
      } else {
        setDeck(deckData);
        
        const { data: cardsData, error: cardsError } = await supabase
          .from('flashcards')
          .select('*')
          .eq('deck_id', deckId)
          .order('order_index', { ascending: true });
          
        if (cardsError) {
          console.error('Error fetching cards:', cardsError);
        } else {
          setCards(cardsData || []);
        }
      }
      
      setLoading(false);
    }

    fetchDeckAndCards();
  }, [deckId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="glass" style={{ margin: '1.5rem', padding: '1rem 2rem', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontFamily: 'inherit' }}>
            <ArrowLeft size={20} /> Back
          </button>
          <div style={{ height: '24px', width: '1px', backgroundColor: '#e2e8f0' }}></div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>{deck ? deck.title : 'Loading...'}</h1>
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
          <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--text-muted)' }}>Loading flashcards...</div>
        ) : !deck ? (
          <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--error)' }}>Deck not found.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
            {cards.map(card => (
              <div key={card.id} className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Card {card.order_index}</span>
                <div style={{ width: '100%', aspectRatio: '1/1', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                  <img src={card.image_url} alt={`Card ${card.order_index}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
