/**
 * breakdown-character-events.js
 * Character continuity events and auto-detection
 *
 * Responsibilities:
 * - Render continuity events timeline
 * - Handle auto-detected events from masterContext
 * - Manage event confirmation, dismissal, and progression
 * - Event CRUD operations
 * - AI-powered progression generation
 */

import { getState, escapeHtml, showToast } from './breakdown-character-utils.js';
import { getCharacterScenes } from './breakdown-character-filtering.js';

// Storage for dismissed auto events
let dismissedAutoEvents = null;

/**
 * Initialize dismissed auto events storage (called lazily to avoid circular dependency issues)
 */
function initDismissedAutoEvents() {
    const state = getState();
    if (state && !state.dismissedAutoEvents) {
        state.dismissedAutoEvents = new Set();
        // Try to restore from localStorage
        try {
            const stored = localStorage.getItem('dismissedAutoEvents');
            if (stored) {
                state.dismissedAutoEvents = new Set(JSON.parse(stored));
            }
        } catch (e) {
            console.warn('Could not restore dismissed auto events:', e);
        }
    }
}

/**
 * Get or initialize dismissed auto events set
 * @returns {Set} Set of dismissed event IDs
 */
function getDismissedAutoEvents() {
    const state = getState();
    if (!state) return new Set();
    if (!state.dismissedAutoEvents) {
        initDismissedAutoEvents();
    }
    return state.dismissedAutoEvents || new Set();
}

/**
 * Save dismissed auto events to localStorage
 */
function saveDismissedAutoEvents() {
    try {
        const dismissed = getDismissedAutoEvents();
        localStorage.setItem('dismissedAutoEvents', JSON.stringify([...dismissed]));
    } catch (e) {
        console.warn('Could not save dismissed auto events:', e);
    }
}

/**
 * Map change type strings to standardized event types
 * @param {string} changeType - Raw change type from detection
 * @returns {string} Standardized event type
 */
function mapChangeTypeToEventType(changeType) {
    const typeMap = {
        'injury': 'Injury',
        'injury_acquired': 'Injury',
        'fight': 'Fight/Action',
        'weather': 'Weather Effect',
        'illness': 'Illness/Health',
        'time_passage': 'Time Passage',
        'condition': 'Condition Change',
        'hair': 'Hair Change',
        'wardrobe': 'Wardrobe Change',
        'makeup': 'Makeup Change',
        'physical': 'Physical Change',
        'physical_appearance': 'Physical Change'
    };
    return typeMap[changeType?.toLowerCase()] || changeType || 'Event';
}

/**
 * Get auto-detected continuity events from masterContext
 * Extracts events from appearanceChanges and descriptionTags
 * @param {string} characterName - Character name
 * @returns {Array} Array of auto-detected event objects
 */
