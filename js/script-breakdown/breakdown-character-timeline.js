/**
 * breakdown-character-timeline.js
 * Character timeline - Swimlane/Gantt Chart visualization
 *
 * Responsibilities:
 * - Render horizontal swimlane chart showing looks and events
 * - Scene numbers across the top, story days as column groups
 * - Looks and events as horizontal bar rows
 * - Click to navigate to scene breakdown
 */

import { getState, escapeHtml, showToast } from './breakdown-character-utils.js';
import { generateLooksFromBreakdown } from './breakdown-character-lookbook.js';

/**
 * Generate timeline data for a character
 * @param {string} characterName - Character name
 * @returns {Object} Timeline data with scenes, storyDays, looks, events
 */
function generateTimelineData(characterName) {
    const state = getState();
    const scenes = state?.scenes || [];

    // Get looks from lookbook
    let looks = [];
    try {
        looks = generateLooksFromBreakdown(characterName);
    } catch (e) {
        console.warn('Could not generate looks:', e);
    }

    // Get continuity events
    const events = state.continuityEvents?.[characterName] || [];

    // Get scenes this character appears in (in order)
    const characterScenes = [];
    scenes.forEach((scene, index) => {
        const breakdown = state.sceneBreakdowns?.[index];
        if (breakdown?.cast?.includes(characterName)) {
            characterScenes.push({
                index: index,
                number: scene.number || index + 1,
                storyDay: scene.storyDay || 'Day 1',
                heading: scene.heading || ''
            });
        }
    });

    // Group scenes by story day for column headers
    const storyDays = [];
    let currentDay = null;
    characterScenes.forEach(scene => {
        if (scene.storyDay !== currentDay) {
            currentDay = scene.storyDay;
            storyDays.push({
                label: currentDay,
                startIndex: characterScenes.indexOf(scene),
                scenes: []
            });
        }
        storyDays[storyDays.length - 1].scenes.push(scene);
    });

    return {
        characterName,
        scenes: characterScenes,
        storyDays,
        looks,
        events
    };
}

/**
 * Format story day to short form
 * @param {string} storyDay - Story day label
 * @returns {string} Short form (e.g., "Day 1" -> "D1")
 */
function formatDayShort(storyDay) {
    if (!storyDay) return '';
    const match = storyDay.match(/\d+/);
    return match ? `D${match[0]}` : storyDay.substring(0, 3);
}

/**
 * Truncate text for display
 * @param {string} text - Text to truncate
 * @param {number} maxLen - Maximum length
 * @returns {string} Truncated text
 */
function truncate(text, maxLen) {
    if (!text) return '';
    return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}

/**
 * Get scene range from start to end
 * @param {number|string} start - Start scene
 * @param {number|string} end - End scene
 * @returns {Array<number>} Array of scene numbers
 */
function getSceneRange(start, end) {
    const range = [];
    for (let i = parseInt(start); i <= parseInt(end); i++) {
        range.push(i);
    }
    return range;
}

/**
 * Render a look row in the timeline table
 * @param {Object} look - Look object
 * @param {Array} scenes - All character scenes
 * @param {number} index - Look index for coloring
 * @returns {string} HTML for look row
 */
function renderLookRow(look, scenes, index) {
    // Determine which scene columns this look spans
    const lookSceneNumbers = look.scenes || [];

    // Build cells - filled or empty for each scene
    const cells = scenes.map(scene => {
        const sceneNum = parseInt(scene.number) || scene.number;
        const isActive = lookSceneNumbers.includes(sceneNum) ||
                        lookSceneNumbers.includes(scene.number);
        return `
            <td class="bar-cell ${isActive ? 'active' : ''}">
                ${isActive ? '<div class="look-bar"></div>' : ''}
            </td>
        `;
    }).join('');

    // Assign colour based on index
    const colours = ['#4a90d9', '#50c878', '#daa520', '#cd5c5c', '#9370db', '#20b2aa'];
    const colour = colours[index % colours.length];

    // Skip undefined looks row if empty
    if (look.id === '__undefined__') {
        return `
            <tr class="look-row undefined-look" data-look-id="${look.id}" style="--look-colour: #666">
                <td class="row-label">
                    <div class="look-label">
                        <span class="look-name undefined">Undefined</span>
                    </div>
                </td>
                ${cells}
            </tr>
        `;
    }

    return `
        <tr class="look-row" data-look-id="${escapeHtml(look.id)}" style="--look-colour: ${colour}">
            <td class="row-label">
                <div class="look-label">
                    <span class="look-name">${escapeHtml(look.name || 'Look ' + (index + 1))}</span>
                    ${look.hair || look.makeup ? `
                        <span class="look-subtitle">${look.hair ? truncate(look.hair, 15) : truncate(look.makeup, 15)}</span>
                    ` : ''}
                </div>
            </td>
            ${cells}
        </tr>
    `;
}

