/**
 * Sync Service - Real-time collaboration engine
 *
 * Handles:
 * 1. Initial pull on project load (fetch from Supabase → merge into local stores)
 * 2. Debounced push on local changes (local stores → Supabase)
 * 3. Real-time subscriptions (Supabase Realtime → local stores)
 * 4. Photo sync (local blobs ↔ Supabase Storage)
 * 5. Presence tracking (who's online)
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSyncStore } from '@/stores/syncStore';
import { useProjectStore } from '@/stores/projectStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import * as supabaseStorage from '@/services/supabaseStorage';
import { savePhotoBlob, getPhotoBlob } from '@/db';
import { v4 as uuidv4 } from 'uuid';
import type {
  Scene,
  Character,
  Look,
  SceneCapture,
  Photo,
  ProductionSchedule,
  ContinuityFlags,
  ContinuityEvent,
  SFXDetails,
  PhotoAngle,
} from '@/types';
import type { Database } from '@/types/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

type DbScene = Database['public']['Tables']['scenes']['Row'];
type DbCharacter = Database['public']['Tables']['characters']['Row'];
type DbLook = Database['public']['Tables']['looks']['Row'];
type DbContinuityEvent = Database['public']['Tables']['continuity_events']['Row'];
type DbPhoto = Database['public']['Tables']['photos']['Row'];
type DbScheduleData = Database['public']['Tables']['schedule_data']['Row'];

/** Client ID to filter out own real-time echoes */
const CLIENT_ID = uuidv4();

/** Debounce delay for push operations (ms) */
const PUSH_DEBOUNCE_MS = 800;

// ============================================================================
// State
// ============================================================================

let activeChannel: RealtimeChannel | null = null;
let activeProjectId: string | null = null;
let pushTimers: Record<string, ReturnType<typeof setTimeout>> = {};
/** Track tables currently being pushed to avoid echo loops */
let pushingTables = new Set<string>();

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
    story_day: scene.shootingDay ? null : null, // story_day not tracked locally
    shooting_day: scene.shootingDay || null,
    filming_status: scene.filmingStatus || null,
    filming_notes: scene.filmingNotes || null,
    is_complete: scene.isComplete,
    completed_at: scene.completedAt ? new Date(scene.completedAt).toISOString() : null,
  };
}

function characterToDb(char: Character, projectId: string): Omit<DbCharacter, 'created_at'> {
  return {
    id: char.id,
    project_id: projectId,
    name: char.name,
    actor_name: null, // actorName is in CastProfile, not Character
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
    makeup_details: look.makeup as any,
    hair_details: look.hair as any,
  };
}

