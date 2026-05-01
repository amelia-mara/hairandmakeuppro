/* ━━━ Common word exclusions for name-mention scanning ━━━ */

/**
 * Words that should never be matched as character name fragments.
 * Prevents pronouns, articles, common verbs, and script terms from
 * causing false positives when scanning for first/last name mentions.
 * e.g. A character named "Will Grace" should not match every "will" or "grace" in the script.
 */
/**
 * Single-word common nouns the screenplay parser should never treat as
 * a character — transitions, sound effects, sensory beats, weather,
 * elemental words, etc. Used both inside `isCharacterCue` and as a
 * final-pass denylist in `scriptParser-core.ts` so any one-word
 * character that slips past the upstream filters is dropped before the
 * project loads.
 */
export const NON_CHARACTER_SINGLE_WORDS = new Set([
  // Transitions / scene directions
  'CUT', 'FADE', 'DISSOLVE', 'INTERCUT', 'MONTAGE', 'CONTINUED',
  'ANGLE', 'SHOT', 'VIEW', 'CLOSE', 'WIDE', 'POV', 'BACK', 'RESUME',
  'BEGIN', 'END', 'STOP', 'START', 'PAUSE', 'BEAT', 'PRELAP', 'OVERLAP',
  // Sound / sensory beats
  'SOUND', 'NOISE', 'MUSIC', 'VOICE', 'WHISPER', 'SCREAM', 'ECHO',
  'SILENCE', 'LIGHT', 'DARKNESS', 'SHADOW',
  // Weather + elements + ambient
  'RAIN', 'WIND', 'SNOW', 'FOG', 'MIST', 'HAIL', 'SLEET', 'BREEZE',
  'THUNDER', 'LIGHTNING', 'STORM', 'EXPLOSION', 'CRASH', 'BANG', 'BOOM',
  'WATER', 'WAVES', 'OCEAN', 'SEA', 'RIVER', 'LAKE', 'STREAM',
  'AIR', 'EARTH', 'GROUND', 'SKY', 'SUN', 'MOON', 'STARS', 'CLOUD',
  'FIRE', 'SMOKE', 'DUST', 'SAND', 'MUD', 'ICE', 'BLOOD',
  // Time + place markers
  'DAY', 'NIGHT', 'MORNING', 'EVENING', 'AFTERNOON', 'DAWN', 'DUSK',
  'LATER', 'CONTINUOUS', 'MIDNIGHT', 'NOON', 'TWILIGHT', 'SUNRISE', 'SUNSET',
  'INT', 'EXT', 'ROOM', 'HOUSE', 'OFFICE', 'STREET', 'ROAD', 'BUILDING',
  // Generic abstractions
  'TIME', 'SPACE', 'PLACE', 'HOME', 'WORLD', 'LIFE', 'DEATH', 'LOVE',
  'HATE', 'FEAR', 'HOPE', 'TRUTH', 'POWER',
  // Title-card markers
  'TITLE', 'SUBTITLE', 'CAPTION', 'CHAPTER', 'PART', 'ACT', 'SCENE',
  'EPISODE', 'PILOT', 'CREDIT', 'CREDITS',
]);

export const NAME_SCAN_EXCLUSIONS = new Set([
  // Pronouns & determiners
  'HER', 'HIS', 'HERS', 'ITS', 'THEY', 'THEM', 'THEIR',
  'THEIRS', 'OUR', 'OURS', 'YOUR', 'YOURS', 'WHO', 'WHOM', 'THIS', 'THAT',
  'THESE', 'THOSE',
  // Common verbs (3+ chars only — shorter are already filtered by length)
  'WAS', 'WERE', 'ARE', 'HAS', 'HAD', 'HAVE', 'DID', 'DOES', 'GOT',
  'GET', 'LET', 'SET', 'RUN', 'SAY', 'SAID', 'PUT', 'COME', 'CAME',
  'TAKE', 'TOOK', 'MAKE', 'MADE', 'SEE', 'SAW', 'KNOW', 'KNEW',
  'WILL', 'CAN', 'SHALL', 'WOULD', 'COULD', 'SHOULD', 'MUST',
  // Common nouns/adjectives
  'MAN', 'WOMAN', 'BOY', 'GIRL', 'OLD', 'NEW', 'LONG', 'SHORT',
  'YOUNG', 'LITTLE', 'BIG', 'SMALL', 'GOOD', 'BAD', 'BEST', 'WORST',
  // Prepositions & conjunctions (3+ chars)
  'AND', 'BUT', 'FOR', 'NOT', 'WITH', 'FROM', 'INTO', 'OVER', 'BACK',
  'DOWN', 'JUST', 'THEN', 'THAN', 'ALSO', 'EVEN', 'STILL', 'WELL',
  // Script directions (3+ chars)
  'INT', 'EXT', 'CUT', 'FADE', 'DAY', 'NIGHT', 'CONT', 'END',
  'ALL', 'ONE', 'TWO', 'NOW', 'OUT', 'OFF', 'HOW', 'WHY',
  'THE', 'YOU', 'WAY', 'TOO', 'USE', 'YES', 'YET',
]);

/* ━━━ Supporting artist role descriptors ━━━ */

/**
 * Generic role descriptors that indicate a supporting artist (extra/background)
 * rather than a named principal character. These are roles described by function
 * rather than a proper character name — e.g. "MAN", "CYCLIST", "WAITRESS".
 * A character with dialogue whose name matches one of these is still classified
 * as a supporting artist unless they also have a proper name.
 */
