import type { ContinuityEvent } from '@/types';

interface EventCardProps {
  event: ContinuityEvent;
  onRemove?: () => void;
}

export function EventCard({ event, onRemove }: EventCardProps) {
  return (
    <div className="bg-card border border-border rounded-[10px] p-3.5 relative">
      {/* Remove button */}
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-3 right-3 p-1 text-text-light hover:text-text-muted transition-colors touch-manipulation"
          aria-label="Remove event"
        >
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      {/* Type badge */}
      <span className="inline-block text-[9px] font-bold tracking-widest uppercase text-gold bg-gold-100/50 px-2 py-0.5 rounded mb-2">
        {event.type}
      </span>

      {/* Event name */}
      <h4 className="font-semibold text-text-primary text-[15px] mb-1">
        {event.name}
      </h4>

      {/* Description */}
      {event.description && (
        <p className="text-[13px] text-text-secondary leading-snug mb-2.5">
          {event.description}
        </p>
      )}

      {/* Stage and Scene range grid */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
        <div>
          <span className="text-text-muted">Stage:</span>
          <span className="text-text-primary font-medium ml-1.5">{event.stage || '—'}</span>
        </div>
        <div>
          <span className="text-text-muted">Scenes:</span>
          <span className="text-text-primary font-medium ml-1.5">{event.sceneRange || '—'}</span>
        </div>
      </div>

      {/* Products */}
      {event.products && (
        <div className="text-xs mt-2">
          <span className="text-text-muted">Products:</span>
          <span className="text-text-primary ml-1.5">{event.products}</span>
        </div>
      )}

      {/* Reference photos */}
      {event.referencePhotos.length > 0 && (
        <div className="mt-3">
          <div className="field-label mb-2">REFERENCE PHOTOS</div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {event.referencePhotos.map((photo) => (
              <img
                key={photo.id}
                src={photo.thumbnail || photo.uri}
                alt="Reference"
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
