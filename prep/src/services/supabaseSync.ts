/**
 * Supabase Sync Service for Prep Happy
 *
 * Connects all Prep stores to Supabase as the single source of truth.
 * Each data category has:
 *   - fetch: loads from Supabase on project open
 *   - save: writes to Supabase with 800ms debounce
 *
 * All project data flows through this service. LocalStorage remains
 * only for UI state (theme, sidebar, dashboard layout).
 */

import { supabase } from '@/lib/supabase';
import {
  useBreakdownStore,
  useTagStore,
  useParsedScriptStore,
  useSynopsisStore,
  useSceneMetaStore,
  useBookmarkStore,
} from '@/stores/breakdownStore';
import { resolveBreakdownForSync } from '@/utils/resolveBreakdownForSync';
import type { Json } from '@/types';

// ============================================================================
// Debounce infrastructure (800ms for text fields per spec)
// ============================================================================

const DEBOUNCE_MS = 800;
const timers: Record<string, ReturnType<typeof setTimeout>> = {};
const pendingFns: Record<string, () => Promise<void>> = {};

let _saveStatus: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
let _saveStatusListeners: Array<(status: typeof _saveStatus) => void> = [];

export function getSaveStatus() { return _saveStatus; }
export function onSaveStatusChange(fn: (status: typeof _saveStatus) => void) {
  _saveStatusListeners.push(fn);
  return () => { _saveStatusListeners = _saveStatusListeners.filter(l => l !== fn); };
}

function setSaveStatus(status: typeof _saveStatus) {
  _saveStatus = status;
  _saveStatusListeners.forEach(fn => fn(status));
}

function debounced(key: string, fn: () => Promise<void>): void {
  if (timers[key]) clearTimeout(timers[key]);
  pendingFns[key] = fn;
  setSaveStatus('saving');
  timers[key] = setTimeout(async () => {
    delete timers[key];
    delete pendingFns[key];
    try {
      await fn();
      setSaveStatus('saved');
      setTimeout(() => { if (_saveStatus === 'saved') setSaveStatus('idle'); }, 2000);
    } catch (err) {
      console.error(`[PrepSync] ${key} failed:`, err);
      // Retry once after 2s for transient failures (network blips, etc.)
      setTimeout(async () => {
        try {
          await fn();
          setSaveStatus('saved');
          console.log(`[PrepSync] ${key} retry succeeded`);
          setTimeout(() => { if (_saveStatus === 'saved') setSaveStatus('idle'); }, 2000);
        } catch (retryErr) {
          console.error(`[PrepSync] ${key} retry also failed:`, retryErr);
          setSaveStatus('error');
        }
      }, 2000);
    }
  }, DEBOUNCE_MS);
}

/** Returns true if there are unsaved changes waiting to be flushed. */
export function hasPendingSaves(): boolean {
  return Object.keys(pendingFns).length > 0;
}

/** Flush all pending saves immediately (runs in parallel for speed). */
export async function flushPrepSync(): Promise<void> {
  const fns = Object.values({ ...pendingFns });
  for (const key of Object.keys(timers)) {
    clearTimeout(timers[key]);
    delete timers[key];
  }
  for (const key of Object.keys(pendingFns)) {
    delete pendingFns[key];
  }
  if (fns.length === 0) return;
  console.log(`[PrepSync] Flushing ${fns.length} pending save(s)...`);
  const results = await Promise.allSettled(fns.map(fn => fn()));
  for (const r of results) {
    if (r.status === 'rejected') {
      console.error('[PrepSync] Flush failed:', r.reason);
    }
  }
  console.log('[PrepSync] Flush complete');
}

/** Flag to prevent sync loops when receiving realtime updates. */
export let receivingFromRealtime = false;
export function setReceivingFromRealtime(v: boolean) { receivingFromRealtime = v; }

/**
 * Upsert a per-project set of rows by `id`, then delete any DB rows
 * whose id is no longer in the local set ("orphan cleanup"). Replaces
 * the dangerous delete-all-then-insert pattern that used to live in
 * saveCharacters / saveLooks: both `characters` and `looks` have
 * cascading FKs, so a brief delete-all window could wipe scene
 * assignments / continuity captures via cascade.
 *
 * The empty-`rows` guard is deliberate: an empty local list almost
 * always means the store hasn't loaded yet, not that the user deleted
 * everything, so we'd rather leak orphans than wipe the DB.
 */
async function upsertWithOrphanCleanup(
  table: 'characters' | 'looks',
  projectId: string,
  rows: Array<{ id: string }>,
): Promise<void> {
  if (rows.length === 0) return;

  const upsertResult =
    table === 'characters'
      ? await supabase.from('characters').upsert(rows as never, { onConflict: 'id' })
      : await supabase.from('looks').upsert(rows as never, { onConflict: 'id' });
  if (upsertResult.error) throw upsertResult.error;

  const existingResult =
    table === 'characters'
      ? await supabase.from('characters').select('id').eq('project_id', projectId)
      : await supabase.from('looks').select('id').eq('project_id', projectId);
  if (existingResult.error) {
    console.warn(
      `[PrepSync] Could not list existing ${table}; skipping orphan cleanup:`,
      existingResult.error.message,
    );
    return;
  }

  const localIds = new Set(rows.map((r) => r.id));
  const orphanIds = (existingResult.data || [])
    .map((r) => r.id as string)
    .filter((id) => !localIds.has(id));
  if (orphanIds.length === 0) return;

  const delResult =
    table === 'characters'
      ? await supabase.from('characters').delete().in('id', orphanIds)
      : await supabase.from('looks').delete().in('id', orphanIds);
  if (delResult.error) {
    console.warn(`[PrepSync] Failed to clean up orphan ${table}:`, delResult.error.message);
  } else {
    console.log(`[PrepSync] Removed ${orphanIds.length} orphan ${table} row(s)`);
  }
}

// ============================================================================
// FETCH — Load project data from Supabase
// ============================================================================

