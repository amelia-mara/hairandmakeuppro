/**
 * master-context-utils.js
 * Utility functions for accessing the master context data
 *
 * The masterContext is the PRIMARY SOURCE for all character and story data.
 * It's created once during script import and stored in:
 * - window.masterContext
 * - localStorage.getItem('masterContext')
 *
 * This module provides easy access to all the rich data extracted from the script.
 */

import { state } from './main.js';

// ============================================================================
// MASTER CONTEXT ACCESS
// ============================================================================

/**
 * Get the master context (loads from localStorage if not in memory)
 * @returns {Object|null} Master context object or null if not available
 */
export function getMasterContext() {
    if (window.masterContext) {
        return window.masterContext;
    }

    // Try to load from localStorage
    const stored = localStorage.getItem('masterContext');
    if (stored) {
        try {
            window.masterContext = JSON.parse(stored);
            return window.masterContext;
        } catch (error) {
            console.error('Failed to parse stored masterContext:', error);
            return null;
        }
    }

    return null;
}

/**
 * Check if master context is available
 * @returns {boolean} True if master context exists
 */
export function hasMasterContext() {
    return getMasterContext() !== null;
}

/**
 * Save master context to localStorage
 * @param {Object} context - Master context object to save
 */
export function saveMasterContext(context) {
    try {
        window.masterContext = context;
        localStorage.setItem('masterContext', JSON.stringify(context));
        console.log('✅ Master context saved to localStorage');
        return true;
    } catch (error) {
        console.error('❌ Failed to save master context:', error);
        return false;
    }
}

/**
 * Clear master context
 */
export function clearMasterContext() {
    window.masterContext = null;
    localStorage.removeItem('masterContext');
    console.log('🗑️ Master context cleared');
}

// ============================================================================
// CHARACTER DATA ACCESS
// ============================================================================

/**
 * Get character profile from master context
 * @param {string} characterName - Character name (exact match)
 * @returns {Object|null} Character profile or null
 */
export function getCharacterProfile(characterName) {
    const context = getMasterContext();
    if (!context || !context.characters) return null;

    return context.characters[characterName] || null;
}

/**
 * Get all character names from master context
 * @returns {Array<string>} Array of character names
 */
export function getAllCharacterNames() {
    const context = getMasterContext();
    if (!context || !context.characters) return [];

    return Object.keys(context.characters);
}

/**
 * Get character's script descriptions (exact quotes from script)
 * @param {string} characterName - Character name
 * @returns {Array<Object>} Array of script description objects
 */
export function getCharacterScriptDescriptions(characterName) {
    const profile = getCharacterProfile(characterName);
    if (!profile) return [];

    return profile.scriptDescriptions || [];
}

/**
 * Get character's physical profile
 * @param {string} characterName - Character name
 * @returns {Object} Physical profile (age, gender, build, hair, etc.)
 */
export function getCharacterPhysicalProfile(characterName) {
    const profile = getCharacterProfile(characterName);
    if (!profile) return {};

    return profile.physicalProfile || {};
}

/**
 * Get character's visual profile (styling, grooming, makeup notes)
 * @param {string} characterName - Character name
 * @returns {Object} Visual profile
 */
export function getCharacterVisualProfile(characterName) {
    const profile = getCharacterProfile(characterName);
    if (!profile) return {};

    return profile.visualProfile || {};
}

/**
 * Get character's continuity notes
 * @param {string} characterName - Character name
 * @returns {Object} Continuity notes (key looks, transformations, signature items)
 */
export function getCharacterContinuityNotes(characterName) {
    const profile = getCharacterProfile(characterName);
    if (!profile) return {};

    return profile.continuityNotes || {};
}

/**
 * Get character analysis (personality, arc, role)
 * @param {string} characterName - Character name
 * @returns {Object} Character analysis
 */
export function getCharacterAnalysis(characterName) {
    const profile = getCharacterProfile(characterName);
    if (!profile) return {};

    return profile.characterAnalysis || {};
}

/**
 * Get scenes where character appears
 * @param {string} characterName - Character name
 * @returns {Array<number>} Array of scene numbers
 */
export function getCharacterScenes(characterName) {
    const profile = getCharacterProfile(characterName);
    if (!profile) return [];

    return profile.scenesPresent || [];
}

