import type { Scene, Character } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { extractTextFromPDF, extractTextFromFDX } from './scriptParser-pdf';
import {
  normalizeCharacterName,
  variantKey,
  extractCueLines,
  extractBackgroundFromAction,
} from './scriptParser-character';
import {
  normalizeTimeOfDayForScene,
  parseSceneHeadingLine,
} from './scriptParser-helpers';

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
  characters: string[]; // Speaking character names (canonical, uppercase)
  /** Non-speaking presence labels found in the scene's action paragraphs. */
  backgroundCharacters?: string[];
  /** Free-text notes for the breakdown background row. */
  backgroundNotes?: string;
  content: string;
  synopsis?: string;
}

export interface ParsedCharacter {
  name: string;
  normalizedName: string;
  sceneCount: number;
  dialogueCount: number;
  scenes: string[]; // Scene numbers where character appears
  variants: string[]; // Name variations found (e.g., "JOHN", "JOHN (V.O.)")
  description?: string;
}

// Fast-parsed scene interface (no characters, just scene structure)
export interface FastParsedScene {
  sceneNumber: string;
  slugline: string;
  intExt: 'INT' | 'EXT';
  location: string;
  timeOfDay: 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS';
  scriptContent: string;
  // Characters NOT included - detected later
}

// Result of fast scene parsing
export interface FastParsedScript {
  title: string;
  scenes: FastParsedScene[];
  rawText: string;
}

/**
 * Parse script text to extract scenes and characters.
 *
 * Two-pass approach:
 *   1. Walk lines to identify scene boundaries and capture each scene's
 *      raw content range (line indexes).
 *   2. Run the structural cue extractor across the whole script, then
 *      assign each cue to the scene whose line range it falls in. A
 *      character is in a scene iff their cue fires inside that scene.
 *
 * Per-scene background labels are extracted from action paragraphs only —
 * they do not become tracked Character profiles.
 */
