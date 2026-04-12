import { useCallback, useMemo, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import { AccessRestricted } from '@/components/AccessRestricted';
import type {
  Scene,
  Character,
  Look,
  HairDetails,
  MakeupDetails,
  PrepCharacterBreakdown,
  PrepSceneBreakdown,
  PrepBreakdownTag,
} from '@/types';
import { clsx } from 'clsx';

export function Breakdown() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const access = useProjectAccess();
  const [filterChar, setFilterChar] = useState<string>('');
  const [copied, setCopied] = useState(false);

  if (!access.breakdown) return <AccessRestricted />;

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

  /* ─── Sort scenes ─── */

  const sortedScenes = useMemo(() => {
    return [...scenes].sort((a, b) =>
      a.sceneNumber.localeCompare(b.sceneNumber, undefined, { numeric: true }),
    );
  }, [scenes]);

  /* ─── Detect time jumps ─── */

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

  /* ─── Filtered scenes ─── */

  const scenesWithCast = useMemo(() => {
    return sortedScenes.filter((s) => {
      if (s.characters.length === 0) return false;
      if (filterChar && !s.characters.includes(filterChar)) return false;
      return true;
    });
  }, [sortedScenes, filterChar]);

  /* ─── Find prior scene ─── */

  const findPrevScene = useCallback(
    (charId: string, currentIdx: number): string | null => {
      for (let i = currentIdx - 1; i >= 0; i--) {
        if (sortedScenes[i].characters.includes(charId)) return sortedScenes[i].sceneNumber;
      }
      return null;
    },
    [sortedScenes],
  );

  /* ─── Export rows ─── */

  const buildExportRows = useCallback((): string[][] => {
    const headers = ['Scene', 'Day', 'Character', 'Look', 'Hair', 'Makeup', 'Wardrobe', 'SFX', 'Environmental', 'Action', 'Continuity Notes'];
    const rows: string[][] = [headers];
    for (let idx = 0; idx < sortedScenes.length; idx++) {
      const scene = sortedScenes[idx];
      const bd = scene.prepBreakdown;
      const charIds = filterChar ? scene.characters.filter((c) => c === filterChar) : scene.characters;
      const storyDay = bd?.timeline?.day || '';
      for (const cid of charIds) {
        const ch = characterMap.get(cid);
        if (!ch) continue;
        const cb = bd?.characters?.find((c) => c.characterId === cid);
        const look = resolveLook(cb, cid, scene.sceneNumber);
        const resolved = resolveCharacterFields(cb, look);
        const continuity = buildContinuityNotes(cb, cid, idx, findPrevScene, resolved, bd);
        rows.push([scene.sceneNumber, storyDay, ch.name, look?.name || '', resolved.hair, resolved.makeup, resolved.wardrobe, resolved.sfx, resolved.environmental, resolved.action, continuity]);
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
      v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
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
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-light pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Stats bar */}
        <div className="px-4 py-2 bg-muted/50 border-t border-border flex items-center gap-4 text-xs text-text-muted">
          <span>{scenesWithCast.length} scene{scenesWithCast.length !== 1 ? 's' : ''}</span>
          <span>{characters.length} character{characters.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Scene blocks */}
      <div className="px-3 py-3 space-y-4">
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

/* ─── Column config (mirrors prep column order) ─── */

const COLUMNS = [
  { key: 'character', label: 'CHARACTER', width: 'min-w-[100px]' },
  { key: 'look', label: 'LOOK', width: 'min-w-[70px]' },
  { key: 'hair', label: 'HAIR', width: 'min-w-[90px]' },
  { key: 'makeup', label: 'MAKEUP', width: 'min-w-[90px]' },
  { key: 'wardrobe', label: 'WARDROBE', width: 'min-w-[90px]' },
  { key: 'sfx', label: 'SFX', width: 'min-w-[80px]' },
  { key: 'env', label: 'ENV.', width: 'min-w-[80px]' },
  { key: 'action', label: 'ACTION', width: 'min-w-[90px]' },
  { key: 'notes', label: 'NOTES', width: 'min-w-[100px]' },
] as const;

/* ─── Scene Block ─── */

interface SceneBlockProps {
  scene: Scene;
  charIds: string[];
  characterMap: Map<string, Character>;
  resolveLook: (cb: PrepCharacterBreakdown | undefined, characterId: string, sceneNumber: string) => Look | undefined;
  bd: Scene['prepBreakdown'];
  storyDay: string;
  isTimeJump: boolean;
  globalIdx: number;
  findPrevScene: (charId: string, currentIdx: number) => string | null;
}

function SceneBlock({
  scene, charIds, characterMap, resolveLook, bd,
  storyDay, isTimeJump, globalIdx, findPrevScene,
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
      <div className="px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={clsx(
            'flex-shrink-0 px-2 py-0.5 rounded text-xs font-bold',
            scene.intExt === 'INT' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400',
          )}>
            SC {scene.sceneNumber}
          </span>
          {storyDay && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gold text-white text-[10px] font-bold flex-shrink-0">
              {storyDay}
            </span>
          )}
          <span className="text-sm font-medium text-foreground">
            {scene.intExt}. {scene.slugline?.replace(/^(INT\.|EXT\.)\s*/i, '').replace(/\s*-\s*(DAY|NIGHT|MORNING|EVENING|CONTINUOUS)\s*$/i, '') || 'UNKNOWN'} — {scene.timeOfDay}
          </span>
        </div>
      </div>

      {/* Table — horizontally scrollable */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'px-2.5 py-2 text-left text-[10px] font-bold tracking-wider text-text-muted uppercase whitespace-nowrap',
                    col.width,
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {charIds.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-3 text-text-muted text-center">
                  No characters confirmed
                </td>
              </tr>
            ) : (
              charIds.map((cid) => {
                const ch = characterMap.get(cid);
                if (!ch) return null;
                const cb = bd?.characters?.find((c) => c.characterId === cid);
                const look = resolveLook(cb, cid, scene.sceneNumber);
                const resolved = resolveCharacterFields(cb, look);
                const continuity = buildContinuityNotes(cb, cid, globalIdx, findPrevScene, resolved, bd);
                const hasChange = cb?.changeType === 'change';
                const tags = bd?.tags ?? [];
                const tagFor = (cat: string) => tags.filter((t) => t.characterId === cid && t.categoryId === cat);

                return (
                  <tr key={cid} className="align-top">
                    {/* Character */}
                    <td className="px-2.5 py-2.5">
                      <div className="font-semibold text-foreground leading-tight">{ch.name}</div>
                    </td>
                    {/* Look */}
                    <td className="px-2.5 py-2.5">
                      {look ? (
                        <span className="text-gold font-semibold">{look.name}</span>
                      ) : <Empty />}
                    </td>
                    {/* Hair */}
                    <td className="px-2.5 py-2.5">
                      <CellContent
                        value={resolved.hair}
                        tags={tagFor('hair')}
                        tagColor="#D4943A"
                        exit={hasChange ? cb?.exitsWith?.hair : undefined}
                      />
                    </td>
                    {/* Makeup */}
                    <td className="px-2.5 py-2.5">
                      <CellContent
                        value={resolved.makeup}
                        tags={tagFor('makeup')}
                        tagColor="#C2785C"
                        exit={hasChange ? cb?.exitsWith?.makeup : undefined}
                      />
                    </td>
                    {/* Wardrobe */}
                    <td className="px-2.5 py-2.5">
                      <CellContent
                        value={resolved.wardrobe}
                        tags={tagFor('wardrobe')}
                        tagColor="#ec4899"
                        exit={hasChange ? cb?.exitsWith?.wardrobe : undefined}
                      />
                    </td>
                    {/* SFX */}
                    <td className="px-2.5 py-2.5">
                      <CellContent value={resolved.sfx} tags={tagFor('sfx')} tagColor="#ef4444" />
                    </td>
                    {/* Env */}
                    <td className="px-2.5 py-2.5">
                      <CellContent value={resolved.environmental} tags={tagFor('environmental')} tagColor="#38bdf8" />
                    </td>
                    {/* Action */}
                    <td className="px-2.5 py-2.5">
                      <CellContent value={resolved.action} tags={tagFor('action')} tagColor="#a855f7" />
                    </td>
                    {/* Notes */}
                    <td className="px-2.5 py-2.5">
                      {hasChange && cb?.changeNotes && (
                        <div className="text-text-muted mb-0.5">{cb.changeNotes}</div>
                      )}
                      {continuity ? (
                        continuity.startsWith('Same as') ? (
                          <span className="text-text-light italic">{continuity}</span>
                        ) : (
                          <span className="text-text-muted">{continuity}</span>
                        )
                      ) : !hasChange ? <Empty /> : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Table cell content with tags ─── */

function CellContent({
  value,
  tags,
  tagColor,
  exit,
}: {
  value: string;
  tags?: PrepBreakdownTag[];
  tagColor?: string;
  exit?: string;
}) {
  const hasTags = !!tags && tags.length > 0;
  if (!value && !hasTags) return <Empty />;

  return (
    <div>
      {value && <span className="text-text-primary">{value}</span>}
      {hasTags && (
        <div className={clsx('flex flex-wrap gap-1', value && 'mt-1')}>
          {tags!.map((t) => (
            <span
              key={t.id}
              className="inline text-[10px] font-medium pl-1.5 pr-1 py-0 border-l-2 rounded-sm leading-snug"
              style={{ borderColor: tagColor, color: tagColor }}
            >
              {t.text}
            </span>
          ))}
        </div>
      )}
      {exit && <div className="text-[10px] text-text-light italic mt-0.5">Exit: {exit}</div>}
    </div>
  );
}

function Empty() {
  return <span className="text-text-light">—</span>;
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

interface ResolvedFields {
  hair: string;
  makeup: string;
  wardrobe: string;
  sfx: string;
  environmental: string;
  action: string;
}

/* ─── Build continuity notes ─── */

function buildContinuityNotes(
  cb: PrepCharacterBreakdown | undefined,
  charId: string,
  sceneIdx: number,
  findPrevScene: (charId: string, currentIdx: number) => string | null,
  resolved: ResolvedFields,
  bd: PrepSceneBreakdown | undefined,
): string {
  const parts: string[] = [];

  if (bd?.continuityEvents && bd.continuityEvents.length > 0) {
    const events = bd.continuityEvents.filter((e) => e.characterId === charId);
    if (events.length > 0) parts.push(events.map((e) => e.description || e.type).join(', '));
  }

  if (cb?.notes) parts.push(cb.notes);

  const hasManualEntry = cb && (cb.entersWith?.hair || cb.entersWith?.makeup || cb.entersWith?.wardrobe || cb.sfx || cb.environmental || cb.action);
  const hasResolvedAny = resolved.hair || resolved.makeup || resolved.wardrobe || resolved.sfx || resolved.environmental || resolved.action;

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
