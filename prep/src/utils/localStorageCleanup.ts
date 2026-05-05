/**
 * localStorage cleanup helpers.
 *
 * Prep persists per-project data across many stores keyed by projectId
 * (script uploads, parsed scripts, revised scenes …). Project deletion
 * historically only removed the row from `prep-happy-projects`, so heavy
 * per-project data (parsed scriptContent for every scene) lingered in
 * localStorage until the ~5–10MB origin quota was hit and subsequent
 * `setItem` calls threw — blocking new script uploads even on fresh
 * projects.
 *
 * Two helpers:
 *   - clearProjectLocalData: cascade delete for a single project
 *   - purgeOrphanedProjectData: one-time sweep that drops entries for
 *     projectIds that are no longer in the active project list
 */

import {
  useScriptUploadStore,
  useParsedScriptStore,
  useRevisedScenesStore,
  useBreakdownStore,
  useSynopsisStore,
  useSceneMetaStore,
  useContinuityTrackerStore,
  useContinuityPhotosStore,
} from '@/stores/breakdownStore';

/**
 * Clear all locally persisted data for a single project across every
 * per-project store. Safe to call after the server-side delete has
 * already happened (or even if it failed — local cleanup is independent).
 */
export function clearProjectLocalData(projectId: string): void {
  // Snapshot scene + character IDs from parsed-scripts BEFORE clearing it,
  // so we can prune scene-keyed and character-keyed stores too.
  const parsed = useParsedScriptStore.getState().getParsedData(projectId);
  const sceneIds = new Set((parsed?.scenes || []).map((s) => s.id));
  const characterIds = new Set((parsed?.characters || []).map((c) => c.id));

  // ── projectId-keyed stores ──
  useScriptUploadStore.getState().clearScript(projectId);
  useParsedScriptStore.getState().clearParsedData(projectId);
  useRevisedScenesStore.getState().clearRevision(projectId);

  if (sceneIds.size === 0 && characterIds.size === 0) return;

  // ── sceneId-keyed stores ──
  useBreakdownStore.setState((s) => ({
    breakdowns: Object.fromEntries(
      Object.entries(s.breakdowns).filter(([k]) => !sceneIds.has(k))
    ),
  }));
  useSynopsisStore.setState((s) => ({
    synopses: Object.fromEntries(
      Object.entries(s.synopses).filter(([k]) => !sceneIds.has(k))
    ),
  }));
  useSceneMetaStore.setState((s) => ({
    overrides: Object.fromEntries(
      Object.entries(s.overrides).filter(([k]) => !sceneIds.has(k))
    ),
  }));
  // Continuity tracker keys are `${sceneId}-${characterId}`.
  useContinuityTrackerStore.setState((s) => ({
    entries: Object.fromEntries(
      Object.entries(s.entries).filter(([k]) => {
        const sceneId = k.split('-')[0];
        return !sceneIds.has(sceneId);
      })
    ),
  }));
  useContinuityPhotosStore.setState((s) => ({
    photos: Object.fromEntries(
      Object.entries(s.photos).filter(([k]) => {
        // Photos keys are `${sceneId}-${characterId}` too.
        const sceneId = k.split('-')[0];
        return !sceneIds.has(sceneId);
      })
    ),
  }));
}

/**
 * Drop locally persisted data for any projectId that is no longer in
 * the active project list. Run once on app startup after the project
 * list has rehydrated. Cheap if there are no orphans.
 */
export function purgeOrphanedProjectData(activeProjectIds: string[]): void {
  const active = new Set(activeProjectIds);

  const scriptStore = useScriptUploadStore.getState();
  const parsedStore = useParsedScriptStore.getState();
  const revisedStore = useRevisedScenesStore.getState();

  const orphanIds = new Set<string>();
  for (const id of Object.keys(scriptStore.scripts)) if (!active.has(id)) orphanIds.add(id);
  for (const id of Object.keys(parsedStore.projects)) if (!active.has(id)) orphanIds.add(id);
  for (const id of Object.keys(revisedStore.revisions)) if (!active.has(id)) orphanIds.add(id);

  if (orphanIds.size === 0) return;

  for (const id of orphanIds) clearProjectLocalData(id);
}
