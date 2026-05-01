/**
 * Realtime Sync Service for Mobile PWA
 *
 * Subscribes to Supabase Realtime changes pushed from Prep Happy.
 * One channel per project. Handlers update local Zustand state directly
 * from the payload — no re-fetch needed.
 *
 * Channel naming: app:project:{projectId}
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useProjectStore } from '@/stores/projectStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useCallSheetStore } from '@/stores/callSheetStore';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { setReceivingFromServer } from '@/services/syncChangeTracker';
import { loadProjectFromSupabase } from '@/services/projectLoader';
import type { Look, ProductionSchedule, ScheduleCastMember, ScheduleDay, CallSheet } from '@/types';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ChangePayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

let activeChannel: RealtimeChannel | null = null;
let activeProjectId: string | null = null;

// Reconnect state — bounded exponential backoff after CHANNEL_ERROR /
// TIMED_OUT. Reset on every successful SUBSCRIBED status, on explicit
// unsubscribe (project change), and when the user manually retries.
const MAX_RECONNECT_ATTEMPTS = 8;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function clearReconnectState() {
  reconnectAttempts = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  useSyncStore.getState().setRealtimeDisconnected(false);
}

function scheduleReconnect(projectId: string) {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.warn('[AppRealtime] Reconnect budget exhausted; surfacing disconnected state');
    useSyncStore.getState().setRealtimeDisconnected(true);
    return;
  }
  // 2s, 4s, 8s, 16s, 32s, 60s (capped), 60s, 60s — ~3.5 minutes total.
  const delayMs = Math.min(2000 * Math.pow(2, reconnectAttempts), 60_000);
  reconnectAttempts++;
  console.log(
    `[AppRealtime] Channel dropped — scheduling reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delayMs}ms`,
  );
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    // Don't reconnect if the user has navigated away from this project.
    const currentId = useProjectStore.getState().currentProject?.id;
    if (!currentId || currentId !== projectId) {
      clearReconnectState();
      return;
    }
    // resubscribeToProject tears down the old channel and creates a
    // new one, then runs a full project reload to catch up missed events.
    resubscribeToProject(projectId).catch((err) => {
      console.error('[AppRealtime] Reconnect attempt failed:', err);
    });
  }, delayMs);
}

/**
 * Subscribe to Realtime changes for a project.
 * Returns an unsubscribe function.
 */