/**
 * Render an event row in the timeline table
 * @param {Object} event - Continuity event object
 * @param {Array} scenes - All character scenes
 * @returns {string} HTML for event row
 */
function renderEventRow(event, scenes) {
    // Determine which scene columns this event spans
    let eventScenes = [];

    if (event.progression && event.progression.length > 0) {
        // Event has stages with scene arrays
        eventScenes = event.progression.flatMap(s => s.scenes || []);
    } else if (event.startScene && event.endScene) {
        // Event has start/end range
        eventScenes = getSceneRange(event.startScene, event.endScene);
    } else if (event.sceneIndex !== undefined) {
        // Single scene event - find the scene number
        const state = getState();
        const scene = state.scenes?.[event.sceneIndex];
        if (scene) {
            eventScenes = [scene.number || event.sceneIndex + 1];
        }
    } else if (event.scenes) {
        eventScenes = event.scenes;
    }

    // Build cells
    const cells = scenes.map(scene => {
        const sceneNum = parseInt(scene.number) || scene.number;
        const isActive = eventScenes.includes(sceneNum) ||
                        eventScenes.includes(scene.number);

        // If event has stages, determine which stage
        let stageClass = '';
        if (isActive && event.progression) {
            const stage = event.progression.find(s =>
                (s.scenes || []).includes(sceneNum) ||
                (s.scenes || []).includes(scene.number)
            );
            if (stage) {
                const stageIndex = event.progression.indexOf(stage);
                stageClass = `stage-${stageIndex}`;
            }
        }

        return `
            <td class="bar-cell ${isActive ? 'active' : ''} ${stageClass}">
                ${isActive ? '<div class="event-bar"></div>' : ''}
            </td>
        `;
    }).join('');

    return `
        <tr class="event-row" data-event-id="${escapeHtml(event.id || '')}">
            <td class="row-label">
                <div class="event-label">
                    <span class="event-type">${escapeHtml(event.type || 'event')}</span>
                    <span class="event-name">${escapeHtml(event.name || event.description || 'Event')}</span>
                </div>
            </td>
            ${cells}
        </tr>
    `;
}

/**
 * Render the swimlane timeline chart
 * @param {string} characterName - Character name
 * @returns {string} HTML for timeline
 */