function sceneCaptureToDb(
  capture: SceneCapture,
  _projectId: string,
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
    continuity_flags: capture.continuityFlags as any,
    continuity_events_data: capture.continuityEvents as any,
    sfx_details: capture.sfxDetails as any,
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
    // Preserve local-only fields
    scriptContent: existingScene?.scriptContent,
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
    // Preserve local-only fields
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
    makeup: db.makeup_details as any || {
      foundation: '', coverage: '', concealer: '', concealerPlacement: '',
      contour: '', contourPlacement: '', highlight: '', highlightPlacement: '',
      blush: '', blushPlacement: '', browProduct: '', browShape: '',
      eyePrimer: '', lidColour: '', creaseColour: '', outerV: '',
      liner: '', lashes: '', lipLiner: '', lipColour: '', setting: '',
    },
    hair: db.hair_details as any || {
      style: '', products: '', parting: '', piecesOut: '', pins: '',
      accessories: '', hairType: 'Natural', wigNameId: '', wigType: '',
      wigCapMethod: '', wigAttachment: [], hairline: '', laceTint: '',
      edgesBabyHairs: '',
    },
    notes: db.description || undefined,
    // Preserve local-only fields
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
// Pull: Fetch from Supabase → merge into local stores
// ============================================================================

export async function pullProjectData(projectId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const syncStore = useSyncStore.getState();
  syncStore.setSyncing();

  try {
    // Phase 1: Fetch tables that have project_id
    const [scenesRes, charsRes, looksRes, scheduleRes] = await Promise.all([
      supabase.from('scenes').select('*').eq('project_id', projectId).order('scene_number'),
      supabase.from('characters').select('*').eq('project_id', projectId).order('name'),
      supabase.from('looks').select('*').eq('project_id', projectId),
      supabase.from('schedule_data').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1),
    ]);

    if (scenesRes.error) throw scenesRes.error;
    if (charsRes.error) throw charsRes.error;
    if (looksRes.error) throw looksRes.error;

    const dbScenes: DbScene[] = scenesRes.data || [];
    const dbChars: DbCharacter[] = charsRes.data || [];
    const dbLooks: DbLook[] = looksRes.data || [];
    const dbSchedule: DbScheduleData[] = scheduleRes.data || [];

    // Phase 2: Fetch junction/child tables using IDs from phase 1
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

    // Phase 3: Fetch photos for continuity events
    const captureIds = dbCaptures.map(c => c.id);
    const photosRes = captureIds.length > 0
      ? await supabase.from('photos').select('*').in('continuity_event_id', captureIds)
      : { data: [], error: null };
    const dbPhotos: DbPhoto[] = photosRes.data || [];

    // Skip merge if server has no data (fresh project)
    if (dbScenes.length === 0 && dbChars.length === 0 && dbLooks.length === 0) {
      syncStore.setSynced();
      return true;
    }

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

    // Get current local state for merge
    const projectStore = useProjectStore.getState();
    const currentProject = projectStore.currentProject;
    if (!currentProject) {
      syncStore.setSynced();
      return true;
    }

    const existingScenes = new Map<string, Scene>(currentProject.scenes.map((s: Scene) => [s.id, s]));
    const existingChars = new Map<string, Character>(currentProject.characters.map((c: Character) => [c.id, c]));
    const existingLooks = new Map<string, Look>(currentProject.looks.map((l: Look) => [l.id, l]));

    // Map DB data to local types (server wins, but preserve local-only fields)
    const mergedScenes: Scene[] = dbScenes.map((dbScene: DbScene) =>
      dbToScene(dbScene, sceneCharMap.get(dbScene.id) || [], existingScenes.get(dbScene.id))
    );

    const mergedChars: Character[] = dbChars.map((dbChar: DbCharacter) =>
      dbToCharacter(dbChar, existingChars.get(dbChar.id))
    );

    const mergedLooks: Look[] = dbLooks.map((dbLook: DbLook) =>
      dbToLook(dbLook, lookSceneMap.get(dbLook.id) || [], existingLooks.get(dbLook.id))
    );

    // Build scene captures from continuity events + photos
    const mergedCaptures: Record<string, SceneCapture> = {};
    for (const dbCapture of dbCaptures) {
      const capturePhotos = photosByCaptureId.get(dbCapture.id) || [];

      // Download photo data from storage and build Photo objects
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

      mergedCaptures[dbCapture.id] = dbToSceneCapture(dbCapture, mainPhotos, additionalPhotos);
    }

    // Update the project store with merged data
    const updatedProject = {
      ...currentProject,
      scenes: mergedScenes,
      characters: mergedChars,
      looks: mergedLooks,
    };

    projectStore.setProject(updatedProject);

    // Merge scene captures
    if (Object.keys(mergedCaptures).length > 0) {
      for (const [captureId, capture] of Object.entries(mergedCaptures)) {
        projectStore.updateSceneCapture(captureId, capture);
      }
    }

    // Merge schedule data if available
    if (dbSchedule.length > 0) {
      const schedule = dbSchedule[0];
      mergeScheduleData(schedule, projectId);
    }

    syncStore.setSynced();
    return true;
  } catch (error) {
    console.error('[SyncService] Pull failed:', error);
    syncStore.setError(error instanceof Error ? error.message : 'Pull failed');
    return false;
  }
}

