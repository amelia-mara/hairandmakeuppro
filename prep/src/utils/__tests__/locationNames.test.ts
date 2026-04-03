/**
 * Unit tests for location-based character name rejection.
 *
 * Tests the post-processing logic that removes "characters" whose names
 * match scene locations. Since parseScriptText depends on pdfjs-dist
 * (unavailable in test env), we test the logic directly.
 *
 * Run: npx tsx prep/src/utils/__tests__/locationNames.test.ts
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

// ─── Replicate the location-based rejection logic from parseScriptText ──────

interface MockScene {
  location: string;
  characters: string[];
}

/**
 * Simulate the location-based false positive removal from parseScriptText.
 * Takes scenes with locations and a character map, returns which characters
 * would be removed.
 */
function findLocationFalsePositives(
  scenes: MockScene[],
  characterNames: string[],
): Set<string> {
  // Build location set (same logic as in parseScriptText)
  const sceneLocations = new Set<string>();
  for (const scene of scenes) {
    const loc = scene.location.toUpperCase().trim();
    if (loc && loc !== 'PREAMBLE') {
      sceneLocations.add(loc);
      for (const segment of loc.split(/\s*[-–—\/]\s*/)) {
        const seg = segment.trim();
        if (seg.length >= 3) sceneLocations.add(seg);
      }
    }
  }

  // Find multi-word names that match locations
  const removed = new Set<string>();
  for (const name of characterNames) {
    if (!name.includes(' ')) continue;
    if (sceneLocations.has(name)) {
      removed.add(name);
    }
  }
  return removed;
}

// ─── Test 1: "FARM LAND" is rejected ────────────────────────────────────────

console.log('\nTest 1: Location names rejected as characters');

{
  const scenes: MockScene[] = [
    { location: 'FARM LAND', characters: ['FARM LAND', 'LENNON BOWIE'] },
    { location: 'BARN', characters: ['LENNON BOWIE'] },
  ];
  const chars = ['FARM LAND', 'LENNON BOWIE'];
  const removed = findLocationFalsePositives(scenes, chars);

  assert(removed.has('FARM LAND'),
    '"FARM LAND" rejected — matches scene location "FARM LAND"');
  assert(!removed.has('LENNON BOWIE'),
    '"LENNON BOWIE" preserved — not a location');
}

// ─── Test 2: "FARM HOUSE" is rejected ───────────────────────────────────────

console.log('\nTest 2: Compound location names rejected');

{
  const scenes: MockScene[] = [
    { location: 'FARM LAND', characters: [] },
    { location: 'FARM HOUSE', characters: ['FARM HOUSE'] },
  ];
  const chars = ['FARM HOUSE'];
  const removed = findLocationFalsePositives(scenes, chars);

  assert(removed.has('FARM HOUSE'),
    '"FARM HOUSE" rejected — matches scene location "FARM HOUSE"');
}

// ─── Test 3: "FARMER JOE" IS preserved ──────────────────────────────────────

console.log('\nTest 3: Legitimate character names preserved');

{
  const scenes: MockScene[] = [
    { location: 'FARM LAND', characters: ['FARMER JOE'] },
    { location: 'BARN', characters: ['FARMER JOE'] },
  ];
  const chars = ['FARMER JOE'];
  const removed = findLocationFalsePositives(scenes, chars);

  assert(!removed.has('FARMER JOE'),
    '"FARMER JOE" preserved — "FARMER JOE" is not a location');
}

// ─── Test 4: "STREET CORNER" is rejected ────────────────────────────────────

console.log('\nTest 4: More location names rejected');

{
  const scenes: MockScene[] = [
    { location: 'STREET CORNER', characters: ['STREET CORNER'] },
    { location: 'OFFICE', characters: [] },
  ];
  const chars = ['STREET CORNER'];
  const removed = findLocationFalsePositives(scenes, chars);

  assert(removed.has('STREET CORNER'),
    '"STREET CORNER" rejected — matches scene location');
}

// ─── Test 5: "OFFICE BUILDING" is rejected ──────────────────────────────────

console.log('\nTest 5: Another location name rejected');

{
  const scenes: MockScene[] = [
    { location: 'OFFICE BUILDING', characters: ['OFFICE BUILDING'] },
    { location: 'LOBBY', characters: [] },
  ];
  const chars = ['OFFICE BUILDING'];
  const removed = findLocationFalsePositives(scenes, chars);

  assert(removed.has('OFFICE BUILDING'),
    '"OFFICE BUILDING" rejected — matches scene location');
}

