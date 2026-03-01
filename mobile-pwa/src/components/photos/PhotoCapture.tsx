import { useEffect, useState, useRef } from 'react';
import { clsx } from 'clsx';
import { useCamera } from '@/hooks/useCamera';
import type { PhotoAngle } from '@/types';

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
  front: 'Front',
  left: 'Left',
  right: 'Right',
  back: 'Back',
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

  // Context line: "Character · Scene 1 · Look Name · Front"
  const contextParts = [
    characterName,
    sceneNumber && `Sc ${sceneNumber}`,
    lookName,
    angleLabels[angle],
  ].filter(Boolean);
  const contextLine = contextParts.join(' \u00B7 ');

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
        <div className="bg-card border-b border-border safe-top">
          <div className="h-14 px-4 flex items-center justify-between">
            <button
              onClick={onClose}
              className="p-2 -ml-2 text-text-muted hover:text-text-primary transition-colors tap-target touch-manipulation"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="text-center flex-1 mx-4">
              <h1 className="text-sm font-semibold text-text-primary">Add Photo</h1>
              {contextLine && (
                <p className="text-[11px] text-text-muted truncate">{contextLine}</p>
              )}
            </div>
            <div className="w-9" />
          </div>
        </div>

        {/* Options */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
          <div className="w-20 h-20 rounded-2xl bg-gold/10 flex items-center justify-center mb-2">
            <svg className="w-10 h-10 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>

          <p className="text-text-secondary text-center text-sm mb-6">
            Take a new photo or choose from your library
          </p>

          <button
            onClick={handleOpenCamera}
            className="w-full max-w-xs flex items-center gap-3 px-4 py-3.5 rounded-xl bg-card border border-border active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-text-primary">Take Photo</p>
              <p className="text-xs text-text-muted">Use your camera</p>
            </div>
            <svg className="w-4 h-4 text-text-light ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          <button
            onClick={handleChooseFromLibrary}
            className="w-full max-w-xs flex items-center gap-3 px-4 py-3.5 rounded-xl bg-card border border-border active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-text-primary">Choose from Library</p>
              <p className="text-xs text-text-muted">Select an existing photo</p>
            </div>
            <svg className="w-4 h-4 text-text-light ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Preview mode - show captured/selected photo
  if (mode === 'preview' && previewUrl) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Header - translucent over image */}
        <div className="absolute top-0 left-0 right-0 z-10 safe-top">
          <div className="h-14 px-4 flex items-center justify-between">
            <button
              onClick={handleRetake}
              className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center tap-target touch-manipulation"
              aria-label="Back"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm">
              <span className="text-white text-xs font-medium">{contextLine}</span>
            </div>
            <div className="w-9" />
          </div>
        </div>

        {/* Preview image */}
        <div className="flex-1 relative overflow-hidden bg-gray-950">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Controls - frosted bottom bar */}
        <div className="bg-card border-t border-border px-4 py-4 safe-bottom">
          <div className="flex items-center gap-3 max-w-sm mx-auto">
            <button
              onClick={handleRetake}
              className="flex-1 py-3 px-4 rounded-xl border border-border text-sm font-medium text-text-primary active:scale-[0.97] transition-transform"
            >
              Change
            </button>
            <button
              onClick={handleUsePhoto}
              className="flex-1 py-3 px-4 rounded-xl gold-gradient text-white text-sm font-medium active:scale-[0.97] transition-transform"
            >
              Use Photo
            </button>
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

      {/* Header - translucent over viewfinder */}
      <div className="absolute top-0 left-0 right-0 z-10 safe-top">
        <div className="h-14 px-4 flex items-center justify-between">
          <button
            onClick={() => setMode('choose')}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center tap-target touch-manipulation"
            aria-label="Back"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm">
            <span className="text-white text-xs font-medium">{contextLine}</span>
          </div>
          <button
            onClick={switchCamera}
            disabled={!isReady}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center tap-target touch-manipulation disabled:opacity-50"
            aria-label="Switch camera"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
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
              <div className="w-8 h-8 border-2 border-white/60 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <div className="text-sm text-white/70">Starting camera...</div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-center px-8 max-w-sm">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="text-sm text-white/70 mb-6">
                {error.includes('permission') || error.includes('Permission')
                  ? 'Camera access denied. Please allow camera access in your browser settings.'
                  : error}
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={startCamera}
                  className="w-full py-3 rounded-xl gold-gradient text-white text-sm font-medium"
                >
                  Try Again
                </button>
                <button
                  onClick={handleChooseFromLibrary}
                  className="w-full py-3 rounded-xl bg-white/10 text-white text-sm font-medium"
                >
                  Choose from Library
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls - floating over bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-10 safe-bottom">
        <div className="px-4 pb-6 pt-16 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-center gap-8">
            {/* Gallery button */}
            <button
              onClick={handleChooseFromLibrary}
              className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center tap-target touch-manipulation"
              aria-label="Choose from library"
            >
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                'w-[72px] h-[72px] rounded-full border-[3px] border-white/90 flex items-center justify-center tap-target touch-manipulation',
                'transition-all active:scale-95',
                { 'opacity-50': !isReady || isCapturing }
              )}
              aria-label="Take photo"
            >
              <div className={clsx(
                'w-[60px] h-[60px] rounded-full bg-white',
                { 'animate-pulse': isCapturing }
              )} />
            </button>

            {/* Spacer to balance layout */}
            <div className="w-12 h-12" />
          </div>
        </div>
      </div>
    </div>
  );
}
