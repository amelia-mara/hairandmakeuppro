import { useEffect } from 'react';
import type { SceneChange } from '@/stores/breakdownStore';
import type { DiffResult } from '@/utils/scriptDiff';

/**
 * Post-upload diff-results modal shown after a script revision is
 * processed. Lists every added / modified / omitted scene with a
 * colour-coded type badge, a one-line change summary, and a click
 * handler that jumps the scene list to that scene. Also displays a
 * stats bar (modified / added / omitted / unchanged counts) at the
 * top.
 *
 * The modal is purely presentational — the diff itself is computed
 * upstream by `useScriptUploadProcessor` via `diffScripts`, and the
 * "review changes" footer button just closes the modal (the caller
 * handles the follow-up UX by clearing the revised-scenes store as
 * the user reviews each scene inline).
 */
export function ChangesSummaryModal({
  diffResult,
  onClose,
  onGoToScene,
}: {
  diffResult: DiffResult;
  onClose: () => void;
  onGoToScene: (sceneId: string) => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const { changes, stats } = diffResult;
  const changeTypeIcon = (type: SceneChange['changeType']) => {
    switch (type) {
      case 'modified': return { color: '#E8621A', label: 'Modified', icon: '~' };
      case 'added': return { color: '#22c55e', label: 'Added', icon: '+' };
      case 'omitted': return { color: '#94a3b8', label: 'Omitted', icon: '−' };
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-glass" style={{ width: 580, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '24px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{
              fontSize: '0.8125rem', letterSpacing: '0.1em',
              textTransform: 'uppercase' as const, color: 'var(--text-heading)', margin: 0,
            }}>
              <span className="heading-italic">Script</span>{' '}
              <span className="heading-regular">Changes</span>
            </h2>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 4,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Stats bar */}
          <div style={{
            display: 'flex', gap: 16, marginTop: 16, marginBottom: 8,
            fontSize: '0.8125rem', color: 'var(--text-muted)',
          }}>
            {stats.modified > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#E8621A', display: 'inline-block' }} />
                {stats.modified} modified
              </span>
            )}
            {stats.added > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                {stats.added} added
              </span>
            )}
            {stats.omitted > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} />
                {stats.omitted} omitted
              </span>
            )}
            <span style={{ marginLeft: 'auto' }}>
              {stats.unchanged} unchanged
            </span>
          </div>
        </div>

        <div style={{ padding: '12px 28px 28px', overflowY: 'auto', flex: 1 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0 0 16px' }}>
            Changed scenes are highlighted in orange in the scene list. Click a scene below to jump to it and review the changes. Your existing breakdown data has been preserved.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {changes.map((change) => {
              const info = changeTypeIcon(change.changeType);
              return (
                <button
                  key={change.sceneId + change.sceneNumber}
                  onClick={() => onGoToScene(change.sceneId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
                    border: `1px solid ${info.color}30`,
                    borderLeft: `3px solid ${info.color}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${info.color}10`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-secondary, rgba(255,255,255,0.03))';
                  }}
                >
                  {/* Change type indicator */}
                  <span style={{
                    width: 26, height: 26, borderRadius: 6,
                    background: `${info.color}18`,
                    color: info.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1rem', fontWeight: 700, flexShrink: 0,
                    fontFamily: 'monospace',
                  }}>
                    {info.icon}
                  </span>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        color: 'var(--text-heading)', fontWeight: 600, fontSize: '0.8125rem',
                      }}>
                        Scene {change.sceneNumber}
                      </span>
                      <span style={{
                        fontSize: '0.6875rem', fontWeight: 500,
                        color: info.color,
                        background: `${info.color}15`,
                        padding: '1px 6px', borderRadius: 4,
                        textTransform: 'uppercase', letterSpacing: '0.03em',
                      }}>
                        {info.label}
                      </span>
                    </div>
                    <div style={{
                      color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {change.summary}
                    </div>
                  </div>

                  {/* Arrow */}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px',
          borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
          display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
            background: 'var(--accent-gold, #D4943A)', border: 'none',
            color: '#1a1a1a', fontSize: '0.8125rem', fontWeight: 600,
          }}>
            Review Changes
          </button>
        </div>
      </div>
    </div>
  );
}