export function getAutoDetectedEvents(characterName) {
    const events = [];
    const masterContext = window.masterContext || window.scriptMasterContext;

    if (!masterContext) return events;

    // Source 1: appearanceChanges from Phase 5
    if (masterContext.appearanceChanges && Array.isArray(masterContext.appearanceChanges)) {
        masterContext.appearanceChanges.forEach(change => {
            if (change.character?.toUpperCase() === characterName.toUpperCase()) {
                events.push({
                    id: `auto-${change.character}-${change.start_scene}-${change.change_type}`,
                    character: characterName,
                    type: mapChangeTypeToEventType(change.change_type),
                    category: change.change_type,
                    description: change.description || change.visual_notes || 'Auto-detected event',
                    startScene: change.start_scene,
                    endScene: change.end_scene || null,
                    source: 'auto-detected',
                    progression: [],
                    visualNotes: change.visual_notes || ''
                });
            }
        });
    }

    // Source 2: descriptionTags that indicate changes
    if (masterContext.descriptionTags && Array.isArray(masterContext.descriptionTags)) {
        const changeCategories = ['injury', 'fight', 'weather', 'illness', 'time_passage', 'condition'];

        // Group tags by scene for change detection
        const tagsByScene = {};
        masterContext.descriptionTags.forEach(tag => {
            if (tag.character?.toUpperCase() === characterName.toUpperCase() &&
                changeCategories.includes(tag.category)) {

                const sceneKey = tag.scene;
                if (!tagsByScene[sceneKey]) {
                    tagsByScene[sceneKey] = [];
                }
                tagsByScene[sceneKey].push(tag);
            }
        });

        // Create events from grouped tags
        Object.entries(tagsByScene).forEach(([scene, tags]) => {
            tags.forEach(tag => {
                // Check if this event already exists
                const existingEvent = events.find(e =>
                    e.startScene === parseInt(scene) &&
                    e.category === tag.category
                );

                if (!existingEvent) {
                    events.push({
                        id: `auto-tag-${characterName}-${scene}-${tag.category}`,
                        character: characterName,
                        type: mapChangeTypeToEventType(tag.category),
                        category: tag.category,
                        description: tag.quote || 'Auto-detected from script',
                        startScene: parseInt(scene),
                        endScene: null,
                        source: 'auto-detected',
                        progression: [],
                        visualNotes: ''
                    });
                }
            });
        });
    }

    // Source 3: Character's extractedElements
    const charData = masterContext.characters?.[characterName];
    if (charData?.extractedElements?.mentionedAppearanceChanges) {
        charData.extractedElements.mentionedAppearanceChanges.forEach(change => {
            const existingEvent = events.find(e =>
                e.startScene === change.scene &&
                e.category === change.type
            );

            if (!existingEvent) {
                events.push({
                    id: `auto-extracted-${characterName}-${change.scene}-${change.type}`,
                    character: characterName,
                    type: mapChangeTypeToEventType(change.type),
                    category: change.type,
                    description: change.description || 'Auto-detected change',
                    startScene: change.scene,
                    endScene: null,
                    source: 'auto-detected',
                    progression: [],
                    visualNotes: change.notes || ''
                });
            }
        });
    }

    // Filter out dismissed events
    const dismissedEvents = getDismissedAutoEvents();
    const filteredEvents = events.filter(e => !dismissedEvents.has(e.id));

    // Sort by start scene
    filteredEvents.sort((a, b) => a.startScene - b.startScene);

    return filteredEvents;
}

/**
 * Get character continuity events with scene data
 * Now includes auto-detected events from masterContext
 * @param {string} characterName - Character name
 * @returns {Array} Array of continuity event objects
 */
