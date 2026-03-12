/**
 * script-upload.js
 * Script PDF upload and parsing module
 *
 * Ported from Checks Happy mobile app (mobile-pwa/src/utils/scriptParser.ts)
 * Handles:
 * - PDF file upload popup (shown on first visit when no script loaded)
 * - PDF text extraction using pdf.js
 * - Fast scene parsing (regex-based, no AI)
 * - Per-scene character detection (character cues + action line mentions)
 * - Scene character confirmation in the breakdown panel
 */

import { state, selectScene } from './main.js';
import { renderSceneList } from './scene-list.js';
import { renderScript } from './script-display.js';
import { renderCharacterTabs, renderCharacterTabPanels } from './character-panel.js';
import { showTopLoadingBar, updateTopLoadingBar, closeTopLoadingBar, showToast, saveProject } from './export-handlers.js';

// ============================================================================
// PDF.JS SETUP
// ============================================================================

let pdfjsLib = null;

/**
 * Load pdf.js library dynamically
 */
async function loadPdfJs() {
    if (pdfjsLib) return pdfjsLib;

    // Load pdf.js from CDN
    return new Promise((resolve, reject) => {
        if (window.pdfjsLib) {
            pdfjsLib = window.pdfjsLib;
            resolve(pdfjsLib);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            pdfjsLib = window.pdfjsLib;
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(pdfjsLib);
        };
        script.onerror = () => reject(new Error('Failed to load PDF.js'));
        document.head.appendChild(script);
    });
}

// ============================================================================
// PDF TEXT EXTRACTION (from mobile-pwa/src/utils/scriptParser.ts)
// ============================================================================

/**
 * Extract text content from a PDF file with improved line structure preservation
 * Groups text items by Y position to reconstruct lines properly
 */
