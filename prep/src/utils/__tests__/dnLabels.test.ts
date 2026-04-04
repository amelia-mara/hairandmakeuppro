/**
 * Unit tests for D/N labels, heading time jumps, and post-jump review flags.
 *
 * Run: npx tsx prep/src/utils/__tests__/dnLabels.test.ts
 */

import {
  buildStoryDayMap,
  classifyTOD,
  matchHeadingTimeJump,
  type ParsedScene,
} from '../storyDayDetection';

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

function scene(
  num: string,
  tod: string,
  opts: { al?: string[]; tc?: string | null; slug?: string } = {},
): ParsedScene {
  return {
    sceneNumber: num,
    slugline: opts.slug ?? `INT. LOCATION ${num} - ${tod}`,
    rawTOD: tod,
    tod: classifyTOD(tod),
    intExt: 'INT',
    location: `LOCATION ${num}`,
    actionLines: opts.al || [],
    titleCardBefore: opts.tc ?? null,
    isEpisodeMarker: false,
  };
}

// ═══════════════════════════════════════════════════════════════
// ISSUE 1: D/N LABEL DESIGNATION
// ═══════════════════════════════════════════════════════════════

console.log('\n── Issue 1: D/N label designation ──');

// Test 1: DAY followed by NIGHT on same day — label prefix becomes N
console.log('\nTest 1: DAY → NIGHT same day — N prefix');
{
  const scenes = [
    scene('1', 'DAY'),
    scene('2', 'NIGHT'),
  ];
  const results = buildStoryDayMap(scenes);
  const sc1 = results.find(r => r.sceneNumber === '1')!;
  const sc2 = results.find(r => r.sceneNumber === '2')!;

  assert(sc1.label.startsWith('D'), `Sc 1 (DAY) label starts with D: "${sc1.label}"`);
  assert(sc2.label.startsWith('N'), `Sc 2 (NIGHT) label starts with N: "${sc2.label}"`);
  assert(sc2.storyDay === sc1.storyDay, 'Same day number (no increment)');
}

// Test 2: NIGHT followed by DAY — counter increments, D prefix
console.log('\nTest 2: NIGHT → DAY — new day, D prefix');
{
  const scenes = [
    scene('1', 'NIGHT'),
    scene('2', 'DAY'),
  ];
  const results = buildStoryDayMap(scenes);
  const sc1 = results.find(r => r.sceneNumber === '1')!;
  const sc2 = results.find(r => r.sceneNumber === '2')!;

  assert(sc1.label.startsWith('N'), `Sc 1 (NIGHT) label starts with N: "${sc1.label}"`);
  assert(sc2.label.startsWith('D'), `Sc 2 (DAY) label starts with D: "${sc2.label}"`);
  assert(sc2.storyDay === sc1.storyDay + 1, 'Day counter incremented');
}

// Test 3: NIGHT followed by NIGHT — stays N, no increment
console.log('\nTest 3: NIGHT → NIGHT — stays N, no increment');
{
  const scenes = [
    scene('1', 'NIGHT'),
    scene('2', 'NIGHT'),
  ];
  const results = buildStoryDayMap(scenes);
  const sc2 = results.find(r => r.sceneNumber === '2')!;

  assert(sc2.label.startsWith('N'), `Sc 2 (NIGHT) label starts with N: "${sc2.label}"`);
  assert(sc2.storyDay === 1, 'No increment');
}

// Test 4: DAY followed by DAY — stays D, no increment
console.log('\nTest 4: DAY → DAY — stays D, no increment');
{
  const scenes = [
    scene('1', 'DAY'),
    scene('2', 'DAY'),
  ];
  const results = buildStoryDayMap(scenes);
  const sc2 = results.find(r => r.sceneNumber === '2')!;

  assert(sc2.label.startsWith('D'), `Sc 2 (DAY) label starts with D: "${sc2.label}"`);
  assert(sc2.storyDay === 1, 'No increment');
}

// Test 5: NIGHT is first scene — label is N, day is 1
console.log('\nTest 5: First scene is NIGHT — N1');
{
  const scenes = [scene('1', 'NIGHT')];
  const results = buildStoryDayMap(scenes);
  const sc1 = results[0];

  assert(sc1.label === 'N1', `First NIGHT scene label is "N1": "${sc1.label}"`);
  assert(sc1.storyDay === 1, 'Day is 1');
}