export function getCharacterContinuityEvents(characterName) {
    const state = getState();
    const manualEvents = state.continuityEvents?.[characterName] || [];
    const autoDetectedEvents = getAutoDetectedEvents(characterName);

    // Combine manual and auto-detected events
    const allEvents = [...manualEvents];

    // Add auto-detected events that don't already exist as manual events
    autoDetectedEvents.forEach(autoEvent => {
        const isDuplicate = manualEvents.some(manual =>
            manual.startScene === autoEvent.startScene &&
            manual.type === autoEvent.type &&
            manual.character === autoEvent.character
        );
        if (!isDuplicate) {
            allEvents.push(autoEvent);
        }
    });

    // Enrich events with scene information and ensure IDs
    return allEvents.map(event => {
        const enrichedEvent = { ...event };

        // Ensure event has an ID
        if (!enrichedEvent.id) {
            enrichedEvent.id = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        return enrichedEvent;
    });
}

/**
 * Get color for progression stage based on severity
 * @param {number} severity - Severity level (0-100)
 * @returns {string} CSS color value
 */
function getStageColor(severity) {
    if (severity >= 70) {
        // High severity - red
        return 'rgba(239, 68, 68, 0.8)';
    } else if (severity >= 40) {
        // Medium severity - yellow/orange
        return 'rgba(251, 191, 36, 0.8)';
    } else if (severity >= 10) {
        // Low severity - light green
        return 'rgba(132, 204, 22, 0.8)';
    } else {
        // Healed - green
        return 'rgba(34, 197, 94, 0.8)';
    }
}

/**
 * Render progression stages for a continuity event
 * @param {Object} event - Event object with progression data
 * @param {string} characterName - Character name
 * @returns {string} HTML for progression stages
 */
function renderProgressionStages(event, characterName) {
    if (!event.progression || event.progression.length === 0) {
        return `
            <div class="progression-empty">
                <span>No progression stages defined</span>
                <button class="small-stage-btn" onclick="addProgressionStage('${escapeHtml(characterName).replace(/'/g, "\\'")}', '${event.id}')">
                    + Add Stage
                </button>
            </div>
        `;
    }

    const characterScenes = getCharacterScenes(characterName);
    const totalScenes = characterScenes.length;

    return `
        <div class="progression-stages">
            ${event.progression.map((stage, index) => {
                const stageScenes = stage.endScene - stage.startScene + 1;
                const width = totalScenes > 0 ? (stageScenes / totalScenes) * 100 : 0;
                const color = getStageColor(stage.severity || 50);

                return `
                    <div class="progression-stage"
                         style="width: ${width}%; background: ${color};"
                         onclick="editProgressionStage('${escapeHtml(characterName).replace(/'/g, "\\'")}', '${event.id}', ${index})"
                         title="Click to edit stage">
                        <div class="stage-content">
                            <span class="stage-label">${escapeHtml(stage.name || 'Stage ' + (index + 1))}</span>
                            <span class="stage-scenes">Sc ${stage.startScene}-${stage.endScene}</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Get event type color
 * @param {string} category - Event category
 * @returns {string} CSS color value
 */
function getEventColor(category) {
    const colors = {
        'injury': '#FF6347', // Coral
        'fight': '#FF6347',
        'weather': '#87CEEB', // Sky blue
        'illness': '#90EE90', // Light green
        'time_passage': '#DDA0DD', // Plum
        'condition': '#87CEEB',
        'hair': '#E6E6FA', // Lavender
        'wardrobe': '#98FB98', // Pale green
        'makeup': '#FFB6C1', // Pink
        'physical': '#FFD700' // Gold
    };
    return colors[category?.toLowerCase()] || '#C9A961';
}

/**
 * Render continuity events timeline
 * Now shows auto-detected events with visual indicator
 * @param {string} characterName - Character name
 * @returns {string} HTML for continuity events timeline
 */
export function renderContinuityEventsTimeline(characterName) {
    const events = getCharacterContinuityEvents(characterName);

    // Separate auto-detected from manual events
    const autoEvents = events.filter(e => e.source === 'auto-detected');
    const manualEvents = events.filter(e => e.source !== 'auto-detected');

    if (events.length === 0) {
        return `
            <div class="continuity-events-section">
                <div class="empty-message">
                    No continuity events tracked yet.
                </div>
                <button class="add-event-btn" onclick="addContinuityEvent('${escapeHtml(characterName).replace(/'/g, "\\'")}')">
                    + Add Continuity Event
                </button>
            </div>
        `;
    }

    return `
        <div class="continuity-events-section">
            <!-- Auto-detected events section -->
            ${autoEvents.length > 0 ? `
                <div class="auto-events-header" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--glass-border);">
                    <span style="color: var(--accent-gold); font-weight: 600;">Auto-Detected Events</span>
                    <span style="font-size: 0.8em; opacity: 0.7;">(${autoEvents.length} found from script analysis)</span>
                </div>
                ${autoEvents.map(event => `
                    <div class="event-timeline auto-detected" data-event-id="${event.id}" style="background: rgba(201, 169, 97, 0.1); border: 1px solid var(--accent-gold); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
                        <div class="event-timeline-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                            <div class="event-info">
                                <span class="event-type-badge" style="background: ${getEventColor(event.category)}; color: #000; padding: 2px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600;">
                                    ${escapeHtml(event.type || event.category || 'Event')}
                                </span>
                                <span class="auto-badge" style="background: var(--accent-gold); color: var(--bg-dark); padding: 2px 6px; border-radius: 4px; font-size: 0.7em; margin-left: 4px;">
                                    AUTO
                                </span>
                            </div>
                            <div class="event-meta" style="font-size: 0.85em; opacity: 0.8;">
                                Scene ${event.startScene || '?'}${event.endScene ? ` - ${event.endScene}` : ' (ongoing)'}
                            </div>
                        </div>
                        <div class="event-description" style="font-size: 0.9em; margin-bottom: 8px; line-height: 1.4;">
                            ${escapeHtml(event.description || 'No description')}
                        </div>
                        ${event.visualNotes ? `
                            <div class="visual-notes" style="font-size: 0.8em; opacity: 0.8; font-style: italic; margin-bottom: 8px;">
                                Visual notes: ${escapeHtml(event.visualNotes)}
                            </div>
                        ` : ''}
                        <div class="event-timeline-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="event-action-btn" onclick="confirmAutoEvent('${escapeHtml(characterName).replace(/'/g, "\\'")}', '${event.id}')" title="Confirm and track this event" style="background: var(--accent-gold); color: var(--bg-dark); border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">
                                ✓ Confirm & Track
                            </button>
                            <button class="event-action-btn" onclick="setEventEndScene('${escapeHtml(characterName).replace(/'/g, "\\'")}', '${event.id}')" title="Set when this event ends" style="background: var(--glass-bg); border: 1px solid var(--glass-border); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">
                                Set End Scene
                            </button>
                            <button class="event-action-btn" onclick="dismissAutoEvent('${escapeHtml(characterName).replace(/'/g, "\\'")}', '${event.id}')" title="Dismiss this detection" style="background: transparent; border: 1px solid var(--glass-border); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em; opacity: 0.7;">
                                Dismiss
                            </button>
                        </div>
                    </div>
                `).join('')}
            ` : ''}

            <!-- Manual/Confirmed events section -->
            ${manualEvents.length > 0 ? `
                <div class="manual-events-header" style="display: flex; align-items: center; gap: 8px; margin-top: 16px; margin-bottom: 12px;">
                    <span style="font-weight: 600;">Tracked Events</span>
                    <span style="font-size: 0.8em; opacity: 0.7;">(${manualEvents.length} events)</span>
                </div>
                ${manualEvents.map(event => `
                    <div class="event-timeline" data-event-id="${event.id}" style="background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
                        <div class="event-timeline-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                            <div class="event-info">
                                <span class="event-type-badge" style="background: ${getEventColor(event.category)}; color: #000; padding: 2px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600;">
                                    ${escapeHtml(event.category || event.type || 'Event')}
                                </span>
                            </div>
                            <div class="event-meta" style="font-size: 0.85em; opacity: 0.8;">
                                Scene ${event.startScene || '?'}${event.endScene ? ` - ${event.endScene}` : ' (ongoing)'}
                            </div>
                        </div>
                        <div class="event-description" style="font-size: 0.9em; margin-bottom: 8px;">
                            ${escapeHtml(event.description || 'Untitled Event')}
                        </div>

                        <div class="progression-bar">
                            ${renderProgressionStages(event, characterName)}
                        </div>

                        <div class="event-timeline-actions" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
                            <button class="event-action-btn" onclick="fillProgressionGaps('${escapeHtml(characterName).replace(/'/g, "\\'")}', '${event.id}')" title="Use AI to fill progression gaps" style="background: var(--glass-bg); border: 1px solid var(--glass-border); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">
                                Fill Gaps with AI
                            </button>
                            <button class="event-action-btn" onclick="editContinuityEvent('${escapeHtml(characterName).replace(/'/g, "\\'")}', '${event.id}')" title="Edit event details" style="background: var(--glass-bg); border: 1px solid var(--glass-border); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">
                                Edit
                            </button>
                            <button class="event-action-btn danger" onclick="deleteContinuityEvent('${escapeHtml(characterName).replace(/'/g, "\\'")}', '${event.id}')" title="Delete event" style="background: transparent; border: 1px solid #ef4444; color: #ef4444; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">
                                Delete
                            </button>
                        </div>
                    </div>
                `).join('')}
            ` : ''}

            <button class="add-event-btn" onclick="addContinuityEvent('${escapeHtml(characterName).replace(/'/g, "\\'")}')">
                + Add Continuity Event
            </button>
        </div>
    `;
}

