import { useEffect, useRef } from 'react';
import type { ScriptDraft } from '@/hooks/useScriptDrafts';
import {
  ToolsIcon,
  ImportIcon,
  DraftsIcon,
  BreakdownViewIcon,
  ExportIcon,
} from '@/components/icons/ScriptBreakdownIcons';

/** Document formats an export row can produce. */
export type ExportFormat = 'pdf' | 'xlsx' | 'pptx' | 'docx';

interface ToolsMenuProps {
  // Menu open/close — parent still owns this state because
  // useScriptDrafts subscribes to it for cache-reset semantics.
  open: boolean;
  onToggle: () => void;
  onClose: () => void;

  // Top section actions
  onImportScript: () => void;
  onOpenBreakdownView: () => void;

  // Export callbacks. Each takes the chosen format chip the user
  // clicked — the parent decides which renderer to invoke (or
  // whether to no-op while the renderer is still a stub).
  onExportBreakdown: (format: ExportFormat) => void;
  onExportLookbooks: (format: ExportFormat) => void;
  onExportTimeline: (format: ExportFormat) => void;
  onExportBible: (format: ExportFormat) => void;
  onExportQueries: (format: ExportFormat) => void;

  // Drafts sub-dropdown — piped through from useScriptDrafts.
  drafts: ScriptDraft[];
  draftsLoading: boolean;
  draftsExpanded: boolean;
  onToggleDraftsExpanded: () => void;
  loadingDraftId: string | null;
  onLoadDraft: (draft: ScriptDraft) => void;
  onViewDraftPdf: (e: React.MouseEvent, draft: ScriptDraft) => void;
  onDeleteDraft: (e: React.MouseEvent, draft: ScriptDraft) => void;
}

/** Static format pairings per section — appears to the right of each row. */
const EXPORT_SECTIONS: ReadonlyArray<{
  key: 'breakdown' | 'lookbooks' | 'timeline' | 'bible' | 'queries';
  label: string;
  formats: ReadonlyArray<ExportFormat>;
}> = [
  { key: 'breakdown', label: 'Breakdown', formats: ['pdf', 'xlsx'] },
  { key: 'lookbooks', label: 'Lookbooks', formats: ['pdf', 'pptx'] },
  { key: 'timeline', label: 'Timeline', formats: ['pdf', 'xlsx'] },
  { key: 'bible', label: 'Bible', formats: ['pdf', 'docx'] },
  { key: 'queries', label: 'Director Queries', formats: ['pdf', 'xlsx'] },
];

/**
 * Tools menu for the ScriptBreakdown page — the chevron button at the
 * top of the right panel plus its dropdown of actions (Import Script,
 * Script Drafts sub-dropdown, View Breakdown, and the Export rows).
 *
 * Owns its own outside-click-to-close behaviour via a local ref and
 * effect, so the parent doesn't need to manage the click listener.
 * The `open` state itself still lives in the parent because
 * `useScriptDrafts` needs to read it for cache-reset semantics — the
 * hook clears its fetched drafts list when the tools menu closes.
 *
 * Each Export row renders a label plus one chip per supported format.
 * Clicking a chip fires the parent callback with that format and
 * closes the menu, matching the close-on-terminal-action convention
 * of the non-export items above.
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
  onDeleteDraft,
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

  const handlerByKey: Record<(typeof EXPORT_SECTIONS)[number]['key'], (f: ExportFormat) => void> = {
    breakdown: onExportBreakdown,
    lookbooks: onExportLookbooks,
    timeline: onExportTimeline,
    bible: onExportBible,
    queries: onExportQueries,
  };

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
                    {!draft.is_active && (
                      <button
                        className="tools-draft-trash"
                        onClick={(e) => onDeleteDraft(e, draft)}
                        title="Delete this draft"
                        aria-label="Delete this draft"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/>
                          <path d="M14 11v6"/>
                          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    )}
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
            {EXPORT_SECTIONS.map((section) => (
              <div key={section.key} className="tools-export-row">
                <span className="tools-export-row-label">
                  <ExportIcon /> <span>{section.label}</span>
                </span>
                <span className="tools-export-chips">
                  {section.formats.map((format) => (
                    <button
                      key={format}
                      className="tools-export-chip"
                      onClick={() => { handlerByKey[section.key](format); onClose(); }}
                    >
                      {format.toUpperCase()}
                    </button>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
