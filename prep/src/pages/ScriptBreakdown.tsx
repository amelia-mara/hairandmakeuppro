import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  MOCK_SCENES, MOCK_CHARACTERS, MOCK_LOOKS, BREAKDOWN_CATEGORIES, CONTINUITY_EVENT_TYPES,
  useBreakdownStore, useTagStore, useSynopsisStore, useScriptUploadStore, useParsedScriptStore,
  useCharacterOverridesStore, useRevisedScenesStore,
  type Scene, type Character, type Look, type CharacterBreakdown, type ContinuityEvent, type HMWEntry, type SceneBreakdown,
  type ScriptTag, type ParsedCharacterData, type SceneChange,
} from '@/stores/breakdownStore';
import { useProjectStore } from '@/stores/projectStore';
import { EmbeddedBreakdownTable } from './BreakdownSheet';
import { parseScriptFile, type ParsedScript } from '@/utils/scriptParser';
import { generateLooksFromScript } from '@/utils/lookGenerator';
import { diffScripts, type DiffResult } from '@/utils/scriptDiff';
import { supabase } from '@/lib/supabase';

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
  const [scrollTrigger, setScrollTrigger] = useState(0);
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
  const parsedScriptStore = useParsedScriptStore();
  const updateProject = useProjectStore((s) => s.updateProject);
  const hasScript = !!scriptUpload.getScript(projectId);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState<DiffResult | null>(null);
  const [splitView, setSplitView] = useState(false);
  const revisedStore = useRevisedScenesStore();

  /* Resolve data source: parsed script → mock data fallback */
  const parsedData = parsedScriptStore.getParsedData(projectId);
  const ALL_SCENES: Scene[] = useMemo(() => parsedData ? parsedData.scenes : MOCK_SCENES, [parsedData]);
  const ALL_CHARACTERS: Character[] = useMemo(() => {
    if (!parsedData) return MOCK_CHARACTERS;
    // Backfill category for data saved before the supporting_artist feature
    return parsedData.characters.map((c) => ({
      ...c,
      category: c.category || 'principal',
    }));
  }, [parsedData]);
  const ALL_LOOKS: Look[] = useMemo(() => parsedData ? parsedData.looks : MOCK_LOOKS, [parsedData]);

  /* Hide preamble from scene list — its content is merged into the first real scene */
  const preambleScene = ALL_SCENES.find(s => s.location === 'PREAMBLE');
  const nonPreambleScenes = useMemo(() => ALL_SCENES.filter(s => s.location !== 'PREAMBLE'), [ALL_SCENES]);

  /* Auto-show upload modal when no script is uploaded */
  useEffect(() => {
    if (!hasScript && !parsedData) {
      setShowUploadModal(true);
    }
  }, [hasScript, parsedData]);

  /* Reset selected scene when data source changes — synchronous derivation
     avoids a render frame where scene is undefined */
  const validSceneId = nonPreambleScenes.find(s => s.id === selectedSceneId) ? selectedSceneId : nonPreambleScenes[0]?.id ?? '';
  useEffect(() => {
    if (validSceneId !== selectedSceneId) {
      setSelectedSceneId(validSceneId);
      setActiveTab('script'); // reset to script tab when data source changes
    }
  }, [validSceneId, selectedSceneId]);

  const scene = ALL_SCENES.find((s) => s.id === validSceneId);
  const sceneCharacters = scene ? scene.characterIds.map((id) => ALL_CHARACTERS.find((c) => c.id === id)).filter((c): c is Character => !!c) : [];
  const scenePrincipals = sceneCharacters.filter((c) => c.category !== 'supporting_artist');
  const sceneSupportingArtists = sceneCharacters.filter((c) => c.category === 'supporting_artist');
  const breakdown = store.getBreakdown(validSceneId);

  useEffect(() => {
    if (!scene) return;
    const existing = store.getBreakdown(validSceneId);
    if (!existing) {
      store.setBreakdown(validSceneId, {
        sceneId: validSceneId,
        timeline: { day: scene.storyDay || '', time: scene.dayNight === 'DAY' ? 'Day' : scene.dayNight === 'NIGHT' ? 'Night' : scene.dayNight === 'DAWN' ? 'Dawn' : scene.dayNight === 'DUSK' ? 'Dusk' : '', type: '', note: '' },
        characters: scene.characterIds.map((cid) => ({
          characterId: cid, lookId: '',
          entersWith: { hair: '', makeup: '', wardrobe: '' },
          sfx: '', environmental: '', action: '',
          changeType: 'no-change', changeNotes: '',
          exitsWith: { hair: '', makeup: '', wardrobe: '' },
          notes: '',
        })),
        continuityEvents: [],
      });
    } else if (!existing.timeline.day && scene.storyDay) {
      // Backfill story day for breakdowns created before auto-population
      store.updateTimeline(validSceneId, { ...existing.timeline, day: scene.storyDay });
    }
  }, [validSceneId, store, scene]);

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

  const filteredScenes = nonPreambleScenes.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (s.location.toLowerCase().includes(q) || String(s.number).includes(q)) return true;
    if (s.scriptContent.toLowerCase().includes(q)) return true;
    const charNames = s.characterIds.map((cid) => ALL_CHARACTERS.find((c) => c.id === cid)?.name ?? '').join(' ').toLowerCase();
    return charNames.includes(q);
  });

  const selectScene = useCallback((id: string) => {
    setSelectedSceneId(id);
    setScrollTrigger(n => n + 1);
    setActiveTab('script');
  }, []);

  /* Auto-select first matching scene when search query changes */
  useEffect(() => {
    if (searchQuery && filteredScenes.length > 0 && !filteredScenes.some((s) => s.id === selectedSceneId)) {
      selectScene(filteredScenes[0].id);
    }
  }, [searchQuery, filteredScenes, selectedSceneId, selectScene]);

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
      <div className={`bd-panels`}>

        {/* ━━━ LEFT — Scene List Panel ━━━ */}
        {(
        <div className="bd-left bd-panel-surface" style={{ width: LEFT_WIDTH, minWidth: LEFT_WIDTH }}>
          <div className="sl-header">
            <span className="sl-header-label">Scenes</span>
            <span className="sl-header-count">{nonPreambleScenes.length}</span>
          </div>
          <div className="sl-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input className="sl-search-input" placeholder="Search scenes, script, characters..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="sl-list" ref={sceneListRef}>
            {filteredScenes.map((s) => {
              const status = store.getCompletionStatus(s.id, s);
              const isActive = s.id === selectedSceneId;
              const bd = store.getBreakdown(s.id);
              const colorClass = sceneColorClass(s.intExt, s.dayNight);
              const isRevised = revisedStore.isSceneRevised(projectId, s.id);
              return (
                <button key={s.id} className={`sl-card ${isActive ? 'sl-card--active' : ''} ${colorClass} ${isRevised ? 'sl-card--revised' : ''}`}
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
                      {s.characterIds.length > 0 && (() => {
                        const principals = s.characterIds.map((cid) => ALL_CHARACTERS.find((c) => c.id === cid)).filter((c): c is Character => !!c && c.category !== 'supporting_artist');
                        const saCount = s.characterIds.map((cid) => ALL_CHARACTERS.find((c) => c.id === cid)).filter((c): c is Character => !!c && c.category === 'supporting_artist').length;
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
        )}

        {/* ━━━ CENTER — Script / Characters ━━━ */}
        <div className="bd-center">
          {/* File divider tabs */}
          <div className="cp-tabstrip">
            <div className="cp-tabs-row">
              <button className={`cp-divider-tab ${activeTab === 'script' ? 'cp-divider-tab--active' : ''}`}
                onClick={() => setActiveTab('script')}>Script</button>
              {scenePrincipals.map((c) => (
                <button key={c.id} className={`cp-divider-tab ${activeTab === c.id ? 'cp-divider-tab--active' : ''}`}
                  onClick={() => setActiveTab(c.id)}>{c.name}</button>
              ))}
              {/* Show tab for active character even if not in this scene */}
              {activeTab !== 'script' && activeTab !== 'supporting-artists' && !scenePrincipals.find(c => c.id === activeTab) && ALL_CHARACTERS.find(c => c.id === activeTab) && (
                <button className="cp-divider-tab cp-divider-tab--active"
                  onClick={() => setActiveTab(activeTab)}>{ALL_CHARACTERS.find(c => c.id === activeTab)!.name}</button>
              )}
              {sceneSupportingArtists.length > 0 && (
                <button className={`cp-divider-tab ${activeTab === 'supporting-artists' ? 'cp-divider-tab--active' : ''}`}
                  onClick={() => setActiveTab('supporting-artists')}
                  style={{ fontStyle: 'italic', opacity: 0.85 }}>
                  Supporting Artists ({sceneSupportingArtists.length})
                </button>
              )}
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
                  scenes={nonPreambleScenes}
                  preambleScene={preambleScene}
                  characters={ALL_CHARACTERS}
                  selectedSceneId={selectedSceneId}
                  scrollTrigger={scrollTrigger}
                  onSceneVisible={onSceneVisible}
                  fontSize={fontSize}
                  onCharClick={setActiveTab}
                  projectId={projectId}
                  onSynopsisTag={(sceneId, text) => {
                    const existing = synopsisStore.getSynopsis(sceneId, '');
                    synopsisStore.setSynopsis(sceneId, existing ? `${existing} ${text}` : text);
                    triggerSave();
                  }}
                  onTagCreated={(sceneId, characterId, categoryId, text) => {
                    const charOverrides = useCharacterOverridesStore.getState();
                    const cat = BREAKDOWN_CATEGORIES.find(c => c.id === categoryId);
                    if (!cat) return;

                    if (cat.group === 'breakdown') {
                      /* Auto-fill scene breakdown fields */
                      const bd = store.getBreakdown(sceneId);
                      const cb = bd?.characters.find((c) => c.characterId === characterId);
                      if (cb) {
                        if (cat.field.startsWith('entersWith.')) {
                          const key = cat.field.split('.')[1] as 'hair' | 'makeup' | 'wardrobe';
                          const existing = cb.entersWith[key];
                          store.updateCharacterBreakdown(sceneId, characterId, {
                            entersWith: { ...cb.entersWith, [key]: existing ? `${existing}, ${text}` : text },
                          });
                        } else {
                          const field = cat.field as 'sfx' | 'environmental' | 'action' | 'notes';
                          const existing = cb[field] || '';
                          store.updateCharacterBreakdown(sceneId, characterId, {
                            [field]: existing ? `${existing}, ${text}` : text,
                          });
                        }
                      }
                    } else if (cat.group === 'profile') {
                      /* Auto-fill character profile fields */
                      if (cat.field === 'scriptNotes') {
                        // Script Description tags are stored as tags and displayed in Script Notes tab
                        // No direct field update — the tag itself serves as the record
                      } else {
                        const profileField = cat.field as keyof Character;
                        const char = ALL_CHARACTERS.find((c) => c.id === characterId);
                        if (char) {
                          const resolved = charOverrides.getCharacter(char);
                          const existing = (resolved[profileField] as string) || '';
                          // For notes, append; for other fields, only fill if empty
                          if (profileField === 'notes') {
                            charOverrides.updateCharacter(characterId, {
                              [profileField]: existing ? `${existing}. ${text}` : text,
                            });
                          } else if (!existing) {
                            charOverrides.updateCharacter(characterId, { [profileField]: text });
                          }
                        }
                      }
                    }
                    triggerSave();
                  }}
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
            ) : activeTab === 'supporting-artists' ? (
              <SupportingArtistsPanel artists={sceneSupportingArtists} scene={scene!} allScenes={ALL_SCENES} />
            ) : ALL_CHARACTERS.find((c) => c.id === activeTab) ? (
              <CharacterView
                char={ALL_CHARACTERS.find((c) => c.id === activeTab)!}
                subTab="profile"
                allScenes={ALL_SCENES}
                allLooks={ALL_LOOKS}
              />
            ) : (
              <div className="cv-empty" style={{ padding: 24 }}>Character not found. Select a character tab above.</div>
            )}
          </div>
        </div>

        {/* Right divider */}
        <div className="bd-divider" onMouseDown={rightPanel.onMouseDown} onDoubleClick={rightPanel.onDoubleClick}>
          <div className="bd-divider-grip" />
        </div>

        {/* ━━━ RIGHT — Breakdown Form or Full Breakdown Table ━━━ */}
        <div className={`bd-right bd-panel-surface ${splitView ? 'bd-right--breakdown' : ''}`} style={splitView ? undefined : { width: rightPanel.width, minWidth: rightPanel.width }}>
          <div className="fp-panel-header">
            <span className="fp-panel-title">{splitView ? 'Breakdown' : 'Scene Breakdown'}</span>
            {splitView && (
              <button
                className="btn-ghost bd-btn bd-split-close"
                onClick={() => setSplitView(false)}
                aria-label="Close breakdown view"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </button>
            )}
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
                    <button className="tools-dropdown-item" onClick={() => { setShowDraftsModal(true); setToolsOpen(false); }}>
                      <DraftsIcon /> <span>View Previous Drafts</span>
                    </button>
                    <button className="tools-dropdown-item" onClick={() => { setSplitView(true); setToolsOpen(false); }}>
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
          {splitView ? (
            <EmbeddedBreakdownTable projectId={projectId} activeSceneId={validSceneId} />
          ) : (
            scene && (
            <BreakdownFormPanel
              scene={scene} characters={sceneCharacters} breakdown={breakdown}
              activeCharacterId={activeTab !== 'script' ? activeTab : null}
              saveStatus={saveStatus}
              scenes={filteredScenes}
              allScenes={ALL_SCENES}
              allCharacters={ALL_CHARACTERS}
              allLooks={ALL_LOOKS}
              onNavigate={selectScene}
              onUpdate={(cid, data) => { store.updateCharacterBreakdown(validSceneId, cid, data); triggerSave(); }}
              onUpdateTimeline={(tl) => { store.updateTimeline(validSceneId, tl); triggerSave(); }}
              onAddEvent={(evt) => { store.addContinuityEvent(validSceneId, evt); triggerSave(); }}
              onUpdateEvent={(eventId, data) => { store.updateContinuityEvent(validSceneId, eventId, data); triggerSave(); }}
              onRemoveEvent={(id) => { store.removeContinuityEvent(validSceneId, id); triggerSave(); }}
              onRemoveCharacter={(charId, action, mergeTargetId) => {
                if (action === 'not-in-scene') {
                  parsedScriptStore.removeCharacterFromScene(projectId, validSceneId, charId);
                  store.removeCharacterBreakdown(validSceneId, charId);
                } else if (action === 'not-a-character') {
                  parsedScriptStore.removeCharacterEntirely(projectId, charId);
                  store.removeCharacterFromAllBreakdowns(charId);
                } else if (action === 'duplicate' && mergeTargetId) {
                  parsedScriptStore.mergeCharacters(projectId, charId, mergeTargetId);
                  store.mergeCharacterBreakdowns(charId, mergeTargetId);
                }
                triggerSave();
              }}
              onAddLook={(characterId, name) => {
                const newId = `look-${Date.now()}`;
                parsedScriptStore.addLook(projectId, {
                  id: newId, characterId, name, description: '', hair: '', makeup: '', wardrobe: '',
                });
                return newId;
              }}
            />
            )
          )}
        </div>
      </div>

      {/* Script Upload Modal */}
      {showUploadModal && (
        <ScriptUploadModal
          projectId={projectId}
          onClose={() => setShowUploadModal(false)}
          onUploaded={(filename, diffResult) => {
            updateProject(projectId, { scriptFilename: filename });
            setShowUploadModal(false);
            if (diffResult && diffResult.changes.length > 0) {
              // Store revision changes for highlighting
              revisedStore.setRevision(projectId, {
                changes: diffResult.changes,
                filename,
              });
              // Show changes summary modal
              setShowChangesModal(diffResult);
            }
          }}
        />
      )}

      {/* Previous Drafts Modal */}
      {showDraftsModal && (
        <PreviousDraftsModal
          projectId={projectId}
          onClose={() => setShowDraftsModal(false)}
        />
      )}

      {/* Changes Summary Modal */}
      {showChangesModal && (
        <ChangesSummaryModal
          diffResult={showChangesModal}
          onClose={() => setShowChangesModal(null)}
          onGoToScene={(sceneId) => {
            setShowChangesModal(null);
            setSelectedSceneId(sceneId);
            setScrollTrigger((n) => n + 1);
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
  /** Step 1: pick character, Step 2: pick field/category */
  step: 'character' | 'field';
  categoryId?: string;
  characterId?: string;
  /** When true, popup appears below the selection instead of above */
  popBelow?: boolean;
}

function ScriptView({ scenes, preambleScene, characters, selectedSceneId, scrollTrigger, onSceneVisible, fontSize, onCharClick, onTagCreated, onSynopsisTag, projectId }: {
  scenes: Scene[];
  preambleScene?: Scene;
  characters: Character[];
  selectedSceneId: string;
  scrollTrigger: number;
  onSceneVisible: (id: string) => void;
  fontSize: number;
  onCharClick: (id: string) => void;
  onTagCreated: (sceneId: string, characterId: string, categoryId: string, text: string) => void;
  onSynopsisTag: (sceneId: string, text: string) => void;
  projectId: string;
}) {
  const charNames = characters.map((c) => c.name);
  /* Build a set of all name variants that could appear as dialogue cues:
     full names ("LENNON BOWIE") plus individual parts ("LENNON", "BOWIE")
     and titled variants ("MRS. BENNET", "MR. DARCY") */
  const cueNameToChar = useMemo(() => {
    const map = new Map<string, Character>();
    for (const c of characters) {
      map.set(c.name, c);
      // Add individual name parts as cue variants
      for (const part of c.name.split(/\s+/)) {
        if (part.length >= 2 && !map.has(part)) {
          map.set(part, c);
        }
      }
    }
    return map;
  }, [characters]);
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

  /* Clamp popup within viewport after render (measures real height) */
  useEffect(() => {
    if (!popup || !popupRef.current) return;
    const el = popupRef.current;
    const rect = el.getBoundingClientRect();
    const pad = 10;
    let needsUpdate = false;
    let newY = popup.y;
    let newX = popup.x;
    let newPopBelow = popup.popBelow;

    if (rect.top < pad) {
      // Popup is above viewport — flip to below or push down
      newY = pad;
      newPopBelow = true;
      needsUpdate = true;
    } else if (rect.bottom > window.innerHeight - pad) {
      // Popup is below viewport — push up
      newY = window.innerHeight - rect.height - pad;
      newPopBelow = false;
      needsUpdate = true;
    }
    if (rect.left < pad) {
      newX = popup.x + (pad - rect.left);
      needsUpdate = true;
    } else if (rect.right > window.innerWidth - pad) {
      newX = popup.x - (rect.right - window.innerWidth + pad);
      needsUpdate = true;
    }

    if (needsUpdate) {
      // Directly update the element style to avoid re-render loop
      el.style.left = `${newX}px`;
      el.style.top = `${newY}px`;
      el.style.transform = newPopBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)';
    }
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

    // Estimate popup height (character list ~280px, field picker ~350px)
    const estPopupHeight = 350;
    // Detect if selection is near the top — pop below instead of above
    const popBelow = rect.top < estPopupHeight + 20;
    // Clamp Y so popup never goes above viewport or below it
    let y = popBelow ? rect.bottom + 10 : rect.top - 10;
    if (popBelow && y + estPopupHeight > window.innerHeight - 10) {
      y = window.innerHeight - estPopupHeight - 10;
    }
    if (!popBelow && y - estPopupHeight < 10) {
      y = estPopupHeight + 10;
    }

    setPopup({
      x: Math.min(Math.max(rect.left + rect.width / 2, 170), window.innerWidth - 170),
      y,
      sceneId,
      startOffset: startIdx,
      endOffset: startIdx + text.length,
      text,
      step: 'character',
      popBelow,
    });

    sel.removeAllRanges();
  }, [scenes]);

  const parsedScriptStore = useParsedScriptStore();

  /* Step 1: User picks a character → advance to field selection */
  const handleCharacterPick = useCallback((charId: string) => {
    if (!popup) return;
    setPopup({ ...popup, step: 'field', characterId: charId });
  }, [popup]);

  /* Step 1b: User creates a new character → add to project, advance to field selection */
  const handleCreateNewCharacter = useCallback(() => {
    if (!popup) return;
    const pd = parsedScriptStore.getParsedData(projectId);
    if (!pd) return;
    const newId = `char-${Date.now()}`;
    const newChar: ParsedCharacterData = {
      id: newId,
      name: popup.text.trim().toUpperCase(),
      billing: pd.characters.length + 1,
      category: 'principal',
      age: '', gender: '', hairColour: '', hairType: '',
      eyeColour: '', skinTone: '', build: '', distinguishingFeatures: '', notes: '',
    };
    const updatedChars = [...pd.characters, newChar];
    const updatedScenes = pd.scenes.map(s =>
      s.id === popup.sceneId ? { ...s, characterIds: [...s.characterIds, newId] } : s
    );
    parsedScriptStore.setParsedData(projectId, { ...pd, characters: updatedChars, scenes: updatedScenes });
    setPopup({ ...popup, step: 'field', characterId: newId });
  }, [popup, parsedScriptStore, projectId]);

  /* Step 2: User picks a field/category → create tag + auto-populate */
  const handleFieldPick = useCallback((catId: string) => {
    if (!popup || !popup.characterId) return;
    tagStore.addTag({
      id: `tag-${Date.now()}`,
      sceneId: popup.sceneId,
      startOffset: popup.startOffset,
      endOffset: popup.endOffset,
      text: popup.text,
      categoryId: catId,
      characterId: popup.characterId,
    });
    onTagCreated(popup.sceneId, popup.characterId, catId, popup.text);
    setPopup(null);
  }, [popup, tagStore, onTagCreated]);

  /* Synopsis pick: tag selected text as synopsis (scene-level, no character) */
  const handleSynopsisPick = useCallback(() => {
    if (!popup) return;
    tagStore.addTag({
      id: `tag-${Date.now()}`,
      sceneId: popup.sceneId,
      startOffset: popup.startOffset,
      endOffset: popup.endOffset,
      text: popup.text,
      categoryId: 'synopsis',
      characterId: '',
    });
    onSynopsisTag(popup.sceneId, popup.text);
    setPopup(null);
  }, [popup, tagStore, onSynopsisTag]);

  /* Build a regex that matches known character names within action/description
     lines so we can highlight them inline. Only multi-word full names and their
     first-name references are matched. Single-word character names and generic
     words (man, cowboy, etc.) are excluded — they only appear on dialogue cues. */
  const charNamePattern = useMemo(() => {
    // Common words that should never be highlighted as first-name fragments
    const GENERIC_WORDS = new Set([
      'MAN', 'WOMAN', 'BOY', 'GIRL', 'OLD', 'YOUNG', 'CHILD', 'BABY',
      'COWBOY', 'COWGIRL', 'DOCTOR', 'NURSE', 'OFFICER', 'CAPTAIN',
      'SERGEANT', 'DETECTIVE', 'AGENT', 'JUDGE', 'PRIEST', 'PASTOR',
      'DRIVER', 'WAITER', 'WAITRESS', 'BARTENDER', 'BARMAN', 'GUARD',
      'SOLDIER', 'GENERAL', 'KING', 'QUEEN', 'PRINCE', 'PRINCESS',
      'MRS', 'MR', 'MISS', 'TALL', 'SHORT', 'BIG', 'FAT', 'THIN',
      'ELDERLY', 'MIDDLE', 'LITTLE', 'BEAUTIFUL', 'PRETTY', 'HANDSOME',
    ]);
    const allNames: { name: string; char: Character }[] = [];
    for (const c of characters) {
      // Skip single-word character names (COWBOY, MAN, etc.)
      if (!/\s/.test(c.name.trim())) continue;
      // Full name always included (e.g. "LENNON BOWIE", "OLD MAN")
      allNames.push({ name: c.name, char: c });
      // First name for inline references — but skip generic words
      const first = c.name.split(/\s+/)[0];
      if (first.length >= 3 && !GENERIC_WORDS.has(first.toUpperCase())) {
        allNames.push({ name: first, char: c });
      }
    }
    // Sort longest first for greedy matching
    allNames.sort((a, b) => b.name.length - a.name.length);
    if (allNames.length === 0) return null;
    const escaped = allNames.map(n => n.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
    return { re, lookup: allNames };
  }, [characters]);

  /** Render a text string with inline character name highlights.
      Character names get the sv-cue-inline class and are clickable. */
  const highlightCharNames = useCallback((text: string, keyPrefix: string): React.ReactNode => {
    if (!charNamePattern || !text) return text;
    const { re, lookup } = charNamePattern;
    re.lastIndex = 0;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const matchText = m[0];
      const upper = matchText.toUpperCase();
      // Find which character this matches
      const entry = lookup.find(n => n.name.toUpperCase() === upper);
      if (!entry) continue;
      // Push text before the match
      if (m.index > lastIdx) {
        parts.push(<span key={`${keyPrefix}-t${lastIdx}`}>{text.slice(lastIdx, m.index)}</span>);
      }
      parts.push(
        <span key={`${keyPrefix}-c${m.index}`} className="sv-cue-inline" onClick={(e) => { e.stopPropagation(); onCharClick(entry.char.id); }}>
          {matchText}
        </span>
      );
      lastIdx = m.index + matchText.length;
    }
    if (lastIdx === 0) return text; // no matches
    if (lastIdx < text.length) {
      parts.push(<span key={`${keyPrefix}-t${lastIdx}`}>{text.slice(lastIdx)}</span>);
    }
    return <>{parts}</>;
  }, [charNamePattern, onCharClick]);

  /* Render preamble (title page) — centred text with bold title */
  const renderPreambleContent = useCallback((scene: Scene) => {
    const lines = scene.scriptContent.split('\n');
    let titleFound = false;
    return lines.map((line, i) => {
      const trimmed = line.trim();
      const isTitle = !titleFound && trimmed !== '';
      if (isTitle) titleFound = true;
      return (
        <div key={`pre-${i}`} className={`sv-line${isTitle ? ' sv-preamble-title' : ''}`}>
          {trimmed || '\u00A0'}
        </div>
      );
    });
  }, []);

  /* Render a scene's content with inline highlights */
  const renderSceneContent = useCallback((scene: Scene) => {
    const sceneTags = tagStore.getTagsForScene(scene.id);
    const lines = scene.scriptContent.split('\n');

    /** Strip parentheticals from a line to get the bare cue name */
    function extractCueName(text: string): string {
      return text.replace(/\s*\(.*?\)\s*/g, '').trim();
    }
    /** Check if a trimmed line is a character cue — must be ALL CAPS and match a known character */
    function matchCue(trimmed: string): Character | null {
      if (trimmed !== trimmed.toUpperCase() || trimmed.length > 50) return null;
      const cueName = extractCueName(trimmed);
      if (!cueName) return null;
      return cueNameToChar.get(cueName) || null;
    }

    /* Pre-compute dialogue line indices: lines following a character cue until blank line */
    const dialogueSet = new Set<number>();
    const cueCharMap = new Map<number, Character>(); // line index → matched character
    let inDialogue = false;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const charMatch = matchCue(trimmed);
      if (charMatch) {
        cueCharMap.set(i, charMatch);
        inDialogue = true;
      } else if (inDialogue) {
        if (trimmed === '') {
          inDialogue = false;
        } else {
          dialogueSet.add(i);
        }
      }
    }

    if (sceneTags.length === 0) {
      /* Plain rendering (no tags to show) */
      return lines.map((line, i) => {
        const trimmed = line.trim();
        const ch = cueCharMap.get(i);
        if (ch) {
          return <div key={`${scene.id}-${i}`} className="sv-line sv-cue" onClick={() => onCharClick(ch.id)}>{trimmed}</div>;
        }
        if (dialogueSet.has(i)) {
          return <div key={`${scene.id}-${i}`} className="sv-line sv-dialogue">{trimmed || '\u00A0'}</div>;
        }
        // Action/description lines: highlight character names inline
        return <div key={`${scene.id}-${i}`} className="sv-line">{trimmed ? highlightCharNames(trimmed, `${scene.id}-${i}`) : '\u00A0'}</div>;
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

      const isDialogueLine = dialogueSet.has(lineIdx);

      if (!hasTag) {
        if (isCue) {
          const ch = characters.find((c) => c.name === matched)!;
          return <div key={`${scene.id}-${lineIdx}`} className="sv-line sv-cue" onClick={() => onCharClick(ch.id)}>{trimmed}</div>;
        }
        if (isDialogueLine) {
          return <div key={`${scene.id}-${lineIdx}`} className="sv-line sv-dialogue">{trimmed || '\u00A0'}</div>;
        }
        return <div key={`${scene.id}-${lineIdx}`} className="sv-line">{lo.line ? highlightCharNames(lo.line, `${scene.id}-${lineIdx}`) : '\u00A0'}</div>;
      }

      /* Render with highlighted spans */
      const parts: React.ReactNode[] = [];
      for (const seg of lineSegs) {
        const segStart = Math.max(seg.start, lo.start) - lo.start;
        const segEnd = Math.min(seg.end, lo.end) - lo.start;
        const segText = lo.line.slice(segStart, segEnd);
        if (seg.tag) {
          if (seg.tag.categoryId === 'cast' && seg.tag.characterId) {
            // Cast tags use amber character-name styling and link to profile
            const charId = seg.tag.characterId;
            parts.push(
              <span key={`${seg.start}-${seg.end}`} className="sv-cue-inline"
                onClick={(e) => { e.stopPropagation(); onCharClick(charId); }}
                title={characters.find(c => c.id === charId)?.name || ''}
              >{segText}</span>
            );
          } else {
            const cat = BREAKDOWN_CATEGORIES.find((c) => c.id === seg.tag!.categoryId);
            parts.push(
              <span key={`${seg.start}-${seg.end}`} className="sv-highlight"
                style={{ backgroundColor: `${cat?.color || '#888'}33`, borderBottom: `2px solid ${cat?.color || '#888'}` }}
                title={`${cat?.label || 'Tag'}${seg.tag.characterId ? ` → ${characters.find(c => c.id === seg.tag!.characterId)?.name || ''}` : ''}`}
              >{segText}</span>
            );
          }
        } else {
          parts.push(<span key={`${seg.start}-${seg.end}`}>{segText}</span>);
        }
      }

      const lineClass = `sv-line${isCue ? ' sv-cue' : isDialogueLine ? ' sv-dialogue' : ''}`;
      return (
        <div key={`${scene.id}-${lineIdx}`} className={lineClass}
          onClick={isCue && matched ? () => { const ch = characters.find((c) => c.name === matched); if (ch) onCharClick(ch.id); } : undefined}>
          {parts}
        </div>
      );
    });
  }, [tagStore, charNames, onCharClick, highlightCharNames]);

  /* Scroll to scene when selected from the scene list.
     scrollTrigger changes on every explicit scene selection (even re-clicking
     the same scene), so the effect always fires. */
  useEffect(() => {
    const el = pageRefs.current.get(selectedSceneId);
    if (el && scrollRef.current) {
      isScrollingTo.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Use scrollend event when available; fall back to a generous timeout
      // so the IntersectionObserver doesn't override selectedSceneId mid-scroll.
      const container = scrollRef.current;
      const unlock = () => { isScrollingTo.current = false; };
      let timer: ReturnType<typeof setTimeout>;
      if (container && 'onscrollend' in container) {
        const handler = () => { unlock(); container.removeEventListener('scrollend', handler); clearTimeout(timer); };
        container.addEventListener('scrollend', handler, { once: true });
        timer = setTimeout(handler, 1500); // safety fallback
      } else {
        timer = setTimeout(unlock, 1200);
      }
      return () => { clearTimeout(timer); unlock(); };
    }
  }, [selectedSceneId, scrollTrigger]);

  /* Detect which scene is most visible while scrolling.
     Uses a scroll listener instead of IntersectionObserver so we always
     evaluate ALL scene elements on every scroll frame, not just the ones
     that happen to cross a threshold boundary. */
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let rafId = 0;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (isScrollingTo.current) return;
        const containerRect = container.getBoundingClientRect();
        // Target zone: top 40% of the container — the area the user is reading
        const zoneTop = containerRect.top;
        const zoneBottom = containerRect.top + containerRect.height * 0.4;

        let bestId: string | null = null;
        let bestOverlap = 0;

        for (const [id, el] of pageRefs.current.entries()) {
          const r = el.getBoundingClientRect();
          const overlapTop = Math.max(r.top, zoneTop);
          const overlapBottom = Math.min(r.bottom, zoneBottom);
          const overlap = Math.max(0, overlapBottom - overlapTop);
          if (overlap > bestOverlap) {
            bestOverlap = overlap;
            bestId = id;
          }
        }
        if (bestId) onSceneVisible(bestId);
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    // Run once on mount to sync initial state
    onScroll();
    return () => { container.removeEventListener('scroll', onScroll); cancelAnimationFrame(rafId); };
  }, [scenes, onSceneVisible]);

  const setPageRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) pageRefs.current.set(id, el);
    else pageRefs.current.delete(id);
  }, []);

  /* All characters available for tag assignment */
  const popupChars = characters;

  return (
    <div className="sv-scroll" ref={scrollRef} style={{ position: 'relative' }}>
      {scenes.map((scene, idx) => (
        <div
          key={scene.id}
          ref={(el) => setPageRef(scene.id, el)}
          data-scene-id={scene.id}
          className={`sv-paper ${scene.id === selectedSceneId ? 'sv-paper--active' : ''} ${useRevisedScenesStore.getState().isSceneRevised(projectId, scene.id) ? 'sv-paper--revised' : ''}`}
          style={{ fontSize: `${fontSize}px` }}
          onMouseUp={() => handleMouseUp(scene.id)}
        >
          {/* Merge preamble content into the first scene */}
          {idx === 0 && preambleScene && (
            <div className="sv-content sv-preamble-content">
              {renderPreambleContent(preambleScene)}
            </div>
          )}
          <div className="sv-heading">{scene.number} {scene.intExt}. {scene.location} — {scene.dayNight}</div>
          <div className="sv-content">
            {renderSceneContent(scene)}
          </div>
        </div>
      ))}


      {/* Tag popup — portalled to body so it isn't clipped by scroll overflow */}
      {popup && createPortal(
        <div ref={popupRef} className="sv-tag-popup sv-tag-popup--fixed" style={{
          left: popup.x,
          top: popup.y,
          transform: popup.popBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
        }}>
          {popup.step === 'character' && (
            <>
              <div className="sv-tag-popup-title">Assign to character</div>
              <div className="sv-tag-popup-quoted">"{popup.text.length > 50 ? popup.text.slice(0, 50) + '…' : popup.text}"</div>
              <div className="sv-tag-popup-charlist">
                <button className="sv-tag-popup-char-item sv-tag-popup-char-item--synopsis" onClick={handleSynopsisPick}>
                  <span className="sv-tag-popup-char-avatar" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  </span>
                  <span>Synopsis</span>
                </button>
                {popupChars.map((ch) => (
                  <button key={ch.id} className="sv-tag-popup-char-item" onClick={() => handleCharacterPick(ch.id)}>
                    <span className="sv-tag-popup-char-avatar">{ch.name.charAt(0)}</span>
                    <span>{ch.name}</span>
                  </button>
                ))}
                <button className="sv-tag-popup-char-item sv-tag-popup-char-item--new" onClick={handleCreateNewCharacter}>
                  <span className="sv-tag-popup-char-avatar" style={{ background: 'rgba(212, 148, 58, 0.2)', color: '#D4943A' }}>+</span>
                  <span>New Character</span>
                </button>
              </div>
            </>
          )}
          {popup.step === 'field' && (
            <>
              <div className="sv-tag-popup-title">
                Tag as — <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{popupChars.find(c => c.id === popup.characterId)?.name}</span>
              </div>
              <div className="sv-tag-popup-field-section">
                <div className="sv-tag-popup-field-label">Scene Breakdown</div>
                <div className="sv-tag-popup-grid">
                  {BREAKDOWN_CATEGORIES.filter(c => c.group === 'breakdown').map((cat) => (
                    <button key={cat.id} className="sv-tag-popup-btn" onClick={() => handleFieldPick(cat.id)}>
                      <span className="sv-tag-popup-swatch" style={{ background: cat.color }} />
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sv-tag-popup-field-section">
                <div className="sv-tag-popup-field-label">Character Profile</div>
                <div className="sv-tag-popup-grid">
                  {BREAKDOWN_CATEGORIES.filter(c => c.group === 'profile').map((cat) => (
                    <button key={cat.id} className="sv-tag-popup-btn" onClick={() => handleFieldPick(cat.id)}>
                      <span className="sv-tag-popup-swatch" style={{ background: cat.color }} />
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <button className="sv-tag-popup-char-btn sv-tag-popup-char-btn--skip" onClick={() => setPopup({ ...popup, step: 'character' })}>
                Back
              </button>
            </>
          )}
        </div>,
        document.body
      )}

    </div>
  );
}

/* ━━━ SCRIPT UPLOAD MODAL ━━━ */

interface ScriptUploadModalProps {
  projectId: string;
  onClose: () => void;
  onUploaded: (filename: string, diffResult?: DiffResult) => void;
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
  const setParsedData = useParsedScriptStore((s) => s.setParsedData);
  const existingParsed = useParsedScriptStore((s) => s.getParsedData(projectId));
  const breakdownStore = useBreakdownStore();
  const synopsisStore = useSynopsisStore();

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
      const parsed: ParsedScript = await parseScriptFile(selectedFile, (status) => {
        setStatusText(status);
      });

      setProgress(50);
      setStatusText('Detecting characters...');
      await new Promise(r => setTimeout(r, 200));

      // Build character ID mapping
      const charIdMap = new Map<string, string>();
      const characters: Character[] = parsed.characters.map((pc, idx) => {
        const id = `pc-${idx + 1}`;
        charIdMap.set(pc.normalizedName, id);
        return {
          id,
          name: pc.name,
          billing: idx + 1,
          category: pc.category || 'principal',
          age: '',
          gender: '',
          hairColour: '',
          hairType: '',
          eyeColour: '',
          skinTone: '',
          build: '',
          distinguishingFeatures: '',
          notes: `Appears in ${pc.sceneCount} scene${pc.sceneCount !== 1 ? 's' : ''}`,
        };
      });

      setProgress(70);
      setStatusText('Building scenes...');

      // Deduplicate scene numbers
      const seenSceneNumbers = new Map<string, number>();
      const scenes: Scene[] = parsed.scenes.map((ps, idx) => {
        let sceneNum = ps.sceneNumber;
        const count = (seenSceneNumbers.get(sceneNum) || 0) + 1;
        seenSceneNumbers.set(sceneNum, count);
        if (count > 1) sceneNum = `${sceneNum}-${count}`;

        const charIds = ps.characters
          .map(name => charIdMap.get(name))
          .filter((id): id is string => !!id);

        const dayNight = ps.timeOfDay === 'MORNING' ? 'DAWN' as const
          : ps.timeOfDay === 'EVENING' ? 'DUSK' as const
          : ps.timeOfDay === 'CONTINUOUS' ? 'DAY' as const
          : ps.timeOfDay as 'DAY' | 'NIGHT';

        const parsedNum = parseInt(sceneNum, 10);
        const isPreamble = ps.location === 'PREAMBLE';
        return {
          id: `ps-${idx + 1}`,
          number: isNaN(parsedNum) ? idx + 1 : parsedNum,
          intExt: ps.intExt,
          dayNight,
          location: isPreamble ? 'PREAMBLE' : ps.location,
          storyDay: '',
          timeInfo: '',
          characterIds: charIds,
          synopsis: '',
          scriptContent: isPreamble ? ps.content.trim() : ps.content.replace(/^[^\n]*\n/, '').trim(),
        };
      });

      setProgress(85);
      setStatusText('Generating looks...');
      await new Promise(r => setTimeout(r, 200));

      const { looks: generatedLooks, scenes: scenesWithStoryDays } = generateLooksFromScript(scenes, characters);

      // ━━━ REVISION DETECTION: if existing script data exists, remap breakdowns ━━━
      const isRevision = !!existingParsed;
      let diffResult: DiffResult | undefined;

      if (isRevision) {
        setProgress(90);
        setStatusText('Comparing with previous draft...');
        await new Promise(r => setTimeout(r, 200));

        diffResult = diffScripts(
          existingParsed.scenes,
          scenesWithStoryDays,
          existingParsed.characters,
          characters,
        );

        // Remap breakdown data from old scene IDs → new scene IDs
        // This preserves all breakdown work (HMW entries, continuity, synopses, etc.)
        for (const [oldSceneId, newSceneId] of diffResult.idMap) {
          if (oldSceneId === newSceneId) continue;

          // Remap main breakdown
          const existingBreakdown = breakdownStore.getBreakdown(oldSceneId);
          if (existingBreakdown) {
            // Also remap character IDs within the breakdown
            const remappedCharBreakdowns = existingBreakdown.characters.map((cb) => {
              const newCharId = diffResult!.characterIdMap.get(cb.characterId);
              return newCharId ? { ...cb, characterId: newCharId } : cb;
            });
            breakdownStore.setBreakdown(newSceneId, {
              ...existingBreakdown,
              sceneId: newSceneId,
              characters: remappedCharBreakdowns,
            });
          }

          // Remap synopsis
          const existingSynopsis = synopsisStore.getSynopsis(oldSceneId, '');
          if (existingSynopsis) {
            synopsisStore.setSynopsis(newSceneId, existingSynopsis);
          }
        }

        // For matched scenes, preserve story day assignments from previous breakdown
        for (const [oldSceneId, newSceneId] of diffResult.idMap) {
          const oldScene = existingParsed.scenes.find((s) => s.id === oldSceneId);
          const newScene = scenesWithStoryDays.find((s) => s.id === newSceneId);
          if (oldScene?.storyDay && newScene) {
            newScene.storyDay = oldScene.storyDay;
          }
        }

        // Preserve character profile overrides by remapping character IDs
        const charOverrides = useCharacterOverridesStore.getState();
        for (const [oldCharId, newCharId] of diffResult.characterIdMap) {
          if (oldCharId === newCharId) continue;
          const existing = charOverrides.overrides[oldCharId];
          if (existing) {
            charOverrides.updateCharacter(newCharId, existing);
          }
        }
      }

      setProgress(95);
      setStatusText('Saving...');
      await new Promise(r => setTimeout(r, 200));

      // Store parsed data
      setParsedData(projectId, {
        scenes: scenesWithStoryDays,
        characters,
        looks: generatedLooks,
        filename: selectedFile.name,
        parsedAt: new Date().toISOString(),
      });

      // Store in script upload store for backward compat
      setScript(projectId, {
        projectId,
        filename: selectedFile.name,
        uploadedAt: new Date().toISOString(),
        sceneCount: scenes.length,
        rawText: parsed.rawText,
      });

      // Upload PDF to Supabase storage and create script_uploads record
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const timestamp = Date.now();
          const storagePath = `${projectId}/scripts/${timestamp}_${selectedFile.name}`;

          await supabase.storage
            .from('project-documents')
            .upload(storagePath, selectedFile, { upsert: false });

          const { data: versions } = await supabase
            .from('script_uploads')
            .select('version_number')
            .eq('project_id', projectId)
            .order('version_number', { ascending: false })
            .limit(1);

          const nextVersion = (versions?.[0]?.version_number ?? 0) + 1;

          await supabase.from('script_uploads').insert({
            project_id: projectId,
            version_number: nextVersion,
            storage_path: storagePath,
            file_name: selectedFile.name,
            file_size: selectedFile.size,
            raw_text: parsed.rawText,
            scene_count: scenesWithStoryDays.length,
            character_count: characters.length,
            is_active: true,
            status: 'parsed',
            uploaded_by: session.user.id,
          });
        }
      } catch (uploadErr) {
        console.warn('Failed to sync script to Supabase:', uploadErr);
      }

      setProgress(100);
      setStatusText('Done!');
      await new Promise(r => setTimeout(r, 300));

      onUploaded(selectedFile.name, diffResult);
    } catch (err) {
      console.error('Script processing error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to process file: ${message}`);
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
            fontSize: '0.8125rem', letterSpacing: '0.1em',
            textTransform: 'uppercase' as const, color: 'var(--text-heading)', margin: 0,
          }}>
            <span className="heading-italic">Upload</span>{' '}
            <span className="heading-regular">Script</span>
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
                  background: 'var(--accent-gold, #D4943A)',
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
                border: `2px dashed ${dragOver ? 'var(--accent-gold, #D4943A)' : 'var(--border-subtle, rgba(255,255,255,0.08))'}`,
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
              border: '1px solid var(--accent-gold, #D4943A)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold, #D4943A)" strokeWidth="1.5">
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
                  background: selectedFile ? 'var(--accent-gold, #D4943A)' : 'var(--bg-tertiary)',
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

/* ━━━ SUPPORTING ARTISTS PANEL ━━━ */

function SupportingArtistsPanel({ artists, scene, allScenes }: { artists: Character[]; scene: Scene; allScenes: Scene[] }) {
  return (
    <div style={{ padding: '20px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary, #e8e0d4)' }}>
          Supporting Artists
        </h3>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted, #a89b8c)' }}>
          Background and extras in this scene
        </p>
      </div>

      {artists.length === 0 ? (
        <p style={{ color: 'var(--text-muted, #a89b8c)', fontStyle: 'italic' }}>No supporting artists in this scene.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {artists.map((artist) => {
            const otherScenes = allScenes.filter((s) => s.id !== scene.id && s.characterIds.includes(artist.id));
            return (
              <div key={artist.id} style={{
                background: 'var(--card-bg, #2a2520)', border: '1px solid var(--border, #3d352d)',
                borderRadius: 8, padding: '12px 16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary, #e8e0d4)' }}>
                    {artist.name}
                  </span>
                  <span style={{
                    fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10,
                    background: 'var(--accent-muted, #78716c)', color: 'var(--text-primary, #e8e0d4)',
                  }}>
                    SA
                  </span>
                </div>
                {artist.notes && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #a89b8c)' }}>
                    {artist.notes}
                  </p>
                )}
                {otherScenes.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--text-muted, #a89b8c)' }}>
                    Also in: {otherScenes.map((s) => `Sc ${s.number}`).join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ━━━ CHARACTER VIEW ━━━ */

function CharacterView({ char, allScenes, allLooks }: { char: Character; subTab: string; allScenes: Scene[]; allLooks: Look[] }) {
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'lookbook' | 'timeline' | 'events' | 'notes'>('profile');
  const looks = allLooks.filter((l) => l.characterId === char.id);
  const scenes = allScenes.filter((s) => s.characterIds.includes(char.id));
  const bdStore = useBreakdownStore();
  const tagStore = useTagStore();
  const charOverrides = useCharacterOverridesStore();
  const resolvedChar = charOverrides.getCharacter(char);
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

  const updateField = useCallback((field: string, value: string) => {
    charOverrides.updateCharacter(char.id, { [field]: value });
  }, [char.id, charOverrides]);

  const profileFields: { label: string; key: keyof Character; wide?: boolean }[] = [
    { label: 'Age', key: 'age' },
    { label: 'Gender', key: 'gender' },
    { label: 'Hair Colour', key: 'hairColour' },
    { label: 'Hair Type', key: 'hairType' },
    { label: 'Eye Colour', key: 'eyeColour' },
    { label: 'Skin Tone', key: 'skinTone' },
    { label: 'Build', key: 'build' },
    { label: 'Features', key: 'distinguishingFeatures' },
  ];

  return (
    <div className="cv-wrap">
      <div className="cv-header">
        <div className="cv-avatar">{resolvedChar.name.split(' ').map((n) => n[0]).join('')}</div>
        <div>
          <div className="cv-name">{resolvedChar.name}</div>
          <div className="cv-meta">{ordinal(resolvedChar.billing)} Billing · {resolvedChar.gender} · Age {resolvedChar.age}</div>
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
            {profileFields.map(({ label, key }) => (
              <div key={label} className="cv-field">
                <label className="cv-field-label">{label}</label>
                <input
                  className="fi-input cv-field-input"
                  value={resolvedChar[key] as string || ''}
                  onChange={(e) => updateField(key, e.target.value)}
                  placeholder={`Enter ${label.toLowerCase()}…`}
                />
              </div>
            ))}
            <div className="cv-field cv-field--wide">
              <label className="cv-field-label">Notes</label>
              <textarea
                className="fi-input cv-field-textarea"
                value={resolvedChar.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Enter notes…"
                rows={3}
              />
            </div>
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
            {scenes.map((s) => {
              const bd = bdStore.getBreakdown(s.id);
              const storyDay = bd?.timeline?.day || s.storyDay || '';
              return (
                <div key={s.id} className="cv-tl-item">
                  <span className="cv-tl-num">Sc {s.number}</span>
                  {storyDay && <span className="cv-tl-day">{storyDay}</span>}
                  <span className="cv-tl-loc">{s.intExt}. {s.location} — {s.dayNight}</span>
                </div>
              );
            })}
          </div>
        )}
        {activeSubTab === 'events' && <p className="cv-empty">No continuity events for this character.</p>}
        {activeSubTab === 'notes' && (
          <div className="cv-notes">
            {charTags.length === 0 ? (
              <p className="cv-empty">No script notes yet. Highlight text in the script and assign it to this character.</p>
            ) : (
              charTags.map((tag) => {
                const tagScene = allScenes.find((s) => s.id === tag.sceneId);
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

function BreakdownFormPanel({ scene, characters, breakdown, activeCharacterId, saveStatus, scenes, allScenes, allCharacters, allLooks, onNavigate, onUpdate, onUpdateTimeline, onAddEvent, onUpdateEvent, onRemoveEvent, onRemoveCharacter, onAddLook }: {
  scene: Scene; characters: Character[]; breakdown: SceneBreakdown | undefined;
  activeCharacterId: string | null; saveStatus: 'idle' | 'saving' | 'saved';
  scenes: Scene[]; allScenes: Scene[]; allCharacters: Character[]; allLooks: Look[];
  onNavigate: (id: string) => void;
  onUpdate: (cid: string, d: Partial<CharacterBreakdown>) => void;
  onUpdateTimeline: (t: SceneBreakdown['timeline']) => void;
  onAddEvent: (e: ContinuityEvent) => void;
  onUpdateEvent: (eventId: string, data: Partial<ContinuityEvent>) => void;
  onRemoveEvent: (id: string) => void;
  onRemoveCharacter: (charId: string, action: 'not-in-scene' | 'not-a-character' | 'duplicate', mergeTargetId?: string) => void;
  onAddLook: (characterId: string, name: string) => string;
}) {
  if (!breakdown) return null;

  const sceneIdx = scenes.findIndex((s) => s.id === scene.id);
  const prevScene = sceneIdx > 0 ? scenes[sceneIdx - 1] : null;
  const nextScene = sceneIdx < scenes.length - 1 ? scenes[sceneIdx + 1] : null;

  const bStore = useBreakdownStore();
  const prevBreakdown = prevScene ? bStore.getBreakdown(prevScene.id) : undefined;

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
          <span className="fp-scene-num">{`Scene ${scene.number}`}</span>
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
            <div className="fi-wrap">
              <label className="fi-label">Day</label>
              <input
                className={`fi-select fi-day-input ${breakdown.timeline.dayConfirmed ? 'fi-day--confirmed' : 'fi-day--suggested'}`}
                value={breakdown.timeline.day}
                onChange={(e) => onUpdateTimeline({ ...breakdown.timeline, day: e.target.value, dayConfirmed: true })}
                placeholder={scene.storyDay || 'Day 1'}
              />
            </div>
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
                looks={allLooks.filter((l) => l.characterId === ch.id)}
                highlighted={activeCharacterId === ch.id}
                onUpdate={(d) => onUpdate(ch.id, d)}
                characterEvents={charEvents}
                allScenes={allScenes}
                allCharacters={allCharacters}
                onAddCharEvent={(charId) => onAddEvent({
                  id: `ce-${Date.now()}`, type: 'Wound', characterId: charId,
                  description: '', sceneRange: `${scene.number}-${scene.number}`,
                })}
                onUpdateEvent={onUpdateEvent}
                onRemoveEvent={onRemoveEvent}
                onRemoveCharacter={onRemoveCharacter}
                onAddLook={onAddLook}
                prevCharBreakdown={prevBreakdown?.characters.find((c) => c.characterId === ch.id)}
                prevSceneNumber={prevScene ? String(prevScene.number) : undefined} />
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

function CharBlock({ char, cb, looks, highlighted, onUpdate, characterEvents, onAddCharEvent, onUpdateEvent, onRemoveEvent, allScenes, allCharacters, sceneId, onRemoveCharacter, onAddLook, prevCharBreakdown, prevSceneNumber }: {
  char: Character; cb: CharacterBreakdown; looks: { id: string; name: string }[];
  highlighted: boolean; onUpdate: (d: Partial<CharacterBreakdown>) => void;
  characterEvents: ContinuityEvent[];
  allScenes: Scene[];
  allCharacters: Character[];
  onAddCharEvent: (charId: string) => void;
  onUpdateEvent: (eventId: string, data: Partial<ContinuityEvent>) => void;
  onRemoveEvent: (eventId: string) => void;
  sceneId: string;
  onRemoveCharacter: (charId: string, action: 'not-in-scene' | 'not-a-character' | 'duplicate', mergeTargetId?: string) => void;
  onAddLook: (characterId: string, name: string) => string;
  prevCharBreakdown?: CharacterBreakdown;
  prevSceneNumber?: string;
}) {
  const ue = (f: 'entersWith' | 'exitsWith', k: keyof HMWEntry, v: string) =>
    onUpdate({ [f]: { ...cb[f], [k]: v } });

  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showNewLookInput, setShowNewLookInput] = useState(false);
  const [newLookName, setNewLookName] = useState('');
  const newLookInputRef = useRef<HTMLInputElement>(null);
  const charOverrides = useCharacterOverridesStore();
  const resolvedChar = charOverrides.getCharacter(char);

  /* Characters available for merge — exclude self, sort by billing (most likely merge targets first) */
  const mergeOptions = useMemo(() =>
    allCharacters
      .filter((c) => c.id !== char.id)
      .sort((a, b) => a.billing - b.billing),
    [allCharacters, char.id]
  );

  const profileFields: { label: string; key: keyof Character }[] = [
    { label: 'Age', key: 'age' },
    { label: 'Gender', key: 'gender' },
    { label: 'Hair Colour', key: 'hairColour' },
    { label: 'Hair Type', key: 'hairType' },
    { label: 'Eye Colour', key: 'eyeColour' },
    { label: 'Skin Tone', key: 'skinTone' },
    { label: 'Build', key: 'build' },
    { label: 'Features', key: 'distinguishingFeatures' },
  ];

  const tagStore = useTagStore();
  const sceneTags = tagStore.getTagsForScene(sceneId).filter((t) => t.characterId === char.id);

  /* Category-specific tags (single words/short phrases → pills) */
  const hairTags = sceneTags.filter((t) => t.categoryId === 'hair');
  const makeupTags = sceneTags.filter((t) => t.categoryId === 'makeup');
  const wardrobeTags = sceneTags.filter((t) => t.categoryId === 'wardrobe');
  const sfxTags = sceneTags.filter((t) => t.categoryId === 'sfx');

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

  const handleCopyFromPrev = useCallback(() => {
    if (!prevCharBreakdown) return;
    onUpdate({
      lookId: prevCharBreakdown.lookId,
      entersWith: { ...prevCharBreakdown.entersWith },
      sfx: prevCharBreakdown.sfx,
      environmental: prevCharBreakdown.environmental,
      action: prevCharBreakdown.action,
      notes: prevCharBreakdown.notes,
    });
  }, [prevCharBreakdown, onUpdate]);

  return (
    <div className={`cb-block ${highlighted ? 'cb-block--hl' : ''}`}>
      <div className="cb-header">
        <span className="cb-name">{char.name}</span>
        <div className="cb-header-right">
          {prevCharBreakdown && (
            <button className="cb-copy-prev-btn" onClick={handleCopyFromPrev} title={`Copy from Scene ${prevSceneNumber}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Copy Sc {prevSceneNumber}
            </button>
          )}
          <span className="cb-billing-badge">{ordinal(char.billing)}</span>
          <button className="cb-remove-char-btn" onClick={() => setShowRemoveModal(true)} title="Remove character">×</button>
        </div>
      </div>

      <div className="cb-field">
        <label className="cb-label">Look</label>
        {showNewLookInput ? (
          <input
            ref={newLookInputRef}
            className="cb-select"
            type="text"
            placeholder="Type look name..."
            value={newLookName}
            onChange={(e) => setNewLookName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
              } else if (e.key === 'Escape') {
                setNewLookName('');
                setShowNewLookInput(false);
              }
            }}
            onBlur={() => {
              if (newLookName.trim()) {
                const newId = onAddLook(char.id, newLookName.trim());
                onUpdate({ lookId: newId });
              }
              setNewLookName('');
              setShowNewLookInput(false);
            }}
            autoFocus
          />
        ) : (
          <select className="cb-select" value={cb.lookId} onChange={(e) => {
            if (e.target.value === '__new') {
              setShowNewLookInput(true);
            } else {
              onUpdate({ lookId: e.target.value });
            }
          }}>
            <option value="">Select look...</option>
            {looks.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            <option value="__new">+ New Look</option>
          </select>
        )}
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

      <div className="cb-field">
        <FInput label="Environmental" value={cb.environmental || ''} onChange={(v) => onUpdate({ environmental: v })} />
        <TagPills tags={sceneTags.filter(t => t.categoryId === 'environmental')} color={catColor('environmental')} />
      </div>

      <div className="cb-field">
        <FInput label="Action" value={cb.action || ''} onChange={(v) => onUpdate({ action: v })} />
        <TagPills tags={sceneTags.filter(t => t.categoryId === 'action')} color={catColor('action')} />
      </div>

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

      {/* Expandable character profile section */}
      <div className="cb-profile-section">
        <button className="cb-profile-toggle" onClick={() => setShowProfile(!showProfile)}>
          <svg className={`cb-profile-chevron${showProfile ? ' cb-profile-chevron--open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          Character Profile
        </button>
        {showProfile && (
          <div className="cb-profile-grid">
            {profileFields.map(({ label, key }) => (
              <div key={key} className="cb-profile-field">
                <label className="cb-profile-label">{label}</label>
                <input
                  className="fi-input cb-profile-input"
                  value={resolvedChar[key] as string || ''}
                  onChange={(e) => charOverrides.updateCharacter(char.id, { [key]: e.target.value })}
                  placeholder={`Enter ${label.toLowerCase()}…`}
                />
              </div>
            ))}
            <div className="cb-profile-field cb-profile-field--wide">
              <label className="cb-profile-label">Notes</label>
              <textarea
                className="fi-input cb-profile-textarea"
                value={resolvedChar.notes || ''}
                onChange={(e) => charOverrides.updateCharacter(char.id, { notes: e.target.value })}
                placeholder="Enter notes…"
                rows={2}
              />
            </div>
          </div>
        )}
      </div>

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

      {/* Character removal modal */}
      {showRemoveModal && (
        <div className="cb-remove-overlay" onClick={() => setShowRemoveModal(false)}>
          <div className="cb-remove-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cb-remove-modal-title">Remove {char.name}</div>
            <button className="cb-remove-option" onClick={() => { onRemoveCharacter(char.id, 'not-in-scene'); setShowRemoveModal(false); }}>
              <strong>Not in this scene</strong>
              <span className="cb-remove-option-desc">Remove from this scene only</span>
            </button>
            <button className="cb-remove-option cb-remove-option--danger" onClick={() => { onRemoveCharacter(char.id, 'not-a-character'); setShowRemoveModal(false); }}>
              <strong>Not a character</strong>
              <span className="cb-remove-option-desc">Remove from the entire script breakdown</span>
            </button>
            <div className="cb-remove-option-group">
              <div className="cb-remove-option-label"><strong>Duplicate character</strong></div>
              <span className="cb-remove-option-desc">Merge into another character</span>
              <select className="cb-merge-select" value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)}>
                <option value="">Select character to merge into…</option>
                {mergeOptions.map((c) => <option key={c.id} value={c.id}>{c.name} ({ordinal(c.billing)})</option>)}
              </select>
              <button className="cb-merge-btn" disabled={!mergeTargetId}
                onClick={() => { onRemoveCharacter(char.id, 'duplicate', mergeTargetId); setShowRemoveModal(false); }}>
                Merge
              </button>
            </div>
            <button className="cb-remove-cancel" onClick={() => setShowRemoveModal(false)}>Cancel</button>
          </div>
        </div>
      )}
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

/* ━━━ CHANGES SUMMARY MODAL ━━━ */

function ChangesSummaryModal({
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

/* ━━━ PREVIOUS DRAFTS MODAL ━━━ */

interface ScriptDraft {
  id: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  scene_count: number | null;
  character_count: number | null;
  version_number: number;
  version_label: string | null;
  is_active: boolean;
  created_at: string;
}

function PreviousDraftsModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [drafts, setDrafts] = useState<ScriptDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewingPdf, setViewingPdf] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewingPdf) setViewingPdf(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, viewingPdf]);

  useEffect(() => {
    async function fetchDrafts() {
      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('script_uploads')
          .select('id, file_name, storage_path, file_size, scene_count, character_count, version_number, version_label, is_active, created_at')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setDrafts(data || []);
      } catch (err) {
        console.error('Failed to fetch drafts:', err);
        setError('Failed to load previous drafts.');
      } finally {
        setLoading(false);
      }
    }
    fetchDrafts();
  }, [projectId]);

  const handleViewPdf = async (draft: ScriptDraft) => {
    try {
      const { data, error: urlError } = await supabase.storage
        .from('project-documents')
        .createSignedUrl(draft.storage_path, 3600); // 1 hour expiry

      if (urlError) throw urlError;
      if (data?.signedUrl) {
        setViewingPdf({ url: data.signedUrl, name: draft.file_name });
      }
    } catch (err) {
      console.error('Failed to get PDF URL:', err);
      setError('Failed to load PDF. Please try again.');
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      + ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // PDF Viewer - full screen overlay
  if (viewingPdf) {
    return (
      <div className="modal-backdrop" style={{ zIndex: 10001 }} onClick={() => setViewingPdf(null)}>
        <div onClick={(e) => e.stopPropagation()} style={{
          width: '90vw', height: '90vh', maxWidth: 1000,
          background: 'var(--bg-primary, #1a1815)',
          borderRadius: 12, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setViewingPdf(null)} style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
                </svg>
              </button>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-heading)' }}>
                {viewingPdf.name}
              </span>
            </div>
            <button onClick={() => setViewingPdf(null)} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 4,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          {/* PDF iframe */}
          <div style={{ flex: 1, background: '#fff' }}>
            <iframe
              src={viewingPdf.url}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title={viewingPdf.name}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-glass" style={{ width: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '24px 28px 0',
        }}>
          <h2 style={{
            fontSize: '0.8125rem', letterSpacing: '0.1em',
            textTransform: 'uppercase' as const, color: 'var(--text-heading)', margin: 0,
          }}>
            <span className="heading-italic">Previous</span>{' '}
            <span className="heading-regular">Drafts</span>
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

        <div style={{ padding: '20px 28px 28px', overflowY: 'auto', flex: 1 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 0, marginBottom: 20 }}>
            View previously uploaded script drafts. Click on any draft to view the full PDF.
          </p>

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              Loading drafts...
            </div>
          )}

          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.8125rem' }}>{error}</p>
          )}

          {!loading && !error && drafts.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)',
              fontSize: '0.875rem',
            }}>
              No previous drafts found. Upload a script to get started.
            </div>
          )}

          {!loading && drafts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {drafts.map((draft) => (
                <button
                  key={draft.id}
                  onClick={() => handleViewPdf(draft)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px',
                    background: draft.is_active
                      ? 'rgba(212, 148, 58, 0.08)'
                      : 'var(--bg-secondary, rgba(255,255,255,0.03))',
                    border: draft.is_active
                      ? '1px solid rgba(212, 148, 58, 0.25)'
                      : '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                    borderRadius: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = draft.is_active
                      ? 'rgba(212, 148, 58, 0.12)'
                      : 'var(--bg-tertiary, rgba(255,255,255,0.06))';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = draft.is_active
                      ? 'rgba(212, 148, 58, 0.08)'
                      : 'var(--bg-secondary, rgba(255,255,255,0.03))';
                  }}
                >
                  {/* PDF Icon */}
                  <div style={{
                    width: 40, height: 48, borderRadius: 6,
                    background: 'rgba(232, 98, 26, 0.1)',
                    border: '1px solid rgba(232, 98, 26, 0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8621A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                      <path d="M14 2v6h6"/>
                    </svg>
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        color: 'var(--text-heading)', fontWeight: 500, fontSize: '0.875rem',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {draft.version_label || draft.file_name}
                      </span>
                      {draft.is_active && (
                        <span style={{
                          fontSize: '0.6875rem', fontWeight: 600,
                          color: '#D4943A',
                          background: 'rgba(212, 148, 58, 0.15)',
                          padding: '1px 8px', borderRadius: 4,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          Current
                        </span>
                      )}
                    </div>
                    <div style={{
                      color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 3,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span>{formatDate(draft.created_at)}</span>
                      {draft.file_size && <span>·</span>}
                      {draft.file_size && <span>{formatSize(draft.file_size)}</span>}
                      {draft.scene_count && <span>·</span>}
                      {draft.scene_count && <span>{draft.scene_count} scenes</span>}
                    </div>
                  </div>

                  {/* Arrow */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
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

