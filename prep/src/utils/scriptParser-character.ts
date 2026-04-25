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
  if (normalized.includes('/') && !normalized.startsWith('INT') && !normalized.startsWith('EXT')) {
    const parts = normalized.split('/');
    if (parts[0].length >= 2 && parts[0].length <= 20) {
      normalized = parts[0].trim();
    }
  }
  return normalized.replace(/\s+/g, ' ').trim();
}

export function extractCharactersFromActionLine(line: string): string[] {
  const characters: string[] = [];
  const trimmed = line.trim();

  if (trimmed.length < 5) return characters;
  if (/^(INT\.|EXT\.|INT\/EXT|CUT TO|FADE|DISSOLVE|CONTINUED)/i.test(trimmed)) return characters;

  let match;

  /* Character introduction pattern: ALL CAPS NAME followed by comma, age, or
     parenthetical — e.g. "LENNON BOWIE, 28" or "DEDRA MONTGOMERY 29, an icy beauty"
     This is the standard screenplay way to introduce a character in action lines. */
  const introPattern = /^([A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+){0,3})\s*[,(\s]\s*\d{1,3}\b/;
  const introMatch = trimmed.match(introPattern);
  if (introMatch) {
    const name = introMatch[1].trim();
    if (name.length >= 3 && !/^(INT|EXT|CUT|FADE|THE|SCENE)\b/.test(name)) {
      characters.push(name);
    }
  }

  /* Also detect ALL CAPS names (2+ words) at start of line followed by comma —
     standard character intro even without age: "LENNON BOWIE, is a cowboy..." */
  const capsCommaPattern = /^([A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+){1,3})\s*,/;
  const capsCommaMatch = trimmed.match(capsCommaPattern);
  if (capsCommaMatch) {
    const name = capsCommaMatch[1].trim();
    if (name.length >= 3 && !/^(INT|EXT|CUT|FADE|THE|SCENE)\b/.test(name)) {
      characters.push(name);
    }
  }

  /* Mid-line character introduction: ALL CAPS NAME (2+ words) after a sentence break
     or mid-sentence, followed by comma + age or comma + lowercase description.
     e.g. "...on foot. JASPER MONTGOMERY, 70, he looks like..."
     e.g. "Her husband, ARCHIBALD CHRISTIE, dashing, holds her hand."
     e.g. "...the door for NAN WATTS, a prim-looking woman"
     e.g. "...on foot. JASPER MONTGOMERY 70, he looks like..." (space before age) */
  const midLineIntroRe = /(?:[.!?]\s+|,\s+|\bfor\s+)([A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+){1,3})(?:\s*[,(]\s*(?:\d{1,3}\b|[a-z])|\s+\d{1,3}\s*,)/g;
  while ((match = midLineIntroRe.exec(trimmed)) !== null) {
    const name = match[1].trim();
    if (name.length >= 3 && !/^(INT|EXT|CUT|FADE|THE|SCENE|AND|BUT|FOR|NOR|YET)\b/.test(name)) {
      characters.push(name);
    }
  }

  const actionVerbs = 'enters|exits|walks|runs|stands|sits|looks|turns|moves|says|speaks|watches|stares|smiles|nods|shakes|reaches|grabs|holds|opens|closes|steps|crosses|approaches|leaves|arrives|appears|disappears|rises|falls|jumps|climbs|crawls|kneels|bends|leans|waves|points|gestures|signals|calls|shouts|whispers|laughs|cries|sighs|groans|screams|freezes|pauses|stops|starts|continues|begins|finishes|waits|hesitates|pulls|pushes|picks|puts|takes|gives|throws|catches|drops|lifts|carries|follows|leads|chases|hugs|kisses|slaps|punches|kicks|shoots|stabs|struggles|fights|ducks|dodges|rolls|slides|stumbles|trips|collapses|faints|wakes|sleeps|eats|drinks|reads|writes|drives|flies|swims|dances|sings|plays|works|tries|helps|saves|kills|dies';

  /* Title Case name + action verb: "Lennon rides", "Dedra watches"
     Skip pronouns/articles/common words that aren't character names */
  const nonNameWords = new Set([
    // Pronouns & determiners
    'SHE', 'HER', 'HIS', 'HIM', 'THE', 'THEY', 'THEM', 'THIS', 'THAT',
    'WHO', 'WHAT', 'ITS', 'OUR', 'YOUR', 'ONE', 'TWO', 'ALL', 'EACH',
    'SOME', 'BOTH', 'FEW', 'MANY', 'MOST', 'OTHER', 'SUCH',
    // Common nouns / generic roles — never character names from action lines
    'MAN', 'WOMAN', 'BOY', 'GIRL', 'CHILD', 'BABY', 'TEEN', 'KID', 'LADY', 'GUY',
    'COWBOY', 'HORSE', 'DOG', 'CAT', 'ANIMAL', 'BIRD',
    'DRIVER', 'OFFICER', 'GUARD', 'SOLDIER', 'DOCTOR', 'NURSE', 'JUDGE',
    'WAITER', 'WAITRESS', 'BARTENDER', 'CLERK', 'MAID', 'BUTLER',
    'STRANGER', 'FIGURE', 'PERSON', 'PEOPLE', 'CROWD', 'GROUP',
    'DANCER', 'SINGER', 'CYCLIST', 'JOGGER', 'RUNNER', 'SWIMMER',
    'THUG', 'THIEF', 'VICTIM', 'WITNESS', 'SUSPECT', 'PASSENGER',
    'MOTHER', 'FATHER', 'BROTHER', 'SISTER', 'HUSBAND', 'WIFE',
    // Common verbs that appear in Title Case at sentence start
    'ANOTHER', 'INSIDE', 'OUTSIDE', 'BEHIND', 'AROUND', 'THROUGH',
    'BEFORE', 'AFTER', 'ABOUT', 'BETWEEN', 'AGAINST', 'WITHOUT',
    'NOTHING', 'SOMETHING', 'EVERYTHING', 'EVERYONE', 'SOMEONE', 'NOBODY',
  ]);

  const titleCasePattern = new RegExp(
    `(?:^|[,;]\\s*|\\.\\s+)([A-Z][a-z]{2,}(?:\\s+(?:and|&)\\s+[A-Z][a-z]{2,})*)\\s+(?:${actionVerbs})`,
    'g'
  );

  while ((match = titleCasePattern.exec(trimmed)) !== null) {
    const names = match[1].split(/\s+(?:and|&)\s+/i);
    for (const name of names) {
      const upperName = name.trim().toUpperCase();
      if (upperName.length >= 3 && upperName.length <= 20 && !nonNameWords.has(upperName)) {
        characters.push(upperName);
      }
    }
  }

  /* Catch-all: ANY ALL CAPS multi-word (2+) name followed by age digits anywhere in the
     line. This is the broadest pattern and handles cases where the text before the name
     has unexpected formatting from PDF extraction (e.g., missing space after period).
     Requires 2+ ALL CAPS words to minimise false positives. */
  const catchAllIntroRe = /\b([A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+){1,3})(?:\s*[,(]\s*|\s+)\d{1,3}\b/g;
  while ((match = catchAllIntroRe.exec(trimmed)) !== null) {
    const name = match[1].trim();
    if (name.length >= 3 && !/^(INT|EXT|CUT|FADE|THE|SCENE|AND|BUT|FOR|NOR|YET)\b/.test(name)) {
      characters.push(name);
    }
  }

  return [...new Set(characters)];
}

/* ━━━ Character cue detection ━━━ */

export function isCharacterCue(line: string): boolean {
  const trimmed = line.trim();

  if (trimmed !== trimmed.toUpperCase()) return false;
  if (trimmed.length > 50) return false;

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



