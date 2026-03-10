import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MOCK_SCENES, MOCK_CHARACTERS, MOCK_LOOKS, BREAKDOWN_CATEGORIES, CONTINUITY_EVENT_TYPES,
  useBreakdownStore, useTagStore, useSynopsisStore, useScriptUploadStore,
  type Scene, type Character, type CharacterBreakdown, type ContinuityEvent, type HMWEntry, type SceneBreakdown,
  type ScriptTag,
} from '@/stores/breakdownStore';
import { useProjectStore } from '@/stores/projectStore';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DRAGGABLE PANEL RESIZE HOOK
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function usePanelResize(storageKey: string, defaultWidth: number, min: number, max: number, side: 'left' | 'right') {
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SCRIPT BREAKDOWN PAGE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface Props { projectId: string }

/** Map INT/EXT + DAY/NIGHT to a CSS color class (matches original script-breakdown.css) */
function sceneColorClass(intExt: string, dayNight: string): string {
  const isInt = intExt.toUpperCase() === 'INT';
  const isExt = intExt.toUpperCase() === 'EXT';
  const isDay = dayNight.toUpperCase() === 'DAY';
  const isNight = dayNight.toUpperCase() === 'NIGHT';

  if (isInt && isDay) return 'sl-card--int-day';
  if (isExt && isDay) return 'sl-card--ext-day';
  if (isInt && isNight) return 'sl-card--int-night';
  if (isExt && isNight) return 'sl-card--ext-night';
  return '';
}

const LEFT_WIDTH = 280;
const RIGHT_DEFAULT = 400;
const RIGHT_MIN = 300;
const RIGHT_MAX = 560;

export function ScriptBreakdown({ projectId }: Props) {
  const [selectedSceneId, setSelectedSceneId] = useState('s1');
  const [activeTab, setActiveTab] = useState<string>('script');
  const [searchQuery, setSearchQuery] = useState('');
  const [fontSize, setFontSize] = useState(16);
  const [showLegend, setShowLegend] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

  const rightPanel = usePanelResize('prep-right-panel-w', RIGHT_DEFAULT, RIGHT_MIN, RIGHT_MAX, 'right');

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const store = useBreakdownStore();
  const synopsisStore = useSynopsisStore();

  /* Script upload state */
  const scriptUpload = useScriptUploadStore();
  const updateProject = useProjectStore((s) => s.updateProject);
  const hasScript = !!scriptUpload.getScript(projectId);
  const [showUploadModal, setShowUploadModal] = useState(false);

  /* Auto-show upload modal when no script is uploaded */
  useEffect(() => {
    if (!hasScript) {
      setShowUploadModal(true);
    }
  }, [hasScript]);
  const scene = MOCK_SCENES.find((s) => s.id === selectedSceneId)!;
  const sceneCharacters = scene.characterIds.map((id) => MOCK_CHARACTERS.find((c) => c.id === id)!);
  const breakdown = store.getBreakdown(selectedSceneId);

  useEffect(() => {
    if (!store.getBreakdown(selectedSceneId)) {
      const sc = MOCK_SCENES.find((s) => s.id === selectedSceneId)!;
      store.setBreakdown(selectedSceneId, {
        sceneId: selectedSceneId,
        timeline: { day: '', time: sc.dayNight === 'DAY' ? 'Day' : sc.dayNight === 'NIGHT' ? 'Night' : sc.dayNight === 'DAWN' ? 'Dawn' : sc.dayNight === 'DUSK' ? 'Dusk' : '', type: '', note: '' },
        characters: sc.characterIds.map((cid) => ({
          characterId: cid, lookId: '',
          entersWith: { hair: '', makeup: '', wardrobe: '' },
          sfx: '', changeType: 'no-change', changeNotes: '',
          exitsWith: { hair: '', makeup: '', wardrobe: '' },
          notes: '',
        })),
        continuityEvents: [],
      });
    }
  }, [selectedSceneId, store]);

  const triggerSave = useCallback(() => {
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saved');
      statusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  }, []);

  /* Close tools menu on outside click */
  useEffect(() => {
    if (!toolsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [toolsOpen]);

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

  const filteredScenes = MOCK_SCENES.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.location.toLowerCase().includes(q) || String(s.number).includes(q);
  });

  const selectScene = useCallback((id: string) => {
    setSelectedSceneId(id);
    setActiveTab('script');
  }, []);

  /* Called by IntersectionObserver as user scrolls through script */
  const onSceneVisible = useCallback((id: string) => {
    setSelectedSceneId(id);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const idx = filteredScenes.findIndex((s) => s.id === selectedSceneId);
      if ((e.key === 'ArrowDown' || e.key === 'j') && idx < filteredScenes.length - 1) {
        e.preventDefault(); selectScene(filteredScenes[idx + 1].id);
      } else if ((e.key === 'ArrowUp' || e.key === 'k') && idx > 0) {
        e.preventDefault(); selectScene(filteredScenes[idx - 1].id);
      } else if (e.key === 'n') {
        const next = filteredScenes.find((s, i) => i > idx && store.getCompletionStatus(s.id, s) !== 'complete');
        if (next) selectScene(next.id);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault(); triggerSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filteredScenes, selectedSceneId, selectScene, store, triggerSave]);

  return (
    <div className="bd-page">
      {/* Three panels with draggable dividers */}
      <div className="bd-panels">

        {/* ━━━ LEFT — Scene List Panel ━━━ */}
        <div className="bd-left bd-panel-surface" style={{ width: LEFT_WIDTH, minWidth: LEFT_WIDTH }}>
          <div className="sl-header">
            <span className="sl-header-label">Scenes</span>
            <span className="sl-header-count">{MOCK_SCENES.length}</span>
          </div>
          <div className="sl-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input className="sl-search-input" placeholder="Search scenes..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="sl-list" ref={sceneListRef}>
            {filteredScenes.map((s) => {
              const status = store.getCompletionStatus(s.id, s);
              const isActive = s.id === selectedSceneId;
              const bd = store.getBreakdown(s.id);
              const colorClass = sceneColorClass(s.intExt, s.dayNight);
              return (
                <button key={s.id} className={`sl-card ${isActive ? 'sl-card--active' : ''} ${colorClass}`}
                  onClick={() => selectScene(s.id)}>
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
                    <span className={`sl-card-status sl-card-status--${status}`} />
                  </div>
                  {isActive && (
                    <div className="sl-card-expand">
                      {bd && (bd.timeline.day || bd.timeline.type) && (
                        <div className="sl-expand-pill">
                          <span className="sl-expand-label">Timeline</span>
                          <span className="sl-expand-value">
                            {[bd.timeline.day, bd.timeline.type && bd.timeline.type !== 'Normal' ? bd.timeline.type : ''].filter(Boolean).join(' · ') || '—'}
                          </span>
                        </div>
                      )}
                      {synopsisStore.getSynopsis(s.id, s.synopsis) && (
                        <div className="sl-expand-pill">
                          <span className="sl-expand-label">Synopsis</span>
                          <span className="sl-expand-value">{synopsisStore.getSynopsis(s.id, s.synopsis)}</span>
                        </div>
                      )}
                      {s.characterIds.length > 0 && (
                        <div className="sl-expand-pill">
                          <span className="sl-expand-label">Characters</span>
                          <div className="sl-expand-chars">
                            {s.characterIds.map((cid) => {
                              const ch = MOCK_CHARACTERS.find((c) => c.id === cid);
                              return ch ? <span key={cid} className="sl-card-char-tag">{ch.name.split(' ')[0].toUpperCase()}</span> : null;
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Left divider (visual only) */}
        <div className="bd-divider bd-divider--static">
          <div className="bd-divider-grip" />
        </div>

        {/* ━━━ CENTER — Script / Characters ━━━ */}
        <div className="bd-center">
          {/* File divider tabs */}
          <div className="cp-tabstrip">
            <div className="cp-tabs-row">
              <button className={`cp-divider-tab ${activeTab === 'script' ? 'cp-divider-tab--active' : ''}`}
                onClick={() => setActiveTab('script')}>Script</button>
              {sceneCharacters.map((c) => (
                <button key={c.id} className={`cp-divider-tab ${activeTab === c.id ? 'cp-divider-tab--active' : ''}`}
                  onClick={() => setActiveTab(c.id)}>{c.name}</button>
              ))}
            </div>
          </div>
          {/* Compact toolbar — Tags toggle only */}
          <div className="cp-toolbar">
            <button className={`bd-tags-toggle ${showLegend ? 'bd-tags-toggle--active' : ''}`} onClick={() => setShowLegend((v) => !v)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              Tags
            </button>
            {showLegend && (
              <div className="bd-legend-tags">
                {BREAKDOWN_CATEGORIES.map((cat) => (
                  <span key={cat.id} className="bd-legend-tag">
                    <span className="bd-legend-swatch" style={{ background: cat.color }} />
                    {cat.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Content body — connects to active tab */}
          <div className="cp-body">
            {activeTab === 'script' ? (
              <div className="sv-wrapper">
                <ScriptView
                  scenes={MOCK_SCENES}
                  selectedSceneId={selectedSceneId}
                  onSceneVisible={onSceneVisible}
                  fontSize={fontSize}
                  onCharClick={setActiveTab}
                />
                <div className="bd-zoom-float">
                  <button className="bd-zoom-btn" onClick={() => setFontSize((s) => Math.max(10, s - 1))}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/></svg>
                  </button>
                  <span className="bd-zoom-label">{fontSize}</span>
                  <button className="bd-zoom-btn" onClick={() => setFontSize((s) => Math.min(22, s + 1))}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                </div>
              </div>
            ) : (
              <CharacterView
                char={sceneCharacters.find((c) => c.id === activeTab)!}
                subTab="profile"
              />
            )}
          </div>
        </div>

        {/* Right divider */}
        <div className="bd-divider" onMouseDown={rightPanel.onMouseDown} onDoubleClick={rightPanel.onDoubleClick}>
          <div className="bd-divider-grip" />
        </div>

        {/* ━━━ RIGHT — Breakdown Form ━━━ */}
        <div className="bd-right bd-panel-surface" style={{ width: rightPanel.width, minWidth: rightPanel.width }}>
          <div className="fp-panel-header">
            <span className="fp-panel-title">Scene Breakdown</span>
            <div className="fp-panel-actions" ref={toolsRef} style={{ position: 'relative' }}>
              <button className="btn-ghost bd-btn" onClick={() => setToolsOpen(!toolsOpen)}>
                <ToolsIcon /> Tools
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transition: 'transform 0.2s ease', transform: toolsOpen ? 'rotate(180deg)' : 'rotate(0deg)', marginLeft: '2px' }}>
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>
              {toolsOpen && (
                <div className="tools-dropdown">
                  <div className="tools-dropdown-section">
                    <button className="tools-dropdown-item" onClick={() => { setShowUploadModal(true); setToolsOpen(false); }}>
                      <ImportIcon /> <span>Import New Script</span>
                    </button>
                    <button className="tools-dropdown-item" onClick={() => { console.log('Previous drafts'); setToolsOpen(false); }}>
                      <DraftsIcon /> <span>View Previous Drafts</span>
                    </button>
                    <button className="tools-dropdown-item" onClick={() => { console.log('View breakdown'); setToolsOpen(false); }}>
                      <BreakdownViewIcon /> <span>View Breakdown</span>
                    </button>
                  </div>
                  <div className="tools-dropdown-divider" />
                  <div className="tools-dropdown-section">
                    <div className="tools-dropdown-label">Export</div>
                    <button className="tools-dropdown-item" onClick={() => { console.log('Export breakdown'); setToolsOpen(false); }}>
                      <ExportIcon /> <span>Breakdown</span>
                    </button>
                    <button className="tools-dropdown-item" onClick={() => { console.log('Export lookbooks'); setToolsOpen(false); }}>
                      <ExportIcon /> <span>Lookbooks</span>
                    </button>
                    <button className="tools-dropdown-item" onClick={() => { console.log('Export timeline'); setToolsOpen(false); }}>
                      <ExportIcon /> <span>Timeline</span>
                    </button>
                    <button className="tools-dropdown-item" onClick={() => { console.log('Export bible'); setToolsOpen(false); }}>
                      <ExportIcon /> <span>Bible</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <BreakdownFormPanel
            scene={scene} characters={sceneCharacters} breakdown={breakdown}
            activeCharacterId={activeTab !== 'script' ? activeTab : null}
            saveStatus={saveStatus}
            scenes={filteredScenes}
            allScenes={MOCK_SCENES}
            onNavigate={selectScene}
            onUpdate={(cid, data) => { store.updateCharacterBreakdown(selectedSceneId, cid, data); triggerSave(); }}
            onUpdateTimeline={(tl) => { store.updateTimeline(selectedSceneId, tl); triggerSave(); }}
            onAddEvent={(evt) => { store.addContinuityEvent(selectedSceneId, evt); triggerSave(); }}
            onUpdateEvent={(eventId, data) => { store.updateContinuityEvent(selectedSceneId, eventId, data); triggerSave(); }}
            onRemoveEvent={(id) => { store.removeContinuityEvent(selectedSceneId, id); triggerSave(); }}
          />
        </div>
      </div>

      {/* Script Upload Modal */}
      {showUploadModal && (
        <ScriptUploadModal
          projectId={projectId}
          onClose={() => setShowUploadModal(false)}
          onUploaded={(filename) => {
            updateProject(projectId, { scriptFilename: filename });
            setShowUploadModal(false);
          }}
        />
      )}
    </div>
  );
}

/* ━━━ SCRIPT VIEW — continuous scroll, all scenes, with tagging ━━━ */

/** Split text into segments: plain text and tagged spans */
function buildTaggedSegments(text: string, tags: ScriptTag[]): { start: number; end: number; tag?: ScriptTag }[] {
  if (tags.length === 0) return [{ start: 0, end: text.length }];
  const sorted = [...tags].sort((a, b) => a.startOffset - b.startOffset);
  const segs: { start: number; end: number; tag?: ScriptTag }[] = [];
  let cursor = 0;
  for (const t of sorted) {
    if (t.startOffset > cursor) segs.push({ start: cursor, end: t.startOffset });
    segs.push({ start: t.startOffset, end: t.endOffset, tag: t });
    cursor = t.endOffset;
  }
  if (cursor < text.length) segs.push({ start: cursor, end: text.length });
  return segs;
}

interface TagPopupState {
  x: number; y: number;
  sceneId: string;
  startOffset: number; endOffset: number;
  text: string;
  /** Step 1: pick category, Step 2: assign character + description, Step 3: offer highlight-all for cast */
  step: 'category' | 'character' | 'highlight-all';
  categoryId?: string;
  description?: string;
  /** For highlight-all: the matched character */
  matchedCharId?: string;
  matchedName?: string;
}

function ScriptView({ scenes, selectedSceneId, onSceneVisible, fontSize, onCharClick }: {
  scenes: Scene[];
  selectedSceneId: string;
  onSceneVisible: (id: string) => void;
  fontSize: number;
  onCharClick: (id: string) => void;
}) {
  const charNames = MOCK_CHARACTERS.map((c) => c.name);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const isScrollingTo = useRef(false);
  const tagStore = useTagStore();
  const [popup, setPopup] = useState<TagPopupState | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  /* Close popup on outside click */
  useEffect(() => {
    if (!popup) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setPopup(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popup]);

  /* Handle text selection on the script paper */
  const handleMouseUp = useCallback((sceneId: string) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const text = sel.toString().trim();
    if (!text) return;

    const range = sel.getRangeAt(0);
    const paper = pageRefs.current.get(sceneId);
    if (!paper) return;

    /* Find the content container (skip heading) */
    const contentEl = paper.querySelector('.sv-content');
    if (!contentEl) return;

    /* Compute character offsets relative to the scene's scriptContent */
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    const scriptText = scene.scriptContent;

    /* Find the selected text position within scriptContent */
    const startIdx = scriptText.indexOf(text);
    if (startIdx === -1) return;

    const rect = range.getBoundingClientRect();
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const scrollRect = scrollEl.getBoundingClientRect();

    setPopup({
      x: rect.left - scrollRect.left + rect.width / 2,
      y: rect.top - scrollRect.top + scrollEl.scrollTop - 10,
      sceneId,
      startOffset: startIdx,
      endOffset: startIdx + text.length,
      text,
      step: 'category',
    });

    sel.removeAllRanges();
  }, [scenes]);

  const handleCategoryPick = useCallback((catId: string) => {
    if (!popup) return;
    /* If it's a 'cast' category, check if the text matches a character name */
    if (catId === 'cast') {
      const matched = MOCK_CHARACTERS.find((c) => c.name === popup.text.trim().toUpperCase() || c.name === popup.text.trim());
      if (matched) {
        tagStore.addTag({
          id: `tag-${Date.now()}`,
          sceneId: popup.sceneId,
          startOffset: popup.startOffset,
          endOffset: popup.endOffset,
          text: popup.text,
          categoryId: catId,
          characterId: matched.id,
        });
        /* Offer to highlight all other occurrences */
        setPopup({ ...popup, step: 'highlight-all', categoryId: catId, matchedCharId: matched.id, matchedName: matched.name });
        return;
      }
    }
    /* Move to character assignment step */
    setPopup({ ...popup, step: 'character', categoryId: catId });
  }, [popup, tagStore, onCharClick]);

  const handleHighlightAll = useCallback(() => {
    if (!popup || !popup.matchedCharId || !popup.categoryId || !popup.matchedName) return;
    const name = popup.matchedName;
    const catId = popup.categoryId;
    const charId = popup.matchedCharId;
    const existingTags = tagStore.tags;

    for (const scene of scenes) {
      const content = scene.scriptContent;
      /* Find all occurrences of the name (case-insensitive) */
      const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        /* Skip if this exact range is already tagged in this scene */
        const alreadyTagged = existingTags.some(
          (t) => t.sceneId === scene.id && t.startOffset === start && t.endOffset === end
        );
        if (alreadyTagged) continue;
        tagStore.addTag({
          id: `tag-${Date.now()}-${scene.id}-${start}`,
          sceneId: scene.id,
          startOffset: start,
          endOffset: end,
          text: match[0],
          categoryId: catId,
          characterId: charId,
        });
      }
    }
    onCharClick(charId);
    setPopup(null);
  }, [popup, tagStore, scenes, onCharClick]);

  const handleCharacterPick = useCallback((charId: string | null) => {
    if (!popup || !popup.categoryId) return;
    tagStore.addTag({
      id: `tag-${Date.now()}`,
      sceneId: popup.sceneId,
      startOffset: popup.startOffset,
      endOffset: popup.endOffset,
      text: popup.text,
      categoryId: popup.categoryId,
      characterId: charId || undefined,
      description: popup.description || undefined,
    });
    if (charId) onCharClick(charId);
    setPopup(null);
  }, [popup, tagStore, onCharClick]);

  /* Render a scene's content with inline highlights */
  const renderSceneContent = useCallback((scene: Scene) => {
    const sceneTags = tagStore.getTagsForScene(scene.id);
    const lines = scene.scriptContent.split('\n');

    if (sceneTags.length === 0) {
      /* Plain rendering (no tags to show) */
      return lines.map((line, i) => {
        const trimmed = line.trim();
        const matched = charNames.find((name) => {
          const cue = trimmed.replace(/\s*\(.*\)$/, '').replace(/\s*\(CONT'D\)$/, '');
          return cue === name;
        });
        if (matched) {
          const ch = MOCK_CHARACTERS.find((c) => c.name === matched)!;
          return <div key={`${scene.id}-${i}`} className="sv-line sv-cue" onClick={() => onCharClick(ch.id)}>{line}</div>;
        }
        return <div key={`${scene.id}-${i}`} className="sv-line">{line || '\u00A0'}</div>;
      });
    }

    /* Tagged rendering — overlay highlights on the full scriptContent */
    const segments = buildTaggedSegments(scene.scriptContent, sceneTags);
    /* Map each character offset to its line */
    let charIdx = 0;
    const lineOffsets: { start: number; end: number; line: string }[] = [];
    for (const line of lines) {
      lineOffsets.push({ start: charIdx, end: charIdx + line.length, line });
      charIdx += line.length + 1; // +1 for \n
    }

    return lineOffsets.map((lo, lineIdx) => {
      const trimmed = lo.line.trim();
      const matched = charNames.find((name) => {
        const cue = trimmed.replace(/\s*\(.*\)$/, '').replace(/\s*\(CONT'D\)$/, '');
        return cue === name;
      });
      const isCue = !!matched;

      /* Find segments that overlap this line */
      const lineSegs = segments.filter((s) => s.start < lo.end + 1 && s.end > lo.start);
      const hasTag = lineSegs.some((s) => s.tag);

      if (!hasTag) {
        if (isCue) {
          const ch = MOCK_CHARACTERS.find((c) => c.name === matched)!;
          return <div key={`${scene.id}-${lineIdx}`} className="sv-line sv-cue" onClick={() => onCharClick(ch.id)}>{lo.line}</div>;
        }
        return <div key={`${scene.id}-${lineIdx}`} className="sv-line">{lo.line || '\u00A0'}</div>;
      }

      /* Render with highlighted spans */
      const parts: React.ReactNode[] = [];
      for (const seg of lineSegs) {
        const segStart = Math.max(seg.start, lo.start) - lo.start;
        const segEnd = Math.min(seg.end, lo.end) - lo.start;
        const segText = lo.line.slice(segStart, segEnd);
        if (seg.tag) {
          const cat = BREAKDOWN_CATEGORIES.find((c) => c.id === seg.tag!.categoryId);
          parts.push(
            <span key={`${seg.start}-${seg.end}`} className="sv-highlight"
              style={{ backgroundColor: `${cat?.color || '#888'}33`, borderBottom: `2px solid ${cat?.color || '#888'}` }}
              title={`${cat?.label || 'Tag'}${seg.tag.characterId ? ` → ${MOCK_CHARACTERS.find(c => c.id === seg.tag!.characterId)?.name || ''}` : ''}`}
            >{segText}</span>
          );
        } else {
          parts.push(<span key={`${seg.start}-${seg.end}`}>{segText}</span>);
        }
      }

      return (
        <div key={`${scene.id}-${lineIdx}`} className={`sv-line${isCue ? ' sv-cue' : ''}`}
          onClick={isCue && matched ? () => { const ch = MOCK_CHARACTERS.find((c) => c.name === matched); if (ch) onCharClick(ch.id); } : undefined}>
          {parts}
        </div>
      );
    });
  }, [tagStore, charNames, onCharClick]);

  /* Scroll to scene when selected from the scene list */
  useEffect(() => {
    const el = pageRefs.current.get(selectedSceneId);
    if (el && scrollRef.current) {
      isScrollingTo.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const timer = setTimeout(() => { isScrollingTo.current = false; }, 600);
      return () => clearTimeout(timer);
    }
  }, [selectedSceneId]);

  /* IntersectionObserver to detect which scene is visible while scrolling */
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingTo.current) return;
        let best: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting && (!best || entry.intersectionRatio > best.intersectionRatio)) {
            best = entry;
          }
        }
        if (best) {
          const id = (best.target as HTMLElement).dataset.sceneId;
          if (id) onSceneVisible(id);
        }
      },
      { root: container, threshold: [0.1, 0.3, 0.5, 0.7], rootMargin: '-10% 0px -60% 0px' }
    );

    for (const el of pageRefs.current.values()) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [scenes, onSceneVisible]);

  const setPageRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) pageRefs.current.set(id, el);
    else pageRefs.current.delete(id);
  }, []);

  /* All characters available for tag assignment */
  const popupChars = MOCK_CHARACTERS;

  return (
    <div className="sv-scroll" ref={scrollRef} style={{ position: 'relative' }}>
      {scenes.map((scene) => (
        <div
          key={scene.id}
          ref={(el) => setPageRef(scene.id, el)}
          data-scene-id={scene.id}
          className={`sv-paper ${scene.id === selectedSceneId ? 'sv-paper--active' : ''}`}
          style={{ fontSize: `${fontSize}px` }}
          onMouseUp={() => handleMouseUp(scene.id)}
        >
          <div className="sv-heading">{scene.number} {scene.intExt}. {scene.location} — {scene.dayNight}</div>
          <div className="sv-content">
            {renderSceneContent(scene)}
          </div>
        </div>
      ))}

      {/* Tag popup */}
      {popup && (
        <div ref={popupRef} className="sv-tag-popup" style={{ left: popup.x, top: popup.y, transform: 'translate(-50%, -100%)' }}>
          {popup.step === 'category' && (
            <>
              <div className="sv-tag-popup-title">Tag as:</div>
              <div className="sv-tag-popup-grid">
                {BREAKDOWN_CATEGORIES.map((cat) => (
                  <button key={cat.id} className="sv-tag-popup-btn" onClick={() => handleCategoryPick(cat.id)}>
                    <span className="sv-tag-popup-swatch" style={{ background: cat.color }} />
                    {cat.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {popup.step === 'character' && (
            <>
              <div className="sv-tag-popup-title">Assign to character:</div>
              <select className="sv-tag-popup-select" defaultValue="">
                <option value="" disabled>Select a character…</option>
                {popupChars.map((ch) => (
                  <option key={ch.id} value={ch.id}>{ch.name}</option>
                ))}
              </select>
              <textarea
                className="sv-tag-popup-desc"
                placeholder="Add a description (optional)…"
                rows={2}
                value={popup.description || ''}
                onChange={(e) => setPopup({ ...popup, description: e.target.value })}
              />
              <div className="sv-tag-popup-actions">
                <button
                  className="sv-tag-popup-char-btn sv-tag-popup-char-btn--confirm"
                  onClick={() => {
                    const selectEl = popupRef.current?.querySelector('.sv-tag-popup-select') as HTMLSelectElement | null;
                    const charId = selectEl?.value || null;
                    handleCharacterPick(charId);
                  }}
                >
                  Confirm
                </button>
                <button className="sv-tag-popup-char-btn sv-tag-popup-char-btn--skip" onClick={() => handleCharacterPick(null)}>
                  Skip character
                </button>
              </div>
            </>
          )}
          {popup.step === 'highlight-all' && (
            <>
              <div className="sv-tag-popup-title">Highlight all occurrences?</div>
              <div className="sv-tag-popup-hint">Tag every instance of "{popup.matchedName}" across all scenes as Cast</div>
              <div className="sv-tag-popup-actions">
                <button className="sv-tag-popup-char-btn sv-tag-popup-char-btn--confirm" onClick={handleHighlightAll}>
                  Highlight all
                </button>
                <button className="sv-tag-popup-char-btn sv-tag-popup-char-btn--skip" onClick={() => { if (popup.matchedCharId) onCharClick(popup.matchedCharId); setPopup(null); }}>
                  Just this one
                </button>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}

/* ━━━ SCRIPT UPLOAD MODAL ━━━ */

interface ScriptUploadModalProps {
  projectId: string;
  onClose: () => void;
  onUploaded: (filename: string) => void;
}

function ScriptUploadModal({ projectId, onClose, onUploaded }: ScriptUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setScript = useScriptUploadStore((s) => s.setScript);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !processing) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, processing]);

  const handleFileSelect = (file: File) => {
    const validExts = ['.pdf', '.fdx', '.fountain', '.txt'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validExts.includes(ext)) {
      setError('Invalid file type. Please upload a PDF, FDX, Fountain, or TXT file.');
      return;
    }
    setError('');
    setSelectedFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const processFile = async () => {
    if (!selectedFile) return;
    setProcessing(true);
    setProgress(10);
    setStatusText('Reading file...');

    try {
      await new Promise(r => setTimeout(r, 300));

      setProgress(40);
      setStatusText('Extracting text...');

      // Read the file as text (PDF parsing would need pdf.js — for now handle text-based formats)
      let rawText = '';
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();

      if (ext === 'pdf') {
        // For PDF files, read as base64 — full parsing handled by desktop script-upload.js
        // Store the file info and let the breakdown page know a script was uploaded
        rawText = '[PDF uploaded — ' + selectedFile.name + ']';
      } else if (ext === 'fdx') {
        const xml = await selectedFile.text();
        // Extract text from FDX XML
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');
        const paragraphs = doc.querySelectorAll('Paragraph');
        rawText = Array.from(paragraphs).map(p => {
          const text = p.querySelector('Text');
          return text?.textContent || '';
        }).filter(Boolean).join('\n');
      } else {
        rawText = await selectedFile.text();
      }

      setProgress(70);
      setStatusText('Detecting scenes...');
      await new Promise(r => setTimeout(r, 200));

      // Count scenes by looking for scene headings
      const scenePattern = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s+/gim;
      const matches = rawText.match(scenePattern);
      const sceneCount = matches ? matches.length : 0;

      setProgress(90);
      setStatusText('Saving...');
      await new Promise(r => setTimeout(r, 200));

      // Store in the script upload store
      setScript(projectId, {
        projectId,
        filename: selectedFile.name,
        uploadedAt: new Date().toISOString(),
        sceneCount,
        rawText,
      });

      setProgress(100);
      setStatusText('Done!');
      await new Promise(r => setTimeout(r, 300));

      onUploaded(selectedFile.name);
    } catch (err) {
      setError('Failed to process file. Please try again.');
      setProcessing(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={!processing ? onClose : undefined}>
      <div className="modal-glass" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '24px 28px 0',
        }}>
          <h2 style={{
            fontSize: '0.8125rem', fontWeight: 500, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--text-heading)', margin: 0,
          }}>
            Upload Script
          </h2>
          {!processing && (
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 4,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <div style={{ padding: '20px 28px 28px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 20px' }}>
            Upload your screenplay to automatically detect scenes and characters.
          </p>

          {/* Processing state */}
          {processing ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{
                width: '100%', height: 6, borderRadius: 3,
                background: 'var(--bg-tertiary)', overflow: 'hidden', marginBottom: 16,
              }}>
                <div style={{
                  width: `${progress}%`, height: '100%', borderRadius: 3,
                  background: 'var(--accent-gold, #c9a961)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                {statusText}
              </p>
            </div>
          ) : !selectedFile ? (
            /* Drop zone */
            <button
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              style={{
                width: '100%', padding: '40px 30px', textAlign: 'center',
                border: `2px dashed ${dragOver ? 'var(--accent-gold, #c9a961)' : 'var(--border-subtle, rgba(255,255,255,0.08))'}`,
                borderRadius: 12,
                background: dragOver ? 'rgba(201, 169, 97, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer', transition: 'all 0.2s ease',
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                  <path d="M14 2v6h6"/>
                  <path d="M12 18v-6"/>
                  <path d="M9 15l3-3 3 3"/>
                </svg>
              </div>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>
                Click to upload or drag and drop
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                PDF, FDX (Final Draft), Fountain, or TXT
              </div>
            </button>
          ) : (
            /* File selected */
            <div style={{
              padding: 16, borderRadius: 10,
              background: 'rgba(201, 169, 97, 0.08)',
              border: '1px solid var(--accent-gold, #c9a961)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold, #c9a961)" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                  <path d="M14 2v6h6"/>
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: 'var(--text-heading)', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {selectedFile.name}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {formatSize(selectedFile.size)}
                  </div>
                </div>
                <button onClick={() => { setSelectedFile(null); setError(''); }} style={{
                  padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.8125rem',
                  background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                }}>
                  Remove
                </button>
              </div>
            </div>
          )}

          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginTop: 12 }}>{error}</p>
          )}

          {/* Actions */}
          {!processing && (
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24,
              borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
              paddingTop: 20,
            }}>
              <button onClick={onClose} style={{
                padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
                background: 'transparent', border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 500,
              }}>
                Cancel
              </button>
              <button
                onClick={processFile}
                disabled={!selectedFile}
                style={{
                  padding: '8px 24px', borderRadius: 8, cursor: selectedFile ? 'pointer' : 'not-allowed',
                  background: selectedFile ? 'var(--accent-gold, #c9a961)' : 'var(--bg-tertiary)',
                  border: 'none',
                  color: selectedFile ? '#1a1a1a' : 'var(--text-muted)',
                  fontSize: '0.8125rem', fontWeight: 600,
                  opacity: selectedFile ? 1 : 0.5,
                  transition: 'all 0.2s ease',
                }}
              >
                Upload & Analyze
              </button>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.fdx,.fountain,.txt"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}

/* ━━━ CHARACTER VIEW ━━━ */

function CharacterView({ char }: { char: Character; subTab: string }) {
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'lookbook' | 'timeline' | 'events' | 'notes'>('profile');
  const looks = MOCK_LOOKS.filter((l) => l.characterId === char.id);
  const scenes = MOCK_SCENES.filter((s) => s.characterIds.includes(char.id));
  const tagStore = useTagStore();
  const allCharTags = tagStore.getTagsForCharacter(char.id);
  /* Only show tags with descriptions or non-name tags in Script Notes.
     Cast tags that are just the character's name serve only to trigger the tab. */
  const charTags = allCharTags.filter((t) => {
    if (t.categoryId === 'cast' && !t.description) {
      const isOwnName = t.text.trim().toUpperCase() === char.name.toUpperCase();
      if (isOwnName) return false;
    }
    return true;
  });

  return (
    <div className="cv-wrap">
      <div className="cv-header">
        <div className="cv-avatar">{char.name.split(' ').map((n) => n[0]).join('')}</div>
        <div>
          <div className="cv-name">{char.name}</div>
          <div className="cv-meta">{ordinal(char.billing)} Billing · {char.gender} · Age {char.age}</div>
        </div>
      </div>
      <div className="cv-subtabs">
        {(['profile', 'lookbook', 'timeline', 'events', 'notes'] as const).map((t) => (
          <button key={t} className={`cv-subtab ${activeSubTab === t ? 'cv-subtab--active' : ''}`}
            onClick={() => setActiveSubTab(t)}>
            {t === 'notes' ? 'Script Notes' : t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'notes' && charTags.length > 0 && <span className="cv-subtab-badge">{charTags.length}</span>}
          </button>
        ))}
      </div>
      <div className="cv-content">
        {activeSubTab === 'profile' && (
          <div className="cv-grid">
            {([['Age', char.age], ['Gender', char.gender], ['Hair Colour', char.hairColour],
              ['Hair Type', char.hairType], ['Eye Colour', char.eyeColour], ['Skin Tone', char.skinTone],
              ['Build', char.build], ['Features', char.distinguishingFeatures]] as [string, string][]).map(([l, v]) => (
              <div key={l} className="cv-field"><span className="cv-field-label">{l}</span><span className="cv-field-value">{v || '—'}</span></div>
            ))}
            {char.notes && (
              <div className="cv-field cv-field--wide"><span className="cv-field-label">Notes</span><span className="cv-field-value">{char.notes}</span></div>
            )}
          </div>
        )}
        {activeSubTab === 'lookbook' && (
          <div className="cv-looks">
            {looks.length === 0 ? <p className="cv-empty">No looks created.</p> : looks.map((lk) => (
              <div key={lk.id} className="cv-look-card">
                <div className="cv-look-name">{lk.name}<span className="cv-look-desc"> — {lk.description}</span></div>
                <div className="cv-look-row"><span className="cv-look-label">Hair</span>{lk.hair}</div>
                <div className="cv-look-row"><span className="cv-look-label">Makeup</span>{lk.makeup}</div>
                <div className="cv-look-row"><span className="cv-look-label">Wardrobe</span>{lk.wardrobe}</div>
              </div>
            ))}
          </div>
        )}
        {activeSubTab === 'timeline' && (
          <div className="cv-timeline">
            {scenes.map((s) => (
              <div key={s.id} className="cv-tl-item">
                <span className="cv-tl-num">Sc {s.number}</span>
                <span className="cv-tl-loc">{s.intExt}. {s.location} — {s.dayNight}</span>
              </div>
            ))}
          </div>
        )}
        {activeSubTab === 'events' && <p className="cv-empty">No continuity events for this character.</p>}
        {activeSubTab === 'notes' && (
          <div className="cv-notes">
            {charTags.length === 0 ? (
              <p className="cv-empty">No script notes yet. Highlight text in the script and assign it to this character.</p>
            ) : (
              charTags.map((tag) => {
                const tagScene = MOCK_SCENES.find((s) => s.id === tag.sceneId);
                const cat = BREAKDOWN_CATEGORIES.find((c) => c.id === tag.categoryId);
                return (
                  <div key={tag.id} className="cv-note-card">
                    <div className="cv-note-header">
                      <span className="cv-note-cat" style={{ color: cat?.color }}>
                        <span className="bd-legend-swatch" style={{ background: cat?.color }} />
                        {cat?.label}
                      </span>
                      {tagScene && <span className="cv-note-scene">Sc {tagScene.number}</span>}
                      <button className="cv-note-remove" onClick={() => tagStore.removeTag(tag.id)} title="Remove tag">×</button>
                    </div>
                    <div className="cv-note-text">"{tag.text}"</div>
                    {tag.description && <div className="cv-note-desc">{tag.description}</div>}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ━━━ BREAKDOWN FORM PANEL ━━━ */

function BreakdownFormPanel({ scene, characters, breakdown, activeCharacterId, saveStatus, scenes, allScenes, onNavigate, onUpdate, onUpdateTimeline, onAddEvent, onUpdateEvent, onRemoveEvent }: {
  scene: Scene; characters: Character[]; breakdown: SceneBreakdown | undefined;
  activeCharacterId: string | null; saveStatus: 'idle' | 'saving' | 'saved';
  scenes: Scene[]; allScenes: Scene[]; onNavigate: (id: string) => void;
  onUpdate: (cid: string, d: Partial<CharacterBreakdown>) => void;
  onUpdateTimeline: (t: SceneBreakdown['timeline']) => void;
  onAddEvent: (e: ContinuityEvent) => void;
  onUpdateEvent: (eventId: string, data: Partial<ContinuityEvent>) => void;
  onRemoveEvent: (id: string) => void;
}) {
  if (!breakdown) return null;

  const sceneIdx = scenes.findIndex((s) => s.id === scene.id);
  const prevScene = sceneIdx > 0 ? scenes[sceneIdx - 1] : null;
  const nextScene = sceneIdx < scenes.length - 1 ? scenes[sceneIdx + 1] : null;

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(false);
  const synopsisStore = useSynopsisStore();
  const synopsis = synopsisStore.getSynopsis(scene.id, scene.synopsis);
  const setSynopsis = useCallback((text: string) => synopsisStore.setSynopsis(scene.id, text), [synopsisStore, scene.id]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setAtBottom(entry.isIntersecting), { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="fp-wrap">
      {/* Scene info — pinned */}
      <div className="fp-header" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span className="fp-scene-num">Scene {scene.number}</span>
          <span className={`fp-save fp-save--${saveStatus}`}>
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : ''}
          </span>
        </div>
        <div className="fp-scene-tagline">{scene.number} {scene.intExt}. {scene.location} — {scene.dayNight}</div>
      </div>

      <div className="fp-scroll">
        {/* Synopsis */}
        <div className="fp-section fp-section--pill">
          <div className="fp-section-title">Synopsis</div>
          <textarea
            className="fi-input fp-synopsis-input"
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
            placeholder="Write a synopsis for this scene..."
            rows={3}
          />
        </div>

        {/* Timeline */}
        <div className="fp-section fp-section--pill">
          <div className="fp-section-title">Timeline</div>
          <div className="fp-row-3">
            <FSelect label="Day" value={breakdown.timeline.day}
              options={['', 'Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7', 'Day 8', 'Day 9', 'Day 10']}
              onChange={(v) => onUpdateTimeline({ ...breakdown.timeline, day: v })} />
            <FSelect label="Time" value={breakdown.timeline.time}
              options={['', 'Day', 'Night', 'Dawn', 'Dusk']}
              onChange={(v) => onUpdateTimeline({ ...breakdown.timeline, time: v })} />
            <FSelect label="Type" value={breakdown.timeline.type}
              options={['', 'Normal', 'Flashback', 'Flash Fwd', 'Time Jump', 'Dream', 'Montage']}
              onChange={(v) => onUpdateTimeline({ ...breakdown.timeline, type: v })} />
          </div>
        </div>

        {/* Notes */}
        <div className="fp-section fp-section--pill">
          <div className="fp-section-title">Notes</div>
          <FInput label="" value={breakdown.timeline.note} placeholder="e.g. 3 weeks later"
            onChange={(v) => onUpdateTimeline({ ...breakdown.timeline, note: v })} />
        </div>

        {/* Characters in Scene */}
        <div className="fp-section fp-section--bordered">
          <div className="fp-section-title">
            Characters in Scene
            <span className="fp-section-count">{characters.length}</span>
          </div>
          {characters.map((ch) => {
            const cb = breakdown.characters.find((c) => c.characterId === ch.id);
            if (!cb) return null;
            const charEvents = breakdown.continuityEvents.filter((e) => e.characterId === ch.id);
            return (
              <CharBlock key={ch.id} char={ch} cb={cb}
                sceneId={scene.id}
                looks={MOCK_LOOKS.filter((l) => l.characterId === ch.id)}
                highlighted={activeCharacterId === ch.id}
                onUpdate={(d) => onUpdate(ch.id, d)}
                characterEvents={charEvents}
                allScenes={allScenes}
                onAddCharEvent={(charId) => onAddEvent({
                  id: `ce-${Date.now()}`, type: 'Wound', characterId: charId,
                  description: '', sceneRange: `${scene.number}-${scene.number}`,
                })}
                onUpdateEvent={onUpdateEvent}
                onRemoveEvent={onRemoveEvent} />
            );
          })}
        </div>

        {/* Scene-level Continuity Events */}
        <div className="fp-section">
          <div className="fp-section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Scene Continuity Events</span>
            <button className="fp-add-btn" onClick={() => onAddEvent({
              id: `ce-${Date.now()}`, type: 'Wound', characterId: '',
              description: '', sceneRange: `${scene.number}-${scene.number}`,
            })}>+ Add</button>
          </div>
          {breakdown.continuityEvents.length === 0 ? (
            <p className="fp-empty">No events flagged.</p>
          ) : breakdown.continuityEvents.map((evt) => (
            <div key={evt.id} className="fp-event">
              <div className="fp-event-top">
                <select className="fp-event-type-select" value={evt.type}
                  onChange={(e) => onUpdateEvent(evt.id, { type: e.target.value })}>
                  {CONTINUITY_EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button className="fp-remove-btn" onClick={() => onRemoveEvent(evt.id)}>Remove</button>
              </div>
              <select className="fp-event-char-select" value={evt.characterId}
                onChange={(e) => onUpdateEvent(evt.id, { characterId: e.target.value })}>
                <option value="">Scene-wide (no character)</option>
                {characters.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
              </select>
              <input className="fp-event-desc-input" placeholder="Description..." value={evt.description}
                onChange={(e) => onUpdateEvent(evt.id, { description: e.target.value })} />
              <SceneRangeSelect sceneRange={evt.sceneRange} allScenes={allScenes}
                onChange={(range) => onUpdateEvent(evt.id, { sceneRange: range })} />
            </div>
          ))}
        </div>
        <div ref={sentinelRef} className="fp-scroll-sentinel" />
      </div>

      {/* Scene navigation — visible only when scrolled to bottom */}
      <div className={`fp-nav${atBottom ? ' fp-nav--visible' : ''}`}>
        <button className="fp-nav-btn" disabled={!prevScene} onClick={() => prevScene && onNavigate(prevScene.id)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          <span className="fp-nav-label">
            {prevScene ? <>Scene {prevScene.number}</> : 'No previous'}
          </span>
        </button>
        <span className="fp-nav-pos">{sceneIdx + 1} / {scenes.length}</span>
        <button className="fp-nav-btn" disabled={!nextScene} onClick={() => nextScene && onNavigate(nextScene.id)}>
          <span className="fp-nav-label">
            {nextScene ? <>Scene {nextScene.number}</> : 'No next'}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  );
}

/* ━━━ CHARACTER FORM BLOCK ━━━ */

function CharBlock({ char, cb, looks, highlighted, onUpdate, characterEvents, onAddCharEvent, onUpdateEvent, onRemoveEvent, allScenes, sceneId }: {
  char: Character; cb: CharacterBreakdown; looks: { id: string; name: string }[];
  highlighted: boolean; onUpdate: (d: Partial<CharacterBreakdown>) => void;
  characterEvents: ContinuityEvent[];
  allScenes: Scene[];
  onAddCharEvent: (charId: string) => void;
  onUpdateEvent: (eventId: string, data: Partial<ContinuityEvent>) => void;
  onRemoveEvent: (eventId: string) => void;
  sceneId: string;
}) {
  const ue = (f: 'entersWith' | 'exitsWith', k: keyof HMWEntry, v: string) =>
    onUpdate({ [f]: { ...cb[f], [k]: v } });

  const tagStore = useTagStore();
  const sceneTags = tagStore.getTagsForScene(sceneId).filter((t) => t.characterId === char.id);

  /* Category-specific tags (single words/short phrases → pills) */
  const hairTags = sceneTags.filter((t) => t.categoryId === 'hair');
  const makeupTags = sceneTags.filter((t) => t.categoryId === 'makeup');
  const wardrobeTags = sceneTags.filter((t) => t.categoryId === 'wardrobe');
  const sfxTags = sceneTags.filter((t) => t.categoryId === 'sfx');
  const healthTags = sceneTags.filter((t) => t.categoryId === 'health');
  const injuryTags = sceneTags.filter((t) => t.categoryId === 'injuries');
  const stuntTags = sceneTags.filter((t) => t.categoryId === 'stunts');
  const weatherTags = sceneTags.filter((t) => t.categoryId === 'weather');

  /* Descriptive tags — cast tags with a description, or any tag with description text */
  const descTags = sceneTags.filter((t) => {
    if (t.categoryId === 'cast') return true;
    return false;
  }).filter((t) => {
    /* Skip plain character-name cast tags (used only for highlighting) */
    if (t.categoryId === 'cast' && !t.description && t.text.trim().toUpperCase() === char.name.toUpperCase()) return false;
    return true;
  });

  const TagPills = ({ tags, color }: { tags: ScriptTag[]; color: string }) =>
    tags.length > 0 ? (
      <div className="cb-tag-row">
        {tags.map((t) => (
          <span key={t.id} className="cb-tag-pill" style={{ borderColor: color, color }}>
            {t.text}
            <button className="cb-tag-remove" onClick={() => tagStore.removeTag(t.id)}>×</button>
          </span>
        ))}
      </div>
    ) : null;

  const catColor = (id: string) => BREAKDOWN_CATEGORIES.find((c) => c.id === id)?.color || '#999';

  return (
    <div className={`cb-block ${highlighted ? 'cb-block--hl' : ''}`}>
      <div className="cb-header">
        <span className="cb-name">{char.name}</span>
        <div className="cb-header-right">
          <span className="cb-billing-badge">{ordinal(char.billing)}</span>
        </div>
      </div>

      <div className="cb-field">
        <label className="cb-label">Look</label>
        <select className="cb-select" value={cb.lookId} onChange={(e) => onUpdate({ lookId: e.target.value })}>
          <option value="">Select look...</option>
          {looks.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          <option value="__new">+ New Look</option>
        </select>
      </div>

      {descTags.length > 0 && (
        <div className="cb-desc-tags">
          {descTags.map((t) => {
            const cat = BREAKDOWN_CATEGORIES.find((c) => c.id === t.categoryId);
            return (
              <div key={t.id} className="cb-desc-card">
                <div className="cb-desc-header">
                  <span className="cb-desc-cat" style={{ color: cat?.color }}>
                    <span className="bd-legend-swatch" style={{ background: cat?.color }} /> {cat?.label}
                  </span>
                  <button className="cb-tag-remove" onClick={() => tagStore.removeTag(t.id)}>×</button>
                </div>
                <div className="cb-desc-text">"{t.text}"</div>
                {t.description && <div className="cb-desc-note">{t.description}</div>}
              </div>
            );
          })}
        </div>
      )}

      <div className="cb-field">
        <label className="cb-label">Enters With</label>
        <div className="cb-hmw">
          <div><FInput label="Hair" value={cb.entersWith.hair} onChange={(v) => ue('entersWith', 'hair', v)} /><TagPills tags={hairTags} color={catColor('hair')} /></div>
          <div><FInput label="Makeup" value={cb.entersWith.makeup} onChange={(v) => ue('entersWith', 'makeup', v)} /><TagPills tags={makeupTags} color={catColor('makeup')} /></div>
          <div><FInput label="Wardrobe" value={cb.entersWith.wardrobe} onChange={(v) => ue('entersWith', 'wardrobe', v)} /><TagPills tags={wardrobeTags} color={catColor('wardrobe')} /></div>
        </div>
      </div>

      <div className="cb-field">
        <FInput label="SFX / Prosthetics" value={cb.sfx} onChange={(v) => onUpdate({ sfx: v })} />
        <TagPills tags={sfxTags} color={catColor('sfx')} />
      </div>

      {(healthTags.length > 0 || injuryTags.length > 0 || stuntTags.length > 0 || weatherTags.length > 0) && (
        <div className="cb-field">
          <label className="cb-label">Tagged from Script</label>
          {healthTags.length > 0 && <><span className="cb-tag-cat" style={{ color: catColor('health') }}>Health</span><TagPills tags={healthTags} color={catColor('health')} /></>}
          {injuryTags.length > 0 && <><span className="cb-tag-cat" style={{ color: catColor('injuries') }}>Injuries</span><TagPills tags={injuryTags} color={catColor('injuries')} /></>}
          {stuntTags.length > 0 && <><span className="cb-tag-cat" style={{ color: catColor('stunts') }}>Stunts</span><TagPills tags={stuntTags} color={catColor('stunts')} /></>}
          {weatherTags.length > 0 && <><span className="cb-tag-cat" style={{ color: catColor('weather') }}>Weather</span><TagPills tags={weatherTags} color={catColor('weather')} /></>}
        </div>
      )}

      <div className="cb-field">
        <label className="cb-label">Changes</label>
        <div className="cb-toggle">
          <button className={`cb-tog-opt ${cb.changeType === 'no-change' ? 'cb-tog-opt--on' : ''}`}
            onClick={() => onUpdate({ changeType: 'no-change', changeNotes: '' })}>No Change</button>
          <button className={`cb-tog-opt ${cb.changeType === 'change' ? 'cb-tog-opt--on' : ''}`}
            onClick={() => onUpdate({ changeType: 'change' })}>Change</button>
        </div>
        {cb.changeType === 'change' && (
          <>
            <textarea className="cb-textarea" placeholder="Describe change..." value={cb.changeNotes}
              onChange={(e) => onUpdate({ changeNotes: e.target.value })} rows={2} />

            <div className="cb-field" style={{ marginTop: '12px' }}>
              <div className="cb-exits-head">
                <label className="cb-label">Exits With</label>
                <button className="cb-same-btn" onClick={() => onUpdate({ exitsWith: { ...cb.entersWith } })}>Same as entry</button>
              </div>
              <div className="cb-hmw">
                <FInput label="Hair" value={cb.exitsWith.hair} onChange={(v) => ue('exitsWith', 'hair', v)} />
                <FInput label="Makeup" value={cb.exitsWith.makeup} onChange={(v) => ue('exitsWith', 'makeup', v)} />
                <FInput label="Wardrobe" value={cb.exitsWith.wardrobe} onChange={(v) => ue('exitsWith', 'wardrobe', v)} />
              </div>
            </div>
          </>
        )}
      </div>

      <FInput label="Notes" value={cb.notes} onChange={(v) => onUpdate({ notes: v })} />

      {/* Per-character continuity events */}
      <div className="cb-continuity">
        <div className="cb-continuity-header">
          <label className="cb-label">Continuity Events</label>
          <button className="fp-add-btn" onClick={() => onAddCharEvent(char.id)}>+ Add</button>
        </div>
        {characterEvents.length === 0 ? (
          <p className="fp-empty">No continuity events for this character.</p>
        ) : characterEvents.map((evt) => (
          <div key={evt.id} className="cb-event">
            <div className="cb-event-row">
              <select className="cb-event-type" value={evt.type}
                onChange={(e) => onUpdateEvent(evt.id, { type: e.target.value })}>
                {CONTINUITY_EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button className="fp-remove-btn" onClick={() => onRemoveEvent(evt.id)}>Remove</button>
            </div>
            <input className="cb-event-desc" placeholder="Description..." value={evt.description}
              onChange={(e) => onUpdateEvent(evt.id, { description: e.target.value })} />
            <SceneRangeSelect sceneRange={evt.sceneRange} allScenes={allScenes}
              onChange={(range) => onUpdateEvent(evt.id, { sceneRange: range })} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ━━━ Scene range selector ━━━ */

function SceneRangeSelect({ sceneRange, allScenes, onChange }: {
  sceneRange: string; allScenes: Scene[]; onChange: (range: string) => void;
}) {
  const parts = sceneRange.split('-');
  const startScene = parts[0]?.trim() || '';
  const endScene = parts[1]?.trim() || startScene;

  const handleStart = (v: string) => onChange(`${v}-${endScene}`);
  const handleEnd = (v: string) => onChange(`${startScene}-${v}`);

  return (
    <div className="ce-scene-range">
      <div className="ce-scene-range-field">
        <label className="ce-scene-range-label">Start</label>
        <select className="ce-scene-range-select" value={startScene} onChange={(e) => handleStart(e.target.value)}>
          {allScenes.map((s) => <option key={s.id} value={String(s.number)}>Scene {s.number}</option>)}
        </select>
      </div>
      <span className="ce-scene-range-sep">—</span>
      <div className="ce-scene-range-field">
        <label className="ce-scene-range-label">End</label>
        <select className="ce-scene-range-select" value={endScene} onChange={(e) => handleEnd(e.target.value)}>
          {allScenes.map((s) => <option key={s.id} value={String(s.number)}>Scene {s.number}</option>)}
        </select>
      </div>
    </div>
  );
}

/* ━━━ Form primitives ━━━ */

function FInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="fi-wrap">
      <label className="fi-label">{label}</label>
      <input className="fi-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function FSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="fi-wrap">
      <label className="fi-label">{label}</label>
      <select className="fi-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
    </div>
  );
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function ToolsIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;
}

function ImportIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
}

function DraftsIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8"/></svg>;
}

function BreakdownViewIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>;
}

function ExportIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
}

