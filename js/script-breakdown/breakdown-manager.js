/**
 * breakdown-manager.js
 * Enhanced Scene Breakdown Manager with workflow integration
 *
 * Responsibilities:
 * - Manage scene breakdown workflow with character focus
 * - Provide quick-add functionality for continuity items
 * - Track character states and continuity across scenes
 * - Bi-directional sync with character profiles
 * - Real-time updates and data flow
 */

import { state } from './main.js';
import { renderBreakdownPanel } from './breakdown-form.js';

// ============================================================================
// SCENE BREAKDOWN MANAGER CLASS
// ============================================================================

/**
 * SceneBreakdownManager class
 * Manages scene breakdown workflow and character continuity tracking
 */
export class SceneBreakdownManager {
    constructor() {
        this.currentScene = null;
        this.continuityStates = {};
    }

    /**
     * Load and render breakdown for a scene
     * @param {number} sceneIndex - Scene index
     */
    loadSceneBreakdown(sceneIndex) {
        this.currentScene = sceneIndex;
        const scene = state.scenes[sceneIndex];

        if (!scene) {
            console.error('Scene not found:', sceneIndex);
            return;
        }

        // Get story position context
        const storyPosition = this.getStoryPosition(sceneIndex);

        // Load character states for this scene
        this.loadCharacterStates(sceneIndex, storyPosition);

        // Render the breakdown
        this.renderEnhancedBreakdown();
    }

    /**
     * Get story position context for a scene
     * @param {number} sceneIndex - Scene index
     * @returns {Object} Story position data
     */
    getStoryPosition(sceneIndex) {
        const scene = state.scenes[sceneIndex];
        const narrativeContext = window.scriptNarrativeContext;

        return {
            storyDay: scene.storyDay || 'Unassigned',
            timeOfDay: scene.timeOfDay || '',
            sceneNumber: scene.number,
            sceneHeading: scene.heading,
            narrativeImportance: this.getSceneNarrativeImportance(sceneIndex, narrativeContext)
        };
    }

    /**
     * Get narrative importance of scene from narrative context
     * @param {number} sceneIndex - Scene index
     * @param {Object} narrativeContext - Narrative context
     * @returns {number} Importance score (1-10)
     */
    getSceneNarrativeImportance(sceneIndex, narrativeContext) {
        if (!narrativeContext || !narrativeContext.storyStructure) return 5;

        // Check if scene is a turning point
        const turningPoints = narrativeContext.storyStructure.turningPoints || [];
        const isTurningPoint = turningPoints.some(tp =>
            tp.scenes && tp.scenes.includes(sceneIndex)
        );

        // Check if scene is part of climax
        const climax = narrativeContext.storyStructure.climax;
        const isClimax = climax && climax.scenes && climax.scenes.includes(sceneIndex);

        if (isClimax) return 10;
        if (isTurningPoint) return 9;
        return 5;
    }

    /**
     * Load character states for current scene
     * @param {number} sceneIndex - Scene index
     * @param {Object} storyPosition - Story position data
     */
    loadCharacterStates(sceneIndex, storyPosition) {
        const breakdown = state.sceneBreakdowns[sceneIndex] || {};
        const cast = breakdown.cast || [];

        this.continuityStates = {};

        cast.forEach(character => {
            const charState = state.characterStates[sceneIndex]?.[character] || {};
            const lastAppearance = this.getLastAppearance(character, sceneIndex);
            const activeItems = this.getActiveItems(character, sceneIndex);

            this.continuityStates[character] = {
                character: character,
                currentState: charState,
                lastAppearance: lastAppearance,
                activeItems: activeItems,
                storyPosition: storyPosition
            };
        });
    }

    /**
     * Get last appearance info for character
     * @param {string} character - Character name
     * @param {number} currentSceneIndex - Current scene index
     * @returns {Object|null} Last appearance data
     */
    getLastAppearance(character, currentSceneIndex) {
        for (let i = currentSceneIndex - 1; i >= 0; i--) {
            const breakdown = state.sceneBreakdowns[i] || {};
            if (breakdown.cast && breakdown.cast.includes(character)) {
                return {
                    sceneIndex: i,
                    sceneNumber: state.scenes[i].number,
                    storyDay: state.scenes[i].storyDay || 'Unassigned'
                };
            }
        }
        return null;
    }