export function subscribeToProject(projectId: string): () => void {
  if (!isSupabaseConfigured) return () => {};

  // Don't create duplicate subscriptions
  if (activeProjectId === projectId && activeChannel) {
    return () => unsubscribeFromProject();
  }

  // Clean up any existing subscription
  if (activeChannel) {
    unsubscribeFromProject();
  }

  activeProjectId = projectId;

  // ARCHITECTURE.md rule #5: gate Prep-specific subscriptions on
  // has_prep_access. Looks and look_scenes are 99% Prep-driven (the
  // mobile lookbook UI is rarely used on app-only projects), so we
  // skip those subscriptions when this isn't a Designer-led project.
  //
  // Note: scenes / characters / scene_characters / schedule_data /
  // call_sheet_data / timesheets stay always-on because mobile users
  // can still legitimately edit those on app-only projects, and the
  // subscriptions provide multi-device same-user sync for those
  // tables regardless of whether Prep is involved.
  const currentProject = useProjectStore.getState().currentProject;
  const hasPrepAccess = !!currentProject?.hasPrepAccess;

  let chan = supabase
    .channel(`app:project:${projectId}`)

    // Prep added/removed a character on a scene. The junction table has
    // no project_id column (only scene_id, character_id), so we cannot
    // filter at the subscription level — we filter in the handler by
    // checking that the affected scene belongs to the active project.
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'scene_characters',
    }, (payload: ChangePayload) => {
      handleWithFlag(() => {
        handleSceneCharacterChange(payload);
      });
    })

    // Prep updated a scene (notes, synopsis, day number)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'scenes',
      filter: `project_id=eq.${projectId}`,
    }, (payload: ChangePayload) => {
      handleWithFlag(() => {
        handleSceneChange(payload);
      });
    })

    // Prep updated characters
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'characters',
      filter: `project_id=eq.${projectId}`,
    }, (payload: ChangePayload) => {
      handleWithFlag(() => {
        handleCharacterChange(payload);
      });
    });

  // Prep-only subscriptions: looks and the look_scenes junction.
  if (hasPrepAccess) {
    chan = chan
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'looks',
        filter: `project_id=eq.${projectId}`,
      }, (payload: ChangePayload) => {
        handleWithFlag(() => {
          handleLookChange(payload);
        });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'look_scenes',
      }, (payload: ChangePayload) => {
        handleWithFlag(() => {
          handleLookScenesChange(payload);
        });
      });
  }

  activeChannel = chan

    // Timesheet rows updated by prep (or another tab) — reflect the
    // change locally so approval / edits the designer just saved
    // appear without a manual refresh. We only act on rows that
    // belong to the current auth user; everyone else's hours stay on
    // their own device.
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'timesheets',
      filter: `project_id=eq.${projectId}`,
    }, (payload: ChangePayload) => {
      handleWithFlag(() => {
        handleTimesheetChange(payload);
      });
    })

    // Prep updated call sheet
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'call_sheet_data',
      filter: `project_id=eq.${projectId}`,
    }, (payload: ChangePayload) => {
      handleWithFlag(() => {
        handleCallSheetChange(payload);
      });
    })

    // Prep updated schedule
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'schedule_data',
      filter: `project_id=eq.${projectId}`,
    }, (payload: ChangePayload) => {
      handleWithFlag(() => {
        handleScheduleChange(payload);
      });
    })

    // Owner changed a team member's access toggles
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'project_members',
      filter: `project_id=eq.${projectId}`,
    }, (payload: ChangePayload) => {
      handleWithFlag(() => {
        handleMemberAccessChange(payload);
      });
    })

    .subscribe((status) => {
      console.log(`[AppRealtime] Channel app:project:${projectId} status:`, status);
      switch (status) {
        case 'SUBSCRIBED':
          // Successful (re-)connect. Drop any pending retry and clear
          // the persistent disconnected indicator.
          clearReconnectState();
          break;
        case 'CHANNEL_ERROR':
        case 'TIMED_OUT':
          // Network drop or server-side error — back off and try
          // again. CLOSED is intentional teardown so it's not handled.
          scheduleReconnect(projectId);
          break;
      }
    });

  return () => unsubscribeFromProject();
}

/**
 * Unsubscribe from the active project channel. Also clears any
 * pending reconnect state so a stale retry doesn't fire after the
 * user navigates away.
 */
export function unsubscribeFromProject(): void {
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
    activeProjectId = null;
    console.log('[AppRealtime] Unsubscribed from project');
  }
  clearReconnectState();
}

/**
 * Re-subscribe after app comes back to foreground.
 * Also refreshes data to catch any missed updates.
 */
export async function resubscribeToProject(projectId: string): Promise<void> {
  subscribeToProject(projectId);
  await loadProjectFromSupabase(projectId);
}

// ============================================================================
// Handlers — update local Zustand state from Realtime payload
// ============================================================================

function handleWithFlag(fn: () => void) {
  setReceivingFromServer(true);
  try {
    fn();
  } finally {
    setReceivingFromServer(false);
  }
}

/**
 * Apply a Realtime timesheet payload to the local store. Skips the
 * sentinel prep-state row (week_starting='1970-01-01') and any rows
 * whose user_id isn't the current auth user — those belong to other
 * team members and stay on their own devices. The store push
 * triggered by saveEntry / deleteEntry is suppressed by the
 * receivingFromServer flag so we don't echo back.
 */
