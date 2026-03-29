import { describe, it, expect } from 'vitest';
import {
  isNonPresent,
  actionLinesIndicateNonPresent,
  actionLinesIndicateEndFlashback,
  extractLocation,
  detectDialogueTimeCues,
  parseSlugline,
  buildStoryDayMap,
  type ParsedScene,
} from '../storyDayDetection';

/* ── Helper to build a minimal ParsedScene for buildStoryDayMap tests ── */

function scene(
  sceneNumber: string,
  slugline: string,
  actionLines: string[] = [],
): ParsedScene {
  return parseSlugline(slugline, parseInt(sceneNumber, 10) - 1, actionLines);
}

/* ━━━ isNonPresent (heading-only) ━━━ */

describe('isNonPresent (heading-only)', () => {
  it('detects FLASHBACK in heading', () => {
    expect(isNonPresent('INT. OFFICE - DAY (FLASHBACK)', 'DAY')).toBe(true);
  });

  it('detects [FLASHBACK] bracket notation', () => {
    expect(isNonPresent('INT. OFFICE - DAY [FLASHBACK]', 'DAY')).toBe(true);
  });

  it('detects MEMORY in TOD', () => {
    expect(isNonPresent('INT. OFFICE', 'NIGHT (MEMORY)')).toBe(true);
  });

  it('returns false for normal heading', () => {
    expect(isNonPresent('INT. OFFICE - DAY', 'DAY')).toBe(false);
  });
});

/* ━━━ actionLinesIndicateNonPresent ━━━ */

describe('actionLinesIndicateNonPresent', () => {
  it('detects "FLASHBACK" in action lines', () => {
    expect(actionLinesIndicateNonPresent(['FLASHBACK:', 'The room is dark.'])).toBe(true);
  });

  it('detects "FLASHBACK: 2 WEEKS AGO" in action lines', () => {
    expect(actionLinesIndicateNonPresent(['FLASHBACK: 2 WEEKS AGO'])).toBe(true);
  });

  it('detects "BEGIN FLASHBACK" in action lines', () => {
    expect(actionLinesIndicateNonPresent(['BEGIN FLASHBACK'])).toBe(true);
  });

  it('detects "FLASH BACK" (two words) in action lines', () => {
    expect(actionLinesIndicateNonPresent(['FLASH BACK TO:'])).toBe(true);
  });

  it('detects numeric time-ago: "10 YEARS AGO"', () => {
    expect(actionLinesIndicateNonPresent(['10 YEARS AGO'])).toBe(true);
  });

  it('detects numeric time-ago: "2 DAYS EARLIER"', () => {
    expect(actionLinesIndicateNonPresent(['2 DAYS EARLIER'])).toBe(true);
  });

  it('detects written time-ago: "THREE MONTHS AGO"', () => {
    expect(actionLinesIndicateNonPresent(['THREE MONTHS AGO'])).toBe(true);
  });

  it('detects written time-ago: "TWENTY YEARS EARLIER"', () => {
    expect(actionLinesIndicateNonPresent(['TWENTY YEARS EARLIER'])).toBe(true);
  });

  it('detects vague time-ago: "SEVERAL YEARS AGO"', () => {
    expect(actionLinesIndicateNonPresent(['SEVERAL YEARS AGO'])).toBe(true);
  });

  it('detects case-insensitively: "three months ago"', () => {
    expect(actionLinesIndicateNonPresent(['three months ago'])).toBe(true);
  });

  it('returns false for "END FLASHBACK"', () => {
    expect(actionLinesIndicateNonPresent(['END FLASHBACK'])).toBe(false);
  });

  it('returns false for "BACK TO PRESENT"', () => {
    expect(actionLinesIndicateNonPresent(['BACK TO PRESENT'])).toBe(false);
  });

  it('returns false for "RETURN TO PRESENT"', () => {
    expect(actionLinesIndicateNonPresent(['RETURN TO PRESENT'])).toBe(false);
  });

  it('returns false for normal action lines', () => {
    expect(actionLinesIndicateNonPresent(['John enters the room.', 'He looks around.'])).toBe(false);
  });

  it('only checks first 3 lines', () => {
    expect(actionLinesIndicateNonPresent([
      'Normal line 1',
      'Normal line 2',
      'Normal line 3',
      'FLASHBACK:',  // line 4 — should be ignored
    ])).toBe(false);
  });
});

