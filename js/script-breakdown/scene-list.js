/**
 * scene-list.js
 * Left sidebar scene navigation
 *
 * Responsibilities:
 * - Render scene cards with metadata
 * - Show scene synopsis, cast, and elements summary
 * - Handle scene selection clicks
 * - Display scene type indicators (INT/EXT, DAY/NIGHT)
 * - Show expanded details for active scene
 */

import { state, selectScene } from './main.js';
import { getSceneType, getSceneTypeLabel, getSceneTypeClass, extractLocation } from './utils.js';

/**
 * Render the scene list in the left sidebar
 * Clean, simplified design with scene type colors
 */
export function renderSceneList() {
    const container = document.getElementById('scene-list');
    if (!container) {
        console.error('Scene list container not found');
        return;
    }

    // Update scene count
    const sceneCountEl = document.getElementById('scene-count');
    if (sceneCountEl) {
        sceneCountEl.textContent = state.scenes.length;
    }

    if (state.scenes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-title">No Scenes</div>
                <div class="empty-desc">Import a screenplay to begin</div>
            </div>
        `;
        return;
    }

    // Get master context for indicators
    const analysis = window.scriptMasterContext || window.masterContext || {};

    container.innerHTML = state.scenes.map((scene, index) => {
        const sceneType = getSceneType(scene.heading);
        const sceneTypeClassName = getSceneTypeClass(sceneType);
        const breakdown = state.sceneBreakdowns[index] || {};
        const cast = breakdown.cast || [];
        const isActive = state.currentScene === index;
        const characterCount = cast.length;

        // Extract location from heading (without INT/EXT and DAY/NIGHT)
        const location = extractLocation(scene.heading);

        // Get scene indicators for special types (flashback, weather, etc.)
        const contextIndicators = getSceneIndicators(index, analysis, scene);

        // Build info line: "Day X · Time · INT/EXT"
        const infoLine = buildInfoLine(scene, sceneType);

        return `
            <div class="scene-item ${sceneTypeClassName} ${isActive ? 'active' : ''}"
                 onclick="selectScene(${index})"
                 data-scene-index="${index}">

                <div class="scene-header">
                    <span class="scene-number">${scene.number || index + 1}</span>
                    <span class="scene-location">${escapeHtml(truncateText(location, 30))}</span>
                    ${sceneType.timeOfDay ? `<span class="scene-time-badge">${sceneType.timeOfDay}</span>` : ''}
                    ${characterCount > 0 ? `<span class="char-count" title="${characterCount} characters">${characterCount}</span>` : ''}
                </div>

                <div class="scene-info-line">
                    ${infoLine}
                    ${contextIndicators.length > 0 ? `
                        <span class="scene-context-indicators">
                            ${contextIndicators.map(ind =>
                                `<span class="context-indicator ${ind.type}" title="${ind.tooltip}">${ind.icon}</span>`
                            ).join('')}
                        </span>
                    ` : ''}
                </div>

                ${isActive ? renderExpandedDetails(scene, cast) : ''}
            </div>
        `;
    }).join('');
}

/**
 * Build the info line for scene card: "Day X · Time · INT/EXT"
 */
function buildInfoLine(scene, sceneType) {
    const parts = [];

    // Story Day with optional note
    if (scene.storyDay) {
        let dayText = scene.storyDay;
        if (scene.storyDayNote) {
            dayText += ` (${scene.storyDayNote})`;
        }
        parts.push(escapeHtml(dayText));
    }

    // Time of day (prefer storyTimeOfDay, fall back to detected)
    if (scene.storyTimeOfDay) {
        parts.push(escapeHtml(scene.storyTimeOfDay));
    }

    // INT/EXT
    if (sceneType.intExt) {
        parts.push(sceneType.intExt);
    }

    return parts.join(' · ');
}

/**
 * Truncate text to specified length with ellipsis
 */
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 1) + '…';
}

/**
 * Get scene indicators based on master context analysis and scene flags
 * @param {number} sceneIndex - Scene index
 * @param {Object} analysis - Master context analysis
 * @param {Object} scene - Scene object (optional)
 * @returns {Array} Array of indicator objects
 */
function getSceneIndicators(sceneIndex, analysis, scene = null) {
    const indicators = [];

    // Check scene type flags (auto-detected or user-set)
    if (scene?.isFlashback) {
        indicators.push({ icon: '⏪', type: 'flashback', tooltip: 'Flashback' });
    }
    if (scene?.isFlashForward) {
        indicators.push({ icon: '⏩', type: 'flashforward', tooltip: 'Flash Forward' });
    }
    if (scene?.isTimeJump) {
        indicators.push({ icon: '⏱️', type: 'timejump', tooltip: 'Time Jump' });
    }
    if (scene?.isDream) {
        indicators.push({ icon: '💭', type: 'dream', tooltip: 'Dream Sequence' });
    }
    if (scene?.isMontage) {
        indicators.push({ icon: '🎞️', type: 'montage', tooltip: 'Montage' });
    }

    // Check for weather conditions
    const environment = analysis.environments?.[`scene_${sceneIndex}`];
    if (environment?.conditions) {
        const conditions = Array.isArray(environment.conditions) ? environment.conditions : [];
        if (conditions.some(c => c.toLowerCase().includes('rain'))) {
            indicators.push({ icon: '🌧️', type: 'weather', tooltip: 'Rain scene' });
        }
        if (conditions.some(c => c.toLowerCase().includes('snow'))) {
            indicators.push({ icon: '❄️', type: 'weather', tooltip: 'Snow scene' });
        }
        if (conditions.some(c => c.toLowerCase().includes('wind'))) {
            indicators.push({ icon: '💨', type: 'weather', tooltip: 'Windy scene' });
        }
    }

    // Check for crowd scenes
    if (analysis.crowdScenes?.[`scene_${sceneIndex}`]) {
        indicators.push({ icon: '👥', type: 'crowd', tooltip: 'Extras required' });
    }

    // Check for action/fight scenes
    const interactions = analysis.interactions?.[`scene_${sceneIndex}`];
    if (interactions?.type === 'fight') {
        indicators.push({ icon: '⚔️', type: 'action', tooltip: 'Fight scene' });
    }

    // Check for emotional beats
    if (analysis.emotionalBeats?.[`scene_${sceneIndex}`]) {
        indicators.push({ icon: '😢', type: 'emotional', tooltip: 'Emotional scene' });
    }

    // Check for special requirements
    if (analysis.specialRequirements?.[`scene_${sceneIndex}`]) {
        indicators.push({ icon: '⚠️', type: 'special', tooltip: 'Special requirements' });
    }

    // Check for stunts/doubling needs
    if (analysis.doublingNeeds?.[`scene_${sceneIndex}`]) {
        indicators.push({ icon: '🎬', type: 'stunt', tooltip: 'Stunt work required' });
    }

    // Check if scene is continuous
    if (analysis.sceneFlow?.continuous) {
        for (let group of analysis.sceneFlow.continuous) {
            if (group.includes(sceneIndex)) {
                indicators.push({ icon: '⚡', type: 'continuous', tooltip: 'Continuous scene' });
                break;
            }
        }
    }

    return indicators;
}

/**
 * Render expanded details for the active scene
 * Clean design without emoji pills
 */
function renderExpandedDetails(scene, cast) {
    const sceneIndex = state.scenes.indexOf(scene);

    return `
        <div class="scene-expanded">
            <!-- SYNOPSIS SECTION -->
            <div class="scene-synopsis-section" data-scene-index="${sceneIndex}">
                <div class="scene-synopsis-header">
                    <span class="scene-synopsis-label">Synopsis</span>
                    ${scene.synopsis
                        ? `<button class="scene-synopsis-edit-btn" onclick="event.stopPropagation(); handleEditSynopsis(${sceneIndex})" title="Edit synopsis">
                            Edit
                        </button>`
                        : `<button class="scene-synopsis-generate-btn" onclick="event.stopPropagation(); handleGenerateSceneSynopsis(${sceneIndex})">
                            Generate AI
                        </button>`
                    }
                </div>
                ${scene.synopsis
                    ? `<div class="scene-synopsis" data-original-synopsis="${escapeHtml(scene.synopsis).replace(/"/g, '&quot;')}">${escapeHtml(scene.synopsis)}</div>`
                    : `<div class="scene-synopsis placeholder">No synopsis yet</div>`
                }
            </div>

            ${cast.length > 0 ? `
                <div class="scene-cast-list">
                    ${cast.map(c => `<span class="char-pill">${escapeHtml(c)}</span>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
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

// ============================================================================
// SYNOPSIS GENERATION
// ============================================================================

/**
 * Handle generating synopsis for a scene from the left sidebar
 */
async function handleGenerateSceneSynopsis(sceneIndex) {
    try {
        // Import the AI function
        const { generateAISynopsis } = await import('./ai-integration.js');

        // Show loading state - find the synopsis div and update it
        const synopsisDiv = document.querySelector('.scene-synopsis');
        const originalContent = synopsisDiv ? synopsisDiv.innerHTML : '';
        if (synopsisDiv) {
            synopsisDiv.innerHTML = 'Generating synopsis...';
            synopsisDiv.classList.remove('placeholder');
        }

        // Generate synopsis
        const synopsis = await generateAISynopsis(sceneIndex);

        // Save to state
        state.scenes[sceneIndex].synopsis = synopsis;

        // Also save to sceneBreakdowns if it exists
        if (!state.sceneBreakdowns[sceneIndex]) {
            state.sceneBreakdowns[sceneIndex] = {};
        }
        state.sceneBreakdowns[sceneIndex].synopsis = synopsis;

        // Save project
        const { saveProject } = await import('./export-handlers.js');
        saveProject();

        // Re-render the scene list to show the new synopsis
        renderSceneList();

        // Also update breakdown panel if it's open for this scene
        if (state.currentScene === sceneIndex) {
            const { renderBreakdownPanel } = await import('./breakdown-form.js');
            renderBreakdownPanel();
        }
    } catch (error) {
        console.error('Error generating synopsis:', error);
        alert('Error generating synopsis: ' + error.message);

        // Re-render to restore original state
        renderSceneList();
    }
}

// ============================================================================
// SYNOPSIS EDITING
// ============================================================================

/**
 * Handle entering edit mode for a scene synopsis
 */
function handleEditSynopsis(sceneIndex) {
    const synopsisSection = document.querySelector(`.scene-synopsis-section[data-scene-index="${sceneIndex}"]`);
    if (!synopsisSection) return;

    const synopsisDiv = synopsisSection.querySelector('.scene-synopsis');
    if (!synopsisDiv) return;

    // Store original text for cancel
    const originalText = synopsisDiv.textContent;
    synopsisDiv.setAttribute('data-original-synopsis', originalText);

    // Make editable
    synopsisDiv.contentEditable = 'true';
    synopsisDiv.classList.add('editing');
    synopsisDiv.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(synopsisDiv);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // Replace header buttons with save/cancel
    const header = synopsisSection.querySelector('.scene-synopsis-header');
    const originalButtonsHtml = header.innerHTML;
    header.setAttribute('data-original-buttons', originalButtonsHtml);

    header.innerHTML = `
        <span class="scene-synopsis-label">📝 Synopsis</span>
        <div class="synopsis-edit-actions">
            <button class="synopsis-save-btn" onclick="event.stopPropagation(); handleSaveSynopsis(${sceneIndex})" title="Save (Enter)">
                ✓
            </button>
            <button class="synopsis-cancel-btn" onclick="event.stopPropagation(); handleCancelSynopsis(${sceneIndex})" title="Cancel (Escape)">
                ✗
            </button>
        </div>
    `;

    // Add keyboard shortcuts
    const keydownHandler = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSaveSynopsis(sceneIndex);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelSynopsis(sceneIndex);
        }
    };
    synopsisDiv.addEventListener('keydown', keydownHandler);
    synopsisDiv.setAttribute('data-has-keydown', 'true');
}

/**
 * Handle saving edited synopsis
 */
async function handleSaveSynopsis(sceneIndex) {
    const synopsisSection = document.querySelector(`.scene-synopsis-section[data-scene-index="${sceneIndex}"]`);
    if (!synopsisSection) return;

    const synopsisDiv = synopsisSection.querySelector('.scene-synopsis');
    if (!synopsisDiv) return;

    // Get the edited text
    const newText = synopsisDiv.textContent.trim();

    // Save to state
    state.scenes[sceneIndex].synopsis = newText;
    state.scenes[sceneIndex].synopsisManuallyEdited = true;

    // Also save to sceneBreakdowns if it exists
    if (!state.sceneBreakdowns[sceneIndex]) {
        state.sceneBreakdowns[sceneIndex] = {};
    }
    state.sceneBreakdowns[sceneIndex].synopsis = newText;
    state.sceneBreakdowns[sceneIndex].synopsisManuallyEdited = true;

    // Save project
    try {
        const { saveProject } = await import('./export-handlers.js');
        saveProject();
    } catch (error) {
        console.error('Error saving project:', error);
    }

    // Exit edit mode and re-render
    exitEditMode(sceneIndex);
    renderSceneList();

    // Also update breakdown panel if it's open for this scene
    if (state.currentScene === sceneIndex) {
        try {
            const { renderBreakdownPanel } = await import('./breakdown-form.js');
            renderBreakdownPanel();
        } catch (error) {
            console.error('Error updating breakdown panel:', error);
        }
    }
}

/**
 * Handle canceling synopsis edit
 */
function handleCancelSynopsis(sceneIndex) {
    exitEditMode(sceneIndex);
    renderSceneList();
}

/**
 * Exit edit mode and restore original state
 */
function exitEditMode(sceneIndex) {
    const synopsisSection = document.querySelector(`.scene-synopsis-section[data-scene-index="${sceneIndex}"]`);
    if (!synopsisSection) return;

    const synopsisDiv = synopsisSection.querySelector('.scene-synopsis');
    if (synopsisDiv) {
        synopsisDiv.contentEditable = 'false';
        synopsisDiv.classList.remove('editing');

        // Remove keydown listener if it was added
        if (synopsisDiv.getAttribute('data-has-keydown')) {
            synopsisDiv.removeAttribute('data-has-keydown');
        }
    }
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

// Make functions available globally for HTML onclick handlers (legacy support)
window.renderSceneList = renderSceneList;
window.handleGenerateSceneSynopsis = handleGenerateSceneSynopsis;
window.handleEditSynopsis = handleEditSynopsis;
window.handleSaveSynopsis = handleSaveSynopsis;
window.handleCancelSynopsis = handleCancelSynopsis;