function renderTimeline(characterName) {
    const data = generateTimelineData(characterName);

    if (data.scenes.length === 0) {
        return `
            <div class="timeline-empty">
                <p>No scenes found for this character.</p>
                <p class="hint">Add this character to scene breakdowns to populate the timeline.</p>
            </div>
        `;
    }

    const sceneCount = data.scenes.length;
    const colWidth = Math.max(50, Math.min(80, 800 / sceneCount)); // Responsive column width
    const escapedName = escapeHtml(characterName).replace(/'/g, "\\'");

    // Filter out undefined looks for cleaner display
    const definedLooks = data.looks.filter(l => l.id !== '__undefined__');
    const undefinedLook = data.looks.find(l => l.id === '__undefined__');

    return `
        <div class="character-timeline" data-character="${escapeHtml(characterName)}">

            <div class="timeline-scroll" id="timeline-scroll-${escapeHtml(characterName).replace(/\s+/g, '-')}">
                <table class="timeline-table">

                    <!-- Header Row 1: Scene Numbers -->
                    <thead>
                        <tr class="scene-row">
                            <th class="row-label"></th>
                            ${data.scenes.map((scene, i) => `
                                <th class="scene-cell"
                                    data-scene-index="${scene.index}"
                                    data-col-index="${i}"
                                    title="${escapeHtml(scene.heading)}"
                                    onclick="goToScene(${scene.index})"
                                    style="width: ${colWidth}px">
                                    Sc${scene.number}
                                </th>
                            `).join('')}
                        </tr>

                        <!-- Header Row 2: Story Days -->
                        <tr class="day-row">
                            <th class="row-label"></th>
                            ${data.scenes.map(scene => `
                                <th class="day-cell">${formatDayShort(scene.storyDay)}</th>
                            `).join('')}
                        </tr>
                    </thead>

                    <tbody>
                        <!-- Looks Section -->
                        ${definedLooks.map((look, i) => renderLookRow(look, data.scenes, i)).join('')}

                        ${undefinedLook && undefinedLook.scenes.length > 0 ? `
                            ${renderLookRow(undefinedLook, data.scenes, definedLooks.length)}
                        ` : ''}

                        <!-- Divider -->
                        <tr class="section-divider">
                            <td colspan="${data.scenes.length + 1}"></td>
                        </tr>

                        <!-- Events Section -->
                        ${data.events.length > 0 ? `
                            ${data.events.map(event => renderEventRow(event, data.scenes)).join('')}
                        ` : `
                            <tr class="no-events">
                                <td class="row-label">EVENTS</td>
                                <td colspan="${data.scenes.length}" class="empty-cell">No continuity events</td>
                            </tr>
                        `}
                    </tbody>

                </table>
            </div>

            <!-- Legend -->
            <div class="timeline-legend">
                <div class="legend-item">
                    <span class="legend-bar look-bar"></span>
                    <span>Look active</span>
                </div>
                <div class="legend-item">
                    <span class="legend-bar event-bar"></span>
                    <span>Event active</span>
                </div>
                <div class="legend-hint">Click scene to jump to breakdown</div>
            </div>

        </div>
    `;
}

/**
 * Navigate to a specific scene
 * @param {number} sceneIndex - Scene index to navigate to
 */
function goToScene(sceneIndex) {
    // Try to find the scene selector or navigation function
    if (typeof window.selectScene === 'function') {
        window.selectScene(sceneIndex);
    } else if (typeof window.navigateToScene === 'function') {
        window.navigateToScene(sceneIndex);
    } else {
        // Fallback: try to click on the scene in the scene list
        const sceneItem = document.querySelector(`.scene-item[data-index="${sceneIndex}"]`);
        if (sceneItem) {
            sceneItem.click();
        }
    }

    // Scroll to top of breakdown panel
    const breakdownPanel = document.querySelector('.breakdown-panel');
    if (breakdownPanel) {
        breakdownPanel.scrollTop = 0;
    }
}

/**
 * Initialize timeline hover effects
 * @param {string} characterName - Character name
 */
function initTimelineHover(characterName) {
    const containerId = `timeline-scroll-${characterName.replace(/\s+/g, '-')}`;
    const container = document.getElementById(containerId);
    if (!container) return;

    const table = container.querySelector('.timeline-table');
    if (!table) return;

    const sceneCells = table.querySelectorAll('.scene-cell');

    sceneCells.forEach((cell) => {
        const colIndex = parseInt(cell.dataset.colIndex);

        cell.addEventListener('mouseenter', () => {
            // Highlight all cells in this column (+2 for row-label and 1-indexed)
            const colSelector = colIndex + 2;
            table.querySelectorAll(`tbody td:nth-child(${colSelector})`).forEach(td => {
                td.classList.add('column-highlight');
            });
        });

        cell.addEventListener('mouseleave', () => {
            table.querySelectorAll('.column-highlight').forEach(td => {
                td.classList.remove('column-highlight');
            });
        });
    });
}

/**
 * Check if timeline has horizontal overflow
 * @param {string} characterName - Character name
 */
function checkTimelineOverflow(characterName) {
    const containerId = `timeline-scroll-${characterName.replace(/\s+/g, '-')}`;
    const scrollContainer = document.getElementById(containerId);
    if (!scrollContainer) return;

    const hasOverflow = scrollContainer.scrollWidth > scrollContainer.clientWidth;
    scrollContainer.classList.toggle('has-overflow', hasOverflow);
}

/**
 * Render the character timeline view (main export)
 * @param {string} characterName - Character name
 * @returns {string} HTML for timeline view
 */
export function renderCharacterTimeline(characterName) {
    // Render the swimlane timeline
    const timelineHtml = renderTimeline(characterName);

    // Schedule hover initialization after render
    setTimeout(() => {
        initTimelineHover(characterName);
        checkTimelineOverflow(characterName);
    }, 100);

    return `
        <div class="timeline-view-container">
            <div class="timeline-header">
                <h3 class="timeline-title">TIMELINE</h3>
                <p class="timeline-subtitle">Visual overview of looks and continuity events across scenes</p>
            </div>
            ${timelineHtml}
        </div>
    `;
}

/**
 * Render timeline view (alias)
 * @param {string} characterName - Character name
 * @returns {string} HTML for timeline view
 */
export function renderTimelineView(characterName) {
    return renderCharacterTimeline(characterName);
}

// ============================================================================
// LEGACY FUNCTIONS (kept for backwards compatibility)
// ============================================================================

/**
 * Render story day timeline visualization (legacy)
 * @param {string} characterName - Character name
 * @returns {string} HTML for story day timeline
 */
export function renderStoryDayTimeline(characterName) {
    const state = getState();
    const scenes = state?.scenes || [];

    // Get scenes this character appears in
    const characterScenes = [];
    scenes.forEach((scene, index) => {
        const breakdown = state.sceneBreakdowns?.[index];
        if (breakdown?.cast?.includes(characterName)) {
            characterScenes.push({ scene, index });
        }
    });

    if (characterScenes.length === 0) {
        return '';
    }

    // Group by story day
    const dayGroups = {};
    characterScenes.forEach(({ scene, index }) => {
        const day = scene.storyDay || 'Unassigned';
        if (!dayGroups[day]) dayGroups[day] = [];
        dayGroups[day].push({ scene, index });
    });

    // Sort days
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

    const escapedName = escapeHtml(characterName).replace(/'/g, "\\'");

    return `
        <div class="story-day-timeline">
            ${sortedDays.map(day => {
                const dayScenes = dayGroups[day];
                const sceneNumbers = dayScenes.map(d => d.scene.number || d.index + 1);
                const firstScene = Math.min(...sceneNumbers);
                const lastScene = Math.max(...sceneNumbers);
                const sceneRange = firstScene === lastScene ? `Sc ${firstScene}` : `Sc ${firstScene}-${lastScene}`;

                return `
                    <div class="timeline-day" onclick="scrollToStoryDay('${escapeHtml(day).replace(/'/g, "\\'")}', '${escapedName}')">
                        <div class="day-label">${escapeHtml(day)}</div>
                        <div class="day-bar" data-scenes="${dayScenes.length}">
                            <div class="scene-range">${sceneRange}</div>
                            <div class="scene-count">${dayScenes.length} scene${dayScenes.length !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Scroll to a specific story day section (legacy)
 * @param {string} storyDay - Story day label
 * @param {string} characterName - Character name
 */
export function scrollToStoryDay(storyDay, characterName) {
    const storyDayGroups = document.querySelectorAll('.story-day-group');

    for (const group of storyDayGroups) {
        const dayLabel = group.querySelector('.story-day-label');
        if (dayLabel && dayLabel.textContent.trim() === storyDay) {
            group.scrollIntoView({ behavior: 'smooth', block: 'start' });

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
 * Render story day continuity timeline (legacy)
 * @param {string} character - Character name
 * @returns {string} HTML for continuity timeline
 */
export function renderStoryDayContinuityTimeline(character) {
    // Redirect to new timeline
    return renderCharacterTimeline(character);
}

// Expose global functions for HTML onclick handlers
window.scrollToStoryDay = scrollToStoryDay;
window.goToScene = goToScene;

export default {
    renderStoryDayTimeline,
    renderCharacterTimeline,
    renderTimelineView,
    renderStoryDayContinuityTimeline,
    scrollToStoryDay,
    goToScene
};
