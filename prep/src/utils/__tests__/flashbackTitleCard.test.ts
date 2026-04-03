/**
 * Unit tests for flashback/non-present title card handling.
 *
 * Verifies that scenes with flashback prefix markers are correctly
 * assigned to the non-present timeline without incrementing the
 * present day counter, and that the scene following a flashback
 * resumes on the correct present day.
 *
 * Run: npx tsx prep/src/utils/__tests__/flashbackTitleCard.test.ts
 */

import { buildStoryDayMap, classifyTOD, matchTitleCard, type ParsedScene } from '../storyDayDetection';

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
  opts: { al?: string[]; tc?: string | null } = {},
): ParsedScene {
  return {
    sceneNumber: num,
    slugline: `INT. LOCATION ${num} - ${tod}`,
    rawTOD: tod,
    tod: classifyTOD(tod),
    intExt: 'INT',
    location: `LOCATION ${num}`,
    actionLines: opts.al || [],
    titleCardBefore: opts.tc ?? null,
    isEpisodeMarker: false,
  };
}

// ─── Test 1: matchTitleCard classification ──────────────────────────────────

console.log('\nTest 1: matchTitleCard correctly classifies flashback vs time jump');

assert(matchTitleCard('FLASHBACK: 2 WEEKS AGO')?.type === 'flashback',
  '"FLASHBACK: 2 WEEKS AGO" → flashback (not large-jump)');
assert(matchTitleCard('FLASH FORWARD: 3 DAYS')?.type === 'flashback',
  '"FLASH FORWARD: 3 DAYS" → flashback');
assert(matchTitleCard('DREAM SEQUENCE')?.type === 'flashback',
  '"DREAM SEQUENCE" → flashback');
assert(matchTitleCard('MEMORY: CHILDHOOD')?.type === 'flashback',
  '"MEMORY: CHILDHOOD" → flashback');
assert(matchTitleCard('6 MONTHS LATER')?.type === 'large-jump',
  '"6 MONTHS LATER" → large-jump (no flashback keyword)');
assert(matchTitleCard('2 WEEKS AGO')?.type === 'large-jump',
  '"2 WEEKS AGO" → large-jump (no flashback keyword)');
assert(matchTitleCard('END FLASHBACK')?.type === 'same-day',
  '"END FLASHBACK" → same-day (return to present)');
assert(matchTitleCard(null) === null, 'null → null');
assert(matchTitleCard('') === null, 'empty → null');

// ─── Test 2: "FLASHBACK: 2 WEEKS AGO" → non-present, present counter unchanged

console.log('\nTest 2: Scene with "FLASHBACK: 2 WEEKS AGO" prefix marker');

{
  const scenes = [
    scene('1', 'DAY'),                                           // Day 1 present
    scene('2', 'NIGHT'),                                         // Day 1 present
    scene('3', 'DAY', { tc: 'FLASHBACK: 2 WEEKS AGO' }),         // Flashback
    scene('4', 'DAY', { al: ['The next day, back to present.'] }),// Day 2 present
  ];
  const results = buildStoryDayMap(scenes);

  const sc1 = results.find(r => r.sceneNumber === '1')!;
  const sc3 = results.find(r => r.sceneNumber === '3')!;
  const sc4 = results.find(r => r.sceneNumber === '4')!;

  assert(sc3.timeline === 'non-present',
    'Sc 3 is non-present timeline');
  assert(sc3.label.includes('Flashback'),
    'Sc 3 label includes "Flashback"');
  assert(sc3.confidence === 'explicit',
    'Sc 3 confidence is explicit');

  // Present counter should not have been incremented by the flashback
  assert(sc4.storyDay === 2,
    'Sc 4 is Day 2 (present counter resumed from Day 1, then +1 for "next day")');
  assert(sc4.timeline === 'present',
    'Sc 4 is present timeline');
}

// ─── Test 3: "FLASH FORWARD: 3 DAYS" → non-present ─────────────────────────

console.log('\nTest 3: Scene with "FLASH FORWARD: 3 DAYS" prefix marker');

{
  const scenes = [
    scene('1', 'DAY'),
    scene('2', 'DAY', { tc: 'FLASH FORWARD: 3 DAYS' }),
    scene('3', 'DAY'),                                           // No explicit marker
  ];
  const results = buildStoryDayMap(scenes);

  const sc2 = results.find(r => r.sceneNumber === '2')!;
  assert(sc2.timeline === 'non-present',
    'Sc 2 is non-present (flash forward)');
  assert(sc2.label.includes('Flashback'),
    'Sc 2 label includes "Flashback"');
}

// ─── Test 4: "6 MONTHS LATER" → NOT flashback, present counter increments ──

console.log('\nTest 4: "6 MONTHS LATER" is NOT a flashback — increments present counter');

