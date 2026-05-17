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
      // 1. Project record first. Use maybeSingle so a missing row
      // returns data=null without throwing — that's the F-34 path
      // we need to handle distinctly from a real query error.
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();

      if (projectError) {
        console.warn('[ProjectLoader] Failed to fetch project:', projectError);
        return { success: true, fromCache: true };
      }
      if (!project) {
        // F-34: the project row is gone (deleted by another client,
        // or the grace period expired and finalizeProjectDeletion
        // hard-deleted it). Previously this path returned
        // { success: true, fromCache: true } and silently fell
        // through, leaving the user on a phantom project. Fail loud:
        // clear the local project and signal the caller via
        // success: false so resubscribeToProject can route the user
        // back to the Hub on its next pass.
        console.warn(
          `[ProjectLoader] Project ${projectId} no longer exists — clearing currentProject`,
        );
        useProjectStore.getState().clearProject();
        return { success: false, fromCache: false, error: 'project-deleted' };
      }

      // 2. Independent data in parallel.
      // schedule_data + call_sheet_data are owned by their respective
      // stores' fetchForProject actions (called from projectStore.
      // setProject). Don't fetch them here — keeps a single ingress
      // per table and avoids the A→B→A race where late-arriving
      // pushes from this loader could overwrite a more recent switch.
      const [
        { data: dbScenes },
        { data: dbCharacters },
        { data: dbLooks },
        { data: dbScriptUpload },
      ] = await Promise.all([
        supabase.from('scenes').select('*').eq('project_id', projectId).order('scene_number'),
        supabase.from('characters').select('*').eq('project_id', projectId),
        supabase.from('looks').select('*').eq('project_id', projectId),
        supabase.from('script_uploads').select('*').eq('project_id', projectId).eq('is_active', true).limit(1),
      ]);

      let scenes: Record<string, unknown>[] = dbScenes || [];
      let characters: Record<string, unknown>[] = dbCharacters || [];
      const looks = dbLooks || [];

      // Fallback: if scenes table is empty but script_uploads has parsed_data,
      // restore scenes/characters from there (handles prep upload where the
      // debounced save to scenes table failed or hasn't completed yet).
      // Also try to merge filming_notes from any existing scene rows so
      // prep breakdown data isn't lost.
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

      // 4. Map to local types. Pass the current local scenes so the
      // mapper can preserve local-only fields (suggestedCharacters,
      // backgroundCharacters, backgroundNotes, characterConfirmation
      // Status) by matching scene id. Without this, every visibility-
      // change foreground reload wipes detected suggestions.
      const existingLocalScenes = useProjectStore.getState().currentProject?.scenes ?? [];
      const mappedScenes = mapScenes(scenes, sceneCharacters, existingLocalScenes);
      const mappedCharacters = mapCharacters(characters);
      const mappedLooks = mapLooks(looks, lookScenes);

      // 5. Apply to stores
      const currentProject = useProjectStore.getState().currentProject;
      if (currentProject && currentProject.id === projectId) {
        // Merge server data into the existing project. has_prep_access
        // gates every Prep-specific sync path (ARCHITECTURE.md rule #5),
        // so it's plumbed through here from the project record.
        useProjectStore.getState().mergeServerData({
          scenes: mappedScenes,
          characters: mappedCharacters,
          looks: mappedLooks,
          hasPrepAccess: !!(project as any).has_prep_access,
        });
      }

      // Refresh schedule + call sheets via their owning stores. This
      // is the path used by resubscribeToProject after a foreground
      // resume — projectStore.setProject already fans out on the
      // initial open, so a normal switch doesn't re-trigger here.
      void useScheduleStore.getState().fetchForProject(projectId);
      void useCallSheetStore.getState().fetchForProject(projectId);

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

      // Diagnostics for lookbook-not-syncing reports. Logs how many
      // looks came back from `looks`, how many look_scenes rows we
      // joined, and how many of the resulting Look objects have
      // orphan characterIds (point at a character that didn't load).
      // Orphans appear as "missing looks" on the lookbook page
      // because the grouping pass filters by allCharacters.
      if (mappedLooks.length === 0 && mappedCharacters.length > 0) {
        console.warn(
          `[ProjectLoader] looks table returned 0 rows for project ${projectId} ` +
            `even though ${mappedCharacters.length} characters loaded. ` +
            `If Prep authored looks for this project they should be in Supabase — ` +
            `check whether saveLooks ever fired on the Prep side, or whether RLS ` +
            `is filtering them out for this user's project_members row.`,
        );
      } else if (mappedLooks.length > 0) {
        const charIds = new Set(mappedCharacters.map((c) => c.id));
        const orphanLooks = mappedLooks.filter((l) => !charIds.has(l.characterId));
        const looksWithoutScenes = mappedLooks.filter((l) => l.scenes.length === 0);
        if (orphanLooks.length > 0) {
          console.warn(
            `[ProjectLoader] ${orphanLooks.length}/${mappedLooks.length} loaded look(s) ` +
              `reference a characterId that didn't load — they'll be invisible on the ` +
              `lookbook page. Look IDs: ${orphanLooks.map((l) => l.id).join(', ')}`,
          );
        }
        if (looksWithoutScenes.length > 0) {
          console.log(
            `[ProjectLoader] ${looksWithoutScenes.length}/${mappedLooks.length} look(s) ` +
              `have no scene assignments in look_scenes — these show "0/0 scenes" on ` +
              `mobile cards. Likely cause: the Prep user assigned the look to a ` +
              `character via the breakdown form but never opened/saved the breakdown.`,
          );
        }
      }

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
  existingLocalScenes: Scene[] = [],
): Scene[] {
  // Build lookup: sceneId → characterIds
  const scMap = new Map<string, string[]>();
  for (const sc of sceneCharacters) {
    const sceneId = sc.scene_id as string;
    const charId = sc.character_id as string;
    if (!scMap.has(sceneId)) scMap.set(sceneId, []);
    scMap.get(sceneId)!.push(charId);
  }

  // Lookup existing local scenes by id so we can preserve the
  // local-only fields Supabase doesn't store (suggestedCharacters,
  // backgroundCharacters, backgroundNotes). Without this, every
  // visibility-change foreground reload wipes detected suggestions
  // and the breakdown collapses back to "No characters confirmed".
  const localById = new Map<string, Scene>();
  for (const s of existingLocalScenes) localById.set(s.id, s);

  return dbScenes.map(row => {
    const charIds = scMap.get(row.id as string) || [];
    const local = localById.get(row.id as string);

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
      // Local-only fields that Supabase doesn't store. Preserve them
      // from the matching local scene (by id) so detected suggestions,
      // background labels and notes survive a foreground reload.
      suggestedCharacters: local?.suggestedCharacters,
      backgroundCharacters: local?.backgroundCharacters,
      backgroundNotes: local?.backgroundNotes,
      // Auto-confirm scenes that have characters from the server (e.g.
      // confirmed in Prep). Otherwise keep the existing local status
      // so a user mid-confirmation doesn't lose their state on reload.
      characterConfirmationStatus: charIds.length > 0 || !row.script_content
        ? ('confirmed' as const)
        : (local?.characterConfirmationStatus ?? ('pending' as const)),
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

  return dbLooks.map((row) => {
    const hairDetailsRaw = (row.hair_details as Record<string, unknown>) || {};
    const makeupDetailsRaw = (row.makeup_details as Record<string, unknown>) || {};

    // Detect Prep-shape vs mobile-native shape.
    //
    // Prep's saveLooks writes:
    //   hair_details = { style: <hair string> }
    //   makeup_details = { notes: <makeup string>,
    //                      _wardrobe, _sfx, _facialHair }
    //
    // Mobile's lookToDb writes the full MakeupDetails / HairDetails
    // objects directly into the JSONB. Detection: prep-shape always
    // has the `notes` key WITHOUT the rich-shape `foundation` key,
    // or carries one of the underscore-prefix extension keys.
    const isPrepShape =
      ('notes' in makeupDetailsRaw && !('foundation' in makeupDetailsRaw)) ||
      '_wardrobe' in makeupDetailsRaw ||
      '_sfx' in makeupDetailsRaw ||
      '_facialHair' in makeupDetailsRaw;

    const prepHair = (hairDetailsRaw.style as string) || '';
    const prepMakeup = (makeupDetailsRaw.notes as string) || '';
    const prepWardrobe = (makeupDetailsRaw._wardrobe as string) || '';
    const prepSfx = (makeupDetailsRaw._sfx as string) || '';
    const prepFacialHair = (makeupDetailsRaw._facialHair as string) || '';

    let makeup: any;
    let hair: any;
    let sfxDetails: any;
    let masterReference: any;
    let continuityFlags: any;
    let continuityEvents: any;
    let prepSummary: Look['prepSummary'];

    if (isPrepShape) {
      // Prep-style: surface the strings into the mobile structured
      // objects' primary fields (foundation / style) AND carry the
      // full free-text bundle on prepSummary so the lookbook view can
      // render the original prep entry as a read-only block.
      makeup = { foundation: prepMakeup };
      hair = { style: prepHair };
      // Promote the SFX string to a minimal SFXDetails so screens
      // that read `sfxDetails` (lookbook SFX accordion, etc) get a
      // non-empty value to display.
      if (prepSfx) {
        sfxDetails = {
          sfxRequired: true,
          sfxTypes: ['Prosthetics'],
          prostheticPieces: prepSfx,
          prostheticAdhesive: '',
          bloodTypes: [],
          bloodProducts: '',
          bloodPlacement: '',
          tattooCoverage: '',
          temporaryTattoos: '',
          contactLenses: '',
          teeth: '',
          agingCharacterNotes: '',
          sfxApplicationTime: null,
          sfxReferencePhotos: [],
        };
      }
      prepSummary = {
        hair: prepHair,
        makeup: prepMakeup,
        wardrobe: prepWardrobe,
        sfx: prepSfx,
        facialHair: prepFacialHair,
      };
    } else {
      // Mobile-native shape: the JSONB IS the full MakeupDetails /
      // HairDetails object. Spread it through. Pull embedded extras
      // (master ref, look-level continuity, sfxDetails) out of the
      // underscore-prefix keys the writer stuffs alongside.
      makeup = { ...(makeupDetailsRaw as any) };
      hair = { ...(hairDetailsRaw as any) };
      const masterRef = (makeupDetailsRaw as any)._masterRef;
      if (masterRef && typeof masterRef === 'object') {
        masterReference = {
          id: masterRef.id || '',
          uri: '',
          thumbnail: masterRef.thumbnail || '',
          capturedAt: masterRef.capturedAt ? new Date(masterRef.capturedAt) : new Date(),
          angle: masterRef.angle || undefined,
        };
      }
      continuityFlags = (makeupDetailsRaw as any)._continuityFlags;
      continuityEvents = (makeupDetailsRaw as any)._continuityEvents;
      sfxDetails = (makeupDetailsRaw as any)._sfxDetails;
    }

    return {
      id: row.id as string,
      characterId: (row.character_id as string) || '',
      name: (row.name as string) || '',
      scenes: lsMap.get(row.id as string) || [],
      estimatedTime: (row.estimated_time as number) || 30,
      masterReference,
      makeup,
      hair,
      sfxDetails,
      continuityFlags,
      continuityEvents,
      notes: (row.description as string) || '',
      prepSummary,
    };
  });
}

