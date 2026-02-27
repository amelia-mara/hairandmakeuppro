import Dexie, { type Table } from 'dexie';
import type {
  Project,
  Scene,
  Character,
  Look,
  SceneCapture,
  Photo,
  PhotoAngle
} from '@/types';

// Main angle photos (excludes 'additional' which is stored separately)
type MainPhotoAngle = 'front' | 'left' | 'right' | 'back';

// Photo blob storage - stores actual image data separately from metadata
export interface PhotoBlob {
  id: string;
  blob: Blob;
  thumbnail: string; // Keep thumbnail as base64 for quick rendering
  capturedAt: Date;
  angle?: PhotoAngle;
}

// Project data for IndexedDB storage
export interface StoredProject {
  id: string;
  data: Project;
  updatedAt: Date;
}

// Scene captures stored separately with photo references
export interface StoredSceneCapture {
  id: string;
  projectId: string;
  sceneId: string;
  characterId: string;
  data: Omit<SceneCapture, 'photos' | 'additionalPhotos'> & {
    photoIds: Partial<Record<MainPhotoAngle, string>>;
    additionalPhotoIds: string[];
  };
  updatedAt: Date;
}

// Zustand store state backup
export interface StoreBackup {
  id: string; // store name
  state: unknown;
  updatedAt: Date;
}

// Define the database with version 2 schema for blob storage
export class HairMakeupDB extends Dexie {
  projects!: Table<StoredProject>;
  scenes!: Table<Scene>;
  characters!: Table<Character>;
  looks!: Table<Look>;
  sceneCaptures!: Table<StoredSceneCapture>;
  photoBlobs!: Table<PhotoBlob>;
  storeBackups!: Table<StoreBackup>;

  constructor() {
    super('HairMakeupProDB');

    // Version 1: Original schema (photos as table, never used)
    this.version(1).stores({
      projects: 'id, name, createdAt, updatedAt',
      scenes: 'id, sceneNumber, slugline, isComplete',
      characters: 'id, name',
      looks: 'id, characterId, name',
      sceneCaptures: 'id, sceneId, characterId, lookId, capturedAt',
      photos: 'id, capturedAt, angle',
    });

    // Version 2: Enhanced schema with blob storage and store backups
    this.version(2).stores({
      projects: 'id, updatedAt',
      scenes: 'id, sceneNumber, slugline, isComplete',
      characters: 'id, name',
      looks: 'id, characterId, name',
      sceneCaptures: 'id, projectId, sceneId, characterId, updatedAt',
      photoBlobs: 'id, capturedAt, angle',
      storeBackups: 'id, updatedAt',
      // Drop old photos table
      photos: null,
    }).upgrade(async () => {
      // Migration: Clear old data since photos table format changed
      // Users will need to re-capture photos, but this is acceptable for the migration
    });
  }
}

// Create the database instance
export const db = new HairMakeupDB();

// ============================================================================
// PHOTO BLOB STORAGE
// ============================================================================

/**
 * Save a photo blob to IndexedDB
 */
export async function savePhotoBlob(
  id: string,
  blob: Blob,
  thumbnail: string,
  angle?: PhotoAngle
): Promise<string> {
  await db.photoBlobs.put({
    id,
    blob,
    thumbnail,
    capturedAt: new Date(),
    angle,
  });
  return id;
}

/**
 * Get a photo blob by ID
 */
export async function getPhotoBlob(id: string): Promise<PhotoBlob | undefined> {
  return await db.photoBlobs.get(id);
}

/**
 * Get multiple photo blobs by IDs
 */
export async function getPhotoBlobs(ids: string[]): Promise<PhotoBlob[]> {
  return await db.photoBlobs.bulkGet(ids).then(results =>
    results.filter((p): p is PhotoBlob => p !== undefined)
  );
}

/**
 * Delete a photo blob
 */
export async function deletePhotoBlob(id: string): Promise<void> {
  await db.photoBlobs.delete(id);
}

/**
 * Delete multiple photo blobs
 */
export async function deletePhotoBlobs(ids: string[]): Promise<void> {
  await db.photoBlobs.bulkDelete(ids);
}

/**
 * Convert a Photo object (with base64 uri) to blob storage
 * Returns the photo ID for reference
 */
