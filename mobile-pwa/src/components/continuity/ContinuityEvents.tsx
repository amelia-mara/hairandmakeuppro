import type { ContinuityEvent } from '@/types';
import { Button } from '../ui';
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
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-header">CONTINUITY EVENTS</h3>
        <Button variant="outline" size="sm" onClick={onAddEvent}>
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Event
        </Button>
      </div>

      {events.length === 0 ? (
        <EmptyState onAdd={onAddEvent} />
      ) : (
        <div className="space-y-3">
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
      className="w-full card flex flex-col items-center justify-center py-8 text-center touch-manipulation hover:shadow-card-hover transition-shadow"
    >
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      </div>
      <span className="text-sm text-text-muted">No continuity events</span>
      <span className="text-xs text-gold mt-1">Tap to add one</span>
    </button>
  );
}
