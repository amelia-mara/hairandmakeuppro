/**
 * Smoke test for v3 story day detection.
 * Creates synthetic scenes exercising all detection tiers,
 * then runs generateLooksFromScript and reports assignments.
 *
 * Run: npx tsx prep/src/utils/__tests__/storyDaySmoke.ts
 */

// Direct imports — bypass @/ alias for tsx compatibility
import { buildStoryDayMap, classifyTOD, type ParsedScene } from '../storyDayDetection';

// ─── Build a Cowboys After Dark–style scene list ────────────────────────────
// Roughly modelling 94 scenes across ~25 story days with:
//   - Action line transitions ("The next day,")
//   - NIGHT→DAY regressions
//   - CONTINUOUS scenes
//   - Flashbacks
//   - Title cards
//   - Calendar dates
//   - Large time jumps

function scene(
  num: string,
  tod: string,
  actionLines: string[] = [],
  opts: { titleCard?: string; slugExtra?: string } = {},
): ParsedScene {
  return {
    sceneNumber: num,
    slugline: `INT. LOCATION ${num} - ${tod}${opts.slugExtra ? ' ' + opts.slugExtra : ''}`,
    rawTOD: tod,
    tod: classifyTOD(tod),
    intExt: 'INT',
    location: `LOCATION ${num}`,
    actionLines,
    titleCardBefore: opts.titleCard ?? null,
    isEpisodeMarker: false,
  };
}

const scenes: ParsedScene[] = [
  // Day 1: scenes 1-4
  scene('1', 'DAY'),
  scene('2', 'DAY'),
  scene('3', 'EVENING'),
  scene('4', 'NIGHT'),

  // Day 2: NIGHT→DAY regression
  scene('5', 'MORNING'),
  scene('6', 'DAY'),
  scene('7', 'CONTINUOUS'),
  scene('8', 'AFTERNOON'),
  scene('9', 'NIGHT'),

  // Day 3: action line "The next day,"
  scene('10', 'DAY', ['The next day, they rode out at dawn.']),
  scene('11', 'DAY'),
  scene('12', 'EVENING'),
  scene('13', 'NIGHT'),

  // Day 4: NIGHT→DAY regression
  scene('14', 'MORNING'),
  scene('15', 'DAY'),
  scene('16', 'CONTINUOUS'),
  scene('17', 'NIGHT'),

  // Day 5: action line "Next morning"
  scene('18', 'DAY', ['Next morning the ranch was quiet.']),
  scene('19', 'DAY'),
  scene('20', 'NIGHT'),

  // Day 6: NIGHT→DAY
  scene('21', 'DAY'),
  scene('22', 'AFTERNOON'),
  scene('23', 'NIGHT'),

  // Day 7: explicit "The following morning"
  scene('24', 'MORNING', ['The following morning she woke early.']),
  scene('25', 'DAY'),
  scene('26', 'NIGHT'),

  // Day 8: NIGHT→DAWN regression
  scene('27', 'DAWN'),
  scene('28', 'DAY'),
  scene('29', 'NIGHT'),

  // Flashback interlude (should NOT advance day counter)
  scene('30', 'DAY', [], { slugExtra: '- FLASHBACK' }),
  scene('31', 'NIGHT', [], { slugExtra: '- FLASHBACK' }),

  // Day 9: back to present, action line "Two days later"
  scene('32', 'DAY', ['Two days later the storm had passed.']),
  scene('33', 'NIGHT'),

  // Day 10: NIGHT→DAY
  scene('34', 'MORNING'),
  scene('35', 'DAY'),
  scene('36', 'NIGHT'),

  // Day 11: title card calendar date
  scene('37', 'DAY', [], { titleCard: 'FRIDAY, DECEMBER 3' }),
  scene('38', 'AFTERNOON'),
  scene('39', 'NIGHT'),

  // Day 12: NIGHT→DAY
  scene('40', 'DAY'),
  scene('41', 'CONTINUOUS'),
  scene('42', 'NIGHT'),

  // Day 13: "Dawn breaks"
  scene('43', 'DAWN', ['Dawn breaks over the valley.']),
  scene('44', 'DAY'),
  scene('45', 'NIGHT'),

  // Day 14: NIGHT→DAY
  scene('46', 'MORNING'),
  scene('47', 'DAY'),
  scene('48', 'EVENING'),
  scene('49', 'NIGHT'),

  // Day 15: "3 days later"
  scene('50', 'DAY', ['3 days later they arrived at the border.']),
  scene('51', 'NIGHT'),

  // Day 16: NIGHT→DAY
  scene('52', 'DAY'),
  scene('53', 'LATER'),
  scene('54', 'NIGHT'),

  // Day 17: title card large jump
  scene('55', 'DAY', [], { titleCard: 'SIX MONTHS LATER' }),
  scene('56', 'NIGHT'),

  // Day 18: NIGHT→DAY
  scene('57', 'MORNING'),
  scene('58', 'DAY'),
  scene('59', 'NIGHT'),

  // Day 19: "Later that night" = same day, then new day via NIGHT→MORNING
  scene('60', 'NIGHT', ['Later that night the fire burned low.']),
  scene('61', 'MORNING'),  // Day 20
  scene('62', 'DAY'),
  scene('63', 'NIGHT'),

  // Day 21: "One week later"
  scene('64', 'DAY', ['One week later the trial began.']),
  scene('65', 'NIGHT'),

  // Day 22: NIGHT→DAY
  scene('66', 'DAY'),
  scene('67', 'AFTERNOON'),
  scene('68', 'NIGHT'),

  // Day 23: moments later (same day), then NIGHT→DAY
  scene('69', 'NIGHT', ['Moments later he was gone.']),
  scene('70', 'MORNING'),  // Day 24
  scene('71', 'DAY'),
  scene('72', 'NIGHT'),

  // Day 25: action line "The next day"
  scene('73', 'DAY', ['The next day it was all over.']),
  scene('74', 'AFTERNOON'),
  scene('75', 'NIGHT'),

  // Extra: CONTINUOUS shouldn't break anything
  scene('76', 'CONTINUOUS'),
  scene('77', 'NIGHT'),
];

