import * as pdfjsLib from 'pdfjs-dist';
import type { Scene, Character } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { parseScriptWithAI, checkAIAvailability } from '@/services/aiService';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ParsedScript {
  title: string;
  scenes: ParsedScene[];
  characters: ParsedCharacter[];
  rawText: string;
}

export interface ParsedScene {
  sceneNumber: string;
  slugline: string;
  intExt: 'INT' | 'EXT';
  location: string;
  timeOfDay: 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS';
  characters: string[]; // Character names appearing in scene
  content: string;
  synopsis?: string;
}

export interface ParsedCharacter {
  name: string;
  normalizedName: string;
  sceneCount: number;
  dialogueCount: number;
  scenes: string[]; // Scene numbers where character appears
  variants: string[]; // Name variations found (e.g., "JOHN", "JOHN (V.O.)")
  description?: string;
}

// Fast-parsed scene interface (no characters, just scene structure)
export interface FastParsedScene {
  sceneNumber: string;
  slugline: string;
  intExt: 'INT' | 'EXT';
  location: string;
  timeOfDay: 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS';
  scriptContent: string;
  // Characters NOT included - detected later
}

// Result of fast scene parsing
export interface FastParsedScript {
  title: string;
  scenes: FastParsedScene[];
  rawText: string;
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

/**
 * Extract text content from a PDF file with improved line structure preservation
 * Groups text items by Y position to reconstruct lines properly
 */
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Group text items by Y position (line-by-line reconstruction)
    const lines: Map<number, Array<{ x: number; text: string; width: number }>> = new Map();

    for (const item of textContent.items as TextItem[]) {
      if (!item.str || item.str.trim() === '') continue;

      // Round Y position to group items on the same line (allow 2px tolerance)
      const y = Math.round(item.transform[5] / 2) * 2;
      const x = item.transform[4];

      if (!lines.has(y)) {
        lines.set(y, []);
      }
      lines.get(y)!.push({ x, text: item.str, width: item.width || 0 });
    }

    // Sort lines by Y position (top to bottom, so descending Y)
    const sortedYPositions = Array.from(lines.keys()).sort((a, b) => b - a);

    for (const y of sortedYPositions) {
      const lineItems = lines.get(y)!;
      // Sort items within line by X position (left to right)
      lineItems.sort((a, b) => a.x - b.x);

      // Reconstruct line with proper spacing
      let lineText = '';
      let lastX = 0;
      let lastWidth = 0;

      for (const item of lineItems) {
        // Calculate gap between items
        const gap = item.x - (lastX + lastWidth);

        // Add spaces for significant gaps (indicates word separation)
        if (lastX > 0 && gap > 3) {
          // Large gap might indicate tab/column separation
          if (gap > 20) {
            lineText += '    '; // Tab-like spacing
          } else {
            lineText += ' ';
          }
        }

        lineText += item.text;
        lastX = item.x;
        lastWidth = item.width;
      }

      fullText += lineText.trimEnd() + '\n';
    }

    fullText += '\n'; // Page break
  }

  // Normalize the text for better script parsing
  return normalizeScriptText(fullText);
}

/**
 * Normalize script text to fix common PDF extraction issues
 */
function normalizeScriptText(text: string): string {
  return text
    // Fix split INT/EXT headings (e.g., "INT" on one line, ". LOCATION" on next)
    .replace(/\b(INT|EXT)\s*\n\s*\./g, '$1.')
    .replace(/\b(INT|EXT)\s*\n\s*\/\s*(INT|EXT)/g, '$1/$2')
    // Fix split CONTINUOUS
    .replace(/CONTIN\s*\n\s*UED?/gi, 'CONTINUOUS')
    .replace(/CONT['']?D/gi, "CONT'D")
    // Fix split character names with (V.O.) or (O.S.)
    .replace(/\(\s*V\s*\.\s*O\s*\.\s*\)/gi, '(V.O.)')
    .replace(/\(\s*O\s*\.\s*S\s*\.\s*\)/gi, '(O.S.)')
    // Normalize multiple spaces
    .replace(/[ \t]+/g, ' ')
    // Normalize multiple newlines (but keep paragraph breaks)
    .replace(/\n{4,}/g, '\n\n\n')
    // Clean up scene number patterns like "1 ." -> "1."
    .replace(/(\d+[A-Z]?)\s+\./g, '$1.')
    .trim();
}

/**
 * Extract text from Final Draft XML (FDX) format
 */
function extractTextFromFDX(xmlContent: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    const paragraphs = doc.querySelectorAll('Paragraph');

    let text = '';
    paragraphs.forEach((para) => {
      const type = para.getAttribute('Type');
      const textElements = para.querySelectorAll('Text');
      let paraText = '';

      textElements.forEach((textEl) => {
        paraText += textEl.textContent || '';
      });

      // Format based on type
      if (type === 'Scene Heading') {
        text += '\n' + paraText.trim() + '\n';
      } else if (type === 'Character') {
        text += '\n' + paraText.trim().toUpperCase() + '\n';
      } else if (type === 'Dialogue') {
        text += paraText.trim() + '\n';
      } else if (type === 'Action') {
        text += '\n' + paraText.trim() + '\n';
      } else {
        text += paraText.trim() + '\n';
      }
    });

    return text;
  } catch (e) {
    console.error('Error parsing FDX:', e);
    return xmlContent;
  }
}

