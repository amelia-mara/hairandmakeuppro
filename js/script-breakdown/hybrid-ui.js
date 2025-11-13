/**
 * hybrid-ui.js
 * UI interaction functions for hybrid breakdown system
 *
 * Provides user-facing functions for:
 * - Accepting/rejecting/editing suggestions
 * - Adding manual items
 * - Scene navigation and review workflow
 * - Progress tracking
 */

import { state, navigateToScene } from './main.js';
import { SuggestionStatus, ReviewStatus } from './hybrid-breakdown-manager.js';

// ============================================================================
// SUGGESTION ACTIONS
// ============================================================================

/**
 * Accept a suggestion
 */
export function acceptSuggestion(suggestionId) {
    const manager = window.hybridBreakdownManager;
    if (!manager) return;

    const success = manager.acceptSuggestion(suggestionId);
    if (success) {
        // Update UI
        const element = document.querySelector(`[data-suggestion-id="${suggestionId}"]`);
        if (element) {
            element.classList.remove('pending');
            element.classList.add('accepted');

            // Animate acceptance
            element.style.transition = 'all 0.3s ease';
            setTimeout(() => {
                element.style.opacity = '0.6';
            }, 100);
        }

        showToast('Suggestion accepted', 'success');

        // Refresh the breakdown display if needed
        refreshCurrentSceneDisplay();
    }
}

/**
 * Reject a suggestion
 */
export function rejectSuggestion(suggestionId) {
    const manager = window.hybridBreakdownManager;
    if (!manager) return;

    const success = manager.rejectSuggestion(suggestionId);
    if (success) {
        // Update UI
        const element = document.querySelector(`[data-suggestion-id="${suggestionId}"]`);
        if (element) {
            element.classList.remove('pending');
            element.classList.add('rejected');

            // Animate rejection
            element.style.transition = 'all 0.3s ease';
            setTimeout(() => {
                element.style.opacity = '0.3';
                element.style.textDecoration = 'line-through';
            }, 100);
        }

        showToast('Suggestion rejected', 'info');
    }
}

/**
 * Show inline editor for a suggestion
 */
export function editSuggestion(suggestionId) {
    const manager = window.hybridBreakdownManager;
    if (!manager) return;

    const result = manager.getSuggestion(suggestionId);
    if (!result) return;

    const { suggestion } = result;
    const element = document.querySelector(`[data-suggestion-id="${suggestionId}"]`);
    if (!element) return;

    // Store original content
    const contentDiv = element.querySelector('.suggestion-content');
    const originalHTML = contentDiv.innerHTML;

    // Create inline editor
    const editorHTML = `
        <div class="inline-editor">
            <div class="editor-field">
                <label>Description:</label>
                <input type="text"
                       id="edit-description-${suggestionId}"
                       value="${escapeHtml(suggestion.description)}"
                       class="editor-input">
            </div>
            <div class="editor-field">
                <label>Category:</label>
                <select id="edit-category-${suggestionId}" class="editor-select">
                    ${getCategoryOptions(suggestion.category)}
                </select>
            </div>
            <div class="editor-actions">
                <button onclick="saveEdit('${suggestionId}')" class="btn-save">
                    Save
                </button>
                <button onclick="cancelEdit('${suggestionId}', \`${escapeForAttribute(originalHTML)}\`)"
                        class="btn-cancel">
                    Cancel
                </button>
            </div>
        </div>
    `;

    contentDiv.innerHTML = editorHTML;
    element.classList.add('editing');
}

/**
 * Save edited suggestion
 */
export function saveEdit(suggestionId) {
    const manager = window.hybridBreakdownManager;
    if (!manager) return;

    const descriptionInput = document.getElementById(`edit-description-${suggestionId}`);
    const categorySelect = document.getElementById(`edit-category-${suggestionId}`);

    if (!descriptionInput || !categorySelect) return;

    const newData = {
        description: descriptionInput.value,
        category: categorySelect.value
    };

    const success = manager.editSuggestion(suggestionId, newData);
    if (success) {
        showToast('Suggestion edited and accepted', 'success');

        // Refresh display
        refreshCurrentSceneDisplay();
    }
}

