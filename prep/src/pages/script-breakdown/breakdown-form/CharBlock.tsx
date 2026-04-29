import { useState, useCallback, useRef, useMemo } from 'react';
import {
  BREAKDOWN_CATEGORIES,
  CONTINUITY_EVENT_TYPES,
  useTagStore,
  type Character,
  type Look,
  type CharacterBreakdown,
  type ContinuityEvent,
  type HMWEntry,
  type Scene,
  type ScriptTag,
} from '@/stores/breakdownStore';
import {
  useShoppingFlagStore,
  SHOPPING_FLAG_KINDS,
  type ShoppingFlagScope,
} from '@/stores/shoppingFlagStore';
import { ordinal } from '@/utils/ordinal';
import { FInput } from './form-primitives';
import { SceneRangeSelect } from './SceneRangeSelect';
import { CostumeBreakdownFields, type CostumeSceneBreakdown } from './CostumeBreakdownFields';

/**
 * Per-character form block rendered inside BreakdownFormPanel. One
 * instance per character in the current scene. Contains: look picker,
 * entersWith (hair / makeup / wardrobe) fields with tag pills, SFX /
 * environmental / action fields, change toggle with exitsWith, the
 * Notes field, an expandable character-profile section, per-character
 * continuity events, and a character-removal modal.
 *
 * Calls useTagStore() internally for tag-pill rendering.
 * Everything else flows through the props received from
 * BreakdownFormPanel.
 */