// Test 6: EVENING and DUSK get N prefix
console.log('\nTest 6: EVENING and DUSK get N prefix');
{
  const scenes = [
    scene('1', 'DAY'),
    scene('2', 'EVENING'),
    scene('3', 'DUSK'),
  ];
  const results = buildStoryDayMap(scenes);
  assert(results[1].label.startsWith('N'), `EVENING gets N prefix: "${results[1].label}"`);
  assert(results[2].label.startsWith('N'), `DUSK gets N prefix: "${results[2].label}"`);
}

// Test 7: MORNING, DAWN, AFTERNOON get D prefix
console.log('\nTest 7: MORNING, DAWN, AFTERNOON get D prefix');
{
  const scenes = [
    scene('1', 'MORNING'),
    scene('2', 'DAWN'),
    scene('3', 'AFTERNOON'),
  ];
  const results = buildStoryDayMap(scenes);
  assert(results[0].label.startsWith('D'), `MORNING gets D prefix: "${results[0].label}"`);
  assert(results[1].label.startsWith('D'), `DAWN gets D prefix: "${results[1].label}"`);
  assert(results[2].label.startsWith('D'), `AFTERNOON gets D prefix: "${results[2].label}"`);
}

// Test 8: CONTINUOUS inherits D prefix
console.log('\nTest 8: CONTINUOUS gets D prefix (default)');
{
  const scenes = [
    scene('1', 'DAY'),
    scene('2', 'CONTINUOUS'),
  ];
  const results = buildStoryDayMap(scenes);
  assert(results[1].label.startsWith('D'), `CONTINUOUS gets D prefix: "${results[1].label}"`);
}

// Test 9: Full D/N sequence across multiple days
console.log('\nTest 9: Multi-day D/N sequence');
{
  const scenes = [
    scene('1', 'DAY'),        // D1
    scene('2', 'NIGHT'),       // N1
    scene('3', 'MORNING'),     // D2
    scene('4', 'EVENING'),     // N2
    scene('5', 'DAY'),         // D3
  ];
  const results = buildStoryDayMap(scenes);
  assert(results[0].label === 'D1', `Sc 1: D1 — got "${results[0].label}"`);
  assert(results[1].label === 'N1', `Sc 2: N1 — got "${results[1].label}"`);
  assert(results[2].label === 'D2', `Sc 3: D2 — got "${results[2].label}"`);
  assert(results[3].label === 'N2', `Sc 4: N2 — got "${results[3].label}"`);
  assert(results[4].label === 'D3', `Sc 5: D3 — got "${results[4].label}"`);
}

// ═══════════════════════════════════════════════════════════════
// ISSUE 2: HEADING TIME JUMPS
// ═══════════════════════════════════════════════════════════════

console.log('\n── Issue 2: Heading time jumps ──');

// Test 10: matchHeadingTimeJump pattern detection
console.log('\nTest 10: matchHeadingTimeJump detects patterns');
{
  assert(matchHeadingTimeJump('INT. OFFICE - 6 MONTHS LATER')?.type === 'large-jump',
    '"6 MONTHS LATER" in heading → large-jump');
  assert(matchHeadingTimeJump('EXT. STREET - ONE YEAR LATER')?.type === 'large-jump',
    '"ONE YEAR LATER" in heading → large-jump');
  assert(matchHeadingTimeJump('INT. BARN - DAY') === null,
    'Normal heading → null');
  assert(matchHeadingTimeJump('INT. BARN - FLASHBACK') === null,
    'Flashback heading → null (let Tier 2A handle)');
}

// Test 11: Heading "6 MONTHS LATER" → explicit increment
console.log('\nTest 11: Heading with time jump → explicit increment');
{
  const scenes = [
    scene('1', 'DAY'),
    scene('2', 'NIGHT'),
    scene('3', 'DAY', { slug: 'INT. LONDON OFFICE - 6 MONTHS LATER' }),
  ];
  const results = buildStoryDayMap(scenes);
  const sc3 = results.find(r => r.sceneNumber === '3')!;

  assert(sc3.storyDay > 1, 'Day counter incremented');
  assert(sc3.confidence === 'explicit', 'Confidence is explicit');
  assert(sc3.signal.includes('Heading time jump'), `Signal mentions heading: "${sc3.signal}"`);
}

