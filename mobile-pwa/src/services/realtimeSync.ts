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
import { setReceivingFromServer } from '@/services/syncChangeTracker';
import { loadProjectFromSupabase } from '@/services/projectLoader';
import type { Look } from '@/types';
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
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'timesheets',
      filter: `project_id=eq.${projectId}`,
    }, (payload: ChangePayload) => {
      handleWithFlag(() => {
        console.log('[AppRealtime] Timesheet updated:', payload);
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
        console.log('[AppRealtime] Call sheet changed:', payload);
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
        console.log('[AppRealtime] Schedule changed:', payload);
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
    store.addScene({
      sceneNumber: (row.scene_number as string) || '0',
      slugline: `${row.int_ext || 'INT'}. ${row.location || ''} - ${row.time_of_day || 'DAY'}`,
      intExt: (row.int_ext as 'INT' | 'EXT') || 'INT',
      timeOfDay: (row.time_of_day as any) || 'DAY',
      synopsis: (row.synopsis as string) || '',
      scriptContent: (row.script_content as string) || '',
      characters: [],
    });
    console.log('[AppRealtime] Scene inserted:', row.id);
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