/* ━━━ actionLinesIndicateEndFlashback ━━━ */

describe('actionLinesIndicateEndFlashback', () => {
  it('detects "END FLASHBACK"', () => {
    expect(actionLinesIndicateEndFlashback(['END FLASHBACK'])).toBe(true);
  });

  it('detects "BACK TO PRESENT"', () => {
    expect(actionLinesIndicateEndFlashback(['BACK TO PRESENT'])).toBe(true);
  });

  it('detects "RETURN TO PRESENT"', () => {
    expect(actionLinesIndicateEndFlashback(['RETURN TO PRESENT'])).toBe(true);
  });

  it('returns false for "FLASHBACK"', () => {
    expect(actionLinesIndicateEndFlashback(['FLASHBACK:'])).toBe(false);
  });

  it('returns false for normal action lines', () => {
    expect(actionLinesIndicateEndFlashback(['She walks out.'])).toBe(false);
  });
});

/* ━━━ parseSlugline integration: heading + action line detection ━━━ */

describe('parseSlugline non-present detection', () => {
  it('marks scene with FLASHBACK in heading as non-present', () => {
    const s = parseSlugline('INT. OFFICE - DAY (FLASHBACK)', 0, ['A dark room.']);
    expect(s.isNonPresent).toBe(true);
  });

  it('marks scene with normal heading but "FLASHBACK: 2 WEEKS AGO" in action as non-present', () => {
    const s = parseSlugline('INT. OFFICE - DAY', 0, ['FLASHBACK: 2 WEEKS AGO', 'The room is quiet.']);
    expect(s.isNonPresent).toBe(true);
  });

  it('marks scene with "three months ago" in action line as non-present', () => {
    const s = parseSlugline('EXT. PARK - DAY', 0, ['three months ago', 'Birds are singing.']);
    expect(s.isNonPresent).toBe(true);
  });

  it('marks scene with "END FLASHBACK" in action line as present even if heading says flashback', () => {
    const s = parseSlugline('INT. OFFICE - DAY (FLASHBACK)', 0, ['END FLASHBACK', 'Back in the office.']);
    expect(s.isNonPresent).toBe(false);
  });

  it('does not affect normal scene with no flashback markers', () => {
    const s = parseSlugline('INT. KITCHEN - NIGHT', 0, ['Sarah cooks dinner.', 'The phone rings.']);
    expect(s.isNonPresent).toBe(false);
  });
});

/* ━━━ buildStoryDayMap: flashback resume behaviour ━━━ */