/**
 * Normalize time of day string to the scene's expected type
 * Maps various script time indicators to our standard set
 */
function normalizeTimeOfDayForScene(timeStr: string): 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS' {
  const upper = (timeStr || 'DAY').toUpperCase();

  // Night variations
  if (upper === 'NIGHT' || upper === 'NIGHTMARE') return 'NIGHT';

  // Morning variations
  if (upper === 'MORNING' || upper === 'DAWN' || upper === 'SUNRISE') return 'MORNING';

  // Evening variations
  if (upper === 'EVENING' || upper === 'DUSK' || upper === 'SUNSET' ||
      upper === 'MAGIC HOUR' || upper === 'GOLDEN HOUR') return 'EVENING';

  // Continuous variations
  if (upper === 'CONTINUOUS' || upper === 'CONT' || upper === 'LATER' ||
      upper === 'SAME' || upper === 'SAME TIME' || upper === 'MOMENTS LATER' ||
      upper === 'SIMULTANEOUS') return 'CONTINUOUS';

  // Day is default (including AFTERNOON, FLASHBACK, PRESENT, ESTABLISHING, etc.)
  return 'DAY';
}

/**
 * Normalize character name for comparison
 * Handles dual character names like "DEAN/PUNK ROCKER" by taking the first name
 */
