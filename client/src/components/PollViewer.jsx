const PollViewer = ({ poll, onVote }) => {
  return (
    <div>
      <h2>Choisissez une option :</h2>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {poll.options.map((option) => (
          <button 
            key={option.id} 
            className="btn btn-option"
            onClick={() => onVote(option.id)}
          >
            {option.text}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PollViewer;
