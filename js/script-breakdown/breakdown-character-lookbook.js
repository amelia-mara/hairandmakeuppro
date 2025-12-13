/**
 * breakdown-character-lookbook.js
 * Character lookbook with distinct look management
 *
 * Responsibilities:
 * - Auto-generate distinct looks from breakdown data
 * - Compress scene ranges (1-5, 7-8 format)
 * - Render "By Look" view (default) - groups scenes by distinct look
 * - Render "By Day" view (secondary)
 * - Compact cards with expand/collapse
 * - Continuity event overlays on look cards
 */

import { getState, escapeHtml, showToast } from './breakdown-character-utils.js';

// Track which look cards are expanded
const expandedLookCards = new Set();

// Track current view mode
let currentViewMode = 'by-look'; // 'by-look' or 'by-day'

/**
 * Generate a unique key for a look based on hair, makeup, wardrobe
 * @param {Object} charState - Character state object
 * @returns {string} Unique look key
 */
function generateLookKey(charState) {
    const hair = (charState?.hair || charState?.enterHair || '').trim().toLowerCase();
    const makeup = (charState?.makeup || charState?.enterMakeup || '').trim().toLowerCase();
    const wardrobe = (charState?.wardrobe || charState?.enterWardrobe || '').trim().toLowerCase();

    // If all empty, return empty key
    if (!hair && !makeup && !wardrobe) return '';

    return `${hair}||${makeup}||${wardrobe}`;
}

/**
 * Compress an array of scene numbers into ranges
 * e.g., [1, 2, 3, 4, 5, 7, 8] -> "1-5, 7-8"
 * @param {Array<number>} scenes - Array of scene numbers
 * @returns {string} Compressed scene range string
 */
export function compressSceneRanges(scenes) {
    if (!scenes || scenes.length === 0) return '';

    // Sort scenes numerically
    const sorted = [...scenes].sort((a, b) => a - b);

    const ranges = [];
    let rangeStart = sorted[0];
    let rangeEnd = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === rangeEnd + 1) {
            // Continue the range
            rangeEnd = sorted[i];
        } else {
            // End current range and start new one
            ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
            rangeStart = sorted[i];
            rangeEnd = sorted[i];
        }
    }

    // Add the last range
    ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);

    return ranges.join(', ');
}

/**
 * Generate distinct looks from breakdown data
 * @param {string} characterName - Character name
 * @returns {Array} Array of look objects with scenes, hair, makeup, wardrobe
 */
