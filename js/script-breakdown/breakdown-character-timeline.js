/**
 * breakdown-character-timeline.js
 * Character timeline and story day visualization
 *
 * Responsibilities:
 * - Render character timeline with look states
 * - Render story day timeline visualization
 * - Render transition cards between looks
 * - Render continuity scene cards with entering/exiting states
 * - Handle timeline navigation
 */

import { getState, escapeHtml, showToast } from './breakdown-character-utils.js';
import { getCharacterScenes, groupScenesByStoryDay } from './breakdown-character-filtering.js';
import { formatSceneRange, getComplexityIcon } from './utils.js';
import { buildCharacterProfile } from './character-profiles.js';

/**
 * Render story day timeline visualization
 * Shows a horizontal timeline with clickable day segments
 * @param {string} characterName - Character name
 * @returns {string} HTML for story day timeline
 */
export function renderStoryDayTimeline(characterName) {
    const state = getState();
    const characterScenes = getCharacterScenes(characterName);

    if (characterScenes.length === 0) {
        return '';
    }

    const dayGroups = groupScenesByStoryDay(characterScenes);

    // Sort days (natural sort for "Day 1", "Day 2", etc.)
    const sortedDays = Object.keys(dayGroups).sort((a, b) => {
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;

        const numA = parseInt(a.match(/\d+/)?.[0] || 0);
        const numB = parseInt(b.match(/\d+/)?.[0] || 0);
        return numA - numB;
    });

    if (sortedDays.length === 0) {
        return '';
    }

    return `
        <div class="story-day-timeline">
            ${sortedDays.map(day => {
                const scenes = dayGroups[day];
                const sceneNumbers = scenes.map(idx => state.scenes[idx].number);
                const firstScene = Math.min(...sceneNumbers);
                const lastScene = Math.max(...sceneNumbers);
                const sceneRange = firstScene === lastScene ? `Sc ${firstScene}` : `Sc ${firstScene}-${lastScene}`;

                return `
                    <div class="timeline-day" onclick="scrollToStoryDay('${escapeHtml(day).replace(/'/g, "\\'")}', '${escapeHtml(characterName).replace(/'/g, "\\'")}')">
                        <div class="day-label">${escapeHtml(day)}</div>
                        <div class="day-bar" data-scenes="${scenes.length}">
                            <div class="scene-range">${sceneRange}</div>
                            <div class="scene-count">${scenes.length} scene${scenes.length !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Scroll to a specific story day section in the character timeline
 * @param {string} storyDay - Story day label
 * @param {string} characterName - Character name
 */
export function scrollToStoryDay(storyDay, characterName) {
    // Find the story day section in the current view
    const storyDayGroups = document.querySelectorAll('.story-day-group');

    for (const group of storyDayGroups) {
        const dayLabel = group.querySelector('.story-day-label');
        if (dayLabel && dayLabel.textContent.trim() === storyDay) {
            group.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Add highlight effect
            group.style.transition = 'background 0.5s ease';
            group.style.background = 'rgba(212, 175, 122, 0.15)';
            setTimeout(() => {
                group.style.background = '';
            }, 1500);

            break;
        }
    }
}

/**
 * Find transition between two looks
 * @param {string} character - Character name
 * @param {string} fromLookId - Source look ID
 * @param {string} toLookId - Target look ID
 * @returns {Object|undefined} Transition object if found
 */
function findTransition(character, fromLookId, toLookId) {
    const state = getState();
    return (state.lookTransitions || []).find(t =>
        t.character === character &&
        t.fromLookId === fromLookId &&
        t.toLookId === toLookId
    );
}

/**
 * Render transition card
 * @param {Object} transition - Transition object
 * @param {string} character - Character name
 * @returns {string} HTML for transition card
 */
function renderTransitionCard(transition, character) {
    return `
        <div class="transition-card">
            <div class="transition-card-header">
                <span class="transition-icon">⚡</span>
                <span class="transition-scene-label">TRANSITION in Scene ${transition.transitionScene}</span>
            </div>
            <div class="transition-event">${escapeHtml(transition.scriptEvent || 'Transition event not defined')}</div>
            ${transition.scriptQuote ? `
                <div class="transition-quote">
                    <span class="quote-icon">📝</span>
                    "${escapeHtml(transition.scriptQuote)}"
                </div>
            ` : ''}
            <button class="edit-transition-mini-btn" onclick="alert('Edit transition feature coming soon')">
                Edit Transition
            </button>
        </div>
    `;
}

/**
 * Render undefined transition placeholder
 * @param {string} character - Character name
 * @param {string} lookId - Look ID
 * @returns {string} HTML for undefined transition card
 */
function renderUndefinedTransitionCard(character, lookId) {
    return `
        <div class="transition-card undefined">
            <div class="transition-card-header">
                <span class="transition-scene-label">TRANSITION NOT DEFINED</span>
            </div>
            <button class="edit-transition-mini-btn" onclick="alert('Define transition feature coming soon')">
                Define Transition
            </button>
        </div>
    `;
}

/**
 * Render look state card
 * @param {Object} look - Look state object
 * @returns {string} HTML for look state card
 */
function renderLookStateCard(look) {
    const sceneRangeText = formatSceneRange(look.scenes || []);
    const complexityIcon = getComplexityIcon(look.complexity);

    // Build appearance preview
    const appearancePreviews = [];
    if (look.appearance?.hair) {
        const preview = look.appearance.hair.substring(0, 40);
        appearancePreviews.push(`Hair: ${preview}${look.appearance.hair.length > 40 ? '...' : ''}`);
    }
    if (look.appearance?.makeup) {
        const preview = look.appearance.makeup.substring(0, 40);
        appearancePreviews.push(`Makeup: ${preview}${look.appearance.makeup.length > 40 ? '...' : ''}`);
    }
    if (look.appearance?.sfx) {
        const preview = look.appearance.sfx.substring(0, 40);
        appearancePreviews.push(`SFX: ${preview}${look.appearance.sfx.length > 40 ? '...' : ''}`);
    }
    if (look.appearance?.wardrobe) {
        const preview = look.appearance.wardrobe.substring(0, 40);
        appearancePreviews.push(`Wardrobe: ${preview}${look.appearance.wardrobe.length > 40 ? '...' : ''}`);
    }

    return `
        <div class="look-state-timeline-card">
            <div class="look-card-header">
                <div class="look-card-title">
                    <span class="look-name">${escapeHtml(look.lookName || 'Untitled Look')}</span>
                    <span class="complexity-badge">${complexityIcon} ${(look.complexity || 'low').toUpperCase()}</span>
                </div>
            </div>

            <div class="look-card-body">
                <div class="look-info-row">
                    <span class="info-label">Scenes:</span>
                    <span class="info-value">${sceneRangeText} (${(look.scenes || []).length} scenes)</span>
                </div>

                ${look.storyTime ? `
                    <div class="look-info-row">
                        <span class="info-label">Story Time:</span>
                        <span class="info-value">${escapeHtml(look.storyTime)}</span>
                    </div>
                ` : ''}

                ${appearancePreviews.length > 0 ? `
                    <div class="appearance-preview">
                        ${appearancePreviews.map(preview => `
                            <div class="preview-line">${escapeHtml(preview)}</div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>

            <div class="look-card-actions">
                <button class="look-card-btn primary" onclick="alert('Edit look feature coming soon')">
                    Edit Look
                </button>
            </div>
        </div>
    `;
}

/**
 * Find the previous scene index where this character appears
 * @param {number} currentIndex - Current scene index
 * @param {Array} allCharacterScenes - All scenes with this character
 * @returns {number|null} Previous scene index or null
 */
function findPreviousSceneIndex(currentIndex, allCharacterScenes) {
    const currentSceneInList = allCharacterScenes.findIndex(s => s.index === currentIndex);
    if (currentSceneInList > 0) {
        return allCharacterScenes[currentSceneInList - 1].index;
    }
    return null;
}

/**
 * Render a single continuity note with category color coding
 * @param {Object} note - Note object with category and text
 * @param {number} sceneIndex - Scene index
 * @param {string} character - Character name
 * @param {string} phase - Phase ('entering' or 'during')
 * @returns {string} HTML for continuity note
 */
function renderContinuityNote(note, sceneIndex, character, phase) {
    const colors = {
        hair: '#a855f7',
        makeup: '#ec4899',
        sfx: '#ef4444',
        wardrobe: '#34d399',
        health: '#f59e0b',
        injuries: '#dc2626',
        stunts: '#f97316'
    };

    const categoryLabels = {
        hair: 'Hair',
        makeup: 'Makeup',
        sfx: 'SFX',
        wardrobe: 'Wardrobe',
        health: 'Health',
        injuries: 'Injuries',
        stunts: 'Stunts'
    };

    const color = colors[note.category] || '#9ca3af';
    const label = categoryLabels[note.category] || note.category;

    return `
        <div class="continuity-note"
             style="border-left: 3px solid ${color}; background: linear-gradient(90deg, ${color}15, transparent);"
             onclick="openContinuityEditModal(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', '${note.category}')">
            <span class="note-category" style="color: ${color};">${label}:</span>
            <span class="note-text">${escapeHtml(note.text)}</span>
        </div>
    `;
}

/**
 * Render a single scene card with continuity states
 * @param {Object} scene - Scene object
 * @param {number} sceneIndex - Scene index
 * @param {string} character - Character name
 * @param {Array} allCharacterScenes - All scenes with this character
 * @returns {string} HTML for continuity scene card
 */
function renderContinuitySceneCard(scene, sceneIndex, character, allCharacterScenes) {
    const state = getState();

    // Get current scene's character state (DURING/EXITS)
    const currentState = state.characterStates?.[sceneIndex]?.[character] || {};

    // Get previous scene's state (ENTERS - what they looked like at end of previous scene)
    const previousSceneIndex = findPreviousSceneIndex(sceneIndex, allCharacterScenes);
    const enteringState = previousSceneIndex !== null
        ? state.characterStates?.[previousSceneIndex]?.[character] || {}
        : null;

    // Extract location from heading (e.g., "INT. FERRY - DAY" -> "FERRY")
    const locationMatch = scene.heading.match(/(?:INT\.|EXT\.|INT\/EXT\.?)\s+(.+?)(?:\s+-\s+|\s*$)/i);
    const location = locationMatch ? locationMatch[1].trim() : scene.heading;

    // Build entering notes (from previous scene)
    const enteringNotes = [];
    if (enteringState) {
        if (enteringState.hair) enteringNotes.push({ category: 'hair', text: enteringState.hair });
        if (enteringState.makeup) enteringNotes.push({ category: 'makeup', text: enteringState.makeup });
        if (enteringState.sfx) enteringNotes.push({ category: 'sfx', text: enteringState.sfx });
        if (enteringState.wardrobe) enteringNotes.push({ category: 'wardrobe', text: enteringState.wardrobe });
    }

    // Build during/exits notes (from current scene)
    const duringNotes = [];
    if (currentState.hair) duringNotes.push({ category: 'hair', text: currentState.hair });
    if (currentState.makeup) duringNotes.push({ category: 'makeup', text: currentState.makeup });
    if (currentState.sfx) duringNotes.push({ category: 'sfx', text: currentState.sfx });
    if (currentState.wardrobe) duringNotes.push({ category: 'wardrobe', text: currentState.wardrobe });

    return `
        <div class="continuity-scene-card">
            <div class="continuity-scene-header" onclick="navigateToScene(${sceneIndex})">
                <span class="scene-number-badge">Scene ${scene.number}</span>
                <span class="scene-location">${escapeHtml(location)}</span>
            </div>

            <div class="continuity-states">
                <!-- ENTERING STATE -->
                <div class="continuity-state entering">
                    <div class="state-label">ENTERS:</div>
                    <div class="state-notes">
                        ${enteringNotes.length > 0
                            ? enteringNotes.map(note => renderContinuityNote(note, sceneIndex, character, 'entering')).join('')
                            : '<div class="no-notes">—</div>'
                        }
                    </div>
                </div>

                <!-- DURING/EXITING STATE -->
                <div class="continuity-state during">
                    <div class="state-label">DURING/EXITS:</div>
                    <div class="state-notes">
                        ${duringNotes.length > 0
                            ? duringNotes.map(note => renderContinuityNote(note, sceneIndex, character, 'during')).join('')
                            : '<div class="no-notes">No changes noted</div>'
                        }
                        <button class="add-continuity-note-btn"
                                onclick="openContinuityEditModal(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}')">
                            + Add Note
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render story day continuity timeline
 * Shows character's journey organized by story days with entering/exiting states
 * @param {string} character - Character name
 * @returns {string} HTML for story day continuity timeline
 */
export function renderStoryDayContinuityTimeline(character) {
    const state = getState();

    // Get all scenes this character appears in
    const characterScenes = [];
    (state?.scenes || []).forEach((scene, index) => {
        const breakdown = state.sceneBreakdowns?.[index] || {};
        if (breakdown.cast && breakdown.cast.includes(character)) {
            characterScenes.push({ scene, index });
        }
    });

    if (characterScenes.length === 0) {
        return `
            <div class="empty-state" style="margin-top: 40px;">
                <div class="empty-title">No Scenes Found</div>
                <div class="empty-desc">This character doesn't appear in any scenes yet.</div>
            </div>
        `;
    }

    // Group scenes by story day
    const scenesByDay = {};
    characterScenes.forEach(({ scene, index }) => {
        const storyDay = scene.storyDay || 'Unassigned';
        if (!scenesByDay[storyDay]) {
            scenesByDay[storyDay] = [];
        }
        scenesByDay[storyDay].push({ scene, index });
    });

    // Sort days (natural sort for "Day 1", "Day 2", etc.)
    const sortedDays = Object.keys(scenesByDay).sort((a, b) => {
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;

        const numA = parseInt(a.match(/\d+/)?.[0] || 0);
        const numB = parseInt(b.match(/\d+/)?.[0] || 0);
        return numA - numB;
    });

    // Check if any continuity data exists
    const hasAnyData = characterScenes.some(({ index }) => {
        const charState = state.characterStates?.[index]?.[character];
        return charState && (charState.hair || charState.makeup || charState.sfx || charState.wardrobe);
    });

    let html = `
        <div class="continuity-timeline-container">
            <div class="timeline-intro">
                <h3 class="timeline-title">STORY DAY CONTINUITY</h3>
                <p class="timeline-description">
                    Track ${escapeHtml(character)}'s appearance changes scene-by-scene.
                    Fill in scene breakdowns to auto-populate this timeline.
                </p>
            </div>
    `;

    if (!hasAnyData) {
        html += `
            <div class="empty-state-small" style="margin: 20px 0;">
                <div class="empty-icon-small">📝</div>
                <div class="empty-text-small">
                    No continuity data yet. Complete scene breakdowns (Hair, Makeup, SFX, Wardrobe fields) to populate this timeline.
                </div>
            </div>
        `;
    }

    // Render each story day
    sortedDays.forEach(day => {
        const dayScenes = scenesByDay[day];

        html += `
            <div class="story-day-group">
                <div class="story-day-header">
                    <span class="story-day-label">${escapeHtml(day)}</span>
                    <span class="story-day-count">${dayScenes.length} scene${dayScenes.length !== 1 ? 's' : ''}</span>
                </div>

                <div class="story-day-scenes">
                    ${dayScenes.map(({ scene, index }) => renderContinuitySceneCard(scene, index, character, characterScenes)).join('')}
                </div>
            </div>
        `;
    });

    html += `</div>`;
    return html;
}

/**
 * Render enhanced character profile with narrative context
 * @param {string} character - Character name
 * @returns {string} HTML for enhanced character profile
 */
function renderEnhancedCharacterProfile(character) {
    try {
        return buildCharacterProfile(character);
    } catch (error) {
        console.error('Error building character profile:', error);
        return `
            <div class="empty-state" style="margin-top: 40px;">
                <div class="empty-title">Error Loading Profile</div>
                <div class="empty-desc">${escapeHtml(error.message)}</div>
            </div>
        `;
    }
}

/**
 * Render character timeline
 * Shows look states, transitions, and story day progression
 * If narrative context is available, uses enhanced profile system
 * @param {string} character - Character name
 * @returns {string} HTML for character timeline
 */
export function renderCharacterTimeline(character) {
    const state = getState();

    // Check if narrative context is available and use enhanced profile
    if (window.scriptNarrativeContext && window.scriptNarrativeContext.characters) {
        try {
            // Use enhanced profile system
            return renderEnhancedCharacterProfile(character);
        } catch (error) {
            console.error('Error rendering enhanced profile, falling back to classic view:', error);
        }
    }

    // Fallback to classic timeline view
    const profile = state.castProfiles?.[character] || {};
    const looks = state.characterLooks?.[character] || [];
    const events = state.continuityEvents?.[character] || [];

    // Check if character has look states defined
    const hasLooks = looks.length > 0;

    // Get transition count
    const transitionCount = (state.lookTransitions || []).filter(t => t.character === character).length;

    // Build HTML - Look State Timeline
    let html = `
        <div class="character-timeline-view">
            <!-- Header -->
            <div class="timeline-header">
                <div class="character-info">
                    <div class="character-name-title">${escapeHtml(character)}</div>
                    <div class="character-base-info">${escapeHtml(profile.baseDescription) || '<em style="opacity: 0.6;">No description yet</em>'}</div>
                </div>
                <div class="timeline-stats">
                    ${hasLooks ? `
                        <div class="stat">
                            <span class="stat-value">${looks.length}</span>
                            <span class="stat-label">Look States</span>
                        </div>
                    ` : ''}
                    <div class="stat">
                        <span class="stat-value">${transitionCount}</span>
                        <span class="stat-label">Transitions</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${events.length}</span>
                        <span class="stat-label">Events</span>
                    </div>
                </div>
            </div>

            <!-- Manage Look States Button -->
            <div class="timeline-controls">
                <button class="manage-looks-btn" onclick="alert('Manage look states feature coming soon')">
                    Manage Look States
                </button>
            </div>

            <!-- Story Day Timeline Visualization -->
            ${renderStoryDayTimeline(character)}
    `;

    if (hasLooks) {
        // LOOK STATE TIMELINE
        html += `<div class="look-state-timeline">`;
        html += `<div class="timeline-title">CHARACTER JOURNEY</div>`;

        // Sort looks chronologically
        const sortedLooks = [...looks].sort((a, b) => {
            const firstSceneA = Math.min(...(a.scenes || [Infinity]));
            const firstSceneB = Math.min(...(b.scenes || [Infinity]));
            return firstSceneA - firstSceneB;
        });

        sortedLooks.forEach((look, index) => {
            const previousLook = index > 0 ? sortedLooks[index - 1] : null;

            // TRANSITION CARD (if not first look)
            if (previousLook) {
                const transition = findTransition(character, previousLook.id, look.id);
                if (transition) {
                    html += renderTransitionCard(transition, character);
                } else {
                    html += renderUndefinedTransitionCard(character, look.id);
                }
            }

            // LOOK STATE CARD
            html += renderLookStateCard(look);
        });

        html += `</div>`;

    } else {
        // FALLBACK: Show story day continuity timeline if no looks defined
        html += renderStoryDayContinuityTimeline(character);
    }

    html += `</div>`;

    return html;
}

/**
 * Render timeline view (alias for renderCharacterTimeline)
 * @param {string} characterName - Character name
 * @returns {string} HTML for timeline view
 */
export function renderTimelineView(characterName) {
    return renderCharacterTimeline(characterName);
}

// Expose global functions for HTML onclick handlers
window.scrollToStoryDay = scrollToStoryDay;

export default {
    renderStoryDayTimeline,
    renderCharacterTimeline,
    renderTimelineView,
    renderStoryDayContinuityTimeline,
    scrollToStoryDay
};
