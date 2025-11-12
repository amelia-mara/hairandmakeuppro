/**
 * character-profiles.js
 * Enhanced character profile system with visual timelines
 *
 * Responsibilities:
 * - Render comprehensive character profiles with narrative context
 * - Display visual timeline showing character journey across story days
 * - Track and display continuity events (injuries, appearance changes, etc.)
 * - Group and display tagged elements by category
 * - Integrate with narrative analysis data
 */

import { state } from './main.js';

// ============================================================================
// CHARACTER TIMELINE CLASS
// ============================================================================

/**
 * CharacterTimeline class
 * Builds and renders visual timeline for a character
 */
export class CharacterTimeline {
    constructor(characterName) {
        this.character = characterName;
        this.narrativeContext = window.scriptNarrativeContext;
        this.events = [];
        this.storyDays = [];
    }

    /**
     * Build complete timeline data structure
     * @returns {Object} Timeline data with story days, appearances, changes, etc.
     */
    buildTimeline() {
        // Get character data from narrative context
        const characterData = this.narrativeContext?.characters?.find(
            c => c.name === this.character
        );

        const timeline = {
            storyDays: this.extractStoryDays(),
            appearances: this.mapAppearances(),
            changes: this.identifyChanges(characterData),
            injuries: this.trackInjuries(characterData),
            emotionalBeats: characterData?.emotionalBeats || []
        };

        return timeline;
    }

    /**
     * Extract story days where character appears
     * @returns {Array} Array of story day objects
     */
    extractStoryDays() {
        const days = new Map();

        state.scenes.forEach((scene, index) => {
            const breakdown = state.sceneBreakdowns[index] || {};
            if (breakdown.cast && breakdown.cast.includes(this.character)) {
                const dayLabel = scene.storyDay || 'Unassigned';

                if (!days.has(dayLabel)) {
                    days.set(dayLabel, {
                        id: dayLabel,
                        label: dayLabel,
                        scenes: []
                    });
                }

                days.get(dayLabel).scenes.push({
                    sceneIndex: index,
                    sceneNumber: scene.number,
                    heading: scene.heading
                });
            }
        });

        // Sort days (natural sort for "Day 1", "Day 2", etc.)
        return Array.from(days.values()).sort((a, b) => {
            if (a.id === 'Unassigned') return 1;
            if (b.id === 'Unassigned') return -1;

            const numA = parseInt(a.id.match(/\d+/)?.[0] || 0);
            const numB = parseInt(b.id.match(/\d+/)?.[0] || 0);
            return numA - numB;
        });
    }

    /**
     * Map all character appearances with scene details
     * @returns {Array} Array of appearance objects
     */
    mapAppearances() {
        const appearances = [];

        state.scenes.forEach((scene, index) => {
            const breakdown = state.sceneBreakdowns[index] || {};
            if (breakdown.cast && breakdown.cast.includes(this.character)) {
                const charState = state.characterStates[index]?.[this.character] || {};

                appearances.push({
                    sceneIndex: index,
                    sceneNumber: scene.number,
                    heading: scene.heading,
                    storyDay: scene.storyDay || 'Unassigned',
                    state: charState
                });
            }
        });

        return appearances;
    }

    /**
     * Identify appearance changes from narrative context and tags
     * @param {Object} characterData - Character data from narrative context
     * @returns {Array} Array of change events
     */
    identifyChanges(characterData) {
        const changes = [];

        // Get physical changes from narrative context
        if (characterData?.physicalChanges) {
            characterData.physicalChanges.forEach(change => {
                changes.push({
                    type: change.type || 'appearance',
                    scene: change.scene,
                    description: change.change || change.description,
                    day: this.getSceneStoryDay(change.scene),
                    category: this.categorizeChange(change),
                    importance: change.importance || 5
                });
            });
        }

        // Get changes from scene tags
        state.scenes.forEach((scene, index) => {
            const tags = state.scriptTags[index] || [];
            tags.forEach(tag => {
                if (tag.character === this.character && this.isAppearanceTag(tag)) {
                    changes.push({
                        type: tag.category,
                        scene: index,
                        description: tag.selectedText || tag.notes,
                        day: scene.storyDay || 'Unassigned',
                        category: tag.category,
                        importance: tag.importance || 3
                    });
                }
            });
        });

        return changes.sort((a, b) => a.scene - b.scene);
    }

