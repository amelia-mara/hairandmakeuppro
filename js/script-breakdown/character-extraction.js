/**
 * character-extraction.js
 * Comprehensive character extraction from screenplay
 *
 * CRITICAL: Pattern-based character extraction that finds ALL characters
 * This runs BEFORE AI analysis to ensure no characters are missed
 */

/**
 * Extract ALL characters from script using pattern matching
 * This is the PRIMARY method - it finds every character regardless of AI
 *
 * @param {string} scriptText - Full screenplay text
 * @param {Array} scenes - Array of scene objects
 * @returns {Object} - { characterNames: [], characterData: {} }
 */
export function extractAllCharactersFromScript(scriptText, scenes) {
    console.log('🔍 Extracting ALL characters using comprehensive pattern matching...');

    const characterSet = new Set();
    const characterFirstAppearance = {};
    const characterLastAppearance = {};
    const characterSceneCount = {};
    const characterDescriptions = {};
    const characterScenes = {}; // Track which scenes each character appears in

    scenes.forEach((scene, index) => {
        const sceneNum = scene.number || (index + 1);
        const content = scene.content || scene.text || '';

        // Extract characters from this scene
        const sceneCharacters = extractCharactersFromScene(content, sceneNum);

        sceneCharacters.forEach(charData => {
            const charName = charData.name;

            // Add to global set
            characterSet.add(charName);

            // Track appearances
            if (!characterFirstAppearance[charName]) {
                characterFirstAppearance[charName] = sceneNum;
            }
            characterLastAppearance[charName] = sceneNum;
            characterSceneCount[charName] = (characterSceneCount[charName] || 0) + 1;

            // Track scenes
            if (!characterScenes[charName]) {
                characterScenes[charName] = [];
            }
            characterScenes[charName].push(sceneNum);

            // Store descriptions
            if (charData.description) {
                if (!characterDescriptions[charName]) {
                    characterDescriptions[charName] = [];
                }
                characterDescriptions[charName].push({
                    text: charData.description,
                    sceneNumber: sceneNum,
                    type: charData.descriptionType || 'mention'
                });
            }
        });
    });

    // Build character data objects
    const characterData = {};
    const characterNames = Array.from(characterSet).sort();

    characterNames.forEach(charName => {
        const sceneCount = characterSceneCount[charName] || 0;
        const firstScene = characterFirstAppearance[charName] || 1;
        const lastScene = characterLastAppearance[charName] || scenes.length;
        const scenesPresent = characterScenes[charName] || [];

        // Determine role based on scene count and dialogue
        let role = 'background';
        if (sceneCount >= 15) role = 'protagonist';
        else if (sceneCount >= 8) role = 'supporting';
        else if (sceneCount >= 3) role = 'featured';

        characterData[charName] = {
            name: charName,
            scriptDescriptions: characterDescriptions[charName] || [],
            firstAppearance: firstScene,
            lastAppearance: lastScene,
            sceneCount: scenesPresent.length,
            scenesPresent: scenesPresent,
            role: role,
            hasDialogue: sceneCount > 0
        };
    });

    console.log(`✅ Pattern extraction complete:`, {
        totalCharacters: characterNames.length,
        characters: characterNames
    });

    return {
        characterNames: characterNames,
        characterData: characterData
    };
}

/**
 * Extract characters from a single scene
 * Uses multiple pattern matching techniques
 *
 * @param {string} sceneContent - Scene text content
 * @param {number} sceneNum - Scene number
 * @returns {Array} - Array of { name, description, descriptionType }
 */