describe('buildStoryDayMap flashback resume', () => {
  it('resumes present day counter after END FLASHBACK', () => {
    const scenes: ParsedScene[] = [
      scene('1', 'INT. OFFICE - DAY'),                                     // present Day 1
      scene('2', 'EXT. STREET - NIGHT'),                                   // present Day 1
      scene('3', 'INT. OFFICE - DAY', ['The next day,']),                   // present Day 2
      scene('4', 'INT. OLD HOUSE - DAY', ['FLASHBACK: 10 YEARS AGO']),     // non-present
      scene('5', 'EXT. GARDEN - DAY (FLASHBACK)'),                         // non-present (heading marker)
      scene('6', 'INT. OFFICE - DAY', ['END FLASHBACK']),                  // present — resume Day 2
      scene('7', 'EXT. PARK - NIGHT'),                                     // present Day 2 continues
    ];

    // Scene 4 should be detected as non-present via action line
    expect(scenes[3].isNonPresent).toBe(true);
    // Scene 5 should be non-present via heading
    expect(scenes[4].isNonPresent).toBe(true);
    // Scene 6 should be present (END FLASHBACK)
    expect(scenes[5].isNonPresent).toBe(false);

    const results = buildStoryDayMap(scenes);

    // Scene 1: present Day 1
    expect(results[0]).toMatchObject({ sceneNumber: '1', storyDay: 1, timeline: 'present' });
    // Scene 3: present Day 2 (action line "The next day,")
    expect(results[2]).toMatchObject({ sceneNumber: '3', storyDay: 2, timeline: 'present' });
    // Scene 4: non-present (flashback)
    expect(results[3]).toMatchObject({ sceneNumber: '4', timeline: 'non-present' });
    // Scene 5: non-present (continues flashback)
    expect(results[4]).toMatchObject({ sceneNumber: '5', timeline: 'non-present' });
    // Scene 6: present — Day 2 resumed (not Day 3)
    expect(results[5]).toMatchObject({ sceneNumber: '6', storyDay: 2, timeline: 'present' });
    // Scene 7: present — still Day 2
    expect(results[6]).toMatchObject({ sceneNumber: '7', storyDay: 2, timeline: 'present' });
  });

  it('resumes present day counter after BACK TO PRESENT', () => {
    const scenes: ParsedScene[] = [
      scene('1', 'INT. LIVING ROOM - DAY'),                                // present Day 1
      scene('2', 'INT. BEACH - DAY (FLASHBACK)'),                          // non-present
      scene('3', 'INT. LIVING ROOM - DAY', ['BACK TO PRESENT']),           // present — resume Day 1
    ];

    const results = buildStoryDayMap(scenes);

    expect(results[0]).toMatchObject({ storyDay: 1, timeline: 'present' });
    expect(results[1]).toMatchObject({ timeline: 'non-present' });
    expect(results[2]).toMatchObject({ storyDay: 1, timeline: 'present' });
  });

  it('does not increment present counter during flashback scenes', () => {
    const scenes: ParsedScene[] = [
      scene('1', 'INT. OFFICE - DAY'),                                     // present Day 1
      scene('2', 'INT. OFFICE - NIGHT'),                                   // present Day 1
      scene('3', 'INT. SCHOOL - DAY (FLASHBACK)'),                         // non-present
      scene('4', 'EXT. FIELD - NIGHT (FLASHBACK)'),                        // non-present
      scene('5', 'INT. CLASSROOM - DAY (FLASHBACK)'),                      // non-present (NIGHT→DAY in flashback)
      scene('6', 'INT. OFFICE - NIGHT', ['END FLASHBACK']),                // present resume Day 1
    ];

    const results = buildStoryDayMap(scenes);

    // Scene 1: Day 1 present
    expect(results[0]).toMatchObject({ storyDay: 1, timeline: 'present' });
    // Scenes 3-5: non-present flashback
    expect(results[2]).toMatchObject({ timeline: 'non-present' });
    expect(results[3]).toMatchObject({ timeline: 'non-present' });
    expect(results[4]).toMatchObject({ timeline: 'non-present' });
    // Scene 6: back to present, Day 1 resumed (not Day 2 from NIGHT→DAY regression)
    expect(results[5]).toMatchObject({ storyDay: 1, timeline: 'present' });
  });

  it('normal scenes with no flashback markers are not affected', () => {
    const scenes: ParsedScene[] = [
      scene('1', 'INT. OFFICE - DAY'),
      scene('2', 'EXT. STREET - NIGHT'),
      scene('3', 'INT. KITCHEN - DAY', ['The next morning,']),
    ];

    const results = buildStoryDayMap(scenes);

    expect(results[0]).toMatchObject({ storyDay: 1, timeline: 'present' });
    expect(results[1]).toMatchObject({ storyDay: 1, timeline: 'present' });
    expect(results[2]).toMatchObject({ storyDay: 2, timeline: 'present' });

    // None should be non-present
    expect(results.every(r => r.timeline === 'present')).toBe(true);
  });
});

