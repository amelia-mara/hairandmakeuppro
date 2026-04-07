import { extractTextFromPDF, extractTextFromFDX, normalizeScriptText } from './scriptParser-pdf';
import {
  NAME_SCAN_EXCLUSIONS,
  isSupportingArtistRole,
  normalizeCharacterName,
  extractCharactersFromActionLine,
  isCharacterCue,
  prescanCharacterIntros,
} from './scriptParser-character';
import {
  normalizeTimeOfDay,
  parseSceneHeadingLine,
  isTemporalPrefixMarker,
  extractTitleCardFromInterstitial,
} from './scriptParser-helpers';

/* ━━━ Types ━━━ */

export interface ParsedScript {
  title: string;
  scenes: ParsedScene[];
  characters: ParsedCharacter[];
  rawText: string;
}

export interface ParsedScene {
  sceneNumber: string;
  slugline: string;
  intExt: 'INT' | 'EXT';
  location: string;
  timeOfDay: 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS';
  characters: string[]; // Character names appearing in scene
  content: string;
  titleCardBefore?: string | null; // ALL-CAPS title card found before this scene's slug
}

export type CharacterCategory = 'principal' | 'supporting_artist';

export interface ParsedCharacter {
  name: string;
  normalizedName: string;
  category: CharacterCategory;
  sceneCount: number;
  dialogueCount: number;
  scenes: string[]; // Scene numbers where character appears
  variants: string[]; // Name variations found
}

/* ━━━ Main parser ━━━ */

