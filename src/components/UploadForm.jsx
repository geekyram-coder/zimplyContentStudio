import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, CheckCircle } from 'lucide-react';

const AGES = ['5', '6', '7', '8', '9', '10'];
const SUBJECTS = ['Science', 'Economics', 'History', 'Geography', 'Civics', 'General Knowledge'];
const CONTENT_TYPES = ['Quickbooks', 'Flashcards', 'Quizzes'];
const FLASHCARD_TYPES = ['Story Card', 'Tap & Reveal Card', 'Guess Card', 'Celebration Card', 'Imagination Card', 'Challenge Card'];

const mockTopics = [
  'Gravity on Earth',
  'Gravity discovered by Newton',
  'What is Gravity? Quiz',
  'Solar System Planets',
  'Money Basics',
  'Supply and Demand',
  'Ancient Egypt',
  'Continents Map',
  'Community Helpers',
  'Flags of the World'
];

export default function UploadForm() {
  const [topic, setTopic] = useState('');
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);
  const [topicResults, setTopicResults] = useState([]);
  
  const [selectedAges, setSelectedAges] = useState(['5']);
  const [subject, setSubject] = useState('Science');
  const [contentType, setContentType] = useState('Flashcards'); // defaulting to Flashcards for better UX flow testing
  
  const [files, setFiles] = useState([]);
  const [groupedCards, setGroupedCards] = useState([]);
  
  const [isUploading, setIsUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const topicRef = useRef(null);

  // Topic Autocomplete Logic
  useEffect(() => {
    if (topic.trim() === '') {
      setTopicResults(mockTopics);
    } else {
      setTopicResults(mockTopics.filter(t => t.toLowerCase().includes(topic.toLowerCase())));
    }
  }, [topic]);

  const toggleAge = (ageVal) => {
    setSelectedAges(prev => 
      prev.includes(ageVal) 
        ? prev.filter(a => a !== ageVal) 
        : [...prev, ageVal]
    );
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (topicRef.current && !topicRef.current.contains(event.target)) {
        setShowTopicDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // File parsing logic
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);

    if (contentType === 'Flashcards') {
      let cards = {};
      selectedFiles.forEach(file => {
        const match = file.name.match(/^(\d+)([fb])?\./i);
        if (match) {
          const num = match[1];
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
          // Unnumbered card fallback
          const randomId = Math.random().toString(36).substr(2, 9);
          cards[randomId] = { number: '?', type: 'Story Card', files: { single: file }, previews: { single: URL.createObjectURL(file) } };
        }
      });
      
      const parsedCards = Object.values(cards).sort((a, b) => {
        const numA = parseInt(a.number);
        const numB = parseInt(b.number);
        if (isNaN(numA)) return 1;
        if (isNaN(numB)) return -1;
        return numA - numB;
      });
      
      setGroupedCards(parsedCards);
    }
  };

  const updateCardType = (index, newType) => {
    const updated = [...groupedCards];
    updated[index].type = newType;
    setGroupedCards(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (files.length === 0) {
      alert("Please select files to upload.");
      return;
    }
    if (!topic) {
      alert("Please enter a topic.");
      return;
    }
    if (selectedAges.length === 0) {
      alert("Please select at least one Age Group.");
      return;
    }
    
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setSuccessMsg(`Successfully uploaded ${files.length} file(s) for "${topic}" (Ages: ${selectedAges.join(', ')}).`);
      setFiles([]);
      setGroupedCards([]);
      setTopic('');
      setTimeout(() => setSuccessMsg(''), 4000);
    }, 1500);
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

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          
          <div className="form-group" style={{ marginBottom: 0, position: 'relative' }} ref={topicRef}>
            <label className="form-label">Topic</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Start typing topic name..."
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                setShowTopicDropdown(true);
              }}
              onFocus={() => setShowTopicDropdown(true)}
            />
            {showTopicDropdown && topicResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-sm)', maxHeight: '200px', overflowY: 'auto', zIndex: 10, boxShadow: 'var(--shadow-soft)' }}>
                {topicResults.map(t => (
                  <div 
                    key={t} 
                    style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f8fafc' }}
                    onMouseDown={() => {
                      setTopic(t);
                      setShowTopicDropdown(false);
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    {t}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Content Type</label>
            <select className="form-select" value={contentType} onChange={(e) => {
              setContentType(e.target.value);
              setFiles([]);
              setGroupedCards([]);
            }}>
              {CONTENT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Age Groups</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              {AGES.map(a => (
                <label key={a} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', backgroundColor: '#f1f5f9', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedAges.includes(a)}
                    onChange={() => toggleAge(a)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>Age {a}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Subject</label>
            <select className="form-select" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          
        </div>

        <div className="form-group" style={{ marginTop: '0.5rem' }}>
          <label className="form-label">Content Files {contentType === 'Flashcards' ? '(Drag multiple PNGs)' : ''}</label>
          <div style={{
            border: '2px dashed #cbd5e1',
            borderRadius: 'var(--radius-md)',
            padding: '2rem',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            transition: 'border-color 0.3s'
          }}>
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
                  {files.length > 0 ? `${files.length} file(s) selected` : (contentType === 'Flashcards' ? "Upload multiple PNGs (e.g. 1.png, 2f.png, 2b.png)" : "PDF, Image, or JSON")}
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
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                  
                  {/* Image Thumbnails */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'center' }}>
                    {card.previews.single && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                        <img src={card.previews.single} alt={`Card ${card.number}`} style={{ width: '280px', height: '280px', objectFit: 'contain', backgroundColor: 'white', borderRadius: 'var(--radius-sm)', border: '1px solid #cbd5e1', padding: '0.5rem', boxShadow: 'var(--shadow-sm)' }} />
                        <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>Card {card.number}</span>
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

                  {/* Card Type Dropdown */}
                  <div style={{ alignSelf: 'center', width: '100%', maxWidth: '300px' }}>
                    <label className="form-label" style={{ fontSize: '0.9rem', textAlign: 'center', display: 'block' }}>Card Type</label>
                    <select 
                      className="form-select" 
                      style={{ padding: '0.75rem 1rem', fontSize: '1rem' }} 
                      value={card.type} 
                      onChange={(e) => updateCardType(idx, e.target.value)}
                    >
                      {FLASHCARD_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                  
                </div>
              ))}
            </div>
          </div>
        )}

        <button type="submit" className="btn-primary" style={{ width: '100%', padding: '1rem' }} disabled={isUploading}>
          {isUploading ? 'Uploading to Supabase...' : 'Upload Content'}
        </button>
      </form>
    </div>
  );
}
