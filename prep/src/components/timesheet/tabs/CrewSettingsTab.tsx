import { useState } from 'react';
import { ProductionSettingsCard } from '../crew/ProductionSettingsCard';
import { CrewList } from '../crew/CrewList';
import { RateCardPanel } from '../crew/RateCardPanel';
import { AddCrewModal } from '../crew/AddCrewModal';
import type {
  ProductionSettings,
  CrewMember,
  RateCard,
} from '@/stores/timesheetStore';
import {
  CURRENCY_SYMBOLS,
  BASE_CONTRACTS,
  DAY_TYPES,
} from '@/stores/timesheetStore';


interface CrewSettingsTabProps {
  production: ProductionSettings;
  crew: CrewMember[];
  selectedCrewId: string | null;
  onSetProduction: (updates: Partial<ProductionSettings>) => void;
  onAddCrew: (crew: Omit<CrewMember, 'id'>) => string;
  onUpdateCrew: (id: string, updates: Partial<CrewMember>) => void;
  onRemoveCrew: (id: string) => void;
  onUpdateRateCard: (crewId: string, updates: Partial<RateCard>) => void;
  onSelectCrew: (crewId: string | null) => void;
  onShowToast: (msg: string) => void;
}

export function CrewSettingsTab({
  production,
  crew,
  selectedCrewId,
  onSetProduction,
  onAddCrew,
  onUpdateCrew,
  onRemoveCrew,
  onUpdateRateCard,
  onSelectCrew,
  onShowToast,
}: CrewSettingsTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const selectedCrew = crew.find(c => c.id === selectedCrewId);

  return (
    <div className="ts-crew-tab">
      <div className="ts-crew-left">
        <ProductionSettingsCard
          production={production}
          onUpdate={onSetProduction}
        />
        <CrewList
          crew={crew}
          selectedCrewId={selectedCrewId}
          onSelectCrew={onSelectCrew}
          onRemoveCrew={onRemoveCrew}
          onAddCrew={() => setShowAddModal(true)}
        />
      </div>
      <div className="ts-crew-right">
        {selectedCrew ? (
          <RateCardPanel
            crew={selectedCrew}
            onUpdateCrew={(updates) => onUpdateCrew(selectedCrew.id, updates)}
            onUpdateRateCard={(updates) => onUpdateRateCard(selectedCrew.id, updates)}
          />
        ) : (
          <RateCardPreview production={production} hasCrew={crew.length > 0} onAddCrew={() => setShowAddModal(true)} />
        )}
      </div>

      {showAddModal && (
        <AddCrewModal
          production={production}
          onAdd={(data) => {
            onAddCrew(data);
            onShowToast('Crew member added');
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

function RateCardPreview({ production, hasCrew, onAddCrew }: { production: ProductionSettings; hasCrew: boolean; onAddCrew: () => void }) {
  const sym = CURRENCY_SYMBOLS[production.currency];
  const contractLabel = BASE_CONTRACTS[production.defaultBaseContract]?.label ?? production.defaultBaseContract;
  const dayTypeLabel = `${production.defaultDayType} — ${DAY_TYPES[production.defaultDayType]?.name ?? ''}`;

  return (
    <div className="ts-card ts-rate-card-panel ts-preview-panel">
      <div className="ts-card-header">
        <h3 className="ts-card-title" style={{ opacity: 0.5 }}>Crew Member Name</h3>
        <span className="ts-type-badge ts-type-paye" style={{ opacity: 0.5 }}>PAYE</span>
      </div>
      <div className="ts-card-body">
        <div className="ts-section-label">PERSONAL DETAILS</div>
        <div className="ts-form-grid ts-form-grid-3">
          <div className="ts-form-field">
            <label className="ts-label">Name</label>
            <input className="ts-input" disabled placeholder="—" />
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Position</label>
            <input className="ts-input" disabled placeholder="—" />
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Department</label>
            <select className="ts-select" disabled><option>Makeup</option></select>
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Employment Type</label>
            <select className="ts-select" disabled><option>PAYE</option></select>
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Email</label>
            <input className="ts-input" disabled placeholder="—" />
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Phone</label>
            <input className="ts-input" disabled placeholder="—" />
          </div>
        </div>

        <div className="ts-section-label" style={{ marginTop: 24 }}>RATE CARD</div>
        <div className="ts-form-grid ts-form-grid-3">
          <div className="ts-form-field">
            <label className="ts-label">Daily Rate ({sym})</label>
            <input className="ts-input" disabled placeholder="0" />
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Base Contract</label>
            <select className="ts-select" disabled><option>{contractLabel}</option></select>
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Day Type</label>
            <select className="ts-select" disabled><option>{dayTypeLabel}</option></select>
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Kit Rental ({sym})</label>
            <input className="ts-input" disabled placeholder="0" />
          </div>
          <div className="ts-form-field">
            <label className="ts-label">OT Multiplier</label>
            <input className="ts-input" disabled value="1.5" />
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Late Night Multiplier</label>
            <input className="ts-input" disabled value="2" />
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Pre-Call Multiplier</label>
            <input className="ts-input" disabled value="1.5" />
          </div>
          <div className="ts-form-field">
            <label className="ts-label">6th Day Multiplier</label>
            <input className="ts-input" disabled value="1.5" />
          </div>
          <div className="ts-form-field">
            <label className="ts-label">7th Day Multiplier</label>
            <input className="ts-input" disabled value="2" />
          </div>
        </div>

        <div className="ts-preview-overlay">
          <p>{hasCrew ? 'Select a crew member to edit their details' : 'Add a crew member to get started'}</p>
          {!hasCrew && (
            <button className="ts-btn ts-btn-primary" onClick={onAddCrew}>+ Add Crew</button>
          )}
        </div>
      </div>
    </div>
  );
}