async function extractTextFromPDF(file) {
    const lib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Group text items by Y position (line-by-line reconstruction)
        const lines = new Map();

        for (const item of textContent.items) {
            if (!item.str || item.str.trim() === '') continue;

            // Round Y position to group items on the same line (allow 2px tolerance)
            const y = Math.round(item.transform[5] / 2) * 2;
            const x = item.transform[4];

            if (!lines.has(y)) {
                lines.set(y, []);
            }
            lines.get(y).push({ x, text: item.str, width: item.width || 0 });
        }

        // Sort lines by Y position (top to bottom, so descending Y)
        const sortedYPositions = Array.from(lines.keys()).sort((a, b) => b - a);

        for (const y of sortedYPositions) {
            const lineItems = lines.get(y);
            // Sort items within line by X position (left to right)
            lineItems.sort((a, b) => a.x - b.x);

            // Reconstruct line with proper spacing
            let lineText = '';
            let lastX = 0;
            let lastWidth = 0;

            for (const item of lineItems) {
                const gap = item.x - (lastX + lastWidth);

                if (lastX > 0 && gap > 3) {
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

    return normalizeScriptText(fullText);
}

/**
 * Map of written-out number words to digits for scene heading normalization.
 * Handles formats like "SCENE TWO: EXT. FARM LAND - DAY" → "2 EXT. FARM LAND - DAY"
 */
const WORD_TO_NUMBER = {
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

// Build regex pattern from word-to-number keys (longest first to match "TWENTY-ONE" before "TWENTY")
const SCENE_WORD_KEYS = Object.keys(WORD_TO_NUMBER).sort((a, b) => b.length - a.length).join('|');
const SCENE_WORD_PREFIX_REGEX = new RegExp(
    `^\\s*SCENE\\s+(${SCENE_WORD_KEYS})\\s*[:\\-–—]?\\s*`,
    'i'
);

/**
 * Normalize "SCENE WORD:" prefixes to numeric scene numbers.
 * e.g. "SCENE TWO: EXT. FARM LAND - DAY" → "2 EXT. FARM LAND - DAY"
 */
function normalizeSceneWordPrefix(line) {
    const match = line.match(SCENE_WORD_PREFIX_REGEX);
    if (match) {
        const word = match[1].toUpperCase();
        const num = WORD_TO_NUMBER[word];
        if (num) {
            return num + ' ' + line.slice(match[0].length);
        }
    }
    // Also handle "SCENE 2:" with a numeric digit
    const numMatch = line.match(/^\s*SCENE\s+(\d+[A-Z]?)\s*[:\-–—]?\s*/i);
    if (numMatch) {
        return numMatch[1] + ' ' + line.slice(numMatch[0].length);
    }
    return line;
}

/**
 * Normalize script text to fix common PDF extraction issues
 */
function normalizeScriptText(text) {
    let normalized = text
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

    // Normalize "SCENE WORD:" prefixes to numeric scene numbers
    normalized = normalized.split('\n').map(line => normalizeSceneWordPrefix(line)).join('\n');

    return normalized;
}

/**
 * Extract text from Final Draft XML (FDX) format
 */
function extractTextFromFDX(xmlContent) {
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

// ============================================================================
// SCENE HEADING PARSER (from mobile-pwa/src/utils/scriptParser.ts)
// ============================================================================

/**
 * Parse a scene heading line and extract all components
 */
function parseSceneHeadingLine(line) {
    const trimmed = line.trim();
    const invalidResult = {
        sceneNumber: null,
        intExt: 'INT',
        location: '',
        timeOfDay: 'DAY',
        rawSlugline: trimmed,
        isValid: false,
    };

    if (!trimmed || trimmed.length < 5) return invalidResult;

    // Normalize "SCENE WORD:" prefix before parsing (safety net if not pre-normalized)
    let cleanLine = normalizeSceneWordPrefix(trimmed).replace(/\s*\*+\s*$/, '').trim();

    const sceneNumPattern = /^(\d+[A-Z]{0,4})\s+/i;
    const trailingSceneNumPattern = /\s+(\d+[A-Z]{0,4})\s*$/i;

    let sceneNumber = null;
    let workingLine = cleanLine;

    const leadingMatch = workingLine.match(sceneNumPattern);
    if (leadingMatch) {
        sceneNumber = leadingMatch[1].toUpperCase();
        workingLine = workingLine.slice(leadingMatch[0].length).trim();
    }

    const trailingMatch = workingLine.match(trailingSceneNumPattern);
    if (trailingMatch) {
        const trailingNum = trailingMatch[1].toUpperCase();
        if (!sceneNumber) {
            sceneNumber = trailingNum;
        }
        workingLine = workingLine.slice(0, -trailingMatch[0].length).trim();
    }

    const intExtPattern = /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|INT\.?|EXT\.?)\s*/i;
    const intExtMatch = workingLine.match(intExtPattern);

    if (!intExtMatch) {
        return invalidResult;
    }

    const intExtRaw = intExtMatch[1].toUpperCase().replace(/\.$/, '');
    const intExt = intExtRaw.startsWith('EXT') ? 'EXT' : 'INT';

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

    if (!location || location.length < 2) {
        return invalidResult;
    }

    return {
        sceneNumber,
        intExt,
        location,
        timeOfDay,
        rawSlugline: trimmed,
        isValid: true,
    };
}

// ============================================================================
// CHARACTER DETECTION (from mobile-pwa/src/utils/scriptParser.ts)
// ============================================================================

/**
 * Check if a line is a character cue (character name before dialogue)
 */
function isCharacterCue(line) {
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

    // Comprehensive blacklist
    const nonCharacterWords = new Set([
        'HE', 'SHE', 'IT', 'WE', 'ME', 'US', 'HIM', 'HER', 'HIS', 'ITS',
        'THEY', 'THEM', 'THEIR', 'WHO', 'WHOM', 'WHOSE', 'WHAT', 'WHICH',
        'THAT', 'THIS', 'THESE', 'THOSE', 'MYSELF', 'HIMSELF', 'HERSELF',
        'BUT', 'FOR', 'NOT', 'ALL', 'WITH', 'FROM', 'INTO', 'UPON',
        'AS', 'AT', 'BY', 'IF', 'OF', 'ON', 'OR', 'TO', 'UP', 'SO',
        'DO', 'GO', 'AM', 'AN', 'BE', 'MY', 'OUR', 'YOUR', 'TOO',
        'HOW', 'WHY', 'OFF', 'OUT', 'BACK', 'DOWN', 'AWAY',
        'INT', 'EXT', 'ROAD', 'STREET', 'HOUSE', 'ROOM', 'OFFICE', 'BUILDING',
        'HALL', 'HALLWAY', 'CORRIDOR', 'LOBBY', 'KITCHEN', 'BATHROOM', 'BEDROOM',
        'DAY', 'NIGHT', 'MORNING', 'EVENING', 'DAWN', 'DUSK', 'LATER', 'CONTINUOUS',
        'SILENCE', 'DARKNESS', 'NOTHING', 'EVERYTHING', 'SOMETHING', 'ANYTHING',
        'NOBODY', 'EVERYBODY', 'SOMEONE', 'ANYONE', 'EVERYONE',
        'TIME', 'SPACE', 'PLACE', 'HOME', 'WORLD', 'DEATH', 'LIFE',
        'CONTINUED', 'FADE', 'CUT', 'DISSOLVE', 'ANGLE', 'SHOT', 'VIEW',
        'RESUME', 'BEGIN', 'END', 'STOP', 'START', 'PAUSE', 'BEAT',
        'PHONE', 'GUN', 'KNIFE', 'CAR', 'DOOR', 'WINDOW', 'TABLE',
        'TITLE', 'CREDIT', 'CREDITS', 'SUBTITLE', 'CAPTION', 'CARD',
        'DREAM', 'NIGHTMARE', 'MEMORY', 'VISION', 'FLASHBACK', 'FANTASY',
        'PRESENT', 'PAST', 'FUTURE', 'UNKNOWN', 'UNTITLED',
        'VERY', 'MUCH', 'MORE', 'MOST', 'JUST', 'ONLY', 'ALSO', 'EVEN', 'STILL',
        'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
        'FIRST', 'SECOND', 'THIRD', 'LAST', 'NEXT', 'ANOTHER',
        'OTHER', 'ANOTHER', 'EITHER', 'NEITHER', 'BOTH', 'NONE', 'EACH', 'EVERY',
        'HERE', 'THERE', 'WHERE', 'WHEN', 'THEN', 'NOW', 'SOON', 'AGO',
        'AGAIN', 'ONCE', 'OKAY', 'YEAH', 'SURE', 'RIGHT', 'WRONG', 'YES', 'NO',
        'LIKE', 'RED', 'BLUE', 'GREEN', 'YELLOW', 'BLACK', 'WHITE',
        'EPISODE', 'CHAPTER', 'SEASON', 'PART', 'ACT', 'PROLOGUE', 'EPILOGUE',
        'PILOT', 'FINALE', 'TEASER', 'COLD', 'OPEN', 'SERIES',
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
            'SMASH CUT', 'JUMP CUT', 'MATCH CUT', 'HARD CUT',
            'FADE IN', 'FADE OUT', 'FADE UP', 'BLACK OUT', 'WHITE OUT',
            'TITLE CARD', 'END CREDITS', 'OPENING CREDITS',
            'STOCK FOOTAGE', 'NEXT DAY', 'SAME DAY', 'THAT NIGHT',
            'DREAM SEQUENCE', 'TITLE SEQUENCE', 'ACTION SEQUENCE',
            'THE END', 'TO BE',
            'COLD OPEN', 'COLD OPENING',
        ]);

        // Also reject lines that start with episode/chapter numbering patterns
        if (/^(EPISODE|CHAPTER|SEASON|PART|ACT)\s*\d/i.test(nameWithoutParen)) return false;
        if (nonCharacterPhrases.has(nameWithoutParen)) return false;
    }

    return nameWithoutParen.length >= 2 && nameWithoutParen.length <= 35;
}

/**
 * Normalize character name - remove parentheticals, handle dual names
 */
function normalizeCharacterName(name) {
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

/**
 * Extract character names mentioned in action/description lines
 * Conservative: only multi-word ALL CAPS with person descriptors, or Title Case + action verb
 */
function extractCharactersFromActionLine(line) {
    const characters = [];
    const trimmed = line.trim();

    if (trimmed.length < 5) return characters;
    if (/^(INT\.|EXT\.|INT\/EXT|CUT TO|FADE|DISSOLVE|CONTINUED)/i.test(trimmed)) return characters;

    const personDescriptors = /\b(MAN|WOMAN|MEN|WOMEN|PERSON|PEOPLE|DRIVER|OFFICER|DOCTOR|DR|NURSE|GUARD|SOLDIER|WORKER|GIRL|BOY|LADY|GUY|KID|CHILD|TEEN|CLERK|WAITER|WAITRESS|COP|DETECTIVE|AGENT|STRANGER|FIGURE|BABY|MOTHER|FATHER|BROTHER|SISTER|HUSBAND|WIFE|SON|DAUGHTER|PRIEST|JUDGE|LAWYER|TEACHER|STUDENT|BARTENDER|BODYGUARD|MAID|BUTLER|PATIENT|CAPTAIN|SERGEANT|COLONEL|GENERAL|PROFESSOR|MANAGER|BOSS|THUG|GANGSTER|SHERIFF|DEPUTY|PARAMEDIC|REPORTER|PHOTOGRAPHER)\b/i;

    // Multi-word ALL CAPS phrases with person descriptors
    const allCapsPattern = /\b([A-Z][A-Z.'-]+(?:\s+[A-Z][A-Z.'-]+){1,3})\b/g;
    let match;

    while ((match = allCapsPattern.exec(trimmed)) !== null) {
        const potential = match[1].trim();
        if (/^(INT|EXT)\s*[.\/]/.test(potential)) continue;
        if (!personDescriptors.test(potential)) continue;
        characters.push(potential);
    }

    // Title Case names followed by action verbs
    const actionVerbs = 'enters|exits|walks|runs|stands|sits|looks|turns|moves|says|speaks|watches|stares|smiles|nods|shakes|reaches|grabs|holds|opens|closes|steps|crosses|approaches|leaves|arrives|appears|disappears|rises|falls|jumps|climbs|crawls|kneels|bends|leans|waves|points|gestures|signals|calls|shouts|whispers|laughs|cries|sighs|groans|screams|freezes|pauses|stops|starts|continues|waits|hesitates|pulls|pushes|picks|puts|takes|gives|throws|catches|drops|lifts|carries|follows|leads|chases|hugs|kisses|slaps|punches|kicks|shoots|struggles|fights|ducks|dodges|rolls|slides|stumbles|trips|collapses|faints|wakes|sleeps|eats|drinks|reads|writes|drives|dances|sings|plays|works|tries|helps|saves|kills|dies';

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

/**
 * Detect characters for a single scene using regex
 */
function detectCharactersForScene(sceneContent) {
    const characterSet = new Set();
    const characters = [];

    const lines = sceneContent.split('\n');

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
        } else if (trimmed.length > 10) {
            // Check action lines for character mentions
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

    return characters;
}

/**
 * Detect characters for all scenes in batch
 */
function detectCharactersForAllScenes(scenes) {
    const results = new Map();

    for (const scene of scenes) {
        const content = scene.content || scene.scriptContent || '';
        const characters = detectCharactersForScene(content);
        results.set(scene.number || scene.sceneNumber, characters);
    }

    return results;
}

// ============================================================================
// FAST SCENE PARSING (from mobile-pwa/src/utils/scriptParser.ts parseScenesFast)
// ============================================================================

/**
 * Parse scenes from extracted text - fast regex-only approach
 */
function parseScenesFast(text) {
    const lines = text.split('\n');
    const scenes = [];

    let currentScene = null;
    let fallbackSceneNumber = 0;
    let currentSceneContent = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        const parsedHeading = parseSceneHeadingLine(trimmed);

        if (parsedHeading.isValid) {
            // Save previous scene
            if (currentScene) {
                currentScene.content = currentSceneContent.trim();
                scenes.push(currentScene);
            }

            fallbackSceneNumber++;
            const sceneNum = parsedHeading.sceneNumber || String(fallbackSceneNumber);

            currentScene = {
                number: sceneNum,
                heading: trimmed,
                slugline: trimmed,
                intExt: parsedHeading.intExt,
                location: parsedHeading.location,
                timeOfDay: parsedHeading.timeOfDay,
                content: '',
                storyDay: '',
                synopsis: null,
                characters: {},
                suggestedCharacters: [],
                characterConfirmationStatus: 'pending'
            };
            currentSceneContent = trimmed + '\n';
            continue;
        }

        if (currentScene) {
            currentSceneContent += line + '\n';
        }
    }

    // Save last scene
    if (currentScene) {
        currentScene.content = currentSceneContent.trim();
        scenes.push(currentScene);
    }

    // Try to extract title
    const titleMatch = text.slice(0, 1000).match(/^(?:title[:\s]*)?([A-Z][A-Z\s\d\-\'"]+)(?:\n|by)/im);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled Script';

    return { title, scenes, rawText: text };
}

// ============================================================================
// UPLOAD MODAL
// ============================================================================

/**
 * Show the script upload modal
 */
export function showScriptUploadModal() {
    const modal = document.getElementById('script-upload-modal');
    if (!modal) return;

    modal.style.display = 'flex';

    // Reset state
    const fileInfo = document.getElementById('script-upload-file-info');
    const uploadArea = document.getElementById('script-upload-area');
    const processBtn = document.getElementById('script-upload-process-btn');

    if (fileInfo) fileInfo.style.display = 'none';
    if (uploadArea) uploadArea.style.display = 'block';
    if (processBtn) processBtn.disabled = true;

    window._uploadedScriptFile = null;
}

/**
 * Close the script upload modal
 */
export function closeScriptUploadModal() {
    const modal = document.getElementById('script-upload-modal');
    if (modal) modal.style.display = 'none';
    window._uploadedScriptFile = null;
}

/**
 * Handle file selection for script upload
 */
export function handleScriptFileSelect(file) {
    if (!file) return;

    const validTypes = ['.pdf', '.fdx', '.fountain', '.txt'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!validTypes.includes(ext)) {
        showToast('Invalid file type. Please upload a PDF, FDX, Fountain, or TXT file.', 'error');
        return;
    }

    window._uploadedScriptFile = file;

    // Show file info
    const fileInfo = document.getElementById('script-upload-file-info');
    const fileName = document.getElementById('script-upload-file-name');
    const fileSize = document.getElementById('script-upload-file-size');
    const uploadArea = document.getElementById('script-upload-area');
    const processBtn = document.getElementById('script-upload-process-btn');

    if (fileName) fileName.textContent = file.name;
    if (fileSize) fileSize.textContent = formatFileSize(file.size);
    if (fileInfo) fileInfo.style.display = 'flex';
    if (uploadArea) uploadArea.style.display = 'none';
    if (processBtn) processBtn.disabled = false;
}

/**
 * Clear the selected script file
 */
export function clearScriptFile() {
    window._uploadedScriptFile = null;

    const fileInfo = document.getElementById('script-upload-file-info');
    const uploadArea = document.getElementById('script-upload-area');
    const processBtn = document.getElementById('script-upload-process-btn');

    if (fileInfo) fileInfo.style.display = 'none';
    if (uploadArea) uploadArea.style.display = 'block';
    if (processBtn) processBtn.disabled = true;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ============================================================================
// MAIN PROCESSING FLOW
// ============================================================================

/**
 * Process the uploaded script file
 * 1. Extract text from PDF
 * 2. Parse scenes (fast, regex-only)
 * 3. Detect characters per scene
 * 4. Store in state and render
 */
export async function processUploadedScript() {
    const file = window._uploadedScriptFile;
    if (!file) {
        showToast('No file selected', 'error');
        return;
    }

    // Close modal
    closeScriptUploadModal();

    // Show loading
    showTopLoadingBar('Processing Script', 'Extracting text from PDF...', 5);

    try {
        // Step 1: Extract text from file
        let text;
        const ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'pdf') {
            text = await extractTextFromPDF(file);
            // PDF path already normalizes via extractTextFromPDF → normalizeScriptText
        } else if (ext === 'fdx') {
            const xmlContent = await file.text();
            text = normalizeScriptText(extractTextFromFDX(xmlContent));
        } else {
            text = normalizeScriptText(await file.text());
        }

        if (!text || text.trim().length < 50) {
            closeTopLoadingBar();
            showToast('Could not extract text from the file. The PDF may be image-based.', 'error');
            return;
        }

        console.log(`Extracted ${text.length} characters from ${file.name}`);
        updateTopLoadingBar('Processing Script', 'Parsing scenes...', 25);

        // Step 2: Parse scenes
        const parsed = parseScenesFast(text);
        console.log(`Found ${parsed.scenes.length} scenes in "${parsed.title}"`);

        if (parsed.scenes.length === 0) {
            closeTopLoadingBar();
            showToast('No scenes detected. Make sure the script uses standard INT./EXT. scene headings.', 'warning');
            return;
        }

        updateTopLoadingBar('Processing Script', `Detecting characters in ${parsed.scenes.length} scenes...`, 50);

        // Step 3: Detect characters per scene
        const characterResults = detectCharactersForAllScenes(parsed.scenes);
        const allCharacterNames = new Set();

        // Assign characters to scenes
        parsed.scenes.forEach(scene => {
            const sceneChars = characterResults.get(scene.number) || [];
            scene.suggestedCharacters = sceneChars;
            scene.characterConfirmationStatus = 'pending';
            sceneChars.forEach(c => allCharacterNames.add(c));
        });

        console.log(`Detected ${allCharacterNames.size} unique characters across all scenes`);

        updateTopLoadingBar('Processing Script', 'Setting up project...', 80);

        // Step 4: Store in state
        // Initialize state arrays
        if (!state.continuityEvents || !Array.isArray(state.continuityEvents)) {
            state.continuityEvents = [];
        }
        if (!state.confirmedCharacters || !(state.confirmedCharacters instanceof Set)) {
            state.confirmedCharacters = new Set();
        }
        if (!state.detectedCharacters) {
            state.detectedCharacters = [];
        }

        // Create/update project
        if (!state.currentProject) {
            state.currentProject = {
                id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: parsed.title || 'Untitled Project',
                created: Date.now()
            };
        }

        state.currentProject.scriptContent = text;
        state.currentProject.scriptFileName = file.name;
        state.currentProject.name = parsed.title || state.currentProject.name;

        // Update project title in UI
        const titleEl = document.getElementById('projectTitle');
        if (titleEl) titleEl.textContent = state.currentProject.name;

        // Set scenes
        state.scenes = parsed.scenes;
        state.currentProject.scenes = parsed.scenes;

        // Build detected characters list for confirmation
        const charCountMap = new Map();
        const charScenesMap = new Map();

        parsed.scenes.forEach(scene => {
            (scene.suggestedCharacters || []).forEach(charName => {
                charCountMap.set(charName, (charCountMap.get(charName) || 0) + 1);
                if (!charScenesMap.has(charName)) charScenesMap.set(charName, []);
                charScenesMap.get(charName).push(scene.number);
            });
        });

        state.detectedCharacters = Array.from(allCharacterNames).map(name => ({
            name: name,
            category: charCountMap.get(name) >= 5 ? 'LEAD' : charCountMap.get(name) >= 2 ? 'SUPPORTING' : 'MINOR',
            sceneCount: charCountMap.get(name) || 0,
            scenesPresent: charScenesMap.get(name) || [],
            selected: true,
            hasDialogue: true
        })).sort((a, b) => b.sceneCount - a.sceneCount);

        // Auto-populate scene breakdowns with detected characters
        parsed.scenes.forEach((scene, index) => {
            if (!state.sceneBreakdowns[index]) {
                state.sceneBreakdowns[index] = {};
            }
            // Convert character names to title case for display
            const titleCaseChars = (scene.suggestedCharacters || []).map(name =>
                name.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
            );
            state.sceneBreakdowns[index].cast = titleCaseChars;
            state.sceneBreakdowns[index].suggestedCharacters = scene.suggestedCharacters;
            state.sceneBreakdowns[index].characterConfirmationStatus = 'pending';
        });

        // Try story day + scene type detection
        try {
            const scriptAnalysis = await import('./script-analysis.js').catch(() => null);
            if (scriptAnalysis) {
                if (scriptAnalysis.detectStoryDays) {
                    scriptAnalysis.detectStoryDays(text, state.scenes);
                }
                if (scriptAnalysis.detectAllSceneTypes) {
                    scriptAnalysis.detectAllSceneTypes(state.scenes);
                }
            }
        } catch (err) {
            console.warn('Auto-detection (non-critical):', err);
        }

        updateTopLoadingBar('Processing Script', 'Rendering...', 95);

        // Step 5: Render UI
        renderSceneList();
        renderScript();

        setTimeout(() => {
            renderCharacterTabs();
            renderCharacterTabPanels();
        }, 0);

        if (state.scenes.length > 0) {
            selectScene(0);
        }

        // Save project
        saveProject();

        closeTopLoadingBar();
        showToast(`Script loaded: ${parsed.scenes.length} scenes, ${allCharacterNames.size} characters detected`, 'success');

        // Show character confirmation modal
        try {
            const { showCharacterConfirmationModal } = await import('./export/export-character-confirmation.js');
            showCharacterConfirmationModal();
        } catch (err) {
            console.warn('Character confirmation modal not available:', err);
        }

        // Update workflow status
        if (window.updateWorkflowStatus) {
            window.updateWorkflowStatus();
        }

    } catch (error) {
        console.error('Script processing failed:', error);
        closeTopLoadingBar();
        showToast(`Failed to process script: ${error.message}`, 'error');
    }
}

// ============================================================================
// SCENE CHARACTER CONFIRMATION (for breakdown panel)
// ============================================================================

/**
 * Render character confirmation section for a scene in the breakdown panel
 * Shows suggested characters with checkboxes to confirm/remove
 */
export function renderSceneCharacterConfirmation(sceneIndex) {
    const scene = state.scenes[sceneIndex];
    if (!scene) return '';

    const breakdown = state.sceneBreakdowns[sceneIndex] || {};
    const status = breakdown.characterConfirmationStatus || 'confirmed';
    const suggested = breakdown.suggestedCharacters || [];
    const confirmed = breakdown.cast || [];

    if (status !== 'pending' || suggested.length === 0) {
        return ''; // Already confirmed or no suggestions
    }

    const html = `
        <div class="scene-char-confirmation" id="scene-char-confirm-${sceneIndex}">
            <div class="char-confirm-header">
                <span class="char-confirm-icon">!</span>
                <span class="char-confirm-title">Confirm Characters</span>
            </div>
            <div class="char-confirm-desc">
                ${suggested.length} character${suggested.length !== 1 ? 's' : ''} detected in this scene. Confirm or adjust below.
            </div>
            <div class="char-confirm-list">
                ${suggested.map((charName, idx) => {
                    const titleCase = charName.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
                    const isChecked = confirmed.some(c => c.toUpperCase() === charName.toUpperCase());
                    return `
                        <label class="char-confirm-item">
                            <input type="checkbox"
                                   ${isChecked ? 'checked' : ''}
                                   onchange="toggleSceneCharacter(${sceneIndex}, '${escapeAttr(titleCase)}', this.checked)">
                            <span class="char-confirm-name">${escapeHtml(titleCase)}</span>
                        </label>
                    `;
                }).join('')}
            </div>
            <div class="char-confirm-actions">
                <button class="char-confirm-btn confirm" onclick="confirmSceneCharacters(${sceneIndex})">
                    Confirm Characters
                </button>
            </div>
        </div>
    `;

    return html;
}

/**
 * Toggle a character in/out of a scene's cast
 */
export function toggleSceneCharacter(sceneIndex, characterName, isChecked) {
    if (!state.sceneBreakdowns[sceneIndex]) {
        state.sceneBreakdowns[sceneIndex] = {};
    }

    const breakdown = state.sceneBreakdowns[sceneIndex];
    if (!breakdown.cast) breakdown.cast = [];

    if (isChecked) {
        if (!breakdown.cast.includes(characterName)) {
            breakdown.cast.push(characterName);
        }
    } else {
        breakdown.cast = breakdown.cast.filter(c => c !== characterName);
    }
}

/**
 * Confirm characters for a specific scene
 */
export function confirmSceneCharacters(sceneIndex) {
    if (!state.sceneBreakdowns[sceneIndex]) {
        state.sceneBreakdowns[sceneIndex] = {};
    }

    state.sceneBreakdowns[sceneIndex].characterConfirmationStatus = 'confirmed';

    // Also set castMembers on the scene object
    const scene = state.scenes[sceneIndex];
    if (scene) {
        scene.castMembers = state.sceneBreakdowns[sceneIndex].cast || [];
    }

    // Re-render the breakdown panel
    import('./breakdown-form.js').then(mod => {
        mod.renderBreakdownPanel();
    });

    saveProject();
    showToast(`Characters confirmed for Scene ${sceneIndex + 1}`, 'success');
}

// ============================================================================
// HELPERS
// ============================================================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;');
}

// ============================================================================
// INITIALIZE: Setup event listeners and auto-show modal
// ============================================================================

/**
 * Initialize the script upload system
 * - Set up drag-and-drop on the upload area
 * - Set up file input
 * - Auto-show modal if no script loaded
 */
export function initScriptUpload() {
    // Set up upload area click and drag-drop
    const uploadArea = document.getElementById('script-upload-area');
    const fileInput = document.getElementById('script-upload-file');

    if (uploadArea && fileInput) {
        uploadArea.addEventListener('click', () => fileInput.click());

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--accent-gold)';
            uploadArea.style.background = 'rgba(201, 169, 97, 0.1)';
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--glass-border)';
            uploadArea.style.background = 'rgba(255, 255, 255, 0.02)';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--glass-border)';
            uploadArea.style.background = 'rgba(255, 255, 255, 0.02)';

            if (e.dataTransfer.files.length > 0) {
                handleScriptFileSelect(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleScriptFileSelect(e.target.files[0]);
            }
        });
    }
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.showScriptUploadModal = showScriptUploadModal;
window.closeScriptUploadModal = closeScriptUploadModal;
window.handleScriptFileSelect = handleScriptFileSelect;
window.clearScriptFile = clearScriptFile;
window.processUploadedScript = processUploadedScript;
window.toggleSceneCharacter = toggleSceneCharacter;
window.confirmSceneCharacters = confirmSceneCharacters;

export default {
    showScriptUploadModal,
    closeScriptUploadModal,
    handleScriptFileSelect,
    clearScriptFile,
    processUploadedScript,
    initScriptUpload,
    renderSceneCharacterConfirmation,
    toggleSceneCharacter,
    confirmSceneCharacters
};
