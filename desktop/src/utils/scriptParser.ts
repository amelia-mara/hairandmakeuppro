import type { Scene } from '@/types';
import type { DetectedCharacter } from '@/types';

const TIME_OF_DAY_PATTERNS = [
  'MOMENTS LATER', 'SECONDS LATER', 'CONTINUOUS', "CONT'D",
  'MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'DAWN', 'DUSK',
  'LATER', 'SAME', 'DAY',
];

const SCENE_HEADING_REGEX = new RegExp(
  `^\\s*(\\d+[A-Z]?)?\\s*(INT\\.?|EXT\\.?|INT\\.?\\/EXT\\.?|I\\/E\\.?)\\s+(.+?)\\s*[-–—.]?\\s*(${TIME_OF_DAY_PATTERNS.join('|')})\\.?\\s*\\d*[A-Z]?\\s*\\*?\\s*$`,
  'i'
);

const SCENE_HEADING_FALLBACK = /^(?:\d+[A-Z]?\s+)?(?:INT\.?|EXT\.?|INT\.?\/EXT\.?|I\/E\.?)\s+.+$/i;

const CHARACTER_NAME_REGEX = /^([A-Z][A-Z\s\-'.]+?)(?:\s*\([^)]+\))?\s*$/;

const CHARACTER_BLACKLIST = new Set([
  'INT', 'EXT', 'FADE', 'CUT', 'DISSOLVE', 'CONTINUED', 'THE END',
  'TITLE', 'SUPER', 'INSERT', 'BACK TO', 'FLASHBACK', 'END FLASHBACK',
  'LATER', 'CONTINUOUS', 'SAME', 'MORNING', 'AFTERNOON', 'EVENING',
  'NIGHT', 'DAY', 'DAWN', 'DUSK', 'MOMENTS', 'THE NEXT', 'MORE',
  'ANGLE ON', 'CLOSE ON', 'WIDE ON', 'POV', 'INTERCUT', 'PRELAP',
  'BEGIN', 'END', 'RESUME', 'OMITTED', 'REVISED', 'FINAL DRAFT',
  'CUT TO', 'FADE IN', 'FADE OUT', 'FADE TO', 'DISSOLVE TO',
  'SMASH CUT', 'MATCH CUT', 'JUMP CUT', 'TIME CUT',
  'MONTAGE', 'SERIES OF SHOTS', 'END MONTAGE', 'DREAM SEQUENCE',
  'HE', 'SHE', 'IT', 'WE', 'ME', 'US', 'HIM', 'HER', 'HIS', 'ITS',
  'THEY', 'THEM', 'THEIR', 'WHO', 'WHOM', 'WHOSE', 'WHAT', 'WHICH',
  'THAT', 'THIS', 'THESE', 'THOSE', 'BUT', 'FOR', 'NOT', 'ALL',
  'WITH', 'FROM', 'INTO', 'UPON', 'THAN', 'YET', 'NOR',
  'SILENCE', 'DARKNESS', 'NOTHING', 'EVERYTHING', 'SOMETHING',
  'ROAD', 'STREET', 'HOUSE', 'ROOM', 'OFFICE', 'BUILDING',
  'HALL', 'HALLWAY', 'CORRIDOR', 'LOBBY', 'KITCHEN', 'BATHROOM',
  'BEDROOM', 'HOSPITAL', 'SCHOOL', 'PRISON', 'GARAGE', 'GARDEN',
  'PARK', 'FIELD', 'PHONE', 'GUN', 'KNIFE', 'CAR', 'TRUCK',
  'DOOR', 'WINDOW', 'TABLE', 'CHAIR', 'BED',
  'RED', 'BLUE', 'GREEN', 'YELLOW', 'BLACK', 'WHITE', 'GOLDEN',
  'BEAUTIFUL', 'GORGEOUS', 'STUNNING', 'SLOWLY', 'QUICKLY', 'QUIETLY',
]);

const SUFFIX_REJECT_REGEX =
  /^[A-Z]+(ING|ED|LY|TION|SION|NESS|MENT|ABLE|IBLE|ICAL|IOUS|EOUS|ULAR|TERN|ERN|WARD|WARDS|LIKE|LESS|FUL|IC|AL|ARY|ORY|IVE|OUS|ANT|ENT)$/;

function normalizeScriptText(text: string): string {
  let normalized = text;
  // Fix split INT/EXT headings across lines
  normalized = normalized.replace(/\b(INT|EXT)\s*\n\s*\./g, '$1.');
  normalized = normalized.replace(/\b(INT|EXT)\s*\n\s*\/\s*(INT|EXT)/g, '$1/$2');
  // Fix split CONTINUED
  normalized = normalized.replace(/CONTIN\s*\n\s*UED?/gi, 'CONTINUED');
  // Normalize V.O. and O.S.
  normalized = normalized.replace(/\(\s*V\s*\.\s*O\s*\.\s*\)/gi, '(V.O.)');
  normalized = normalized.replace(/\(\s*O\s*\.\s*S\s*\.\s*\)/gi, '(O.S.)');
  // Collapse multiple newlines
  normalized = normalized.replace(/\n{4,}/g, '\n\n\n');
  return normalized;
}

function parseIntExt(heading: string): 'INT' | 'EXT' | 'INT/EXT' {
  const upper = heading.toUpperCase();
  if (upper.includes('INT/EXT') || upper.includes('I/E')) return 'INT/EXT';
  if (upper.includes('INT')) return 'INT';
  return 'EXT';
}

function parseLocation(heading: string): string {
  // Remove INT/EXT prefix
  let loc = heading.replace(/^\s*\d*[A-Z]?\s*/, '');
  loc = loc.replace(/^(?:INT\.?|EXT\.?|INT\.?\/EXT\.?|I\/E\.?)\s*/i, '');
  // Remove time of day suffix
  for (const tod of TIME_OF_DAY_PATTERNS) {
    const idx = loc.toUpperCase().lastIndexOf(tod);
    if (idx > 0) {
      loc = loc.substring(0, idx);
      break;
    }
  }
  // Clean up separators
  loc = loc.replace(/[\s\-–—.,]+$/, '').trim();
  return loc || heading;
}

function parseTimeOfDay(heading: string): string {
  const upper = heading.toUpperCase();
  for (const tod of TIME_OF_DAY_PATTERNS) {
    if (upper.includes(tod)) return tod;
  }
  return 'DAY';
}

export function detectScenes(text: string): Scene[] {
  const normalized = normalizeScriptText(text);
  const lines = normalized.split('\n');
  const scenes: Scene[] = [];
  let currentScene: { startLine: number; heading: string } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const isSceneHeading =
      SCENE_HEADING_REGEX.test(line) || SCENE_HEADING_FALLBACK.test(line);

    if (isSceneHeading) {
      if (currentScene) {
        const content = lines.slice(currentScene.startLine + 1, i).join('\n').trim();
        const sceneNum = scenes.length + 1;
        scenes.push({
          id: `scene-${sceneNum}`,
          number: sceneNum,
          heading: currentScene.heading,
          content,
          intExt: parseIntExt(currentScene.heading),
          location: parseLocation(currentScene.heading),
          timeOfDay: parseTimeOfDay(currentScene.heading),
          characterIds: [],
        });
      }
      currentScene = { startLine: i, heading: line };
    }
  }

  // Last scene
  if (currentScene) {
    const content = lines.slice(currentScene.startLine + 1).join('\n').trim();
    const sceneNum = scenes.length + 1;
    scenes.push({
      id: `scene-${sceneNum}`,
      number: sceneNum,
      heading: currentScene.heading,
      content,
      intExt: parseIntExt(currentScene.heading),
      location: parseLocation(currentScene.heading),
      timeOfDay: parseTimeOfDay(currentScene.heading),
      characterIds: [],
    });
  }

  return scenes;
}

function isValidCharacterName(name: string): boolean {
  if (name.length < 2 || name.length > 35) return false;
  if (CHARACTER_BLACKLIST.has(name.toUpperCase())) return false;
  if (name.length >= 6 && SUFFIX_REJECT_REGEX.test(name.toUpperCase())) return false;
  if (/^\d/.test(name)) return false;
  if (/\.$/.test(name)) return false;
  if (/^(A |AN |THE |HE |SHE |THEY |WE |IT )/.test(name.toUpperCase())) return false;
  if (/^(IN THE |AT THE |ON THE |FROM THE )/.test(name.toUpperCase())) return false;
  if (/ (ENTERS|EXITS|WALKS|RUNS|STANDS|SITS|LOOKS|TURNS|MOVES)$/.test(name.toUpperCase())) return false;
  if (/^[A-Z]+ [A-Z]+ [A-Z]+ [A-Z]+ [A-Z]+/.test(name)) return false;
  return true;
}

export function detectCharacters(scenes: Scene[]): DetectedCharacter[] {
  const characterMap = new Map<string, { sceneNumbers: Set<number> }>();

  for (const scene of scenes) {
    const lines = scene.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(CHARACTER_NAME_REGEX);
      if (match) {
        let name = match[1].trim();
        // Remove V.O., O.S., CONT'D
        name = name.replace(/\s*\(.*?\)\s*/g, '').trim();
        if (!isValidCharacterName(name)) continue;

        const existing = characterMap.get(name);
        if (existing) {
          existing.sceneNumbers.add(scene.number);
        } else {
          characterMap.set(name, { sceneNumbers: new Set([scene.number]) });
        }
      }
    }
  }

  const characters: DetectedCharacter[] = [];
  for (const [name, data] of characterMap) {
    const sceneNumbers = Array.from(data.sceneNumbers).sort((a, b) => a - b);
    const sceneCount = sceneNumbers.length;

    let roleType: DetectedCharacter['roleType'] = 'extra';
    if (sceneCount >= 10) roleType = 'lead';
    else if (sceneCount >= 5) roleType = 'supporting';
    else if (sceneCount >= 2) roleType = 'day_player';

    characters.push({
      name,
      sceneCount,
      sceneNumbers,
      roleType,
      selected: roleType !== 'extra',
    });
  }

  characters.sort((a, b) => b.sceneCount - a.sceneCount);
  return characters;
}

export function assignCharactersToScenes(
  scenes: Scene[],
  characters: { id: string; name: string }[]
): Scene[] {
  return scenes.map((scene) => {
    const charIds: string[] = [];
    const contentUpper = scene.content.toUpperCase();

    for (const char of characters) {
      if (contentUpper.includes(char.name.toUpperCase())) {
        charIds.push(char.id);
      }
    }

    return { ...scene, characterIds: charIds };
  });
}