async function downloadAndCachePhoto(dbPhoto: DbPhoto): Promise<Photo | null> {
  try {
    // Check if we already have it cached locally
    const cached = await getPhotoBlob(dbPhoto.id);
    if (cached) {
      return {
        id: dbPhoto.id,
        uri: '', // Will be loaded from blob when needed
        thumbnail: cached.thumbnail,
        capturedAt: cached.capturedAt,
        angle: dbPhoto.angle as PhotoAngle,
      };
    }

    // Download from Supabase Storage
    const { blob, error } = await supabaseStorage.downloadPhoto(dbPhoto.storage_path);
    if (error || !blob) return null;

    // Create thumbnail
    const thumbnail = await createThumbnail(blob);

    // Cache locally
    await savePhotoBlob(dbPhoto.id, blob, thumbnail, dbPhoto.angle as PhotoAngle);

    return {
      id: dbPhoto.id,
      uri: URL.createObjectURL(blob),
      thumbnail,
      capturedAt: new Date(dbPhoto.taken_at),
      angle: dbPhoto.angle as PhotoAngle,
    };
  } catch (error) {
    console.error('[SyncService] Photo download failed:', error);
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

function mergeScheduleData(dbSchedule: DbScheduleData, _projectId: string): void {
  const scheduleStore = useScheduleStore.getState();
  const currentSchedule = scheduleStore.schedule;

  // Only merge if we have server data and local doesn't exist or is older
  if (!dbSchedule.days && !dbSchedule.cast_list) return;
  if (currentSchedule && currentSchedule.days.length > 0) {
    // Local has data - keep local (user may have unsaved local changes)
    return;
  }

  // Build a ProductionSchedule from DB data
  const schedule: ProductionSchedule = {
    id: dbSchedule.id,
    status: dbSchedule.status === 'complete' ? 'complete' : 'pending',
    castList: (dbSchedule.cast_list as any[]) || [],
    days: (dbSchedule.days as any[]) || [],
    totalDays: ((dbSchedule.days as any[]) || []).length,
    uploadedAt: new Date(dbSchedule.created_at),
    rawText: dbSchedule.raw_pdf_text || undefined,
  };

  // Use the store's restoration mechanism
  scheduleStore.saveScheduleForProject(schedule.id, schedule);
}

// ============================================================================
// Push: Local stores → Supabase
// ============================================================================

function debouncedPush(table: string, pushFn: () => Promise<void>): void {
  if (pushTimers[table]) {
    clearTimeout(pushTimers[table]);
  }

  useSyncStore.getState().incrementPending();

  pushTimers[table] = setTimeout(async () => {
    pushingTables.add(table);
    try {
      useSyncStore.getState().setSyncing();
      await pushFn();
      useSyncStore.getState().decrementPending();
      if (useSyncStore.getState().pendingChanges === 0) {
        useSyncStore.getState().setSynced();
      }
    } catch (error) {
      console.error(`[SyncService] Push ${table} failed:`, error);
      useSyncStore.getState().setError(`Failed to sync ${table}`);
    } finally {
      pushingTables.delete(table);
    }
  }, PUSH_DEBOUNCE_MS);
}

export async function pushScenes(projectId: string, scenes: Scene[]): Promise<void> {
  if (!isSupabaseConfigured) return;

  debouncedPush('scenes', async () => {
    // Upsert scenes
    const dbScenes = scenes.map(s => sceneToDb(s, projectId));
    const { error } = await supabase
      .from('scenes')
      .upsert(dbScenes, { onConflict: 'id' });
    if (error) throw error;

    // Sync scene_characters junction
    // Get all scene IDs
    const sceneIds = scenes.map(s => s.id);

    // Delete existing scene_characters for these scenes
    if (sceneIds.length > 0) {
      await supabase.from('scene_characters').delete().in('scene_id', sceneIds);
    }

    // Build new scene_characters entries
    const sceneCharEntries: { scene_id: string; character_id: string }[] = [];
    for (const scene of scenes) {
      for (const charId of scene.characters) {
        sceneCharEntries.push({
          scene_id: scene.id,
          character_id: charId,
        });
      }
    }

    if (sceneCharEntries.length > 0) {
      const { error: scError } = await supabase
        .from('scene_characters')
        .insert(sceneCharEntries);
      if (scError) throw scError;
    }
  });
}

export async function pushCharacters(projectId: string, characters: Character[]): Promise<void> {
  if (!isSupabaseConfigured) return;

  debouncedPush('characters', async () => {
    const dbChars = characters.map(c => characterToDb(c, projectId));
    const { error } = await supabase
      .from('characters')
      .upsert(dbChars, { onConflict: 'id' });
    if (error) throw error;
  });
}

export async function pushLooks(projectId: string, looks: Look[]): Promise<void> {
  if (!isSupabaseConfigured) return;

  debouncedPush('looks', async () => {
    const dbLooks = looks.map(l => lookToDb(l, projectId));
    const { error: lookError } = await supabase
      .from('looks')
      .upsert(dbLooks, { onConflict: 'id' });
    if (lookError) throw lookError;

    // Sync look_scenes junction
    const lookIds = looks.map(l => l.id);
    if (lookIds.length > 0) {
      await supabase.from('look_scenes').delete().in('look_id', lookIds);
    }

    const lookSceneEntries: { look_id: string; scene_number: string }[] = [];
    for (const look of looks) {
      for (const sceneNum of look.scenes) {
        lookSceneEntries.push({
          look_id: look.id,
          scene_number: sceneNum,
        });
      }
    }

    if (lookSceneEntries.length > 0) {
      const { error: lsError } = await supabase
        .from('look_scenes')
        .insert(lookSceneEntries);
      if (lsError) throw lsError;
    }
  });
}

export async function pushSceneCapture(
  projectId: string,
  capture: SceneCapture,
  userId: string | null
): Promise<void> {
  if (!isSupabaseConfigured) return;

  debouncedPush(`capture_${capture.id}`, async () => {
    const dbCapture = sceneCaptureToDb(capture, projectId, userId);
    const { error } = await supabase
      .from('continuity_events')
      .upsert(dbCapture, { onConflict: 'id' });
    if (error) throw error;

    // Upload photos that haven't been uploaded yet
    await syncCapturePhotos(projectId, capture);
  });
}

async function syncCapturePhotos(projectId: string, capture: SceneCapture): Promise<void> {
  const allPhotos: { photo: Photo; angle: string }[] = [];

  // Main angle photos
  for (const [angle, photo] of Object.entries(capture.photos)) {
    if (photo) {
      allPhotos.push({ photo, angle });
    }
  }

  // Additional photos
  for (const photo of capture.additionalPhotos) {
    allPhotos.push({ photo, angle: 'additional' });
  }

  for (const { photo, angle } of allPhotos) {
    // Check if photo already exists in DB
    const { data: existing } = await supabase
      .from('photos')
      .select('id')
      .eq('id', photo.id)
      .single();

    if (existing) continue;

    // Upload to storage
    let storagePath: string | null = null;

    // Try to get blob from local IndexedDB
    const localBlob = await getPhotoBlob(photo.id);
    if (localBlob) {
      const { result, error } = await supabaseStorage.uploadPhoto(
        projectId,
        capture.characterId,
        localBlob.blob
      );
      if (!error && result) {
        storagePath = result.path;
      }
    } else if (photo.uri && photo.uri.startsWith('data:')) {
      // Upload from base64
      const { result, error } = await supabaseStorage.uploadBase64Photo(
        projectId,
        capture.characterId,
        photo.uri
      );
      if (!error && result) {
        storagePath = result.path;
      }
    }

    if (storagePath) {
      // Save photo record in DB
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

export async function pushScheduleData(projectId: string, schedule: ProductionSchedule): Promise<void> {
  if (!isSupabaseConfigured) return;

  debouncedPush('schedule', async () => {
    const { error } = await supabase
      .from('schedule_data')
      .upsert({
        id: schedule.id,
        project_id: projectId,
        raw_pdf_text: schedule.rawText || null,
        cast_list: schedule.castList as any,
        days: schedule.days as any,
        status: schedule.status === 'complete' ? 'complete' : 'pending',
      }, { onConflict: 'id' });
    if (error) throw error;
  });
}

// ============================================================================
// Real-time Subscriptions
// ============================================================================

export function subscribeToProject(projectId: string, userId?: string): void {
  if (!isSupabaseConfigured) return;
  if (activeChannel) {
    unsubscribeFromProject();
  }

  activeProjectId = projectId;

  const channel = supabase.channel(`project:${projectId}`, {
    config: {
      broadcast: { self: false },
      presence: { key: userId || CLIENT_ID },
    },
  });

  // Subscribe to scene changes
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'scenes',
      filter: `project_id=eq.${projectId}`,
    },
    (payload: RealtimePostgresChangesPayload<DbScene>) => {
      if (pushingTables.has('scenes')) return;
      handleSceneChange(payload);
    }
  );

  // Subscribe to character changes
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'characters',
      filter: `project_id=eq.${projectId}`,
    },
    (payload: RealtimePostgresChangesPayload<DbCharacter>) => {
      if (pushingTables.has('characters')) return;
      handleCharacterChange(payload);
    }
  );

  // Subscribe to look changes
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'looks',
      filter: `project_id=eq.${projectId}`,
    },
    (payload: RealtimePostgresChangesPayload<DbLook>) => {
      if (pushingTables.has('looks')) return;
      handleLookChange(payload);
    }
  );

  // Subscribe to continuity event changes (no project_id column - filter client-side)
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'continuity_events',
    },
    (payload: RealtimePostgresChangesPayload<DbContinuityEvent>) => {
      // Filter client-side: only process if scene belongs to current project
      const record = (payload.new || payload.old) as any;
      if (!record?.scene_id) return;
      const project = useProjectStore.getState().currentProject;
      if (!project?.scenes.some((s: Scene) => s.id === record.scene_id)) return;
      if (pushingTables.has(`capture_${record.id}`)) return;
      handleContinuityEventChange(payload, projectId);
    }
  );

  // Subscribe to schedule data changes
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'schedule_data',
      filter: `project_id=eq.${projectId}`,
    },
    (payload: RealtimePostgresChangesPayload<DbScheduleData>) => {
      if (pushingTables.has('schedule')) return;
      handleScheduleChange(payload, projectId);
    }
  );

  // Subscribe to photo changes (no project_id - filter by known capture IDs)
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'photos',
    },
    (payload: RealtimePostgresChangesPayload<DbPhoto>) => {
      const record = (payload.new || payload.old) as any;
      if (!record?.continuity_event_id) return;
      // Only process if capture belongs to our project
      const captures = useProjectStore.getState().sceneCaptures;
      if (!captures[record.continuity_event_id]) return;
      handlePhotoChange(payload, projectId);
    }
  );

  // Presence tracking
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    const onlineCount = Object.keys(state).length;
    useSyncStore.getState().setOnlineMembers(onlineCount);
  });

  channel.subscribe(async (status: string) => {
    if (status === 'SUBSCRIBED') {
      useSyncStore.getState().setRealtimeConnected(true);
      // Track presence
      if (userId) {
        await channel.track({
          user_id: userId,
          client_id: CLIENT_ID,
          online_at: new Date().toISOString(),
        });
      }
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
      useSyncStore.getState().setRealtimeConnected(false);
    }
  });

  activeChannel = channel;
  useSyncStore.getState().setActiveProject(projectId);
}

