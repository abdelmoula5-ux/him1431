const LiveResults = ({ poll }) => {
  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);

  return (
    <div>
      <h2>Résultats en temps réel</h2>
      <p className="mb-4" style={{ color: 'var(--text-muted)' }}>Total des votes : {totalVotes}</p>
      
      <div>
        {poll.options.map((option) => {
          const percentage = totalVotes === 0 ? 0 : Math.round((option.votes / totalVotes) * 100);
          
          return (
            <div key={option.id} className="result-item">
              <div className="result-header">
                <span>{option.text}</span>
                <span>{percentage}% <span className="vote-count">({option.votes})</span></span>
              </div>
              <div class="progress-bar-bg">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiveResults;
