import { useState, useMemo, useEffect } from 'react';
import {
  MOCK_SCENES, MOCK_CHARACTERS, MOCK_LOOKS,
  useBreakdownStore, useParsedScriptStore, useCharacterOverridesStore,
  type Scene, type Character, type Look,
} from '@/stores/breakdownStore';
import { useIsMobile } from '@/hooks/useIsMobile';

/* ━━━ LOOKBOOK TAB ━━━ */

export function LookbookTab({ projectId }: { projectId: string }) {
  const breakdownStore = useBreakdownStore();
  const parsedScriptStore = useParsedScriptStore();
  const overridesStore = useCharacterOverridesStore();

  const [activeCharId, setActiveCharId] = useState<string>('');

  /* Mobile-only — phone viewport (≤768px) hides the character sidebar
     by default and slides it in as a drawer when ☰ is tapped. Picking
     a character auto-closes the drawer. */
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => { if (!isMobile) setDrawerOpen(false); }, [isMobile]);
  const pickChar = (id: string) => { setActiveCharId(id); setDrawerOpen(false); };

  /* Resolve data source */
  const parsedData = parsedScriptStore.getParsedData(projectId);
  const scenes: Scene[] = useMemo(() => {
    const arr = parsedData ? parsedData.scenes : MOCK_SCENES;
    return [...arr].sort((a, b) => a.number - b.number);
  }, [parsedData]);
  const rawCharacters: Character[] = useMemo(() => {
    if (!parsedData) return MOCK_CHARACTERS;
    return parsedData.characters.map((c) => ({ ...c, category: c.category || 'principal' as const }));
  }, [parsedData]);
  const looks: Look[] = useMemo(() => parsedData ? parsedData.looks : MOCK_LOOKS, [parsedData]);

  /* Apply character overrides (profile edits) */
  const characters = useMemo(
    () => rawCharacters.map((c) => overridesStore.getCharacter(c)).sort((a, b) => a.billing - b.billing),
    [rawCharacters, overridesStore],
  );

  /* Default to first character */
  const selectedId = characters.find((c) => c.id === activeCharId) ? activeCharId : characters[0]?.id ?? '';
  if (selectedId !== activeCharId && selectedId) {
    setActiveCharId(selectedId);
  }
  const activeChar = characters.find((c) => c.id === selectedId);

  /* Scene map: lookId → scene numbers */
  const lookSceneMap = useMemo(() => {
    const map: Record<string, { sceneNumber: number; confirmed: boolean }[]> = {};
    for (const s of scenes) {
      const bd = breakdownStore.getBreakdown(s.id);
      if (!bd) continue;
      for (const cb of bd.characters) {
        if (cb.lookId) {
          if (!map[cb.lookId]) map[cb.lookId] = [];
          map[cb.lookId].push({ sceneNumber: s.number, confirmed: true });
        }
      }
    }
    return map;
  }, [scenes, breakdownStore]);

  /* Count scenes per character */
  const charSceneCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of scenes) {
      for (const cid of s.characterIds) {
        counts[cid] = (counts[cid] || 0) + 1;
      }
    }
    return counts;
  }, [scenes]);

  /* Looks per character count */
  const charLookCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lk of looks) {
      counts[lk.characterId] = (counts[lk.characterId] || 0) + 1;
    }
    return counts;
  }, [looks]);

  /* Unassigned scenes for active character */
  const unassignedScenes = useMemo(() => {
    if (!activeChar) return [];
    const charScenes = scenes.filter((s) => s.characterIds.includes(activeChar.id));
    return charScenes.filter((s) => {
      const bd = breakdownStore.getBreakdown(s.id);
      if (!bd) return true;
      const cb = bd.characters.find((c) => c.characterId === activeChar.id);
      return !cb?.lookId;
    });
  }, [activeChar, scenes, breakdownStore]);

  const charLooks = activeChar ? looks.filter((l) => l.characterId === activeChar.id) : [];

  /* Add a blank look for the active character. Uses the next available
     "Look A / B / C…" letter so the user has something to rename. */
  const handleAddLook = () => {
    if (!activeChar) return;
    const existingNames = new Set(charLooks.map((l) => l.name.toUpperCase()));
    let letterIdx = 0;
    let candidate = `Look ${String.fromCharCode(65 + letterIdx)}`;
    while (existingNames.has(candidate.toUpperCase()) && letterIdx < 25) {
      letterIdx++;
      candidate = `Look ${String.fromCharCode(65 + letterIdx)}`;
    }
    const newLook: Look = {
      id: crypto.randomUUID(),
      characterId: activeChar.id,
      name: candidate,
      description: '',
      hair: '',
      makeup: '',
      wardrobe: '',
    };
    parsedScriptStore.addLook(projectId, newLook);
  };

  /* Bulk-assign a look to every scene where the active character
     currently has no look. Sets each scene's breakdown.characters[i].lookId
     to the chosen look so the Scene Breakdown panel and Continuity
     immediately reflect it. */
  const [assignLookOpen, setAssignLookOpen] = useState(false);
  const handleAssignLookToUnassigned = (lookId: string) => {
    if (!activeChar) return;
    for (const scene of unassignedScenes) {
      const bd = breakdownStore.getBreakdown(scene.id);
      if (bd) {
        // Existing breakdown — update the character's lookId, adding the
        // character row first if it isn't there yet.
        const hasCharRow = bd.characters.some((c) => c.characterId === activeChar.id);
        if (hasCharRow) {
          breakdownStore.updateCharacterBreakdown(scene.id, activeChar.id, { lookId });
        } else {
          breakdownStore.setBreakdown(scene.id, {
            ...bd,
            characters: [
              ...bd.characters,
              {
                characterId: activeChar.id,
                lookId,
                entersWith: { hair: '', makeup: '', wardrobe: '' },
                sfx: '', environmental: '', action: '',
                changeType: 'no-change' as const, changeNotes: '',
                exitsWith: { hair: '', makeup: '', wardrobe: '' },
                notes: '',
              },
            ],
          });
        }
      } else {
        // No breakdown yet — seed it with all current scene characters,
        // setting the active one's lookId.
        breakdownStore.setBreakdown(scene.id, {
          sceneId: scene.id,
          timeline: { day: scene.storyDay || '', time: '', type: '', note: '' },
          characters: scene.characterIds.map((cid) => ({
            characterId: cid,
            lookId: cid === activeChar.id ? lookId : '',
            entersWith: { hair: '', makeup: '', wardrobe: '' },
            sfx: '', environmental: '', action: '',
            changeType: 'no-change' as const, changeNotes: '',
            exitsWith: { hair: '', makeup: '', wardrobe: '' },
            notes: '',
          })),
          continuityEvents: [],
        });
      }
    }
    setAssignLookOpen(false);
  };

  /* Helpers */
  const billingLabel = (n: number) => {
    if (n === 1) return '1st Billing';
    if (n === 2) return '2nd Billing';
    if (n === 3) return '3rd Billing';
    return `${n}th Billing`;
  };

  const billingShort = (n: number) => {
    if (n === 1) return '1st Billing';
    if (n === 2) return '2nd Billing';
    if (n === 3) return '3rd Billing';
    return `${n}th Billing`;
  };

  const initials = (name: string) =>
    name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const MAX_DOTS = 4;

  return (
    <div className={`lb-page${isMobile ? ' lb-page--mobile' : ''}${isMobile && drawerOpen ? ' lb-page--drawer-open' : ''}`}>
      {/* Mobile drawer backdrop */}
      {isMobile && drawerOpen && (
        <div className="lb-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
      )}
      {/* ━━━ LEFT — Character sidebar ━━━ */}
      <div className="lb-sidebar">
        <div className="lb-sidebar-header">
          <span className="lb-sidebar-label">Characters</span>
          <span className="lb-sidebar-count">{characters.length}</span>
        </div>
        <div className="lb-sidebar-list">
          {characters.map((ch) => {
            const isActive = ch.id === selectedId;
            const lookCount = charLookCount[ch.id] || 0;
            const sceneCount = charSceneCount[ch.id] || 0;
            const hasLooks = lookCount > 0;
            return (
              <button
                key={ch.id}
                className={`lb-sidebar-item ${isActive ? 'lb-sidebar-item--active' : ''} ${!hasLooks ? 'lb-sidebar-item--dim' : ''}`}
                onClick={() => pickChar(ch.id)}
              >
                <div className={`lb-sidebar-avatar ${isActive ? 'lb-sidebar-avatar--active' : ''}`}>
                  {initials(ch.name)}
                </div>
                <div className="lb-sidebar-info">
                  <div className="lb-sidebar-name">{ch.name}</div>
                  <div className="lb-sidebar-meta">
                    {ch.gender?.charAt(0)} · Age {ch.age || '?'} · {sceneCount} scenes
                  </div>
                  <span className="lb-sidebar-billing">{billingLabel(ch.billing)}</span>
                  <div className="lb-sidebar-look-count">{lookCount} look{lookCount !== 1 ? 's' : ''}{!hasLooks ? ' yet' : ''}</div>
                </div>
                <div className="lb-sidebar-dots">
                  {Array.from({ length: Math.min(MAX_DOTS, Math.max(lookCount, 1)) }).map((_, i) => (
                    <span key={i} className={`lb-sidebar-dot ${i < lookCount ? 'lb-sidebar-dot--filled' : ''}`} />
                  ))}
                  {lookCount > MAX_DOTS && <span className="lb-sidebar-dot-extra">+{lookCount - MAX_DOTS}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ━━━ RIGHT — Character look sheet ━━━ */}
      <div className="lb-main">
        {activeChar ? (
          <>
            {/* Hero header */}
            <div className="lb-hero">
              <div className="lb-hero-left">
                {isMobile && (
                  <button
                    type="button"
                    className="lb-drawer-toggle"
                    aria-label="Open characters"
                    onClick={() => setDrawerOpen(true)}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="3" y1="6" x2="21" y2="6"/>
                      <line x1="3" y1="12" x2="21" y2="12"/>
                      <line x1="3" y1="18" x2="21" y2="18"/>
                    </svg>
                  </button>
                )}
                <div className="lb-hero-avatar">{initials(activeChar.name)}</div>
                <div className="lb-hero-info">
                  <h2 className="lb-hero-name">{activeChar.name}</h2>
                  <div className="lb-hero-meta">
                    {[
                      billingShort(activeChar.billing),
                      activeChar.gender,
                      activeChar.age ? `Age ${activeChar.age}` : '',
                      `${charSceneCount[activeChar.id] || 0} scenes`,
                      activeChar.hairColour ? `${activeChar.hairColour} hair` : '',
                      activeChar.skinTone ? `${activeChar.skinTone} skin` : '',
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
              <button className="lb-add-look-btn" onClick={handleAddLook}>
                <PlusIcon /> Add Look
              </button>
            </div>

            {/* Attribute pills */}
            <div className="lb-pills-row">
              <span className="lb-pill lb-pill--orange">{billingLabel(activeChar.billing)}</span>
              {activeChar.hairColour && <span className="lb-pill">{activeChar.hairColour} hair</span>}
              {activeChar.skinTone && <span className="lb-pill">{activeChar.skinTone} skin</span>}
              {activeChar.build && <span className="lb-pill">{activeChar.build} build</span>}
              {activeChar.distinguishingFeatures && <span className="lb-pill">{activeChar.distinguishingFeatures}</span>}
              {activeChar.age && <span className="lb-pill">Age {activeChar.age}</span>}
            </div>

            {/* Looks area */}
            <div className="lb-looks-area">
              <div className="lb-looks-row">
                {charLooks.map((lk) => {
                  const sceneEntries = lookSceneMap[lk.id] || [];
                  return (
                    <div key={lk.id} className="lb-look-card">
                      <div className="lb-look-header">
                        <div className="lb-look-name">{lk.name}</div>
                        {lk.description && (
                          <div className="lb-look-desc">{lk.description}</div>
                        )}
                      </div>
                      <div className="lb-look-rule" />
                      <div className="lb-look-body">
                        {lk.hair && (
                          <div className="lb-look-row">
                            <span className="lb-look-label">Hair</span>
                            <span className="lb-look-value">{lk.hair}</span>
                          </div>
                        )}
                        {lk.makeup && (
                          <div className="lb-look-row">
                            <span className="lb-look-label">Makeup</span>
                            <span className="lb-look-value">{lk.makeup}</span>
                          </div>
                        )}
                        {lk.wardrobe && (
                          <div className="lb-look-row">
                            <span className="lb-look-label">Wardrobe</span>
                            <span className="lb-look-value">{lk.wardrobe}</span>
                          </div>
                        )}
                      </div>
                      {sceneEntries.length > 0 && (
                        <div className="lb-look-scenes">
                          <span className="lb-look-scenes-label">Scenes</span>
                          <div className="lb-scene-strip">
                            {sceneEntries
                              .sort((a, b) => a.sceneNumber - b.sceneNumber)
                              .map((se, i) => (
                                <span key={i} className={`lb-scene-pill ${se.confirmed ? 'lb-scene-pill--confirmed' : ''}`}>
                                  Sc {se.sceneNumber}
                                </span>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add Look card */}
                <button className="lb-add-look-card" onClick={handleAddLook}>
                  <PlusIcon size={20} />
                  <span>Add Look</span>
                </button>
              </div>

              {/* Unassigned scenes notice */}
              {unassignedScenes.length > 0 && (
                <div className="lb-unassigned-bar" style={{ position: 'relative' }}>
                  <div className="lb-unassigned-left">
                    <WarningIcon />
                    <span>
                      {unassignedScenes.map((s) => `Sc ${s.number}`).join(', ')} ha{unassignedScenes.length === 1 ? 's' : 've'} no look assigned for {activeChar.name}
                    </span>
                  </div>
                  <button
                    className="lb-unassigned-action"
                    onClick={() => setAssignLookOpen((v) => !v)}
                  >
                    Assign look
                  </button>
                  {assignLookOpen && (
                    <div
                      role="menu"
                      style={{
                        position: 'absolute', top: '100%', right: 0, marginTop: 4,
                        background: 'var(--surface, #fff)',
                        border: '1px solid var(--border, #ccc)',
                        borderRadius: 6, padding: 4, minWidth: 180,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                        zIndex: 10,
                      }}
                    >
                      {charLooks.length === 0 ? (
                        <div style={{ padding: '8px 12px', fontSize: 13, opacity: 0.7 }}>
                          No looks yet — add one first.
                        </div>
                      ) : (
                        charLooks.map((lk) => (
                          <button
                            key={lk.id}
                            onClick={() => handleAssignLookToUnassigned(lk.id)}
                            style={{
                              display: 'block', width: '100%', textAlign: 'left',
                              padding: '6px 12px', background: 'transparent',
                              border: 'none', cursor: 'pointer', fontSize: 13,
                            }}
                          >
                            {lk.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="lb-empty">
            <p>No characters found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ━━━ Metadata helpers for parent ━━━ */
export function useLookbookMeta(projectId: string) {
  const parsedScriptStore = useParsedScriptStore();
  const parsedData = parsedScriptStore.getParsedData(projectId);
  const characters = parsedData ? parsedData.characters : MOCK_CHARACTERS;
  const looks = parsedData ? parsedData.looks : MOCK_LOOKS;
  return { characterCount: characters.length, lookCount: looks.length };
}

/* ━━━ Icons ━━━ */

function PlusIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
