import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, LogOut } from 'lucide-react';
import { uploadFileToR2 } from '../r2Client';
import { resizeImageToPng } from '../utils/imageProcessing';


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
  const [uploadingCards, setUploadingCards] = useState({});
  const [draggingCards, setDraggingCards] = useState({});

  const [showAddCard, setShowAddCard] = useState(false);
  const [newCardOrder, setNewCardOrder] = useState('');
  const [newCardFile, setNewCardFile] = useState(null);
  const [isAddingCard, setIsAddingCard] = useState(false);

  const handleCardImageUpload = async (file, cardId, orderIndex) => {
    setUploadingCards(prev => ({ ...prev, [cardId]: true }));
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${deckId}-card-${orderIndex}-${Date.now()}.${fileExt}`;
    const originalKey = `flashcards/cards/${fileName}`;
    
    try {
      await uploadFileToR2(file, originalKey, file.type);
      
      const resizedBlob = await resizeImageToPng(file);
      const lastDotIdx = originalKey.lastIndexOf('.');
      const baseKey = lastDotIdx > -1 ? originalKey.substring(0, lastDotIdx) : originalKey;
      const derivedKey = `derived/w720/${baseKey}.png`;
      
      const newImageUrl = await uploadFileToR2(resizedBlob, derivedKey, 'image/png');
      
      const { error: updateError } = await supabase
        .from('flashcards')
        .update({ image_url: newImageUrl })
        .eq('id', cardId);
        
      if (updateError) throw updateError;
      
      setCards(prevCards => prevCards.map(c => c.id === cardId ? { ...c, image_url: newImageUrl } : c));
    } catch (err) {
      console.error('Error updating card image:', err);
      alert('Failed to update card image.');
    } finally {
      setUploadingCards(prev => ({ ...prev, [cardId]: false }));
      setDraggingCards(prev => ({ ...prev, [cardId]: false }));
    }
  };

  const handleAddCard = async () => {
    if (!newCardOrder || !newCardFile) {
      alert('Please provide both order number and image.');
      return;
    }
    
    setIsAddingCard(true);
    
    const orderNum = parseFloat(newCardOrder);
    
    const fileExt = newCardFile.name.split('.').pop();
    const fileName = `${deckId}-card-${orderNum}-${Date.now()}.${fileExt}`;
    const originalKey = `flashcards/cards/${fileName}`;
    
    try {
      await uploadFileToR2(newCardFile, originalKey, newCardFile.type);
      
      const resizedBlob = await resizeImageToPng(newCardFile);
      const lastDotIdx = originalKey.lastIndexOf('.');
      const baseKey = lastDotIdx > -1 ? originalKey.substring(0, lastDotIdx) : originalKey;
      const derivedKey = `derived/w720/${baseKey}.png`;
      
      const newImageUrl = await uploadFileToR2(resizedBlob, derivedKey, 'image/png');
      
      const { data: insertedCard, error: insertError } = await supabase
        .from('flashcards')
        .insert([{ 
          deck_id: deckId, 
          order_index: orderNum, 
          image_url: newImageUrl 
        }])
        .select()
        .single();
        
      if (insertError) throw insertError;
      
      setCards(prevCards => {
        const updated = [...prevCards, insertedCard];
        updated.sort((a, b) => a.order_index - b.order_index);
        return updated;
      });
      
      setShowAddCard(false);
      setNewCardOrder('');
      setNewCardFile(null);
      
    } catch (err) {
      console.error('Error adding new card:', err);
      alert('Failed to add new card.');
    } finally {
      setIsAddingCard(false);
    }
  };

  const handleThumbnailUpload = async (file) => {
    setIsUploadingThumb(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${deckId}-thumbnail-${Date.now()}.${fileExt}`;
    const originalKey = `flashcards/thumbnails/${fileName}`;
    
    try {
      await uploadFileToR2(file, originalKey, file.type);
      
      const resizedBlob = await resizeImageToPng(file);
      const lastDotIdx = originalKey.lastIndexOf('.');
      const baseKey = lastDotIdx > -1 ? originalKey.substring(0, lastDotIdx) : originalKey;
      const derivedKey = `derived/w720/${baseKey}.png`;
      
      const newThumbnailUrl = await uploadFileToR2(resizedBlob, derivedKey, 'image/png');
      
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
              <div 
                key={card.id} 
                className="glass-card" 
                style={{ 
                  padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                  border: draggingCards[card.id] ? '2px dashed var(--primary)' : '1px solid transparent',
                  backgroundColor: draggingCards[card.id] ? 'rgba(38, 184, 245, 0.1)' : 'white'
                }}
                onDragOver={(e) => { e.preventDefault(); setDraggingCards(prev => ({ ...prev, [card.id]: true })); }}
                onDragLeave={(e) => { e.preventDefault(); setDraggingCards(prev => ({ ...prev, [card.id]: false })); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDraggingCards(prev => ({ ...prev, [card.id]: false }));
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleCardImageUpload(e.dataTransfer.files[0], card.id, card.order_index);
                  }
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Card {card.order_index}</span>
                <label style={{ width: '100%', aspectRatio: '1/1', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleCardImageUpload(e.target.files[0], card.id, card.order_index); }} />
                  {uploadingCards[card.id] ? (
                    <span style={{ color: 'var(--text-muted)' }}>Uploading...</span>
                  ) : (
                    <>
                      <img src={card.image_url} alt={`Card ${card.order_index}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.8rem', padding: '0.5rem', textAlign: 'center', opacity: 0, transition: 'opacity 0.2s', ':hover': { opacity: 1 } }} onMouseEnter={(e) => e.currentTarget.style.opacity = 1} onMouseLeave={(e) => e.currentTarget.style.opacity = 0}>
                        Click or Drop to Update
                      </div>
                    </>
                  )}
                </label>
              </div>
            ))}

            <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', justifyContent: 'center', border: '2px dashed #cbd5e1' }}>
              {!showAddCard ? (
                <button 
                  onClick={() => setShowAddCard(true)}
                  style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600 }}
                >
                  + Add Card
                </button>
              ) : (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <input 
                    type="number" 
                    step="0.1" 
                    placeholder="Order Number (e.g., 2.1)" 
                    value={newCardOrder}
                    onChange={(e) => setNewCardOrder(e.target.value)}
                    style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0', width: '100%' }}
                  />
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => { if (e.target.files && e.target.files.length > 0) setNewCardFile(e.target.files[0]); }}
                    style={{ fontSize: '0.875rem' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={handleAddCard}
                      disabled={isAddingCard}
                      style={{ flex: 1, background: 'var(--primary)', color: 'white', border: 'none', padding: '0.5rem', borderRadius: 'var(--radius-sm)', cursor: isAddingCard ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                    >
                      {isAddingCard ? 'Saving...' : 'Save'}
                    </button>
                    <button 
                      onClick={() => { setShowAddCard(false); setNewCardOrder(''); setNewCardFile(null); }}
                      disabled={isAddingCard}
                      style={{ flex: 1, background: 'transparent', color: 'var(--text-main)', border: '1px solid #e2e8f0', padding: '0.5rem', borderRadius: 'var(--radius-sm)', cursor: isAddingCard ? 'not-allowed' : 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