/**
 * Render events view with timeline visualization
 * @param {string} characterName - Character name
 * @returns {string} HTML for events view
 */
export function renderEventsView(characterName) {
    return `
        <div class="events-view">
            ${renderContinuityEventsTimeline(characterName)}
        </div>
    `;
}

/**
 * Confirm an auto-detected event and add it to the tracked continuity events
 * @param {string} characterName - Character name
 * @param {string} eventId - Auto-detected event ID
 */
export async function confirmAutoEvent(characterName, eventId) {
    const state = getState();

    // Get the auto-detected event
    const autoEvents = getAutoDetectedEvents(characterName);
    const autoEvent = autoEvents.find(e => e.id === eventId);

    if (!autoEvent) {
        console.error('Auto-detected event not found:', eventId);
        showToast('Event not found', 'error');
        return;
    }

    // Initialize continuity events storage if needed
    if (!state.continuityEvents) {
        state.continuityEvents = {};
    }
    if (!state.continuityEvents[characterName]) {
        state.continuityEvents[characterName] = [];
    }

    // Create a confirmed event from the auto-detected one
    const confirmedEvent = {
        id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        character: characterName,
        type: autoEvent.type,
        category: autoEvent.category,
        description: autoEvent.description,
        startScene: autoEvent.startScene,
        endScene: autoEvent.endScene,
        source: 'confirmed',
        originalAutoId: eventId,
        progression: autoEvent.progression || [],
        visualNotes: autoEvent.visualNotes || '',
        confirmedAt: new Date().toISOString()
    };

    // Add to confirmed events
    state.continuityEvents[characterName].push(confirmedEvent);

    // Dismiss the auto-detected event so it doesn't show again
    const dismissed = getDismissedAutoEvents();
    dismissed.add(eventId);
    saveDismissedAutoEvents();

    // Save project
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Show success notification
    showToast(`Event confirmed and added to tracking for ${characterName}`, 'success');

    // Refresh the events view
    refreshEventsView(characterName);
}

