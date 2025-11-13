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
import { renderBreakdownPanel } from './breakdown-form.js';

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
export async function generateSuggestions(event) {
    const manager = window.hybridBreakdownManager;
    if (!manager) return;

    if (!window.scriptNarrativeContext) {
        showToast('Please run narrative analysis first', 'warning');
        return;
    }

    if (!state.scenes || state.scenes.length === 0) {
        showToast('No scenes available to analyze', 'warning');
        return;
    }

    // Get button reference if called from event
    let button = null;
    let originalContent = '';

    if (event) {
        button = event.target.closest('.tools-panel-btn');
        if (button) {
            originalContent = button.innerHTML;
            button.disabled = true;
        }
    }

    try {
        const totalScenes = state.scenes.length;

        // Show initial progress
        if (button) {
            button.innerHTML = `
                <span class="btn-progress-text">Analyzing scenes...</span>
                <div class="btn-progress-bar">
                    <div class="btn-progress-fill" style="width: 0%"></div>
                </div>
            `;
        }

        // Clear existing suggestions
        manager.suggestedContinuity.clear();

        const narrativeContext = window.scriptNarrativeContext;

        // Generate suggestions for each scene
        for (let i = 0; i < totalScenes; i++) {
            const suggestions = await manager.generateSceneSuggestions(i, narrativeContext);
            if (suggestions && suggestions.length > 0) {
                manager.suggestedContinuity.set(i.toString(), suggestions);
            }

            // Update progress
            const progress = ((i + 1) / totalScenes) * 100;
            if (button) {
                const fillElement = button.querySelector('.btn-progress-fill');
                const textElement = button.querySelector('.btn-progress-text');
                if (fillElement) fillElement.style.width = progress + '%';
                if (textElement) textElement.textContent = `Scene ${i + 1}/${totalScenes}`;
            }

            // Small delay to prevent UI freezing
            if (i < totalScenes - 1) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        manager.saveToStorage();

        // Restore button
        if (button) {
            button.innerHTML = originalContent;
            button.disabled = false;
        }

        showToast('AI suggestions generated', 'success');

        // Display suggestions overview in right panel
        displaySuggestionsOverview();

    } catch (error) {
        // Restore button on error
        if (button) {
            button.innerHTML = originalContent;
            button.disabled = false;
        }

        showToast(`Error: ${error.message}`, 'error');
        console.error('Error generating suggestions:', error);
    }
}

/**
 * Display suggestions overview after generation
 */
function displaySuggestionsOverview() {
    const manager = window.hybridBreakdownManager;
    if (!manager) return;

    const panel = document.getElementById('breakdown-panel');
    if (!panel) return;

    // Calculate statistics
    let totalSuggestions = 0;
    let scenesWithSuggestions = 0;
    const categoryCount = {};

    for (let i = 0; i < state.scenes.length; i++) {
        const suggestions = manager.getSuggestionsForScene(i);
        if (suggestions.length > 0) {
            scenesWithSuggestions++;
            totalSuggestions += suggestions.length;

            suggestions.forEach(s => {
                categoryCount[s.category] = (categoryCount[s.category] || 0) + 1;
            });
        }
    }

    // Render overview
    panel.innerHTML = `
        <div class="suggestions-overview">
            <div class="overview-header">
                <h3>AI Suggestions Generated</h3>
                <div class="overview-subtitle">
                    ${scenesWithSuggestions} of ${state.scenes.length} scenes have suggestions
                </div>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${totalSuggestions}</div>
                    <div class="stat-label">Total Suggestions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${scenesWithSuggestions}</div>
                    <div class="stat-label">Scenes with Suggestions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Object.keys(categoryCount).length}</div>
                    <div class="stat-label">Categories Found</div>
                </div>
            </div>

            ${Object.keys(categoryCount).length > 0 ? `
                <div class="category-breakdown">
                    <h4>Suggestions by Category</h4>
                    <div class="category-list">
                        ${Object.entries(categoryCount)
                            .sort((a, b) => b[1] - a[1])
                            .map(([category, count]) => `
                                <div class="category-item">
                                    <span class="category-badge ${category}">${getCategoryLabel(category)}</span>
                                    <span class="category-count">${count} items</span>
                                </div>
                            `).join('')}
                    </div>
                </div>
            ` : ''}

            <div class="overview-actions">
                <button onclick="startReview()" class="btn-primary btn-large">
                    <span class="btn-icon">🚀</span>
                    Start Reviewing Scenes
                </button>
                <button onclick="clearHybridData()" class="btn-secondary">
                    Clear All Suggestions
                </button>
            </div>

            <div class="overview-note">
                <strong>Next Step:</strong> Click "Start Reviewing Scenes" to go through each scene and accept, reject, or edit suggestions.
            </div>
        </div>
    `;
}

/**
 * Get category label
 */
function getCategoryLabel(category) {
    const labels = {
        injuries: 'Injuries',
        hair: 'Hair',
        makeup: 'Makeup',
        wardrobe: 'Wardrobe',
        condition: 'Condition',
        props: 'Props',
        other: 'Other'
    };
    return labels[category] || category;
}

/**
 * Start review workflow
 */
export function startReview(event) {
    const manager = window.hybridBreakdownManager;
    if (!manager) return;

    // Check if suggestions exist
    let hasSuggestions = false;
    for (let i = 0; i < state.scenes.length; i++) {
        const suggestions = manager.getSuggestionsForScene(i);
        if (suggestions.length > 0) {
            hasSuggestions = true;
            break;
        }
    }

    if (!hasSuggestions) {
        showToast('No suggestions found. Generate AI suggestions first.', 'warning');
        return;
    }

    // Enable hybrid mode
    localStorage.setItem('useHybridMode', 'true');

    // Navigate to first scene
    if (state.scenes.length > 0) {
        navigateToScene(0);
        manager.setSceneReviewStatus(0, ReviewStatus.IN_PROGRESS);
    }

    showToast('Review started - Scene 1', 'success');

    // Trigger re-render to show hybrid breakdown
    setTimeout(() => {
        renderBreakdownPanel();
    }, 100);
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
