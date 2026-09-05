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

  const [isDraggingThumb, setIsDraggingThumb] = useState(false);
  const [isUploadingThumb, setIsUploadingThumb] = useState(false);

  const handleThumbnailUpload = async (file) => {
    setIsUploadingThumb(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${deckId}-thumbnail-${Date.now()}.${fileExt}`;
    
    try {
      const { error: uploadError } = await supabase.storage
        .from('flashcards')
        .upload(fileName, file);
        
      if (uploadError) throw uploadError;
      
      const { data: publicUrlData } = supabase.storage
        .from('flashcards')
        .getPublicUrl(fileName);
        
      const newThumbnailUrl = publicUrlData.publicUrl;
      
      const { error: updateError } = await supabase
        .from('flashcard_decks')
        .update({ thumbnail_url: newThumbnailUrl })
        .eq('id', deckId);
        
      if (updateError) throw updateError;
      
      setDeck(prev => ({ ...prev, thumbnail_url: newThumbnailUrl }));
    } catch (err) {
      console.error('Error updating thumbnail:', err);
      alert('Failed to update thumbnail.');
    } finally {
      setIsUploadingThumb(false);
      setIsDraggingThumb(false);
    }
  };

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
            
            <div 
              className="glass-card" 
              style={{ 
                padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                border: isDraggingThumb ? '2px dashed var(--primary)' : '1px solid transparent',
                backgroundColor: isDraggingThumb ? 'rgba(38, 184, 245, 0.1)' : 'white'
              }}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingThumb(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDraggingThumb(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingThumb(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleThumbnailUpload(e.dataTransfer.files[0]);
                }
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Deck Thumbnail</span>
              <label style={{ width: '100%', aspectRatio: '1/1', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleThumbnailUpload(e.target.files[0]); }} />
                
                {isUploadingThumb ? (
                  <span style={{ color: 'var(--text-muted)' }}>Uploading...</span>
                ) : deck.thumbnail_url ? (
                  <>
                    <img src={deck.thumbnail_url} alt="Thumbnail" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.8rem', padding: '0.5rem', textAlign: 'center' }}>Click or Drop to Update</div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Update Thumbnail</p>
                    <p style={{ margin: 0, fontSize: '0.8rem' }}>Click or Drop Image</p>
                  </div>
                )}
              </label>
            </div>

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
