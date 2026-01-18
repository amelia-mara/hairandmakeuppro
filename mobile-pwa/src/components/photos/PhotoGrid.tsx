import { clsx } from 'clsx';
import type { Photo, PhotoAngle } from '@/types';
import { PhotoSlot } from './PhotoSlot';

interface PhotoGridProps {
  photos: {
    front?: Photo;
    left?: Photo;
    right?: Photo;
    back?: Photo;
  };
  onCapture: (angle: PhotoAngle) => void;
  onView?: (photo: Photo, angle: PhotoAngle) => void;
  onRemove?: (angle: PhotoAngle) => void;
  className?: string;
}

export function PhotoGrid({
  photos,
  onCapture,
  onView,
  onRemove,
  className,
}: PhotoGridProps) {
  const slots: { angle: PhotoAngle; photo?: Photo }[] = [
    { angle: 'front', photo: photos.front },
    { angle: 'left', photo: photos.left },
    { angle: 'right', photo: photos.right },
    { angle: 'back', photo: photos.back },
  ];

  return (
    <div className={clsx('grid grid-cols-4 gap-2.5', className)}>
      {slots.map(({ angle, photo }) => (
        <PhotoSlot
          key={angle}
          photo={photo}
          angle={angle}
          onCapture={() => onCapture(angle)}
          onView={photo && onView ? () => onView(photo, angle) : undefined}
          onRemove={photo && onRemove ? () => onRemove(angle) : undefined}
          size="portrait"
          showLabel
          isPrimary={angle === 'front'}
        />
      ))}
    </div>
  );
}

interface AdditionalPhotosGridProps {
  photos: Photo[];
  onCapture: () => void;
  onView?: (photo: Photo, index: number) => void;
  onRemove?: (photoId: string) => void;
  maxVisible?: number;
  className?: string;
}

export function AdditionalPhotosGrid({
  photos,
  onCapture,
  onView,
  onRemove,
  maxVisible = 8,
  className,
}: AdditionalPhotosGridProps) {
  const visiblePhotos = photos.slice(0, maxVisible);
  const remainingCount = photos.length - maxVisible;

  // Calculate number of empty slots to show
  const emptySlots = Math.max(0, 4 - (visiblePhotos.length % 4 || 4));
  const showEmptySlots = visiblePhotos.length < maxVisible;

  return (
    <div className={clsx('grid grid-cols-4 gap-2', className)}>
      {visiblePhotos.map((photo, index) => (
        <div key={photo.id} className="relative">
          <button
            type="button"
            onClick={() => onView?.(photo, index)}
            className="w-full aspect-square rounded-lg overflow-hidden border-2 border-gold touch-manipulation focus:outline-none focus:ring-2 focus:ring-gold"
          >
            <img
              src={photo.thumbnail || photo.uri}
              alt={`Additional photo ${index + 1}`}
              className="w-full h-full object-cover"
            />
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(photo.id);
              }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-error text-white rounded-full flex items-center justify-center shadow-sm touch-manipulation"
              aria-label="Remove photo"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {/* Show remaining count on last visible photo */}
          {index === maxVisible - 1 && remainingCount > 0 && (
            <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
              <span className="text-white font-semibold text-lg">+{remainingCount}</span>
            </div>
          )}
        </div>
      ))}

      {/* Empty slots for adding more photos */}
      {showEmptySlots && (
        Array.from({ length: Math.min(emptySlots + 1, maxVisible - visiblePhotos.length) }).map((_, index) => (
          <button
            key={`empty-${index}`}
            type="button"
            onClick={onCapture}
            className={clsx(
              'w-full aspect-square rounded-lg flex items-center justify-center touch-manipulation',
              'focus:outline-none focus:ring-2 focus:ring-gold',
              {
                'border-2 border-dashed border-gold bg-gold-50/50': index === 0,
                'border-2 border-dashed border-gray-300 bg-gray-50': index > 0,
              }
            )}
          >
            <svg
              className={clsx('w-5 h-5', {
                'text-gold': index === 0,
                'text-gray-400': index > 0,
              })}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        ))
      )}
    </div>
  );
}
