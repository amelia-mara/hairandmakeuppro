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

            <!-- SYNOPSIS WITH EDIT BUTTON -->
            <div class="scene-synopsis-container">
                ${scene.synopsis
                    ? `<div class="scene-synopsis">${escapeHtml(scene.synopsis)}</div>`
                    : `<div class="scene-synopsis placeholder">No synopsis yet</div>`
                }
                <button class="edit-synopsis-btn"
                        onclick="event.stopPropagation(); openSynopsisEditor(${sceneIndex})"
                        title="Edit synopsis">
                    ✏️ Edit
                </button>
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

/**
 * Open synopsis editor modal
 * @param {number} sceneIndex - Index of the scene to edit
 */
function openSynopsisEditor(sceneIndex) {
    const scene = state.scenes[sceneIndex];
    if (!scene) return;

    // Create modal if it doesn't exist
    let modal = document.getElementById('synopsis-editor-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'synopsis-editor-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3>Edit Synopsis - Scene ${scene.number}</h3>
                <button class="modal-close-btn" onclick="closeSynopsisEditor()">×</button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 8px; font-size: 0.875em; color: var(--text-muted);">
                    ${escapeHtml(scene.heading)}
                </div>
                <textarea id="synopsis-editor-textarea"
                          class="modal-textarea"
                          rows="6"
                          placeholder="Enter scene synopsis...">${escapeHtml(scene.synopsis || '')}</textarea>
                <button class="ai-btn-compact" onclick="generateSynopsisInEditor(${sceneIndex})" style="margin-top: 8px; width: 100%;">
                    🤖 Generate with AI
                </button>
            </div>
            <div class="modal-footer">
                <button class="modal-btn secondary" onclick="closeSynopsisEditor()">Cancel</button>
                <button class="modal-btn primary" onclick="saveSynopsisFromEditor(${sceneIndex})">Save</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
    document.getElementById('synopsis-editor-textarea')?.focus();
}

/**
 * Close synopsis editor modal
 */
function closeSynopsisEditor() {
    const modal = document.getElementById('synopsis-editor-modal');
    if (modal) modal.style.display = 'none';
}

/**
 * Save synopsis from editor
 */
async function saveSynopsisFromEditor(sceneIndex) {
    const textarea = document.getElementById('synopsis-editor-textarea');
    if (!textarea) return;

    const synopsis = textarea.value.trim();

    // Update scene
    state.scenes[sceneIndex].synopsis = synopsis;

    // Update breakdown
    if (!state.sceneBreakdowns[sceneIndex]) {
        state.sceneBreakdowns[sceneIndex] = {};
    }
    state.sceneBreakdowns[sceneIndex].synopsis = synopsis;

    // Save project
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Re-render scene list
    renderSceneList();

    // Re-render breakdown panel if this is the current scene
    if (state.currentScene === sceneIndex) {
        const { renderBreakdownPanel } = await import('./breakdown-form.js');
        renderBreakdownPanel();
    }

    // Close modal
    closeSynopsisEditor();
}

/**
 * Generate synopsis using AI in the editor
 */
async function generateSynopsisInEditor(sceneIndex) {
    const textarea = document.getElementById('synopsis-editor-textarea');
    if (!textarea) return;

    try {
        textarea.placeholder = 'Generating synopsis with AI...';
        textarea.disabled = true;

        const { generateAISynopsis } = await import('./ai-integration.js');
        const synopsis = await generateAISynopsis(sceneIndex);

        textarea.value = synopsis;
        textarea.disabled = false;
        textarea.focus();
    } catch (error) {
        console.error('Error generating synopsis:', error);
        alert('Failed to generate synopsis: ' + error.message);
        textarea.disabled = false;
        textarea.placeholder = 'Enter scene synopsis...';
    }
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

// Make functions available globally for HTML onclick handlers (legacy support)
window.renderSceneList = renderSceneList;
window.openSynopsisEditor = openSynopsisEditor;
window.closeSynopsisEditor = closeSynopsisEditor;
window.saveSynopsisFromEditor = saveSynopsisFromEditor;
window.generateSynopsisInEditor = generateSynopsisInEditor;
