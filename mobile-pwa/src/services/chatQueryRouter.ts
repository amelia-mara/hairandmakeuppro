/**
 * Chat Query Router — parses user messages into structured intents
 * and executes the correct data-service queries.
 */

import * as ds from './chatDataService';

// ─── Intent types ──────────────────────────────────────────────────

export type QueryIntent =
  | 'schedule_today'
  | 'schedule_day'
  | 'schedule_scene'
  | 'continuity_capture'
  | 'continuity_character'
  | 'continuity_scene'
  | 'character_scenes'
  | 'character_looks'
  | 'character_list'
  | 'scene_list'
  | 'timesheet_day'
  | 'timesheet_summary'
  | 'budget_summary'
  | 'budget_receipts'
  | 'team_members'
  | 'project_info'
  | 'callsheet_today'
  | 'capture_progress'
  | 'unknown';

export interface ParsedQuery {
  intent: QueryIntent;
  parameters: {
    characterName?: string;
    sceneNumber?: string;
    date?: string;
    dayNumber?: number;
    category?: string;
  };
}

// ─── Known character / scene cache ─────────────────────────────────

/** Retrieve lowered character names from the project for entity extraction. */
function getKnownCharacters(): string[] {
  const result = ds.getCharacterList();
  return result.success && result.data
    ? result.data.map((c) => c.name.toLowerCase())
    : [];
}

function getKnownSceneNumbers(): string[] {
  const result = ds.getSceneList();
  return result.success && result.data
    ? result.data.map((s) => s.sceneNumber.toLowerCase())
    : [];
}

// ─── Entity extraction ─────────────────────────────────────────────

/** Try to pull a scene number from the message. */
function extractSceneNumber(msg: string): string | undefined {
  // "scene 4A", "sc 4A", "sc4a", "scene 152", "#4A"
  const m = msg.match(/(?:scene|sc\.?|#)\s*(\d+[a-z]?\b)/i);
  if (m) return m[1].toUpperCase();

  // Check for bare known scene numbers only if they appear as whole words
  const known = getKnownSceneNumbers();
  for (const sn of known) {
    const rx = new RegExp(`\\b${sn}\\b`, 'i');
    if (rx.test(msg)) return sn.toUpperCase();
  }
  return undefined;
}

/** Try to pull a character name from the message. */
function extractCharacterName(msg: string): string | undefined {
  const lower = msg.toLowerCase();
  const known = getKnownCharacters();
  // Longest-first so "Mary Jane" matches before "Mary"
  const sorted = [...known].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (lower.includes(name)) {
      // Return original casing from the store
      const result = ds.getCharacterList();
      const original = result.data?.find((c) => c.name.toLowerCase() === name);
      return original?.name ?? name;
    }
  }
  return undefined;
}

/** Try to pull a day number ("day 5", "day5"). */
function extractDayNumber(msg: string): number | undefined {
  const m = msg.match(/\bday\s*(\d+)\b/i);
  return m ? parseInt(m[1], 10) : undefined;
}

/** Try to pull an ISO date or a weekday name and resolve to ISO. */
function extractDate(msg: string): string | undefined {
  // ISO date in the message
  const iso = msg.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  // Relative: "today", "yesterday", "tomorrow"
  const lower = msg.toLowerCase();
  const now = new Date();
  if (lower.includes('today')) return now.toISOString().split('T')[0];
  if (lower.includes('yesterday')) {
    now.setDate(now.getDate() - 1);
    return now.toISOString().split('T')[0];
  }
  if (lower.includes('tomorrow')) {
    now.setDate(now.getDate() + 1);
    return now.toISOString().split('T')[0];
  }

  // Weekday names — resolve to the most recent occurrence
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < weekdays.length; i++) {
    if (lower.includes(weekdays[i])) {
      const today = new Date();
      const diff = (today.getDay() - i + 7) % 7 || 7; // days ago
      today.setDate(today.getDate() - diff);
      return today.toISOString().split('T')[0];
    }
  }
  return undefined;
}

function extractCategory(msg: string): string | undefined {
  const cats = ['kit supplies', 'consumables', 'transportation', 'equipment'];
  const lower = msg.toLowerCase();
  return cats.find((c) => lower.includes(c));
}

