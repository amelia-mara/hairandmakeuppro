/**
 * Pure data extractor for the Lookbook export (PDF + PPTX).
 *
 * Groups the parsed project's looks under their characters in the
 * order they appear on the Lookbook page — i.e. the on-screen sidebar
 * sort: characters with looks first, by billing ascending; then
 * characters with no looks yet.
 */

import {
  useParsedScriptStore,
  useCharacterOverridesStore,
  type Look,
  type ParsedCharacterData,
} from '@/stores/breakdownStore';
import { useProjectStore } from '@/stores/projectStore';

export interface LookbookExportMeta {
  projectName: string;
  generatedAt: Date;
  characterCount: number;
  lookCount: number;
}

export interface LookbookCharacterEntry {
  character: ParsedCharacterData;
  looks: Look[];
}

export interface LookbookExportPayload {
  meta: LookbookExportMeta;
  characters: LookbookCharacterEntry[];
}

export function buildLookbookExport(projectId: string): LookbookExportPayload {
  const project = useProjectStore.getState().getProject(projectId);
  const parsed = useParsedScriptStore.getState().getParsedData(projectId);
  const overrides = useCharacterOverridesStore.getState();

  const characters = (parsed?.characters ?? []).map((c) => {
    const ovr = overrides.overrides[c.id];
    return ovr ? { ...c, ...ovr } : c;
  });
  const looks = parsed?.looks ?? [];

  const looksByCharacter = new Map<string, Look[]>();
  for (const look of looks) {
    const list = looksByCharacter.get(look.characterId);
    if (list) list.push(look);
    else looksByCharacter.set(look.characterId, [look]);
  }

  // Sort: characters with looks first (by billing asc), then unlooked
  // characters (by billing asc).
  const sortedCharacters = [...characters].sort((a, b) => a.billing - b.billing);
  const withLooks = sortedCharacters.filter((c) => (looksByCharacter.get(c.id)?.length ?? 0) > 0);
  const withoutLooks = sortedCharacters.filter((c) => (looksByCharacter.get(c.id)?.length ?? 0) === 0);

  const entries: LookbookCharacterEntry[] = [...withLooks, ...withoutLooks].map((character) => ({
    character,
    looks: looksByCharacter.get(character.id) ?? [],
  }));

  return {
    meta: {
      projectName: project?.title || 'Untitled Project',
      generatedAt: new Date(),
      characterCount: entries.length,
      lookCount: looks.length,
    },
    characters: entries,
  };
}

/** Human-readable billing label — "Lead", "2nd", "3rd", or empty. */
export function billingLabel(billing: number | undefined): string {
  if (!billing || billing <= 0) return '';
  if (billing === 1) return 'Lead';
  if (billing === 2) return '2nd';
  if (billing === 3) return '3rd';
  return `${billing}th`;
}

/** Comma-joined metadata pills (matches the on-screen character header). */
export function characterMetaLine(c: ParsedCharacterData): string {
  const parts: string[] = [];
  const bill = billingLabel(c.billing);
  if (bill) parts.push(bill);
  if (c.hairColour) parts.push(`${c.hairColour} hair`);
  if (c.skinTone) parts.push(`${c.skinTone} skin`);
  if (c.build) parts.push(`${c.build} build`);
  if (c.age) parts.push(`Age ${c.age}`);
  if (c.distinguishingFeatures) parts.push(c.distinguishingFeatures);
  return parts.join(' · ');
}
