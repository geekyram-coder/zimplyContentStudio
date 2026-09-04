import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, LogOut, BookOpen, Plus } from 'lucide-react';

export default function QuickBooksPage({ onLogout }) {
  const { subject, age } = useParams();
  const [quickbooks, setQuickbooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchQuickbooks() {
      setLoading(true);
      const { data, error } = await supabase
        .from('quickbooks')
        .select('*')
        .eq('subject', subject)
        .contains('applicable_ages', [parseInt(age)])
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching quickbooks:', error);
      } else {
        setQuickbooks(data || []);
      }
      setLoading(false);
    }

    fetchQuickbooks();
  }, [subject, age]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="glass" style={{ margin: '1.5rem', padding: '1rem 2rem', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/" style={{ color: 'var(--text-main)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={20} /> Back to Dashboard
          </Link>
          <div style={{ height: '24px', width: '1px', backgroundColor: '#e2e8f0' }}></div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>{subject} Quickbooks (Age {age})</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/quickbooks/create" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--primary)', color: 'white', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>
            <Plus size={16} /> Create New
          </Link>
          <button 
            onClick={onLogout}
            style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main style={{ flex: 1, padding: '0 1.5rem 2rem 1.5rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--text-muted)' }}>Loading quickbooks...</div>
        ) : quickbooks.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--text-muted)' }}>
            <BookOpen size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
            <h3>No quickbooks found</h3>
            <p>Create some quickbooks for {subject} Age {age} to see them here.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {quickbooks.map(qb => (
              <Link 
                to={`/quickbook/edit/${qb.id}`} 
                key={qb.id} 
                className="glass-card" 
                style={{ textDecoration: 'none', color: 'inherit', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: 'var(--radius-md)', overflow: 'hidden', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={48} color="#94a3b8" />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', textAlign: 'center' }}>{qb.title}</h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center' }}>{qb.description}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
