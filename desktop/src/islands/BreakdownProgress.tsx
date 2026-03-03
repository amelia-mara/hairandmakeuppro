/**
 * BreakdownProgress Island
 *
 * A progress bar + stats strip that mounts below the top bar on the
 * script-breakdown page. Shows overall breakdown completion at a glance.
 *
 * Mount point: #island-breakdown-progress
 */

import React from 'react';
import { useLegacyState } from './bridge';

interface SceneBreakdown {
  cast?: string[];
  elements?: Record<string, any>;
  synopsis?: string;
  isComplete?: boolean;
  processed?: boolean;
}

export default function BreakdownProgress() {
  const scenes = useLegacyState((s) => s.scenes) || [];
  const breakdowns = useLegacyState((s) => s.sceneBreakdowns) || {};
  const confirmedCharacters = useLegacyState((s) => s.confirmedCharacters);
  const currentScene = useLegacyState((s) => s.currentScene);

  const totalScenes = scenes.length;
  if (totalScenes === 0) return null; // Don't show until script is loaded

  // Count scenes with any breakdown data
  const processedCount = Object.keys(breakdowns).filter((key) => {
    const b = breakdowns[Number(key)] as SceneBreakdown | undefined;
    return b && (b.cast?.length || b.synopsis || b.processed);
  }).length;

  // Count fully completed scenes
  const completedCount = Object.keys(breakdowns).filter((key) => {
    const b = breakdowns[Number(key)] as SceneBreakdown | undefined;
    return b?.isComplete;
  }).length;

  const charCount = confirmedCharacters instanceof Set
    ? confirmedCharacters.size
    : 0;

  const progressPct = totalScenes > 0
    ? Math.round((processedCount / totalScenes) * 100)
    : 0;

  const completePct = totalScenes > 0
    ? Math.round((completedCount / totalScenes) * 100)
    : 0;

  return (
    <div style={styles.container}>
      {/* Progress bar */}
      <div style={styles.barTrack}>
        <div
          style={{
            ...styles.barFillProcessed,
            width: `${progressPct}%`,
          }}
        />
        <div
          style={{
            ...styles.barFillComplete,
            width: `${completePct}%`,
          }}
        />
      </div>

      {/* Stats */}
      <div style={styles.stats}>
        <span style={styles.stat}>
          <span style={styles.statValue}>{totalScenes}</span>
          <span style={styles.statLabel}>scenes</span>
        </span>

        <span style={styles.divider}>|</span>

        <span style={styles.stat}>
          <span style={{ ...styles.statValue, color: '#fbbf24' }}>
            {processedCount}
          </span>
          <span style={styles.statLabel}>processed</span>
        </span>

        <span style={styles.divider}>|</span>

        <span style={styles.stat}>
          <span style={{ ...styles.statValue, color: '#34d399' }}>
            {completedCount}
          </span>
          <span style={styles.statLabel}>complete</span>
        </span>

        <span style={styles.divider}>|</span>

        <span style={styles.stat}>
          <span style={{ ...styles.statValue, color: '#c9a962' }}>
            {charCount}
          </span>
          <span style={styles.statLabel}>characters</span>
        </span>

        {currentScene !== null && currentScene !== undefined && (
          <>
            <span style={styles.divider}>|</span>
            <span style={styles.stat}>
              <span style={styles.statLabel}>viewing scene</span>
              <span style={{ ...styles.statValue, color: '#fff' }}>
                {scenes[currentScene]?.number || currentScene + 1}
              </span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// Inline styles to avoid dependency on Tailwind in the legacy page
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '6px 20px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: '12px',
    minHeight: '32px',
  },
  barTrack: {
    position: 'relative',
    width: '120px',
    height: '4px',
    borderRadius: '2px',
    background: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    flexShrink: 0,
  },
  barFillProcessed: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: '2px',
    background: 'rgba(251, 191, 36, 0.4)',
    transition: 'width 0.4s ease',
  },
  barFillComplete: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: '2px',
    background: '#34d399',
    transition: 'width 0.4s ease',
  },
  stats: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap' as const,
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  statValue: {
    fontWeight: 600,
    color: '#fff',
    fontSize: '12px',
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: '11px',
  },
  divider: {
    color: 'rgba(255, 255, 255, 0.12)',
    fontSize: '10px',
  },
};