/* ━━━ extractLocation helper ━━━ */

describe('extractLocation', () => {
  it('extracts location from standard slugline', () => {
    expect(extractLocation('INT. COFFEE SHOP - DAY')).toBe('COFFEE SHOP');
  });

  it('extracts location from numbered slugline', () => {
    expect(extractLocation('14 INT. COFFEE SHOP - NIGHT 14')).toBe('COFFEE SHOP');
  });

  it('handles EXT prefix', () => {
    expect(extractLocation('EXT. PARK - MORNING')).toBe('PARK');
  });

  it('handles INT/EXT prefix', () => {
    expect(extractLocation('INT./EXT. CAR - DAY')).toBe('CAR');
  });

  it('handles multi-segment location', () => {
    expect(extractLocation('INT. HOUSE - KITCHEN - NIGHT')).toBe('HOUSE - KITCHEN');
  });
});

/* ━━━ buildStoryDayMap: concurrent-thread detection ━━━ */

describe('buildStoryDayMap concurrent-thread detection', () => {
  it('does NOT increment for consecutive scenes in different locations with identical TOD', () => {
    // Cross-cutting: OFFICE and PARK both at NIGHT on the same day
    const scenes: ParsedScene[] = [
      scene('1', 'INT. OFFICE - NIGHT'),
      scene('2', 'EXT. PARK - NIGHT'),
      scene('3', 'INT. WAREHOUSE - NIGHT'),
    ];

    const results = buildStoryDayMap(scenes);

    expect(results[0]).toMatchObject({ storyDay: 1 });
    expect(results[1]).toMatchObject({ storyDay: 1 });
    expect(results[2]).toMatchObject({ storyDay: 1 });
  });

  it('does NOT increment when cutting back to a location seen earlier in the same day with same TOD', () => {
    // OFFICE at DAY → PARK at DAY → OFFICE at DAY (cut back)
    const scenes: ParsedScene[] = [
      scene('1', 'INT. OFFICE - DAY'),
      scene('2', 'EXT. PARK - DAY'),
      scene('3', 'INT. OFFICE - DAY'),
    ];

    const results = buildStoryDayMap(scenes);

    expect(results[0]).toMatchObject({ storyDay: 1 });
    expect(results[1]).toMatchObject({ storyDay: 1 });
    expect(results[2]).toMatchObject({ storyDay: 1 });
  });

  it('DOES increment for NIGHT→DAY regression in different locations (genuine new day)', () => {
    const scenes: ParsedScene[] = [
      scene('1', 'INT. OFFICE - NIGHT'),
      scene('2', 'EXT. PARK - DAY'),
    ];

    const results = buildStoryDayMap(scenes);

    expect(results[0]).toMatchObject({ storyDay: 1 });
    expect(results[1]).toMatchObject({ storyDay: 2 });
  });

  it('DOES increment for TOD regression in the SAME location', () => {
    // Same location, EVENING → DAY = time went backwards = new day
    const scenes: ParsedScene[] = [
      scene('1', 'INT. OFFICE - EVENING'),
      scene('2', 'INT. OFFICE - DAY'),
    ];

    const results = buildStoryDayMap(scenes);

    expect(results[0]).toMatchObject({ storyDay: 1 });
    expect(results[1]).toMatchObject({ storyDay: 2 });
  });

  it('DOES increment when Priority 1 fires even with different location (explicit marker)', () => {
    const scenes: ParsedScene[] = [
      scene('1', 'INT. OFFICE - DAY'),
      scene('2', 'EXT. PARK - DAY', ['The next day,']),
    ];

    const results = buildStoryDayMap(scenes);

    expect(results[0]).toMatchObject({ storyDay: 1 });
    expect(results[1]).toMatchObject({ storyDay: 2, confidence: 'explicit' });
  });

  it('does NOT increment for cross-cutting with general TOD regression', () => {
    // OFFICE at EVENING → PARK at DAY → OFFICE at EVENING
    // The PARK at DAY looks like a regression from EVENING, but OFFICE at DAY
    // was seen earlier this day, so it's concurrent.
    const scenes: ParsedScene[] = [
      scene('1', 'INT. OFFICE - DAY'),
      scene('2', 'EXT. PARK - EVENING'),
      scene('3', 'INT. OFFICE - DAY'),   // cut back to OFFICE+DAY — seen earlier this day
    ];

    const results = buildStoryDayMap(scenes);

    expect(results[0]).toMatchObject({ storyDay: 1 });
    expect(results[1]).toMatchObject({ storyDay: 1 });
    expect(results[2]).toMatchObject({ storyDay: 1 });  // concurrent, not regression
  });

  it('resets location tracking when day increments', () => {
    // Day 1: OFFICE at DAY. Day 2 (explicit): PARK at DAY.
    // Then OFFICE at DAY — this should NOT be treated as concurrent with Day 1,
    // because the day already advanced. It should stay on Day 2.
    const scenes: ParsedScene[] = [
      scene('1', 'INT. OFFICE - DAY'),
      scene('2', 'EXT. PARK - DAY', ['The next day,']),     // Day 2
      scene('3', 'INT. OFFICE - DAY'),                       // same TOD, diff location → concurrent on Day 2
    ];

    const results = buildStoryDayMap(scenes);

    expect(results[0]).toMatchObject({ storyDay: 1 });
    expect(results[1]).toMatchObject({ storyDay: 2 });
    expect(results[2]).toMatchObject({ storyDay: 2 });  // stays on Day 2, not Day 3
  });
});

