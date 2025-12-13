/**
 * export-generation.js
 * Timeline and lookbook generation functionality
 *
 * Responsibilities:
 * - Generate character timelines
 * - Generate character lookbooks
 * - Build timeline data for characters
 * - Create lookbook data for characters
 */

import { state } from '../main.js';
import { showProgressModal, updateProgressModal, closeProgressModal, showToast } from './export-core.js';

// Cached AI module reference
let _callAI = null;

/**
 * Get callAI function - loads dynamically if needed
 * @returns {Promise<Function>} callAI function
 */
async function getCallAI() {
    if (_callAI) return _callAI;

    // Try window first (most common case)
    if (window.callAI) {
        _callAI = window.callAI;
        return _callAI;
    }

    // Try dynamic import from ai-integration.js
    try {
        const aiModule = await import('../ai-integration.js');
        if (aiModule?.callAI) {
            _callAI = aiModule.callAI;
            return _callAI;
        }
    } catch (e) {
        console.warn('Could not load ai-integration module:', e);
    }

    // Fallback to window.callAI
    _callAI = window.callAI;
    return _callAI;
}

/**
 * Generate character timelines for all characters
 */
export async function generateCharacterTimelines() {
    if (!window.scriptNarrativeContext) {
        alert('Please import and analyze a script first');
        return;
    }

    showProgressModal('Generating Timelines', 'Creating visual timelines for all characters...');

    const characters = window.confirmedCharacters || [];

    if (characters.length === 0) {
        closeProgressModal();
        alert('No characters found. Please run "Detect & Review Characters" first.');
        return;
    }

    if (!window.characterTimelines) {
        window.characterTimelines = {};
    }

    for (let i = 0; i < characters.length; i++) {
        const character = characters[i];

        updateProgressModal(
            i + 1,
            characters.length,
            `Processing ${character}...`,
            false
        );

        try {
            const timeline = await buildCharacterTimeline(character);
            storeCharacterTimeline(character, timeline);
            updateCharacterProfileTab(character, timeline);
        } catch (error) {
            console.error(`Error generating timeline for ${character}:`, error);
        }
    }

    updateProgressModal(characters.length, characters.length, 'Timelines generated!', true);
    closeProgressModal();
    showToast('Character timelines generated successfully', 'success');
}

/**
 * Build timeline data for a specific character
 * @param {string} characterName - Character name
 * @returns {Promise<Object>} Timeline data
 */
