import { useState } from 'react';
import {
  createDefaultRateCard,
  type CrewMember,
  type ProductionSettings,
  type Department,
  type CrewType,
} from '@/stores/timesheetStore';

interface AddCrewModalProps {
  production: ProductionSettings;
  onAdd: (crew: Omit<CrewMember, 'id'>) => void;
  onClose: () => void;
}

export function AddCrewModal({ production, onAdd, onClose }: AddCrewModalProps) {
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState<Department>('makeup');
  const [crewType, setCrewType] = useState<CrewType>('paye');
  const [dailyRate, setDailyRate] = useState(200);

  const handleSubmit = () => {
    if (!name.trim()) return;
    const rateCard = createDefaultRateCard();
    rateCard.dailyRate = dailyRate;
    rateCard.baseContract = production.defaultBaseContract;
    rateCard.dayType = production.defaultDayType;

    onAdd({
      name: name.trim(),
      position: position.trim() || 'Makeup Artist',
      department,
      crewType,
      email: '',
      phone: '',
      rateCard,
    });
  };

  return (
    <div className="ts-modal-backdrop" onClick={onClose}>
      <div className="ts-modal" onClick={e => e.stopPropagation()}>
        <div className="ts-modal-header">
          <h3>Add Crew Member</h3>
          <button className="ts-delete-btn" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="ts-modal-body">
          <div className="ts-form-grid">
            <div className="ts-form-field">
              <label className="ts-label">Name *</label>
              <input className="ts-input" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" autoFocus />
            </div>
            <div className="ts-form-field">
              <label className="ts-label">Position</label>
              <input className="ts-input" value={position} onChange={e => setPosition(e.target.value)} placeholder="e.g. Makeup Artist" />
            </div>
            <div className="ts-form-field">
              <label className="ts-label">Department</label>
              <select className="ts-select" value={department} onChange={e => setDepartment(e.target.value as Department)}>
                <option value="hair">Hair</option>
                <option value="makeup">Makeup</option>
                <option value="sfx">SFX</option>
                <option value="prosthetics">Prosthetics</option>
              </select>
            </div>
            <div className="ts-form-field">
              <label className="ts-label">Type</label>
              <select className="ts-select" value={crewType} onChange={e => setCrewType(e.target.value as CrewType)}>
                <option value="paye">PAYE</option>
                <option value="ltd">LTD</option>
              </select>
            </div>
            <div className="ts-form-field">
              <label className="ts-label">Daily Rate (£)</label>
              <input className="ts-input" type="number" min={0} step={10} value={dailyRate} onChange={e => setDailyRate(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
        </div>
        <div className="ts-modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-gold" onClick={handleSubmit} disabled={!name.trim()}>Add Crew Member</button>
        </div>
      </div>
    </div>
  );
}
