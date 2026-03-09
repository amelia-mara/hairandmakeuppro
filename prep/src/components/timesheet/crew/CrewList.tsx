import type { CrewMember } from '@/stores/timesheetStore';

interface CrewListProps {
  crew: CrewMember[];
  selectedCrewId: string | null;
  onSelectCrew: (crewId: string | null) => void;
  onRemoveCrew: (id: string) => void;
  onAddCrew: () => void;
}

export function CrewList({ crew, selectedCrewId, onSelectCrew, onRemoveCrew, onAddCrew }: CrewListProps) {
  return (
    <div className="ts-card">
      <div className="ts-card-header">
        <h3 className="ts-card-title">Crew ({crew.length})</h3>
        <button className="btn-gold ts-btn-sm" onClick={onAddCrew}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Crew
        </button>
      </div>
      <div className="ts-card-body ts-crew-list-body">
        {crew.length === 0 ? (
          <div className="ts-empty-hint">No crew members yet. Click "Add Crew" to get started.</div>
        ) : (
          <div className="ts-crew-list">
            {crew.map(member => (
              <div
                key={member.id}
                className={`ts-crew-row ${selectedCrewId === member.id ? 'ts-crew-row-active' : ''}`}
                onClick={() => onSelectCrew(member.id)}
              >
                <div className="ts-crew-row-info">
                  <span className="ts-crew-name">{member.name}</span>
                  <span className="ts-crew-position">{member.position}</span>
                </div>
                <div className="ts-crew-row-meta">
                  <span className={`ts-type-badge ts-type-${member.crewType}`}>
                    {member.crewType.toUpperCase()}
                  </span>
                  <span className="ts-crew-dept">{member.department}</span>
                  <button
                    className="ts-delete-btn"
                    onClick={e => { e.stopPropagation(); onRemoveCrew(member.id); }}
                    title="Remove crew member"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
