import { useEffect, useRef, useState } from 'react';
import {
  useBreakdownStore,
  useSynopsisStore,
  useRevisedScenesStore,
  type Character,
  type Scene,
} from '@/stores/breakdownStore';
import { sceneColorClass } from '@/utils/sceneColorClass';

const LEFT_WIDTH = 280;

interface SceneListPanelProps {
  /** Total non-preamble scene count for the header display.
   *  Distinct from `filteredScenes.length` — the header always
   *  shows the unfiltered total regardless of the search query. */
  totalSceneCount: number;

  /** The already-filtered scenes to render in the scrollable list.
   *  Filtered by the parent because the same list is also consumed
   *  by the auto-select effect, the keyboard nav handler, and the
   *  BreakdownFormPanel (as its `scenes` prop). */
  filteredScenes: Scene[];

  /** All characters in the current project. Needed to resolve
   *  character names + detect supporting artists in the
   *  expand-on-active character pill at the bottom of each
   *  active card. */
  allCharacters: Character[];

  /** Currently selected scene — drives the `.sl-card--active` class
   *  and the scroll-into-view effect that snaps the active card
   *  into the viewport whenever it changes. */
  selectedSceneId: string;

  /** Called when the user clicks a scene card. Parent wires this to
   *  its `selectScene` useCallback, which updates selectedSceneId,
   *  bumps scrollTrigger, and sets activeTab to 'script'. */
  onSelectScene: (sceneId: string) => void;

  /** Current project ID — needed for useRevisedScenesStore reads
   *  (isSceneRevised on every card) and writes (markReviewed on the
   *  "Reviewed" button inside the revised-scene banner). */
  projectId: string;

  /** Search-query state — stays in the parent because
   *  filteredScenes derives from it and is consumed elsewhere. */
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;

  /** Optional callback to re-open the Changes Summary modal. The
   *  parent synthesises a DiffResult from the persisted revised-scenes
   *  store so the user can revisit the flagged list any time, not
   *  just on first upload. The button only renders when there are
   *  unreviewed changes left for this project. */
  onShowRevisions?: () => void;
}

/**
 * Left-panel scene list for the ScriptBreakdown page. Renders:
 *
 *   - A sticky header with a "Scenes" label and the total count
 *   - A search input bound to the parent's `searchQuery` state
 *   - A scrollable list of scene cards, each with:
 *     • INT/EXT + DAY/NIGHT colour class
 *     • Scene number + location heading
 *     • Day/night pill, INT/EXT label, cast count, status dot
 *     • A "Revised — review changes" banner + Reviewed button
 *       (only on the active card when the scene has unreviewed
 *       script revisions)
 *     • An expand-on-active detail block showing the breakdown
 *       timeline, synopsis, and principal characters
 *
 * Owns its own `sceneListRef` and a scroll-into-view effect that
 * snaps the active card into the viewport whenever `selectedSceneId`
 * changes. Calls useBreakdownStore / useSynopsisStore /
 * useRevisedScenesStore directly for per-card state — these are the
 * same store hooks the parent uses, so both sides share the same
 * underlying state and re-render independently on store changes.
 */
