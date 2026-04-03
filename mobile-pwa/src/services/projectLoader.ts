/**
 * Project Loader — Mobile PWA
 *
 * Loads all project data from Supabase on project open.
 * Supabase is the source of truth. IndexedDB is the cache.
 *
 * This replaces the pattern of loading from IndexedDB first.
 * When Supabase is available, data comes from there. When offline,
 * falls back to IndexedDB cache.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useProjectStore } from '@/stores/projectStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useCallSheetStore } from '@/stores/callSheetStore';
import { setReceivingFromServer } from '@/services/syncChangeTracker';
import type {
  Scene,
  Character,
  Look,
  ProductionSchedule,
  CallSheet,
  PrepSceneBreakdown,
} from '@/types';

export interface ProjectLoadResult {
  success: boolean;
  fromCache: boolean;
  error?: string;
}

/**
 * Load all project data from Supabase into local stores.
 * This is called when a user opens a project.
 */
export async function loadProjectFromSupabase(projectId: string): Promise<ProjectLoadResult> {
  if (!isSupabaseConfigured) {
    return { success: true, fromCache: true };
  }

  try {
    // Check connectivity
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('[ProjectLoader] No active session — using cached data');
      return { success: true, fromCache: true };
    }

    // Set flag to prevent auto-save from re-uploading what we just downloaded
    setReceivingFromServer(true);

    try {
      // 1. Project record first
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) {
        console.warn('[ProjectLoader] Failed to fetch project:', projectError);
        return { success: true, fromCache: true };
      }

      // 2. Independent data in parallel
      const [
        { data: dbScenes },
        { data: dbCharacters },
        { data: dbLooks },
        { data: dbSchedule },
        { data: dbCallSheets },
        { data: dbScriptUpload },
      ] = await Promise.all([
        supabase.from('scenes').select('*').eq('project_id', projectId).order('scene_number'),
        supabase.from('characters').select('*').eq('project_id', projectId),
        supabase.from('looks').select('*').eq('project_id', projectId),
        supabase.from('schedule_data').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1),
        supabase.from('call_sheet_data').select('*').eq('project_id', projectId).order('production_day'),
        supabase.from('script_uploads').select('*').eq('project_id', projectId).eq('is_active', true).limit(1),
      ]);

      let scenes: Record<string, unknown>[] = dbScenes || [];
      let characters: Record<string, unknown>[] = dbCharacters || [];
      const looks = dbLooks || [];

      // Fallback: if scenes table is empty but script_uploads has parsed_data,
      // restore scenes/characters from there (handles prep upload where the
      // debounced save to scenes table failed or hasn't completed yet).
      let restoredFromParsedData = false;
      const restoredSceneCharacters: Record<string, unknown>[] = [];
      if (scenes.length === 0 && dbScriptUpload && dbScriptUpload.length > 0) {
        const parsedData = dbScriptUpload[0].parsed_data as {
          scenes?: any[]; characters?: any[]; looks?: any[];
        } | null;
        if (parsedData?.scenes && parsedData.scenes.length > 0) {
          console.log(`[ProjectLoader] Restoring from script_uploads.parsed_data — scenes: ${parsedData.scenes.length}`);
          restoredFromParsedData = true;
          scenes = parsedData.scenes.map((ps: any, idx: number) => ({
            id: ps.id || `ps-${idx + 1}`,
            scene_number: String(ps.number ?? ps.sceneNumber ?? idx + 1),
            int_ext: ps.intExt || 'INT',
            location: ps.location || 'UNKNOWN',
            time_of_day: ps.dayNight || ps.timeOfDay || 'DAY',
            synopsis: ps.synopsis || null,
            script_content: ps.scriptContent || ps.content || null,
            shooting_day: ps.shootingDay || null,
            is_complete: ps.isComplete || false,
            completed_at: null,
            filming_status: null,
            filming_notes: null,
            project_id: projectId,
          }));
          // Build scene_characters from parsed_data characterIds
          for (const ps of parsedData.scenes) {
            const sceneId = ps.id || `ps-${parsedData.scenes.indexOf(ps) + 1}`;
            const charIds: string[] = ps.characterIds || [];
            for (const charId of charIds) {
              restoredSceneCharacters.push({ scene_id: sceneId, character_id: charId });
            }
          }
          if (parsedData.characters) {
            characters = parsedData.characters.map((pc: any, idx: number) => ({
              id: pc.id || `char-${idx + 1}`,
              name: pc.name || '',
              initials: pc.initials || (pc.name || '').split(' ').map((w: string) => w[0]).join('').substring(0, 3),
              avatar_colour: pc.avatarColour || '#6366f1',
              project_id: projectId,
              metadata: pc.category ? { category: pc.category, billing: pc.billing } : null,
            }));
          }
        }
      }

      // 3. Junction tables
      let sceneCharacters: Record<string, unknown>[] = [];
      let lookScenes: Record<string, unknown>[] = [];

      if (scenes.length > 0) {
        if (restoredFromParsedData) {
          // Use scene_characters built from parsed_data (not in DB yet)
          sceneCharacters = restoredSceneCharacters;
        } else {
          const sceneIds = scenes.map((s: Record<string, unknown>) => s.id as string);
          const { data: scData } = await supabase
            .from('scene_characters')
            .select('*')
            .in('scene_id', sceneIds);
          sceneCharacters = scData || [];
        }
      }

      if (looks.length > 0) {
        const lookIds = looks.map((l: Record<string, unknown>) => l.id as string);
        const { data: lsData } = await supabase
          .from('look_scenes')
          .select('*')
          .in('look_id', lookIds);
        lookScenes = lsData || [];
      }

      // 4. Map to local types
      const mappedScenes = mapScenes(scenes, sceneCharacters);
      const mappedCharacters = mapCharacters(characters);
      const mappedLooks = mapLooks(looks, lookScenes);

      // 5. Apply to stores
      const currentProject = useProjectStore.getState().currentProject;
      if (currentProject && currentProject.id === projectId) {
        // Merge server data into the existing project
        useProjectStore.getState().mergeServerData({
          scenes: mappedScenes,
          characters: mappedCharacters,
          looks: mappedLooks,
        });
      }

      // Apply schedule if available
      if (dbSchedule && dbSchedule.length > 0) {
        const schedule = mapSchedule(dbSchedule[0]);
        if (schedule) {
          useScheduleStore.getState().setSchedule(schedule);
        }
      }

      // Apply call sheets if available
      if (dbCallSheets && dbCallSheets.length > 0) {
        const mappedCallSheets = dbCallSheets.map(mapCallSheet).filter(Boolean) as CallSheet[];
        if (mappedCallSheets.length > 0) {
          const csStore = useCallSheetStore.getState();
          // Replace call sheets with server data
          for (const cs of mappedCallSheets) {
            const existing = csStore.callSheets.find(c => c.id === cs.id);
            if (!existing) {
              csStore.callSheets.push(cs);
            }
          }
        }
      }

      // Store script URL from project record for the script viewer
      if (project.script_url || (dbScriptUpload && dbScriptUpload.length > 0)) {
        // Script is available — the viewer will use the URL
        console.log('[ProjectLoader] Script available from Supabase');
      }

      console.log(
        `[ProjectLoader] Loaded project from Supabase:`,
        `${mappedScenes.length} scenes,`,
        `${mappedCharacters.length} characters,`,
        `${mappedLooks.length} looks`,
      );

      return { success: true, fromCache: false };
    } finally {
      setReceivingFromServer(false);
    }
  } catch (err) {
    console.error('[ProjectLoader] Failed to load from Supabase:', err);
    return {
      success: true,
      fromCache: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================================
// Data mappers — Supabase rows → mobile store types
// ============================================================================

function mapScenes(
  dbScenes: Record<string, unknown>[],
  sceneCharacters: Record<string, unknown>[],
): Scene[] {
  // Build lookup: sceneId → characterIds
  const scMap = new Map<string, string[]>();
  for (const sc of sceneCharacters) {
    const sceneId = sc.scene_id as string;
    const charId = sc.character_id as string;
    if (!scMap.has(sceneId)) scMap.set(sceneId, []);
    scMap.get(sceneId)!.push(charId);
  }

  return dbScenes.map(row => {
    const charIds = scMap.get(row.id as string) || [];

    // Parse prep breakdown from filming_notes JSON
    let prepBreakdown: PrepSceneBreakdown | undefined;
    if (row.filming_notes) {
      try {
        const parsed = typeof row.filming_notes === 'string'
          ? JSON.parse(row.filming_notes as string)
          : row.filming_notes;
        // Validate it looks like a prep breakdown (has characters array)
        if (parsed && Array.isArray(parsed.characters)) {
          prepBreakdown = parsed as PrepSceneBreakdown;
        }
      } catch {
        // Not valid JSON — treat as plain filming notes string
      }
    }

    return {
      id: row.id as string,
      sceneNumber: (row.scene_number as string) || '0',
      slugline: `${row.int_ext || 'INT'}. ${row.location || 'UNKNOWN'} - ${row.time_of_day || 'DAY'}`,
      intExt: (row.int_ext as 'INT' | 'EXT') || 'INT',
      timeOfDay: ((row.time_of_day as string) || 'DAY') as Scene['timeOfDay'],
      synopsis: (row.synopsis as string) || '',
      scriptContent: (row.script_content as string) || '',
      characters: charIds,
      isComplete: (row.is_complete as boolean) || false,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      filmingStatus: (row.filming_status as Scene['filmingStatus']) || undefined,
      filmingNotes: prepBreakdown ? undefined : ((row.filming_notes as string) || undefined),
      prepBreakdown,
      shootingDay: (row.shooting_day as number) || undefined,
      // Auto-confirm scenes that have characters from the server (e.g. confirmed in Prep)
      characterConfirmationStatus: (charIds.length > 0 || !row.script_content)
        ? 'confirmed' as const
        : 'pending' as const,
    };
  });
}

function mapCharacters(dbCharacters: Record<string, unknown>[]): Character[] {
  return dbCharacters.map(row => {
    const meta = (row.metadata as Record<string, unknown>) || {};
    return {
      id: row.id as string,
      name: (row.name as string) || '',
      initials: (row.initials as string) || ((row.name as string) || '').split(' ').map(w => w[0]).join('').substring(0, 3),
      avatarColour: (row.avatar_colour as string) || undefined,
      actorNumber: (meta.billing as number) || undefined,
      role: ((meta.category as string) === 'supporting_artist' ? 'background' : 'lead') as 'lead' | 'supporting' | 'background',
    };
  });
}

function mapLooks(
  dbLooks: Record<string, unknown>[],
  lookScenes: Record<string, unknown>[],
): Look[] {
  // Build lookup: lookId → scene numbers
  const lsMap = new Map<string, string[]>();
  for (const ls of lookScenes) {
    const lookId = ls.look_id as string;
    const sceneNum = ls.scene_number as string;
    if (!lsMap.has(lookId)) lsMap.set(lookId, []);
    lsMap.get(lookId)!.push(sceneNum);
  }

  return dbLooks.map(row => {
    const hairDetails = (row.hair_details as Record<string, unknown>) || {};
    const makeupDetails = (row.makeup_details as Record<string, unknown>) || {};
    return {
      id: row.id as string,
      characterId: (row.character_id as string) || '',
      name: (row.name as string) || '',
      scenes: lsMap.get(row.id as string) || [],
      estimatedTime: (row.estimated_time as number) || 30,
      masterReference: undefined,
      makeup: {
        foundation: (makeupDetails.notes as string) || '',
      } as any,
      hair: {
        style: (hairDetails.style as string) || '',
      } as any,
      notes: (row.description as string) || '',
    };
  });
}

function mapSchedule(row: Record<string, unknown>): ProductionSchedule | null {
  if (!row) return null;
  return {
    id: row.id as string,
    status: (row.status as 'pending' | 'processing' | 'complete' | 'partial') || 'pending',
    castList: (row.cast_list as any[]) || [],
    days: (row.days as any[]) || [],
    totalDays: Array.isArray(row.days) ? (row.days as any[]).length : 0,
    uploadedAt: row.created_at ? new Date(row.created_at as string) : new Date(),
    rawText: (row.raw_pdf_text as string) || '',
  };
}

function mapCallSheet(row: Record<string, unknown>): CallSheet | null {
  if (!row) return null;
  const parsed = (row.parsed_data as Record<string, unknown>) || {};
  return {
    id: row.id as string,
    date: (row.shoot_date as string) || '',
    productionDay: (row.production_day as number) || 0,
    rawText: (row.raw_text as string) || '',
    uploadedAt: row.created_at ? new Date(row.created_at as string) : new Date(),
    ...parsed,
  } as CallSheet;
}
