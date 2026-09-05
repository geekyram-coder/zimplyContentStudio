import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, LayoutDashboard, BookOpen, Layers, FlaskConical, BadgeDollarSign, Landmark, Globe, Gavel, Brain, CheckSquare } from 'lucide-react';
import UploadForm from '../components/UploadForm';
import SearchBar from '../components/SearchBar';
import { supabase } from '../supabaseClient';

// Mock chart data for different ages
const mockChartData = {
  '5': [
    { subject: 'Science', quickbooks: 12, flashcards: 25, quizzes: 5 },
    { subject: 'Economics', quickbooks: 2, flashcards: 8, quizzes: 1 },
    { subject: 'History', quickbooks: 5, flashcards: 10, quizzes: 2 },
    { subject: 'Geography', quickbooks: 8, flashcards: 15, quizzes: 4 },
    { subject: 'Civics', quickbooks: 4, flashcards: 12, quizzes: 3 },
    { subject: 'Gen. Knowledge', quickbooks: 15, flashcards: 30, quizzes: 10 },
  ],
  '8': [
    { subject: 'Science', quickbooks: 20, flashcards: 15, quizzes: 12 },
    { subject: 'Economics', quickbooks: 10, flashcards: 5, quizzes: 8 },
    { subject: 'History', quickbooks: 25, flashcards: 20, quizzes: 15 },
    { subject: 'Geography', quickbooks: 18, flashcards: 12, quizzes: 10 },
    { subject: 'Civics', quickbooks: 15, flashcards: 10, quizzes: 8 },
    { subject: 'Gen. Knowledge', quickbooks: 30, flashcards: 25, quizzes: 20 },
  ]
};

const AGES = ['5', '6', '7', '8', '9', '10'];

const SUBJECT_ICONS = {
  'Science': FlaskConical,
  'Economics': BadgeDollarSign,
  'History': Landmark,
  'Geography': Globe,
  'Civics': Gavel,
  'Gen. Knowledge': Brain
};

