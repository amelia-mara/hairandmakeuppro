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
          <div className="ts-empty-state">
            <p>Select a crew member or add one to get started</p>
          </div>
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
