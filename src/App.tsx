import React, { useState, useEffect } from 'react';
import { db } from './database';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout/Layout';
import Dashboard from './components/Pages/Dashboard';
import ParserPage from './components/Pages/ParserPage';

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  
  // Load relations on app start
  useEffect(() => {
    db.getRelationsWithDetails();
  }, []);

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard />;
      case 'parser':
        return <ParserPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      <Toaster position="top-right" />
      {renderPage()}
    </Layout>
  );
}

export default App;