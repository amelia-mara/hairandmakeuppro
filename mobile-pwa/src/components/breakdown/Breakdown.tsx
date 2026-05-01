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
        { key: 'sfx', label: 'SFX / PROSTHETICS', width: 'min-w-[90px]' },
        { key: 'env', label: 'ENVIRONMENTAL', width: 'min-w-[80px]' },
        { key: 'action', label: 'ACTION', width: 'min-w-[80px]' },
        { key: 'notes', label: 'CONTINUITY NOTES', width: 'min-w-[100px]' },
      ] as const;
    }
    return [
      { key: 'character', label: 'CHARACTER', width: 'min-w-[100px]' },
      { key: 'look', label: 'LOOK', width: 'min-w-[70px]' },
      { key: 'hair', label: 'HAIR', width: 'min-w-[90px]' },
      { key: 'makeup', label: 'MAKEUP', width: 'min-w-[90px]' },
      { key: 'wardrobe', label: 'WARDROBE', width: 'min-w-[90px]' },
      { key: 'sfx', label: 'SFX / PROSTHETICS', width: 'min-w-[90px]' },
      { key: 'env', label: 'ENVIRONMENTAL', width: 'min-w-[80px]' },
      { key: 'action', label: 'ACTION', width: 'min-w-[80px]' },
      { key: 'notes', label: 'CONTINUITY NOTES', width: 'min-w-[100px]' },
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

  // When no character filter is active, show every scene — including scenes
  // whose cast is still empty. The per-scene table already renders a
  // "No characters confirmed" row so the user can add characters inline.
  const scenesWithCast = useMemo(() => {
    if (!filterChar) return sortedScenes;
    return sortedScenes.filter((s) => s.characters.includes(filterChar));
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
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-teal-500/10 text-teal-700">
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
            {filterChar ? 'No scenes for this character.' : 'No scenes yet.'}
          </p>
        ) : (
          scenesWithCast.map((scene) => {
            // OMITTED scenes from script revisions render as a thin
            // placeholder card showing the verbatim script line (e.g.
            // "30 OMITTED 30."). They have no characters and no breakdown
            // — the card exists so production crews can see scene 30
            // used to exist even after it's been removed.
            if (scene.isOmitted) {
              return (
                <div
                  key={scene.id}
                  ref={(el) => { if (el) sceneRefs.current.set(scene.id, el); }}
                  className="rounded-[14px] px-4 py-3 flex items-center gap-3 opacity-60"
                  style={{
                    border: '1px dashed rgba(0,0,0,0.18)',
                    backgroundColor: 'rgba(0,0,0,0.02)',
                  }}
                >
                  <span className="flex-shrink-0" style={{ color: '#8A7B5C', fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.02em' }}>
                    SC {scene.sceneNumber}
                  </span>
                  <span className="text-[0.8125rem] font-mono text-text-muted flex-1 truncate">
                    {scene.scriptContent || scene.slugline || 'OMITTED'}
                  </span>
                </div>
              );
            }

            const globalIdx = sortedScenes.indexOf(scene);
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
                className="rounded-[14px] overflow-hidden"
                style={{
                  border: '1px solid rgba(0,0,0,0.08)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.03)',
                  backgroundColor: scene.filmingStatus === 'complete'
                    ? 'rgba(74, 191, 176, 0.10)'    // Teal — matches complete dot #4ABFB0
                    : scene.filmingStatus === 'partial'
                      ? 'rgba(245, 166, 35, 0.10)'  // Amber — matches partial dot #F5A623
                      : scene.filmingStatus === 'not-filmed'
                        ? 'rgba(232, 98, 26, 0.10)'  // Orange — matches incomplete dot #E8621A
                        : 'var(--bg-card, #fff)',
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
                      <tr style={{
                        borderTop: '1px solid rgba(180, 160, 120, 0.25)',
                        borderBottom: '1px solid rgba(180, 160, 120, 0.25)',
                        backgroundColor: 'rgba(210, 195, 165, 0.22)',
                      }}>
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
                                'align-top cursor-pointer transition-colors',
                                charUnconfirmed && 'opacity-50',
                              )}
                              style={{
                                borderBottom: '1px solid rgba(180, 160, 120, 0.18)',
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(210, 195, 165, 0.18)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
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
                              {/* Look */}
                              <td className="px-4 py-3 text-[0.8125rem]">
                                {look ? <span className="text-text-primary">{look.name}</span> : <Empty />}
                              </td>
                              {/* Department-specific columns + shared columns */}
                              {hasPrepData && (() => {
                                const tags = bd?.tags ?? [];
                                const tagFor = (cat: string) => tags.filter(t => t.characterId === cid && t.categoryId === cat);
                                const hasChange = cb?.changeType === 'change';
                                const continuity = buildContinuityNotes(cb, cid, globalIdx, findPrevScene, resolved, bd);
                                return department === 'costume' ? (
                                  <>
                                    <td className="px-4 py-3 text-[0.8125rem]"><CellContent value={resolved.wardrobe} tags={tagFor('clothing')} tagColor="#ec4899" /></td>
                                    <td className="px-4 py-3 text-[0.8125rem]"><CellContent value="" tags={tagFor('accessories')} tagColor="#D4943A" /></td>
                                    <td className="px-4 py-3 text-[0.8125rem]"><CellContent value={resolved.sfx} tags={tagFor('sfx')} tagColor="#ef4444" /></td>
                                    <td className="px-4 py-3 text-[0.8125rem]"><CellContent value={resolved.environmental} tags={tagFor('environmental')} tagColor="#38bdf8" /></td>
                                    <td className="px-4 py-3 text-[0.8125rem]"><CellContent value={resolved.action} tags={tagFor('action')} tagColor="#a855f7" /></td>
                                    <td className="px-4 py-3 text-[0.8125rem]">
                                      {hasChange && cb?.changeNotes && <div className="text-text-muted mb-0.5">{cb.changeNotes}</div>}
                                      {continuity ? (
                                        continuity.startsWith('Same as') ? <span className="text-text-muted italic">{continuity}</span> : <span className="text-text-primary">{continuity}</span>
                                      ) : <Empty />}
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-4 py-3 text-[0.8125rem]"><CellContent value={resolved.hair} tags={tagFor('hair')} tagColor="#D4943A" exit={hasChange ? cb?.exitsWith?.hair : undefined} /></td>
                                    <td className="px-4 py-3 text-[0.8125rem]"><CellContent value={resolved.makeup} tags={tagFor('makeup')} tagColor="#C2785C" exit={hasChange ? cb?.exitsWith?.makeup : undefined} /></td>
                                    <td className="px-4 py-3 text-[0.8125rem]"><CellContent value={resolved.wardrobe} tags={tagFor('wardrobe')} tagColor="#ec4899" exit={hasChange ? cb?.exitsWith?.wardrobe : undefined} /></td>
                                    <td className="px-4 py-3 text-[0.8125rem]"><CellContent value={resolved.sfx} tags={tagFor('sfx')} tagColor="#ef4444" /></td>
                                    <td className="px-4 py-3 text-[0.8125rem]"><CellContent value={resolved.environmental} tags={tagFor('environmental')} tagColor="#38bdf8" /></td>
                                    <td className="px-4 py-3 text-[0.8125rem]"><CellContent value={resolved.action} tags={tagFor('action')} tagColor="#a855f7" /></td>
                                    <td className="px-4 py-3 text-[0.8125rem]">
                                      {hasChange && cb?.changeNotes && <div className="text-text-muted mb-0.5">{cb.changeNotes}</div>}
                                      {continuity ? (
                                        continuity.startsWith('Same as') ? <span className="text-text-muted italic">{continuity}</span> : <span className="text-text-primary">{continuity}</span>
                                      ) : <Empty />}
                                    </td>
                                  </>
                                );
                              })()}
                            </tr>
                          );
                        })
                      )}
                      <BackgroundRow
                        sceneId={scene.id}
                        names={scene.backgroundCharacters || []}
                        notes={scene.backgroundNotes || ''}
                        colSpan={COLUMNS.length}
                      />
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

/* ─── Background row — one row per scene listing non-speaking presence ─── */

function BackgroundRow({
  sceneId,
  names,
  notes,
  colSpan,
}: {
  sceneId: string;
  names: string[];
  notes: string;
  colSpan: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes);
  const updateSceneBackground = useProjectStore((s) => s.updateSceneBackground);

  // Hide the row entirely when there's nothing to show and the user hasn't
  // opened the editor yet — keeps the breakdown clean when a scene has no
  // background presence.
  if (names.length === 0 && !notes && !editing) {
    return (
      <tr className="border-t border-black/5">
        <td colSpan={colSpan} className="px-4 py-2">
          <button
            onClick={() => setEditing(true)}
            className="text-[11px] text-text-muted hover:text-text-secondary transition-colors"
          >
            + Add background
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className="border-t border-black/5"
      style={{ backgroundColor: 'rgba(210, 195, 165, 0.10)' }}
    >
      <td colSpan={colSpan} className="px-4 py-3 text-[0.8125rem]">
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 text-[10px] font-bold tracking-[0.08em] text-text-muted uppercase pt-0.5">
            Background
          </span>
          <div className="flex-1 min-w-0 space-y-1">
            {names.length > 0 ? (
              <div className="text-text-primary">{names.join(', ')}</div>
            ) : (
              <div className="text-text-light italic text-[11px]">No background listed</div>
            )}
            {editing ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  updateSceneBackground(sceneId, { backgroundNotes: draft });
                  setEditing(false);
                }}
                placeholder="Notes (e.g. 6 background, hospital scrubs, no SA prep needed)"
                className="w-full text-[12px] text-text-primary bg-transparent border border-black/10 rounded px-2 py-1 resize-y min-h-[2.25rem] focus:outline-none focus:border-black/25"
                autoFocus
                rows={2}
              />
            ) : notes ? (
              <button
                onClick={() => {
                  setDraft(notes);
                  setEditing(true);
                }}
                className="text-left text-[12px] text-text-secondary hover:text-text-primary transition-colors w-full"
              >
                {notes}
              </button>
            ) : (
              <button
                onClick={() => {
                  setDraft('');
                  setEditing(true);
                }}
                className="text-[11px] text-text-muted hover:text-text-secondary transition-colors"
              >
                + Add notes
              </button>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

/* ─── Table cell content with optional tags ─── */

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
  if (!value && !hasTags && !exit) return <Empty />;

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
      {exit && <div className="text-[10px] text-text-muted italic mt-0.5">Exit: {exit}</div>}
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
