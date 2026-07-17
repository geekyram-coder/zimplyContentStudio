import React, { useState } from 'react';
import { LogOut, LayoutDashboard, BookOpen, Layers } from 'lucide-react';
import StatCard from '../components/StatCard';
import UploadForm from '../components/UploadForm';
import SearchBar from '../components/SearchBar';

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

export default function Dashboard({ onLogout }) {
  const [selectedAge, setSelectedAge] = useState('5');

  // Fallback to empty array if no specific mock data for selected age
  const chartData = mockChartData[selectedAge] || [
    { subject: 'Science', quickbooks: Math.floor(Math.random() * 20), flashcards: Math.floor(Math.random() * 20), quizzes: Math.floor(Math.random() * 20) },
    { subject: 'Economics', quickbooks: Math.floor(Math.random() * 20), flashcards: Math.floor(Math.random() * 20), quizzes: Math.floor(Math.random() * 20) },
    { subject: 'History', quickbooks: Math.floor(Math.random() * 20), flashcards: Math.floor(Math.random() * 20), quizzes: Math.floor(Math.random() * 20) },
    { subject: 'Geography', quickbooks: Math.floor(Math.random() * 20), flashcards: Math.floor(Math.random() * 20), quizzes: Math.floor(Math.random() * 20) },
    { subject: 'Civics', quickbooks: Math.floor(Math.random() * 20), flashcards: Math.floor(Math.random() * 20), quizzes: Math.floor(Math.random() * 20) },
    { subject: 'Gen. Knowledge', quickbooks: Math.floor(Math.random() * 20), flashcards: Math.floor(Math.random() * 20), quizzes: Math.floor(Math.random() * 20) },
  ];

  const stats = [
    { id: 1, title: 'Total Quickbooks', value: '145', icon: 'BookOpen', color: '#6366f1' },
    { id: 2, title: 'Total Flashcards', value: '328', icon: 'Layers', color: '#ec4899' },
    { id: 3, title: 'Total Quizzes', value: '136', icon: 'CheckSquare', color: '#05cd99' },
    { id: 4, title: `Active Age Group`, value: `Age ${selectedAge}`, icon: 'Users', color: '#f59e0b' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header */}
      <header className="glass" style={{ margin: '1.5rem', padding: '1rem 2rem', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ backgroundColor: 'var(--primary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', color: 'white' }}>
            <LayoutDashboard size={24} />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-main)' }}>Simply Kids <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>| Studio</span></h1>
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
        
        <div className="animate-fade-in delay-1" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', margin: 0 }}>Overview</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Filter Data by Age:</label>
              <select className="form-select" style={{ width: '120px', padding: '0.5rem 1rem' }} value={selectedAge} onChange={(e) => setSelectedAge(e.target.value)}>
                {AGES.map(a => <option key={a} value={a}>Age {a}</option>)}
              </select>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'stretch' }}>
            {/* Table Area */}
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', width: '100%', height: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                  <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.95rem' }}>Subject</th>
                      <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.95rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <BookOpen size={18} color="#6366f1" /> Quickbooks
                        </div>
                      </th>
                      <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.95rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Layers size={18} color="#ec4899" /> Flashcards
                        </div>
                      </th>
                      <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.95rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 800, color: '#05cd99', fontSize: '1.1rem', padding: '0 4px' }}>Q</span> Quizzes
                        </div>
                      </th>
                      <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.95rem' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((row, idx) => {
                      const total = row.quickbooks + row.flashcards + row.quizzes;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                          <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-main)' }}>{row.subject}</td>
                          <td style={{ padding: '1rem 1.5rem', color: '#6366f1', fontWeight: 700, fontSize: '1.1rem' }}>{row.quickbooks}</td>
                          <td style={{ padding: '1rem 1.5rem', color: '#ec4899', fontWeight: 700, fontSize: '1.1rem' }}>{row.flashcards}</td>
                          <td style={{ padding: '1rem 1.5rem', color: '#05cd99', fontWeight: 700, fontSize: '1.1rem' }}>{row.quizzes}</td>
                          <td style={{ padding: '1rem 1.5rem', color: 'var(--text-main)', fontWeight: 700, fontSize: '1.1rem', backgroundColor: '#f8fafc' }}>{total}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Stats Summary Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {stats.slice(0, 3).map(stat => (
                <StatCard 
                  key={stat.id} 
                  title={stat.title} 
                  value={stat.value} 
                  iconName={stat.icon} 
                  color={stat.color} 
                />
              ))}
            </div>
          </div>
        </div>

        <div className="animate-fade-in delay-2">
          <UploadForm />
        </div>

      </main>
    </div>
  );
}
