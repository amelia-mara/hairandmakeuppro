/**
 * Normalize character name for comparison
 * Handles dual character names like "DEAN/PUNK ROCKER" by taking the first name
 */
export function normalizeCharacterName(name: string): string {
  let normalized = name.toUpperCase();

  // Remove parentheticals (V.O.), (O.S.), (CONT'D), etc.
  normalized = normalized.replace(/\s*\(.*?\)\s*/g, '');

  // Handle dual character names - take the first name as primary
  // e.g., "DEAN/PUNK ROCKER" -> "DEAN"
  if (normalized.includes('/') && !normalized.startsWith('INT') && !normalized.startsWith('EXT')) {
    const parts = normalized.split('/');
    // Only split if both parts look like names (not INT/EXT)
    if (parts[0].length >= 2 && parts[0].length <= 20) {
      normalized = parts[0].trim();
    }
  }

  return normalized.replace(/\s+/g, ' ').trim();
}

/**
 * Extract character names mentioned in action/description lines
 * These are characters physically present in a scene but not speaking
 *
 * This function is VERY conservative to avoid false positives. In scripts,
 * many words appear in ALL CAPS that are NOT character names (locations,
 * directions, emphasis words, etc.). We only extract:
 *
 * 1. Multi-word ALL CAPS phrases containing a person-descriptor word
 *    (MAN, WOMAN, BOY, GIRL, DOCTOR, etc.)
 * 2. Title Case names followed by action verbs ("Gwen approaches")
 *
 * Single ALL CAPS words in action lines are NOT extracted — they are too
 * unreliable without a schedule to cross-reference against.
 */
