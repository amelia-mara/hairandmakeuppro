/**
 * breakdown-form.js
 * Right panel scene breakdown form
 */

import { state } from './main.js';
import { formatSceneRange, getComplexityIcon, extractLocation, detectTimeOfDay, detectIntExt } from './utils.js';
import { detectAIElements, generateDescription } from './ai-integration.js';

// ============================================================================
// ELEMENT CATEGORIES
// ============================================================================

// Element categories for tagging (NO 'cast' - characters are handled separately)
const categories = [
    { id: 'hair', name: 'Hair', color: '#a855f7' },
    { id: 'makeup', name: 'Makeup', color: '#ec4899' },
    { id: 'sfx', name: 'SFX', color: '#ef4444' },
    { id: 'wardrobe', name: 'Wardrobe', color: '#34d399' },
    { id: 'health', name: 'Health', color: '#f59e0b' },
    { id: 'injuries', name: 'Injuries', color: '#dc2626' },
    { id: 'stunts', name: 'Stunts', color: '#f97316' },
    { id: 'weather', name: 'Weather', color: '#38bdf8' },
    { id: 'extras', name: 'Extras', color: '#9ca3af' }
];

let currentElementCategory = null;

// ============================================================================
// MAIN RENDER FUNCTION
// ============================================================================

/**
 * Render the breakdown panel for the current scene
 */