/* ━━━ detectDialogueTimeCues ━━━ */

describe('detectDialogueTimeCues', () => {
  // ── Countdown / forward-reference phrases — MUST match ──

  it('matches "twenty-three days left"', () => {
    const result = detectDialogueTimeCues(['We have twenty-three days left.']);
    expect(result).not.toBe('');
    expect(result).toMatch(/TWENTY.THREE DAYS LEFT/i);
  });

  it('matches "only five more days"', () => {
    const result = detectDialogueTimeCues(['Only five more days.']);
    expect(result).not.toBe('');
    expect(result).toMatch(/ONLY FIVE MORE DAYS/i);
  });

  it('matches "see you on Friday"', () => {
    const result = detectDialogueTimeCues(["I'll see you on Friday."]);
    expect(result).not.toBe('');
    expect(result).toMatch(/SEE YOU ON FRIDAY/i);
  });

  it('matches "the funeral is tomorrow"', () => {
    const result = detectDialogueTimeCues(['The funeral is tomorrow.']);
    expect(result).not.toBe('');
    expect(result).toMatch(/THE FUNERAL IS TOMORROW/i);
  });

  it('matches "see you tomorrow"', () => {
    const result = detectDialogueTimeCues(['See you tomorrow!']);
    expect(result).not.toBe('');
    expect(result).toMatch(/SEE YOU TOMORROW/i);
  });

  it('matches "tomorrow morning"', () => {
    const result = detectDialogueTimeCues(["We leave tomorrow morning."]);
    expect(result).not.toBe('');
    expect(result).toMatch(/TOMORROW MORNING/i);
  });

  it('matches "3 days remaining"', () => {
    const result = detectDialogueTimeCues(['3 days remaining.']);
    expect(result).not.toBe('');
    expect(result).toMatch(/3 DAYS REMAINING/i);
  });

  it('matches "the trial is on Monday"', () => {
    const result = detectDialogueTimeCues(['The trial is on Monday.']);
    expect(result).not.toBe('');
    expect(result).toMatch(/THE TRIAL IS ON MONDAY/i);
  });

  // ── Backward-looking / elapsed-time phrases — must NOT match ──

  it('does NOT match "it\'s been three weeks since my dad died"', () => {
    expect(detectDialogueTimeCues(["It's been three weeks since my dad died."])).toBe('');
  });

  it('does NOT match "we\'ve been here two weeks"', () => {
    expect(detectDialogueTimeCues(["We've been here two weeks."])).toBe('');
  });

  it('does NOT match "two years ago we were happy"', () => {
    expect(detectDialogueTimeCues(['Two years ago we were happy.'])).toBe('');
  });

  it('does NOT match "back when you were a kid"', () => {
    expect(detectDialogueTimeCues(['Back when you were a kid.'])).toBe('');
  });

  it('does NOT match "it\'s been X days"', () => {
    expect(detectDialogueTimeCues(["It's been 5 days."])).toBe('');
  });

  it('does NOT match "been here X days"', () => {
    expect(detectDialogueTimeCues(["I've been here 3 days now."])).toBe('');
  });

  it('does NOT match "X days ago"', () => {
    expect(detectDialogueTimeCues(['10 days ago something happened.'])).toBe('');
  });

  it('does NOT match "X weeks ago"', () => {
    expect(detectDialogueTimeCues(['Three weeks ago I left.'])).toBe('');
  });

  it('does NOT match "I remember when"', () => {
    expect(detectDialogueTimeCues(['I remember when we had five days left.'])).toBe('');
  });

  // ── No cues present ──

  it('returns empty string when no cues present', () => {
    expect(detectDialogueTimeCues(['Hello John.', 'How are you?'])).toBe('');
  });
});

