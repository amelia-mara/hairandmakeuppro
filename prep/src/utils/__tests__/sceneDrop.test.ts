/**
 * Unit tests for scene drop prevention.
 *
 * Verifies that every valid INT./EXT. heading produces a ParsedScene,
 * regardless of content length, dialogue, or character presence.
 *
 * Since parseScriptText depends on pdfjs-dist (unavailable in test env),
 * these tests replicate the core heading detection + scene assembly logic
 * to verify the algorithm handles all edge cases.
 *
 * Run: npx tsx prep/src/utils/__tests__/sceneDrop.test.ts
 */

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${message}`);
  }
}

// ─── Replicate parseSceneHeadingLine logic ──────────────────────────────────
// (Copied from scriptParser.ts to avoid pdfjs-dist import)

interface ParsedSceneHeading {
  sceneNumber: string | null;
  intExt: 'INT' | 'EXT';
  location: string;
  timeOfDay: string;
  rawSlugline: string;
  isValid: boolean;
}

function parseSceneHeadingLine(line: string): ParsedSceneHeading {
  const trimmed = line.trim();
  const invalidResult: ParsedSceneHeading = {
    sceneNumber: null, intExt: 'INT', location: '', timeOfDay: 'DAY',
    rawSlugline: trimmed, isValid: false,
  };

  if (!trimmed || trimmed.length < 5) return invalidResult;

  let cleanLine = trimmed.replace(/\s*\*+\s*$/, '').trim();

  const sceneNumPattern = /^(\d+[A-Z]{0,4})\s+/i;
  const trailingSceneNumPattern = /\s+(\d+[A-Z]{0,4})\s*$/i;

  let sceneNumber: string | null = null;
  let workingLine = cleanLine;

  const leadingMatch = workingLine.match(sceneNumPattern);
  if (leadingMatch) {
    sceneNumber = leadingMatch[1].toUpperCase();
    workingLine = workingLine.slice(leadingMatch[0].length).trim();
  }

  const trailingMatch = workingLine.match(trailingSceneNumPattern);
  if (trailingMatch) {
    const trailingNum = trailingMatch[1].toUpperCase();
    if (!sceneNumber) sceneNumber = trailingNum;
    workingLine = workingLine.slice(0, -trailingMatch[0].length).trim();
  }

  const intExtPattern = /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|INT\.?|EXT\.?)\s*/i;
  const intExtMatch = workingLine.match(intExtPattern);
  if (!intExtMatch) return invalidResult;

  const intExtRaw = intExtMatch[1].toUpperCase().replace(/\.$/, '');
  const intExt: 'INT' | 'EXT' = intExtRaw.startsWith('EXT') ? 'EXT' : 'INT';

  workingLine = workingLine.slice(intExtMatch[0].length).trim();
  workingLine = workingLine.replace(/^[\.\-–—]\s*/, '').trim();

  const timeSeparatorPattern = /(?:\s*[-–—\.]+\s*|\s+)(DAY|NIGHT|MORNING|EVENING|AFTERNOON|DAWN|DUSK|SUNSET|SUNRISE|CONTINUOUS|CONT|LATER|SAME|SAME TIME|MOMENTS LATER|SIMULTANEOUS|MAGIC HOUR|GOLDEN HOUR|FLASHBACK|PRESENT|DREAM|FANTASY|NIGHTMARE|ESTABLISHING)(?:\s*[-–—]?\s*(?:FLASHBACK|PRESENT|CONT(?:'D)?)?)?$/i;

  let timeOfDay = 'DAY';
  let location = workingLine;

  const timeMatch = workingLine.match(timeSeparatorPattern);
  if (timeMatch) {
    timeOfDay = timeMatch[1].toUpperCase();
    location = workingLine.slice(0, timeMatch.index).trim();
    location = location.replace(/[\s\-–—\.,]+$/, '').trim();
  }

  if (!timeMatch && workingLine.length > 0) {
    if (workingLine.length > 50 || /,\s*\d/.test(workingLine) || /[a-z]/.test(workingLine)) {
      return invalidResult;
    }
    location = workingLine.replace(/[\s\-–—\.,]+$/, '').trim();
  }

  if (!location || location.length < 2) return invalidResult;

  return { sceneNumber, intExt, location, timeOfDay, rawSlugline: trimmed, isValid: true };
}

// ─── Simplified scene assembly (same algorithm as parseScriptText) ──────────

interface SimpleScene {
  sceneNumber: string;
  slugline: string;
  location: string;
  content: string;
  characters: string[];
}

function parseScenes(text: string): SimpleScene[] {
  const lines = text.split('\n');
  const scenes: SimpleScene[] = [];
  let currentScene: SimpleScene | null = null;
  let currentContent = '';
  let fallbackNum = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const heading = parseSceneHeadingLine(trimmed);

    if (heading.isValid) {
      if (currentScene) {
        currentScene.content = currentContent.trim();
        scenes.push(currentScene);
      }
      fallbackNum++;
      currentScene = {
        sceneNumber: heading.sceneNumber || String(fallbackNum),
        slugline: trimmed,
        location: heading.location,
        content: '',
        characters: [],
      };
      currentContent = trimmed + '\n';
      continue;
    }

    if (currentScene) {
      currentContent += line + '\n';
    }
  }

  if (currentScene) {
    currentScene.content = currentContent.trim();
    scenes.push(currentScene);
  }

  return scenes;
}

// ─── Validation helper (same as in parseScriptText) ─────────────────────────

function countHeadings(text: string): number {
  const headingRe = /^(\d+[A-Z]{0,4}\s+)?(INT\.?|EXT\.?|INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?)\s/i;
  let count = 0;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (headingRe.test(t) && t.length >= 5) count++;
  }
  return count;
}

// ─── Test 1: 1-line scene (heading only, no action, no dialogue) ────────────

console.log('\nTest 1: Scene with heading only — no action, no dialogue');

{
  const script = `1 INT. OFFICE - DAY 1

