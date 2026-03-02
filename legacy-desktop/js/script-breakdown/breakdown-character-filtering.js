/**
 * breakdown-character-filtering.js
 * Character filtering, categorization, and deduplication
 *
 * Responsibilities:
 * - Calculate character scene counts
 * - Categorize characters (main, supporting, minor)
 * - Aggressive deduplication of character names
 * - Character deduplication across all scenes
 */

import { getState } from './breakdown-character-utils.js';

/**
 * Get character scene counts
 * @returns {Map} - Map of character name -> scene count
 */
export function getCharacterSceneCounts() {
    const state = getState();
    const characterSceneCounts = new Map();

    (state?.scenes || []).forEach((scene, index) => {
        const breakdown = state?.sceneBreakdowns?.[index];
        if (breakdown && breakdown.cast) {
            breakdown.cast.forEach(char => {
                characterSceneCounts.set(char, (characterSceneCounts.get(char) || 0) + 1);
            });
        }
    });

    return characterSceneCounts;
}

/**
 * Get character scene count for a specific character
 * @param {string} characterName - Character name
 * @returns {number} Number of scenes the character appears in
 */
export function getCharacterSceneCount(characterName) {
    const state = getState();
    let count = 0;
    (state?.scenes || []).forEach((scene, index) => {
        const breakdown = state?.sceneBreakdowns?.[index];
        if (breakdown && breakdown.cast && breakdown.cast.includes(characterName)) {
            count++;
        }
    });
    return count;
}

/**
 * Get main characters (appear in 5+ scenes)
 * @param {number} maxCount - Maximum number of main characters to return (default 8)
 * @returns {string[]} - Array of main character names
 */
export function getMainCharacters(maxCount = 8) {
    const characterSceneCounts = getCharacterSceneCounts();

    // Filter characters appearing in 5+ scenes
    const mainCharacters = Array.from(characterSceneCounts.entries())
        .filter(([name, count]) => count >= 5)
        .sort((a, b) => b[1] - a[1]) // Sort by scene count (descending)
        .slice(0, maxCount) // Limit to maxCount
        .map(([name, count]) => name);

    return mainCharacters;
}

/**
 * Get supporting characters (appear in 2-4 scenes)
 * @returns {string[]} - Array of supporting character names
 */
export function getSupportingCharacters() {
    const characterSceneCounts = getCharacterSceneCounts();

    // Filter characters appearing in 2-4 scenes
    const supportingCharacters = Array.from(characterSceneCounts.entries())
        .filter(([name, count]) => count >= 2 && count < 5)
        .sort((a, b) => b[1] - a[1]) // Sort by scene count (descending)
        .map(([name, count]) => name);

    return supportingCharacters;
}

/**
 * Get character role based on scene count
 * @param {string} characterName - Character name
 * @returns {string} Character role (Lead, Supporting, Minor, Extra)
 */
export function getCharacterRole(characterName) {
    const sceneCount = getCharacterSceneCount(characterName);

    if (sceneCount >= 10) {
        return 'Lead';
    } else if (sceneCount >= 5) {
        return 'Supporting';
    } else if (sceneCount >= 2) {
        return 'Minor';
    } else {
        return 'Extra';
    }
}

/**
 * Get all scenes where a character appears
 * @param {string} characterName - Character name
 * @returns {Array} Array of scene indices
 */
export function getCharacterScenes(characterName) {
    const state = getState();
    const sceneIndices = [];
    (state?.scenes || []).forEach((scene, index) => {
        const breakdown = state?.sceneBreakdowns?.[index];
        if (breakdown && breakdown.cast && breakdown.cast.includes(characterName)) {
            sceneIndices.push(index);
        }
    });
    return sceneIndices;
}

/**
 * Group scenes by story day
 * @param {Array} sceneIndices - Array of scene indices
 * @returns {Object} Object mapping story days to arrays of scene indices
 */
export function groupScenesByStoryDay(sceneIndices) {
    const state = getState();
    const groups = {};
    sceneIndices.forEach(sceneIndex => {
        const scene = state.scenes[sceneIndex];
        const day = scene.storyDay || 'Unassigned';
        if (!groups[day]) {
            groups[day] = [];
        }
        groups[day].push(sceneIndex);
    });
    return groups;
}

/**
 * Aggressive deduplication - merge all duplicate character names
 * This runs before generating tabs to ensure no duplicates
 */
