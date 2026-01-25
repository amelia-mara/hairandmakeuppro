import { useEffect, useState, useRef } from 'react';
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
  sceneNumber?: string;
  lookName?: string;
}

const angleLabels: Record<PhotoAngle, string> = {
  front: 'Front View',
  left: 'Left View',
  right: 'Right View',
  back: 'Back View',
  additional: 'Additional',
};

type CaptureMode = 'choose' | 'camera' | 'preview';

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
  const [mode, setMode] = useState<CaptureMode>('choose');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setMode('choose');
      setCapturedBlob(null);
      setPreviewUrl(null);
    } else {
      stopCamera();
      setCapturedBlob(null);
      setPreviewUrl(null);
    }
  }, [isOpen, stopCamera]);

  // Start camera when switching to camera mode
  useEffect(() => {
    if (mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
  }, [mode, startCamera, stopCamera]);

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
      setMode('preview');
    }
  };

  const handleRetake = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setCapturedBlob(null);
    setPreviewUrl(null);
    setMode('choose');
  };

  const handleUsePhoto = () => {
    if (capturedBlob) {
      onCapture(capturedBlob);
      onClose();
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Create blob from file
      const blob = file;
      const url = URL.createObjectURL(blob);
      setCapturedBlob(blob);
      setPreviewUrl(url);
      setMode('preview');
    }
    // Reset file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleChooseFromLibrary = () => {
    fileInputRef.current?.click();
  };

  const handleOpenCamera = () => {
    setMode('camera');
  };

  if (!isOpen) return null;

  // Choose mode - show options to take photo or choose from library
  if (mode === 'choose') {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture={undefined}
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Header */}
        <div className="gold-gradient px-4 py-3 safe-top">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="text-white tap-target touch-manipulation"
              aria-label="Close"
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
            <div className="w-6" />
          </div>
        </div>

        {/* Angle indicator */}
        <div className="bg-card border-b border-border px-4 py-3 text-center">
          <span className="text-text-primary text-sm font-medium">
            {angleLabels[angle]}
          </span>
        </div>

        {/* Options */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
          <div className="w-24 h-24 rounded-full bg-gold/10 flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>

          <h2 className="text-xl font-semibold text-text-primary mb-2">Add Photo</h2>
          <p className="text-text-secondary text-center text-sm mb-8">
            Take a new photo or choose one from your library
          </p>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleOpenCamera}
            className="max-w-xs"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Take Photo
          </Button>

          <Button
            variant="outline"
            size="lg"
            fullWidth
            onClick={handleChooseFromLibrary}
            className="max-w-xs"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            Choose from Library
          </Button>
        </div>
      </div>
    );
  }

  // Preview mode - show captured/selected photo
  if (mode === 'preview' && previewUrl) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        {/* Header */}
        <div className="gold-gradient px-4 py-3 safe-top">
          <div className="flex items-center justify-between">
            <button
              onClick={handleRetake}
              className="text-white tap-target touch-manipulation"
              aria-label="Back"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              {characterName && (
                <div className="text-white font-semibold text-sm">{characterName}</div>
              )}
              <div className="text-white/80 text-xs">
                {angleLabels[angle]}
              </div>
            </div>
            <div className="w-6" />
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 relative overflow-hidden bg-black">
          <img
            src={previewUrl}
            alt="Captured preview"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Controls */}
        <div className="bg-black px-4 py-6 safe-bottom">
          <div className="flex items-center justify-center gap-6">
            <Button
              variant="secondary"
              size="lg"
              onClick={handleRetake}
              className="flex-1 max-w-[140px]"
            >
              Change
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
        </div>
      </div>
    );
  }

  // Camera mode - live viewfinder
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Hidden file input for library fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header */}
      <div className="gold-gradient px-4 py-3 safe-top">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setMode('choose')}
            className="text-white tap-target touch-manipulation"
            aria-label="Back"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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
          <div className="w-6" />
        </div>
      </div>

      {/* Angle indicator */}
      <div className="bg-black/50 px-4 py-2 text-center">
        <span className="text-white/90 text-sm font-medium">
          {angleLabels[angle]}
        </span>
      </div>

      {/* Camera viewfinder */}
      <div className="flex-1 relative overflow-hidden">
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

        {/* Loading state */}
        {!isReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-white text-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <div className="text-sm">Starting camera...</div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-white text-center px-8">
              <svg className="w-12 h-12 mx-auto mb-3 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-sm mb-4">
                {error.includes('permission') || error.includes('Permission')
                  ? 'Camera access denied. Please allow camera access in your browser settings.'
                  : error}
              </div>
              <div className="flex flex-col gap-3">
                <Button variant="primary" size="sm" onClick={startCamera}>
                  Try Again
                </Button>
                <Button variant="outline" size="sm" onClick={handleChooseFromLibrary}>
                  Choose from Library Instead
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black px-4 py-6 safe-bottom">
        <div className="flex items-center justify-center gap-8">
          {/* Gallery button */}
          <button
            onClick={handleChooseFromLibrary}
            className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center tap-target touch-manipulation"
            aria-label="Choose from library"
          >
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
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
        </div>
      </div>
    </div>
  );
}
