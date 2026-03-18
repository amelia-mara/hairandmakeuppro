import { useState, useMemo } from 'react';
import {
  MOCK_SCENES, MOCK_CHARACTERS, MOCK_LOOKS,
  useBreakdownStore, useParsedScriptStore, useCharacterOverridesStore,
  type Scene, type Character, type Look,
} from '@/stores/breakdownStore';

/* ━━━ LOOKBOOK TAB ━━━ */

export function LookbookTab({ projectId }: { projectId: string }) {
  const breakdownStore = useBreakdownStore();
  const parsedScriptStore = useParsedScriptStore();
  const overridesStore = useCharacterOverridesStore();

  const [activeCharId, setActiveCharId] = useState<string>('');

  /* Resolve data source */
  const parsedData = parsedScriptStore.getParsedData(projectId);
  const scenes: Scene[] = useMemo(() => parsedData ? parsedData.scenes : MOCK_SCENES, [parsedData]);
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
    <div className="lb-page">
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
                onClick={() => setActiveCharId(ch.id)}
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
              <button className="lb-add-look-btn">
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
                <button className="lb-add-look-card">
                  <PlusIcon size={20} />
                  <span>Add Look</span>
                </button>
              </div>

              {/* Unassigned scenes notice */}
              {unassignedScenes.length > 0 && (
                <div className="lb-unassigned-bar">
                  <div className="lb-unassigned-left">
                    <WarningIcon />
                    <span>
                      {unassignedScenes.map((s) => `Sc ${s.number}`).join(', ')} ha{unassignedScenes.length === 1 ? 's' : 've'} no look assigned for {activeChar.name}
                    </span>
                  </div>
                  <button className="lb-unassigned-action">Assign look</button>
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
