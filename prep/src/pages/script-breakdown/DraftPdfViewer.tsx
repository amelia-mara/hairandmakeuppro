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
 * Behaviour-preserving extraction — every inline style, the `z-index:
 * 10001` backdrop (deliberately above the tools dropdown), the
 * back-arrow + X double-close, and the iframe's lack of a border are
 * all preserved verbatim. No keyboard handling (there was none on the
 * inline version either; Escape doesn't close this modal, and that
 * matches the previous behaviour).
 */
export function DraftPdfViewer({ draft, onClose }: DraftPdfViewerProps) {
  if (!draft) return null;
  return (
    <div className="modal-backdrop" style={{ zIndex: 10001 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '90vw', height: '90vh', maxWidth: 1000,
        background: 'var(--bg-primary, #1a1815)',
        borderRadius: 12, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
              </svg>
            </button>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-heading)' }}>
              {draft.name}
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', padding: 4,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div style={{ flex: 1, background: '#fff' }}>
          <iframe
            src={draft.url}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title={draft.name}
          />
        </div>
      </div>
    </div>
  );
}