{
  const scenes = [
    scene('1', 'DAY'),
    scene('2', 'NIGHT'),
    scene('3', 'DAY', { tc: '6 MONTHS LATER' }),
  ];
  const results = buildStoryDayMap(scenes);

  const sc3 = results.find(r => r.sceneNumber === '3')!;
  assert(sc3.timeline === 'present',
    'Sc 3 is present timeline (time jump, not flashback)');
  assert(sc3.storyDay > 1,
    'Sc 3 day counter incremented');
  assert(sc3.gapNote !== null && sc3.gapNote!.includes('months'),
    'Sc 3 has gap note with "months"');
}

// ─── Test 5: Scene after flashback resumes correct present day ──────────────

console.log('\nTest 5: Present counter resumes after flashback');

{
  const scenes = [
    scene('1', 'DAY'),                                           // Day 1
    scene('2', 'NIGHT'),                                         // Day 1
    scene('3', 'DAY', { tc: 'FLASHBACK:' }),                     // Flashback
    scene('4', 'NIGHT', { tc: 'FLASHBACK:' }),                   // Another flashback scene
    scene('5', 'DAY', { tc: 'END FLASHBACK' }),                  // Return to present
    scene('6', 'NIGHT'),                                         // Same day as before flashback
  ];
  const results = buildStoryDayMap(scenes);

  const sc1 = results.find(r => r.sceneNumber === '1')!;
  const sc3 = results.find(r => r.sceneNumber === '3')!;
  const sc4 = results.find(r => r.sceneNumber === '4')!;
  const sc5 = results.find(r => r.sceneNumber === '5')!;
  const sc6 = results.find(r => r.sceneNumber === '6')!;

  assert(sc3.timeline === 'non-present', 'Sc 3 is non-present (flashback)');
  assert(sc4.timeline === 'non-present', 'Sc 4 is non-present (flashback)');

  // "END FLASHBACK" returns to present — same day as before the flashback
  assert(sc5.timeline === 'present' || sc5.timeline === 'concurrent',
    'Sc 5 returns to present timeline');
  assert(sc5.storyDay === sc1.storyDay,
    'Sc 5 resumes on same day as Sc 1 (Day 1)');

  // Sc 6 should still be on the same day
  assert(sc6.storyDay === sc1.storyDay,
    'Sc 6 is still Day 1 (no day change after returning from flashback)');
}

// ─── Test 6: Scene with empty titleCardBefore has no effect ─────────────────

console.log('\nTest 6: Empty prefixMarker has no effect');

{
  const scenes = [
    scene('1', 'DAY'),
    scene('2', 'DAY', { tc: null }),
    scene('3', 'DAY', { tc: '' }),
  ];
  const results = buildStoryDayMap(scenes);

  const sc2 = results.find(r => r.sceneNumber === '2')!;
  const sc3 = results.find(r => r.sceneNumber === '3')!;

  assert(sc2.timeline === 'present', 'Sc 2 with null titleCard is present');
  assert(sc3.timeline === 'present', 'Sc 3 with empty titleCard is present');
  assert(sc2.storyDay === 1, 'Sc 2 is Day 1');
  assert(sc3.storyDay === 1, 'Sc 3 is Day 1');
}

// ─── Test 7: Multiple flashbacks don't corrupt present counter ──────────────

console.log('\nTest 7: Multiple flashbacks in sequence');

{
  const scenes = [
    scene('1', 'DAY'),                                           // Day 1
    scene('2', 'NIGHT'),                                         // Day 1
    scene('3', 'DAY', { tc: 'FLASHBACK: 10 YEARS AGO' }),        // Flashback
    scene('4', 'DAY', { tc: 'END FLASHBACK' }),                  // Return to present
    scene('5', 'DAY', { al: ['The next day, she packed.'] }),     // Day 2
    scene('6', 'DAY', { tc: 'MEMORY: CHILDHOOD' }),               // Another flashback
    scene('7', 'DAY'),                                            // Day 2 continues
  ];
  const results = buildStoryDayMap(scenes);

  const sc3 = results.find(r => r.sceneNumber === '3')!;
  const sc5 = results.find(r => r.sceneNumber === '5')!;
  const sc6 = results.find(r => r.sceneNumber === '6')!;
  const sc7 = results.find(r => r.sceneNumber === '7')!;

  assert(sc3.timeline === 'non-present', 'Sc 3 is flashback');
  assert(sc5.storyDay === 2, 'Sc 5 is Day 2');
  assert(sc6.timeline === 'non-present', 'Sc 6 is memory (non-present)');
  assert(sc7.storyDay === 2, 'Sc 7 resumes Day 2 after memory');
}

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(failed > 0 ? 'SOME TESTS FAILED' : 'ALL TESTS PASSED');