    /**
     * Track injuries affecting this character
     * @param {Object} characterData - Character data from narrative context
     * @returns {Array} Array of injury events with progression
     */
    trackInjuries(characterData) {
        const injuries = [];

        // Get injuries from narrative context
        if (this.narrativeContext?.elements?.injuries) {
            this.narrativeContext.elements.injuries.forEach(injury => {
                if (injury.character === this.character) {
                    injuries.push({
                        type: 'injury',
                        scene: injury.scene,
                        description: injury.type || injury.description,
                        day: this.getSceneStoryDay(injury.scene),
                        progression: this.calculateInjuryProgression(injury),
                        importance: injury.narrativeImportance || 8
                    });
                }
            });
        }

        // Get injuries from tags
        state.scenes.forEach((scene, index) => {
            const tags = state.scriptTags[index] || [];
            tags.forEach(tag => {
                if (tag.character === this.character && tag.category === 'injuries') {
                    injuries.push({
                        type: 'injury',
                        scene: index,
                        description: tag.selectedText || tag.notes,
                        day: scene.storyDay || 'Unassigned',
                        progression: null,
                        importance: tag.importance || 7
                    });
                }
            });
        });

        return injuries.sort((a, b) => a.scene - b.scene);
    }

    /**
     * Calculate injury progression across scenes
     * @param {Object} injury - Injury object
     * @returns {Array|null} Array of progression stages or null
     */
    calculateInjuryProgression(injury) {
        if (!injury.progression) return null;

        // Simple progression tracking based on scene appearances after injury
        const injuryScene = injury.scene;
        const progression = [];
        const characterAppearances = this.mapAppearances();

        characterAppearances.forEach(appearance => {
            if (appearance.sceneIndex >= injuryScene) {
                const daysDiff = this.calculateDayDifference(
                    this.getSceneStoryDay(injuryScene),
                    appearance.storyDay
                );

                if (daysDiff >= 0) {
                    const stage = this.getHealingStage(daysDiff);
                    progression.push({
                        scene: appearance.sceneIndex,
                        day: appearance.storyDay,
                        stage: stage,
                        description: this.getHealingDescription(injury.type, stage)
                    });
                }
            }
        });

        return progression.length > 0 ? progression : null;
    }

    /**
     * Get story day for a scene index
     * @param {number} sceneIndex - Scene index
     * @returns {string} Story day label
     */
    getSceneStoryDay(sceneIndex) {
        return state.scenes[sceneIndex]?.storyDay || 'Unassigned';
    }

    /**
     * Categorize a change based on type
     * @param {Object} change - Change object
     * @returns {string} Category identifier
     */
    categorizeChange(change) {
        const type = (change.type || '').toLowerCase();
        if (type.includes('hair')) return 'hair';
        if (type.includes('makeup')) return 'makeup';
        if (type.includes('wardrobe') || type.includes('costume')) return 'wardrobe';
        if (type.includes('injury') || type.includes('wound')) return 'injuries';
        if (type.includes('sfx') || type.includes('prosthetic')) return 'sfx';
        return 'appearance';
    }

    /**
     * Check if tag is appearance-related
     * @param {Object} tag - Tag object
     * @returns {boolean} True if appearance-related
     */
    isAppearanceTag(tag) {
        const appearanceCategories = ['hair', 'makeup', 'sfx', 'wardrobe', 'injuries', 'health'];
        return appearanceCategories.includes(tag.category);
    }

    /**
     * Calculate day difference between two story days
     * @param {string} day1 - First day label
     * @param {string} day2 - Second day label
     * @returns {number} Day difference or 0 if can't calculate
     */
    calculateDayDifference(day1, day2) {
        const num1 = parseInt(day1.match(/\d+/)?.[0] || 0);
        const num2 = parseInt(day2.match(/\d+/)?.[0] || 0);
        return num2 - num1;
    }

    /**
     * Get healing stage based on days elapsed
     * @param {number} days - Days since injury
     * @returns {string} Healing stage
     */
    getHealingStage(days) {
        if (days === 0) return 'fresh';
        if (days <= 2) return 'recent';
        if (days <= 7) return 'healing';
        if (days <= 14) return 'healed';
        return 'faded';
    }