export function renderBreakdownPanel() {
    const container = document.getElementById('breakdown-panel');
    if (!container) return;

    if (state.currentScene === null) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-title">Select a Scene</div>
                <div class="empty-desc">Choose a scene to view and edit its breakdown</div>
            </div>
        `;
        return;
    }

    renderSceneBreakdown(state.currentScene);
}

/**
 * Detect which characters from masterContext appear in the given scene content
 * This is the SINGLE SOURCE OF TRUTH - uses characters from initial analysis
 */
function detectCharactersFromMasterContext(sceneContent) {
    const charactersInScene = [];

    // First try: Check masterContext.characters (primary source)
    if (window.masterContext?.characters) {
        Object.keys(window.masterContext.characters).forEach(characterName => {
            // Check if character name appears in scene content
            // Use word boundary to avoid partial matches
            const regex = new RegExp('\\b' + characterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
            if (sceneContent.match(regex)) {
                charactersInScene.push(characterName);
            }
        });
    }

    // Fallback: Check confirmedCharacters if masterContext didn't have characters
    if (charactersInScene.length === 0 && window.confirmedCharacters) {
        window.confirmedCharacters.forEach(characterName => {
            const regex = new RegExp('\\b' + characterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
            if (sceneContent.match(regex)) {
                charactersInScene.push(characterName);
            }
        });
    }

    // Additional fallback: Check scriptMasterContext.characters
    if (charactersInScene.length === 0 && window.scriptMasterContext?.characters) {
        Object.keys(window.scriptMasterContext.characters).forEach(characterName => {
            const regex = new RegExp('\\b' + characterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
            if (sceneContent.match(regex)) {
                charactersInScene.push(characterName);
            }
        });
    }

    console.log('🔍 Character detection from masterContext:', {
        sceneContentLength: sceneContent.length,
        masterContextCharacters: Object.keys(window.masterContext?.characters || {}),
        charactersFound: charactersInScene
    });

    return charactersInScene;
}

/**
 * Render comprehensive scene breakdown
 */
function renderSceneBreakdown(sceneIndex) {
    const scene = state.scenes[sceneIndex];
    const panel = document.getElementById('breakdown-panel');
    if (!scene || !panel) return;

    const breakdown = state.sceneBreakdowns[sceneIndex] || {};

    // FIX: Auto-populate characters from masterContext if not already set
    let characters = breakdown.cast || [];
    if (characters.length === 0 && scene.content) {
        characters = detectCharactersFromMasterContext(scene.content);
        if (characters.length > 0) {
            // Auto-populate breakdown.cast for future renders
            if (!state.sceneBreakdowns[sceneIndex]) {
                state.sceneBreakdowns[sceneIndex] = {};
            }
            state.sceneBreakdowns[sceneIndex].cast = characters;
            saveToLocalStorage();
        }
    }

    const storyDay = scene.storyDay || extractStoryDay(sceneIndex) || '';
    const timeOfDay = scene.timeOfDay || extractTimeFromHeading(scene.heading) || '';

    const analysis = window.scriptMasterContext || window.masterContext || {};
    const alerts = extractSceneAlerts(scene, sceneIndex, analysis);
    const environment = analysis.environments?.[`scene_${sceneIndex}`];
    const emotional = analysis.emotionalBeats?.[`scene_${sceneIndex}`];

    panel.innerHTML = `
        <div class="scene-breakdown-wrapper">
            <!-- Scene Header -->
            <div class="breakdown-scene-header">
                <h3>Scene ${sceneIndex + 1}</h3>
                <div class="scene-heading">${escapeHtml(scene.heading)}</div>
            </div>

            ${alerts.length > 0 ? `
                <div class="alerts-bar">
                    ${alerts.map(alert => `
                        <div class="alert-item ${alert.type}">
                            <span class="alert-icon">${alert.icon}</span>
                            <span class="alert-text">${escapeHtml(alert.text)}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${environment || emotional ? `
                <div class="conditions-section">
                    <h4 class="section-title">SCENE CONDITIONS</h4>
                    ${environment ? `
                        <div class="condition-box">
                            <div class="condition-label">Environment:</div>
                            <div class="condition-tags">
                                ${(Array.isArray(environment.conditions) ? environment.conditions : []).map(c =>
                                    `<div class="condition-tag">${escapeHtml(c)}</div>`
                                ).join('')}
                            </div>
                            ${environment.impactOnAppearance ? `
                                <div class="impact-note">💡 ${escapeHtml(environment.impactOnAppearance)}</div>
                            ` : ''}
                        </div>
                    ` : ''}
                    ${emotional ? `
                        <div class="condition-box">
                            <div class="condition-label">Emotional State:</div>
                            <div class="emotional-info">
                                ${emotional.character ? `<strong>${escapeHtml(emotional.character)}</strong>: ` : ''}
                                ${escapeHtml(emotional.emotion || '')}
                                ${emotional.visualImpact ? `
                                    <div class="impact-note">💄 ${escapeHtml(emotional.visualImpact)}</div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
            ` : ''}

            <!-- TIMELINE SECTION -->
            <div class="breakdown-section timeline-section">
                <h4 class="section-title">TIMELINE</h4>
                <div class="field-row">
                    <div class="field-group">
                        <label>Story Day</label>
                        <input type="text"
                               value="${escapeHtml(storyDay)}"
                               placeholder="Day 1, Day 2, etc."
                               onchange="updateSceneField(${sceneIndex}, 'storyDay', this.value)">
                    </div>
                    <div class="field-group">
                        <label>Time</label>
                        <select onchange="updateSceneField(${sceneIndex}, 'timeOfDay', this.value)">
                            <option value="">Select...</option>
                            <option ${timeOfDay === 'Early Morning' ? 'selected' : ''}>Early Morning</option>
                            <option ${timeOfDay === 'Morning' ? 'selected' : ''}>Morning</option>
                            <option ${timeOfDay === 'Afternoon' ? 'selected' : ''}>Afternoon</option>
                            <option ${timeOfDay === 'Evening' ? 'selected' : ''}>Evening</option>
                            <option ${timeOfDay === 'Night' ? 'selected' : ''}>Night</option>
                        </select>
                    </div>
                </div>
                <div class="field-row">
                    <label class="checkbox-field">
                        <input type="checkbox"
                               ${scene.isFlashback ? 'checked' : ''}
                               onchange="updateSceneField(${sceneIndex}, 'isFlashback', this.checked)">
                        Flashback
                    </label>
                    <label class="checkbox-field">
                        <input type="checkbox"
                               ${scene.isDream ? 'checked' : ''}
                               onchange="updateSceneField(${sceneIndex}, 'isDream', this.checked)">
                        Dream
                    </label>
                </div>
            </div>

            <!-- CHARACTER CONTINUITY SECTION -->
            <div class="breakdown-section character-section">
                <div class="section-header">
                    <h4 class="section-title">CHARACTER CONTINUITY</h4>
                    ${characters.length === 0 ? `
                        <button class="small-btn detect-chars-btn" onclick="detectSceneCharacters(${sceneIndex})">
                            🔍 Detect Characters
                        </button>
                    ` : ''}
                </div>
                ${characters.length > 0 ?
                    characters.map(char => renderCharacterFields(char, sceneIndex, scene)).join('')
                    : `<div class="no-characters">
                        <div>No characters from masterContext found in this scene.</div>
                        <div style="font-size: 0.9em; margin-top: 8px; opacity: 0.7;">
                            Master characters: ${Object.keys(window.masterContext?.characters || {}).length > 0
                                ? Object.keys(window.masterContext.characters).join(', ')
                                : 'None in masterContext'}
                        </div>
                        <div style="font-size: 0.85em; margin-top: 4px; opacity: 0.6;">
                            Scene preview: ${escapeHtml(scene.content?.substring(0, 100) || 'No content')}...
                        </div>
                    </div>`}
            </div>

            <!-- CONTINUITY EVENTS SECTION -->
            <div class="breakdown-section events-section">
                <h4 class="section-title">CONTINUITY EVENTS</h4>
                <div class="event-controls">
                    <button class="small-btn" onclick="startNewEvent(${sceneIndex})">+ Start Event</button>
                    <button class="small-btn" onclick="linkExistingEvent(${sceneIndex})">Link Event</button>
                </div>
                <div id="scene-events">
                    ${renderSceneEvents(sceneIndex)}
                </div>
            </div>

            <!-- NAVIGATION -->
            <div class="breakdown-nav">
                <button onclick="navigateToScene(${sceneIndex - 1})"
                        ${sceneIndex === 0 ? 'disabled' : ''}>
                    ← Previous
                </button>
                <span>${sceneIndex + 1} / ${state.scenes.length}</span>
                <button onclick="navigateToScene(${sceneIndex + 1})"
                        ${sceneIndex >= state.scenes.length - 1 ? 'disabled' : ''}>
                    Next →
                </button>
            </div>
        </div>
    `;
}

// ============================================================================
// CHARACTER FIELDS RENDERING
// ============================================================================

/**
 * Render character continuity fields with streamlined "No Change" workflow
 */
function renderCharacterFields(character, sceneIndex, scene) {
    const charData = state.characterStates[sceneIndex]?.[character] || {};
    const prevScene = findPreviousCharacterAppearance(character, sceneIndex);
    const suggestions = extractSuggestionsFromTags(sceneIndex, character);

    // Character ID for HTML elements
    const charId = sanitizeCharacterId(character);

    // Get appearance data
    const enterHair = charData.enterHair || suggestions.hair || '';
    const enterMakeup = charData.enterMakeup || suggestions.makeup || '';
    const enterWardrobe = charData.enterWardrobe || suggestions.wardrobe || '';

    // Change status
    const changeStatus = charData.changeStatus || 'no-change';
    const hasChanges = changeStatus === 'has-changes';

    // Changes data
    const changeHair = charData.changeHair || '';
    const changeMakeup = charData.changeMakeup || '';
    const changeWardrobe = charData.changeWardrobe || '';
    const changeInjuries = charData.changeInjuries || '';
    const changeDirt = charData.changeDirt || '';

    // Exit appearance (calculated or manual)
    const exitHair = charData.exitHair || enterHair;
    const exitMakeup = charData.exitMakeup || enterMakeup;
    const exitWardrobe = charData.exitWardrobe || enterWardrobe;

    // Build entry tags
    const entryTags = [];
    if (enterHair) entryTags.push(`Hair: ${enterHair}`);
    if (enterMakeup) entryTags.push(`Makeup: ${enterMakeup}`);
    if (enterWardrobe) entryTags.push(`Wardrobe: ${enterWardrobe}`);

    // Build exit tags (show if different from entry)
    const exitTags = [];
    if (hasChanges || exitHair !== enterHair) exitTags.push(`Hair: ${exitHair}`);
    if (hasChanges || exitMakeup !== enterMakeup) exitTags.push(`Makeup: ${exitMakeup}`);
    if (hasChanges || exitWardrobe !== enterWardrobe) exitTags.push(`Wardrobe: ${exitWardrobe}`);

    return `
        <div class="character-profile" data-character="${escapeHtml(character)}">
            <!-- Header with character name and copy button -->
            <div class="character-profile-header">
                <div class="character-name">${escapeHtml(character)}</div>
                <button class="copy-previous-btn"
                        onclick="copyPreviousAppearance('${escapeHtml(character).replace(/'/g, "\\'")}', ${sceneIndex})"
                        ${!prevScene ? 'disabled' : ''}
                        title="${prevScene ? `Copy from Scene ${prevScene + 1}` : 'No previous appearance'}">
                    ${prevScene !== null ? '↓ Copy Previous' : 'First Appearance'}
                </button>
            </div>

            <!-- ENTERS WITH -->
            <div class="continuity-section">
                <div class="continuity-section-header">
                    <div class="continuity-label">ENTERS WITH</div>
                </div>
                ${entryTags.length > 0 ? `
                    <div class="continuity-tags" id="enters-tags-${charId}">
                        ${entryTags.map(tag => `<span class="continuity-tag">${escapeHtml(tag)}</span>`).join('')}
                    </div>
                ` : `
                    <div class="continuity-empty">
                        Click "Copy Previous" or enter appearance below
                    </div>
                `}
                <div class="continuity-entry-fields">
                    <input type="text" placeholder="Hair..." value="${escapeHtml(enterHair)}"
                           onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'enterHair', this.value)">
                    <input type="text" placeholder="Makeup..." value="${escapeHtml(enterMakeup)}"
                           onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'enterMakeup', this.value)">
                    <input type="text" placeholder="Wardrobe..." value="${escapeHtml(enterWardrobe)}"
                           onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'enterWardrobe', this.value)">
                </div>
            </div>

            <!-- CHANGES -->
            <div class="continuity-section">
                <div class="continuity-section-header">
                    <div class="continuity-label">CHANGES</div>
                    <div class="continuity-actions">
                        <button class="continuity-btn no-change-btn ${!hasChanges ? 'active' : ''}"
                                onclick="setNoChange('${escapeHtml(character).replace(/'/g, "\\'")}', ${sceneIndex})">
                            No Change
                        </button>
                        <button class="continuity-btn change-btn ${hasChanges ? 'active' : ''}"
                                onclick="showChangeFields('${escapeHtml(character).replace(/'/g, "\\'")}', ${sceneIndex})">
                            Change
                        </button>
                    </div>
                </div>

                <!-- Change fields (shown when has-changes) -->
                <div class="change-fields" id="change-fields-${charId}" style="display: ${hasChanges ? 'block' : 'none'};">
                    <div class="change-category">
                        <label>Hair</label>
                        <textarea placeholder="Describe hair changes..."
                                  onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'changeHair', this.value)">${escapeHtml(changeHair)}</textarea>
                    </div>
                    <div class="change-category">
                        <label>Makeup</label>
                        <textarea placeholder="Describe makeup changes..."
                                  onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'changeMakeup', this.value)">${escapeHtml(changeMakeup)}</textarea>
                    </div>
                    <div class="change-category">
                        <label>Wardrobe</label>
                        <textarea placeholder="Describe wardrobe changes..."
                                  onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'changeWardrobe', this.value)">${escapeHtml(changeWardrobe)}</textarea>
                    </div>
                    <div class="change-category">
                        <label>Injuries/Blood</label>
                        <textarea placeholder="New injuries, blood, etc..."
                                  onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'changeInjuries', this.value)">${escapeHtml(changeInjuries)}</textarea>
                    </div>
                    <div class="change-category">
                        <label>Dirt/Damage</label>
                        <textarea placeholder="Dirt, damage, wear..."
                                  onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'changeDirt', this.value)">${escapeHtml(changeDirt)}</textarea>
                    </div>
                </div>
            </div>

            <!-- EXITS WITH -->
            <div class="continuity-section">
                <div class="continuity-section-header">
                    <div class="continuity-label">EXITS WITH</div>
                    <div class="continuity-status" id="exit-status-${charId}">
                        ${hasChanges ? 'Entry + changes' : 'Same as entry'}
                    </div>
                </div>
                <div class="continuity-tags" id="exits-tags-${charId}" style="display: ${hasChanges || exitTags.length > 0 ? 'flex' : 'none'};">
                    ${exitTags.map(tag => `<span class="continuity-tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
            </div>

            <!-- ACTIVE CONTINUITY EVENTS -->
            ${renderActiveEvents(character, sceneIndex)}
        </div>
    `;
}

/**
 * Render active continuity events for a character in current scene
 */
function renderActiveEvents(character, sceneIndex) {
    // Get all events for this character that are active in this scene
    const activeEvents = getActiveEventsForCharacter(character, sceneIndex);

    if (activeEvents.length === 0) {
        return `
            <div class="active-events-section">
                <div class="section-label">CONTINUITY EVENTS</div>
                <button class="add-event-btn" onclick="createContinuityEvent('${escapeHtml(character).replace(/'/g, "\\'")}', ${sceneIndex})">
                    + Create Event
                </button>
            </div>
        `;
    }

    return `
        <div class="active-events-section">
            <div class="section-header-with-btn">
                <div class="section-label">ACTIVE EVENTS</div>
                <button class="add-event-btn small" onclick="createContinuityEvent('${escapeHtml(character).replace(/'/g, "\\'")}', ${sceneIndex})">
                    + New
                </button>
            </div>
            ${activeEvents.map(event => renderEventCard(event, sceneIndex)).join('')}
        </div>
    `;
}

/**
 * Render a single event card
 */
function renderEventCard(event, sceneIndex) {
    // Get current scene's observation if it exists
    const currentObs = event.observations.find(o => o.scene === sceneIndex);
    const currentNote = currentObs ? currentObs.description : '';

    // Get visibility info for current scene
    const visInfo = event.visibility?.find(v => v.scene === sceneIndex);
    const isHidden = visInfo?.status === 'hidden';
    const coverage = visInfo?.coverage || '';
    const coverageNote = visInfo?.note || '';

    const sceneRange = event.endScene
        ? `Scenes ${event.startScene + 1}-${event.endScene + 1}`
        : `Started Scene ${event.startScene + 1} • Active`;

    return `
        <div class="event-card" data-event-id="${event.id}">
            <div class="event-header">
                <div class="event-info">
                    <div class="event-name">${escapeHtml(event.name)}</div>
                    <div class="event-meta">${sceneRange}</div>
                </div>
                <button class="event-menu-btn" onclick="toggleEventMenu('${event.id}')">⋮</button>
            </div>

            <div class="event-current-state">
                <div class="event-label">Scene ${sceneIndex + 1} Status:</div>
                <textarea class="event-note"
                          placeholder="Describe appearance/condition in this scene..."
                          onchange="updateEventNote('${event.id}', ${sceneIndex}, this.value)">${escapeHtml(currentNote)}</textarea>
            </div>

            <!-- Visibility Tracking -->
            <div class="event-visibility">
                <label class="visibility-checkbox">
                    <input type="checkbox"
                           ${isHidden ? 'checked' : ''}
                           onchange="toggleVisibility('${event.id}', ${sceneIndex}, this.checked)">
                    <span>Hidden/Covered in this scene</span>
                </label>

                ${isHidden ? `
                    <div class="visibility-details">
                        <label class="visibility-label">Coverage Type:</label>
                        <select class="visibility-select"
                                onchange="setCoverage('${event.id}', ${sceneIndex}, this.value)">
                            <option value="">Select...</option>
                            <option value="bandage" ${coverage === 'bandage' ? 'selected' : ''}>Bandage</option>
                            <option value="clothing" ${coverage === 'clothing' ? 'selected' : ''}>Clothing</option>
                            <option value="hat" ${coverage === 'hat' ? 'selected' : ''}>Hat</option>
                            <option value="makeup" ${coverage === 'makeup' ? 'selected' : ''}>Makeup/Concealer</option>
                            <option value="other" ${coverage === 'other' ? 'selected' : ''}>Other</option>
                        </select>

                        ${coverage === 'other' || coverageNote ? `
                            <input type="text"
                                   class="visibility-note"
                                   placeholder="Specify coverage details..."
                                   value="${escapeHtml(coverageNote)}"
                                   onchange="setCoverageNote('${event.id}', ${sceneIndex}, this.value)">
                        ` : ''}
                    </div>
                ` : ''}
            </div>

            <div class="event-actions">
                <button class="event-btn" onclick="viewEventTimeline('${event.id}')">
                    📊 Timeline
                </button>
                ${!event.endScene ? `
                    <button class="event-btn end-event-btn" onclick="endContinuityEvent('${event.id}', ${sceneIndex})">
                        End Event
                    </button>
                ` : `
                    <span class="event-status-badge">Completed</span>
                `}
            </div>
        </div>
    `;
}

/**
 * Get active events for a character in a given scene
 */
function getActiveEventsForCharacter(character, sceneIndex) {
    // DEFENSIVE: Ensure state exists
    if (!state) {
        console.warn('⚠️ scriptBreakdownState not initialized');
        return [];
    }

    // DEFENSIVE: Ensure continuityEvents is an array
    if (!state.continuityEvents) {
        console.warn('⚠️ continuityEvents missing, initializing');
        state.continuityEvents = [];
    }

    if (!Array.isArray(state.continuityEvents)) {
        console.error('❌ continuityEvents is not an array:', typeof state.continuityEvents);
        state.continuityEvents = [];
    }

    return state.continuityEvents.filter(event =>
        event.character === character &&
        event.startScene <= sceneIndex &&
        (!event.endScene || event.endScene >= sceneIndex)
    );
}

/**
 * Sanitize character name for use in HTML IDs
 */
function sanitizeCharacterId(name) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/**
 * Render scene events list
 */
function renderSceneEvents(sceneIndex) {
    const events = Array.from(window.continuityTracker?.events?.values() || []);
    const sceneEvents = events.filter(e =>
        sceneIndex >= e.startScene && (!e.endScene || sceneIndex <= e.endScene)
    );

    if (sceneEvents.length === 0) {
        return '<div class="no-events">No active continuity events</div>';
    }

    return sceneEvents.map(event => {
        const canEnd = !event.endScene && sceneIndex > event.startScene;
        const hasProgression = event.progression && event.progression.length > 0;

        let currentStage = '';
        if (hasProgression) {
            const stageIndex = sceneIndex - event.startScene;
            if (stageIndex >= 0 && stageIndex < event.progression.length) {
                currentStage = event.progression[stageIndex];
            }
        }

        return `
            <div class="event-item">
                <div class="event-header">
                    <span class="event-type-badge">${escapeHtml(event.type)}</span>
                    <span class="event-character-name">${escapeHtml(event.character)}</span>
                    ${canEnd ? `
                        <button class="event-action-btn"
                                onclick="endEventAtScene('${event.id}', ${sceneIndex})"
                                title="End event at this scene">
                            ✓ End Here
                        </button>
                    ` : ''}
                </div>
                <div class="event-description">${escapeHtml(event.description)}</div>
                ${currentStage ? `
                    <div class="event-current-stage">
                        <strong>Current stage:</strong> ${escapeHtml(currentStage)}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract story day from master context timeline
 */
function extractStoryDay(sceneIndex) {
    if (!window.masterContext?.storyStructure?.timeline) return '';

    const timeline = window.masterContext.storyStructure.timeline;
    const sceneNumber = state.scenes[sceneIndex]?.number;

    if (!sceneNumber) return '';

    for (const day of timeline) {
        if (day.scenes && day.scenes.includes(sceneNumber)) {
            return day.day || '';
        }
    }

    return '';
}

/**
 * Extract time of day from scene heading
 */
function extractTimeFromHeading(heading) {
    if (!heading) return '';
    const upper = heading.toUpperCase();

    if (upper.includes('EARLY MORNING')) return 'Early Morning';
    if (upper.includes('MORNING')) return 'Morning';
    if (upper.includes('AFTERNOON')) return 'Afternoon';
    if (upper.includes('EVENING') || upper.includes('DUSK')) return 'Evening';
    if (upper.includes('NIGHT')) return 'Night';
    if (upper.includes('DAY') && !upper.includes('HOLIDAY')) return 'Afternoon';

    return '';
}

/**
 * Extract scene alerts from master context
 */
function extractSceneAlerts(scene, sceneIndex, analysis) {
    const alerts = [];

    const environment = analysis.environments?.[`scene_${sceneIndex}`];
    if (environment?.conditions) {
        const conditions = Array.isArray(environment.conditions) ? environment.conditions : [];
        if (conditions.some(c => c.toLowerCase().includes('rain'))) {
            alerts.push({ type: 'weather', icon: '🌧️', text: 'Rain - waterproof makeup needed' });
        }
        if (conditions.some(c => c.toLowerCase().includes('wind'))) {
            alerts.push({ type: 'weather', icon: '💨', text: 'Wind - hair protection needed' });
        }
    }

    const interactions = analysis.interactions?.[`scene_${sceneIndex}`];
    if (interactions?.type === 'fight') {
        alerts.push({ type: 'action', icon: '⚔️', text: 'Fight scene - injury makeup may be needed' });
    }

    return alerts;
}

/**
 * Extract AI suggestions from tags for a character
 */
function extractSuggestionsFromTags(sceneIndex, character) {
    const sceneTags = state.scriptTags[sceneIndex] || [];
    const suggestions = {
        hair: '',
        makeup: '',
        wardrobe: '',
        changes: []
    };

    sceneTags.forEach(tag => {
        if (tag.character === character) {
            const text = tag.selectedText || tag.notes || '';
            if (tag.category === 'hair' && !suggestions.hair) {
                suggestions.hair = text;
            } else if (tag.category === 'makeup' && !suggestions.makeup) {
                suggestions.makeup = text;
            } else if (tag.category === 'wardrobe' && !suggestions.wardrobe) {
                suggestions.wardrobe = text;
            } else if (['injuries', 'sfx', 'health'].includes(tag.category)) {
                suggestions.changes.push(text);
            }
        }
    });

    return suggestions;
}

/**
 * Find previous appearance of character
 */
function findPreviousCharacterAppearance(character, currentSceneIndex) {
    for (let i = currentSceneIndex - 1; i >= 0; i--) {
        const breakdown = state.sceneBreakdowns[i];
        if (breakdown?.cast?.includes(character) && state.characterStates[i]?.[character]) {
            return state.characterStates[i][character];
        }
    }
    return null;
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

/**
 * Save to localStorage
 */
function saveToLocalStorage() {
    import('./export-handlers.js').then(module => module.saveProject());
}

// ============================================================================
// WINDOW EVENT HANDLERS
// ============================================================================

/**
 * Detect characters in scene content using pattern matching
 * @param {string} sceneContent - Scene content text
 * @returns {Set} Set of detected character names
 */
function detectCharactersFromContent(sceneContent) {
    const characters = new Set();
    const lines = sceneContent.split('\n');

    for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        const nextLine = lines[i + 1]?.trim();

        if (!line || !nextLine) continue;

        // Character name pattern: all caps, not too long, not scene headings
        if (line.length > 1 && line.length < 50 &&
            line === line.toUpperCase() &&
            !line.startsWith('INT') && !line.startsWith('EXT') &&
            !line.includes('CUT TO') && !line.includes('FADE') &&
            !line.includes('CONTINUOUS') &&
            !line.includes('DISSOLVE') && !line.includes('SMASH CUT')) {

            let cleanName = line
                .replace(/\s*\(.*?\)\s*/g, '')
                .replace(/\s*\(V\.O\.\)\s*/gi, '')
                .replace(/\s*\(O\.S\.\)\s*/gi, '')
                .replace(/\s*\(O\.C\.\)\s*/gi, '')
                .replace(/\s*\(CONT'D\)\s*/gi, '')
                .replace(/\s*\(CONT\.\)\s*/gi, '')
                .trim();

            // Validate character name format
            if (cleanName.match(/^[A-Z][A-Z\s\.\-\']{1,35}$/)) {
                characters.add(cleanName);
            }
        }
    }

    return characters;
}

/**
 * Manually detect characters in a single scene
 */
window.detectSceneCharacters = function(sceneIndex) {
    const scene = state.scenes[sceneIndex];
    if (!scene || !scene.content) {
        alert('No scene content available');
        return;
    }

    console.log(`🔍 Manually detecting characters for scene ${sceneIndex}...`);

    const characters = detectCharactersFromContent(scene.content);

    if (characters.size === 0) {
        alert('No characters detected. Characters must be in ALL CAPS in the script.');
        return;
    }

    // Add to global characters
    characters.forEach(char => {
        if (state.characters) {
            state.characters.add(char);
        }
    });

    // Update breakdown
    if (!state.sceneBreakdowns[sceneIndex]) {
        state.sceneBreakdowns[sceneIndex] = {};
    }
    state.sceneBreakdowns[sceneIndex].cast = Array.from(characters);

    console.log(`✅ Detected ${characters.size} characters:`, Array.from(characters));

    // Save and re-render
    saveToLocalStorage();
    renderSceneBreakdown(sceneIndex);

    alert(`Detected ${characters.size} character(s): ${Array.from(characters).join(', ')}`);
};

/**
 * Detect characters across all scenes in the script
 */
window.detectAllCharacters = function() {
    if (!state.scenes || state.scenes.length === 0) {
        alert('No scenes loaded. Please import a script first.');
        return;
    }

    console.log('🔍 Detecting characters across all scenes...');

    let totalCharactersDetected = 0;
    let scenesWithCharacters = 0;
    const allCharacters = new Set();

    state.scenes.forEach((scene, index) => {
        if (!scene.content) return;

        const sceneCharacters = detectCharactersFromContent(scene.content);

        if (sceneCharacters.size > 0) {
            // Update breakdown for this scene
            if (!state.sceneBreakdowns[index]) {
                state.sceneBreakdowns[index] = {};
            }
            state.sceneBreakdowns[index].cast = Array.from(sceneCharacters);

            totalCharactersDetected += sceneCharacters.size;
            scenesWithCharacters++;

            // Add to global characters
            sceneCharacters.forEach(char => {
                allCharacters.add(char);
                if (state.characters) {
                    state.characters.add(char);
                }
            });

            console.log(`  Scene ${scene.number}: ${sceneCharacters.size} characters -`, Array.from(sceneCharacters).join(', '));
        }
    });

    console.log(`✅ Detection complete:`);
    console.log(`  - Unique characters found: ${allCharacters.size}`);
    console.log(`  - Scenes with characters: ${scenesWithCharacters}`);
    console.log(`  - Characters:`, Array.from(allCharacters).join(', '));

    // Save
    saveToLocalStorage();

    // Refresh current view if viewing a scene
    if (state.currentScene !== null) {
        renderSceneBreakdown(state.currentScene);
    }

    alert(`Character Detection Complete!\n\n` +
          `Found ${allCharacters.size} unique characters across ${scenesWithCharacters} scenes.\n\n` +
          `Characters: ${Array.from(allCharacters).join(', ')}`);
};

/**
 * Update scene field
 */
window.updateSceneField = function(sceneIndex, field, value) {
    if (!state.scenes[sceneIndex]) return;
    state.scenes[sceneIndex][field] = value;
    saveToLocalStorage();
};

/**
 * Update character field
 */
window.updateCharField = function(sceneIndex, character, field, value) {
    const scene = state.scenes[sceneIndex];
    if (!scene) return;

    if (!state.characterStates[sceneIndex]) state.characterStates[sceneIndex] = {};
    if (!state.characterStates[sceneIndex][character]) state.characterStates[sceneIndex][character] = {};

    state.characterStates[sceneIndex][character][field] = value;
    saveToLocalStorage();
};

/**
 * Copy character state from previous scene
 */
window.copyFromPrevious = function(character, sceneIndex) {
    const prevState = findPreviousCharacterAppearance(character, sceneIndex);
    if (!prevState) {
        alert('No previous appearance found for ' + character);
        return;
    }

    if (!state.characterStates[sceneIndex]) {
        state.characterStates[sceneIndex] = {};
    }
    if (!state.characterStates[sceneIndex][character]) {
        state.characterStates[sceneIndex][character] = {};
    }

    state.characterStates[sceneIndex][character] = {
        ...state.characterStates[sceneIndex][character],
        enterHair: prevState.exitHair || prevState.enterHair || prevState.hair || '',
        enterMakeup: prevState.exitMakeup || prevState.enterMakeup || prevState.makeup || '',
        enterWardrobe: prevState.exitWardrobe || prevState.enterWardrobe || prevState.wardrobe || '',
        enterCondition: prevState.exitCondition || prevState.enterCondition || ''
    };

    renderSceneBreakdown(sceneIndex);
    saveToLocalStorage();
};

/**
 * Start new continuity event
 */
window.startNewEvent = function(sceneIndex) {
    const breakdown = state.sceneBreakdowns[sceneIndex];
    const cast = breakdown?.cast || [];

    if (cast.length === 0) {
        alert('No characters in this scene. Add characters first.');
        return;
    }

    const character = prompt(`Character name (${cast.join(', ')}):`);
    if (!character || !cast.includes(character)) {
        alert('Invalid character name');
        return;
    }

    const type = prompt('Event type (injury, condition, transformation, wardrobe_change):');
    if (!type) return;

    const description = prompt('Description:');
    if (!description) return;

    if (window.continuityTracker) {
        window.continuityTracker.createEvent(sceneIndex, character, type, description);
        renderSceneBreakdown(sceneIndex);
        saveToLocalStorage();
    } else {
        alert('Continuity tracker not available');
    }
};

/**
 * Link to existing event
 */
window.linkExistingEvent = function(sceneIndex) {
    alert('Feature coming soon: Link this scene to an existing continuity event');
};

/**
 * End continuity event at a specific scene
 */
window.endEventAtScene = function(eventId, sceneIndex) {
    if (!window.continuityTracker) {
        alert('Continuity tracker not available');
        return;
    }

    const events = Array.from(window.continuityTracker.events.values());
    const event = events.find(e => e.id === eventId);

    if (!event) {
        alert('Event not found');
        return;
    }

    if (confirm(`End "${event.description}" at Scene ${sceneIndex + 1}?`)) {
        event.endScene = sceneIndex;
        window.continuityTracker.events.set(eventId, event);
        renderSceneBreakdown(sceneIndex);
        saveToLocalStorage();
    }
};

// ============================================================================
// STREAMLINED CONTINUITY WORKFLOW FUNCTIONS
// ============================================================================

/**
 * Copy previous scene's exit appearance to current entry
 */
window.copyPreviousAppearance = function(character, sceneIndex) {
    const prevScene = findPreviousCharacterAppearance(character, sceneIndex);

    if (prevScene === null) {
        alert(`${character} has no previous appearance to copy from`);
        return;
    }

    const prevState = state.characterStates[prevScene]?.[character];
    if (!prevState) {
        alert(`No previous appearance data found for ${character} in Scene ${prevScene + 1}`);
        return;
    }

    // Initialize current scene's character state
    if (!state.characterStates[sceneIndex]) {
        state.characterStates[sceneIndex] = {};
    }
    if (!state.characterStates[sceneIndex][character]) {
        state.characterStates[sceneIndex][character] = {};
    }

    // Copy exit appearance from previous scene to entry of current scene
    state.characterStates[sceneIndex][character] = {
        ...state.characterStates[sceneIndex][character],
        enterHair: prevState.exitHair || prevState.enterHair || '',
        enterMakeup: prevState.exitMakeup || prevState.enterMakeup || '',
        enterWardrobe: prevState.exitWardrobe || prevState.enterWardrobe || ''
    };

    console.log(`✅ Copied ${character}'s appearance from Scene ${prevScene + 1} to Scene ${sceneIndex + 1}`);

    renderSceneBreakdown(sceneIndex);
    saveToLocalStorage();
};

/**
 * Set "No Change" mode - exit = entry
 */
window.setNoChange = function(character, sceneIndex) {
    // Initialize state if needed
    if (!state.characterStates[sceneIndex]) {
        state.characterStates[sceneIndex] = {};
    }
    if (!state.characterStates[sceneIndex][character]) {
        state.characterStates[sceneIndex][character] = {};
    }

    const charState = state.characterStates[sceneIndex][character];

    // Set changeStatus to no-change
    charState.changeStatus = 'no-change';

    // Copy entry to exit (no changes)
    charState.exitHair = charState.enterHair || '';
    charState.exitMakeup = charState.enterMakeup || '';
    charState.exitWardrobe = charState.enterWardrobe || '';

    // Clear change fields
    charState.changeHair = '';
    charState.changeMakeup = '';
    charState.changeWardrobe = '';
    charState.changeInjuries = '';
    charState.changeDirt = '';

    console.log(`✅ ${character}: No change in Scene ${sceneIndex + 1}`);

    renderSceneBreakdown(sceneIndex);
    saveToLocalStorage();
};

/**
 * Show change fields - user will document changes
 */
window.showChangeFields = function(character, sceneIndex) {
    // Initialize state if needed
    if (!state.characterStates[sceneIndex]) {
        state.characterStates[sceneIndex] = {};
    }
    if (!state.characterStates[sceneIndex][character]) {
        state.characterStates[sceneIndex][character] = {};
    }

    // Set changeStatus to has-changes
    state.characterStates[sceneIndex][character].changeStatus = 'has-changes';

    console.log(`📝 ${character}: Recording changes in Scene ${sceneIndex + 1}`);

    renderSceneBreakdown(sceneIndex);
    saveToLocalStorage();
};

// ============================================================================
// CONTINUITY EVENT MANAGEMENT
// ============================================================================

/**
 * Auto-detect which scenes a character appears in based on scene breakdowns
 * @param {string} character - Character name
 * @returns {number[]} - Array of scene indices where character appears
 */
function detectActorPresenceForCharacter(character) {
    const scenes = [];

    // Scan all scene breakdowns for character presence
    state.sceneBreakdowns.forEach((breakdown, index) => {
        if (breakdown && breakdown.cast && breakdown.cast.includes(character)) {
            scenes.push(index);
        }
    });

    console.log(`🎬 Detected ${character} in scenes:`, scenes.map(s => s + 1).join(', '));

    return scenes;
}

/**
 * Update actor presence for an existing event (when scene breakdowns change)
 * @param {string} eventId - Event ID to update
 */
function updateEventActorPresence(eventId) {
    const event = state.continuityEvents.find(e => e.id === eventId);
    if (!event) return;

    const newPresence = detectActorPresenceForCharacter(event.character);

    // Filter to scenes within event range
    const filteredPresence = newPresence.filter(scene =>
        scene >= event.startScene &&
        (!event.endScene || scene <= event.endScene)
    );

    // Update actorPresence
    event.actorPresence = filteredPresence;

    // Add visibility entries for new scenes (default: visible)
    filteredPresence.forEach(sceneNum => {
        const existingVis = event.visibility.find(v => v.scene === sceneNum);
        if (!existingVis) {
            event.visibility.push({
                scene: sceneNum,
                status: 'visible',
                coverage: null,
                note: ''
            });
        }
    });

    // Sort visibility by scene
    event.visibility.sort((a, b) => a.scene - b.scene);

    saveToLocalStorage();
    console.log(`✅ Updated actor presence for event: ${event.name}`);
}

/**
 * Create a new continuity event
 */
window.createContinuityEvent = function(character, sceneIndex) {
    // Store character and scene for modal
    window.currentEventCharacter = character;
    window.currentEventScene = sceneIndex;

    // Open create event modal
    document.getElementById('event-character-name').textContent = character;
    document.getElementById('event-start-scene').value = sceneIndex + 1;
    document.getElementById('create-event-modal').style.display = 'flex';
};

/**
 * Confirm creating a continuity event
 */
window.confirmCreateEvent = function() {
    const name = document.getElementById('event-name').value.trim();
    const category = document.getElementById('event-category').value;
    const startScene = parseInt(document.getElementById('event-start-scene').value) - 1; // Convert to 0-index
    const initialDescription = document.getElementById('event-initial-description').value.trim();

    if (!name) {
        alert('Please enter an event name');
        return;
    }

    if (!initialDescription) {
        alert('Please enter an initial description');
        return;
    }

    // Auto-detect actor presence from scene breakdowns
    const actorPresence = detectActorPresenceForCharacter(window.currentEventCharacter);

    const event = {
        id: `event-${Date.now()}`,
        character: window.currentEventCharacter,
        name: name,
        category: category,
        startScene: startScene,
        endScene: null,
        status: 'active',
        observations: [
            {
                scene: startScene,
                description: initialDescription,
                type: 'logged',
                timestamp: Date.now()
            }
        ],
        timeline: [],

        // NEW: Auto-detected actor presence
        actorPresence: actorPresence,

        // NEW: Visibility tracking
        visibility: actorPresence.map(sceneNum => ({
            scene: sceneNum,
            status: 'visible',
            coverage: null,
            note: ''
        })),

        // NEW: Script references (tags linked to this event)
        keyScenes: []
    };

    // Initialize continuityEvents if needed
    if (!state.continuityEvents) {
        state.continuityEvents = [];
    }

    // Add event
    state.continuityEvents.push(event);

    // Save to localStorage
    saveToLocalStorage();

    console.log(`✅ Created event: ${event.name} for ${event.character}`);

    // Close modal
    closeCreateEventModal();

    // Refresh scene breakdown
    renderSceneBreakdown(state.currentScene);
};

/**
 * Close create event modal
 */
window.closeCreateEventModal = function() {
    document.getElementById('create-event-modal').style.display = 'none';
    // Clear form
    document.getElementById('event-name').value = '';
    document.getElementById('event-initial-description').value = '';
};

/**
 * Update event note for current scene
 */
window.updateEventNote = function(eventId, sceneIndex, note) {
    if (!state.continuityEvents) return;

    const event = state.continuityEvents.find(e => e.id === eventId);
    if (!event) return;

    // Find or create observation for current scene
    let obs = event.observations.find(o => o.scene === sceneIndex);

    if (obs) {
        obs.description = note;
    } else {
        event.observations.push({
            scene: sceneIndex,
            description: note,
            type: 'logged',
            timestamp: Date.now()
        });
    }

    // Sort observations by scene
    event.observations.sort((a, b) => a.scene - b.scene);

    saveToLocalStorage();
    console.log(`📝 Updated ${event.name} for Scene ${sceneIndex + 1}`);
};

/**
 * Toggle visibility status for an event in a specific scene
 */
window.toggleVisibility = function(eventId, sceneIndex, isHidden) {
    const event = state.continuityEvents.find(e => e.id === eventId);
    if (!event) return;

    // Initialize visibility array if needed
    if (!event.visibility) {
        event.visibility = [];
    }

    // Find or create visibility entry for this scene
    let visEntry = event.visibility.find(v => v.scene === sceneIndex);

    if (!visEntry) {
        visEntry = {
            scene: sceneIndex,
            status: 'visible',
            coverage: null,
            note: ''
        };
        event.visibility.push(visEntry);
        event.visibility.sort((a, b) => a.scene - b.scene);
    }

    // Update status
    visEntry.status = isHidden ? 'hidden' : 'visible';

    // Clear coverage if not hidden
    if (!isHidden) {
        visEntry.coverage = null;
        visEntry.note = '';
    }

    saveToLocalStorage();
    renderSceneBreakdown(state.currentScene);
    console.log(`👁️ ${event.name}: ${isHidden ? 'Hidden' : 'Visible'} in Scene ${sceneIndex + 1}`);
};

/**
 * Set coverage type for a hidden event
 */
window.setCoverage = function(eventId, sceneIndex, coverage) {
    const event = state.continuityEvents.find(e => e.id === eventId);
    if (!event) return;

    const visEntry = event.visibility.find(v => v.scene === sceneIndex);
    if (!visEntry) return;

    visEntry.coverage = coverage;

    saveToLocalStorage();
    renderSceneBreakdown(state.currentScene);
    console.log(`🩹 ${event.name}: Coverage set to "${coverage}" in Scene ${sceneIndex + 1}`);
};

/**
 * Set coverage note for a hidden event
 */
window.setCoverageNote = function(eventId, sceneIndex, note) {
    const event = state.continuityEvents.find(e => e.id === eventId);
    if (!event) return;

    const visEntry = event.visibility.find(v => v.scene === sceneIndex);
    if (!visEntry) return;

    visEntry.note = note;

    saveToLocalStorage();
    console.log(`📝 ${event.name}: Coverage note updated for Scene ${sceneIndex + 1}`);
};

/**
 * End a continuity event
 */
window.endContinuityEvent = function(eventId, sceneIndex) {
    const description = prompt('Describe the final state of this event:');

    if (!description) return;

    const event = state.continuityEvents.find(e => e.id === eventId);
    if (!event) return;

    event.endScene = sceneIndex;
    event.status = 'completed';

    // Add final observation
    event.observations.push({
        scene: sceneIndex,
        description: description,
        type: 'logged',
        timestamp: Date.now()
    });

    saveToLocalStorage();

    console.log(`✅ Ended event: ${event.name} at Scene ${sceneIndex + 1}`);

    // Refresh scene breakdown
    renderSceneBreakdown(state.currentScene);
};

/**
 * View event timeline
 */
window.viewEventTimeline = function(eventId) {
    const event = state.continuityEvents.find(e => e.id === eventId);
    if (!event) return;

    // Store current event ID
    window.currentTimelineEvent = eventId;

    // Populate timeline modal
    document.getElementById('timeline-event-name').textContent = `${event.name} Timeline`;
    document.getElementById('timeline-character').textContent = event.character;
    document.getElementById('timeline-category').textContent = event.category;
    document.getElementById('timeline-range').textContent = event.endScene
        ? `${event.startScene + 1} - ${event.endScene + 1}`
        : `${event.startScene + 1} - present`;
    document.getElementById('timeline-status').textContent = event.status;

    // Render timeline view
    renderTimelineEntries(event);

    // Show modal
    document.getElementById('event-timeline-modal').style.display = 'flex';
};

/**
 * Render timeline entries in three-column view
 */
function renderTimelineEntries(event) {
    // Render Timeline column
    renderTimelineColumn(event);

    // Render Actor Presence column
    renderActorPresenceColumn(event);

    // Render Key Scenes column
    renderKeyScenesColumn(event);
}

/**
 * Render Timeline column (logged + generated observations)
 */
function renderTimelineColumn(event) {
    const container = document.getElementById('timeline-column');
    if (!container) return;

    const endScene = event.endScene || state.scenes.length - 1;
    let html = '';
    let lastLoggedScene = event.startScene - 1;

    // Sort observations by scene
    const sortedObs = [...event.observations].sort((a, b) => a.scene - b.scene);

    sortedObs.forEach((obs, index) => {
        // Check if there's a gap between this and previous observation
        if (obs.scene > lastLoggedScene + 1) {
            const gapStart = lastLoggedScene + 1;
            const gapEnd = obs.scene - 1;
            const sceneList = [];
            for (let i = gapStart; i <= gapEnd; i++) {
                sceneList.push(i + 1);
            }

            html += `
                <div class="timeline-gap">
                    <div class="gap-indicator">Scenes ${sceneList.join(', ')}</div>
                </div>
            `;

            // Show generated entries for this gap if they exist
            const generated = (event.timeline || event.generatedTimeline || [])
                .filter(g => g.scene >= gapStart && g.scene <= gapEnd);
            generated.forEach(gen => {
                html += `
                    <div class="timeline-entry generated">
                        <div class="timeline-scene">Scene ${gen.scene + 1}</div>
                        <div class="timeline-badge">AI GENERATED</div>
                        <div class="timeline-description">${escapeHtml(gen.description)}</div>
                    </div>
                `;
            });
        }

        // Add logged observation
        html += `
            <div class="timeline-entry logged">
                <div class="timeline-scene">Scene ${obs.scene + 1}</div>
                <div class="timeline-badge">LOGGED</div>
                <div class="timeline-description">${escapeHtml(obs.description)}</div>
            </div>
        `;

        lastLoggedScene = obs.scene;
    });

    if (html === '') {
        html = '<div class="column-empty">No timeline entries yet</div>';
    }

    container.innerHTML = html;
}

/**
 * Render Actor Presence column
 */
function renderActorPresenceColumn(event) {
    const container = document.getElementById('actor-presence-column');
    if (!container) return;

    const actorPresence = event.actorPresence || [];
    const visibility = event.visibility || [];

    if (actorPresence.length === 0) {
        container.innerHTML = '<div class="column-empty">No actor presence data</div>';
        return;
    }

    let html = '';

    actorPresence.forEach(sceneNum => {
        const visInfo = visibility.find(v => v.scene === sceneNum);
        const isHidden = visInfo?.status === 'hidden';
        const coverage = visInfo?.coverage || '';
        const coverageNote = visInfo?.note || '';

        html += `
            <div class="presence-item ${isHidden ? 'hidden' : ''}">
                <div class="presence-scene">Scene ${sceneNum + 1}</div>
                <div class="presence-status">
                    <span class="presence-status-icon">${isHidden ? '🚫' : '✅'}</span>
                    <span>${isHidden ? 'Hidden/Covered' : 'Visible'}</span>
                </div>
                ${isHidden && coverage ? `
                    <div class="presence-coverage">
                        Coverage: ${coverage === 'other' ? (coverageNote || 'Other') : coverage}
                    </div>
                ` : ''}
            </div>
        `;
    });

    container.innerHTML = html;
}

/**
 * Render Key Scenes column (linked tags)
 */
function renderKeyScenesColumn(event) {
    const container = document.getElementById('key-scenes-column');
    if (!container) return;

    const keyScenes = event.keyScenes || [];

    if (keyScenes.length === 0) {
        container.innerHTML = '<div class="column-empty">No key scenes linked yet<br><br>Use "Link to Event" when creating tags</div>';
        return;
    }

    let html = '';

    keyScenes.forEach(keyScene => {
        html += `
            <div class="key-scene-item">
                <div class="key-scene-header">
                    <span class="key-scene-number">Scene ${keyScene.scene + 1}</span>
                    <span class="key-scene-category">${keyScene.category}</span>
                </div>
                <div class="key-scene-text">
                    "${escapeHtml(keyScene.scriptText.substring(0, 100))}${keyScene.scriptText.length > 100 ? '...' : ''}"
                </div>
                <div class="key-scene-phrase">
                    → <span class="key-scene-phrase">${escapeHtml(keyScene.taggedPhrase)}</span>
                </div>
                ${keyScene.note ? `
                    <div class="key-scene-note">${escapeHtml(keyScene.note)}</div>
                ` : ''}
            </div>
        `;
    });

    container.innerHTML = html;
}

/**
 * Close event timeline modal
 */
window.closeEventTimelineModal = function() {
    document.getElementById('event-timeline-modal').style.display = 'none';
};

/**
 * Export event timeline to PDF
 */
window.exportEventPDF = function() {
    alert('PDF export coming soon! This will export the full event timeline with all three columns.');
};

/**
 * Toggle event menu
 */
window.toggleEventMenu = function(eventId) {
    // TODO: Implement menu dropdown
    console.log('Toggle menu for event:', eventId);
};

// Expose renderTimelineEntries for AI integration
window.renderTimelineEntries = renderTimelineEntries;

// ============================================================================
// EXPORTS
// ============================================================================

export function renderComprehensiveBreakdown() {
    renderSceneBreakdown(state.currentScene);
}

export function selectScene(sceneIndex) {
    state.currentScene = sceneIndex;
    renderBreakdownPanel();
}

export { renderSceneBreakdown };
