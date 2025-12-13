/**
 * export-deep-analysis.js
 * Character detection and extraction utilities
 *
 * Responsibilities:
 * - CharacterDetector class for intelligent character detection
 * - Extract characters from scenes
 * - Normalize character names
 * - Create character alias maps
 */

import { state } from '../main.js';

/**
 * Character Detection Class - Handles intelligent character name extraction and deduplication
 */
export class CharacterDetector {
    constructor() {
        this.characters = new Map(); // Map<primaryName, characterData>
        this.aliasMap = new Map();   // Map<alias, primaryName>
    }

    /**
     * Add a character or merge with existing variations
     * @param {string} rawName - Raw character name
     * @param {number} sceneIndex - Scene index
     * @returns {string|null} Primary name or null
     */
    addCharacter(rawName, sceneIndex) {
        const cleaned = this.cleanName(rawName);
        if (!cleaned) return null;

        const parts = cleaned.split(/\s+/);
        const upperName = cleaned.toUpperCase();

        const existingPrimary = this.findMatchingCharacter(parts, upperName);

        if (existingPrimary) {
            const char = this.characters.get(existingPrimary);

            if (!char.aliases.includes(cleaned)) {
                char.aliases.push(cleaned);
            }

            if (cleaned.length > char.primaryName.length) {
                if (!char.aliases.includes(char.primaryName)) {
                    char.aliases.push(char.primaryName);
                }
                char.primaryName = cleaned;
                this.characters.set(cleaned, char);
                this.characters.delete(existingPrimary);
                char.aliases.forEach(alias => {
                    this.aliasMap.set(alias.toUpperCase(), cleaned);
                });
                this.aliasMap.set(upperName, cleaned);
            }

            char.dialogueCount++;
            if (!char.sceneAppearances.includes(sceneIndex)) {
                char.sceneAppearances.push(sceneIndex);
            }

            return existingPrimary;
        } else {
            const charData = {
                primaryName: cleaned,
                aliases: [cleaned, rawName],
                firstScene: sceneIndex,
                sceneAppearances: [sceneIndex],
                dialogueCount: 1,
                isConfirmed: false
            };

            this.characters.set(cleaned, charData);
            this.aliasMap.set(upperName, cleaned);

            if (parts.length === 1) {
                this.aliasMap.set(upperName, cleaned);
            }

            return cleaned;
        }
    }

