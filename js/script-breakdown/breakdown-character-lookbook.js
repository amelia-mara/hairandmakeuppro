/**
 * breakdown-character-lookbook.js
 * Character lookbook and look state management
 *
 * Responsibilities:
 * - Render lookbook view with expandable story day sections
 * - Render individual look cards with editable fields
 * - Handle look updates and forward application
 * - Manage character looks by story day
 */

import { getState, escapeHtml, showToast } from './breakdown-character-utils.js';

/**
 * Get character looks organized by story day
 * @param {string} characterName - Character name
 * @returns {Object} Object mapping story days to arrays of look objects
 */
export function getCharacterLooksByDay(characterName) {
    const state = getState();
    const dayGroups = {};

    // Get all scenes where character appears
    (state?.scenes || []).forEach((scene, sceneIndex) => {
        const breakdown = state.sceneBreakdowns[sceneIndex];
        if (!breakdown || !breakdown.cast || !breakdown.cast.includes(characterName)) {
            return;
        }

        const storyDay = scene.storyDay || 'Unassigned';
        const charState = state.characterStates?.[sceneIndex]?.[characterName] || {};

        // Initialize day group if needed
        if (!dayGroups[storyDay]) {
            dayGroups[storyDay] = [];
        }

        // Create look object from scene data
        const look = {
            sceneIndex: sceneIndex,
            sceneNumber: scene.number,
            heading: scene.heading,
            storyDay: storyDay,
            hair: charState.hair || '',
            makeup: charState.makeup || '',
            sfx: charState.sfx || '',
            wardrobe: charState.wardrobe || '',
            notes: charState.notes || ''
        };

        dayGroups[storyDay].push(look);
    });

    return dayGroups;
}

/**
 * Render a single look card with editable fields
 * @param {string} characterName - Character name
 * @param {Object} look - Look object with scene and appearance data
 * @returns {string} HTML for look card
 */
export function renderLookCard(characterName, look) {
    const hasContent = look.hair || look.makeup || look.sfx || look.wardrobe || look.notes;

    return `
        <div class="look-card ${hasContent ? 'has-content' : ''}" data-scene="${look.sceneIndex}">
            <div class="look-card-header" onclick="navigateToScene(${look.sceneIndex})">
                <span class="look-scene-badge">Scene ${look.sceneNumber}</span>
                <span class="look-scene-heading">${escapeHtml(look.heading.substring(0, 50))}${look.heading.length > 50 ? '...' : ''}</span>
            </div>

            <div class="look-details">
                <div class="look-field">
                    <label>Hair:</label>
                    <input type="text"
                           value="${escapeHtml(look.hair)}"
                           placeholder="Hair description..."
                           onchange="updateCharacterLook('${escapeHtml(characterName).replace(/'/g, "\\'")}', ${look.sceneIndex}, 'hair', this.value)">
                </div>

                <div class="look-field">
                    <label>Makeup:</label>
                    <input type="text"
                           value="${escapeHtml(look.makeup)}"
                           placeholder="Makeup description..."
                           onchange="updateCharacterLook('${escapeHtml(characterName).replace(/'/g, "\\'")}', ${look.sceneIndex}, 'makeup', this.value)">
                </div>

                <div class="look-field">
                    <label>SFX:</label>
                    <input type="text"
                           value="${escapeHtml(look.sfx)}"
                           placeholder="SFX/prosthetics..."
                           onchange="updateCharacterLook('${escapeHtml(characterName).replace(/'/g, "\\'")}', ${look.sceneIndex}, 'sfx', this.value)">
                </div>

                <div class="look-field">
                    <label>Wardrobe:</label>
                    <input type="text"
                           value="${escapeHtml(look.wardrobe)}"
                           placeholder="Wardrobe description..."
                           onchange="updateCharacterLook('${escapeHtml(characterName).replace(/'/g, "\\'")}', ${look.sceneIndex}, 'wardrobe', this.value)">
                </div>

                <div class="look-field look-field-notes">
                    <label>Notes:</label>
                    <textarea
                        placeholder="Additional continuity notes..."
                        onchange="updateCharacterLook('${escapeHtml(characterName).replace(/'/g, "\\'")}', ${look.sceneIndex}, 'notes', this.value)">${escapeHtml(look.notes)}</textarea>
                </div>
            </div>

            <div class="look-actions">
                <button class="look-action-btn" onclick="applyLookForward('${escapeHtml(characterName).replace(/'/g, "\\'")}', ${look.sceneIndex})" title="Copy this look to all following scenes in this day">
                    Apply Forward →
                </button>
                <button class="look-action-btn" onclick="alert('Photo attachment feature coming soon')" title="Attach reference photos">
                    Add Photo
                </button>
            </div>
        </div>
    `;
}

/**
 * Render lookbook view with expandable story day sections
 * @param {string} characterName - Character name
 * @returns {string} HTML for lookbook view
 */