function extractCharactersFromScene(sceneContent, sceneNum) {
    const characters = [];
    const foundNames = new Set();

    // METHOD 1: Dialogue pattern
    // Character names appear in ALL CAPS before dialogue or parentheticals
    // Pattern: CHARACTER_NAME (dialogue) or CHARACTER_NAME:
    const dialoguePattern = /^([A-Z][A-Z\s\.'\-]+?)(?:\s*\(|\s*$)/gm;

    const lines = sceneContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1] || '';

        // Check if this line is a character name
        const trimmed = line.trim();

        // Must be all caps, reasonable length, not a scene heading
        if (trimmed.length > 0 &&
            trimmed.length < 50 &&
            trimmed === trimmed.toUpperCase() &&
            !trimmed.startsWith('INT') &&
            !trimmed.startsWith('EXT') &&
            !trimmed.startsWith('FADE') &&
            !trimmed.startsWith('CUT') &&
            !trimmed.startsWith('DISSOLVE') &&
            !trimmed.startsWith('CONTINUED') &&
            !trimmed.startsWith('THE END') &&
            !trimmed.startsWith('TITLE') &&
            !trimmed.startsWith('SUPER') &&
            !trimmed.startsWith('INSERT') &&
            !trimmed.startsWith('BACK TO') &&
            !trimmed.match(/^\d/) && // Not starting with number
            nextLine.trim().length > 0) { // Has next line (dialogue or parenthetical)

            // Clean character name (remove V.O., O.S., CONT'D, etc.)
            let cleanName = trimmed
                .replace(/\s*\(.*?\)\s*/g, '') // Remove parentheticals
                .replace(/\s*\(V\.O\.\)\s*/gi, '')
                .replace(/\s*\(O\.S\.\)\s*/gi, '')
                .replace(/\s*\(O\.C\.\)\s*/gi, '')
                .replace(/\s*\(CONT'D\)\s*/gi, '')
                .replace(/\s*\(CONT\.\)\s*/gi, '')
                .replace(/\s*V\.O\.\s*/gi, '')
                .replace(/\s*O\.S\.\s*/gi, '')
                .replace(/\s*CONT'D\s*/gi, '')
                .trim();

            // Validate cleaned name
            if (cleanName.length > 0 &&
                cleanName.length < 40 &&
                cleanName.match(/^[A-Z][A-Z\s\.\-\']+$/) &&
                !foundNames.has(cleanName)) {

                foundNames.add(cleanName);
                characters.push({
                    name: cleanName,
                    description: null,
                    descriptionType: 'dialogue'
                });
            }
        }
    }

    // METHOD 2: Character introductions in action lines
    // Pattern: "CHARACTER_NAME, age/description" or "CHARACTER_NAME (age)"
    const introPatterns = [
        /\b([A-Z][A-Z\s\.'\-]+),\s*(?:(?:\d+|early|mid|late)\s*(?:years old|\d+s)?|a\s+[a-z]+)/gi,
        /\b([A-Z][A-Z\s\.'\-]+)\s*\((?:\d+|early|mid|late)\s*(?:years old|\d+s)?\)/gi
    ];

    const actionLines = sceneContent.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 &&
               trimmed !== trimmed.toUpperCase() && // Not all caps (not character name or scene heading)
               !trimmed.startsWith('INT') &&
               !trimmed.startsWith('EXT') &&
               !trimmed.startsWith('FADE') &&
               !trimmed.startsWith('CUT');
    });

    actionLines.forEach(line => {
        introPatterns.forEach(pattern => {
            const matches = line.matchAll(pattern);
            for (const match of matches) {
                const charName = match[1].trim();

                // Validate name
                if (charName.length > 1 &&
                    charName.length < 40 &&
                    !foundNames.has(charName) &&
                    !charName.match(/^(INT|EXT|FADE|CUT|THE|A|AN)\s/)) {

                    foundNames.add(charName);
                    characters.push({
                        name: charName,
                        description: line.trim(),
                        descriptionType: 'introduction'
                    });
                }
            }
        });
    });

    // METHOD 3: Character names in action (possessives, references)
    // Pattern: "CHARACTER_NAME's" or "CHARACTER_NAME shakes"
    // Only add if they match dialogue pattern (all caps with reasonable length)
    const possessivePattern = /\b([A-Z][A-Z\s\.'\-]+)'s\b/g;
    let match;

    while ((match = possessivePattern.exec(sceneContent)) !== null) {
        const charName = match[1].trim();

        if (charName.length > 1 &&
            charName.length < 30 &&
            !foundNames.has(charName) &&
            charName.match(/^[A-Z][A-Z\s\.\-\']+$/)) {

            // Only add if it looks like a real character name (not a single word, has reasonable format)
            if (charName.includes(' ') || charName.length < 15) {
                foundNames.add(charName);
                characters.push({
                    name: charName,
                    description: null,
                    descriptionType: 'action'
                });
            }
        }
    }

    return characters;
}

/**
 * Build complete character profile from extracted data
 * Creates the full structure needed for masterContext
 *
 * @param {string} charName - Character name
 * @param {Object} extractedData - Data from extractAllCharactersFromScript
 * @returns {Object} - Complete character profile object
 */
export function buildCharacterProfile(charName, extractedData) {
    const data = extractedData.characterData[charName];

    if (!data) {
        return null;
    }

    return {
        scriptDescriptions: data.scriptDescriptions || [],

        physicalProfile: {
            age: null,
            gender: null,
            build: null,
            height: null,
            hairColor: null,
            hairStyle: null,
            eyeColor: null,
            skin: null,
            distinctiveFeatures: []
        },

        characterAnalysis: {
            role: data.role || 'background',
            relationship: '',
            occupation: '',
            socialClass: '',
            personality: '',
            arc: '',
            emotionalJourney: ''
        },

        visualProfile: {
            overallVibe: '',
            styleChoices: '',
            groomingHabits: '',
            makeupNotes: '',
            quirks: '',
            inspirations: ''
        },

        storyPresence: {
            firstAppearance: data.firstAppearance,
            lastAppearance: data.lastAppearance,
            totalScenes: data.sceneCount,
            scenesPresent: data.scenesPresent,
            hasDialogue: data.hasDialogue,
            speakingScenes: data.scenesPresent
        },

        extractedElements: {
            mentionedWardrobe: [],
            mentionedAppearanceChanges: [],
            physicalActions: [],
            environmentalExposure: []
        },

        continuityNotes: {
            keyLooks: '',
            transformations: '',
            signature: '',
            importantScenes: []
        },

        // Duplicate fields for compatibility
        firstAppearance: data.firstAppearance,
        lastAppearance: data.lastAppearance,
        sceneCount: data.sceneCount,
        scenesPresent: data.scenesPresent
    };
}
