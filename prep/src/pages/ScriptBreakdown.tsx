import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MOCK_SCENES, MOCK_CHARACTERS, MOCK_LOOKS, BREAKDOWN_CATEGORIES,
  useBreakdownStore,
  type Scene, type Character, type CharacterBreakdown, type HMWEntry, type SceneBreakdown,
} from '@/stores/breakdownStore';

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

const LEFT_DEFAULT = 300;
const LEFT_MIN = 200;
const LEFT_MAX = 440;
const RIGHT_DEFAULT = 400;
const RIGHT_MIN = 300;
const RIGHT_MAX = 560;

export function ScriptBreakdown({ projectId: _projectId }: Props) {
  const [selectedSceneId, setSelectedSceneId] = useState('s1');
  const [activeTab, setActiveTab] = useState<string>('script');
  const [searchQuery, setSearchQuery] = useState('');
  const [fontSize, setFontSize] = useState(13);

  const leftPanel = usePanelResize('prep-left-panel-w', LEFT_DEFAULT, LEFT_MIN, LEFT_MAX, 'left');
  const rightPanel = usePanelResize('prep-right-panel-w', RIGHT_DEFAULT, RIGHT_MIN, RIGHT_MAX, 'right');

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const store = useBreakdownStore();
  const scene = MOCK_SCENES.find((s) => s.id === selectedSceneId)!;
  const sceneCharacters = scene.characterIds.map((id) => MOCK_CHARACTERS.find((c) => c.id === id)!);
  const breakdown = store.getBreakdown(selectedSceneId);

  useEffect(() => {
    if (!store.getBreakdown(selectedSceneId)) {
      const sc = MOCK_SCENES.find((s) => s.id === selectedSceneId)!;
      store.setBreakdown(selectedSceneId, {
        sceneId: selectedSceneId,
        timeline: { day: '', time: '', type: '', note: '' },
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
        <div className="bd-left bd-panel-surface" style={{ width: leftPanel.width, minWidth: leftPanel.width }}>
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
                  {isActive && s.synopsis && (
                    <div className="sl-card-synopsis">
                      <div className="sl-card-synopsis-head">
                        <span>Synopsis</span>
                        <button className="sl-generate-btn" onClick={(e) => { e.stopPropagation(); console.log('AI generate'); }}>Generate AI</button>
                      </div>
                      <p className="sl-card-synopsis-text">{s.synopsis}</p>
                    </div>
                  )}
                  {isActive && s.characterIds.length > 0 && (
                    <div className="sl-card-chars">
                      {s.characterIds.map((cid) => {
                        const ch = MOCK_CHARACTERS.find((c) => c.id === cid);
                        return ch ? <span key={cid} className="sl-card-char-tag">{ch.name.split(' ')[0]}</span> : null;
                      })}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Left divider */}
        <div className="bd-divider" onMouseDown={leftPanel.onMouseDown} onDoubleClick={leftPanel.onDoubleClick}>
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
          {/* Legend & zoom bar — separate row below tabs */}
          <div className="cp-toolbar">
            <div className="bd-legend-tags">
              {BREAKDOWN_CATEGORIES.map((cat) => (
                <span key={cat.id} className="bd-legend-tag">
                  <span className="bd-legend-swatch" style={{ background: cat.color }} />
                  {cat.label}
                </span>
              ))}
            </div>
            <div className="bd-zoom">
              <button className="bd-zoom-btn" onClick={() => setFontSize((s) => Math.max(10, s - 1))}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/></svg>
              </button>
              <span className="bd-zoom-label">{fontSize}</span>
              <button className="bd-zoom-btn" onClick={() => setFontSize((s) => Math.min(22, s + 1))}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>
          </div>
          {/* Content body — connects to active tab */}
          <div className="cp-body">
            {activeTab === 'script' ? (
              <ScriptView
                scenes={MOCK_SCENES}
                selectedSceneId={selectedSceneId}
                onSceneVisible={onSceneVisible}
                fontSize={fontSize}
                onCharClick={setActiveTab}
              />
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
            <div className="fp-panel-actions">
              <button className="btn-ghost bd-btn" onClick={() => console.log('Tools')}>
                <ToolsIcon /> Tools
              </button>
              <button className="btn-gold bd-btn" onClick={() => console.log('Import')}>
                <ImportIcon /> Import Script
              </button>
            </div>
          </div>
          <BreakdownFormPanel
            scene={scene} characters={sceneCharacters} breakdown={breakdown}
            activeCharacterId={activeTab !== 'script' ? activeTab : null}
            saveStatus={saveStatus}
            onUpdate={(cid, data) => { store.updateCharacterBreakdown(selectedSceneId, cid, data); triggerSave(); }}
            onUpdateTimeline={(tl) => { store.updateTimeline(selectedSceneId, tl); triggerSave(); }}
            onAddEvent={(evt) => { store.addContinuityEvent(selectedSceneId, evt); triggerSave(); }}
            onRemoveEvent={(id) => { store.removeContinuityEvent(selectedSceneId, id); triggerSave(); }}
          />
        </div>
      </div>
    </div>
  );
}

/* ━━━ SCRIPT VIEW — continuous scroll, all scenes ━━━ */

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

  const renderLine = (line: string, i: number, sceneId: string) => {
    const trimmed = line.trim();
    const matched = charNames.find((name) => {
      const cue = trimmed.replace(/\s*\(.*\)$/, '').replace(/\s*\(CONT'D\)$/, '');
      return cue === name;
    });
    if (matched) {
      const ch = MOCK_CHARACTERS.find((c) => c.name === matched)!;
      return <div key={`${sceneId}-${i}`} className="sv-line sv-cue" onClick={() => onCharClick(ch.id)}>{line}</div>;
    }
    return <div key={`${sceneId}-${i}`} className="sv-line">{line || '\u00A0'}</div>;
  };

  /* Scroll to scene when selected from the scene list */
  useEffect(() => {
    const el = pageRefs.current.get(selectedSceneId);
    if (el && scrollRef.current) {
      isScrollingTo.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      /* Reset the flag after scroll animation completes */
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
        /* Find the entry with the largest visible ratio */
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

  return (
    <div className="sv-scroll" ref={scrollRef}>
      {scenes.map((scene) => (
        <div
          key={scene.id}
          ref={(el) => setPageRef(scene.id, el)}
          data-scene-id={scene.id}
          className={`sv-paper ${scene.id === selectedSceneId ? 'sv-paper--active' : ''}`}
          style={{ fontSize: `${fontSize}px` }}
        >
          <div className="sv-scene-badge">Scene {scene.number}</div>
          <div className="sv-heading">{scene.number} {scene.intExt}. {scene.location} — {scene.dayNight}</div>
          {scene.scriptContent.split('\n').map((line, i) => renderLine(line, i, scene.id))}
        </div>
      ))}
    </div>
  );
}

/* ━━━ CHARACTER VIEW ━━━ */

function CharacterView({ char }: { char: Character; subTab: string }) {
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'lookbook' | 'timeline' | 'events'>('profile');
  const looks = MOCK_LOOKS.filter((l) => l.characterId === char.id);
  const scenes = MOCK_SCENES.filter((s) => s.characterIds.includes(char.id));

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
        {(['profile', 'lookbook', 'timeline', 'events'] as const).map((t) => (
          <button key={t} className={`cv-subtab ${activeSubTab === t ? 'cv-subtab--active' : ''}`}
            onClick={() => setActiveSubTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
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
      </div>
    </div>
  );
}

/* ━━━ BREAKDOWN FORM PANEL ━━━ */

function BreakdownFormPanel({ scene, characters, breakdown, activeCharacterId, saveStatus, onUpdate, onUpdateTimeline, onAddEvent, onRemoveEvent }: {
  scene: Scene; characters: Character[]; breakdown: SceneBreakdown | undefined;
  activeCharacterId: string | null; saveStatus: 'idle' | 'saving' | 'saved';
  onUpdate: (cid: string, d: Partial<CharacterBreakdown>) => void;
  onUpdateTimeline: (t: SceneBreakdown['timeline']) => void;
  onAddEvent: (e: { id: string; type: string; characterId: string; description: string; sceneRange: string }) => void;
  onRemoveEvent: (id: string) => void;
}) {
  if (!breakdown) return null;

  return (
    <div className="fp-wrap">
      {/* Scene info */}
      <div className="fp-header">
        <div className="fp-scene-info">
          <span className="fp-scene-num">Scene {scene.number}</span>
          <span className="fp-scene-loc">{scene.number} {scene.intExt}. {scene.location} — {scene.dayNight}</span>
        </div>
        <span className={`fp-save fp-save--${saveStatus}`}>
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : ''}
        </span>
      </div>

      <div className="fp-scroll">
        {/* Timeline */}
        <div className="fp-section">
          <div className="fp-section-title">Timeline</div>
          <div className="fp-row-4">
            <FSelect label="Day" value={breakdown.timeline.day}
              options={['', 'Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7', 'Day 8', 'Day 9', 'Day 10']}
              onChange={(v) => onUpdateTimeline({ ...breakdown.timeline, day: v })} />
            <FSelect label="Time" value={breakdown.timeline.time}
              options={['', 'Day', 'Night', 'Dawn', 'Dusk']}
              onChange={(v) => onUpdateTimeline({ ...breakdown.timeline, time: v })} />
            <FSelect label="Type" value={breakdown.timeline.type}
              options={['', 'Normal', 'VFX', 'SFX']}
              onChange={(v) => onUpdateTimeline({ ...breakdown.timeline, type: v })} />
            <FInput label="Note" value={breakdown.timeline.note} placeholder="e.g. 3 weeks later"
              onChange={(v) => onUpdateTimeline({ ...breakdown.timeline, note: v })} />
          </div>
        </div>

        {/* Characters in Scene */}
        <div className="fp-section">
          <div className="fp-section-title">
            Characters in Scene
            <span className="fp-section-count">{characters.length}</span>
          </div>
          {characters.map((ch) => {
            const cb = breakdown.characters.find((c) => c.characterId === ch.id);
            if (!cb) return null;
            return (
              <CharBlock key={ch.id} char={ch} cb={cb}
                looks={MOCK_LOOKS.filter((l) => l.characterId === ch.id)}
                highlighted={activeCharacterId === ch.id}
                onUpdate={(d) => onUpdate(ch.id, d)} />
            );
          })}
        </div>

        {/* Continuity Events */}
        <div className="fp-section">
          <div className="fp-section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Continuity Events</span>
            <button className="fp-add-btn" onClick={() => onAddEvent({
              id: `ce-${Date.now()}`, type: 'Continuity', characterId: characters[0]?.id || '',
              description: '', sceneRange: `${scene.number}-${scene.number}`,
            })}>+ Add</button>
          </div>
          {breakdown.continuityEvents.length === 0 ? (
            <p className="fp-empty">No events flagged.</p>
          ) : breakdown.continuityEvents.map((evt) => (
            <div key={evt.id} className="fp-event">
              <div className="fp-event-top">
                <span className="fp-event-badge">{evt.type}</span>
                <button className="fp-remove-btn" onClick={() => onRemoveEvent(evt.id)}>Remove</button>
              </div>
              <div className="fp-event-detail">
                {MOCK_CHARACTERS.find((c) => c.id === evt.characterId)?.name || 'Unknown'} · Scenes {evt.sceneRange}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ━━━ CHARACTER FORM BLOCK ━━━ */

function CharBlock({ char, cb, looks, highlighted, onUpdate }: {
  char: Character; cb: CharacterBreakdown; looks: { id: string; name: string }[];
  highlighted: boolean; onUpdate: (d: Partial<CharacterBreakdown>) => void;
}) {
  const ue = (f: 'entersWith' | 'exitsWith', k: keyof HMWEntry, v: string) =>
    onUpdate({ [f]: { ...cb[f], [k]: v } });

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

      <div className="cb-field">
        <label className="cb-label">Enters With</label>
        <div className="cb-hmw">
          <FInput label="Hair" value={cb.entersWith.hair} onChange={(v) => ue('entersWith', 'hair', v)} />
          <FInput label="Makeup" value={cb.entersWith.makeup} onChange={(v) => ue('entersWith', 'makeup', v)} />
          <FInput label="Wardrobe" value={cb.entersWith.wardrobe} onChange={(v) => ue('entersWith', 'wardrobe', v)} />
        </div>
      </div>

      <FInput label="SFX / Prosthetics" value={cb.sfx} onChange={(v) => onUpdate({ sfx: v })} />

      <div className="cb-field">
        <label className="cb-label">Changes</label>
        <div className="cb-toggle">
          <button className={`cb-tog-opt ${cb.changeType === 'no-change' ? 'cb-tog-opt--on' : ''}`}
            onClick={() => onUpdate({ changeType: 'no-change', changeNotes: '' })}>No Change</button>
          <button className={`cb-tog-opt ${cb.changeType === 'change' ? 'cb-tog-opt--on' : ''}`}
            onClick={() => onUpdate({ changeType: 'change' })}>Change</button>
        </div>
        {cb.changeType === 'change' && (
          <textarea className="cb-textarea" placeholder="Describe change..." value={cb.changeNotes}
            onChange={(e) => onUpdate({ changeNotes: e.target.value })} rows={2} />
        )}
      </div>

      <div className="cb-field">
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

      <FInput label="Notes" value={cb.notes} onChange={(v) => onUpdate({ notes: v })} />
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
