/**
 * Script Amendment Service
 *
 * Compares new script versions against existing breakdown data to:
 * - Detect new scenes
 * - Detect modified scenes (content changes)
 * - Detect deleted scenes
 * - Preserve existing breakdown data (characters, looks, continuity photos)
 */

import type { Scene, SceneAmendmentStatus } from '@/types';
import type { FastParsedScene } from '@/utils/scriptParser';

export interface SceneChange {
  sceneNumber: string;
  status: SceneAmendmentStatus;
  existingScene?: Scene;
  newScene?: FastParsedScene;
  changeDescription: string;
  contentSimilarity?: number; // 0-100 percentage
}

export interface AmendmentResult {
  changes: SceneChange[];
  newScenes: SceneChange[];
  modifiedScenes: SceneChange[];
  deletedScenes: SceneChange[];
  unchangedScenes: SceneChange[];
  summary: string;
}

/**
 * Calculate similarity between two strings using Jaccard similarity
 * Returns a value between 0 and 100
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 && !text2) return 100;
  if (!text1 || !text2) return 0;

  // Normalize texts
  const normalize = (text: string) =>
    text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const normalized1 = normalize(text1);
  const normalized2 = normalize(text2);

  if (normalized1 === normalized2) return 100;

  // Use word-level comparison for better accuracy
  const words1 = new Set(normalized1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(normalized2.split(' ').filter(w => w.length > 2));

  if (words1.size === 0 && words2.size === 0) return 100;
  if (words1.size === 0 || words2.size === 0) return 0;

  // Calculate Jaccard similarity
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return Math.round((intersection.size / union.size) * 100);
}

/**
 * Generate a human-readable description of what changed
 */
function describeChanges(
  existingContent: string | undefined,
  newContent: string | undefined,
  similarity: number
): string {
  if (!existingContent && newContent) {
    return 'New scene added';
  }
  if (existingContent && !newContent) {
    return 'Scene removed from script';
  }
  if (similarity >= 95) {
    return 'Minor formatting changes';
  }
  if (similarity >= 80) {
    return 'Minor dialogue or action changes';
  }
  if (similarity >= 50) {
    return 'Significant content changes';
  }
  return 'Major rewrite of scene';
}

/**
 * Compare a new parsed script against existing scenes
 * Returns detailed information about what changed
 */
export function compareScriptAmendment(
  existingScenes: Scene[],
  newParsedScenes: FastParsedScene[]
): AmendmentResult {
  const changes: SceneChange[] = [];
  const processedExisting = new Set<string>();
  const processedNew = new Set<string>();

  // Create map for quick lookup of existing scenes
  const existingMap = new Map(existingScenes.map(s => [s.sceneNumber, s]));

  // Check each new scene against existing
  for (const newScene of newParsedScenes) {
    const existing = existingMap.get(newScene.sceneNumber);
    processedNew.add(newScene.sceneNumber);

    if (!existing) {
      // New scene
      changes.push({
        sceneNumber: newScene.sceneNumber,
        status: 'new',
        newScene,
        changeDescription: 'New scene added to script',
      });
    } else {
      processedExisting.add(newScene.sceneNumber);

      // Compare content
      const similarity = calculateTextSimilarity(
        existing.scriptContent || '',
        newScene.scriptContent || ''
      );

      if (similarity >= 95) {
        // Essentially unchanged
        changes.push({
          sceneNumber: newScene.sceneNumber,
          status: 'unchanged',
          existingScene: existing,
          newScene,
          changeDescription: 'No significant changes',
          contentSimilarity: similarity,
        });
      } else {
        // Modified
        changes.push({
          sceneNumber: newScene.sceneNumber,
          status: 'modified',
          existingScene: existing,
          newScene,
          changeDescription: describeChanges(
            existing.scriptContent,
            newScene.scriptContent,
            similarity
          ),
          contentSimilarity: similarity,
        });
      }
    }
  }

  // Check for deleted scenes (in existing but not in new)
  for (const existing of existingScenes) {
    if (!processedExisting.has(existing.sceneNumber)) {
      changes.push({
        sceneNumber: existing.sceneNumber,
        status: 'deleted',
        existingScene: existing,
        changeDescription: 'Scene removed from script',
      });
    }
  }

  // Sort by scene number
  changes.sort((a, b) => {
    const numA = parseFloat(a.sceneNumber.replace(/[A-Z]/g, '.5')) || 0;
    const numB = parseFloat(b.sceneNumber.replace(/[A-Z]/g, '.5')) || 0;
    return numA - numB;
  });

  // Categorize changes
  const newScenes = changes.filter(c => c.status === 'new');
  const modifiedScenes = changes.filter(c => c.status === 'modified');
  const deletedScenes = changes.filter(c => c.status === 'deleted');
  const unchangedScenes = changes.filter(c => c.status === 'unchanged');

  // Generate summary
  const summaryParts: string[] = [];
  if (newScenes.length > 0) {
    summaryParts.push(`${newScenes.length} new scene${newScenes.length > 1 ? 's' : ''}`);
  }
  if (modifiedScenes.length > 0) {
    summaryParts.push(`${modifiedScenes.length} modified scene${modifiedScenes.length > 1 ? 's' : ''}`);
  }
  if (deletedScenes.length > 0) {
    summaryParts.push(`${deletedScenes.length} deleted scene${deletedScenes.length > 1 ? 's' : ''}`);
  }

  const summary = summaryParts.length > 0
    ? summaryParts.join(', ')
    : 'No changes detected';

  return {
    changes,
    newScenes,
    modifiedScenes,
    deletedScenes,
    unchangedScenes,
    summary,
  };
}