async function buildCharacterTimeline(characterName) {
    const context = window.scriptNarrativeContext;
    const scriptData = state.scriptData;

    const characterScenes = state.scenes
        .map((scene, idx) => ({
            sceneNumber: scene.sceneNumber || idx + 1,
            heading: scene.heading,
            text: scene.text,
            index: idx
        }))
        .filter(scene =>
            scene.text && scene.text.toUpperCase().includes(characterName.toUpperCase())
        );

    const prompt = `Generate a visual continuity timeline for the character "${characterName}" in this script.

Script Title: ${scriptData?.title || 'Untitled'}
Narrative Context: ${JSON.stringify(context).substring(0, 1000)}

Character appears in ${characterScenes.length} scenes:
${characterScenes.map(s => `Scene ${s.sceneNumber}: ${s.heading}`).join('\n')}

Scene details:
${characterScenes.map(s => `\nScene ${s.sceneNumber}:\n${s.text.substring(0, 500)}`).join('\n')}

Create a timeline showing:
1. All appearance changes (hair, makeup, wardrobe)
2. Injury progressions with healing stages
3. Emotional states affecting appearance
4. Time of day and lighting considerations
5. Key story moments affecting continuity

Return as JSON array with this structure:
[
  {
    "sceneNumber": "1",
    "description": "Brief continuity note",
    "changes": ["hair: neat bun", "makeup: fresh, natural"],
    "injuries": [],
    "emotional_state": "confident, composed",
    "notes": "Additional continuity notes"
  }
]

Keep descriptions concise and focused on visual continuity for hair and makeup departments.`;

    try {
        const aiCall = await getCallAI();
        if (!aiCall) {
            throw new Error('AI module not available');
        }

        const response = await aiCall(prompt, 2000);
        const timelineData = JSON.parse(response);

        return {
            character: characterName,
            totalScenes: characterScenes.length,
            timeline: timelineData,
            generatedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error parsing timeline:', error);
        return {
            character: characterName,
            totalScenes: characterScenes.length,
            timeline: characterScenes.map(s => ({
                sceneNumber: s.sceneNumber,
                description: `Appears in ${s.heading}`,
                changes: [],
                injuries: [],
                emotional_state: 'unknown',
                notes: ''
            })),
            generatedAt: new Date().toISOString()
        };
    }
}

/**
 * Store character timeline data
 * @param {string} characterName - Character name
 * @param {Object} timeline - Timeline data
 */
function storeCharacterTimeline(characterName, timeline) {
    if (!window.characterTimelines) {
        window.characterTimelines = {};
    }
    window.characterTimelines[characterName] = timeline;
}

/**
 * Get character timeline data
 * @param {string} characterName - Character name
 * @returns {Object|null} Timeline data or null
 */
export function getCharacterTimeline(characterName) {
    return window.characterTimelines?.[characterName] || null;
}

/**
 * Update character profile tab with timeline data
 * @param {string} characterName - Character name
 * @param {Object} timeline - Timeline data
 */
function updateCharacterProfileTab(characterName, timeline) {
    console.log(`Timeline available for ${characterName}:`, timeline);
}

/**
 * Generate character lookbooks for all characters
 */
export async function generateCharacterLookbooks() {
    if (!window.scriptNarrativeContext) {
        alert('Please import and analyze a script first');
        return;
    }

    showProgressModal('Generating Lookbooks', 'Creating visual reference guides...');

    const characters = window.confirmedCharacters || [];

    if (characters.length === 0) {
        closeProgressModal();
        alert('No characters found. Please run "Detect & Review Characters" first.');
        return;
    }

    if (!window.characterLookbooks) {
        window.characterLookbooks = {};
    }

    for (let i = 0; i < characters.length; i++) {
        const character = characters[i];

        updateProgressModal(
            i + 1,
            characters.length,
            `Creating lookbook for ${character}...`,
            false
        );

        try {
            const lookbook = await createCharacterLookbook(character);
            storeCharacterLookbook(character, lookbook);
        } catch (error) {
            console.error(`Error generating lookbook for ${character}:`, error);
        }
    }

    updateProgressModal(characters.length, characters.length, 'Lookbooks generated!', true);
    closeProgressModal();
    showToast('Character lookbooks generated successfully', 'success');
}

/**
 * Create lookbook for a specific character
 * @param {string} characterName - Character name
 * @returns {Promise<Object>} Lookbook data
 */
async function createCharacterLookbook(characterName) {
    const context = window.scriptNarrativeContext;
    const scriptData = state.scriptData;
    const timeline = getCharacterTimeline(characterName);

    const characterScenes = state.scenes
        .map((scene, idx) => ({
            sceneNumber: scene.sceneNumber || idx + 1,
            heading: scene.heading,
            text: scene.text,
            index: idx
        }))
        .filter(scene =>
            scene.text && scene.text.toUpperCase().includes(characterName.toUpperCase())
        );

    const prompt = `Create a professional character lookbook for "${characterName}" for the hair and makeup department.

Script Title: ${scriptData?.title || 'Untitled'}
Narrative Context: ${JSON.stringify(context).substring(0, 1000)}

Character appears in ${characterScenes.length} scenes.

${timeline ? `Timeline data available:\n${JSON.stringify(timeline.timeline).substring(0, 1000)}` : ''}

Scene details:
${characterScenes.slice(0, 10).map(s => `\nScene ${s.sceneNumber}:\n${s.text.substring(0, 400)}`).join('\n')}

Include:
1. Base appearance description (hair, makeup, general look)
2. Key looks by story phase or act
3. Continuity requirements (injuries, aging, weather effects)
4. Special makeup/hair needs (SFX, period styling, etc.)
5. Reference notes for each major scene
6. Color palette and styling notes

Format as structured JSON:
{
  "character": "${characterName}",
  "baseAppearance": {
    "hair": "description",
    "makeup": "description",
    "skinTone": "description",
    "specialFeatures": []
  },
  "looksByPhase": [
    {
      "phase": "Act 1",
      "scenes": "1-10",
      "description": "Overall look description",
      "hair": "specific hair notes",
      "makeup": "specific makeup notes",
      "continuity": ["note1", "note2"]
    }
  ],
  "specialRequirements": [],
  "colorPalette": [],
  "departmentNotes": {
    "hair": [],
    "makeup": [],
    "wardrobe": []
  }
}

Focus on practical, actionable information for the crew.`;

    try {
        const aiCall = await getCallAI();
        if (!aiCall) {
            throw new Error('AI module not available');
        }

        const response = await aiCall(prompt, 2500);
        const lookbookData = JSON.parse(response);

        return {
            ...lookbookData,
            generatedAt: new Date().toISOString(),
            totalScenes: characterScenes.length
        };
    } catch (error) {
        console.error('Error parsing lookbook:', error);
        return {
            character: characterName,
            baseAppearance: {
                hair: 'Not analyzed',
                makeup: 'Not analyzed',
                skinTone: 'Not specified',
                specialFeatures: []
            },
            looksByPhase: [],
            specialRequirements: [],
            colorPalette: [],
            departmentNotes: {
                hair: [],
                makeup: [],
                wardrobe: []
            },
            generatedAt: new Date().toISOString(),
            totalScenes: characterScenes.length
        };
    }
}

/**
 * Store character lookbook data
 * @param {string} characterName - Character name
 * @param {Object} lookbook - Lookbook data
 */
function storeCharacterLookbook(characterName, lookbook) {
    if (!window.characterLookbooks) {
        window.characterLookbooks = {};
    }
    window.characterLookbooks[characterName] = lookbook;
}

/**
 * Get character lookbook data
 * @param {string} characterName - Character name
 * @returns {Object|null} Lookbook data or null
 */
export function getCharacterLookbook(characterName) {
    return window.characterLookbooks?.[characterName] || null;
}

/**
 * Get character continuity data (combines timeline and lookbook)
 * @param {string} characterName - Character name
 * @returns {Object} Combined continuity data
 */
export function getCharacterContinuity(characterName) {
    const timeline = getCharacterTimeline(characterName);
    const lookbook = getCharacterLookbook(characterName);

    return {
        timeline,
        lookbook,
        character: characterName
    };
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.generateCharacterTimelines = generateCharacterTimelines;
window.generateCharacterLookbooks = generateCharacterLookbooks;
window.getCharacterTimeline = getCharacterTimeline;
window.getCharacterLookbook = getCharacterLookbook;
window.getCharacterContinuity = getCharacterContinuity;

export default {
    generateCharacterTimelines,
    generateCharacterLookbooks,
    getCharacterTimeline,
    getCharacterLookbook,
    getCharacterContinuity
};
