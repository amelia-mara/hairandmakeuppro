import { useEffect, useRef } from 'react';

export function useAutoSave(callback: () => void, intervalMs: number = 30000) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const timer = setInterval(() => {
      callbackRef.current();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);
}
