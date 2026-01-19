import { clsx } from 'clsx';
import type { Photo, PhotoAngle } from '@/types';

interface PhotoSlotProps {
  photo?: Photo;
  angle: PhotoAngle;
  onCapture: () => void;
  onView?: () => void;
  onRemove?: () => void;
  size?: 'sm' | 'md' | 'lg' | 'portrait';
  showLabel?: boolean;
  isPrimary?: boolean;
}

const angleLabels: Record<PhotoAngle, string> = {
  front: 'Front',
  left: 'Left',
  right: 'Right',
  back: 'Back',
  additional: '',
};

export function PhotoSlot({
  photo,
  angle,
  onCapture,
  onView,
  onRemove,
  size = 'md',
  showLabel = true,
  isPrimary = false,
}: PhotoSlotProps) {
  const hasPhoto = !!photo;
  const label = angleLabels[angle];

  const handleClick = () => {
    if (hasPhoto && onView) {
      onView();
    } else {
      onCapture();
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        className={clsx(
          'relative rounded-[10px] overflow-hidden touch-manipulation transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2',
          {
            // Size variants
            'w-full aspect-square': size === 'sm',
            'w-full aspect-[4/3]': size === 'md',
            'w-full aspect-[16/9]': size === 'lg',
            'w-full aspect-[3/4]': size === 'portrait',
            // Border styles
            'border-2 border-dashed': !hasPhoto,
            'border-gold': !hasPhoto && isPrimary,
            'border-gray-300': !hasPhoto && !isPrimary,
            'border-2 border-solid border-gold': hasPhoto,
          }
        )}
      >
        {hasPhoto ? (
          // Photo display
          <>
            <img
              src={photo.thumbnail || photo.uri}
              alt={`${label} view`}
              className="w-full h-full object-cover"
            />
            {showLabel && label && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                <span className="text-[10px] font-medium text-white uppercase tracking-wide">
                  {label}
                </span>
              </div>
            )}
          </>
        ) : (
          // Empty state
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
            <CameraIcon className={clsx('text-gray-400', {
              'w-5 h-5': size === 'sm' || size === 'portrait',
              'w-6 h-6': size === 'md',
              'w-8 h-8': size === 'lg',
            })} />
            {showLabel && label && (
              <span className={clsx('font-bold uppercase tracking-widest text-gray-400 mt-2', {
                'text-[9px]': size === 'sm' || size === 'portrait',
                'text-[10px]': size === 'md',
                'text-xs': size === 'lg',
              })}>
                {label}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Remove button for filled slots */}
      {hasPhoto && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-error text-white rounded-full flex items-center justify-center shadow-md tap-target touch-manipulation"
          aria-label="Remove photo"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// Compact photo slot for scene thumbnails
interface SceneThumbnailSlotProps {
  sceneNumber: string;
  hasCaptured: boolean;
  isActive: boolean;
  onClick: () => void;
}

export function SceneThumbnailSlot({
  sceneNumber,
  hasCaptured,
  isActive,
  onClick,
}: SceneThumbnailSlotProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex flex-col items-center gap-1.5 touch-manipulation',
        'focus:outline-none'
      )}
    >
      <div
        className={clsx(
          'w-[70px] h-[70px] rounded-lg flex items-center justify-center transition-all',
          {
            'border-2 border-solid border-gold bg-gold-50': hasCaptured,
            'border-2 border-dashed border-gray-300 bg-gray-50': !hasCaptured,
            'ring-2 ring-gold ring-offset-2': isActive,
          }
        )}
      >
        {hasCaptured ? (
          <CheckIcon className="w-6 h-6 text-gold" />
        ) : (
          <CameraIcon className="w-5 h-5 text-gray-400" />
        )}
      </div>
      <span
        className={clsx('text-xs font-medium', {
          'text-gold': isActive,
          'text-text-secondary': !isActive,
        })}
      >
        {sceneNumber}
      </span>
    </button>
  );
}

// Icon components
function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