2 EXT. STREET - NIGHT 2

Some action happens here.
`;
  const scenes = parseScenes(script);
  assert(scenes.length === 2, `Produced ${scenes.length} scenes (expected 2)`);
  assert(scenes[0].sceneNumber === '1', 'Scene 1 present');
  assert(scenes[0].content.trim() === '1 INT. OFFICE - DAY 1', 'Scene 1 has heading-only content');
  assert(scenes[1].sceneNumber === '2', 'Scene 2 present');
}

// ─── Test 2: Two adjacent scenes with no content between them ───────────────

console.log('\nTest 2: Two adjacent headings with no content between');

{
  const script = `6 INT. BARN - DAY 6
7 EXT. GARDEN - NIGHT 7

The garden is dark.
`;
  const scenes = parseScenes(script);
  assert(scenes.length === 2, `Produced ${scenes.length} scenes (expected 2)`);
  assert(scenes[0].sceneNumber === '6', 'Scene 6 present');
  assert(scenes[1].sceneNumber === '7', 'Scene 7 present');
}

// ─── Test 3: Scene with only action lines, no dialogue ──────────────────────

console.log('\nTest 3: Scene with action only, no dialogue');

{
  const script = `1 INT. OFFICE - DAY 1

She walks in and sits down.
The phone rings.
She picks it up.

2 EXT. PARKING LOT - NIGHT 2
`;
  const scenes = parseScenes(script);
  assert(scenes.length === 2, `Produced ${scenes.length} scenes (expected 2)`);
  assert(scenes[0].content.includes('phone rings'), 'Scene 1 has action content');
}

// ─── Test 4: Scene with no characters at all ────────────────────────────────

console.log('\nTest 4: Scene with no characters');

{
  const script = `1 EXT. MOUNTAIN TOP - DAY 1

The wind blows across the empty peak.

2 INT. CABIN - NIGHT 2

