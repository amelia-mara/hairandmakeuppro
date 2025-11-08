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
import { getSceneType, getSceneTypeLabel } from './utils.js';

// Element categories for counting
const categories = [
    { id: 'cast', name: 'Cast Members' },
    { id: 'hair', name: 'Hair' },
    { id: 'makeup', name: 'Makeup' },
    { id: 'sfx', name: 'SFX Makeup' },
    { id: 'health', name: 'Health/Illness' },
    { id: 'injuries', name: 'Injuries/Wounds' },
    { id: 'stunts', name: 'Stunts/Action' },
    { id: 'weather', name: 'Weather Effects' },
    { id: 'wardrobe', name: 'Costume/Wardrobe' },
    { id: 'extras', name: 'Supporting Artists' }
];

/**
 * Render the scene list in the left sidebar
 * Shows scene cards with metadata, cast, and element counts
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

    container.innerHTML = state.scenes.map((scene, index) => {
        const sceneType = getSceneType(scene.heading);
        const sceneTypeLabel = getSceneTypeLabel(sceneType);
        const breakdown = state.sceneBreakdowns[index] || {};
        const cast = breakdown.cast || [];
        const isActive = state.currentScene === index;

        // Count elements (excluding cast)
        let elementCounts = [];
        categories.forEach(cat => {
            const items = breakdown[cat.id] || [];
            if (items.length > 0 && cat.id !== 'cast') {
                elementCounts.push(`${cat.name}: ${items.length}`);
            }
        });

        return `
            <div class="scene-item ${sceneType} ${isActive ? 'active' : ''}" onclick="selectScene(${index})">
                <div class="scene-header">
                    <div class="scene-number">${scene.number}</div>
                    <div class="scene-info">
                        <div class="scene-heading">${escapeHtml(scene.heading)}</div>
                        <div class="scene-meta">
                            <span class="scene-type-indicator ${sceneType}">${sceneTypeLabel}</span>
                        </div>
                    </div>
                </div>

                ${isActive ? renderExpandedDetails(scene, cast, elementCounts) : ''}
            </div>
        `;
    }).join('');
}

/**
 * Render expanded details for the active scene
 */
function renderExpandedDetails(scene, cast, elementCounts) {
    const sceneIndex = state.scenes.indexOf(scene);

    return `
        <div class="scene-expanded">
            <!-- READ-ONLY METADATA OVERVIEW -->
            <div class="scene-metadata-overview">
                ${scene.storyDay ? `
                    <div class="metadata-pill">
                        <span class="metadata-pill-icon">📅</span>
                        <span class="metadata-pill-text">${escapeHtml(scene.storyDay)}</span>
                    </div>
                ` : ''}
                ${scene.timeOfDay ? `
                    <div class="metadata-pill">
                        <span class="metadata-pill-icon">🕐</span>
                        <span class="metadata-pill-text">${escapeHtml(scene.timeOfDay)}</span>
                    </div>
                ` : ''}
                ${scene.location ? `
                    <div class="metadata-pill">
                        <span class="metadata-pill-icon">📍</span>
                        <span class="metadata-pill-text">${escapeHtml(scene.location)}</span>
                    </div>
                ` : ''}
            </div>

            <!-- SYNOPSIS SECTION -->
            <div class="scene-synopsis-section">
                <div class="scene-synopsis-header">
                    <span class="scene-synopsis-label">📝 Synopsis</span>
                    <button class="scene-synopsis-generate-btn" onclick="event.stopPropagation(); handleGenerateSceneSynopsis(${sceneIndex})">
                        Generate AI
                    </button>
                </div>
                ${scene.synopsis
                    ? `<div class="scene-synopsis">${escapeHtml(scene.synopsis)}</div>`
                    : `<div class="scene-synopsis placeholder">No synopsis yet - click Generate AI</div>`
                }
            </div>

            ${cast.length > 0 ? `
                <div class="scene-cast-list">
                    ${cast.map(c => `<div class="cast-chip">${escapeHtml(c)}</div>`).join('')}
                </div>
            ` : ''}

            ${elementCounts.length > 0 ? `
                <div class="element-summary">
                    ${elementCounts.slice(0, 3).map(e => `<div class="element-count">${escapeHtml(e)}</div>`).join('')}
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
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

// Make functions available globally for HTML onclick handlers (legacy support)
window.renderSceneList = renderSceneList;
window.handleGenerateSceneSynopsis = handleGenerateSceneSynopsis;