// Test 12: Heading "ONE YEAR LATER" → explicit increment
console.log('\nTest 12: Heading "ONE YEAR LATER"');
{
  const scenes = [
    scene('1', 'DAY'),
    scene('2', 'DAY', { slug: 'EXT. GARDEN - ONE YEAR LATER' }),
  ];
  const results = buildStoryDayMap(scenes);
  assert(results[1].storyDay === 2, 'Counter incremented');
  assert(results[1].confidence === 'explicit', 'Explicit confidence');
}

// Test 13: prefixMarker "SIX MONTHS LATER" → explicit increment
console.log('\nTest 13: prefixMarker time jump');
{
  const scenes = [
    scene('1', 'DAY'),
    scene('2', 'DAY', { tc: 'SIX MONTHS LATER' }),
  ];
  const results = buildStoryDayMap(scenes);
  assert(results[1].storyDay === 2, 'Counter incremented via title card');
  assert(results[1].confidence === 'explicit', 'Explicit confidence');
}

// Test 14: prefixMarker "FLASHBACK: 3 MONTHS AGO" — NOT increment
console.log('\nTest 14: prefixMarker flashback wins over time jump');
{
  const scenes = [
    scene('1', 'DAY'),
    scene('2', 'DAY', { tc: 'FLASHBACK: 3 MONTHS AGO' }),
  ];
  const results = buildStoryDayMap(scenes);
  assert(results[1].timeline === 'non-present', 'Flashback, not time jump');
  assert(results[1].storyDay === 1, 'Day counter NOT incremented');
}

// ═══════════════════════════════════════════════════════════════
// ISSUE 3: POST-JUMP needsReview
// ═══════════════════════════════════════════════════════════════

console.log('\n── Issue 3: Post-jump needsReview ──');

// Test 15: Scenes after large time jump get inferred confidence
console.log('\nTest 15: Scenes after "6 MONTHS LATER" get inferred');
{
  const scenes = [
    scene('1', 'DAY'),
    scene('2', 'DAY', { tc: '6 MONTHS LATER' }),  // Explicit jump
    scene('3', 'DAY'),                              // Post-jump, no marker
    scene('4', 'NIGHT'),                            // Post-jump, no marker
    scene('5', 'DAY', { al: ['The next day, she woke.'] }), // Explicit again
    scene('6', 'DAY'),                              // After explicit, should be explicit/inherited
  ];
  const results = buildStoryDayMap(scenes);

  const sc2 = results.find(r => r.sceneNumber === '2')!;
  const sc3 = results.find(r => r.sceneNumber === '3')!;
  const sc4 = results.find(r => r.sceneNumber === '4')!;
  const sc5 = results.find(r => r.sceneNumber === '5')!;
  const sc6 = results.find(r => r.sceneNumber === '6')!;

  assert(sc2.confidence === 'explicit', 'Sc 2 (jump itself) is explicit');
  assert(sc3.confidence === 'inferred', `Sc 3 (post-jump) is inferred: "${sc3.confidence}"`);
  assert(sc4.confidence === 'inferred', `Sc 4 (post-jump) is inferred: "${sc4.confidence}"`);
  assert(sc5.confidence === 'explicit', `Sc 5 (explicit marker) is explicit: "${sc5.confidence}"`);
  assert(sc6.confidence !== 'inferred' || sc6.confidence === 'inherited',
    `Sc 6 (after explicit) is not inferred: "${sc6.confidence}"`);
}

// Test 16: TOD regression clears post-jump flag
console.log('\nTest 16: TOD regression clears post-jump flag');
{
  const scenes = [
    scene('1', 'DAY'),
    scene('2', 'DAY', { tc: '3 YEARS LATER' }),
    scene('3', 'NIGHT'),                            // Post-jump
    scene('4', 'DAY'),                              // NIGHT→DAY regression clears flag
    scene('5', 'DAY'),                              // Should NOT be inferred
  ];
  const results = buildStoryDayMap(scenes);
  const sc3 = results.find(r => r.sceneNumber === '3')!;
  const sc4 = results.find(r => r.sceneNumber === '4')!;
  const sc5 = results.find(r => r.sceneNumber === '5')!;

  assert(sc3.confidence === 'inferred', 'Sc 3 post-jump is inferred');
  assert(sc4.confidence === 'explicit', 'Sc 4 (TOD regression) is explicit');
  // sc5 follows an explicit signal so it should not be inferred
  assert(sc5.confidence !== 'inferred',
    `Sc 5 after regression is not inferred: "${sc5.confidence}"`);
}

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(failed > 0 ? 'SOME TESTS FAILED' : 'ALL TESTS PASSED');