export function aggressiveDeduplicate() {
    const state = getState();

    // Manual duplicate mappings for common issues
    const duplicateMap = {
        'gwen': 'Gwen Lawson',
        'GWEN': 'Gwen Lawson',
        'peter': 'Peter Lawson',
        'PETER': 'Peter Lawson',
        'Peter': 'Peter Lawson',
        'inga': 'Inga Olafsson',
        'Inga': 'Inga Olafsson',
        'jon': 'Jon Olafsson',
        'Jon': 'Jon Olafsson',
    };

    (state?.scenes || []).forEach((scene, index) => {
        const breakdown = state?.sceneBreakdowns?.[index];
        if (breakdown && breakdown.cast) {
            breakdown.cast = breakdown.cast.map(char =>
                duplicateMap[char] || window.characterManager?.getCanonicalName?.(char) || char
            );

            // Remove exact duplicates
            breakdown.cast = [...new Set(breakdown.cast)];
        }

        // Also normalize tags
        if (state?.scriptTags?.[index]) {
            state.scriptTags[index].forEach(tag => {
                if (tag.character) {
                    tag.character = duplicateMap[tag.character] ||
                                   window.characterManager?.getCanonicalName?.(tag.character) ||
                                   tag.character;
                }
            });
        }
    });
}

/**
 * Deduplicate all character names across all scenes
 * Rebuilds character manager from scratch and normalizes all references
 */
export function deduplicateAllCharacters() {
    const state = getState();

    // Rebuild character manager from scratch
    window.characterManager.clear();

    // First pass: collect all unique names from scenes
    (state?.scenes || []).forEach((scene, index) => {
        // Process cast in scene breakdowns
        const breakdown = state.sceneBreakdowns[index];
        if (breakdown && breakdown.cast) {
            breakdown.cast = breakdown.cast.map(char =>
                window.characterManager.addCharacter(char)
            ).filter(Boolean);

            // Remove duplicates within scene
            breakdown.cast = [...new Set(breakdown.cast)];
        }

        // Process character names in script tags
        if (state.scriptTags[index]) {
            state.scriptTags[index] = state.scriptTags[index].map(tag => {
                if (tag.character) {
                    tag.character = window.characterManager.getCanonicalName(tag.character) ||
                                   window.characterManager.addCharacter(tag.character);
                }
                // Also normalize cast category tags
                if (tag.category === 'cast' && tag.selectedText) {
                    const canonical = window.characterManager.getCanonicalName(tag.selectedText) ||
                                     window.characterManager.addCharacter(tag.selectedText);
                    tag.selectedText = canonical;
                    tag.character = canonical;
                }
                return tag;
            });
        }

        // Process character states
        if (state.characterStates[index]) {
            const newStates = {};
            Object.keys(state.characterStates[index]).forEach(char => {
                const canonical = window.characterManager.getCanonicalName(char) ||
                                 window.characterManager.addCharacter(char);
                newStates[canonical] = state.characterStates[index][char];
            });
            state.characterStates[index] = newStates;
        }
    });

    // Update global characters set
    state.characters.clear();
    window.characterManager.getAllCharacters().forEach(char => {
        state.characters.add(char);
    });

    // Update cast profiles with canonical names
    const newProfiles = {};
    Object.keys(state.castProfiles).forEach(char => {
        const canonical = window.characterManager.getCanonicalName(char) ||
                         window.characterManager.addCharacter(char);
        newProfiles[canonical] = state.castProfiles[char];
        if (newProfiles[canonical].name) {
            newProfiles[canonical].name = canonical;
        }
    });
    state.castProfiles = newProfiles;

    // Update character looks with canonical names
    const newLooks = {};
    Object.keys(state.characterLooks).forEach(char => {
        const canonical = window.characterManager.getCanonicalName(char) ||
                         window.characterManager.addCharacter(char);
        newLooks[canonical] = state.characterLooks[char];
    });
    state.characterLooks = newLooks;

    // Update continuity events with canonical names
    const newEvents = {};
    Object.keys(state.continuityEvents || {}).forEach(char => {
        const canonical = window.characterManager.getCanonicalName(char) ||
                         window.characterManager.addCharacter(char);
        newEvents[canonical] = state.continuityEvents[char];
    });
    state.continuityEvents = newEvents;

    // Update look transitions
    state.lookTransitions = (state.lookTransitions || []).map(transition => {
        if (transition.character) {
            transition.character = window.characterManager.getCanonicalName(transition.character) ||
                                  window.characterManager.addCharacter(transition.character);
        }
        return transition;
    });
}

// Expose global functions
window.deduplicateAllCharacters = deduplicateAllCharacters;

export default {
    getCharacterSceneCounts,
    getCharacterSceneCount,
    getMainCharacters,
    getSupportingCharacters,
    getCharacterRole,
    getCharacterScenes,
    groupScenesByStoryDay,
    aggressiveDeduplicate,
    deduplicateAllCharacters
};
