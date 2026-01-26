import { useState, useRef, useCallback, useEffect } from 'react';

interface UseCameraOptions {
  facingMode?: 'user' | 'environment';
  onCapture?: (blob: Blob) => void;
  onError?: (error: Error) => void;
}

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  isReady: boolean;
  isCapturing: boolean;
  error: string | null;
  facingMode: 'user' | 'environment';
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  capturePhoto: () => Promise<Blob | null>;
  switchCamera: () => Promise<void>;
}

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const {
    facingMode: initialFacingMode = 'environment',
    onCapture,
    onError,
  } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(initialFacingMode);

  // Create canvas for capturing
  useEffect(() => {
    canvasRef.current = document.createElement('canvas');
    return () => {
      canvasRef.current = null;
    };
  }, []);

  // Stop camera helper - releases all media tracks
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsReady(false);
  }, []);

  // Cleanup on unmount - ensures camera is released when component unmounts
  useEffect(() => {
    // Return cleanup function that uses refs directly (not callbacks)
    // to avoid stale closure issues
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsReady(false);

      // Stop any existing stream
      stopCamera();

      // Check for camera support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this device');
      }

      // Request camera access
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsReady(true);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [facingMode, stopCamera, onError]);

  const switchCamera = useCallback(async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);

    // Restart camera with new facing mode
    if (streamRef.current) {
      stopCamera();
      // Small delay to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: newFacingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsReady(true);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to switch camera';
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      }
    }
  }, [facingMode, stopCamera, onError]);

  const capturePhoto = useCallback(async (): Promise<Blob | null> => {
    if (!videoRef.current || !canvasRef.current || !isReady) {
      return null;
    }

    try {
      setIsCapturing(true);

      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Set canvas dimensions to video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw video frame to canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // If using front camera, flip horizontally
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0);

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to capture photo'));
            }
          },
          'image/jpeg',
          0.9
        );
      });

      onCapture?.(blob);
      return blob;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to capture photo';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [isReady, facingMode, onCapture, onError]);

  return {
    videoRef,
    isReady,
    isCapturing,
    error,
    facingMode,
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
  };
}

// Hook for checking camera permissions
export function useCameraPermissions() {
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');

  useEffect(() => {
    let permissionStatus: PermissionStatus | null = null;

    const handleChange = () => {
      if (permissionStatus) {
        setPermission(permissionStatus.state);
      }
    };

    const checkPermission = async () => {
      try {
        if (!navigator.permissions) {
          setPermission('unknown');
          return;
        }

        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        permissionStatus = result;
        setPermission(result.state);

        // Add listener with proper cleanup reference
        result.addEventListener('change', handleChange);
      } catch {
        setPermission('unknown');
      }
    };

    checkPermission();

    // Cleanup: remove event listener when component unmounts
    return () => {
      if (permissionStatus) {
        permissionStatus.removeEventListener('change', handleChange);
      }
    };
  }, []);

  return permission;
}