export function extractCharactersFromActionLine(line: string): string[] {
  const characters: string[] = [];
  const trimmed = line.trim();

  // Skip scene headings, transitions, and very short lines
  if (trimmed.length < 5) return characters;
  if (/^(INT\.|EXT\.|INT\/EXT|CUT TO|FADE|DISSOLVE|CONTINUED)/i.test(trimmed)) return characters;

  // Person-descriptor words — multi-word ALL CAPS phrases containing one of
  // these are very likely to be character references (e.g. "YOUNG WOMAN",
  // "OLD MAN", "TAXI DRIVER", "LITTLE GIRL")
  const personDescriptors = /\b(MAN|WOMAN|MEN|WOMEN|PERSON|PEOPLE|DRIVER|OFFICER|DOCTOR|DR|NURSE|GUARD|SOLDIER|WORKER|GIRL|BOY|LADY|LADIES|GUY|GUYS|KID|KIDS|CHILD|CHILDREN|TEEN|TEENAGER|CLERK|WAITER|WAITRESS|COP|COPS|DETECTIVE|AGENT|STRANGER|FIGURE|BABY|INFANT|TODDLER|GRANDAD|GRANDDAD|GRANDPA|GRANDMA|GRANDMOTHER|GRANDFATHER|MOTHER|FATHER|BROTHER|SISTER|HUSBAND|WIFE|SON|DAUGHTER|UNCLE|AUNT|NEPHEW|NIECE|COUSIN|PRIEST|PASTOR|JUDGE|LAWYER|TEACHER|STUDENT|BARTENDER|DOORMAN|BODYGUARD|MAID|BUTLER|NEIGHBOR|NEIGHBOUR|PATIENT|VICTIM|SUSPECT|WITNESS|PASSENGER|PILOT|CAPTAIN|LIEUTENANT|SERGEANT|CORPORAL|PRIVATE|COLONEL|GENERAL|COMMANDER|CHIEF|KING|QUEEN|PRINCE|PRINCESS|LORD|DUKE|COUNT|BARON|KNIGHT|SURGEON|PROFESSOR|RECEPTIONIST|SECRETARY|ASSISTANT|MANAGER|BOSS|OWNER|HOST|HOSTESS|THUG|THIEF|ROBBER|MUGGER|BULLY|GANGSTER|HITMAN|ASSASSIN|VILLAIN|HENCHMAN|SIDEKICK|ACCOMPLICE|LEADER|FOLLOWER|ELDER|SENIOR|JUNIOR|HOMELESS|BEGGAR|ORPHAN|WIDOW|WIDOWER|VETERAN|INMATE|PRISONER|CONVICT|JANITOR|PORTER|VALET|USHER|BELLHOP|CONCIERGE|SALESMAN|VENDOR|MERCHANT|TRADER|BANKER|FARMER|RANCHER|COWBOY|SHERIFF|DEPUTY|MARSHAL|PARAMEDIC|FIREFIGHTER|MARINE|SAILOR|AIRMAN|TROOPER|RANGER|SCOUT|SPY|INFORMANT|SNIPER|MEDIC|ORDERLY|ATTENDANT|CHAUFFEUR|CABBIE|TRUCKER|BIKER|CYCLIST|JOGGER|RUNNER|SWIMMER|DIVER|CLIMBER|HIKER|HUNTER|FISHERMAN|SINGER|DANCER|ACTOR|ACTRESS|MUSICIAN|ARTIST|PAINTER|SCULPTOR|WRITER|POET|JOURNALIST|REPORTER|ANCHOR|CAMERAMAN|PHOTOGRAPHER)\b/i;

  // Pattern 1: Multi-word ALL CAPS phrases that contain a person descriptor
  // e.g. "YOUNG WOMAN", "OLD MAN", "TAXI DRIVER", "LITTLE GIRL"
  const allCapsPattern = /\b([A-Z][A-Z.'-]+(?:\s+[A-Z][A-Z.'-]+){1,3})\b/g;
  let match;

  while ((match = allCapsPattern.exec(trimmed)) !== null) {
    const potential = match[1].trim();

    // Skip scene heading fragments
    if (/^(INT|EXT)\s*[.\/]/.test(potential)) continue;

    // Must contain a person-descriptor word
    if (!personDescriptors.test(potential)) continue;

    characters.push(potential);
  }

  // Pattern 2: Title Case names followed by action verbs
  // e.g. "Gwen approaches", "Jon and Peter sit down"
  const actionVerbs = 'enters|exits|walks|runs|stands|sits|looks|turns|moves|says|speaks|watches|stares|smiles|nods|shakes|reaches|grabs|holds|opens|closes|steps|crosses|approaches|leaves|arrives|appears|disappears|rises|falls|jumps|climbs|crawls|kneels|bends|leans|waves|points|gestures|signals|calls|shouts|whispers|laughs|cries|sighs|groans|screams|freezes|pauses|stops|starts|continues|begins|finishes|waits|hesitates|pulls|pushes|picks|puts|takes|gives|throws|catches|drops|lifts|carries|follows|leads|chases|hugs|kisses|slaps|punches|kicks|shoots|stabs|struggles|fights|ducks|dodges|rolls|slides|stumbles|trips|collapses|faints|wakes|sleeps|eats|drinks|reads|writes|drives|flies|swims|dances|sings|plays|works|tries|helps|saves|kills|dies';

  const titleCasePattern = new RegExp(
    `(?:^|[,;]\\s*|\\.\\s+)([A-Z][a-z]{2,}(?:\\s+(?:and|&)\\s+[A-Z][a-z]{2,})*)\\s+(?:${actionVerbs})`,
    'g'
  );

  while ((match = titleCasePattern.exec(trimmed)) !== null) {
    const names = match[1].split(/\s+(?:and|&)\s+/i);
    for (const name of names) {
      const upperName = name.trim().toUpperCase();
      if (upperName.length >= 3 && upperName.length <= 20) {
        characters.push(upperName);
      }
    }
  }

  // Deduplicate
  return [...new Set(characters)];
}

/**
 * Check if a line is a character cue (character name before dialogue)
 * Improved to better filter out false positives from action lines
 *
 * Character cues are names that appear alone on a line before dialogue.
 * They are typically centered and in ALL CAPS.
 */