const SUPPORTING_ARTIST_ROLES = new Set([
  // Generic people
  'MAN', 'WOMAN', 'BOY', 'GIRL', 'CHILD', 'BABY', 'INFANT', 'TODDLER',
  'TEEN', 'TEENAGER', 'KID', 'LADY', 'GUY', 'PERSON', 'FIGURE',
  'OLD MAN', 'OLD WOMAN', 'YOUNG MAN', 'YOUNG WOMAN', 'YOUNG BOY', 'YOUNG GIRL',
  'ELDERLY MAN', 'ELDERLY WOMAN', 'MIDDLE-AGED MAN', 'MIDDLE-AGED WOMAN',
  'TALL MAN', 'SHORT MAN', 'HEAVY MAN', 'THIN MAN', 'THIN WOMAN',
  // Numbered generics
  'MAN #1', 'MAN #2', 'MAN #3', 'WOMAN #1', 'WOMAN #2', 'WOMAN #3',
  'GUY #1', 'GUY #2', 'GIRL #1', 'GIRL #2', 'BOY #1', 'BOY #2',
  'PERSON #1', 'PERSON #2', 'KID #1', 'KID #2',
  // Occupational / functional roles
  'WAITER', 'WAITRESS', 'BARTENDER', 'BARISTA', 'BARMAN', 'BARMAID',
  'RECEPTIONIST', 'CLERK', 'CASHIER', 'SHOP ASSISTANT', 'SHOPKEEPER',
  'DRIVER', 'TAXI DRIVER', 'BUS DRIVER', 'UBER DRIVER', 'CHAUFFEUR',
  'OFFICER', 'POLICE OFFICER', 'COP', 'POLICEMAN', 'POLICEWOMAN',
  'GUARD', 'SECURITY GUARD', 'BOUNCER', 'DOORMAN',
  'NURSE', 'DOCTOR', 'PARAMEDIC', 'EMT', 'SURGEON', 'ORDERLY',
  'SOLDIER', 'MARINE', 'SAILOR', 'PILOT',
  'TEACHER', 'PROFESSOR', 'STUDENT', 'PUPIL',
  'PRIEST', 'MINISTER', 'PASTOR', 'NUN', 'MONK',
  'JUDGE', 'LAWYER', 'ATTORNEY', 'BAILIFF',
  'REPORTER', 'JOURNALIST', 'PHOTOGRAPHER', 'CAMERAMAN',
  'SECRETARY', 'ASSISTANT', 'INTERN',
  'JANITOR', 'CLEANER', 'MAID', 'BUTLER', 'HOUSEKEEPER',
  'CHEF', 'COOK',
  // Performers / activity roles
  'DANCER', 'SINGER', 'MUSICIAN', 'DRUMMER', 'GUITARIST',
  'ACTOR', 'ACTRESS', 'PERFORMER', 'ENTERTAINER', 'DJ',
  'CYCLIST', 'JOGGER', 'RUNNER', 'SWIMMER', 'SKATER',
  'COWBOY', 'COWGIRL', 'RANCHER', 'FARMER', 'FISHERMAN',
  // Street / crowd roles
  'PASSER BY', 'PASSERBY', 'PASSER-BY', 'PEDESTRIAN', 'BYSTANDER',
  'STRANGER', 'HOMELESS MAN', 'HOMELESS WOMAN', 'BEGGAR',
  'VENDOR', 'STREET VENDOR', 'NEWSREADER', 'PRESENTER', 'ANCHOR',
  'NEIGHBOUR', 'NEIGHBOR',
  // Vehicle / transport
  'PASSENGER', 'COMMUTER', 'TRAVELLER', 'TRAVELER',
  // Criminal / threat roles
  'THUG', 'THIEF', 'ROBBER', 'MUGGER', 'GANGSTER', 'HITMAN',
  'ASSASSIN', 'KIDNAPPER', 'SNIPER', 'GUNMAN',
  // Family generics (without proper names)
  'MOTHER', 'FATHER', 'BROTHER', 'SISTER', 'HUSBAND', 'WIFE',
  'SON', 'DAUGHTER', 'UNCLE', 'AUNT', 'GRANDMOTHER', 'GRANDFATHER',
  'GRANDMA', 'GRANDPA',
  // Sports / competition
  'REFEREE', 'REF', 'UMPIRE', 'OPPONENT', 'FIGHTER', 'BOXER', 'WRESTLER',
  'COACH', 'TRAINER', 'COMMENTATOR', 'ANNOUNCER',
  // Historical / military extras
  'CENTURION', 'WARRIOR', 'GLADIATOR', 'KNIGHT', 'SQUIRE', 'HERALD',
  'DRUID', 'LEGIONNAIRE', 'BARBARIAN', 'SLAVE', 'SERVANT', 'PEASANT',
  'PRAETORIAN', 'TRIBUNE', 'SENATOR', 'CONSUL', 'EMPEROR',
  // Group / crowd
  'CROWD', 'CROWD MEMBER', 'ONLOOKER', 'SPECTATOR', 'AUDIENCE MEMBER',
  'GUEST', 'CUSTOMER', 'PATIENT', 'CLIENT', 'VICTIM', 'WITNESS',
  'INMATE', 'PRISONER', 'SUSPECT', 'HENCHMAN', 'GOON', 'MINION',
  // Titled generics
  'MR SMITH', 'MRS SMITH', 'THE MAN', 'THE WOMAN', 'THE BOY', 'THE GIRL',
  'A MAN', 'A WOMAN', 'A BOY', 'A GIRL',
]);