function handleTimesheetChange(payload: ChangePayload) {
  const newRow = payload.new as
    | { user_id?: string; week_starting?: string; entries?: unknown }
    | null;
  const oldRow = payload.old as
    | { user_id?: string; week_starting?: string }
    | null;
  const week = newRow?.week_starting ?? oldRow?.week_starting;
  if (week === '1970-01-01') return;
  const currentUserId = useAuthStore.getState().user?.id;
  if (!currentUserId) return;
  const rowUserId = newRow?.user_id ?? oldRow?.user_id;
  if (rowUserId !== currentUserId) return;

  // Lazy-import the store to avoid the circular dependency of
  // realtimeSync ← timesheetStore ← timesheetSync ← projectStore.
  import('@/stores/timesheetStore').then(({ useTimesheetStore }) => {
    if (payload.eventType === 'DELETE') {
      // Whole week was wiped server-side; drop the matching local
      // entries so we don't keep stale rows in IndexedDB.
      const monday = week;
      if (!monday) return;
      const all = useTimesheetStore.getState().entries;
      const filtered: typeof all = {};
      for (const [date, e] of Object.entries(all)) {
        const d = new Date(date + 'T00:00:00');
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const m = new Date(d);
        m.setDate(diff);
        if (m.toISOString().slice(0, 10) !== monday) filtered[date] = e;
      }
      useTimesheetStore.setState({ entries: filtered });
      return;
    }
    const rawEntries = Array.isArray(newRow?.entries) ? newRow!.entries : null;
    if (!rawEntries) return;
    // Use the store's existing TimesheetEntry type loosely; the
    // shape is whatever was pushed up earlier so we trust it.
    const list = rawEntries as Array<Record<string, unknown> & { date: string }>;
    useTimesheetStore.setState((state) => {
      const next = { ...state.entries };
      for (const e of list) {
        if (e?.date) next[e.date as string] = e as unknown as typeof state.entries[string];
      }
      return { entries: next };
    });
  });
}

/**
 * scene_characters has no `project_id` column, so the subscription
 * cannot be filtered at the database level. Each event is checked
 * client-side by looking up the affected scene_id in the active project.
 */
function handleSceneCharacterChange(payload: ChangePayload) {
  const store = useProjectStore.getState();
  const project = store.currentProject;
  if (!project) return;

  const newRow = payload.new as { scene_id?: string; character_id?: string } | null;
  const oldRow = payload.old as { scene_id?: string; character_id?: string } | null;
  const sceneId = newRow?.scene_id ?? oldRow?.scene_id;
  const characterId = newRow?.character_id ?? oldRow?.character_id;
  if (!sceneId || !characterId) return;

  // Only react to junction rows for scenes in the currently-loaded project.
  if (!project.scenes.some((s) => s.id === sceneId)) return;

  if (payload.eventType === 'INSERT') {
    store.addCharacterToScene(sceneId, characterId);
    console.log('[AppRealtime] Scene character added:', sceneId, characterId);
    return;
  }

  if (payload.eventType === 'DELETE') {
    store.removeCharacterFromScene(sceneId, characterId);
    console.log('[AppRealtime] Scene character removed:', sceneId, characterId);
    return;
  }

  // UPDATE on this junction is rare (only key columns exist) — log and ignore.
  if (payload.eventType === 'UPDATE') {
    console.log('[AppRealtime] scene_characters UPDATE ignored (no mutable fields):', sceneId, characterId);
  }
}

