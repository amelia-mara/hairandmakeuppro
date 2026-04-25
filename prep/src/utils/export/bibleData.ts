/**
 * Pure data extractor for the Bible export (PDF only, for now).
 *
 * Mirrors what BibleTab.tsx renders: production details, character
 * reference cards (all billed characters, ordered by billing), full
 * character profiles (with looks), and the SFX / Prosthetics
 * register assembled from continuity events, breakdown SFX notes, and
 * script tags — deduplicated by scene-character-description like the
 * on-screen list.
 */

import {
  useBreakdownStore,
  useTagStore,
  useParsedScriptStore,
  useCharacterOverridesStore,
  type Look,
  type ParsedCharacterData,
  type ParsedSceneData,
} from '@/stores/breakdownStore';
import { useProjectStore } from '@/stores/projectStore';

export interface BibleCharacterEntry {
  character: ParsedCharacterData;
  looks: Look[];
  sceneCount: number;
}

export interface BibleSfxEntry {
  sceneNumber: number;
  characterName: string;
  description: string;
  type: 'SFX' | 'Prosth.';
  confirmed: boolean;
}

export interface BibleExportMeta {
  projectName: string;
  productionType: string;
  department: 'hmu' | 'costume';
  departmentLabel: string;
  generatedAt: Date;
  sceneCount: number;
  shootDays: number;
  characterCount: number;
  sfxCount: number;
  sfxSceneCount: number;
}

export interface BibleExportPayload {
  meta: BibleExportMeta;
  characters: BibleCharacterEntry[];
  sfxEntries: BibleSfxEntry[];
}

export function buildBibleExport(projectId: string): BibleExportPayload {
  const project = useProjectStore.getState().getProject(projectId);
  const parsed = useParsedScriptStore.getState().getParsedData(projectId);
  const breakdownStore = useBreakdownStore.getState();
  const tagStore = useTagStore.getState();
  const overrides = useCharacterOverridesStore.getState();

  const scenes: ParsedSceneData[] = [...(parsed?.scenes ?? [])].sort((a, b) => a.number - b.number);
  const rawCharacters = parsed?.characters ?? [];
  const looks = parsed?.looks ?? [];

  const characters = rawCharacters
    .map((c) => overrides.getCharacter(c))
    .sort((a, b) => a.billing - b.billing);

  const charSceneCount = new Map<string, number>();
  for (const s of scenes) {
    for (const cid of s.characterIds) {
      charSceneCount.set(cid, (charSceneCount.get(cid) ?? 0) + 1);
    }
  }

  const entries: BibleCharacterEntry[] = characters.map((character) => ({
    character,
    looks: looks.filter((l) => l.characterId === character.id),
    sceneCount: charSceneCount.get(character.id) ?? 0,
  }));

  // SFX register — mirror BibleTab's useMemo exactly, including
  // deduplication by `scene-char-desc`.
  const rawSfx: BibleSfxEntry[] = [];
  for (const scene of scenes) {
    const bd = breakdownStore.getBreakdown(scene.id);
    const tags = tagStore.getTagsForScene(scene.id);
    if (bd) {
      for (const ev of bd.continuityEvents) {
        if (ev.type === 'Prosthetic' || ev.type === 'Wound') {
          const ch = characters.find((c) => c.id === ev.characterId);
          rawSfx.push({
            sceneNumber: scene.number,
            characterName: ch?.name || 'Unknown',
            description: ev.description || ev.name || ev.type,
            type: ev.type === 'Prosthetic' ? 'Prosth.' : 'SFX',
            confirmed: true,
          });
        }
      }
      for (const cb of bd.characters) {
        if (cb.sfx) {
          const ch = characters.find((c) => c.id === cb.characterId);
          rawSfx.push({
            sceneNumber: scene.number,
            characterName: ch?.name || 'Unknown',
            description: cb.sfx,
            type: 'SFX',
            confirmed: true,
          });
        }
      }
    }
    const sfxTags = tags.filter((t) => t.categoryId === 'sfx');
    for (const tag of sfxTags) {
      const ch = tag.characterId ? characters.find((c) => c.id === tag.characterId) : null;
      rawSfx.push({
        sceneNumber: scene.number,
        characterName: ch?.name || 'Unknown',
        description: tag.description || tag.text,
        type: 'SFX',
        confirmed: false,
      });
    }
  }

  const seen = new Set<string>();
  const sfxEntries = rawSfx
    .filter((e) => {
      const key = `${e.sceneNumber}-${e.characterName}-${e.description}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.sceneNumber - b.sceneNumber);

  const shootDays = new Set(scenes.map((s) => s.storyDay).filter(Boolean)).size;
  const sfxSceneCount = new Set(sfxEntries.map((e) => e.sceneNumber)).size;

  const department = (project?.department as 'hmu' | 'costume' | undefined) ?? 'hmu';
  const departmentLabel = department === 'costume' ? 'Costume' : 'Hair & Makeup';

  return {
    meta: {
      projectName: project?.title || 'Untitled Project',
      productionType: project?.type || 'Production',
      department,
      departmentLabel,
      generatedAt: new Date(),
      sceneCount: scenes.length,
      shootDays,
      characterCount: characters.length,
      sfxCount: sfxEntries.length,
      sfxSceneCount,
    },
    characters: entries,
    sfxEntries,
  };
}

/** Short ordinal for billing (matches BibleTab's `billingShort`). */
export function billingShort(n: number | undefined): string {
  if (!n || n <= 0) return '—';
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

/** Character initials, max 2 chars (matches BibleTab's `initials`). */
export function characterInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
