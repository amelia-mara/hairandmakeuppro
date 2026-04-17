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
import { setReceivingFromServer } from '@/services/syncChangeTracker';
import { loadProjectFromSupabase } from '@/services/projectLoader';
import type { Look, ProductionSchedule, ScheduleCastMember, ScheduleDay, CallSheet } from '@/types';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ChangePayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

let activeChannel: RealtimeChannel | null = null;
let activeProjectId: string | null = null;

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

  activeChannel = supabase
    .channel(`app:project:${projectId}`)

    // Prep assigned a look — update look label on breakdown screen
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'scene_characters',
    }, (payload: ChangePayload) => {
      handleWithFlag(() => {
        console.log('[AppRealtime] scene_characters updated:', payload);
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
    })

    // Prep updated looks
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

    // Prep assigned looks to scenes (look_scenes junction)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'look_scenes',
    }, (payload: ChangePayload) => {
      handleWithFlag(() => {
        handleLookScenesChange(payload);
      });
    })

    // Prep approved timesheet hours
    // NOTE: Mobile timesheets are local-only (IndexedDB). Prep stores
    // timesheet state in a sentinel row (week_starting='1970-01-01') with
    // a different structure (crew + production + entries blob). Full
    // two-way timesheet sync requires a design decision on shared format.
    // For now, log the event so it's visible in dev tools.
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'timesheets',
      filter: `project_id=eq.${projectId}`,
    }, (payload: ChangePayload) => {
      handleWithFlag(() => {
        console.log('[AppRealtime] Timesheet updated from Prep:', payload);
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
    });

  return () => unsubscribeFromProject();
}

/**
 * Unsubscribe from the active project channel.
 */
export function unsubscribeFromProject(): void {
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
    activeProjectId = null;
    console.log('[AppRealtime] Unsubscribed from project');
  }
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