export function unsubscribeFromProject(): void {
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
  }
  activeProjectId = null;

  // Clear any pending push timers
  for (const timer of Object.values(pushTimers)) {
    clearTimeout(timer);
  }
  pushTimers = {};
  pushingTables.clear();

  useSyncStore.getState().setRealtimeConnected(false);
  useSyncStore.getState().setActiveProject(null);
}

// ============================================================================
// Real-time Change Handlers
// ============================================================================

function handleSceneChange(payload: RealtimePostgresChangesPayload<DbScene>): void {
  const projectStore = useProjectStore.getState();
  const project = projectStore.currentProject;
  if (!project) return;

  if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
    const dbScene = payload.new as DbScene;
    const existingScene = project.scenes.find((s: Scene) => s.id === dbScene.id);

    // We need to fetch scene_characters for this scene
    fetchSceneCharacters(dbScene.id).then(characterIds => {
      const localScene = dbToScene(dbScene, characterIds, existingScene);
      const updatedScenes = existingScene
        ? project.scenes.map((s: Scene) => s.id === localScene.id ? localScene : s)
        : [...project.scenes, localScene];

      projectStore.setProject({
        ...project,
        scenes: updatedScenes,
      });
    });
  } else if (payload.eventType === 'DELETE') {
    const oldScene = payload.old as { id: string };
    projectStore.setProject({
      ...project,
      scenes: project.scenes.filter((s: Scene) => s.id !== oldScene.id),
    });
  }
}

