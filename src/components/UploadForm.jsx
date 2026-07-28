import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';


const CONTENT_TYPES = ['Quickbooks', 'Flashcards', 'Quizzes'];
const FLASHCARD_TYPES = ['Cover Card', 'Story Card', 'Think Card', 'Guess Card', 'Celebration Card', 'Imagination Card', 'Challenge Card'];

export default function UploadForm() {
  const navigate = useNavigate();
  
  const [contentType, setContentType] = useState('Flashcards');
  const [metadataJson, setMetadataJson] = useState('');
  
  const [files, setFiles] = useState([]);
  const [groupedCards, setGroupedCards] = useState([]);
  
  const [isUploading, setIsUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  

  const [isDragging, setIsDragging] = useState(false);

  const processFiles = (selectedFiles) => {
    setFiles(selectedFiles);

    if (contentType === 'Flashcards') {
      let cards = {};
      selectedFiles.forEach(file => {
        const match = file.name.match(/^(\d+|t)([fb])?\./i);
        if (match) {
          const num = match[1].toLowerCase();
          const side = match[2]?.toLowerCase();
          
          if (!cards[num]) cards[num] = { number: num, type: 'Story Card', files: {}, previews: {} };
          
          const previewUrl = URL.createObjectURL(file);
          
          if (side === 'f') {
            cards[num].files.front = file;
            cards[num].previews.front = previewUrl;
          } else if (side === 'b') {
            cards[num].files.back = file;
            cards[num].previews.back = previewUrl;
          } else {
            cards[num].files.single = file;
            cards[num].previews.single = previewUrl;
          }
        } else {
          const randomId = Math.random().toString(36).substr(2, 9);
          cards[randomId] = { number: '?', type: 'Story Card', files: { single: file }, previews: { single: URL.createObjectURL(file) } };
        }
      });
      
      const parsedCards = Object.values(cards).sort((a, b) => {
        if (a.number === 't') return -1;
        if (b.number === 't') return 1;
        const numA = parseInt(a.number);
        const numB = parseInt(b.number);
        if (isNaN(numA)) return 1;
        if (isNaN(numB)) return -1;
        return numA - numB;
      });

      parsedCards.forEach((c, idx) => {
        if (c.number === 't') return;
        
        if (c.number === '0') {
          c.type = 'Cover Card';
        } else if (idx === parsedCards.length - 1) {
          c.type = 'Celebration Card';
        } else if (c.files.front || c.files.back) {
          c.type = 'Think Card';
        }
      });
      
      setGroupedCards(parsedCards);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const updateCardType = (index, newType) => {
    const updated = [...groupedCards];
    updated[index].type = newType;
    setGroupedCards(updated);
  };

  const uploadFileToSupabase = async (file, path) => {
    const { data, error } = await supabase.storage.from('flashcards').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data: publicUrlData } = supabase.storage.from('flashcards').getPublicUrl(path);
    return publicUrlData.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      alert("Please select files to upload.");
      return;
    }
    
    if (!metadataJson.trim()) {
      alert("Please enter the metadata JSON.");
      return;
    }
    
    let parsedMeta;
    try {
      parsedMeta = JSON.parse(metadataJson);
    } catch (e) {
      alert("Invalid JSON in metadata field.");
      return;
    }
    
    if (!parsedMeta.title || parsedMeta.title.trim() === "") {
      alert("Please enter a valid title in the JSON.");
      return;
    }

    if (!parsedMeta.ageApplicability || parsedMeta.ageApplicability.length === 0) {
      alert("Please include at least one age in ageApplicability array.");
      return;
    }
    
    setIsUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (contentType === 'Flashcards') {
        const thumbnailCard = groupedCards.find(c => c.number === 't');
        if (!thumbnailCard || !thumbnailCard.files.single) {
          throw new Error("Missing thumbnail! Please ensure a file named 't.png' or 't.jpg' is included for the deck thumbnail.");
        }

        const remainingCards = groupedCards.filter(c => c.number !== 't' && c.number !== '?');

        // 1. Upload Thumbnail
        const thumbFile = thumbnailCard.files.single;
        const thumbPath = `thumbnails/${Date.now()}_${thumbFile.name.replace(/\s+/g, '_')}`;
        const thumbUrl = await uploadFileToSupabase(thumbFile, thumbPath);

        // 2. Insert Deck Record
        const { data: deckData, error: deckError } = await supabase.from('flashcard_decks').insert({
          title: parsedMeta.title,
          thumbnail_url: thumbUrl,
          subject: parsedMeta.subject || 'Science',
          applicable_ages: parsedMeta.ageApplicability.map(a => parseInt(a)),
          category: parsedMeta.category || '',
          description: parsedMeta.description || ''
        }).select().single();

        if (deckError) throw deckError;
        const deckId = deckData.id;

        // 3. Upload Remaining Cards & Insert DB Records
        const cardInsertions = [];
        for (const card of remainingCards) {
          const dbCardType = (card.type || 'Story Card').toLowerCase().replace(' ', '_');

          if (card.files.single) {
            const fileToUpload = card.files.single;
            const cardPath = `cards/${deckId}_${card.number}_${fileToUpload.name.replace(/\s+/g, '_')}`;
            const cardUrl = await uploadFileToSupabase(fileToUpload, cardPath);

            cardInsertions.push({
              deck_id: deckId,
              image_url: cardUrl,
              order_index: parseFloat(card.number),
              card_type: dbCardType
            });
          } else {
            if (card.files.front) {
              const fileToUpload = card.files.front;
              const cardPath = `cards/${deckId}_${card.number}_f_${fileToUpload.name.replace(/\s+/g, '_')}`;
              const cardUrl = await uploadFileToSupabase(fileToUpload, cardPath);

              cardInsertions.push({
                deck_id: deckId,
                image_url: cardUrl,
                order_index: parseFloat(`${card.number}.1`),
                card_type: dbCardType
              });
            }
            if (card.files.back) {
              const fileToUpload = card.files.back;
              const cardPath = `cards/${deckId}_${card.number}_b_${fileToUpload.name.replace(/\s+/g, '_')}`;
              const cardUrl = await uploadFileToSupabase(fileToUpload, cardPath);

              cardInsertions.push({
                deck_id: deckId,
                image_url: cardUrl,
                order_index: parseFloat(`${card.number}.2`),
                card_type: dbCardType
              });
            }
          }
        }

        if (cardInsertions.length > 0) {
          const { error: cardsError } = await supabase.from('flashcards').insert(cardInsertions);
          if (cardsError) throw cardsError;
        }

        setSuccessMsg(`Successfully uploaded deck "${parsedMeta.title}" with ${cardInsertions.length} cards!`);
      } else {
        // Implement logic for Quizzes/Quickbooks later
        setSuccessMsg(`Uploaded ${files.length} files for ${contentType} (Logic placeholder)`);
      }

      setFiles([]);
      setGroupedCards([]);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <UploadCloud size={24} color="var(--primary)" />
        <h2 style={{ margin: 0, color: 'var(--text-main)' }}>Upload Content</h2>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Content Type</label>
            <select className="form-select" value={contentType} onChange={(e) => {
              const val = e.target.value;
              if (val === 'Quickbooks') {
                navigate('/quickbooks/create');
              } else {
                setContentType(val);
                setFiles([]);
                setGroupedCards([]);
              }
            }}>
              {CONTENT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
            <label className="form-label">Metadata (JSON)</label>
            <textarea 
              className="form-input" 
              style={{ minHeight: '160px', fontFamily: 'monospace', whiteSpace: 'pre', padding: '1rem', resize: 'vertical' }}
              value={metadataJson}
              onChange={(e) => setMetadataJson(e.target.value)}
              placeholder={'{\n  "title": "Enter deck title...",\n  "subject": "e.g. Science",\n  "category": "e.g. Earth & Nature",\n  "ageApplicability": [5, 6],\n  "description": "Enter description here..."\n}'}
            />
          </div>
          
        </div>

        <div className="form-group" style={{ marginTop: '0.5rem' }}>
          <label className="form-label">Content Files {contentType === 'Flashcards' ? '(Must include t.png for Thumbnail)' : ''}</label>
          <div 
            style={{
              border: `2px dashed ${isDragging ? 'var(--primary)' : '#cbd5e1'}`,
              borderRadius: 'var(--radius-md)',
              padding: '2rem',
              textAlign: 'center',
              backgroundColor: isDragging ? '#f0f9ff' : '#f8fafc',
              transition: 'all 0.3s'
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input 
              type="file" 
              id="file-upload" 
              multiple={contentType === 'Flashcards'}
              accept="image/png, image/jpeg"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ backgroundColor: '#e2e8f0', padding: '1rem', borderRadius: '50%' }}>
                <UploadCloud size={32} color="#64748b" />
              </div>
              <div>
                <span style={{ color: 'var(--primary)', fontWeight: '600' }}>Click to upload</span> or drag and drop
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  {files.length > 0 ? `${files.length} file(s) selected` : (contentType === 'Flashcards' ? "Upload t.png (thumbnail) and 0.png, 1.png..." : "PDF, Image, or JSON")}
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Flashcard Preview Section */}
        {contentType === 'Flashcards' && groupedCards.length > 0 && (
          <div style={{ marginTop: '2rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Flashcard Previews</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {groupedCards.map((card, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem', backgroundColor: card.number === 't' ? '#f0fdf4' : '#f8fafc', borderRadius: 'var(--radius-md)', border: card.number === 't' ? '1px solid #86efac' : '1px solid #e2e8f0' }}>
                  
                  {card.number === 't' && (
                    <div style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 700 }}>Deck Thumbnail Image</div>
                  )}

                  {/* Image Thumbnails */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'center' }}>
                    {card.previews.single && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                        <img src={card.previews.single} alt={`Card ${card.number}`} style={{ width: '280px', height: '280px', objectFit: 'contain', backgroundColor: 'white', borderRadius: 'var(--radius-sm)', border: '1px solid #cbd5e1', padding: '0.5rem', boxShadow: 'var(--shadow-sm)' }} />
                        <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>{card.number === 't' ? 'Thumbnail' : `Card ${card.number}`}</span>
                      </div>
                    )}
                    {card.previews.front && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                        <img src={card.previews.front} alt={`Card ${card.number} Front`} style={{ width: '280px', height: '280px', objectFit: 'contain', backgroundColor: 'white', borderRadius: 'var(--radius-sm)', border: '1px solid #cbd5e1', padding: '0.5rem', boxShadow: 'var(--shadow-sm)' }} />
                        <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>Card {card.number} (Front)</span>
                      </div>
                    )}
                    {card.previews.back && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                        <img src={card.previews.back} alt={`Card ${card.number} Back`} style={{ width: '280px', height: '280px', objectFit: 'contain', backgroundColor: 'white', borderRadius: 'var(--radius-sm)', border: '1px solid #cbd5e1', padding: '0.5rem', boxShadow: 'var(--shadow-sm)' }} />
                        <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>Card {card.number} (Back)</span>
                      </div>
                    )}
                  </div>

                  {/* Card Type Dropdown (Only show for actual cards, not thumbnail) */}
                  {card.number !== 't' && (
                    <div style={{ alignSelf: 'center', width: '100%', maxWidth: '300px' }}>
                      <label className="form-label" style={{ fontSize: '0.9rem', textAlign: 'center', display: 'block' }}>Card Type</label>
                      <select 
                        className="form-select" 
                        style={{ padding: '0.75rem 1rem', fontSize: '1rem' }} 
                        value={card.type || 'Story Card'} 
                        onChange={(e) => updateCardType(idx, e.target.value)}
                      >
                        {FLASHCARD_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </div>
                  )}
                  
                </div>
              ))}
            </div>
          </div>
        )}

        <button type="submit" className="btn-primary" style={{ width: '100%', padding: '1rem' }} disabled={isUploading}>
          {isUploading ? (
            <><Loader2 className="animate-spin" size={20} /> Uploading to Supabase...</>
          ) : 'Upload Content'}
        </button>
      </form>
    </div>
  );
}
