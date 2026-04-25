/**
 * Pure data extractor for the Breakdown export (PDF + XLSX).
 *
 * Mirrors the row-building logic in BreakdownSheet.tsx so both on-screen
 * CSV copy and offline exports stay in lockstep. If a column changes in
 * the Breakdown UI, change it here too.
 *
 * Reads straight from the stores via `getState()` so this can be called
 * from a non-React context (menu callback in ScriptBreakdown.tsx).
 */

import {
  useParsedScriptStore,
  useBreakdownStore,
  useTagStore,
  type CharacterBreakdown,
  type ParsedSceneData,
  type SceneBreakdown,
} from '@/stores/breakdownStore';
import { useProjectStore } from '@/stores/projectStore';

export interface BreakdownExportMeta {
  projectName: string;
  department: 'hmu' | 'costume';
  scriptFilename?: string;
  generatedAt: Date;
  sceneCount: number;
  characterCount: number;
}

export interface BreakdownExportPayload {
  meta: BreakdownExportMeta;
  headers: string[];
  rows: string[][];
}

/** Replicates the `Same as Sc X` fallback used by the on-screen Breakdown. */
function findPrevScene(
  charId: string,
  currentIdx: number,
  scenes: ParsedSceneData[],
): number | null {
  for (let i = currentIdx - 1; i >= 0; i--) {
    if (scenes[i].characterIds.includes(charId)) return scenes[i].number;
  }
  return null;
}

function buildContinuityNotes(
  cb: CharacterBreakdown | undefined,
  charId: string,
  sceneIdx: number,
  scenes: ParsedSceneData[],
  breakdown: SceneBreakdown | undefined,
  tags: { text: string; categoryId: string }[],
): string {
  const parts: string[] = [];

  if (breakdown) {
    const events = breakdown.continuityEvents.filter((e) => e.characterId === charId);
    if (events.length > 0) {
      parts.push(events.map((e) => e.description || e.type).join(', '));
    }
  }

  if (cb?.notes) parts.push(cb.notes);

  const injTags = tags.filter((t) => t.categoryId === 'injuries' || t.categoryId === 'health');
  if (injTags.length > 0) parts.push(injTags.map((t) => t.text).join(', '));

  const hasHairTag = tags.some((t) => t.categoryId === 'hair');
  const hasMakeupTag = tags.some((t) => t.categoryId === 'makeup');
  const hasManualEntry =
    cb && (cb.entersWith.hair || cb.entersWith.makeup || cb.entersWith.wardrobe || cb.sfx);
  if (parts.length === 0 && !hasManualEntry && !hasHairTag && !hasMakeupTag) {
    const prev = findPrevScene(charId, sceneIdx, scenes);
    if (prev !== null) parts.push(`Same as Sc ${prev}`);
  }

  return parts.join('; ');
}

/**
 * Produce the breakdown export table for a project. Returns the 11-column
 * shape used by the on-screen CSV export, plus meta used to stamp the
 * document cover / footer.
 */
export function buildBreakdownExport(projectId: string): BreakdownExportPayload {
  const project = useProjectStore.getState().getProject(projectId);
  const parsed = useParsedScriptStore.getState().getParsedData(projectId);
  const breakdownStore = useBreakdownStore.getState();
  const tagStore = useTagStore.getState();

  const scenes: ParsedSceneData[] = [...(parsed?.scenes ?? [])].sort(
    (a, b) => a.number - b.number,
  );
  const characters = parsed?.characters ?? [];
  const looks = parsed?.looks ?? [];

  const department: 'hmu' | 'costume' =
    (project?.department as 'hmu' | 'costume' | undefined) ?? 'hmu';

  const headers =
    department === 'costume'
      ? [
          'Scene',
          'Day',
          'Character',
          'Look',
          'Clothing',
          'Accessories',
          'SFX',
          'Environmental',
          'Action',
          'Continuity Notes',
        ]
      : [
          'Scene',
          'Day',
          'Character',
          'Look',
          'Hair',
          'Makeup',
          'Wardrobe',
          'SFX',
          'Environmental',
          'Action',
          'Continuity Notes',
        ];

  const rows: string[][] = [];
  for (let idx = 0; idx < scenes.length; idx++) {
    const s = scenes[idx];
    const bd = breakdownStore.getBreakdown(s.id);
    const storyDay = bd?.timeline.day || s.storyDay || '';
    for (const cid of s.characterIds) {
      const ch = characters.find((c) => c.id === cid);
      if (!ch) continue;
      const cb = bd?.characters.find((c) => c.characterId === cid);
      const tags = tagStore.getTagsForScene(s.id).filter((t) => t.characterId === cid);
      const notes = buildContinuityNotes(cb, cid, idx, scenes, bd, tags);

      const charLook = cb?.lookId ? looks.find((l) => l.id === cb.lookId) : null;
      const hairTags = tags.filter((t) => t.categoryId === 'hair');
      const makeupTags = tags.filter((t) => t.categoryId === 'makeup');
      const wardrobeTags = tags.filter((t) => t.categoryId === 'wardrobe');
      const sfxTags = tags.filter((t) => t.categoryId === 'sfx');
      const envTags = tags.filter((t) => t.categoryId === 'environmental');
      const actionTags = tags.filter((t) => t.categoryId === 'action');

      const resolve = (
        manual: string | undefined,
        tagList: typeof hairTags,
        lookField: string | undefined,
      ): string =>
        manual || (tagList.length > 0 ? tagList.map((t) => t.text).join(', ') : '') || lookField || '';

      const hair = resolve(cb?.entersWith.hair, hairTags, charLook?.hair);
      const makeup = resolve(cb?.entersWith.makeup, makeupTags, charLook?.makeup);
      const wardrobe = resolve(cb?.entersWith.wardrobe, wardrobeTags, charLook?.wardrobe);
      const sfx = cb?.sfx || sfxTags.map((t) => t.text).join(', ') || '';
      const environmental = cb?.environmental || envTags.map((t) => t.text).join(', ') || '';
      const action = cb?.action || actionTags.map((t) => t.text).join(', ') || '';

      const base = [String(s.number), storyDay, ch.name, charLook?.name || ''];
      if (department === 'costume') {
        rows.push([...base, wardrobe, '', sfx, environmental, action, notes]);
      } else {
        rows.push([...base, hair, makeup, wardrobe, sfx, environmental, action, notes]);
      }
    }
  }

  return {
    meta: {
      projectName: project?.title || 'Untitled Project',
      department,
      scriptFilename: project?.scriptFilename || parsed?.filename,
      generatedAt: new Date(),
      sceneCount: scenes.length,
      characterCount: characters.length,
    },
    headers,
    rows,
  };
}
