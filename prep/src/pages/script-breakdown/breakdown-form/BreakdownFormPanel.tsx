import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CONTINUITY_EVENT_TYPES,
  useBreakdownStore,
  useSynopsisStore,
  type Scene,
  type Character,
  type Look,
  type CharacterBreakdown,
  type ContinuityEvent,
  type SceneBreakdown,
} from '@/stores/breakdownStore';
import { FSelect } from './form-primitives';
import { SceneRangeSelect } from './SceneRangeSelect';

/* Simple per-scene notes stored in localStorage — avoids the Zustand persist
   issue that crashed DirectorQueriesSection. Data keyed by projectId:sceneId. */
function useSceneNotes(projectId: string, sceneId: string) {
  const key = `prep-scene-notes-${projectId}`;
  const [allNotes, setAllNotes] = useState<Record<string, { text: string; flagged: boolean }>>(() => {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
  });
  const note = allNotes[sceneId] || { text: '', flagged: false };

  const save = useCallback((updated: Record<string, { text: string; flagged: boolean }>) => {
    setAllNotes(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  }, [key]);

  const setText = useCallback((text: string) => {
    save({ ...allNotes, [sceneId]: { ...note, text } });
  }, [allNotes, sceneId, note, save]);

  const toggleFlag = useCallback(() => {
    save({ ...allNotes, [sceneId]: { ...note, flagged: !note.flagged } });
  }, [allNotes, sceneId, note, save]);

  return { text: note.text, flagged: note.flagged, setText, toggleFlag };
}
import { CharBlock } from './CharBlock';

/**
 * Right-panel breakdown form for the ScriptBreakdown page. Renders
 * the pinned scene header, synopsis textarea, timeline fields, the
 * characters-in-scene section (delegated to CharBlock per character),
 * scene-level continuity events, and a bottom-anchored prev/next
 * scene navigation bar that fades in when the user scrolls to the
 * bottom of the form.
 *
 * Calls useSynopsisStore() internally for synopsis read/write.
 * Everything else flows through the 17 props received from the
 * parent ScriptBreakdown component.
 */
import { useCharacterOverridesStore } from '@/stores/breakdownStore';
import { type CostumeSceneBreakdown } from './CostumeBreakdownFields';

export function BreakdownFormPanel({ projectId: _projectId, scene, characters, breakdown, activeCharacterId, saveStatus, scenes, allScenes, allCharacters, allLooks, onNavigate, onUpdate, onUpdateTimeline, onAddEvent, onUpdateEvent, onRemoveEvent, onRemoveCharacter, onAddLook, onSetLook, department }: {
  projectId: string; scene: Scene; characters: Character[]; breakdown: SceneBreakdown | undefined;
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
  onSetLook: (lookId: string, hair: string, makeup: string, wardrobe: string) => void;
  department?: 'hmu' | 'costume';
}) {
  const charOverrides = useCharacterOverridesStore();
  const sceneNotes = useSceneNotes(_projectId, scene.id);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(false);
  const synopsisStore = useSynopsisStore();
  const synopsis = synopsisStore.getSynopsis(breakdown ? scene.id : '', breakdown ? scene.synopsis : '');
  const setSynopsis = useCallback((text: string) => synopsisStore.setSynopsis(scene.id, text), [synopsisStore, scene.id]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setAtBottom(entry.isIntersecting), { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* Scroll breakdown panel to top when switching scenes */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [scene.id]);

  if (!breakdown) return null;

  const sceneIdx = scenes.findIndex((s) => s.id === scene.id);
  const prevScene = sceneIdx > 0 ? scenes[sceneIdx - 1] : null;
  const nextScene = sceneIdx < scenes.length - 1 ? scenes[sceneIdx + 1] : null;

  return (
    <div className="fp-wrap">
      {/* Notes & Queries — pinned */}
      <div className="fp-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: sceneNotes.flagged ? '#C4522A' : 'var(--text-muted)' }}>
            {sceneNotes.flagged ? '⚑ Query' : 'Notes'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={sceneNotes.toggleFlag}
              title={sceneNotes.flagged ? 'Resolve query' : 'Flag as query'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                fontSize: '14px', lineHeight: 1,
                color: sceneNotes.flagged ? '#C4522A' : 'var(--text-muted)',
                opacity: sceneNotes.flagged ? 1 : 0.5,
              }}
            >
              ⚑
            </button>
            <span className={`fp-save fp-save--${saveStatus}`}>
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : ''}
            </span>
          </div>
        </div>
        <textarea
          className="fi-input"
          value={sceneNotes.text}
          onChange={(e) => sceneNotes.setText(e.target.value)}
          placeholder="Production notes, questions for director..."
          rows={2}
          style={{
            fontSize: '0.8125rem', resize: 'vertical', minHeight: '36px',
            borderColor: sceneNotes.flagged ? 'rgba(196, 82, 42, 0.3)' : undefined,
            backgroundColor: sceneNotes.flagged ? 'rgba(196, 82, 42, 0.04)' : undefined,
          }}
        />
      </div>

      <div className="fp-scroll" ref={scrollRef}>
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
            // Costume data stored in character metadata JSONB
            const resolvedChar = charOverrides.getCharacter(ch);
            const costumeBreakdowns = (resolvedChar as any).costume_breakdown as Record<string, CostumeSceneBreakdown> | undefined;
            const costumeData: CostumeSceneBreakdown = costumeBreakdowns?.[String(scene.number)] || {};
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
                  id: crypto.randomUUID(), type: 'Wound', characterId: charId,
                  description: '', sceneRange: `${scene.number}-`,
                })}
                onUpdateEvent={onUpdateEvent}
                onRemoveEvent={onRemoveEvent}
                onRemoveCharacter={onRemoveCharacter}
                onAddLook={onAddLook}
                onSetLook={onSetLook}
                department={department}
                costumeData={department === 'costume' ? costumeData : undefined}
                onCostumeUpdate={department === 'costume' ? (data) => {
                  const existing = (resolvedChar as any).costume_breakdown || {};
                  charOverrides.updateCharacter(ch.id, {
                    costume_breakdown: { ...existing, [String(scene.number)]: data },
                  } as any);
                } : undefined} />
            );
          })}
        </div>

        {/* Active continuity events from earlier scenes — open events
            (no end set) and events whose sceneRange still covers this
            scene. The user can leave events open while they read on,
            then close them here with a single click once the story
            reaches the moment the event ends. */}
        <ActiveContinuityEventsSection
          currentSceneId={scene.id}
          currentSceneNumber={scene.number}
          allScenes={allScenes}
          allCharacters={allCharacters}
        />

        {/* Scene-level Continuity Events */}
        <div className="fp-section">
          <div className="fp-section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Scene Continuity Events</span>
            <button className="fp-add-btn" onClick={() => onAddEvent({
              id: crypto.randomUUID(), type: 'Wound', characterId: '',
              description: '', sceneRange: `${scene.number}-`,
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
        {/* ── Director Queries — rendered separately to avoid crash ── */}

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

/* ──────────────────────────────────────────────────────────────────
   Active continuity events from earlier scenes
   ────────────────────────────────────────────────────────────────── */

interface ActiveEventEntry {
  /** Source scene id where the event was originally added. */
  sourceSceneId: string;
  /** Source scene number (parsed from sceneRange). */
  startScene: number;
  /** Numeric end scene, or null when the event is still open. */
  endScene: number | null;
  event: ContinuityEvent;
}

function ActiveContinuityEventsSection({
  currentSceneId,
  currentSceneNumber,
  allScenes,
  allCharacters,
}: {
  currentSceneId: string;
  currentSceneNumber: number;
  allScenes: Scene[];
  allCharacters: Character[];
}) {
  const breakdowns = useBreakdownStore((s) => s.breakdowns);
  const updateContinuityEvent = useBreakdownStore((s) => s.updateContinuityEvent);
  const removeContinuityEvent = useBreakdownStore((s) => s.removeContinuityEvent);

  const sceneIdByNumber = new Map<number, string>();
  for (const s of allScenes) sceneIdByNumber.set(s.number, s.id);

  const active: ActiveEventEntry[] = [];
  for (const [sceneId, bd] of Object.entries(breakdowns)) {
    if (sceneId === currentSceneId) continue; // current scene's events render below
    if (!bd?.continuityEvents) continue;
    for (const ev of bd.continuityEvents) {
      const parts = (ev.sceneRange || '').split('-');
      const start = Number.parseInt((parts[0] || '').trim(), 10);
      const endRaw = (parts[1] || '').trim();
      const end = endRaw === '' ? null : Number.parseInt(endRaw, 10);
      if (Number.isNaN(start)) continue;
      const stillActive =
        start <= currentSceneNumber &&
        (end === null || (Number.isFinite(end) && end >= currentSceneNumber));
      if (stillActive) {
        active.push({ sourceSceneId: sceneId, startScene: start, endScene: end, event: ev });
      }
    }
  }
  active.sort((a, b) => a.startScene - b.startScene);

  if (active.length === 0) return null;

  const charName = (id: string) => allCharacters.find((c) => c.id === id)?.name || '';

  return (
    <div className="fp-section">
      <div className="fp-section-title">
        <span>Active continuity events</span>
      </div>
      <p className="fp-empty" style={{ marginTop: -6 }}>
        Events that started earlier and are either still open or scheduled to span this scene.
      </p>
      {active.map(({ sourceSceneId, startScene, endScene, event }) => {
        const isOpen = endScene === null;
        const status = isOpen
          ? `Sc ${startScene} → open`
          : `Sc ${startScene} → Sc ${endScene}`;
        const charLabel = event.characterId ? charName(event.characterId) : 'Scene-wide';
        return (
          <div key={`${sourceSceneId}-${event.id}`} className="fp-event">
            <div className="fp-event-top">
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: '0.6875rem', fontWeight: 700,
                color: '#C4522A', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {event.type}
              </span>
              <span style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {charLabel} · {status}
              </span>
              <button
                className="fp-add-btn"
                onClick={() =>
                  updateContinuityEvent(sourceSceneId, event.id, {
                    sceneRange: `${startScene}-${currentSceneNumber}`,
                  })
                }
                title={`Mark Sc ${currentSceneNumber} as the closing scene for this event`}
              >
                {isOpen ? `End in Sc ${currentSceneNumber}` : `Move end to Sc ${currentSceneNumber}`}
              </button>
              <button
                className="fp-remove-btn"
                onClick={() => removeContinuityEvent(sourceSceneId, event.id)}
                title="Remove this event"
              >
                Remove
              </button>
            </div>
            {event.description && (
              <p className="fp-empty" style={{ marginTop: 4, marginBottom: 0, color: 'var(--text-secondary)' }}>
                {event.description}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