export function CharBlock({ projectId, char, cb, looks, highlighted, onUpdate, characterEvents, onAddCharEvent, onUpdateEvent, onRemoveEvent, allScenes, allCharacters, sceneId, onRemoveCharacter, onAddLook, onUpdateLookField, department, costumeData, onCostumeUpdate }: {
  projectId: string;
  char: Character; cb: CharacterBreakdown; looks: Look[];
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
  /**
   * Called when the user types into hair / makeup / wardrobe and a
   * look is currently selected. Updates the look's saved value so the
   * next scene that selects the same look auto-fills the latest text.
   * Replaces the old explicit "Set Look" button — the look is kept
   * in sync continuously with whatever was last typed in any scene
   * where it was active.
   */
  onUpdateLookField: (lookId: string, field: 'hair' | 'makeup' | 'wardrobe', value: string) => void;
  department?: 'hmu' | 'costume';
  costumeData?: CostumeSceneBreakdown;
  onCostumeUpdate?: (data: CostumeSceneBreakdown) => void;
}) {
  const ue = (f: 'entersWith' | 'exitsWith', k: keyof HMWEntry, v: string) => {
    onUpdate({ [f]: { ...cb[f], [k]: v } });
    // Mirror entersWith edits onto the active look — the next scene
    // that selects this look will auto-fill from the saved value.
    // exitsWith reflects post-change state, so it doesn't write back.
    if (f === 'entersWith' && cb.lookId && (k === 'hair' || k === 'makeup' || k === 'wardrobe')) {
      onUpdateLookField(cb.lookId, k, v);
    }
  };

  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [showNewLookInput, setShowNewLookInput] = useState(false);
  const [newLookName, setNewLookName] = useState('');
  const newLookInputRef = useRef<HTMLInputElement>(null);

  /* Characters available for merge — exclude self, sort by billing (most likely merge targets first) */
  const mergeOptions = useMemo(() =>
    allCharacters
      .filter((c) => c.id !== char.id)
      .sort((a, b) => a.billing - b.billing),
    [allCharacters, char.id]
  );

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

  // Tags are pure metadata now — dismiss/restore only toggles the tag's
  // dismissed flag in the store. They no longer mutate cb.entersWith / sfx /
  // environmental / action / notes. The pill row under each field is driven
  // directly by the tag store, so hiding/showing a pill is visible
  // immediately without touching the form field text.
  const handleDismissTag = useCallback((tag: ScriptTag) => {
    tagStore.dismissTag(tag.id);
  }, [tagStore]);

  const handleRestoreTag = useCallback((tag: ScriptTag) => {
    tagStore.restoreTag(tag.id);
  }, [tagStore]);

  const TagPills = ({ tags, color }: { tags: ScriptTag[]; color: string }) =>
    tags.length > 0 ? (
      <div className="cb-tag-row">
        {tags.map((t) => (
          <span
            key={t.id}
            className={`cb-tag-pill${t.dismissed ? ' cb-tag-pill--dismissed' : ''}`}
            style={{ borderColor: color, color }}
            onClick={t.dismissed ? () => handleRestoreTag(t) : undefined}
            title={t.dismissed ? 'Click to re-apply to field' : undefined}
          >
            {t.text}
            {!t.dismissed && (
              <button className="cb-tag-remove" onClick={() => handleDismissTag(t)}>×</button>
            )}
          </span>
        ))}
      </div>
    ) : null;

  const catColor = (id: string) => BREAKDOWN_CATEGORIES.find((c) => c.id === id)?.color || '#999';

  const handleSetLook = useCallback((lookId: string) => {
    const look = looks.find((l) => l.id === lookId);
    if (!look) {
      onUpdate({ lookId });
      return;
    }
    // Decide per-field whether to take the look's value or keep what's in
    // the form. Two cases:
    //   (a) cb.lookId is already set → the user is SWITCHING looks. The
    //       text currently in entersWith came from the previous look, so
    //       it's safe to replace with the new look's values. But if the
    //       new look has an empty value for a field, keep the previous
    //       text rather than clobbering it with empty.
    //   (b) cb.lookId is empty → this is the FIRST look pick on this
    //       character/scene. Anything already in entersWith was typed
    //       manually by the user and must NOT be overwritten. Only fill
    //       fields that are still empty so the look's values fall in
    //       where there's nothing to lose.
    const wasLookSet = !!cb.lookId;
    const pickField = (current: string, fromLook: string): string => {
      if (wasLookSet) return fromLook || current;
      return current || fromLook;
    };
    onUpdate({
      lookId,
      entersWith: {
        hair: pickField(cb.entersWith.hair, look.hair),
        makeup: pickField(cb.entersWith.makeup, look.makeup),
        wardrobe: pickField(cb.entersWith.wardrobe, look.wardrobe),
      },
    });
  }, [cb.lookId, cb.entersWith, looks, onUpdate]);

  return (
    <div className={`cb-block ${highlighted ? 'cb-block--hl' : ''}`}>
      <div className="cb-header">
        <span className="cb-name">{char.name}</span>
        <div className="cb-header-right">
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
              handleSetLook(e.target.value);
            }
          }}>
            <option value="">Select look...</option>
            <option value="__new">+ New Look</option>
            {looks
              .filter((l) => {
                // Hide untouched auto-generated "Day N / Flashback"
                // presets from earlier uploads — recognised by the
                // generator's auto description ("Scenes: 1-3,7") and
                // empty hair/makeup/wardrobe. Once the user has put
                // any content in, the look becomes a real one and
                // shows up like any user-created look. New uploads
                // skip preset generation entirely (lookGenerator).
                if (l.id === cb.lookId) return true;
                const isPreset =
                  /^Scenes:/.test(l.description ?? '') &&
                  !l.hair &&
                  !l.makeup &&
                  !l.wardrobe;
                return !isPreset;
              })
              .slice()
              .sort((a, b) => {
                const tsA = parseInt(a.id.replace('look-', '').split('-')[0]) || 0;
                const tsB = parseInt(b.id.replace('look-', '').split('-')[0]) || 0;
                return tsB - tsA;
              })
              .map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
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

      {department === 'costume' && costumeData && onCostumeUpdate ? (
        /* ── Costume department fields ── */
        <CostumeBreakdownFields
          charId={char.id}
          sceneId={sceneId}
          data={costumeData}
          onChange={onCostumeUpdate}
        />
      ) : (
        /* ── HMU department fields (default) ── */
        <>
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

          <ShoppingListSection
            projectId={projectId}
            characterId={char.id}
            lookId={cb.lookId}
            characterEvents={characterEvents}
          />

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
        </>
      )}

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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SHOPPING LIST SECTION

   Per-character checkboxes for major HMU items the production has
   to source ahead of shooting (wig / facial hair / tattoo /
   prosthetic). Each ticked item gets a scope picker:
     - Look       (default)  — covers every scene with this look
     - Continuity            — covers the event's scene range
     - Storyline             — covers every scene the character is in

   The store dedupes by (character, kind, scope, scopeRef) so ticking
   "wig" on three different scenes that all use the same look results
   in one budget line item, not three.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function ShoppingListSection({
  projectId,
  characterId,
  lookId,
  characterEvents,
}: {
  projectId: string;
  characterId: string;
  lookId: string | undefined;
  characterEvents: ContinuityEvent[];
}) {
  const store = useShoppingFlagStore(projectId);
  const flags = store((s) => s.flags);
  const toggleFlag = store((s) => s.toggleFlag);
  const setScope = store((s) => s.setScope);

  // Default scope: 'look' if a look is set, else 'storyline'.
  const defaultScope: ShoppingFlagScope = lookId ? 'look' : 'storyline';
  const defaultScopeRef = lookId;

  return (
    <div className="cb-field cb-shopping">
      <label className="cb-label">Shopping list</label>
      <div className="cb-shopping-grid">
        {SHOPPING_FLAG_KINDS.map(({ id: kind, label }) => {
          // Show as ticked if ANY flag exists for this character/kind,
          // regardless of scope — the scope picker below shows which.
          const charFlags = flags.filter(
            (f) => f.characterId === characterId && f.kind === kind,
          );
          const ticked = charFlags.length > 0;
          // The active flag (if any) — used for the scope picker.
          // Prefer one matching the current look; fall back to any.
          const activeFlag =
            charFlags.find(
              (f) => f.scope === defaultScope &&
                (defaultScope === 'storyline' ||
                 f.lookId === defaultScopeRef ||
                 f.continuityEventId === defaultScopeRef),
            ) || charFlags[0];

          return (
            <div key={kind} className="cb-shopping-row">
              <label className="cb-shopping-check">
                <input
                  type="checkbox"
                  checked={ticked}
                  onChange={() => {
                    if (ticked && activeFlag) {
                      // Untick the existing flag(s).
                      charFlags.forEach((f) =>
                        toggleFlag(
                          characterId,
                          kind,
                          f.scope,
                          f.scope === 'look'
                            ? f.lookId
                            : f.scope === 'continuity'
                              ? f.continuityEventId
                              : undefined,
                        ),
                      );
                    } else {
                      toggleFlag(characterId, kind, defaultScope, defaultScopeRef);
                    }
                  }}
                />
                <span>{label}</span>
              </label>

              {ticked && activeFlag && (
                <div className="cb-shopping-scope">
                  <button
                    type="button"
                    className={`cb-scope-pill${activeFlag.scope === 'look' ? ' cb-scope-pill--active' : ''}`}
                    disabled={!lookId}
                    onClick={() => setScope(activeFlag.id, 'look', lookId)}
                  >
                    Look
                  </button>
                  <button
                    type="button"
                    className={`cb-scope-pill${activeFlag.scope === 'continuity' ? ' cb-scope-pill--active' : ''}`}
                    disabled={characterEvents.length === 0}
                    onClick={() =>
                      setScope(activeFlag.id, 'continuity', characterEvents[0]?.id)
                    }
                  >
                    Event
                  </button>
                  <button
                    type="button"
                    className={`cb-scope-pill${activeFlag.scope === 'storyline' ? ' cb-scope-pill--active' : ''}`}
                    onClick={() => setScope(activeFlag.id, 'storyline')}
                  >
                    Storyline
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
