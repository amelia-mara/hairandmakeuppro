import { useState, useCallback } from 'react';
import {
  BREAKDOWN_CATEGORIES,
  useBreakdownStore,
  useTagStore,
  useCharacterOverridesStore,
  type Character,
  type Scene,
  type Look,
} from '@/stores/breakdownStore';
import { ordinal } from '@/utils/ordinal';

/**
 * Character detail view rendered in the center panel when a character
 * tab is selected. Shows a header (avatar + name + billing + meta),
 * a 5-tab strip, and the active tab's content:
 *
 *   - Profile — editable grid of character profile fields (age,
 *     gender, hair colour, etc.) via useCharacterOverridesStore
 *   - Lookbook — cards for each of the character's looks, sorted by
 *     earliest scene appearance, with hair / makeup / wardrobe rows
 *   - Timeline — scene list with story-day badges, read from
 *     useBreakdownStore
 *   - Events — placeholder ("No continuity events for this character")
 *   - Script Notes — tag cards (text, category colour, scene number,
 *     remove button) from useTagStore, filtered to non-name tags
 *
 * Calls useBreakdownStore / useTagStore / useCharacterOverridesStore
 * internally. The parent passes the character, the full scene list,
 * and the full look list as props; everything else is derived or
 * store-read inside the component.
 */
export function CharacterView({ char, allScenes, allLooks }: {
  char: Character;
  allScenes: Scene[];
  allLooks: Look[];
}) {
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
            {looks.length === 0 ? <p className="cv-empty">No looks created.</p> : looks.slice().sort((a, b) => {
              // Sort by earliest scene number where the look is used
              const earliestScene = (lookId: string) => {
                let min = Infinity;
                for (const s of scenes) {
                  const bd = bdStore.getBreakdown(s.id);
                  if (bd?.characters.some(c => c.lookId === lookId)) {
                    min = Math.min(min, s.number);
                  }
                }
                return min;
              };
              return earliestScene(a.id) - earliestScene(b.id);
            }).map((lk) => (
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
