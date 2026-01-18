import type { ContinuityEvent } from '@/types';
import { Badge } from '../ui';

interface EventCardProps {
  event: ContinuityEvent;
  onRemove?: () => void;
}

export function EventCard({ event, onRemove }: EventCardProps) {
  return (
    <div className="card relative">
      {/* Remove button */}
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-text-muted hover:text-error hover:bg-red-50 transition-colors tap-target touch-manipulation"
          aria-label="Remove event"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Type badge */}
      <Badge variant="gold" size="md" className="mb-2">
        {event.type}
      </Badge>

      {/* Event name */}
      <h4 className="font-semibold text-text-primary text-base mb-1">
        {event.name}
      </h4>

      {/* Description */}
      {event.description && (
        <p className="text-sm text-text-secondary mb-3">
          {event.description}
        </p>
      )}

      {/* Stage and Scene range grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="field-label mb-1">STAGE</div>
          <div className="text-sm text-text-primary">{event.stage || '—'}</div>
        </div>
        <div>
          <div className="field-label mb-1">SCENES</div>
          <div className="text-sm text-text-primary">{event.sceneRange || '—'}</div>
        </div>
      </div>

      {/* Products */}
      {event.products && (
        <div>
          <div className="field-label mb-1">PRODUCTS</div>
          <div className="text-sm text-text-secondary">{event.products}</div>
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