/**
 * Dismiss an auto-detected event (mark as not relevant)
 * @param {string} characterName - Character name
 * @param {string} eventId - Auto-detected event ID
 */
export function dismissAutoEvent(characterName, eventId) {
    // Add to dismissed set
    const dismissed = getDismissedAutoEvents();
    dismissed.add(eventId);
    saveDismissedAutoEvents();

    showToast('Event dismissed', 'info');

    // Refresh the events view
    refreshEventsView(characterName);
}

/**
 * Set the end scene for an event
 * @param {string} characterName - Character name
 * @param {string} eventId - Event ID
 */
export async function setEventEndScene(characterName, eventId) {
    const state = getState();

    // Get current scene index
    const currentSceneIndex = state.currentSceneIndex !== undefined ? state.currentSceneIndex : (state.currentScene || 0);
    const currentScene = state.scenes?.[currentSceneIndex];
    const sceneNumber = currentScene?.number || (currentSceneIndex + 1);

    // Check if it's a tracked event first
    if (state.continuityEvents?.[characterName]) {
        const trackedEvent = state.continuityEvents[characterName].find(e => e.id === eventId);
        if (trackedEvent) {
            trackedEvent.endScene = sceneNumber;
            const { saveProject } = await import('./export-handlers.js');
            saveProject();
            showToast(`Event end scene set to Scene ${sceneNumber}`, 'success');
            refreshEventsView(characterName);
            return;
        }
    }

    // If it's an auto-detected event, confirm it first then set end scene
    const autoEvents = getAutoDetectedEvents(characterName);
    const autoEvent = autoEvents.find(e => e.id === eventId);

    if (autoEvent) {
        // Confirm the event first
        await confirmAutoEvent(characterName, eventId);

        // Then set the end scene on the newly confirmed event
        const confirmedEvents = state.continuityEvents?.[characterName] || [];
        const newlyConfirmed = confirmedEvents.find(e => e.originalAutoId === eventId);
        if (newlyConfirmed) {
            newlyConfirmed.endScene = sceneNumber;
            const { saveProject } = await import('./export-handlers.js');
            saveProject();
            showToast(`Event confirmed and end scene set to Scene ${sceneNumber}`, 'success');
            refreshEventsView(characterName);
        }
        return;
    }

    showToast('Event not found', 'error');
}

