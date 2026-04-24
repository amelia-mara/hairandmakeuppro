import { useState, useCallback, useMemo, useRef } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import {
  MOCK_SCENES, MOCK_CHARACTERS,
  useParsedScriptStore,
  useCharacterOverridesStore,
  type Character, type Scene,
} from '@/stores/breakdownStore';

/* ━━━ Types ━━━ */

interface Props {
  projectId: string;
}

interface CharacterDesignData {
  characterId: string;
  actor: string;
  palette: string[];
  paletteLabels: string[];
  images: Record<string, string>; // zone key → data URL
  notes: { desc: string; refs: string; hair: string; mua: string };
  sceneLooks: { sceneId: string; look: string; notes: string }[];
  completion: number;
}

type ViewMode = 'gallery' | 'detail';
type FilterMode = 'all' | 'lead' | 'supporting' | 'complete';

const IMAGE_ZONES: readonly { key: string; label: string; sublabel?: string; className: string }[] = [
  { key: 'face', label: 'Face Reference', sublabel: 'Actor / character ref', className: 'cd-iz-face' },
  { key: 'hair1', label: 'Hair Ref 1', className: 'cd-iz-small' },
  { key: 'hair2', label: 'Hair Ref 2', className: 'cd-iz-small' },
  { key: 'hair3', label: 'Hair Ref 3', className: 'cd-iz-small' },
  { key: 'mua1', label: 'MUA Ref 1', className: 'cd-iz-small' },
  { key: 'mua2', label: 'MUA Ref 2', className: 'cd-iz-small' },
  { key: 'mua3', label: 'MUA Ref 3', className: 'cd-iz-small' },
];

const LOOK_COLORS: Record<string, string> = {
  A: '#D4691E', B: '#3A9E8A', C: '#B8922A', D: '#8B5A8B', E: '#5A8B7A', F: '#8B7A5A',
};

const DEFAULT_PALETTE = ['#D4A882', '#8B4513', '#C17A4A', '#3D2B1F', '#E8C9A0', '#F5E6D3'];
const DEFAULT_PALETTE_LABELS = ['Base', 'Brow', 'Contour', 'Liner', 'Highlight', 'Skin Tone'];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getCharacterColor(index: number): { color: string; colorBg: string } {
  const colors = [
    { color: '#C4845A', colorBg: 'rgba(196,132,90,0.12)' },
    { color: '#5A7C8B', colorBg: 'rgba(90,124,139,0.12)' },
    { color: '#8B5E8B', colorBg: 'rgba(139,94,139,0.12)' },
    { color: '#6B6B4A', colorBg: 'rgba(107,107,74,0.12)' },
    { color: '#7A8B7A', colorBg: 'rgba(122,139,122,0.12)' },
    { color: '#8B6A4A', colorBg: 'rgba(139,106,74,0.12)' },
  ];
  return colors[index % colors.length];
}

function calcCompletion(data: CharacterDesignData): number {
  let score = 0;
  if (data.notes.desc) score += 20;
  if (data.notes.refs) score += 15;
  if (data.notes.hair) score += 15;
  if (data.notes.mua) score += 15;
  if (data.actor) score += 10;
  if (data.images.face) score += 25;
  return Math.min(100, score);
}

/* ━━━ Persistent store for character design boards ━━━ */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface CharacterDesignStore {
  boards: Record<string, Record<string, CharacterDesignData>>; // projectId → characterId → data
  getBoard(projectId: string, characterId: string): CharacterDesignData | undefined;
  setBoard(projectId: string, characterId: string, data: CharacterDesignData): void;
}