// ─── Run detection ──────────────────────────────────────────────────────────

const results = buildStoryDayMap(scenes);

// ─── Report ─────────────────────────────────────────────────────────────────

const dayCounts = new Map<string, number>();
for (const r of results) {
  dayCounts.set(r.label, (dayCounts.get(r.label) ?? 0) + 1);
}

console.log(`Total scenes processed: ${results.length}`);
console.log(`Unique story days: ${dayCounts.size}`);
console.log('\nDay → scene count:');
[...dayCounts.entries()]
  .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
  .forEach(([day, count]) => console.log(`  ${day.padEnd(30)} ${count} scenes`));

// Confidence breakdown
const confidenceCounts = { explicit: 0, inferred: 0, inherited: 0 };
for (const r of results) {
  confidenceCounts[r.confidence]++;
}
console.log('\nConfidence breakdown:');
console.log(`  explicit:  ${confidenceCounts.explicit}`);
console.log(`  inferred:  ${confidenceCounts.inferred}`);
console.log(`  inherited: ${confidenceCounts.inherited}`);

// Scenes needing review
const needsReview = results.filter(r => r.confidence === 'inferred' || r.confidence === 'inherited');
console.log(`\nScenes needing review: ${needsReview.length}`);
needsReview.forEach(r => console.log(`  Sc ${r.sceneNumber}: ${r.label} — ${r.signal}`));

// Flashbacks
const flashbacks = results.filter(r => r.timeline === 'non-present');
console.log(`\nFlashback scenes: ${flashbacks.length}`);
flashbacks.forEach(r => console.log(`  Sc ${r.sceneNumber}: ${r.label}`));

// Gap notes
const gaps = results.filter(r => r.gapNote);
console.log(`\nGap notes: ${gaps.length}`);
gaps.forEach(r => console.log(`  Sc ${r.sceneNumber}: ${r.label} — "${r.gapNote}"`));

// Full scene-by-scene log
console.log('\n─── Full scene log ───');
for (const r of results) {
  const flag = r.confidence !== 'explicit' ? ' ⚠' : '';
  console.log(`  Sc ${r.sceneNumber.padEnd(4)} ${r.label.padEnd(25)} [${r.confidence}]${flag}  ${r.signal}`);
}
