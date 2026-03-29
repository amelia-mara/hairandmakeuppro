import { useState, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import type { Scene, Character, Look, PrepCharacterBreakdown } from '@/types';
import { clsx } from 'clsx';

type ViewMode = 'by-scene' | 'by-character';

interface SceneCharacterEntry {
  scene: Scene;
  character: Character;
  look: Look | undefined;
  prepBreakdown: PrepCharacterBreakdown | undefined;
}

export function MasterBreakdown() {
  const currentProject = useProjectStore(s => s.currentProject);
  const [viewMode, setViewMode] = useState<ViewMode>('by-scene');
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
  const [expandedCharacters, setExpandedCharacters] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const scenes = currentProject?.scenes ?? [];
  const characters = currentProject?.characters ?? [];
  const looks = currentProject?.looks ?? [];

  // Build lookup maps
  const characterMap = useMemo(() => {
    const map = new Map<string, Character>();
    characters.forEach(c => map.set(c.id, c));
    return map;
  }, [characters]);

  const looksByCharacter = useMemo(() => {
    const map = new Map<string, Look[]>();
    looks.forEach(l => {
      const existing = map.get(l.characterId) ?? [];
      existing.push(l);
      map.set(l.characterId, existing);
    });
    return map;
  }, [looks]);

  // Find the look assigned to a character for a given scene
  const findLookForScene = (characterId: string, sceneNumber: string): Look | undefined => {
    const charLooks = looksByCharacter.get(characterId) ?? [];
    return charLooks.find(l => l.scenes.includes(sceneNumber));
  };

  // Sort scenes by scene number
  const sortedScenes = useMemo(() => {
    return [...scenes].sort((a, b) => {
      const numA = parseInt(a.sceneNumber);
      const numB = parseInt(b.sceneNumber);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.sceneNumber.localeCompare(b.sceneNumber);
    });
  }, [scenes]);

  // Filter scenes by search
  const filteredScenes = useMemo(() => {
    if (!searchQuery.trim()) return sortedScenes;
    const q = searchQuery.toLowerCase();
    return sortedScenes.filter(s =>
      s.sceneNumber.toLowerCase().includes(q) ||
      s.slugline.toLowerCase().includes(q) ||
      s.characters.some(cId => characterMap.get(cId)?.name.toLowerCase().includes(q))
    );
  }, [sortedScenes, searchQuery, characterMap]);

  // Build character-centric view data
  const characterSceneMap = useMemo(() => {
    const map = new Map<string, SceneCharacterEntry[]>();
    characters.forEach(char => {
      const entries: SceneCharacterEntry[] = [];
      sortedScenes.forEach(scene => {
        if (scene.characters.includes(char.id)) {
          entries.push({
            scene,
            character: char,
            look: findLookForScene(char.id, scene.sceneNumber),
            prepBreakdown: scene.prepBreakdown?.characters?.find(
              c => c.characterId === char.id
            ),
          });
        }
      });
      if (entries.length > 0) {
        map.set(char.id, entries);
      }
    });
    return map;
  }, [characters, sortedScenes, looksByCharacter]);

  const toggleScene = (sceneId: string) => {
    setExpandedScenes(prev => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  };

  const toggleCharacter = (charId: string) => {
    setExpandedCharacters(prev => {
      const next = new Set(prev);
      if (next.has(charId)) next.delete(charId);
      else next.add(charId);
      return next;
    });
  };

  const expandAll = () => {
    if (viewMode === 'by-scene') {
      setExpandedScenes(new Set(filteredScenes.map(s => s.id)));
    } else {
      setExpandedCharacters(new Set(Array.from(characterSceneMap.keys())));
    }
  };

  const collapseAll = () => {
    if (viewMode === 'by-scene') {
      setExpandedScenes(new Set());
    } else {
      setExpandedCharacters(new Set());
    }
  };

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-background pb-safe-bottom">
        <div className="p-6 text-center text-text-muted">
          <p>No project loaded</p>
        </div>
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-safe-bottom">
        <div className="p-6 text-center">
          <div className="text-4xl mb-3">📋</div>
          <h2 className="text-lg font-semibold text-foreground mb-2">No Breakdown Available</h2>
          <p className="text-sm text-text-muted max-w-xs mx-auto">
            The master breakdown will appear here once scenes and characters have been set up in pre-production.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-foreground">Breakdown</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={expandAll}
                className="text-xs text-gold font-medium px-2 py-1"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="text-xs text-text-muted font-medium px-2 py-1"
              >
                Collapse
              </button>
            </div>
          </div>

          {/* View mode toggle */}
          <div className="flex gap-1 bg-muted rounded-lg p-1 mb-3">
            <button
              onClick={() => setViewMode('by-scene')}
              className={clsx(
                'flex-1 text-xs font-medium py-1.5 rounded-md transition-colors',
                viewMode === 'by-scene'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-text-muted'
              )}
            >
              By Scene
            </button>
            <button
              onClick={() => setViewMode('by-character')}
              className={clsx(
                'flex-1 text-xs font-medium py-1.5 rounded-md transition-colors',
                viewMode === 'by-character'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-text-muted'
              )}
            >
              By Character
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search scenes or characters..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-muted rounded-lg text-sm text-foreground placeholder:text-text-light border-none outline-none focus:ring-1 focus:ring-gold/50"
            />
          </div>
        </div>

        {/* Stats bar */}
        <div className="px-4 py-2 bg-muted/50 border-t border-border flex items-center gap-4 text-xs text-text-muted">
          <span>{scenes.length} scenes</span>
          <span>{characters.length} characters</span>
          <span>{looks.length} looks</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3 space-y-2">
        {viewMode === 'by-scene' ? (
          <BySceneView
            scenes={filteredScenes}
            characterMap={characterMap}
            findLookForScene={findLookForScene}
            expandedScenes={expandedScenes}
            toggleScene={toggleScene}
          />
        ) : (
          <ByCharacterView
            characters={characters}
            characterSceneMap={characterSceneMap}
            expandedCharacters={expandedCharacters}
            toggleCharacter={toggleCharacter}
            searchQuery={searchQuery}
          />
        )}
      </div>
    </div>
  );
}

/* ─── By Scene View ─── */

interface BySceneViewProps {
  scenes: Scene[];
  characterMap: Map<string, Character>;
  findLookForScene: (characterId: string, sceneNumber: string) => Look | undefined;
  expandedScenes: Set<string>;
  toggleScene: (sceneId: string) => void;
}

function BySceneView({ scenes, characterMap, findLookForScene, expandedScenes, toggleScene }: BySceneViewProps) {
  if (scenes.length === 0) {
    return <p className="text-sm text-text-muted text-center py-8">No scenes match your search</p>;
  }

  return (
    <>
      {scenes.map(scene => {
        const isExpanded = expandedScenes.has(scene.id);
        const sceneCharacters = scene.characters
          .map(cId => characterMap.get(cId))
          .filter(Boolean) as Character[];

        return (
          <div key={scene.id} className="bg-card rounded-xl border border-border overflow-hidden">
            {/* Scene header */}
            <button
              onClick={() => toggleScene(scene.id)}
              className="w-full px-4 py-3 flex items-center gap-3 text-left"
            >
              <div className={clsx(
                'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold',
                scene.intExt === 'INT' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'
              )}>
                {scene.sceneNumber}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {scene.slugline || `Scene ${scene.sceneNumber}`}
                </div>
                <div className="text-xs text-text-muted mt-0.5">
                  {scene.intExt} &middot; {scene.timeOfDay} &middot; {sceneCharacters.length} character{sceneCharacters.length !== 1 ? 's' : ''}
                </div>
              </div>
              <svg
                className={clsx('w-5 h-5 text-text-light transition-transform', isExpanded && 'rotate-180')}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded: character breakdown */}
            {isExpanded && (
              <div className="border-t border-border">
                {sceneCharacters.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-text-muted">No characters confirmed for this scene</p>
                ) : (
                  sceneCharacters.map(char => {
                    const look = findLookForScene(char.id, scene.sceneNumber);
                    const prepEntry = scene.prepBreakdown?.characters?.find(
                      c => c.characterId === char.id
                    );
                    return (
                      <CharacterBreakdownCard
                        key={char.id}
                        character={char}
                        look={look}
                        prepBreakdown={prepEntry}
                      />
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ─── By Character View ─── */

interface ByCharacterViewProps {
  characters: Character[];
  characterSceneMap: Map<string, SceneCharacterEntry[]>;
  expandedCharacters: Set<string>;
  toggleCharacter: (charId: string) => void;
  searchQuery: string;
}

function ByCharacterView({ characters, characterSceneMap, expandedCharacters, toggleCharacter, searchQuery }: ByCharacterViewProps) {
  const filteredCharacters = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return characters.filter(c => {
      const entries = characterSceneMap.get(c.id);
      if (!entries || entries.length === 0) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) ||
        entries.some(e => e.scene.sceneNumber.toLowerCase().includes(q) || e.scene.slugline.toLowerCase().includes(q));
    });
  }, [characters, characterSceneMap, searchQuery]);

  if (filteredCharacters.length === 0) {
    return <p className="text-sm text-text-muted text-center py-8">No characters match your search</p>;
  }

  return (
    <>
      {filteredCharacters.map(char => {
        const isExpanded = expandedCharacters.has(char.id);
        const entries = characterSceneMap.get(char.id) ?? [];
        const uniqueLooks = new Set(entries.map(e => e.look?.id).filter(Boolean));

        return (
          <div key={char.id} className="bg-card rounded-xl border border-border overflow-hidden">
            {/* Character header */}
            <button
              onClick={() => toggleCharacter(char.id)}
              className="w-full px-4 py-3 flex items-center gap-3 text-left"
            >
              <CharacterAvatar character={char} size="md" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">{char.name}</div>
                <div className="text-xs text-text-muted mt-0.5">
                  {entries.length} scene{entries.length !== 1 ? 's' : ''} &middot; {uniqueLooks.size} look{uniqueLooks.size !== 1 ? 's' : ''}
                </div>
              </div>
              <svg
                className={clsx('w-5 h-5 text-text-light transition-transform', isExpanded && 'rotate-180')}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded: scenes list */}
            {isExpanded && (
              <div className="border-t border-border divide-y divide-border">
                {entries.map(({ scene, look, prepBreakdown: prepEntry }) => (
                  <div key={scene.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={clsx(
                        'text-xs font-bold px-2 py-0.5 rounded',
                        scene.intExt === 'INT' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'
                      )}>
                        Sc {scene.sceneNumber}
                      </span>
                      <span className="text-xs text-text-muted truncate">{scene.slugline}</span>
                    </div>
                    {prepEntry ? (
                      <PrepBreakdownSummary entry={prepEntry} />
                    ) : look ? (
                      <LookSummary look={look} />
                    ) : (
                      <p className="text-xs text-text-light italic">No look assigned</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ─── Character Breakdown Card ─── */

interface CharacterBreakdownCardProps {
  character: Character;
  look: Look | undefined;
  prepBreakdown: PrepCharacterBreakdown | undefined;
}

function CharacterBreakdownCard({ character, look, prepBreakdown }: CharacterBreakdownCardProps) {
  return (
    <div className="px-4 py-3 border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 mb-2">
        <CharacterAvatar character={character} size="sm" />
        <span className="text-sm font-medium text-foreground">{character.name}</span>
        {look && (
          <span className="ml-auto text-xs text-gold font-medium">{look.name}</span>
        )}
      </div>
      {prepBreakdown ? (
        <PrepBreakdownSummary entry={prepBreakdown} />
      ) : look ? (
        <LookSummary look={look} />
      ) : (
        <p className="text-xs text-text-light italic ml-8">No look assigned for this scene</p>
      )}
    </div>
  );
}

/* ─── Prep Breakdown Summary ─── */

function PrepBreakdownSummary({ entry }: { entry: PrepCharacterBreakdown }) {
  const hair = entry.entersWith?.hair;
  const makeup = entry.entersWith?.makeup;
  const wardrobe = entry.entersWith?.wardrobe;
  const sfx = entry.sfx;
  const environmental = entry.environmental;
  const action = entry.action;
  const notes = entry.notes;

  if (!hair && !makeup && !wardrobe && !sfx && !environmental && !action && !notes) {
    return <p className="text-xs text-text-light italic ml-8">No breakdown details yet</p>;
  }

  return (
    <div className="space-y-1.5 ml-8">
      {hair && <DetailRow label="Hair" value={hair} color="text-amber-400" />}
      {makeup && <DetailRow label="Makeup" value={makeup} color="text-pink-400" />}
      {wardrobe && <DetailRow label="Wardrobe" value={wardrobe} color="text-purple-400" />}
      {sfx && <DetailRow label="SFX" value={sfx} color="text-red-400" />}
      {environmental && <DetailRow label="Env." value={environmental} color="text-sky-400" />}
      {action && <DetailRow label="Action" value={action} color="text-violet-400" />}
      {notes && <DetailRow label="Notes" value={notes} color="text-text-muted" />}
    </div>
  );
}

/* ─── Look Summary ─── */

interface LookSummaryProps {
  look: Look;
}

function LookSummary({ look }: LookSummaryProps) {
  const hairSummary = buildHairSummary(look.hair);
  const makeupSummary = buildMakeupSummary(look.makeup);
  const hasSfx = look.sfxDetails?.sfxRequired;

  if (!hairSummary && !makeupSummary && !hasSfx && !look.notes) {
    return <p className="text-xs text-text-light italic">No details entered yet</p>;
  }

  return (
    <div className="space-y-1.5 ml-8">
      {hairSummary && (
        <DetailRow label="Hair" value={hairSummary} color="text-amber-400" />
      )}
      {makeupSummary && (
        <DetailRow label="Makeup" value={makeupSummary} color="text-pink-400" />
      )}
      {hasSfx && look.sfxDetails && (
        <DetailRow
          label="SFX"
          value={look.sfxDetails.sfxTypes.join(', ')}
          color="text-red-400"
        />
      )}
      {look.notes && (
        <DetailRow label="Notes" value={look.notes} color="text-text-muted" />
      )}
    </div>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className={clsx('font-semibold flex-shrink-0 w-14', color)}>{label}</span>
      <span className="text-text-muted">{value}</span>
    </div>
  );
}

/* ─── Helpers ─── */

function buildHairSummary(hair: Look['hair']): string {
  const parts: string[] = [];
  if (hair.hairType && hair.hairType !== 'Natural') parts.push(hair.hairType);
  if (hair.style) parts.push(hair.style);
  if (hair.parting) parts.push(`Part: ${hair.parting}`);
  if (hair.accessories) parts.push(hair.accessories);
  if (hair.wigNameId) parts.push(`Wig: ${hair.wigNameId}`);
  return parts.join(' / ');
}

function buildMakeupSummary(makeup: Look['makeup']): string {
  const parts: string[] = [];
  if (makeup.foundation) parts.push(`Foundation: ${makeup.foundation}`);
  if (makeup.lidColour) parts.push(`Eyes: ${makeup.lidColour}`);
  if (makeup.lipColour) parts.push(`Lips: ${makeup.lipColour}`);
  if (makeup.blush) parts.push(`Blush: ${makeup.blush}`);
  if (makeup.lashes) parts.push(`Lashes: ${makeup.lashes}`);
  return parts.join(' / ');
}