    /**
     * Get healing description for injury type and stage
     * @param {string} injuryType - Type of injury
     * @param {string} stage - Healing stage
     * @returns {string} Description
     */
    getHealingDescription(injuryType, stage) {
        const descriptions = {
            fresh: 'Fresh injury',
            recent: 'Recent, still prominent',
            healing: 'Healing, visible',
            healed: 'Mostly healed',
            faded: 'Faint scar/mark'
        };
        return descriptions[stage] || stage;
    }

    /**
     * Render timeline HTML
     * @returns {string} HTML string for timeline
     */
    renderTimeline() {
        const timeline = this.buildTimeline();

        let html = `
            <div class="timeline-track">
        `;

        timeline.storyDays.forEach(day => {
            html += this.renderDayTimeline(day, timeline);
        });

        html += `</div>`;

        return html;
    }

    /**
     * Render timeline for a single story day
     * @param {Object} day - Story day object
     * @param {Object} timeline - Complete timeline data
     * @returns {string} HTML string
     */
    renderDayTimeline(day, timeline) {
        const events = this.getDayEvents(day.id, timeline);

        return `
            <div class="timeline-day" data-day="${escapeHtml(day.id)}">
                <div class="day-label">${escapeHtml(day.label)}</div>
                <div class="day-scenes-count">${day.scenes.length} scene${day.scenes.length !== 1 ? 's' : ''}</div>
                <div class="day-events">
                    ${events.length > 0
                        ? events.map(event => this.renderEvent(event)).join('')
                        : '<div class="no-events">No appearance changes</div>'
                    }
                </div>
            </div>
        `;
    }

    /**
     * Get all events for a specific day
     * @param {string} dayId - Story day ID
     * @param {Object} timeline - Complete timeline data
     * @returns {Array} Array of events for this day
     */
    getDayEvents(dayId, timeline) {
        const events = [];

        // Add changes for this day
        timeline.changes
            .filter(c => c.day === dayId)
            .forEach(change => events.push(change));

        // Add injuries for this day
        timeline.injuries
            .filter(i => i.day === dayId)
            .forEach(injury => events.push(injury));

        // Sort by scene number
        return events.sort((a, b) => a.scene - b.scene);
    }

    /**
     * Render a single timeline event
     * @param {Object} event - Event object
     * @returns {string} HTML string
     */
    renderEvent(event) {
        const icon = this.getEventIcon(event.category || event.type);
        const scene = state.scenes[event.scene];

        return `
            <div class="timeline-event ${escapeHtml(event.category || event.type)}"
                 data-scene="${event.scene}"
                 data-importance="${event.importance}"
                 onclick="navigateToScene(${event.scene})"
                 title="Scene ${scene?.number}: ${escapeHtml(event.description)}">
                <span class="event-icon">${icon}</span>
                <span class="event-label">Scene ${scene?.number}</span>
                <span class="event-desc">${escapeHtml(event.description.substring(0, 30))}${event.description.length > 30 ? '...' : ''}</span>
            </div>
        `;
    }

    /**
     * Get icon for event category
     * @param {string} category - Event category
     * @returns {string} Emoji icon
     */
    getEventIcon(category) {
        const icons = {
            'injury': '🩹',
            'injuries': '🩹',
            'hair': '✂️',
            'makeup': '💄',
            'wardrobe': '👔',
            'health': '🏥',
            'sfx': '🎭',
            'emotional': '😔',
            'appearance': '👤'
        };
        return icons[category] || '●';
    }
}

// ============================================================================
// CHARACTER PROFILE RENDERING
// ============================================================================

/**
 * Build and render comprehensive character profile
 * @param {string} characterName - Character name
 * @returns {string} HTML string for character profile
 */
export function buildCharacterProfile(characterName) {
    const narrativeContext = window.scriptNarrativeContext;
    const characterData = narrativeContext?.characters?.find(c => c.name === characterName);

    // Create visual timeline
    const timeline = new CharacterTimeline(characterName);
    const timelineData = timeline.buildTimeline();

    // Get profile data
    const profile = state.castProfiles[characterName] || {};
    const events = extractCharacterEvents(characterName);
    const taggedElements = getCharacterTaggedElements(characterName);

    // Build HTML
    let html = `
        <div class="character-profile-panel">
            ${renderCharacterHeader(characterName, characterData, timelineData)}
            ${renderVisualTimeline(timeline)}
            ${renderContinuityEvents(events, characterName)}
            ${renderTaggedElements(taggedElements, characterName)}
        </div>
    `;

    return html;
}