/**
 * Check if a normalized character name is a supporting artist role descriptor.
 * Returns true for generic roles like "MAN", "WAITRESS", "CYCLIST #2".
 */
export function isSupportingArtistRole(normalizedName: string): boolean {
  if (SUPPORTING_ARTIST_ROLES.has(normalizedName)) return true;

  // Check for numbered variants: "WAITER #4", "COP 2", "MAN 1"
  const withoutNumber = normalizedName.replace(/\s*#?\d+\s*$/, '').trim();
  if (withoutNumber !== normalizedName && SUPPORTING_ARTIST_ROLES.has(withoutNumber)) return true;

  // Check for word-numbered variants: "COWBOY ONE", "WAITER TWO", "GIRL THREE"
  const wordNumbers = /\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE)$/;
  const withoutWordNumber = normalizedName.replace(wordNumbers, '').trim();
  if (withoutWordNumber !== normalizedName && SUPPORTING_ARTIST_ROLES.has(withoutWordNumber)) return true;

  // Check for "THE X" or "A X" prefix
  const withoutArticle = normalizedName.replace(/^(THE|A|AN)\s+/, '').trim();
  if (withoutArticle !== normalizedName && SUPPORTING_ARTIST_ROLES.has(withoutArticle)) return true;

  return false;
}

/* ━━━ Character name helpers ━━━ */

export function normalizeCharacterName(name: string): string {
  let normalized = name.toUpperCase();
  normalized = normalized.replace(/\s*\(.*?\)\s*/g, '');
  // Drop leading non-letter punctuation / dashes so a line like
  // "- LATER 9" becomes "LATER 9" before downstream filters check
  // the first word against the denylist.
  normalized = normalized.replace(/^[^A-Z]+/, '');
  if (normalized.includes('/') && !normalized.startsWith('INT') && !normalized.startsWith('EXT')) {
    const parts = normalized.split('/');
    if (parts[0].length >= 2 && parts[0].length <= 20) {
      normalized = parts[0].trim();
    }
  }
  return normalized.replace(/\s+/g, ' ').trim();
}

/* ━━━ Character cue detection ━━━ */

