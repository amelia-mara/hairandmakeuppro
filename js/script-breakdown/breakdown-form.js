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

const categories = [
    { id: 'cast', name: 'Cast Members', color: '#fbbf24' },
    { id: 'hair', name: 'Hair', color: '#a855f7' },
    { id: 'makeup', name: 'Makeup (Beauty)', color: '#ec4899' },
    { id: 'sfx', name: 'SFX Makeup', color: '#ef4444' },
    { id: 'health', name: 'Health/Illness', color: '#f59e0b' },
    { id: 'injuries', name: 'Injuries/Wounds', color: '#dc2626' },
    { id: 'stunts', name: 'Stunts/Action', color: '#f97316' },
    { id: 'weather', name: 'Weather Effects', color: '#38bdf8' },
    { id: 'wardrobe', name: 'Costume/Wardrobe', color: '#34d399' },
    { id: 'extras', name: 'Supporting Artists', color: '#9ca3af' }
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
 * Render comprehensive scene breakdown
 */
function renderSceneBreakdown(sceneIndex) {
    const scene = state.scenes[sceneIndex];
    const panel = document.getElementById('breakdown-panel');
    if (!scene || !panel) return;

    const breakdown = state.sceneBreakdowns[sceneIndex] || {};
    const characters = breakdown.cast || [];
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
                    : '<div class="no-characters">No characters detected in this scene yet</div>'}
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
 * Render character continuity fields
 */
function renderCharacterFields(character, sceneIndex, scene) {
    const charData = state.characterStates[sceneIndex]?.[character] || {};
    const prevScene = findPreviousCharacterAppearance(character, sceneIndex);
    const suggestions = extractSuggestionsFromTags(sceneIndex, character);

    const enterHair = charData.enterHair || suggestions.hair || '';
    const enterMakeup = charData.enterMakeup || suggestions.makeup || '';
    const enterWardrobe = charData.enterWardrobe || suggestions.wardrobe || '';
    const changes = charData.changes || suggestions.changes.join('; ') || '';

    return `
        <div class="character-continuity-block" data-character="${escapeHtml(character)}">
            <div class="character-header">
                <h5>${escapeHtml(character)}</h5>
                <button class="copy-btn"
                        onclick="copyFromPrevious('${escapeHtml(character).replace(/'/g, "\\'")}', ${sceneIndex})"
                        title="Copy from previous scene"
                        ${!prevScene ? 'disabled' : ''}>
                    ↓ Copy Previous
                </button>
            </div>

            <!-- ENTERS WITH -->
            <div class="continuity-row">
                <label class="row-label">Enters with:</label>
                <div class="continuity-fields">
                    <input type="text"
                           placeholder="Hair"
                           value="${escapeHtml(enterHair)}"
                           onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'enterHair', this.value)">
                    <input type="text"
                           placeholder="Makeup"
                           value="${escapeHtml(enterMakeup)}"
                           onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'enterMakeup', this.value)">
                    <input type="text"
                           placeholder="Wardrobe"
                           value="${escapeHtml(enterWardrobe)}"
                           onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'enterWardrobe', this.value)">
                </div>
            </div>

            <!-- CHANGES DURING -->
            <div class="continuity-row">
                <label class="row-label">Changes:</label>
                <div class="continuity-fields">
                    <textarea placeholder="Describe any changes during the scene..."
                              onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'changes', this.value)"
                              >${escapeHtml(changes)}</textarea>
                </div>
            </div>

            <!-- EXITS WITH -->
            <div class="continuity-row">
                <label class="row-label">Exits with:</label>
                <div class="continuity-fields">
                    <input type="text"
                           placeholder="Hair"
                           value="${escapeHtml(charData.exitHair || '')}"
                           onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'exitHair', this.value)">
                    <input type="text"
                           placeholder="Makeup"
                           value="${escapeHtml(charData.exitMakeup || '')}"
                           onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'exitMakeup', this.value)">
                    <input type="text"
                           placeholder="Wardrobe"
                           value="${escapeHtml(charData.exitWardrobe || '')}"
                           onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'exitWardrobe', this.value)">
                </div>
            </div>
        </div>
    `;
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
