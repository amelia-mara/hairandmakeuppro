import type { CrewMember } from '@/stores/timesheetStore';

interface WeeklyCrewSelectorProps {
  crew: CrewMember[];
  selectedCrewId: string | null;
  onSelectCrew: (crewId: string | null) => void;
}

export function WeeklyCrewSelector({ crew, selectedCrewId, onSelectCrew }: WeeklyCrewSelectorProps) {
  return (
    <div className="ts-crew-selector">
      {crew.map(member => (
        <button
          key={member.id}
          className={`ts-crew-chip ${selectedCrewId === member.id ? 'ts-crew-chip-active' : ''}`}
          onClick={() => onSelectCrew(member.id)}
        >
          <span className="ts-crew-chip-name">{member.name}</span>
          <span className={`ts-type-dot ts-type-dot-${member.crewType}`} />
        </button>
      ))}
    </div>
  );
}
