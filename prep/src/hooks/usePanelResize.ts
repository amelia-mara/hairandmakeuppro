import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Draggable panel-divider hook with localStorage persistence.
 *
 * Wires up the mousedown→mousemove→mouseup pipeline for a vertical
 * divider that resizes a panel by dragging it left or right. The
 * panel's current width is persisted to localStorage under the
 * supplied key so the layout survives reloads, and double-clicking
 * the divider snaps the width back to the supplied default.
 *
 * Generic and side-aware: pass `'left'` for a divider that lives on
 * a panel's right edge (drag right → wider), or `'right'` for a
 * divider on a panel's left edge (drag left → wider). Width is
 * always clamped to `[min, max]`.
 *
 * Returns the current `width` plus the two event handlers to attach
 * to the divider element:
 *
 *     const right = usePanelResize('my-right-panel', 400, 300, 560, 'right');
 *     <div style={{ width: right.width }}>…</div>
 *     <div className="divider"
 *          onMouseDown={right.onMouseDown}
 *          onDoubleClick={right.onDoubleClick} />
 */
export function usePanelResize(
  storageKey: string,
  defaultWidth: number,
  min: number,
  max: number,
  side: 'left' | 'right',
) {
  const [width, setWidth] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) { const n = Number(saved); if (n >= min && n <= max) return n; }
    } catch { /* ignore */ }
    return defaultWidth;
  });
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = side === 'left'
        ? ev.clientX - startX.current
        : startX.current - ev.clientX;
      const next = Math.max(min, Math.min(max, startW.current + delta));
      setWidth(next);
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [width, min, max, side]);

  const onDoubleClick = useCallback(() => { setWidth(defaultWidth); }, [defaultWidth]);

  useEffect(() => {
    localStorage.setItem(storageKey, String(width));
  }, [storageKey, width]);

  return { width, onMouseDown, onDoubleClick };
}
