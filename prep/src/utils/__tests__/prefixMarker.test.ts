/**
 * Unit tests for temporal prefix marker detection and story day integration.
 *
 * Run: npx tsx prep/src/utils/__tests__/prefixMarker.test.ts
 */

import { buildStoryDayMap, classifyTOD, matchTitleCard, type ParsedScene } from '../storyDayDetection';

// ─── Helpers ────────────────────────────────────────────────────────────────

function scene(
  num: string,
  tod: string,
  opts: { al?: string[]; tc?: string | null; slugExtra?: string } = {},
): ParsedScene {
  return {
    sceneNumber: num,
    slugline: `INT. LOCATION ${num} - ${tod}${opts.slugExtra ? ' ' + opts.slugExtra : ''}`,
    rawTOD: tod,
    tod: classifyTOD(tod),
    intExt: 'INT',
    location: `LOCATION ${num}`,
    actionLines: opts.al || [],
    titleCardBefore: opts.tc ?? null,
    isEpisodeMarker: false,
  };
}

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

// ─── Test 1: matchTitleCard handles all prefix marker patterns ──────────────

console.log('\nTest 1: matchTitleCard pattern matching');

// Flashback markers
assert(matchTitleCard('FLASHBACK: 2 WEEKS AGO')?.type === 'large-jump',
  '"FLASHBACK: 2 WEEKS AGO" → large-jump (time jump takes priority)');

assert(matchTitleCard('FLASHBACK:')?.type === 'flashback',
  '"FLASHBACK:" → flashback');

assert(matchTitleCard('FLASH BACK - 1985')?.type === 'flashback',
  '"FLASH BACK - 1985" → flashback');

assert(matchTitleCard('END FLASHBACK')?.type === 'same-day',
  '"END FLASHBACK" → same-day (return to present)');

assert(matchTitleCard('BACK TO PRESENT')?.type === 'same-day',
  '"BACK TO PRESENT" → same-day');

assert(matchTitleCard('RETURN TO PRESENT')?.type === 'same-day',
  '"RETURN TO PRESENT" → same-day');

// Time jump markers — days, weeks, months, years
assert(matchTitleCard('6 MONTHS LATER')?.type === 'large-jump',
  '"6 MONTHS LATER" → large-jump');

assert(matchTitleCard('6 MONTHS LATER, LONDON SKYLINE')?.type === 'large-jump',
  '"6 MONTHS LATER, LONDON SKYLINE" → large-jump');

assert(matchTitleCard('2 WEEKS LATER')?.type === 'large-jump',
  '"2 WEEKS LATER" → large-jump');

assert(matchTitleCard('3 DAYS AGO')?.type === 'large-jump',
  '"3 DAYS AGO" → large-jump');

assert(matchTitleCard('TWO WEEKS AGO')?.type === 'large-jump',
  '"TWO WEEKS AGO" → large-jump');

assert(matchTitleCard('SEVERAL MONTHS LATER')?.type === 'large-jump',
  '"SEVERAL MONTHS LATER" → large-jump');

assert(matchTitleCard('TEN YEARS LATER')?.type === 'large-jump',
  '"TEN YEARS LATER" → large-jump');

// Gap notes
assert(matchTitleCard('6 MONTHS LATER')?.gapNote === '6 months later',
  '"6 MONTHS LATER" gapNote = "6 months later"');

assert(matchTitleCard('2 WEEKS AGO')?.gapNote === '2 weeks ago',
  '"2 WEEKS AGO" gapNote = "2 weeks ago"');

// Non-matches
assert(matchTitleCard(null) === null, 'null → null');
assert(matchTitleCard('') === null, 'empty → null');
assert(matchTitleCard('He walks away.') === null, 'action text → null');

// ─── Test 2: Flashback prefix marker triggers flashback in detection ────────

console.log('\nTest 2: Flashback prefix marker → isFlashback in buildStoryDayMap');

{
  const scenes = [
    scene('1', 'DAY'),
    scene('2', 'NIGHT'),
    scene('3', 'DAY', { tc: 'FLASHBACK: 2 WEEKS AGO' }), // prefix marker
    scene('4', 'DAY', { al: ['The next day, back to reality.'] }),
  ];
  const results = buildStoryDayMap(scenes);

  const sc3 = results.find(r => r.sceneNumber === '3')!;
  // "FLASHBACK: 2 WEEKS AGO" has a time jump, so it should be large-jump, not flashback
  // The time jump takes priority in matchTitleCard
  assert(sc3.storyDay > 1, 'Sc 3 with "FLASHBACK: 2 WEEKS AGO" starts a new day (time jump)');
  assert(sc3.confidence === 'explicit', 'Sc 3 confidence is explicit');

  // Preceding scene should NOT have the marker
  const sc2 = results.find(r => r.sceneNumber === '2')!;
  assert(sc2.signal.indexOf('FLASHBACK') === -1,
    'Sc 2 (preceding scene) signal does NOT contain FLASHBACK');
}

