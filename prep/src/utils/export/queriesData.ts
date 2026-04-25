/**
 * Pure data extractor for the Director Queries export (PDF + XLSX).
 *
 * Pulls every non-empty Notes & Queries entry from the Script
 * Breakdown panel — the pinned "Notes" textarea at the top of each
 * scene's breakdown — and pairs it with the scene's heading + the
 * synopsis from useSynopsisStore. This is the same data the on-screen
 * 🚩 query indicator surfaces on the scene list, just exported.
 *
 * Notes are persisted to localStorage under
 * `prep-scene-notes-${projectId}` as a record keyed by scene id with
 * `{ text, flagged }`. We sort flagged scenes first, then by scene
 * number — so the urgent stuff is at the top of the document.
 */

import {
  useParsedScriptStore,
  useSynopsisStore,
  type ParsedSceneData,
} from '@/stores/breakdownStore';
import { useProjectStore } from '@/stores/projectStore';

export interface QueryExportMeta {
  projectName: string;
  generatedAt: Date;
  totalCount: number;
  flaggedCount: number;
  unflaggedCount: number;
}

export interface QueryExportEntry {
  sceneId: string;
  sceneNumber: number;
  sceneHeader: string;
  intExt: 'INT' | 'EXT' | '';
  location: string;
  dayNight: string;
  storyDay: string;
  synopsis: string;
  noteText: string;
  flagged: boolean;
}

export interface QueryExportPayload {
  meta: QueryExportMeta;
  entries: QueryExportEntry[];
}

interface SceneNoteEntry {
  text: string;
  flagged: boolean;
}

function readSceneNotes(projectId: string): Record<string, SceneNoteEntry> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`prep-scene-notes-${projectId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, SceneNoteEntry>;
  } catch { /* corrupt JSON — treat as empty */ }
  return {};
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
  const synopsisStore = useSynopsisStore.getState();
  const notesByScene = readSceneNotes(projectId);

  const scenes = [...(parsed?.scenes ?? [])].sort((a, b) => a.number - b.number);

  const entries: QueryExportEntry[] = [];
  let flaggedCount = 0;
  let unflaggedCount = 0;

  for (const scene of scenes) {
    const note = notesByScene[scene.id];
    if (!note) continue;
    const text = (note.text || '').trim();
    if (!text) continue;
    const flagged = !!note.flagged;
    if (flagged) flaggedCount++;
    else unflaggedCount++;
    const synopsis = synopsisStore.getSynopsis(scene.id, scene.synopsis || '');
    entries.push({
      sceneId: scene.id,
      sceneNumber: scene.number,
      sceneHeader: makeSceneHeader(scene),
      intExt: scene.intExt,
      location: scene.location,
      dayNight: scene.dayNight,
      storyDay: scene.storyDay,
      synopsis: synopsis.trim(),
      noteText: text,
      flagged,
    });
  }

  // Flagged scenes first, then by scene number ascending.
  entries.sort((a, b) => {
    if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
    return a.sceneNumber - b.sceneNumber;
  });

  return {
    meta: {
      projectName: project?.title || 'Untitled Project',
      generatedAt: new Date(),
      totalCount: entries.length,
      flaggedCount,
      unflaggedCount,
    },
    entries,
  };
}
