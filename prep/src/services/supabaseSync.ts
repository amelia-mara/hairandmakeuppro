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
import { useBreakdownStore, useTagStore, useParsedScriptStore } from '@/stores/breakdownStore';
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
    // (e.g. after page reload or scene ID change).
    const existingFilmingNotes = new Map<string, string | null>();
    const { data: existingRows } = await supabase
      .from('scenes')
      .select('id, filming_notes')
      .eq('project_id', projectId);
    if (existingRows) {
      for (const row of existingRows) {
        existingFilmingNotes.set(row.id as string, row.filming_notes as string | null);
      }
    }

    const dbScenes = scenes.map(s => {
      const bd = breakdownState.getBreakdown(s.id);
      const sceneTags = allTags.filter(t => t.sceneId === s.id);
      let filmingNotes: string | null = null;

      if (bd && bd.characters && bd.characters.length > 0) {
        // Real breakdown — resolve form values with look defaults and attach
        // tags as a sideband pill list.
        const resolved = resolveBreakdownForSync(bd, sceneTags, allLooks);
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
        filmingNotes = existingFilmingNotes.get(s.id) ?? null;
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
      };
    });

    // Try the fast path first: upsert on id (works when IDs already match Supabase)
    const { error } = await supabase
      .from('scenes')
      .upsert(dbScenes, { onConflict: 'id' });

    if (error) {
      // Likely a UNIQUE(project_id, scene_number) conflict because local IDs
      // are fresh UUIDs that don't match existing rows.  Fall back to
      // delete-then-insert so the new IDs take effect cleanly.
      console.warn('[PrepSync] Scene upsert conflict, replacing scenes:', error.message);
      const { error: delErr } = await supabase
        .from('scenes')
        .delete()
        .eq('project_id', projectId);
      if (delErr) throw delErr;

      const { error: insErr } = await supabase
        .from('scenes')
        .insert(dbScenes);
      if (insErr) throw insErr;
    }

    // Sync scene_characters junction (non-fatal — data still saved above)
    const sceneIds = scenes.map(s => s.id);
    const entries: { scene_id: string; character_id: string }[] = [];
    for (const scene of scenes) {
      for (const charId of scene.characterIds) {
        entries.push({ scene_id: scene.id, character_id: charId });
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

    // Delete existing characters for this project first, then insert.
    // On script re-upload, new UUIDs are generated for all characters.
    // Without deleting first, old character rows accumulate as orphans.
    await supabase.from('characters').delete().eq('project_id', projectId);
    const { error } = await supabase
      .from('characters')
      .insert(dbChars);
    if (error) throw error;
    console.log('[PrepSync] Characters saved');
  });
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
      makeup_details: { notes: l.makeup, _wardrobe: l.wardrobe } as unknown as Json,
    }));

    // Delete existing looks for this project first, then insert.
    // On script re-upload, new UUIDs are generated for all looks.
    await supabase.from('looks').delete().eq('project_id', projectId);
    const { error } = await supabase
      .from('looks')
      .insert(dbLooks);
    if (error) throw error;

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
 * Save breakdown data for a scene. Stores as metadata on the scene record.
 */
export function saveBreakdown(
  _projectId: string,
  sceneId: string,
  breakdown: Record<string, unknown>,
) {
  if (receivingFromRealtime) return;
  debounced(`breakdown:${sceneId}`, async () => {
    // Store breakdown data in a JSONB column or as part of existing scene data
    // Since there's no dedicated breakdown table, we'll store in scene's metadata
    // by updating the scene record with breakdown info in a way both apps understand
    const { error } = await supabase
      .from('scenes')
      .update({
        // Store breakdown data as part of the scene — mobile reads script_content + synopsis
        // Prep-specific breakdown data goes alongside
        filming_notes: JSON.stringify(breakdown),
      })
      .eq('id', sceneId);
    if (error) throw error;
    console.log('[PrepSync] Breakdown saved for scene', sceneId);
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
  sheet: { id: string; name: string; date: string; dataUri: string; thumbnailUri: string; uploadedAt: string },
): Promise<{ pdfUrl: string; thumbnailUrl: string } | null> {
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

    // Get public URLs
    const { data: pdfUrlData } = supabase.storage.from('project-documents').getPublicUrl(pdfPath);
    const { data: thumbUrlData } = supabase.storage.from('project-documents').getPublicUrl(thumbPath);

    // Save metadata to call_sheet_data
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('call_sheet_data')
      .upsert({
        id: sheet.id,
        project_id: projectId,
        shoot_date: sheet.date,
        parsed_data: {
          name: sheet.name,
          storagePath: pdfPath,
          thumbnailPath: thumbPath,
          pdfUrl: pdfUrlData.publicUrl,
          thumbnailUrl: thumbUrlData.publicUrl,
          uploadedAt: sheet.uploadedAt,
        } as unknown as Json,
        uploaded_by: user?.id || null,
      }, { onConflict: 'id' });
    if (error) throw error;

    console.log('[PrepSync] Call sheet uploaded:', sheet.id);
    return { pdfUrl: pdfUrlData.publicUrl, thumbnailUrl: thumbUrlData.publicUrl };
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
  };
}
