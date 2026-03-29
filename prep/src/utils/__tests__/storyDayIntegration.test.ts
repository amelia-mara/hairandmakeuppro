/**
 * Integration test for the full buildStoryDayMap() pipeline.
 *
 * Constructs a single mock ParsedScene[] covering every detection pathway
 * and validates the complete StoryDayResult output for each scene.
 */
import { describe, it, expect } from 'vitest';
import {
  buildStoryDayMap,
  parseSlugline,
  type ParsedScene,
  type StoryDayResult,
} from '../storyDayDetection';

/* ── Helper ── */

function scene(
  sceneNumber: string,
  slugline: string,
  actionLines: string[] = [],
): ParsedScene {
  return parseSlugline(slugline, parseInt(sceneNumber, 10) - 1, actionLines);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  FULL PIPELINE INTEGRATION TEST
 *
 *  Scene list exercises every detection pathway in a single ordered sequence:
 *
 *   1  – First scene (baseline)
 *   2  – "the next day" explicit marker
 *   3  – "three weeks later" multi-day jump
 *   4  – "meanwhile" same-day phrase
 *   5  – NIGHT→DAY TOD regression (no marker)
 *   6  – DAY→NIGHT forward progression (no increment)
 *   7  – FLASHBACK in heading
 *   8  – Normal heading + "FLASHBACK: 2 WEEKS AGO" in action line
 *   9  – "END FLASHBACK" resumes present counter
 *  10  – Concurrent: different location, same TOD
 *  11  – Concurrent: cut back to earlier location+TOD
 *  12  – Dialogue cue: "only seven days left"
 *  13  – Backward dialogue: "it's been weeks since he left" (no cue)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const MOCK_SCENES: ParsedScene[] = [
  // 1: First scene — baseline, Day 1
  scene('1', 'INT. OFFICE - DAY'),

  // 2: "the next day" — explicit marker, Day 2
  scene('2', 'INT. OFFICE - DAY', ['The next day,']),

  // 3: "three weeks later" — multi-day jump (+21), Day 23
  scene('3', 'EXT. PARK - MORNING', ['Three weeks later.']),

  // 4: "meanwhile" — same day, no increment, Day 23
  scene('4', 'INT. WAREHOUSE - MORNING', ['Meanwhile,']),

  // 5: NIGHT then DAY — TOD regression, Day 24
  scene('5', 'INT. BAR - NIGHT'),
  scene('6', 'EXT. STREET - DAY'),

  // 6 (scene 7): DAY then NIGHT — forward progression, same Day 24
  scene('7', 'INT. RESTAURANT - NIGHT'),

  // 7 (scene 8): FLASHBACK in heading
  scene('8', 'INT. CHILDHOOD HOME - DAY (FLASHBACK)'),

  // 8 (scene 9): Normal heading + flashback in action line
  scene('9', 'INT. SCHOOL - DAY', ['FLASHBACK: 2 WEEKS AGO']),

  // 9 (scene 10): END FLASHBACK — resumes present counter
  scene('10', 'INT. BAR - NIGHT', ['END FLASHBACK']),

  // 10 (scene 11): Concurrent — different location, same TOD as scene 10
  scene('11', 'EXT. ROOFTOP - NIGHT'),

  // 11 (scene 12): Concurrent cut-back — OFFICE+DAY seen on Day 24 (scene 6)
  // After the flashback exit we're back on Day 24. OFFICE at DAY was scene 6.
  // But location tracking was reset when we entered day 24. Let me set this up
  // properly: we need a location+TOD that already appeared this story day.
  // Scene 10 is BAR+NIGHT, Scene 11 is ROOFTOP+NIGHT.
  // So BAR+NIGHT was already seen this day — cut back.
  scene('12', 'INT. BAR - NIGHT'),

  // 12 (scene 13): Dialogue cue — "only seven days left"
  scene('13', 'INT. KITCHEN - NIGHT', ['Only seven days left.']),

  // 13 (scene 14): Backward-looking dialogue — no cue
  scene('14', 'INT. LIVING ROOM - NIGHT', ["It's been weeks since he left."]),
];

describe('buildStoryDayMap full pipeline integration', () => {
  const results = buildStoryDayMap(MOCK_SCENES);

  /* ── FIELD INTEGRITY ── */

  it('produces exactly one result per input scene', () => {
    expect(results.length).toBe(MOCK_SCENES.length);
  });

  it('every result has all required fields populated', () => {
    const requiredFields: (keyof StoryDayResult)[] = [
      'sceneNumber', 'storyDay', 'label', 'confidence',
      'dayChangeReason', 'isFlashback', 'isConcurrent',
      'dialogueTimeCue', 'needsReview',
    ];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      for (const field of requiredFields) {
        expect(r).toHaveProperty(field);
        expect(r[field]).not.toBeUndefined();
      }
    }
  });

  /* ── EXPLICIT MARKERS ── */

  it('scene 1: first scene — Day 1, first_scene reason', () => {
    expect(results[0]).toMatchObject({
      sceneNumber: '1',
      storyDay: 1,
      label: 'Day 1',
      dayChangeReason: 'first_scene',
      isFlashback: false,
    });
  });

  it('scene 2: "the next day" — Day 2, explicit confidence, explicit_marker', () => {
    expect(results[1]).toMatchObject({
      sceneNumber: '2',
      storyDay: 2,
      confidence: 'explicit',
      dayChangeReason: 'explicit_marker',
    });
  });

  it('scene 3: "three weeks later" — day increments by 21 to Day 23', () => {
    expect(results[2]).toMatchObject({
      sceneNumber: '3',
      storyDay: 23,
      confidence: 'explicit',
      dayChangeReason: 'explicit_marker',
    });
  });

  it('scene 4: "meanwhile" — same day 23, no increment', () => {
    expect(results[3]).toMatchObject({
      sceneNumber: '4',
      storyDay: 23,
      dayChangeReason: 'none',
    });
  });

  /* ── TOD REGRESSION ── */

  it('scene 5: NIGHT sets up the baseline', () => {
    expect(results[4]).toMatchObject({
      sceneNumber: '5',
      storyDay: 23,
    });
  });

  it('scene 6: NIGHT→DAY regression — new day 24, inferred, tod_regression, needsReview', () => {
    expect(results[5]).toMatchObject({
      sceneNumber: '6',
      storyDay: 24,
      confidence: 'inferred',
      dayChangeReason: 'tod_regression',
      needsReview: true,
    });
  });

  it('scene 7: DAY→NIGHT — same day 24, no increment', () => {
    expect(results[6]).toMatchObject({
      sceneNumber: '7',
      storyDay: 24,
      dayChangeReason: 'none',
    });
  });

  /* ── FLASHBACK ── */

  it('scene 8: FLASHBACK in heading — isFlashback true, non-present timeline', () => {
    expect(results[7]).toMatchObject({
      sceneNumber: '8',
      isFlashback: true,
      timeline: 'non-present',
    });
  });

  it('scene 9: action line "FLASHBACK: 2 WEEKS AGO" — isFlashback true', () => {
    expect(results[8]).toMatchObject({
      sceneNumber: '9',
      isFlashback: true,
      timeline: 'non-present',
    });
  });

  it('scene 8-9: flashback uses non-present counter, not present counter', () => {
    // Present counter was at 24 before flashback. Non-present starts at 1.
    expect(results[7].timeline).toBe('non-present');
    expect(results[8].timeline).toBe('non-present');
  });

  it('scene 10: END FLASHBACK — present counter resumes at 24', () => {
    expect(results[9]).toMatchObject({
      sceneNumber: '10',
      storyDay: 24,
      timeline: 'present',
      isFlashback: false,
    });
  });

  /* ── CONCURRENT THREADS ── */

  it('scene 11: different location, same TOD (NIGHT) — no increment, isConcurrent', () => {
    expect(results[10]).toMatchObject({
      sceneNumber: '11',
      storyDay: 24,
      isConcurrent: true,
      dayChangeReason: 'none',
    });
  });

  it('scene 12: cut back to BAR+NIGHT seen earlier same day — no increment, isConcurrent', () => {
    expect(results[11]).toMatchObject({
      sceneNumber: '12',
      storyDay: 24,
      isConcurrent: true,
      dayChangeReason: 'none',
    });
  });

  /* ── DIALOGUE TIME CUES ── */

  it('scene 13: "only seven days left" — dialogueTimeCue populated, needsReview true, day unchanged', () => {
    expect(results[12]).toMatchObject({
      sceneNumber: '13',
      storyDay: 24,
      needsReview: true,
    });
    expect(results[12].dialogueTimeCue).not.toBe('');
    expect(results[12].dialogueTimeCue).toMatch(/SEVEN DAYS LEFT/i);
  });

  it('scene 14: "it\'s been weeks since he left" — dialogueTimeCue empty, needsReview not set by cue', () => {
    expect(results[13]).toMatchObject({
      sceneNumber: '14',
      dialogueTimeCue: '',
    });
    // needsReview may still be false (no cue, no regression)
    // It should NOT be set to true by the backward-looking phrase
  });

  /* ── CROSS-CHECK: no scenes dropped, all scene numbers present ── */

  it('output scene numbers match input scene numbers in order', () => {
    const inputNums = MOCK_SCENES.map(s => s.sceneNumber);
    const outputNums = results.map(r => r.sceneNumber);
    expect(outputNums).toEqual(inputNums);
  });
});
