import { useState } from 'react';

const PollCreator = ({ onCreate }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleAddOption = () => {
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validOptions = options.filter(opt => opt.trim() !== '');
    if (question.trim() && validOptions.length >= 2) {
      onCreate({ question, options: validOptions });
    }
  };

  return (
    <div className="glass-panel">
      <h1>Nouveau Sondage</h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="question" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Question</label>
          <input 
            type="text" 
            id="question"
            value={question} 
            onChange={(e) => setQuestion(e.target.value)} 
            placeholder="Posez votre question ici..."
            required 
          />
        </div>
        
        <div className="mb-4">
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Options</label>
          {options.map((option, index) => (
            <div key={index} className="flex-between mb-4" style={{ gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input 
                type="text" 
                value={option} 
                onChange={(e) => handleOptionChange(index, e.target.value)} 
                placeholder={`Option ${index + 1}`}
                style={{ marginBottom: 0 }}
                required 
              />
              {options.length > 2 && (
                <button type="button" className="btn btn-secondary" style={{ padding: '0 1rem', height: '100%' }} onClick={() => handleRemoveOption(index)}>✕</button>
              )}
            </div>
          ))}
        </div>
        
        <div className="flex-between mt-4">
          <button type="button" className="btn btn-secondary" onClick={handleAddOption} style={{ width: 'auto' }}>
            + Ajouter
          </button>
          <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>
            Lancer le Sondage
          </button>
        </div>
      </form>
    </div>
  );
};

export default PollCreator;
