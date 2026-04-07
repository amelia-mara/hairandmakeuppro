/**
 * Unit tests for concurrent thread detection.
 *
 * Run: npx tsx prep/src/utils/__tests__/concurrent.test.ts
 */

import {
  buildStoryDayMap,
  classifyTOD,
  hasConcurrentMarker,
  type ParsedScene,
} from '../storyDayDetection';

// ─── Helpers ────────────────────────────────────────────────────────────────

function scene(
  num: string,
  tod: string,
  location: string,
  opts: { al?: string[]; tc?: string | null } = {},
): ParsedScene {
  return {
    sceneNumber: num,
    slugline: `INT. ${location} - ${tod}`,
    rawTOD: tod,
    tod: classifyTOD(tod),
    intExt: 'INT',
    location,
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

// ─── Test 1: hasConcurrentMarker detects all phrases ────────────────────────

console.log('\nTest 1: hasConcurrentMarker phrase detection');

assert(hasConcurrentMarker(['INTERCUT WITH OFFICE']),
  '"INTERCUT WITH" detected');
assert(hasConcurrentMarker(['INTERCUT — phone conversation']),
  '"INTERCUT —" detected');
assert(hasConcurrentMarker(['INTERCUT: the two locations']),
  '"INTERCUT:" detected');
assert(hasConcurrentMarker(['Meanwhile, at the ranch...']),
  '"Meanwhile," detected');
assert(hasConcurrentMarker(['At the same time across town']),
  '"AT THE SAME TIME" detected');
assert(hasConcurrentMarker(['The events happen simultaneously']),
  '"SIMULTANEOUSLY" detected');
assert(hasConcurrentMarker(['Cutting between the two rooms']),
  '"CUTTING BETWEEN" detected');

assert(!hasConcurrentMarker(['He walks to the office.']),
  'Normal action line → no match');
assert(!hasConcurrentMarker([]),
  'Empty action lines → no match');
assert(!hasConcurrentMarker(['She intercepts the pass']),
  '"intercepts" (not INTERCUT) → no match');

// ─── Test 2: INTERCUT WITH → concurrent, no day increment ──────────────────

console.log('\nTest 2: Scene preceded by "INTERCUT WITH" — concurrent');

{
  const scenes = [
    scene('1', 'DAY', 'OFFICE'),
    scene('2', 'DAY', 'OFFICE', { al: ['She picks up the phone. INTERCUT WITH:'] }),
    scene('3', 'DAY', 'BEDROOM'),  // Should be concurrent
    scene('4', 'DAY', 'OFFICE'),   // Still same day
  ];
  const results = buildStoryDayMap(scenes);

  const sc2 = results.find(r => r.sceneNumber === '2')!;
  const sc3 = results.find(r => r.sceneNumber === '3')!;
  const sc4 = results.find(r => r.sceneNumber === '4')!;

  assert(sc3.timeline === 'concurrent',
    'Sc 3 timeline is concurrent');
  assert(sc3.storyDay === sc2.storyDay,
    'Sc 3 is same story day as Sc 2');
  assert(sc3.confidence === 'inferred',
    'Sc 3 confidence is inferred');
  assert(sc3.signal.includes('Concurrent'),
    'Sc 3 signal mentions "Concurrent"');
  assert(sc4.storyDay === sc2.storyDay,
    'Sc 4 is still same story day');
}

// ─── Test 3: MEANWHILE → concurrent, no day increment ──────────────────────

console.log('\nTest 3: Scene preceded by "MEANWHILE," — concurrent');

{
  const scenes = [
    scene('1', 'NIGHT', 'BAR'),
    scene('2', 'NIGHT', 'BAR', { al: ['He orders a drink. Meanwhile,'] }),
    scene('3', 'NIGHT', 'PARKING LOT'),  // Should be concurrent
  ];
  const results = buildStoryDayMap(scenes);

  const sc3 = results.find(r => r.sceneNumber === '3')!;
  assert(sc3.timeline === 'concurrent',
    'Sc 3 with MEANWHILE is concurrent');
  assert(sc3.storyDay === 1,
    'Sc 3 stays on Day 1');
}

// ─── Test 4: Different location, same TOD, NO intercut → NOT concurrent ────

console.log('\nTest 4: Different location, same TOD, no intercut — NOT concurrent');

{
  const scenes = [
    scene('1', 'DAY', 'OFFICE'),
    scene('2', 'DAY', 'OFFICE', { al: ['He leaves the office.'] }),
    scene('3', 'DAY', 'STREET'),  // Different location, no intercut marker
  ];
  const results = buildStoryDayMap(scenes);

  const sc3 = results.find(r => r.sceneNumber === '3')!;
  assert(sc3.timeline !== 'concurrent',
    'Sc 3 is NOT concurrent (no intercut marker)');
  assert(sc3.timeline === 'present',
    'Sc 3 is present timeline');
}

// ─── Test 5: TOD regression NIGHT→DAY overrides intercut ────────────────────

console.log('\nTest 5: NIGHT→DAY regression takes priority over intercut marker');

{
  const scenes = [
    scene('1', 'NIGHT', 'BAR', { al: ['INTERCUT WITH the kitchen.'] }),
    scene('2', 'DAY', 'KITCHEN'),  // NIGHT→DAY regression should win
  ];
  const results = buildStoryDayMap(scenes);

  const sc2 = results.find(r => r.sceneNumber === '2')!;
  assert(sc2.storyDay === 2,
    'Sc 2 is Day 2 (regression wins over intercut)');
  assert(sc2.timeline === 'present',
    'Sc 2 timeline is present, not concurrent');
  assert(sc2.signal.includes('TOD regression'),
    'Sc 2 signal mentions TOD regression');
}

// ─── Test 6: Explicit day marker overrides intercut ─────────────────────────

console.log('\nTest 6: Explicit day marker takes priority over intercut marker');

{
  const scenes = [
    scene('1', 'DAY', 'OFFICE', { al: ['INTERCUT WITH the warehouse.'] }),
    scene('2', 'DAY', 'WAREHOUSE', { al: ['The next day, the warehouse is empty.'] }),
  ];
  const results = buildStoryDayMap(scenes);

  const sc2 = results.find(r => r.sceneNumber === '2')!;
  assert(sc2.storyDay === 2,
    'Sc 2 is Day 2 (explicit "next day" wins over intercut)');
  assert(sc2.confidence === 'explicit',
    'Sc 2 confidence is explicit');
}

// ─── Test 7: No false positives on old hardcoded locations ──────────────────

console.log('\nTest 7: Old hardcoded locations (FARM→OFFICE) no longer false-positive');

{
  const scenes = [
    scene('1', 'DAY', 'FARM'),
    scene('2', 'DAY', 'FARM', { al: ['Lennon tends to the horses.'] }),
    scene('3', 'DAY', 'OFFICE'),  // No intercut marker in Sc 2
  ];
  const results = buildStoryDayMap(scenes);

  const sc3 = results.find(r => r.sceneNumber === '3')!;
  assert(sc3.timeline !== 'concurrent',
    'FARM→OFFICE is NOT concurrent without intercut marker');
}

// ─── Test 8: Concurrent with NIGHT→NIGHT (ambiguous TOD) ───────────────────

console.log('\nTest 8: Concurrent detected in ambiguous NIGHT→NIGHT with intercut');

{
  const scenes = [
    scene('1', 'NIGHT', 'HOUSE', { al: ['INTERCUT WITH the street.'] }),
    scene('2', 'NIGHT', 'STREET'),  // Ambiguous NIGHT→NIGHT + intercut
  ];
  const results = buildStoryDayMap(scenes);

  const sc2 = results.find(r => r.sceneNumber === '2')!;
  assert(sc2.timeline === 'concurrent',
    'NIGHT→NIGHT with INTERCUT is concurrent');
  assert(sc2.storyDay === 1,
    'Sc 2 stays on Day 1');
}

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(failed > 0 ? 'SOME TESTS FAILED' : 'ALL TESTS PASSED');