const useCharacterDesignStore = create<CharacterDesignStore>()(
  persist(
    (set, get) => ({
      boards: {},
      getBoard(projectId, characterId) {
        return get().boards[projectId]?.[characterId];
      },
      setBoard(projectId, characterId, data) {
        set((state) => ({
          boards: {
            ...state.boards,
            [projectId]: {
              ...(state.boards[projectId] || {}),
              [characterId]: data,
            },
          },
        }));
      },
    }),
    {
      name: 'prep-character-design',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/* ━━━ Component ━━━ */

export function CharacterDesign({ projectId }: Props) {
  const [view, setView] = useState<ViewMode>('gallery');
  const [filter, setFilter] = useState<FilterMode>('all');
  const cdProject = useProjectStore((s) => s.getProject(projectId));
  const cdDeptLabel = cdProject?.department === 'costume' ? 'Costume' : 'Hair & Makeup';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCharId, setSelectedCharId] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);

  // Local working state for the detail view
  const [localBoard, setLocalBoard] = useState<CharacterDesignData | null>(null);

  const parsedScriptStore = useParsedScriptStore();
  const overridesStore = useCharacterOverridesStore();
  const designStore = useCharacterDesignStore();

  const parsedData = parsedScriptStore.getParsedData(projectId);
  const allCharacters: Character[] = useMemo(() => {
    if (!parsedData) return MOCK_CHARACTERS;
    return parsedData.characters.map((c) => ({
      ...c,
      category: c.category || 'principal',
    }));
  }, [parsedData]);

  const allScenes: Scene[] = useMemo(() => {
    const arr = parsedData ? parsedData.scenes : MOCK_SCENES;
    return [...arr].sort((a, b) => a.number - b.number);
  }, [parsedData]);

  // Map characters with their design data
  const charactersWithDesign = useMemo(() => {
    return allCharacters.map((char, i) => {
      const board = designStore.getBoard(projectId, char.id);
      const { color, colorBg } = getCharacterColor(i);
      const scenesForChar = allScenes.filter((s) => s.characterIds.includes(char.id));
      const charWithOverrides = overridesStore.getCharacter(char);
      return {
        character: charWithOverrides,
        color,
        colorBg,
        initials: getInitials(charWithOverrides.name),
        scenes: scenesForChar,
        board,
        roleLabel: char.category === 'principal' ? 'Lead' : 'Supporting',
      };
    });
  }, [allCharacters, allScenes, projectId, designStore, overridesStore]);

  const filteredCharacters = useMemo(() => {
    return charactersWithDesign.filter((c) => {
      const matchFilter =
        filter === 'all' ||
        (filter === 'lead' && c.character.category === 'principal') ||
        (filter === 'supporting' && c.character.category === 'supporting_artist') ||
        (filter === 'complete' && (c.board?.completion ?? 0) >= 80);
      const matchSearch =
        !searchQuery || c.character.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [charactersWithDesign, filter, searchQuery]);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ─── Detail helpers ───
  const getOrCreateBoard = useCallback(
    (charId: string): CharacterDesignData => {
      const existing = designStore.getBoard(projectId, charId);
      if (existing) return { ...existing };
      const char = allCharacters.find((c) => c.id === charId);
      const scenesForChar = allScenes.filter((s) => s.characterIds.includes(charId));
      return {
        characterId: charId,
        actor: '',
        palette: [...DEFAULT_PALETTE],
        paletteLabels: [...DEFAULT_PALETTE_LABELS],
        images: {},
        notes: { desc: char?.notes || '', refs: '', hair: '', mua: '' },
        sceneLooks: scenesForChar.map((s) => ({ sceneId: s.id, look: '', notes: '' })),
        completion: 0,
      };
    },
    [projectId, allCharacters, allScenes, designStore],
  );

  const openDetail = useCallback(
    (charId: string) => {
      setSelectedCharId(charId);
      const board = getOrCreateBoard(charId);
      setLocalBoard(board);
      setView('detail');
      setIsDirty(false);
      window.scrollTo(0, 0);
    },
    [getOrCreateBoard],
  );

  const showGallery = useCallback(() => {
    setView('gallery');
    setIsDirty(false);
    setLocalBoard(null);
  }, []);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const updateLocalBoard = useCallback(
    (updater: (prev: CharacterDesignData) => CharacterDesignData) => {
      setLocalBoard((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        return next;
      });
      markDirty();
    },
    [markDirty],
  );

  const saveBoard = useCallback(() => {
    if (!localBoard) return;
    const updated = { ...localBoard, completion: calcCompletion(localBoard) };
    designStore.setBoard(projectId, selectedCharId, updated);
    setLocalBoard(updated);
    setIsDirty(false);
  }, [localBoard, projectId, selectedCharId, designStore]);

  const discardChanges = useCallback(() => {
    const board = getOrCreateBoard(selectedCharId);
    setLocalBoard(board);
    setIsDirty(false);
  }, [selectedCharId, getOrCreateBoard]);

  // ─── Image handling ───
  const triggerUpload = useCallback((zone: string) => {
    fileInputRefs.current[zone]?.click();
  }, []);

  const handleImageLoad = useCallback(
    (zone: string, file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        updateLocalBoard((prev) => ({
          ...prev,
          images: { ...prev.images, [zone]: result },
        }));
      };
      reader.readAsDataURL(file);
    },
    [updateLocalBoard],
  );

  const clearZone = useCallback(
    (zone: string) => {
      updateLocalBoard((prev) => {
        const images = { ...prev.images };
        delete images[zone];
        return { ...prev, images };
      });
    },
    [updateLocalBoard],
  );

  // ─── Get current detail character info ───
  const currentCharInfo = useMemo(() => {
    return charactersWithDesign.find((c) => c.character.id === selectedCharId);
  }, [charactersWithDesign, selectedCharId]);

  // ═══════════════════════════════════════
  // GALLERY VIEW
  // ═══════════════════════════════════════
  if (view === 'gallery') {
    return (
      <div className="animate-fade-in">
        <div className="cd-gallery-wrap">
          <div className="cd-gallery-header">
            <div>
              <h1 className="cd-gh-title">
                <span className="cd-title-italic">Character</span>{' '}
                <span className="cd-title-regular">Design</span>
              </h1>
              <div className="cd-gh-sub">
                {allCharacters.length} character{allCharacters.length !== 1 ? 's' : ''} · {cdDeptLabel}
              </div>
            </div>
            <div className="cd-gh-actions">
              <button className="panel-btn">Export All</button>
              <button className="panel-btn panel-btn--accent" onClick={() => allCharacters.length > 0 && openDetail(allCharacters[0].id)}>
                + Add Character
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="cd-filter-row">
            <div className="cd-filter-pills-group">
              {([
                { key: 'all' as const, label: 'All Characters' },
                { key: 'lead' as const, label: 'Leads' },
                { key: 'supporting' as const, label: 'Supporting' },
                { key: 'complete' as const, label: 'Complete' },
              ]).map((f) => (
                <button
                  key={f.key}
                  className={`cd-filter-pill${filter === f.key ? ' active' : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              className="cd-search-box"
              placeholder="Search characters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Cards */}
          <div className="cd-chars-grid">
            {filteredCharacters.map((c) => {
              const completion = c.board?.completion ?? 0;
              const stripeClass = completion >= 80 ? 'cd-stripe-done' : completion > 0 ? 'cd-stripe-wip' : 'cd-stripe-empty';
              const palette = c.board?.palette ?? DEFAULT_PALETTE;
              const actor = c.board?.actor || '';
              const compTag = completion >= 80
                ? <span className="cd-tag teal">Complete</span>
                : completion > 0
                  ? <span className="cd-tag gold">In progress</span>
                  : <span className="cd-tag">Not started</span>;

              return (
                <div
                  key={c.character.id}
                  className="cd-char-card"
                  onClick={() => openDetail(c.character.id)}
                >
                  <div className={`cd-card-stripe ${stripeClass}`} />
                  <div className="cd-card-inner">
                    <div className="cd-card-role-badge">
                      {c.roleLabel} · {c.scenes.length} scene{c.scenes.length !== 1 ? 's' : ''}
                    </div>
                    <div className="cd-card-name-row">
                      <div
                        className="cd-card-initials"
                        style={{ background: c.colorBg, color: c.color }}
                      >
                        {c.initials}
                      </div>
                      <div>
                        <div className="cd-card-name">{c.character.name}</div>
                        <div className={`cd-card-actor${!actor ? ' uncast' : ''}`}>
                          {actor || 'Not yet cast'}
                        </div>
                      </div>
                    </div>
                    <div className="cd-card-img-strip">
                      <div className="cd-cis-slot">
                        {c.board?.images.face
                          ? <img src={c.board.images.face} alt="Face ref" />
                          : <div className="cd-cis-label">Face ref</div>}
                      </div>
                      <div className="cd-cis-slot">
                        {c.board?.images.hair1
                          ? <img src={c.board.images.hair1} alt="Hair ref" />
                          : <div className="cd-cis-label">Hair ref</div>}
                      </div>
                      <div className="cd-cis-slot">
                        {c.board?.images.mua1
                          ? <img src={c.board.images.mua1} alt="MUA ref" />
                          : <div className="cd-cis-label">MUA ref</div>}
                      </div>
                    </div>
                    <div className="cd-card-palette">
                      {palette.map((col, i) => (
                        <div key={i} className="cd-cp-swatch" style={{ background: col }} />
                      ))}
                    </div>
                    <div className="cd-card-meta">
                      {compTag}
                      <div className="cd-card-progress">{completion}%</div>
                    </div>
                  </div>
                  <div className="cd-card-footer">
                    <div className={`cd-cf-status${completion >= 80 ? ' done' : ''}`}>
                      {completion >= 80 ? 'Board complete' : 'Open to edit board'}
                    </div>
                    <button className="panel-btn panel-btn--sm">Open Board</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // DETAIL VIEW
  // ═══════════════════════════════════════
  if (!localBoard || !currentCharInfo) return null;

  const char = currentCharInfo.character;
  const { color, colorBg, initials } = currentCharInfo;
  const scenesForChar = currentCharInfo.scenes;

  return (
    <div className="animate-fade-in">
      <div className="cd-detail-wrap">
        {/* Breadcrumb */}
        <div className="cd-breadcrumb">
          <button className="cd-bc-link" onClick={showGallery}>
            &larr; Character Design
          </button>
          <span style={{ color: 'var(--text-tertiary)' }}>/</span>
          <span>{char.name}</span>
        </div>

        {/* Character switcher pills */}
        <div className="cd-char-nav">
          {charactersWithDesign.map((c) => (
            <button
              key={c.character.id}
              className={`cd-cn-pill${c.character.id === selectedCharId ? ' active' : ''}`}
              onClick={() => openDetail(c.character.id)}
            >
              {c.character.name}
            </button>
          ))}
        </div>

        {/* Character header */}
        <div className="cd-char-header">
          <div
            className="cd-ch-accent"
            style={{ background: `linear-gradient(90deg, ${color}, ${colorBg.replace('0.12', '0.3')})` }}
          />
          <div
            className="cd-ch-initials"
            style={{ background: colorBg, color }}
          >
            {initials}
          </div>
          <div className="cd-ch-info">
            <div className="cd-ch-eyebrow">
              {currentCharInfo.roleLabel} · {scenesForChar.length} scene{scenesForChar.length !== 1 ? 's' : ''}
            </div>
            <div className="cd-ch-name">{char.name}</div>
            <div className="cd-ch-role">{char.notes || char.distinguishingFeatures || ''}</div>
            <div className="cd-ch-meta">
              <div className="cd-ch-meta-item">
                <strong>{scenesForChar.length}</strong>&nbsp;scenes
              </div>
              <div className="cd-ch-meta-item">
                Scenes:&nbsp;
                <strong>
                  {scenesForChar.slice(0, 5).map((s) => s.number).join(', ')}
                  {scenesForChar.length > 5 ? ' ...' : ''}
                </strong>
              </div>
            </div>
          </div>
          <div className="cd-ch-actor-field">
            <div className="cd-ch-actor-label">Cast / Actor</div>
            <input
              className="cd-ch-actor-input"
              placeholder="Not yet cast..."
              value={localBoard.actor}
              onChange={(e) =>
                updateLocalBoard((prev) => ({ ...prev, actor: e.target.value }))
              }
            />
          </div>
          <div className="cd-ch-actions">
            <div className="cd-completion-badge">{localBoard.completion}% complete</div>
            <button className="panel-btn panel-btn--accent panel-btn--sm" onClick={saveBoard}>
              Save Board
            </button>
          </div>
        </div>

        {/* IMAGE ZONES */}
        <div className="cd-section-label">
          Image References <div className="cd-sl-line" />
        </div>
        <div className="cd-img-zones-grid">
          {IMAGE_ZONES.map((zone) => {
            const hasImage = !!localBoard.images[zone.key];
            return (
              <div
                key={zone.key}
                className={`cd-img-zone ${zone.className}${hasImage ? ' has-image' : ''}`}
                onClick={() => triggerUpload(zone.key)}
                style={zone.key === 'mua1' ? { gridColumn: 2 } : undefined}
              >
                {!hasImage && (
                  <div className="cd-iz-inner">
                    <div className="cd-iz-icon">&#9723;</div>
                    <div className="cd-iz-label">{zone.label}</div>
                    {zone.sublabel && <div className="cd-iz-sublabel">{zone.sublabel}</div>}
                  </div>
                )}
                {hasImage && (
                  <>
                    <img className="cd-iz-img" src={localBoard.images[zone.key]} alt={zone.label} />
                    <div className="cd-iz-overlay">
                      <button
                        className="cd-iz-overlay-btn"
                        onClick={(e) => { e.stopPropagation(); triggerUpload(zone.key); }}
                      >
                        Replace
                      </button>
                      <button
                        className="cd-iz-overlay-btn"
                        onClick={(e) => { e.stopPropagation(); clearZone(zone.key); }}
                      >
                        Remove
                      </button>
                    </div>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="cd-iz-file-input"
                  ref={(el) => { fileInputRefs.current[zone.key] = el; }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageLoad(zone.key, file);
                    e.target.value = '';
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* COLOUR PALETTE */}
        <div className="cd-section-label">
          Colour Palette <div className="cd-sl-line" />
        </div>
        <div className="cd-palette-card">
          <div className="cd-palette-swatches">
            {localBoard.palette.map((col, i) => (
              <div key={i} className="cd-swatch-item">
                <div className="cd-swatch-color" style={{ background: col }}>
                  <input
                    type="color"
                    className="cd-swatch-color-input"
                    value={col}
                    onChange={(e) =>
                      updateLocalBoard((prev) => {
                        const palette = [...prev.palette];
                        palette[i] = e.target.value;
                        return { ...prev, palette };
                      })
                    }
                  />
                </div>
                <input
                  className="cd-swatch-label-input"
                  value={localBoard.paletteLabels[i] || ''}
                  placeholder="Label..."
                  onChange={(e) =>
                    updateLocalBoard((prev) => {
                      const paletteLabels = [...prev.paletteLabels];
                      paletteLabels[i] = e.target.value;
                      return { ...prev, paletteLabels };
                    })
                  }
                />
                <div className="cd-swatch-hex">{col}</div>
              </div>
            ))}
          </div>
          <div className="cd-palette-note">
            Click a swatch to change its colour. Label each one with a descriptor: skin tone, lip, eye, brow, blush, base, etc.
          </div>
        </div>

        {/* NOTES */}
        <div className="cd-section-label">
          Notes &amp; Inspiration <div className="cd-sl-line" />
        </div>
        <div className="cd-notes-grid">
          <div className="cd-note-card">
            <div className="cd-nc-label">Character Description</div>
            <textarea
              className="cd-nc-textarea"
              placeholder="Write a description of this character's look and feel. Who are they? What does their appearance say about them?"
              rows={5}
              value={localBoard.notes.desc}
              onChange={(e) =>
                updateLocalBoard((prev) => ({
                  ...prev,
                  notes: { ...prev.notes, desc: e.target.value },
                }))
              }
            />
          </div>
          <div className="cd-note-card">
            <div className="cd-nc-label">Visual References &amp; Inspiration</div>
            <textarea
              className="cd-nc-textarea"
              placeholder="Film references, celebrities, eras, moods. e.g. 'Think Chinatown meets No Country For Old Men. Dusty, lived-in, sun-damaged skin...'"
              rows={5}
              value={localBoard.notes.refs}
              onChange={(e) =>
                updateLocalBoard((prev) => ({
                  ...prev,
                  notes: { ...prev.notes, refs: e.target.value },
                }))
              }
            />
          </div>
          <div className="cd-note-card">
            <div className="cd-nc-label">Hair Notes</div>
            <textarea
              className="cd-nc-textarea"
              placeholder="Texture, length, colour, styling approach. Any special considerations — wigs, colour treatment, continuity flags..."
              rows={4}
              value={localBoard.notes.hair}
              onChange={(e) =>
                updateLocalBoard((prev) => ({
                  ...prev,
                  notes: { ...prev.notes, hair: e.target.value },
                }))
              }
            />
          </div>
          <div className="cd-note-card">
            <div className="cd-nc-label">Makeup Notes</div>
            <textarea
              className="cd-nc-textarea"
              placeholder="Skin, coverage, key features to enhance or downplay. Products to consider. Any SFX or special application requirements..."
              rows={4}
              value={localBoard.notes.mua}
              onChange={(e) =>
                updateLocalBoard((prev) => ({
                  ...prev,
                  notes: { ...prev.notes, mua: e.target.value },
                }))
              }
            />
          </div>
        </div>

        {/* SCENE BREAKDOWN */}
        <div className="cd-section-label" style={{ marginTop: 28 }}>
          Scene-by-Scene Look Breakdown <div className="cd-sl-line" />
        </div>
        <div className="cd-scene-table-wrap">
          <div className="cd-st-header">
            <div className="cd-sth cd-stc-num">Sc.</div>
            <div className="cd-sth cd-stc-int">I/E</div>
            <div className="cd-sth cd-stc-desc" style={{ flex: 1 }}>Scene / Setting</div>
            <div className="cd-sth cd-stc-look">Look</div>
            <div className="cd-sth cd-stc-notes">Notes</div>
            <div className="cd-sth cd-stc-flag" />
          </div>
          <div>
            {localBoard.sceneLooks.map((sl, i) => {
              const scene = allScenes.find((s) => s.id === sl.sceneId);
              if (!scene) return null;
              const lookColor = LOOK_COLORS[sl.look?.toUpperCase()] || '#A0897A';
              return (
                <div key={sl.sceneId} className="cd-st-row">
                  <div className="cd-stc-num">
                    <span className="cd-sc-badge">{scene.number}</span>
                  </div>
                  <div className={`cd-stc-int ${scene.intExt.toLowerCase()}`}>{scene.intExt}</div>
                  <div className="cd-stc-desc">{scene.location}</div>
                  <div className="cd-stc-look">
                    <input
                      className="cd-stc-look-input"
                      value={sl.look}
                      placeholder="Look A..."
                      style={{ borderLeft: `3px solid ${lookColor}` }}
                      onChange={(e) =>
                        updateLocalBoard((prev) => {
                          const sceneLooks = [...prev.sceneLooks];
                          sceneLooks[i] = { ...sceneLooks[i], look: e.target.value.toUpperCase() };
                          return { ...prev, sceneLooks };
                        })
                      }
                    />
                  </div>
                  <div className="cd-stc-notes">
                    <input
                      className="cd-stc-notes-input"
                      value={sl.notes}
                      placeholder="Notes..."
                      onChange={(e) =>
                        updateLocalBoard((prev) => {
                          const sceneLooks = [...prev.sceneLooks];
                          sceneLooks[i] = { ...sceneLooks[i], notes: e.target.value };
                          return { ...prev, sceneLooks };
                        })
                      }
                    />
                  </div>
                  <div className="cd-stc-flag">
                    <div className="cd-flag-dot" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Look legend */}
        {(() => {
          const usedLooks = [...new Set(localBoard.sceneLooks.map((s) => s.look).filter(Boolean))].sort();
          return (
            <div className="cd-look-legend">
              {usedLooks.map((l) => (
                <div key={l} className="cd-ll-item">
                  <div className="cd-ll-swatch" style={{ background: LOOK_COLORS[l] || '#A0897A' }} />
                  Look {l}
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* SAVE BAR */}
      {isDirty && (
        <div className="cd-save-bar visible">
          <div className="cd-sb-msg">
            Unsaved changes on <span>{char.name}</span>
          </div>
          <button className="panel-btn panel-btn--sm" onClick={discardChanges}>Discard</button>
          <button className="panel-btn panel-btn--accent panel-btn--sm" onClick={saveBoard}>Save Board</button>
        </div>
      )}
    </div>
  );
}