export default function Dashboard({ onLogout }) {
  const [selectedAge, setSelectedAge] = useState('5');
  const [flashcardCounts, setFlashcardCounts] = useState({});
  const [quickbookCounts, setQuickbookCounts] = useState({});

  useEffect(() => {
    async function fetchCounts() {
      // Fetch Flashcards
      const { data: fcData, error: fcError } = await supabase.from('flashcard_decks').select('subject, applicable_ages');
      if (fcError) {
        console.error('Error fetching deck counts:', fcError);
      }
      
      const counts = {};
      AGES.forEach(age => {
        counts[age] = {};
        Object.keys(SUBJECT_ICONS).forEach(subj => {
          counts[age][subj] = 0;
        });
      });
      
      if (fcData) {
        fcData.forEach(deck => {
          if (deck.applicable_ages && Array.isArray(deck.applicable_ages)) {
            deck.applicable_ages.forEach(ageNum => {
              const ageStr = ageNum.toString();
              if (counts[ageStr] && counts[ageStr][deck.subject] !== undefined) {
                counts[ageStr][deck.subject] += 1;
              }
            });
          }
        });
      }
      
      setFlashcardCounts(counts);

      // Fetch Quickbooks
      const { data: qbData, error: qbError } = await supabase.from('quickbooks').select('subject, applicable_ages');
      if (qbError) {
        console.error('Error fetching quickbooks counts:', qbError);
      }
      
      const qbCounts = {};
      AGES.forEach(age => {
        qbCounts[age] = {};
        Object.keys(SUBJECT_ICONS).forEach(subj => {
          qbCounts[age][subj] = 0;
        });
      });
      
      if (qbData && qbData.length > 0) {
        qbData.forEach(qb => {
          if (qb.applicable_ages && Array.isArray(qb.applicable_ages)) {
            qb.applicable_ages.forEach(ageNum => {
              const ageStr = ageNum.toString();
              if (qbCounts[ageStr] && qbCounts[ageStr][qb.subject] !== undefined) {
                qbCounts[ageStr][qb.subject] += 1;
              }
            });
          }
        });
      }
      setQuickbookCounts(qbCounts);
    }
    
    fetchCounts();
  }, []);

  const [drafts, setDrafts] = useState([]);
  
  useEffect(() => {
    import('../utils/draftManager').then(({ getAllDrafts }) => {
      getAllDrafts().then(setDrafts);
    });
  }, []);

  // Fallback to empty array if no specific mock data for selected age
  const chartData = mockChartData[selectedAge] || [
    { subject: 'Science', quickbooks: Math.floor(Math.random() * 20), flashcards: Math.floor(Math.random() * 20), quizzes: Math.floor(Math.random() * 20) },
    { subject: 'Economics', quickbooks: Math.floor(Math.random() * 20), flashcards: Math.floor(Math.random() * 20), quizzes: Math.floor(Math.random() * 20) },
    { subject: 'History', quickbooks: Math.floor(Math.random() * 20), flashcards: Math.floor(Math.random() * 20), quizzes: Math.floor(Math.random() * 20) },
    { subject: 'Geography', quickbooks: Math.floor(Math.random() * 20), flashcards: Math.floor(Math.random() * 20), quizzes: Math.floor(Math.random() * 20) },
    { subject: 'Civics', quickbooks: Math.floor(Math.random() * 20), flashcards: Math.floor(Math.random() * 20), quizzes: Math.floor(Math.random() * 20) },
    { subject: 'Gen. Knowledge', quickbooks: Math.floor(Math.random() * 20), flashcards: Math.floor(Math.random() * 20), quizzes: Math.floor(Math.random() * 20) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header */}
      <header className="glass" style={{ margin: '1.5rem', padding: '1rem 2rem', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ backgroundColor: 'var(--primary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', color: 'white' }}>
            <LayoutDashboard size={24} />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-main)' }}>Zimply Kids <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>| Studio</span></h1>
        </div>
        
        {/* Search Bar centered in header */}
        <div style={{ flex: 1, padding: '0 2rem' }}>
           <SearchBar />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src={`https://ui-avatars.com/api/?name=Admin&background=random&rounded=true`} alt="Admin" style={{ width: 40, height: 40 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>Admin</p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Content Creator</p>
            </div>
          </div>
          
          <button 
            onClick={onLogout}
            style={{ 
              background: 'transparent', 
              border: '1px solid #e2e8f0', 
              borderRadius: 'var(--radius-md)', 
              padding: '0.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.borderColor = 'var(--error)'; }}
            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '0 1.5rem 2rem 1.5rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        
        {/* Top Section: Upload Form */}
        <div className="animate-fade-in delay-1" style={{ marginBottom: '2rem' }}>
          <UploadForm />
        </div>

        {/* Drafts Section */}
        {drafts.length > 0 && (
          <div className="animate-fade-in delay-1" style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '1rem' }}>Saved Drafts</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {drafts.map(draft => (
                <div key={draft.id} className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>{draft.title}</h3>
                    <span style={{ fontSize: '0.75rem', backgroundColor: '#e2e8f0', padding: '0.2rem 0.5rem', borderRadius: '1rem', color: 'var(--text-muted)' }}>{draft.subject}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{draft.pageCount} Pages • Saved {new Date(draft.updatedAt).toLocaleTimeString()}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <Link to={`/quickbook/create?draftId=${draft.id}`} style={{ flex: 1, textAlign: 'center', backgroundColor: 'var(--primary)', color: 'white', padding: '0.5rem', borderRadius: 'var(--radius-sm)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>Resume</Link>
                    <button onClick={async () => {
                      const { deleteDraft } = await import('../utils/draftManager');
                      await deleteDraft(draft.id);
                      setDrafts(drafts.filter(d => d.id !== draft.id));
                    }} style={{ backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', padding: '0.5rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Overview Section */}
        <div className="animate-fade-in delay-2">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', margin: 0 }}>Content Overview</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#ffffff', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-soft)' }}>
              <label style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: 600 }}>Age Group:</label>
              <select className="form-select" style={{ width: '100px', padding: '0.25rem 0.5rem', border: 'none', backgroundColor: 'transparent', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }} value={selectedAge} onChange={(e) => setSelectedAge(e.target.value)}>
                {AGES.map(a => <option key={a} value={a}>Age {a}</option>)}
              </select>
            </div>
          </div>
          
          {/* Subject Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {chartData.map((row, idx) => {
              const Icon = SUBJECT_ICONS[row.subject] || BookOpen;
              const realFlashcardCount = flashcardCounts[selectedAge]?.[row.subject] || 0;
              const realQuickbookCount = quickbookCounts[selectedAge]?.[row.subject] || 0;
              return (
                <div key={idx} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
                  {/* Subject Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
                      <Icon size={24} color="var(--primary)" />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>{row.subject}</h3>
                  </div>
                  
                  {/* Subject Target Numbers */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <Link to={`/quickbooks/${row.subject}/${selectedAge}`} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                        <BookOpen size={18} color="#6366f1" />
                        <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Quickbooks</span>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#6366f1' }}>
                        {realQuickbookCount} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>/ 8</span>
                      </div>
                    </Link>
                    
                    <Link to={`/decks/${row.subject}/${selectedAge}`} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                        <Layers size={18} color="#ec4899" />
                        <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Flashcards</span>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#ec4899' }}>
                        {realFlashcardCount} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>/ 15</span>
                      </div>
                    </Link>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                        <CheckSquare size={18} color="#05cd99" />
                        <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Quizzes</span>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#05cd99' }}>
                        {row.quizzes} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>/ 250</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </main>
    </div>
  );
}