/**
 * Apply amendment changes to existing scenes
 * Preserves breakdown data (characters, looks, etc.) while updating script content
 */
export function applyAmendmentToScenes(
  existingScenes: Scene[],
  amendmentResult: AmendmentResult,
  options: {
    includeNew?: boolean;
    includeModified?: boolean;
    includeDeleted?: boolean;
  } = { includeNew: true, includeModified: true, includeDeleted: false }
): Scene[] {
  const now = new Date().toISOString();
  const sceneMap = new Map(existingScenes.map(s => [s.sceneNumber, { ...s }]));

  // Process each change
  for (const change of amendmentResult.changes) {
    if (change.status === 'new' && options.includeNew && change.newScene) {
      // Add new scene
      const newScene: Scene = {
        id: `scene-${change.newScene.sceneNumber}-${Date.now()}`,
        sceneNumber: change.newScene.sceneNumber,
        slugline: change.newScene.slugline,
        intExt: change.newScene.intExt,
        timeOfDay: change.newScene.timeOfDay,
        scriptContent: change.newScene.scriptContent,
        characters: [],
        isComplete: false,
        amendmentStatus: 'new',
        amendmentDate: now,
        amendmentNotes: 'New scene added in script revision',
      };
      sceneMap.set(change.sceneNumber, newScene);
    } else if (change.status === 'modified' && options.includeModified && change.newScene) {
      // Update existing scene while preserving breakdown data
      const existing = sceneMap.get(change.sceneNumber);
      if (existing) {
        sceneMap.set(change.sceneNumber, {
          ...existing,
          // Update script content
          slugline: change.newScene.slugline,
          intExt: change.newScene.intExt,
          timeOfDay: change.newScene.timeOfDay,
          scriptContent: change.newScene.scriptContent,
          // Store previous content for reference
          previousScriptContent: existing.scriptContent,
          // Mark as amended
          amendmentStatus: 'modified',
          amendmentDate: now,
          amendmentNotes: change.changeDescription,
          // PRESERVE existing breakdown data:
          // - characters (confirmed cast)
          // - characterConfirmationStatus
          // - suggestedCharacters
          // - synopsis (if manually edited)
          // - filmingStatus, filmingNotes
          // - shootingDay
          // - isComplete, completedAt
        });
      }
    } else if (change.status === 'deleted' && options.includeDeleted) {
      // Mark scene as deleted but don't remove (preserves continuity data)
      const existing = sceneMap.get(change.sceneNumber);
      if (existing) {
        sceneMap.set(change.sceneNumber, {
          ...existing,
          amendmentStatus: 'deleted',
          amendmentDate: now,
          amendmentNotes: 'Scene removed in script revision',
        });
      }
    } else if (change.status === 'unchanged') {
      // Clear any previous amendment status for unchanged scenes
      const existing = sceneMap.get(change.sceneNumber);
      if (existing && existing.amendmentStatus) {
        sceneMap.set(change.sceneNumber, {
          ...existing,
          amendmentStatus: 'unchanged',
        });
      }
    }
  }

  // Convert map back to array and sort by scene number
  return Array.from(sceneMap.values()).sort((a, b) => {
    const numA = parseFloat(a.sceneNumber.replace(/[A-Z]/g, '.5')) || 0;
    const numB = parseFloat(b.sceneNumber.replace(/[A-Z]/g, '.5')) || 0;
    return numA - numB;
  });
}

/**
 * Clear amendment flags from all scenes
 * Called when user acknowledges/reviews all amendments
 */
export function clearAmendmentFlags(scenes: Scene[]): Scene[] {
  return scenes.map(scene => ({
    ...scene,
    amendmentStatus: undefined,
    previousScriptContent: undefined,
    amendmentNotes: undefined,
    // Keep amendmentDate for historical reference
  }));
}

/**
 * Get count of scenes with pending amendment review
 */
export function getAmendmentCount(scenes: Scene[]): {
  total: number;
  new: number;
  modified: number;
  deleted: number;
} {
  const newCount = scenes.filter(s => s.amendmentStatus === 'new').length;
  const modifiedCount = scenes.filter(s => s.amendmentStatus === 'modified').length;
  const deletedCount = scenes.filter(s => s.amendmentStatus === 'deleted').length;

  return {
    total: newCount + modifiedCount + deletedCount,
    new: newCount,
    modified: modifiedCount,
    deleted: deletedCount,
  };
}