function handleSceneChange(payload: ChangePayload) {
  const store = useProjectStore.getState();
  const project = store.currentProject;
  if (!project) return;

  if (payload.eventType === 'UPDATE' && payload.new) {
    const updated = payload.new as Record<string, unknown>;
    const sceneId = updated.id as string;
    const existingScene = project.scenes.find(s => s.id === sceneId);

    if (existingScene) {
      // Update synopsis if changed
      const newSynopsis = updated.synopsis as string | undefined;
      if (newSynopsis !== undefined && newSynopsis !== existingScene.synopsis) {
        store.updateSceneSynopsis(sceneId, newSynopsis);
      }

      // Update filming status if changed
      const filmingStatus = updated.filming_status as string | undefined;
      if (filmingStatus && filmingStatus !== existingScene.filmingStatus) {
        store.updateSceneFilmingStatus(
          existingScene.sceneNumber,
          filmingStatus as any,
          (updated.filming_notes as string) || undefined,
        );
      }

      // Parse prep breakdown from filming_notes if it's valid JSON with characters array
      let prepBreakdown = existingScene.prepBreakdown;
      if (updated.filming_notes !== undefined) {
        try {
          const parsed = typeof updated.filming_notes === 'string'
            ? JSON.parse(updated.filming_notes as string)
            : updated.filming_notes;
          if (parsed && Array.isArray(parsed.characters)) {
            prepBreakdown = parsed;
          }
        } catch {
          // Not valid breakdown JSON — ignore
        }
      }

      // For other fields, use mergeServerData to update the scene in place
      const updatedScenes = project.scenes.map(s => {
        if (s.id !== sceneId) return s;
        return {
          ...s,
          scriptContent: (updated.script_content as string) ?? s.scriptContent,
          isComplete: (updated.is_complete as boolean) ?? s.isComplete,
          shootingDay: (updated.shooting_day as number) ?? s.shootingDay,
          prepBreakdown,
        };
      });
      store.mergeServerData({ scenes: updatedScenes });
      console.log('[AppRealtime] Scene updated:', sceneId);
    }
  } else if (payload.eventType === 'INSERT' && payload.new) {
    const row = payload.new as Record<string, unknown>;
    const rowId = row.id as string | undefined;
    const rowSceneNumber = (row.scene_number as string) || '0';

    // Skip if this scene already exists locally — by id (server pushed
    // back our own insert) or by sceneNumber (we already have this scene
    // under a different id). Re-adding would create a duplicate Scene
    // with empty characters, since the realtime payload doesn't include
    // the scene_characters junction rows.
    const alreadyExists = project.scenes.some(
      (s) => (rowId && s.id === rowId) || s.sceneNumber === rowSceneNumber,
    );
    if (alreadyExists) {
      console.log('[AppRealtime] Scene insert ignored (already present):', rowId, rowSceneNumber);
      return;
    }

    store.addScene({
      sceneNumber: rowSceneNumber,
      slugline: `${row.int_ext || 'INT'}. ${row.location || ''} - ${row.time_of_day || 'DAY'}`,
      intExt: (row.int_ext as 'INT' | 'EXT') || 'INT',
      timeOfDay: (row.time_of_day as any) || 'DAY',
      synopsis: (row.synopsis as string) || '',
      scriptContent: (row.script_content as string) || '',
      characters: [],
    });
    console.log('[AppRealtime] Scene inserted:', rowId);
  } else if (payload.eventType === 'DELETE' && payload.old) {
    const sceneId = (payload.old as Record<string, unknown>).id as string | undefined;
    if (!sceneId) return;
    if (!project.scenes.some((s) => s.id === sceneId)) return;
    store.deleteScene(sceneId);
    console.log('[AppRealtime] Scene deleted:', sceneId);
  }
}

