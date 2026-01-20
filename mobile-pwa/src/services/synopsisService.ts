/**
 * Synopsis Sync Service
 * Handles syncing scene synopses from desktop and generating them via AI if unavailable
 */

import type { Scene } from '@/types';
import { generateSceneSynopsis, checkAIAvailability } from './aiService';

// Storage key for desktop-synced synopsis data
const DESKTOP_SYNOPSIS_KEY = 'desktop-synopsis-sync';

interface DesktopSynopsisData {
  projectId: string;
  synopses: Record<string, string>; // sceneNumber -> synopsis
  syncedAt: Date;
}

/**
 * Check if desktop synopsis data is available
 */
export function hasDesktopSynopsisData(projectId: string): boolean {
  try {
    const stored = localStorage.getItem(DESKTOP_SYNOPSIS_KEY);
    if (!stored) return false;

    const data: DesktopSynopsisData = JSON.parse(stored);
    return data.projectId === projectId && Object.keys(data.synopses).length > 0;
  } catch {
    return false;
  }
}

/**
 * Get desktop-synced synopsis for a scene
 */
export function getDesktopSynopsis(projectId: string, sceneNumber: string): string | null {
  try {
    const stored = localStorage.getItem(DESKTOP_SYNOPSIS_KEY);
    if (!stored) return null;

    const data: DesktopSynopsisData = JSON.parse(stored);
    if (data.projectId !== projectId) return null;

    return data.synopses[sceneNumber] || null;
  } catch {
    return null;
  }
}

/**
 * Save desktop synopsis data (called when syncing from desktop)
 */
export function saveDesktopSynopsisData(
  projectId: string,
  synopses: Record<string, string>
): void {
  const data: DesktopSynopsisData = {
    projectId,
    synopses,
    syncedAt: new Date(),
  };
  localStorage.setItem(DESKTOP_SYNOPSIS_KEY, JSON.stringify(data));
}

/**
 * Sync and apply synopsis to scenes
 * First tries to pull from desktop, then generates via AI if unavailable
 */
export async function syncSceneSynopses(
  projectId: string,
  scenes: Scene[],
  onProgress?: (status: string, progress: number) => void
): Promise<Scene[]> {
  const updatedScenes = [...scenes];
  const scenesNeedingSynopsis = updatedScenes.filter(s => !s.synopsis);

  if (scenesNeedingSynopsis.length === 0) {
    onProgress?.('All scenes have synopses', 100);
    return updatedScenes;
  }

  // Step 1: Try to sync from desktop
  onProgress?.('Checking for desktop sync data...', 5);

  const hasDesktopData = hasDesktopSynopsisData(projectId);

  if (hasDesktopData) {
    onProgress?.('Pulling synopses from desktop...', 10);

    let syncedCount = 0;
    for (const scene of scenesNeedingSynopsis) {
      const desktopSynopsis = getDesktopSynopsis(projectId, scene.sceneNumber);
      if (desktopSynopsis) {
        const idx = updatedScenes.findIndex(s => s.id === scene.id);
        if (idx !== -1) {
          updatedScenes[idx] = { ...updatedScenes[idx], synopsis: desktopSynopsis };
          syncedCount++;
        }
      }
    }

    if (syncedCount > 0) {
      onProgress?.(`Synced ${syncedCount} synopses from desktop`, 50);
    }

    // Check if all scenes now have synopses
    const stillNeedingSynopsis = updatedScenes.filter(s => !s.synopsis);
    if (stillNeedingSynopsis.length === 0) {
      onProgress?.('All synopses synced from desktop', 100);
      return updatedScenes;
    }
  }

  // Step 2: Generate synopsis via AI for remaining scenes
  const remainingScenes = updatedScenes.filter(s => !s.synopsis);

  if (remainingScenes.length === 0) {
    onProgress?.('All scenes have synopses', 100);
    return updatedScenes;
  }

  onProgress?.('Checking AI availability...', 15);
  const aiAvailable = await checkAIAvailability();

  if (!aiAvailable) {
    onProgress?.('AI unavailable - some scenes lack synopses', 100);
    return updatedScenes;
  }

  onProgress?.(`Generating synopses for ${remainingScenes.length} scenes...`, 20);

  // Generate synopses for scenes with script content
  const scenesWithContent = remainingScenes.filter(s => s.scriptContent);
  const totalToGenerate = scenesWithContent.length;
  let generated = 0;

  for (const scene of scenesWithContent) {
    try {
      const progress = 20 + Math.round((generated / totalToGenerate) * 75);
      onProgress?.(`Generating synopsis for Scene ${scene.sceneNumber}...`, progress);

      const synopsis = await generateSceneSynopsis(scene.slugline, scene.scriptContent!);

      if (synopsis) {
        const idx = updatedScenes.findIndex(s => s.id === scene.id);
        if (idx !== -1) {
          updatedScenes[idx] = { ...updatedScenes[idx], synopsis };
        }
      }

      generated++;
    } catch (error) {
      console.error(`Failed to generate synopsis for scene ${scene.sceneNumber}:`, error);
    }

    // Small delay between API calls to avoid rate limiting
    if (generated < totalToGenerate) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  onProgress?.(`Generated ${generated} synopses`, 100);
  return updatedScenes;
}

/**
 * Generate synopsis for a single scene
 */
export async function generateSingleSceneSynopsis(scene: Scene): Promise<string | null> {
  if (!scene.scriptContent) {
    return null;
  }

  const aiAvailable = await checkAIAvailability();
  if (!aiAvailable) {
    return null;
  }

  try {
    return await generateSceneSynopsis(scene.slugline, scene.scriptContent);
  } catch (error) {
    console.error(`Failed to generate synopsis for scene ${scene.sceneNumber}:`, error);
    return null;
  }
}