export function parseScriptText(text: string): ParsedScript {
  const lines = text.split('\n');
  const scenes: ParsedScene[] = [];
  const characterMap = new Map<string, ParsedCharacter>();

  // Pre-scan: find full character names from introductions
  const nameResolveMap = prescanCharacterIntros(lines);

  /** Resolve a single-word character name to its full name if known */
  function resolveCharacterName(normalized: string): string {
    if (!normalized.includes(' ') && nameResolveMap.has(normalized)) {
      return nameResolveMap.get(normalized)!;
    }
    return normalized;
  }

  /** Register a character in the characterMap and current scene */
  function registerCharacter(rawName: string, resolved: string, scene: ParsedScene | null) {
    if (resolved.length < 2) return;

    if (scene && !scene.characters.includes(resolved)) {
      scene.characters.push(resolved);
    }

    if (!characterMap.has(resolved)) {
      characterMap.set(resolved, {
        name: resolved,
        normalizedName: resolved,
        category: 'principal',
        sceneCount: 0,
        dialogueCount: 0,
        scenes: [],
        variants: [],
      });
    }

    const char = characterMap.get(resolved)!;
    if (!char.variants.includes(rawName)) {
      char.variants.push(rawName);
    }
    if (scene && !char.scenes.includes(scene.sceneNumber)) {
      char.scenes.push(scene.sceneNumber);
      char.sceneCount++;
    }
  }

  let currentScene: ParsedScene | null = null;
  let fallbackSceneNumber = 0;
  let currentSceneContent = '';
  let preambleContent = ''; // Text before the first scene heading
  let lastLineWasCharacter = false;
  let dialogueCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const parsedHeading = parseSceneHeadingLine(trimmed);

    if (parsedHeading.isValid) {
      // If there's preamble text before the first scene, create a preamble scene
      if (!currentScene && preambleContent.trim()) {
        scenes.push({
          sceneNumber: '0',
          slugline: 'PREAMBLE',
          intExt: 'EXT',
          location: 'PREAMBLE',
          timeOfDay: 'DAY',
          characters: [],
          content: preambleContent.trim(),
        });
      }

      // Check the line immediately preceding this heading for a temporal marker.
      // Temporal markers (e.g. "FLASHBACK: 2 WEEKS AGO", "6 MONTHS LATER")
      // appear on the line directly before an INT./EXT. heading and describe
      // the FOLLOWING scene, not the preceding one.
      let titleCardBefore: string | null = null;
      if (currentScene) {
        const contentLines = currentSceneContent.split('\n');
        // Find last non-empty line in accumulated content
        let lastNonEmptyIdx = contentLines.length - 1;
        while (lastNonEmptyIdx >= 0 && !contentLines[lastNonEmptyIdx].trim()) {
          lastNonEmptyIdx--;
        }
        if (lastNonEmptyIdx >= 0) {
          const lastLine = contentLines[lastNonEmptyIdx].trim();
          if (isTemporalPrefixMarker(lastLine)) {
            titleCardBefore = lastLine;
            // Remove the marker from the previous scene's content
            contentLines.splice(lastNonEmptyIdx, 1);
            currentSceneContent = contentLines.join('\n');
          }
        }
        // Fall back to broader interstitial scan if no prefix marker found
        if (!titleCardBefore) {
          titleCardBefore = extractTitleCardFromInterstitial(currentSceneContent);
        }
        currentScene.content = currentSceneContent.trim();
        scenes.push(currentScene);
      } else if (preambleContent.trim()) {
        // Also check preamble for title cards before the first scene
        titleCardBefore = extractTitleCardFromInterstitial(preambleContent);
      }

      fallbackSceneNumber++;
      const sceneNum = parsedHeading.sceneNumber || String(fallbackSceneNumber);
      const normalizedTime = normalizeTimeOfDay(parsedHeading.timeOfDay);

      currentScene = {
        sceneNumber: sceneNum,
        slugline: trimmed,
        intExt: parsedHeading.intExt,
        location: parsedHeading.location,
        timeOfDay: normalizedTime,
        characters: [],
        content: '',
        titleCardBefore,
      };
      currentSceneContent = trimmed + '\n';
      lastLineWasCharacter = false;
      continue;
    }

    if (currentScene) {
      currentSceneContent += line + '\n';
    } else {
      // Accumulate text before the first scene heading
      preambleContent += line + '\n';
    }

    // Before treating a line as a dialogue cue, check if it's actually the
    // first half of a character introduction split across two lines by PDF
    // word-wrap.  e.g. "JASPER\nMONTGOMERY, 70, he looks like..."
    // Without this check, "JASPER" is consumed as a dialogue cue and the
    // next line ("MONTGOMERY, 70, ...") is treated as dialogue — so the
    // character introduction is completely missed.
    let isSplitCharacterIntro = false;
    if (
      isCharacterCue(trimmed) &&
      /^[A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+){0,2}$/.test(trimmed) &&
      i + 1 < lines.length
    ) {
      const nextTrimmed = lines[i + 1].trim();
      // Next line starts with ALL CAPS word(s) followed by age/comma → split intro
      if (/^[A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+){0,2}\s*(?:[,(]\s*\d{1,3}\b|\d{1,3}\s*[,)])/.test(nextTrimmed)) {
        isSplitCharacterIntro = true;
      }
    }

    if (!isSplitCharacterIntro && isCharacterCue(trimmed)) {
      const charName = trimmed;
      let normalized = normalizeCharacterName(charName);
      // Resolve single-name cues: "LENNON" → "LENNON BOWIE"
      normalized = resolveCharacterName(normalized);

      registerCharacter(charName, normalized, currentScene);
      lastLineWasCharacter = true;
      dialogueCount = 0;
    } else if (!isSplitCharacterIntro && lastLineWasCharacter && trimmed.length > 0) {
      dialogueCount++;
      if (dialogueCount > 3 || trimmed.length === 0) {
        lastLineWasCharacter = false;
      }
    } else {
      lastLineWasCharacter = false;

      if (currentScene && trimmed.length > 3) {
        // Try extracting characters from this line alone (only if long enough for patterns)
        let actionCharacters = trimmed.length > 10
          ? extractCharactersFromActionLine(trimmed)
          : [];

        // Cross-line detection: if this line ends with ALL CAPS word(s) (potential
        // split character name), combine with the next line and re-extract.
        // This catches "...on foot. JASPER\nMONTGOMERY, 70, ..." even when the
        // normalizeScriptText join regex didn't merge the lines.
        // Also handles short lines like just "JASPER" on its own line.
        if (/[A-Z][A-Z'-]{2,}\s*$/.test(trimmed) && i + 1 < lines.length) {
          const nextTrimmed = lines[i + 1].trim();
          if (nextTrimmed && nextTrimmed.length > 2) {
            const combinedCharacters = extractCharactersFromActionLine(trimmed + ' ' + nextTrimmed);
            // Merge: keep any names from the combined line that weren't in the single line
            for (const name of combinedCharacters) {
              if (!actionCharacters.includes(name)) {
                actionCharacters.push(name);
              }
            }
          }
        }

        for (const charName of actionCharacters) {
          let normalized = normalizeCharacterName(charName);
          // Resolve single-name action references: "Lennon" → "LENNON BOWIE"
          normalized = resolveCharacterName(normalized);
          registerCharacter(charName, normalized, currentScene);
        }
      }
    }
  }

  if (currentScene) {
    currentScene.content = currentSceneContent.trim();
    scenes.push(currentScene);
  }

  /* ── Post-processing safety net: scan each scene's raw content for character ──
     introductions that the line-by-line parser may have missed.
     Standard screenplay character introduction: ALL CAPS FULL NAME, age,
     e.g. "JASPER MONTGOMERY, 70, he looks like a grandpa"
     This catches intros that were:
     - Merged with scene headings (PDF extraction artifact)
     - Split across lines and not recombined
     - On lines incorrectly consumed as dialogue cues
     After finding names, also scan the ENTIRE raw text so that a character
     introduced in one scene is known globally for first-name resolution. */
  const introSafetyRe = /\b([A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+){1,3})(?:\s*[,(]\s*|\s+)\d{1,3}\b/g;
  const introExcludeFirstWord = new Set([
    'INT', 'EXT', 'CUT', 'FADE', 'SCENE', 'THE', 'AND', 'BUT', 'FOR', 'NOR',
    'YET', 'DAY', 'NIGHT', 'MORNING', 'EVENING', 'AFTERNOON',
    'DAWN', 'DUSK', 'CONTINUOUS', 'LATER', 'SAME', 'ANGLE', 'CLOSE',
    'WIDE', 'SHOT', 'FADE', 'TITLE', 'SUPER', 'CHAPTER', 'EPISODE',
  ]);

  // Helper: scan text for character intros, handling greedy match backtracking.
  // When a match like "DAY JASPER MONTGOMERY, 70" is excluded (first word "DAY"),
  // retry from after the excluded word so "JASPER MONTGOMERY, 70" can still match.
  function scanForIntroductions(source: string, re: RegExp): string[] {
    const results: string[] = [];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(source)) !== null) {
      const name = m[1].trim();
      const words = name.split(/\s+/);
      const firstWord = words[0];
      if (name.length >= 5 && !introExcludeFirstWord.has(firstWord) && !isSupportingArtistRole(name)) {
        results.push(name);
      } else if (words.length > 1 && introExcludeFirstWord.has(firstWord)) {
        // Greedy match consumed a good name after an excluded word — retry
        // from just after the excluded word so the shorter match can succeed
        re.lastIndex = m.index + firstWord.length + 1;
      }
    }
    return results;
  }

  // First pass: collect all full names from the entire raw text
  const safetyFullNames = scanForIntroductions(text, introSafetyRe);

  // Build a first-name → full-name map from safety-net names
  // (supplements the prescan resolveMap for first-name mentions later)
  const safetyResolve = new Map<string, string>();
  for (const fullName of safetyFullNames) {
    const parts = fullName.split(/\s+/);
    for (const part of parts) {
      if (part.length < 3 || NAME_SCAN_EXCLUSIONS.has(part)) continue;
      if (!safetyResolve.has(part)) {
        safetyResolve.set(part, fullName);
      } else if (safetyResolve.get(part) !== fullName) {
        safetyResolve.set(part, ''); // ambiguous
      }
    }
  }
  for (const [k, v] of safetyResolve) {
    if (v === '') safetyResolve.delete(k);
  }

  // Second pass: for each scene, find character intros in scene.content
  for (const scene of scenes) {
    const sceneNames = scanForIntroductions(scene.content, introSafetyRe);
    for (const name of sceneNames) {
      const normalized = normalizeCharacterName(name);
      registerCharacter(name, normalized, scene);
    }
  }

  // Also resolve first-name-only mentions using the safety-net map.
  // If a character was registered as just "JASPER" but the safety net found
  // "JASPER MONTGOMERY", merge them.
  for (const [fragment, fullName] of safetyResolve) {
    if (characterMap.has(fragment) && !characterMap.has(fullName)) {
      // The full name wasn't registered yet but a fragment was — register the full name
      // and transfer the fragment's scenes
      const fragChar = characterMap.get(fragment)!;
      for (const sceneNum of fragChar.scenes) {
        const scene = scenes.find(s => s.sceneNumber === sceneNum);
        if (scene) registerCharacter(fragment, fullName, scene);
      }
    }
  }

  /* ── Deduplication safety net: merge any remaining single-name fragments ──
     If the pre-scan missed an intro but a full name was detected during parsing,
     merge fragments that match exactly one full-name parent. */
  const fullNames = Array.from(characterMap.keys()).filter(k => k.includes(' '));
  const singleNames = Array.from(characterMap.keys()).filter(k => !k.includes(' ') && k.length >= 3);
  const fragmentsToRemove = new Set<string>();

  for (const fragment of singleNames) {
    const parents = fullNames.filter(fn => fn.split(/\s+/).includes(fragment));
    if (parents.length === 1) {
      const parentName = parents[0];
      const fragChar = characterMap.get(fragment)!;
      const parentChar = characterMap.get(parentName)!;

      for (const sceneNum of fragChar.scenes) {
        if (!parentChar.scenes.includes(sceneNum)) {
          parentChar.scenes.push(sceneNum);
          parentChar.sceneCount++;
        }
      }
      for (const v of fragChar.variants) {
        if (!parentChar.variants.includes(v)) parentChar.variants.push(v);
      }
      for (const scene of scenes) {
        const idx = scene.characters.indexOf(fragment);
        if (idx !== -1) {
          scene.characters.splice(idx, 1);
          if (!scene.characters.includes(parentName)) {
            scene.characters.push(parentName);
          }
        }
      }
      fragmentsToRemove.add(fragment);
    }
  }

  for (const key of fragmentsToRemove) {
    characterMap.delete(key);
  }

  // Deduplicate scene character lists
  for (const scene of scenes) {
    scene.characters = [...new Set(scene.characters)];
  }

  /* ── Location-based false positive removal ──
     Reject any "character" whose name matches a location extracted from a scene
     heading. This catches false positives like "FARM LAND", "STREET CORNER",
     "OFFICE BUILDING" that get picked up by the catch-all intro patterns.
     Only applies to multi-word names — single-word names like "LENNON" are
     never locations (locations are always multi-segment in scene headings). */
  const sceneLocations = new Set<string>();
  for (const scene of scenes) {
    const loc = scene.location.toUpperCase().trim();
    if (loc && loc !== 'PREAMBLE') {
      sceneLocations.add(loc);
      // Also add individual segments for compound locations:
      // "FARMHOUSE - KITCHEN" → "FARMHOUSE", "KITCHEN", "FARMHOUSE - KITCHEN"
      for (const segment of loc.split(/\s*[-–—\/]\s*/)) {
        const seg = segment.trim();
        if (seg.length >= 3) sceneLocations.add(seg);
      }
    }
  }

  const locationFalsePositives = new Set<string>();
  for (const [name] of characterMap) {
    // Only check multi-word names (single words like "LENNON" are never locations)
    if (!name.includes(' ')) continue;
    if (sceneLocations.has(name)) {
      locationFalsePositives.add(name);
    }
  }

  for (const name of locationFalsePositives) {
    characterMap.delete(name);
    for (const scene of scenes) {
      const idx = scene.characters.indexOf(name);
      if (idx !== -1) scene.characters.splice(idx, 1);
    }
  }

  const characters = Array.from(characterMap.values())
    .filter(c => c.sceneCount >= 1)
    .sort((a, b) => b.sceneCount - a.sceneCount);

  characters.forEach(char => {
    char.dialogueCount = char.variants.length;
  });

  /* NOTE: We intentionally do NOT do a broad "name-mention scan" of scene content.
     Characters are only associated with a scene if they have a dialogue cue or
     are detected in an action line (intro pattern or Title Case + action verb).
     A character merely *mentioned* in dialogue ("Told Dedra to pack her bags")
     is NOT physically present in the scene — for hair & makeup departments,
     only physically present characters matter. The pre-scan + main parse +
     dedup safety net above handle detection accurately. */

  const titleMatch = text.slice(0, 1000).match(/^(?:title[:\s]*)?([A-Z][A-Z\s\d\-\'\"]+)(?:\n|by)/im);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Script';

  /* ── Validation: check for dropped scenes ──
     Independently count all lines that look like scene headings and compare
     to the number of ParsedScene objects produced. If they differ, some
     headings were not recognised by parseSceneHeadingLine — log a warning
     with the specific missing scene numbers so they can be investigated. */
  const headingRe = /^(\d+[A-Z]{0,4}\s+)?(INT\.?|EXT\.?|INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?)\s/i;
  const detectedHeadings: Array<{ lineNum: number; text: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (headingRe.test(t) && t.length >= 5) {
      detectedHeadings.push({ lineNum: i + 1, text: t });
    }
  }

  // Filter out PREAMBLE scene from comparison
  const outputScenes = scenes.filter(s => s.location !== 'PREAMBLE');
  if (detectedHeadings.length !== outputScenes.length) {
    const outputSlugs = new Set(outputScenes.map(s => s.slugline));
    const missing = detectedHeadings.filter(h => !outputSlugs.has(h.text));
    if (missing.length > 0) {
      console.warn(
        `[scriptParser] Scene count mismatch: ${detectedHeadings.length} headings detected, ` +
        `${outputScenes.length} scenes produced. Missing headings:\n` +
        missing.map(m => `  Line ${m.lineNum}: ${m.text}`).join('\n')
      );
    }
  }

  return { title, scenes, characters, rawText: text };
}

/* ━━━ Public API: parse a script file ━━━ */

export async function parseScriptFile(
  file: File,
  onProgress?: (status: string) => void,
): Promise<ParsedScript> {
  const fileName = file.name.toLowerCase();
  let text: string;

  onProgress?.('Reading document...');

  if (fileName.endsWith('.pdf')) {
    text = await extractTextFromPDF(file);
    // PDF path already normalizes via extractTextFromPDF → normalizeScriptText
  } else if (fileName.endsWith('.fdx')) {
    const xmlContent = await file.text();
    text = normalizeScriptText(extractTextFromFDX(xmlContent));
  } else {
    text = normalizeScriptText(await file.text());
  }

  onProgress?.('Parsing script format...');
  return parseScriptText(text);
}