// ─── Intent classification ─────────────────────────────────────────

const INTENT_PATTERNS: { intent: QueryIntent; patterns: RegExp[] }[] = [
  // Schedule
  {
    intent: 'schedule_today',
    patterns: [
      /what(?:'s| is) filming today/i,
      /today(?:'s)? schedule/i,
      /what(?:'s| are)? (?:we )?shoot(?:ing)? today/i,
      /what(?:'s| is) on today/i,
    ],
  },
  {
    intent: 'callsheet_today',
    patterns: [
      /today(?:'s)? call\s?sheet/i,
      /call\s?sheet/i,
      /show (?:me )?(?:the )?call\s?sheet/i,
    ],
  },
  {
    intent: 'schedule_scene',
    patterns: [
      /when (?:do|are) we shoot(?:ing)? scene/i,
      /when is scene/i,
      /what day (?:is|do we shoot) scene/i,
      /scene.*(?:shooting|schedule|when)/i,
    ],
  },
  {
    intent: 'schedule_day',
    patterns: [
      /what(?:'s| is) (?:on|filming|shooting) (?:on )?day\s?\d/i,
      /day\s?\d+.*schedule/i,
      /what(?:'s| is) (?:on|filming|shooting) (?:on )?\w+day/i,
    ],
  },

  // Continuity
  {
    intent: 'continuity_capture',
    patterns: [
      /continuity (?:for|of)\s/i,
      /what was captured for/i,
      /capture(?:d|s)? for/i,
    ],
  },
  {
    intent: 'continuity_character',
    patterns: [
      /(?:all )?captures? for/i,
      /continuity (?:notes?|history|so far)/i,
    ],
  },
  {
    intent: 'continuity_scene',
    patterns: [
      /scene.*captures?/i,
      /what(?:'s| was) captured (?:in|for) scene/i,
    ],
  },
  {
    intent: 'capture_progress',
    patterns: [
      /capture progress/i,
      /how (?:much|many) (?:is|have been) captured/i,
      /continuity progress/i,
    ],
  },

  // Characters & looks
  {
    intent: 'character_scenes',
    patterns: [
      /what scenes (?:is|does|are)/i,
      /scenes? for/i,
      /which scenes/i,
    ],
  },
  {
    intent: 'character_looks',
    patterns: [
      /looks? (?:for|does|of)/i,
      /what looks/i,
      /(?:need|require).*(?:makeup|hair|sfx)/i,
      /special (?:makeup|hair)/i,
      /does.*need.*(?:makeup|hair)/i,
    ],
  },
  {
    intent: 'character_list',
    patterns: [/(?:list|all|show) (?:the )?characters/i, /who(?:'s| is) in (?:the|this) (?:project|production)/i],
  },
  {
    intent: 'scene_list',
    patterns: [/(?:list|all|show|how many) (?:the )?scenes/i],
  },

  // Timesheet
  {
    intent: 'timesheet_day',
    patterns: [
      /what time (?:did|do) we (?:start|wrap|call)/i,
      /timesheet (?:for|on)/i,
      /hours (?:for|on)/i,
    ],
  },
  {
    intent: 'timesheet_summary',
    patterns: [
      /how many hours/i,
      /timesheet summary/i,
      /total (?:hours|earnings)/i,
      /overtime/i,
    ],
  },

  // Budget
  {
    intent: 'budget_summary',
    patterns: [
      /budget/i,
      /how much (?:remaining|left|spent)/i,
      /spend(?:ing)?/i,
      /float/i,
    ],
  },
  {
    intent: 'budget_receipts',
    patterns: [/receipts?/i, /expenses?/i, /recent (?:spend|purchases)/i],
  },

  // Team / project
  {
    intent: 'team_members',
    patterns: [/(?:who(?:'s| is)|show) (?:on )?(?:the )?team/i, /team members?/i, /crew/i],
  },
  {
    intent: 'project_info',
    patterns: [/project (?:info|details|summary|overview)/i, /how many (?:scenes|characters)/i],
  },
];

// ─── Public API ────────────────────────────────────────────────────

export function parseUserQuery(message: string): ParsedQuery {
  const charName = extractCharacterName(message);
  const sceneNum = extractSceneNumber(message);
  const dayNum = extractDayNumber(message);
  const date = extractDate(message);
  const category = extractCategory(message);

  // Walk the pattern list — first match wins
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((p) => p.test(message))) {
      // Refine some intents based on extracted entities
      let refined = intent;

      // If the matched intent is continuity_capture but we only have a char, not a scene
      if (intent === 'continuity_capture' && charName && !sceneNum) {
        refined = 'continuity_character';
      }
      // If asking about scenes for a character
      if (intent === 'character_scenes' && !charName && sceneNum) {
        refined = 'continuity_scene';
      }

      return {
        intent: refined,
        parameters: {
          characterName: charName,
          sceneNumber: sceneNum,
          dayNumber: dayNum,
          date,
          category,
        },
      };
    }
  }

  // Fallback: if we extracted a character name and scene, guess continuity
  if (charName && sceneNum) {
    return { intent: 'continuity_capture', parameters: { characterName: charName, sceneNumber: sceneNum } };
  }
  if (charName) {
    return { intent: 'character_looks', parameters: { characterName: charName } };
  }
  if (sceneNum) {
    return { intent: 'continuity_scene', parameters: { sceneNumber: sceneNum } };
  }

  return { intent: 'unknown', parameters: {} };
}

/**
 * Run the right data-service calls for a parsed intent and return
 * a concise text block that becomes the [DATA CONTEXT] in the LLM prompt.
 */
export function executeQuery(parsed: ParsedQuery): string {
  const { intent, parameters: p } = parsed;

  switch (intent) {
    // ── Schedule ────────────────────────────────────────────
    case 'schedule_today': {
      const cs = ds.getTodaysCallSheet();
      if (cs.success && cs.data) {
        return `Today's call sheet (Day ${cs.data.productionDay}, ${cs.data.date}):\nCall: ${cs.data.unitCallTime} | Est. wrap: ${cs.data.wrapEstimate}\nScenes: ${cs.data.scenes.join(', ')}\n${cs.data.weather ? `Weather: ${cs.data.weather}` : ''}`.trim();
      }
      const sched = ds.getTodaysSchedule();
      if (sched.success && sched.data) {
        return `Today's schedule (Day ${sched.data.dayNumber}, ${sched.data.date}):\nScenes: ${sched.data.scenes.join(', ')}\nLocation: ${sched.data.location}\nHours: ${sched.data.hours}`;
      }
      return 'No call sheet or schedule data for today.';
    }

    case 'callsheet_today': {
      const cs = ds.getTodaysCallSheet();
      if (!cs.success || !cs.data) return 'No call sheet uploaded for today.';
      const d = cs.data;
      const lines = [
        `Call Sheet — Day ${d.productionDay} (${d.date})`,
        `Unit call: ${d.unitCallTime}`,
        d.wrapEstimate ? `Est. wrap: ${d.wrapEstimate}` : '',
        `Scenes (${d.sceneCount}): ${d.scenes.join(', ')}`,
        d.weather ? `Weather: ${d.weather}` : '',
      ];
      if (d.castCalls.length > 0) {
        lines.push('Cast calls:');
        d.castCalls.forEach((c) => lines.push(`  ${c.name} (${c.character}) — ${c.callTime}`));
      }
      if (d.notes.length > 0) lines.push(`Notes: ${d.notes.join('; ')}`);
      return lines.filter(Boolean).join('\n');
    }

    case 'schedule_scene': {
      if (!p.sceneNumber) return 'Please specify a scene number.';
      const r = ds.getSceneShootingDay(p.sceneNumber);
      if (!r.success || !r.data) return r.error ?? `Scene ${p.sceneNumber} not found in schedule.`;
      return `Scene ${p.sceneNumber} → Day ${r.data.dayNumber}${r.data.date ? ` (${r.data.date})` : ''}, ${r.data.location}`;
    }

    case 'schedule_day': {
      if (p.dayNumber) {
        const r = ds.getShootingDay(p.dayNumber);
        if (!r.success || !r.data) return r.error ?? `Day ${p.dayNumber} not in schedule.`;
        const d = r.data;
        return `Day ${d.dayNumber}${d.date ? ` (${d.date})` : ''}:\nScenes: ${d.scenes.join(', ')}\nLocation: ${d.location}\nHours: ${d.hours}`;
      }
      if (p.date) {
        const r = ds.getShootingDayByDate(p.date);
        if (!r.success || !r.data) return r.error ?? `No shooting day on ${p.date}.`;
        const d = r.data;
        return `Day ${d.dayNumber} (${d.date}):\nScenes: ${d.scenes.join(', ')}\nLocation: ${d.location}\nHours: ${d.hours}`;
      }
      return 'Please specify a day number or date.';
    }

    // ── Continuity captures ─────────────────────────────────
    case 'continuity_capture': {
      if (!p.characterName || !p.sceneNumber) return 'Please specify both a character and scene number.';
      const r = ds.getContinuityCapture(p.characterName, p.sceneNumber);
      if (!r.success || !r.data) return r.error ?? 'No capture found.';
      const c = r.data;
      const lines = [
        `Scene ${c.sceneNumber} — ${c.characterName}:`,
        c.flags.length ? `Flags: ${c.flags.join(', ')}` : 'Flags: none',
        c.generalNotes ? `Notes: ${c.generalNotes}` : 'Notes: none',
        `Photos: ${c.photoCount} captured`,
      ];
      return lines.join('\n');
    }

    case 'continuity_character': {
      if (!p.characterName) return 'Please specify a character name.';
      const r = ds.getCharacterCaptures(p.characterName);
      if (!r.success || !r.data) return r.error ?? 'No captures found.';
      if (r.data.length === 0) return `No continuity captured for ${p.characterName} yet.`;
      const lines = [`${p.characterName} — ${r.data.length} capture(s):`];
      r.data.forEach((c) => {
        const f = c.flags.length ? ` [${c.flags.join(', ')}]` : '';
        lines.push(`  Sc ${c.sceneNumber}: ${c.photoCount} photos${f}`);
      });
      return lines.join('\n');
    }

    case 'continuity_scene': {
      if (!p.sceneNumber) return 'Please specify a scene number.';
      const r = ds.getSceneCaptures(p.sceneNumber);
      if (!r.success || !r.data) return r.error ?? 'No captures found.';
      if (r.data.length === 0) return `No continuity captured for scene ${p.sceneNumber} yet.`;
      const lines = [`Scene ${p.sceneNumber} — ${r.data.length} capture(s):`];
      r.data.forEach((c) => {
        const f = c.flags.length ? ` [${c.flags.join(', ')}]` : '';
        lines.push(`  ${c.characterName}: ${c.photoCount} photos${f}`);
      });
      return lines.join('\n');
    }

    case 'capture_progress': {
      const r = ds.getCaptureProgress();
      if (!r.success || !r.data) return r.error ?? 'Cannot calculate progress.';
      const pct = r.data.total > 0 ? Math.round((r.data.captured / r.data.total) * 100) : 0;
      return `Capture progress: ${r.data.captured}/${r.data.total} (${pct}%) — ${r.data.pending} remaining`;
    }

    // ── Characters & looks ──────────────────────────────────
    case 'character_scenes': {
      if (!p.characterName) return 'Please specify a character name.';
      const r = ds.getCharacterScenes(p.characterName);
      if (!r.success || !r.data) return r.error ?? 'Character not found.';
      return `${p.characterName} appears in ${r.data.length} scene(s): ${r.data.map((s) => s.sceneNumber).join(', ')}`;
    }

    case 'character_looks': {
      if (!p.characterName) return 'Please specify a character name.';
      const r = ds.getCharacterLooks(p.characterName);
      if (!r.success || !r.data) return r.error ?? 'Character not found.';
      if (r.data.length === 0) return `No looks defined for ${p.characterName}.`;
      const lines = [`${p.characterName} — ${r.data.length} look(s):`];
      r.data.forEach((l) => {
        const sceneList = l.scenes.length > 0 ? ` (scenes: ${l.scenes.join(', ')})` : '';
        const sfx = l.sfxDetails?.sfxRequired ? ' [SFX]' : '';
        lines.push(`  "${l.name}" — ${l.estimatedTime}min${sfx}${sceneList}`);
      });
      return lines.join('\n');
    }

    case 'character_list': {
      const r = ds.getCharacterList();
      if (!r.success || !r.data) return r.error ?? 'No characters.';
      return `${r.data.length} character(s): ${r.data.map((c) => c.name).join(', ')}`;
    }

    case 'scene_list': {
      const r = ds.getSceneList();
      if (!r.success || !r.data) return r.error ?? 'No scenes.';
      const completed = r.data.filter((s) => s.isComplete).length;
      return `${r.data.length} scene(s) (${completed} complete). Numbers: ${r.data.map((s) => s.sceneNumber).join(', ')}`;
    }

    // ── Timesheet ───────────────────────────────────────────
    case 'timesheet_day': {
      const date = p.date || new Date().toISOString().split('T')[0];
      const r = ds.getDayTimesheet(date);
      if (!r.success || !r.data) return r.error ?? `No timesheet for ${date}.`;
      const e = r.data.entry;
      return `Timesheet ${date}:\nPre-call: ${e.preCall || '—'} | Unit call: ${e.unitCall || '—'} | Wrap: ${e.wrapOut || '—'}\nHours: ${r.data.hours}h | Earnings: £${r.data.earnings}`;
    }

    case 'timesheet_summary': {
      const r = ds.getTimesheetSummary();
      if (!r.success || !r.data) return r.error ?? 'No timesheet data.';
      const d = r.data;
      return `Timesheet summary:\n${d.totalDays} day(s) logged | ${d.totalHours}h total | ${d.overtimeHours}h overtime\nTotal earnings: £${d.totalEarnings}`;
    }

    // ── Budget ──────────────────────────────────────────────
    case 'budget_summary': {
      const r = ds.getBudgetSummary();
      if (!r.success || !r.data) return r.error ?? 'No budget data.';
      const d = r.data;
      return `Budget: ${d.currency} ${d.total} total\nSpent: ${d.currency} ${d.spent} across ${d.receiptCount} receipt(s)\nRemaining: ${d.currency} ${d.remaining}`;
    }

    case 'budget_receipts': {
      const r = ds.getReceipts(p.category);
      if (!r.success || !r.data) return r.error ?? 'No receipts.';
      if (r.data.length === 0) return p.category ? `No receipts in category "${p.category}".` : 'No receipts recorded.';
      const lines = [`${r.data.length} receipt(s)${p.category ? ` in "${p.category}"` : ''}:`];
      r.data.slice(0, 10).forEach((r) => {
        lines.push(`  ${r.date} — ${r.vendor}: £${r.amount} (${r.category})`);
      });
      if (r.data.length > 10) lines.push(`  ... and ${r.data.length - 10} more`);
      return lines.join('\n');
    }

    // ── Team / project ──────────────────────────────────────
    case 'team_members': {
      const r = ds.getTeamMembers();
      if (!r.success || !r.data) return r.error ?? 'No team data.';
      const lines = [`${r.data.length} team member(s):`];
      r.data.forEach((m) => {
        lines.push(`  ${m.name} — ${m.role}${m.isOwner ? ' (owner)' : ''}`);
      });
      return lines.join('\n');
    }

    case 'project_info': {
      const r = ds.getProjectInfo();
      if (!r.success || !r.data) return r.error ?? 'No project loaded.';
      const d = r.data;
      return `Project: ${d.name}\nScenes: ${d.sceneCount} (${d.completedScenes} complete)\nCharacters: ${d.characterCount}\nLooks: ${d.lookCount}`;
    }

    case 'unknown':
    default:
      // Provide basic project context so the LLM can still attempt an answer
      const info = ds.getProjectInfo();
      if (info.success && info.data) {
        return `Project: ${info.data.name} | ${info.data.sceneCount} scenes, ${info.data.characterCount} characters, ${info.data.lookCount} looks`;
      }
      return 'No specific data matched for this query.';
  }
}
