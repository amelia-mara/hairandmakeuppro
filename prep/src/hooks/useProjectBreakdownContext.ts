import { useMemo } from 'react';
import {
  useParsedScriptStore,
  useBreakdownStore,
  type ParsedSceneData,
  type ParsedCharacterData,
  type SceneBreakdown,
  type Look,
} from '@/stores/breakdownStore';

export interface BreakdownContext {
  /** Script scenes keyed by their canonical scene number (string). */
  scenesByNumber: Map<string, ParsedSceneData>;
  /** Breakdown rows keyed by the script scene id. */
  breakdownsByScene: Record<string, SceneBreakdown | undefined>;
  /** Characters indexed by id and by uppercase name (for fuzzy lookups). */
  charactersById: Map<string, ParsedCharacterData>;
  charactersByName: Map<string, ParsedCharacterData>;
  /** Looks indexed by id. */
  looksById: Map<string, Look>;
  /** True when neither script nor breakdown has data — widgets render
   *  the call-sheet-only path in that case. */
  isEmpty: boolean;
}

/** Strip "5/20" → "20", "Sc. 22" → "22", " 60 " → "60", trims and uppercases. */
export function canonicalSceneNumber(raw: string | number): string {
  const s = String(raw).trim().toUpperCase().replace(/^(?:SCENE|SC\.?)\s*/, '');
  const slash = s.split('/');
  return slash[slash.length - 1].trim();
}

/**
 * One-stop accessor for the script + breakdown side of the project — the
 * dashboard widgets use it to enrich the call-sheet rows with per-scene
 * HMU requirements, SFX, characters, looks, etc.
 */
export function useProjectBreakdownContext(projectId: string): BreakdownContext {
  const parsedData = useParsedScriptStore((s) => s.getParsedData(projectId));
  const breakdowns = useBreakdownStore((s) => s.breakdowns);

  return useMemo(() => {
    const scenesByNumber = new Map<string, ParsedSceneData>();
    const charactersById = new Map<string, ParsedCharacterData>();
    const charactersByName = new Map<string, ParsedCharacterData>();
    const looksById = new Map<string, Look>();

    if (parsedData) {
      for (const sc of parsedData.scenes) {
        scenesByNumber.set(canonicalSceneNumber(sc.number), sc);
      }
      for (const ch of parsedData.characters) {
        charactersById.set(ch.id, ch);
        charactersByName.set(ch.name.trim().toUpperCase(), ch);
      }
      for (const lk of parsedData.looks) {
        looksById.set(lk.id, lk);
      }
    }

    const isEmpty =
      scenesByNumber.size === 0 &&
      Object.keys(breakdowns).length === 0;

    return {
      scenesByNumber,
      breakdownsByScene: breakdowns,
      charactersById,
      charactersByName,
      looksById,
      isEmpty,
    };
  }, [parsedData, breakdowns]);
}
