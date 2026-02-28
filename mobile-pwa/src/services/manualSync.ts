/**
 * Manual Sync Service
 *
 * Provides explicit upload (push) and download (pull) functions
 * that the user triggers manually. No auto-sync, no realtime,
 * no debouncing — just direct reads and writes to Supabase.
 *
 * Upload: Local stores → Supabase
 * Download: Supabase → Local stores
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSyncStore } from '@/stores/syncStore';
import { useProjectStore } from '@/stores/projectStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useCallSheetStore } from '@/stores/callSheetStore';
import { useAuthStore } from '@/stores/authStore';
import { setReceivingFromServer } from '@/services/syncChangeTracker';
import * as supabaseStorage from '@/services/supabaseStorage';
import { savePhotoBlob, getPhotoBlob } from '@/db';
import type {
  Scene,
  Character,
  Look,
  SceneCapture,
  Photo,
  CallSheet,
  ProductionSchedule,
  ContinuityFlags,
  ContinuityEvent,
  SFXDetails,
  PhotoAngle,
  MakeupDetails,
  HairDetails,
  ScheduleCastMember,
  ScheduleDay,
} from '@/types';
import type { Database, Json } from '@/types/supabase';

// ============================================================================
// Types
// ============================================================================

type DbScene = Database['public']['Tables']['scenes']['Row'];
type DbCharacter = Database['public']['Tables']['characters']['Row'];
type DbLook = Database['public']['Tables']['looks']['Row'];
type DbContinuityEvent = Database['public']['Tables']['continuity_events']['Row'];
type DbPhoto = Database['public']['Tables']['photos']['Row'];
type DbScheduleData = Database['public']['Tables']['schedule_data']['Row'];
type DbCallSheetData = Database['public']['Tables']['call_sheet_data']['Row'];
type DbScriptUpload = Database['public']['Tables']['script_uploads']['Row'];

// ============================================================================
// Data Mappers: Local → Supabase
// ============================================================================

function sceneToDb(scene: Scene, projectId: string): Omit<DbScene, 'created_at'> {
  return {
    id: scene.id,
    project_id: projectId,
    scene_number: scene.sceneNumber,
    int_ext: scene.intExt || null,
    location: scene.slugline || null,
    time_of_day: scene.timeOfDay || null,
    synopsis: scene.synopsis || null,
    page_count: null,
    story_day: null,
    shooting_day: scene.shootingDay || null,
    filming_status: scene.filmingStatus || null,
    filming_notes: scene.filmingNotes || null,
    is_complete: scene.isComplete,
    completed_at: scene.completedAt ? new Date(scene.completedAt).toISOString() : null,
    script_content: scene.scriptContent || null,
  };
}

function characterToDb(char: Character, projectId: string): Omit<DbCharacter, 'created_at'> {
  return {
    id: char.id,
    project_id: projectId,
    name: char.name,
    actor_name: null,
    initials: char.initials,
    avatar_colour: char.avatarColour || '#6366f1',
    base_look_description: null,
  };
}

function lookToDb(look: Look, projectId: string): Omit<DbLook, 'created_at'> {
  return {
    id: look.id,
    project_id: projectId,
    character_id: look.characterId,
    name: look.name,
    description: look.notes || null,
    estimated_time: look.estimatedTime,
    makeup_details: look.makeup as unknown as Json,
    hair_details: look.hair as unknown as Json,
  };
}

function sceneCaptureToDb(
  capture: SceneCapture,
  userId: string | null
): Omit<DbContinuityEvent, 'created_at'> {
  return {
    id: capture.id,
    scene_id: capture.sceneId,
    character_id: capture.characterId,
    look_id: capture.lookId || null,
    shooting_day: null,
    status: 'in_progress',
    hair_notes: null,
    makeup_notes: null,
    prosthetics_notes: null,
    wounds_blood_notes: null,
    general_notes: capture.notes || null,
    application_time: capture.applicationTime || null,
    continuity_flags: capture.continuityFlags as unknown as Json,
    continuity_events_data: capture.continuityEvents as unknown as Json,
    sfx_details: capture.sfxDetails as unknown as Json,
    checked_by: userId,
    checked_at: null,
  };
}

// ============================================================================
// Data Mappers: Supabase → Local
// ============================================================================

function dbToScene(
  db: DbScene,
  characterIds: string[],
  existingScene?: Scene
): Scene {
  return {
    id: db.id,
    sceneNumber: db.scene_number,
    slugline: db.location || '',
    intExt: (db.int_ext as Scene['intExt']) || 'INT',
    timeOfDay: (db.time_of_day as Scene['timeOfDay']) || 'DAY',
    synopsis: db.synopsis || undefined,
    characters: characterIds,
    isComplete: db.is_complete,
    completedAt: db.completed_at ? new Date(db.completed_at) : undefined,
    filmingStatus: db.filming_status as Scene['filmingStatus'] || undefined,
    filmingNotes: db.filming_notes || undefined,
    shootingDay: db.shooting_day || undefined,
    scriptContent: db.script_content || existingScene?.scriptContent,
    hasScheduleDiscrepancy: existingScene?.hasScheduleDiscrepancy,
    characterConfirmationStatus: existingScene?.characterConfirmationStatus,
    suggestedCharacters: existingScene?.suggestedCharacters,
    amendmentStatus: existingScene?.amendmentStatus,
    previousScriptContent: existingScene?.previousScriptContent,
    amendmentDate: existingScene?.amendmentDate,
    amendmentNotes: existingScene?.amendmentNotes,
  };
}

function dbToCharacter(db: DbCharacter, existingChar?: Character): Character {
  return {
    id: db.id,
    name: db.name,
    initials: db.initials,
    avatarColour: db.avatar_colour,
    actorNumber: existingChar?.actorNumber,
  };
}

function dbToLook(db: DbLook, sceneNumbers: string[], existingLook?: Look): Look {
  return {
    id: db.id,
    characterId: db.character_id,
    name: db.name,
    scenes: sceneNumbers,
    estimatedTime: db.estimated_time,
    makeup: (db.makeup_details as unknown as MakeupDetails) || {
      foundation: '', coverage: '', concealer: '', concealerPlacement: '',
      contour: '', contourPlacement: '', highlight: '', highlightPlacement: '',
      blush: '', blushPlacement: '', browProduct: '', browShape: '',
      eyePrimer: '', lidColour: '', creaseColour: '', outerV: '',
      liner: '', lashes: '', lipLiner: '', lipColour: '', setting: '',
    },
    hair: (db.hair_details as unknown as HairDetails) || {
      style: '', products: '', parting: '', piecesOut: '', pins: '',
      accessories: '', hairType: 'Natural', wigNameId: '', wigType: '',
      wigCapMethod: '', wigAttachment: [], hairline: '', laceTint: '',
      edgesBabyHairs: '',
    },
    notes: db.description || undefined,
    masterReference: existingLook?.masterReference,
    continuityFlags: existingLook?.continuityFlags,
    continuityEvents: existingLook?.continuityEvents,
    sfxDetails: existingLook?.sfxDetails,
  };
}

function dbToSceneCapture(
  db: DbContinuityEvent,
  photos: { front?: Photo; left?: Photo; right?: Photo; back?: Photo },
  additionalPhotos: Photo[]
): SceneCapture {
  return {
    id: db.id,
    sceneId: db.scene_id,
    characterId: db.character_id,
    lookId: db.look_id || '',
    capturedAt: new Date(db.created_at),
    photos,
    additionalPhotos,
    continuityFlags: (db.continuity_flags as unknown as ContinuityFlags) || {
      sweat: false, dishevelled: false, blood: false,
      dirt: false, wetHair: false, tears: false,
    },
    continuityEvents: (db.continuity_events_data as unknown as ContinuityEvent[]) || [],
    sfxDetails: (db.sfx_details as unknown as SFXDetails) || {
      sfxRequired: false, sfxTypes: [], prostheticPieces: '',
      prostheticAdhesive: '', bloodTypes: [], bloodProducts: '',
      bloodPlacement: '', tattooCoverage: '', temporaryTattoos: '',
      contactLenses: '', teeth: '', agingCharacterNotes: '',
      sfxApplicationTime: null, sfxReferencePhotos: [],
    },
    notes: db.general_notes || '',
    applicationTime: db.application_time || undefined,
  };
}

// ============================================================================
// Upload: Push all local data to Supabase
// ============================================================================

export async function uploadToServer(): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { error: new Error('Supabase not configured') };
  }

  const syncStore = useSyncStore.getState();

  // Check auth
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      syncStore.setError('Not signed in');
      return { error: new Error('Not signed in') };
    }
  } catch {
    syncStore.setError('Auth check failed');
    return { error: new Error('Auth check failed') };
  }

  const project = useProjectStore.getState().currentProject;
  if (!project) {
    return { error: new Error('No project loaded') };
  }

  const projectId = project.id;
  const userId = useAuthStore.getState().user?.id || null;

  syncStore.setUploading();

  try {
    const steps = 7;
    let step = 0;

    // 1. Upload scenes + scene_characters
    if (project.scenes.length > 0) {
      // Clear all server scenes for this project, then upsert local ones.
      // This avoids unique constraint conflicts when local scenes have new UUIDs
      // but the same scene_number as stale server rows.
      await supabase
        .from('scenes')
        .delete()
        .eq('project_id', projectId);

      const dbScenes = project.scenes.map(s => sceneToDb(s, projectId));
      const { error } = await supabase
        .from('scenes')
        .upsert(dbScenes, { onConflict: 'id' });
      if (error) throw new Error(`Scenes upload failed: ${error.message}`);

      // Sync scene_characters junction
      const sceneIds = project.scenes.map(s => s.id);
      const sceneCharEntries: { scene_id: string; character_id: string }[] = [];
      for (const scene of project.scenes) {
        for (const charId of scene.characters) {
          sceneCharEntries.push({ scene_id: scene.id, character_id: charId });
        }
      }
      if (sceneIds.length > 0) {
        const { error: scError } = await supabase.rpc('sync_scene_characters', {
          p_scene_ids: sceneIds,
          p_entries: sceneCharEntries,
        });
        if (scError) console.warn('[Upload] scene_characters sync failed:', scError);
      }
    }
    step++;
    syncStore.setProgress(Math.round((step / steps) * 100));

    // 2. Upload characters
    if (project.characters.length > 0) {
      await supabase
        .from('characters')
        .delete()
        .eq('project_id', projectId);

      const dbChars = project.characters.map(c => characterToDb(c, projectId));
      const { error } = await supabase
        .from('characters')
        .upsert(dbChars, { onConflict: 'id' });
      if (error) throw new Error(`Characters upload failed: ${error.message}`);
    }
    step++;
    syncStore.setProgress(Math.round((step / steps) * 100));

    // 3. Upload looks + look_scenes
    if (project.looks.length > 0) {
      await supabase
        .from('looks')
        .delete()
        .eq('project_id', projectId);

      const dbLooks = project.looks.map(l => lookToDb(l, projectId));
      const { error: lookError } = await supabase
        .from('looks')
        .upsert(dbLooks, { onConflict: 'id' });
      if (lookError) throw new Error(`Looks upload failed: ${lookError.message}`);

      // Sync look_scenes junction
      const lookIds = project.looks.map(l => l.id);
      const lookSceneEntries: { look_id: string; scene_number: string }[] = [];
      for (const look of project.looks) {
        for (const sceneNum of look.scenes) {
          lookSceneEntries.push({ look_id: look.id, scene_number: sceneNum });
        }
      }
      if (lookIds.length > 0) {
        const { error: lsError } = await supabase.rpc('sync_look_scenes', {
          p_look_ids: lookIds,
          p_entries: lookSceneEntries,
        });
        if (lsError) console.warn('[Upload] look_scenes sync failed:', lsError);
      }
    }
    step++;
    syncStore.setProgress(Math.round((step / steps) * 100));

    // 4. Upload schedule
    const schedule = useScheduleStore.getState().schedule;
    if (schedule) {
      const { error: scheduleError } = await supabase
        .from('schedule_data')
        .upsert({
          id: schedule.id,
          project_id: projectId,
          raw_pdf_text: schedule.rawText || null,
          cast_list: schedule.castList as unknown as Json,
          days: schedule.days as unknown as Json,
          status: schedule.status === 'complete' ? 'complete' : 'pending',
        }, { onConflict: 'id' });
      if (scheduleError) throw new Error(`Schedule upload failed: ${scheduleError.message}`);

      // Upload schedule PDF
      if (schedule.pdfUri && schedule.pdfUri.startsWith('data:')) {
        const { path, error: uploadError } = await supabaseStorage.uploadBase64Document(
          projectId, 'schedules', schedule.pdfUri
        );
        if (!uploadError && path) {
          await supabase.from('schedule_data').update({ storage_path: path }).eq('id', schedule.id);
        }
      }
    }
    step++;
    syncStore.setProgress(Math.round((step / steps) * 100));

    // 5. Upload call sheets
    const callSheets = useCallSheetStore.getState().callSheets;
    if (callSheets.length > 0) {
      for (const cs of callSheets) {
        const { pdfUri, ...parsedData } = cs;
        const { error: csError } = await supabase
          .from('call_sheet_data')
          .upsert({
            id: cs.id,
            project_id: projectId,
            shoot_date: cs.date,
            production_day: cs.productionDay,
            raw_text: cs.rawText || null,
            parsed_data: parsedData as unknown as Json,
            uploaded_by: userId,
          }, { onConflict: 'id' });
        if (csError) console.warn('[Upload] Call sheet upload failed:', csError);

        // Upload PDF
        if (pdfUri && pdfUri.startsWith('data:')) {
          const { path, error: uploadError } = await supabaseStorage.uploadBase64Document(
            projectId, 'call-sheets', pdfUri
          );
          if (!uploadError && path) {
            await supabase.from('call_sheet_data').update({ storage_path: path }).eq('id', cs.id);
          }
        }
      }
    }
    step++;
    syncStore.setProgress(Math.round((step / steps) * 100));

    // 6. Upload script PDF
    if (project.scriptPdfData && project.scriptPdfData.startsWith('data:')) {
      // Deactivate previous uploads
      await supabase
        .from('script_uploads')
        .update({ is_active: false })
        .eq('project_id', projectId)
        .eq('is_active', true);

      const { path, error: uploadError } = await supabaseStorage.uploadBase64Document(
        projectId, 'scripts', project.scriptPdfData
      );
      if (!uploadError && path) {
        const base64Length = project.scriptPdfData.split(',')[1]?.length || 0;
        const fileSize = Math.round(base64Length * 0.75);
        await supabase.from('script_uploads').insert({
          project_id: projectId,
          storage_path: path,
          file_name: 'script.pdf',
          file_size: fileSize,
          is_active: true,
          status: 'uploaded',
          uploaded_by: userId,
          scene_count: project.scenes.length,
        });
      }
    }
    step++;
    syncStore.setProgress(Math.round((step / steps) * 100));

    // 7. Upload scene captures (continuity events + photos)
    const captures = useProjectStore.getState().sceneCaptures;
    for (const capture of Object.values(captures)) {
      const sc = capture as SceneCapture;
      const dbCapture = sceneCaptureToDb(sc, userId);
      const { error: ceError } = await supabase
        .from('continuity_events')
        .upsert(dbCapture, { onConflict: 'id' });
      if (ceError) {
        console.warn('[Upload] Continuity event upload failed:', ceError);
        continue;
      }
      // Upload photos
      await uploadCapturePhotos(projectId, sc);
    }
    step++;
    syncStore.setProgress(100);

    // Done
    syncStore.setUploaded();
    syncStore.clearChanges();
    return { error: null };
  } catch (error) {
    console.error('[ManualSync] Upload failed:', error);
    syncStore.setError(error instanceof Error ? error.message : 'Upload failed');
    return { error: error as Error };
  }
}

async function uploadCapturePhotos(projectId: string, capture: SceneCapture): Promise<void> {
  const allPhotos: { photo: Photo; angle: string }[] = [];

  for (const [angle, photo] of Object.entries(capture.photos)) {
    if (photo) allPhotos.push({ photo, angle });
  }
  for (const photo of capture.additionalPhotos) {
    allPhotos.push({ photo, angle: 'additional' });
  }

  for (const { photo, angle } of allPhotos) {
    // Check if already uploaded
    const { data: existing } = await supabase
      .from('photos')
      .select('id')
      .eq('id', photo.id)
      .single();
    if (existing) continue;

    let storagePath: string | null = null;

    const localBlob = await getPhotoBlob(photo.id);
    if (localBlob) {
      const { result, error } = await supabaseStorage.uploadPhoto(
        projectId, capture.characterId, localBlob.blob
      );
      if (!error && result) storagePath = result.path;
    } else if (photo.uri && photo.uri.startsWith('data:')) {
      const { result, error } = await supabaseStorage.uploadBase64Photo(
        projectId, capture.characterId, photo.uri
      );
      if (!error && result) storagePath = result.path;
    }

    if (storagePath) {
      await supabase.from('photos').insert({
        id: photo.id,
        continuity_event_id: capture.id,
        storage_path: storagePath,
        photo_type: 'on_set',
        angle: angle as DbPhoto['angle'],
        taken_at: photo.capturedAt ? new Date(photo.capturedAt).toISOString() : new Date().toISOString(),
      });
    }
  }
}

// ============================================================================
// Download: Pull all data from Supabase → local stores
// ============================================================================

export async function downloadFromServer(): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { error: new Error('Supabase not configured') };
  }

  const syncStore = useSyncStore.getState();

  // Check auth
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      syncStore.setError('Not signed in');
      return { error: new Error('Not signed in') };
    }
  } catch {
    syncStore.setError('Auth check failed');
    return { error: new Error('Auth check failed') };
  }

  const project = useProjectStore.getState().currentProject;
  if (!project) {
    return { error: new Error('No project loaded') };
  }

  const projectId = project.id;
  syncStore.setDownloading();

  try {
    const steps = 5;
    let step = 0;

    // Phase 1: Fetch all project-level tables
    const [scenesRes, charsRes, looksRes, scheduleRes, callSheetsRes, scriptRes] = await Promise.all([
      supabase.from('scenes').select('*').eq('project_id', projectId).order('scene_number'),
      supabase.from('characters').select('*').eq('project_id', projectId).order('name'),
      supabase.from('looks').select('*').eq('project_id', projectId),
      supabase.from('schedule_data').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1),
      supabase.from('call_sheet_data').select('*').eq('project_id', projectId).order('production_day'),
      supabase.from('script_uploads').select('*').eq('project_id', projectId).eq('is_active', true).limit(1),
    ]);

    if (scenesRes.error) throw scenesRes.error;
    if (charsRes.error) throw charsRes.error;
    if (looksRes.error) throw looksRes.error;

    const dbScenes: DbScene[] = scenesRes.data || [];
    const dbChars: DbCharacter[] = charsRes.data || [];
    const dbLooks: DbLook[] = looksRes.data || [];
    const dbSchedule: DbScheduleData[] = scheduleRes.data || [];
    const dbCallSheets: DbCallSheetData[] = callSheetsRes.data || [];
    const dbScript: DbScriptUpload[] = scriptRes.data || [];

    step++;
    syncStore.setProgress(Math.round((step / steps) * 100));

    // Phase 2: Fetch junction/child tables
    const sceneIds = dbScenes.map(s => s.id);
    const lookIds = dbLooks.map(l => l.id);

    const [sceneCharsRes, lookScenesRes, capturesRes] = await Promise.all([
      sceneIds.length > 0
        ? supabase.from('scene_characters').select('scene_id, character_id').in('scene_id', sceneIds)
        : Promise.resolve({ data: [], error: null }),
      lookIds.length > 0
        ? supabase.from('look_scenes').select('look_id, scene_number').in('look_id', lookIds)
        : Promise.resolve({ data: [], error: null }),
      sceneIds.length > 0
        ? supabase.from('continuity_events').select('*').in('scene_id', sceneIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const sceneChars = sceneCharsRes.data || [];
    const lookScenes = lookScenesRes.data || [];
    const dbCaptures: DbContinuityEvent[] = capturesRes.data || [];

    // Phase 3: Fetch photos
    const captureIds = dbCaptures.map(c => c.id);
    const photosRes = captureIds.length > 0
      ? await supabase.from('photos').select('*').in('continuity_event_id', captureIds)
      : { data: [], error: null };
    const dbPhotos: DbPhoto[] = photosRes.data || [];

    step++;
    syncStore.setProgress(Math.round((step / steps) * 100));

    // Build lookup maps
    const sceneCharMap = new Map<string, string[]>();
    for (const sc of sceneChars) {
      const existing = sceneCharMap.get(sc.scene_id) || [];
      existing.push(sc.character_id);
      sceneCharMap.set(sc.scene_id, existing);
    }

    const lookSceneMap = new Map<string, string[]>();
    for (const ls of lookScenes) {
      const existing = lookSceneMap.get(ls.look_id) || [];
      existing.push(ls.scene_number);
      lookSceneMap.set(ls.look_id, existing);
    }

    const photosByCaptureId = new Map<string, DbPhoto[]>();
    for (const photo of dbPhotos) {
      const existing = photosByCaptureId.get(photo.continuity_event_id) || [];
      existing.push(photo);
      photosByCaptureId.set(photo.continuity_event_id, existing);
    }

    // Map DB data to local types
    const projectStore = useProjectStore.getState();
    const currentProject = projectStore.currentProject;
    const existingScenes = currentProject
      ? new Map(currentProject.scenes.map((s: Scene) => [s.id, s]))
      : new Map<string, Scene>();
    const existingChars = currentProject
      ? new Map(currentProject.characters.map((c: Character) => [c.id, c]))
      : new Map<string, Character>();
    const existingLooks = currentProject
      ? new Map(currentProject.looks.map((l: Look) => [l.id, l]))
      : new Map<string, Look>();

    const mergedScenes = dbScenes.map(dbScene =>
      dbToScene(dbScene, sceneCharMap.get(dbScene.id) || [], existingScenes.get(dbScene.id))
    );
    const mergedChars = dbChars.map(dbChar =>
      dbToCharacter(dbChar, existingChars.get(dbChar.id))
    );
    const mergedLooks = dbLooks.map(dbLook =>
      dbToLook(dbLook, lookSceneMap.get(dbLook.id) || [], existingLooks.get(dbLook.id))
    );

    step++;
    syncStore.setProgress(Math.round((step / steps) * 100));

    // Build scene captures
    const mergedCaptures: Record<string, SceneCapture> = {};
    for (const dbCapture of dbCaptures) {
      const capturePhotos = photosByCaptureId.get(dbCapture.id) || [];
      const mainPhotos: { front?: Photo; left?: Photo; right?: Photo; back?: Photo } = {};
      const additionalPhotos: Photo[] = [];

      for (const dbPhoto of capturePhotos) {
        const photo = await downloadAndCachePhoto(dbPhoto);
        if (!photo) continue;
        if (dbPhoto.angle !== 'additional' && dbPhoto.angle !== 'detail') {
          mainPhotos[dbPhoto.angle as keyof typeof mainPhotos] = photo;
        } else {
          additionalPhotos.push(photo);
        }
      }

      const capture = dbToSceneCapture(dbCapture, mainPhotos, additionalPhotos);
      const captureKey = `${dbCapture.scene_id}-${dbCapture.character_id}`;
      mergedCaptures[captureKey] = capture;
    }

    // Apply to stores — server data wins (this is a download/refresh)
    // Set flag so change tracker doesn't mark these as pending local changes
    setReceivingFromServer(true);
    try {
      if (dbScenes.length > 0 || dbChars.length > 0 || dbLooks.length > 0) {
        projectStore.mergeServerData({
          scenes: mergedScenes,
          characters: mergedChars,
          looks: mergedLooks,
        });
      }

      // Apply captures
      for (const [captureKey, capture] of Object.entries(mergedCaptures)) {
        projectStore.updateSceneCapture(captureKey, capture);
      }

      step++;
      syncStore.setProgress(Math.round((step / steps) * 100));

      // Merge schedule
      if (dbSchedule.length > 0) {
        mergeScheduleFromServer(dbSchedule[0], projectId);
      }

      // Merge call sheets
      if (dbCallSheets.length > 0) {
        mergeCallSheetsFromServer(dbCallSheets, projectId);
      }

      // Merge script
      if (dbScript.length > 0) {
        await mergeScriptFromServer(dbScript[0]);
      }
    } finally {
      setReceivingFromServer(false);
    }

    step++;
    syncStore.setProgress(100);

    syncStore.setDownloaded();
    // Clear pending changes — local data now matches server
    syncStore.clearChanges();
    return { error: null };
  } catch (error) {
    console.error('[ManualSync] Download failed:', error);
    syncStore.setError(error instanceof Error ? error.message : 'Download failed');
    return { error: error as Error };
  }
}

// ============================================================================
// Check for updates: Compare local vs server timestamps
// ============================================================================

export async function checkForUpdates(): Promise<{
  hasUpdates: boolean;
  error: Error | null;
}> {
  if (!isSupabaseConfigured) return { hasUpdates: false, error: null };

  const project = useProjectStore.getState().currentProject;
  if (!project) return { hasUpdates: false, error: null };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { hasUpdates: false, error: null };

    // Quick check: count scenes on server vs local
    const { count: serverSceneCount } = await supabase
      .from('scenes')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project.id);

    const localSceneCount = project.scenes.length;

    // If counts differ, there are updates
    if (serverSceneCount !== null && serverSceneCount !== localSceneCount) {
      return { hasUpdates: true, error: null };
    }

    // Check for characters
    const { count: serverCharCount } = await supabase
      .from('characters')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project.id);

    if (serverCharCount !== null && serverCharCount !== project.characters.length) {
      return { hasUpdates: true, error: null };
    }

    return { hasUpdates: false, error: null };
  } catch (error) {
    return { hasUpdates: false, error: error as Error };
  }
}

// ============================================================================
// Helpers
// ============================================================================

async function downloadAndCachePhoto(dbPhoto: DbPhoto): Promise<Photo | null> {
  try {
    const cached = await getPhotoBlob(dbPhoto.id);
    if (cached) {
      return {
        id: dbPhoto.id,
        uri: '',
        thumbnail: cached.thumbnail,
        capturedAt: cached.capturedAt,
        angle: dbPhoto.angle as PhotoAngle,
      };
    }

    const { blob, error } = await supabaseStorage.downloadPhoto(dbPhoto.storage_path);
    if (error || !blob) return null;

    const thumbnail = await createThumbnail(blob);
    await savePhotoBlob(dbPhoto.id, blob, thumbnail, dbPhoto.angle as PhotoAngle);

    return {
      id: dbPhoto.id,
      uri: URL.createObjectURL(blob),
      thumbnail,
      capturedAt: new Date(dbPhoto.taken_at),
      angle: dbPhoto.angle as PhotoAngle,
    };
  } catch (error) {
    console.error('[ManualSync] Photo download failed:', error);
    return null;
  }
}

async function createThumbnail(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 80;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const scale = Math.max(size / img.width, size / img.height);
      const x = (size - img.width * scale) / 2;
      const y = (size - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('');
    };
    img.src = url;
  });
}

function mergeScheduleFromServer(dbSchedule: DbScheduleData, _projectId: string): void {
  const scheduleStore = useScheduleStore.getState();
  const currentSchedule = scheduleStore.schedule;

  if (!dbSchedule.days && !dbSchedule.cast_list) return;

  const schedule: ProductionSchedule = {
    id: dbSchedule.id,
    status: dbSchedule.status === 'complete' ? 'complete' : 'pending',
    castList: (dbSchedule.cast_list as unknown as ScheduleCastMember[]) || [],
    days: (dbSchedule.days as unknown as ScheduleDay[]) || [],
    totalDays: ((dbSchedule.days as unknown as ScheduleDay[]) || []).length,
    uploadedAt: new Date(dbSchedule.created_at),
    rawText: dbSchedule.raw_pdf_text || undefined,
    // Preserve local pdfUri if same schedule
    pdfUri: currentSchedule?.id === dbSchedule.id ? currentSchedule.pdfUri : undefined,
  };

  scheduleStore.setSchedule(schedule);

  // Download PDF from storage if missing locally
  if (!schedule.pdfUri && dbSchedule.storage_path) {
    supabaseStorage.downloadDocumentAsDataUri(dbSchedule.storage_path).then(({ dataUri }) => {
      if (!dataUri) return;
      const current = useScheduleStore.getState().schedule;
      if (current && current.id === dbSchedule.id) {
        useScheduleStore.getState().setSchedule({ ...current, pdfUri: dataUri });
      }
    });
  }
}

function mergeCallSheetsFromServer(dbCallSheets: DbCallSheetData[], _projectId: string): void {
  const callSheetStore = useCallSheetStore.getState();

  const callSheets: CallSheet[] = dbCallSheets.map((db) => {
    const parsed = (db.parsed_data || {}) as Record<string, unknown>;
    return {
      ...parsed,
      id: db.id,
      date: db.shoot_date,
      productionDay: db.production_day,
      rawText: db.raw_text || (parsed.rawText as string | undefined),
      pdfUri: undefined,
      uploadedAt: new Date(db.created_at),
      scenes: (parsed.scenes as CallSheet['scenes']) || [],
    } as CallSheet;
  });

  if (callSheets.length === 0) return;

  callSheetStore.clearAll();
  for (const cs of callSheets) {
    useCallSheetStore.setState((state) => ({
      callSheets: [...state.callSheets, cs].sort(
        (a, b) => a.productionDay - b.productionDay
      ),
    }));
  }

  const latest = callSheets[callSheets.length - 1];
  if (latest) {
    callSheetStore.setActiveCallSheet(latest.id);
  }

  // Download PDFs from storage in background
  for (const db of dbCallSheets) {
    if (db.storage_path) {
      supabaseStorage.downloadDocumentAsDataUri(db.storage_path).then(({ dataUri }) => {
        if (!dataUri) return;
        useCallSheetStore.setState((state) => ({
          callSheets: state.callSheets.map((cs) =>
            cs.id === db.id ? { ...cs, pdfUri: dataUri } : cs
          ),
        }));
      });
    }
  }
}

async function mergeScriptFromServer(dbScript: DbScriptUpload): Promise<void> {
  const projectStore = useProjectStore.getState();
  if (!projectStore.currentProject) return;
  if (!dbScript.storage_path) return;

  try {
    const { dataUri, error } = await supabaseStorage.downloadDocumentAsDataUri(dbScript.storage_path);
    if (error || !dataUri) return;
    projectStore.setScriptPdf(dataUri);
  } catch (err) {
    console.error('[ManualSync] Script download failed:', err);
  }
}