export function generateLooksFromBreakdown(characterName) {
    const state = getState();
    const lookMap = new Map(); // lookKey -> look object

    // Get all scenes where character appears
    (state?.scenes || []).forEach((scene, sceneIndex) => {
        const breakdown = state.sceneBreakdowns?.[sceneIndex];
        if (!breakdown?.cast?.includes(characterName)) return;

        const charState = state.characterStates?.[sceneIndex]?.[characterName] || {};
        const lookKey = generateLookKey(charState);

        // Skip scenes with no look data defined
        if (!lookKey) {
            // Add to "undefined" look group
            if (!lookMap.has('__undefined__')) {
                lookMap.set('__undefined__', {
                    id: '__undefined__',
                    name: 'Undefined Look',
                    hair: '',
                    makeup: '',
                    wardrobe: '',
                    scenes: [],
                    sceneIndices: [],
                    storyDays: new Set()
                });
            }
            const undefLook = lookMap.get('__undefined__');
            undefLook.scenes.push(scene.number || sceneIndex + 1);
            undefLook.sceneIndices.push(sceneIndex);
            undefLook.storyDays.add(scene.storyDay || 'Unassigned');
            return;
        }

        if (!lookMap.has(lookKey)) {
            // Create new look
            lookMap.set(lookKey, {
                id: lookKey,
                name: '', // Will be auto-generated
                hair: charState.hair || charState.enterHair || '',
                makeup: charState.makeup || charState.enterMakeup || '',
                wardrobe: charState.wardrobe || charState.enterWardrobe || '',
                sfx: charState.sfx || '',
                scenes: [],
                sceneIndices: [],
                storyDays: new Set()
            });
        }

        const look = lookMap.get(lookKey);
        look.scenes.push(scene.number || sceneIndex + 1);
        look.sceneIndices.push(sceneIndex);
        look.storyDays.add(scene.storyDay || 'Unassigned');
    });

    // Convert to array and auto-name looks
    const looks = Array.from(lookMap.values());

    // Name looks based on content or index
    looks.forEach((look, index) => {
        if (look.id === '__undefined__') {
            look.name = 'No Look Defined';
        } else if (look.hair || look.makeup || look.wardrobe) {
            // Generate name from primary elements
            const parts = [];
            if (look.hair) parts.push(truncateLookPart(look.hair));
            if (look.wardrobe) parts.push(truncateLookPart(look.wardrobe));
            look.name = parts.length > 0 ? parts.join(' / ') : `Look ${index + 1}`;
        } else {
            look.name = `Look ${index + 1}`;
        }

        // Convert storyDays Set to sorted array
        look.storyDays = Array.from(look.storyDays).sort((a, b) => {
            if (a === 'Unassigned') return 1;
            if (b === 'Unassigned') return -1;
            const numA = parseInt(a.match(/\d+/)?.[0] || 0);
            const numB = parseInt(b.match(/\d+/)?.[0] || 0);
            return numA - numB;
        });
    });

    // Sort looks: defined looks first (by scene count), undefined last
    looks.sort((a, b) => {
        if (a.id === '__undefined__') return 1;
        if (b.id === '__undefined__') return -1;
        return b.scenes.length - a.scenes.length;
    });

    return looks;
}

/**
 * Truncate a look part for display in name
 * @param {string} text - Text to truncate
 * @returns {string} Truncated text
 */
function truncateLookPart(text) {
    if (!text) return '';
    // Take first meaningful phrase (before comma or semicolon)
    const firstPart = text.split(/[,;]/)[0].trim();
    if (firstPart.length <= 25) return firstPart;
    return firstPart.substring(0, 22) + '...';
}

/**
 * Get continuity events that affect a look's scenes
 * @param {string} characterName - Character name
 * @param {Array<number>} sceneIndices - Scene indices for this look
 * @returns {Array} Relevant continuity events
 */
function getEventsForLook(characterName, sceneIndices) {
    const state = getState();
    const events = state.continuityEvents?.[characterName] || [];

    return events.filter(event => {
        const eventSceneIndex = event.sceneIndex;
        return sceneIndices.includes(eventSceneIndex);
    });
}

/**
 * Render a single look card with editable fields (legacy - for backwards compatibility)
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
                    Apply Forward
                </button>
                <button class="look-action-btn" onclick="alert('Photo attachment feature coming soon')" title="Attach reference photos">
                    Add Photo
                </button>
            </div>
        </div>
    `;
}

/**
 * Render a compact lookbook card (collapsed by default) - NEW design
 * @param {string} characterName - Character name
 * @param {Object} look - Look object
 * @param {number} index - Look index for ID
 * @returns {string} HTML for look card
 */