    /**
     * Get active continuity items for character at this point in story
     * @param {string} character - Character name
     * @param {number} sceneIndex - Scene index
     * @returns {Array} Active items
     */
    getActiveItems(character, sceneIndex) {
        const items = [];
        const narrativeContext = window.scriptNarrativeContext;

        // Get injuries that are still healing
        if (narrativeContext?.elements?.injuries) {
            narrativeContext.elements.injuries
                .filter(inj => inj.character === character && inj.scene <= sceneIndex)
                .forEach(injury => {
                    const healingProgress = this.calculateHealingProgress(injury, sceneIndex);
                    if (healingProgress < 100) {
                        items.push({
                            type: 'injury',
                            category: 'injuries',
                            description: injury.type || injury.description,
                            scene: injury.scene,
                            healingProgress: healingProgress,
                            importance: injury.narrativeImportance || 8
                        });
                    }
                });
        }

        // Get recent appearance changes
        const recentScenes = Math.max(0, sceneIndex - 5);
        for (let i = recentScenes; i <= sceneIndex; i++) {
            const tags = state.scriptTags[i] || [];
            tags.forEach(tag => {
                if (tag.character === character && this.isAppearanceCategory(tag.category)) {
                    items.push({
                        type: tag.category,
                        category: tag.category,
                        description: tag.selectedText || tag.notes,
                        scene: i,
                        importance: tag.importance || 5
                    });
                }
            });
        }

        return items;
    }

    /**
     * Calculate healing progress for an injury
     * @param {Object} injury - Injury object
     * @param {number} currentSceneIndex - Current scene index
     * @returns {number} Healing percentage (0-100)
     */
    calculateHealingProgress(injury, currentSceneIndex) {
        const injuryScene = injury.scene;
        const scenesSince = currentSceneIndex - injuryScene;

        // Simple healing model: 10% per scene, capped at 100%
        const healingDays = injury.healingDays || 7;
        const progressPerScene = 100 / healingDays;

        return Math.min(100, scenesSince * progressPerScene);
    }

    /**
     * Check if category is appearance-related
     * @param {string} category - Category name
     * @returns {boolean} True if appearance-related
     */
    isAppearanceCategory(category) {
        const appearanceCategories = ['hair', 'makeup', 'sfx', 'wardrobe', 'injuries', 'health'];
        return appearanceCategories.includes(category);
    }