// ─── Test 6: "MARY JANE" IS preserved ───────────────────────────────────────

console.log('\nTest 6: Legitimate two-word character name preserved');

{
  const scenes: MockScene[] = [
    { location: 'APARTMENT', characters: ['MARY JANE'] },
    { location: 'STREET', characters: ['MARY JANE'] },
  ];
  const chars = ['MARY JANE'];
  const removed = findLocationFalsePositives(scenes, chars);

  assert(!removed.has('MARY JANE'),
    '"MARY JANE" preserved — not a scene location');
}

// ─── Test 7: Compound location with dash splits into segments ───────────────

console.log('\nTest 7: Compound location segments');

{
  const scenes: MockScene[] = [
    { location: 'FARMHOUSE - KITCHEN', characters: ['FARMHOUSE', 'KITCHEN'] },
  ];
  const chars = ['FARMHOUSE', 'KITCHEN', 'PETER SMITH'];
  const removed = findLocationFalsePositives(scenes, chars);

  // Single-word names like "FARMHOUSE" are not checked (only multi-word)
  assert(!removed.has('FARMHOUSE'),
    '"FARMHOUSE" not checked — single word names skipped');
  assert(!removed.has('KITCHEN'),
    '"KITCHEN" not checked — single word names skipped');
  assert(!removed.has('PETER SMITH'),
    '"PETER SMITH" preserved — not a location');

  // But "FARMHOUSE - KITCHEN" as a full string IS a location
  const chars2 = ['FARMHOUSE - KITCHEN'];
  const removed2 = findLocationFalsePositives(scenes, chars2);
  assert(removed2.has('FARMHOUSE - KITCHEN'),
    '"FARMHOUSE - KITCHEN" rejected — matches full compound location');
}

// ─── Test 8: Single-word character names are never rejected by location ─────

console.log('\nTest 8: Single-word names never rejected by location check');

{
  const scenes: MockScene[] = [
    { location: 'BARN', characters: ['BARN'] },
    { location: 'OFFICE', characters: ['LENNON'] },
  ];
  const chars = ['BARN', 'LENNON'];
  const removed = findLocationFalsePositives(scenes, chars);

  assert(!removed.has('BARN'),
    '"BARN" (single word) not rejected by location check');
  assert(!removed.has('LENNON'),
    '"LENNON" (single word) not rejected by location check');
}

// ─── Test 9: Location with slash splits correctly ───────────────────────────

console.log('\nTest 9: Slash-separated compound locations');

{
  const scenes: MockScene[] = [
    { location: 'BARS / NIGHTCLUBS', characters: [] },
  ];
  const chars = ['BARS / NIGHTCLUBS', 'JOHNNY CASH'];
  const removed = findLocationFalsePositives(scenes, chars);

  assert(removed.has('BARS / NIGHTCLUBS'),
    '"BARS / NIGHTCLUBS" rejected — matches scene location');
  assert(!removed.has('JOHNNY CASH'),
    '"JOHNNY CASH" preserved — not a location');
}

// ─── Test 10: No false negatives for real character names ───────────────────

console.log('\nTest 10: Multiple legitimate characters preserved');

{
  const scenes: MockScene[] = [
    { location: 'FARM LAND', characters: ['LENNON BOWIE', 'DEDRA MONTGOMERY'] },
    { location: 'BARN', characters: ['JASPER MONTGOMERY'] },
    { location: 'LONDON STREET', characters: ['AGATHA CHRISTIE'] },
  ];
  const chars = ['LENNON BOWIE', 'DEDRA MONTGOMERY', 'JASPER MONTGOMERY', 'AGATHA CHRISTIE'];
  const removed = findLocationFalsePositives(scenes, chars);

  assert(!removed.has('LENNON BOWIE'), '"LENNON BOWIE" preserved');
  assert(!removed.has('DEDRA MONTGOMERY'), '"DEDRA MONTGOMERY" preserved');
  assert(!removed.has('JASPER MONTGOMERY'), '"JASPER MONTGOMERY" preserved');
  assert(!removed.has('AGATHA CHRISTIE'), '"AGATHA CHRISTIE" preserved');
}

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(failed > 0 ? 'SOME TESTS FAILED' : 'ALL TESTS PASSED');