export async function fetchProject(projectId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchScenes(projectId: string) {
  const { data, error } = await supabase
    .from('scenes')
    .select('*')
    .eq('project_id', projectId)
    .order('scene_number');
  if (error) throw error;
  return data || [];
}

export async function fetchCharacters(projectId: string) {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('project_id', projectId)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function fetchLooks(projectId: string) {
  const { data, error } = await supabase
    .from('looks')
    .select('*')
    .eq('project_id', projectId);
  if (error) throw error;
  return data || [];
}

export async function fetchSceneCharacters(projectId: string) {
  // Get all scene IDs for this project first, then fetch junction
  const { data: scenes } = await supabase
    .from('scenes')
    .select('id')
    .eq('project_id', projectId);
  if (!scenes || scenes.length === 0) return [];

  const sceneIds = scenes.map(s => s.id);
  const { data, error } = await supabase
    .from('scene_characters')
    .select('*')
    .in('scene_id', sceneIds);
  if (error) throw error;
  return data || [];
}

export async function fetchLookScenes(projectId: string) {
  const { data: looks } = await supabase
    .from('looks')
    .select('id')
    .eq('project_id', projectId);
  if (!looks || looks.length === 0) return [];

  const lookIds = looks.map(l => l.id);
  const { data, error } = await supabase
    .from('look_scenes')
    .select('*')
    .in('look_id', lookIds);
  if (error) throw error;
  return data || [];
}

export async function fetchContinuityEntries(projectId: string) {
  const { data: scenes } = await supabase
    .from('scenes')
    .select('id')
    .eq('project_id', projectId);
  if (!scenes || scenes.length === 0) return [];

  const sceneIds = scenes.map(s => s.id);
  const { data, error } = await supabase
    .from('continuity_events')
    .select('*')
    .in('scene_id', sceneIds);
  if (error) throw error;
  return data || [];
}

export async function fetchPhotos(projectId: string) {
  const entries = await fetchContinuityEntries(projectId);
  if (entries.length === 0) return [];

  const entryIds = entries.map(e => e.id);
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .in('continuity_event_id', entryIds);
  if (error) throw error;
  return data || [];
}

export async function fetchSchedule(projectId: string) {
  const { data, error } = await supabase
    .from('schedule_data')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchCallSheets(projectId: string) {
  const { data, error } = await supabase
    .from('call_sheet_data')
    .select('*')
    .eq('project_id', projectId)
    .order('production_day');
  if (error) throw error;
  return data || [];
}

export async function fetchTimesheetEntries(projectId: string) {
  const { data, error } = await supabase
    .from('timesheets')
    .select('*')
    .eq('project_id', projectId);
  if (error) throw error;
  return data || [];
}

/**
 * Fetch every team member's per-week timesheet rows for this project.
 * Excludes the sentinel prep-state row (week_starting='1970-01-01')
 * which holds prep's own crew/production blob — that's read elsewhere.
 *
 * Each row's `entries` is expected to be an array of TimesheetEntry
 * (the shape mobile pushes). Returns the raw rows so the caller can
 * group / merge as they need.
 */
export async function fetchMemberTimesheets(projectId: string) {
  const { data, error } = await supabase
    .from('timesheets')
    .select('user_id, week_starting, entries, updated_at')
    .eq('project_id', projectId)
    .neq('week_starting', '1970-01-01');
  if (error) {
    console.warn('[PrepSync] fetchMemberTimesheets failed:', error.message);
    return [];
  }
  return data ?? [];
}

export async function fetchScriptUpload(projectId: string) {
  const { data, error } = await supabase
    .from('script_uploads')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ============================================================================
// SAVE — Write project data to Supabase (debounced)
// ============================================================================

/**
 * Save scenes to Supabase. Accepts the Prep Scene format and maps to DB columns.
 */
/**
 * Rewrite scene-id references in every store that keys by sceneId. Called
 * when saveScenes discovers the local store's IDs don't match the DB's
 * (typically after a script_uploads.parsed_data restore that minted fresh
 * UUIDs for scenes that already exist in the scenes table). Without this
 * remap, the local breakdownStore / tagStore / etc. stay tied to the old
 * IDs and saveBreakdown's UPDATE-by-id silently no-ops on every edit.
 */
function remapSceneIdsInStores(projectId: string, idMap: Map<string, string>): void {
  if (idMap.size === 0) return;

  // parsedScriptStore.projects[projectId].scenes
  const parsed = useParsedScriptStore.getState().getParsedData(projectId);
  if (parsed) {
    const newScenes = parsed.scenes.map((s) =>
      idMap.has(s.id) ? { ...s, id: idMap.get(s.id)! } : s,
    );
    useParsedScriptStore.getState().setParsedData(projectId, { ...parsed, scenes: newScenes });
  }

  // breakdownStore.breakdowns (keyed by sceneId)
  const breakdowns = useBreakdownStore.getState().breakdowns;
  const newBd = { ...breakdowns };
  let bdChanged = false;
  for (const [oldId, newId] of idMap) {
    if (newBd[oldId]) {
      newBd[newId] = { ...newBd[oldId], sceneId: newId };
      delete newBd[oldId];
      bdChanged = true;
    }
  }
  if (bdChanged) useBreakdownStore.setState({ breakdowns: newBd });

  // tagStore.tags (each tag has sceneId)
  const tags = useTagStore.getState().tags;
  let tagsChanged = false;
  const newTags = tags.map((t) => {
    if (idMap.has(t.sceneId)) {
      tagsChanged = true;
      return { ...t, sceneId: idMap.get(t.sceneId)! };
    }
    return t;
  });
  if (tagsChanged) useTagStore.setState({ tags: newTags });

  // synopsisStore.synopses (keyed by sceneId)
  const synopses = useSynopsisStore.getState().synopses;
  let synChanged = false;
  const newSyn: Record<string, string> = { ...synopses };
  for (const [oldId, newId] of idMap) {
    if (oldId in newSyn) {
      newSyn[newId] = newSyn[oldId];
      delete newSyn[oldId];
      synChanged = true;
    }
  }
  if (synChanged) useSynopsisStore.setState({ synopses: newSyn });

  // sceneMetaStore.overrides (keyed by sceneId)
  const overrides = useSceneMetaStore.getState().overrides;
  let metaChanged = false;
  const newMeta: typeof overrides = { ...overrides };
  for (const [oldId, newId] of idMap) {
    if (oldId in newMeta) {
      newMeta[newId] = newMeta[oldId];
      delete newMeta[oldId];
      metaChanged = true;
    }
  }
  if (metaChanged) useSceneMetaStore.setState({ overrides: newMeta });

  // bookmarkStore.bookmarks (Record<projectId, sceneId> — remap the value)
  const bookmarks = useBookmarkStore.getState().bookmarks;
  const currentBookmark = bookmarks[projectId];
  if (currentBookmark && idMap.has(currentBookmark)) {
    useBookmarkStore.setState({
      bookmarks: { ...bookmarks, [projectId]: idMap.get(currentBookmark)! },
    });
  }
}

export function saveScenes(
  projectId: string,
  scenes: Array<{
    id: string;
    number: number;
    intExt: string;
    dayNight: string;
    location: string;
    storyDay: string;
    timeInfo: string;
    characterIds: string[];
    synopsis: string;
    scriptContent: string;
    manuallyInserted?: boolean;
    needsReview?: boolean;
    numberSuffix?: string;
  }>,
) {
  if (receivingFromRealtime) return;
  debounced(`scenes:${projectId}`, async () => {
    // Include filming_notes from the breakdown store so breakdown data
    // survives the delete-then-insert fallback and isn't lost during
    // parallel flush on sign-out.
    const breakdownState = useBreakdownStore.getState();
    const allTags = useTagStore.getState().tags;
    const allLooks = useParsedScriptStore.getState().getParsedData(projectId)?.looks ?? [];

    // Fetch existing filming_notes from DB so we don't overwrite breakdown
    // data that was saved by saveBreakdown() but isn't in the local store
    // (e.g. after page reload or scene ID change). Key by
    // (scene_number, number_suffix) so a manually-inserted 5A doesn't
    // inherit the parent scene 5's filming_notes when there's no local
    // breakdown to write.
    const existingFilmingNotes = new Map<string, string | null>();
    const { data: existingRows } = await supabase
      .from('scenes')
      .select('scene_number, number_suffix, filming_notes')
      .eq('project_id', projectId);
    if (existingRows) {
      for (const row of existingRows) {
        const key = `${String(row.scene_number)}|${(row.number_suffix as string | null) ?? ''}`;
        existingFilmingNotes.set(key, row.filming_notes as string | null);
      }
    }

    /** Returns true when a SceneBreakdown carries data worth persisting
     *  via filming_notes. Used to widen the previous
     *  "only save when characters.length > 0" check, which silently
     *  dropped breakdowns that had timeline or continuity-event data
     *  but no character breakdowns yet — the exact shape produced by
     *  the Story Day Breakdown PDF apply on scenes the user hasn't
     *  broken down per-character. */
    const breakdownHasContent = (bd: ReturnType<typeof breakdownState.getBreakdown>): boolean => {
      if (!bd) return false;
      if (bd.characters && bd.characters.length > 0) return true;
      if (bd.continuityEvents && bd.continuityEvents.length > 0) return true;
      const t = bd.timeline;
      if (!t) return false;
      return !!(t.day || t.time || t.type || t.note || t.dayConfirmed);
    };

    const dbScenes = scenes.map(s => {
      const bd = breakdownState.getBreakdown(s.id);
      const sceneTags = allTags.filter(t => t.sceneId === s.id);
      let filmingNotes: string | null = null;

      if (breakdownHasContent(bd)) {
        // Real breakdown — resolve form values with look defaults and attach
        // tags as a sideband pill list. Also catches "timeline-only"
        // breakdowns (Story Day apply on scenes with no character
        // breakdowns yet) so the day/type/note round-trip cleanly.
        const resolved = resolveBreakdownForSync(bd!, sceneTags, allLooks);
        filmingNotes = JSON.stringify(resolved);
      } else if (sceneTags.some(t => !t.dismissed) && s.characterIds && s.characterIds.length > 0) {
        // No local breakdown but there are live tags — build a minimal stub
        // with empty form fields and let resolveBreakdownForSync attach the
        // tags sideband, so mobile can still render pills for this scene.
        const stub = {
          sceneId: s.id,
          timeline: { day: s.storyDay || '', time: '', type: '', note: '' },
          characters: s.characterIds.map((cid: string) => ({
            characterId: cid,
            lookId: '',
            entersWith: { hair: '', makeup: '', wardrobe: '' },
            sfx: '', environmental: '', action: '',
            changeType: 'no-change' as const, changeNotes: '',
            exitsWith: { hair: '', makeup: '', wardrobe: '' },
            notes: '',
          })),
          continuityEvents: [],
        };
        const resolved = resolveBreakdownForSync(stub, sceneTags, allLooks);
        filmingNotes = JSON.stringify(resolved);
      } else {
        // Nothing to write locally — preserve what's already in Supabase.
        filmingNotes = existingFilmingNotes.get(`${String(s.number)}|${s.numberSuffix ?? ''}`) ?? null;
      }
      return {
        id: s.id,
        project_id: projectId,
        scene_number: String(s.number),
        int_ext: s.intExt,
        time_of_day: s.dayNight,
        location: s.location,
        synopsis: s.synopsis,
        script_content: s.scriptContent,
        story_day: s.storyDay ? parseInt(s.storyDay.replace(/\D/g, ''), 10) || null : null,
        filming_notes: filmingNotes,
        manually_inserted: s.manuallyInserted ?? false,
        needs_review: s.needsReview ?? false,
        number_suffix: s.numberSuffix ?? null,
      };
    });

    // Defensive ID remap before upsert. Without this, freshly-minted local
    // scene IDs (e.g. from a script_uploads.parsed_data restore) don't
    // match the DB row IDs, and saveBreakdown's UPDATE WHERE id=X silently
    // matches zero rows (Supabase returns 204 with no rows affected) — the
    // misleading-success chain that kept losing breakdown data on logout.
    //
    // Pre-fetch existing (id, scene_number) for this project, remap the
    // upsert payload AND the local stores so future saveBreakdown calls
    // hit real rows. The DB-level UNIQUE(project_id, scene_number)
    // constraint is dropped in migration 023 because the screenplay
    // domain legitimately produces multiple rows with the same scene
    // number (split scenes: INT/DAY + EXT/NIGHT, [FLASHBACK]
    // continuations, etc.). Each scene is now identified solely by its
    // id, so onConflict='id' is the correct strategy.
    const { data: existingScenes } = await supabase
      .from('scenes')
      .select('id, scene_number, number_suffix')
      .eq('project_id', projectId);
    // Group existing IDs by (scene_number, number_suffix). Split scenes
    // legitimately have multiple DB rows under the same scene_number
    // (one screenplay scene number that maps to INT/DAY + EXT/NIGHT,
    // [FLASHBACK] continuations, etc), AND manually-inserted scenes
    // share their parent's scene_number while carrying a letter suffix
    // (5A, 5B). Keying only by scene_number would collapse 5A onto the
    // unsuffixed 5 during the remap below, corrupting both DB rows.
    // Including number_suffix in the key keeps each variant distinct.
    const idsByKey = new Map<string, string[]>();
    for (const r of (existingScenes ?? [])) {
      const key = `${String(r.scene_number)}|${(r.number_suffix as string | null) ?? ''}`;
      const list = idsByKey.get(key) ?? [];
      list.push(r.id as string);
      idsByKey.set(key, list);
    }
    const idRemap = new Map<string, string>();
    const remappedDbScenes = dbScenes.map((s) => {
      const key = `${s.scene_number}|${s.number_suffix ?? ''}`;
      const existingIds = idsByKey.get(key) ?? [];
      // Only remap when there's exactly one DB row for this
      // (scene_number, suffix) and it doesn't match the local id.
      // Multiple-row cases (true split scenes — same number AND suffix)
      // mean the local ids should already match because they came from
      // fetchScenes; trying to remap would arbitrarily collapse one
      // onto another.
      if (existingIds.length === 1 && existingIds[0] !== s.id) {
        idRemap.set(s.id as string, existingIds[0]);
        return { ...s, id: existingIds[0] };
      }
      return s;
    });
    if (idRemap.size > 0) {
      console.warn(`[PrepSync] saveScenes: remapping ${idRemap.size} scene IDs to match existing DB rows`);
      // Suppress save watchers while we mutate stores — otherwise every
      // store update inside remapSceneIdsInStores fires its watcher and
      // queues a redundant save with the same data we're about to write.
      receivingFromRealtime = true;
      try {
        remapSceneIdsInStores(projectId, idRemap);
      } finally {
        receivingFromRealtime = false;
      }
    }

    // Defensive dedupe by id — last write wins. Even with the
    // single-row-only remap above, an upstream caller could in theory
    // pass a payload that already has duplicate ids (e.g. a store reset
    // racing with a save). Postgres ON CONFLICT DO UPDATE refuses to
    // affect the same row twice in one command, so keep this guard so
    // the upsert never trips that even if something upstream regresses.
    const uniqueDbScenes = Array.from(
      new Map(remappedDbScenes.map((s) => [s.id, s])).values(),
    );
    if (uniqueDbScenes.length !== remappedDbScenes.length) {
      console.warn(
        `[PrepSync] saveScenes: deduped ${remappedDbScenes.length - uniqueDbScenes.length} duplicate scene id(s) from upsert payload`,
      );
    }

    const { error } = await supabase
      .from('scenes')
      .upsert(uniqueDbScenes, { onConflict: 'id' });

    if (error) {
      throw error;
    }

    // Sync scene_characters junction (non-fatal — data still saved above).
    // Use idRemap to translate the input scenes' (possibly stale) ids to
    // whatever was actually persisted, so the junction references real rows.
    const resolveSceneId = (oldId: string) => idRemap.get(oldId) ?? oldId;
    const sceneIds = scenes.map(s => resolveSceneId(s.id));
    const entries: { scene_id: string; character_id: string }[] = [];
    for (const scene of scenes) {
      for (const charId of scene.characterIds) {
        entries.push({ scene_id: resolveSceneId(scene.id), character_id: charId });
      }
    }
    if (sceneIds.length > 0) {
      try {
        await supabase.rpc('sync_scene_characters', {
          p_scene_ids: sceneIds,
          p_entries: entries,
        });
      } catch (rpcErr) {
        console.warn('[PrepSync] sync_scene_characters RPC failed, using fallback:', rpcErr);
        // Fallback: delete + insert directly
        await supabase
          .from('scene_characters')
          .delete()
          .in('scene_id', sceneIds);
        if (entries.length > 0) {
          await supabase
            .from('scene_characters')
            .upsert(entries, { onConflict: 'scene_id,character_id' });
        }
      }
    }
    console.log('[PrepSync] Scenes saved');
  });
}

/**
 * Save characters to Supabase. Stores Prep-specific profile fields in metadata JSONB.
 */
export function saveCharacters(
  projectId: string,
  characters: Array<{
    id: string;
    name: string;
    billing: number;
    category: string;
    age: string;
    gender: string;
    hairColour: string;
    hairType: string;
    eyeColour: string;
    skinTone: string;
    build: string;
    distinguishingFeatures: string;
    notes: string;
  }>,
) {
  if (receivingFromRealtime) return;
  debounced(`characters:${projectId}`, async () => {
    const dbChars = characters.map(c => ({
      id: c.id,
      project_id: projectId,
      name: c.name,
      initials: c.name.split(' ').map(w => w[0]).join('').substring(0, 3),
      metadata: {
        billing: c.billing,
        category: c.category,
        age: c.age,
        gender: c.gender,
        hairColour: c.hairColour,
        hairType: c.hairType,
        eyeColour: c.eyeColour,
        skinTone: c.skinTone,
        build: c.build,
        distinguishingFeatures: c.distinguishingFeatures,
        notes: c.notes,
      } as unknown as Json,
    }));

    await upsertWithOrphanCleanup('characters', projectId, dbChars);
    console.log('[PrepSync] Characters saved');
  });
}

/**
 * Delete a single character from Supabase. Used by the store's explicit
 * removeCharacterEntirely action so the user sees the deletion reflected
 * in the DB (and propagated via realtime) without waiting for the next
 * debounced save. FK ON DELETE CASCADE handles scene_characters and
 * continuity_events for this character only — no project-wide damage.
 */
export async function removeCharacterFromSupabase(characterId: string): Promise<void> {
  const { error } = await supabase
    .from('characters')
    .delete()
    .eq('id', characterId);
  if (error) {
    console.error('[PrepSync] removeCharacterFromSupabase failed:', error.message);
    throw error;
  }
}

/**
 * Save looks to Supabase.
 */
export function saveLooks(
  projectId: string,
  looks: Array<{
    id: string;
    characterId: string;
    name: string;
    description: string;
    hair: string;
    makeup: string;
    wardrobe: string;
    sfx?: string;
    facialHair?: string;
  }>,
  lookSceneMap?: Record<string, string[]>,
) {
  if (receivingFromRealtime) return;
  debounced(`looks:${projectId}`, async () => {
    const dbLooks = looks.map(l => ({
      id: l.id,
      project_id: projectId,
      character_id: l.characterId,
      name: l.name,
      description: l.description,
      hair_details: { style: l.hair } as unknown as Json,
      // Pack wardrobe / sfx / facialHair into makeup_details so we
      // don't need new columns. The underscore-prefix keys mark them
      // as Prep-private extensions; dbToLook reads them back.
      makeup_details: {
        notes: l.makeup,
        _wardrobe: l.wardrobe,
        _sfx: l.sfx ?? '',
        _facialHair: l.facialHair ?? '',
      } as unknown as Json,
    }));

    await upsertWithOrphanCleanup('looks', projectId, dbLooks);

    // Sync look_scenes junction if provided (non-fatal)
    if (lookSceneMap) {
      const lookIds = looks.map(l => l.id);
      const entries: { look_id: string; scene_number: string }[] = [];
      for (const look of looks) {
        const sceneNums = lookSceneMap[look.id] || [];
        for (const sceneNum of sceneNums) {
          entries.push({ look_id: look.id, scene_number: sceneNum });
        }
      }
      if (lookIds.length > 0) {
        try {
          await supabase.rpc('sync_look_scenes', {
            p_look_ids: lookIds,
            p_entries: entries,
          });
        } catch (rpcErr) {
          console.warn('[PrepSync] sync_look_scenes RPC failed, using fallback:', rpcErr);
          await supabase
            .from('look_scenes')
            .delete()
            .in('look_id', lookIds);
          if (entries.length > 0) {
            await supabase
              .from('look_scenes')
              .upsert(entries, { onConflict: 'look_id,scene_number' });
          }
        }
      }
    }
    console.log('[PrepSync] Looks saved');
  });
}

/**
 * Delete a single look from Supabase. Used by the store's deletion path
 * for instant DB feedback rather than waiting for the next debounced
 * save's diff cleanup. look_scenes cascade-deletes; continuity_events
 * SET NULL on look_id, preserving on-set capture history.
 */
export async function removeLookFromSupabase(lookId: string): Promise<void> {
  const { error } = await supabase
    .from('looks')
    .delete()
    .eq('id', lookId);
  if (error) {
    console.error('[PrepSync] removeLookFromSupabase failed:', error.message);
    throw error;
  }
}

/**
 * Save breakdown data for a scene. Stores as metadata on the scene record.
 */
export function saveBreakdown(
  _projectId: string,
  sceneId: string,
  breakdown: Record<string, unknown>,
) {
  if (receivingFromRealtime) {
    console.log('[PrepSync] saveBreakdown SUPPRESSED (receivingFromRealtime) for', sceneId);
    return;
  }
  // Diagnostic: count non-empty character fields so we can spot empty-stub writes.
  const chars = (breakdown as { characters?: Array<Record<string, unknown>> }).characters ?? [];
  const filledFields = chars.reduce((n, c) => {
    const ew = (c.entersWith as Record<string, string> | undefined) ?? {};
    return n
      + (ew.hair ? 1 : 0) + (ew.makeup ? 1 : 0) + (ew.wardrobe ? 1 : 0)
      + (c.sfx ? 1 : 0) + (c.environmental ? 1 : 0) + (c.action ? 1 : 0) + (c.notes ? 1 : 0);
  }, 0);
  console.log(`[PrepSync] saveBreakdown queued: scene=${sceneId} chars=${chars.length} filled=${filledFields}`);
  debounced(`breakdown:${sceneId}`, async () => {
    const { error } = await supabase
      .from('scenes')
      .update({ filming_notes: JSON.stringify(breakdown) })
      .eq('id', sceneId);
    if (error) {
      console.error(`[PrepSync] saveBreakdown FAILED scene=${sceneId}:`, error);
      throw error;
    }
    console.log(`[PrepSync] saveBreakdown OK: scene=${sceneId} chars=${chars.length} filled=${filledFields}`);
  });
}

/**
 * Save continuity tracker data.
 */
export function saveContinuityEntry(
  sceneId: string,
  characterId: string,
  data: {
    lookId?: string;
    status?: string;
    flags?: Record<string, boolean>;
    hairNotes?: string;
    makeupNotes?: string;
    generalNotes?: string;
    costumeLookbook?: { outfit?: string; accessories?: string; breakdown?: string };
  },
) {
  if (receivingFromRealtime) return;
  debounced(`continuity:${sceneId}-${characterId}`, async () => {
    // Build the JSONB payload with costume_lookbook when present
    let continuityEventsData: Json | undefined;
    if (data.costumeLookbook) {
      // Merge with any existing events data — fetch current row first
      const { data: existing } = await supabase
        .from('continuity_events')
        .select('continuity_events_data')
        .eq('id', `${sceneId}-${characterId}`)
        .maybeSingle();
      const raw = existing?.continuity_events_data as Record<string, unknown> | unknown[] | null;
      const base: Record<string, unknown> = Array.isArray(raw) ? { events: raw } : (raw as Record<string, unknown>) || {};
      base.costume_lookbook = data.costumeLookbook;
      continuityEventsData = base as unknown as Json;
    }

    const upsertPayload: Record<string, unknown> = {
      id: `${sceneId}-${characterId}`,
      scene_id: sceneId,
      character_id: characterId,
      look_id: data.lookId || sceneId,
      status: data.status || 'not_started',
      continuity_flags: data.flags as unknown as Json,
      hair_notes: data.hairNotes || null,
      makeup_notes: data.makeupNotes || null,
      general_notes: data.generalNotes || null,
    };
    if (continuityEventsData !== undefined) {
      upsertPayload.continuity_events_data = continuityEventsData;
    }

    const { error } = await supabase
      .from('continuity_events')
      .upsert(upsertPayload, { onConflict: 'id' });
    if (error) throw error;
    console.log('[PrepSync] Continuity entry saved');
  });
}

/**
 * Save schedule data to Supabase.
 */
export function saveSchedule(
  projectId: string,
  schedule: {
    id: string;
    rawText?: string;
    castList?: unknown[];
    days?: unknown[];
    status: string;
  },
) {
  if (receivingFromRealtime) return;
  debounced(`schedule:${projectId}`, async () => {
    const { error } = await supabase
      .from('schedule_data')
      .upsert({
        id: schedule.id,
        project_id: projectId,
        raw_pdf_text: schedule.rawText || '',
        cast_list: (schedule.castList || []) as unknown as Json,
        days: (schedule.days || []) as unknown as Json,
        status: schedule.status === 'complete' ? 'complete' : 'pending',
      }, { onConflict: 'id' });
    if (error) throw error;
    console.log('[PrepSync] Schedule saved');
  });
}

/**
 * Save call sheet data to Supabase.
 */
export function saveCallSheet(
  projectId: string,
  callSheet: {
    id: string;
    date: string;
    productionDay?: number;
    rawText?: string;
    parsedData?: unknown;
  },
) {
  if (receivingFromRealtime) return;
  debounced(`callsheet:${callSheet.id}`, async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('call_sheet_data')
      .upsert({
        id: callSheet.id,
        project_id: projectId,
        shoot_date: callSheet.date,
        production_day: callSheet.productionDay || null,
        raw_text: callSheet.rawText || null,
        parsed_data: (callSheet.parsedData || null) as unknown as Json,
        uploaded_by: user?.id || null,
      }, { onConflict: 'id' });
    if (error) throw error;
    console.log('[PrepSync] Call sheet saved');
  });
}

/**
 * Save timesheet entry to Supabase.
 */
export function saveTimesheetEntry(
  projectId: string,
  userId: string,
  weekStarting: string,
  entries: unknown[],
) {
  if (receivingFromRealtime) return;
  debounced(`timesheet:${projectId}:${userId}:${weekStarting}`, async () => {
    const { error } = await supabase
      .from('timesheets')
      .upsert({
        project_id: projectId,
        user_id: userId,
        week_starting: weekStarting,
        entries: entries as unknown as Json,
      }, { onConflict: 'project_id,user_id,week_starting' });
    if (error) throw error;
    console.log('[PrepSync] Timesheet saved');
  });
}

/**
 * Upload a call sheet PDF + thumbnail to Supabase Storage and save metadata.
 * Returns { pdfUrl, thumbnailUrl } on success.
 */
export async function uploadCallSheetToStorage(
  projectId: string,
  sheet: {
    id: string;
    name: string;
    date: string;
    dataUri?: string;
    thumbnailUri?: string;
    uploadedAt: string;
    parsed?: unknown;
  },
): Promise<{
  pdfUrl: string;
  thumbnailUrl: string;
  storagePath: string;
  thumbnailPath: string;
} | null> {
  if (!sheet.dataUri || !sheet.thumbnailUri) return null;
  try {
    // Upload PDF
    const pdfPath = `${projectId}/callsheets/${sheet.id}.pdf`;
    const pdfBlob = await (await fetch(sheet.dataUri)).blob();
    await supabase.storage
      .from('project-documents')
      .upload(pdfPath, pdfBlob, { upsert: true, contentType: 'application/pdf' });

    // Upload thumbnail
    const thumbPath = `${projectId}/callsheets/${sheet.id}_thumb.png`;
    const thumbBlob = await (await fetch(sheet.thumbnailUri)).blob();
    await supabase.storage
      .from('project-documents')
      .upload(thumbPath, thumbBlob, { upsert: true, contentType: 'image/png' });

    // Signed URLs — bucket is private so getPublicUrl wouldn't actually
    // serve the file. The signed URL is short-lived; treat it as a hint
    // for the immediate post-upload session. On rehydration we re-sign
    // from storagePath / thumbnailPath.
    const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days
    const [{ data: pdfSigned }, { data: thumbSigned }] = await Promise.all([
      supabase.storage.from('project-documents').createSignedUrl(pdfPath, SIGNED_URL_TTL),
      supabase.storage.from('project-documents').createSignedUrl(thumbPath, SIGNED_URL_TTL),
    ]);

    // Compose parsed_data: keep paths (durable) but not URLs (expire).
    // Merge in structured parser fields when present so the dashboard
    // widgets get scenes/castCalls/preCalls without re-parsing.
    const storageMeta = {
      name: sheet.name,
      storagePath: pdfPath,
      thumbnailPath: thumbPath,
      uploadedAt: sheet.uploadedAt,
    };
    // Spread the parsed CallSheet (when present) underneath the storage
    // metadata so the storage URLs always win on key collision. Using a
    // local cast keeps the public signature loose (`unknown`) while the
    // body still gets normal object semantics.
    const parsedAsRecord =
      sheet.parsed && typeof sheet.parsed === 'object'
        ? (sheet.parsed as Record<string, unknown>)
        : undefined;
    const parsedData: Record<string, unknown> = parsedAsRecord
      ? { ...parsedAsRecord, ...storageMeta }
      : storageMeta;

    // Save metadata to call_sheet_data
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('call_sheet_data')
      .upsert({
        id: sheet.id,
        project_id: projectId,
        shoot_date: sheet.date,
        production_day:
          (sheet.parsed && typeof (sheet.parsed as { productionDay?: unknown }).productionDay === 'number')
            ? ((sheet.parsed as { productionDay: number }).productionDay)
            : null,
        raw_text:
          (sheet.parsed && typeof (sheet.parsed as { rawText?: unknown }).rawText === 'string')
            ? ((sheet.parsed as { rawText: string }).rawText)
            : null,
        parsed_data: parsedData as unknown as Json,
        storage_path: pdfPath,
        uploaded_by: user?.id || null,
      }, { onConflict: 'id' });
    if (error) throw error;

    console.log('[PrepSync] Call sheet uploaded:', sheet.id);
    return {
      pdfUrl: pdfSigned?.signedUrl ?? '',
      thumbnailUrl: thumbSigned?.signedUrl ?? '',
      storagePath: pdfPath,
      thumbnailPath: thumbPath,
    };
  } catch (err) {
    console.error('[PrepSync] Call sheet upload failed:', err);
    return null;
  }
}

/**
 * Remove a call sheet from Supabase Storage + DB.
 */
export async function removeCallSheetFromSupabase(
  projectId: string,
  sheetId: string,
): Promise<void> {
  try {
    const pdfPath = `${projectId}/callsheets/${sheetId}.pdf`;
    const thumbPath = `${projectId}/callsheets/${sheetId}_thumb.png`;
    await supabase.storage.from('project-documents').remove([pdfPath, thumbPath]);
    await supabase.from('call_sheet_data').delete().eq('id', sheetId);
    console.log('[PrepSync] Call sheet removed:', sheetId);
  } catch (err) {
    console.error('[PrepSync] Call sheet removal failed:', err);
  }
}

/**
 * Save full timesheet state (crew, production settings, entries) to Supabase.
 * Uses a single JSONB row per project in the timesheets table.
 */
export function saveTimesheetFull(
  projectId: string,
  state: {
    production: unknown;
    crew: unknown[];
    entries: Record<string, unknown>;
  },
) {
  if (receivingFromRealtime) return;
  debounced(`timesheet-full:${projectId}`, async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('timesheets')
      .upsert({
        project_id: projectId,
        user_id: user.id,
        week_starting: '1970-01-01', // sentinel: full Prep state dump
        entries: {
          _prepTimesheetState: true,
          production: state.production,
          crew: state.crew,
          entries: state.entries,
        } as unknown as Json,
      }, { onConflict: 'project_id,user_id,week_starting' });
    if (error) throw error;
    console.log('[PrepSync] Timesheet full state saved');
  });
}

/**
 * Approve a timesheet entry (Designer action).
 */
export async function approveTimesheetEntry(
  projectId: string,
  userId: string,
  weekStarting: string,
  entries: unknown[],
) {
  const { error } = await supabase
    .from('timesheets')
    .update({ entries: entries as unknown as Json })
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('week_starting', weekStarting);
  if (error) throw error;
  console.log('[PrepSync] Timesheet approved');
}

// ============================================================================
// BUDGET — one JSONB row per project
// ============================================================================

export async function fetchBudget(projectId: string) {
  const { data, error } = await supabase
    .from('budget_data')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function saveBudget(
  projectId: string,
  budget: {
    projectInfo: unknown;
    categories: unknown[];
    expenses: unknown[];
    receipts: unknown[];
    isLTD: boolean;
    currency: string;
  },
) {
  if (receivingFromRealtime) return;
  debounced(`budget:${projectId}`, async () => {
    const { error } = await supabase
      .from('budget_data')
      .upsert({
        project_id: projectId,
        project_info: budget.projectInfo as unknown as Json,
        categories: budget.categories as unknown as Json,
        expenses: budget.expenses as unknown as Json,
        receipts: budget.receipts as unknown as Json,
        is_ltd: budget.isLTD,
        currency: budget.currency,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'project_id' });
    if (error) throw error;
    console.log('[PrepSync] Budget saved');
  });
}

// ============================================================================
// SCRIPT TAGS — JSONB array per project
// ============================================================================

export async function fetchTags(projectId: string) {
  const { data, error } = await supabase
    .from('script_tags')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function saveTags(projectId: string, tags: unknown[]) {
  if (receivingFromRealtime) return;
  debounced(`tags:${projectId}`, async () => {
    const { error } = await supabase
      .from('script_tags')
      .upsert({
        project_id: projectId,
        tags: tags as unknown as Json,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'project_id' });
    if (error) throw error;
    console.log('[PrepSync] Tags saved');
  });
}

// ============================================================================
// SCRIPT REVISIONS — latest revision per project
// ============================================================================

export async function fetchRevision(projectId: string) {
  const { data, error } = await supabase
    .from('script_revisions')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function saveRevision(
  projectId: string,
  revision: {
    changes: unknown[];
    reviewedSceneIds: string[];
    filename: string;
    uploadedAt: string;
  },
) {
  if (receivingFromRealtime) return;
  debounced(`revision:${projectId}`, async () => {
    const { error } = await supabase
      .from('script_revisions')
      .upsert({
        project_id: projectId,
        changes: revision.changes as unknown as Json,
        reviewed_scene_ids: revision.reviewedSceneIds as unknown as Json,
        filename: revision.filename,
        uploaded_at: revision.uploadedAt,
      }, { onConflict: 'project_id' });
    if (error) throw error;
    console.log('[PrepSync] Revision saved');
  });
}

// ============================================================================
// CONTINUITY PHOTOS — upload to / download from Supabase Storage
// ============================================================================

/**
 * Upload a continuity photo (data URI) to Supabase Storage.
 * Returns the public URL for the stored file.
 */
export async function uploadContinuityPhoto(
  projectId: string,
  sceneId: string,
  characterId: string,
  photoId: string,
  dataUri: string,
): Promise<string | null> {
  try {
    // Convert data URI to blob
    const res = await fetch(dataUri);
    const blob = await res.blob();
    const ext = blob.type.includes('png') ? 'png' : 'jpg';
    const path = `${projectId}/${sceneId}-${characterId}/${photoId}.${ext}`;

    const { error } = await supabase.storage
      .from('continuity-photos')
      .upload(path, blob, { upsert: true, contentType: blob.type });

    if (error) {
      console.error('[PrepSync] Photo upload failed:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('continuity-photos')
      .getPublicUrl(path);

    console.log('[PrepSync] Photo uploaded:', path);
    return urlData.publicUrl;
  } catch (err) {
    console.error('[PrepSync] Photo upload error:', err);
    return null;
  }
}

/**
 * Get a signed URL for a continuity photo from Supabase Storage.
 */
export async function getContinuityPhotoUrl(storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('continuity-photos')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry
    if (error) throw error;
    return data.signedUrl;
  } catch (err) {
    console.error('[PrepSync] Photo URL error:', err);
    return null;
  }
}

/**
 * Save continuity photo metadata to Supabase.
 * The actual image is in Supabase Storage; this saves the reference.
 */
export function saveContinuityPhotoMeta(
  _projectId: string,
  sceneId: string,
  characterId: string,
  photosData: {
    anglePhotos: Record<string, { id: string; url: string; filename: string; addedAt: string } | undefined>;
    masterRef: { id: string; url: string; filename: string; addedAt: string } | null;
    additional: { id: string; url: string; filename: string; addedAt: string }[];
  },
) {
  if (receivingFromRealtime) return;
  const key = `${sceneId}-${characterId}`;
  debounced(`photos:${key}`, async () => {
    // Store photo metadata in continuity_events as a JSONB field
    const { error } = await supabase
      .from('continuity_events')
      .update({
        continuity_events_data: {
          prep_photos: photosData,
        } as unknown as Json,
      })
      .eq('id', key);
    // If no matching continuity_events row, that's ok — photos depend on continuity entries existing
    if (error && !error.message.includes('0 rows')) {
      throw error;
    }
    console.log('[PrepSync] Photo metadata saved for', key);
  });
}

// ============================================================================
// FULL PROJECT LOAD — fetch everything in correct order
// ============================================================================

export interface PrepProjectData {
  project: Record<string, unknown>;
  scenes: Record<string, unknown>[];
  characters: Record<string, unknown>[];
  looks: Record<string, unknown>[];
  sceneCharacters: Record<string, unknown>[];
  lookScenes: Record<string, unknown>[];
  continuityEntries: Record<string, unknown>[];
  photos: Record<string, unknown>[];
  schedule: Record<string, unknown> | null;
  callSheets: Record<string, unknown>[];
  timesheetEntries: Record<string, unknown>[];
  scriptUpload: Record<string, unknown> | null;
  budget: Record<string, unknown> | null;
  tags: Record<string, unknown> | null;
  revision: Record<string, unknown> | null;
}

export async function loadFullProject(projectId: string): Promise<PrepProjectData> {
  // 1. Project record first
  const project = await fetchProject(projectId);

  // 2. Independent data in parallel
  const [scenes, characters, looks, schedule, callSheets, timesheetEntries, scriptUpload, budget, tags, revision] =
    await Promise.all([
      fetchScenes(projectId),
      fetchCharacters(projectId),
      fetchLooks(projectId),
      fetchSchedule(projectId),
      fetchCallSheets(projectId),
      fetchTimesheetEntries(projectId),
      fetchScriptUpload(projectId),
      fetchBudget(projectId).catch(() => null),
      fetchTags(projectId).catch(() => null),
      fetchRevision(projectId).catch(() => null),
    ]);

  // 3. Dependent data
  const [sceneCharacters, lookScenes] = await Promise.all([
    fetchSceneCharacters(projectId),
    fetchLookScenes(projectId),
  ]);

  // 4. Continuity data
  let continuityEntries: Record<string, unknown>[] = [];
  let photos: Record<string, unknown>[] = [];
  if (scenes.length > 0) {
    const sceneIds = scenes.map((s: Record<string, unknown>) => s.id as string);
    const { data: ceData } = await supabase
      .from('continuity_events')
      .select('*')
      .in('scene_id', sceneIds);
    continuityEntries = ceData || [];

    if (continuityEntries.length > 0) {
      const ceIds = continuityEntries.map((e: Record<string, unknown>) => e.id as string);
      const { data: photoData } = await supabase
        .from('photos')
        .select('*')
        .in('continuity_event_id', ceIds);
      photos = photoData || [];
    }
  }

  return {
    project,
    scenes,
    characters,
    looks,
    sceneCharacters,
    lookScenes,
    continuityEntries,
    photos,
    schedule,
    callSheets,
    budget: budget as Record<string, unknown> | null,
    tags: tags as Record<string, unknown> | null,
    revision: revision as Record<string, unknown> | null,
    timesheetEntries,
    scriptUpload,
  };
}

// ============================================================================
// DATA MAPPERS — Supabase rows → Prep store format
// ============================================================================

/**
 * Map a Supabase scene row to Prep's Scene interface.
 */
export function dbToScene(
  row: Record<string, unknown>,
  sceneCharacterIds: string[],
): {
  id: string;
  number: number;
  intExt: string;
  dayNight: string;
  location: string;
  storyDay: string;
  timeInfo: string;
  characterIds: string[];
  synopsis: string;
  scriptContent: string;
  manuallyInserted?: boolean;
  needsReview?: boolean;
  numberSuffix?: string;
} {
  return {
    id: row.id as string,
    number: parseInt(String(row.scene_number).replace(/\D/g, ''), 10) || 0,
    intExt: (row.int_ext as string) || 'INT',
    dayNight: (row.time_of_day as string) || 'DAY',
    location: (row.location as string) || '',
    storyDay: row.story_day ? `Day ${row.story_day}` : '',
    timeInfo: '',
    characterIds: sceneCharacterIds,
    synopsis: (row.synopsis as string) || '',
    scriptContent: (row.script_content as string) || '',
    manuallyInserted: (row.manually_inserted as boolean) || undefined,
    needsReview: (row.needs_review as boolean) || undefined,
    numberSuffix: (row.number_suffix as string) || undefined,
  };
}

/**
 * Map a Supabase character row to Prep's Character interface.
 */
export function dbToCharacter(row: Record<string, unknown>): {
  id: string;
  name: string;
  billing: number;
  category: string;
  age: string;
  gender: string;
  hairColour: string;
  hairType: string;
  eyeColour: string;
  skinTone: string;
  build: string;
  distinguishingFeatures: string;
  notes: string;
} {
  const meta = (row.metadata as Record<string, unknown>) || {};
  return {
    id: row.id as string,
    name: (row.name as string) || '',
    billing: (meta.billing as number) || 0,
    category: (meta.category as string) || 'principal',
    age: (meta.age as string) || '',
    gender: (meta.gender as string) || '',
    hairColour: (meta.hairColour as string) || '',
    hairType: (meta.hairType as string) || '',
    eyeColour: (meta.eyeColour as string) || '',
    skinTone: (meta.skinTone as string) || '',
    build: (meta.build as string) || '',
    distinguishingFeatures: (meta.distinguishingFeatures as string) || '',
    notes: (meta.notes as string) || '',
  };
}

/**
 * Map a Supabase look row to Prep's Look interface.
 */
export function dbToLook(row: Record<string, unknown>): {
  id: string;
  characterId: string;
  name: string;
  description: string;
  hair: string;
  makeup: string;
  wardrobe: string;
  sfx: string;
  facialHair: string;
} {
  const hairDetails = (row.hair_details as Record<string, unknown>) || {};
  const makeupDetails = (row.makeup_details as Record<string, unknown>) || {};
  return {
    id: row.id as string,
    characterId: (row.character_id as string) || '',
    name: (row.name as string) || '',
    description: (row.description as string) || '',
    hair: (hairDetails.style as string) || '',
    makeup: (makeupDetails.notes as string) || '',
    wardrobe: (makeupDetails._wardrobe as string) || '',
    sfx: (makeupDetails._sfx as string) || '',
    facialHair: (makeupDetails._facialHair as string) || '',
  };
}
