import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  MOCK_SCENES, MOCK_CHARACTERS, MOCK_LOOKS, CONTINUITY_EVENT_TYPES, STAGE_SUGGESTIONS,
  useBreakdownStore, useContinuityTrackerStore, useContinuityPhotosStore,
  useParsedScriptStore, useCharacterOverridesStore,
  type Scene, type Character, type Look,
  type ContinuityEvent, type ProgressionStage, type ContinuityFlags,
  type PhotoAngle, type ContinuityPhoto,
  emptyHMW,
} from '@/stores/breakdownStore';
import { useProjectStore } from '@/stores/projectStore';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HELPERS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

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

const FLAG_LABELS: { key: keyof ContinuityFlags; label: string; icon: string }[] = [
  { key: 'sweat', label: 'Sweat', icon: '💧' },
  { key: 'dishevelled', label: 'Dishevelled', icon: '💨' },
  { key: 'blood', label: 'Blood', icon: '🩸' },
  { key: 'dirt', label: 'Dirt', icon: '🟤' },
  { key: 'wetHair', label: 'Wet Hair', icon: '🌊' },
  { key: 'tears', label: 'Tears', icon: '😢' },
];

const LEFT_WIDTH = 280;

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MAIN COMPONENT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface Props { projectId: string }

export function ContinuityTracker({ projectId }: Props) {
  const [selectedSceneId, setSelectedSceneId] = useState('s1');
  const [activeCharId, setActiveCharId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [addEventOpen, setAddEventOpen] = useState(false);

  const sceneListRef = useRef<HTMLDivElement>(null);
  const angleInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const masterRefInputRef = useRef<HTMLInputElement | null>(null);
  const additionalInputRef = useRef<HTMLInputElement | null>(null);

  const breakdownStore = useBreakdownStore();
  const continuityStore = useContinuityTrackerStore();
  const photosStore = useContinuityPhotosStore();
  const parsedScriptStore = useParsedScriptStore();
  const overridesStore = useCharacterOverridesStore();
  const project = useProjectStore((s) => s.getProject(projectId));
  const isCostume = project?.department === 'costume';

  /* Resolve data source: parsed script → mock data fallback */
  const parsedData = parsedScriptStore.getParsedData(projectId);

  const scenes: Scene[] = useMemo(
    () => parsedData ? parsedData.scenes : MOCK_SCENES,
    [parsedData],
  );

  const characters: Character[] = useMemo(() => {
    const raw = parsedData
      ? parsedData.characters.map((c) => ({ ...c, category: c.category || 'principal' as const }))
      : MOCK_CHARACTERS;
    return raw.map((c) => overridesStore.getCharacter(c));
  }, [parsedData, overridesStore]);

  const looks: Look[] = useMemo(
    () => parsedData ? parsedData.looks : MOCK_LOOKS,
    [parsedData],
  );

  /* Default to first scene if current selection is invalid */
  const validSceneId = scenes.find((s) => s.id === selectedSceneId) ? selectedSceneId : scenes[0]?.id ?? '';
  if (validSceneId !== selectedSceneId && validSceneId) {
    setSelectedSceneId(validSceneId);
  }

  const scene = scenes.find((s) => s.id === selectedSceneId) ?? scenes[0];
  const sceneCharacters = scene
    ? scene.characterIds.map((id) => characters.find((c) => c.id === id)!).filter(Boolean)
    : [];
  const breakdown = breakdownStore.getBreakdown(selectedSceneId);

  // Ensure breakdown exists for selected scene
  useEffect(() => {
    if (!breakdownStore.getBreakdown(selectedSceneId)) {
      const sc = scenes.find((s) => s.id === selectedSceneId)!;
      breakdownStore.setBreakdown(selectedSceneId, {
        sceneId: selectedSceneId,
        timeline: {
          day: '', note: '', type: '',
          time: sc.dayNight === 'DAY' ? 'Day' : sc.dayNight === 'NIGHT' ? 'Night' : sc.dayNight === 'DAWN' ? 'Dawn' : sc.dayNight === 'DUSK' ? 'Dusk' : '',
        },
        characters: sc.characterIds.map((cid) => ({
          characterId: cid, lookId: '',
          entersWith: emptyHMW(), sfx: '', environmental: '', action: '',
          changeType: 'no-change' as const, changeNotes: '',
          exitsWith: emptyHMW(), notes: '',
        })),
        continuityEvents: [],
      });
    }
  }, [selectedSceneId, breakdownStore, scenes]);

  // Default to first character
  useEffect(() => {
    if (sceneCharacters.length > 0 && (!activeCharId || !scene.characterIds.includes(activeCharId))) {
      setActiveCharId(sceneCharacters[0].id);
    }
  }, [selectedSceneId, sceneCharacters, activeCharId, scene.characterIds]);

  // Search filter
  const filteredScenes = scenes.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.location.toLowerCase().includes(q) ||
      String(s.number).includes(q) ||
      s.characterIds.some((cid) => {
        const ch = characters.find((c) => c.id === cid);
        return ch?.name.toLowerCase().includes(q);
      })
    );
  });

  const selectScene = useCallback((id: string) => {
    setSelectedSceneId(id);
    setAddEventOpen(false);
  }, []);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const currentIdx = scenes.findIndex((s) => s.id === selectedSceneId);
      if (e.key === 'ArrowUp' && currentIdx > 0) {
        e.preventDefault();
        selectScene(scenes[currentIdx - 1].id);
      }
      if (e.key === 'ArrowDown' && currentIdx < scenes.length - 1) {
        e.preventDefault();
        selectScene(scenes[currentIdx + 1].id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedSceneId, selectScene, scenes]);

  // Current character entry
  const activeChar = characters.find((c) => c.id === activeCharId);
  const charEntry = continuityStore.getEntry(selectedSceneId, activeCharId);
  const charBreakdown = breakdown?.characters.find((c) => c.characterId === activeCharId);
  const charLook = charBreakdown?.lookId ? looks.find((l) => l.id === charBreakdown.lookId) : null;

  // Events for this scene + character
  const sceneEvents = breakdown?.continuityEvents.filter((e) => e.characterId === activeCharId) || [];

  // Photos for this scene + character
  const scenePhotos = photosStore.getPhotos(selectedSceneId, activeCharId);

  const ANGLE_SLOTS: { angle: PhotoAngle; label: string }[] = [
    { angle: 'front', label: 'Front' },
    { angle: 'left', label: 'Left' },
    { angle: 'right', label: 'Right' },
    { angle: 'back', label: 'Back' },
  ];

  const fileToPhoto = (file: File): ContinuityPhoto => ({
    id: crypto.randomUUID(),
    url: URL.createObjectURL(file),
    filename: file.name,
    addedAt: new Date().toISOString(),
  });

  const handleAnglePhoto = (angle: PhotoAngle, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    photosStore.setAnglePhoto(selectedSceneId, activeCharId, angle, fileToPhoto(file));
    e.target.value = '';
  };

  const handleMasterRef = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    photosStore.setMasterRef(selectedSceneId, activeCharId, fileToPhoto(file));
    e.target.value = '';
  };

  const handleAdditionalPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      photosStore.addAdditionalPhoto(selectedSceneId, activeCharId, fileToPhoto(files[i]));
    }
    e.target.value = '';
  };

  /* Add continuity event */
  const handleAddEvent = (data: Omit<ContinuityEvent, 'id'>) => {
    breakdownStore.addContinuityEvent(selectedSceneId, {
      ...data,
      id: crypto.randomUUID(),
    });
    setAddEventOpen(false);
  };

  /* Remove continuity event */
  const handleRemoveEvent = (eventId: string) => {
    breakdownStore.removeContinuityEvent(selectedSceneId, eventId);
  };

  /* Copy tracking to next scene */
  const handleCopyToNext = () => {
    const currentIdx = scenes.findIndex((s) => s.id === selectedSceneId);
    if (currentIdx < scenes.length - 1) {
      const nextScene = scenes[currentIdx + 1];
      if (nextScene.characterIds.includes(activeCharId)) {
        continuityStore.setEntry(nextScene.id, activeCharId, {
          flags: { ...charEntry.flags },
          notes: charEntry.notes,
        });
      }
    }
  };

  return (
    <div className="bd-page">
      <div className="bd-panels">

        {/* ━━━ LEFT — Scene List ━━━ */}
        <div className="bd-left bd-panel-surface" style={{ width: LEFT_WIDTH, minWidth: LEFT_WIDTH }}>
          <div className="sl-header">
            <span className="sl-header-label">Scenes</span>
            <span className="sl-header-count">{scenes.length}</span>
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
              const isActive = s.id === selectedSceneId;
              const colorClass = sceneColorClass(s.intExt, s.dayNight);
              const ctStatus = continuityStore.getSceneStatus(s.id, s.characterIds);
              const bd = breakdownStore.getBreakdown(s.id);
              const eventCount = bd?.continuityEvents.length || 0;
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
                    <span className={`sl-card-status sl-card-status--${ctStatus}`} />
                  </div>
                  {isActive && (
                    <div className="sl-card-expand">
                      {eventCount > 0 && (
                        <div className="sl-expand-pill">
                          <span className="sl-expand-label">Events</span>
                          <span className="sl-expand-value">{eventCount} continuity event{eventCount !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {s.characterIds.length > 0 && (
                        <div className="sl-expand-pill">
                          <span className="sl-expand-label">Characters</span>
                          <div className="sl-expand-chars">
                            {s.characterIds.map((cid) => {
                              const ch = characters.find((c) => c.id === cid);
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

        {/* ━━━ CENTER — Continuity Tracking ━━━ */}
        <div className="bd-center">
          {/* Character tabs */}
          <div className="cp-tabstrip">
            <div className="cp-tabs-row">
              {sceneCharacters.map((c) => (
                <button key={c.id}
                  className={`cp-divider-tab ${activeCharId === c.id ? 'cp-divider-tab--active' : ''}`}
                  onClick={() => setActiveCharId(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Scene header bar */}
          <div className="ct-scene-bar">
            <div className="ct-scene-bar-left">
              <span className="ct-scene-num">SC {scene.number}</span>
              <span className="ct-scene-loc">{scene.intExt}. {scene.location} — {scene.dayNight}</span>
            </div>
            <div className="ct-scene-bar-right">
              <button
                className={`ct-status-btn ct-status-btn--${charEntry.status}`}
                onClick={() => {
                  const next = charEntry.status === 'pending' ? 'in-progress'
                    : charEntry.status === 'in-progress' ? 'complete' : 'pending';
                  continuityStore.setStatus(selectedSceneId, activeCharId, next);
                }}
              >
                {charEntry.status === 'pending' && <><CircleIcon /> Not Started</>}
                {charEntry.status === 'in-progress' && <><HalfCircleIcon /> In Progress</>}
                {charEntry.status === 'complete' && <><CheckIcon /> Complete</>}
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="ct-scroll">
            {activeChar ? (
              <div className="ct-content">

                {/* Character Info Card */}
                <div className="ct-card">
                  <div className="ct-card-header">
                    <h3 className="ct-card-title">{activeChar.name}</h3>
                    <span className="ct-card-subtitle">{activeChar.age} · {activeChar.gender} · {activeChar.hairColour} hair</span>
                  </div>
                  {charLook && (
                    <div className="ct-look-info">
                      <span className="ct-look-label">Look:</span>
                      <span className="ct-look-name">{charLook.name}</span>
                    </div>
                  )}
                  {/* Current HMW from breakdown */}
                  {charBreakdown && (charBreakdown.entersWith.hair || charBreakdown.entersWith.makeup) && (
                    <div className="ct-hmw-grid">
                      {charBreakdown.entersWith.hair && (
                        <div className="ct-hmw-item">
                          <span className="ct-hmw-label">Hair</span>
                          <span className="ct-hmw-value">{charBreakdown.entersWith.hair}</span>
                        </div>
                      )}
                      {charBreakdown.entersWith.makeup && (
                        <div className="ct-hmw-item">
                          <span className="ct-hmw-label">Makeup</span>
                          <span className="ct-hmw-value">{charBreakdown.entersWith.makeup}</span>
                        </div>
                      )}
                      {charBreakdown.entersWith.wardrobe && (
                        <div className="ct-hmw-item">
                          <span className="ct-hmw-label">Wardrobe</span>
                          <span className="ct-hmw-value">{charBreakdown.entersWith.wardrobe}</span>
                        </div>
                      )}
                      {charBreakdown.sfx && (
                        <div className="ct-hmw-item">
                          <span className="ct-hmw-label">SFX</span>
                          <span className="ct-hmw-value">{charBreakdown.sfx}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Scene Photos — angle slots */}
                <div className="ct-section">
                  <h4 className="ct-section-title">SCENE PHOTOS</h4>
                  <div className="ct-photo-grid">
                    {ANGLE_SLOTS.map(({ angle, label }) => {
                      const photo = scenePhotos.anglePhotos[angle];
                      return (
                        <button
                          key={angle}
                          className={`ct-photo-slot ${photo ? 'ct-photo-slot--filled' : ''} ${!photo && angle === 'front' ? 'ct-photo-slot--primary' : ''}`}
                          onClick={() => angleInputRefs.current[angle]?.click()}
                        >
                          <input
                            ref={(el) => { angleInputRefs.current[angle] = el; }}
                            type="file"
                            accept="image/*"
                            className="ct-photo-input"
                            onChange={(e) => handleAnglePhoto(angle, e)}
                          />
                          {photo ? (
                            <img src={photo.url} alt={label} className="ct-photo-img" />
                          ) : (
                            <>
                              <CameraIcon />
                              <span className="ct-photo-slot-label">{label.toUpperCase()}</span>
                            </>
                          )}
                          {photo && (
                            <button
                              className="ct-photo-remove"
                              onClick={(e) => {
                                e.stopPropagation();
                                photosStore.setAnglePhoto(selectedSceneId, activeCharId, angle, null);
                              }}
                              aria-label={`Remove ${label} photo`}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Master Reference */}
                <div className="ct-section">
                  <h4 className="ct-section-title">MASTER REFERENCE</h4>
                  <button
                    className={`ct-master-ref ${scenePhotos.masterRef ? 'ct-master-ref--filled' : ''}`}
                    onClick={() => masterRefInputRef.current?.click()}
                  >
                    <input
                      ref={masterRefInputRef}
                      type="file"
                      accept="image/*"
                      className="ct-photo-input"
                      onChange={handleMasterRef}
                    />
                    {scenePhotos.masterRef ? (
                      <>
                        <img src={scenePhotos.masterRef.url} alt="Master reference" className="ct-master-ref-img" />
                        <button
                          className="ct-photo-remove ct-photo-remove--lg"
                          onClick={(e) => {
                            e.stopPropagation();
                            photosStore.setMasterRef(selectedSceneId, activeCharId, null);
                          }}
                          aria-label="Remove master reference"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </>
                    ) : (
                      <div className="ct-master-ref-empty">
                        <CameraIcon size={24} />
                        <span>Click to set master reference</span>
                      </div>
                    )}
                  </button>
                </div>

                {/* Additional Photos */}
                <div className="ct-section">
                  <div className="ct-section-header">
                    <h4 className="ct-section-title">ADDITIONAL PHOTOS</h4>
                    <span className="ct-photo-count">{scenePhotos.additional.length} photo{scenePhotos.additional.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="ct-additional-photos">
                    {scenePhotos.additional.map((photo) => (
                      <div key={photo.id} className="ct-additional-thumb">
                        <img src={photo.url} alt={photo.filename} className="ct-additional-img" />
                        <button
                          className="ct-photo-remove"
                          onClick={() => photosStore.removeAdditionalPhoto(selectedSceneId, activeCharId, photo.id)}
                          aria-label="Remove photo"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    ))}
                    <button
                      className="ct-photo-slot ct-photo-slot--primary ct-photo-slot--add"
                      onClick={() => additionalInputRef.current?.click()}
                    >
                      <input
                        ref={additionalInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="ct-photo-input"
                        onChange={handleAdditionalPhotos}
                      />
                      <PlusIcon />
                    </button>
                  </div>
                </div>

                {/* Quick Flags */}
                <div className="ct-section">
                  <h4 className="ct-section-title">QUICK FLAGS</h4>
                  <div className="ct-flags-grid">
                    {FLAG_LABELS.map(({ key, label }) => {
                      const active = charEntry.flags[key];
                      return (
                        <button key={key}
                          className={`ct-flag-pill ${active ? 'ct-flag-pill--active' : ''}`}
                          onClick={() => continuityStore.toggleFlag(selectedSceneId, activeCharId, key)}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Costume Lookbook Fields (costume department only) */}
                {isCostume && (
                  <div className="ct-section">
                    <h4 className="ct-section-title">COSTUME LOOKBOOK</h4>
                    <div className="ct-lookbook-fields" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <label className="ct-field-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Outfit</label>
                        <textarea
                          className="ct-notes-input"
                          placeholder="Describe the outfit..."
                          value={charEntry.costumeLookbook?.outfit ?? ''}
                          onChange={(e) => continuityStore.setEntry(selectedSceneId, activeCharId, {
                            costumeLookbook: { ...charEntry.costumeLookbook, outfit: e.target.value },
                          })}
                          rows={2}
                        />
                      </div>
                      <div>
                        <label className="ct-field-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Accessories</label>
                        <textarea
                          className="ct-notes-input"
                          placeholder="Jewellery, bags, hats, glasses..."
                          value={charEntry.costumeLookbook?.accessories ?? ''}
                          onChange={(e) => continuityStore.setEntry(selectedSceneId, activeCharId, {
                            costumeLookbook: { ...charEntry.costumeLookbook, accessories: e.target.value },
                          })}
                          rows={2}
                        />
                      </div>
                      <div>
                        <label className="ct-field-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Breakdown</label>
                        <textarea
                          className="ct-notes-input"
                          placeholder="Ageing, distressing, breakdown effects..."
                          value={charEntry.costumeLookbook?.breakdown ?? ''}
                          onChange={(e) => continuityStore.setEntry(selectedSceneId, activeCharId, {
                            costumeLookbook: { ...charEntry.costumeLookbook, breakdown: e.target.value },
                          })}
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Continuity Events */}
                <div className="ct-section">
                  <div className="ct-section-header">
                    <h4 className="ct-section-title">CONTINUITY EVENTS</h4>
                    <button className="ct-add-btn" onClick={() => setAddEventOpen(true)}>
                      <PlusIcon /> Add Event
                    </button>
                  </div>

                  {sceneEvents.length === 0 && !addEventOpen ? (
                    <button className="ct-empty-events" onClick={() => setAddEventOpen(true)}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <line x1="9" y1="15" x2="15" y2="15" />
                      </svg>
                      <span className="ct-empty-text">No continuity events</span>
                      <span className="ct-empty-hint">Add wounds, bruises, prosthetics etc.</span>
                    </button>
                  ) : (
                    <div className="ct-events-list">
                      {sceneEvents.map((event) => (
                        <EventCard key={event.id} event={event} onRemove={() => handleRemoveEvent(event.id)} />
                      ))}
                    </div>
                  )}

                  {addEventOpen && (
                    <AddEventForm
                      sceneId={selectedSceneId}
                      characterId={activeCharId}
                      onAdd={handleAddEvent}
                      onCancel={() => setAddEventOpen(false)}
                    />
                  )}
                </div>

                {/* Notes */}
                <div className="ct-section">
                  <h4 className="ct-section-title">CONTINUITY NOTES</h4>
                  <textarea
                    className="ct-notes-input"
                    placeholder="Add continuity notes for this scene..."
                    value={charEntry.notes}
                    onChange={(e) => continuityStore.setEntry(selectedSceneId, activeCharId, { notes: e.target.value })}
                    rows={3}
                  />
                </div>

                {/* Copy to next */}
                <div className="ct-actions">
                  <button className="ct-copy-btn" onClick={handleCopyToNext}>
                    <CopyNextIcon /> Copy to Next Scene
                  </button>
                  <button
                    className="ct-complete-btn"
                    onClick={() => continuityStore.setStatus(selectedSceneId, activeCharId, 'complete')}
                  >
                    <CheckIcon /> Mark Complete
                  </button>
                </div>

              </div>
            ) : (
              <div className="ct-empty-state">
                <p>No characters in this scene.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ━━━ Event Card ━━━ */

function EventCard({ event, onRemove }: { event: ContinuityEvent; onRemove: () => void }) {
  const [showTimeline, setShowTimeline] = useState(false);
  const hasProgression = event.progression && event.progression.length > 0;

  return (
    <div className="ct-event-card">
      <button className="ct-event-remove" onClick={onRemove} aria-label="Remove event">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      <span className="ct-event-type">{event.type}</span>
      <h4 className="ct-event-name">{event.name || event.description || event.type}</h4>

      {event.description && event.name && (
        <p className="ct-event-desc">{event.description}</p>
      )}

      <div className="ct-event-meta">
        {event.stage && (
          <div className="ct-event-meta-item">
            <span className="ct-event-meta-label">Stage:</span>
            <span className="ct-event-meta-value">{event.stage}</span>
          </div>
        )}
        {event.sceneRange && (
          <div className="ct-event-meta-item">
            <span className="ct-event-meta-label">Scenes:</span>
            <span className="ct-event-meta-value">{event.sceneRange}</span>
          </div>
        )}
        {event.products && (
          <div className="ct-event-meta-item">
            <span className="ct-event-meta-label">Products:</span>
            <span className="ct-event-meta-value">{event.products}</span>
          </div>
        )}
      </div>

      {/* Scene chips */}
      {event.scenes && event.scenes.length > 0 && (
        <div className="ct-event-scenes">
          <span className="ct-event-scenes-label">SCENES</span>
          <div className="ct-event-scene-chips">
            {event.scenes.map((sc) => {
              const hasStage = hasProgression && event.progression!.some((p) => p.scene === sc);
              return (
                <span key={sc} className={`ct-scene-chip ${hasStage ? 'ct-scene-chip--staged' : ''}`}>
                  {sc}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Progression timeline */}
      {hasProgression && (
        <div className="ct-event-progression">
          <button className="ct-prog-toggle" onClick={() => setShowTimeline(!showTimeline)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Progression ({event.progression!.length} stage{event.progression!.length !== 1 ? 's' : ''})
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transition: 'transform 0.2s', transform: showTimeline ? 'rotate(180deg)' : '' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showTimeline && (
            <div className="ct-prog-timeline">
              <div className="ct-prog-line" />
              {event.progression!.map((ps, idx) => (
                <div key={ps.id} className="ct-prog-stage">
                  <div className="ct-prog-dot">
                    <span>{idx + 1}</span>
                  </div>
                  <div className="ct-prog-content">
                    <div className="ct-prog-stage-header">
                      <span className="ct-prog-stage-name">{ps.stage || `Stage ${idx + 1}`}</span>
                      {ps.scene && <span className="ct-prog-scene-badge">Sc {ps.scene}</span>}
                    </div>
                    {ps.notes && <p className="ct-prog-notes">{ps.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ━━━ Add Event Form ━━━ */

function AddEventForm({ sceneId: _sceneId, characterId, onAdd, onCancel }: {
  sceneId: string; characterId: string;
  onAdd: (data: Omit<ContinuityEvent, 'id'>) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<string>('Wound');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stage, setStage] = useState('');
  const [sceneRange, setSceneRange] = useState('');
  const [products, setProducts] = useState('');
  const [showStageSuggestions, setShowStageSuggestions] = useState(false);
  const [progression, setProgression] = useState<ProgressionStage[]>([]);
  const [showProgression, setShowProgression] = useState(false);

  const hasProgression = type === 'Wound' || type === 'Bruise' || type === 'Other';
  const scenes = sceneRange.split(',').map((s) => s.trim()).filter(Boolean);

  const addProgressionStage = () => {
    const nextScene = scenes.find((s) => !progression.some((p) => p.scene === s)) || '';
    setProgression((prev) => [...prev, { id: `stage-${Date.now()}`, scene: nextScene, stage: '', notes: '' }]);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd({
      type,
      characterId,
      name: name.trim(),
      description: description.trim(),
      stage: stage.trim(),
      sceneRange: sceneRange.trim(),
      scenes: scenes.length > 0 ? scenes : undefined,
      products: products.trim(),
      progression: progression.length > 0 ? progression : undefined,
    });
  };

  return (
    <div className="ct-event-form">
      <h4 className="ct-form-title"><span className="heading-italic">Add</span> Continuity Event</h4>

      {/* Type selector */}
      <div className="ct-form-field">
        <label className="ct-form-label">TYPE</label>
        <div className="ct-type-chips">
          {CONTINUITY_EVENT_TYPES.map((t) => (
            <button key={t} className={`ct-type-chip ${type === t ? 'ct-type-chip--active' : ''}`}
              onClick={() => setType(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div className="ct-form-field">
        <label className="ct-form-label">NAME</label>
        <input className="ct-form-input" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Forehead Cut" />
      </div>

      {/* Description */}
      <div className="ct-form-field">
        <label className="ct-form-label">DESCRIPTION</label>
        <textarea className="ct-form-textarea" value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the makeup effect..." rows={2} />
      </div>

      {/* Scene Range */}
      <div className="ct-form-field">
        <label className="ct-form-label">SCENES</label>
        <input className="ct-form-input" value={sceneRange} onChange={(e) => setSceneRange(e.target.value)}
          placeholder="e.g., 3, 4, 5, 6" />
      </div>

      {/* Current Stage */}
      <div className="ct-form-field" style={{ position: 'relative' }}>
        <label className="ct-form-label">CURRENT STAGE</label>
        <input className="ct-form-input" value={stage}
          onChange={(e) => setStage(e.target.value)}
          onFocus={() => setShowStageSuggestions(true)}
          onBlur={() => setTimeout(() => setShowStageSuggestions(false), 200)}
          placeholder="e.g., Fresh, Day 2 Healing" />
        {showStageSuggestions && (
          <div className="ct-stage-dropdown">
            {STAGE_SUGGESTIONS.map((s) => (
              <button key={s} className="ct-stage-option" onClick={() => { setStage(s); setShowStageSuggestions(false); }}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Progression */}
      {hasProgression && scenes.length > 1 && (
        <div className="ct-form-field">
          <div className="ct-form-field-header">
            <label className="ct-form-label">PROGRESSION TIMELINE</label>
            <button className="ct-form-link" onClick={() => setShowProgression(!showProgression)}>
              {showProgression ? 'Hide' : 'Plan changes over scenes'}
            </button>
          </div>
          {showProgression && (
            <div className="ct-prog-form">
              {progression.map((ps, idx) => (
                <div key={ps.id} className="ct-prog-form-stage">
                  <div className="ct-prog-form-header">
                    <div className="ct-prog-dot"><span>{idx + 1}</span></div>
                    <span className="ct-prog-form-label">Stage {idx + 1}</span>
                    <button className="ct-prog-form-remove"
                      onClick={() => setProgression((p) => p.filter((x) => x.id !== ps.id))}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                  <div className="ct-prog-form-fields">
                    <div className="ct-prog-form-row">
                      <span className="ct-prog-form-sublabel">Scene</span>
                      <div className="ct-prog-scene-chips">
                        {scenes.map((sc) => (
                          <button key={sc}
                            className={`ct-scene-chip ${ps.scene === sc ? 'ct-scene-chip--staged' : ''}`}
                            onClick={() => setProgression((p) => p.map((x) => x.id === ps.id ? { ...x, scene: sc } : x))}>
                            {sc}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input className="ct-form-input ct-form-input--sm" placeholder="Stage description..."
                      value={ps.stage}
                      onChange={(e) => setProgression((p) => p.map((x) => x.id === ps.id ? { ...x, stage: e.target.value } : x))} />
                    <textarea className="ct-form-textarea ct-form-textarea--sm" placeholder="Application notes..."
                      rows={1} value={ps.notes}
                      onChange={(e) => setProgression((p) => p.map((x) => x.id === ps.id ? { ...x, notes: e.target.value } : x))} />
                  </div>
                </div>
              ))}
              <button className="ct-prog-add-btn" onClick={addProgressionStage}>
                <PlusIcon /> Add Stage
              </button>
            </div>
          )}
        </div>
      )}

      {/* Products */}
      <div className="ct-form-field">
        <label className="ct-form-label">PRODUCTS</label>
        <textarea className="ct-form-textarea" value={products} onChange={(e) => setProducts(e.target.value)}
          placeholder="List products used..." rows={2} />
      </div>

      {/* Actions */}
      <div className="ct-form-actions">
        <button className="ct-form-cancel" onClick={onCancel}>Cancel</button>
        <button className="ct-form-submit" onClick={handleSubmit} disabled={!name.trim()}>Add Event</button>
      </div>
    </div>
  );
}

/* ━━━ Icons ━━━ */

function PlusIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}

function CheckIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}

function CircleIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>;
}

function HalfCircleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a10 10 0 0 1 0 20" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function CopyNextIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>;
}

function CameraIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
}