function renderLookbookCard(characterName, look, index) {
    const cardId = `look-card-${characterName.toLowerCase().replace(/\s+/g, '-')}-${index}`;
    const isExpanded = expandedLookCards.has(cardId);
    const isUndefined = look.id === '__undefined__';

    const sceneRanges = compressSceneRanges(look.scenes);
    const events = getEventsForLook(characterName, look.sceneIndices);

    // Determine if look has content
    const hasContent = look.hair || look.makeup || look.wardrobe || look.sfx;

    return `
        <div class="lookbook-card ${isExpanded ? 'expanded' : 'compact'} ${isUndefined ? 'undefined-look' : ''} ${hasContent ? 'has-content' : ''}"
             id="${cardId}"
             data-look-index="${index}">

            <div class="lookbook-card-header" onclick="toggleLookCard('${cardId}')">
                <div class="lookbook-card-title">
                    <span class="look-expand-icon">${isExpanded ? '▼' : '▶'}</span>
                    <span class="look-name">${escapeHtml(look.name)}</span>
                    <span class="look-scene-count">${look.scenes.length} scene${look.scenes.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="look-scene-ranges">Scenes: ${sceneRanges}</div>
            </div>

            ${isExpanded ? renderExpandedLookContent(characterName, look, events) : ''}

            ${events.length > 0 ? `
                <div class="look-events-indicator" title="${events.length} continuity event${events.length !== 1 ? 's' : ''}">
                    ${events.length} event${events.length !== 1 ? 's' : ''}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render expanded content for a look card
 * @param {string} characterName - Character name
 * @param {Object} look - Look object
 * @param {Array} events - Continuity events for this look
 * @returns {string} HTML for expanded content
 */
function renderExpandedLookContent(characterName, look, events) {
    const isUndefined = look.id === '__undefined__';

    return `
        <div class="lookbook-card-body">
            ${isUndefined ? `
                <div class="look-undefined-message">
                    These scenes have no hair/makeup/wardrobe defined yet.
                    Click a scene to add continuity details.
                </div>
            ` : `
                <div class="look-details-grid">
                    ${look.hair ? `
                        <div class="look-detail-row">
                            <span class="look-detail-label">Hair</span>
                            <span class="look-detail-value">${escapeHtml(look.hair)}</span>
                        </div>
                    ` : ''}
                    ${look.makeup ? `
                        <div class="look-detail-row">
                            <span class="look-detail-label">Makeup</span>
                            <span class="look-detail-value">${escapeHtml(look.makeup)}</span>
                        </div>
                    ` : ''}
                    ${look.wardrobe ? `
                        <div class="look-detail-row">
                            <span class="look-detail-label">Wardrobe</span>
                            <span class="look-detail-value">${escapeHtml(look.wardrobe)}</span>
                        </div>
                    ` : ''}
                    ${look.sfx ? `
                        <div class="look-detail-row">
                            <span class="look-detail-label">SFX</span>
                            <span class="look-detail-value">${escapeHtml(look.sfx)}</span>
                        </div>
                    ` : ''}
                </div>
            `}

            <div class="look-story-days">
                <span class="look-days-label">Story Days:</span>
                ${look.storyDays.map(day => `<span class="look-day-badge">${escapeHtml(day)}</span>`).join('')}
            </div>

            ${events.length > 0 ? `
                <div class="look-events-section">
                    <div class="look-events-header">Continuity Events</div>
                    ${events.map(event => `
                        <div class="look-event-item ${event.category || 'general'}">
                            <span class="look-event-scene">Scene ${event.sceneNumber || '?'}</span>
                            <span class="look-event-desc">${escapeHtml(event.description || event.note || '')}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <div class="look-scene-list">
                <div class="look-scenes-header">Scenes with this look:</div>
                <div class="look-scene-chips">
                    ${look.sceneIndices.map((sceneIndex, i) => `
                        <span class="look-scene-chip" onclick="navigateToScene(${sceneIndex})" title="Go to scene ${look.scenes[i]}">
                            ${look.scenes[i]}
                        </span>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

/**
 * Toggle look card expansion
 * @param {string} cardId - Card element ID
 */
export function toggleLookCard(cardId) {
    if (expandedLookCards.has(cardId)) {
        expandedLookCards.delete(cardId);
    } else {
        expandedLookCards.add(cardId);
    }

    // Re-render the lookbook view
    const card = document.getElementById(cardId);
    if (card) {
        const characterName = getCurrentCharacterFromCard(card);
        if (characterName) {
            const contentId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-content`;
            const contentDiv = document.getElementById(contentId);
            if (contentDiv) {
                contentDiv.innerHTML = renderLookbookView(characterName);
            }
        }
    }
}

/**
 * Get current character name from card context
 * @param {HTMLElement} card - Card element
 * @returns {string|null} Character name
 */
function getCurrentCharacterFromCard(card) {
    const profilePanel = card.closest('.character-profile-panel');
    if (profilePanel) {
        // Extract from panel ID: "character-name-profile-panel"
        const panelId = profilePanel.id;
        const match = panelId.match(/^(.+)-profile-panel$/);
        if (match) {
            // Find matching character from confirmed characters
            const state = getState();
            const nameSlug = match[1];
            const matchingChar = Array.from(state.confirmedCharacters || [])
                .find(c => c.toLowerCase().replace(/\s+/g, '-') === nameSlug);
            return matchingChar;
        }
    }
    return null;
}

/**
 * Render lookbook "By Look" view (default)
 * Groups scenes by distinct looks
 * @param {string} characterName - Character name
 * @returns {string} HTML for lookbook view
 */
export function renderLookbookView(characterName) {
    const state = getState();
    const profile = state.castProfiles?.[characterName] || {};
    const looks = generateLooksFromBreakdown(characterName);

    // Count total scenes
    const totalScenes = looks.reduce((sum, look) => sum + look.scenes.length, 0);

    if (totalScenes === 0) {
        return `
            <div class="lookbook-view">
                <div class="lookbook-header">
                    <h3>Lookbook</h3>
                    <div class="lookbook-view-toggle">
                        <button class="view-toggle-btn ${currentViewMode === 'by-look' ? 'active' : ''}" onclick="switchLookbookView('${escapeHtml(characterName).replace(/'/g, "\\'")}', 'by-look')">By Look</button>
                        <button class="view-toggle-btn ${currentViewMode === 'by-day' ? 'active' : ''}" onclick="switchLookbookView('${escapeHtml(characterName).replace(/'/g, "\\'")}', 'by-day')">By Day</button>
                    </div>
                </div>
                <div class="empty-message">
                    This character doesn't appear in any scenes yet.
                </div>
            </div>
        `;
    }

    // Render based on current view mode
    if (currentViewMode === 'by-day') {
        return renderLookbookByDay(characterName);
    }

    const definedLooks = looks.filter(l => l.id !== '__undefined__');
    const undefinedLook = looks.find(l => l.id === '__undefined__');

    return `
        <div class="lookbook-view">
            <div class="lookbook-header">
                <h3>Lookbook</h3>
                <div class="lookbook-view-toggle">
                    <button class="view-toggle-btn ${currentViewMode === 'by-look' ? 'active' : ''}" onclick="switchLookbookView('${escapeHtml(characterName).replace(/'/g, "\\'")}', 'by-look')">By Look</button>
                    <button class="view-toggle-btn ${currentViewMode === 'by-day' ? 'active' : ''}" onclick="switchLookbookView('${escapeHtml(characterName).replace(/'/g, "\\'")}', 'by-day')">By Day</button>
                </div>
            </div>

            <div class="lookbook-stats">
                <div class="lookbook-stat">
                    <span class="stat-value">${definedLooks.length}</span>
                    <span class="stat-label">Distinct Look${definedLooks.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="lookbook-stat">
                    <span class="stat-value">${totalScenes}</span>
                    <span class="stat-label">Total Scenes</span>
                </div>
                ${undefinedLook ? `
                    <div class="lookbook-stat warning">
                        <span class="stat-value">${undefinedLook.scenes.length}</span>
                        <span class="stat-label">Undefined</span>
                    </div>
                ` : ''}
            </div>

            <div class="lookbook-cards">
                ${definedLooks.map((look, index) => renderLookbookCard(characterName, look, index)).join('')}
                ${undefinedLook ? renderLookbookCard(characterName, undefinedLook, looks.length - 1) : ''}
            </div>
        </div>
    `;
}

/**
 * Render lookbook "By Day" view
 * Organizes looks by story day
 * @param {string} characterName - Character name
 * @returns {string} HTML for by-day view
 */
export function renderLookbookByDay(characterName) {
    const state = getState();
    const dayGroups = {};

    // Get all scenes where character appears, organized by story day
    (state?.scenes || []).forEach((scene, sceneIndex) => {
        const breakdown = state.sceneBreakdowns?.[sceneIndex];
        if (!breakdown?.cast?.includes(characterName)) return;

        const storyDay = scene.storyDay || 'Unassigned';
        const charState = state.characterStates?.[sceneIndex]?.[characterName] || {};

        if (!dayGroups[storyDay]) {
            dayGroups[storyDay] = [];
        }

        dayGroups[storyDay].push({
            sceneIndex,
            sceneNumber: scene.number || sceneIndex + 1,
            heading: scene.heading,
            hair: charState.hair || charState.enterHair || '',
            makeup: charState.makeup || charState.enterMakeup || '',
            wardrobe: charState.wardrobe || charState.enterWardrobe || '',
            sfx: charState.sfx || ''
        });
    });

    // Sort days
    const sortedDays = Object.keys(dayGroups).sort((a, b) => {
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;
        const numA = parseInt(a.match(/\d+/)?.[0] || 0);
        const numB = parseInt(b.match(/\d+/)?.[0] || 0);
        return numA - numB;
    });

    return `
        <div class="lookbook-view">
            <div class="lookbook-header">
                <h3>Lookbook</h3>
                <div class="lookbook-view-toggle">
                    <button class="view-toggle-btn ${currentViewMode === 'by-look' ? 'active' : ''}" onclick="switchLookbookView('${escapeHtml(characterName).replace(/'/g, "\\'")}', 'by-look')">By Look</button>
                    <button class="view-toggle-btn ${currentViewMode === 'by-day' ? 'active' : ''}" onclick="switchLookbookView('${escapeHtml(characterName).replace(/'/g, "\\'")}', 'by-day')">By Day</button>
                </div>
            </div>

            <div class="lookbook-by-day">
                ${sortedDays.map(day => {
                    const scenes = dayGroups[day];
                    const dayId = day.toLowerCase().replace(/\s+/g, '-');

                    return `
                        <div class="story-day-section" id="lookbook-day-${dayId}">
                            <div class="day-section-header" onclick="toggleDaySection('${dayId}')">
                                <span class="expand-icon">▼</span>
                                <h4 class="day-section-title">${escapeHtml(day)}</h4>
                                <span class="day-scene-count">${scenes.length} scene${scenes.length !== 1 ? 's' : ''}</span>
                            </div>

                            <div class="day-looks expanded" id="day-looks-${dayId}">
                                ${scenes.map(scene => renderDaySceneCard(characterName, scene)).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

/**
 * Render a scene card for "By Day" view
 * @param {string} characterName - Character name
 * @param {Object} scene - Scene data
 * @returns {string} HTML for scene card
 */
function renderDaySceneCard(characterName, scene) {
    const hasContent = scene.hair || scene.makeup || scene.wardrobe || scene.sfx;

    return `
        <div class="day-scene-card ${hasContent ? 'has-content' : ''}" onclick="navigateToScene(${scene.sceneIndex})">
            <div class="day-scene-header">
                <span class="day-scene-number">Scene ${scene.sceneNumber}</span>
                <span class="day-scene-heading">${escapeHtml(truncateText(scene.heading, 40))}</span>
            </div>
            ${hasContent ? `
                <div class="day-scene-look">
                    ${scene.hair ? `<div class="day-look-item"><span class="day-look-label">H:</span> ${escapeHtml(truncateText(scene.hair, 30))}</div>` : ''}
                    ${scene.makeup ? `<div class="day-look-item"><span class="day-look-label">M:</span> ${escapeHtml(truncateText(scene.makeup, 30))}</div>` : ''}
                    ${scene.wardrobe ? `<div class="day-look-item"><span class="day-look-label">W:</span> ${escapeHtml(truncateText(scene.wardrobe, 30))}</div>` : ''}
                </div>
            ` : `
                <div class="day-scene-no-look">No look defined</div>
            `}
        </div>
    `;
}

/**
 * Switch lookbook view mode
 * @param {string} characterName - Character name
 * @param {string} mode - View mode ('by-look' or 'by-day')
 */
export function switchLookbookView(characterName, mode) {
    currentViewMode = mode;

    const contentId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-content`;
    const contentDiv = document.getElementById(contentId);
    if (contentDiv) {
        contentDiv.innerHTML = renderLookbookView(characterName);
    }
}

/**
 * Toggle expansion of a story day section
 * @param {string} dayId - Day identifier
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
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Max length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 1) + '...';
}

/**
 * Update character look for a specific scene (legacy support)
 * @param {string} characterName - Character name
 * @param {number} sceneIndex - Scene index
 * @param {string} field - Field to update
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

    showToast('Look updated', 'success');
}

/**
 * Apply a look to multiple scenes
 * @param {string} characterName - Character name
 * @param {Object} look - Look object with hair, makeup, wardrobe
 * @param {Array<number>} targetSceneIndices - Scene indices to apply to
 */
export async function applyLookToScenes(characterName, look, targetSceneIndices) {
    const state = getState();

    targetSceneIndices.forEach(sceneIndex => {
        if (!state.characterStates[sceneIndex]) {
            state.characterStates[sceneIndex] = {};
        }
        if (!state.characterStates[sceneIndex][characterName]) {
            state.characterStates[sceneIndex][characterName] = {};
        }

        if (look.hair) state.characterStates[sceneIndex][characterName].hair = look.hair;
        if (look.makeup) state.characterStates[sceneIndex][characterName].makeup = look.makeup;
        if (look.wardrobe) state.characterStates[sceneIndex][characterName].wardrobe = look.wardrobe;
        if (look.sfx) state.characterStates[sceneIndex][characterName].sfx = look.sfx;
    });

    // Save project
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    showToast(`Applied look to ${targetSceneIndices.length} scene(s)`, 'success');
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

// Legacy function for backwards compatibility
export function getCharacterLooksByDay(characterName) {
    const state = getState();
    const dayGroups = {};

    (state?.scenes || []).forEach((scene, sceneIndex) => {
        const breakdown = state.sceneBreakdowns?.[sceneIndex];
        if (!breakdown?.cast?.includes(characterName)) return;

        const storyDay = scene.storyDay || 'Unassigned';
        const charState = state.characterStates?.[sceneIndex]?.[characterName] || {};

        if (!dayGroups[storyDay]) {
            dayGroups[storyDay] = [];
        }

        dayGroups[storyDay].push({
            sceneIndex,
            sceneNumber: scene.number,
            heading: scene.heading,
            storyDay,
            hair: charState.hair || '',
            makeup: charState.makeup || '',
            sfx: charState.sfx || '',
            wardrobe: charState.wardrobe || '',
            notes: charState.notes || ''
        });
    });

    return dayGroups;
}

// Expose global functions for HTML onclick handlers
window.toggleLookCard = toggleLookCard;
window.toggleDaySection = toggleDaySection;
window.switchLookbookView = switchLookbookView;
window.updateCharacterLook = updateCharacterLook;
window.applyLookToScenes = applyLookToScenes;
window.applyLookForward = applyLookForward;

export default {
    generateLooksFromBreakdown,
    compressSceneRanges,
    renderLookCard,
    renderLookbookView,
    renderLookbookByDay,
    toggleLookCard,
    toggleDaySection,
    switchLookbookView,
    updateCharacterLook,
    applyLookToScenes,
    applyLookForward,
    getCharacterLooksByDay
};