export function SceneListPanel({
  totalSceneCount,
  filteredScenes,
  allCharacters,
  selectedSceneId,
  onSelectScene,
  projectId,
  searchQuery,
  onSearchQueryChange,
  onShowRevisions,
}: SceneListPanelProps) {
  const store = useBreakdownStore();
  const synopsisStore = useSynopsisStore();
  const revisedStore = useRevisedScenesStore();

  // Read scene query flags from localStorage
  const [sceneFlags, setSceneFlags] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`prep-scene-notes-${projectId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, { flagged?: boolean }>;
        const flags: Record<string, boolean> = {};
        for (const [id, v] of Object.entries(parsed)) {
          if (v.flagged) flags[id] = true;
        }
        setSceneFlags(flags);
      }
    } catch { /* ignore */ }
  }, [projectId, selectedSceneId]);

  /* Scroll the active scene card into view in the left panel */
  const sceneListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = sceneListRef.current;
    if (!list) return;
    const active = list.querySelector('.sl-card--active') as HTMLElement;
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedSceneId]);

  const unreviewedChanges = revisedStore.getUnreviewedChanges(projectId);
  const unreviewedCount = unreviewedChanges.length;

  return (
    <div className="bd-left bd-panel-surface" style={{ width: LEFT_WIDTH, minWidth: LEFT_WIDTH }}>
      <div className="sl-header">
        <span className="sl-header-label">Scenes</span>
        <span className="sl-header-count">{totalSceneCount}</span>
        {onShowRevisions && unreviewedCount > 0 && (
          <button
            type="button"
            className="sl-revisions-pill"
            onClick={onShowRevisions}
            title="Open the changes summary for this revision"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4"/><path d="M12 17h.01"/>
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
            <span>{unreviewedCount}</span>
            <span className="sl-revisions-pill-label">to review</span>
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: '4px', padding: '0 14px 8px', boxSizing: 'border-box', width: '100%', overflow: 'hidden' }}>
        <div className="sl-search" style={{ flex: 1, margin: 0, minWidth: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input className="sl-search-input" placeholder="Search..."
            value={searchQuery} onChange={(e) => onSearchQueryChange(e.target.value)} />
        </div>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) {
              onSelectScene(e.target.value);
              e.target.value = '';
            }
          }}
          style={{
            width: '80px', flexShrink: 0, padding: '0 20px 0 6px', borderRadius: '6px',
            fontSize: '0.625rem', fontWeight: 500,
            backgroundColor: 'var(--bg-secondary, #F0EBE0)',
            border: '1px solid rgba(0,0,0,0.06)',
            color: 'var(--text-muted)', outline: 'none',
            cursor: 'pointer', appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239C9488' stroke-width='3'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 6px center',
          }}
        >
          <option value="">Jump to</option>
          {filteredScenes.map(s => (
            <option key={s.id} value={s.id}>SC {s.number}</option>
          ))}
        </select>
      </div>
      <div className="sl-list" ref={sceneListRef}>
        {filteredScenes.map((s) => {
          // Omitted scenes render as a thin grey placeholder so the
          // numbering gap stays visible without dedicating a full
          // breakdown card to a scene that no longer exists.
          if (s.isOmitted) {
            const isActive = s.id === selectedSceneId;
            return (
              <button
                key={s.id}
                className={`sl-card sl-card--omitted${isActive ? ' sl-card--active' : ''}`}
                onClick={() => onSelectScene(s.id)}
              >
                <div className="sl-card-top">
                  <span className="sl-card-num">{s.number}</span>
                  <span className="sl-card-location">OMITTED</span>
                </div>
              </button>
            );
          }
          const status = store.getCompletionStatus(s.id, s);
          const isActive = s.id === selectedSceneId;
          const bd = store.getBreakdown(s.id);
          const colorClass = sceneColorClass(s.intExt, s.dayNight);
          const isRevised = revisedStore.isSceneRevised(projectId, s.id);
          return (
            <button key={s.id} className={`sl-card ${isActive ? 'sl-card--active' : ''} ${colorClass} ${isRevised ? 'sl-card--revised' : ''}`}
              onClick={() => onSelectScene(s.id)}>
              <div className="sl-card-top">
                <span className="sl-card-num">{s.number}</span>
                <span className="sl-card-location">{s.intExt}. {s.location}</span>
              </div>
              <div className="sl-card-meta">
                <span className={`sl-card-pill sl-pill--${s.dayNight.toLowerCase()}`}>{s.dayNight}</span>
                <span className="sl-card-detail">{s.intExt}</span>
                {s.characterIds.length > 0 && (
                  <span className="sl-card-cast">{s.characterIds.length}</span>
                )}
                {sceneFlags[s.id] && (
                  <span style={{ fontSize: '10px', color: '#C4522A' }} title="Has query">⚑</span>
                )}
                {isRevised && (
                  <span className="sl-card-rev-pill" title="Scene changed in latest revision — reassess the breakdown">
                    REV
                  </span>
                )}
                <span className={`sl-card-status sl-card-status--${status}`} />
              </div>
              {isActive && isRevised && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', margin: '6px 0 0',
                  background: 'rgba(232, 98, 26, 0.12)',
                  borderRadius: 6, fontSize: '0.6875rem', color: '#E8621A', fontWeight: 600,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 9v4"/><path d="M12 17h.01"/>
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  </svg>
                  <span style={{ flex: 1 }}>Revised — review changes</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); revisedStore.markReviewed(projectId, s.id); }}
                    style={{
                      background: '#E8621A', border: 'none', borderRadius: 4,
                      color: '#fff', fontSize: '0.625rem', fontWeight: 700,
                      padding: '2px 8px', cursor: 'pointer', textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    ✓ Reviewed
                  </button>
                </div>
              )}
              {isActive && (
                <div className="sl-card-expand">
                  {bd && (bd.timeline.day || bd.timeline.type) && (
                    <div className="sl-expand-pill">
                      <span className="sl-expand-label">Timeline</span>
                      <span className="sl-expand-value">
                        {[bd.timeline.day, bd.timeline.type && bd.timeline.type !== 'Normal' && bd.timeline.type !== 'Present' ? bd.timeline.type : ''].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </div>
                  )}
                  {synopsisStore.getSynopsis(s.id, s.synopsis) && (
                    <div className="sl-expand-pill">
                      <span className="sl-expand-label">Synopsis</span>
                      <span className="sl-expand-value">{synopsisStore.getSynopsis(s.id, s.synopsis)}</span>
                    </div>
                  )}
                  {s.characterIds.length > 0 && (() => {
                    const principals = s.characterIds.map((cid) => allCharacters.find((c) => c.id === cid)).filter((c): c is Character => !!c && c.category !== 'supporting_artist');
                    const saCount = s.characterIds.map((cid) => allCharacters.find((c) => c.id === cid)).filter((c): c is Character => !!c && c.category === 'supporting_artist').length;
                    return (
                      <div className="sl-expand-pill">
                        <span className="sl-expand-label">Characters</span>
                        <div className="sl-expand-chars">
                          {principals.map((ch) => (
                            <span key={ch.id} className="sl-card-char-tag">{ch.name.split(' ')[0].toUpperCase()}</span>
                          ))}
                          {saCount > 0 && (
                            <span className="sl-card-char-tag" style={{ opacity: 0.6, fontStyle: 'italic' }}>+{saCount} SA</span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
