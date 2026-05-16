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

/**
 * Extract a numeric day index from a story-day label. "Day 5" → 5,
 * "Day  17 " → 17. Returns null for flashback labels ("Flashback #2"),
 * free-form labels ("Day 1 (later)"), and anything that can't be
 * confidently parsed as a single integer. Used by classifyDayChange
 * to decide whether two consecutive day labels are adjacent (Day 1
 * → Day 2 = NEW STORY DAY) or a real jump (Day 3 → Day 8 = TIME JUMP).
 */
function extractDayNumber(label: string): number | null {
  const m = label.trim().match(/^Day\s+(\d+)\s*$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return isNaN(n) ? null : n;
}

/**
 * Classify a story-day transition between two consecutive scenes.
 * Returns 'new-day' for the next consecutive numeric day (Day 1 →
 * Day 2). Everything else — multi-day gaps, flashback transitions,
 * non-numeric labels — is 'time-jump'.
 */
function classifyDayChange(prev: string, curr: string): 'time-jump' | 'new-day' {
  const prevNum = extractDayNumber(prev);
  const currNum = extractDayNumber(curr);
  if (prevNum != null && currNum != null && currNum - prevNum === 1) {
    return 'new-day';
  }
  return 'time-jump';
}

/**
 * Comparator used to order character tabs in the breakdown.
 *
 * Mirrors the Prep app's script-page character ordering: lead cast
 * first, then supporting, then background; within each role,
 * ascending by `actorNumber` (cast list billing — 1st billed shows
 * up before 2nd, etc); ties broken alphabetically by name. Without
 * this the tab order matched whatever sequence the parser happened
 * to write into `scene.characters`, which mixed leads and minor
 * roles unpredictably.
 *
 * Characters missing role/actorNumber sink to the end so the
 * known-billing cast members stay grouped at the front.
 */
function compareCharsByBilling(a: Character, b: Character): number {
  const roleRank: Record<string, number> = { lead: 0, supporting: 1, background: 2 };
  const aRank = a.role ? (roleRank[a.role] ?? 3) : 3;
  const bRank = b.role ? (roleRank[b.role] ?? 3) : 3;
  if (aRank !== bRank) return aRank - bRank;
  const aNum = a.actorNumber ?? Number.POSITIVE_INFINITY;
  const bNum = b.actorNumber ?? Number.POSITIVE_INFINITY;
  if (aNum !== bNum) return aNum - bNum;
  return (a.name || '').localeCompare(b.name || '');
}

interface BreakdownProps {
  /** Navigate to SceneView for continuity tracking. The optional
   *  characterId comes from the per-scene character-tab "Track →"
   *  button so SceneView opens on the chosen character instead of
   *  defaulting to the first cast member. */
  onSceneSelect?: (sceneId: string, characterId?: string) => void;
}

export function Breakdown({ onSceneSelect }: BreakdownProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const updateSceneFilmingStatus = useProjectStore((s) => s.updateSceneFilmingStatus);
  const access = useProjectAccess();
  const [filterChar, setFilterChar] = useState<string>('');
  const [copied, setCopied] = useState(false);
  /** Per-scene active character — keyed by sceneId so each scene
   *  block remembers which character's card the user last tapped to.
   *  Falls back to first-in-billing-order when not yet set. */
  const [activeCharByScene, setActiveCharByScene] = useState<Record<string, string>>({});
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

  /**
   * Per-scene day-change classification. Whenever the story-day
   * label changes between consecutive scenes we tag the new scene
   * as either:
   *   * 'time-jump' — the gap is more than one numeric day (Day 3
   *     → Day 8), or one side is non-numeric (flashbacks, dream
   *     sequences, etc.). Render the loud TIME JUMP banner with
   *     the timeline note.
   *   * 'new-day' — the next consecutive day (Day 1 → Day 2 or
   *     Day 17 → Day 18). Render the quieter NEW STORY DAY banner.
   *
   * Scenes that share their day with the previous scene get no
   * banner at all.
   */
  const dayChangeBySceneId = useMemo(() => {
    const map = new Map<string, 'time-jump' | 'new-day'>();
    let prevDay = '';
    for (const s of sortedScenes) {
      const day = s.prepBreakdown?.timeline?.day || '';
      if (prevDay && day && day !== prevDay) {
        map.set(s.id, classifyDayChange(prevDay, day));
      }
      if (day) prevDay = day;
    }
    return map;
  }, [sortedScenes]);

  /* ─── Export ─── */

  const buildExportRows = useCallback((): string[][] => {
    // Header order mirrors the on-screen columns + the prep
    // BreakdownSheet export, so the two CSV outputs round-trip
    // cleanly into the same spreadsheet template.
    const headers = ['Scene', 'Day', 'Character', 'Look', 'Hair', 'Makeup', 'Facial Hair', 'SFX / Prosthetics', 'Wardrobe', 'Environmental', 'Action', 'Notes'];
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
        rows.push([
          scene.sceneNumber,
          storyDay,
          ch.name,
          look?.name || '',
          resolved.hair,
          resolved.makeup,
          resolved.facialHair,
          resolved.sfx,
          resolved.wardrobe,
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
            const dayChange = dayChangeBySceneId.get(scene.id);
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
                {/* Day-change banner.
                    Time jump: multi-day gaps and flashback/dream
                    transitions — loud orange band carrying the
                    timeline note ("12 years prior", "May-19" etc.).
                    New story day: the next consecutive numeric day
                    — quieter teal band, no note. */}
                {dayChange === 'time-jump' && (
                  <div
                    className="px-4 py-1.5 text-[11px] font-semibold flex items-center gap-1.5"
                    style={{ background: 'rgba(232,98,26,0.1)', color: '#C4522A' }}
                  >
                    TIME JUMP — {storyDay}
                    {bd?.timeline?.note && (
                      <span className="font-normal opacity-80"> &middot; {bd.timeline.note}</span>
                    )}
                  </div>
                )}
                {dayChange === 'new-day' && (
                  <div
                    className="px-4 py-1.5 text-[11px] font-semibold flex items-center gap-1.5"
                    style={{ background: 'rgba(74, 191, 176, 0.12)', color: '#1F7066' }}
                  >
                    NEW STORY DAY — {storyDay}
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

                {/* Character tabs + active card — replaces the
                    horizontal table that crammed 9 columns into a
                    phone-width viewport. Mobile rendering now stacks
                    one character at a time vertically; the tab strip
                    above lets the user flip between cast members in
                    the scene, and the "Track →" button on the active
                    card opens SceneView for continuity tracking on
                    that character. */}
                {charIds.length === 0 ? (
                  scene.suggestedCharacters && scene.suggestedCharacters.length > 0 ? (
                    <div
                      className="px-4 py-3 space-y-2"
                      style={{ borderTop: '1px solid rgba(180, 160, 120, 0.25)' }}
                    >
                      <div className="text-[10px] font-bold tracking-[0.08em] text-text-muted uppercase">
                        Suggested — tap + above to confirm
                      </div>
                      {scene.suggestedCharacters.map((name) => {
                        const matched = characters.find(
                          (c) => c.name.toUpperCase() === name.toUpperCase(),
                        );
                        return (
                          <div
                            key={`suggested-${name}`}
                            className="text-[0.8125rem] italic opacity-60"
                          >
                            {matched?.name || name}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      className="px-4 py-4 text-text-muted text-center text-[0.8125rem]"
                      style={{ borderTop: '1px solid rgba(180, 160, 120, 0.25)' }}
                    >
                      No characters confirmed
                    </div>
                  )
                ) : (() => {
                  // Sort the scene's cast by billing before handing
                  // it to the tab strip so leads always appear first.
                  // Unknown characters (cast member missing from the
                  // characterMap) slot to the end alphabetically.
                  const orderedCharIds = [...charIds].sort((a, b) => {
                    const ca = characterMap.get(a);
                    const cb = characterMap.get(b);
                    if (!ca && !cb) return 0;
                    if (!ca) return 1;
                    if (!cb) return -1;
                    return compareCharsByBilling(ca, cb);
                  });
                  return (
                    <SceneCharacterCards
                      sceneNumber={scene.sceneNumber}
                      sceneGlobalIdx={globalIdx}
                      charIds={orderedCharIds}
                      characterMap={characterMap}
                      breakdown={bd}
                      department={department}
                      hasPrepData={hasPrepData}
                      resolveLook={resolveLook}
                      findPrevScene={findPrevScene}
                      activeCid={
                        (activeCharByScene[scene.id] && orderedCharIds.includes(activeCharByScene[scene.id]))
                          ? activeCharByScene[scene.id]
                          : orderedCharIds[0]
                      }
                      onSetActive={(cid) =>
                        setActiveCharByScene((prev) => ({ ...prev, [scene.id]: cid }))
                      }
                      isUnconfirmed={isUnconfirmed}
                      onConfirmRequested={() => setConfirmSceneId(scene.id)}
                      onTrack={(cid) => onSceneSelect?.(scene.id, cid)}
                    />
                  );
                })()}

                {/* Background presence — now a freestanding section
                    instead of a tr/colSpan inside the table. */}
                <BackgroundSection
                  sceneId={scene.id}
                  names={scene.backgroundCharacters || []}
                  notes={scene.backgroundNotes || ''}
                />
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

/* ─── Per-scene character tabs + active breakdown card ─────────────
 *
 * Replaces the horizontal table that crammed 9 columns into a
 * phone-width viewport. The tabs strip lets the user flip between
 * cast members in this scene; the card below shows the active
 * character's full breakdown vertically, hiding empty fields. The
 * "Track →" button on the card header is the entry point to
 * SceneView for continuity tracking on the chosen character.
 */
function SceneCharacterCards({
  sceneNumber,
  sceneGlobalIdx,
  charIds,
  characterMap,
  breakdown,
  department,
  hasPrepData,
  resolveLook,
  findPrevScene,
  activeCid,
  onSetActive,
  isUnconfirmed,
  onConfirmRequested,
  onTrack,
}: {
  // sceneId not needed in here — the parent already captures it in
  // the onConfirmRequested and onTrack callbacks.
  sceneNumber: string;
  sceneGlobalIdx: number;
  charIds: string[];
  characterMap: Map<string, Character>;
  breakdown: PrepSceneBreakdown | undefined;
  department: 'hmu' | 'costume';
  hasPrepData: boolean;
  resolveLook: (cb: PrepCharacterBreakdown | undefined, characterId: string, sceneNumber: string) => Look | undefined;
  findPrevScene: (charId: string, currentIdx: number) => string | null;
  activeCid: string;
  onSetActive: (cid: string) => void;
  isUnconfirmed: boolean;
  onConfirmRequested: () => void;
  onTrack: (characterId: string) => void;
}) {
  const activeChar = characterMap.get(activeCid);
  const cb = breakdown?.characters?.find((c) => c.characterId === activeCid);
  const look = resolveLook(cb, activeCid, sceneNumber);
  const resolved = resolveCharacterFields(cb, look);
  const tags = breakdown?.tags ?? [];
  const tagFor = (cat: string) => tags.filter((t) => t.characterId === activeCid && t.categoryId === cat);
  const hasChange = cb?.changeType === 'change';
  const continuity = buildContinuityNotes(cb, activeCid, sceneGlobalIdx, findPrevScene, resolved, breakdown);

  if (!activeChar) return null;

  return (
    <div
      className={clsx(isUnconfirmed && 'opacity-60')}
      style={{ borderTop: '1px solid rgba(180, 160, 120, 0.25)' }}
    >
      {/* Character tabs — horizontally scrollable. Tap to swap the
          visible card; the "Track →" button on the card is what
          opens SceneView for continuity. Two interactions, two
          buttons — no second-tap-to-open trap. */}
      <div className="overflow-x-auto hide-scrollbar">
        <div className="flex gap-2 px-4 py-2.5" style={{ backgroundColor: 'rgba(210, 195, 165, 0.18)' }}>
          {charIds.map((cid) => {
            const ch = characterMap.get(cid);
            if (!ch) return null;
            const isActive = cid === activeCid;
            return (
              <button
                key={cid}
                onClick={() => onSetActive(cid)}
                className={clsx(
                  'flex-shrink-0 px-3 py-1.5 rounded-full text-[0.75rem] font-bold uppercase tracking-[0.04em] transition-colors touch-manipulation',
                  isActive
                    ? 'text-white'
                    : 'bg-white/60 text-text-muted hover:bg-white',
                )}
                style={isActive ? { backgroundColor: '#F5A623' } : undefined}
              >
                {ch.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active character card */}
      <div className="px-4 py-3">
        {/* Card header — name + billing + Track button */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-baseline gap-2 min-w-0">
            <span
              className="uppercase truncate"
              style={{ color: '#A0522D', fontSize: '0.9375rem', fontWeight: 700, letterSpacing: '0.02em' }}
            >
              {activeChar.name}
            </span>
            {activeChar.actorNumber && !isUnconfirmed && (
              <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'rgba(80, 60, 30, 0.55)' }}>
                {activeChar.actorNumber}
                {activeChar.actorNumber === 1 ? 'st' : activeChar.actorNumber === 2 ? 'nd' : activeChar.actorNumber === 3 ? 'rd' : 'th'}
              </span>
            )}
            {isUnconfirmed && (
              <span className="text-[10px] text-amber-600 font-semibold">unconfirmed</span>
            )}
          </div>
          <button
            onClick={() => (isUnconfirmed ? onConfirmRequested() : onTrack(activeCid))}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[0.75rem] font-semibold text-white transition-colors active:scale-95"
            style={{ backgroundColor: '#E8621A' }}
          >
            <span>{isUnconfirmed ? 'Confirm' : 'Track'}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Field rows — only rendered when there's content or a tag
            to show. Keeps the card compact on scenes where the user
            hasn't filled in everything yet. */}
        <div className="space-y-0">
          <CardField label="Look" value={look?.name ?? ''} />
          {hasPrepData && department === 'costume' && (
            <>
              <CardField label="Clothing" value={resolved.wardrobe} tags={tagFor('clothing')} tagColor="#ec4899" />
              <CardField label="Accessories" value="" tags={tagFor('accessories')} tagColor="#D4943A" />
              <CardField label="SFX" value={resolved.sfx} tags={tagFor('sfx')} tagColor="#ef4444" />
              <CardField label="Env" value={resolved.environmental} tags={tagFor('environmental')} tagColor="#38bdf8" />
              <CardField label="Action" value={resolved.action} tags={tagFor('action')} tagColor="#a855f7" />
            </>
          )}
          {hasPrepData && department !== 'costume' && (
            <>
              <CardField label="Hair" value={resolved.hair} tags={tagFor('hair')} tagColor="#D4943A" exit={hasChange ? cb?.exitsWith?.hair : undefined} />
              <CardField label="Makeup" value={resolved.makeup} tags={tagFor('makeup')} tagColor="#C2785C" exit={hasChange ? cb?.exitsWith?.makeup : undefined} />
              <CardField label="Facial Hair" value={resolved.facialHair} tagColor="#B8860B" exit={hasChange ? cb?.exitsWith?.facialHair : undefined} />
              <CardField label="SFX / Pros." value={resolved.sfx} tags={tagFor('sfx')} tagColor="#ef4444" />
              <CardField label="Wardrobe" value={resolved.wardrobe} tags={tagFor('wardrobe')} tagColor="#ec4899" exit={hasChange ? cb?.exitsWith?.wardrobe : undefined} />
              <CardField label="Env" value={resolved.environmental} tags={tagFor('environmental')} tagColor="#38bdf8" />
              <CardField label="Action" value={resolved.action} tags={tagFor('action')} tagColor="#a855f7" />
            </>
          )}
        </div>

        {/* Change-on-exit summary + continuity notes — appended at
            the bottom of the card so "Same as Sc N" sits clearly
            below the breakdown fields rather than inline. */}
        {(hasChange && cb?.changeNotes) || continuity ? (
          <div className="mt-2 pt-2 border-t border-black/5 space-y-1">
            {hasChange && cb?.changeNotes && (
              <div className="text-[0.75rem]">
                <span className="text-[10px] font-bold tracking-wider text-text-muted uppercase mr-2">Change</span>
                <span className="text-text-primary">{cb.changeNotes}</span>
              </div>
            )}
            {continuity && (
              <div className="text-[0.75rem]">
                <span className="text-[10px] font-bold tracking-wider text-text-muted uppercase mr-2">Continuity</span>
                {continuity.startsWith('Same as') ? (
                  <span className="text-text-muted italic">{continuity}</span>
                ) : (
                  <span className="text-text-primary">{continuity}</span>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Single breakdown field row inside a character card ───────────
 *
 * Renders a label + value + optional tag pills + optional exit note.
 * Returns null when the field is fully empty so the card stays
 * compact (the user can still see what they've filled in vs what's
 * blank because the missing label simply doesn't appear).
 */
function CardField({
  label,
  value,
  tags,
  tagColor,
  exit,
}: {
  label: string;
  value: string;
  tags?: PrepBreakdownTag[];
  tagColor?: string;
  exit?: string;
}) {
  const hasTags = !!tags && tags.length > 0;
  if (!value && !hasTags && !exit) return null;
  return (
    <div className="flex gap-3 py-1.5 border-b border-black/5 last:border-0">
      <div className="flex-shrink-0 w-[88px] text-[0.625rem] font-bold tracking-[0.08em] text-text-muted uppercase pt-1">
        {label}
      </div>
      <div className="flex-1 min-w-0 text-[0.8125rem]">
        {value && <div className="text-text-primary leading-snug">{value}</div>}
        {hasTags && (
          <div className={clsx('flex flex-wrap gap-1', value && 'mt-1')}>
            {tags!.map((t) => (
              <span
                key={t.id}
                className="inline-block text-[10px] font-medium pl-1.5 pr-1.5 py-0.5 border-l-2 rounded-sm leading-snug"
                style={{ borderColor: tagColor, color: tagColor }}
              >
                {t.text}
              </span>
            ))}
          </div>
        )}
        {exit && <div className="text-[10px] text-text-muted italic mt-0.5">Exit: {exit}</div>}
      </div>
    </div>
  );
}

/* ─── Background presence section ──────────────────────────────────
 *
 * Replaces the old BackgroundRow that lived inside the table via a
 * <td colSpan>. Same edit semantics — tap notes to edit, autosave on
 * blur — but it's now a freestanding block underneath each scene's
 * character card so it composes cleanly with the new layout.
 */
function BackgroundSection({
  sceneId,
  names,
  notes,
}: {
  sceneId: string;
  names: string[];
  notes: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes);
  const updateSceneBackground = useProjectStore((s) => s.updateSceneBackground);

  if (names.length === 0 && !notes && !editing) return null;

  return (
    <div
      className="px-4 py-3 text-[0.8125rem]"
      style={{
        borderTop: '1px solid rgba(0,0,0,0.05)',
        backgroundColor: 'rgba(210, 195, 165, 0.10)',
      }}
    >
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
    // Facial Hair has no Look-default fallback yet — the Look schema
    // doesn't carry it. Manual prep entry only.
    facialHair: cb?.entersWith?.facialHair || '',
    wardrobe: cb?.entersWith?.wardrobe || '',
    sfx: cb?.sfx || (look?.sfxDetails?.sfxRequired && look.sfxDetails.sfxTypes.length > 0 ? look.sfxDetails.sfxTypes.join(', ') : ''),
    environmental: cb?.environmental || '',
    action: cb?.action || '',
  };
}

interface ResolvedFields {
  hair: string; makeup: string; facialHair: string; wardrobe: string;
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
    // Per-character events scope to this character only.
    const charEvents = bd.continuityEvents.filter((e) => e.characterId === charId);
    // Scene-wide events (no characterId) affect everyone in the scene,
    // so they appear in every character's notes on the simplified mobile
    // breakdown view. Tagged with "(scene-wide)" so the source is clear
    // alongside per-character events. Prep is the authoring surface for
    // these; mobile is display-only.
    const sceneWideEvents = bd.continuityEvents.filter((e) => !e.characterId);
    const eventStrings: string[] = [];
    if (charEvents.length > 0) {
      eventStrings.push(...charEvents.map((e) => e.description || e.type));
    }
    if (sceneWideEvents.length > 0) {
      eventStrings.push(
        ...sceneWideEvents.map((e) => `${e.description || e.type} (scene-wide)`),
      );
    }
    if (eventStrings.length > 0) parts.push(eventStrings.join(', '));
  }
  if (cb?.notes) parts.push(cb.notes);
  const hasManualEntry = cb && (cb.entersWith?.hair || cb.entersWith?.makeup || cb.entersWith?.facialHair || cb.entersWith?.wardrobe || cb.sfx || cb.environmental || cb.action);
  const hasResolvedAny = resolved.hair || resolved.makeup || resolved.facialHair || resolved.wardrobe || resolved.sfx || resolved.environmental || resolved.action;
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