export function parseScriptText(text: string): ParsedScript {
  const lines = text.split('\n');

  // ── Pass 1 — scene boundaries ─────────────────────────────────────
  type SceneBuild = ParsedScene & { headLine: number; endLineExclusive: number };
  const builds: SceneBuild[] = [];
  let fallbackSceneNumber = 0;
  let current: SceneBuild | null = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const heading = parseSceneHeadingLine(trimmed);
    if (heading.isValid) {
      if (current) {
        current.endLineExclusive = i;
        current.content = lines.slice(current.headLine, i).join('\n').trim();
        builds.push(current);
      }
      fallbackSceneNumber++;
      const sceneNum = heading.sceneNumber || String(fallbackSceneNumber);
      current = {
        sceneNumber: sceneNum,
        slugline: trimmed,
        intExt: heading.intExt,
        location: heading.location,
        timeOfDay: normalizeTimeOfDayForScene(heading.timeOfDay),
        characters: [],
        backgroundCharacters: [],
        backgroundNotes: '',
        content: '',
        headLine: i,
        endLineExclusive: lines.length,
      };
    }
  }
  if (current) {
    current.endLineExclusive = lines.length;
    current.content = lines.slice(current.headLine).join('\n').trim();
    builds.push(current);
  }

  // ── Pass 2 — cue extraction (whole script in one go) ──────────────
  const cues = extractCueLines(lines);
  const characterMap = new Map<string, ParsedCharacter>();

  // Bucket cues into scenes by line index. Cues outside any scene
  // (e.g. before the first slugline) are dropped.
  const cuesPerScene: Map<number, typeof cues> = new Map();
  for (const cue of cues) {
    const sceneIdx = builds.findIndex(
      (s) => cue.lineIndex >= s.headLine && cue.lineIndex < s.endLineExclusive,
    );
    if (sceneIdx < 0) continue;
    if (!cuesPerScene.has(sceneIdx)) cuesPerScene.set(sceneIdx, []);
    cuesPerScene.get(sceneIdx)!.push(cue);

    // Build the speaker map keyed by canonical name so age variants
    // (BRY / YOUNG BRY) merge into one tracked character.
    const key = variantKey(cue.name);
    let entry = characterMap.get(key);
    if (!entry) {
      entry = {
        name: cue.name,
        normalizedName: key,
        sceneCount: 0,
        dialogueCount: 0,
        scenes: [],
        variants: [],
      };
      characterMap.set(key, entry);
    }
    if (!entry.variants.includes(cue.name)) entry.variants.push(cue.name);
    entry.dialogueCount++;
    const sceneNum = builds[sceneIdx].sceneNumber;
    if (!entry.scenes.includes(sceneNum)) {
      entry.scenes.push(sceneNum);
      entry.sceneCount++;
    }
  }

  // Build per-scene speaking character lists from their cues only.
  // No substring propagation — cues are the sole signal for membership.
  const knownSpeakerSet = new Set<string>();
  for (const ch of characterMap.values()) {
    knownSpeakerSet.add(ch.name);
    knownSpeakerSet.add(ch.normalizedName);
    for (const v of ch.variants) knownSpeakerSet.add(normalizeCharacterName(v));
  }

  // Pass 2 prep: build a per-character regex that matches the
  // canonical name OR any of its variants, word-bounded, in Title
  // Case or ALL CAPS form. Lowercase-only matches are intentionally
  // skipped — character names in action lines are virtually always
  // capitalised, and matching lowercase would false-positive on
  // common English words for character names like "Will" / "May" /
  // "Hope" (the modal verb / month / noun).
  const charScanPatterns: Array<{ key: string; re: RegExp }> = [];
  for (const ch of characterMap.values()) {
    const terms = new Set<string>();
    terms.add(ch.normalizedName);
    for (const v of ch.variants) terms.add(normalizeCharacterName(v));
    // Drop very short names (< 3 chars) and any with non-letter chars
    // beyond apostrophe/hyphen/space — too risky for fuzzy matching.
    const safe = [...terms].filter((t) => t.length >= 3 && /^[A-Z][A-Z'\- ]*$/.test(t));
    if (safe.length === 0) continue;
    const alts = new Set<string>();
    for (const t of safe) {
      alts.add(t);
      alts.add(toTitleCase(t));
    }
    const escaped = [...alts].map(escapeRegExp).join('|');
    charScanPatterns.push({
      key: ch.normalizedName,
      re: new RegExp(`\\b(?:${escaped})\\b`),
    });
  }

  for (let i = 0; i < builds.length; i++) {
    const scene = builds[i];
    const sceneCues = cuesPerScene.get(i) || [];
    const seen = new Set<string>();
    for (const c of sceneCues) {
      const key = variantKey(c.name);
      if (seen.has(key)) continue;
      seen.add(key);
      // Use the canonical key as the per-scene character name so that
      // BRY and YOUNG BRY don't both appear on one scene.
      scene.characters.push(key);
    }

    // Pass 2: known-name scan. Pick up any speaker who is named in
    // this scene's content but doesn't have a dialogue cue here —
    // typically wordless scenes that only describe the character in
    // action ("Young Bry stands on the bridge"). Bounded to names
    // already validated as real speakers via cue extraction, so it
    // can't introduce new false positives.
    for (const { key, re } of charScanPatterns) {
      if (seen.has(key)) continue;
      if (re.test(scene.content)) {
        seen.add(key);
        scene.characters.push(key);
        const ch = characterMap.get(key);
        if (ch && !ch.scenes.includes(scene.sceneNumber)) {
          ch.scenes.push(scene.sceneNumber);
          ch.sceneCount++;
        }
      }
    }

    // Background extraction: action lines only — strip cue lines and the
    // dialogue runs that follow them, keep the rest.
    scene.backgroundCharacters = extractSceneBackground(
      lines,
      scene.headLine,
      scene.endLineExclusive,
      sceneCues.map((c) => c.lineIndex),
      knownSpeakerSet,
    );
  }

  // Strip the helper line-index fields before returning.
  const scenes: ParsedScene[] = builds.map((b) => ({
    sceneNumber: b.sceneNumber,
    slugline: b.slugline,
    intExt: b.intExt,
    location: b.location,
    timeOfDay: b.timeOfDay,
    characters: b.characters,
    backgroundCharacters: b.backgroundCharacters,
    backgroundNotes: b.backgroundNotes,
    content: b.content,
    synopsis: b.synopsis,
  }));

  // Sort speakers by scene count desc.
  const characters = Array.from(characterMap.values()).sort(
    (a, b) => b.sceneCount - a.sceneCount,
  );

  // Title from the start of the script.
  const titleMatch = text
    .slice(0, 1000)
    .match(/^(?:title[:\s]*)?([A-Z][A-Z\s\d\-\'\"]+)(?:\n|by)/im);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Script';

  return { title, scenes, characters, rawText: text };
}

/**
 * Slice action lines out of a scene (everything that's not a cue and not
 * the dialogue immediately following a cue) and run background detection
 * on the joined text.
 */
function extractSceneBackground(
  lines: string[],
  startLine: number,
  endLineExclusive: number,
  cueLineIndexes: number[],
  knownSpeakers: Set<string>,
): string[] {
  const cueSet = new Set(cueLineIndexes);
  const actionLines: string[] = [];
  let inDialogue = false;
  let blanksSinceDialogue = 0;

  for (let i = startLine; i < endLineExclusive; i++) {
    const t = lines[i].trim();
    if (cueSet.has(i)) {
      inDialogue = true;
      blanksSinceDialogue = 0;
      continue;
    }
    if (inDialogue) {
      // Parenthetical-only stays in dialogue mode.
      if (/^\(.*\)$/.test(t)) continue;
      // Blank line: one blank stays in dialogue, two ends it.
      if (!t) {
        blanksSinceDialogue++;
        if (blanksSinceDialogue >= 1) inDialogue = false;
        continue;
      }
      // Non-blank line — heuristic: short uppercase-y indented lines look
      // like dialogue continuation. If we hit a clearly action-shaped line
      // (sentence with lowercase letters), it's action again.
      if (/[a-z]/.test(t)) {
        inDialogue = false;
        actionLines.push(t);
      }
      continue;
    }
    if (!t) continue;
    actionLines.push(t);
  }

  return extractBackgroundFromAction(actionLines.join(' '), knownSpeakers);
}

/**
 * Parse a script file (PDF, FDX, or plain text/fountain).
 *
 * Regex-only — character extraction is deterministic and runs entirely
 * locally.
 */
export async function parseScriptFile(
  file: File,
  options: {
    onProgress?: (status: string) => void;
  } = {}
): Promise<ParsedScript> {
  const { onProgress } = options;
  const fileName = file.name.toLowerCase();
  let text: string;

  onProgress?.('Reading document...');

  if (fileName.endsWith('.pdf')) {
    text = await extractTextFromPDF(file);
  } else if (fileName.endsWith('.fdx')) {
    const xmlContent = await file.text();
    text = extractTextFromFDX(xmlContent);
  } else {
    text = await file.text();
  }

  onProgress?.('Parsing script format...');
  return parseScriptText(text);
}

/**
 * Convert parsed script to project scenes and characters
 */
export function convertParsedScriptToProject(
  parsed: ParsedScript,
  selectedCharacters: string[] // Characters the user selected to track
): { scenes: Scene[]; characters: Character[] } {
  // Create character ID mapping
  const charIdMap = new Map<string, string>();
  const characters: Character[] = selectedCharacters.map((name, index) => {
    const id = uuidv4();
    charIdMap.set(name, id);

    // Generate initials
    const initials = name
      .split(' ')
      .map(w => w[0])
      .join('')
      .slice(0, 2);

    // Generate color
    const colors = ['#D4943A', '#E8621A', '#F0882A', '#4ABFB0', '#F5A623', '#5A3E28', '#F2C4A0', '#C4522A'];
    const avatarColour = colors[index % colors.length];

    return {
      id,
      name,
      initials,
      avatarColour,
    };
  });

  // Convert scenes — deduplicate scene numbers so they satisfy the
  // UNIQUE(project_id, scene_number) constraint in Supabase.
  const seenSceneNumbers = new Map<string, number>();
  const scenes: Scene[] = parsed.scenes.map((ps) => {
    // Map character names to IDs for this scene
    const sceneCharIds = ps.characters
      .filter(charName => charIdMap.has(charName))
      .map(charName => charIdMap.get(charName)!);

    // Deduplicate: "45" stays "45", second "45" becomes "45-2", etc.
    let sceneNum = ps.sceneNumber;
    const count = (seenSceneNumbers.get(sceneNum) || 0) + 1;
    seenSceneNumbers.set(sceneNum, count);
    if (count > 1) {
      sceneNum = `${sceneNum}-${count}`;
    }

    return {
      id: uuidv4(),
      sceneNumber: sceneNum,
      slugline: `${ps.intExt}. ${ps.location} - ${ps.timeOfDay}`,
      intExt: ps.intExt,
      timeOfDay: ps.timeOfDay,
      synopsis: ps.synopsis,
      scriptContent: ps.content,
      characters: sceneCharIds,
      backgroundCharacters: ps.backgroundCharacters,
      backgroundNotes: ps.backgroundNotes,
      isComplete: false,
    };
  });

  return { scenes, characters };
}

/**
 * Suggest character merges based on name similarity
 */
export function suggestCharacterMerges(characters: ParsedCharacter[]): Array<{
  primary: string;
  similar: string[];
}> {
  const suggestions: Array<{ primary: string; similar: string[] }> = [];
  const processed = new Set<string>();

  for (const char of characters) {
    if (processed.has(char.name)) continue;

    const similar: string[] = [];

    for (const other of characters) {
      if (other.name === char.name) continue;
      if (processed.has(other.name)) continue;

      // Check if names are similar
      const name1 = char.name.toLowerCase();
      const name2 = other.name.toLowerCase();

      // Check if one contains the other
      if (name1.includes(name2) || name2.includes(name1)) {
        similar.push(other.name);
      }
      // Check if first names match
      else if (name1.split(' ')[0] === name2.split(' ')[0] && name1.split(' ')[0].length > 2) {
        similar.push(other.name);
      }
    }

    if (similar.length > 0) {
      suggestions.push({
        primary: char.name,
        similar,
      });
      similar.forEach(s => processed.add(s));
    }

    processed.add(char.name);
  }

  return suggestions;
}

/**
 * Fast scene parsing - extracts ONLY scene structure without character detection
 * This is designed to complete in under 30 seconds for any script size
 * Uses regex only (no AI) for maximum speed
 */
export async function parseScenesFast(file: File): Promise<FastParsedScript> {
  const fileName = file.name.toLowerCase();
  let text: string;

  // Extract text based on file type
  if (fileName.endsWith('.pdf')) {
    text = await extractTextFromPDF(file);
  } else if (fileName.endsWith('.fdx')) {
    const xmlContent = await file.text();
    text = extractTextFromFDX(xmlContent);
  } else {
    text = await file.text();
  }

  // Parse scenes using regex only (fast path)
  const lines = text.split('\n');
  const scenes: FastParsedScene[] = [];

  let currentScene: FastParsedScene | null = null;
  let fallbackSceneNumber = 0;
  let currentSceneContent = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for scene heading using the existing robust parser
    const parsedHeading = parseSceneHeadingLine(trimmed);

    if (parsedHeading.isValid) {
      // Save previous scene
      if (currentScene) {
        currentScene.scriptContent = currentSceneContent.trim();
        scenes.push(currentScene);
      }

      // Use scene number from script, or fall back to sequential
      fallbackSceneNumber++;
      const sceneNum = parsedHeading.sceneNumber || String(fallbackSceneNumber);

      // Normalize time of day to our expected types
      const normalizedTime = normalizeTimeOfDayForScene(parsedHeading.timeOfDay);

      currentScene = {
        sceneNumber: sceneNum,
        slugline: trimmed,
        intExt: parsedHeading.intExt,
        location: parsedHeading.location,
        timeOfDay: normalizedTime,
        scriptContent: '',
      };
      currentSceneContent = trimmed + '\n';
      continue;
    }

    // Add to current scene content
    if (currentScene) {
      currentSceneContent += line + '\n';
    }
  }

  // Save last scene
  if (currentScene) {
    currentScene.scriptContent = currentSceneContent.trim();
    scenes.push(currentScene);
  }

  // Try to extract title from the beginning of the script
  const titleMatch = text.slice(0, 1000).match(/^(?:title[:\s]*)?([A-Z][A-Z\s\d\-\'\"]+)(?:\n|by)/im);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Script';

  return {
    title,
    scenes,
    rawText: text,
  };
}

/**
 * Detect characters appearing in a single scene's script content.
 *
 * Regex-only — runs the structural cue extractor on the scene's lines.
 * When `knownCharacters` is supplied (e.g. from the call sheet) those
 * names are matched against the scene's cue lines and action text by
 * word boundary, providing a deterministic schedule cross-reference.
 *
 * @returns Canonical character names found in this scene.
 */
export async function detectCharactersForScene(
  sceneContent: string,
  _rawText: string,
  options?: { knownCharacters?: string[] }
): Promise<string[]> {
  const knownCharacters = options?.knownCharacters ?? [];
  const characters: string[] = [];
  const characterSet = new Set<string>();

  // 1) Strict cue extraction across this scene only.
  const lines = sceneContent.split('\n');
  const cues = extractCueLines(lines);
  for (const cue of cues) {
    const key = variantKey(cue.name);
    if (!characterSet.has(key)) {
      characterSet.add(key);
      characters.push(key);
    }
  }

  // 2) Known-name pass-2 scan. When called from the per-scene
  // confirmation modal we receive the project's existing character
  // names; when called from the schedule cross-reference flow we
  // receive the call sheet's cast list. Either way, match each name
  // word-bounded in Title Case OR ALL CAPS — never lowercase, so a
  // character named "Will" doesn't pick up the modal verb "will".
  if (knownCharacters.length > 0) {
    for (const charName of knownCharacters) {
      const normalized = normalizeCharacterName(charName);
      if (normalized.length < 3) continue;
      if (!/^[A-Z][A-Z'\- ]*$/.test(normalized)) continue;
      const key = variantKey(normalized);
      if (characterSet.has(key)) continue;
      const alts = new Set([normalized, toTitleCase(normalized)]);
      const pattern = new RegExp(
        `\\b(?:${[...alts].map(escapeRegExp).join('|')})\\b`,
      );
      if (pattern.test(sceneContent)) {
        characterSet.add(key);
        characters.push(key);
      }
    }
  }

  return characters;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert "BRY" → "Bry", "YOUNG BRY" → "Young Bry", "MISS NAIR" →
 * "Miss Nair". Used by the pass-2 known-name scan so we match the
 * Title Case form characters typically take in action lines.
 */
function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((part) => (part && /^[a-z]/.test(part) ? part[0].toUpperCase() + part.slice(1) : part))
    .join('');
}

/**
 * Batch detect characters for multiple scenes
 * More efficient than calling detectCharactersForScene individually
 * @param scenes - Array of scenes with their content
 * @param rawText - Full raw script text
 * @param options - Optional settings including known characters from schedule
 */
export async function detectCharactersForScenesBatch(
  scenes: Array<{ sceneNumber: string; scriptContent: string }>,
  rawText: string,
  options?: {
    knownCharacters?: string[];
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();
  const total = scenes.length;
  let completed = 0;

  // Process scenes in parallel batches of 5 for better performance
  const batchSize = 5;

  for (let i = 0; i < scenes.length; i += batchSize) {
    const batch = scenes.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (scene) => {
        const characters = await detectCharactersForScene(
          scene.scriptContent,
          rawText,
          { knownCharacters: options?.knownCharacters }
        );
        return { sceneNumber: scene.sceneNumber, characters };
      })
    );

    for (const result of batchResults) {
      results.set(result.sceneNumber, result.characters);
      completed++;
      options?.onProgress?.(completed, total);
    }
  }

  return results;
}