{
  // Test pure flashback (no time component)
  const scenes = [
    scene('1', 'DAY'),
    scene('2', 'NIGHT'),
    scene('3', 'DAY', { tc: 'FLASHBACK:' }),
    scene('4', 'DAY'),
  ];
  const results = buildStoryDayMap(scenes);
  const sc3 = results.find(r => r.sceneNumber === '3')!;
  assert(sc3.timeline === 'non-present', 'Sc 3 with "FLASHBACK:" is non-present timeline');
  assert(sc3.label.includes('Flashback'), 'Sc 3 label includes "Flashback"');
}

// ─── Test 3: "6 MONTHS LATER" prefix marker triggers time jump ──────────────

console.log('\nTest 3: Time jump prefix marker → increments day counter');

{
  const scenes = [
    scene('1', 'DAY'),
    scene('2', 'NIGHT'),
    scene('3', 'DAY', { tc: '6 MONTHS LATER, LONDON SKYLINE' }),
    scene('4', 'NIGHT'),
  ];
  const results = buildStoryDayMap(scenes);

  const sc2 = results.find(r => r.sceneNumber === '2')!;
  const sc3 = results.find(r => r.sceneNumber === '3')!;
  assert(sc3.storyDay > sc2.storyDay, 'Sc 3 is on a later day than Sc 2');
  assert(sc3.confidence === 'explicit', 'Sc 3 confidence is explicit');
  assert(sc3.gapNote !== null && sc3.gapNote!.includes('months'),
    'Sc 3 gapNote contains "months"');
  assert(sc3.signal.includes('Title card'), 'Sc 3 signal mentions "Title card"');

  // Preceding scene must NOT reference the marker
  assert(!sc2.signal.includes('MONTHS'), 'Sc 2 signal does NOT contain "MONTHS"');
}

// ─── Test 4: Marker NOT immediately before heading stays in content ─────────

console.log('\nTest 4: Marker in middle of scene content stays with that scene');

{
  // Here "6 MONTHS LATER" appears as an action line within scene 2,
  // NOT as a prefix marker. Scene 3 has no title card.
  const scenes = [
    scene('1', 'DAY'),
    scene('2', 'NIGHT', { al: ['6 MONTHS LATER, the city has changed.'] }),
    scene('3', 'DAY'),
  ];
  const results = buildStoryDayMap(scenes);

  // matchTier1 should detect the time jump in scene 2's action lines
  const sc2 = results.find(r => r.sceneNumber === '2')!;
  assert(sc2.storyDay > 1, 'Sc 2 with time jump in action lines starts new day');

  // Scene 3 should NOT get a title card — it has none
  const sc3 = results.find(r => r.sceneNumber === '3')!;
  assert(!sc3.signal.includes('Title card'), 'Sc 3 has no title card signal');
}

// ─── Test 5: Multiple prefix markers in sequence ────────────────────────────

console.log('\nTest 5: Sequence with multiple prefix markers');

{
  const scenes = [
    scene('1', 'DAY'),
    scene('2', 'NIGHT'),
    scene('3', 'DAY', { tc: '3 WEEKS LATER' }),
    scene('4', 'NIGHT'),
    scene('5', 'DAY', { tc: 'FLASHBACK:' }),
    scene('6', 'DAY', { tc: 'BACK TO PRESENT' }),
    scene('7', 'NIGHT'),
  ];
  const results = buildStoryDayMap(scenes);

  const sc3 = results.find(r => r.sceneNumber === '3')!;
  assert(sc3.gapNote !== null && sc3.gapNote!.includes('weeks'),
    'Sc 3 gap note contains "weeks"');

  const sc5 = results.find(r => r.sceneNumber === '5')!;
  assert(sc5.timeline === 'non-present', 'Sc 5 is flashback (non-present)');

  const sc6 = results.find(r => r.sceneNumber === '6')!;
  assert(sc6.timeline === 'present' || sc6.timeline === 'concurrent',
    'Sc 6 "BACK TO PRESENT" returns to present timeline');
}

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(failed > 0 ? 'SOME TESTS FAILED' : 'ALL TESTS PASSED');
