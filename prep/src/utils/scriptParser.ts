import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
}

export interface ParsedCharacter {
  name: string;
  normalizedName: string;
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

function normalizeScriptText(text: string): string {
  return text
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

  const personDescriptors = /\b(MAN|WOMAN|MEN|WOMEN|PERSON|PEOPLE|DRIVER|OFFICER|DOCTOR|DR|NURSE|GUARD|SOLDIER|WORKER|GIRL|BOY|LADY|LADIES|GUY|GUYS|KID|KIDS|CHILD|CHILDREN|TEEN|TEENAGER|CLERK|WAITER|WAITRESS|COP|COPS|DETECTIVE|AGENT|STRANGER|FIGURE|BABY|INFANT|TODDLER|MOTHER|FATHER|BROTHER|SISTER|HUSBAND|WIFE|SON|DAUGHTER|UNCLE|AUNT|NEPHEW|NIECE|COUSIN|PRIEST|JUDGE|LAWYER|TEACHER|STUDENT|BARTENDER|BODYGUARD|MAID|BUTLER|PATIENT|VICTIM|SUSPECT|WITNESS|PASSENGER|CAPTAIN|LIEUTENANT|SERGEANT|COLONEL|GENERAL|COMMANDER|CHIEF|KING|QUEEN|PRINCE|PRINCESS|SURGEON|PROFESSOR|RECEPTIONIST|SECRETARY|ASSISTANT|MANAGER|BOSS|OWNER|HOST|HOSTESS|THUG|THIEF|GANGSTER|HITMAN|ASSASSIN|LEADER|ELDER|HOMELESS|ORPHAN|VETERAN|INMATE|PRISONER|JANITOR|SHERIFF|DEPUTY|PARAMEDIC|FIREFIGHTER|MARINE|SAILOR|RANGER|SPY|SNIPER|MEDIC|ATTENDANT|SINGER|DANCER|ACTOR|ACTRESS|MUSICIAN|ARTIST|WRITER|JOURNALIST|REPORTER|PHOTOGRAPHER)\b/i;

  const allCapsPattern = /\b([A-Z][A-Z.'-]+(?:\s+[A-Z][A-Z.'-]+){1,3})\b/g;
  let match;

  while ((match = allCapsPattern.exec(trimmed)) !== null) {
    const potential = match[1].trim();
    if (/^(INT|EXT)\s*[.\/]/.test(potential)) continue;
    if (!personDescriptors.test(potential)) continue;
    characters.push(potential);
  }

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

  let cleanLine = trimmed.replace(/\s*\*+\s*$/, '').trim();

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
    location = workingLine.replace(/[\s\-–—\.,]+$/, '').trim();
  }

  if (!location || location.length < 2) return invalidResult;

  return { sceneNumber, intExt, location, timeOfDay, rawSlugline: trimmed, isValid: true };
}

/* ━━━ Main parser ━━━ */

export function parseScriptText(text: string): ParsedScript {
  const lines = text.split('\n');
  const scenes: ParsedScene[] = [];
  const characterMap = new Map<string, ParsedCharacter>();

  let currentScene: ParsedScene | null = null;
  let fallbackSceneNumber = 0;
  let currentSceneContent = '';
  let lastLineWasCharacter = false;
  let dialogueCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const parsedHeading = parseSceneHeadingLine(trimmed);

    if (parsedHeading.isValid) {
      if (currentScene) {
        currentScene.content = currentSceneContent.trim();
        scenes.push(currentScene);
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
      };
      currentSceneContent = trimmed + '\n';
      lastLineWasCharacter = false;
      continue;
    }

    if (currentScene) {
      currentSceneContent += line + '\n';
    }

    if (isCharacterCue(trimmed)) {
      const charName = trimmed;
      const normalized = normalizeCharacterName(charName);

      if (normalized.length >= 2) {
        if (currentScene && !currentScene.characters.includes(normalized)) {
          currentScene.characters.push(normalized);
        }

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

        if (!char.variants.includes(charName)) {
          char.variants.push(charName);
        }

        if (currentScene && !char.scenes.includes(currentScene.sceneNumber)) {
          char.scenes.push(currentScene.sceneNumber);
          char.sceneCount++;
        }

        lastLineWasCharacter = true;
        dialogueCount = 0;
      }
    } else if (lastLineWasCharacter && trimmed.length > 0) {
      dialogueCount++;
      if (dialogueCount > 3 || trimmed.length === 0) {
        lastLineWasCharacter = false;
      }
    } else {
      lastLineWasCharacter = false;

      if (currentScene && trimmed.length > 10) {
        const actionCharacters = extractCharactersFromActionLine(trimmed);
        for (const charName of actionCharacters) {
          const normalized = normalizeCharacterName(charName);

          if (normalized.length >= 2) {
            if (!currentScene.characters.includes(normalized)) {
              currentScene.characters.push(normalized);
            }

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
            if (!char.scenes.includes(currentScene.sceneNumber)) {
              char.scenes.push(currentScene.sceneNumber);
              char.sceneCount++;
            }
          }
        }
      }
    }
  }

  if (currentScene) {
    currentScene.content = currentSceneContent.trim();
    scenes.push(currentScene);
  }

  const characters = Array.from(characterMap.values())
    .filter(c => c.sceneCount >= 1)
    .sort((a, b) => b.sceneCount - a.sceneCount);

  characters.forEach(char => {
    char.dialogueCount = char.variants.length;
  });

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
  } else if (fileName.endsWith('.fdx')) {
    const xmlContent = await file.text();
    text = extractTextFromFDX(xmlContent);
  } else {
    text = await file.text();
  }

  onProgress?.('Parsing script format...');
  return parseScriptText(text);
}