/**
 * Add a new continuity event for a character
 * @param {string} characterName - Character name
 */
export async function addContinuityEvent(characterName) {
    const state = getState();

    const eventName = prompt('Enter event name (e.g., "Bruised Left Eye", "Broken Arm"):');
    if (!eventName || !eventName.trim()) return;

    const category = prompt('Enter category (injury, health, sfx, other):', 'injury');
    const startScene = parseInt(prompt('Enter starting scene number:', '1'));

    if (isNaN(startScene)) {
        alert('Invalid scene number');
        return;
    }

    // Initialize continuity events if needed
    if (!state.continuityEvents) {
        state.continuityEvents = {};
    }
    if (!state.continuityEvents[characterName]) {
        state.continuityEvents[characterName] = [];
    }

    // Create new event
    const newEvent = {
        id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        description: eventName.trim(),
        category: category || 'injury',
        startScene: startScene,
        endScene: null,
        progression: []
    };

    state.continuityEvents[characterName].push(newEvent);

    // Save project
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Refresh the view
    refreshEventsView(characterName);

    showToast(`Added continuity event: ${eventName}`, 'success');
}

/**
 * Edit a continuity event
 * @param {string} characterName - Character name
 * @param {string} eventId - Event ID
 */
export async function editContinuityEvent(characterName, eventId) {
    const state = getState();
    const events = state.continuityEvents?.[characterName] || [];
    const event = events.find(e => e.id === eventId);

    if (!event) {
        alert('Event not found');
        return;
    }

    const newName = prompt('Event name:', event.description);
    if (newName === null) return;

    if (newName.trim()) {
        event.description = newName.trim();
    }

    const newCategory = prompt('Category (injury, health, sfx, other):', event.category);
    if (newCategory && newCategory.trim()) {
        event.category = newCategory.trim();
    }

    const newEnd = prompt('End scene (leave empty if ongoing):', event.endScene || '');
    if (newEnd.trim()) {
        const endScene = parseInt(newEnd);
        if (!isNaN(endScene)) {
            event.endScene = endScene;
        }
    } else {
        event.endScene = null;
    }

    // Save project
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Refresh the view
    refreshEventsView(characterName);
}

/**
 * Delete a continuity event
 * @param {string} characterName - Character name
 * @param {string} eventId - Event ID
 */
export async function deleteContinuityEvent(characterName, eventId) {
    if (!confirm('Are you sure you want to delete this continuity event?')) {
        return;
    }

    const state = getState();
    const events = state.continuityEvents?.[characterName] || [];
    const index = events.findIndex(e => e.id === eventId);

    if (index !== -1) {
        events.splice(index, 1);

        // Save project
        const { saveProject } = await import('./export-handlers.js');
        saveProject();

        // Refresh the view
        refreshEventsView(characterName);
    }
}

/**
 * Delete a tracked continuity event (alias for deleteContinuityEvent)
 * @param {string} characterName - Character name
 * @param {string} eventId - Event ID to delete
 */
export async function deleteTrackedEvent(characterName, eventId) {
    const state = getState();
    if (!state.continuityEvents?.[characterName]) {
        return;
    }

    const index = state.continuityEvents[characterName].findIndex(e => e.id === eventId);
    if (index !== -1) {
        state.continuityEvents[characterName].splice(index, 1);
        const { saveProject } = await import('./export-handlers.js');
        saveProject();
        showToast('Event deleted', 'info');
        refreshEventsView(characterName);
    }
}

/**
 * Add a progression stage to an event
 * @param {string} characterName - Character name
 * @param {string} eventId - Event ID
 */
