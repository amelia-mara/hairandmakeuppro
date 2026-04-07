/**
 * Comprehensive end-to-end integration test for buildStoryDayMap().
 *
 * Validates the complete pipeline against a mock ParsedScene array
 * covering all detection methods: explicit markers, heading jumps,
 * TOD regression, D/N labels, flashback, concurrent, post-jump flags.
 *
 * Run: npx tsx prep/src/utils/__tests__/integration.test.ts
 */

import {
  buildStoryDayMap,
  classifyTOD,
  type ParsedScene,
  type StoryDayResult,
} from '../storyDayDetection';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${message}`);
  }
}

function s(
  num: string,
  tod: string,
  location = 'LOC',
  opts: { al?: string[]; tc?: string | null; slug?: string } = {},
): ParsedScene {
  return {
    sceneNumber: num,
    slugline: opts.slug ?? `INT. ${location} - ${tod}`,
    rawTOD: tod,
    tod: classifyTOD(tod),
    intExt: 'INT',
    location,
    actionLines: opts.al || [],
    titleCardBefore: opts.tc ?? null,
    isEpisodeMarker: false,
  };
}

/** Helper to check derived fields from StoryDayResult */
function isFlashback(r: StoryDayResult): boolean { return r.timeline === 'non-present'; }
function isConcurrent(r: StoryDayResult): boolean { return r.timeline === 'concurrent'; }
function needsReview(r: StoryDayResult): boolean {
  return r.confidence === 'inferred' || r.confidence === 'inherited';
}

// ═══════════════════════════════════════════════════════════════
// BUILD THE MOCK SCENE ARRAY
// ═══════════════════════════════════════════════════════════════

const scenes: ParsedScene[] = [
  // ── Block 1: Basic day/night cycle ──
  s('1', 'DAY', 'OFFICE'),                                          // D1
  s('2', 'DAY', 'OFFICE'),                                          // D1 (same day)
  s('3', 'NIGHT', 'STREET'),                                        // N1 (same day, night)
  s('4', 'NIGHT', 'BAR'),                                           // N1 (NIGHT→NIGHT)

  // ── Block 2: NIGHT→DAY regression ──
  s('5', 'MORNING', 'BEDROOM'),                                     // D2 (regression)

  // ── Block 3: Explicit action line markers ──
  s('6', 'DAY', 'FARM', { al: ['The next day, they rode out.'] }),   // D3 ("The next day")
  s('7', 'DAY', 'FARM', { al: ['One week later the trial began.'] }),// D4 ("One week later")
  s('8', 'NIGHT', 'COURTHOUSE'),                                    // N4

  // ── Block 4: Concurrent / INTERCUT ──
  s('9', 'NIGHT', 'HOUSE', { al: ['INTERCUT WITH the street.'] }),   // N4
  s('10', 'NIGHT', 'STREET'),                                       // N4 concurrent

  // ── Block 5: Flashback via prefixMarker ──
  s('11', 'DAY', 'PARK', { tc: 'FLASHBACK: 2 WEEKS AGO' }),         // flashback
  s('12', 'NIGHT', 'PARK'),                                         // continues non-present (slug flashback check)

  // ── Block 6: End flashback ──
  s('13', 'DAY', 'HOUSE', { tc: 'END FLASHBACK' }),                  // return to present, D4

  // ── Block 7: Large time jump via prefixMarker ──
  s('14', 'DAY', 'LONDON', { tc: '6 MONTHS LATER' }),                // D5 (large jump)
  s('15', 'DAY', 'LONDON'),                                         // D5 post-jump (inferred)
  s('16', 'NIGHT', 'LONDON'),                                       // N5 post-jump (inferred)

  // ── Block 8: Explicit marker clears post-jump ──
  s('17', 'DAY', 'OFFICE', { al: ['The next day, back to work.'] }), // D6 (clears flag)
  s('18', 'DAY', 'OFFICE'),                                         // D6 (no longer inferred)

  // ── Block 9: Heading time jump ──
  s('19', 'DAY', 'GARDEN', { slug: 'EXT. GARDEN - ONE YEAR LATER' }),// D7 heading jump
  s('20', 'DAY', 'GARDEN'),                                         // D7 post-jump (inferred)

  // ── Block 10: Flash forward via prefixMarker ──
  s('21', 'DAY', 'HOSPITAL', { tc: 'FLASH FORWARD: 3 DAYS' }),      // flashback (non-present)

  // ── Block 11: "6 MONTHS LATER" is NOT flashback ──
  s('22', 'DAY', 'AIRPORT', { tc: 'SIX MONTHS LATER' }),            // D8 (time jump, present)

  // ── Block 12: Meanwhile / concurrent ──
  s('23', 'DAY', 'OFFICE', { al: ['Meanwhile, at the office...'] }), // D8
  s('24', 'DAY', 'WAREHOUSE'),                                      // D8 concurrent

  // ── Block 13: No intercut marker — NOT concurrent ──
  s('25', 'DAY', 'DINER', { al: ['He eats lunch.'] }),               // D8
  s('26', 'DAY', 'PARK'),                                           // D8 (not concurrent, just same TOD)

  // ── Block 14: TOD regression overrides intercut ──
  s('27', 'NIGHT', 'BAR', { al: ['INTERCUT WITH the street.'] }),    // N8
  s('28', 'DAY', 'STREET'),                                         // D9 (regression wins)

  // ── Block 15: CONTINUOUS ──
  s('29', 'CONTINUOUS', 'STREET'),                                   // D9

  // ── Block 16: Wake-up (inferred new day) ──
  s('30', 'NIGHT', 'BEDROOM'),                                      // N9
  s('31', 'DAY', 'BEDROOM', { al: ['Lennon wakes up in the barn.']}),// D10 (inferred)

  // ── Block 17: First scene NIGHT ──
  // (tested separately below)

  // ── Block 18: Heading flashback wins over heading time jump ──
  // (tested separately below)
];

// ═══════════════════════════════════════════════════════════════
// RUN THE PIPELINE
// ═══════════════════════════════════════════════════════════════

const results = buildStoryDayMap(scenes);

function r(num: string): StoryDayResult {
  const found = results.find(x => x.sceneNumber === num);
  if (!found) throw new Error(`Scene ${num} not in results`);
  return found;
}

// ═══════════════════════════════════════════════════════════════
// FIELD INTEGRITY
// ═══════════════════════════════════════════════════════════════

console.log('\n── Field Integrity ──');

assert(results.length === scenes.length,
  `Output count (${results.length}) equals input count (${scenes.length})`);

for (let i = 0; i < results.length; i++) {
  const res = results[i];
  assert(res.sceneNumber === scenes[i].sceneNumber,
    `Output order: result[${i}].sceneNumber === "${scenes[i].sceneNumber}"`);
  assert(typeof res.storyDay === 'number' && res.storyDay >= 1,
    `Sc ${res.sceneNumber}: storyDay is positive number`);
  assert(typeof res.label === 'string' && res.label.length > 0,
    `Sc ${res.sceneNumber}: label is non-empty string`);
  assert(['explicit', 'inferred', 'inherited'].includes(res.confidence),
    `Sc ${res.sceneNumber}: confidence is valid`);
  assert(['present', 'non-present', 'concurrent'].includes(res.timeline),
    `Sc ${res.sceneNumber}: timeline is valid`);
  assert(typeof res.signal === 'string' && res.signal.length > 0,
    `Sc ${res.sceneNumber}: signal is non-empty string`);
  assert(res.gapNote === null || typeof res.gapNote === 'string',
    `Sc ${res.sceneNumber}: gapNote is string or null`);
}

// ═══════════════════════════════════════════════════════════════
// D/N LABELS
// ═══════════════════════════════════════════════════════════════

console.log('\n── D/N Labels ──');

assert(r('1').label === 'D1', `Sc 1 (DAY first): "${r('1').label}" === "D1"`);
assert(r('3').label === 'N1', `Sc 3 (NIGHT same day): "${r('3').label}" === "N1"`);
assert(r('4').label === 'N1', `Sc 4 (NIGHT→NIGHT): "${r('4').label}" === "N1"`);
assert(r('5').label === 'D2', `Sc 5 (MORNING regression): "${r('5').label}" === "D2"`);
assert(r('8').label === 'N4', `Sc 8 (NIGHT): "${r('8').label}" === "N4"`);

// ═══════════════════════════════════════════════════════════════
// EXPLICIT MARKERS (Tier 1)
// ═══════════════════════════════════════════════════════════════

console.log('\n── Explicit Markers ──');

// "The next day" in action lines
assert(r('6').storyDay === 3, 'Sc 6 "The next day" → day 3');
assert(r('6').confidence === 'explicit', 'Sc 6 confidence explicit');
assert(r('6').label === 'D3', `Sc 6 label: "${r('6').label}"`);

// "One week later" → increment by 1
assert(r('7').storyDay === 4, 'Sc 7 "One week later" → day 4 (increment by 1)');
assert(r('7').confidence === 'explicit', 'Sc 7 confidence explicit');

// ═══════════════════════════════════════════════════════════════
// CONCURRENT
// ═══════════════════════════════════════════════════════════════

console.log('\n── Concurrent ──');

// INTERCUT WITH
assert(isConcurrent(r('10')), 'Sc 10 after INTERCUT is concurrent');
assert(r('10').storyDay === r('9').storyDay, 'Sc 10 same day as Sc 9');

// Meanwhile
assert(isConcurrent(r('24')), 'Sc 24 after MEANWHILE is concurrent');
assert(r('24').storyDay === r('23').storyDay, 'Sc 24 same day as Sc 23');

// No intercut → NOT concurrent
assert(!isConcurrent(r('26')), 'Sc 26 (no intercut) NOT concurrent');

// TOD regression overrides intercut
assert(!isConcurrent(r('28')), 'Sc 28 (NIGHT→DAY with intercut) NOT concurrent');
assert(r('28').storyDay === r('27').storyDay + 1, 'Sc 28 regression incremented');

// ═══════════════════════════════════════════════════════════════
// FLASHBACK
// ═══════════════════════════════════════════════════════════════

console.log('\n── Flashback ──');

// "FLASHBACK: 2 WEEKS AGO" → flashback
assert(isFlashback(r('11')), 'Sc 11 "FLASHBACK: 2 WEEKS AGO" is flashback');
assert(r('11').timeline === 'non-present', 'Sc 11 non-present timeline');
assert(r('11').label.includes('Flashback'), `Sc 11 label includes Flashback: "${r('11').label}"`);

// Present counter unchanged by flashback
const presentDayBeforeFlashback = r('10').storyDay;
assert(r('13').storyDay === presentDayBeforeFlashback,
  `Sc 13 after END FLASHBACK resumes day ${presentDayBeforeFlashback}`);
assert(!isFlashback(r('13')), 'Sc 13 is present timeline');

// Flash forward → non-present
assert(isFlashback(r('21')), 'Sc 21 "FLASH FORWARD: 3 DAYS" is flashback');

// "6 MONTHS LATER" → NOT flashback
assert(!isFlashback(r('14')), 'Sc 14 "6 MONTHS LATER" is NOT flashback');
assert(r('14').timeline === 'present', 'Sc 14 is present timeline');
assert(r('14').storyDay > presentDayBeforeFlashback, 'Sc 14 counter incremented');

// ═══════════════════════════════════════════════════════════════
// HEADING TIME JUMPS (Tier 1A)
// ═══════════════════════════════════════════════════════════════

console.log('\n── Heading Time Jumps ──');

assert(r('19').confidence === 'explicit', 'Sc 19 heading "ONE YEAR LATER" explicit');
assert(r('19').storyDay > r('18').storyDay, 'Sc 19 counter incremented');
assert(r('19').signal.includes('Heading'), `Sc 19 signal mentions heading: "${r('19').signal}"`);

// ═══════════════════════════════════════════════════════════════
// TOD REGRESSION (Tier 4)
// ═══════════════════════════════════════════════════════════════

console.log('\n── TOD Regression ──');

// NIGHT→DAY (Sc 4→5)
assert(r('5').storyDay === 2, 'Sc 5 NIGHT→MORNING regression → day 2');
assert(r('5').label.startsWith('D'), 'Sc 5 label starts with D');

// DAY→NIGHT same day (Sc 2→3)
assert(r('3').storyDay === r('2').storyDay, 'Sc 3 DAY→NIGHT no increment');
assert(r('3').label.startsWith('N'), 'Sc 3 label starts with N');

// NIGHT→NIGHT (Sc 3→4)
assert(r('4').storyDay === r('3').storyDay, 'Sc 4 NIGHT→NIGHT no increment');

// DAY→DAY (Sc 1→2)
assert(r('2').storyDay === r('1').storyDay, 'Sc 2 DAY→DAY no increment');

// ═══════════════════════════════════════════════════════════════
// POST-LARGE-JUMP
// ═══════════════════════════════════════════════════════════════

console.log('\n── Post-Large-Jump ──');

assert(r('14').confidence === 'explicit', 'Sc 14 (jump itself) explicit');
assert(r('15').confidence === 'inferred', `Sc 15 post-jump inferred: "${r('15').confidence}"`);
assert(needsReview(r('15')), 'Sc 15 needsReview true');
assert(r('16').confidence === 'inferred', `Sc 16 post-jump inferred: "${r('16').confidence}"`);
assert(needsReview(r('16')), 'Sc 16 needsReview true');

// Explicit marker clears post-jump flag
assert(r('17').confidence === 'explicit', 'Sc 17 explicit marker clears flag');
assert(!needsReview(r('17')), 'Sc 17 needsReview false');
assert(r('18').confidence === 'explicit' || r('18').confidence === 'inherited',
  `Sc 18 not inferred after explicit: "${r('18').confidence}"`);

// Heading jump also sets post-jump flag
assert(r('20').confidence === 'inferred', `Sc 20 post heading jump inferred: "${r('20').confidence}"`);

// ═══════════════════════════════════════════════════════════════
// CONTINUOUS
// ═══════════════════════════════════════════════════════════════

console.log('\n── CONTINUOUS ──');

assert(r('29').storyDay === r('28').storyDay, 'Sc 29 CONTINUOUS same day as Sc 28');
assert(r('29').label.startsWith('D'), `Sc 29 CONTINUOUS gets D prefix: "${r('29').label}"`);

// ═══════════════════════════════════════════════════════════════
// WAKE-UP (inferred new day)
// ═══════════════════════════════════════════════════════════════

console.log('\n── Wake-up ──');

assert(r('31').storyDay > r('30').storyDay, 'Sc 31 "wakes up" increments day');
assert(r('31').confidence === 'inferred', 'Sc 31 confidence inferred');
assert(needsReview(r('31')), 'Sc 31 needsReview true');

// ═══════════════════════════════════════════════════════════════
// STANDALONE: First scene NIGHT
// ═══════════════════════════════════════════════════════════════

console.log('\n── First Scene NIGHT ──');
{
  const nightFirst = buildStoryDayMap([s('1', 'NIGHT', 'BAR')]);
  assert(nightFirst[0].label === 'N1', `First scene NIGHT: "${nightFirst[0].label}" === "N1"`);
  assert(nightFirst[0].storyDay === 1, 'Day is 1');
}

// ═══════════════════════════════════════════════════════════════
// STANDALONE: Heading flashback wins over heading time jump
// ═══════════════════════════════════════════════════════════════

console.log('\n── Heading flashback priority ──');
{
  const fbScenes = [
    s('1', 'DAY', 'LOC'),
    s('2', 'DAY', 'LOC', { slug: 'INT. HOUSE - FLASHBACK' }),
  ];
  const fbResults = buildStoryDayMap(fbScenes);
  assert(fbResults[1].timeline === 'non-present',
    'Heading "FLASHBACK" → non-present (not time jump)');
}

// ═══════════════════════════════════════════════════════════════
// STANDALONE: dialogueTimeCue not implemented — verify absent
// ═══════════════════════════════════════════════════════════════

console.log('\n── dialogueTimeCue ──');
{
  // dialogueTimeCue is not yet implemented in StoryDayResult.
  // Verify the field doesn't exist to avoid false expectations.
  const sampleResult = results[0] as unknown as Record<string, unknown>;
  assert(!('dialogueTimeCue' in sampleResult),
    'dialogueTimeCue not yet implemented (field absent)');
}

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`);
console.log(`Integration test: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(failed > 0 ? 'SOME TESTS FAILED' : 'ALL TESTS PASSED');

// Print the full scene table for reference
console.log('\n── Full scene table ──');
for (const res of results) {
  const fl = isFlashback(res) ? ' FB' : '';
  const cc = isConcurrent(res) ? ' CC' : '';
  const rv = needsReview(res) ? ' (??)' : '';
  console.log(
    `  Sc ${res.sceneNumber.padEnd(3)} ${res.label.padEnd(18)} ` +
    `[${res.confidence.padEnd(9)}] ${res.signal.slice(0, 50)}${fl}${cc}${rv}`
  );
}