/**
 * Render character header with metadata
 * @param {string} characterName - Character name
 * @param {Object} characterData - Character data from narrative context
 * @param {Object} timelineData - Timeline data
 * @returns {string} HTML string
 */
function renderCharacterHeader(characterName, characterData, timelineData) {
    const sceneCount = timelineData.appearances.length;
    const importance = characterData?.importance || 5;
    const arc = characterData?.arc || 'No arc defined';

    const importanceLabel = getImportanceLabel(importance);

    return `
        <div class="character-header">
            <h2 class="character-name">${escapeHtml(characterName)}</h2>
            <div class="character-meta">
                <span class="importance-badge" data-level="${importance}">${importanceLabel}</span>
                <span class="scene-count">${sceneCount} scene${sceneCount !== 1 ? 's' : ''}</span>
                <span class="story-arc" title="${escapeHtml(arc)}">${escapeHtml(arc.substring(0, 40))}${arc.length > 40 ? '...' : ''}</span>
            </div>
        </div>
    `;
}

/**
 * Get importance label from numeric value
 * @param {number} importance - Importance value (1-10)
 * @returns {string} Label
 */
function getImportanceLabel(importance) {
    if (importance >= 9) return 'Lead Character';
    if (importance >= 7) return 'Main Character';
    if (importance >= 5) return 'Supporting';
    if (importance >= 3) return 'Minor Role';
    return 'Background';
}

/**
 * Render visual timeline section
 * @param {CharacterTimeline} timeline - Timeline instance
 * @returns {string} HTML string
 */
function renderVisualTimeline(timeline) {
    return `
        <div class="character-timeline">
            <h3 class="section-title">Visual Journey</h3>
            <div class="timeline-container">
                ${timeline.renderTimeline()}
            </div>
        </div>
    `;
}

/**
 * Extract all continuity events for character
 * @param {string} characterName - Character name
 * @returns {Array} Array of event objects
 */
function extractCharacterEvents(characterName) {
    const events = [];
    const context = window.scriptNarrativeContext;

    // Get injuries affecting this character
    if (context?.elements?.injuries) {
        context.elements.injuries
            .filter(i => i.character === characterName)
            .forEach(injury => {
                events.push({
                    type: 'injury',
                    category: 'injuries',
                    scene: injury.scene,
                    description: injury.type || injury.description,
                    importance: injury.narrativeImportance || 8,
                    progression: null // Could be calculated if needed
                });
            });
    }

    // Get appearance changes from narrative context
    const characterData = context?.characters?.find(c => c.name === characterName);
    if (characterData?.physicalChanges) {
        characterData.physicalChanges.forEach(change => {
            events.push({
                type: change.type || 'appearance',
                category: categorizeChangeType(change.type),
                scene: change.scene,
                description: change.change || change.description,
                importance: change.importance || 6
            });
        });
    }

    // Get from tags
    state.scenes.forEach((scene, index) => {
        const tags = state.scriptTags[index] || [];
        tags.forEach(tag => {
            if (tag.character === characterName && isAppearanceCategory(tag.category)) {
                events.push({
                    type: tag.category,
                    category: tag.category,
                    scene: index,
                    description: tag.selectedText || tag.notes,
                    importance: tag.importance || 5
                });
            }
        });
    });

    return events.sort((a, b) => a.scene - b.scene);
}

/**
 * Categorize change type string
 * @param {string} type - Change type
 * @returns {string} Category
 */
function categorizeChangeType(type) {
    if (!type) return 'appearance';
    const lower = type.toLowerCase();
    if (lower.includes('hair')) return 'hair';
    if (lower.includes('makeup')) return 'makeup';
    if (lower.includes('wardrobe')) return 'wardrobe';
    if (lower.includes('injury')) return 'injuries';
    if (lower.includes('sfx')) return 'sfx';
    return 'appearance';
}

/**
 * Check if category is appearance-related
 * @param {string} category - Category name
 * @returns {boolean} True if appearance-related
 */
function isAppearanceCategory(category) {
    const appearanceCategories = ['hair', 'makeup', 'sfx', 'wardrobe', 'injuries', 'health'];
    return appearanceCategories.includes(category);
}

/**
 * Render continuity events list
 * @param {Array} events - Array of events
 * @param {string} characterName - Character name
 * @returns {string} HTML string
 */