export async function addProgressionStage(characterName, eventId) {
    const state = getState();
    const events = state.continuityEvents?.[characterName] || [];
    const event = events.find(e => e.id === eventId);

    if (!event) {
        alert('Event not found');
        return;
    }

    const stageName = prompt('Stage name (e.g., "Fresh wound", "Healing", "Scabbed over"):');
    if (!stageName || !stageName.trim()) return;

    const startScene = parseInt(prompt('Start scene:', event.startScene));
    const endScene = parseInt(prompt('End scene:', startScene + 5));
    const severity = parseInt(prompt('Severity (0-100, where 100 is worst):', '70'));

    if (isNaN(startScene) || isNaN(endScene) || isNaN(severity)) {
        alert('Invalid input');
        return;
    }

    if (!event.progression) {
        event.progression = [];
    }

    event.progression.push({
        name: stageName.trim(),
        startScene: startScene,
        endScene: endScene,
        severity: Math.max(0, Math.min(100, severity))
    });

    // Sort by start scene
    event.progression.sort((a, b) => a.startScene - b.startScene);

    // Save project
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Refresh the view
    refreshEventsView(characterName);
}

/**
 * Edit a progression stage
 * @param {string} characterName - Character name
 * @param {string} eventId - Event ID
 * @param {number} stageIndex - Stage index
 */
export async function editProgressionStage(characterName, eventId, stageIndex) {
    const state = getState();
    const events = state.continuityEvents?.[characterName] || [];
    const event = events.find(e => e.id === eventId);

    if (!event || !event.progression || !event.progression[stageIndex]) {
        alert('Stage not found');
        return;
    }

    const stage = event.progression[stageIndex];

    const newName = prompt('Stage name:', stage.name);
    if (newName === null) return;

    if (newName.trim()) {
        stage.name = newName.trim();
    }

    const newSeverity = prompt('Severity (0-100):', stage.severity);
    if (newSeverity && newSeverity.trim()) {
        const severity = parseInt(newSeverity);
        if (!isNaN(severity)) {
            stage.severity = Math.max(0, Math.min(100, severity));
        }
    }

    // Save project
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Refresh the view
    refreshEventsView(characterName);
}

/**
 * Add a progression stage to a tracked event
 * @param {string} characterName - Character name
 * @param {string} eventId - Event ID
 * @param {number} sceneNumber - Scene number for this progression stage
 * @param {string} description - Description of progression at this point
 */
export async function addEventProgression(characterName, eventId, sceneNumber, description) {
    const state = getState();
    if (!state.continuityEvents?.[characterName]) {
        showToast('No tracked events for this character', 'error');
        return;
    }

    const event = state.continuityEvents[characterName].find(e => e.id === eventId);
    if (!event) {
        showToast('Event not found', 'error');
        return;
    }

    // Initialize progression array if needed
    if (!event.progression) {
        event.progression = [];
    }

    // Add progression stage
    event.progression.push({
        sceneNumber: sceneNumber,
        description: description,
        addedAt: new Date().toISOString()
    });

    // Sort by scene number
    event.progression.sort((a, b) => a.sceneNumber - b.sceneNumber);

    const { saveProject } = await import('./export-handlers.js');
    saveProject();
    showToast(`Progression stage added at Scene ${sceneNumber}`, 'success');

    // Refresh the view
    refreshEventsView(characterName);
}

/**
 * Fill progression gaps with AI
 * @param {string} characterName - Character name
 * @param {string} eventId - Event ID
 */
