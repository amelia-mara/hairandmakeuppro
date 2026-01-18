import type { ContinuityEvent } from '@/types';
import { EventCard } from './EventCard';

interface ContinuityEventsProps {
  events: ContinuityEvent[];
  onAddEvent: () => void;
  onRemoveEvent: (eventId: string) => void;
  onEditEvent?: (eventId: string) => void;
}

export function ContinuityEvents({
  events,
  onAddEvent,
  onRemoveEvent,
}: ContinuityEventsProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="section-header">CONTINUITY EVENTS</h3>
        <button
          onClick={onAddEvent}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-gold-100/50 text-gold text-[11px] font-semibold hover:bg-gold-100 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Event
        </button>
      </div>

      {events.length === 0 ? (
        <EmptyState onAdd={onAddEvent} />
      ) : (
        <div className="space-y-2.5">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onRemove={() => onRemoveEvent(event.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface EmptyStateProps {
  onAdd: () => void;
}

function EmptyState({ onAdd }: EmptyStateProps) {
  return (
    <button
      onClick={onAdd}
      className="w-full flex flex-col items-center justify-center py-6 text-center touch-manipulation"
    >
      <svg className="w-8 h-8 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="12" y1="18" x2="12" y2="12" strokeLinecap="round" />
        <line x1="9" y1="15" x2="15" y2="15" strokeLinecap="round" />
      </svg>
      <span className="text-[13px] text-text-light">No continuity events</span>
      <span className="text-[11px] text-text-placeholder mt-1">Add wounds, bruises, prosthetics etc.</span>
    </button>
  );
}
