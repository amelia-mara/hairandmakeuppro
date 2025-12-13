/**
 * scene-panel.js
 * Scene-specific breakdown functionality
 *
 * Responsibilities:
 * - Handle scene metadata updates (day, time, location)
 * - Scene navigation (previous/next)
 * - Scene detail rendering
 * - Update scene properties
 */

import { state, updateSceneMetadata as mainUpdateSceneMetadata, navigateToScene } from './main.js';

/**
 * Update scene metadata
 * Wrapper function that delegates to main.js
 * @param {number} sceneIndex - Scene index
 * @param {string} field - Field name to update
 * @param {*} value - New value
 */
export function updateSceneMetadata(sceneIndex, field, value) {
    mainUpdateSceneMetadata(sceneIndex, field, value);
}

/**
 * Render scene details
 * Shows scene heading, metadata, and breakdown summary
 * @param {number} sceneIndex - Scene index to render
 * @returns {string} HTML for scene details
 */
export function renderSceneDetails(sceneIndex) {
    if (sceneIndex < 0 || sceneIndex >= state.scenes.length) {
        return '<div class="empty-state">Invalid scene index</div>';
    }

    const scene = state.scenes[sceneIndex];
    const breakdown = state.sceneBreakdowns[sceneIndex] || {};

    return `
        <div class="scene-details">
            <div class="scene-details-header">
                <div class="scene-number-large">Scene ${scene.number}</div>
                <div class="scene-heading-large">${escapeHtml(scene.heading)}</div>
            </div>

            <div class="scene-details-metadata">
                ${scene.storyDay ? `<div class="metadata-item">${escapeHtml(scene.storyDay)}</div>` : ''}
                ${scene.timeOfDay ? `<div class="metadata-item">${escapeHtml(scene.timeOfDay)}</div>` : ''}
                ${scene.intExt ? `<div class="metadata-item">${escapeHtml(scene.intExt)}</div>` : ''}
                ${scene.location ? `<div class="metadata-item">${escapeHtml(scene.location)}</div>` : ''}
            </div>

            ${scene.synopsis ? `
                <div class="scene-details-synopsis">
                    <div class="synopsis-label">Synopsis:</div>
                    <div class="synopsis-text">${escapeHtml(scene.synopsis)}</div>
                </div>
            ` : ''}

            <div class="scene-details-breakdown">
                ${breakdown.cast && breakdown.cast.length > 0 ? `
                    <div class="breakdown-summary-item">
                        <div class="summary-label">Cast Members:</div>
                        <div class="summary-value">${breakdown.cast.length}</div>
                    </div>
                ` : ''}

                ${Object.keys(breakdown).filter(k => k !== 'cast' && breakdown[k]?.length > 0).length > 0 ? `
                    <div class="breakdown-summary-item">
                        <div class="summary-label">Elements:</div>
                        <div class="summary-value">${Object.keys(breakdown).filter(k => k !== 'cast' && breakdown[k]?.length > 0).length}</div>
                    </div>
                ` : ''}
            </div>

            <div class="scene-details-actions">
                <button class="btn-secondary" onclick="navigateToScene(${sceneIndex})">
                    View Scene Breakdown
                </button>
            </div>
        </div>
    `;
}

/**
 * Navigate to previous scene
 */
export function navigateToPrevious() {
    if (state.currentScene === null || state.currentScene <= 0) return;
    navigateToScene(state.currentScene - 1);
}

/**
 * Navigate to next scene
 */
export function navigateToNext() {
    if (state.currentScene === null || state.currentScene >= state.scenes.length - 1) return;
    navigateToScene(state.currentScene + 1);
}

/**
 * Jump to specific scene by number
 * @param {number} sceneNumber - Scene number (1-based)
 */
export function jumpToSceneNumber(sceneNumber) {
    const sceneIndex = state.scenes.findIndex(s => s.number === sceneNumber);
    if (sceneIndex >= 0) {
        navigateToScene(sceneIndex);
    }
}

/**
 * Get scene by index
 * @param {number} sceneIndex - Scene index
 * @returns {Object|null} Scene object or null
 */
export function getScene(sceneIndex) {
    if (sceneIndex < 0 || sceneIndex >= state.scenes.length) return null;
    return state.scenes[sceneIndex];
}

/**
 * Get scene breakdown by index
 * @param {number} sceneIndex - Scene index
 * @returns {Object} Breakdown object
 */
export function getSceneBreakdown(sceneIndex) {
    return state.sceneBreakdowns[sceneIndex] || {};
}

/**
 * Check if scene has any elements
 * @param {number} sceneIndex - Scene index
 * @returns {boolean} True if scene has elements
 */
export function sceneHasElements(sceneIndex) {
    const breakdown = state.sceneBreakdowns[sceneIndex];
    if (!breakdown) return false;

    return Object.keys(breakdown).some(key => {
        const value = breakdown[key];
        return Array.isArray(value) && value.length > 0;
    });
}

/**
 * Get cast members in scene
 * @param {number} sceneIndex - Scene index
 * @returns {Array} Array of cast member names
 */
export function getSceneCast(sceneIndex) {
    const breakdown = state.sceneBreakdowns[sceneIndex];
    return breakdown?.cast || [];
}

/**
 * Check if character appears in scene
 * @param {number} sceneIndex - Scene index
 * @param {string} character - Character name
 * @returns {boolean} True if character appears in scene
 */
export function characterInScene(sceneIndex, character) {
    const cast = getSceneCast(sceneIndex);
    return cast.includes(character);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.updateSceneMetadata = updateSceneMetadata;
window.navigateToPrevious = navigateToPrevious;
window.navigateToNext = navigateToNext;
window.jumpToSceneNumber = jumpToSceneNumber;