export async function migratePhotoToBlob(photo: Photo): Promise<string> {
  // Convert base64 to blob
  const response = await fetch(photo.uri);
  const blob = await response.blob();

  await savePhotoBlob(photo.id, blob, photo.thumbnail, photo.angle);
  return photo.id;
}

/**
 * Get photo as Photo object (converts blob back to base64 for compatibility)
 */
export async function getPhotoAsBase64(id: string): Promise<Photo | undefined> {
  const photoBlob = await getPhotoBlob(id);
  if (!photoBlob) return undefined;

  // Convert blob to base64
  const reader = new FileReader();
  const uri = await new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(photoBlob.blob);
  });

  return {
    id: photoBlob.id,
    uri,
    thumbnail: photoBlob.thumbnail,
    capturedAt: photoBlob.capturedAt,
    angle: photoBlob.angle,
  };
}

// ============================================================================
// PROJECT STORAGE
// ============================================================================

/**
 * Save a project to IndexedDB
 */
export async function saveProject(project: Project): Promise<string> {
  await db.projects.put({
    id: project.id,
    data: project,
    updatedAt: new Date(),
  });
  return project.id;
}

/**
 * Get a project by ID
 */
export async function getProject(id: string): Promise<Project | undefined> {
  const stored = await db.projects.get(id);
  return stored?.data;
}

/**
 * Get all projects
 */
export async function getAllProjects(): Promise<Project[]> {
  const stored = await db.projects.toArray();
  return stored.map(s => s.data);
}

/**
 * Delete a project and its associated data
 */
export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', [db.projects, db.sceneCaptures, db.photoBlobs], async () => {
    // Get all scene captures for this project
    const captures = await db.sceneCaptures.where('projectId').equals(id).toArray();

    // Collect all photo IDs
    const photoIds: string[] = [];
    for (const capture of captures) {
      // Add main angle photos
      const angleIds = Object.values(capture.data.photoIds).filter((id): id is string => id !== undefined);
      photoIds.push(...angleIds);
      // Add additional photos
      photoIds.push(...capture.data.additionalPhotoIds);
    }

    // Delete all photos
    await db.photoBlobs.bulkDelete(photoIds);

    // Delete scene captures
    await db.sceneCaptures.where('projectId').equals(id).delete();

    // Delete project
    await db.projects.delete(id);
  });
}

// ============================================================================
// SCENE CAPTURE STORAGE
// ============================================================================

/**
 * Save scene capture to IndexedDB (stores photos as blobs)
 */
export async function saveSceneCaptureToDb(
  projectId: string,
  capture: SceneCapture
): Promise<string> {
  // Extract photo IDs from the capture
  const photoIds: Partial<Record<MainPhotoAngle, string>> = {};
  const additionalPhotoIds: string[] = [];

  // Save main angle photos
  const angles: MainPhotoAngle[] = ['front', 'left', 'right', 'back'];
  for (const angle of angles) {
    const photo = capture.photos[angle];
    if (photo) {
      photoIds[angle] = photo.id;
      // Save photo blob if it's new
      const existing = await db.photoBlobs.get(photo.id);
      if (!existing) {
        await migratePhotoToBlob(photo);
      }
    }
  }

  // Save additional photos
  for (const photo of capture.additionalPhotos) {
    additionalPhotoIds.push(photo.id);
    const existing = await db.photoBlobs.get(photo.id);
    if (!existing) {
      await migratePhotoToBlob(photo);
    }
  }

  // Save capture with photo references only
  const storedCapture: StoredSceneCapture = {
    id: capture.id,
    projectId,
    sceneId: capture.sceneId,
    characterId: capture.characterId,
    data: {
      id: capture.id,
      sceneId: capture.sceneId,
      characterId: capture.characterId,
      lookId: capture.lookId,
      capturedAt: capture.capturedAt,
      continuityFlags: capture.continuityFlags,
      continuityEvents: capture.continuityEvents,
      sfxDetails: capture.sfxDetails,
      notes: capture.notes,
      applicationTime: capture.applicationTime,
      photoIds,
      additionalPhotoIds,
    },
    updatedAt: new Date(),
  };

  await db.sceneCaptures.put(storedCapture);
  return capture.id;
}

/**
 * Get scene capture with photos loaded from blob storage
 */
