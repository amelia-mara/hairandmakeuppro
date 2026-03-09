import { useState } from 'react';

interface AddCategoryModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string) => void;
}

export function AddCategoryModal({ open, onClose, onAdd }: AddCategoryModalProps) {
  const [name, setName] = useState('');

  if (!open) return null;

  const handleSubmit = () => {
    if (name.trim()) {
      onAdd(name.trim());
      setName('');
      onClose();
    }
  };

  return (
    <div className="budget-modal-overlay" onClick={onClose}>
      <div className="budget-modal glass" onClick={e => e.stopPropagation()}>
        <div className="budget-modal-header">
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.125rem', fontWeight: 600 }}>
            Add Category
          </h3>
          <button className="budget-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="budget-modal-body">
          <label className="budget-field-label">Category Name</label>
          <input
            className="budget-input"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Special Effects"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>
        <div className="budget-modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-gold" onClick={handleSubmit}>Add Category</button>
        </div>
      </div>
    </div>
  );
}