function handleCharacterChange(payload: RealtimePostgresChangesPayload<DbCharacter>): void {
  const projectStore = useProjectStore.getState();
  const project = projectStore.currentProject;
  if (!project) return;

  if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
    const dbChar = payload.new as DbCharacter;
    const existingChar = project.characters.find((c: Character) => c.id === dbChar.id);
    const localChar = dbToCharacter(dbChar, existingChar);

    const updatedChars = existingChar
      ? project.characters.map((c: Character) => c.id === localChar.id ? localChar : c)
      : [...project.characters, localChar];

    projectStore.setProject({
      ...project,
      characters: updatedChars,
    });
  } else if (payload.eventType === 'DELETE') {
    const oldChar = payload.old as { id: string };
    projectStore.setProject({
      ...project,
      characters: project.characters.filter((c: Character) => c.id !== oldChar.id),
    });
  }
}

function handleLookChange(payload: RealtimePostgresChangesPayload<DbLook>): void {
  const projectStore = useProjectStore.getState();
  const project = projectStore.currentProject;
  if (!project) return;

  if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
    const dbLook = payload.new as DbLook;
    const existingLook = project.looks.find((l: Look) => l.id === dbLook.id);

    // Fetch look_scenes for this look
    fetchLookScenes(dbLook.id).then(sceneNumbers => {
      const localLook = dbToLook(dbLook, sceneNumbers, existingLook);

      const updatedLooks = existingLook
        ? project.looks.map((l: Look) => l.id === localLook.id ? localLook : l)
        : [...project.looks, localLook];

      projectStore.setProject({
        ...project,
        looks: updatedLooks,
      });
    });
  } else if (payload.eventType === 'DELETE') {
    const oldLook = payload.old as { id: string };
    projectStore.setProject({
      ...project,
      looks: project.looks.filter((l: Look) => l.id !== oldLook.id),
    });
  }
}

