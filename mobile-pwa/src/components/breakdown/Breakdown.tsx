import { useCallback, useMemo, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import type {
  Scene,
  Character,
  Look,
  HairDetails,
  MakeupDetails,
  PrepCharacterBreakdown,
  PrepSceneBreakdown,
} from '@/types';
import { clsx } from 'clsx';

export function Breakdown() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [filterChar, setFilterChar] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const scenes = currentProject?.scenes ?? [];
  const characters = currentProject?.characters ?? [];
  const looks = currentProject?.looks ?? [];

  /* ─── Lookups ─── */

  const characterMap = useMemo(() => {
    const map = new Map<string, Character>();
    characters.forEach((c) => map.set(c.id, c));
    return map;
  }, [characters]);

  const looksById = useMemo(() => {
    const map = new Map<string, Look>();
    looks.forEach((l) => map.set(l.id, l));
    return map;
  }, [looks]);

  const looksByCharacter = useMemo(() => {
    const map = new Map<string, Look[]>();
    looks.forEach((l) => {
      const list = map.get(l.characterId) ?? [];
      list.push(l);
      map.set(l.characterId, list);
    });
    return map;
  }, [looks]);

  /** Resolve a character's look for a scene: prep lookId → scene-tagged look */
  const resolveLook = useCallback(
    (cb: PrepCharacterBreakdown | undefined, characterId: string, sceneNumber: string): Look | undefined => {
      if (cb?.lookId) {
        const byId = looksById.get(cb.lookId);
        if (byId) return byId;
      }
      const charLooks = looksByCharacter.get(characterId) ?? [];
      return charLooks.find((l) => l.scenes.includes(sceneNumber));
    },
    [looksById, looksByCharacter],
  );

  /* ─── Sort scenes by scene number (alphanumeric-aware) ─── */

  const sortedScenes = useMemo(() => {
    return [...scenes].sort((a, b) =>
      a.sceneNumber.localeCompare(b.sceneNumber, undefined, { numeric: true }),
    );
  }, [scenes]);

  /* ─── Detect time jumps: scenes where story day differs from prior ─── */

  const timeJumpSceneIds = useMemo(() => {
    const jumps = new Set<string>();
    let prevDay = '';
    for (const s of sortedScenes) {
      const day = s.prepBreakdown?.timeline?.day || '';
      if (prevDay && day && day !== prevDay) jumps.add(s.id);
      if (day) prevDay = day;
    }
    return jumps;
  }, [sortedScenes]);

  /* ─── Filtered scenes (only those with characters) ─── */

  const scenesWithCast = useMemo(() => {
    return sortedScenes.filter((s) => {
      if (s.characters.length === 0) return false;
      if (filterChar && !s.characters.includes(filterChar)) return false;
      return true;
    });
  }, [sortedScenes, filterChar]);

  /* ─── Find prior scene where a character appeared (for "Same as Sc N") ─── */

  const findPrevScene = useCallback(
    (charId: string, currentIdx: number): string | null => {
      for (let i = currentIdx - 1; i >= 0; i--) {
        if (sortedScenes[i].characters.includes(charId)) return sortedScenes[i].sceneNumber;
      }
      return null;
    },
    [sortedScenes],
  );

  /* ─── Export rows (used by Copy and CSV) ─── */

  const buildExportRows = useCallback((): string[][] => {
    const headers = [
      'Scene',
      'Day',
      'Character',
      'Look',
      'Hair',
      'Makeup',
      'Wardrobe',
      'SFX',
      'Environmental',
      'Action',
      'Continuity Notes',
    ];
    const rows: string[][] = [headers];
    for (let idx = 0; idx < sortedScenes.length; idx++) {
      const scene = sortedScenes[idx];
      const bd = scene.prepBreakdown;
      const charIds = filterChar
        ? scene.characters.filter((c) => c === filterChar)
        : scene.characters;
      const storyDay = bd?.timeline?.day || '';
      for (const cid of charIds) {
        const ch = characterMap.get(cid);
        if (!ch) continue;
        const cb = bd?.characters?.find((c) => c.characterId === cid);
        const look = resolveLook(cb, cid, scene.sceneNumber);
        const resolved = resolveCharacterFields(cb, look);
        const continuity = buildContinuityNotes(cb, cid, idx, findPrevScene, resolved, bd);
        rows.push([
          scene.sceneNumber,
          storyDay,
          ch.name,
          look?.name || '',
          resolved.hair,
          resolved.makeup,
          resolved.wardrobe,
          resolved.sfx,
          resolved.environmental,
          resolved.action,
          continuity,
        ]);
      }
    }
    return rows;
  }, [sortedScenes, characterMap, resolveLook, filterChar, findPrevScene]);

  const handleCopy = useCallback(() => {
    const rows = buildExportRows();
    const tsv = rows.map((r) => r.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [buildExportRows]);

  const handleExportCSV = useCallback(() => {
    const rows = buildExportRows();
    const esc = (v: string) =>
      v.includes(',') || v.includes('"') || v.includes('\n')
        ? `"${v.replace(/"/g, '""')}"`
        : v;
    const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'breakdown.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [buildExportRows]);

  /* ─── Empty states ─── */

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
          <h2 className="text-lg font-semibold text-foreground mb-2">No Breakdown Available</h2>
          <p className="text-sm text-text-muted max-w-xs mx-auto">
            The breakdown will appear here once scenes and characters have been set up in pre-production.
          </p>
        </div>
      </div>
    );
  }

  /* ─── Render ─── */

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-foreground">Breakdown</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="text-xs text-text-muted font-medium px-2 py-1 rounded-md border border-border"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handleExportCSV}
                className="text-xs text-gold font-medium px-2 py-1 rounded-md border border-gold/40"
              >
                Export CSV
              </button>
            </div>
          </div>

          {/* Character filter */}
          <div className="relative">
            <select
              value={filterChar}
              onChange={(e) => setFilterChar(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-muted rounded-lg text-sm text-foreground border-none outline-none focus:ring-1 focus:ring-gold/50 appearance-none"
            >
              <option value="">All Characters</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Stats bar */}
        <div className="px-4 py-2 bg-muted/50 border-t border-border flex items-center gap-4 text-xs text-text-muted">
          <span>
            {scenesWithCast.length} scene{scenesWithCast.length !== 1 ? 's' : ''}
          </span>
          <span>
            {characters.length} character{characters.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Scene blocks */}
      <div className="px-4 py-3 space-y-3">
        {scenesWithCast.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">
            No scenes with characters{filterChar ? ' for this character' : ''}.
          </p>
        ) : (
          scenesWithCast.map((scene) => {
            const globalIdx = sortedScenes.indexOf(scene);
            const bd = scene.prepBreakdown;
            const charIds = filterChar
              ? scene.characters.filter((c) => c === filterChar)
              : scene.characters;
            const storyDay = bd?.timeline?.day || '';
            const timelineType = bd?.timeline?.type || '';
            const showBadge = Boolean(timelineType) && timelineType !== 'Normal';
            const isTimeJump = timeJumpSceneIds.has(scene.id);

            return (
              <SceneBlock
                key={scene.id}
                scene={scene}
                charIds={charIds}
                characterMap={characterMap}
                resolveLook={resolveLook}
                bd={bd}
                storyDay={storyDay}
                timelineType={timelineType}
                showBadge={showBadge}
                isTimeJump={isTimeJump}
                globalIdx={globalIdx}
                findPrevScene={findPrevScene}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

/* ─── Scene Block ─── */

interface SceneBlockProps {
  scene: Scene;
  charIds: string[];
  characterMap: Map<string, Character>;
  resolveLook: (
    cb: PrepCharacterBreakdown | undefined,
    characterId: string,
    sceneNumber: string,
  ) => Look | undefined;
  bd: Scene['prepBreakdown'];
  storyDay: string;
  timelineType: string;
  showBadge: boolean;
  isTimeJump: boolean;
  globalIdx: number;
  findPrevScene: (charId: string, currentIdx: number) => string | null;
}

function SceneBlock({
  scene,
  charIds,
  characterMap,
  resolveLook,
  bd,
  storyDay,
  timelineType,
  showBadge,
  isTimeJump,
  globalIdx,
  findPrevScene,
}: SceneBlockProps) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Time jump banner */}
      {isTimeJump && (
        <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-[11px] font-semibold text-amber-400 flex items-center gap-1.5">
          <span>&#9203;</span>
          TIME JUMP — {storyDay}
          {bd?.timeline?.note && <span className="font-normal opacity-80"> &middot; {bd.timeline.note}</span>}
        </div>
      )}

      {/* Scene header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span
            className={clsx(
              'flex-shrink-0 px-2 py-0.5 rounded text-xs font-bold',
              scene.intExt === 'INT' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400',
            )}
          >
            SC {scene.sceneNumber}
          </span>
          {storyDay && (
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">
              {storyDay}
            </span>
          )}
          {showBadge && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 uppercase tracking-wide">
              {timelineType}
            </span>
          )}
        </div>
        <div className="text-sm font-medium text-foreground">
          {scene.intExt}. {scene.slugline} — {scene.timeOfDay}
        </div>
        {bd?.timeline?.note && !isTimeJump && (
          <div className="text-xs text-text-muted mt-1 italic">{bd.timeline.note}</div>
        )}
        {scene.synopsis && (
          <div className="text-xs text-text-muted mt-1.5 leading-relaxed">{scene.synopsis}</div>
        )}
      </div>

      {/* Characters */}
      <div className="divide-y divide-border">
        {charIds.length === 0 ? (
          <p className="px-4 py-3 text-xs text-text-muted">
            No characters confirmed for this scene
          </p>
        ) : (
          charIds.map((cid) => {
            const ch = characterMap.get(cid);
            if (!ch) return null;
            const cb = bd?.characters?.find((c) => c.characterId === cid);
            const look = resolveLook(cb, cid, scene.sceneNumber);
            const resolved = resolveCharacterFields(cb, look);
            const continuity = buildContinuityNotes(cb, cid, globalIdx, findPrevScene, resolved, bd);
            const hasChange = cb?.changeType === 'change';

            return (
              <CharacterRow
                key={cid}
                character={ch}
                look={look}
                cb={cb}
                resolved={resolved}
                continuity={continuity}
                hasChange={hasChange}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

/* ─── Character Row ─── */

interface ResolvedFields {
  hair: string;
  makeup: string;
  wardrobe: string;
  sfx: string;
  environmental: string;
  action: string;
}

interface CharacterRowProps {
  character: Character;
  look: Look | undefined;
  cb: PrepCharacterBreakdown | undefined;
  resolved: ResolvedFields;
  continuity: string;
  hasChange: boolean;
}

function CharacterRow({ character, look, cb, resolved, continuity, hasChange }: CharacterRowProps) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <CharacterAvatar character={character} size="sm" />
        <span className="text-sm font-semibold text-foreground">{character.name}</span>
      </div>

      <div className="space-y-1.5 ml-8">
        <DetailRow label="Look" value={look?.name || ''} color="text-gold" />
        <DetailRow
          label="Hair"
          value={resolved.hair}
          exit={hasChange ? cb?.exitsWith?.hair : undefined}
          color="text-amber-400"
        />
        <DetailRow
          label="Makeup"
          value={resolved.makeup}
          exit={hasChange ? cb?.exitsWith?.makeup : undefined}
          color="text-pink-400"
        />
        <DetailRow
          label="Wardrobe"
          value={resolved.wardrobe}
          exit={hasChange ? cb?.exitsWith?.wardrobe : undefined}
          color="text-purple-400"
        />
        <DetailRow label="SFX" value={resolved.sfx} color="text-red-400" highlight={!!resolved.sfx} />
        <DetailRow
          label="Env."
          value={resolved.environmental}
          color="text-sky-400"
          highlight={!!resolved.environmental}
        />
        <DetailRow label="Action" value={resolved.action} color="text-violet-400" />
        <NotesRow
          changeNotes={hasChange ? cb?.changeNotes : undefined}
          continuity={continuity}
        />
      </div>
    </div>
  );
}

/* ─── Detail Row ─── */

function DetailRow({
  label,
  value,
  color,
  exit,
  highlight,
}: {
  label: string;
  value: string;
  color: string;
  exit?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className={clsx('font-semibold flex-shrink-0 w-16', color)}>{label}</span>
      <div className="flex-1 min-w-0">
        {value ? (
          <span className={clsx(highlight ? 'text-foreground font-medium' : 'text-text-muted')}>
            {value}
          </span>
        ) : (
          <span className="text-text-light">—</span>
        )}
        {exit && (
          <div className="text-[10px] text-text-light italic mt-0.5">Exit: {exit}</div>
        )}
      </div>
    </div>
  );
}

/* ─── Notes Row ─── */

function NotesRow({ changeNotes, continuity }: { changeNotes?: string; continuity: string }) {
  const isSameRef = continuity.startsWith('Same as');
  const hasContent = !!changeNotes || !!continuity;
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="font-semibold flex-shrink-0 w-16 text-text-muted">Notes</span>
      <div className="flex-1 min-w-0">
        {changeNotes && <div className="text-text-muted">{changeNotes}</div>}
        {continuity ? (
          isSameRef ? (
            <span className="text-text-light italic">{continuity}</span>
          ) : (
            <span className="text-text-muted">{continuity}</span>
          )
        ) : !hasContent ? (
          <span className="text-text-light">—</span>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Field resolution: prep manual entry → look defaults ─── */

function resolveCharacterFields(
  cb: PrepCharacterBreakdown | undefined,
  look: Look | undefined,
): ResolvedFields {
  return {
    hair: cb?.entersWith?.hair || (look ? buildHairSummary(look.hair) : ''),
    makeup: cb?.entersWith?.makeup || (look ? buildMakeupSummary(look.makeup) : ''),
    wardrobe: cb?.entersWith?.wardrobe || '',
    sfx:
      cb?.sfx ||
      (look?.sfxDetails?.sfxRequired && look.sfxDetails.sfxTypes.length > 0
        ? look.sfxDetails.sfxTypes.join(', ')
        : ''),
    environmental: cb?.environmental || '',
    action: cb?.action || '',
  };
}

/* ─── Build continuity notes (matches prep BreakdownSheet logic) ─── */

function buildContinuityNotes(
  cb: PrepCharacterBreakdown | undefined,
  charId: string,
  sceneIdx: number,
  findPrevScene: (charId: string, currentIdx: number) => string | null,
  resolved: ResolvedFields,
  bd: PrepSceneBreakdown | undefined,
): string {
  const parts: string[] = [];

  // 1. Active continuity events for this character in this scene.
  //    Mirrors prep/src/pages/BreakdownSheet.tsx buildContinuityNotes.
  if (bd?.continuityEvents && bd.continuityEvents.length > 0) {
    const events = bd.continuityEvents.filter((e) => e.characterId === charId);
    if (events.length > 0) {
      parts.push(events.map((e) => e.description || e.type).join(', '));
    }
  }

  // 2. Character-level breakdown notes from the form
  if (cb?.notes) parts.push(cb.notes);

  // 3. "Same as Sc N" only when there's no data at all for this character
  const hasManualEntry =
    cb &&
    (cb.entersWith?.hair ||
      cb.entersWith?.makeup ||
      cb.entersWith?.wardrobe ||
      cb.sfx ||
      cb.environmental ||
      cb.action);
  const hasResolvedAny =
    resolved.hair || resolved.makeup || resolved.wardrobe || resolved.sfx || resolved.environmental || resolved.action;

  if (parts.length === 0 && !hasManualEntry && !hasResolvedAny) {
    const prev = findPrevScene(charId, sceneIdx);
    if (prev !== null) parts.push(`Same as Sc ${prev}`);
  }

  return parts.join('; ');
}

/* ─── Look summary helpers ─── */

function buildHairSummary(hair: HairDetails): string {
  const parts: string[] = [];
  if (hair.hairType && hair.hairType !== 'Natural') parts.push(hair.hairType);
  if (hair.style) parts.push(hair.style);
  if (hair.parting) parts.push(`Part: ${hair.parting}`);
  if (hair.accessories) parts.push(hair.accessories);
  if (hair.wigNameId) parts.push(`Wig: ${hair.wigNameId}`);
  return parts.join(' / ');
}

function buildMakeupSummary(makeup: MakeupDetails): string {
  const parts: string[] = [];
  if (makeup.foundation) parts.push(`Foundation: ${makeup.foundation}`);
  if (makeup.lidColour) parts.push(`Eyes: ${makeup.lidColour}`);
  if (makeup.lipColour) parts.push(`Lips: ${makeup.lipColour}`);
  if (makeup.blush) parts.push(`Blush: ${makeup.blush}`);
  if (makeup.lashes) parts.push(`Lashes: ${makeup.lashes}`);
  return parts.join(' / ');
}
