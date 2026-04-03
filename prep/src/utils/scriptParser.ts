import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker — use the local bundled worker (v5 uses .mjs)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/* ━━━ Types ━━━ */

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
  titleCardBefore?: string | null; // ALL-CAPS title card found before this scene's slug
}

export type CharacterCategory = 'principal' | 'supporting_artist';

export interface ParsedCharacter {
  name: string;
  normalizedName: string;
  category: CharacterCategory;
  sceneCount: number;
  dialogueCount: number;
  scenes: string[]; // Scene numbers where character appears
  variants: string[]; // Name variations found
}

/* ━━━ PDF text extraction ━━━ */

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const lines: Map<number, Array<{ x: number; text: string; width: number }>> = new Map();

    for (const item of textContent.items as TextItem[]) {
      if (!item.str || item.str.trim() === '') continue;

      const y = Math.round(item.transform[5] / 2) * 2;
      const x = item.transform[4];

      if (!lines.has(y)) {
        lines.set(y, []);
      }
      lines.get(y)!.push({ x, text: item.str, width: item.width || 0 });
    }

    const sortedYPositions = Array.from(lines.keys()).sort((a, b) => b - a);

    for (const y of sortedYPositions) {
      const lineItems = lines.get(y)!;
      lineItems.sort((a, b) => a.x - b.x);

      let lineText = '';
      let lastX = 0;
      let lastWidth = 0;

      for (const item of lineItems) {
        const gap = item.x - (lastX + lastWidth);

        if (lastX > 0 && gap > 3) {
          if (gap > 20) {
            lineText += '    ';
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

    fullText += '\n';
  }

  return normalizeScriptText(fullText);
}

/* ━━━ Text normalization ━━━ */

/** Written-out number words → digits for scene heading normalization */
const WORD_TO_NUMBER: Record<string, string> = {
  'ONE': '1', 'TWO': '2', 'THREE': '3', 'FOUR': '4', 'FIVE': '5',
  'SIX': '6', 'SEVEN': '7', 'EIGHT': '8', 'NINE': '9', 'TEN': '10',
  'ELEVEN': '11', 'TWELVE': '12', 'THIRTEEN': '13', 'FOURTEEN': '14',
  'FIFTEEN': '15', 'SIXTEEN': '16', 'SEVENTEEN': '17', 'EIGHTEEN': '18',
  'NINETEEN': '19', 'TWENTY': '20', 'TWENTY-ONE': '21', 'TWENTY-TWO': '22',
  'TWENTY-THREE': '23', 'TWENTY-FOUR': '24', 'TWENTY-FIVE': '25',
  'TWENTY-SIX': '26', 'TWENTY-SEVEN': '27', 'TWENTY-EIGHT': '28',
  'TWENTY-NINE': '29', 'THIRTY': '30', 'THIRTY-ONE': '31', 'THIRTY-TWO': '32',
  'THIRTY-THREE': '33', 'THIRTY-FOUR': '34', 'THIRTY-FIVE': '35',
  'THIRTY-SIX': '36', 'THIRTY-SEVEN': '37', 'THIRTY-EIGHT': '38',
  'THIRTY-NINE': '39', 'FORTY': '40', 'FORTY-ONE': '41', 'FORTY-TWO': '42',
  'FORTY-THREE': '43', 'FORTY-FOUR': '44', 'FORTY-FIVE': '45',
  'FORTY-SIX': '46', 'FORTY-SEVEN': '47', 'FORTY-EIGHT': '48',
  'FORTY-NINE': '49', 'FIFTY': '50',
};

const SCENE_WORD_KEYS = Object.keys(WORD_TO_NUMBER).sort((a, b) => b.length - a.length).join('|');
const SCENE_WORD_PREFIX_RE = new RegExp(
  `^\\s*(?:\\d+[A-Z]{0,4}\\s+)?SCENE\\s+(${SCENE_WORD_KEYS})\\s*[:\\-–—]?\\s*`, 'i',
);

/**
 * Normalize "SCENE WORD:" prefixes to numeric scene numbers.
 * e.g. "SCENE TWO: EXT. FARM LAND - DAY" → "2 EXT. FARM LAND - DAY"
 * e.g. "4 SCENE THREE: EXT. STREET - DAY 4" → "3 EXT. STREET - DAY 4"
 * A leading scene number before "SCENE" is discarded in favour of the word number.
 */
function normalizeSceneWordPrefix(line: string): string {
  const match = line.match(SCENE_WORD_PREFIX_RE);
  if (match) {
    const num = WORD_TO_NUMBER[match[1].toUpperCase()];
    if (num) return num + ' ' + line.slice(match[0].length);
  }
  // Also handle "SCENE 2:" or "4 SCENE 2:" with numeric digit
  const numMatch = line.match(/^\s*(?:\d+[A-Z]{0,4}\s+)?SCENE\s+(\d+[A-Z]?)\s*[:\-–—]?\s*/i);
  if (numMatch) {
    return numMatch[1] + ' ' + line.slice(numMatch[0].length);
  }
  return line;
}

function normalizeScriptText(text: string): string {
  let normalized = text
    // Normalize Unicode whitespace (non-breaking spaces, etc.) from PDF extraction
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
    .replace(/\b(INT|EXT)\s*\n\s*\./g, '$1.')
    .replace(/\b(INT|EXT)\s*\n\s*\/\s*(INT|EXT)/g, '$1/$2')
    .replace(/CONTIN\s*\n\s*UED?/gi, 'CONTINUOUS')
    .replace(/CONT['']?D/gi, "CONT'D")
    .replace(/\(\s*V\s*\.\s*O\s*\.\s*\)/gi, '(V.O.)')
    .replace(/\(\s*O\s*\.\s*S\s*\.\s*\)/gi, '(O.S.)')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/(\d+[A-Z]?)\s+\./g, '$1.')
    .trim();

  // Join character introductions split across line breaks (PDF word-wrap artifact).
  // When a line has content ending with an ALL CAPS word and the next line starts
  // with ALL CAPS word(s) followed by comma + age or comma + lowercase description,
  // join them into a single line.
  // e.g. "...on foot. JASPER\nMONTGOMERY, 70, he looks..." → single line
  // e.g. "...on foot. JASPER\nMONTGOMERY 70, he looks..." → single line (space before age)
  normalized = normalized.replace(
    /([^\n]+\s[A-Z][A-Z'-]{2,})\s*\n\s*([A-Z][A-Z'-]{2,}(?:\s+[A-Z][A-Z'-]+){0,2}\s*(?:[,(]\s*(?:\d{1,3}\b|[a-z])|\d{1,3}\s*,))/g,
    '$1 $2',
  );

  // Normalize "SCENE WORD:" prefixes to numeric scene numbers BEFORE splitting
  // so that "4 SCENE THREE: EXT. STREET - DAY" becomes "3 EXT. STREET - DAY"
  normalized = normalized.split('\n').map(l => normalizeSceneWordPrefix(l)).join('\n');

  // Split lines where a scene heading (INT./EXT. + LOCATION – TIME) is followed
  // by additional action text on the same line. PDF extraction sometimes merges
  // the heading and the first action line when they're vertically close.
  // e.g. "1 EXT. FARM LAND – DAY LENNON BOWIE, 28, IS A COWBOY..."
  //    → "1 EXT. FARM LAND – DAY\nLENNON BOWIE, 28, IS A COWBOY..."
  normalized = normalized.split('\n').map(line => {
    // Case 1: heading at START of line, followed by action text after the TOD
    if (/^(\d+[A-Z]?\s+)?(INT\.?|EXT\.?|INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?)\s/i.test(line)) {
      const timeSplitRe = /(\s+[-–—]\s*(?:DAY|NIGHT|MORNING|EVENING|AFTERNOON|DAWN|DUSK|SUNSET|SUNRISE|CONTINUOUS|CONT|LATER|SAME)\b)([\s].+)/i;
      const m = line.match(timeSplitRe);
      if (m && m.index != null) {
        const headingEnd = m.index + m[1].length;
        const overflow = line.slice(headingEnd);
        const trimmedOverflow = overflow.trim();
        if (trimmedOverflow.length > 3 &&
            !/^\(?(?:FLASHBACK|PRESENT|CONT'?D?|STOCK|ESTABLISHING)\)?$/i.test(trimmedOverflow) &&
            !/^\d+[A-Z]?\s*$/.test(trimmedOverflow)) {
          return line.slice(0, headingEnd) + '\n' + trimmedOverflow;
        }
      }
      return line;
    }

    // Case 2: action text from previous scene merged with a heading in the MIDDLE.
    // PDF extraction can merge adjacent lines when y-coordinates are close.
    // e.g. "He walks away. 6 EXT. GARDEN TERRACE - DAY 6"
    //    → "He walks away.\n6 EXT. GARDEN TERRACE - DAY 6"
    const midHeadingRe = /(.+?)\s+(\d+[A-Z]?\s+(?:INT\.?|EXT\.?|INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?)\s.+[-–—]\s*(?:DAY|NIGHT|MORNING|EVENING|AFTERNOON|DAWN|DUSK|SUNSET|SUNRISE|CONTINUOUS|CONT|LATER|SAME)\b.*)/i;
    const mid = line.match(midHeadingRe);
    if (mid) {
      return mid[1] + '\n' + mid[2];
    }

    return line;
  }).join('\n');

  return normalized;
}

/* ━━━ FDX extraction ━━━ */

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

/* ━━━ Time of day normalization ━━━ */

function normalizeTimeOfDay(timeStr: string): 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS' {
  const upper = (timeStr || 'DAY').toUpperCase();
  if (upper === 'NIGHT' || upper === 'NIGHTMARE') return 'NIGHT';
  if (upper === 'MORNING' || upper === 'DAWN' || upper === 'SUNRISE') return 'MORNING';
  if (upper === 'EVENING' || upper === 'DUSK' || upper === 'SUNSET' ||
      upper === 'MAGIC HOUR' || upper === 'GOLDEN HOUR') return 'EVENING';
  if (upper === 'CONTINUOUS' || upper === 'CONT' || upper === 'LATER' ||
      upper === 'SAME' || upper === 'SAME TIME' || upper === 'MOMENTS LATER' ||
      upper === 'SIMULTANEOUS') return 'CONTINUOUS';
  return 'DAY';
}

/* ━━━ Common word exclusions for name-mention scanning ━━━ */

/**
 * Words that should never be matched as character name fragments.
 * Prevents pronouns, articles, common verbs, and script terms from
 * causing false positives when scanning for first/last name mentions.
 * e.g. A character named "Will Grace" should not match every "will" or "grace" in the script.
 */
const NAME_SCAN_EXCLUSIONS = new Set([
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
function isSupportingArtistRole(normalizedName: string): boolean {
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

function normalizeCharacterName(name: string): string {
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

function extractCharactersFromActionLine(line: string): string[] {
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

function isCharacterCue(line: string): boolean {
  const trimmed = line.trim();

  if (trimmed !== trimmed.toUpperCase()) return false;
  if (trimmed.length > 50) return false;

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
    /^(EPISODE|CHAPTER|PART|ACT|SCENE|PILOT)\s*\d*\s*$/i,
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

/* ━━━ Scene heading parsing ━━━ */

interface ParsedSceneHeading {
  sceneNumber: string | null;
  intExt: 'INT' | 'EXT';
  location: string;
  timeOfDay: string;
  rawSlugline: string;
  isValid: boolean;
}

function parseSceneHeadingLine(line: string): ParsedSceneHeading {
  const trimmed = line.trim();

  const invalidResult: ParsedSceneHeading = {
    sceneNumber: null, intExt: 'INT', location: '', timeOfDay: 'DAY',
    rawSlugline: trimmed, isValid: false,
  };

  if (!trimmed || trimmed.length < 5) return invalidResult;

  // Normalize "SCENE WORD:" prefix (safety net if text wasn't pre-normalized)
  let cleanLine = normalizeSceneWordPrefix(trimmed).replace(/\s*\*+\s*$/, '').trim();

  const sceneNumPattern = /^(\d+[A-Z]{0,4})\s+/i;
  const trailingSceneNumPattern = /\s+(\d+[A-Z]{0,4})\s*$/i;

  let sceneNumber: string | null = null;
  let workingLine = cleanLine;

  const leadingMatch = workingLine.match(sceneNumPattern);
  if (leadingMatch) {
    sceneNumber = leadingMatch[1].toUpperCase();
    workingLine = workingLine.slice(leadingMatch[0].length).trim();
  }

  const trailingMatch = workingLine.match(trailingSceneNumPattern);
  if (trailingMatch) {
    const trailingNum = trailingMatch[1].toUpperCase();
    if (!sceneNumber) sceneNumber = trailingNum;
    workingLine = workingLine.slice(0, -trailingMatch[0].length).trim();
  }

  const intExtPattern = /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|INT\.?|EXT\.?)\s*/i;
  const intExtMatch = workingLine.match(intExtPattern);

  if (!intExtMatch) return invalidResult;

  const intExtRaw = intExtMatch[1].toUpperCase().replace(/\.$/, '');
  const intExt: 'INT' | 'EXT' = intExtRaw.startsWith('EXT') ? 'EXT' : 'INT';

  workingLine = workingLine.slice(intExtMatch[0].length).trim();
  workingLine = workingLine.replace(/^[\.\-–—]\s*/, '').trim();

  const timeSeparatorPattern = /(?:\s*[-–—\.]+\s*|\s+)(DAY|NIGHT|MORNING|EVENING|AFTERNOON|DAWN|DUSK|SUNSET|SUNRISE|CONTINUOUS|CONT|LATER|SAME|SAME TIME|MOMENTS LATER|SIMULTANEOUS|MAGIC HOUR|GOLDEN HOUR|FLASHBACK|PRESENT|DREAM|FANTASY|NIGHTMARE|ESTABLISHING)(?:\s*[-–—]?\s*(?:FLASHBACK|PRESENT|CONT(?:'D)?)?)?$/i;

  let timeOfDay = 'DAY';
  let location = workingLine;

  const timeMatch = workingLine.match(timeSeparatorPattern);
  if (timeMatch) {
    timeOfDay = timeMatch[1].toUpperCase();
    if (timeOfDay === 'CONT') timeOfDay = 'CONTINUOUS';
    location = workingLine.slice(0, timeMatch.index).trim();
    location = location.replace(/[\s\-–—\.,]+$/, '').trim();
  }

  if (!timeMatch && workingLine.length > 0) {
    // Scene headings should always end after the time-of-day marker (DAY/NIGHT/etc).
    // If no time marker was found at the end, this line likely has action text
    // merged after the heading (PDF extraction artifact).
    // Only accept as a valid heading if the remaining text is short and looks
    // like a bare location (e.g. "INT. OFFICE") — reject anything with
    // character intro patterns (comma + digits) or excessive length.
    if (workingLine.length > 50 || /,\s*\d/.test(workingLine) || /[a-z]/.test(workingLine)) {
      return invalidResult;
    }
    location = workingLine.replace(/[\s\-–—\.,]+$/, '').trim();
  }

  if (!location || location.length < 2) return invalidResult;

  return { sceneNumber, intExt, location, timeOfDay, rawSlugline: trimmed, isValid: true };
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
function prescanCharacterIntros(lines: string[]): Map<string, string> {
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

/**
 * Check if a line is a temporal prefix marker that should be attached to the
 * FOLLOWING scene rather than the preceding scene. These appear on the line
 * immediately before an INT./EXT. heading.
 *
 * Matches: FLASHBACK, FLASH FORWARD, BACK TO PRESENT, END FLASHBACK,
 * and time-jump patterns like "6 MONTHS LATER", "TWO WEEKS AGO", etc.
 */
function isTemporalPrefixMarker(line: string): boolean {
  if (!line || line.length < 4) return false;
  const t = line.toUpperCase();
  // Don't match scene headings themselves
  if (/^(\d+[A-Z]?\s+)?(INT\.|EXT\.|INT\/EXT|I\/E)/i.test(line)) return false;
  return /\bFLASHBACK\b/.test(t)
      || /\bFLASH\s+FORWARD\b/.test(t)
      || /\bBACK\s+TO\s+PRESENT\b/.test(t)
      || /\bRETURN\s+TO\s+PRESENT\b/.test(t)
      || /\bEND\s+FLASHBACK\b/.test(t)
      || /\b(\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|TWENTY|THIRTY|SEVERAL|FEW|MANY|SOME|A\s+FEW)\s+(DAYS?|WEEKS?|MONTHS?|YEARS?)\s+(LATER|AGO|EARLIER)\b/.test(t);
}

/**
 * Scan interstitial text (between two sluglines) for a title card line.
 * Title cards are standalone ALL-CAPS lines like "6 MONTHS LATER",
 * "FRIDAY, DECEMBER 3, 1926", "FLASHBACK - 1985", etc.
 */
function extractTitleCardFromInterstitial(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (
      /^[A-Z0-9][A-Z\s,.:'\-!0-9]+$/.test(line) &&
      line.length > 4 &&
      line.length < 80 &&
      /\b(FLASHBACK|LATER|AGO|EARLIER|MORNING|YEARS?|MONTHS?|WEEKS?|DAYS?|CHRISTMAS|VALENTINE|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\b/.test(line) &&
      !/^(INT|EXT|EPISODE)\b/.test(line)
    ) {
      return line;
    }
  }
  return null;
}

/* ━━━ Main parser ━━━ */

export function parseScriptText(text: string): ParsedScript {
  const lines = text.split('\n');
  const scenes: ParsedScene[] = [];
  const characterMap = new Map<string, ParsedCharacter>();

  // Pre-scan: find full character names from introductions
  const nameResolveMap = prescanCharacterIntros(lines);

  /** Resolve a single-word character name to its full name if known */
  function resolveCharacterName(normalized: string): string {
    if (!normalized.includes(' ') && nameResolveMap.has(normalized)) {
      return nameResolveMap.get(normalized)!;
    }
    return normalized;
  }

  /** Register a character in the characterMap and current scene */
  function registerCharacter(rawName: string, resolved: string, scene: ParsedScene | null) {
    if (resolved.length < 2) return;

    if (scene && !scene.characters.includes(resolved)) {
      scene.characters.push(resolved);
    }

    if (!characterMap.has(resolved)) {
      characterMap.set(resolved, {
        name: resolved,
        normalizedName: resolved,
        category: 'principal',
        sceneCount: 0,
        dialogueCount: 0,
        scenes: [],
        variants: [],
      });
    }

    const char = characterMap.get(resolved)!;
    if (!char.variants.includes(rawName)) {
      char.variants.push(rawName);
    }
    if (scene && !char.scenes.includes(scene.sceneNumber)) {
      char.scenes.push(scene.sceneNumber);
      char.sceneCount++;
    }
  }

  let currentScene: ParsedScene | null = null;
  let fallbackSceneNumber = 0;
  let currentSceneContent = '';
  let preambleContent = ''; // Text before the first scene heading
  let lastLineWasCharacter = false;
  let dialogueCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const parsedHeading = parseSceneHeadingLine(trimmed);

    if (parsedHeading.isValid) {
      // If there's preamble text before the first scene, create a preamble scene
      if (!currentScene && preambleContent.trim()) {
        scenes.push({
          sceneNumber: '0',
          slugline: 'PREAMBLE',
          intExt: 'EXT',
          location: 'PREAMBLE',
          timeOfDay: 'DAY',
          characters: [],
          content: preambleContent.trim(),
        });
      }

      // Check the line immediately preceding this heading for a temporal marker.
      // Temporal markers (e.g. "FLASHBACK: 2 WEEKS AGO", "6 MONTHS LATER")
      // appear on the line directly before an INT./EXT. heading and describe
      // the FOLLOWING scene, not the preceding one.
      let titleCardBefore: string | null = null;
      if (currentScene) {
        const contentLines = currentSceneContent.split('\n');
        // Find last non-empty line in accumulated content
        let lastNonEmptyIdx = contentLines.length - 1;
        while (lastNonEmptyIdx >= 0 && !contentLines[lastNonEmptyIdx].trim()) {
          lastNonEmptyIdx--;
        }
        if (lastNonEmptyIdx >= 0) {
          const lastLine = contentLines[lastNonEmptyIdx].trim();
          if (isTemporalPrefixMarker(lastLine)) {
            titleCardBefore = lastLine;
            // Remove the marker from the previous scene's content
            contentLines.splice(lastNonEmptyIdx, 1);
            currentSceneContent = contentLines.join('\n');
          }
        }
        // Fall back to broader interstitial scan if no prefix marker found
        if (!titleCardBefore) {
          titleCardBefore = extractTitleCardFromInterstitial(currentSceneContent);
        }
        currentScene.content = currentSceneContent.trim();
        scenes.push(currentScene);
      } else if (preambleContent.trim()) {
        // Also check preamble for title cards before the first scene
        titleCardBefore = extractTitleCardFromInterstitial(preambleContent);
      }

      fallbackSceneNumber++;
      const sceneNum = parsedHeading.sceneNumber || String(fallbackSceneNumber);
      const normalizedTime = normalizeTimeOfDay(parsedHeading.timeOfDay);

      currentScene = {
        sceneNumber: sceneNum,
        slugline: trimmed,
        intExt: parsedHeading.intExt,
        location: parsedHeading.location,
        timeOfDay: normalizedTime,
        characters: [],
        content: '',
        titleCardBefore,
      };
      currentSceneContent = trimmed + '\n';
      lastLineWasCharacter = false;
      continue;
    }

    if (currentScene) {
      currentSceneContent += line + '\n';
    } else {
      // Accumulate text before the first scene heading
      preambleContent += line + '\n';
    }

    // Before treating a line as a dialogue cue, check if it's actually the
    // first half of a character introduction split across two lines by PDF
    // word-wrap.  e.g. "JASPER\nMONTGOMERY, 70, he looks like..."
    // Without this check, "JASPER" is consumed as a dialogue cue and the
    // next line ("MONTGOMERY, 70, ...") is treated as dialogue — so the
    // character introduction is completely missed.
    let isSplitCharacterIntro = false;
    if (
      isCharacterCue(trimmed) &&
      /^[A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+){0,2}$/.test(trimmed) &&
      i + 1 < lines.length
    ) {
      const nextTrimmed = lines[i + 1].trim();
      // Next line starts with ALL CAPS word(s) followed by age/comma → split intro
      if (/^[A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+){0,2}\s*(?:[,(]\s*\d{1,3}\b|\d{1,3}\s*[,)])/.test(nextTrimmed)) {
        isSplitCharacterIntro = true;
      }
    }

    if (!isSplitCharacterIntro && isCharacterCue(trimmed)) {
      const charName = trimmed;
      let normalized = normalizeCharacterName(charName);
      // Resolve single-name cues: "LENNON" → "LENNON BOWIE"
      normalized = resolveCharacterName(normalized);

      registerCharacter(charName, normalized, currentScene);
      lastLineWasCharacter = true;
      dialogueCount = 0;
    } else if (!isSplitCharacterIntro && lastLineWasCharacter && trimmed.length > 0) {
      dialogueCount++;
      if (dialogueCount > 3 || trimmed.length === 0) {
        lastLineWasCharacter = false;
      }
    } else {
      lastLineWasCharacter = false;

      if (currentScene && trimmed.length > 3) {
        // Try extracting characters from this line alone (only if long enough for patterns)
        let actionCharacters = trimmed.length > 10
          ? extractCharactersFromActionLine(trimmed)
          : [];

        // Cross-line detection: if this line ends with ALL CAPS word(s) (potential
        // split character name), combine with the next line and re-extract.
        // This catches "...on foot. JASPER\nMONTGOMERY, 70, ..." even when the
        // normalizeScriptText join regex didn't merge the lines.
        // Also handles short lines like just "JASPER" on its own line.
        if (/[A-Z][A-Z'-]{2,}\s*$/.test(trimmed) && i + 1 < lines.length) {
          const nextTrimmed = lines[i + 1].trim();
          if (nextTrimmed && nextTrimmed.length > 2) {
            const combinedCharacters = extractCharactersFromActionLine(trimmed + ' ' + nextTrimmed);
            // Merge: keep any names from the combined line that weren't in the single line
            for (const name of combinedCharacters) {
              if (!actionCharacters.includes(name)) {
                actionCharacters.push(name);
              }
            }
          }
        }

        for (const charName of actionCharacters) {
          let normalized = normalizeCharacterName(charName);
          // Resolve single-name action references: "Lennon" → "LENNON BOWIE"
          normalized = resolveCharacterName(normalized);
          registerCharacter(charName, normalized, currentScene);
        }
      }
    }
  }

  if (currentScene) {
    currentScene.content = currentSceneContent.trim();
    scenes.push(currentScene);
  }

  /* ── Post-processing safety net: scan each scene's raw content for character ──
     introductions that the line-by-line parser may have missed.
     Standard screenplay character introduction: ALL CAPS FULL NAME, age,
     e.g. "JASPER MONTGOMERY, 70, he looks like a grandpa"
     This catches intros that were:
     - Merged with scene headings (PDF extraction artifact)
     - Split across lines and not recombined
     - On lines incorrectly consumed as dialogue cues
     After finding names, also scan the ENTIRE raw text so that a character
     introduced in one scene is known globally for first-name resolution. */
  const introSafetyRe = /\b([A-Z][A-Z'-]+(?:\s+[A-Z][A-Z'-]+){1,3})(?:\s*[,(]\s*|\s+)\d{1,3}\b/g;
  const introExcludeFirstWord = new Set([
    'INT', 'EXT', 'CUT', 'FADE', 'SCENE', 'THE', 'AND', 'BUT', 'FOR', 'NOR',
    'YET', 'DAY', 'NIGHT', 'MORNING', 'EVENING', 'AFTERNOON',
    'DAWN', 'DUSK', 'CONTINUOUS', 'LATER', 'SAME', 'ANGLE', 'CLOSE',
    'WIDE', 'SHOT', 'FADE', 'TITLE', 'SUPER', 'CHAPTER', 'EPISODE',
  ]);

  // Helper: scan text for character intros, handling greedy match backtracking.
  // When a match like "DAY JASPER MONTGOMERY, 70" is excluded (first word "DAY"),
  // retry from after the excluded word so "JASPER MONTGOMERY, 70" can still match.
  function scanForIntroductions(source: string, re: RegExp): string[] {
    const results: string[] = [];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(source)) !== null) {
      const name = m[1].trim();
      const words = name.split(/\s+/);
      const firstWord = words[0];
      if (name.length >= 5 && !introExcludeFirstWord.has(firstWord) && !isSupportingArtistRole(name)) {
        results.push(name);
      } else if (words.length > 1 && introExcludeFirstWord.has(firstWord)) {
        // Greedy match consumed a good name after an excluded word — retry
        // from just after the excluded word so the shorter match can succeed
        re.lastIndex = m.index + firstWord.length + 1;
      }
    }
    return results;
  }

  // First pass: collect all full names from the entire raw text
  const safetyFullNames = scanForIntroductions(text, introSafetyRe);

  // Build a first-name → full-name map from safety-net names
  // (supplements the prescan resolveMap for first-name mentions later)
  const safetyResolve = new Map<string, string>();
  for (const fullName of safetyFullNames) {
    const parts = fullName.split(/\s+/);
    for (const part of parts) {
      if (part.length < 3 || NAME_SCAN_EXCLUSIONS.has(part)) continue;
      if (!safetyResolve.has(part)) {
        safetyResolve.set(part, fullName);
      } else if (safetyResolve.get(part) !== fullName) {
        safetyResolve.set(part, ''); // ambiguous
      }
    }
  }
  for (const [k, v] of safetyResolve) {
    if (v === '') safetyResolve.delete(k);
  }

  // Second pass: for each scene, find character intros in scene.content
  for (const scene of scenes) {
    const sceneNames = scanForIntroductions(scene.content, introSafetyRe);
    for (const name of sceneNames) {
      const normalized = normalizeCharacterName(name);
      registerCharacter(name, normalized, scene);
    }
  }

  // Also resolve first-name-only mentions using the safety-net map.
  // If a character was registered as just "JASPER" but the safety net found
  // "JASPER MONTGOMERY", merge them.
  for (const [fragment, fullName] of safetyResolve) {
    if (characterMap.has(fragment) && !characterMap.has(fullName)) {
      // The full name wasn't registered yet but a fragment was — register the full name
      // and transfer the fragment's scenes
      const fragChar = characterMap.get(fragment)!;
      for (const sceneNum of fragChar.scenes) {
        const scene = scenes.find(s => s.sceneNumber === sceneNum);
        if (scene) registerCharacter(fragment, fullName, scene);
      }
    }
  }

  /* ── Deduplication safety net: merge any remaining single-name fragments ──
     If the pre-scan missed an intro but a full name was detected during parsing,
     merge fragments that match exactly one full-name parent. */
  const fullNames = Array.from(characterMap.keys()).filter(k => k.includes(' '));
  const singleNames = Array.from(characterMap.keys()).filter(k => !k.includes(' ') && k.length >= 3);
  const fragmentsToRemove = new Set<string>();

  for (const fragment of singleNames) {
    const parents = fullNames.filter(fn => fn.split(/\s+/).includes(fragment));
    if (parents.length === 1) {
      const parentName = parents[0];
      const fragChar = characterMap.get(fragment)!;
      const parentChar = characterMap.get(parentName)!;

      for (const sceneNum of fragChar.scenes) {
        if (!parentChar.scenes.includes(sceneNum)) {
          parentChar.scenes.push(sceneNum);
          parentChar.sceneCount++;
        }
      }
      for (const v of fragChar.variants) {
        if (!parentChar.variants.includes(v)) parentChar.variants.push(v);
      }
      for (const scene of scenes) {
        const idx = scene.characters.indexOf(fragment);
        if (idx !== -1) {
          scene.characters.splice(idx, 1);
          if (!scene.characters.includes(parentName)) {
            scene.characters.push(parentName);
          }
        }
      }
      fragmentsToRemove.add(fragment);
    }
  }

  for (const key of fragmentsToRemove) {
    characterMap.delete(key);
  }

  // Deduplicate scene character lists
  for (const scene of scenes) {
    scene.characters = [...new Set(scene.characters)];
  }

  /* ── Location-based false positive removal ──
     Reject any "character" whose name matches a location extracted from a scene
     heading. This catches false positives like "FARM LAND", "STREET CORNER",
     "OFFICE BUILDING" that get picked up by the catch-all intro patterns.
     Only applies to multi-word names — single-word names like "LENNON" are
     never locations (locations are always multi-segment in scene headings). */
  const sceneLocations = new Set<string>();
  for (const scene of scenes) {
    const loc = scene.location.toUpperCase().trim();
    if (loc && loc !== 'PREAMBLE') {
      sceneLocations.add(loc);
      // Also add individual segments for compound locations:
      // "FARMHOUSE - KITCHEN" → "FARMHOUSE", "KITCHEN", "FARMHOUSE - KITCHEN"
      for (const segment of loc.split(/\s*[-–—\/]\s*/)) {
        const seg = segment.trim();
        if (seg.length >= 3) sceneLocations.add(seg);
      }
    }
  }

  const locationFalsePositives = new Set<string>();
  for (const [name] of characterMap) {
    // Only check multi-word names (single words like "LENNON" are never locations)
    if (!name.includes(' ')) continue;
    if (sceneLocations.has(name)) {
      locationFalsePositives.add(name);
    }
  }

  for (const name of locationFalsePositives) {
    characterMap.delete(name);
    for (const scene of scenes) {
      const idx = scene.characters.indexOf(name);
      if (idx !== -1) scene.characters.splice(idx, 1);
    }
  }

  const characters = Array.from(characterMap.values())
    .filter(c => c.sceneCount >= 1)
    .sort((a, b) => b.sceneCount - a.sceneCount);

  characters.forEach(char => {
    char.dialogueCount = char.variants.length;
  });

  /* NOTE: We intentionally do NOT do a broad "name-mention scan" of scene content.
     Characters are only associated with a scene if they have a dialogue cue or
     are detected in an action line (intro pattern or Title Case + action verb).
     A character merely *mentioned* in dialogue ("Told Dedra to pack her bags")
     is NOT physically present in the scene — for hair & makeup departments,
     only physically present characters matter. The pre-scan + main parse +
     dedup safety net above handle detection accurately. */

  const titleMatch = text.slice(0, 1000).match(/^(?:title[:\s]*)?([A-Z][A-Z\s\d\-\'\"]+)(?:\n|by)/im);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Script';

  return { title, scenes, characters, rawText: text };
}

/* ━━━ Public API: parse a script file ━━━ */

export async function parseScriptFile(
  file: File,
  onProgress?: (status: string) => void,
): Promise<ParsedScript> {
  const fileName = file.name.toLowerCase();
  let text: string;

  onProgress?.('Reading document...');

  if (fileName.endsWith('.pdf')) {
    text = await extractTextFromPDF(file);
    // PDF path already normalizes via extractTextFromPDF → normalizeScriptText
  } else if (fileName.endsWith('.fdx')) {
    const xmlContent = await file.text();
    text = normalizeScriptText(extractTextFromFDX(xmlContent));
  } else {
    text = normalizeScriptText(await file.text());
  }

  onProgress?.('Parsing script format...');
  return parseScriptText(text);
}
