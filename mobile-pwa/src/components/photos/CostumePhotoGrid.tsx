import { clsx } from 'clsx';
import { usePhotoUrl } from '@/hooks';
import type { Photo } from '@/types';
import { COSTUME_PHOTO_CATEGORIES, type CostumePhotoCategory } from '@/config/department';

interface CostumePhotoGridProps {
  photos: Partial<Record<CostumePhotoCategory, Photo>>;
  onCapture: (category: CostumePhotoCategory) => void;
  onView?: (photo: Photo, category: CostumePhotoCategory) => void;
  className?: string;
}

export function CostumePhotoGrid({
  photos,
  onCapture,
  onView,
  className,
}: CostumePhotoGridProps) {
  const masterCategory = COSTUME_PHOTO_CATEGORIES[0]; // Master Reference
  const otherCategories = COSTUME_PHOTO_CATEGORIES.slice(1);

  return (
    <div className={clsx('space-y-3', className)}>
      {/* Master Reference - larger card with gold dashed border */}
      <CostumePhotoSlot
        photo={photos[masterCategory.key]}
        category={masterCategory.key}
        label={masterCategory.label}
        isMaster
        onCapture={() => onCapture(masterCategory.key)}
        onView={photos[masterCategory.key] && onView
          ? () => onView(photos[masterCategory.key]!, masterCategory.key)
          : undefined
        }
      />

      {/* Other categories in 3-column grid */}
      <div className="grid grid-cols-3 gap-2">
        {otherCategories.map((cat) => (
          <CostumePhotoSlot
            key={cat.key}
            photo={photos[cat.key]}
            category={cat.key}
            label={cat.label}
            onCapture={() => onCapture(cat.key)}
            onView={photos[cat.key] && onView
              ? () => onView(photos[cat.key]!, cat.key)
              : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

// Individual costume photo slot
interface CostumePhotoSlotProps {
  photo?: Photo;
  category: CostumePhotoCategory;
  label: string;
  isMaster?: boolean;
  onCapture: () => void;
  onView?: () => void;
}

function CostumePhotoSlot({
  photo,
  label,
  isMaster = false,
  onCapture,
  onView,
}: CostumePhotoSlotProps) {
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
    <button
      type="button"
      onClick={handleClick}
      className={clsx(
        'relative rounded-[10px] overflow-hidden touch-manipulation transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2',
        'w-full',
        {
          'aspect-[4/3]': isMaster,
          'aspect-[3/4]': !isMaster,
          'border-2 border-dashed border-gold bg-gold-50/30': !hasPhoto && isMaster,
          'border-2 border-dashed border-gray-300 bg-gray-50': !hasPhoto && !isMaster,
          'border-2 border-solid border-gold': hasPhoto,
        }
      )}
    >
      {hasPhoto ? (
        <>
          <img
            src={photoUrl}
            alt={label}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
            <span className={clsx('font-medium text-white uppercase tracking-wide', {
              'text-[10px]': !isMaster,
              'text-xs': isMaster,
            })}>
              {label}
            </span>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <svg
            className={clsx('text-gray-400', {
              'w-8 h-8': isMaster,
              'w-5 h-5': !isMaster,
            })}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
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
          <span className={clsx('font-bold uppercase tracking-widest text-gray-400 mt-1.5 text-center px-1', {
            'text-[7px] leading-tight': !isMaster,
            'text-[10px]': isMaster,
          })}>
            {label}
          </span>
          {isMaster && (
            <span className="text-[8px] text-gold font-medium mt-0.5">Hero Shot</span>
          )}
        </div>
      )}
    </button>
  );
}