/**
 * Cancel editing
 */
export function cancelEdit(suggestionId, originalHTML) {
    const element = document.querySelector(`[data-suggestion-id="${suggestionId}"]`);
    if (!element) return;

    const contentDiv = element.querySelector('.suggestion-content');
    contentDiv.innerHTML = originalHTML;
    element.classList.remove('editing');
}

/**
 * Accept all pending suggestions for current scene
 */
export function acceptAllSuggestions() {
    const manager = window.hybridBreakdownManager;
    if (!manager || state.currentScene === null) return;

    const count = manager.acceptAllSuggestionsForScene(state.currentScene);

    if (count > 0) {
        showToast(`${count} suggestions accepted`, 'success');
        refreshCurrentSceneDisplay();
    } else {
        showToast('No pending suggestions to accept', 'info');
    }
}

// ============================================================================
// MANUAL ADDITIONS
// ============================================================================

/**
 * Show quick add modal for manual continuity items
 */
export function quickAddContinuity() {
    if (state.currentScene === null) {
        showToast('Please select a scene first', 'warning');
        return;
    }

    const scene = state.scenes[state.currentScene];
    if (!scene) return;

    const modalHTML = `
        <div class="modal-overlay" id="quick-add-overlay" onclick="closeQuickAdd()">
            <div class="modal-content quick-add-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Add Continuity Item</h3>
                    <button class="modal-close" onclick="closeQuickAdd()">×</button>
                </div>

                <div class="modal-body">
                    <div class="add-form">
                        <div class="form-field">
                            <label for="add-character">Character:</label>
                            <select id="add-character" class="form-select">
                                ${getCharacterOptions()}
                            </select>
                        </div>

                        <div class="form-field">
                            <label for="add-category">Category:</label>
                            <select id="add-category" class="form-select">
                                <option value="injuries">Injury</option>
                                <option value="hair">Hair</option>
                                <option value="makeup">Makeup</option>
                                <option value="wardrobe">Wardrobe</option>
                                <option value="condition">Condition</option>
                                <option value="props">Props</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        <div class="form-field">
                            <label for="add-description">Description:</label>
                            <textarea id="add-description"
                                      class="form-textarea"
                                      rows="3"
                                      placeholder="Describe the continuity element..."></textarea>
                        </div>

                        <div class="form-field">
                            <label for="add-duration">Duration/Progression:</label>
                            <input type="text"
                                   id="add-duration"
                                   class="form-input"
                                   placeholder="e.g., 'Heals over 5 days' or 'Entire film'">
                        </div>

                        <div class="form-field">
                            <label for="add-importance">Importance:</label>
                            <div class="importance-slider-container">
                                <input type="range"
                                       id="add-importance"
                                       class="importance-slider"
                                       min="1"
                                       max="10"
                                       value="5">
                                <span id="importance-value" class="importance-value">5</span>
                            </div>
                        </div>

                        <div class="form-field">
                            <label for="add-notes">Notes:</label>
                            <textarea id="add-notes"
                                      class="form-textarea"
                                      rows="2"
                                      placeholder="Additional notes or details..."></textarea>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button onclick="saveManualAddition()" class="btn-primary">
                        Add Item
                    </button>
                    <button onclick="closeQuickAdd()" class="btn-secondary">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;

    // Add modal to page
    const existingModal = document.getElementById('quick-add-overlay');
    if (existingModal) {
        existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Setup importance slider update
    const slider = document.getElementById('add-importance');
    const valueDisplay = document.getElementById('importance-value');
    slider.addEventListener('input', () => {
        valueDisplay.textContent = slider.value;
    });
}

/**
 * Close quick add modal
 */
export function closeQuickAdd() {
    const modal = document.getElementById('quick-add-overlay');
    if (modal) {
        modal.remove();
    }
}

/**
 * Save manual addition
 */
export function saveManualAddition() {
    const manager = window.hybridBreakdownManager;
    if (!manager || state.currentScene === null) return;

    const character = document.getElementById('add-character').value;
    const category = document.getElementById('add-category').value;
    const description = document.getElementById('add-description').value;
    const duration = document.getElementById('add-duration').value;
    const importance = document.getElementById('add-importance').value;
    const notes = document.getElementById('add-notes').value;

    // Validation
    if (!character) {
        showToast('Please select a character', 'warning');
        return;
    }

    if (!description.trim()) {
        showToast('Please provide a description', 'warning');
        return;
    }

    const itemData = {
        character,
        category,
        description: description.trim(),
        duration: duration.trim(),
        importance: parseInt(importance),
        notes: notes.trim()
    };

    manager.addManualItem(state.currentScene, itemData);

    closeQuickAdd();
    showToast('Continuity item added', 'success');
    refreshCurrentSceneDisplay();
}

/**
 * Delete a confirmed or manual item
 */
export function deleteItem(sceneIndex, itemId, isManual) {
    const manager = window.hybridBreakdownManager;
    if (!manager) return;

    if (confirm('Are you sure you want to delete this item?')) {
        manager.deleteItem(sceneIndex, itemId, isManual);
        showToast('Item deleted', 'info');
        refreshCurrentSceneDisplay();
    }
}

// ============================================================================
// SCENE REVIEW WORKFLOW
// ============================================================================

/**
 * Start review workflow
 */
export function startReview() {
    const manager = window.hybridBreakdownManager;
    if (!manager) return;

    // Navigate to first scene
    navigateToScene(0);
    manager.setSceneReviewStatus(0, ReviewStatus.IN_PROGRESS);

    showToast('Review started', 'success');
    refreshCurrentSceneDisplay();
}

/**
 * Mark current scene as complete and move to next
 */
export function markSceneComplete() {
    const manager = window.hybridBreakdownManager;
    if (!manager || state.currentScene === null) return;

    manager.markSceneComplete(state.currentScene);

    showToast(`Scene ${state.scenes[state.currentScene].number} marked complete`, 'success');

    // Move to next scene if available
    if (state.currentScene < state.scenes.length - 1) {
        setTimeout(() => {
            nextScene();
        }, 500);
    } else {
        showToast('All scenes reviewed!', 'success');
        refreshCurrentSceneDisplay();
    }
}

/**
 * Navigate to previous scene
 */
export function previousScene() {
    if (state.currentScene === null || state.currentScene <= 0) {
        showToast('Already at first scene', 'info');
        return;
    }

    const manager = window.hybridBreakdownManager;
    const prevIndex = state.currentScene - 1;

    navigateToScene(prevIndex);

    // Update status if not started
    if (manager && manager.getSceneReviewStatus(prevIndex) === ReviewStatus.NOT_STARTED) {
        manager.setSceneReviewStatus(prevIndex, ReviewStatus.IN_PROGRESS);
    }

    refreshCurrentSceneDisplay();
}

/**
 * Navigate to next scene
 */
export function nextScene() {
    if (state.currentScene === null || state.currentScene >= state.scenes.length - 1) {
        showToast('Already at last scene', 'info');
        return;
    }

    const manager = window.hybridBreakdownManager;
    const nextIndex = state.currentScene + 1;

    navigateToScene(nextIndex);

    // Update status if not started
    if (manager && manager.getSceneReviewStatus(nextIndex) === ReviewStatus.NOT_STARTED) {
        manager.setSceneReviewStatus(nextIndex, ReviewStatus.IN_PROGRESS);
    }

    refreshCurrentSceneDisplay();
}

/**
 * Generate AI suggestions for all scenes
 */
export async function generateSuggestions() {
    const manager = window.hybridBreakdownManager;
    if (!manager) return;

    if (!window.scriptNarrativeContext) {
        showToast('Please run narrative analysis first', 'warning');
        return;
    }

    // Show loading indicator
    showLoadingModal('Generating AI suggestions...');

    try {
        await manager.generateAllSuggestions();
        closeLoadingModal();
        showToast('AI suggestions generated', 'success');
        refreshCurrentSceneDisplay();
    } catch (error) {
        closeLoadingModal();
        showToast(`Error: ${error.message}`, 'error');
        console.error('Error generating suggestions:', error);
    }
}

/**
 * Clear all hybrid breakdown data
 */
export function clearHybridData() {
    const manager = window.hybridBreakdownManager;
    if (!manager) return;

    if (confirm('Are you sure you want to clear all suggestions and review data? This cannot be undone.')) {
        manager.clearAllData();
        showToast('Hybrid breakdown data cleared', 'info');
        refreshCurrentSceneDisplay();
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get character options for select dropdown
 */
function getCharacterOptions() {
    const narrativeContext = window.scriptNarrativeContext;
    const characters = [];

    // Get from narrative context
    if (narrativeContext && narrativeContext.characters) {
        characters.push(...narrativeContext.characters.map(c => c.name));
    }

    // Get from current scene breakdown
    if (state.currentScene !== null) {
        const breakdown = state.sceneBreakdowns[state.currentScene];
        if (breakdown && breakdown.cast) {
            breakdown.cast.forEach(char => {
                if (!characters.includes(char)) {
                    characters.push(char);
                }
            });
        }
    }

    if (characters.length === 0) {
        return '<option value="">No characters found</option>';
    }

    return characters.map(char =>
        `<option value="${escapeHtml(char)}">${escapeHtml(char)}</option>`
    ).join('');
}

/**
 * Get category options for select dropdown
 */
function getCategoryOptions(selectedCategory) {
    const categories = [
        { value: 'injuries', label: 'Injury' },
        { value: 'hair', label: 'Hair' },
        { value: 'makeup', label: 'Makeup' },
        { value: 'wardrobe', label: 'Wardrobe' },
        { value: 'condition', label: 'Condition' },
        { value: 'props', label: 'Props' },
        { value: 'other', label: 'Other' }
    ];

    return categories.map(cat =>
        `<option value="${cat.value}" ${cat.value === selectedCategory ? 'selected' : ''}>
            ${cat.label}
        </option>`
    ).join('');
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Show loading modal
 */
function showLoadingModal(message) {
    const modalHTML = `
        <div class="modal-overlay" id="loading-modal">
            <div class="loading-content">
                <div class="spinner"></div>
                <div class="loading-message">${message}</div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Close loading modal
 */
function closeLoadingModal() {
    const modal = document.getElementById('loading-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Refresh current scene display
 */
function refreshCurrentSceneDisplay() {
    if (state.currentScene !== null && window.breakdownManager) {
        window.breakdownManager.loadSceneBreakdown(state.currentScene);
    }
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Escape for attribute
 */
function escapeForAttribute(html) {
    return html.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.acceptSuggestion = acceptSuggestion;
window.rejectSuggestion = rejectSuggestion;
window.editSuggestion = editSuggestion;
window.saveEdit = saveEdit;
window.cancelEdit = cancelEdit;
window.acceptAllSuggestions = acceptAllSuggestions;
window.quickAddContinuity = quickAddContinuity;
window.closeQuickAdd = closeQuickAdd;
window.saveManualAddition = saveManualAddition;
window.deleteItem = deleteItem;
window.previousScene = previousScene;
window.nextScene = nextScene;
window.markSceneComplete = markSceneComplete;
window.startReview = startReview;
window.generateSuggestions = generateSuggestions;
window.clearHybridData = clearHybridData;