export function isCharacterCue(line: string): boolean {
  const trimmed = line.trim();

  if (trimmed !== trimmed.toUpperCase()) return false;
  if (trimmed.length > 50) return false;
  // Reject prose punctuation, revision marks, and stray quote glyphs.
  // Real cues are name + optional (V.O./CONT'D) — none of these chars
  // belong in a cue line. Catches "NOW!", "GREG*" (revision flag),
  // "KEY CORONAVIRUS SYMPTOM\"", "[FLASHBACK]", etc.
  if (/[!?:;,*\[\]"“”]/.test(trimmed)) return false;

  const nonCharPatterns = [
    /^\[?(INT\.|EXT\.|INT\/EXT|EXT\/INT|I\/E\.)/i,
    /^\[?(CUT TO|FADE|DISSOLVE|SMASH|MATCH|WIPE)\]?(:|\s|$)/i,
    /^\[?(THE END|CONTINUED|MORE|\(MORE\))\]?(:|\s|$)/i,
    /^\d+\s*$/,
    /^\s*$/,
    /^\[?(TITLE:|SUPER:|CHYRON:|CARD:|INSERT:|INTERCUT)\]?(\s|$)/i,
    /^\[?(FLASHBACK|END FLASHBACK|FLASH BACK|FLASH FORWARD|DREAM SEQUENCE|DREAM|MONTAGE|END MONTAGE|INTERCUT|END INTERCUT|PRESENT DAY|PRESENT|LATER|TIME CUT|TITLE CARD)\]?(:|\s|$)/i,
    /^\[?(BACK TO|RESUME|ANGLE ON|CLOSE ON|WIDE ON|POV)\]?(:|\s|$)/i,
    /^\[?(LATER|CONTINUOUS|MOMENTS LATER|SAME TIME)\]?(:|\s|$)/i,
    /^\[?(SUPERIMPOSE|SUBTITLE|CAPTION)\]?(:|\s|$)/i,
    /^\[?(EPISODE|CHAPTER|PART|ACT|SCENE|PILOT)\]?\s*\d*\s*$/i,
  ];

  for (const pattern of nonCharPatterns) {
    if (pattern.test(trimmed)) return false;
  }

  if (!/[A-Z]/.test(trimmed)) return false;

  // Character cues are character names — they always start with a
  // letter. Leading punctuation (dashes, slashes, numbers) is a signal
  // that the line is a transition marker like "- LATER 9", not a cue.
  // The bracket-prefixed cases (`[FLASHBACK]` etc.) were already caught
  // above in nonCharPatterns.
  if (!/^[A-Z]/.test(trimmed)) return false;

  const actionPatterns = [
    /^(A |AN |THE |HE |SHE |THEY |WE |IT |HIS |HER |THEIR )/,
    /^(IN THE |AT THE |ON THE |FROM THE |TO THE |INTO THE )/,
    /^(ARRIVING|ENTERING|LEAVING|WALKING|RUNNING|STANDING|SITTING)/,
    / (ENTERS|EXITS|WALKS|RUNS|STANDS|SITS|LOOKS|TURNS|MOVES)$/,
    / (IS |ARE |WAS |WERE |HAS |HAVE |THE |A |AN )/,
    /^[A-Z]+ [A-Z]+ [A-Z]+ [A-Z]+ [A-Z]+/,
    /\.$/,
    /^\d+[A-Z]?\s+/,
  ];

  for (const pattern of actionPatterns) {
    if (pattern.test(trimmed)) return false;
  }

  const nameWithoutParen = trimmed.replace(/\s*\(.*?\)\s*/g, '').trim();
  const wordCount = nameWithoutParen.split(/\s+/).length;
  if (wordCount > 4) return false;

  const nonCharacterWords = new Set([
    'HE', 'SHE', 'IT', 'WE', 'ME', 'US', 'HIM', 'HER', 'HIS', 'ITS',
    'THEY', 'THEM', 'THEIR', 'WHO', 'WHOM', 'WHOSE', 'WHAT', 'WHICH',
    'THAT', 'THIS', 'THESE', 'THOSE', 'MYSELF', 'HIMSELF', 'HERSELF',
    'BUT', 'FOR', 'NOT', 'ALL', 'WITH', 'FROM', 'INTO', 'UPON',
    'THAN', 'YET', 'NOR', 'SINCE', 'UNTIL', 'WHILE', 'DURING',
    'THROUGH', 'BETWEEN', 'AGAINST', 'WITHOUT', 'WITHIN', 'BEYOND',
    'AS', 'AT', 'BY', 'IF', 'OF', 'ON', 'OR', 'TO', 'UP', 'SO',
    'DO', 'GO', 'AM', 'AN', 'BE', 'MY', 'OUR', 'YOUR', 'TOO',
    'HOW', 'WHY', 'OFF', 'OUT', 'BACK', 'DOWN', 'AWAY',
    'INT', 'EXT', 'ROAD', 'STREET', 'HOUSE', 'ROOM', 'OFFICE', 'BUILDING',
    'HALL', 'HALLWAY', 'CORRIDOR', 'LOBBY', 'STAIRS', 'BASEMENT', 'ATTIC',
    'GARAGE', 'PORCH', 'BALCONY', 'GARDEN', 'YARD', 'ALLEY', 'PARK',
    'DAY', 'NIGHT', 'MORNING', 'EVENING', 'DAWN', 'DUSK', 'LATER', 'CONTINUOUS',
    'MIDNIGHT', 'NOON', 'AFTERNOON', 'TWILIGHT', 'SUNSET', 'SUNRISE',
    'SILENCE', 'DARKNESS', 'NOTHING', 'EVERYTHING', 'SOMETHING', 'ANYTHING',
    'NOBODY', 'EVERYBODY', 'SOMEONE', 'ANYONE', 'EVERYONE',
    'TIME', 'SPACE', 'PLACE', 'HOME', 'WORLD',
    'LOVE', 'HATE', 'FEAR', 'HOPE', 'DEATH', 'LIFE', 'TRUTH', 'POWER',
    'BLOOD', 'FIRE', 'SMOKE', 'DUST', 'SAND', 'MUD', 'ICE',
    'THUNDER', 'LIGHTNING', 'STORM', 'EXPLOSION', 'CRASH', 'BANG', 'BOOM',
    'SCREAM', 'WHISPER', 'ECHO', 'VOICE', 'SOUND', 'NOISE', 'MUSIC',
    // Weather, elemental and ambient sound cues — these recur in scripts
    // as ALL-CAPS sensory beats ("RAIN batters her face") and slip past
    // the general filter without an explicit denylist entry.
    'RAIN', 'WIND', 'SNOW', 'FOG', 'MIST', 'HAIL', 'SLEET', 'BREEZE',
    'WATER', 'WAVES', 'OCEAN', 'SEA', 'RIVER', 'LAKE', 'STREAM',
    'AIR', 'EARTH', 'GROUND', 'SKY', 'SUN', 'MOON', 'STARS', 'CLOUD',
    'SHADOW', 'LIGHT', 'DARKNESS',
    'CONTINUED', 'FADE', 'CUT', 'DISSOLVE', 'ANGLE', 'SHOT', 'VIEW', 'CLOSE', 'WIDE',
    'RESUME', 'BEGIN', 'END', 'STOP', 'START', 'PAUSE', 'BEAT',
    'PRELAP', 'OVERLAP', 'INTERCUT', 'MONTAGE', 'SERIES', 'SEQUENCE',
    'PHONE', 'GUN', 'KNIFE', 'SWORD', 'WEAPON', 'BOMB',
    'CAR', 'TRUCK', 'BUS', 'TRAIN', 'PLANE', 'BOAT', 'SHIP',
    'TAXI', 'AMBULANCE', 'MOTORCYCLE', 'VEHICLE',
    'DOOR', 'WINDOW', 'WALL', 'FLOOR', 'CEILING', 'ROOF',
    'TABLE', 'CHAIR', 'DESK', 'BED', 'COUCH', 'BENCH',
    'LAMP', 'MIRROR', 'CLOCK', 'SCREEN', 'COMPUTER',
    'RADIO', 'TELEVISION', 'CAMERA',
    'BAG', 'BOX', 'CASE', 'TRUNK', 'CHEST',
    'BOTTLE', 'GLASS', 'CUP', 'PLATE', 'BOWL',
    'KEY', 'LOCK', 'CHAIN', 'ROPE', 'WIRE',
    'SIGN', 'FLAG', 'BANNER', 'POSTER', 'PHOTO', 'PICTURE',
    'BOOK', 'LETTER', 'NOTE', 'MAP', 'CARD', 'ENVELOPE',
    'RING', 'NECKLACE', 'WATCH', 'HELMET', 'MASK', 'BADGE',
    'TITLE', 'CREDIT', 'CREDITS', 'SUBTITLE', 'CAPTION',
    'CHAPTER', 'PART', 'ACT', 'SCENE', 'EPISODE',
    'DREAM', 'NIGHTMARE', 'MEMORY', 'VISION', 'FLASHBACK', 'FANTASY',
    'PRESENT', 'PAST', 'FUTURE',
    'UNKNOWN', 'UNTITLED', 'UNNAMED',
    'VARIOUS', 'SEVERAL', 'MULTIPLE',
    'OTHER', 'ANOTHER', 'EITHER', 'NEITHER', 'BOTH', 'NONE', 'EACH', 'EVERY',
    'HERE', 'THERE', 'WHERE', 'WHEN', 'THEN', 'NOW', 'SOON', 'AGO',
    'AGAIN', 'ONCE', 'TWICE', 'NEVER', 'ALWAYS',
    'OKAY', 'YEAH', 'SURE', 'RIGHT', 'WRONG', 'TRUE', 'FALSE', 'YES', 'NO',
    'VERY', 'MUCH', 'MORE', 'MOST', 'JUST', 'ONLY', 'ALSO', 'EVEN', 'STILL', 'WELL',
    'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
    'FIRST', 'SECOND', 'THIRD', 'LAST', 'NEXT', 'ANOTHER', 'HALF',
    'LIKE', 'REAL', 'SAME', 'DIFFERENT', 'SPECIAL',
    'SECRET', 'PRIVATE', 'PUBLIC', 'FINAL', 'TOTAL', 'PERFECT', 'COMPLETE',
    'TYPE', 'OPEN', 'SHUT', 'EMPTY', 'FULL', 'BUSY', 'FREE', 'SAFE',
    'RED', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE', 'PURPLE', 'BLACK', 'WHITE', 'GOLDEN',
  ]);

  if (wordCount === 1) {
    if (nameWithoutParen.length >= 6) {
      const nonNameSuffixes = /^[A-Z]+(ING|ED|LY|TION|SION|NESS|MENT|ABLE|IBLE|ICAL|IOUS|EOUS|ULAR|TERN|ERN|WARD|WARDS|LIKE|LESS|FUL|IC|AL|ARY|ORY|IVE|OUS|ANT|ENT)$/;
      if (nonNameSuffixes.test(nameWithoutParen)) return false;
    }
    if (nonCharacterWords.has(nameWithoutParen)) return false;
  }

  if (wordCount >= 2) {
    const words = nameWithoutParen.split(/\s+/);
    if (words.every(w => nonCharacterWords.has(w))) return false;

    const nonCharacterPhrases = new Set([
      'TYPE WRITER', 'VOICE OVER', 'VOICE MAIL',
      'TIME LAPSE', 'TIME CUT', 'TIME JUMP',
      'SLOW MOTION', 'FREEZE FRAME', 'SPLIT SCREEN',
      'WIDE SHOT', 'CLOSE UP', 'MEDIUM SHOT', 'LONG SHOT', 'AERIAL SHOT',
      'PUSH IN', 'PULL BACK', 'PAN LEFT', 'PAN RIGHT',
      'SMASH CUT', 'JUMP CUT', 'MATCH CUT', 'HARD CUT',
      'FADE IN', 'FADE OUT', 'FADE UP', 'BLACK OUT', 'WHITE OUT',
      'TITLE CARD', 'END CREDITS', 'OPENING CREDITS',
      'STOCK FOOTAGE', 'NEXT DAY', 'SAME DAY', 'THAT NIGHT',
      'NEXT MORNING', 'SOME TIME', 'YEARS LATER', 'MONTHS LATER',
      'DAYS LATER', 'HOURS LATER', 'WEEKS LATER',
      'DREAM SEQUENCE', 'TITLE SEQUENCE', 'ACTION SEQUENCE',
      'THE END', 'TO BE',
    ]);
    if (nonCharacterPhrases.has(nameWithoutParen)) return false;
  }

  return nameWithoutParen.length >= 2 && nameWithoutParen.length <= 35;
}

/* ━━━ Pre-scan: discover character introductions ━━━ */

/**
 * Words that can start an ALL CAPS line but are NOT character names.
 * Prevents "WE END on..." or "THE BUTLER" from being treated as intros.
 */
const INTRO_EXCLUDED_STARTS = new Set([
  'INT', 'EXT', 'CUT', 'FADE', 'SCENE', 'EPISODE', 'CHAPTER', 'ACT', 'PART',
  'WE', 'HE', 'SHE', 'THE', 'A', 'AN', 'IT', 'AS', 'AT', 'IF', 'IN', 'ON',
  'OR', 'TO', 'SO', 'NO', 'OF', 'BY', 'UP', 'IS', 'BE', 'DO', 'GO', 'MY',
  'HIS', 'HER', 'ITS', 'OUR', 'ALL', 'BUT', 'FOR', 'NOT', 'AND', 'YET',
  'NOR', 'THEY', 'THEM', 'THIS', 'THAT', 'THEN', 'THAN', 'FROM', 'WITH',
  'INTO', 'OVER', 'BACK', 'DOWN', 'JUST', 'ALSO', 'EVEN', 'STILL',
  'FRIDAY', 'SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY',
  'TITLES', 'TITLE', 'SUPER', 'SUPERIMPOSE', 'INSERT', 'INTERCUT',
  'FLASHBACK', 'MONTAGE', 'SERIES', 'STOCK', 'BASED', 'ELEVEN', 'TWELVE',
]);

/** Age modifiers that precede character names: "YOUNG BRY TYRELL" → "BRY TYRELL" */
const NAME_MODIFIERS = new Set([
  'YOUNG', 'OLD', 'ELDERLY', 'MIDDLE-AGED', 'LITTLE', 'TEENAGE', 'BABY',
  'DETECTIVE', 'AGENT', 'OFFICER', 'DOCTOR', 'DR', 'EMPEROR', 'KING', 'QUEEN',
  'PRINCE', 'PRINCESS', 'LORD', 'LADY', 'SIR', 'DAME', 'PROFESSOR', 'PROF',
  'CAPTAIN', 'LIEUTENANT', 'SERGEANT', 'COLONEL', 'GENERAL', 'COMMANDER',
  'MR', 'MRS', 'MS', 'MISS', 'MASTER',
]);

/**
 * Pre-scan the entire script to find character introductions.
 * Returns a Map of single-name fragments → full character names,
 * allowing dialogue cues like "LENNON" to resolve to "LENNON BOWIE".
 *
 * Detects these introduction patterns:
 *  1. FULL NAME, age — "LENNON BOWIE, 28, is a cowboy..."
 *  2. FULL NAME age  — "DEDRA MONTGOMERY 29, an icy beauty..."
 *  3. FULL NAME (age) — "LIZZY BENNET (20s), stumbles into..."
 *  4. FULL NAME, description — "ARCHIBALD CHRISTIE, dashing, holds..."
 *  5. FULL NAME + lowercase — "AGATHA CHRISTIE let's out a cry..."
 *  6. Mid-line: ...sentence. FULL NAME, age — "...on foot. JASPER MONTGOMERY, 70"
 */
export function prescanCharacterIntros(lines: string[]): Map<string, string> {
  const fullNames: string[] = [];
  const seen = new Set<string>();

  function addName(raw: string) {
    if (raw.length < 3) return;
    const firstWord = raw.split(/\s+/)[0];
    if (INTRO_EXCLUDED_STARTS.has(firstWord)) return;
    // Same denylist the action-line extractor uses — keeps "LATER ALICE,
    // 25" or "DAY MARCUS, 30" out of the prescan's full-name pool so
    // the resolveMap never points a fragment ("ALICE", "MARCUS") at a
    // bogus parent name starting with a transition / time marker.
    if (NON_CHARACTER_SINGLE_WORDS.has(firstWord)) return;
    // Strip leading modifiers: "YOUNG BRY TYRELL" → "BRY TYRELL"
    let cleaned = raw;
    const words = raw.split(/\s+/);
    while (words.length > 1 && NAME_MODIFIERS.has(words[0])) {
      words.shift();
    }
    cleaned = words.join(' ');
    // Must have 2+ words to be a "full name"
    if (cleaned.split(/\s+/).length < 2) return;
    // Skip if it's a supporting artist role
    if (isSupportingArtistRole(cleaned)) return;
    if (!seen.has(cleaned)) {
      seen.add(cleaned);
      fullNames.push(cleaned);
    }
  }

  /** Run all intro patterns on a single line of text */
  function scanLineForIntros(trimmed: string) {
    let m;

    // Pattern 1: ALL CAPS name + comma/space + age digits (anywhere in line)
    // "LENNON BOWIE, 28" or "JASPER MONTGOMERY, 70" or "DEDRA MONTGOMERY 29," (space before age)
    const ageIntroRegex = /(?:^|[.!?]\s+)([A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+){0,3})(?:\s*[,(]\s*|\s+)\d{1,3}\b/g;
    while ((m = ageIntroRegex.exec(trimmed)) !== null) {
      addName(m[1].trim());
    }

    // Pattern 2: ALL CAPS name + parenthetical age — "LIZZY BENNET (20s)"
    const parenAgeRegex = /(?:^|[.!?]\s+)([A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+){0,3})\s*\(\d{1,3}[s']?\)/g;
    while ((m = parenAgeRegex.exec(trimmed)) !== null) {
      addName(m[1].trim());
    }

    // Pattern 3: Start of line ALL CAPS 2+ word name + comma (no age needed)
    // "AGATHA CHRISTIE, dashing" or "NAN WATTS, a prim-looking woman"
    const commaIntro = trimmed.match(/^([A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+){1,3})\s*,/);
    if (commaIntro) {
      addName(commaIntro[1].trim());
    }

    // Pattern 4: Start of line ALL CAPS 2+ word name followed by lowercase word
    // "AGATHA CHRISTIE let's out a cry" — name acts in an action line
    const actionIntro = trimmed.match(/^([A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+){1,3})\s+[a-z]/);
    if (actionIntro) {
      addName(actionIntro[1].trim());
    }

    // Pattern 5: Mid-line character intro after period/sentence break
    // "She sees Lennon on foot. JASPER MONTGOMERY, 70, he looks like..."
    // "She sees Lennon on foot. JASPER MONTGOMERY 70, he looks like..." (space before age)
    const midLineRegex = /[.!?]\s+([A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+){1,3})(?:\s*[,(]\s*(?:\d{1,3}\b|[a-z])|\s+\d{1,3}\s*,)/g;
    while ((m = midLineRegex.exec(trimmed)) !== null) {
      addName(m[1].trim());
    }

    // Pattern 6: Mid-sentence intro with article: "...sister, ROSALIND, is..." or "...for NAN WATTS, a..."
    const midSentenceRegex = /[,]\s+([A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+){0,3})\s*[,(]/g;
    while ((m = midSentenceRegex.exec(trimmed)) !== null) {
      const candidate = m[1].trim();
      // Only accept if it's 2+ words OR if the single word is not a common word
      if (candidate.split(/\s+/).length >= 2) {
        addName(candidate);
      }
    }

    // Pattern 8: Catch-all — ANY ALL CAPS multi-word (2+) name followed by age digits,
    // regardless of what precedes it. This is the broadest pattern and handles cases
    // where the text before the name has unexpected formatting (e.g., "foot.JASPER
    // MONTGOMERY, 70" with no space after period, or other PDF extraction quirks).
    // Requires 2+ ALL CAPS words to avoid false positives on single uppercase words.
    const catchAllAgeRegex = /\b([A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+){1,3})(?:\s*[,(]\s*|\s+)\d{1,3}\b/g;
    while ((m = catchAllAgeRegex.exec(trimmed)) !== null) {
      addName(m[1].trim());
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    // For scene headings, skip the INT/EXT prefix but still scan the rest of the
    // line for character intros — PDF sometimes merges heading + action on one line
    // e.g. "1 EXT. FARM LAND – DAY JASPER MONTGOMERY, 70, he looks like..."
    if (/^(\d+[A-Z]?\s+)?(INT\.|EXT\.|INT\/EXT)/i.test(trimmed)) {
      // Try to extract overflow text after the time-of-day marker
      const timeMarker = trimmed.match(/\b(DAY|NIGHT|MORNING|EVENING|AFTERNOON|DAWN|DUSK|SUNSET|SUNRISE|CONTINUOUS|CONT|LATER|SAME)\b/i);
      if (timeMarker && timeMarker.index != null) {
        const afterTime = trimmed.slice(timeMarker.index + timeMarker[0].length).trim();
        if (afterTime.length > 5) {
          scanLineForIntros(afterTime);
        }
      }
      continue;
    }

    // Run all patterns on this line
    scanLineForIntros(trimmed);

    // Pattern 7: Cross-line character intro — name split across line break (PDF word-wrap).
    // If this line ends with ALL CAPS word(s), peek at the next non-empty line and
    // try combining them. This catches "...on foot. JASPER\nMONTGOMERY, 70, ..."
    // even when the normalizeScriptText join regex didn't merge the lines.
    const trailingCapsMatch = trimmed.match(/(?:^|[.!?]\s+|,\s+|\bfor\s+)([A-Z][A-Z'-]{2,}(?:\s+[A-Z][A-Z'-]{2,}){0,2})\s*$/);
    if (trailingCapsMatch && i + 1 < lines.length) {
      const nextTrimmed = lines[i + 1].trim();
      if (nextTrimmed && !/^(\d+[A-Z]?\s+)?(INT\.|EXT\.|INT\/EXT)/i.test(nextTrimmed)) {
        const combined = trimmed + ' ' + nextTrimmed;
        scanLineForIntros(combined);
      }
    }
  }

  // Build fragment → full name resolution map
  // If "LENNON" appears in "LENNON BOWIE" only, map LENNON → LENNON BOWIE
  // If "MONTGOMERY" appears in both "DEDRA MONTGOMERY" and "JASPER MONTGOMERY", skip (ambiguous)
  const resolveMap = new Map<string, string>();

  for (const fullName of fullNames) {
    const parts = fullName.split(/\s+/);
    for (const part of parts) {
      if (part.length < 3) continue;
      if (NAME_SCAN_EXCLUSIONS.has(part)) continue;
      if (isSupportingArtistRole(part)) continue;

      if (!resolveMap.has(part)) {
        resolveMap.set(part, fullName);
      } else if (resolveMap.get(part) !== fullName) {
        resolveMap.set(part, ''); // ambiguous — maps to multiple full names
      }
    }
  }

  // Remove ambiguous entries
  for (const [key, value] of resolveMap) {
    if (value === '') resolveMap.delete(key);
  }

  return resolveMap;
}




/* ━━━ Strict structural extractors (regex-only, no AI) ━━━ */

/**
 * Person-descriptor lexicon used for background detection. Generic
 * enough to work on any script — covers the most common "the X" /
 * "another X" roles that appear in action lines as background presence.
 */
const PERSON_DESCRIPTORS_BG = new Set([
  'MAN', 'WOMAN', 'MEN', 'WOMEN', 'BOY', 'GIRL', 'BOYS', 'GIRLS',
  'PERSON', 'PEOPLE', 'KID', 'KIDS', 'CHILD', 'CHILDREN', 'TEEN', 'TEENAGER',
  'BABY', 'INFANT', 'TODDLER', 'YOUTH', 'ADULT', 'ELDER',
  'GUY', 'GUYS', 'LADY', 'LADIES', 'STRANGER', 'FIGURE', 'CROWD',
  'NURSE', 'DOCTOR', 'SURGEON', 'PATIENT', 'PARAMEDIC', 'MEDIC', 'ORDERLY',
  'COP', 'COPS', 'OFFICER', 'DETECTIVE', 'AGENT', 'GUARD', 'SOLDIER', 'TROOP',
  'TROOPS', 'WARRIOR', 'WARRIORS', 'KNIGHT', 'CAPTAIN', 'LIEUTENANT', 'SERGEANT',
  'CORPORAL', 'PRIVATE', 'COLONEL', 'GENERAL', 'COMMANDER', 'CHIEF',
  'KING', 'QUEEN', 'PRINCE', 'PRINCESS', 'LORD', 'DUKE',
  'PRIEST', 'PASTOR', 'NUN', 'MONK', 'JUDGE', 'LAWYER', 'TEACHER', 'STUDENT',
  'PROFESSOR', 'SCIENTIST', 'TECHNICIAN', 'ENGINEER',
  'WORKER', 'CLERK', 'WAITER', 'WAITRESS', 'BARTENDER', 'BARMAN', 'BARMAID',
  'DRIVER', 'PILOT', 'SAILOR', 'CREWMAN', 'CREWMEMBER',
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

/**
 * Variant key for collapsing "YOUNG BRY" / "BRY" / "OLDER BRY" into one
 * canonical character when grouping. Strips age-descriptor prefixes.
 */
export function variantKey(name: string): string {
  const n = normalizeCharacterName(name);
  return n.replace(/^(YOUNG|YOUNGER|OLD|OLDER|TEEN|LITTLE|LIL)\s+/, '');
}

function leadingSpacesPrep(line: string): number {
  const m = line.match(/^( *)/);
  return m ? m[1].length : 0;
}

/**
 * After a candidate cue line, look ahead to confirm the next non-blank,
 * non-parenthetical-only line is dialogue (not another cue, scene
 * heading, or transition). When the cue is indented but the following
 * line sits at the left margin, it's a centred title card or sub-header,
 * not a real cue.
 */
function isFollowedByDialoguePrep(lines: string[], cueIdx: number): boolean {
  const cueIndent = leadingSpacesPrep(lines[cueIdx]);
  for (let i = cueIdx + 1; i < lines.length && i <= cueIdx + 5; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t) continue;
    if (/^\(.*\)$/.test(t)) continue;          // skip "(faintly)" / "(MORE)"
    if (/^\d+\.?$/.test(t)) continue;          // skip page numbers
    if (/^Page\s+\d+/i.test(t)) continue;
    if (isCharacterCue(t)) return false;       // another cue right after → fake
    if (/^(INT\.?|EXT\.?|I\/E\.?)\s/.test(t.toUpperCase())) return false;
    if (/^\d+\s*[A-Z]?\s+(INT|EXT)/.test(t.toUpperCase())) return false;
    if (/^(CUT |FADE |DISSOLVE )/.test(t.toUpperCase())) return false;
    if (cueIndent > 0 && leadingSpacesPrep(raw) === 0) return false;
    return true;
  }
  return false;
}

export interface CueHit {
  /** Line index in the source array. */
  lineIndex: number;
  /** Canonical name with parentheticals stripped. */
  name: string;
  /** Variant key (age prefixes collapsed) — groups BRY / YOUNG BRY. */
  variantKey: string;
  /** Original raw line text with extension parentheticals intact. */
  raw: string;
}

/**
 * Single-pass cue extraction across the whole script.
 *
 * Two filters apply: a per-line structural test (next non-blank line is
 * dialogue) and a per-script indentation cluster check. Industry-format
 * scripts indent dialogue cues to a consistent column; centred sub-headers
 * sit at the left margin. We compute the dominant cue indent from the
 * candidate set and drop anything far below it. Scripts that are entirely
 * flush-left (e.g. Fountain exports) skip the second filter automatically.
 */
export function extractCueLines(lines: string[]): CueHit[] {
  type Cand = { i: number; t: string; indent: number };
  const candidates: Cand[] = [];

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (!isCharacterCue(t)) continue;
    if (!isFollowedByDialoguePrep(lines, i)) continue;
    candidates.push({ i, t, indent: leadingSpacesPrep(lines[i]) });
  }

  let minIndent = 0;
  if (candidates.length >= 4) {
    const indents = candidates.map((c) => c.indent).sort((a, b) => a - b);
    const median = indents[Math.floor(indents.length / 2)];
    if (median >= 6) {
      minIndent = Math.floor(median / 2);
    }
  }

  const hits: CueHit[] = [];
  for (const c of candidates) {
    if (c.indent < minIndent) continue;
    const name = normalizeCharacterName(c.t);
    if (name.length < 2 || name.length > 35) continue;
    if (NON_CHARACTER_SINGLE_WORDS.has(name)) continue;
    hits.push({
      lineIndex: c.i,
      name,
      variantKey: variantKey(name),
      raw: c.t,
    });
  }
  return hits;
}

/**
 * Background extraction from a scene's action text.
 *
 * Returns a small ordered list of background labels (e.g. "PASSER BY",
 * "ELDERLY PATIENT") found in the action text. Speaker names supplied
 * via `knownSpeakers` are excluded so leads aren't double-listed as
 * background.
 *
 * Rules:
 *   - Multi-word ALL CAPS phrases (2–4 words) where a person-descriptor
 *     word is in the last two positions.
 *   - Single-word ALL CAPS tokens that are themselves person-descriptors
 *     (e.g. "NURSE", "REFEREE") and are introduced with an article
 *     (a/an/the/another/two/three/HER/HIS) immediately before them.
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

  // Multi-word ALL CAPS phrases (2–4 words).
  const multi = /\b([A-Z][A-Z'-]{1,}(?:\s+[A-Z][A-Z'-]{1,}){1,3})\b/g;
  let m: RegExpExecArray | null;
  while ((m = multi.exec(actionText)) !== null) {
    const phrase = m[1].trim();
    const words = phrase.split(/\s+/);
    if (words.some((w) => w === 'INT' || w === 'EXT')) continue;
    if (words.every((w) => NON_CHARACTER_SINGLE_WORDS.has(w))) continue;
    const tail = words.slice(-2);
    if (!tail.some((w) => PERSON_DESCRIPTORS_BG.has(w))) continue;
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
    if (!PERSON_DESCRIPTORS_BG.has(word)) continue;
    if (NON_CHARACTER_SINGLE_WORDS.has(word)) continue;
    if (speakerVariants.has(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= 12) break;
  }

  return out;
}