    /**
     * Render breakdown panel - single comprehensive view
     */
    renderEnhancedBreakdown() {
        const container = document.getElementById('breakdown-panel');
        if (!container) return;

        if (this.currentScene === null) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-title">Select a Scene</div>
                    <div class="empty-desc">Choose a scene to view and edit its breakdown</div>
                </div>
            `;
            return;
        }

        // Render the comprehensive breakdown view directly
        renderBreakdownPanel();
    }


    /**
     * Get icon for category
     * @param {string} category - Category name
     * @returns {string} Emoji icon
     */
    getCategoryIcon(category) {
        const icons = {
            'injury': '🩹',
            'injuries': '🩹',
            'hair': '✂️',
            'makeup': '💄',
            'wardrobe': '👔',
            'health': '🏥',
            'sfx': '🎭',
            'stunts': '🎬',
            'weather': '🌤️',
            'extras': '👥'
        };
        return icons[category] || '●';
    }


    /**
     * View character timeline
     * @param {string} character - Character name
     */
    viewCharacterTimeline(character) {
        const charId = `character-${character.toLowerCase().replace(/\s+/g, '-')}`;
        if (typeof window.switchCenterTab === 'function') {
            window.switchCenterTab(charId);
        }
    }


    /**
     * Show quick add form
     * @param {string} category - Category type
     * @param {string} character - Character name
     */
    showQuickAddForm(category, character) {
        const formHtml = `
            <div class="quick-add-form-overlay" onclick="window.breakdownManager.cancelQuickAdd()">
                <div class="quick-add-form" onclick="event.stopPropagation()">
                    <h4 class="form-title">Add ${category} for ${escapeHtml(character)}</h4>
                    <input type="text"
                           id="quick-desc"
                           class="quick-input"
                           placeholder="Description..."
                           onkeyup="if(event.key==='Enter') window.breakdownManager.saveQuickAdd('${category}', '${escapeHtml(character).replace(/'/g, "\\'")}')">
                    ${category === 'injury' ? `
                        <select id="injury-severity" class="quick-select">
                            <option value="minor">Minor</option>
                            <option value="moderate">Moderate</option>
                            <option value="severe">Severe</option>
                        </select>
                        <input type="number"
                               id="healing-days"
                               class="quick-input"
                               placeholder="Healing days"
                               value="7">
                    ` : ''}
                    <div class="form-actions">
                        <button class="form-btn primary" onclick="window.breakdownManager.saveQuickAdd('${category}', '${escapeHtml(character).replace(/'/g, "\\'")}')">
                            Add
                        </button>
                        <button class="form-btn" onclick="window.breakdownManager.cancelQuickAdd()">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', formHtml);
        document.getElementById('quick-desc')?.focus();
    }

    /**
     * Save quick add item
     * @param {string} category - Category type
     * @param {string} character - Character name
     */
    async saveQuickAdd(category, character) {
        const descInput = document.getElementById('quick-desc');
        const description = descInput?.value.trim();

        if (!description) {
            showToast('Please enter a description', 'warning');
            return;
        }

        // Create tag in current scene
        const tag = {
            id: generateId(),
            category: category,
            character: character,
            selectedText: description,
            notes: '',
            sceneIndex: this.currentScene,
            timestamp: Date.now()
        };

        // Handle injury-specific data
        if (category === 'injury') {
            const severityInput = document.getElementById('injury-severity');
            const healingInput = document.getElementById('healing-days');

            tag.severity = severityInput?.value || 'moderate';
            tag.healingDays = parseInt(healingInput?.value) || 7;
        }

        // Add to scriptTags
        if (!state.scriptTags[this.currentScene]) {
            state.scriptTags[this.currentScene] = [];
        }
        state.scriptTags[this.currentScene].push(tag);

        // Update character state in breakdown
        if (!state.characterStates[this.currentScene]) {
            state.characterStates[this.currentScene] = {};
        }
        if (!state.characterStates[this.currentScene][character]) {
            state.characterStates[this.currentScene][character] = {};
        }

        // Add to appropriate field
        if (!state.characterStates[this.currentScene][character][category]) {
            state.characterStates[this.currentScene][character][category] = description;
        }

        // Save project
        try {
            const { saveProject } = await import('./export-handlers.js');
            saveProject();
        } catch (error) {
            console.error('Error saving project:', error);
        }

        // Update character timeline
        this.updateCharacterTimelineFromTag(character, tag);

        // Close form and refresh
        this.cancelQuickAdd();
        this.loadSceneBreakdown(this.currentScene);

        // Show confirmation
        showToast(`Added ${category} for ${character}`, 'success');

        // Dispatch event for other components
        document.dispatchEvent(new CustomEvent('tagCreated', {
            detail: { character, category, text: description, sceneId: this.currentScene, tag }
        }));
    }

    /**
     * Update character timeline from tag
     * @param {string} character - Character name
     * @param {Object} tag - Tag object
     */
    updateCharacterTimelineFromTag(character, tag) {
        // This will be picked up by the character profile when it re-renders
        // The profile already watches scriptTags, so no additional work needed
        console.log(`Timeline update queued for ${character}:`, tag);
    }

    /**
     * Cancel quick add form
     */
    cancelQuickAdd() {
        const overlay = document.querySelector('.quick-add-form-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    /**
     * Add continuity item (full modal)
     * @param {string} character - Character name
     */
    addContinuityItem(character) {
        // Open the full continuity modal
        if (typeof window.openContinuityEditModal === 'function') {
            window.openContinuityEditModal(this.currentScene, character);
        }
    }

    /**
     * Copy from last scene
     * @param {string} character - Character name
     */
    async copyFromLastScene(character) {
        const state = this.continuityStates[character];
        if (!state || !state.lastAppearance) return;

        const lastSceneIndex = state.lastAppearance.sceneIndex;
        const lastState = window.state.characterStates[lastSceneIndex]?.[character];

        if (!lastState) {
            showToast('No data to copy from previous scene', 'warning');
            return;
        }

        // Copy to current scene
        if (!window.state.characterStates[this.currentScene]) {
            window.state.characterStates[this.currentScene] = {};
        }
        window.state.characterStates[this.currentScene][character] = { ...lastState };

        // Save
        try {
            const { saveProject } = await import('./export-handlers.js');
            saveProject();
        } catch (error) {
            console.error('Error saving project:', error);
        }

        // Refresh
        this.loadSceneBreakdown(this.currentScene);
        showToast(`Copied data from Scene ${state.lastAppearance.sceneNumber}`, 'success');
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Escape HTML
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Generate unique ID
 * @returns {string} Unique ID
 */
function generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Show toast notification
 * @param {string} message - Message to show
 * @param {string} type - Type (success, warning, error)
 */
function showToast(message, type = 'info') {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================================================
// INITIALIZE GLOBAL INSTANCE
// ============================================================================

// Create global breakdown manager instance
window.breakdownManager = new SceneBreakdownManager();

// Export for module use
export default window.breakdownManager;
