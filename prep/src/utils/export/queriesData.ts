/**
 * Pure data extractor for the Director Queries export (PDF + XLSX).
 *
 * Flattens the per-scene queries map into a scene-ordered array with
 * the surrounding scene context (SC N · INT. LOCATION · DAY etc.).
 * Includes both resolved and unresolved queries — downstream
 * renderers decide how to visually distinguish them.
 */

import {
  useParsedScriptStore,
  type ParsedSceneData,
} from '@/stores/breakdownStore';
import {
  useDirectorQueriesStore,
  type DirectorQuery,
} from '@/stores/directorQueriesStore';
import { useProjectStore } from '@/stores/projectStore';

export interface QueryExportMeta {
  projectName: string;
  generatedAt: Date;
  totalCount: number;
  unresolvedCount: number;
  resolvedCount: number;
}

export interface QueryExportEntry {
  sceneId: string;
  sceneNumber: number;
  intExt: 'INT' | 'EXT' | '';
  location: string;
  dayNight: string;
  storyDay: string;
  query: DirectorQuery;
}

export interface QueryExportGroup {
  sceneId: string;
  sceneNumber: number;
  sceneHeader: string;
  queries: DirectorQuery[];
}

export interface QueryExportPayload {
  meta: QueryExportMeta;
  /** Flat rows for the XLSX sheet. */
  entries: QueryExportEntry[];
  /** Scene-grouped structure for the PDF rendering. */
  groups: QueryExportGroup[];
}

function makeSceneHeader(s: ParsedSceneData): string {
  const bits: string[] = [`SC ${s.number}`];
  if (s.intExt) bits.push(s.intExt);
  if (s.location) bits.push(s.location);
  if (s.dayNight) bits.push(s.dayNight);
  return bits.join(' · ');
}

export function buildQueriesExport(projectId: string): QueryExportPayload {
  const project = useProjectStore.getState().getProject(projectId);
  const parsed = useParsedScriptStore.getState().getParsedData(projectId);
  const queriesStore = useDirectorQueriesStore(projectId).getState();

  const scenes = [...(parsed?.scenes ?? [])].sort((a, b) => a.number - b.number);
  const sceneById = new Map(scenes.map((s) => [s.id, s]));

  const groups: QueryExportGroup[] = [];
  const entries: QueryExportEntry[] = [];
  let resolvedCount = 0;
  let unresolvedCount = 0;

  // Walk scenes in numeric order, then any orphan queries (scenes not
  // in the parsed set — e.g. mock sceneIds).
  const seenSceneIds = new Set<string>();
  for (const scene of scenes) {
    const queries = queriesStore.getQueries(scene.id);
    if (queries.length === 0) continue;
    seenSceneIds.add(scene.id);
    const header = makeSceneHeader(scene);
    groups.push({
      sceneId: scene.id,
      sceneNumber: scene.number,
      sceneHeader: header,
      queries: [...queries].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    });
    for (const query of queries) {
      if (query.resolved) resolvedCount++;
      else unresolvedCount++;
      entries.push({
        sceneId: scene.id,
        sceneNumber: scene.number,
        intExt: scene.intExt,
        location: scene.location,
        dayNight: scene.dayNight,
        storyDay: scene.storyDay,
        query,
      });
    }
  }

  // Orphan queries — the scene record isn't available (happens for mock
  // sceneIds). Tack them on at the end so nothing is lost.
  const allQueries = queriesStore.queries;
  for (const [sceneId, queries] of Object.entries(allQueries)) {
    if (seenSceneIds.has(sceneId) || queries.length === 0) continue;
    groups.push({
      sceneId,
      sceneNumber: Number.POSITIVE_INFINITY,
      sceneHeader: `Scene ${sceneId.slice(0, 8)}`,
      queries: [...queries].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    });
    for (const query of queries) {
      if (query.resolved) resolvedCount++;
      else unresolvedCount++;
      entries.push({
        sceneId,
        sceneNumber: 0,
        intExt: '',
        location: '',
        dayNight: '',
        storyDay: '',
        query,
      });
    }
    void sceneById; // retained — future work may annotate the orphan entry
  }

  const totalCount = resolvedCount + unresolvedCount;

  return {
    meta: {
      projectName: project?.title || 'Untitled Project',
      generatedAt: new Date(),
      totalCount,
      unresolvedCount,
      resolvedCount,
    },
    entries,
    groups,
  };
}
