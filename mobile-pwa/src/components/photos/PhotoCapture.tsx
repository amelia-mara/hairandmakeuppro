import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { useCamera } from '@/hooks/useCamera';
import type { PhotoAngle } from '@/types';
import { Button } from '../ui';

interface PhotoCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (blob: Blob) => void;
  angle?: PhotoAngle;
  characterName?: string;
  sceneNumber?: number;
  lookName?: string;
}

const angleLabels: Record<PhotoAngle, string> = {
  front: 'Front View',
  left: 'Left View',
  right: 'Right View',
  back: 'Back View',
  additional: 'Additional',
};

export function PhotoCapture({
  isOpen,
  onClose,
  onCapture,
  angle = 'additional',
  characterName,
  sceneNumber,
  lookName,
}: PhotoCaptureProps) {
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const {
    videoRef,
    isReady,
    isCapturing,
    error,
    facingMode,
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
  } = useCamera({
    facingMode: 'environment',
    onError: (err) => console.error('Camera error:', err),
  });

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setCapturedBlob(null);
      setPreviewUrl(null);
    }
  }, [isOpen, startCamera, stopCamera]);

  // Clean up preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleCapture = async () => {
    const blob = await capturePhoto();
    if (blob) {
      const url = URL.createObjectURL(blob);
      setCapturedBlob(blob);
      setPreviewUrl(url);
    }
  };

  const handleRetake = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setCapturedBlob(null);
    setPreviewUrl(null);
  };

  const handleUsePhoto = () => {
    if (capturedBlob) {
      onCapture(capturedBlob);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="gold-gradient px-4 py-3 safe-top">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-white tap-target touch-manipulation"
            aria-label="Close camera"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="text-center">
            {characterName && (
              <div className="text-white font-semibold text-sm">{characterName}</div>
            )}
            <div className="text-white/80 text-xs">
              {sceneNumber && `Scene ${sceneNumber}`}
              {lookName && ` • ${lookName}`}
            </div>
          </div>
          <div className="w-6" /> {/* Spacer for alignment */}
        </div>
      </div>

      {/* Angle indicator */}
      <div className="bg-black/50 px-4 py-2 text-center">
        <span className="text-white/90 text-sm font-medium">
          {angleLabels[angle]}
        </span>
      </div>

      {/* Camera viewfinder or preview */}
      <div className="flex-1 relative overflow-hidden">
        {previewUrl ? (
          // Preview captured photo
          <img
            src={previewUrl}
            alt="Captured preview"
            className="w-full h-full object-contain"
          />
        ) : (
          // Camera viewfinder
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={clsx(
                'w-full h-full object-cover',
                { 'scale-x-[-1]': facingMode === 'user' }
              )}
            />

            {/* Loading/Error states */}
            {!isReady && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="text-white text-center">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <div className="text-sm">Starting camera...</div>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="text-white text-center px-8">
                  <svg className="w-12 h-12 mx-auto mb-3 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="text-sm mb-4">{error}</div>
                  <Button variant="outline" size="sm" onClick={startCamera}>
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black px-4 py-6 safe-bottom">
        {previewUrl ? (
          // Preview controls
          <div className="flex items-center justify-center gap-6">
            <Button
              variant="secondary"
              size="lg"
              onClick={handleRetake}
              className="flex-1 max-w-[140px]"
            >
              Retake
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={handleUsePhoto}
              className="flex-1 max-w-[140px]"
            >
              Use Photo
            </Button>
          </div>
        ) : (
          // Capture controls
          <div className="flex items-center justify-center gap-8">
            {/* Switch camera button */}
            <button
              onClick={switchCamera}
              disabled={!isReady}
              className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center tap-target touch-manipulation disabled:opacity-50"
              aria-label="Switch camera"
            >
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Capture button */}
            <button
              onClick={handleCapture}
              disabled={!isReady || isCapturing}
              className={clsx(
                'w-20 h-20 rounded-full border-4 border-white flex items-center justify-center tap-target touch-manipulation',
                'transition-transform active:scale-95',
                { 'opacity-50': !isReady || isCapturing }
              )}
              aria-label="Take photo"
            >
              <div className={clsx(
                'w-16 h-16 rounded-full bg-white',
                { 'animate-pulse': isCapturing }
              )} />
            </button>

            {/* Placeholder for symmetry */}
            <div className="w-12 h-12" />
          </div>
        )}
      </div>
    </div>
  );
}