function normalizeCharacterName(name: string): string {
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
function extractCharactersFromActionLine(line: string): string[] {
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
function isCharacterCue(line: string): boolean {
  const trimmed = line.trim();

  // Character cues are typically uppercase
  if (trimmed !== trimmed.toUpperCase()) return false;

  // Should be short (character names aren't long sentences)
  if (trimmed.length > 50) return false;

  // Should not start with common non-character patterns
  const nonCharPatterns = [
    /^(INT\.|EXT\.|INT\/EXT|EXT\/INT|I\/E\.)/i,
    /^(CUT TO|FADE|DISSOLVE|SMASH|MATCH|WIPE)/i,
    /^(THE END|CONTINUED|MORE|\(MORE\))/i,
    /^\d+\s*$/,
    /^\s*$/,
    /^(TITLE:|SUPER:|CHYRON:|CARD:|INSERT:|INTERCUT)/i,
    /^(FLASHBACK|END FLASHBACK|FLASH BACK|DREAM SEQUENCE)/i,
    /^(BACK TO|RESUME|ANGLE ON|CLOSE ON|WIDE ON|POV)/i,
    /^(LATER|CONTINUOUS|MOMENTS LATER|SAME TIME)/i,
    /^(SUPERIMPOSE|SUBTITLE|CAPTION)/i,
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

  // Single word checks - filter out words that are NOT character names
  if (wordCount === 1) {
    // Filter out words ending in common adjective/verb suffixes
    const nonNameSuffixes = /^[A-Z]+(ING|ED|LY|TION|SION|NESS|MENT|ABLE|IBLE|ICAL|IOUS|EOUS|ULAR|TERN|ERN|WARD|WARDS|LIKE|LESS|FUL|IC|AL|ARY|ORY|IVE|OUS|ANT|ENT)$/;
    if (nonNameSuffixes.test(nameWithoutParen)) return false;

    // Filter out common non-character single words
    // This must be comprehensive — any ALL CAPS English word on its own line
    // can be mistaken for a character cue in badly-formatted scripts
    const nonCharacterSingleWords = new Set([
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
      // Common verbs / action words (caps for emphasis)
      'SILENCE', 'DARKNESS', 'NOTHING', 'EVERYTHING', 'SOMETHING', 'ANYTHING',
      'NOBODY', 'EVERYBODY', 'SOMEONE', 'ANYONE', 'EVERYONE', 'NOWHERE', 'EVERYWHERE',
      'TIME', 'SPACE', 'PLACE', 'HOME', 'WORLD', 'EARTH', 'HEAVEN', 'HELL',
      'LOVE', 'HATE', 'FEAR', 'HOPE', 'DEATH', 'LIFE', 'TRUTH', 'LIES', 'POWER',
      'MONEY', 'BLOOD', 'FIRE', 'SMOKE', 'DUST', 'SAND', 'MUD', 'ICE', 'FROST',
      'THUNDER', 'LIGHTNING', 'STORM', 'EXPLOSION', 'CRASH', 'BANG', 'BOOM',
      'SCREAM', 'SILENCE', 'WHISPER', 'ECHO', 'VOICE', 'SOUND', 'NOISE', 'MUSIC',
      'CHAOS', 'PANIC', 'MAYHEM', 'CARNAGE', 'WRECKAGE', 'DEBRIS', 'RUBBLE',
      'LIKE', 'JUST', 'ONLY', 'REAL', 'TRUE', 'SAME', 'DIFFERENT', 'SPECIAL',
      'SECRET', 'PRIVATE', 'PUBLIC', 'FINAL', 'TOTAL', 'PERFECT', 'COMPLETE',
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

    if (nonCharacterSingleWords.has(nameWithoutParen)) return false;
  }

  // Character names should be reasonably short
  return nameWithoutParen.length >= 2 && nameWithoutParen.length <= 35;
}

/**
 * Parsed scene heading result
 */
interface ParsedSceneHeading {
  sceneNumber: string | null;
  intExt: 'INT' | 'EXT';
  location: string;
  timeOfDay: string;
  rawSlugline: string;
  isValid: boolean;
}

/**
 * Check if a line is a scene heading
 * Handles scene numbers before and after INT/EXT
 * Examples:
 *   "4    INT. HOTEL ROOM - CONTINUOUS    4"
 *   "INT. COFFEE SHOP - DAY"
 *   "12A  EXT. PARK - NIGHT  12A"
 *   "I/E. FARMHOUSE - KITCHEN - DAY"
 */
/**
 * Parse a scene heading line and extract all components
 * Handles various formats:
 *   - Scene numbers on left: "4 INT. LOCATION - TIME"
 *   - Scene numbers on both sides: "4 INT. LOCATION - TIME 4"
 *   - Scene numbers with letters: "4A INT. LOCATION - TIME"
 *   - Various INT/EXT formats: INT., EXT., I/E., INT./EXT., INT/EXT
 *   - Various separators: dashes, periods, commas
 */
function parseSceneHeadingLine(line: string): ParsedSceneHeading {
  const trimmed = line.trim();

  // Default invalid result
  const invalidResult: ParsedSceneHeading = {
    sceneNumber: null,
    intExt: 'INT',
    location: '',
    timeOfDay: 'DAY',
    rawSlugline: trimmed,
    isValid: false,
  };

  if (!trimmed || trimmed.length < 5) return invalidResult;

  // Remove revision asterisks from end
  let cleanLine = trimmed.replace(/\s*\*+\s*$/, '').trim();

  // Pattern to match scene numbers (with optional letter suffix)
  const sceneNumPattern = /^(\d+[A-Z]?)\s+/i;
  const trailingSceneNumPattern = /\s+(\d+[A-Z]?)\s*$/i;

  let sceneNumber: string | null = null;
  let workingLine = cleanLine;

  // Extract leading scene number
  const leadingMatch = workingLine.match(sceneNumPattern);
  if (leadingMatch) {
    sceneNumber = leadingMatch[1].toUpperCase();
    workingLine = workingLine.slice(leadingMatch[0].length).trim();
  }

  // Extract trailing scene number (and validate it matches leading if both exist)
  const trailingMatch = workingLine.match(trailingSceneNumPattern);
  if (trailingMatch) {
    const trailingNum = trailingMatch[1].toUpperCase();
    if (!sceneNumber) {
      sceneNumber = trailingNum;
    }
    // Remove trailing scene number
    workingLine = workingLine.slice(0, -trailingMatch[0].length).trim();
  }

  // Now check for INT/EXT pattern
  // Supports: INT. INT EXT. EXT I/E. I/E INT./EXT. INT/EXT EXT./INT. EXT/INT
  const intExtPattern = /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|INT\.?|EXT\.?)\s*/i;
  const intExtMatch = workingLine.match(intExtPattern);

  if (!intExtMatch) {
    return invalidResult;
  }

  const intExtRaw = intExtMatch[1].toUpperCase().replace(/\.$/, '');
  const intExt: 'INT' | 'EXT' = intExtRaw.startsWith('EXT') ? 'EXT' : 'INT';

  // Remove INT/EXT from working line
  workingLine = workingLine.slice(intExtMatch[0].length).trim();

  // Remove leading period or dash if present (some scripts have "INT. - LOCATION")
  workingLine = workingLine.replace(/^[\.\-–—]\s*/, '').trim();

  // Now extract time of day and location
  // Build regex to find time of day (handling various separators)
  // Matches: "- DAY", "-- DAY", "– DAY", "— DAY", ". DAY", ", DAY", just "DAY" at end
  const timeSeparatorPattern = /(?:\s*[-–—\.]+\s*|\s+)(DAY|NIGHT|MORNING|EVENING|AFTERNOON|DAWN|DUSK|SUNSET|SUNRISE|CONTINUOUS|CONT|LATER|SAME|SAME TIME|MOMENTS LATER|SIMULTANEOUS|MAGIC HOUR|GOLDEN HOUR|FLASHBACK|PRESENT|DREAM|FANTASY|NIGHTMARE|ESTABLISHING)(?:\s*[-–—]?\s*(?:FLASHBACK|PRESENT|CONT(?:'D)?)?)?$/i;

  let timeOfDay = 'DAY';
  let location = workingLine;

  const timeMatch = workingLine.match(timeSeparatorPattern);
  if (timeMatch) {
    timeOfDay = timeMatch[1].toUpperCase();
    // Normalize some time values
    if (timeOfDay === 'CONT') timeOfDay = 'CONTINUOUS';

    // Extract location (everything before the time match)
    location = workingLine.slice(0, timeMatch.index).trim();
    // Clean up trailing separators from location
    location = location.replace(/[\s\-–—\.,]+$/, '').trim();
  }

  // If no time found but line is valid scene heading format, assume DAY
  if (!timeMatch && workingLine.length > 0) {
    location = workingLine.replace(/[\s\-–—\.,]+$/, '').trim();
  }

  // Validate: must have a location
  if (!location || location.length < 2) {
    return invalidResult;
  }

  return {
    sceneNumber,
    intExt,
    location,
    timeOfDay,
    rawSlugline: trimmed, // Keep original for reference
    isValid: true,
  };
}

/**
 * Parse script text to extract scenes and characters
 */
export function parseScriptText(text: string): ParsedScript {
  const lines = text.split('\n');
  const scenes: ParsedScene[] = [];
  const characterMap = new Map<string, ParsedCharacter>();

  let currentScene: ParsedScene | null = null;
  let fallbackSceneNumber = 0; // Used only if script doesn't have scene numbers
  let currentSceneContent = '';
  let lastLineWasCharacter = false;
  let dialogueCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for scene heading using the new robust parser
    const parsedHeading = parseSceneHeadingLine(trimmed);

    if (parsedHeading.isValid) {
      // Save previous scene
      if (currentScene) {
        currentScene.content = currentSceneContent.trim();
        scenes.push(currentScene);
      }

      // Use scene number from script, or fall back to sequential
      fallbackSceneNumber++;
      const sceneNum = parsedHeading.sceneNumber || String(fallbackSceneNumber);

      // Normalize time of day to our expected types
      const normalizedTime = normalizeTimeOfDayForScene(parsedHeading.timeOfDay);

      currentScene = {
        sceneNumber: sceneNum,
        slugline: trimmed, // Keep original for display
        intExt: parsedHeading.intExt,
        location: parsedHeading.location,
        timeOfDay: normalizedTime,
        characters: [],
        content: '',
      };
      currentSceneContent = trimmed + '\n';
      lastLineWasCharacter = false;
      continue;
    }

    // Add to current scene content
    if (currentScene) {
      currentSceneContent += line + '\n';
    }

    // Check for character cue
    if (isCharacterCue(trimmed)) {
      const charName = trimmed;
      const normalized = normalizeCharacterName(charName);

      if (normalized.length >= 2) {
        // Add to scene's characters
        if (currentScene && !currentScene.characters.includes(normalized)) {
          currentScene.characters.push(normalized);
        }

        // Add to character map
        if (!characterMap.has(normalized)) {
          characterMap.set(normalized, {
            name: normalized,
            normalizedName: normalized,
            sceneCount: 0,
            dialogueCount: 0,
            scenes: [],
            variants: [],
          });
        }

        const char = characterMap.get(normalized)!;

        // Track variant names
        if (!char.variants.includes(charName)) {
          char.variants.push(charName);
        }

        // Track scenes
        if (currentScene && !char.scenes.includes(currentScene.sceneNumber)) {
          char.scenes.push(currentScene.sceneNumber);
          char.sceneCount++;
        }

        lastLineWasCharacter = true;
        dialogueCount = 0;
      }
    } else if (lastLineWasCharacter && trimmed.length > 0) {
      // This is dialogue following a character cue
      dialogueCount++;
      if (dialogueCount <= 3) {
        // Count dialogue for the character
        // We already tracked them, just confirming they have dialogue
      }
      if (dialogueCount > 3 || trimmed.length === 0) {
        lastLineWasCharacter = false;
      }
    } else {
      lastLineWasCharacter = false;

      // Also check for characters mentioned in action/description lines
      // This catches characters who are physically present but not speaking
      if (currentScene && trimmed.length > 10) {
        const actionCharacters = extractCharactersFromActionLine(trimmed);
        for (const charName of actionCharacters) {
          const normalized = normalizeCharacterName(charName);

          if (normalized.length >= 2) {
            // Add to scene's characters
            if (!currentScene.characters.includes(normalized)) {
              currentScene.characters.push(normalized);
            }

            // Add to character map (mark as non-speaking/action appearance)
            if (!characterMap.has(normalized)) {
              characterMap.set(normalized, {
                name: normalized,
                normalizedName: normalized,
                sceneCount: 0,
                dialogueCount: 0,
                scenes: [],
                variants: [],
              });
            }

            const char = characterMap.get(normalized)!;

            // Track scenes
            if (!char.scenes.includes(currentScene.sceneNumber)) {
              char.scenes.push(currentScene.sceneNumber);
              char.sceneCount++;
            }
          }
        }
      }
    }
  }

  // Save last scene
  if (currentScene) {
    currentScene.content = currentSceneContent.trim();
    scenes.push(currentScene);
  }

  // Convert character map to array and update dialogue counts
  const characters = Array.from(characterMap.values())
    .filter(c => c.sceneCount >= 1) // Only include characters that appear in scenes
    .sort((a, b) => b.sceneCount - a.sceneCount); // Sort by appearance count

  // Update dialogue counts based on variants
  characters.forEach(char => {
    char.dialogueCount = char.variants.length;
  });

  // Try to extract title from the beginning of the script
  const titleMatch = text.slice(0, 1000).match(/^(?:title[:\s]*)?([A-Z][A-Z\s\d\-\'\"]+)(?:\n|by)/im);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Script';

  return {
    title,
    scenes,
    characters,
    rawText: text,
  };
}

/**
 * Parse a script file (PDF, FDX, or plain text/fountain)
 * @param file - The script file to parse
 * @param options - Parsing options
 * @param options.useAI - Whether to use AI for parsing (recommended for better accuracy)
 * @param options.onProgress - Progress callback for status updates
 */
export async function parseScriptFile(
  file: File,
  options: {
    useAI?: boolean;
    onProgress?: (status: string) => void;
  } = {}
): Promise<ParsedScript> {
  const { useAI = true, onProgress } = options;
  const fileName = file.name.toLowerCase();
  let text: string;

  onProgress?.('Reading document...');

  if (fileName.endsWith('.pdf')) {
    text = await extractTextFromPDF(file);
  } else if (fileName.endsWith('.fdx')) {
    const xmlContent = await file.text();
    text = extractTextFromFDX(xmlContent);
  } else {
    // Assume plain text or fountain format
    text = await file.text();
  }

  // Try AI parsing first if enabled
  if (useAI) {
    onProgress?.('Checking AI availability...');
    const aiAvailable = await checkAIAvailability();

    if (aiAvailable) {
      try {
        onProgress?.('Analyzing script with AI...');
        return await parseScriptWithAIFallback(text, onProgress);
      } catch (error) {
        console.warn('AI parsing failed, falling back to regex parsing:', error);
        onProgress?.('AI unavailable, using standard parsing...');
      }
    } else {
      onProgress?.('AI service unavailable, using standard parsing...');
    }
  }

  onProgress?.('Parsing script format...');
  return parseScriptText(text);
}

/**
 * Extract scene content from raw script text using slugline matching
 * Handles various script formats including scene numbers before/after INT/EXT
 */
function extractSceneContent(slugline: string, text: string): string {
  // Normalize dashes in both slugline and text for matching
  // Convert en-dash and em-dash to regular hyphen for comparison
  const normalizedSlugline = slugline.replace(/[–—]/g, '-');
  const normalizedText = text.replace(/[–—]/g, '-');

  // Extract the key parts from the slugline
  const intExtMatch = normalizedSlugline.match(/^(INT|EXT)\.?\/?(?:INT|EXT)?\.?\s*/i);
  const intExt = intExtMatch ? intExtMatch[1].toUpperCase() : 'INT';

  // Get the location and time part (everything after INT./EXT.)
  const locationPart = normalizedSlugline.replace(/^(?:INT|EXT)\.?\/?(?:INT|EXT)?\.?\s*/i, '').trim();

  // Escape special regex characters in location part
  const escapedLocation = locationPart
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+')
    .replace(/-/g, '[-–—]'); // Match any dash type

  // Strategy 1: Try exact slugline match (with flexible whitespace)
  const escapedSlugline = normalizedSlugline
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+')
    .replace(/-/g, '[-–—]');
  const exactPattern = new RegExp(escapedSlugline, 'im');
  let match = normalizedText.match(exactPattern);

  if (match && match.index !== undefined) {
    return extractContentFromPosition(text, match.index);
  }

  // Strategy 2: Match with optional scene numbers before INT/EXT
  // Pattern handles: "4 INT. LOCATION", "4A INT. LOCATION", "INT. LOCATION"
  const sceneNumPattern = new RegExp(
    `(?:\\d+[A-Z]?\\s+)?(?:${intExt}|INT|EXT)[\\.\\s/]*(?:INT|EXT)?[\\./]?\\s*${escapedLocation}`,
    'im'
  );
  match = normalizedText.match(sceneNumPattern);

  if (match && match.index !== undefined) {
    return extractContentFromPosition(text, match.index);
  }

  // Strategy 3: Just match INT/EXT followed by the location name (most flexible)
  // Extract just the location name without time of day for fuzzy matching
  const locationOnly = locationPart.replace(/\s*[-–—]\s*(DAY|NIGHT|MORNING|EVENING|CONTINUOUS|CONT|LATER|SAME|DAWN|DUSK|SUNSET|SUNRISE).*$/i, '').trim();
  if (locationOnly.length > 3) {
    const escapedLocationOnly = locationOnly
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+');
    const locationOnlyPattern = new RegExp(
      `(?:\\d+[A-Z]?\\s+)?(?:INT|EXT)[\\./\\s]*(?:INT|EXT)?[\\./]?\\s*${escapedLocationOnly}`,
      'im'
    );
    match = normalizedText.match(locationOnlyPattern);

    if (match && match.index !== undefined) {
      return extractContentFromPosition(text, match.index);
    }
  }

  // Strategy 4: Search for any line starting with the INT/EXT and containing keywords from location
  // Split location into words and search for a line containing most of them
  const locationWords = locationOnly.split(/\s+/).filter(w => w.length > 2);
  if (locationWords.length > 0) {
    const lines = normalizedText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Check if line looks like a scene heading with INT/EXT
      if (/^(?:\d+[A-Z]?\s+)?(?:INT|EXT)/i.test(line)) {
        // Count how many location words are in this line
        const matchingWords = locationWords.filter(word =>
          line.toUpperCase().includes(word.toUpperCase())
        );
        // If at least half the words match, this is likely our scene
        if (matchingWords.length >= Math.ceil(locationWords.length / 2)) {
          // Find the position of this line in the original text
          const lineIndex = text.indexOf(lines[i]);
          if (lineIndex !== -1) {
            return extractContentFromPosition(text, lineIndex);
          }
        }
      }
    }
  }

  return '';
}

/**
 * Extract content from a position until the next scene heading
 * Handles various scene heading formats with or without periods
 */
function extractContentFromPosition(text: string, startIndex: number): string {
  // Find the next scene heading pattern
  // More flexible pattern: handles INT., INT, INT/, EXT., EXT, EXT/, etc.
  // Also handles scene numbers before INT/EXT like "4 INT." or "12A EXT."
  const nextScenePattern = /\n\s*(?:\d+[A-Z]?\s+)?(?:INT|EXT)[\s./]/gi;
  nextScenePattern.lastIndex = startIndex + 1;

  // Skip past the current scene heading line to avoid matching it
  const firstNewline = text.indexOf('\n', startIndex);
  if (firstNewline !== -1) {
    nextScenePattern.lastIndex = firstNewline + 1;
  }

  const nextMatch = nextScenePattern.exec(text);

  const endIndex = nextMatch ? nextMatch.index : text.length;
  return text.slice(startIndex, endIndex).trim();
}

/**
 * Parse script using AI with fallback to regex parsing
 */
async function parseScriptWithAIFallback(
  text: string,
  onProgress?: (status: string) => void
): Promise<ParsedScript> {
  const aiResult = await parseScriptWithAI(text, onProgress);

  // Convert AI results to ParsedScript format
  // Extract actual scene content from the raw text using the sluglines
  const scenes: ParsedScene[] = aiResult.scenes.map(s => {
    // Extract content from the original text using the slugline
    const content = extractSceneContent(s.slugline, text);
    return {
      sceneNumber: s.sceneNumber,
      slugline: s.slugline,
      intExt: s.intExt,
      location: s.location,
      timeOfDay: normalizeTimeOfDay(s.timeOfDay),
      characters: s.characters,
      content: content,
      synopsis: s.synopsis,
    };
  });

  const characters: ParsedCharacter[] = aiResult.characters.map(c => ({
    name: c.name,
    normalizedName: c.normalizedName,
    sceneCount: c.sceneCount,
    dialogueCount: c.dialogueCount,
    scenes: c.scenes,
    variants: c.variants,
    description: c.description,
  }));

  // Extract title
  const titleMatch = text.slice(0, 1000).match(/^(?:title[:\s]*)?([A-Z][A-Z\s\d\-\'\"]+)(?:\n|by)/im);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Script';

  return {
    title,
    scenes,
    characters,
    rawText: text,
  };
}

/**
 * Normalize time of day string to standard format
 */
function normalizeTimeOfDay(tod: string): 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS' {
  const upper = (tod || 'DAY').toUpperCase();
  if (upper.includes('NIGHT')) return 'NIGHT';
  if (upper.includes('MORNING') || upper.includes('DAWN')) return 'MORNING';
  if (upper.includes('EVENING') || upper.includes('DUSK') || upper.includes('SUNSET')) return 'EVENING';
  if (upper.includes('CONTINUOUS') || upper.includes('CONT')) return 'CONTINUOUS';
  return 'DAY';
}

/**
 * Convert parsed script to project scenes and characters
 */
export function convertParsedScriptToProject(
  parsed: ParsedScript,
  selectedCharacters: string[] // Characters the user selected to track
): { scenes: Scene[]; characters: Character[] } {
  // Create character ID mapping
  const charIdMap = new Map<string, string>();
  const characters: Character[] = selectedCharacters.map((name, index) => {
    const id = uuidv4();
    charIdMap.set(name, id);

    // Generate initials
    const initials = name
      .split(' ')
      .map(w => w[0])
      .join('')
      .slice(0, 2);

    // Generate color
    const colors = ['#C9A961', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#6366F1'];
    const avatarColour = colors[index % colors.length];

    return {
      id,
      name,
      initials,
      avatarColour,
    };
  });

  // Convert scenes
  const scenes: Scene[] = parsed.scenes.map((ps) => {
    // Map character names to IDs for this scene
    const sceneCharIds = ps.characters
      .filter(charName => charIdMap.has(charName))
      .map(charName => charIdMap.get(charName)!);

    return {
      id: uuidv4(),
      sceneNumber: ps.sceneNumber,
      slugline: `${ps.intExt}. ${ps.location} - ${ps.timeOfDay}`,
      intExt: ps.intExt,
      timeOfDay: ps.timeOfDay,
      synopsis: ps.synopsis,
      scriptContent: ps.content,
      characters: sceneCharIds,
      isComplete: false,
    };
  });

  return { scenes, characters };
}

/**
 * Suggest character merges based on name similarity
 */
export function suggestCharacterMerges(characters: ParsedCharacter[]): Array<{
  primary: string;
  similar: string[];
}> {
  const suggestions: Array<{ primary: string; similar: string[] }> = [];
  const processed = new Set<string>();

  for (const char of characters) {
    if (processed.has(char.name)) continue;

    const similar: string[] = [];

    for (const other of characters) {
      if (other.name === char.name) continue;
      if (processed.has(other.name)) continue;

      // Check if names are similar
      const name1 = char.name.toLowerCase();
      const name2 = other.name.toLowerCase();

      // Check if one contains the other
      if (name1.includes(name2) || name2.includes(name1)) {
        similar.push(other.name);
      }
      // Check if first names match
      else if (name1.split(' ')[0] === name2.split(' ')[0] && name1.split(' ')[0].length > 2) {
        similar.push(other.name);
      }
    }

    if (similar.length > 0) {
      suggestions.push({
        primary: char.name,
        similar,
      });
      similar.forEach(s => processed.add(s));
    }

    processed.add(char.name);
  }

  return suggestions;
}

/**
 * Fast scene parsing - extracts ONLY scene structure without character detection
 * This is designed to complete in under 30 seconds for any script size
 * Uses regex only (no AI) for maximum speed
 */
export async function parseScenesFast(file: File): Promise<FastParsedScript> {
  const fileName = file.name.toLowerCase();
  let text: string;

  // Extract text based on file type
  if (fileName.endsWith('.pdf')) {
    text = await extractTextFromPDF(file);
  } else if (fileName.endsWith('.fdx')) {
    const xmlContent = await file.text();
    text = extractTextFromFDX(xmlContent);
  } else {
    text = await file.text();
  }

  // Parse scenes using regex only (fast path)
  const lines = text.split('\n');
  const scenes: FastParsedScene[] = [];

  let currentScene: FastParsedScene | null = null;
  let fallbackSceneNumber = 0;
  let currentSceneContent = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for scene heading using the existing robust parser
    const parsedHeading = parseSceneHeadingLine(trimmed);

    if (parsedHeading.isValid) {
      // Save previous scene
      if (currentScene) {
        currentScene.scriptContent = currentSceneContent.trim();
        scenes.push(currentScene);
      }

      // Use scene number from script, or fall back to sequential
      fallbackSceneNumber++;
      const sceneNum = parsedHeading.sceneNumber || String(fallbackSceneNumber);

      // Normalize time of day to our expected types
      const normalizedTime = normalizeTimeOfDayForScene(parsedHeading.timeOfDay);

      currentScene = {
        sceneNumber: sceneNum,
        slugline: trimmed,
        intExt: parsedHeading.intExt,
        location: parsedHeading.location,
        timeOfDay: normalizedTime,
        scriptContent: '',
      };
      currentSceneContent = trimmed + '\n';
      continue;
    }

    // Add to current scene content
    if (currentScene) {
      currentSceneContent += line + '\n';
    }
  }

  // Save last scene
  if (currentScene) {
    currentScene.scriptContent = currentSceneContent.trim();
    scenes.push(currentScene);
  }

  // Try to extract title from the beginning of the script
  const titleMatch = text.slice(0, 1000).match(/^(?:title[:\s]*)?([A-Z][A-Z\s\d\-\'\"]+)(?:\n|by)/im);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Script';

  return {
    title,
    scenes,
    rawText: text,
  };
}

/**
 * Detect characters for a single scene or batch of scenes
 * Can use AI for better accuracy or fall back to regex
 * @param sceneContent - The script content for the scene
 * @param rawText - The full raw script text (for context)
 * @param options - Optional settings including known characters from schedule
 * @returns Array of character names detected in this scene
 */
export async function detectCharactersForScene(
  sceneContent: string,
  _rawText: string,
  options?: { useAI?: boolean; knownCharacters?: string[] }
): Promise<string[]> {
  const useAI = options?.useAI ?? false;
  const knownCharacters = options?.knownCharacters ?? [];
  const characters: string[] = [];
  const characterSet = new Set<string>();

  // First, search for known characters from schedule (if provided)
  // This is the most reliable method when a schedule is uploaded
  if (knownCharacters.length > 0) {
    const contentUpper = sceneContent.toUpperCase();
    for (const charName of knownCharacters) {
      const normalized = normalizeCharacterName(charName);
      if (normalized.length < 2) continue;

      // Check if character name appears in the scene (as character cue or in action)
      // Use word boundary matching to avoid partial matches
      const namePattern = new RegExp(`\\b${escapeRegExp(normalized)}\\b`, 'i');
      if (namePattern.test(contentUpper) && !characterSet.has(normalized)) {
        characterSet.add(normalized);
        characters.push(normalized);
      }
    }
  }

  // Always try regex detection for character cues (fast, reliable for dialogue)
  const lines = sceneContent.split('\n');
  let lastLineWasCharacter = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for character cue
    if (isCharacterCue(trimmed)) {
      const normalized = normalizeCharacterName(trimmed);

      if (normalized.length >= 2 && !characterSet.has(normalized)) {
        characterSet.add(normalized);
        characters.push(normalized);
      }
      lastLineWasCharacter = true;
    } else if (lastLineWasCharacter && trimmed.length > 0) {
      // This is dialogue following a character cue
      // Keep lastLineWasCharacter true for multi-line dialogue
    } else {
      lastLineWasCharacter = false;

      // Also check for characters mentioned in action/description lines
      // Only do this if we don't have known characters (to avoid noise)
      if (trimmed.length > 10 && knownCharacters.length === 0) {
        const actionCharacters = extractCharactersFromActionLine(trimmed);
        for (const charName of actionCharacters) {
          const normalized = normalizeCharacterName(charName);
          if (normalized.length >= 2 && !characterSet.has(normalized)) {
            characterSet.add(normalized);
            characters.push(normalized);
          }
        }
      }
    }
  }

  // If AI is requested and available, use it to enhance detection
  if (useAI) {
    try {
      const aiAvailable = await checkAIAvailability();
      if (aiAvailable) {
        const aiCharacters = await detectCharactersWithAI(sceneContent);
        // Merge AI results with regex results, avoiding duplicates
        for (const char of aiCharacters) {
          const normalized = normalizeCharacterName(char);
          if (normalized.length >= 2 && !characterSet.has(normalized)) {
            characterSet.add(normalized);
            characters.push(normalized);
          }
        }
      }
    } catch (error) {
      console.warn('AI character detection failed, using regex results only:', error);
    }
  }

  return characters;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect characters in a scene using AI
 * This is called by detectCharactersForScene when AI is enabled
 */
async function detectCharactersWithAI(sceneContent: string): Promise<string[]> {
  // Import the AI service dynamically to avoid circular dependencies
  const { callAI } = await import('@/services/aiService');

  const prompt = `You are a screenplay analyzer. Identify ALL characters who appear in this scene.

Rules:
1. Include characters who speak (have dialogue)
2. Include characters who are physically present but don't speak
3. Include characters referenced by role (e.g., "TAXI DRIVER", "YOUNG WOMAN")
4. Exclude location names, objects, and directions
5. Return ONLY character names, one per line
6. Use the name as it appears in the script (e.g., "JOHN", "MARY SMITH", "COP #1")

Scene content:
${sceneContent}

Return only character names, one per line:`;

  try {
    const response = await callAI(prompt);
    if (!response) return [];

    // Parse the response - expect one character name per line
    const lines = response.split('\n');
    const characters: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines and lines that look like explanations
      if (!trimmed || trimmed.length > 30 || trimmed.includes(':')) continue;
      // Remove common prefixes like "- " or "* " or numbers
      const cleaned = trimmed.replace(/^[-*\d.)\s]+/, '').trim();
      if (cleaned.length >= 2 && cleaned.length <= 25) {
        characters.push(cleaned.toUpperCase());
      }
    }

    return characters;
  } catch (error) {
    console.warn('AI character detection failed:', error);
    return [];
  }
}

/**
 * Batch detect characters for multiple scenes
 * More efficient than calling detectCharactersForScene individually
 * @param scenes - Array of scenes with their content
 * @param rawText - Full raw script text
 * @param options - Optional settings including known characters from schedule
 */
export async function detectCharactersForScenesBatch(
  scenes: Array<{ sceneNumber: string; scriptContent: string }>,
  rawText: string,
  options?: {
    useAI?: boolean;
    knownCharacters?: string[];
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();
  const total = scenes.length;
  let completed = 0;

  // Process scenes in parallel batches of 5 for better performance
  const batchSize = 5;

  for (let i = 0; i < scenes.length; i += batchSize) {
    const batch = scenes.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (scene) => {
        const characters = await detectCharactersForScene(
          scene.scriptContent,
          rawText,
          { useAI: options?.useAI, knownCharacters: options?.knownCharacters }
        );
        return { sceneNumber: scene.sceneNumber, characters };
      })
    );

    for (const result of batchResults) {
      results.set(result.sceneNumber, result.characters);
      completed++;
      options?.onProgress?.(completed, total);
    }
  }

  return results;
}