function handleContinuityEventChange(
  payload: RealtimePostgresChangesPayload<DbContinuityEvent>,
  _projectId: string
): void {
  const projectStore = useProjectStore.getState();

  if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
    const dbCapture = payload.new as DbContinuityEvent;

    // Fetch associated photos
    fetchCapturePhotos(dbCapture.id).then(async (dbPhotos) => {
      const mainPhotos: { front?: Photo; left?: Photo; right?: Photo; back?: Photo } = {};
      const additionalPhotos: Photo[] = [];

      for (const dbPhoto of dbPhotos) {
        const photo = await downloadAndCachePhoto(dbPhoto);
        if (!photo) continue;

        if (dbPhoto.angle !== 'additional' && dbPhoto.angle !== 'detail') {
          mainPhotos[dbPhoto.angle as keyof typeof mainPhotos] = photo;
        } else {
          additionalPhotos.push(photo);
        }
      }

      const localCapture = dbToSceneCapture(dbCapture, mainPhotos, additionalPhotos);
      projectStore.updateSceneCapture(localCapture.id, localCapture);
    });
  }
}

function handleScheduleChange(
  payload: RealtimePostgresChangesPayload<DbScheduleData>,
  projectId: string
): void {
  if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
    const dbSchedule = payload.new as DbScheduleData;
    mergeScheduleData(dbSchedule, projectId);
  }
}

