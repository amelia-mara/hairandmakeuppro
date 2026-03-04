import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MOCK_SCENES, MOCK_CHARACTERS, MOCK_LOOKS, BREAKDOWN_CATEGORIES,
  useBreakdownStore,
  type Scene, type Character, type Look, type CharacterBreakdown, type HMWEntry, type SceneBreakdown,
} from '@/stores/breakdownStore';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SCRIPT BREAKDOWN PAGE
   Three-panel layout: Scene List | Script/Character | Breakdown Form
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface Props { projectId: string }

export function ScriptBreakdown({ projectId: _projectId }: Props) {
  const [selectedSceneId, setSelectedSceneId] = useState('s1');
  const [activeTab, setActiveTab] = useState<string>('script'); // 'script' | character id
  const [searchQuery, setSearchQuery] = useState('');
  const [fontSize, setFontSize] = useState(13);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('prep-scene-list-collapsed') === 'true'; }
    catch { return false; }
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const store = useBreakdownStore();
  const scene = MOCK_SCENES.find((s) => s.id === selectedSceneId)!;
  const sceneCharacters = scene.characterIds.map((id) => MOCK_CHARACTERS.find((c) => c.id === id)!);
  const breakdown = store.getBreakdown(selectedSceneId);

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem('prep-scene-list-collapsed', String(collapsed));
  }, [collapsed]);

  // Ensure breakdown exists for selected scene
  useEffect(() => {
    if (!store.getBreakdown(selectedSceneId)) {
      const scene = MOCK_SCENES.find((s) => s.id === selectedSceneId)!;
      store.setBreakdown(selectedSceneId, {
        sceneId: selectedSceneId,
        timeline: { day: '', time: '', type: '', note: '' },
        characters: scene.characterIds.map((cid) => ({
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

  // Auto-save with debounce
  const triggerSave = useCallback(() => {
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saved');
      statusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  }, []);

  // Filtered scenes
  const filteredScenes = MOCK_SCENES.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.location.toLowerCase().includes(q) || String(s.number).includes(q);
  });

  // Select scene handler
  const selectScene = useCallback((id: string) => {
    setSelectedSceneId(id);
    setActiveTab('script');
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const idx = filteredScenes.findIndex((s) => s.id === selectedSceneId);
      if ((e.key === 'ArrowDown' || e.key === 'j') && idx < filteredScenes.length - 1) {
        e.preventDefault();
        selectScene(filteredScenes[idx + 1].id);
      } else if ((e.key === 'ArrowUp' || e.key === 'k') && idx > 0) {
        e.preventDefault();
        selectScene(filteredScenes[idx - 1].id);
      } else if (e.key === 'n') {
        const next = filteredScenes.find((s, i) => i > idx &&
          store.getCompletionStatus(s.id, s) !== 'complete');
        if (next) selectScene(next.id);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setCollapsed((c) => !c);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        triggerSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filteredScenes, selectedSceneId, selectScene, store, triggerSave]);

  return (
    <div className="breakdown-page">
      {/* ━━━ Header ━━━ */}
      <div className="breakdown-header">
        <div className="breakdown-header-top">
          <h2 className="breakdown-title">Script Breakdown</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-ghost breakdown-btn" onClick={() => console.log('Tools clicked')}>
              <ToolsIcon /> Tools
            </button>
            <button className="btn-gold breakdown-btn" onClick={() => console.log('Import Script clicked')}>
              <ImportIcon /> Import Script
            </button>
          </div>
        </div>
        {/* Tag legend + zoom */}
        <div className="breakdown-legend-bar">
          <div className="breakdown-tags">
            {BREAKDOWN_CATEGORIES.map((cat) => (
              <span key={cat.id} className="breakdown-tag" style={{
                background: `${cat.color}18`,
                border: `1px solid ${cat.color}40`,
                color: cat.color,
              }}>
                <span className="breakdown-tag-dot" style={{ background: cat.color }} />
                {cat.label}
              </span>
            ))}
          </div>
          <div className="breakdown-zoom">
            <button className="btn-ghost breakdown-zoom-btn" onClick={() => setFontSize((s) => Math.max(10, s - 1))}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M8 11h6"/></svg>
            </button>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', minWidth: '32px', textAlign: 'center' }}>{fontSize}px</span>
            <button className="btn-ghost breakdown-zoom-btn" onClick={() => setFontSize((s) => Math.min(24, s + 1))}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M8 11h6M11 8v6"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* ━━━ Three panels ━━━ */}
      <div className="breakdown-panels">
        {/* Left — Scene List */}
        <div className={`breakdown-panel-left ${collapsed ? 'collapsed' : ''}`}>
          {!collapsed && (
            <SceneListPanel
              scenes={filteredScenes}
              selectedId={selectedSceneId}
              onSelect={selectScene}
              searchQuery={searchQuery}
              onSearch={setSearchQuery}
              getStatus={(s) => store.getCompletionStatus(s.id, s)}
            />
          )}
          <button
            className="panel-collapse-toggle"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand scene list' : 'Collapse scene list'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {collapsed
                ? <path d="M9 18l6-6-6-6"/>
                : <path d="M15 18l-6-6 6-6"/>}
            </svg>
          </button>
        </div>

        {/* Center — Script / Character */}
        <div className="breakdown-panel-center">
          <CenterPanel
            scene={scene}
            characters={sceneCharacters}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            fontSize={fontSize}
          />
        </div>

        {/* Right — Breakdown Form */}
        <div className="breakdown-panel-right">
          <BreakdownFormPanel
            scene={scene}
            characters={sceneCharacters}
            breakdown={breakdown}
            activeCharacterId={activeTab !== 'script' ? activeTab : null}
            saveStatus={saveStatus}
            onUpdate={(charId, data) => {
              store.updateCharacterBreakdown(selectedSceneId, charId, data);
              triggerSave();
            }}
            onUpdateTimeline={(tl) => {
              store.updateTimeline(selectedSceneId, tl);
              triggerSave();
            }}
            onAddEvent={(evt) => {
              store.addContinuityEvent(selectedSceneId, evt);
              triggerSave();
            }}
            onRemoveEvent={(id) => {
              store.removeContinuityEvent(selectedSceneId, id);
              triggerSave();
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SCENE LIST PANEL (Left)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function SceneListPanel({ scenes, selectedId, onSelect, searchQuery, onSearch, getStatus }: {
  scenes: Scene[];
  selectedId: string;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearch: (q: string) => void;
  getStatus: (s: Scene) => 'empty' | 'partial' | 'complete';
}) {
  const selectedScene = scenes.find((s) => s.id === selectedId);

  return (
    <div className="scene-list-content">
      {/* Search */}
      <div style={{ padding: '12px 12px 8px' }}>
        <div className="scene-search-wrapper">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            className="scene-search-input"
            placeholder="Search scenes..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Scene list */}
      <div className="scene-list-scroll">
        {scenes.map((s) => {
          const status = getStatus(s);
          const charCount = s.characterIds.length;
          return (
            <button
              key={s.id}
              className={`scene-list-item ${s.id === selectedId ? 'active' : ''}`}
              onClick={() => onSelect(s.id)}
            >
              <div className="scene-item-top">
                <span className="scene-number">Sc {s.number}</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <span className={`scene-badge ${s.intExt === 'INT' ? 'badge-int' : 'badge-ext'}`}>
                    {s.intExt}
                  </span>
                  <span className={`scene-badge ${s.dayNight === 'NIGHT' || s.dayNight === 'DUSK' ? 'badge-night' : 'badge-day'}`}>
                    {s.dayNight}
                  </span>
                </div>
              </div>
              <div className="scene-item-location">{s.location}</div>
              <div className="scene-item-meta">
                <span>{s.storyDay} · {s.timeInfo}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  </svg>
                  {charCount}
                </span>
              </div>
              <div className="scene-item-status">
                <span className={`completion-dot completion-${status}`} />
                <span className="completion-label">{status === 'complete' ? 'Complete' : status === 'partial' ? 'In Progress' : 'Not Started'}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Synopsis */}
      {selectedScene && (
        <div className="scene-synopsis-section">
          <div className="synopsis-header">
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Synopsis
            </span>
            <button className="btn-ghost synopsis-generate-btn" onClick={() => console.log('Generate synopsis AI')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
              Generate
            </button>
          </div>
          <p className="synopsis-text">
            {selectedScene.synopsis || 'No synopsis available.'}
          </p>
        </div>
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CENTER PANEL (Script / Character tabs)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function CenterPanel({ scene, characters, activeTab, onTabChange, fontSize }: {
  scene: Scene;
  characters: Character[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  fontSize: number;
}) {
  const [charSubTab, setCharSubTab] = useState<'profile' | 'lookbook' | 'timeline' | 'events'>('profile');
  const activeCharacter = characters.find((c) => c.id === activeTab);

  // Reset sub-tab when switching characters
  useEffect(() => { setCharSubTab('profile'); }, [activeTab]);

  return (
    <div className="center-panel-inner">
      {/* Tab bar */}
      <div className="center-tab-bar">
        <button
          className={`center-tab ${activeTab === 'script' ? 'active' : ''}`}
          onClick={() => onTabChange('script')}
        >
          Script
        </button>
        {characters.map((c) => (
          <button
            key={c.id}
            className={`center-tab ${activeTab === c.id ? 'active' : ''}`}
            onClick={() => onTabChange(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="center-panel-content">
        {activeTab === 'script' ? (
          <ScriptView scene={scene} fontSize={fontSize} onCharacterClick={onTabChange} />
        ) : activeCharacter ? (
          <CharacterView
            character={activeCharacter}
            charSubTab={charSubTab}
            onSubTabChange={setCharSubTab}
            allScenes={MOCK_SCENES}
          />
        ) : null}
      </div>
    </div>
  );
}

/* ━━━ Script View ━━━ */

function ScriptView({ scene, fontSize, onCharacterClick }: {
  scene: Scene;
  fontSize: number;
  onCharacterClick: (charId: string) => void;
}) {
  // Highlight character cue lines (ALL CAPS names at start of line after whitespace)
  const charNames = MOCK_CHARACTERS.map((c) => c.name);

  const renderLine = (line: string, i: number) => {
    const trimmed = line.trim();
    // Check if this line is a character cue
    const matchedChar = charNames.find((name) => {
      const cueName = trimmed.replace(/\s*\(.*\)$/, '').replace(/\s*\(CONT'D\)$/, '');
      return cueName === name;
    });
    if (matchedChar) {
      const char = MOCK_CHARACTERS.find((c) => c.name === matchedChar)!;
      return (
        <div key={i} className="script-line script-character-cue" onClick={() => onCharacterClick(char.id)}>
          {line}
        </div>
      );
    }
    return <div key={i} className="script-line">{line || '\u00A0'}</div>;
  };

  return (
    <div className="script-view" style={{ fontSize: `${fontSize}px` }}>
      <div className="script-scene-heading">
        {scene.intExt}. {scene.location} - {scene.dayNight}
      </div>
      {scene.scriptContent.split('\n').map(renderLine)}
    </div>
  );
}

/* ━━━ Character View ━━━ */

function CharacterView({ character, charSubTab, onSubTabChange, allScenes }: {
  character: Character;
  charSubTab: 'profile' | 'lookbook' | 'timeline' | 'events';
  onSubTabChange: (tab: 'profile' | 'lookbook' | 'timeline' | 'events') => void;
  allScenes: Scene[];
}) {
  const characterLooks = MOCK_LOOKS.filter((l) => l.characterId === character.id);
  const characterScenes = allScenes.filter((s) => s.characterIds.includes(character.id));

  const subTabs: { id: 'profile' | 'lookbook' | 'timeline' | 'events'; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'lookbook', label: 'Lookbook' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'events', label: 'Events' },
  ];

  return (
    <div className="character-view">
      {/* Character header */}
      <div className="char-view-header">
        <div className="char-avatar-large">{character.name.split(' ').map((n) => n[0]).join('')}</div>
        <div>
          <div className="char-view-name">{character.name}</div>
          <div className="char-view-billing">{ordinal(character.billing)} Billing · {character.gender} · {character.age}</div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="char-sub-tabs">
        {subTabs.map((t) => (
          <button key={t.id} className={`char-sub-tab ${charSubTab === t.id ? 'active' : ''}`}
            onClick={() => onSubTabChange(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div className="char-sub-content">
        {charSubTab === 'profile' && (
          <div className="char-profile-grid">
            {([
              ['Age', character.age], ['Gender', character.gender],
              ['Hair Colour', character.hairColour], ['Hair Type', character.hairType],
              ['Eye Colour', character.eyeColour], ['Skin Tone', character.skinTone],
              ['Build', character.build], ['Distinguishing Features', character.distinguishingFeatures],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="char-profile-field">
                <div className="char-field-label">{label}</div>
                <div className="char-field-value">{value || '—'}</div>
              </div>
            ))}
            <div className="char-profile-field" style={{ gridColumn: '1 / -1' }}>
              <div className="char-field-label">Notes</div>
              <div className="char-field-value">{character.notes || '—'}</div>
            </div>
          </div>
        )}

        {charSubTab === 'lookbook' && (
          <div className="char-lookbook">
            {characterLooks.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No looks created yet.</p>
            ) : characterLooks.map((look) => (
              <div key={look.id} className="look-card">
                <div className="look-card-header">
                  <span className="look-name">{look.name}</span>
                  <span className="look-desc">{look.description}</span>
                </div>
                <div className="look-card-body">
                  <div className="look-field"><span className="look-field-label">Hair</span><span>{look.hair}</span></div>
                  <div className="look-field"><span className="look-field-label">Makeup</span><span>{look.makeup}</span></div>
                  <div className="look-field"><span className="look-field-label">Wardrobe</span><span>{look.wardrobe}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {charSubTab === 'timeline' && (
          <div className="char-timeline">
            {characterScenes.map((s) => (
              <div key={s.id} className="timeline-item">
                <div className="timeline-scene-num">Sc {s.number}</div>
                <div className="timeline-scene-info">
                  <span className="timeline-location">{s.intExt}. {s.location}</span>
                  <span className="timeline-meta">{s.storyDay} · {s.dayNight}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {charSubTab === 'events' && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            No continuity events for this character.
          </div>
        )}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BREAKDOWN FORM PANEL (Right)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function BreakdownFormPanel({ scene, characters, breakdown, activeCharacterId, saveStatus, onUpdate, onUpdateTimeline, onAddEvent, onRemoveEvent }: {
  scene: Scene;
  characters: Character[];
  breakdown: SceneBreakdown | undefined;
  activeCharacterId: string | null;
  saveStatus: 'idle' | 'saving' | 'saved';
  onUpdate: (charId: string, data: Partial<CharacterBreakdown>) => void;
  onUpdateTimeline: (tl: SceneBreakdown['timeline']) => void;
  onAddEvent: (evt: { id: string; type: string; characterId: string; description: string; sceneRange: string }) => void;
  onRemoveEvent: (id: string) => void;
}) {
  if (!breakdown) return null;

  return (
    <div className="form-panel-inner">
      {/* Form header */}
      <div className="form-panel-header">
        <div>
          <span className="form-scene-label">Scene {scene.number}</span>
          <span className="form-scene-heading">{scene.intExt}. {scene.location} - {scene.dayNight}</span>
        </div>
        <span className={`save-indicator ${saveStatus}`}>
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : ''}
        </span>
      </div>

      <div className="form-panel-scroll">
        {/* Timeline row */}
        <div className="form-section">
          <div className="form-section-title">Timeline</div>
          <div className="form-timeline-row">
            <FormSelect label="Day" value={breakdown.timeline.day}
              options={['', 'Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7', 'Day 8', 'Day 9', 'Day 10']}
              onChange={(v) => onUpdateTimeline({ ...breakdown.timeline, day: v })} />
            <FormSelect label="Time" value={breakdown.timeline.time}
              options={['', 'Day', 'Night', 'Dawn', 'Dusk']}
              onChange={(v) => onUpdateTimeline({ ...breakdown.timeline, time: v })} />
            <FormSelect label="Type" value={breakdown.timeline.type}
              options={['', 'Normal', 'VFX', 'SFX']}
              onChange={(v) => onUpdateTimeline({ ...breakdown.timeline, type: v })} />
            <FormInput label="Note" value={breakdown.timeline.note}
              onChange={(v) => onUpdateTimeline({ ...breakdown.timeline, note: v })} />
          </div>
        </div>

        {/* Characters in scene */}
        <div className="form-section">
          <div className="form-section-title">Characters in Scene</div>
          {characters.map((char) => {
            const cb = breakdown.characters.find((c) => c.characterId === char.id);
            if (!cb) return null;
            const isHighlighted = activeCharacterId === char.id;
            const charLooks = MOCK_LOOKS.filter((l) => l.characterId === char.id);
            return (
              <CharacterFormBlock
                key={char.id}
                character={char}
                breakdown={cb}
                looks={charLooks}
                highlighted={isHighlighted}
                onUpdate={(data) => onUpdate(char.id, data)}
              />
            );
          })}
        </div>

        {/* Continuity Events */}
        <div className="form-section">
          <div className="form-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Continuity Events</span>
            <button className="btn-ghost" style={{ fontSize: '0.6875rem', padding: '4px 10px' }}
              onClick={() => onAddEvent({
                id: `ce-${Date.now()}`,
                type: 'Continuity',
                characterId: characters[0]?.id || '',
                description: '',
                sceneRange: `${scene.number}-${scene.number}`,
              })}>
              + Add Event
            </button>
          </div>
          {breakdown.continuityEvents.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '8px 0' }}>No events flagged for this scene.</p>
          ) : breakdown.continuityEvents.map((evt) => (
            <div key={evt.id} className="continuity-event-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="event-type-badge">{evt.type}</span>
                <button className="btn-ghost" style={{ fontSize: '0.625rem', padding: '2px 8px', color: 'var(--status-error)' }}
                  onClick={() => onRemoveEvent(evt.id)}>Remove</button>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {MOCK_CHARACTERS.find((c) => c.id === evt.characterId)?.name || 'Unknown'} · Scenes {evt.sceneRange}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {evt.description || 'No description'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ━━━ Character Form Block ━━━ */

function CharacterFormBlock({ character, breakdown: cb, looks, highlighted, onUpdate }: {
  character: Character;
  breakdown: CharacterBreakdown;
  looks: Look[];
  highlighted: boolean;
  onUpdate: (data: Partial<CharacterBreakdown>) => void;
}) {
  const updateEntry = (field: 'entersWith' | 'exitsWith', key: keyof HMWEntry, value: string) => {
    onUpdate({ [field]: { ...cb[field], [key]: value } });
  };

  return (
    <div className={`char-form-block ${highlighted ? 'highlighted' : ''}`}>
      <div className="char-form-header">
        <div>
          <span className="char-form-name">{character.name}</span>
          <span className="char-form-billing">{ordinal(character.billing)} Billing</span>
        </div>
      </div>

      {/* Look selector */}
      <div className="form-field-group">
        <label className="form-label">Look</label>
        <select className="form-select" value={cb.lookId}
          onChange={(e) => onUpdate({ lookId: e.target.value })}>
          <option value="">Select a look...</option>
          {looks.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          <option value="__new">+ Create New Look</option>
        </select>
      </div>

      {/* Enters With */}
      <div className="form-field-group">
        <label className="form-label">Enters With</label>
        <div className="hmw-fields">
          <FormInput label="Hair" value={cb.entersWith.hair} onChange={(v) => updateEntry('entersWith', 'hair', v)} />
          <FormInput label="Makeup" value={cb.entersWith.makeup} onChange={(v) => updateEntry('entersWith', 'makeup', v)} />
          <FormInput label="Wardrobe" value={cb.entersWith.wardrobe} onChange={(v) => updateEntry('entersWith', 'wardrobe', v)} />
        </div>
      </div>

      {/* SFX / Prosthetics */}
      <div className="form-field-group">
        <FormInput label="SFX / Prosthetics" value={cb.sfx} onChange={(v) => onUpdate({ sfx: v })} />
      </div>

      {/* Changes */}
      <div className="form-field-group">
        <label className="form-label">Changes</label>
        <div className="change-toggle">
          <button className={`change-opt ${cb.changeType === 'no-change' ? 'active' : ''}`}
            onClick={() => onUpdate({ changeType: 'no-change', changeNotes: '' })}>No Change</button>
          <button className={`change-opt ${cb.changeType === 'change' ? 'active' : ''}`}
            onClick={() => onUpdate({ changeType: 'change' })}>Change</button>
        </div>
        {cb.changeType === 'change' && (
          <textarea className="form-textarea" placeholder="Describe the change..." value={cb.changeNotes}
            onChange={(e) => onUpdate({ changeNotes: e.target.value })} rows={2} />
        )}
      </div>

      {/* Exits With */}
      <div className="form-field-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label className="form-label">Exits With</label>
          <button className="btn-ghost" style={{ fontSize: '0.625rem', padding: '2px 8px' }}
            onClick={() => onUpdate({ exitsWith: { ...cb.entersWith } })}>Same as entry</button>
        </div>
        <div className="hmw-fields">
          <FormInput label="Hair" value={cb.exitsWith.hair} onChange={(v) => updateEntry('exitsWith', 'hair', v)} />
          <FormInput label="Makeup" value={cb.exitsWith.makeup} onChange={(v) => updateEntry('exitsWith', 'makeup', v)} />
          <FormInput label="Wardrobe" value={cb.exitsWith.wardrobe} onChange={(v) => updateEntry('exitsWith', 'wardrobe', v)} />
        </div>
      </div>

      {/* Notes */}
      <div className="form-field-group">
        <FormInput label="Notes" value={cb.notes} onChange={(v) => onUpdate({ notes: v })} />
      </div>
    </div>
  );
}

/* ━━━ Shared form primitives ━━━ */

function FormInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="form-input-wrap">
      <label className="form-input-label">{label}</label>
      <input className="form-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function FormSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="form-input-wrap">
      <label className="form-input-label">{label}</label>
      <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
    </div>
  );
}

/* ━━━ Helpers ━━━ */

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* ━━━ Icons ━━━ */

function ToolsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}
