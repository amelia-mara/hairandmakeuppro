import { addDays, formatShortDate } from '@/utils/bectuCalculations';

interface WeekSelectorProps {
  weekStart: string;
  onNavigate: (direction: 'prev' | 'next') => void;
}

export function WeekSelector({ weekStart, onNavigate }: WeekSelectorProps) {
  const weekEnd = addDays(weekStart, 6);

  return (
    <div className="ts-week-selector">
      <button className="ts-week-nav-btn" onClick={() => onNavigate('prev')} title="Previous week">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <span className="ts-week-label">
        {formatShortDate(weekStart)} – {formatShortDate(weekEnd)}
      </span>
      <button className="ts-week-nav-btn" onClick={() => onNavigate('next')} title="Next week">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}