/* ━━━ buildStoryDayMap: dialogueTimeCue + needsReview wiring ━━━ */

describe('buildStoryDayMap dialogueTimeCue wiring', () => {
  it('sets needsReview and dialogueTimeCue when countdown phrase is in action lines', () => {
    const scenes: ParsedScene[] = [
      scene('1', 'INT. OFFICE - DAY'),
      scene('2', 'INT. KITCHEN - NIGHT', ['Only 5 days left.']),
    ];

    const results = buildStoryDayMap(scenes);

    expect(results[1].needsReview).toBe(true);
    expect(results[1].dialogueTimeCue).toMatch(/5 DAYS LEFT/i);
  });

  it('does not set needsReview when no cues present', () => {
    const scenes: ParsedScene[] = [
      scene('1', 'INT. OFFICE - DAY'),
      scene('2', 'INT. KITCHEN - NIGHT', ['She picks up the phone.']),
    ];

    const results = buildStoryDayMap(scenes);

    expect(results[1].needsReview).toBe(false);
    expect(results[1].dialogueTimeCue).toBe('');
  });

  it('does not change storyDay when dialogueTimeCue is detected', () => {
    const scenes: ParsedScene[] = [
      scene('1', 'INT. OFFICE - DAY'),
      scene('2', 'INT. KITCHEN - DAY', ['See you tomorrow!']),
    ];

    const results = buildStoryDayMap(scenes);

    // Both scenes should be Day 1 — same day, same TOD different location (concurrent)
    expect(results[0].storyDay).toBe(1);
    expect(results[1].storyDay).toBe(1);
    // But needsReview should be flagged
    expect(results[1].needsReview).toBe(true);
  });

  it('does not change confidence when dialogueTimeCue is detected', () => {
    const scenes: ParsedScene[] = [
      scene('1', 'INT. OFFICE - DAY'),
      scene('2', 'EXT. PARK - DAY', ['Only 3 days remaining.']),
    ];

    const results = buildStoryDayMap(scenes);

    // Confidence should be 'inherited' (no day change signal), not affected by the cue
    expect(results[1].confidence).toBe('inherited');
    expect(results[1].needsReview).toBe(true);
  });

  it('does not flag backward-looking dialogue in buildStoryDayMap', () => {
    const scenes: ParsedScene[] = [
      scene('1', 'INT. OFFICE - DAY'),
      scene('2', 'INT. KITCHEN - NIGHT', ["It's been two weeks since he left."]),
    ];

    const results = buildStoryDayMap(scenes);

    expect(results[1].needsReview).toBe(false);
    expect(results[1].dialogueTimeCue).toBe('');
  });
});