export async function fillProgressionGaps(characterName, eventId) {
    const state = getState();
    const events = state.continuityEvents?.[characterName] || [];
    const event = events.find(e => e.id === eventId);

    if (!event) {
        showToast('Event not found', 'error');
        return;
    }

    // Check if event has basic info
    if (!event.startScene) {
        showToast('Event needs a start scene before generating progression', 'error');
        return;
    }

    // Get character scenes for context
    const characterScenes = getCharacterScenes(characterName);
    const sceneCount = characterScenes.length;
    const endScene = event.endScene || Math.min(event.startScene + 20, sceneCount);

    const duration = endScene - event.startScene;

    if (duration < 2) {
        showToast('Event duration too short for meaningful progression', 'error');
        return;
    }

    try {
        showToast('Generating progression stages with AI...', 'info');

        const { callAI } = await import('./ai-integration.js');

        const prompt = `You are a film continuity expert. Generate realistic healing/progression stages for a character continuity event.

Event Type: ${event.category || 'injury'}
Description: ${event.description}
Start Scene: ${event.startScene}
End Scene: ${endScene}
Duration: ${duration} scenes

Create 3-5 progression stages showing realistic healing/recovery over time. For each stage:
1. Name (brief description of the stage)
2. Start scene number
3. End scene number
4. Severity (0-100, where 100 is worst)

Format as JSON array:
[
  {"name": "Fresh wound", "startScene": ${event.startScene}, "endScene": ${event.startScene + Math.floor(duration * 0.2)}, "severity": 95},
  ...
]

Important:
- Severity should decrease over time (healing progression)
- Scene ranges should be continuous with no gaps
- Be realistic for the type of injury/condition
- Consider typical healing timelines
- Final stage should have low severity (nearly healed)

Return ONLY the JSON array, no other text.`;

        const response = await callAI(prompt, 1000);

        // Parse AI response
        let progressionStages;
        try {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                progressionStages = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('Failed to parse AI response:', response);
            showToast('AI generated invalid progression data', 'error');
            return;
        }

        // Validate progression stages
        if (!Array.isArray(progressionStages) || progressionStages.length === 0) {
            showToast('AI generated empty progression', 'error');
            return;
        }

        // Ensure all stages have required fields
        progressionStages = progressionStages.map((stage, index) => ({
            name: stage.name || `Stage ${index + 1}`,
            startScene: parseInt(stage.startScene) || event.startScene,
            endScene: parseInt(stage.endScene) || event.startScene + 1,
            severity: Math.max(0, Math.min(100, parseInt(stage.severity) || 50))
        }));

        // Sort by start scene
        progressionStages.sort((a, b) => a.startScene - b.startScene);

        // Update event with new progression
        event.progression = progressionStages;

        // Save project
        const { saveProject } = await import('./export-handlers.js');
        saveProject();

        // Refresh the view
        refreshEventsView(characterName);

        showToast(`Generated ${progressionStages.length} progression stages`, 'success');

    } catch (error) {
        console.error('Error filling progression gaps:', error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

/**
 * Clear all dismissed auto events (for testing/reset purposes)
 */
export function clearDismissedAutoEvents() {
    const dismissed = getDismissedAutoEvents();
    dismissed.clear();
    saveDismissedAutoEvents();
    showToast('Dismissed events cleared', 'info');
}

/**
 * Helper function to refresh events view
 * @param {string} characterName - Character name
 */
function refreshEventsView(characterName) {
    const contentId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-content`;
    const contentDiv = document.getElementById(contentId);
    if (contentDiv) {
        contentDiv.innerHTML = renderEventsView(characterName);
    }
}

// Expose global functions for HTML onclick handlers
window.confirmAutoEvent = confirmAutoEvent;
window.dismissAutoEvent = dismissAutoEvent;
window.setEventEndScene = setEventEndScene;
window.addContinuityEvent = addContinuityEvent;
window.editContinuityEvent = editContinuityEvent;
window.deleteContinuityEvent = deleteContinuityEvent;
window.deleteTrackedEvent = deleteTrackedEvent;
window.addProgressionStage = addProgressionStage;
window.editProgressionStage = editProgressionStage;
window.addEventProgression = addEventProgression;
window.fillProgressionGaps = fillProgressionGaps;
window.clearDismissedAutoEvents = clearDismissedAutoEvents;

export default {
    getAutoDetectedEvents,
    getCharacterContinuityEvents,
    renderContinuityEventsTimeline,
    renderEventsView,
    confirmAutoEvent,
    dismissAutoEvent,
    setEventEndScene,
    addContinuityEvent,
    editContinuityEvent,
    deleteContinuityEvent,
    deleteTrackedEvent,
    addProgressionStage,
    editProgressionStage,
    addEventProgression,
    fillProgressionGaps,
    clearDismissedAutoEvents
};