/**
 * Get character's first and last appearance
 * @param {string} characterName - Character name
 * @returns {Object} {first, last, sceneCount}
 */
export function getCharacterAppearanceRange(characterName) {
    const profile = getCharacterProfile(characterName);
    if (!profile) return { first: 0, last: 0, sceneCount: 0 };

    return {
        first: profile.firstAppearance || 0,
        last: profile.lastAppearance || 0,
        sceneCount: profile.sceneCount || 0
    };
}

// ============================================================================
// STORY STRUCTURE ACCESS
// ============================================================================

/**
 * Get story timeline (days, scenes per day, time jumps)
 * @returns {Object} Story structure
 */
export function getStoryStructure() {
    const context = getMasterContext();
    if (!context) return null;

    return context.storyStructure || null;
}

/**
 * Get story day for a scene
 * @param {number} sceneNumber - Scene number (1-indexed)
 * @returns {string|null} Story day label (e.g., "Day 1", "Day 2")
 */
export function getSceneStoryDay(sceneNumber) {
    const structure = getStoryStructure();
    if (!structure || !structure.timeline) return null;

    for (const dayData of structure.timeline) {
        if (dayData.scenes && dayData.scenes.includes(sceneNumber)) {
            return dayData.day;
        }
    }

    return null;
}

/**
 * Get all scenes for a story day
 * @param {string} dayLabel - Day label (e.g., "Day 1")
 * @returns {Array<number>} Array of scene numbers
 */
export function getScenesForDay(dayLabel) {
    const structure = getStoryStructure();
    if (!structure || !structure.timeline) return [];

    const dayData = structure.timeline.find(d => d.day === dayLabel);
    return dayData ? dayData.scenes || [] : [];
}

/**
 * Get flashback scenes
 * @returns {Array<number>} Array of scene numbers that are flashbacks
 */
export function getFlashbackScenes() {
    const structure = getStoryStructure();
    if (!structure) return [];

    return structure.flashbacks || [];
}

/**
 * Get time jumps
 * @returns {Array<Object>} Array of time jump objects
 */
export function getTimeJumps() {
    const structure = getStoryStructure();
    if (!structure) return [];

    return structure.timeJumps || [];
}

// ============================================================================
// SCENE CONTEXT ACCESS
// ============================================================================

/**
 * Get environment data for a scene
 * @param {number} sceneNumber - Scene number (1-indexed)
 * @returns {Object|null} Environment data (location, conditions, impact on appearance)
 */
export function getSceneEnvironment(sceneNumber) {
    const context = getMasterContext();
    if (!context || !context.environments) return null;

    const key = `scene_${sceneNumber}`;
    return context.environments[key] || null;
}

/**
 * Get physical interactions in a scene
 * @param {number} sceneNumber - Scene number (1-indexed)
 * @returns {Object|null} Interaction data (type, characters, impact)
 */
export function getSceneInteractions(sceneNumber) {
    const context = getMasterContext();
    if (!context || !context.interactions) return null;

    const key = `scene_${sceneNumber}`;
    return context.interactions[key] || null;
}

/**
 * Get emotional beats in a scene
 * @param {number} sceneNumber - Scene number (1-indexed)
 * @returns {Object|null} Emotional beat data (character, emotion, visual impact)
 */
export function getSceneEmotionalBeats(sceneNumber) {
    const context = getMasterContext();
    if (!context || !context.emotionalBeats) return null;

    const key = `scene_${sceneNumber}`;
    return context.emotionalBeats[key] || null;
}

/**
 * Get dialogue references to appearance in a scene
 * @param {number} sceneNumber - Scene number (1-indexed)
 * @returns {Object|null} Dialogue reference (line, character, speaker, implication)
 */
export function getSceneDialogueReferences(sceneNumber) {
    const context = getMasterContext();
    if (!context || !context.dialogueReferences) return null;

    const key = `scene_${sceneNumber}`;
    return context.dialogueReferences[key] || null;
}

/**
 * Get all context data for a scene (one-stop shop)
 * @param {number} sceneNumber - Scene number (1-indexed)
 * @returns {Object} Combined scene context
 */
