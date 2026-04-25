import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DraftPdfViewerProps {
  /** The draft PDF to display. `null` hides the modal (the component
   *  renders nothing when no draft is set). */
  draft: { url: string; name: string } | null;
  /** Called when the user clicks the backdrop, the back arrow, or
   *  the close button. The parent is responsible for clearing
   *  whatever state it uses to track the currently-viewed draft. */
  onClose: () => void;
}

/**
 * Fullscreen-ish modal overlay that previews a script draft's original
 * PDF inside an iframe. Mounted by ScriptBreakdown when the user clicks
 * the eye icon on a row in the Tools → Script Drafts sub-dropdown.
 *
 * Rendered via a React portal to `document.body` so the modal is
 * never trapped inside a parent stacking context (the prep topbar
 * uses `position: fixed; z-index: 200`, and an inline z-index here
 * was being clipped by an ancestor `transform`-creating stacking
 * context — putting the modal at the body root sidesteps that).
 *
 * Esc closes the modal in addition to the backdrop / arrow / X.
 */
export function DraftPdfViewer({ draft, onClose }: DraftPdfViewerProps) {
  useEffect(() => {
    if (!draft) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft, onClose]);

  if (!draft) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      style={{ zIndex: 10001 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(1100px, 92vw)',
          height: 'min(calc(100vh - 96px), 1100px)',
          marginTop: 24,
          marginBottom: 24,
          background: 'var(--bg-primary, #1a1815)',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
          boxShadow: '0 24px 80px -12px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <button
              onClick={onClose}
              aria-label="Close draft preview"
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
              </svg>
            </button>
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--text-heading)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={draft.name}
            >
              {draft.name}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close draft preview"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
              borderRadius: 8,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginLeft: 12,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div style={{ flex: 1, background: '#fff', minHeight: 0 }}>
          <iframe
            src={draft.url}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title={draft.name}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
