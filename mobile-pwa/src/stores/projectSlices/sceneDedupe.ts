import type { Scene } from '@/types';

/**
 * Pick the "richer" of two duplicate scenes — used to decide which copy
 * to keep when two Scene records share the same sceneNumber.
 *
 * Preference order:
 *   1. More confirmed characters (longer characters[] array)
 *   2. Has prepBreakdown data
 *   3. Has synopsis
 *   4. Has shootingDay
 */
export function isRicherScene(candidate: Scene, current: Scene): boolean {
  if (candidate.characters.length !== current.characters.length) {
    return candidate.characters.length > current.characters.length;
  }
  if (!!candidate.prepBreakdown !== !!current.prepBreakdown) {
    return !!candidate.prepBreakdown;
  }
  if (!!candidate.synopsis !== !!current.synopsis) {
    return !!candidate.synopsis;
  }
  if (candidate.shootingDay != null && current.shootingDay == null) {
    return true;
  }
  return false;
}

/**
 * Remove duplicate Scene records that share the same sceneNumber, keeping
 * the richest copy (see isRicherScene). The order of first-occurrence
 * sceneNumbers is preserved.
 *
 * Background: a realtime-sync regression caused server-pushed INSERT
 * events to re-add scenes already present locally with empty characters,
 * producing pairs of cards on the Scenes page (one confirmed, one empty).
 * This helper is the safety net invoked at every entry point that brings
 * scene data into the store.
 */
export function dedupeScenesByNumber(scenes: Scene[]): Scene[] {
  const indexBySceneNumber = new Map<string, number>();
  const result: Scene[] = [];

  for (const scene of scenes) {
    const existingIdx = indexBySceneNumber.get(scene.sceneNumber);
    if (existingIdx === undefined) {
      indexBySceneNumber.set(scene.sceneNumber, result.length);
      result.push(scene);
    } else if (isRicherScene(scene, result[existingIdx])) {
      result[existingIdx] = scene;
    }
  }

  return result;
}
