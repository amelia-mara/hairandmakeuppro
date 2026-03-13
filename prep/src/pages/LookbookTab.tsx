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

  const [filterChar, setFilterChar] = useState<string>('');
  const [sortBy, setSortBy] = useState<'billing' | 'name'>('billing');

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
    () => rawCharacters.map((c) => overridesStore.getCharacter(c)),
    [rawCharacters, overridesStore],
  );

  /* Sort characters */
  const sortedCharacters = useMemo(() => {
    const list = filterChar
      ? characters.filter((c) => c.id === filterChar)
      : [...characters];
    if (sortBy === 'billing') list.sort((a, b) => a.billing - b.billing);
    else list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [characters, filterChar, sortBy]);

  /* Scene map: lookId → scene numbers (confirmed or not) */
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



  const billingLabel = (n: number) => {
    if (n === 1) return '1st Billing';
    if (n === 2) return '2nd Billing';
    if (n === 3) return '3rd Billing';
    return `${n}th Billing`;
  };

  const billingClass = (n: number) => {
    if (n === 1) return 'lb-pill--orange';
    if (n === 2) return 'lb-pill--brown';
    if (n === 3) return 'lb-pill--teal';
    return '';
  };

  const initials = (name: string) =>
    name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const handleCopy = () => {
    const lines: string[] = [];
    for (const ch of sortedCharacters) {
      const charLooks = looks.filter((l) => l.characterId === ch.id);
      lines.push(ch.name);
      for (const lk of charLooks) {
        lines.push(`  ${lk.name} — ${lk.description}`);
        if (lk.hair) lines.push(`    HAIR: ${lk.hair}`);
        if (lk.makeup) lines.push(`    MAKEUP: ${lk.makeup}`);
        if (lk.wardrobe) lines.push(`    WARDROBE: ${lk.wardrobe}`);
      }
      lines.push('');
    }
    navigator.clipboard.writeText(lines.join('\n'));
  };

  return (
    <div className="lb-page">
      {/* Filter / action bar */}
      <div className="lb-toolbar">
        <div className="lb-toolbar-left">
          <select
            className="lb-filter-select"
            value={filterChar}
            onChange={(e) => setFilterChar(e.target.value)}
          >
            <option value="">All Characters</option>
            {characters
              .slice()
              .sort((a, b) => a.billing - b.billing)
              .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="lb-toolbar-right">
          <button
            className="lb-sort-btn"
            onClick={() => setSortBy(sortBy === 'billing' ? 'name' : 'billing')}
          >
            <SortIcon /> Sort by {sortBy === 'billing' ? 'Billing' : 'Name'}
          </button>
          <button className="lb-copy-btn" onClick={handleCopy}>
            <CopyIcon /> Copy
          </button>
        </div>
      </div>

      {/* Column grid */}
      <div className="lb-grid" style={{ gridTemplateColumns: `repeat(${sortedCharacters.length}, 1fr)` }}>
        {sortedCharacters.map((ch) => {
          const charLooks = looks.filter((l) => l.characterId === ch.id);

          return (
            <div key={ch.id} className="lb-column">
              {/* Character header */}
              <div className="lb-char-header">
                <div className="lb-char-top">
                  <div className="lb-avatar">{initials(ch.name)}</div>
                  <div className="lb-char-info">
                    <div className="lb-char-name">{ch.name}</div>
                    <div className="lb-char-meta">
                      {[ch.gender, ch.age ? `Age ${ch.age}` : '', `${charSceneCount[ch.id] || 0} scenes`]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                </div>
                <div className="lb-pills">
                  <span className={`lb-pill ${billingClass(ch.billing)}`}>{billingLabel(ch.billing)}</span>
                  {ch.hairColour && <span className="lb-pill">{ch.hairColour} hair</span>}
                  {ch.skinTone && <span className="lb-pill">{ch.skinTone} skin</span>}
                </div>
              </div>

              {/* Look cards */}
              <div className="lb-looks-scroll">
                {charLooks.map((lk) => {
                  const sceneEntries = lookSceneMap[lk.id] || [];
                  return (
                    <div key={lk.id} className="lb-look-card">
                      <div className="lb-look-title">
                        <span className="lb-look-name">{lk.name}</span>
                        {lk.description && (
                          <span className="lb-look-desc"> — {lk.description}</span>
                        )}
                      </div>
                      <div className="lb-look-rule" />
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
                      {sceneEntries.length > 0 && (
                        <div className="lb-scene-strip">
                          {sceneEntries
                            .sort((a, b) => a.sceneNumber - b.sceneNumber)
                            .map((se, i) => (
                              <span
                                key={i}
                                className={`lb-scene-pill ${se.confirmed ? 'lb-scene-pill--confirmed' : ''}`}
                              >
                                Sc {se.sceneNumber}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add Look CTA */}
                <button className="lb-add-look">
                  <span className="lb-add-icon">+</span> Add Look
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {sortedCharacters.length === 0 && (
        <div className="lb-empty">
          <p>No characters found{filterChar ? ' for this filter' : ''}.</p>
        </div>
      )}
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

function SortIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M6 12h12M9 18h6" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}
