import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, Layers, CheckSquare } from 'lucide-react';

// Mock data representing existing topics across different subjects and ages
const mockTopics = [
  { id: 1, title: 'Gravity on Earth', subject: 'Science', age: '5', type: 'Flashcards', icon: Layers },
  { id: 2, title: 'Gravity discovered by Newton', subject: 'Science', age: '8', type: 'Quickbooks', icon: FileText },
  { id: 3, title: 'What is Gravity? Quiz', subject: 'Science', age: '6', type: 'Quizzes', icon: CheckSquare },
  { id: 4, title: 'Solar System Planets', subject: 'Science', age: '7', type: 'Quickbooks', icon: FileText },
  { id: 5, title: 'Money Basics', subject: 'Economics', age: '5', type: 'Flashcards', icon: Layers },
  { id: 6, title: 'Supply and Demand', subject: 'Economics', age: '10', type: 'Quickbooks', icon: FileText },
  { id: 7, title: 'Ancient Egypt', subject: 'History', age: '9', type: 'Quickbooks', icon: FileText },
  { id: 8, title: 'Continents Map', subject: 'Geography', age: '5', type: 'Flashcards', icon: Layers },
  { id: 9, title: 'Community Helpers', subject: 'Civics', age: '5', type: 'Flashcards', icon: Layers },
  { id: 10, title: 'Flags of the World', subject: 'General Knowledge', age: '6', type: 'Quizzes', icon: CheckSquare },
];

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (query.trim() === '') {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const filtered = mockTopics.filter(topic => 
      topic.title.toLowerCase().includes(query.toLowerCase()) || 
      topic.subject.toLowerCase().includes(query.toLowerCase())
    );
    
    setResults(filtered);
    setIsOpen(true);
  }, [query]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
          <Search size={20} />
        </span>
        <input
          type="text"
          className="form-input"
          style={{ paddingLeft: '3rem', borderRadius: 'var(--radius-xl)', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}
          placeholder="Search topics to avoid duplicates (e.g. 'Gravity')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if(query) setIsOpen(true) }}
        />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '110%',
          left: 0,
          right: 0,
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-hover)',
          zIndex: 50,
          maxHeight: '350px',
          overflowY: 'auto',
          border: '1px solid #f1f5f9'
        }}>
          {results.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {results.map(topic => {
                const Icon = topic.icon;
                return (
                  <li key={topic.id} style={{ 
                    padding: '1rem', 
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    cursor: 'default'
                  }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                      <Icon size={24} color="var(--primary)" />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1rem' }}>{topic.title}</h4>
                      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        {topic.type} • {topic.subject} • Age {topic.age}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No topics found for "{query}". You're good to upload new content!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