function handleCharacterChange(payload: ChangePayload) {
  const store = useProjectStore.getState();
  const project = store.currentProject;
  if (!project) return;

  if (payload.eventType === 'UPDATE' && payload.new) {
    const updated = payload.new as Record<string, unknown>;
    const charId = updated.id as string;
    const existing = project.characters.find(c => c.id === charId);

    if (existing) {
      store.updateCharacter(charId, {
        name: (updated.name as string) ?? existing.name,
      });
      console.log('[AppRealtime] Character updated:', charId);
    }
  } else if (payload.eventType === 'INSERT' && payload.new) {
    // For new characters from Prep, add via mergeServerData
    const row = payload.new as Record<string, unknown>;
    const newChar = {
      id: row.id as string,
      name: (row.name as string) || '',
      initials: (row.initials as string) || '',
      avatarColour: (row.avatar_colour as string) || undefined,
    };
    const updatedCharacters = [...project.characters, newChar];
    store.mergeServerData({ characters: updatedCharacters });
    console.log('[AppRealtime] Character inserted:', row.id);
  } else if (payload.eventType === 'DELETE' && payload.old) {
    const characterId = (payload.old as Record<string, unknown>).id as string | undefined;
    if (!characterId) return;
    if (!project.characters.some((c) => c.id === characterId)) return;
    store.deleteCharacter(characterId);
    console.log('[AppRealtime] Character deleted:', characterId);
  }
}

function parseLookFromRow(row: Record<string, unknown>, existing?: Look): Look {
  const rawMakeup = row.makeup_details as Record<string, unknown> | null;
  const rawHair = row.hair_details as Record<string, unknown> | null;

  // Strip underscore-prefixed metadata keys from makeup_details
  let cleanMakeup: Record<string, unknown> | null = null;
  if (rawMakeup) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawMakeup)) {
      if (!key.startsWith('_')) cleaned[key] = value;
    }
    cleanMakeup = cleaned;
  }

  // Extract master reference photo metadata embedded in makeup_details
  const masterRefMeta = rawMakeup?._masterRef as {
    id: string; thumbnail: string; storagePath: string | null;
    capturedAt: string | null; angle: string | null;
  } | undefined;

  let masterReference = existing?.masterReference;
  if (!masterReference && masterRefMeta?.id) {
    masterReference = {
      id: masterRefMeta.id,
      uri: '',
      thumbnail: masterRefMeta.thumbnail || '',
      capturedAt: masterRefMeta.capturedAt ? new Date(masterRefMeta.capturedAt) : new Date(),
      angle: masterRefMeta.angle as any,
    };
  }

  // Extract embedded continuity/SFX metadata
  const continuityFlagsMeta = rawMakeup?._continuityFlags as any;
  const continuityEventsMeta = rawMakeup?._continuityEvents as any[];
  const sfxDetailsMeta = rawMakeup?._sfxDetails as any;

  return {
    id: row.id as string,
    characterId: (row.character_id as string) || existing?.characterId || '',
    name: (row.name as string) ?? existing?.name ?? '',
    scenes: existing?.scenes || [],
    estimatedTime: (row.estimated_time as number) ?? existing?.estimatedTime ?? 30,
    makeup: cleanMakeup ? (cleanMakeup as any) : (existing?.makeup || {} as any),
    hair: rawHair ? (rawHair as any) : (existing?.hair || {} as any),
    notes: (row.description as string) ?? existing?.notes,
    masterReference,
    continuityFlags: existing?.continuityFlags || continuityFlagsMeta || undefined,
    continuityEvents: existing?.continuityEvents || (continuityEventsMeta && continuityEventsMeta.length > 0
      ? continuityEventsMeta : undefined),
    sfxDetails: existing?.sfxDetails || (sfxDetailsMeta || undefined),
  };
}