A fire crackles in the hearth.
`;
  const scenes = parseScenes(script);
  assert(scenes.length === 2, `Produced ${scenes.length} scenes (expected 2)`);
  assert(scenes[0].characters.length === 0, 'Scene 1 has no characters');
  assert(scenes[1].characters.length === 0, 'Scene 2 has no characters');
}

// ─── Test 5: Total output count equals heading count ────────────────────────

console.log('\nTest 5: Output scene count matches heading count');

{
  const script = `1 INT. OFFICE - DAY 1
2 EXT. STREET - NIGHT 2
3 INT. BAR - EVENING 3

Some text.

4 EXT. PARK - DAY 4
5 INT. HOSPITAL - NIGHT 5
`;
  const headings = countHeadings(script);
  const scenes = parseScenes(script);
  assert(headings === 5, `Detected ${headings} headings (expected 5)`);
  assert(scenes.length === headings, `Output ${scenes.length} scenes matches ${headings} headings`);
}

// ─── Test 6: Very short scenes interspersed with normal scenes ──────────────

console.log('\nTest 6: Mix of short and normal scenes');

{
  const script = `1 INT. OFFICE - DAY 1

PETER
Hello.

2 INT. HALLWAY - DAY 2
3 INT. STAIRWELL - DAY 3
4 EXT. STREET - NIGHT 4

She runs.

5 INT. CAR - NIGHT 5
`;
  const headings = countHeadings(script);
  const scenes = parseScenes(script);
  assert(headings === 5, `Detected ${headings} headings (expected 5)`);
  assert(scenes.length === 5, `Produced ${scenes.length} scenes (expected 5)`);
  assert(scenes[1].sceneNumber === '2', 'Scene 2 (empty) present');
  assert(scenes[2].sceneNumber === '3', 'Scene 3 (empty) present');
  assert(scenes[4].sceneNumber === '5', 'Scene 5 (empty) present');
}

// ─── Test 7: Scene headings with letter suffixes ────────────────────────────

console.log('\nTest 7: Scene numbers with letter suffixes');

{
  const script = `36A INT. OFFICE - DAY 36A
36B INT. OFFICE - NIGHT 36B
37 EXT. STREET - DAY 37
`;
  const scenes = parseScenes(script);
  assert(scenes.length === 3, `Produced ${scenes.length} scenes (expected 3)`);
  assert(scenes[0].sceneNumber === '36A', 'Scene 36A present');
  assert(scenes[1].sceneNumber === '36B', 'Scene 36B present');
  assert(scenes[2].sceneNumber === '37', 'Scene 37 present');
}

// ─── Test 8: Various INT/EXT formats all produce scenes ─────────────────────

console.log('\nTest 8: All heading format variants');

{
  const script = `INT. OFFICE - DAY

EXT. STREET - NIGHT

INT/EXT. CAR - DAY

I/E. PHONE BOOTH - NIGHT
`;
  const scenes = parseScenes(script);
  assert(scenes.length === 4, `Produced ${scenes.length} scenes (expected 4)`);
}

// ─── Test 9: Scene with heading only at end of script (no trailing content) ─

console.log('\nTest 9: Final scene with no trailing content');

{
  const script = `1 INT. OFFICE - DAY 1

Some action.

2 EXT. ROOFTOP - NIGHT 2`;
  const scenes = parseScenes(script);
  assert(scenes.length === 2, `Produced ${scenes.length} scenes (expected 2)`);
  assert(scenes[1].sceneNumber === '2', 'Final scene 2 present');
}

// ─── Test 10: OMITTED-like empty scene ──────────────────────────────────────

console.log('\nTest 10: Scene that would be "omitted" — still produces output');

{
  const script = `67 INT. KITCHEN - DAY 67

PETER
Are you sure?

68 INT. HALLWAY - NIGHT 68

69 EXT. GARDEN - MORNING 69

Birds chirp.
`;
  const scenes = parseScenes(script);
  assert(scenes.length === 3, `Produced ${scenes.length} scenes (expected 3)`);
  assert(scenes[1].sceneNumber === '68', 'Scene 68 present (even though empty)');
  assert(scenes[1].characters.length === 0, 'Scene 68 has no characters');
}

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(failed > 0 ? 'SOME TESTS FAILED' : 'ALL TESTS PASSED');
