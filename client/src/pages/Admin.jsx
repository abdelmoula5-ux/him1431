import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import PollCreator from '../components/PollCreator';

const backendUrl = import.meta.env.PROD ? '' : 'http://localhost:3001';
const socket = io(backendUrl || undefined);

const Admin = () => {
  const [currentPoll, setCurrentPoll] = useState(null);

  useEffect(() => {
    fetch(`${backendUrl}/api/poll`)
      .then(res => res.json())
      .then(data => {
        if (data) setCurrentPoll(data);
      })
      .catch(console.error);

    socket.on('poll_updated', (poll) => {
      setCurrentPoll(poll);
    });

    return () => socket.off('poll_updated');
  }, []);

  const handleCreatePoll = async (pollData) => {
    try {
      const res = await fetch(`${backendUrl}/api/poll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pollData)
      });
      const data = await res.json();
      setCurrentPoll(data);
    } catch (error) {
      console.error('Erreur lors de la création du sondage:', error);
    }
  };

  const handleExportCSV = () => {
    if (!currentPoll || !currentPoll.options) return;
    
    // CAHIER DES CHARGES : Export CSV des réponses
    let csv = "Question,Option,Nb Votes\n";
    currentPoll.options.forEach(opt => {
        csv += `"${currentPoll.question}","${opt.text}",${opt.votes}\n`;
    });
    
    // Génération du fichier téléchargeable
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sondage_${currentPoll.id}_resultats.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="app-container">
      <PollCreator onCreate={handleCreatePoll} />
      
      {currentPoll && (
        <div className="glass-panel" style={{ marginTop: '2rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--primary)' }}>
            Sondage diffusé au public :
          </h2>
          <p style={{ fontWeight: 600, marginBottom: '1.5rem' }}>{currentPoll.question}</p>
          
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            📥 Exporter les Résultats en CSV
          </button>
        </div>
      )}
    </div>
  );
};

export default Admin;
