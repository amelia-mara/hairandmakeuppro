/**
 * Infer the breakdown form's Timeline → Type value from the script's
 * own markers. Most screenplays signal a non-present-day scene either
 * with a bracketed tag at the end of the slugline ("INT. ROOM - DAY
 * [FLASHBACK]"), an inline temporal phrase, or a title card on the
 * line above the heading. This helper looks at all three signals and
 * returns the matching dropdown option:
 *
 *   "Flashback" | "Flash Fwd" | "Present" | "Dream" | "Montage"
 *   | "Time Jump" | ""
 *
 * Empty string when nothing matches — the user can still pick the
 * type manually.
 */

const PATTERNS: Array<[RegExp, string]> = [
  // Bracketed tags at end of slugline / on a line above
  [/\[\s*FLASH\s*FORWARD\s*\]|\[\s*FLASH\s*FWD\s*\]/i, 'Flash Fwd'],
  [/\[\s*FLASHBACK\s*\]|\[\s*FLASH\s*BACK\s*\]/i, 'Flashback'],
  [/\[\s*PRESENT(?:\s+DAY)?\s*\]/i, 'Present'],
  [/\[\s*DREAM(?:\s+SEQUENCE)?\s*\]/i, 'Dream'],
  [/\[\s*MONTAGE\s*\]/i, 'Montage'],
  [/\[\s*TIME\s*JUMP\s*\]/i, 'Time Jump'],

  // Slugline phrases without brackets — order matters: the more
  // specific multi-word forms before the bare keyword.
  [/\bFLASH\s+FORWARD\b/i, 'Flash Fwd'],
  [/\bFLASH\s+FWD\b/i, 'Flash Fwd'],
  [/\bBACK\s+TO\s+PRESENT\b|\bRETURN\s+TO\s+PRESENT\b|\bSNAP\s+(?:BACK\s+)?TO\s+PRESENT\b|\bIN\s+THE\s+PRESENT\b/i, 'Present'],
  [/\bDREAM\s+SEQUENCE\b/i, 'Dream'],
  [/\bMONTAGE\s+SEQUENCE\b|\bTRAINING\s+MONTAGE\b|\bMUSIC\s+MONTAGE\b/i, 'Montage'],
  [/\bTIME\s+JUMP\b/i, 'Time Jump'],
  [/\bFLASH\s*BACK\b|\bFLASHBACK\b/i, 'Flashback'],
  [/\b(?:END\s+)?MONTAGE\b/i, 'Montage'],
];

export function inferTimelineType(...signals: Array<string | null | undefined>): string {
  const haystack = signals.filter((s): s is string => !!s).join('\n');
  if (!haystack) return '';
  for (const [re, label] of PATTERNS) {
    if (re.test(haystack)) return label;
  }
  return '';
}
