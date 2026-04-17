/**
 * Breakdown — Merged scene breakdown page.
 *
 * Combines the Breakdown table (character/look/hair/makeup per scene) with
 * Scenes page features (set status, view script, character confirmation,
 * continuity navigation). Single page replaces both.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import { AccessRestricted } from '@/components/AccessRestricted';
import { canAccessPrep } from '@/utils/tierUtils';
import { SceneCharacterConfirmation } from '@/components/scenes/SceneCharacterConfirmation';
import { FilmingStatusDropdown, FilmingNotesModal } from '@/components/scenes/FilmingStatusDropdown';
import type {
  Character,
  Look,
  HairDetails,
  MakeupDetails,
  PrepCharacterBreakdown,
  PrepSceneBreakdown,
  PrepBreakdownTag,
  SceneFilmingStatus,
} from '@/types';
import { clsx } from 'clsx';

interface BreakdownProps {
  onSceneSelect?: (sceneId: string) => void;
}

export function Breakdown({ onSceneSelect }: BreakdownProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const updateSceneFilmingStatus = useProjectStore((s) => s.updateSceneFilmingStatus);
  const access = useProjectAccess();
  const [filterChar, setFilterChar] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [confirmSceneId, setConfirmSceneId] = useState<string | null>(null);
  const sceneRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [notesModalState, setNotesModalState] = useState<{
    sceneNumber: string;
    status: 'partial' | 'not-filmed';
  } | null>(null);

  const effectiveTier = useAuthStore((s) => s.getEffectiveTier)();
  const syncStatus = useSyncStore((s) => s.status);
  const lastSynced = useSyncStore((s) => s.lastUploadedAt || s.lastDownloadedAt);
  const hasPrepAccess = !!(currentProject as any)?.hasPrepAccess;
  const showSyncBadge = canAccessPrep(effectiveTier) && hasPrepAccess;

  if (!access.breakdown) return <AccessRestricted />;

  const scenes = currentProject?.scenes ?? [];
  const characters = currentProject?.characters ?? [];
  const looks = currentProject?.looks ?? [];
  const department = currentProject?.department ?? 'hmu';

  // Detect if any scene has prep breakdown data or any looks exist.
  // Mobile-only projects (no Prep) have no prepBreakdown and no looks —
  // only scene number, slugline, story day, and characters are available.
  const hasPrepData = useMemo(() => {
    if (looks.length > 0) return true;
    return scenes.some((s) => s.prepBreakdown?.characters && s.prepBreakdown.characters.length > 0);
  }, [scenes, looks]);

  /* ─── Columns — adapt to available data ─── */

  const COLUMNS = useMemo(() => {
    if (!hasPrepData) {
      // Mobile-only project — only show character and look (look will be empty but column exists for when data arrives)
      return [
        { key: 'character', label: 'CHARACTER', width: 'min-w-[100px]' },
        { key: 'look', label: 'LOOK', width: 'min-w-[70px]' },
      ] as const;
    }
    if (department === 'costume') {
      return [
        { key: 'character', label: 'CHARACTER', width: 'min-w-[100px]' },
        { key: 'look', label: 'LOOK', width: 'min-w-[70px]' },
        { key: 'clothing', label: 'CLOTHING', width: 'min-w-[90px]' },
        { key: 'accessories', label: 'ACCESSORIES', width: 'min-w-[90px]' },
      ] as const;
    }
    return [
      { key: 'character', label: 'CHARACTER', width: 'min-w-[100px]' },
      { key: 'look', label: 'LOOK', width: 'min-w-[70px]' },
      { key: 'hair', label: 'HAIR', width: 'min-w-[90px]' },
      { key: 'makeup', label: 'MAKEUP', width: 'min-w-[90px]' },
    ] as const;
  }, [department, hasPrepData]);

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

  /* ─── Export ─── */

  const buildExportRows = useCallback((): string[][] => {
    const headers = ['Scene', 'Day', 'Character', 'Look', 'Hair', 'Makeup', 'Wardrobe', 'SFX', 'Environmental', 'Action', 'Notes'];
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

  /* ─── Jump to scene ─── */

  const handleJumpToScene = (sceneId: string) => {
    const el = sceneRefs.current.get(sceneId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ─── Filming status handlers ─── */

  const handleFilmingStatusChange = (sceneNumber: string, status: SceneFilmingStatus, notes?: string) => {
    updateSceneFilmingStatus(sceneNumber, status, notes);
  };

  const handleNotesModalOpen = (sceneNumber: string, status: 'partial' | 'not-filmed') => {
    setNotesModalState({ sceneNumber, status });
  };

  const handleNotesConfirm = (notes: string) => {
    if (notesModalState) {
      updateSceneFilmingStatus(notesModalState.sceneNumber, notesModalState.status, notes);
      setNotesModalState(null);
    }
  };

  /* ─── Modal scenes ─── */

  const confirmScene = confirmSceneId ? scenes.find((s) => s.id === confirmSceneId) : null;

  /* ─── Empty states ─── */

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-background pb-safe-bottom">
        <div className="p-6 text-center text-text-muted"><p>No project loaded</p></div>
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-safe-bottom">
        <div className="p-6 text-center">
          <h2 className="text-lg font-semibold text-foreground mb-2">No Breakdown Available</h2>
          <p className="text-sm text-text-muted max-w-xs mx-auto">
            The breakdown will appear here once scenes and characters have been set up.
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
              {/* Prep sync badge */}
              {showSyncBadge && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-green-500/10 text-green-600">
                  {syncStatus === 'synced' && lastSynced
                    ? `Synced ${new Date(lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : syncStatus === 'uploading' || syncStatus === 'downloading'
                      ? 'Syncing...'
                      : 'Prep linked'}
                </span>
              )}
              <button onClick={handleCopy} className="text-xs text-text-muted font-medium px-2 py-1 rounded-md border border-border">
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={handleExportCSV} className="text-xs text-amber font-medium px-2 py-1 rounded-md border border-amber/40">
                Export CSV
              </button>
            </div>
          </div>

          {/* Filters row — compact */}
          <div className="flex items-center gap-2">
            {/* Character filter */}
            <div className="relative flex-1">
              <select
                value={filterChar}
                onChange={(e) => setFilterChar(e.target.value)}
                className="w-full pl-2.5 pr-7 py-1.5 bg-muted rounded-lg text-xs text-foreground border-none outline-none focus:ring-1 focus:ring-amber/50 appearance-none"
              >
                <option value="">All Characters</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-light pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {/* Jump to scene */}
            <div className="relative flex-1">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) handleJumpToScene(e.target.value);
                  e.target.value = '';
                }}
                className="w-full pl-2.5 pr-7 py-1.5 bg-muted rounded-lg text-xs text-foreground border-none outline-none focus:ring-1 focus:ring-amber/50 appearance-none"
              >
                <option value="">Jump to scene...</option>
                {scenesWithCast.map((s) => (
                  <option key={s.id} value={s.id}>SC {s.sceneNumber}</option>
                ))}
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-light pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
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
            const bd = scene.prepBreakdown;
            const charIds = filterChar
              ? scene.characters.filter((c) => c === filterChar)
              : scene.characters;
            const storyDay = bd?.timeline?.day || '';
            const isTimeJump = timeJumpSceneIds.has(scene.id);
            const isUnconfirmed = scene.characterConfirmationStatus !== 'confirmed';

            return (
              <div
                key={scene.id}
                ref={(el) => { if (el) sceneRefs.current.set(scene.id, el); }}
                className={clsx(
                  'rounded-[14px] overflow-hidden',
                  scene.filmingStatus === 'complete' && 'bg-green-500/[0.08]',
                  scene.filmingStatus === 'partial' && 'bg-amber-500/[0.10]',
                  scene.filmingStatus === 'not-filmed' && 'bg-red-500/[0.08]',
                  !scene.filmingStatus && 'bg-card',
                )}
                style={{
                  border: '1px solid rgba(0,0,0,0.08)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.03)',
                }}
              >
                {/* Time jump banner */}
                {isTimeJump && (
                  <div className="px-4 py-1.5 text-[11px] font-semibold flex items-center gap-1.5" style={{ background: 'rgba(232,98,26,0.1)', color: '#C4522A' }}>
                    <span>&#9203;</span>
                    TIME JUMP — {storyDay}
                    {bd?.timeline?.note && <span className="font-normal opacity-80"> &middot; {bd.timeline.note}</span>}
                  </div>
                )}

                {/* Scene header — matches Prep aesthetic */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-center gap-2.5">
                    {/* SC number in accent color, no pill — matches Prep .bs-scene-num */}
                    <span className="flex-shrink-0" style={{ color: '#E8621A', fontSize: '1.125rem', fontWeight: 800, letterSpacing: '0.02em' }}>
                      SC {scene.sceneNumber}
                    </span>
                    {storyDay && (
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-teal text-white text-[0.6875rem] font-bold flex-shrink-0">
                        {storyDay}
                      </span>
                    )}
                    <span className="truncate flex-1" style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-heading, #2A2013)', letterSpacing: '0.01em' }}>
                      {scene.intExt}. {scene.slugline?.replace(/^(INT\.|EXT\.)\s*/i, '').replace(/\s*-\s*(DAY|NIGHT|MORNING|EVENING|CONTINUOUS)\s*$/i, '') || 'UNKNOWN'} — {scene.timeOfDay}
                    </span>

                    {/* Actions */}
                    <FilmingStatusDropdown
                      scene={scene}
                      onStatusChange={handleFilmingStatusChange}
                      onNotesModalOpen={handleNotesModalOpen}
                    />
                    <button
                      onClick={() => setConfirmSceneId(scene.id)}
                      className="text-text-muted p-1 rounded-md hover:bg-black/5 transition-colors flex-shrink-0"
                      title="Add character"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </button>

                    {/* Unconfirmed indicator */}
                    {isUnconfirmed && (
                      <button
                        onClick={() => setConfirmSceneId(scene.id)}
                        className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0"
                        title="Characters unconfirmed"
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Character table — Prep-style */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr style={{ borderTop: '1px solid rgba(0,0,0,0.08)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                        {COLUMNS.map((col) => (
                          <th
                            key={col.key}
                            className={clsx(
                              'px-4 py-2.5 text-left text-[0.6875rem] font-bold tracking-[0.08em] text-text-muted uppercase whitespace-nowrap',
                              col.width,
                            )}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {charIds.length === 0 ? (
                        <tr>
                          <td colSpan={COLUMNS.length} className="px-4 py-4 text-text-muted text-center text-[0.8125rem]">
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
                          const charUnconfirmed = isUnconfirmed;

                          return (
                            <tr
                              key={cid}
                              className={clsx(
                                'align-top cursor-pointer transition-colors hover:bg-black/[0.03]',
                                charUnconfirmed && 'opacity-50',
                              )}
                              style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                              onClick={() => {
                                if (charUnconfirmed) {
                                  setConfirmSceneId(scene.id);
                                } else {
                                  onSceneSelect?.(scene.id);
                                }
                              }}
                            >
                              <td className="px-4 py-3">
                                <div
                                  className="uppercase leading-tight"
                                  style={{ color: '#A0522D', fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.02em' }}
                                >
                                  {ch.name}
                                </div>
                                {ch.actorNumber && !charUnconfirmed && (
                                  <span style={{ fontSize: '0.5625rem', fontWeight: 600, color: 'rgba(80, 60, 30, 0.5)' }}>
                                    {ch.actorNumber}{ch.actorNumber === 1 ? 'st' : ch.actorNumber === 2 ? 'nd' : ch.actorNumber === 3 ? 'rd' : 'th'}
                                  </span>
                                )}
                                {charUnconfirmed && (
                                  <span className="text-[9px] text-amber-500 font-medium">unconfirmed</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-[0.8125rem]">
                                {look ? <span className="text-text-primary">{look.name}</span> : <Empty />}
                              </td>
                              {hasPrepData && department === 'costume' && (
                                <>
                                  <td className="px-4 py-3 text-[0.8125rem]">
                                    <CellContent value={resolved.wardrobe} />
                                  </td>
                                  <td className="px-4 py-3 text-[0.8125rem]">
                                    <CellContent value="" />
                                  </td>
                                </>
                              )}
                              {hasPrepData && department !== 'costume' && (
                                <>
                                  <td className="px-4 py-3 text-[0.8125rem]">
                                    <CellContent value={resolved.hair} tags={bd?.tags?.filter(t => t.characterId === cid && t.categoryId === 'hair')} tagColor="#F5A623" />
                                  </td>
                                  <td className="px-4 py-3 text-[0.8125rem]">
                                    <CellContent value={resolved.makeup} tags={bd?.tags?.filter(t => t.characterId === cid && t.categoryId === 'makeup')} tagColor="#C2785C" />
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Character confirmation modal */}
      {confirmScene && (
        <SceneCharacterConfirmation
          scene={confirmScene}
          onClose={() => setConfirmSceneId(null)}
          onConfirm={() => setConfirmSceneId(null)}
        />
      )}

      {/* Filming notes modal */}
      {notesModalState && (
        <FilmingNotesModal
          sceneNumber={notesModalState.sceneNumber}
          status={notesModalState.status}
          onConfirm={handleNotesConfirm}
          onClose={() => setNotesModalState(null)}
        />
      )}
    </div>
  );
}

/* ─── Table cell content with optional tags ─── */

function CellContent({
  value,
  tags,
  tagColor,
}: {
  value: string;
  tags?: PrepBreakdownTag[];
  tagColor?: string;
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
    sfx: cb?.sfx || (look?.sfxDetails?.sfxRequired && look.sfxDetails.sfxTypes.length > 0 ? look.sfxDetails.sfxTypes.join(', ') : ''),
    environmental: cb?.environmental || '',
    action: cb?.action || '',
  };
}

interface ResolvedFields {
  hair: string; makeup: string; wardrobe: string;
  sfx: string; environmental: string; action: string;
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
