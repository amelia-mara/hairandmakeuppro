/**
 * breakdown-form.js
 * Right panel scene breakdown form
 */

import { state } from './main.js';
import { formatSceneRange, getComplexityIcon, extractLocation, detectTimeOfDay, detectIntExt } from './utils.js';
import { detectAIElements, generateDescription } from './ai-integration.js';
import { getAllVersions, getCurrentVersion, getVersionById, copySceneFromVersion } from './version-manager.js';

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
    // Use scene.content or scene.text as fallback (different script parsers store content differently)
    let characters = breakdown.cast || [];
    const sceneContent = scene.content || scene.text || '';

    if (characters.length === 0 && sceneContent) {
        characters = detectCharactersFromMasterContext(sceneContent);
        if (characters.length > 0) {
            // Auto-populate breakdown.cast for future renders
            if (!state.sceneBreakdowns[sceneIndex]) {
                state.sceneBreakdowns[sceneIndex] = {};
            }
            state.sceneBreakdowns[sceneIndex].cast = characters;
            saveToLocalStorage();
        }
    }

    // Also populate castMembers on the scene object for continuity tracking
    if (characters.length > 0 && !scene.castMembers) {
        scene.castMembers = characters;
    }

    const storyDay = scene.storyDay || extractStoryDay(sceneIndex) || '';
    const timeOfDay = scene.timeOfDay || extractTimeFromHeading(scene.heading) || '';

    const analysis = window.scriptMasterContext || window.masterContext || {};
    const alerts = extractSceneAlerts(scene, sceneIndex, analysis);
    const environment = analysis.environments?.[`scene_${sceneIndex}`];
    const emotional = analysis.emotionalBeats?.[`scene_${sceneIndex}`];

    // Check if there are other versions to copy from
    const versions = getAllVersions();
    const currentVersion = getCurrentVersion();
    const otherVersionsWithBreakdown = versions.filter(v =>
        v.version_id !== currentVersion?.version_id &&
        v.breakdowns &&
        v.breakdowns[(sceneIndex + 1).toString()]
    );
    const showCopyFromVersion = otherVersionsWithBreakdown.length > 0;

    // Check if this breakdown needs review (inherited with changes)
    const needsReview = breakdown._needs_review;
    const inheritedChanges = breakdown._changes || [];

    panel.innerHTML = `
        <div class="scene-breakdown-wrapper">
            <!-- Scene Header -->
            <div class="breakdown-scene-header">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3>Scene ${sceneIndex + 1}</h3>
                        <div class="scene-heading">${escapeHtml(scene.heading)}</div>
                    </div>
                    ${showCopyFromVersion ? `
                        <button onclick="openCopyFromVersionModal(${sceneIndex})"
                                class="copy-version-btn"
                                style="
                                    padding: 6px 12px;
                                    background: transparent;
                                    border: 1px solid var(--glass-border);
                                    border-radius: 4px;
                                    color: var(--text-muted);
                                    cursor: pointer;
                                    font-size: 0.8em;
                                    white-space: nowrap;
                                "
                                title="Copy breakdown from another version">
                            Copy from Version
                        </button>
                    ` : ''}
                </div>
            </div>

            ${needsReview ? `
                <div class="needs-review-banner" style="
                    padding: 12px;
                    background: rgba(251, 191, 36, 0.1);
                    border: 1px solid rgba(251, 191, 36, 0.3);
                    border-radius: 8px;
                    margin-bottom: 16px;
                ">
                    <div style="color: #fbbf24; font-weight: 600; margin-bottom: 4px;">
                        ⚠️ Breakdown Needs Review
                    </div>
                    <div style="font-size: 0.85em; color: var(--text-muted);">
                        This scene was changed in the new script version:
                        <ul style="margin: 8px 0 0 16px; padding: 0;">
                            ${inheritedChanges.map(c => `
                                <li style="margin: 4px 0; color: ${c.severity === 'high' ? '#ef4444' : 'inherit'};">
                                    ${c.type.startsWith('hmu') ? '🎨 ' : ''}${c.message}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                    <button onclick="markBreakdownReviewed(${sceneIndex})" style="
                        margin-top: 8px;
                        padding: 6px 12px;
                        background: var(--accent-gold);
                        border: none;
                        border-radius: 4px;
                        color: var(--bg-dark);
                        cursor: pointer;
                        font-size: 0.85em;
                        font-weight: 600;
                    ">
                        Mark as Reviewed
                    </button>
                </div>
            ` : ''}

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
                            Scene preview: ${escapeHtml((scene.content || scene.text || '')?.substring(0, 100) || 'No content')}...
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
 * Now auto-populates from AI-detected appearance changes
 */
function renderCharacterFields(character, sceneIndex, scene) {
    const charData = state.characterStates[sceneIndex]?.[character] || {};
    const prevScene = findPreviousCharacterAppearance(character, sceneIndex);
    const suggestions = extractSuggestionsFromTags(sceneIndex, character);

    // Character ID for HTML elements
    const charId = sanitizeCharacterId(character);

    // Get appearance data (with AI suggestions as fallback)
    const enterHair = charData.enterHair || suggestions.hair || '';
    const enterMakeup = charData.enterMakeup || suggestions.makeup || '';
    const enterWardrobe = charData.enterWardrobe || suggestions.wardrobe || '';

    // Change status - auto-detect from AI analysis if not manually set
    const hasAutoChanges = suggestions.hasAutoChanges && suggestions.changes.length > 0;
    const changeStatus = charData.changeStatus || (hasAutoChanges ? 'has-changes' : 'no-change');
    const hasChanges = changeStatus === 'has-changes';

    // Changes data - use AI suggestions if not manually entered
    const changeHair = charData.changeHair || '';
    const changeMakeup = charData.changeMakeup || '';
    const changeWardrobe = charData.changeWardrobe || '';
    const changeInjuries = charData.changeInjuries || suggestions.injuries || '';
    const changeDirt = charData.changeDirt || suggestions.condition || '';

    // Build auto-detected changes summary for display
    const autoChanges = suggestions.changes || [];

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
                    <div class="continuity-label">CHANGES ${hasAutoChanges ? '<span style="color: var(--accent-gold); font-size: 0.8em; margin-left: 8px;">⚡ Auto-detected</span>' : ''}</div>
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

                <!-- Auto-detected changes from script analysis -->
                ${autoChanges.length > 0 ? `
                    <div class="auto-detected-changes" style="background: rgba(201, 169, 97, 0.1); border: 1px solid var(--accent-gold); border-radius: 6px; padding: 10px; margin-bottom: 10px;">
                        <div style="font-size: 0.75em; color: var(--accent-gold); margin-bottom: 6px; font-weight: 600;">DETECTED FROM SCRIPT:</div>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                            ${autoChanges.map(change => {
                                // Determine color based on change type
                                let bgColor = '#F5F5DC33'; // default beige
                                const lowerChange = change.toLowerCase();
                                if (lowerChange.includes('injury') || lowerChange.includes('blood')) {
                                    bgColor = '#FF634755'; // coral for injuries
                                } else if (lowerChange.includes('wet') || lowerChange.includes('soaked')) {
                                    bgColor = '#87CEEB55'; // sky blue for wet
                                } else if (lowerChange.includes('dirty') || lowerChange.includes('mud')) {
                                    bgColor = '#8B451355'; // brown for dirt
                                } else if (lowerChange.includes('condition')) {
                                    bgColor = '#87CEEB55'; // sky blue for condition
                                }
                                return `<span class="auto-change-tag" style="background: ${bgColor}; padding: 4px 8px; border-radius: 4px; font-size: 0.85em; display: inline-block;">${escapeHtml(change)}</span>`;
                            }).join('')}
                        </div>
                        <button class="small-btn" style="margin-top: 8px; font-size: 0.75em;" onclick="applyAutoChanges('${escapeHtml(character).replace(/'/g, "\\'")}', ${sceneIndex})">
                            Apply to Fields Below
                        </button>
                    </div>
                ` : ''}

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
    console.log('🎬 Rendering active events for:', character, 'in scene', sceneIndex + 1);

    // Get all active events for this character
    const activeEvents = getActiveEventsForCharacter(character, sceneIndex);

    console.log('   Found', activeEvents.length, 'active events');

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

    // Filter to events that are active in this scene
    const relevantEvents = activeEvents.filter(event => {
        // Show if scene is at or after start
        if (sceneIndex < event.startScene) {
            return false;
        }

        // Show if no end scene (still active)
        if (!event.endScene && event.endScene !== 0) {
            return true;
        }

        // Show if scene is before or at end
        return sceneIndex <= event.endScene;
    });

    console.log('   Showing', relevantEvents.length, 'events in this scene');

    if (relevantEvents.length === 0) {
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
            ${relevantEvents.map(event => renderEventCard(event, sceneIndex)).join('')}
        </div>
    `;
}

/**
 * Render a single event card
 */
function renderEventCard(event, sceneIndex) {
    // Get existing observation for this scene
    const observation = event.observations.find(obs => obs.scene === sceneIndex);
    const observationText = observation ? observation.description : '';

    // Get visibility for this scene
    const visibility = event.visibility.find(v => v.scene === sceneIndex);
    const isVisible = !visibility || visibility.status === 'visible';

    return `
        <div class="event-card" data-event-id="${event.id}">
            <div class="event-header">
                <div class="event-info">
                    <div class="event-name">${escapeHtml(event.name)}</div>
                    <div class="event-meta">
                        ${event.category} • Started Scene ${event.startScene + 1}
                        ${event.endScene ? ` • Ended Scene ${event.endScene + 1}` : ' • Active'}
                    </div>
                </div>
                <button class="event-menu-btn" onclick="openEventMenu('${event.id}')">⋮</button>
            </div>

            <div class="event-observation">
                <label class="event-label">Scene ${sceneIndex + 1} Notes:</label>
                <textarea class="event-note-input"
                          placeholder="Describe appearance/condition in this scene..."
                          onchange="saveEventObservation('${event.id}', ${sceneIndex}, this.value)"
                          >${escapeHtml(observationText)}</textarea>
                <div class="observation-hint">
                    ${observationText ? '✓ Observation logged' : 'No notes yet for this scene'}
                </div>
            </div>

            ${renderVisibilityCheckbox(event, sceneIndex)}

            <div class="event-card-actions">
                <button class="event-btn view" onclick="viewEventInTimeline('${event.id}')">
                    View Timeline
                </button>
                ${!event.endScene ? `
                    <button class="event-btn end" onclick="endEventAtScene('${event.id}', ${sceneIndex})">
                        End Event Here
                    </button>
                ` : `
                    <div class="event-ended-badge">Ended</div>
                `}
            </div>
        </div>
    `;
}

/**
 * Render visibility checkbox for an event
 */
function renderVisibilityCheckbox(event, sceneIndex) {
    const visInfo = event.visibility?.find(v => v.scene === sceneIndex);
    const isHidden = visInfo?.status === 'hidden';
    const coverage = visInfo?.coverage || '';
    const coverageNote = visInfo?.note || '';

    return `
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
 * Now also pulls from masterContext descriptionTags and appearanceChanges
 */
function extractSuggestionsFromTags(sceneIndex, character) {
    const sceneTags = state.scriptTags[sceneIndex] || [];
    const suggestions = {
        hair: '',
        makeup: '',
        wardrobe: '',
        changes: [],
        injuries: '',
        condition: '',
        hasAutoChanges: false
    };

    // Source 1: Manual tags from state.scriptTags
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

    // Source 2: masterContext descriptionTags (from Phase 5 AI analysis)
    const masterContext = window.masterContext || window.scriptMasterContext;
    if (masterContext?.descriptionTags) {
        masterContext.descriptionTags.forEach(tag => {
            // Match by character (case-insensitive) and scene
            if (tag.character?.toUpperCase() === character.toUpperCase() &&
                tag.scene === (sceneIndex + 1)) {

                const quote = tag.quote || '';

                // Categorize based on tag category - comprehensive continuity event handling
                switch (tag.category) {
                    case 'hair':
                        if (!suggestions.hair) suggestions.hair = quote;
                        // Check for hair changes
                        const hairLower = quote.toLowerCase();
                        if (hairLower.includes('wet') || hairLower.includes('messy') || hairLower.includes('tangled') ||
                            hairLower.includes('cut') || hairLower.includes('grows') || hairLower.includes('wind')) {
                            suggestions.changes.push(`Hair change: ${quote}`);
                            suggestions.hasAutoChanges = true;
                        }
                        break;

                    case 'wardrobe':
                        if (!suggestions.wardrobe) suggestions.wardrobe = quote;
                        // Check for wardrobe damage/changes
                        const wardrobeLower = quote.toLowerCase();
                        if (wardrobeLower.includes('torn') || wardrobeLower.includes('ripped') ||
                            wardrobeLower.includes('stained') || wardrobeLower.includes('damaged')) {
                            suggestions.changes.push(`Wardrobe damage: ${quote}`);
                            suggestions.hasAutoChanges = true;
                        }
                        break;

                    case 'injury':
                    case 'fight':
                        suggestions.injuries = quote;
                        suggestions.changes.push(`Injury: ${quote}`);
                        suggestions.hasAutoChanges = true;
                        break;

                    case 'weather':
                        suggestions.condition = quote;
                        suggestions.changes.push(`Weather effect: ${quote}`);
                        suggestions.hasAutoChanges = true;
                        break;

                    case 'illness':
                        suggestions.condition = quote;
                        suggestions.changes.push(`Illness/health: ${quote}`);
                        suggestions.hasAutoChanges = true;
                        break;

                    case 'time_passage':
                        suggestions.changes.push(`Time passage: ${quote}`);
                        suggestions.hasAutoChanges = true;
                        break;

                    case 'condition':
                        suggestions.condition = quote;
                        suggestions.changes.push(`Condition: ${quote}`);
                        suggestions.hasAutoChanges = true;
                        break;

                    case 'makeup':
                        if (!suggestions.makeup) suggestions.makeup = quote;
                        // Check for makeup changes
                        const makeupLower = quote.toLowerCase();
                        if (makeupLower.includes('smeared') || makeupLower.includes('running') ||
                            makeupLower.includes('crying') || makeupLower.includes('tears')) {
                            suggestions.changes.push(`Makeup change: ${quote}`);
                            suggestions.hasAutoChanges = true;
                        }
                        break;

                    case 'physical_appearance':
                    case 'physical':
                        // Check for appearance-changing keywords
                        const lowerQuote = quote.toLowerCase();
                        if (lowerQuote.includes('wet') || lowerQuote.includes('soaked') || lowerQuote.includes('drenched')) {
                            suggestions.changes.push(`Gets wet: ${quote}`);
                            suggestions.hasAutoChanges = true;
                        }
                        if (lowerQuote.includes('dirty') || lowerQuote.includes('mud') || lowerQuote.includes('grime') || lowerQuote.includes('filthy')) {
                            suggestions.changes.push(`Gets dirty: ${quote}`);
                            suggestions.hasAutoChanges = true;
                        }
                        if (lowerQuote.includes('blood') || lowerQuote.includes('bleeding') || lowerQuote.includes('bruise') || lowerQuote.includes('cut')) {
                            suggestions.injuries = quote;
                            suggestions.changes.push(`Blood/injury: ${quote}`);
                            suggestions.hasAutoChanges = true;
                        }
                        if (lowerQuote.includes('older') || lowerQuote.includes('aged') || lowerQuote.includes('gray')) {
                            suggestions.changes.push(`Aging: ${quote}`);
                            suggestions.hasAutoChanges = true;
                        }
                        if (lowerQuote.includes('sick') || lowerQuote.includes('pale') || lowerQuote.includes('ill') || lowerQuote.includes('fever')) {
                            suggestions.changes.push(`Illness: ${quote}`);
                            suggestions.hasAutoChanges = true;
                        }
                        break;

                    case 'age':
                        // Age mentions that indicate time passage
                        if (quote.toLowerCase().includes('older') || quote.toLowerCase().includes('years later')) {
                            suggestions.changes.push(`Aging: ${quote}`);
                            suggestions.hasAutoChanges = true;
                        }
                        break;
                }
            }
        });
    }

    // Source 3: masterContext appearanceChanges (explicit changes from Phase 5)
    if (masterContext?.appearanceChanges) {
        masterContext.appearanceChanges.forEach(change => {
            if (change.character?.toUpperCase() === character.toUpperCase() &&
                change.start_scene === (sceneIndex + 1)) {

                const desc = change.description || change.visual_notes || '';
                suggestions.changes.push(`${change.change_type}: ${desc}`);
                suggestions.hasAutoChanges = true;

                // Also populate specific fields based on change type
                if (change.change_type === 'injury' || change.change_type === 'injury_acquired') {
                    suggestions.injuries = desc;
                }
            }
        });
    }

    // Source 4: Character's extractedElements from masterContext
    const charData = masterContext?.characters?.[character];
    if (charData?.extractedElements?.mentionedAppearanceChanges) {
        charData.extractedElements.mentionedAppearanceChanges.forEach(change => {
            if (change.scene === (sceneIndex + 1)) {
                suggestions.changes.push(`${change.type}: ${change.description}`);
                suggestions.hasAutoChanges = true;
            }
        });
    }

    return suggestions;
}

/**
 * Find previous appearance of character
 * Returns the scene INDEX (not the state) for the most recent scene where this character appeared
 */
function findPreviousCharacterAppearance(character, currentSceneIndex) {
    for (let i = currentSceneIndex - 1; i >= 0; i--) {
        const breakdown = state.sceneBreakdowns[i];

        // Check if character is in this scene's cast
        if (breakdown?.cast?.includes(character)) {
            return i; // Return scene INDEX, not state
        }

        // Also check if character appears in scene content (fallback)
        const scene = state.scenes[i];
        const sceneContent = scene?.content || scene?.text || '';
        if (sceneContent && window.masterContext?.characters?.[character]) {
            const regex = new RegExp('\\b' + character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
            if (sceneContent.match(regex)) {
                return i; // Return scene INDEX
            }
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
    const prevSceneIndex = findPreviousCharacterAppearance(character, sceneIndex);
    if (prevSceneIndex === null) {
        alert('No previous appearance found for ' + character);
        return;
    }

    // Get the character state from the previous scene
    const prevState = state.characterStates[prevSceneIndex]?.[character];
    if (!prevState) {
        alert(`${character} appeared in Scene ${prevSceneIndex + 1} but has no saved appearance data`);
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

    console.log(`✅ Copied ${character}'s appearance from Scene ${prevSceneIndex + 1} to Scene ${sceneIndex + 1}`);

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

/**
 * Apply auto-detected changes to the character's change fields
 * Takes the AI-detected changes and populates the appropriate form fields
 */
window.applyAutoChanges = function(character, sceneIndex) {
    // Get the suggestions which include auto-detected changes
    const suggestions = extractSuggestionsFromTags(sceneIndex, character);

    // Initialize state if needed
    if (!state.characterStates[sceneIndex]) {
        state.characterStates[sceneIndex] = {};
    }
    if (!state.characterStates[sceneIndex][character]) {
        state.characterStates[sceneIndex][character] = {};
    }

    const charState = state.characterStates[sceneIndex][character];

    // Set changeStatus to has-changes
    charState.changeStatus = 'has-changes';

    // Parse auto-detected changes and populate appropriate fields
    const changes = suggestions.changes || [];
    const hairChanges = [];
    const makeupChanges = [];
    const wardrobeChanges = [];
    const injuryChanges = [];
    const conditionChanges = [];

    changes.forEach(change => {
        const lowerChange = change.toLowerCase();

        if (lowerChange.includes('hair') || lowerChange.includes('wet hair') || lowerChange.includes('messy')) {
            hairChanges.push(change);
        } else if (lowerChange.includes('makeup') || lowerChange.includes('face')) {
            makeupChanges.push(change);
        } else if (lowerChange.includes('wardrobe') || lowerChange.includes('clothes') || lowerChange.includes('torn')) {
            wardrobeChanges.push(change);
        } else if (lowerChange.includes('injury') || lowerChange.includes('blood') || lowerChange.includes('cut') || lowerChange.includes('bruise')) {
            injuryChanges.push(change);
        } else if (lowerChange.includes('wet') || lowerChange.includes('soaked') || lowerChange.includes('dirty') || lowerChange.includes('mud') || lowerChange.includes('condition')) {
            conditionChanges.push(change);
        } else {
            // Default to condition for unrecognized changes
            conditionChanges.push(change);
        }
    });

    // Apply to fields (append to existing if present)
    if (hairChanges.length > 0) {
        charState.changeHair = [charState.changeHair, ...hairChanges].filter(Boolean).join('; ');
    }
    if (makeupChanges.length > 0) {
        charState.changeMakeup = [charState.changeMakeup, ...makeupChanges].filter(Boolean).join('; ');
    }
    if (wardrobeChanges.length > 0) {
        charState.changeWardrobe = [charState.changeWardrobe, ...wardrobeChanges].filter(Boolean).join('; ');
    }
    if (injuryChanges.length > 0 || suggestions.injuries) {
        charState.changeInjuries = [charState.changeInjuries, suggestions.injuries, ...injuryChanges].filter(Boolean).join('; ');
    }
    if (conditionChanges.length > 0 || suggestions.condition) {
        charState.changeDirt = [charState.changeDirt, suggestions.condition, ...conditionChanges].filter(Boolean).join('; ');
    }

    console.log(`✅ Applied auto-detected changes for ${character} in Scene ${sceneIndex + 1}:`, {
        hair: charState.changeHair,
        makeup: charState.changeMakeup,
        wardrobe: charState.changeWardrobe,
        injuries: charState.changeInjuries,
        dirt: charState.changeDirt
    });

    renderSceneBreakdown(sceneIndex);
    saveToLocalStorage();
};

// ============================================================================
// CONTINUITY EVENT MANAGEMENT
// ============================================================================

/**
 * Auto-detect which scenes a character appears in based on castMembers
 * @param {string} character - Character name
 * @param {number} startScene - Starting scene (1-indexed, optional)
 * @param {number} endScene - Ending scene (1-indexed, optional)
 * @returns {number[]} - Array of 1-indexed scene numbers where character appears
 */
function detectActorPresenceForCharacter(character, startScene, endScene) {
    console.log('🔍 Detecting actor presence for:', character);
    console.log('   Range:', startScene || 'start', 'to', endScene || 'end');

    const presenceScenes = [];

    // Check if scenes exist
    if (!state || !state.scenes || !Array.isArray(state.scenes)) {
        console.warn('⚠️ No scenes array found in state');
        return [];
    }

    // Loop through scenes
    state.scenes.forEach((scene, index) => {
        const sceneNumber = index + 1; // Convert to 1-indexed

        // Check if scene is in range
        if (startScene && sceneNumber < startScene) return;
        if (endScene && sceneNumber > endScene) return;

        // Check if character appears in this scene's castMembers
        const castMembers = scene.castMembers || [];

        if (castMembers.includes(character)) {
            presenceScenes.push(sceneNumber);
        }
    });

    console.log(`✅ Actor "${character}" present in ${presenceScenes.length} scene(s):`, presenceScenes.join(', '));

    return presenceScenes;
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
    console.log('🎬 Opening create event modal:', { character, sceneIndex });

    try {
        // Store character and scene for modal
        window.currentEventCharacter = character;
        window.currentEventScene = sceneIndex;

        // Get modal elements
        const modal = document.getElementById('create-event-modal');
        const characterDisplay = document.getElementById('event-character-name');
        const startSceneInput = document.getElementById('event-start-scene');
        const nameInput = document.getElementById('event-name');
        const descriptionInput = document.getElementById('event-initial-description');

        // Validate elements exist
        if (!modal) {
            console.error('❌ Modal not found: create-event-modal');
            alert('Error: Event modal not found. Please refresh the page.');
            return;
        }

        if (!characterDisplay) {
            console.error('❌ Character display not found: event-character-name');
        }

        if (!startSceneInput) {
            console.error('❌ Start scene input not found: event-start-scene');
        }

        // Set character display
        if (characterDisplay) {
            characterDisplay.textContent = character;
            characterDisplay.style.color = 'var(--accent-gold)';
            characterDisplay.style.fontWeight = '600';
        }

        // Set starting scene (convert 0-index to 1-index for display)
        if (startSceneInput) {
            startSceneInput.value = sceneIndex + 1;
            console.log(`📍 Set start scene to: ${sceneIndex + 1}`);
        }

        // Clear previous values
        if (nameInput) {
            nameInput.value = '';
        }
        if (descriptionInput) {
            descriptionInput.value = '';
        }

        // Open modal
        modal.style.display = 'flex';
        console.log('✅ Modal opened successfully');

        // Focus on name input for better UX
        setTimeout(() => {
            if (nameInput) {
                nameInput.focus();
            }
        }, 100);

    } catch (error) {
        console.error('❌ Error opening event modal:', error);
        alert(`Error opening modal: ${error.message}`);
    }
};

/**
 * Confirm creating a continuity event
 */
window.confirmCreateEvent = function() {
    console.log('🎬 confirmCreateEvent called');

    try {
        // Get form values
        const nameInput = document.getElementById('event-name');
        const categoryInput = document.getElementById('event-category');
        const startSceneInput = document.getElementById('event-start-scene');
        const descriptionInput = document.getElementById('event-initial-description');

        console.log('📋 Form elements:', {
            nameInput,
            categoryInput,
            startSceneInput,
            descriptionInput
        });

        if (!nameInput || !categoryInput || !startSceneInput || !descriptionInput) {
            console.error('❌ Missing form elements!');
            alert('Error: Form elements not found. Please refresh the page.');
            return;
        }

        const name = nameInput.value.trim();
        const category = categoryInput.value;
        const startSceneValue = startSceneInput.value;
        const initialDescription = descriptionInput.value.trim();

        console.log('📝 Form values:', {
            character: window.currentEventCharacter,
            name,
            category,
            startSceneValue,
            initialDescription
        });

        // Validate character
        if (!window.currentEventCharacter) {
            console.error('❌ No character selected');
            alert('Error: No character selected. Please close and reopen the modal.');
            return;
        }

        // Validate name
        if (!name) {
            console.warn('⚠️ No event name entered');
            alert('Please enter an event name');
            return;
        }

        // Validate start scene
        if (!startSceneValue || isNaN(startSceneValue)) {
            console.warn('⚠️ Invalid start scene:', startSceneValue);
            alert('Please enter a valid starting scene number');
            return;
        }

        const startScene = parseInt(startSceneValue) - 1; // Convert to 0-index

        if (startScene < 0 || startScene >= state.scenes.length) {
            console.warn('⚠️ Start scene out of range:', startScene);
            alert(`Scene ${startSceneValue} is out of range (1-${state.scenes.length})`);
            return;
        }

        // Validate description
        if (!initialDescription) {
            console.warn('⚠️ No initial description entered');
            alert('Please enter an initial description');
            return;
        }

        console.log('✅ All validations passed');

        // Auto-detect actor presence from scene breakdowns
        // detectActorPresenceForCharacter returns 1-indexed scene numbers
        console.log('🔍 Detecting actor presence...');
        const actorPresence1Indexed = detectActorPresenceForCharacter(
            window.currentEventCharacter,
            parseInt(startSceneValue) // Pass 1-indexed start scene
        );
        console.log('🎭 Actor presence detected (1-indexed):', actorPresence1Indexed);

        // Convert to 0-indexed for internal storage
        const actorPresence = actorPresence1Indexed.map(sceneNum => sceneNum - 1);
        console.log('🎭 Actor presence (0-indexed for storage):', actorPresence);

        // Create event object
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
            actorPresence: actorPresence, // 0-indexed scene numbers
            visibility: actorPresence.map(sceneNum => ({
                scene: sceneNum, // 0-indexed
                status: 'visible',
                coverage: null,
                note: ''
            })),
            keyScenes: []
        };

        console.log('📦 Event object created:', event);

        // Initialize continuityEvents if needed
        if (!state.continuityEvents) {
            console.log('🔧 Initializing continuityEvents array');
            state.continuityEvents = [];
        }

        // Add event
        console.log('➕ Adding event to state...');
        state.continuityEvents.push(event);
        console.log(`📊 Total events: ${state.continuityEvents.length}`);

        // Save to localStorage
        console.log('💾 Saving to localStorage...');
        saveToLocalStorage();
        console.log('✅ Saved successfully');

        console.log(`✅ Created event: ${event.name} for ${event.character}`);

        // Close modal
        console.log('🚪 Closing modal...');
        closeCreateEventModal();

        // Refresh scene breakdown
        console.log('🔄 Refreshing scene breakdown...');
        renderSceneBreakdown(state.currentScene);

        // Show success message
        alert(`✅ Event created: ${name}\n\nCharacter: ${event.character}\nStarting Scene: ${startSceneValue}\nActor appears in ${actorPresence.length} scene(s)`);

        console.log('✅ confirmCreateEvent completed successfully');

    } catch (error) {
        console.error('❌ Error in confirmCreateEvent:', error);
        console.error('Stack trace:', error.stack);
        alert(`Error creating event: ${error.message}\n\nCheck console for details.`);
    }
};

/**
 * Close create event modal
 */
window.closeCreateEventModal = function() {
    console.log('🚪 Closing event modal...');

    try {
        const modal = document.getElementById('create-event-modal');
        const nameInput = document.getElementById('event-name');
        const descriptionInput = document.getElementById('event-initial-description');

        if (modal) {
            modal.style.display = 'none';
        } else {
            console.error('❌ Modal not found when trying to close');
        }

        // Clear form
        if (nameInput) {
            nameInput.value = '';
        }
        if (descriptionInput) {
            descriptionInput.value = '';
        }

        // Clear stored character
        window.currentEventCharacter = null;
        window.currentEventScene = null;

        console.log('✅ Modal closed');

    } catch (error) {
        console.error('❌ Error closing modal:', error);
    }
};

/**
 * Save event observation for a scene
 */
window.saveEventObservation = function(eventId, sceneNumber, description) {
    console.log('💾 Saving observation:', { eventId, sceneNumber, description });

    const event = state.continuityEvents.find(e => e.id === eventId);

    if (!event) {
        console.error('❌ Event not found:', eventId);
        return;
    }

    // Remove empty observations
    if (!description || description.trim() === '') {
        event.observations = event.observations.filter(obs => obs.scene !== sceneNumber);
        console.log('🗑️ Removed empty observation for scene', sceneNumber + 1);
    } else {
        // Find or create observation for this scene
        let observation = event.observations.find(obs => obs.scene === sceneNumber);

        if (observation) {
            // Update existing
            observation.description = description;
            observation.timestamp = Date.now();
            console.log('✏️ Updated observation');
        } else {
            // Add new
            event.observations.push({
                scene: sceneNumber,
                description: description,
                type: 'logged',
                timestamp: Date.now()
            });
            console.log('➕ Added new observation');
        }

        // Sort by scene number
        event.observations.sort((a, b) => a.scene - b.scene);
    }

    // Update timeline with logged observation
    updateTimelineEntry(event, sceneNumber, description);

    // Save to storage
    saveToLocalStorage();

    console.log('✅ Observation saved for', event.name);
};

/**
 * Update timeline entry for a scene
 */
function updateTimelineEntry(event, sceneNumber, description) {
    // Initialize timeline if needed
    if (!event.timeline) {
        event.timeline = [];
    }

    // Find existing timeline entry
    let timelineEntry = event.timeline.find(t => t.scene === sceneNumber);

    if (description && description.trim()) {
        if (timelineEntry) {
            // Update existing
            timelineEntry.state = description;
            timelineEntry.source = 'logged';
        } else {
            // Add new
            event.timeline.push({
                scene: sceneNumber,
                state: description,
                source: 'logged'
            });

            // Sort timeline
            event.timeline.sort((a, b) => a.scene - b.scene);
        }
    } else {
        // Remove if description is empty (but keep generated entries)
        event.timeline = event.timeline.filter(t =>
            t.scene !== sceneNumber || t.source === 'generated'
        );
    }
}

/**
 * Update event note for current scene (DEPRECATED - use saveEventObservation)
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
 * End event at a specific scene
 */
window.endEventAtScene = function(eventId, sceneNumber) {
    console.log('🏁 Ending event:', eventId, 'at scene', sceneNumber + 1);

    const description = prompt(`Describe the final state of this event in Scene ${sceneNumber + 1}:`);

    if (description === null) {
        // User cancelled
        return;
    }

    const event = state.continuityEvents.find(e => e.id === eventId);

    if (!event) {
        console.error('❌ Event not found:', eventId);
        return;
    }

    // Set end scene
    event.endScene = sceneNumber;
    event.status = 'completed';

    // Add final observation if description provided
    if (description && description.trim()) {
        // Check if observation already exists
        let observation = event.observations.find(obs => obs.scene === sceneNumber);

        if (observation) {
            observation.description = description;
            observation.timestamp = Date.now();
        } else {
            event.observations.push({
                scene: sceneNumber,
                description: description,
                type: 'logged',
                timestamp: Date.now()
            });
        }

        // Update timeline
        updateTimelineEntry(event, sceneNumber, description);
    }

    // Save
    saveToLocalStorage();

    console.log('✅ Event ended:', event.name);

    // Refresh display
    renderSceneBreakdown(sceneNumber);

    alert(`✅ Event "${event.name}" ended at Scene ${sceneNumber + 1}`);
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

/**
 * Open event menu (alias for toggleEventMenu)
 */
window.openEventMenu = function(eventId) {
    window.toggleEventMenu(eventId);
};

/**
 * View event in timeline (alias for viewEventTimeline)
 */
window.viewEventInTimeline = function(eventId) {
    window.viewEventTimeline(eventId);
};

// Expose renderTimelineEntries for AI integration
window.renderTimelineEntries = renderTimelineEntries;

// ============================================================================
// COPY FROM VERSION FUNCTIONALITY
// ============================================================================

/**
 * Open modal to copy breakdown from another version
 */
window.openCopyFromVersionModal = function(sceneIndex) {
    const sceneNumber = (sceneIndex + 1).toString();
    const versions = getAllVersions();
    const currentVersion = getCurrentVersion();

    // Find versions that have a breakdown for this scene
    const versionsWithBreakdown = versions.filter(v =>
        v.version_id !== currentVersion?.version_id &&
        v.breakdowns &&
        v.breakdowns[sceneNumber]
    );

    if (versionsWithBreakdown.length === 0) {
        alert('No other versions have breakdowns for this scene.');
        return;
    }

    let modal = document.getElementById('copy-from-version-modal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'copy-from-version-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-title">Copy Breakdown from Another Version</div>

            <div style="margin-bottom: 16px; color: var(--text-muted); font-size: 0.9em;">
                Select a version to copy the breakdown for Scene ${sceneIndex + 1}.
                This will <strong>replace</strong> the current breakdown.
            </div>

            <div style="display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto;">
                ${versionsWithBreakdown.map(v => {
                    const breakdown = v.breakdowns[sceneNumber];
                    const castCount = breakdown.cast?.length || 0;
                    const hasElements = Object.keys(breakdown.elements || {}).length > 0;

                    return `
                        <div style="
                            padding: 16px;
                            background: var(--card-bg);
                            border: 1px solid var(--glass-border);
                            border-radius: 8px;
                            cursor: pointer;
                        "
                        onclick="performCopyFromVersion(${sceneIndex}, '${v.version_id}')"
                        onmouseover="this.style.borderColor='var(--accent-gold)'"
                        onmouseout="this.style.borderColor='var(--glass-border)'">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                                <span style="
                                    width: 14px;
                                    height: 14px;
                                    border-radius: 50%;
                                    background: ${v.version_color};
                                    border: 1px solid rgba(0,0,0,0.2);
                                "></span>
                                <span style="font-weight: 600;">${v.version_name}</span>
                                <span style="color: var(--text-muted); font-size: 0.85em;">
                                    ${new Date(v.upload_date).toLocaleDateString()}
                                </span>
                            </div>
                            <div style="font-size: 0.85em; color: var(--text-muted);">
                                ${castCount} character${castCount !== 1 ? 's' : ''} •
                                ${hasElements ? 'Has elements' : 'No elements'}
                                ${breakdown.synopsis ? ` • Synopsis: "${breakdown.synopsis.substring(0, 50)}..."` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="modal-actions" style="margin-top: 20px;">
                <button class="modal-btn" onclick="closeCopyFromVersionModal()">Cancel</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
};

/**
 * Close copy from version modal
 */
window.closeCopyFromVersionModal = function() {
    const modal = document.getElementById('copy-from-version-modal');
    if (modal) modal.style.display = 'none';
};

/**
 * Execute copy breakdown from another version
 */
window.performCopyFromVersion = function(sceneIndex, sourceVersionId) {
    const sceneNumber = (sceneIndex + 1).toString();

    if (!confirm('This will replace the current breakdown for this scene. Continue?')) {
        return;
    }

    const success = copySceneFromVersion(sceneNumber, sourceVersionId);

    if (success) {
        closeCopyFromVersionModal();
        renderBreakdownPanel();

        // Show success toast
        if (window.showToast) {
            window.showToast('Breakdown copied successfully', 'success');
        } else {
            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed;
                bottom: 24px;
                right: 24px;
                padding: 12px 24px;
                background: #22c55e;
                color: white;
                border-radius: 8px;
                z-index: 10001;
                font-size: 0.9em;
                font-weight: 600;
            `;
            toast.textContent = 'Breakdown copied successfully';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    } else {
        alert('Failed to copy breakdown. Please try again.');
    }
};

/**
 * Mark breakdown as reviewed (clear needs_review flag)
 */
window.markBreakdownReviewed = function(sceneIndex) {
    const breakdown = state.sceneBreakdowns[sceneIndex];
    if (breakdown) {
        delete breakdown._needs_review;
        delete breakdown._changes;

        // Also update in current version
        const currentVersion = getCurrentVersion();
        if (currentVersion) {
            const sceneNumber = (sceneIndex + 1).toString();
            if (currentVersion.breakdowns[sceneNumber]) {
                delete currentVersion.breakdowns[sceneNumber]._needs_review;
                delete currentVersion.breakdowns[sceneNumber]._changes;
            }
        }

        // Save and re-render
        saveToLocalStorage();
        renderBreakdownPanel();

        // Show confirmation
        if (window.showToast) {
            window.showToast('Breakdown marked as reviewed', 'success');
        }
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
