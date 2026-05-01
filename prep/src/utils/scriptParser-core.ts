import { extractTextFromPDF, extractTextFromFDX, normalizeScriptText } from './scriptParser-pdf';
import {
  NAME_SCAN_EXCLUSIONS,
  NON_CHARACTER_SINGLE_WORDS,
  isSupportingArtistRole,
  normalizeCharacterName,
  prescanCharacterIntros,
  extractCueLines,
  extractBackgroundFromAction,
  variantKey,
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
  characters: string[]; // Speaking character names found via dialogue cues
  content: string;
  titleCardBefore?: string | null; // ALL-CAPS title card found before this scene's slug
  /** Set when the script marks a scene as removed in this revision
   *  (e.g. "12. OMITTED"). The placeholder is preserved in the scene
   *  list so numbering stays coherent — production crews need to know
   *  scene 12 used to exist even if it's gone now. */
  isOmitted?: boolean;
  /** Non-speaking presence labels found in this scene's action text
   *  ("PASSER BY", "ELDERLY PATIENT"). Listed on the scene only;
   *  never become tracked Character profiles. */
  backgroundCharacters?: string[];
  /** Free-text notes shown alongside the background list. */
  backgroundNotes?: string;
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

  // Line ranges per scene index — used after the walk to bucket cue
  // hits into the scene whose [head, end) range contains them.
  // Indexes are line numbers in the source `lines` array. Omitted-scene
  // placeholders are not added (they're a single-line stub and have no
  // characters by definition).
  const sceneLineRanges: Array<{ head: number; endExclusive: number }> = [];
  let currentSceneHeadLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Omitted scene placeholder ──────────────────────────────
    // Scripts mark deleted scenes with a stub line that retains the
    // scene number. Common formats — all detected here — are:
    //
    //   "12. OMITTED"     "12 OMITTED."     "OMITTED."
    //   "12A. OMITTED."   "SCENE 12 OMITTED."
    //   "98 OMITTED 98"   ← number at BOTH ends (revision pages)
    //   "30 OMITTED 30."
    //
    // We emit a ParsedScene with isOmitted:true so the scene list
    // keeps numbering coherent (29, 30, 31 with 30 marked omitted)
    // and store the verbatim trimmed line in `content` so the
    // script viewer can render it exactly as it appears in the PDF.
    const omittedMatch = trimmed.match(
      /^(?:SCENE\s+)?(\d+[A-Z]{0,4})?\s*[\.\-:]?\s*OMITTED\.?\s*(?:\d+[A-Z]{0,4})?\.?\s*$/i,
    );
    if (omittedMatch) {
      // Close out the current scene first.
      if (currentScene) {
        currentScene.content = currentSceneContent.trim();
        scenes.push(currentScene);
        sceneLineRanges.push({ head: currentSceneHeadLine, endExclusive: i });
        currentScene = null;
        currentSceneContent = '';
        currentSceneHeadLine = -1;
      }
      fallbackSceneNumber++;
      const sceneNum = (omittedMatch[1] || String(fallbackSceneNumber)).toUpperCase();
      scenes.push({
        sceneNumber: sceneNum,
        slugline: trimmed,
        intExt: 'INT',
        location: 'OMITTED',
        timeOfDay: 'DAY',
        characters: [],
        // Preserve the verbatim line so ScriptView can render the
        // exact text from the PDF rather than a synthesised label.
        content: trimmed,
        isOmitted: true,
      });
      // Empty range — omitted scenes have no characters.
      sceneLineRanges.push({ head: i, endExclusive: i });
      continue;
    }

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
        // Empty range — preamble doesn't have dialogue cues.
        sceneLineRanges.push({ head: 0, endExclusive: 0 });
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
        sceneLineRanges.push({ head: currentSceneHeadLine, endExclusive: i });
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
      currentSceneHeadLine = i;
      continue;
    }

    if (currentScene) {
      currentSceneContent += line + '\n';
    } else {
      // Accumulate text before the first scene heading
      preambleContent += line + '\n';
    }
  }

  if (currentScene) {
    currentScene.content = currentSceneContent.trim();
    scenes.push(currentScene);
    sceneLineRanges.push({
      head: currentSceneHeadLine,
      endExclusive: lines.length,
    });
  }

  /* ── Strict cue extraction ────────────────────────────────────────
   * Extract every dialogue cue from the whole script in a single pass.
   * `extractCueLines` enforces: ALL-CAPS short line + next non-blank
   * line is dialogue + script-level indent cluster check. False
   * positives like centred title cards ("ELEVEN MISSING DAYS",
   * "LIBRARY") and action-line intros ("JASPER MONTGOMERY, 70") are
   * filtered out. Cues are bucketed into scenes by line index.
   *
   * Names are resolved through `prescanCharacterIntros` so a cue
   * "LENNON" merges with an introduction "LENNON BOWIE, 28" found
   * earlier in the script.
   */
  const cues = extractCueLines(lines);
  for (const cue of cues) {
    const sceneIdx = sceneLineRanges.findIndex(
      (r) => cue.lineIndex >= r.head && cue.lineIndex < r.endExclusive,
    );
    if (sceneIdx < 0) continue;
    const scene = scenes[sceneIdx];
    if (!scene || scene.isOmitted) continue;

    // Drop one-off generic supporting-artist labels (MAN, COP, NURSE)
    // — they live in `backgroundCharacters` instead, not as profiles.
    if (isSupportingArtistRole(cue.name)) continue;

    let canonical = resolveCharacterName(cue.name);
    canonical = variantKey(canonical);
    registerCharacter(cue.raw, canonical, scene);
  }

  /* ── Pass 2: known-name scan ─────────────────────────────────────
   * Pick up speakers who are named in a scene's text but don't have
   * a dialogue cue there. Bounded to canonical names already
   * validated as real speakers via cue extraction, so it can't
   * introduce new false positives. Matches Title Case OR ALL CAPS
   * forms (word-bounded) — never lowercase, so a character named
   * "Will" won't match the modal verb "will". */
  const charScanPatterns: Array<{ key: string; re: RegExp }> = [];
  for (const ch of characterMap.values()) {
    const terms = new Set<string>();
    terms.add(ch.normalizedName);
    for (const v of ch.variants) terms.add(normalizeCharacterName(v));
    const safe = [...terms].filter((t) => t.length >= 3 && /^[A-Z][A-Z'\- ]*$/.test(t));
    if (safe.length === 0) continue;
    const alts = new Set<string>();
    for (const t of safe) {
      alts.add(t);
      alts.add(prepToTitleCase(t));
    }
    const escaped = [...alts].map(prepEscapeRegExp).join('|');
    charScanPatterns.push({
      key: ch.normalizedName,
      re: new RegExp(`\\b(?:${escaped})\\b`),
    });
  }
  for (const scene of scenes) {
    if (scene.isOmitted) continue;
    const have = new Set(scene.characters);
    for (const { key, re } of charScanPatterns) {
      if (have.has(key)) continue;
      if (re.test(scene.content)) {
        registerCharacter(key, key, scene);
        have.add(key);
      }
    }
  }

  /* ── Per-scene background extraction ─────────────────────────────── */
  const knownSpeakerSet = new Set<string>();
  for (const ch of characterMap.values()) {
    knownSpeakerSet.add(ch.name);
    knownSpeakerSet.add(ch.normalizedName);
    for (const v of ch.variants) {
      knownSpeakerSet.add(normalizeCharacterName(v));
    }
  }

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (scene.isOmitted) continue;
    const range = sceneLineRanges[i];
    if (!range || range.head < 0) continue;

    // Walk this scene's lines and accumulate action-only text (skip
    // cue lines and the dialogue runs that follow them).
    const cueLineSet = new Set(
      cues
        .filter((c) => c.lineIndex >= range.head && c.lineIndex < range.endExclusive)
        .map((c) => c.lineIndex),
    );
    const actionLines: string[] = [];
    let inDialogue = false;
    for (let j = range.head; j < range.endExclusive; j++) {
      const t = lines[j].trim();
      if (cueLineSet.has(j)) {
        inDialogue = true;
        continue;
      }
      if (inDialogue) {
        if (/^\(.*\)$/.test(t)) continue;
        if (!t) {
          inDialogue = false;
          continue;
        }
        if (/[a-z]/.test(t)) {
          inDialogue = false;
          actionLines.push(t);
        }
        continue;
      }
      if (!t) continue;
      actionLines.push(t);
    }
    scene.backgroundCharacters = extractBackgroundFromAction(
      actionLines.join(' '),
      knownSpeakerSet,
    );
  }

  /* ── Common-noun false-positive filter ──
     Keep the existing belt-and-braces filter. With cues now structurally
     validated this rarely fires, but it's cheap insurance against any
     edge case where a transition / sound word slipped through. */
  const commonNounFalsePositives = new Set<string>();
  for (const [name] of characterMap) {
    const words = name.split(/\s+/).filter((w) => !/^\d+$/.test(w));
    if (words.length === 0) {
      commonNounFalsePositives.add(name);
      continue;
    }
    if (NON_CHARACTER_SINGLE_WORDS.has(words[0])) {
      commonNounFalsePositives.add(name);
      continue;
    }
    if (words.every((w) => NON_CHARACTER_SINGLE_WORDS.has(w))) {
      commonNounFalsePositives.add(name);
    }
  }
  for (const name of commonNounFalsePositives) {
    characterMap.delete(name);
    for (const scene of scenes) {
      const idx = scene.characters.indexOf(name);
      if (idx !== -1) scene.characters.splice(idx, 1);
    }
  }

  // Suppress "unused" warnings for legacy helpers that may still be
  // used by future revisions or by other utilities. NAME_SCAN_EXCLUSIONS
  // is referenced indirectly through prescanCharacterIntros' name map.
  void NAME_SCAN_EXCLUSIONS;

  const characters = Array.from(characterMap.values())
    .filter((c) => c.sceneCount >= 1)
    .sort((a, b) => b.sceneCount - a.sceneCount);

  characters.forEach((char) => {
    char.dialogueCount = char.variants.length;
  });

  // Deduplicate scene character lists (defensive — should already be unique).
  for (const scene of scenes) {
    scene.characters = [...new Set(scene.characters)];
  }

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

  /* ── Per-scene content-length sanity check ──
     Flag any scene whose body text is unusually short relative to the
     median scene size. This is the strongest signal we have that the
     parser dropped the middle of a scene — e.g. PDF extraction missed
     part of a page, or a downstream regex over-matched and ate text
     before the next heading. Logs the affected scene numbers + slugs
     so the issue can be reproduced from the console output rather
     than guessed at from a screenshot. */
  const realScenes = outputScenes.filter((s) => s.content.length > 0);
  if (realScenes.length >= 5) {
    const lengths = realScenes.map((s) => s.content.length).sort((a, b) => a - b);
    const median = lengths[Math.floor(lengths.length / 2)];
    const threshold = Math.max(80, Math.floor(median * 0.15));
    const stubby = realScenes
      .filter((s) => s.content.length < threshold)
      .slice(0, 10);
    if (stubby.length > 0) {
      console.warn(
        `[scriptParser] ${stubby.length} scene(s) have unusually short content ` +
        `(< ${threshold} chars vs median ${median}). This often means the parser ` +
        `dropped part of the scene. Affected scenes:\n` +
        stubby.map((s) => `  Sc ${s.sceneNumber} · ${s.slugline} · ${s.content.length} chars`).join('\n')
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


function prepEscapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "BRY" -> "Bry", "YOUNG BRY" -> "Young Bry". Used by the pass-2
 *  known-name scan to match the Title Case form character names
 *  typically take in action lines. */
function prepToTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((part) => (part && /^[a-z]/.test(part) ? part[0].toUpperCase() + part.slice(1) : part))
    .join('');
}
