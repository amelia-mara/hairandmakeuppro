import { useEffect, useCallback } from 'react';

type KeyHandler = (e: KeyboardEvent) => void;

interface KeyBinding {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: KeyHandler;
}

export function useKeyboard(bindings: KeyBinding[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      for (const binding of bindings) {
        const keyMatch = e.key.toLowerCase() === binding.key.toLowerCase();
        const ctrlMatch = binding.ctrl ? e.ctrlKey || e.metaKey : true;
        const metaMatch = binding.meta ? e.metaKey : true;
        const shiftMatch = binding.shift ? e.shiftKey : !e.shiftKey || binding.shift === undefined;

        if (keyMatch && ctrlMatch && metaMatch && shiftMatch) {
          // Don't trigger in inputs unless it's a ctrl/meta combo
          const target = e.target as HTMLElement;
          const isInput =
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable;

          if (isInput && !binding.ctrl && !binding.meta) continue;

          e.preventDefault();
          binding.handler(e);
          return;
        }
      }
    },
    [bindings]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