function handleLookChange(payload: ChangePayload) {
  const store = useProjectStore.getState();
  const project = store.currentProject;
  if (!project) return;

  if (payload.eventType === 'UPDATE' && payload.new) {
    const updated = payload.new as Record<string, unknown>;
    const lookId = updated.id as string;
    const existing = project.looks.find(l => l.id === lookId);

    if (existing) {
      const parsed = parseLookFromRow(updated, existing);
      // Preserve existing scene assignments (these come from look_scenes, not the looks row)
      parsed.scenes = existing.scenes;
      const updatedLooks = project.looks.map(l => l.id === lookId ? parsed : l);
      store.mergeServerData({ looks: updatedLooks });
      console.log('[AppRealtime] Look updated:', lookId);
    } else {
      // Look not found locally — treat as an insert
      const newLook = parseLookFromRow(updated);
      const updatedLooks = [...project.looks, newLook];
      store.mergeServerData({ looks: updatedLooks });
      console.log('[AppRealtime] Look upserted (was missing locally):', lookId);
    }
  } else if (payload.eventType === 'INSERT' && payload.new) {
    const row = payload.new as Record<string, unknown>;
    const lookId = row.id as string;
    // Prevent duplicates if the look already exists locally
    if (project.looks.some(l => l.id === lookId)) {
      console.log('[AppRealtime] Look INSERT skipped (already exists):', lookId);
      return;
    }
    const newLook = parseLookFromRow(row);
    const updatedLooks = [...project.looks, newLook];
    store.mergeServerData({ looks: updatedLooks });
    console.log('[AppRealtime] Look inserted:', lookId);
  } else if (payload.eventType === 'DELETE' && payload.old) {
    const old = payload.old as Record<string, unknown>;
    const lookId = old.id as string;
    if (lookId) {
      const updatedLooks = project.looks.filter(l => l.id !== lookId);
      store.mergeServerData({ looks: updatedLooks });
      console.log('[AppRealtime] Look deleted:', lookId);
    }
  }
}

function handleLookScenesChange(payload: ChangePayload) {
  const store = useProjectStore.getState();
  const project = store.currentProject;
  if (!project) return;

  // look_scenes changes mean scene assignments changed — refetch them
  // Since realtime gives us individual row changes but we need the full set
  // for a look, we re-query the look_scenes table for the affected look.
  const row = (payload.new || payload.old) as Record<string, unknown> | null;
  if (!row) return;

  const lookId = row.look_id as string;
  if (!lookId) return;

  const existing = project.looks.find(l => l.id === lookId);
  if (!existing) return;

  // Fetch all scene assignments for this look from Supabase
  supabase
    .from('look_scenes')
    .select('scene_number')
    .eq('look_id', lookId)
    .then(({ data, error }) => {
      if (error) {
        console.warn('[AppRealtime] Failed to fetch look_scenes:', error);
        return;
      }
      const sceneNumbers = (data || []).map(r => r.scene_number as string);
      const currentProject = useProjectStore.getState().currentProject;
      if (!currentProject) return;

      const updatedLooks = currentProject.looks.map(l =>
        l.id === lookId ? { ...l, scenes: sceneNumbers } : l
      );

      setReceivingFromServer(true);
      try {
        useProjectStore.getState().mergeServerData({ looks: updatedLooks });
      } finally {
        setReceivingFromServer(false);
      }
      console.log('[AppRealtime] Look scenes updated:', lookId, sceneNumbers);
    });
}

function handleScheduleChange(payload: ChangePayload) {
  if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && payload.new) {
    const row = payload.new as Record<string, unknown>;
    const castList = (row.cast_list as ScheduleCastMember[]) || [];
    const days = (row.days as ScheduleDay[]) || [];
    const status = (row.status as string) === 'complete' ? 'complete' : 'pending';

    if (!days.length && !castList.length) return;

    const scheduleStore = useScheduleStore.getState();
    const current = scheduleStore.schedule;

    const schedule: ProductionSchedule = {
      id: row.id as string,
      status: status as ProductionSchedule['status'],
      castList,
      days,
      totalDays: days.length,
      uploadedAt: new Date((row.created_at as string) || Date.now()),
      rawText: (row.raw_pdf_text as string) || undefined,
      // Preserve local PDF URI if same schedule
      pdfUri: current?.id === (row.id as string) ? current.pdfUri : undefined,
    };

    scheduleStore.setSchedule(schedule);
    console.log('[AppRealtime] Schedule updated from Prep:', row.id);
  }
}

