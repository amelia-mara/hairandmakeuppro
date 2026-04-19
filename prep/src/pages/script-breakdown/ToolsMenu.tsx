import { useEffect, useRef } from 'react';
import type { ScriptDraft } from '@/hooks/useScriptDrafts';
import {
  ToolsIcon,
  ImportIcon,
  DraftsIcon,
  BreakdownViewIcon,
  ExportIcon,
} from '@/components/icons/ScriptBreakdownIcons';

interface ToolsMenuProps {
  // Menu open/close — parent still owns this state because
  // useScriptDrafts subscribes to it for cache-reset semantics.
  open: boolean;
  onToggle: () => void;
  onClose: () => void;

  // Top section actions
  onImportScript: () => void;
  onOpenBreakdownView: () => void;

  // Export section actions. Currently stubbed in the parent as
  // inline console.log callbacks — keeping them as parent-owned
  // callbacks lets the real implementations land later without
  // touching this component.
  onExportBreakdown: () => void;
  onExportLookbooks: () => void;
  onExportTimeline: () => void;
  onExportBible: () => void;
  onExportQueries: () => void;

  // Drafts sub-dropdown — piped through from useScriptDrafts.
  drafts: ScriptDraft[];
  draftsLoading: boolean;
  draftsExpanded: boolean;
  onToggleDraftsExpanded: () => void;
  loadingDraftId: string | null;
  onLoadDraft: (draft: ScriptDraft) => void;
  onViewDraftPdf: (e: React.MouseEvent, draft: ScriptDraft) => void;
}

/**
 * Tools menu for the ScriptBreakdown page — the chevron button at the
 * top of the right panel plus its dropdown of actions (Import Script,
 * Script Drafts sub-dropdown, View Breakdown, and four Export items).
 *
 * Owns its own outside-click-to-close behaviour via a local ref and
 * effect, so the parent doesn't need to manage the click listener.
 * The `open` state itself still lives in the parent because
 * `useScriptDrafts` needs to read it for cache-reset semantics — the
 * hook clears its fetched drafts list when the tools menu closes.
 *
 * Every terminal action (Import, View Breakdown, each Export) calls
 * its action callback and then `onClose()`, preserving the inline
 * `{ setX(true); setToolsOpen(false); }` pattern from the parent
 * exactly.
 */
export function ToolsMenu({
  open,
  onToggle,
  onClose,
  onImportScript,
  onOpenBreakdownView,
  onExportBreakdown,
  onExportLookbooks,
  onExportTimeline,
  onExportBible,
  onExportQueries,
  drafts,
  draftsLoading,
  draftsExpanded,
  onToggleDraftsExpanded,
  loadingDraftId,
  onLoadDraft,
  onViewDraftPdf,
}: ToolsMenuProps) {
  const toolsRef = useRef<HTMLDivElement>(null);

  /* Close tools menu on outside click */
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  return (
    <div className="fp-panel-actions" ref={toolsRef} style={{ position: 'relative' }}>
      <button className="btn-ghost bd-btn" onClick={onToggle}>
        <ToolsIcon /> Tools
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', marginLeft: '2px' }}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div className="tools-dropdown">
          <div className="tools-dropdown-section">
            <button className="tools-dropdown-item" onClick={() => { onImportScript(); onClose(); }}>
              <ImportIcon /> <span>Import New Script</span>
            </button>
            <button
              className={`tools-dropdown-item ${draftsExpanded ? 'tools-dropdown-item--expanded' : ''}`}
              onClick={onToggleDraftsExpanded}
            >
              <DraftsIcon />
              <span style={{ flex: 1 }}>Script Drafts</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                style={{ transition: 'transform 0.2s ease', transform: draftsExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>
            {draftsExpanded && (
              <div className="tools-drafts-sub">
                {draftsLoading && (
                  <div className="tools-drafts-loading">Loading drafts...</div>
                )}
                {!draftsLoading && drafts.length === 0 && (
                  <div className="tools-drafts-empty">No drafts yet</div>
                )}
                {!draftsLoading && drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className={`tools-draft-item ${draft.is_active ? 'tools-draft-item--active' : ''}`}
                    onClick={() => onLoadDraft(draft)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="tools-draft-info">
                      <div className="tools-draft-name">
                        {draft.version_label || draft.file_name}
                        {draft.is_active && <span className="tools-draft-badge">Current</span>}
                      </div>
                      <div className="tools-draft-meta">
                        {new Date(draft.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {draft.scene_count ? ` · ${draft.scene_count} scenes` : ''}
                        {!draft.parsed_data && !draft.is_active ? ' · PDF only' : ''}
                      </div>
                    </div>
                    {loadingDraftId === draft.id && (
                      <span className="tools-draft-spinner" />
                    )}
                    <button
                      className="tools-draft-eye"
                      onClick={(e) => onViewDraftPdf(e, draft)}
                      title="View original PDF"
                      aria-label="View original PDF"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button className="tools-dropdown-item" onClick={() => { onOpenBreakdownView(); onClose(); }}>
              <BreakdownViewIcon /> <span>View Breakdown</span>
            </button>
          </div>
          <div className="tools-dropdown-divider" />
          <div className="tools-dropdown-section">
            <div className="tools-dropdown-label">Export</div>
            <button className="tools-dropdown-item" onClick={() => { onExportBreakdown(); onClose(); }}>
              <ExportIcon /> <span>Breakdown</span>
            </button>
            <button className="tools-dropdown-item" onClick={() => { onExportLookbooks(); onClose(); }}>
              <ExportIcon /> <span>Lookbooks</span>
            </button>
            <button className="tools-dropdown-item" onClick={() => { onExportTimeline(); onClose(); }}>
              <ExportIcon /> <span>Timeline</span>
            </button>
            <button className="tools-dropdown-item" onClick={() => { onExportBible(); onClose(); }}>
              <ExportIcon /> <span>Bible</span>
            </button>
            <button className="tools-dropdown-item" onClick={() => { onExportQueries(); onClose(); }} style={{ color: '#C4522A' }}>
              <ExportIcon /> <span>Director Queries</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
