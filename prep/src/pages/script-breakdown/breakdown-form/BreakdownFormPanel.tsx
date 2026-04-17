import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CONTINUITY_EVENT_TYPES,
  useSynopsisStore,
  type Scene,
  type Character,
  type Look,
  type CharacterBreakdown,
  type ContinuityEvent,
  type SceneBreakdown,
} from '@/stores/breakdownStore';
import { useDirectorQueriesStore } from '@/stores/directorQueriesStore';
import { FInput, FSelect } from './form-primitives';
import { SceneRangeSelect } from './SceneRangeSelect';
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

export function BreakdownFormPanel({ projectId, scene, characters, breakdown, activeCharacterId, saveStatus, scenes, allScenes, allCharacters, allLooks, onNavigate, onUpdate, onUpdateTimeline, onAddEvent, onUpdateEvent, onRemoveEvent, onRemoveCharacter, onAddLook, onSetLook, department }: {
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
  const queriesStore = useDirectorQueriesStore(projectId);
  const sceneQueries = queriesStore((s) => s.getQueries(scene.id));
  const addQuery = queriesStore((s) => s.addQuery);
  const updateQuery = queriesStore((s) => s.updateQuery);
  const toggleResolved = queriesStore((s) => s.toggleResolved);
  const removeQuery = queriesStore((s) => s.removeQuery);
  const [newQueryText, setNewQueryText] = useState('');

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
                  description: '', sceneRange: `${scene.number}-${scene.number}`,
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

        {/* Scene-level Continuity Events */}
        <div className="fp-section">
          <div className="fp-section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Scene Continuity Events</span>
            <button className="fp-add-btn" onClick={() => onAddEvent({
              id: crypto.randomUUID(), type: 'Wound', characterId: '',
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
        {/* ── Director Queries ── */}
        <div style={{ marginTop: '24px', padding: '0 4px' }}>
          <div style={{
            fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#C4522A', marginBottom: '10px',
          }}>
            Director Queries
          </div>

          {sceneQueries.map((q) => (
            <div
              key={q.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                padding: '8px 10px', marginBottom: '6px', borderRadius: '8px',
                backgroundColor: q.resolved ? 'rgba(74,191,176,0.08)' : 'rgba(232,98,26,0.08)',
                border: `1px solid ${q.resolved ? 'rgba(74,191,176,0.2)' : 'rgba(232,98,26,0.2)'}`,
              }}
            >
              <button
                onClick={() => toggleResolved(scene.id, q.id)}
                style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 2,
                  border: `2px solid ${q.resolved ? '#4ABFB0' : '#E8621A'}`,
                  backgroundColor: q.resolved ? '#4ABFB0' : 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {q.resolved && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
              <input
                type="text"
                value={q.text}
                onChange={(e) => updateQuery(scene.id, q.id, e.target.value)}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  fontSize: '0.8125rem', color: 'var(--text-primary)',
                  textDecoration: q.resolved ? 'line-through' : 'none',
                  opacity: q.resolved ? 0.5 : 1,
                }}
              />
              <button
                onClick={() => removeQuery(scene.id, q.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', padding: '0 2px', flexShrink: 0 }}
              >
                ×
              </button>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              value={newQueryText}
              onChange={(e) => setNewQueryText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newQueryText.trim()) {
                  addQuery(scene.id, newQueryText.trim());
                  setNewQueryText('');
                }
              }}
              placeholder="Add a question for the director..."
              style={{
                flex: 1, padding: '8px 10px', borderRadius: '8px', fontSize: '0.8125rem',
                border: '1px solid rgba(232,98,26,0.25)', backgroundColor: 'rgba(232,98,26,0.04)',
                outline: 'none', color: 'var(--text-primary)',
              }}
            />
            <button
              onClick={() => {
                if (newQueryText.trim()) {
                  addQuery(scene.id, newQueryText.trim());
                  setNewQueryText('');
                }
              }}
              disabled={!newQueryText.trim()}
              style={{
                padding: '8px 12px', borderRadius: '8px', border: 'none',
                backgroundColor: newQueryText.trim() ? '#E8621A' : 'var(--bg-secondary)',
                color: newQueryText.trim() ? '#fff' : 'var(--text-muted)',
                fontSize: '0.75rem', fontWeight: 600, cursor: newQueryText.trim() ? 'pointer' : 'default',
              }}
            >
              Add
            </button>
          </div>
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