export function isCharacterCue(line: string): boolean {
  const trimmed = line.trim();

  // Character cues are typically uppercase
  if (trimmed !== trimmed.toUpperCase()) return false;

  // Should be short (character names aren't long sentences)
  if (trimmed.length > 50) return false;

  // Should not start with common non-character patterns
  const nonCharPatterns = [
    /^\[?(INT\.|EXT\.|INT\/EXT|EXT\/INT|I\/E\.)/i,
    /^\[?(CUT TO|FADE|DISSOLVE|SMASH|MATCH|WIPE)\]?(\s|$)/i,
    /^\[?(THE END|CONTINUED|MORE|\(MORE\))\]?(\s|$)/i,
    /^\d+\s*$/,
    /^\s*$/,
    /^\[?(TITLE:|SUPER:|CHYRON:|CARD:|INSERT:|INTERCUT)\]?(\s|$)/i,
    /^\[?(FLASHBACK|END FLASHBACK|FLASH BACK|FLASH FORWARD|DREAM SEQUENCE|DREAM|MONTAGE|END MONTAGE|INTERCUT|END INTERCUT|PRESENT DAY|PRESENT|LATER|TIME CUT|TITLE CARD)\]?(\s|$)/i,
    /^\[?(BACK TO|RESUME|ANGLE ON|CLOSE ON|WIDE ON|POV)\]?(\s|$)/i,
    /^\[?(LATER|CONTINUOUS|MOMENTS LATER|SAME TIME)\]?(\s|$)/i,
    /^\[?(SUPERIMPOSE|SUBTITLE|CAPTION)\]?(\s|$)/i,
    /^\[?(EPISODE|CHAPTER|PART|ACT|SCENE|PILOT)\]?\s*\d*\s*$/i,
  ];

  for (const pattern of nonCharPatterns) {
    if (pattern.test(trimmed)) return false;
  }

  // Should contain at least one letter
  if (!/[A-Z]/.test(trimmed)) return false;

  // Filter out common action line patterns that are all caps
  // These typically describe what's happening, not who's speaking
  const actionPatterns = [
    /^(A |AN |THE |HE |SHE |THEY |WE |IT |HIS |HER |THEIR )/,
    /^(IN THE |AT THE |ON THE |FROM THE |TO THE |INTO THE )/,
    /^(ARRIVING|ENTERING|LEAVING|WALKING|RUNNING|STANDING|SITTING)/,
    / (ENTERS|EXITS|WALKS|RUNS|STANDS|SITS|LOOKS|TURNS|MOVES)$/,
    / (IS |ARE |WAS |WERE |HAS |HAVE |THE |A |AN )/, // Action lines have articles/verbs mid-sentence
    /^[A-Z]+ [A-Z]+ [A-Z]+ [A-Z]+ [A-Z]+/, // 5+ words is likely an action line
    /\.$/, // Character cues don't end with periods
    /^\d+[A-Z]?\s+/, // Starts with scene number
  ];

  for (const pattern of actionPatterns) {
    if (pattern.test(trimmed)) return false;
  }

  // Allow parentheticals like (V.O.), (O.S.), (CONT'D)
  const nameWithoutParen = trimmed.replace(/\s*\(.*?\)\s*/g, '').trim();

  // Character names should be reasonably short (1-4 words typically)
  const wordCount = nameWithoutParen.split(/\s+/).length;
  if (wordCount > 4) return false;

  // Comprehensive blacklist of non-character words.
  // Used for single-word rejection AND multi-word phrase filtering.
  const nonCharacterWords = new Set([
    // Pronouns (never character names)
    'HE', 'SHE', 'IT', 'WE', 'ME', 'US', 'HIM', 'HER', 'HIS', 'ITS',
    'THEY', 'THEM', 'THEIR', 'WHO', 'WHOM', 'WHOSE', 'WHAT', 'WHICH',
    'THAT', 'THIS', 'THESE', 'THOSE', 'MYSELF', 'HIMSELF', 'HERSELF',
    'ITSELF', 'OURSELVES', 'THEMSELVES', 'YOURSELF',
    // Prepositions / conjunctions / function words
    'BUT', 'FOR', 'NOT', 'ALL', 'WITH', 'FROM', 'INTO', 'UPON',
    'THAN', 'YET', 'NOR', 'SINCE', 'UNTIL', 'WHILE', 'DURING',
    'THROUGH', 'BETWEEN', 'AGAINST', 'WITHOUT', 'WITHIN', 'BEYOND',
    'ALONG', 'ACROSS', 'TOWARD', 'TOWARDS', 'AROUND', 'OVER', 'UNDER',
    'AFTER', 'BEFORE', 'NEAR', 'FAR',
    'AS', 'AT', 'BY', 'IF', 'OF', 'ON', 'OR', 'TO', 'UP', 'SO',
    'DO', 'GO', 'AM', 'AN', 'BE', 'MY', 'OUR', 'YOUR', 'TOO',
    'HOW', 'WHY', 'OFF', 'OUT', 'BACK', 'DOWN', 'AWAY',
    // Scene elements / locations
    'INT', 'EXT', 'ROAD', 'STREET', 'HOUSE', 'ROOM', 'OFFICE', 'BUILDING',
    'HALL', 'HALLWAY', 'CORRIDOR', 'LOBBY', 'FOYER', 'STAIRS', 'STAIRCASE',
    'BASEMENT', 'ATTIC', 'GARAGE', 'PORCH', 'BALCONY', 'TERRACE', 'ROOFTOP',
    'GARDEN', 'YARD', 'ALLEY', 'PARK', 'FIELD', 'PLAZA', 'SQUARE',
    'BRIDGE', 'TUNNEL', 'CAVE', 'CLIFF', 'LEDGE', 'RIDGE', 'SUMMIT', 'PEAK',
    'CHURCH', 'TEMPLE', 'HOSPITAL', 'SCHOOL', 'PRISON', 'JAIL', 'COURTHOUSE',
    'AIRPORT', 'STATION', 'HARBOR', 'HARBOUR', 'DOCK', 'PIER', 'WAREHOUSE',
    'FACTORY', 'LABORATORY', 'BUNKER', 'SHELTER', 'CABIN', 'COTTAGE', 'MANOR',
    'CASTLE', 'PALACE', 'TOWER', 'FORT', 'FORTRESS', 'CAMP', 'TENT',
    'KITCHEN', 'BATHROOM', 'BEDROOM', 'PARLOR', 'PARLOUR', 'STUDY', 'LIBRARY',
    'CAFETERIA', 'RESTAURANT', 'BAR', 'PUB', 'CLUB', 'CASINO', 'THEATER', 'THEATRE',
    'CEMETERY', 'GRAVEYARD', 'MORGUE', 'AUTOPSY', 'COURTROOM', 'PRECINCT',
    'CLASSROOM', 'GYMNASIUM', 'STADIUM', 'ARENA', 'RINK',
    // Time
    'DAY', 'NIGHT', 'MORNING', 'EVENING', 'DAWN', 'DUSK', 'LATER', 'CONTINUOUS',
    'MIDNIGHT', 'NOON', 'AFTERNOON', 'TWILIGHT', 'SUNSET', 'SUNRISE',
    // Common adjectives / adverbs (often in caps for emphasis)
    'EDENIC', 'VERDANT', 'TOWERING', 'LONELY', 'BEAUTIFUL', 'GORGEOUS', 'STUNNING',
    'SERENE', 'PEACEFUL', 'WILD', 'FIERCE', 'ANCIENT', 'MODERN', 'RUSTIC',
    'EXTREME', 'ALMOST', 'ABOUT', 'READY', 'SUDDENLY', 'FINALLY', 'SLOWLY',
    'QUICKLY', 'QUIETLY', 'LOUDLY', 'SOFTLY', 'GENTLY', 'ROUGHLY', 'BARELY',
    'EXACTLY', 'SIMPLY', 'MERELY', 'UTTERLY', 'COMPLETELY', 'ENTIRELY',
    'ACTUALLY', 'BASICALLY', 'APPARENTLY', 'OBVIOUSLY', 'CLEARLY', 'CERTAINLY',
    'PERHAPS', 'MAYBE', 'PROBABLY', 'POSSIBLY', 'LIKELY', 'UNLIKELY',
    'TOGETHER', 'ALONE', 'APART', 'AHEAD', 'BEHIND', 'ABOVE', 'BELOW',
    'INSIDE', 'OUTSIDE', 'UPSTAIRS', 'DOWNSTAIRS', 'NEARBY', 'ELSEWHERE',
    'FOREVER', 'ALWAYS', 'NEVER', 'SOMETIMES', 'OFTEN', 'RARELY', 'SELDOM',
    'ALREADY', 'ANYWAY', 'HOWEVER', 'MEANWHILE', 'OTHERWISE', 'THEREFORE',
    'ABSOLUTELY', 'DEFINITELY', 'SERIOUSLY', 'LITERALLY', 'BASICALLY',
    // Common nouns / abstract words (caps for emphasis)
    'SILENCE', 'DARKNESS', 'NOTHING', 'EVERYTHING', 'SOMETHING', 'ANYTHING',
    'NOBODY', 'EVERYBODY', 'SOMEONE', 'ANYONE', 'EVERYONE', 'NOWHERE', 'EVERYWHERE',
    'TIME', 'SPACE', 'PLACE', 'HOME', 'WORLD', 'EARTH', 'HEAVEN', 'HELL',
    'LOVE', 'HATE', 'FEAR', 'HOPE', 'DEATH', 'LIFE', 'TRUTH', 'LIES', 'POWER',
    'MONEY', 'BLOOD', 'FIRE', 'SMOKE', 'DUST', 'SAND', 'MUD', 'ICE', 'FROST',
    'THUNDER', 'LIGHTNING', 'STORM', 'EXPLOSION', 'CRASH', 'BANG', 'BOOM',
    'SCREAM', 'SILENCE', 'WHISPER', 'ECHO', 'VOICE', 'SOUND', 'NOISE', 'MUSIC',
    'CHAOS', 'PANIC', 'MAYHEM', 'CARNAGE', 'WRECKAGE', 'DEBRIS', 'RUBBLE',
    'SHOCK', 'HORROR', 'TERROR', 'RAGE', 'FURY', 'AGONY', 'GRIEF', 'ANGER',
    'RELIEF', 'DESPAIR', 'SURPRISE', 'WONDER', 'DISGUST', 'SORROW', 'DREAD',
    'LIKE', 'JUST', 'ONLY', 'REAL', 'TRUE', 'SAME', 'DIFFERENT', 'SPECIAL',
    'SECRET', 'PRIVATE', 'PUBLIC', 'FINAL', 'TOTAL', 'PERFECT', 'COMPLETE',
    'TYPE', 'OPEN', 'SHUT', 'EMPTY', 'FULL', 'BUSY', 'FREE', 'SAFE',
    'LUCKY', 'SORRY', 'GUILTY', 'WRONG', 'CRAZY', 'ANGRY', 'UPSET',
    // Nature / scenery
    'MOUNTAINS', 'MOUNTAIN', 'HILLS', 'VALLEY', 'RIVER', 'STREAM', 'LAKE', 'OCEAN',
    'FOREST', 'WOODS', 'TREE', 'TREES', 'SKY', 'SUN', 'MOON', 'MELTWATER',
    'DESERT', 'JUNGLE', 'SWAMP', 'MARSH', 'BOG', 'MEADOW', 'PRAIRIE', 'PLAIN',
    'ISLAND', 'COAST', 'SHORE', 'WATERFALL', 'VOLCANO', 'GLACIER', 'CANYON',
    // Colors
    'RED', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE', 'PURPLE', 'BLACK', 'WHITE', 'GOLDEN',
    'CRIMSON', 'SCARLET', 'AZURE', 'IVORY', 'SILVER',
    // Numbers / quantities
    'VERY', 'MUCH', 'MORE', 'MOST', 'JUST', 'ONLY', 'ALSO', 'EVEN', 'STILL', 'WELL',
    'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
    'FIRST', 'SECOND', 'THIRD', 'LAST', 'NEXT', 'ANOTHER', 'HALF', 'DOUBLE', 'TRIPLE',
    // Screenplay terms
    'CONTINUED', 'FADE', 'CUT', 'DISSOLVE', 'ANGLE', 'SHOT', 'VIEW', 'CLOSE', 'WIDE',
    'RESUME', 'BEGIN', 'END', 'STOP', 'START', 'PAUSE', 'BEAT',
    'PRELAP', 'OVERLAP', 'INTERCUT', 'MONTAGE', 'SERIES', 'SEQUENCE',
    // Objects / props
    'PHONE', 'GUN', 'KNIFE', 'SWORD', 'WEAPON', 'BOMB', 'GRENADE', 'RIFLE',
    'CAR', 'TRUCK', 'BUS', 'TRAIN', 'PLANE', 'HELICOPTER', 'BOAT', 'SHIP',
    'TAXI', 'AMBULANCE', 'MOTORCYCLE', 'BICYCLE', 'WHEELCHAIR', 'VEHICLE',
    'DOOR', 'WINDOW', 'WALL', 'FLOOR', 'CEILING', 'ROOF',
    'TABLE', 'CHAIR', 'DESK', 'BED', 'COUCH', 'SOFA', 'BENCH',
    'LAMP', 'MIRROR', 'CLOCK', 'SCREEN', 'MONITOR', 'COMPUTER', 'LAPTOP',
    'RADIO', 'TELEVISION', 'CAMERA', 'MICROPHONE', 'SPEAKER',
    'BAG', 'BOX', 'CASE', 'TRUNK', 'CHEST', 'DRAWER', 'CABINET', 'SHELF',
    'BOTTLE', 'GLASS', 'CUP', 'PLATE', 'BOWL', 'TRAY', 'BASKET',
    'KEY', 'LOCK', 'CHAIN', 'ROPE', 'WIRE', 'CABLE', 'PIPE', 'TUBE',
    'SIGN', 'FLAG', 'BANNER', 'POSTER', 'PHOTO', 'PICTURE', 'PAINTING',
    'BOOK', 'LETTER', 'NOTE', 'MAP', 'CARD', 'ENVELOPE', 'PACKAGE',
    'RING', 'NECKLACE', 'BRACELET', 'WATCH', 'HELMET', 'MASK', 'BADGE',
    // Misc common words that appear in caps in scripts
    'TITLE', 'CREDIT', 'CREDITS', 'SUBTITLE', 'CAPTION', 'CARD',
    'CHAPTER', 'PART', 'ACT', 'SCENE', 'EPISODE', 'PILOT',
    'DREAM', 'NIGHTMARE', 'MEMORY', 'VISION', 'FLASHBACK', 'FANTASY',
    'PRESENT', 'PAST', 'FUTURE', 'HISTORY', 'LEGEND', 'MYTH', 'PROPHECY',
    'UNKNOWN', 'UNTITLED', 'UNNAMED', 'UNIDENTIFIED', 'ANONYMOUS',
    'VARIOUS', 'SEVERAL', 'MULTIPLE', 'NUMEROUS', 'COUNTLESS',
    'OTHER', 'ANOTHER', 'EITHER', 'NEITHER', 'BOTH', 'NONE', 'EACH', 'EVERY',
    'HERE', 'THERE', 'WHERE', 'WHEN', 'THEN', 'NOW', 'SOON', 'AGO', 'HENCE',
    'AGAIN', 'ONCE', 'TWICE', 'THRICE', 'OFTEN', 'SELDOM', 'NEVER', 'ALWAYS',
    'OKAY', 'YEAH', 'SURE', 'RIGHT', 'WRONG', 'TRUE', 'FALSE', 'YES', 'NO',
  ]);

  // Single word checks - filter out words that are NOT character names
  if (wordCount === 1) {
    // Filter out words ending in common adjective/verb suffixes.
    // Only apply to words with 6+ characters to avoid rejecting short names
    // like TED, FRED, NED (ED), LILY, EMILY, SALLY (LY), ERIC (IC),
    // KING (ING), GRANT (ANT), CLIVE (IVE), etc.
    if (nameWithoutParen.length >= 6) {
      const nonNameSuffixes = /^[A-Z]+(ING|ED|LY|TION|SION|NESS|MENT|ABLE|IBLE|ICAL|IOUS|EOUS|ULAR|TERN|ERN|WARD|WARDS|LIKE|LESS|FUL|IC|AL|ARY|ORY|IVE|OUS|ANT|ENT)$/;
      if (nonNameSuffixes.test(nameWithoutParen)) return false;
    }

    if (nonCharacterWords.has(nameWithoutParen)) return false;
  }

  // Multi-word checks — filter out compound phrases that aren't character names
  if (wordCount >= 2) {
    const words = nameWithoutParen.split(/\s+/);

    // If every word in the phrase is a known non-character word, reject
    if (words.every(w => nonCharacterWords.has(w))) return false;

    // Curated multi-word non-character phrases (screenplay terms, directions)
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

  // Character names should be reasonably short
  return nameWithoutParen.length >= 2 && nameWithoutParen.length <= 35;
}
