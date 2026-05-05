/**
 * Character extraction utilities for screenplay parsing.
 *
 * Two-tier model:
 *   Tier 1 — Speakers: a real character has at least one well-formed dialogue
 *            cue (an ALL CAPS name on its own line followed by dialogue).
 *            Speakers become tracked Character profiles.
 *   Tier 2 — Background: per-scene labels for non-speaking presence
 *            ("PASSER BY", "ELDERLY PATIENT"). Listed on the scene only;
 *            never become Character profiles.
 *
 * The structural cue check (`extractCueLines`) is the heart of the system —
 * it's deliberately permissive about NAMES (any uppercase word combo) but
 * strict about CONTEXT (must be followed by dialogue, not by another action
 * paragraph or scene heading). That combination keeps it generic across
 * scripts while filtering out ALL-CAPS noise like "ELEVEN MISSING DAYS",
 * "SUPER: BASED ON TRUE EVENTS", "THE END", etc.
 */

// Cue-extension parentheticals that are part of the cue, not dialogue:
// (V.O.) (V/O) (O.S.) (O/S) (CONT'D) (CONTD) (CONT.) (O.C.) (MORE) (PRE-LAP)
const CUE_PARENS = /\((?:V\.?\s*O\.?|O\.?\s*S\.?|O\.?\s*C\.?|CONT['’]?D|CONT\.?|MORE|PRE[-\s]?LAP|FILTERED|ON\s+PHONE|INTO\s+PHONE|2|3|\d+)\)/gi;

// Words that should never be treated as character names. Used to reject
// whole-line cues whose "name" is a single such word (e.g. "MORE", "END").
const RESERVED_LINE_WORDS = new Set([
  'INT', 'EXT', 'CUT', 'TO', 'FADE', 'IN', 'OUT', 'DISSOLVE',
  'MORE', 'CONTINUED', 'CONTD', 'OMITTED',
  'TITLE', 'SUPER', 'CHYRON', 'CARD', 'INSERT', 'CAPTION', 'SUBTITLE',
  'INTERCUT', 'MONTAGE', 'FLASHBACK', 'FLASHFORWARD',
  'BACK', 'RESUME', 'ANGLE', 'CLOSE', 'WIDE', 'POV',
  'LATER', 'CONTINUOUS', 'PRESENT', 'PRESENTDAY', 'MEANWHILE',
  'PROLOGUE', 'EPILOGUE', 'CHAPTER', 'PART', 'ACT', 'SCENE', 'PILOT',
  'END', 'ENDS', 'BLACK', 'WHITE',
]);

// Person-descriptor lexicon used by background detection. Kept generic enough
// to work on any script — it covers the most common "the X" / "another X"
// roles that appear in action lines as background presence.
const PERSON_DESCRIPTORS = new Set([
  'MAN', 'WOMAN', 'MEN', 'WOMEN', 'BOY', 'GIRL', 'BOYS', 'GIRLS',
  'PERSON', 'PEOPLE', 'KID', 'KIDS', 'CHILD', 'CHILDREN', 'TEEN', 'TEENAGER',
  'BABY', 'INFANT', 'TODDLER', 'YOUTH', 'ADULT', 'ELDER',
  'GUY', 'GUYS', 'LADY', 'LADIES', 'STRANGER', 'FIGURE', 'CROWD',
  'NURSE', 'DOCTOR', 'SURGEON', 'PATIENT', 'PARAMEDIC', 'MEDIC', 'ORDERLY',
  'COP', 'COPS', 'OFFICER', 'DETECTIVE', 'AGENT', 'GUARD', 'SOLDIER', 'TROOP',
  'TROOPS', 'WARRIOR', 'WARRIORS', 'KNIGHT', 'CAPTAIN', 'LIEUTENANT', 'SERGEANT',
  'CORPORAL', 'PRIVATE', 'COLONEL', 'GENERAL', 'COMMANDER', 'CHIEF',
  'KING', 'QUEEN', 'PRINCE', 'PRINCESS', 'LORD', 'LADY', 'DUKE',
  'PRIEST', 'PASTOR', 'NUN', 'MONK', 'JUDGE', 'LAWYER', 'TEACHER', 'STUDENT',
  'PROFESSOR', 'SCIENTIST', 'TECHNICIAN', 'ENGINEER',
  'WORKER', 'CLERK', 'WAITER', 'WAITRESS', 'BARTENDER', 'BARMAN', 'BARMAID',
  'DRIVER', 'PILOT', 'SAILOR', 'CAPTAIN', 'CREWMAN', 'CREWMEMBER',
  'CYCLIST', 'JOGGER', 'RUNNER', 'PASSER-BY', 'PASSERBY', 'PEDESTRIAN',
  'BYSTANDER', 'ONLOOKER', 'WITNESS', 'VICTIM', 'SUSPECT',
  'DOORMAN', 'BUTLER', 'MAID', 'HOUSEKEEPER', 'CHAUFFEUR', 'JANITOR',
  'BODYGUARD', 'BOUNCER', 'THUG', 'GANGSTER', 'HENCHMAN', 'PRISONER', 'INMATE',
  'REFEREE', 'COACH', 'PLAYER', 'OPPONENT',
  'REPORTER', 'JOURNALIST', 'ANCHOR', 'PHOTOGRAPHER', 'CAMERAMAN',
  'SINGER', 'DANCER', 'ACTOR', 'ACTRESS', 'MUSICIAN',
  'CIVILIAN', 'TOURIST', 'VISITOR', 'CUSTOMER', 'GUEST',
  'FATHER', 'MOTHER', 'BROTHER', 'SISTER', 'SON', 'DAUGHTER',
  'HUSBAND', 'WIFE', 'GRANDFATHER', 'GRANDMOTHER', 'GRANDPA', 'GRANDMA',
  'UNCLE', 'AUNT', 'COUSIN', 'NEPHEW', 'NIECE', 'FRIEND', 'NEIGHBOR', 'NEIGHBOUR',
  'COMMENTATOR', 'ANNOUNCER', 'INTERVIEWER', 'PRESENTER', 'HOST', 'HOSTESS',
]);

// Generic non-character single words that occasionally land in CAPS in
// action lines or get matched as cue candidates. Filtered out of both
// speaker and background paths.
const NON_CHARACTER_SINGLE = new Set<string>([
  // Pronouns / function words
  'A', 'AN', 'THE', 'HE', 'SHE', 'IT', 'WE', 'THEY', 'HIS', 'HER', 'OUR',
  'THEIR', 'YOU', 'YOUR', 'ME', 'MY', 'I', 'US', 'HIM', 'THEM',
  'AND', 'BUT', 'OR', 'NOR', 'IF', 'AS', 'AT', 'BY', 'OF', 'ON', 'IN', 'TO',
  'FOR', 'WITH', 'WITHOUT', 'FROM', 'INTO', 'ONTO', 'UPON', 'OVER', 'UNDER',
  'THIS', 'THAT', 'THESE', 'THOSE', 'WHICH', 'WHO', 'WHOM', 'WHAT', 'WHERE',
  'WHEN', 'WHY', 'HOW', 'BACK', 'DOWN', 'UP', 'AWAY', 'OFF', 'OUT',
  // Intensifiers / sentence-starters that can be capitalised
  'JUST', 'NOW', 'THEN', 'EVEN', 'ALSO', 'STILL', 'ALREADY', 'HOWEVER',
  'SUDDENLY', 'FINALLY', 'EVENTUALLY', 'MEANWHILE', 'OBVIOUSLY', 'CLEARLY',
  'ABSOLUTELY', 'DEFINITELY', 'CERTAINLY', 'PROBABLY', 'POSSIBLY',
  // Time / location markers that appear in caps
  'DAY', 'NIGHT', 'MORNING', 'EVENING', 'AFTERNOON', 'NOON', 'MIDNIGHT',
  'DAWN', 'DUSK', 'LATER', 'CONTINUOUS', 'MOMENTS',
  // Common abstract nouns
  'TIME', 'SPACE', 'BLOOD', 'FIRE', 'WATER', 'SMOKE', 'DUST', 'SAND', 'ICE',
  'WIND', 'RAIN', 'SUN', 'MOON', 'STARS', 'SKY', 'EARTH', 'WORLD', 'HOPE',
  'LOVE', 'HATE', 'FEAR', 'DEATH', 'LIFE', 'TRUTH', 'POWER', 'CHAOS', 'PANIC',
  'SILENCE', 'DARKNESS', 'LIGHT', 'SHADOW', 'NOTHING', 'EVERYTHING', 'SOMETHING',
  'SOUND', 'NOISE', 'MUSIC', 'VOICE', 'ECHO', 'SCREAM', 'WHISPER', 'THUNDER',
  // Common screenplay terms not in RESERVED_LINE_WORDS
  'BEAT', 'PAUSE', 'OMITTED', 'CONTINUED',
]);

// Multi-word phrases that occasionally pass shape checks but are clearly
// directions, not characters.
const NON_CHARACTER_PHRASES = new Set([
  'CUT TO', 'FADE IN', 'FADE OUT', 'FADE UP', 'SMASH CUT', 'JUMP CUT',
  'MATCH CUT', 'HARD CUT', 'DISSOLVE TO', 'MATCH DISSOLVE',
  'BACK TO', 'WE SEE', 'WE HEAR', 'WE FOLLOW',
  'CLOSE ON', 'CLOSE UP', 'WIDE SHOT', 'WIDE ON', 'PUSH IN', 'PULL BACK',
  'PAN LEFT', 'PAN RIGHT', 'ANGLE ON', 'POV ON', 'POV SHOT',
  'TIME CUT', 'TIME LAPSE', 'TIME JUMP', 'SLOW MOTION', 'FREEZE FRAME',
  'TITLE CARD', 'END CREDITS', 'OPENING CREDITS', 'INTRO TITLE',
  'PRESENT DAY', 'YEARS LATER', 'MONTHS LATER', 'WEEKS LATER',
  'DAYS LATER', 'HOURS LATER', 'MOMENTS LATER', 'NEXT MORNING',
  'THE END', 'THE NEXT', 'THE FOLLOWING',
  'BASED ON', 'INSPIRED BY',
]);

/**
 * Strip cue extensions and return a canonical, uppercase-trimmed name.
 * "BRY (V.O.)" → "BRY"
 * "JOHN (CONT'D)" → "JOHN"
 * "DEAN/PUNK ROCKER" → "DEAN" (first half — handled by callers if needed)
 */
export function normalizeCharacterName(name: string): string {
  let n = name.toUpperCase();
  n = n.replace(CUE_PARENS, '');
  // Strip any other parentheticals defensively (e.g. "(35)" age tags)
  n = n.replace(/\s*\([^)]*\)\s*/g, ' ');
  // Dual-cue split — only when both halves look like names
  if (n.includes('/') && !/^(INT|EXT|I\/E)/.test(n)) {
    const [first] = n.split('/');
    if (first.trim().length >= 2 && first.trim().length <= 25) {
      n = first;
    }
  }
  return n.replace(/\s+/g, ' ').trim();
}

/**
 * Return the canonical "key" for variant grouping. Strips age prefixes
 * (YOUNG, OLD, OLDER, YOUNGER, TEEN) only when callers want to collapse
 * "YOUNG BRY" with "BRY". Stays a no-op when the name is already simple.
 */
export function variantKey(name: string): string {
  const n = normalizeCharacterName(name);
  return n.replace(/^(YOUNG|YOUNGER|OLD|OLDER|TEEN|LITTLE|LIL)\s+/, '');
}

/**
 * Shape check: could this trimmed line BE a cue, ignoring context?
 * Permissive about names (any uppercase word combo, including numbered
 * variants like "MAN #1"), strict about non-character markers.
 */
function looksLikeCueShape(trimmed: string): boolean {
  if (!trimmed) return false;
  if (trimmed.length > 60) return false;

  // No lowercase letters allowed (entire line must be ALL CAPS where letters appear).
  // Numbers, spaces, '.', "'", '-', '/', '#', parens are fine.
  if (/[a-z]/.test(trimmed)) return false;
  if (!/[A-Z]/.test(trimmed)) return false;
  // Disallow most punctuation that would indicate prose, brackets that
  // mark transitions ([FLASHBACK]), and stray quote glyphs.
  if (/[!?:;,*\[\]"“”]/.test(trimmed)) return false;
  // Trailing period is a strong action-line signal — reject.
  if (/\.$/.test(trimmed.replace(CUE_PARENS, '').trim())) return false;

  // Strip cue extensions for the shape check.
  let bare = trimmed.replace(CUE_PARENS, '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
  if (bare.length === 0) return false;

  // Reject pure scene-number prefixes: "12  INT.", "4A EXT.", or just "12."
  if (/^\d+[A-Z]?\s+(INT|EXT|I\/E)/.test(bare)) return false;
  if (/^\d+[A-Z]?\.?$/.test(bare)) return false;

  // Reject scene headings outright.
  if (/^(INT\.?|EXT\.?|INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?)\b/.test(bare)) return false;

  // Reject transition / direction lines.
  if (/^(CUT|FADE|DISSOLVE|SMASH|MATCH|WIPE)\b/.test(bare)) return false;

  // Word count: cues are 1–4 words after stripping extensions.
  const words = bare.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0 || words.length > 4) return false;

  // Reject lines whose every word is a reserved direction word.
  if (words.every(w => RESERVED_LINE_WORDS.has(w))) return false;

  // Multi-word phrase blacklist.
  if (NON_CHARACTER_PHRASES.has(bare)) return false;

  // Single-word non-character rejection.
  if (words.length === 1 && NON_CHARACTER_SINGLE.has(words[0])) return false;
  if (words.length === 1 && RESERVED_LINE_WORDS.has(words[0])) return false;

  // Total length sanity.
  return bare.length >= 2 && bare.length <= 50;
}

function leadingSpaces(line: string): number {
  const m = line.match(/^( *)/);
  return m ? m[1].length : 0;
}

/**
 * After a candidate cue line, look ahead to confirm the next non-blank,
 * non-parenthetical-only line is dialogue (not another cue, not a scene
 * heading, not a transition). When the cue is indented we additionally
 * require its dialogue to be indented too — title cards and sub-headers
 * are centred but their action paragraphs sit at the left margin, which
 * is the cleanest signal that distinguishes them from a real cue.
 */
function isFollowedByDialogue(lines: string[], cueIdx: number): boolean {
  const cueIndent = leadingSpaces(lines[cueIdx]);
  for (let i = cueIdx + 1; i < lines.length && i <= cueIdx + 5; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t) continue;
    // Skip parenthetical-only lines like "(faintly)" or "(MORE)".
    if (/^\(.*\)$/.test(t)) continue;
    // Skip page footers like "12." or "Page 4".
    if (/^\d+\.?$/.test(t)) continue;
    if (/^Page\s+\d+/i.test(t)) continue;
    // If the next non-blank line is itself a cue or scene heading, the
    // candidate was not a real cue.
    if (looksLikeCueShape(t)) return false;
    if (/^(INT\.?|EXT\.?|I\/E\.?)\s/.test(t.toUpperCase())) return false;
    if (/^\d+\s*[A-Z]?\s+(INT|EXT)/.test(t.toUpperCase())) return false;
    if (/^(CUT |FADE |DISSOLVE )/.test(t.toUpperCase())) return false;
    // Indentation guard: in industry-format scripts dialogue is indented.
    // If the cue itself is indented but the next line sits at the left
    // margin, this is a centred title card or sub-header, not a cue.
    // (Lenient: any non-zero indent on the next line is enough.)
    if (cueIndent > 0 && leadingSpaces(raw) === 0) return false;
    return true;
  }
  return false;
}

export interface CueHit {
  /** The line index in the source `lines` array. */
  lineIndex: number;
  /** Normalised canonical name (parentheticals stripped). */
  name: string;
  /** Variant key (age prefixes collapsed) — used to group BRY / YOUNG BRY. */
  variantKey: string;
  /** The original raw cue text including any extension. */
  raw: string;
}

/**
 * Single-pass cue extraction across the whole script.
 *
 * Two filters apply: a per-line structural test (`isFollowedByDialogue`)
 * and a per-script indentation-cluster test. Industry-format scripts
 * indent dialogue cues to a consistent column; centred sub-headers
 * inside scenes (like "LIBRARY", "THE TRAIN STATION") sit at the left
 * margin alongside action paragraphs. We compute the dominant cue
 * indent from the candidate set, then drop any candidate whose own
 * indent is far below it. Scripts that are entirely flush-left (e.g.
 * Fountain-style exports) skip the second filter automatically.
 */
export function extractCueLines(lines: string[]): CueHit[] {
  // Pass 1 — collect every line that PASSES SHAPE only. We don't apply
  // the structural follow-by-dialogue check here yet because it can
  // false-reject real cues whose dialogue happens to be a short
  // ALL-CAPS reaction (e.g. JOHN -> "RUN!" / "JESUS" / "HELP") that
  // also passes shape.
  type Cand = { i: number; t: string; indent: number; canonical: string };
  const shapeCandidates: Cand[] = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (!looksLikeCueShape(t)) continue;
    const canonical = normalizeCharacterName(t);
    if (canonical.length < 2 || canonical.length > 35) continue;
    if (NON_CHARACTER_SINGLE.has(canonical)) continue;
    if (NON_CHARACTER_PHRASES.has(canonical)) continue;
    shapeCandidates.push({
      i,
      t,
      indent: leadingSpaces(lines[i]),
      canonical,
    });
  }

  // Pass 2 — frequency table. A canonical name that appears ≥ 3 times
  // in cue position is almost certainly a real character; one-off
  // matches are usually centred title cards or shouted exclamations.
  const FREQUENCY_FLOOR = 3;
  const freqByCanonical = new Map<string, number>();
  for (const c of shapeCandidates) {
    freqByCanonical.set(c.canonical, (freqByCanonical.get(c.canonical) ?? 0) + 1);
  }

  // Pass 3 — accept each candidate iff EITHER:
  //   (a) it passes the structural follow-by-dialogue test, OR
  //   (b) its canonical name has at least FREQUENCY_FLOOR shape matches
  //       across the whole script — frequency tells us this is a real
  //       speaker and the structural test was rejecting on a noisy
  //       dialogue line (e.g. a one-word ALL CAPS reaction).
  const accepted: Cand[] = [];
  for (const c of shapeCandidates) {
    const isFrequent = (freqByCanonical.get(c.canonical) ?? 0) >= FREQUENCY_FLOOR;
    if (isFrequent || isFollowedByDialogue(lines, c.i)) {
      accepted.push(c);
    }
  }

  // Pass 4 — indent cluster filter. Industry-format scripts indent
  // dialogue cues to a consistent column; centred sub-headers sit at
  // the left margin. Compute the dominant cue indent from the accepted
  // set and drop anything far below it. Scripts that are entirely
  // flush-left (e.g. Fountain exports) skip this filter automatically.
  let minIndent = 0;
  if (accepted.length >= 4) {
    const indents = accepted.map((c) => c.indent).sort((a, b) => a - b);
    const median = indents[Math.floor(indents.length / 2)];
    if (median >= 6) {
      minIndent = Math.floor(median / 2);
    }
  }

  const hits: CueHit[] = [];
  for (const c of accepted) {
    if (c.indent < minIndent) continue;
    hits.push({
      lineIndex: c.i,
      name: c.canonical,
      variantKey: variantKey(c.canonical),
      raw: c.t,
    });
  }
  return hits;
}

/**
 * Background detection from raw scene action text.
 *
 * Returns a small ordered list of background labels (e.g. "PASSER BY",
 * "ELDERLY PATIENT") found in the action text. Speaker names supplied via
 * `knownSpeakers` are excluded so they don't show up as background as well.
 *
 * Generic rules:
 *   - Multi-word ALL CAPS phrases (2–4 words) where a person-descriptor
 *     word is in the last two positions.
 *   - Single-word ALL CAPS tokens that are themselves person-descriptors
 *     (e.g. "NURSE", "REFEREE") and are introduced with an article
 *     (a/an/the/another/two/three/HER/HIS) immediately before them.
 *   - Skips anything matching a known speaker (canonical name or variant
 *     key) so leads aren't double-listed as background.
 */
export function extractBackgroundFromAction(
  actionText: string,
  knownSpeakers: Set<string>,
): string[] {
  if (!actionText) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  const speakerVariants = new Set<string>();
  for (const s of knownSpeakers) {
    speakerVariants.add(s);
    speakerVariants.add(variantKey(s));
  }

  // Multi-word ALL CAPS phrases (2–4 words). Allow apostrophes/hyphens
  // inside words. Reject if any word is a non-character single.
  const multi = /\b([A-Z][A-Z'-]{1,}(?:\s+[A-Z][A-Z'-]{1,}){1,3})\b/g;
  let m: RegExpExecArray | null;
  while ((m = multi.exec(actionText)) !== null) {
    const phrase = m[1].trim();
    if (NON_CHARACTER_PHRASES.has(phrase)) continue;
    const words = phrase.split(/\s+/);
    // Reject phrases whose every word is a reserved direction word.
    if (words.every(w => RESERVED_LINE_WORDS.has(w))) continue;
    // Reject if any word is INT/EXT (slugline fragments).
    if (words.some(w => w === 'INT' || w === 'EXT')) continue;
    // Require a person-descriptor in the last two positions.
    const tail = words.slice(-2);
    if (!tail.some(w => PERSON_DESCRIPTORS.has(w))) continue;
    // Reject if every word is in NON_CHARACTER_SINGLE (e.g. "BACK BACK").
    if (words.every(w => NON_CHARACTER_SINGLE.has(w))) continue;
    if (speakerVariants.has(phrase) || speakerVariants.has(variantKey(phrase))) continue;
    if (seen.has(phrase)) continue;
    seen.add(phrase);
    out.push(phrase);
    if (out.length >= 12) break;
  }

  // Single-word descriptors introduced by an article — "the NURSE",
  // "another COP", "a JANITOR".
  const single = /\b(?:a|an|the|another|two|three|four|five|her|his|their|some|several)\s+([A-Z][A-Z'-]{2,})\b/gi;
  while ((m = single.exec(actionText)) !== null) {
    const word = m[1].toUpperCase();
    if (!PERSON_DESCRIPTORS.has(word)) continue;
    if (NON_CHARACTER_SINGLE.has(word)) continue;
    if (speakerVariants.has(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= 12) break;
  }

  return out;
}
