import { clsx } from 'clsx';
import { usePhotoUrl } from '@/hooks';
import type { Photo } from '@/types';

interface MasterReferenceProps {
  photo?: Photo;
  onCapture: () => void;
  onView?: () => void;
  onRemove?: () => void;
  className?: string;
}

export function MasterReference({
  photo,
  onCapture,
  onView,
  onRemove,
  className,
}: MasterReferenceProps) {
  const photoUrl = usePhotoUrl(photo);
  const hasPhoto = !!photo;

  const handleClick = () => {
    if (hasPhoto && onView) {
      onView();
    } else {
      onCapture();
    }
  };

  return (
    <div className={clsx('relative', className)}>
      <button
        type="button"
        onClick={handleClick}
        className={clsx(
          'w-full aspect-[16/9] rounded-lg overflow-hidden touch-manipulation transition-all',
          'focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2',
          {
            'border-2 border-dashed border-gray-300 bg-gray-50': !hasPhoto,
            'border-2 border-solid border-gold': hasPhoto,
          }
        )}
      >
        {hasPhoto ? (
          // Photo display
          <img
            src={photoUrl}
            alt="Master reference"
            className="w-full h-full object-cover"
          />
        ) : (
          // Empty state
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <CameraIcon className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-sm text-gray-500">Tap to set master reference</span>
          </div>
        )}
      </button>

      {/* Remove button */}
      {hasPhoto && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center tap-target touch-manipulation hover:bg-black/70"
          aria-label="Remove master reference"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Label overlay */}
      {hasPhoto && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
          <span className="text-xs font-medium text-white uppercase tracking-wide">
            Master Reference
          </span>
        </div>
      )}
    </div>
  );
}

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