export async function getSceneCaptureFromDb(id: string): Promise<SceneCapture | undefined> {
  const stored = await db.sceneCaptures.get(id);
  if (!stored) return undefined;

  // Load main angle photos from blob storage
  const photos: SceneCapture['photos'] = {};
  const angles: MainPhotoAngle[] = ['front', 'left', 'right', 'back'];
  for (const angle of angles) {
    const photoId = stored.data.photoIds[angle];
    if (photoId) {
      const photo = await getPhotoAsBase64(photoId);
      if (photo) {
        photos[angle] = photo;
      }
    }
  }

  // Load additional photos
  const additionalPhotos: Photo[] = [];
  for (const photoId of stored.data.additionalPhotoIds) {
    const photo = await getPhotoAsBase64(photoId);
    if (photo) {
      additionalPhotos.push(photo);
    }
  }

  return {
    id: stored.data.id,
    sceneId: stored.data.sceneId,
    characterId: stored.data.characterId,
    lookId: stored.data.lookId,
    capturedAt: stored.data.capturedAt,
    continuityFlags: stored.data.continuityFlags,
    continuityEvents: stored.data.continuityEvents,
    sfxDetails: stored.data.sfxDetails,
    notes: stored.data.notes,
    applicationTime: stored.data.applicationTime,
    photos,
    additionalPhotos,
  };
}

/**
 * Get all scene captures for a project (with photos loaded)
 */
export async function getSceneCapturesForProject(
  projectId: string
): Promise<Record<string, SceneCapture>> {
  const stored = await db.sceneCaptures.where('projectId').equals(projectId).toArray();

  const captures: Record<string, SceneCapture> = {};
  for (const s of stored) {
    const capture = await getSceneCaptureFromDb(s.id);
    if (capture) {
      captures[s.id] = capture;
    }
  }

  return captures;
}

/**
 * Get scene capture by scene and character
 */
export async function getSceneCaptureBySceneAndCharacter(
  sceneId: string,
  characterId: string
): Promise<SceneCapture | undefined> {
  const stored = await db.sceneCaptures
    .where({ sceneId, characterId })
    .first();

  if (!stored) return undefined;
  return getSceneCaptureFromDb(stored.id);
}

/**
 * Delete scene capture and its photos
 */
export async function deleteSceneCapture(id: string): Promise<void> {
  const stored = await db.sceneCaptures.get(id);
  if (!stored) return;

  // Collect all photo IDs
  const photoIds: string[] = [
    ...Object.values(stored.data.photoIds).filter((id): id is string => id !== undefined),
    ...stored.data.additionalPhotoIds,
  ];

  // Delete photos and capture
  await db.transaction('rw', [db.sceneCaptures, db.photoBlobs], async () => {
    await db.photoBlobs.bulkDelete(photoIds);
    await db.sceneCaptures.delete(id);
  });
}

// ============================================================================
// STORE BACKUP (for Zustand state that needs IndexedDB)
// ============================================================================

/**
 * Save a store's state to IndexedDB
 */
export async function saveStoreBackup(storeName: string, state: unknown): Promise<void> {
  await db.storeBackups.put({
    id: storeName,
    state,
    updatedAt: new Date(),
  });
}

/**
 * Get a store's backed up state
 */
export async function getStoreBackup(storeName: string): Promise<unknown | undefined> {
  const backup = await db.storeBackups.get(storeName);
  return backup?.state;
}

/**
 * Delete a store backup
 */
export async function deleteStoreBackup(storeName: string): Promise<void> {
  await db.storeBackups.delete(storeName);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get database storage usage estimate
 */
export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
  percentUsed: number;
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    return {
      usage,
      quota,
      percentUsed: quota > 0 ? (usage / quota) * 100 : 0,
    };
  }
  return { usage: 0, quota: 0, percentUsed: 0 };
}

/**
 * Count photos in database
 */
export async function getPhotoCount(): Promise<number> {
  return await db.photoBlobs.count();
}

/**
 * Get total size of photos (approximate)
 */
export async function getPhotosSize(): Promise<number> {
  let totalSize = 0;
  await db.photoBlobs.each(photo => {
    totalSize += photo.blob.size;
  });
  return totalSize;
}

/**
 * Clear all data (for development/testing)
 */
export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.projects.clear(),
    db.scenes.clear(),
    db.characters.clear(),
    db.looks.clear(),
    db.sceneCaptures.clear(),
    db.photoBlobs.clear(),
    db.storeBackups.clear(),
  ]);
}

// Export database for direct access if needed
export default db;