export function getSceneContext(sceneNumber) {
    return {
        sceneNumber: sceneNumber,
        storyDay: getSceneStoryDay(sceneNumber),
        environment: getSceneEnvironment(sceneNumber),
        interactions: getSceneInteractions(sceneNumber),
        emotionalBeats: getSceneEmotionalBeats(sceneNumber),
        dialogueReferences: getSceneDialogueReferences(sceneNumber),
        isFlashback: getFlashbackScenes().includes(sceneNumber)
    };
}

// ============================================================================
// CONTINUITY EVENT ACCESS
// ============================================================================

/**
 * Get all major continuity events
 * @returns {Array<Object>} Array of major event objects
 */
export function getMajorEvents() {
    const context = getMasterContext();
    if (!context) return [];

    return context.majorEvents || [];
}

/**
 * Get continuity events affecting a specific character
 * @param {string} characterName - Character name
 * @returns {Array<Object>} Array of events affecting this character
 */
export function getCharacterContinuityEvents(characterName) {
    const events = getMajorEvents();
    return events.filter(event =>
        event.charactersAffected && event.charactersAffected.includes(characterName)
    );
}

/**
 * Get continuity events in a specific scene
 * @param {number} sceneNumber - Scene number (1-indexed)
 * @returns {Array<Object>} Array of events in this scene
 */
export function getContinuityEventsInScene(sceneNumber) {
    const events = getMajorEvents();
    return events.filter(event => event.scene === sceneNumber);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Search for character by partial name (case-insensitive)
 * @param {string} partialName - Partial character name
 * @returns {Array<string>} Array of matching character names
 */
export function searchCharacters(partialName) {
    const allNames = getAllCharacterNames();
    const searchTerm = partialName.toLowerCase();

    return allNames.filter(name =>
        name.toLowerCase().includes(searchTerm)
    );
}

/**
 * Get master context statistics
 * @returns {Object} Statistics about the master context
 */
export function getMasterContextStats() {
    const context = getMasterContext();
    if (!context) {
        return {
            exists: false,
            title: null,
            totalScenes: 0,
            characterCount: 0,
            storyDays: 0,
            majorEvents: 0
        };
    }

    return {
        exists: true,
        title: context.title || 'Untitled',
        totalScenes: context.totalScenes || 0,
        characterCount: Object.keys(context.characters || {}).length,
        storyDays: context.storyStructure?.totalDays || 0,
        majorEvents: (context.majorEvents || []).length,
        environments: Object.keys(context.environments || {}).length,
        interactions: Object.keys(context.interactions || {}).length,
        emotionalBeats: Object.keys(context.emotionalBeats || {}).length,
        dialogueReferences: Object.keys(context.dialogueReferences || {}).length,
        createdAt: context.createdAt || null,
        version: context.analysisVersion || '1.0'
    };
}

/**
 * Log master context summary to console
 */
export function logMasterContextSummary() {
    const stats = getMasterContextStats();

    if (!stats.exists) {
        console.log('❌ No master context available');
        return;
    }

    console.log('📊 MASTER CONTEXT SUMMARY');
    console.log('========================');
    console.log(`Title: ${stats.title}`);
    console.log(`Total Scenes: ${stats.totalScenes}`);
    console.log(`Characters: ${stats.characterCount}`);
    console.log(`Story Days: ${stats.storyDays}`);
    console.log(`Major Events: ${stats.majorEvents}`);
    console.log(`Environments: ${stats.environments}`);
    console.log(`Interactions: ${stats.interactions}`);
    console.log(`Emotional Beats: ${stats.emotionalBeats}`);
    console.log(`Dialogue References: ${stats.dialogueReferences}`);
    console.log(`Version: ${stats.version}`);
    console.log(`Created: ${stats.createdAt}`);
}

// ============================================================================
// EXPORT FUNCTIONS TO WINDOW FOR GLOBAL ACCESS
// ============================================================================

// Make key functions available globally
window.getMasterContext = getMasterContext;
window.getCharacterProfile = getCharacterProfile;
window.getAllCharacterNames = getAllCharacterNames;
window.getSceneContext = getSceneContext;
window.getMasterContextStats = getMasterContextStats;
window.logMasterContextSummary = logMasterContextSummary;