    /**
     * Clean character name - remove parentheticals and normalize
     * @param {string} rawName - Raw name
     * @returns {string|null} Cleaned name or null
     */
    cleanName(rawName) {
        if (!rawName) return null;

        let cleaned = rawName.replace(/\s*\((?:V\.O\.|O\.S\.|O\.C\.|CONT'D|PRE-LAP|FILTERED|.*?)\)\s*/g, '');
        cleaned = cleaned.trim().replace(/\s+/g, ' ');
        cleaned = this.toTitleCase(cleaned);

        return cleaned;
    }

    /**
     * Find matching character based on name parts
     * @param {string[]} parts - Name parts
     * @param {string} upperName - Uppercase name
     * @returns {string|null} Matching primary name or null
     */
    findMatchingCharacter(parts, upperName) {
        if (this.aliasMap.has(upperName)) {
            return this.aliasMap.get(upperName);
        }

        for (const [primaryName, charData] of this.characters) {
            const primaryUpper = primaryName.toUpperCase();
            const primaryParts = primaryUpper.split(/\s+/);

            if (parts.length < primaryParts.length) {
                const isSubset = parts.every(part => primaryParts.includes(part));
                if (isSubset) {
                    return primaryName;
                }
            }

            if (primaryParts.length < parts.length) {
                const isSuperset = primaryParts.every(part => parts.includes(part));
                if (isSuperset) {
                    return primaryName;
                }
            }

            if (parts[0] === primaryParts[0] && parts.length > 1 && primaryParts.length > 1) {
                return primaryName;
            }
        }

        return null;
    }

    /**
     * Convert to title case
     * @param {string} str - String to convert
     * @returns {string} Title case string
     */
    toTitleCase(str) {
        return str.split(' ')
            .map(word => word.charAt(0) + word.slice(1).toLowerCase())
            .join(' ');
    }

    /**
     * Get all detected characters sorted by importance
     * @returns {Array} Array of character objects
     */
    getCharacters() {
        return Array.from(this.characters.values())
            .sort((a, b) => b.dialogueCount - a.dialogueCount);
    }

    /**
     * Clear all data
     */
    clear() {
        this.characters.clear();
        this.aliasMap.clear();
    }
}

/**
 * Extract characters from all scenes with intelligent screenplay format parsing
 * @returns {Array} Array of detected characters
 */
export function extractCharactersFromScenes() {
    console.log(`Extracting characters from ${state.scenes.length} scenes using intelligent detection...`);

    if (state.scenes.length === 0) {
        console.error('No scenes found! Cannot detect characters.');
        return [];
    }

    console.log(`Processing ${state.scenes.length} scenes`);

    const detector = new CharacterDetector();

    // Regex patterns
    const sceneHeadingPattern = /^(?:INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)/i;
    const transitionPattern = /^(?:CUT TO:|FADE IN:|FADE OUT:|DISSOLVE TO:|BACK TO:)/i;
    const characterPattern = /^([A-Z][A-Z\s\-'\.]+?)(?:\s*\([^\)]+\))?\s*$/;

    // Invalid patterns to exclude
    const invalidPatterns = [
        /^\d+$/,
        /^\d+\s*\./,
        /CONTINUED/i,
        /^MORE$/i,
        /LATER|MEANWHILE|MOMENTS/i,
        /^[*\.\-\s]+$/,
        /:/,
        /DAY|NIGHT|MORNING|EVENING|DUSK|DAWN/i,
        /\d{2,}/,
        /[!?\.]{2,}/,
        /^THE END$/i,
        /^(?:TITLE|SUPER|MONTAGE|SERIES OF SHOTS|INTERCUT|INSERT|FLASHBACK|FLASH FORWARD)/i
    ];

    // Generic roles to exclude
    const genericRoles = new Set([
        'WAITER', 'WAITRESS', 'BARTENDER', 'DRIVER', 'TAXI DRIVER',
        'CREW MEMBER', 'PASSENGER', 'AGENT', 'RECEPTIONIST',
        'NURSE', 'DOCTOR', 'OFFICER', 'GUARD',
        'MAN', 'WOMAN', 'BOY', 'GIRL', 'PERSON',
        'VOICE', 'CROWD', 'ALL', 'EVERYONE', 'MORE'
    ]);

    // Location keywords
    const locationWords = ['HOUSE', 'ROOM', 'STREET', 'ROAD', 'FERRY', 'TAXI',
                          'FARMHOUSE', 'AIRPORT', 'KITCHEN', 'BEDROOM', 'BATHROOM',
                          'HALLWAY', 'OFFICE', 'CAR', 'BUILDING', 'LOBBY'];

    let totalDetected = 0;

    state.scenes.forEach((scene, sceneIndex) => {
        const lines = scene.content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (!trimmed) continue;
            if (sceneHeadingPattern.test(trimmed)) continue;
            if (transitionPattern.test(trimmed)) continue;

            const leadingSpaces = line.length - line.trimStart().length;
            const hasTabs = line.startsWith('\t');
            const hasIndentation = hasTabs || leadingSpaces >= 5;

            const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);

            if (!isAllCaps) continue;

            const requireStrictDialogue = !hasIndentation;

            // Check for dialogue following
            let nextLineIndex = i + 1;
            let nextLine = '';
            while (nextLineIndex < lines.length && !nextLine.trim()) {
                nextLine = lines[nextLineIndex];
                nextLineIndex++;
            }

            let hasDialogueAfter = nextLine &&
                                    nextLine.trim().length > 0 &&
                                    !sceneHeadingPattern.test(nextLine.trim()) &&
                                    !transitionPattern.test(nextLine.trim()) &&
                                    !(nextLine.trim() === nextLine.trim().toUpperCase() && /[A-Z]/.test(nextLine.trim()));

            if (hasDialogueAfter && nextLine.trim().startsWith('(')) {
                let lookAhead = nextLineIndex;
                while (lookAhead < lines.length) {
                    const futureLinetext = lines[lookAhead].trim();
                    if (futureLinetext && !futureLinetext.startsWith('(') && !futureLinetext.match(/^[A-Z\s]+$/)) {
                        hasDialogueAfter = true;
                        break;
                    }
                    if (futureLinetext.match(/^[A-Z\s]+$/)) {
                        hasDialogueAfter = false;
                        break;
                    }
                    lookAhead++;
                }
            }

            if (requireStrictDialogue && !hasDialogueAfter) {
                continue;
            }

            if (!hasDialogueAfter) {
                continue;
            }

            const match = trimmed.match(characterPattern);
            if (!match) continue;

            let charName = match[1].trim();

            if (charName.length < 2 || charName.length > 30) continue;
            if (invalidPatterns.some(pattern => pattern.test(charName))) continue;
            if (genericRoles.has(charName.toUpperCase())) continue;
            if (locationWords.some(word => charName.includes(word))) continue;

            const added = detector.addCharacter(charName, sceneIndex);
            if (added) {
                totalDetected++;
            }
        }
    });

    const detectedChars = detector.getCharacters();
    const validCharacters = detectedChars.filter(char => char.dialogueCount >= 1);

    console.log('DETECTION RESULTS:');
    console.log(`Detected ${totalDetected} character instances`);
    console.log(`Found ${detectedChars.length} total unique characters`);
    console.log(`${validCharacters.length} characters after filtering`);

    if (validCharacters.length === 0) {
        console.error('NO CHARACTERS DETECTED!');
    }

    // Store in global state for review modal
    window.detectedCharacterData = validCharacters;

    // Also populate state.characters for backwards compatibility
    state.characters = new Set();
    validCharacters.forEach(char => state.characters.add(char.primaryName));

    return validCharacters;
}

/**
 * Normalize character name to title case
 * @param {string} name - Character name
 * @returns {string} Normalized name
 */
export function normalizeCharacterName(name) {
    return name.split(' ')
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Create character alias map to handle name variations
 * @returns {Map} Alias map
 */
export function createCharacterAliasMap() {
    const aliasMap = new Map();
    const characters = Array.from(state.characters);

    console.log('Creating character alias map...');

    const firstNameToFull = new Map();

    characters.forEach(fullName => {
        const parts = fullName.split(' ');

        aliasMap.set(fullName, fullName);
        aliasMap.set(fullName.toUpperCase(), fullName);
        aliasMap.set(fullName.toLowerCase(), fullName);

        if (parts.length > 1) {
            const firstName = parts[0];

            if (!firstNameToFull.has(firstName)) {
                firstNameToFull.set(firstName, fullName);
            }
        }
    });

    firstNameToFull.forEach((fullName, firstName) => {
        if (characters.includes(firstName)) {
            console.log(`  → Merging "${firstName}" into "${fullName}"`);
            state.characters.delete(firstName);
        }

        aliasMap.set(firstName, fullName);
        aliasMap.set(firstName.toUpperCase(), fullName);
        aliasMap.set(firstName.toLowerCase(), fullName);
        console.log(`  Alias: "${firstName}" → "${fullName}"`);
    });

    window.characterAliasMap = aliasMap;

    console.log(`Created ${aliasMap.size} character aliases`);
    return aliasMap;
}

/**
 * Normalize a raw character name using the alias map
 * @param {string} rawName - Raw name
 * @param {Map} aliasMap - Alias map
 * @returns {string} Normalized name
 */
export function normalizeCharacterNameWithAlias(rawName, aliasMap) {
    if (!rawName) return '';

    const cleaned = rawName.trim();

    if (aliasMap.has(cleaned)) {
        return aliasMap.get(cleaned);
    }

    if (aliasMap.has(cleaned.toUpperCase())) {
        return aliasMap.get(cleaned.toUpperCase());
    }

    if (aliasMap.has(cleaned.toLowerCase())) {
        return aliasMap.get(cleaned.toLowerCase());
    }

    return normalizeCharacterName(cleaned);
}

/**
 * Initialize character tabs and profiles from confirmed characters
 */
export function initializeCharacterTabs() {
    console.log('Initializing character tabs from confirmed characters...');

    if (!state.confirmedCharacters || state.confirmedCharacters.size === 0) {
        console.log('No confirmed characters - skipping tab initialization');
        state.characterTabs = [];
        return;
    }

    const characterArray = Array.from(state.confirmedCharacters);
    console.log(`  Initializing ${characterArray.length} confirmed characters`);

    characterArray.forEach(character => {
        if (!state.castProfiles[character]) {
            state.castProfiles[character] = {
                name: character,
                baseDescription: '',
                scenes: [],
                lookStates: []
            };
            console.log(`  → Created cast profile for "${character}"`);
        }
    });

    state.characterTabs = characterArray;

    console.log(`Initialized ${state.characterTabs.length} character tabs from confirmed characters:`, state.characterTabs);
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.extractCharactersFromScenes = extractCharactersFromScenes;
window.normalizeCharacterName = normalizeCharacterName;
window.createCharacterAliasMap = createCharacterAliasMap;
window.initializeCharacterTabs = initializeCharacterTabs;

export default {
    CharacterDetector,
    extractCharactersFromScenes,
    normalizeCharacterName,
    normalizeCharacterNameWithAlias,
    createCharacterAliasMap,
    initializeCharacterTabs
};