function renderContinuityEvents(events, characterName) {
    if (events.length === 0) {
        return `
            <div class="continuity-events">
                <h3 class="section-title">Key Appearance Changes</h3>
                <div class="empty-state-small">
                    <div class="empty-text-small">No continuity events tagged yet</div>
                </div>
            </div>
        `;
    }

    return `
        <div class="continuity-events">
            <h3 class="section-title">Key Appearance Changes</h3>
            <div class="events-list">
                ${events.map(event => renderContinuityEvent(event, characterName)).join('')}
            </div>
        </div>
    `;
}

/**
 * Render a single continuity event
 * @param {Object} event - Event object
 * @param {string} characterName - Character name
 * @returns {string} HTML string
 */
function renderContinuityEvent(event, characterName) {
    const scene = state.scenes[event.scene];
    const stars = '★'.repeat(Math.min(5, Math.ceil(event.importance / 2)));

    return `
        <div class="continuity-event ${escapeHtml(event.category)}"
             data-importance="${event.importance}">
            <div class="event-header">
                <span class="scene-ref" onclick="navigateToScene(${event.scene})">Scene ${scene?.number || event.scene}</span>
                <span class="importance-indicator" title="Importance: ${event.importance}/10">${stars}</span>
            </div>
            <div class="event-description">${escapeHtml(event.description)}</div>
            <div class="event-actions">
                <button class="event-action-btn" onclick="navigateToScene(${event.scene})">
                    View Scene
                </button>
                <button class="event-action-btn" onclick="openContinuityEditModal(${event.scene}, '${escapeHtml(characterName).replace(/'/g, "\\'")}', '${event.category}')">
                    Edit
                </button>
            </div>
        </div>
    `;
}

/**
 * Get all tagged elements for character
 * @param {string} characterName - Character name
 * @returns {Object} Tagged elements grouped by category
 */
function getCharacterTaggedElements(characterName) {
    const grouped = {
        hair: [],
        makeup: [],
        sfx: [],
        wardrobe: [],
        injuries: [],
        health: [],
        stunts: [],
        weather: []
    };

    state.scenes.forEach((scene, index) => {
        const tags = state.scriptTags[index] || [];
        tags.forEach(tag => {
            if (tag.character === characterName && grouped.hasOwnProperty(tag.category)) {
                grouped[tag.category].push({
                    scene: index,
                    sceneNumber: scene.number,
                    text: tag.selectedText,
                    notes: tag.notes
                });
            }
        });
    });

    return grouped;
}

/**
 * Render tagged elements section
 * @param {Object} taggedElements - Tagged elements grouped by category
 * @param {string} characterName - Character name
 * @returns {string} HTML string
 */
function renderTaggedElements(taggedElements, characterName) {
    const categories = Object.keys(taggedElements).filter(cat => taggedElements[cat].length > 0);

    if (categories.length === 0) {
        return `
            <div class="character-tags">
                <h3 class="section-title">Tagged Elements</h3>
                <div class="empty-state-small">
                    <div class="empty-text-small">No elements tagged yet</div>
                </div>
            </div>
        `;
    }

    return `
        <div class="character-tags">
            <h3 class="section-title">Tagged Elements</h3>
            <div class="tags-by-category">
                ${categories.map(cat => renderTagCategory(cat, taggedElements[cat])).join('')}
            </div>
        </div>
    `;
}

/**
 * Render a tag category section
 * @param {string} category - Category name
 * @param {Array} tags - Array of tags
 * @returns {string} HTML string
 */
function renderTagCategory(category, tags) {
    const categoryLabels = {
        hair: 'Hair',
        makeup: 'Makeup',
        sfx: 'SFX Makeup',
        wardrobe: 'Wardrobe',
        injuries: 'Injuries',
        health: 'Health',
        stunts: 'Stunts',
        weather: 'Weather'
    };

    const label = categoryLabels[category] || category;

    return `
        <div class="tag-category-group">
            <div class="tag-category-header">${label} (${tags.length})</div>
            <div class="tag-items">
                ${tags.map(tag => `
                    <div class="tag-item" onclick="navigateToScene(${tag.scene})">
                        <span class="tag-scene">Scene ${tag.sceneNumber}</span>
                        <span class="tag-text">${escapeHtml(tag.text || tag.notes || 'No description')}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// EXPOSE FUNCTIONS
// ============================================================================

window.buildCharacterProfile = buildCharacterProfile;
