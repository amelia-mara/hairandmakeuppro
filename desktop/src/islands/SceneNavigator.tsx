/**
 * SceneNavigator Island
 *
 * Compact scene navigation strip that sits at the top of the left sidebar.
 * Provides keyboard-navigable previous/next scene controls and a jump-to
 * dropdown — enhancing the existing vanilla scene list below it.
 *
 * Mount point: #island-scene-navigator
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { useLegacyState, callLegacy, notifyStateChange } from './bridge';

export default function SceneNavigator() {
  const scenes = useLegacyState((s) => s.scenes) || [];
  const currentScene = useLegacyState((s) => s.currentScene);
  const breakdowns = useLegacyState((s) => s.sceneBreakdowns) || {};
  const selectRef = useRef<HTMLSelectElement>(null);

  const totalScenes = scenes.length;
  if (totalScenes === 0) return null;

  const currentIdx = currentScene ?? -1;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < totalScenes - 1;

  const goTo = useCallback((index: number) => {
    if (index >= 0 && index < totalScenes) {
      callLegacy('selectScene', index);
    }
  }, [totalScenes]);

  const goPrev = useCallback(() => {
    if (hasPrev) goTo(currentIdx - 1);
  }, [hasPrev, currentIdx, goTo]);

  const goNext = useCallback(() => {
    if (hasNext) goTo(currentIdx + 1);
  }, [hasNext, currentIdx, goTo]);

  // Find next unprocessed scene
  const goNextUnprocessed = useCallback(() => {
    for (let i = currentIdx + 1; i < totalScenes; i++) {
      const b = breakdowns[i];
      if (!b || (!b.cast?.length && !b.synopsis && !b.processed)) {
        goTo(i);
        return;
      }
    }
    // Wrap around
    for (let i = 0; i < currentIdx; i++) {
      const b = breakdowns[i];
      if (!b || (!b.cast?.length && !b.synopsis && !b.processed)) {
        goTo(i);
        return;
      }
    }
  }, [currentIdx, totalScenes, breakdowns, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't interfere with inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        goNextUnprocessed();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext, goNextUnprocessed]);

  const sceneLabel = currentIdx >= 0
    ? scenes[currentIdx]?.number || currentIdx + 1
    : '—';

  return (
    <div style={styles.container}>
      {/* Prev / Next buttons */}
      <button
        style={{ ...styles.btn, opacity: hasPrev ? 1 : 0.3 }}
        disabled={!hasPrev}
        onClick={goPrev}
        title="Previous scene (↑ or k)"
      >
        ‹
      </button>

      {/* Scene selector dropdown */}
      <select
        ref={selectRef}
        style={styles.select}
        value={currentIdx}
        onChange={(e) => goTo(Number(e.target.value))}
        title="Jump to scene"
      >
        {scenes.map((scene: any, idx: number) => {
          const num = scene.number || idx + 1;
          const hasData = !!(breakdowns[idx]?.cast?.length || breakdowns[idx]?.synopsis);
          const isComplete = !!breakdowns[idx]?.isComplete;
          const marker = isComplete ? ' ✓' : hasData ? ' ◐' : '';
          const heading = scene.heading
            ? ` — ${scene.heading.substring(0, 30)}`
            : '';
          return (
            <option key={idx} value={idx}>
              Sc {num}{heading}{marker}
            </option>
          );
        })}
      </select>

      <button
        style={{ ...styles.btn, opacity: hasNext ? 1 : 0.3 }}
        disabled={!hasNext}
        onClick={goNext}
        title="Next scene (↓ or j)"
      >
        ›
      </button>

      {/* Jump to next unprocessed */}
      <button
        style={styles.skipBtn}
        onClick={goNextUnprocessed}
        title="Jump to next unprocessed scene (n)"
      >
        skip ›
      </button>

      {/* Position indicator */}
      <span style={styles.position}>
        {currentIdx + 1} / {totalScenes}
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 8px 6px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  btn: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '16px',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
    flexShrink: 0,
  },
  select: {
    flex: 1,
    minWidth: 0,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '11px',
    padding: '4px 6px',
    cursor: 'pointer',
    outline: 'none',
  },
  skipBtn: {
    background: 'none',
    border: '1px solid rgba(201, 169, 97, 0.3)',
    borderRadius: '4px',
    color: '#c9a962',
    fontSize: '10px',
    padding: '3px 6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  position: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: '10px',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
};
