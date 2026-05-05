import { useState } from 'react';
import { useParsedScriptStore } from '@/stores/breakdownStore';

/**
 * Per-scene background presence row, rendered at the bottom of each
 * scene's character table in the breakdown sheet.
 *
 * Background entries are non-speaking labels found in the script's
 * action paragraphs ("PASSER BY", "ELDERLY PATIENT") — they live on
 * the scene only and never become tracked Character profiles.
 */
export function SceneBackgroundRow({
  projectId,
  sceneId,
  names,
  notes,
  colSpan,
}: {
  projectId: string;
  sceneId: string;
  names: string[];
  notes: string;
  colSpan: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes);

  // Inline access to the parsed-script store so notes saved here flow
  // back into Supabase via the existing breakdown sync path.
  const updateScene = (next: { backgroundNotes?: string }) => {
    const data = useParsedScriptStore.getState().getParsedData(projectId);
    if (!data) return;
    const scenes = data.scenes.map((s) =>
      s.id === sceneId ? { ...s, ...next } : s,
    );
    useParsedScriptStore.getState().setParsedData(projectId, { ...data, scenes });
  };

  if (names.length === 0 && !notes && !editing) {
    return (
      <tr className="bs-bg-row bs-bg-row--empty">
        <td colSpan={colSpan} style={{ padding: '4px 12px' }}>
          <button
            onClick={() => setEditing(true)}
            style={{
              fontSize: '0.7rem', color: 'var(--text-muted, #a89b8c)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            + Add background
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className="bs-bg-row"
      style={{ background: 'rgba(210, 195, 165, 0.06)' }}
    >
      <td colSpan={colSpan} style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{
            flexShrink: 0, fontSize: '0.65rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--text-muted, #a89b8c)', paddingTop: 2,
          }}>
            Background
          </span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {names.length > 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary, #e8e0d4)' }}>
                {names.join(', ')}
              </div>
            ) : (
              <div style={{ fontSize: '0.7rem', fontStyle: 'italic', color: 'var(--text-muted, #a89b8c)' }}>
                No background listed
              </div>
            )}
            {editing ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  updateScene({ backgroundNotes: draft });
                  setEditing(false);
                }}
                placeholder="Notes (e.g. 6 background, hospital scrubs, no SA prep needed)"
                autoFocus
                rows={2}
                style={{
                  fontSize: '0.75rem', color: 'var(--text-primary, #e8e0d4)',
                  background: 'var(--input-bg, transparent)',
                  border: '1px solid var(--border, #3d352d)',
                  borderRadius: 4, padding: '4px 8px', resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            ) : notes ? (
              <button
                onClick={() => { setDraft(notes); setEditing(true); }}
                style={{
                  textAlign: 'left', fontSize: '0.75rem',
                  color: 'var(--text-secondary, #c9bda8)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                {notes}
              </button>
            ) : (
              <button
                onClick={() => { setDraft(''); setEditing(true); }}
                style={{
                  textAlign: 'left', fontSize: '0.7rem',
                  color: 'var(--text-muted, #a89b8c)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                + Add notes
              </button>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
