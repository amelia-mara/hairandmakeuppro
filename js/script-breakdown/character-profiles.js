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
    const masterContext = window.scriptMasterContext;

    // Try to get character data from master context first (new format), fallback to narrative context
    let characterData = null;
    if (masterContext?.characters?.[characterName]) {
        characterData = masterContext.characters[characterName];
    } else if (narrativeContext?.characters?.find(c => c.name === characterName)) {
        characterData = narrativeContext.characters.find(c => c.name === characterName);
    }

    // Create visual timeline
    const timeline = new CharacterTimeline(characterName);
    const timelineData = timeline.buildTimeline();

    // Get profile data
    const profile = state.castProfiles[characterName] || {};
    const events = extractCharacterEvents(characterName);
    const taggedElements = getCharacterTaggedElements(characterName);

    // Build HTML with new sections
    let html = `
        <div class="character-profile-container">
            ${renderCharacterHeader(characterName, characterData, timelineData)}
            ${renderScriptDescriptions(characterData)}
            ${renderCharacterJourney(characterData)}
            ${renderStoryPresence(characterData)}
            ${renderExtractedElements(characterData)}
            ${renderContinuityBreakdown(characterName, characterData)}
            ${renderContinuityEventsSection(characterName, events)}
            ${renderActionButtons(characterName)}
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
    const role = characterData?.characterAnalysis?.role || 'supporting';
    const physicalSummary = buildPhysicalSummary(characterData?.physicalProfile);

    return `
        <div class="profile-header">
            <div class="character-title">
                ${escapeHtml(characterName)} - ${role.toUpperCase()}
            </div>
            <div class="physical-summary">${physicalSummary}</div>
        </div>
    `;
}

/**
 * Build physical profile summary line
 * @param {Object} physicalProfile - Physical profile object
 * @returns {string} Summary text
 */
function buildPhysicalSummary(physicalProfile) {
    if (!physicalProfile) return 'No physical description available';

    const parts = [];
    if (physicalProfile.age) parts.push(`Age: ${physicalProfile.age}`);
    if (physicalProfile.build) parts.push(`Build: ${physicalProfile.build}`);
    if (physicalProfile.hairColor || physicalProfile.hairStyle) {
        const hairParts = [physicalProfile.hairColor, physicalProfile.hairStyle].filter(Boolean);
        parts.push(`Hair: ${hairParts.join(', ')}`);
    }
    if (physicalProfile.eyeColor) parts.push(`Eyes: ${physicalProfile.eyeColor}`);
    if (physicalProfile.distinctiveFeatures?.length > 0) {
        parts.push(`Distinctive: ${physicalProfile.distinctiveFeatures.join(', ')}`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'No physical description available';
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
 * Render script descriptions section (direct quotes from script)
 * @param {Object} characterData - Character data
 * @returns {string} HTML string
 */
function renderScriptDescriptions(characterData) {
    const descriptions = characterData?.scriptDescriptions || [];

    if (descriptions.length === 0) {
        return '';
    }

    return `
        <div class="profile-section script-descriptions-section">
            <h3 class="section-title">SCRIPT DESCRIPTIONS</h3>
            <div class="script-descriptions-list">
                ${descriptions.map(desc => `
                    <div class="description-block" data-scene="${desc.sceneNumber}">
                        <div class="description-quote">"${escapeHtml(desc.text)}"</div>
                        <div class="description-meta">
                            <span class="scene-link" onclick="navigateToScene(${desc.sceneNumber - 1})">Scene ${desc.sceneNumber}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Render physical profile section
 * @param {Object} characterData - Character data
 * @returns {string} HTML string
 */
function renderPhysicalProfile(characterData) {
    const physical = characterData?.physicalProfile || {};

    const fields = [
        { key: 'age', label: 'Age' },
        { key: 'gender', label: 'Gender' },
        { key: 'ethnicity', label: 'Ethnicity' },
        { key: 'height', label: 'Height' },
        { key: 'build', label: 'Build' },
        { key: 'hairColor', label: 'Hair Color' },
        { key: 'hairStyle', label: 'Hair Style' },
        { key: 'eyeColor', label: 'Eye Color' }
    ];

    const hasAnyField = fields.some(f => physical[f.key]);
    const hasFeatures = physical.distinctiveFeatures && physical.distinctiveFeatures.length > 0;

    if (!hasAnyField && !hasFeatures) {
        return '';
    }

    return `
        <div class="profile-section physical-profile-section">
            <h3 class="section-title">PHYSICAL PROFILE</h3>
            <div class="profile-grid">
                ${fields.filter(f => physical[f.key]).map(field => `
                    <div class="profile-field">
                        <span class="field-label">${field.label}:</span>
                        <span class="field-value">${escapeHtml(physical[field.key])}</span>
                    </div>
                `).join('')}
                ${hasFeatures ? `
                    <div class="profile-field full-width">
                        <span class="field-label">Distinctive Features:</span>
                        <span class="field-value">${physical.distinctiveFeatures.map(f => escapeHtml(f)).join(', ')}</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Render visual identity section (generated analysis)
 * @param {Object} characterData - Character data
 * @returns {string} HTML string
 */
function renderVisualIdentity(characterData) {
    const visual = characterData?.visualProfile || {};

    const hasContent = visual.overallVibe || visual.styleChoices || visual.groomingHabits ||
                       visual.makeupStyle || visual.quirks || visual.inspirations;

    if (!hasContent) {
        return '';
    }

    return `
        <div class="profile-section visual-identity-section">
            <h3 class="section-title">VISUAL IDENTITY</h3>
            <div class="visual-profile-content">
                ${visual.overallVibe ? `
                    <div class="visual-field">
                        <div class="visual-label">Overall Vibe</div>
                        <div class="visual-value">${escapeHtml(visual.overallVibe)}</div>
                    </div>
                ` : ''}
                ${visual.styleChoices ? `
                    <div class="visual-field">
                        <div class="visual-label">Style Choices</div>
                        <div class="visual-value">${escapeHtml(visual.styleChoices)}</div>
                    </div>
                ` : ''}
                ${visual.groomingHabits ? `
                    <div class="visual-field">
                        <div class="visual-label">Grooming Habits</div>
                        <div class="visual-value">${escapeHtml(visual.groomingHabits)}</div>
                    </div>
                ` : ''}
                ${visual.makeupStyle ? `
                    <div class="visual-field">
                        <div class="visual-label">Makeup Style</div>
                        <div class="visual-value">${escapeHtml(visual.makeupStyle)}</div>
                    </div>
                ` : ''}
                ${visual.quirks ? `
                    <div class="visual-field">
                        <div class="visual-label">Visual Quirks</div>
                        <div class="visual-value">${escapeHtml(visual.quirks)}</div>
                    </div>
                ` : ''}
                ${visual.inspirations ? `
                    <div class="visual-field">
                        <div class="visual-label">Reference Inspirations</div>
                        <div class="visual-value">${escapeHtml(visual.inspirations)}</div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Render character journey section (personality and arc)
 * @param {Object} characterData - Character data
 * @returns {string} HTML string
 */
function renderCharacterJourney(characterData) {
    const analysis = characterData?.characterAnalysis || {};

    const hasContent = analysis.personality || analysis.arc || analysis.emotionalJourney ||
                       analysis.socialClass || analysis.occupation;

    if (!hasContent) {
        return '';
    }

    return `
        <div class="profile-section character-journey-section">
            <h3 class="section-title">CHARACTER OVERVIEW</h3>
            <div class="journey-content">
                ${analysis.personality ? `
                    <div class="journey-field">
                        <div class="journey-label">Personality</div>
                        <div class="journey-value">${escapeHtml(analysis.personality)}</div>
                    </div>
                ` : ''}
                ${analysis.socialClass ? `
                    <div class="journey-field">
                        <div class="journey-label">Social Class</div>
                        <div class="journey-value">${escapeHtml(analysis.socialClass)}</div>
                    </div>
                ` : ''}
                ${analysis.occupation ? `
                    <div class="journey-field">
                        <div class="journey-label">Occupation</div>
                        <div class="journey-value">${escapeHtml(analysis.occupation)}</div>
                    </div>
                ` : ''}
                ${analysis.arc ? `
                    <div class="journey-field">
                        <div class="journey-label">Story Arc</div>
                        <div class="journey-value">${escapeHtml(analysis.arc)}</div>
                    </div>
                ` : ''}
                ${analysis.emotionalJourney ? `
                    <div class="journey-field">
                        <div class="journey-label">Emotional Journey</div>
                        <div class="journey-value">${escapeHtml(analysis.emotionalJourney)}</div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Render continuity guidelines section
 * @param {Object} characterData - Character data
 * @returns {string} HTML string
 */
function renderContinuityGuidelines(characterData) {
    const notes = characterData?.continuityNotes || {};

    const hasContent = notes.keyLooks || notes.signature || notes.transformations;

    if (!hasContent) {
        return '';
    }

    return `
        <div class="profile-section continuity-guidelines-section">
            <h3 class="section-title">CONTINUITY GUIDELINES</h3>
            <div class="guidelines-content">
                ${notes.keyLooks ? `
                    <div class="guideline-field">
                        <div class="guideline-label">Key Looks</div>
                        <div class="guideline-value">${escapeHtml(notes.keyLooks)}</div>
                    </div>
                ` : ''}
                ${notes.signature ? `
                    <div class="guideline-field">
                        <div class="guideline-label">Signature Elements</div>
                        <div class="guideline-value">${escapeHtml(notes.signature)}</div>
                    </div>
                ` : ''}
                ${notes.transformations ? `
                    <div class="guideline-field">
                        <div class="guideline-label">Major Transformations</div>
                        <div class="guideline-value">${escapeHtml(notes.transformations)}</div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Render story presence section
 * @param {Object} characterData - Character data
 * @returns {string} HTML string
 */
function renderStoryPresence(characterData) {
    const presence = characterData?.storyPresence;

    if (!presence) return '';

    const totalScenes = presence.totalScenes || 0;
    const firstScene = presence.firstAppearance || characterData?.firstAppearance || 'Unknown';
    const lastScene = presence.lastAppearance || characterData?.lastAppearance || 'Unknown';
    const hasDialogue = presence.hasDialogue ? 'Has dialogue' : 'Non-speaking';
    const speakingScenes = presence.speakingScenes?.length || 0;

    return `
        <div class="profile-section story-presence-section">
            <h3 class="section-title">STORY PRESENCE</h3>
            <div class="presence-grid">
                <div class="presence-stat">
                    <div class="stat-label">Total Scenes</div>
                    <div class="stat-value">${totalScenes}</div>
                </div>
                <div class="presence-stat">
                    <div class="stat-label">First Appearance</div>
                    <div class="stat-value">Scene ${firstScene}</div>
                </div>
                <div class="presence-stat">
                    <div class="stat-label">Last Appearance</div>
                    <div class="stat-value">Scene ${lastScene}</div>
                </div>
                <div class="presence-stat">
                    <div class="stat-label">Dialogue Status</div>
                    <div class="stat-value">${hasDialogue}${speakingScenes > 0 ? ` (${speakingScenes} scenes)` : ''}</div>
                </div>
            </div>
            ${presence.scenesPresent?.length > 0 ? `
                <div class="scenes-list">
                    <strong>Appears in scenes:</strong> ${presence.scenesPresent.join(', ')}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render extracted elements section
 * @param {Object} characterData - Character data
 * @returns {string} HTML string
 */
function renderExtractedElements(characterData) {
    const elements = characterData?.extractedElements;

    if (!elements) return '';

    const hasContent = elements.mentionedWardrobe?.length > 0 ||
                      elements.mentionedAppearanceChanges?.length > 0 ||
                      elements.physicalActions?.length > 0 ||
                      elements.environmentalExposure?.length > 0;

    if (!hasContent) return '';

    return `
        <div class="profile-section extracted-elements-section">
            <h3 class="section-title">EXTRACTED CONTINUITY ELEMENTS</h3>
            <div class="elements-list">
                ${elements.mentionedWardrobe?.length > 0 ? `
                    <div class="element-group">
                        <div class="element-label">Wardrobe Mentions:</div>
                        <div class="element-values">${elements.mentionedWardrobe.map(w => escapeHtml(w)).join(', ')}</div>
                    </div>
                ` : ''}

                ${elements.mentionedAppearanceChanges?.length > 0 ? `
                    <div class="element-group">
                        <div class="element-label">Appearance Changes:</div>
                        <div class="element-values">${elements.mentionedAppearanceChanges.map(c => escapeHtml(c)).join(', ')}</div>
                    </div>
                ` : ''}

                ${elements.physicalActions?.length > 0 ? `
                    <div class="element-group">
                        <div class="element-label">Physical Actions:</div>
                        <div class="element-values">${elements.physicalActions.map(a => escapeHtml(a)).join(', ')}</div>
                    </div>
                ` : ''}

                ${elements.environmentalExposure?.length > 0 ? `
                    <div class="element-group">
                        <div class="element-label">Environmental Exposure:</div>
                        <div class="element-values">${elements.environmentalExposure.map(e => escapeHtml(e)).join(', ')}</div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Render continuity breakdown with looks
 * @param {string} characterName - Character name
 * @param {Object} characterData - Character data from masterContext
 * @returns {string} HTML string
 */
function renderContinuityBreakdown(characterName, characterData) {
    const looks = extractCharacterLooks(characterName, characterData);

    if (looks.length === 0) return '';

    return `
        <div class="profile-section continuity-breakdown-section">
            <h3 class="section-title">CONTINUITY BREAKDOWN</h3>
            <div class="looks-container">
                ${looks.map((look, index) => `
                    <div class="look-block">
                        <div class="look-header">
                            <div class="look-title">LOOK ${index + 1}: "${look.name}"</div>
                            <div class="look-range">(${look.dayRange} / Scenes ${look.sceneRange})</div>
                        </div>
                        <div class="look-details">
                            ${look.hair ? `<div class="detail-row"><strong>Hair:</strong> ${escapeHtml(look.hair)}</div>` : ''}
                            ${look.makeup ? `<div class="detail-row"><strong>Makeup:</strong> ${escapeHtml(look.makeup)}</div>` : ''}
                            ${look.wardrobe ? `<div class="detail-row"><strong>Wardrobe:</strong> ${escapeHtml(look.wardrobe)}</div>` : ''}
                            ${look.notes ? `<div class="detail-row"><strong>Notes:</strong> ${escapeHtml(look.notes)}</div>` : ''}
                            ${look.special ? `<div class="detail-row special"><strong>Special:</strong> ${escapeHtml(look.special)}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Extract character looks from scene data
 * @param {string} characterName - Character name
 * @param {Object} characterData - Character data
 * @returns {Array} Array of look objects
 */
function extractCharacterLooks(characterName, characterData) {
    const looks = [];

    // Get base appearance
    const baseAppearance = characterData?.visualProfile?.overallVibe || 'Standard appearance';

    // Collect scenes where character appears
    const scenesPresent = characterData?.scenesPresent || [];

    if (scenesPresent.length === 0) return looks;

    // Group by story days and look changes
    const scenesByDay = {};
    scenesPresent.forEach(sceneNum => {
        const sceneIndex = sceneNum - 1;
        const scene = state.scenes?.[sceneIndex];
        if (!scene) return;

        const storyDay = scene.storyDay || 'Unassigned';
        if (!scenesByDay[storyDay]) {
            scenesByDay[storyDay] = [];
        }
        scenesByDay[storyDay].push(sceneNum);
    });

    // Create look for each story day (can be enhanced to detect mid-day changes)
    Object.entries(scenesByDay).forEach(([day, scenes]) => {
        const firstScene = Math.min(...scenes);
        const lastScene = Math.max(...scenes);
        const sceneRange = scenes.length === 1 ? `${firstScene}` : `${firstScene}-${lastScene}`;

        looks.push({
            name: `${day} Look`,
            dayRange: day,
            sceneRange: sceneRange,
            hair: 'As per base appearance',
            makeup: 'As per base appearance',
            wardrobe: 'As per base appearance',
            notes: baseAppearance
        });
    });

    return looks;
}

/**
 * Render continuity events section
 * @param {string} characterName - Character name
 * @param {Array} events - Array of event objects
 * @returns {string} HTML string
 */
function renderContinuityEventsSection(characterName, events) {
    if (events.length === 0) return '';

    return `
        <div class="profile-section continuity-events-section">
            <h3 class="section-title">CONTINUITY EVENTS</h3>
            <div class="events-list">
                ${events.map(event => `
                    <div class="event-item">
                        <strong>Scene ${event.sceneNumber || event.scene}:</strong> ${escapeHtml(event.description || event.type)}
                        ${event.endScene ? ` - continues through Scene ${event.endScene}` : ' - ongoing'}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Render action buttons section
 * @param {string} characterName - Character name
 * @returns {string} HTML string
 */
function renderActionButtons(characterName) {
    const escapedName = characterName.replace(/'/g, "\\'");

    return `
        <div class="profile-actions">
            <button class="action-btn" onclick="viewCharacterTimeline('${escapedName}')" title="View full timeline">
                View Full Timeline
            </button>
            <button class="action-btn" onclick="exportCharacterProfile('${escapedName}')" title="Export profile">
                Export Profile
            </button>
            <button class="action-btn" onclick="addCharacterNotes('${escapedName}')" title="Add notes">
                Add Notes
            </button>
        </div>
    `;
}

/**
 * Render visual timeline section
 * @param {CharacterTimeline} timeline - Timeline instance
 * @returns {string} HTML string
 */
function renderVisualTimeline(timeline) {
    return `
        <div class="character-timeline">
            <h3 class="section-title">Visual Journey Timeline</h3>
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
// ACTION BUTTON HANDLERS
// ============================================================================

/**
 * Generate lookbook for character (placeholder)
 * @param {string} characterName - Character name
 */
window.generateLookbook = function(characterName) {
    console.log('Generate lookbook for:', characterName);
    // TODO: Implement lookbook generation
    alert(`Lookbook generation for ${characterName} - Coming soon!`);
};

/**
 * View detailed character timeline
 * @param {string} characterName - Character name
 */
window.viewCharacterTimeline = function(characterName) {
    console.log('View timeline for:', characterName);

    const timelineData = buildTimelineData(characterName);

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal timeline-modal active';
    modal.id = 'character-timeline-modal';
    modal.style.display = 'flex';

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${escapeHtml(characterName)} - CONTINUITY TIMELINE</h2>
                <button class="modal-close" onclick="closeTimelineModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="timeline-scroll">
                    ${renderTimelineDays(timelineData)}
                </div>
            </div>
            <div class="modal-notes">
                <div class="notes-section">
                    <strong>TECHNICAL NOTES</strong>
                    <div class="technical-notes">${timelineData.technicalNotes || 'None'}</div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="modal-btn" onclick="exportTimeline('${characterName.replace(/'/g, "\\'")}')">Export Timeline</button>
                <button class="modal-btn" onclick="printTimeline('${characterName.replace(/'/g, "\\'")}')">Print for HOD Meeting</button>
                <button class="modal-btn secondary" onclick="closeTimelineModal()">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeTimelineModal();
        }
    });
};

/**
 * Build timeline data for character
 * @param {string} characterName - Character name
 * @returns {Object} Timeline data
 */
function buildTimelineData(characterName) {
    const characterData = window.masterContext?.characters?.[characterName];
    const scenesPresent = characterData?.scenesPresent || [];

    // Group scenes by story day
    const scenesByDay = {};
    scenesPresent.forEach(sceneNum => {
        const sceneIndex = sceneNum - 1;
        const scene = state.scenes?.[sceneIndex];
        if (!scene) return;

        const storyDay = scene.storyDay || 'Unassigned';
        if (!scenesByDay[storyDay]) {
            scenesByDay[storyDay] = [];
        }

        scenesByDay[storyDay].push({
            number: sceneNum,
            heading: scene.heading,
            index: sceneIndex,
            continuity: state.characterStates?.[sceneIndex]?.[characterName] || null
        });
    });

    // Build timeline days
    const days = Object.entries(scenesByDay).map(([dayLabel, scenes]) => {
        return {
            number: dayLabel,
            look: characterData?.visualProfile?.overallVibe || 'Standard',
            base: 'As per base appearance',
            scenes: scenes
        };
    });

    return {
        days: days,
        technicalNotes: characterData?.continuityNotes?.transformations || ''
    };
}

/**
 * Render timeline days
 * @param {Object} timelineData - Timeline data
 * @returns {string} HTML string
 */
function renderTimelineDays(timelineData) {
    return timelineData.days.map(day => `
        <div class="timeline-day">
            <div class="day-header">
                <strong>STORY DAY ${day.number}</strong>
                ${day.look ? `<div class="day-meta">Look: ${escapeHtml(day.look)}</div>` : ''}
                ${day.base ? `<div class="day-meta">Base: ${escapeHtml(day.base)}</div>` : ''}
            </div>
            <div class="day-scenes">
                ${day.scenes.map(scene => renderTimelineScene(scene)).join('')}
            </div>
        </div>
    `).join('');
}

/**
 * Render timeline scene
 * @param {Object} scene - Scene object
 * @returns {string} HTML string
 */
function renderTimelineScene(scene) {
    const hasEvent = scene.continuity && (scene.continuity.notes || scene.continuity.injuries);

    return `
        <div class="timeline-scene ${hasEvent ? 'has-event' : ''}" onclick="navigateToScene(${scene.index})">
            <div class="scene-header">
                <strong>Scene ${scene.number}:</strong>
                ${escapeHtml(scene.heading)}
            </div>
            ${scene.continuity && (scene.continuity.enter || scene.continuity.during || scene.continuity.exit) ? `
                <div class="scene-continuity">
                    ${scene.continuity.enter ? `<div class="continuity-note">Enter: ${escapeHtml(scene.continuity.enter)}</div>` : ''}
                    ${scene.continuity.during ? `<div class="continuity-note">During: ${escapeHtml(scene.continuity.during)}</div>` : ''}
                    ${scene.continuity.exit ? `<div class="continuity-note">Exit: ${escapeHtml(scene.continuity.exit)}</div>` : ''}
                </div>
            ` : ''}
            ${scene.continuity && scene.continuity.notes ? `
                <div class="scene-event">
                    <strong>EVENT:</strong> ${escapeHtml(scene.continuity.notes)}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Close timeline modal
 */
window.closeTimelineModal = function() {
    const modal = document.getElementById('character-timeline-modal');
    if (modal) {
        modal.remove();
    }
};

/**
 * Export timeline (placeholder)
 */
window.exportTimeline = function(characterName) {
    alert(`Export timeline for ${characterName} - Coming soon!`);
};

/**
 * Print timeline (placeholder)
 */
window.printTimeline = function(characterName) {
    alert(`Print timeline for ${characterName} - Coming soon!`);
};

/**
 * Add character notes (placeholder)
 * @param {string} characterName - Character name
 */
window.addCharacterNotes = function(characterName) {
    console.log('Add notes for:', characterName);
    alert(`Add notes for ${characterName} - Coming soon!`);
};

/**
 * Export character profile (placeholder)
 * @param {string} characterName - Character name
 */
window.exportCharacterProfile = function(characterName) {
    console.log('Export profile for:', characterName);
    // TODO: Implement profile export
    alert(`Export profile for ${characterName} - Coming soon!`);
};

// ============================================================================
// EXPOSE FUNCTIONS
// ============================================================================

window.buildCharacterProfile = buildCharacterProfile;
