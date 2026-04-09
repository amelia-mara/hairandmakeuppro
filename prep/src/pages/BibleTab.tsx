import { useState, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import {
  MOCK_SCENES, MOCK_CHARACTERS, MOCK_LOOKS,
  useBreakdownStore, useTagStore, useParsedScriptStore, useCharacterOverridesStore,
  type Scene, type Character, type Look,
} from '@/stores/breakdownStore';

/* ━━━ Types ━━━ */

interface SfxEntry {
  sceneNumber: number;
  characterName: string;
  description: string;
  type: 'SFX' | 'Prosth.';
  confirmed: boolean;
}

interface BibleSection {
  id: string;
  num: string;
  title: string;
  complete: boolean;
}

/* ━━━ BIBLE TAB ━━━ */

export function BibleTab({ projectId }: { projectId: string }) {
  const breakdownStore = useBreakdownStore();
  const tagStore = useTagStore();
  const bbProject = useProjectStore((s) => s.getProject(projectId));
  const bbDeptLabel = bbProject?.department === 'costume' ? 'Costume' : '{bbDeptLabel}';
  const parsedScriptStore = useParsedScriptStore();
  const overridesStore = useCharacterOverridesStore();

  const [activeSection, setActiveSection] = useState('overview');

  /* Resolve data source */
  const parsedData = parsedScriptStore.getParsedData(projectId);
  const scenes: Scene[] = useMemo(() => parsedData ? parsedData.scenes : MOCK_SCENES, [parsedData]);
  const rawCharacters: Character[] = useMemo(() => {
    if (!parsedData) return MOCK_CHARACTERS;
    return parsedData.characters.map((c) => ({ ...c, category: c.category || 'principal' as const }));
  }, [parsedData]);
  const looks: Look[] = useMemo(() => parsedData ? parsedData.looks : MOCK_LOOKS, [parsedData]);

  const characters = useMemo(
    () => rawCharacters.map((c) => overridesStore.getCharacter(c)).sort((a, b) => a.billing - b.billing),
    [rawCharacters, overridesStore],
  );

  /* SFX / Prosthetics register — gather from continuity events + sfx tags */
  const sfxEntries: SfxEntry[] = useMemo(() => {
    const entries: SfxEntry[] = [];
    for (const scene of scenes) {
      const bd = breakdownStore.getBreakdown(scene.id);
      const tags = tagStore.getTagsForScene(scene.id);

      /* Continuity events with type 'Prosthetic' */
      if (bd) {
        for (const ev of bd.continuityEvents) {
          if (ev.type === 'Prosthetic' || ev.type === 'Wound') {
            const ch = characters.find((c) => c.id === ev.characterId);
            entries.push({
              sceneNumber: scene.number,
              characterName: ch?.name || 'Unknown',
              description: ev.description || ev.name || ev.type,
              type: ev.type === 'Prosthetic' ? 'Prosth.' : 'SFX',
              confirmed: true,
            });
          }
        }

        /* Character-level SFX from breakdown */
        for (const cb of bd.characters) {
          if (cb.sfx) {
            const ch = characters.find((c) => c.id === cb.characterId);
            entries.push({
              sceneNumber: scene.number,
              characterName: ch?.name || 'Unknown',
              description: cb.sfx,
              type: 'SFX',
              confirmed: true,
            });
          }
        }
      }

      /* SFX tags from script annotation */
      const sfxTags = tags.filter((t) => t.categoryId === 'sfx');
      for (const tag of sfxTags) {
        const ch = tag.characterId ? characters.find((c) => c.id === tag.characterId) : null;
        entries.push({
          sceneNumber: scene.number,
          characterName: ch?.name || 'Unknown',
          description: tag.description || tag.text,
          type: 'SFX',
          confirmed: false,
        });
      }
    }
    /* Deduplicate by scene+char+desc */
    const seen = new Set<string>();
    return entries.filter((e) => {
      const key = `${e.sceneNumber}-${e.characterName}-${e.description}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => a.sceneNumber - b.sceneNumber);
  }, [scenes, breakdownStore, tagStore, characters]);

  /* Scene count per character */
  const charSceneCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of scenes) {
      for (const cid of s.characterIds) {
        counts[cid] = (counts[cid] || 0) + 1;
      }
    }
    return counts;
  }, [scenes]);

  /* Shoot days */
  const shootDays = useMemo(() => {
    const days = new Set<string>();
    for (const s of scenes) if (s.storyDay) days.add(s.storyDay);
    return days.size;
  }, [scenes]);

  /* Sections with completion status */
  const sections: BibleSection[] = useMemo(() => [
    { id: 'overview', num: '01', title: 'Overview', complete: true },
    { id: 'characters', num: '02', title: 'Characters', complete: characters.length > 0 },
    { id: 'sfx', num: '03', title: 'SFX Register', complete: sfxEntries.length > 0 },
    { id: 'continuity', num: '04', title: 'Continuity Rules', complete: false },
    { id: 'products', num: '05', title: 'Products', complete: false },
    { id: 'daily-notes', num: '06', title: 'Daily Notes', complete: false },
  ], [characters.length, sfxEntries.length]);

  const currentSection = sections.find((s) => s.id === activeSection) || sections[0];

  /* Helpers */
  const initials = (name: string) =>
    name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const billingShort = (n: number) => {
    if (n === 1) return '1st';
    if (n === 2) return '2nd';
    if (n === 3) return '3rd';
    return `${n}th`;
  };

  const avatarClass = (billing: number) => {
    if (billing === 1) return 'bb-ref-avatar--1st';
    if (billing === 2) return 'bb-ref-avatar--2nd';
    if (billing === 3) return 'bb-ref-avatar--3rd';
    return 'bb-ref-avatar--default';
  };

  return (
    <div className="bb-page">
      {/* Sidebar */}
      <div className="bb-sidebar">
        <div className="bb-sidebar-label">Sections</div>
        {sections.map((sec) => (
          <button
            key={sec.id}
            className={`bb-nav-item ${activeSection === sec.id ? 'bb-nav-item--active' : ''} ${sec.complete ? 'bb-nav-item--complete' : ''}`}
            onClick={() => setActiveSection(sec.id)}
          >
            <span className="bb-nav-num">{sec.num}</span>
            <span className="bb-nav-title">{sec.title}</span>
            <span className={`bb-nav-dot ${sec.complete ? 'bb-nav-dot--complete' : 'bb-nav-dot--progress'}`} />
          </button>
        ))}
        <div className="bb-sidebar-divider" />
        <div className="bb-sidebar-legend">
          <div className="bb-legend-label">Completion</div>
          <div className="bb-legend-row">
            <span className="bb-legend-dot bb-legend-dot--complete" />
            <span className="bb-legend-text">Complete</span>
          </div>
          <div className="bb-legend-row">
            <span className="bb-legend-dot bb-legend-dot--progress" />
            <span className="bb-legend-text">In progress</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="bb-main">
        <div className="bb-section-header">
          <div className="bb-section-title">{currentSection.num} — {currentSection.title}</div>
          <div className="bb-section-meta">Last updated today</div>
        </div>

        <div className="bb-content">
          {/* Section 01 — Overview */}
          {activeSection === 'overview' && (
            <>
              {/* Production Details */}
              <div className="bb-card">
                <div className="bb-card-title">Production Details</div>
                <div className="bb-detail-grid">
                  <div>
                    <div className="bb-field-label">Production</div>
                    <div className="bb-field-value">Short Film</div>
                  </div>
                  <div>
                    <div className="bb-field-label">HOD</div>
                    <div className="bb-field-value">Amelia Kildear</div>
                  </div>
                  <div>
                    <div className="bb-field-label">Shoot Days</div>
                    <div className="bb-field-value">{scenes.length} scenes · {shootDays} days</div>
                  </div>
                  <div>
                    <div className="bb-field-label">Department</div>
                    <div className="bb-field-value">{bbDeptLabel}</div>
                  </div>
                  <div>
                    <div className="bb-field-label">Characters</div>
                    <div className="bb-field-value">{characters.length} principals</div>
                  </div>
                  <div>
                    <div className="bb-field-label">SFX Scenes</div>
                    <div className="bb-field-value">{sfxEntries.length > 0 ? `${new Set(sfxEntries.map((e) => e.sceneNumber)).size} scenes flagged` : 'None flagged'}</div>
                  </div>
                </div>
              </div>

              <div className="bb-teal-rule" />

              {/* Character References */}
              <div className="bb-section-label">Character References</div>
              <div className="bb-char-refs">
                {characters.slice(0, 5).map((ch) => {
                  const charLooks = looks.filter((l) => l.characterId === ch.id);
                  return (
                    <div key={ch.id} className="bb-char-ref-card">
                      <div className="bb-ref-top">
                        <div className={`bb-ref-avatar ${avatarClass(ch.billing)}`}>
                          {initials(ch.name)}
                        </div>
                        <div>
                          <div className="bb-ref-name">{ch.name}</div>
                          <div className="bb-ref-meta">
                            {billingShort(ch.billing)} · {ch.gender?.charAt(0) || '?'} · Age {ch.age || '?'}
                          </div>
                        </div>
                      </div>
                      <div className="bb-ref-row">
                        <span className="bb-ref-label">Hair</span>
                        <span className="bb-ref-value">
                          {ch.hairColour}{ch.hairType ? `, ${ch.hairType.toLowerCase()}` : ''}
                        </span>
                      </div>
                      <div className="bb-ref-row">
                        <span className="bb-ref-label">Skin</span>
                        <span className="bb-ref-value">
                          {ch.skinTone || '—'}{ch.distinguishingFeatures ? `, ${ch.distinguishingFeatures.toLowerCase()}` : ''}
                        </span>
                      </div>
                      {charLooks.length > 0 && (
                        <div className="bb-ref-looks">
                          <span className="bb-ref-looks-label">Looks</span>
                          <div className="bb-look-tags">
                            {charLooks.map((lk) => (
                              <span key={lk.id} className="bb-look-tag">{lk.name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="bb-teal-rule" />

              {/* SFX / Prosthetics Register */}
              <div className="bb-sfx-card">
                <div className="bb-sfx-header">
                  <div className="bb-sfx-title">SFX / Prosthetics Register</div>
                  <div className="bb-sfx-count">{sfxEntries.length} flagged</div>
                </div>
                {sfxEntries.length > 0 ? (
                  sfxEntries.map((entry, i) => (
                    <div key={i} className={`bb-sfx-row ${!entry.confirmed ? 'bb-sfx-row--unconfirmed' : ''}`}>
                      <span className="bb-sfx-scene">Sc {entry.sceneNumber}</span>
                      <span className="bb-sfx-char">{entry.characterName}</span>
                      <span className="bb-sfx-desc">{entry.description}</span>
                      <span className={`bb-sfx-badge ${entry.type === 'SFX' ? 'bb-sfx-badge--sfx' : 'bb-sfx-badge--prosth'}`}>
                        {entry.type}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="bb-placeholder">
                    <div className="bb-placeholder-text">No SFX or prosthetics entries yet. Tag scenes with SFX in the Breakdown tab.</div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Section 02 — Characters */}
          {activeSection === 'characters' && (
            <>
              {characters.map((ch) => {
                const charLooks = looks.filter((l) => l.characterId === ch.id);
                return (
                  <div key={ch.id} className="bb-char-profile">
                    <div className="bb-char-profile-top">
                      <div className="bb-char-profile-avatar">{initials(ch.name)}</div>
                      <div>
                        <div className="bb-char-profile-name">{ch.name}</div>
                        <div className="bb-char-profile-meta">
                          {billingShort(ch.billing)} Billing · {ch.gender} · Age {ch.age || '?'} · {charSceneCount[ch.id] || 0} scenes
                        </div>
                      </div>
                    </div>
                    <div className="bb-char-detail-grid">
                      <div>
                        <div className="bb-char-detail-label">Hair Colour</div>
                        <div className="bb-char-detail-value">{ch.hairColour || '—'}</div>
                      </div>
                      <div>
                        <div className="bb-char-detail-label">Hair Type</div>
                        <div className="bb-char-detail-value">{ch.hairType || '—'}</div>
                      </div>
                      <div>
                        <div className="bb-char-detail-label">Eye Colour</div>
                        <div className="bb-char-detail-value">{ch.eyeColour || '—'}</div>
                      </div>
                      <div>
                        <div className="bb-char-detail-label">Skin Tone</div>
                        <div className="bb-char-detail-value">{ch.skinTone || '—'}</div>
                      </div>
                      <div>
                        <div className="bb-char-detail-label">Build</div>
                        <div className="bb-char-detail-value">{ch.build || '—'}</div>
                      </div>
                      <div>
                        <div className="bb-char-detail-label">Distinguishing Features</div>
                        <div className="bb-char-detail-value">{ch.distinguishingFeatures || '—'}</div>
                      </div>
                    </div>
                    {charLooks.length > 0 && (
                      <div className="bb-char-notes">
                        <div className="bb-char-notes-label">Looks</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                          {charLooks.map((lk) => (
                            <span key={lk.id} className="bb-look-tag">{lk.name} — {lk.description}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {ch.notes && (
                      <div className="bb-char-notes">
                        <div className="bb-char-notes-label">Notes</div>
                        <div className="bb-char-notes-text">{ch.notes}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* Section 03 — SFX Register (full view) */}
          {activeSection === 'sfx' && (
            <div className="bb-sfx-card">
              <div className="bb-sfx-header">
                <div className="bb-sfx-title">SFX / Prosthetics Register</div>
                <div className="bb-sfx-count">{sfxEntries.length} flagged</div>
              </div>
              {sfxEntries.length > 0 ? (
                sfxEntries.map((entry, i) => (
                  <div key={i} className={`bb-sfx-row ${!entry.confirmed ? 'bb-sfx-row--unconfirmed' : ''}`}>
                    <span className="bb-sfx-scene">Sc {entry.sceneNumber}</span>
                    <span className="bb-sfx-char">{entry.characterName}</span>
                    <span className="bb-sfx-desc">{entry.description}</span>
                    <span className={`bb-sfx-badge ${entry.type === 'SFX' ? 'bb-sfx-badge--sfx' : 'bb-sfx-badge--prosth'}`}>
                      {entry.type}
                    </span>
                  </div>
                ))
              ) : (
                <div className="bb-placeholder">
                  <div className="bb-placeholder-text">No SFX or prosthetics entries yet. Tag scenes with SFX in the Breakdown tab.</div>
                </div>
              )}
            </div>
          )}

          {/* Section 04 — Continuity Rules */}
          {activeSection === 'continuity' && (
            <div className="bb-placeholder">
              <div className="bb-placeholder-icon">&#128221;</div>
              <div>Continuity Rules</div>
              <div className="bb-placeholder-text">
                Production-wide continuity rules will appear here once added.
              </div>
            </div>
          )}

          {/* Section 05 — Products */}
          {activeSection === 'products' && (
            <div className="bb-placeholder">
              <div className="bb-placeholder-icon">&#128230;</div>
              <div>Products</div>
              <div className="bb-placeholder-text">
                Product lists with supplier and shade references will appear here.
              </div>
            </div>
          )}

          {/* Section 06 — Daily Notes */}
          {activeSection === 'daily-notes' && (
            <div className="bb-placeholder">
              <div className="bb-placeholder-icon">&#128466;</div>
              <div>Daily Notes</div>
              <div className="bb-placeholder-text">
                Scene-level notes flagged during the shoot will be aggregated here.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
