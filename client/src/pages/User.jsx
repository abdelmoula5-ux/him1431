// client/src/pages/User.jsx
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import PollViewer from '../components/PollViewer';
import LiveResults from '../components/LiveResults';

const backendUrl = import.meta.env.PROD ? '' : 'http://localhost:3001';
const socket = io(backendUrl || undefined);

const User = () => {
  const [currentPoll, setCurrentPoll] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [pseudo, setPseudo] = useState('');
  const [pseudoValide, setPseudoValide] = useState(false);

  useEffect(() => {
    fetch(`${backendUrl}/api/poll`)
      .then(res => res.json())
      .then(data => {
        if (data) setCurrentPoll(data);
      })
      .catch(console.error);

    socket.on('poll_updated', (poll) => {
      setCurrentPoll(prev => {
        if (!prev || prev.id !== poll.id) {
          setHasVoted(false);
        }
        return poll;
      });
    });

    return () => socket.off('poll_updated');
  }, []);

  const handleVote = (optionId) => {
    // Le vote contient désormais l'identifiant du participant
    socket.emit('submit_vote', { optionId, pseudo });
    setHasVoted(true);
  };

  const validerPseudo = () => {
    if (pseudo.trim().length >= 2) {
      setPseudoValide(true);
    } else {
      alert("Veuillez entrer au moins 2 caractères.");
    }
  };

  // 1. Cas : Aucun sondage actif
  if (!currentPoll) {
    return (
      <div className="app-container">
        <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <div className="spinner"></div>
          <h2>En attente d'un administrateur...</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
            Dès qu'un sondage sera lancé, il s'affichera ici instantanément.
          </p>
        </div>
      </div>
    );
  }

  // 2. Cas : Un sondage est là, mais l'utilisateur n'a pas encore entré son nom
  if (!pseudoValide && !hasVoted) {
    return (
      <div className="app-container">
        <div className="glass-panel text-center">
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Rejoindre le Sondage</h2>
          <p style={{ marginBottom: '1rem' }}>Veuillez entrer votre nom ou pseudo pour participer au sondage et enregistrer votre vote.</p>
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') validerPseudo(); }}
            placeholder="Ex: Amine"
            className="poll-input"
            style={{ textAlign: 'center' }}
            autoFocus
          />
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={validerPseudo}>
            Démarrer le Vote
          </button>
        </div>
      </div>
    );
  }

  // 3. Cas : L'utilisateur a entré son nom, il peut voter (ou a fini de voter)
  return (
    <div className="app-container">
      <div className="glass-panel">
        <h1>{currentPoll.question}</h1>
        
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
           <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.85rem' }}>
              👤 Connecté en tant que : <strong>{pseudo}</strong>
           </span>
        </div>

        {!hasVoted ? (
          <PollViewer poll={currentPoll} onVote={handleVote} />
        ) : (
          <LiveResults poll={currentPoll} />
        )}
      </div>
    </div>
  );
};

export default User;
