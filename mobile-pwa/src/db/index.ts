import Dexie, { type Table } from 'dexie';
import type {
  Project,
  Scene,
  Character,
  Look,
  SceneCapture,
  Photo
} from '@/types';

// Define the database
export class HairMakeupDB extends Dexie {
  projects!: Table<Project>;
  scenes!: Table<Scene>;
  characters!: Table<Character>;
  looks!: Table<Look>;
  sceneCaptures!: Table<SceneCapture>;
  photos!: Table<Photo>;

  constructor() {
    super('HairMakeupProDB');

    this.version(1).stores({
      projects: 'id, name, createdAt, updatedAt',
      scenes: 'id, sceneNumber, slugline, isComplete',
      characters: 'id, name',
      looks: 'id, characterId, name',
      sceneCaptures: 'id, sceneId, characterId, lookId, capturedAt',
      photos: 'id, capturedAt, angle',
    });
  }
}

// Create the database instance
export const db = new HairMakeupDB();

// Database helper functions
export async function saveProject(project: Project): Promise<string> {
  await db.projects.put(project);
  return project.id;
}

export async function getProject(id: string): Promise<Project | undefined> {
  return await db.projects.get(id);
}

export async function getAllProjects(): Promise<Project[]> {
  return await db.projects.toArray();
}

export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id);
}

export async function saveSceneCapture(capture: SceneCapture): Promise<string> {
  await db.sceneCaptures.put(capture);
  return capture.id;
}

export async function getSceneCapture(id: string): Promise<SceneCapture | undefined> {
  return await db.sceneCaptures.get(id);
}

export async function getSceneCaptureBySceneAndCharacter(
  sceneId: string,
  characterId: string
): Promise<SceneCapture | undefined> {
  return await db.sceneCaptures
    .where({ sceneId, characterId })
    .first();
}

export async function getAllSceneCaptures(): Promise<SceneCapture[]> {
  return await db.sceneCaptures.toArray();
}

export async function savePhoto(photo: Photo): Promise<string> {
  await db.photos.put(photo);
  return photo.id;
}

export async function getPhoto(id: string): Promise<Photo | undefined> {
  return await db.photos.get(id);
}

export async function deletePhoto(id: string): Promise<void> {
  await db.photos.delete(id);
}

// Clear all data (for development/testing)
export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.projects.clear(),
    db.scenes.clear(),
    db.characters.clear(),
    db.looks.clear(),
    db.sceneCaptures.clear(),
    db.photos.clear(),
  ]);
}

// Export database for direct access if needed
export default db;
