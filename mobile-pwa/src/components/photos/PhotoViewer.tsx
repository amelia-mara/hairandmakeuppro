import { useState, useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import type { Photo } from '@/types';

interface PhotoViewerProps {
  isOpen: boolean;
  photos: Photo[];
  initialIndex?: number;
  onClose: () => void;
  onDelete?: (photoId: string) => void;
}

export function PhotoViewer({
  isOpen,
  photos,
  initialIndex = 0,
  onClose,
  onDelete,
}: PhotoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showControls, setShowControls] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset index when photos change or modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.min(initialIndex, photos.length - 1));
      setShowControls(true);
    }
  }, [isOpen, initialIndex, photos.length]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, photos.length]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, photos.length]);

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;

    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50; // Minimum swipe distance

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        // Swiped left - go to next
        goToNext();
      } else {
        // Swiped right - go to previous
        goToPrevious();
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleDelete = async () => {
    if (!onDelete || isDeleting) return;

    const photoToDelete = photos[currentIndex];
    setIsDeleting(true);

    try {
      onDelete(photoToDelete.id);

      // Adjust index if we deleted the last photo
      if (currentIndex >= photos.length - 1 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }

      // Close if no photos left
      if (photos.length <= 1) {
        onClose();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleControls = () => {
    setShowControls(!showControls);
  };

  if (!isOpen || photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];
  if (!currentPhoto) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header controls */}
      <div
        className={clsx(
          'absolute top-0 left-0 right-0 z-10 transition-opacity duration-200',
          'bg-gradient-to-b from-black/60 to-transparent',
          'safe-top',
          { 'opacity-100': showControls, 'opacity-0 pointer-events-none': !showControls }
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 pt-[calc(env(safe-area-inset-top)+12px)]">
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm touch-manipulation"
            aria-label="Close"
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Photo counter */}
          <span className="text-white text-sm font-medium px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm">
            {currentIndex + 1} / {photos.length}
          </span>

          {/* Delete button */}
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm touch-manipulation disabled:opacity-50"
              aria-label="Delete photo"
            >
              {isDeleting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main photo display */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        onClick={toggleControls}
      >
        <img
          src={currentPhoto.uri}
          alt={`Photo ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain"
          draggable={false}
        />
      </div>

      {/* Navigation arrows (desktop/tablet) */}
      {photos.length > 1 && showControls && (
        <>
          {/* Previous button */}
          {currentIndex > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToPrevious();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm touch-manipulation hidden sm:flex"
              aria-label="Previous photo"
            >
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Next button */}
          {currentIndex < photos.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm touch-manipulation hidden sm:flex"
              aria-label="Next photo"
            >
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </>
      )}

      {/* Dot indicators */}
      {photos.length > 1 && showControls && (
        <div
          className={clsx(
            'absolute bottom-0 left-0 right-0 z-10',
            'bg-gradient-to-t from-black/60 to-transparent',
            'safe-bottom'
          )}
        >
          <div className="flex justify-center gap-1.5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-6">
            {photos.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(index);
                }}
                className={clsx(
                  'w-2 h-2 rounded-full transition-all touch-manipulation',
                  {
                    'bg-white w-6': index === currentIndex,
                    'bg-white/50': index !== currentIndex,
                  }
                )}
                aria-label={`Go to photo ${index + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Swipe hint for mobile */}
      {photos.length > 1 && showControls && (
        <div className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none sm:hidden">
          <span className="text-white/60 text-xs">Swipe to navigate</span>
        </div>
      )}
    </div>
  );
}
