import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DecksPage from './pages/DecksPage';
import DeckViewPage from './pages/DeckViewPage';
import QuickBookCreator from './pages/QuickBookCreator';
import QuickBooksPage from './pages/QuickBooksPage';
import QuickBookViewPage from './pages/QuickBookViewPage';
import { supabase } from './supabaseClient';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('mockLoggedIn') === 'true';
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) setIsAuthenticated(true);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) setIsAuthenticated(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    localStorage.setItem('mockLoggedIn', 'true');
  };

  const handleLogout = async () => {
    setIsAuthenticated(false);
    localStorage.removeItem('mockLoggedIn');
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-main)' }}>Loading session...</div>;
  }

  // We consider the user logged in if they pass the mock login OR have a Supabase session
  const isLoggedIn = isAuthenticated || session;

  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route 
            path="/login" 
            element={isLoggedIn ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} 
          />
          <Route 
            path="/" 
            element={isLoggedIn ? <Dashboard onLogout={handleLogout} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/decks/:subject/:age" 
            element={isLoggedIn ? <DecksPage onLogout={handleLogout} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/deck/:deckId" 
            element={isLoggedIn ? <DeckViewPage onLogout={handleLogout} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/quickbooks/:subject/:age" 
            element={isLoggedIn ? <QuickBooksPage onLogout={handleLogout} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/quickbook/:id" 
            element={isLoggedIn ? <QuickBookViewPage onLogout={handleLogout} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/quickbooks/create" 
            element={isLoggedIn ? <QuickBookCreator /> : <Navigate to="/login" />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