export function renderLookbookView(characterName) {
    const state = getState();
    const profile = state.castProfiles?.[characterName] || {};
    const dayGroups = getCharacterLooksByDay(characterName);

    // Sort days (natural sort for "Day 1", "Day 2", etc.)
    const sortedDays = Object.keys(dayGroups).sort((a, b) => {
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;

        const numA = parseInt(a.match(/\d+/)?.[0] || 0);
        const numB = parseInt(b.match(/\d+/)?.[0] || 0);
        return numA - numB;
    });

    if (sortedDays.length === 0) {
        return `
            <div class="lookbook-view">
                <div class="view-section">
                    <h3>Base Description</h3>
                    <p>${escapeHtml(profile.baseDescription || 'No base description yet')}</p>
                </div>
                <div class="empty-message">
                    This character doesn't appear in any scenes yet.
                </div>
            </div>
        `;
    }

    return `
        <div class="lookbook-view">
            <div class="view-section">
                <h3>Base Description</h3>
                <div class="base-description-field">
                    <textarea
                        class="base-description-input"
                        placeholder="Enter base character description (age, build, general appearance, etc.)..."
                        onchange="updateQuickBaseDescription('${escapeHtml(characterName).replace(/'/g, "\\'")}', this.value)">${escapeHtml(profile.baseDescription || '')}</textarea>
                </div>
            </div>

            <div class="lookbook-container">
                ${sortedDays.map(day => {
                    const looks = dayGroups[day];
                    const dayId = day.toLowerCase().replace(/\s+/g, '-');

                    return `
                        <div class="story-day-section" id="lookbook-day-${dayId}">
                            <div class="day-section-header" onclick="toggleDaySection('${dayId}')">
                                <span class="expand-icon">▼</span>
                                <h3 class="day-section-title">${escapeHtml(day)}</h3>
                                <span class="day-scene-count">${looks.length} scene${looks.length !== 1 ? 's' : ''}</span>
                            </div>

                            <div class="day-looks expanded" id="day-looks-${dayId}">
                                ${looks.map(look => renderLookCard(characterName, look)).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

/**
 * Toggle expansion of a story day section
 * @param {string} dayId - Day identifier (e.g., 'day-1', 'unassigned')
 */
export function toggleDaySection(dayId) {
    const dayLooks = document.getElementById(`day-looks-${dayId}`);
    const section = document.getElementById(`lookbook-day-${dayId}`);

    if (!dayLooks || !section) return;

    const expandIcon = section.querySelector('.expand-icon');

    if (dayLooks.classList.contains('expanded')) {
        dayLooks.classList.remove('expanded');
        dayLooks.classList.add('collapsed');
        if (expandIcon) expandIcon.textContent = '▶';
    } else {
        dayLooks.classList.remove('collapsed');
        dayLooks.classList.add('expanded');
        if (expandIcon) expandIcon.textContent = '▼';
    }
}

/**
 * Update character look for a specific scene
 * @param {string} characterName - Character name
 * @param {number} sceneIndex - Scene index
 * @param {string} field - Field to update (hair, makeup, sfx, wardrobe, notes)
 * @param {string} value - New value
 */
export async function updateCharacterLook(characterName, sceneIndex, field, value) {
    const state = getState();

    // Initialize structures if needed
    if (!state.characterStates[sceneIndex]) {
        state.characterStates[sceneIndex] = {};
    }
    if (!state.characterStates[sceneIndex][characterName]) {
        state.characterStates[sceneIndex][characterName] = {};
    }

    // Update the field
    state.characterStates[sceneIndex][characterName][field] = value;

    // Save project
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Update visual indicator on the card
    const card = document.querySelector(`.look-card[data-scene="${sceneIndex}"]`);
    if (card) {
        const hasContent = Object.values(state.characterStates[sceneIndex][characterName])
            .some(val => val && val.trim() !== '');
        if (hasContent) {
            card.classList.add('has-content');
        } else {
            card.classList.remove('has-content');
        }
    }
}

/**
 * Apply current look forward to all following scenes in the same day
 * @param {string} characterName - Character name
 * @param {number} sourceSceneIndex - Scene index to copy from
 */
export async function applyLookForward(characterName, sourceSceneIndex) {
    const state = getState();
    const sourceScene = state.scenes[sourceSceneIndex];
    if (!sourceScene) return;

    const sourceState = state.characterStates?.[sourceSceneIndex]?.[characterName];
    if (!sourceState || Object.keys(sourceState).length === 0) {
        showToast('No look data to copy from this scene', 'warning');
        return;
    }

    const storyDay = sourceScene.storyDay || 'Unassigned';

    // Find all following scenes in the same story day where character appears
    let updatedCount = 0;

    (state.scenes || []).forEach((scene, sceneIndex) => {
        if (sceneIndex <= sourceSceneIndex) return;
        if ((scene.storyDay || 'Unassigned') !== storyDay) return;

        const breakdown = state.sceneBreakdowns?.[sceneIndex];
        if (!breakdown || !breakdown.cast || !breakdown.cast.includes(characterName)) return;

        // Initialize structures if needed
        if (!state.characterStates[sceneIndex]) {
            state.characterStates[sceneIndex] = {};
        }
        if (!state.characterStates[sceneIndex][characterName]) {
            state.characterStates[sceneIndex][characterName] = {};
        }

        // Copy all look fields
        ['hair', 'makeup', 'sfx', 'wardrobe'].forEach(field => {
            if (sourceState[field]) {
                state.characterStates[sceneIndex][characterName][field] = sourceState[field];
            }
        });

        updatedCount++;
    });

    if (updatedCount > 0) {
        // Save project
        const { saveProject } = await import('./export-handlers.js');
        saveProject();

        // Refresh the view
        const contentId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-content`;
        const contentDiv = document.getElementById(contentId);
        if (contentDiv) {
            contentDiv.innerHTML = renderLookbookView(characterName);
        }

        showToast(`Applied look forward to ${updatedCount} scene${updatedCount !== 1 ? 's' : ''} in ${storyDay}`, 'success');
    } else {
        showToast(`No following scenes found in ${storyDay}`, 'info');
    }
}

// Expose global functions for HTML onclick handlers
window.toggleDaySection = toggleDaySection;
window.updateCharacterLook = updateCharacterLook;
window.applyLookForward = applyLookForward;

export default {
    getCharacterLooksByDay,
    renderLookCard,
    renderLookbookView,
    toggleDaySection,
    updateCharacterLook,
    applyLookForward
};
