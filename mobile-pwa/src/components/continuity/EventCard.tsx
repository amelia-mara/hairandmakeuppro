import { useState } from 'react';
import { PhotoImg } from '@/hooks';
import type { ContinuityEvent } from '@/types';

interface EventCardProps {
  event: ContinuityEvent;
  onRemove?: () => void;
}

export function EventCard({ event, onRemove }: EventCardProps) {
  const [showTimeline, setShowTimeline] = useState(false);
  const hasProgression = event.progression && event.progression.length > 0;
  const scenes = event.scenes && event.scenes.length > 0 ? event.scenes : null;

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
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Type badge */}
      <span className="inline-block text-[9px] font-bold tracking-widest uppercase text-gold bg-gold-100/50 px-2 py-0.5 rounded mb-2">
        {event.type}
      </span>

      {/* Event name */}
      <h4 className="font-semibold text-text-primary text-[15px] mb-1 pr-6">
        {event.name}
      </h4>

      {/* Description */}
      {event.description && (
        <p className="text-[13px] text-text-secondary leading-snug mb-2.5">
          {event.description}
        </p>
      )}

      {/* Scene chips */}
      {scenes && (
        <div className="mb-2.5">
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide block mb-1.5">SCENES</span>
          <div className="flex flex-wrap gap-1">
            {scenes.map((scene) => {
              // Highlight scenes that have progression stages
              const hasStage = hasProgression && event.progression!.some((p) => p.scene === scene);
              return (
                <span
                  key={scene}
                  className={`inline-block min-w-[32px] text-center px-2 py-0.5 text-[11px] font-medium rounded ${
                    hasStage
                      ? 'bg-gold text-white'
                      : 'bg-gray-100 text-text-secondary'
                  }`}
                >
                  {scene}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Stage and fallback scene range */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
        <div>
          <span className="text-text-muted">Stage:</span>
          <span className="text-text-primary font-medium ml-1.5">{event.stage || '—'}</span>
        </div>
        {!scenes && (
          <div>
            <span className="text-text-muted">Scenes:</span>
            <span className="text-text-primary font-medium ml-1.5">{event.sceneRange || '—'}</span>
          </div>
        )}
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
              <PhotoImg
                key={photo.id}
                photo={photo}
                alt="Reference"
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              />
            ))}
          </div>
        </div>
      )}

      {/* Progression Timeline */}
      {hasProgression && (
        <div className="mt-3 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowTimeline(!showTimeline)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-gold mb-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Progression ({event.progression!.length} stage{event.progression!.length !== 1 ? 's' : ''})
            <svg
              className={`w-3.5 h-3.5 transition-transform ${showTimeline ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showTimeline && (
            <div className="relative pl-4">
              {/* Timeline line */}
              <div className="absolute left-[7px] top-1 bottom-1 w-[2px] bg-gold-200 rounded" />

              <div className="space-y-3">
                {event.progression!.map((ps, idx) => (
                  <div key={ps.id} className="relative">
                    {/* Timeline dot */}
                    <div className="absolute -left-4 top-0.5 w-4 h-4 rounded-full bg-gold flex items-center justify-center">
                      <span className="text-[8px] text-white font-bold">{idx + 1}</span>
                    </div>

                    <div className="ml-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-semibold text-text-primary">
                          {ps.stage || `Stage ${idx + 1}`}
                        </span>
                        {ps.scene && (
                          <span className="text-[10px] text-text-muted bg-gray-100 px-1.5 py-0.5 rounded">
                            Sc {ps.scene}
                          </span>
                        )}
                      </div>
                      {ps.notes && (
                        <p className="text-[11px] text-text-secondary leading-snug">
                          {ps.notes}
                        </p>
                      )}
                      {ps.referencePhotos && ps.referencePhotos.length > 0 && (
                        <div className="flex gap-1.5 mt-1.5">
                          {ps.referencePhotos.map((photo) => (
                            <PhotoImg
                              key={photo.id}
                              photo={photo}
                              alt="Stage reference"
                              className="w-10 h-10 rounded object-cover"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