function handleCallSheetChange(payload: ChangePayload) {
  if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && payload.new) {
    const row = payload.new as Record<string, unknown>;
    const parsed = (row.parsed_data || {}) as Record<string, unknown>;

    const callSheet: CallSheet = {
      ...parsed,
      id: row.id as string,
      date: (row.shoot_date as string) || '',
      productionDay: (row.production_day as number) || 0,
      rawText: (row.raw_text as string) || (parsed.rawText as string) || undefined,
      pdfUri: undefined,
      uploadedAt: new Date((row.created_at as string) || Date.now()),
      scenes: (parsed.scenes as CallSheet['scenes']) || [],
    } as CallSheet;

    const store = useCallSheetStore.getState();
    const existingIdx = store.callSheets.findIndex(cs => cs.id === callSheet.id);
    if (existingIdx >= 0) {
      // Update existing
      useCallSheetStore.setState(state => ({
        callSheets: state.callSheets.map(cs =>
          cs.id === callSheet.id ? { ...cs, ...callSheet, pdfUri: cs.pdfUri } : cs
        ),
      }));
    } else {
      // Insert new
      useCallSheetStore.setState(state => ({
        callSheets: [...state.callSheets, callSheet].sort(
          (a, b) => a.productionDay - b.productionDay
        ),
      }));
    }
    console.log('[AppRealtime] Call sheet updated from Prep:', row.id);
  } else if (payload.eventType === 'DELETE' && payload.old) {
    const old = payload.old as Record<string, unknown>;
    const id = old.id as string;
    if (id) {
      useCallSheetStore.setState(state => ({
        callSheets: state.callSheets.filter(cs => cs.id !== id),
      }));
      console.log('[AppRealtime] Call sheet deleted from Prep:', id);
    }
  }
}

function handleMemberAccessChange(payload: ChangePayload) {
  if (payload.eventType !== 'UPDATE' || !payload.new) return;

  const updated = payload.new as Record<string, unknown>;
  const currentUserId = useAuthStore.getState().user?.id;
  if (!currentUserId) return;

  // Only process if this update is for the current user's membership record
  if (updated.user_id !== currentUserId) return;

  // Store the updated access toggles on the auth store's membership record
  // so components can re-read them via getProjectAccess()
  const memberships = useAuthStore.getState().projectMemberships || [];
  const projectId = updated.project_id as string;
  const updatedMemberships = memberships.map(m =>
    m.projectId === projectId
      ? {
          ...m,
          access_breakdown: updated.access_breakdown as boolean,
          access_script: updated.access_script as boolean,
          access_lookbook: updated.access_lookbook as boolean,
          access_callsheets: updated.access_callsheets as boolean,
          access_chat: updated.access_chat as boolean,
          access_continuity: updated.access_continuity as boolean,
          access_hours: updated.access_hours as boolean,
          access_receipts: updated.access_receipts as boolean,
          access_budget: updated.access_budget as boolean,
          access_export_hours: updated.access_export_hours as boolean,
          access_export_invoice: updated.access_export_invoice as boolean,
        }
      : m
  );
  useAuthStore.setState({ projectMemberships: updatedMemberships });
  console.log('[AppRealtime] Access toggles updated for current user on project', projectId);
}

// ============================================================================
// App lifecycle — handle background/foreground transitions
// ============================================================================

let visibilityHandler: (() => void) | null = null;

/**
 * Start listening for app visibility changes.
 * When app goes to background: unsubscribe.
 * When app comes to foreground: re-subscribe and refresh.
 */
export function startLifecycleListener(getProjectId: () => string | null): () => void {
  if (visibilityHandler) return () => {};

  visibilityHandler = () => {
    const projectId = getProjectId();
    if (document.visibilityState === 'hidden') {
      unsubscribeFromProject();
    } else if (document.visibilityState === 'visible' && projectId) {
      resubscribeToProject(projectId);
    }
  };

  document.addEventListener('visibilitychange', visibilityHandler);

  return () => {
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
  };
}