function handlePhotoChange(
  payload: RealtimePostgresChangesPayload<DbPhoto>,
  _projectId: string
): void {
  if (payload.eventType === 'INSERT') {
    const dbPhoto = payload.new as DbPhoto;
    // Download and cache the new photo
    downloadAndCachePhoto(dbPhoto).then(photo => {
      if (!photo) return;
      // Find the capture this photo belongs to and update it
      const projectStore = useProjectStore.getState();
      const captures = projectStore.sceneCaptures;

      for (const [captureId, _capture] of Object.entries(captures)) {
        if (captureId === dbPhoto.continuity_event_id) {
          if (dbPhoto.angle !== 'additional' && dbPhoto.angle !== 'detail') {
            projectStore.addPhotoToCapture(
              captureId,
              photo,
              dbPhoto.angle as keyof SceneCapture['photos']
            );
          } else {
            projectStore.addPhotoToCapture(captureId, photo, 'additional');
          }
          break;
        }
      }
    });
  }
}

// ============================================================================
// Helper Fetchers (for real-time change handling)
// ============================================================================

async function fetchSceneCharacters(sceneId: string): Promise<string[]> {
  const { data } = await supabase
    .from('scene_characters')
    .select('character_id')
    .eq('scene_id', sceneId);
  return (data || []).map((sc: any) => sc.character_id);
}

async function fetchLookScenes(lookId: string): Promise<string[]> {
  const { data } = await supabase
    .from('look_scenes')
    .select('scene_number')
    .eq('look_id', lookId);
  return (data || []).map((ls: any) => ls.scene_number);
}

async function fetchCapturePhotos(captureId: string): Promise<DbPhoto[]> {
  const { data } = await supabase
    .from('photos')
    .select('*')
    .eq('continuity_event_id', captureId);
  return data || [];
}

// ============================================================================
// Lifecycle: Start / Stop sync for a project
// ============================================================================

export async function startSync(projectId: string, userId?: string): Promise<void> {
  if (!isSupabaseConfigured) {
    useSyncStore.getState().setOffline();
    return;
  }

  // Check if we're online
  if (!navigator.onLine) {
    useSyncStore.getState().setOffline();
    // Listen for reconnection
    window.addEventListener('online', () => {
      startSync(projectId, userId);
    }, { once: true });
    return;
  }

  // Pull latest data from server
  await pullProjectData(projectId);

  // Set up real-time subscriptions
  subscribeToProject(projectId, userId);

  // Listen for online/offline events
  window.addEventListener('offline', () => {
    useSyncStore.getState().setOffline();
  });
  window.addEventListener('online', () => {
    useSyncStore.getState().setStatus('syncing');
    pullProjectData(projectId).then(() => {
      subscribeToProject(projectId, userId);
    });
  });
}

export function stopSync(): void {
  unsubscribeFromProject();
  useSyncStore.getState().reset();
}

// ============================================================================
// Export active project ID for use in push triggers
// ============================================================================

export function getActiveProjectId(): string | null {
  return activeProjectId;
}
