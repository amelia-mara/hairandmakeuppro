/**
 * export-character-confirmation.js
 * Character confirmation modal - Two-Step Workflow
 *
 * Step 1: Merge Duplicates - Click to select characters for merging
 * Step 2: Confirm Selection - Check characters to include in breakdown
 *
 * IMPORTANT: Data flow is PRESERVED from original implementation.
 * This file only changes the UI/UX, not the underlying data handling.
 */

import { state } from '../main.js';
import { renderScript } from '../script-display.js';
import { renderSceneList } from '../scene-list.js';
import { renderCharacterTabs, renderCharacterTabPanels } from '../character-panel.js';
import { showToast } from './export-core.js';
import { saveProject } from './export-project.js';

// ============================================================================
// MODULE STATE
// ============================================================================

// Current step (1 = merge, 2 = selection)
let currentStep = 1;

// Characters selected for merging (indices into state.detectedCharacters)
let selectedForMerge = new Set();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize character name to title case
 */
function normalizeCharacterName(name) {
    return name.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Get confidence display based on scene count
 */
function getConfidenceDisplay(sceneCount) {
    if (sceneCount >= 5) {
        return { label: 'High', bgColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981' };
    } else if (sceneCount >= 3) {
        return { label: 'Medium', bgColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' };
    }
    return { label: 'Low', bgColor: 'rgba(107, 114, 128, 0.2)', color: '#6b7280' };
}

/**
 * Update step indicator UI
 */
function updateStepIndicators() {
    const step1 = document.getElementById('confirm-step-indicator-1');
    const step2 = document.getElementById('confirm-step-indicator-2');

    if (step1) step1.classList.toggle('active', currentStep === 1);
    if (step2) step2.classList.toggle('active', currentStep === 2);
}

// ============================================================================
// MODAL CREATION
// ============================================================================

/**
 * Show character confirmation modal for user to review detected characters
 * THIS IS THE MAIN ENTRY POINT - Called after script analysis
 */
export function showCharacterConfirmationModal() {
    console.log('showCharacterConfirmationModal called');
    console.log('state.detectedCharacters:', state.detectedCharacters?.length || 0);

    // Remove existing modal to ensure fresh render
    const existingModal = document.getElementById('character-confirm-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create fresh modal
    const modal = createCharacterConfirmationModal();
    document.body.appendChild(modal);

    // Add styles
    addModalStyles();

    // Reset state
    currentStep = 1;
    selectedForMerge.clear();

    // Ensure characters have needed properties
    if (state.detectedCharacters && Array.isArray(state.detectedCharacters)) {
        state.detectedCharacters.forEach(char => {
            if (char.selected === undefined) {
                char.selected = true;
            }
            if (char.merged === undefined) {
                char.merged = false;
            }
        });
    }

    // Update UI
    updateStepIndicators();
    showStep1();
    renderMergeList();

    // Show modal
    modal.style.display = 'flex';
    console.log('Character confirmation modal opened with two-step workflow');
}

/**
 * Create the character confirmation modal HTML - Two Step Workflow
 */
function createCharacterConfirmationModal() {
    const modal = document.createElement('div');
    modal.id = 'character-confirm-modal';
    modal.className = 'modal character-confirm-modal-v2';
    modal.innerHTML = `
        <div class="modal-content character-confirm-content-v2">
            <!-- Header -->
            <div class="confirm-header">
                <div class="confirm-title">Character Confirmation</div>
                <button class="confirm-close" onclick="closeCharacterConfirmModal()">&times;</button>
            </div>

            <!-- Step Indicator -->
            <div class="confirm-step-indicator">
                <div class="confirm-step-item active" id="confirm-step-indicator-1">
                    <div class="confirm-step-circle">1</div>
                    <div class="confirm-step-label">Merge Duplicates</div>
                </div>
                <div class="confirm-step-connector"></div>
                <div class="confirm-step-item" id="confirm-step-indicator-2">
                    <div class="confirm-step-circle">2</div>
                    <div class="confirm-step-label">Confirm Selection</div>
                </div>
            </div>

            <!-- Step 1: Merge Duplicates -->
            <div class="confirm-step-content" id="confirm-step-1-content">
                <div class="confirm-step-description">
                    <strong>Clean up duplicate character names</strong>
                    <p>Click characters to select for merging. When 2+ are selected, merge options appear.</p>
                </div>

                <div class="confirm-character-list" id="confirm-merge-list">
                    <!-- Characters rendered here -->
                </div>

                <!-- Inline Merge Prompt -->
                <div class="confirm-merge-prompt" id="confirm-merge-prompt" style="display: none;">
                    <div class="confirm-merge-prompt-header">Merge Characters</div>
                    <div class="confirm-merge-prompt-body">
                        <div class="confirm-merge-preview">
                            <span class="confirm-merge-preview-label">Selected:</span>
                            <div class="confirm-merge-preview-names" id="confirm-merge-preview-names"></div>
                        </div>
                        <div class="confirm-merge-options" id="confirm-merge-options">
                            <!-- Radio options for names -->
                        </div>
                        <div class="confirm-merge-custom-option">
                            <label class="confirm-merge-radio-label">
                                <input type="radio" name="confirm-merge-name" id="confirm-merge-custom-radio" value="custom">
                                <span>Custom name:</span>
                            </label>
                            <input type="text" class="confirm-merge-custom-input" id="confirm-merge-custom-input" placeholder="Enter custom name..." oninput="document.getElementById('confirm-merge-custom-radio').checked = true;">
                        </div>
                    </div>
                    <div class="confirm-merge-prompt-actions">
                        <button class="modal-btn" onclick="cancelConfirmMerge()">Cancel</button>
                        <button class="modal-btn primary" onclick="executeConfirmMerge()">Merge Characters</button>
                    </div>
                </div>

                <div class="confirm-step-actions">
                    <button class="modal-btn" onclick="closeCharacterConfirmModal()">Cancel</button>
                    <button class="modal-btn primary" onclick="goToConfirmStep2()">Continue to Selection →</button>
                </div>
            </div>

            <!-- Step 2: Confirm Selection -->
            <div class="confirm-step-content" id="confirm-step-2-content" style="display: none;">
                <div class="confirm-step-description">
                    <strong>Select characters to include in breakdown</strong>
                    <p>Check the characters you want to track. Unchecked characters will not appear in your breakdown.</p>
                </div>

                <div class="confirm-selection-controls">
                    <label class="confirm-auto-select-toggle">
                        <input type="checkbox" id="confirm-auto-select-high" checked onchange="toggleConfirmAutoSelectHigh()">
                        <span>Auto-select high confidence</span>
                    </label>
                    <div class="confirm-selection-buttons">
                        <button class="modal-btn small" onclick="selectAllConfirmCharacters()">Select All</button>
                        <button class="modal-btn small" onclick="deselectAllConfirmCharacters()">Deselect All</button>
                    </div>
                </div>

                <div class="confirm-character-list" id="confirm-selection-list">
                    <!-- Characters with checkboxes rendered here -->
                </div>

                <div class="confirm-selection-stats" id="confirm-selection-stats">
                    <!-- Stats rendered here -->
                </div>

                <div class="confirm-step-actions">
                    <button class="modal-btn" onclick="goToConfirmStep1()">← Back to Merging</button>
                    <button class="modal-btn primary" onclick="confirmCharactersAndContinue()">Confirm & Process</button>
                </div>
            </div>
        </div>
    `;

    return modal;
}

/**
 * Add CSS styles for the modal
 */
function addModalStyles() {
    if (document.getElementById('character-confirm-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'character-confirm-modal-styles';
    style.textContent = `
        .character-confirm-modal-v2 {
            z-index: 10001;
        }

        .character-confirm-content-v2 {
            max-width: 650px;
            width: 95%;
            max-height: 85vh;
            padding: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background: var(--glass-bg);
            backdrop-filter: blur(30px);
            border: 1px solid var(--accent-gold);
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(212, 175, 122, 0.2);
        }

        .confirm-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid var(--glass-border);
        }

        .confirm-title {
            font-size: 1.25em;
            font-weight: 600;
            color: var(--text-light);
        }

        .confirm-close {
            background: none;
            border: none;
            color: var(--text-muted);
            font-size: 1.5em;
            cursor: pointer;
            padding: 4px 8px;
            line-height: 1;
            transition: color 0.2s;
        }

        .confirm-close:hover { color: var(--text-light); }

        /* Step Indicator */
        .confirm-step-indicator {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px 24px;
            gap: 12px;
            background: rgba(0, 0, 0, 0.2);
        }

        .confirm-step-item {
            display: flex;
            align-items: center;
            gap: 10px;
            opacity: 0.5;
            transition: opacity 0.3s;
        }

        .confirm-step-item.active { opacity: 1; }

        .confirm-step-circle {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 0.875em;
            background: rgba(255, 255, 255, 0.1);
            border: 2px solid var(--glass-border);
            color: var(--text-muted);
            transition: all 0.3s;
        }

        .confirm-step-item.active .confirm-step-circle {
            background: linear-gradient(135deg, var(--accent-gold), #c09861);
            border-color: var(--accent-gold);
            color: var(--bg-dark);
        }

        .confirm-step-label {
            font-size: 0.875em;
            font-weight: 500;
            color: var(--text-muted);
        }

        .confirm-step-item.active .confirm-step-label { color: var(--text-light); }

        .confirm-step-connector {
            width: 60px;
            height: 2px;
            background: var(--glass-border);
        }

        /* Step Content */
        .confirm-step-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            padding: 0 24px;
        }

        .confirm-step-description {
            text-align: center;
            padding: 16px 0;
        }

        .confirm-step-description strong {
            display: block;
            font-size: 1em;
            margin-bottom: 6px;
            color: var(--text-light);
        }

        .confirm-step-description p {
            font-size: 0.875em;
            color: var(--text-muted);
        }

        /* Character List */
        .confirm-character-list {
            flex: 1;
            overflow-y: auto;
            border: 1px solid var(--glass-border);
            border-radius: 10px;
            background: rgba(0, 0, 0, 0.2);
            margin-bottom: 16px;
            min-height: 150px;
            max-height: 250px;
        }

        /* Merge List Items */
        .confirm-merge-item {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid var(--glass-border);
            cursor: pointer;
            transition: all 0.2s;
            gap: 12px;
        }

        .confirm-merge-item:last-child { border-bottom: none; }
        .confirm-merge-item:hover { background: rgba(212, 175, 122, 0.08); }

        .confirm-merge-item.selected {
            background: rgba(212, 175, 122, 0.15);
            border-left: 3px solid var(--accent-gold);
        }

        .confirm-merge-item.merged {
            opacity: 0.5;
            cursor: default;
            background: rgba(0, 0, 0, 0.3);
        }

        .confirm-merge-info { flex: 1; }

        .confirm-merge-name {
            font-weight: 600;
            color: var(--text-light);
            margin-bottom: 2px;
        }

        .confirm-merge-meta {
            font-size: 0.8125em;
            color: var(--text-muted);
        }

        .confirm-merge-badge {
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.6875em;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.03em;
        }

        .confirm-select-indicator {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2px solid var(--glass-border);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }

        .confirm-select-indicator svg {
            width: 14px;
            height: 14px;
            opacity: 0;
            transition: opacity 0.2s;
        }

        .confirm-select-indicator.active {
            background: var(--accent-gold);
            border-color: var(--accent-gold);
        }

        .confirm-select-indicator.active svg {
            opacity: 1;
            color: var(--bg-dark);
        }

        .confirm-merged-badge {
            background: rgba(107, 114, 128, 0.3);
            color: #9ca3af;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.6875em;
            font-weight: 700;
            text-transform: uppercase;
        }

        .confirm-merged-section {
            border-top: 2px solid var(--glass-border);
            padding-top: 8px;
            margin-top: 8px;
        }

        .confirm-merged-section-label {
            font-size: 0.75em;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 8px 16px 4px;
        }

        /* Merge Prompt */
        .confirm-merge-prompt {
            background: rgba(212, 175, 122, 0.1);
            border: 1px solid rgba(212, 175, 122, 0.3);
            border-radius: 10px;
            margin-bottom: 16px;
            overflow: hidden;
        }

        .confirm-merge-prompt-header {
            padding: 12px 16px;
            background: rgba(212, 175, 122, 0.15);
            font-weight: 600;
            font-size: 0.9375em;
            color: var(--accent-gold);
        }

        .confirm-merge-prompt-body { padding: 16px; }

        .confirm-merge-preview {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            margin-bottom: 16px;
        }

        .confirm-merge-preview-label {
            font-size: 0.8125em;
            color: var(--text-muted);
            padding-top: 4px;
        }

        .confirm-merge-preview-names {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .confirm-merge-name-pill {
            background: rgba(212, 175, 122, 0.2);
            border: 1px solid rgba(212, 175, 122, 0.4);
            padding: 4px 10px;
            border-radius: 14px;
            font-size: 0.8125em;
            color: var(--text-light);
        }

        .confirm-merge-options {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 12px;
        }

        .confirm-merge-radio-label {
            display: flex;
            align-items: center;
            gap: 10px;
            cursor: pointer;
            padding: 8px 12px;
            border-radius: 6px;
            transition: background 0.2s;
        }

        .confirm-merge-radio-label:hover { background: rgba(255, 255, 255, 0.05); }

        .confirm-merge-radio-label input[type="radio"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
        }

        .confirm-merge-custom-option {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 6px;
        }

        .confirm-merge-custom-input {
            flex: 1;
            padding: 8px 12px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid var(--glass-border);
            border-radius: 6px;
            color: var(--text-light);
            font-size: 0.875em;
        }

        .confirm-merge-custom-input:focus {
            outline: none;
            border-color: var(--accent-gold);
        }

        .confirm-merge-prompt-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            padding: 12px 16px;
            background: rgba(0, 0, 0, 0.2);
            border-top: 1px solid var(--glass-border);
        }

        /* Selection Controls */
        .confirm-selection-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid var(--glass-border);
            margin-bottom: 12px;
        }

        .confirm-auto-select-toggle {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.875em;
            color: var(--text-muted);
            cursor: pointer;
        }

        .confirm-auto-select-toggle input {
            width: 16px;
            height: 16px;
            cursor: pointer;
        }

        .confirm-selection-buttons {
            display: flex;
            gap: 8px;
        }

        /* Selection List Items */
        .confirm-selection-item {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid var(--glass-border);
            gap: 12px;
        }

        .confirm-selection-item:last-child { border-bottom: none; }

        .confirm-selection-item input[type="checkbox"] {
            width: 20px;
            height: 20px;
            cursor: pointer;
        }

        .confirm-selection-info { flex: 1; }

        .confirm-selection-name {
            font-weight: 600;
            color: var(--text-light);
            margin-bottom: 2px;
        }

        .confirm-selection-meta {
            font-size: 0.8125em;
            color: var(--text-muted);
        }

        /* Selection Stats */
        .confirm-selection-stats {
            display: flex;
            justify-content: center;
            gap: 24px;
            padding: 12px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            margin-bottom: 16px;
        }

        .confirm-stat-item { text-align: center; }

        .confirm-stat-value {
            font-size: 1.25em;
            font-weight: 700;
            color: var(--accent-gold);
        }

        .confirm-stat-label {
            font-size: 0.75em;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        /* Step Actions */
        .confirm-step-actions {
            display: flex;
            justify-content: space-between;
            padding: 16px 0 20px;
            border-top: 1px solid var(--glass-border);
            margin-top: auto;
        }

        /* Empty State */
        .confirm-empty-list {
            padding: 40px 20px;
            text-align: center;
        }

        .confirm-empty-icon {
            font-size: 2.5em;
            margin-bottom: 12px;
            opacity: 0.5;
        }

        .confirm-empty-text {
            font-size: 1em;
            font-weight: 600;
            color: var(--text-light);
            margin-bottom: 8px;
        }

        .confirm-empty-hint {
            font-size: 0.875em;
            color: var(--text-muted);
        }
    `;
    document.head.appendChild(style);
}

// ============================================================================
// STEP NAVIGATION
// ============================================================================

function showStep1() {
    const step1 = document.getElementById('confirm-step-1-content');
    const step2 = document.getElementById('confirm-step-2-content');
    if (step1) step1.style.display = 'flex';
    if (step2) step2.style.display = 'none';
    hideMergePrompt();
}

function showStep2() {
    const step1 = document.getElementById('confirm-step-1-content');
    const step2 = document.getElementById('confirm-step-2-content');
    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'flex';
}

window.goToConfirmStep1 = function() {
    currentStep = 1;
    updateStepIndicators();
    showStep1();
    renderMergeList();
};

window.goToConfirmStep2 = function() {
    currentStep = 2;
    updateStepIndicators();
    showStep2();
    renderSelectionList();
};

// ============================================================================
// STEP 1: MERGE DUPLICATES
// ============================================================================

/**
 * Render the merge list (Step 1)
 */
function renderMergeList() {
    const container = document.getElementById('confirm-merge-list');
    if (!container) return;

    const characters = state.detectedCharacters || [];

    if (characters.length === 0) {
        container.innerHTML = `
            <div class="confirm-empty-list">
                <div class="confirm-empty-icon">👥</div>
                <div class="confirm-empty-text">No characters detected</div>
                <p class="confirm-empty-hint">Import a script and run analysis first.</p>
            </div>
        `;
        return;
    }

    // Separate active and merged characters
    const activeCharacters = characters.filter(c => !c.merged);
    const mergedCharacters = characters.filter(c => c.merged);

    let html = activeCharacters.map((char, idx) => {
        const originalIndex = characters.indexOf(char);
        const isSelected = selectedForMerge.has(originalIndex);
        const conf = getConfidenceDisplay(char.sceneCount || 0);

        return `
            <div class="confirm-merge-item ${isSelected ? 'selected' : ''}"
                 data-index="${originalIndex}"
                 onclick="toggleForConfirmMerge(${originalIndex})">
                <div class="confirm-merge-info">
                    <div class="confirm-merge-name">${char.name}</div>
                    <div class="confirm-merge-meta">
                        ${char.sceneCount || 0} scene${(char.sceneCount || 0) !== 1 ? 's' : ''}
                    </div>
                </div>
                <div class="confirm-merge-badge" style="background: ${conf.bgColor}; color: ${conf.color};">
                    ${conf.label}
                </div>
                <div class="confirm-select-indicator ${isSelected ? 'active' : ''}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
            </div>
        `;
    }).join('');

    // Add merged characters section if any
    if (mergedCharacters.length > 0) {
        html += `
            <div class="confirm-merged-section">
                <div class="confirm-merged-section-label">Merged Characters</div>
                ${mergedCharacters.map(char => `
                    <div class="confirm-merge-item merged">
                        <div class="confirm-merge-info">
                            <div class="confirm-merge-name">${char.name}</div>
                            <div class="confirm-merge-meta">merged into ${char.mergedInto || 'another character'}</div>
                        </div>
                        <div class="confirm-merged-badge">MERGED</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    container.innerHTML = html;
}

/**
 * Toggle character selection for merging
 */
window.toggleForConfirmMerge = function(index) {
    const characters = state.detectedCharacters || [];
    const char = characters[index];
    if (!char || char.merged) return;

    if (selectedForMerge.has(index)) {
        selectedForMerge.delete(index);
    } else {
        selectedForMerge.add(index);
    }

    renderMergeList();

    // Show/hide merge prompt based on selection
    if (selectedForMerge.size >= 2) {
        showMergePrompt();
    } else {
        hideMergePrompt();
    }
};

/**
 * Show the merge prompt with selected character options
 */
function showMergePrompt() {
    const prompt = document.getElementById('confirm-merge-prompt');
    const previewNames = document.getElementById('confirm-merge-preview-names');
    const optionsContainer = document.getElementById('confirm-merge-options');

    if (!prompt || !previewNames || !optionsContainer) return;

    const characters = state.detectedCharacters || [];
    const selected = Array.from(selectedForMerge).map(idx => characters[idx]).filter(Boolean);

    // Render preview pills
    previewNames.innerHTML = selected.map(c => `
        <span class="confirm-merge-name-pill">${c.name}</span>
    `).join('');

    // Render radio options for each name
    optionsContainer.innerHTML = selected.map((c, i) => `
        <label class="confirm-merge-radio-label">
            <input type="radio" name="confirm-merge-name" value="${c.name}" ${i === 0 ? 'checked' : ''}>
            <span>${c.name}</span>
        </label>
    `).join('');

    // Clear custom input
    const customInput = document.getElementById('confirm-merge-custom-input');
    if (customInput) customInput.value = '';

    prompt.style.display = 'block';
}

/**
 * Hide the merge prompt
 */
function hideMergePrompt() {
    const prompt = document.getElementById('confirm-merge-prompt');
    if (prompt) prompt.style.display = 'none';
}

/**
 * Cancel merge operation
 */
window.cancelConfirmMerge = function() {
    selectedForMerge.clear();
    hideMergePrompt();
    renderMergeList();
};

/**
 * Execute the merge
 */
window.executeConfirmMerge = function() {
    const characters = state.detectedCharacters || [];
    const indices = Array.from(selectedForMerge);
    const selected = indices.map(idx => characters[idx]).filter(Boolean);

    if (selected.length < 2) {
        alert('Please select at least 2 characters to merge');
        return;
    }

    // Get the selected name (radio button or custom)
    const customRadio = document.getElementById('confirm-merge-custom-radio');
    const customInput = document.getElementById('confirm-merge-custom-input');
    let primaryName;

    if (customRadio && customRadio.checked && customInput && customInput.value.trim()) {
        primaryName = customInput.value.trim();
    } else {
        const selectedRadio = document.querySelector('input[name="confirm-merge-name"]:checked');
        primaryName = selectedRadio ? selectedRadio.value : selected[0].name;
    }

    console.log(`Merging ${selected.length} characters into "${primaryName}"`);

    // Find or create the primary character
    let primaryChar = characters.find(c => c.name === primaryName);

    if (!primaryChar) {
        // Create new character with merged data
        primaryChar = {
            name: primaryName,
            category: selected[0].category || 'SUPPORTING',
            sceneCount: 0,
            firstAppearance: Infinity,
            lastAppearance: 0,
            hasDialogue: false,
            selected: true,
            merged: false,
            mergedFrom: [],
            scenesPresent: []
        };
        state.detectedCharacters.push(primaryChar);
    }

    // Merge data from selected characters
    const mergedFromNames = [];
    selected.forEach(char => {
        if (char.name !== primaryName) {
            mergedFromNames.push(char.name);

            // Mark as merged
            char.merged = true;
            char.mergedInto = primaryName;
            char.selected = false;
        }

        // Combine scene counts and appearances
        primaryChar.sceneCount = (primaryChar.sceneCount || 0) + (char.sceneCount || 0);
        primaryChar.firstAppearance = Math.min(primaryChar.firstAppearance || Infinity, char.firstAppearance || Infinity);
        primaryChar.lastAppearance = Math.max(primaryChar.lastAppearance || 0, char.lastAppearance || 0);
        primaryChar.hasDialogue = primaryChar.hasDialogue || char.hasDialogue;

        // Combine scenes present
        if (char.scenesPresent) {
            primaryChar.scenesPresent = [...new Set([...(primaryChar.scenesPresent || []), ...char.scenesPresent])];
        }
    });

    primaryChar.mergedFrom = [...(primaryChar.mergedFrom || []), ...mergedFromNames];
    primaryChar.selected = true;
    primaryChar.merged = false;

    console.log(`  Combined ${primaryChar.sceneCount} scenes`);
    console.log(`  Merged from: ${mergedFromNames.join(', ')}`);

    // Reset selection and re-render
    selectedForMerge.clear();
    hideMergePrompt();
    renderMergeList();

    showToast(`Merged ${selected.length} characters into "${primaryName}"`, 'success');
};

// ============================================================================
// STEP 2: CONFIRM SELECTION
// ============================================================================

/**
 * Render the selection list (Step 2)
 */
function renderSelectionList() {
    const container = document.getElementById('confirm-selection-list');
    if (!container) return;

    const characters = (state.detectedCharacters || []).filter(c => !c.merged);
    const autoSelectHigh = document.getElementById('confirm-auto-select-high')?.checked ?? true;

    if (characters.length === 0) {
        container.innerHTML = `
            <div class="confirm-empty-list">
                <div class="confirm-empty-icon">👥</div>
                <div class="confirm-empty-text">No characters to select</div>
                <p class="confirm-empty-hint">Go back and detect characters first.</p>
            </div>
        `;
        updateConfirmSelectionStats();
        return;
    }

    container.innerHTML = characters.map((char, index) => {
        const originalIndex = state.detectedCharacters.indexOf(char);
        const conf = getConfidenceDisplay(char.sceneCount || 0);

        // Determine if should be checked
        let isChecked;
        if (char.selected !== undefined) {
            isChecked = char.selected;
        } else {
            isChecked = autoSelectHigh ? (char.sceneCount || 0) >= 3 : true;
        }

        return `
            <div class="confirm-selection-item">
                <input type="checkbox"
                       id="confirm-char-select-${originalIndex}"
                       data-index="${originalIndex}"
                       ${isChecked ? 'checked' : ''}
                       onchange="toggleConfirmCharacterSelection(${originalIndex})">
                <div class="confirm-selection-info">
                    <label for="confirm-char-select-${originalIndex}" class="confirm-selection-name">${char.name}</label>
                    <div class="confirm-selection-meta">
                        ${char.sceneCount || 0} scene${(char.sceneCount || 0) !== 1 ? 's' : ''}
                        ${char.mergedFrom?.length ? ` · Includes: ${char.mergedFrom.join(', ')}` : ''}
                    </div>
                </div>
                <div class="confirm-merge-badge" style="background: ${conf.bgColor}; color: ${conf.color};">
                    ${conf.label}
                </div>
            </div>
        `;
    }).join('');

    updateConfirmSelectionStats();
}

/**
 * Toggle character selection
 */
window.toggleConfirmCharacterSelection = function(index) {
    if (state.detectedCharacters && state.detectedCharacters[index]) {
        state.detectedCharacters[index].selected = !state.detectedCharacters[index].selected;
        updateConfirmSelectionStats();
    }
};

/**
 * Update selection stats
 */
function updateConfirmSelectionStats() {
    const statsContainer = document.getElementById('confirm-selection-stats');
    if (!statsContainer) return;

    const characters = (state.detectedCharacters || []).filter(c => !c.merged);
    const total = characters.length;
    const selected = characters.filter(c => c.selected !== false).length;

    statsContainer.innerHTML = `
        <div class="confirm-stat-item">
            <div class="confirm-stat-value">${total}</div>
            <div class="confirm-stat-label">Total</div>
        </div>
        <div class="confirm-stat-item">
            <div class="confirm-stat-value">${selected}</div>
            <div class="confirm-stat-label">Selected</div>
        </div>
    `;
}

/**
 * Toggle auto-select high confidence
 */
window.toggleConfirmAutoSelectHigh = function() {
    const autoSelectHigh = document.getElementById('confirm-auto-select-high')?.checked ?? true;
    const characters = (state.detectedCharacters || []).filter(c => !c.merged);

    characters.forEach(char => {
        if (autoSelectHigh) {
            char.selected = (char.sceneCount || 0) >= 3;
        }
    });

    renderSelectionList();
};

/**
 * Select all characters
 */
window.selectAllConfirmCharacters = function() {
    (state.detectedCharacters || []).forEach(char => {
        if (!char.merged) char.selected = true;
    });
    renderSelectionList();
};

/**
 * Deselect all characters
 */
window.deselectAllConfirmCharacters = function() {
    (state.detectedCharacters || []).forEach(char => {
        if (!char.merged) char.selected = false;
    });
    renderSelectionList();
};

// ============================================================================
// CLOSE MODAL
// ============================================================================

/**
 * Close the character confirmation modal
 */
export function closeCharacterConfirmModal() {
    const modal = document.getElementById('character-confirm-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

window.closeCharacterConfirmModal = closeCharacterConfirmModal;

// ============================================================================
// CONFIRM AND CONTINUE (PRESERVED FROM ORIGINAL)
// ============================================================================

/**
 * Build a mapping of old/merged character names to their canonical names
 */
function buildCharacterMergeMapping(selectedCharacters) {
    const mapping = new Map();

    selectedCharacters.forEach(char => {
        mapping.set(char.name, char.name);

        if (char.mergedFrom && Array.isArray(char.mergedFrom)) {
            char.mergedFrom.forEach(oldName => {
                mapping.set(oldName, char.name);
            });
        }
    });

    return mapping;
}

/**
 * Clean up ALL scene character data to only contain selected/canonical names
 */
function cleanupAllSceneCharacterData(selectedNames, mergeMapping) {
    console.log('Cleaning up all scene character data...');

    let scenesUpdated = 0;
    let charactersRemoved = 0;
    let charactersMerged = 0;

    const cleanCharacterArray = (arr) => {
        if (!arr || !Array.isArray(arr)) return arr;

        const cleanedSet = new Set();

        arr.forEach(charName => {
            const canonicalName = mergeMapping.get(charName);

            if (canonicalName && selectedNames.has(canonicalName)) {
                cleanedSet.add(canonicalName);
                if (charName !== canonicalName) {
                    charactersMerged++;
                }
            } else if (selectedNames.has(charName)) {
                cleanedSet.add(charName);
            } else {
                charactersRemoved++;
            }
        });

        return Array.from(cleanedSet);
    };

    // Clean up scenes
    if (state.scenes && Array.isArray(state.scenes)) {
        state.scenes.forEach((scene, idx) => {
            let updated = false;

            if (scene.castMembers) {
                const cleaned = cleanCharacterArray(scene.castMembers);
                if (JSON.stringify(cleaned) !== JSON.stringify(scene.castMembers)) {
                    scene.castMembers = cleaned;
                    updated = true;
                }
            }

            if (scene.characters_present) {
                const cleaned = cleanCharacterArray(scene.characters_present);
                if (JSON.stringify(cleaned) !== JSON.stringify(scene.characters_present)) {
                    scene.characters_present = cleaned;
                    updated = true;
                }
            }

            if (updated) scenesUpdated++;
        });
    }

    // Clean up scene breakdowns
    if (state.sceneBreakdowns) {
        Object.keys(state.sceneBreakdowns).forEach(sceneIdx => {
            const breakdown = state.sceneBreakdowns[sceneIdx];
            if (breakdown && breakdown.cast) {
                breakdown.cast = cleanCharacterArray(breakdown.cast);
            }
        });
    }

    // Clean up script tags
    if (state.scriptTags) {
        Object.keys(state.scriptTags).forEach(sceneIdx => {
            const tags = state.scriptTags[sceneIdx];
            if (Array.isArray(tags)) {
                state.scriptTags[sceneIdx] = tags.filter(tag => {
                    if (tag.category === 'cast' && tag.character) {
                        const canonicalName = mergeMapping.get(tag.character);
                        if (canonicalName && selectedNames.has(canonicalName)) {
                            tag.character = canonicalName;
                            return true;
                        }
                        return selectedNames.has(tag.character);
                    }
                    return true;
                });
            }
        });
    }

    console.log(`Cleanup complete: ${scenesUpdated} scenes updated, ${charactersMerged} character references merged, ${charactersRemoved} removed`);
}

/**
 * Confirm characters and continue with breakdown
 * THIS IS THE MAIN OUTPUT FUNCTION - Interface preserved from original
 */
window.confirmCharactersAndContinue = async function() {
    console.log('confirmCharactersAndContinue called');

    try {
        // Get selected characters (not merged and selected)
        const selectedCharacters = (state.detectedCharacters || []).filter(c => c.selected && !c.merged);
        console.log('Selected characters:', selectedCharacters.length);

        if (selectedCharacters.length === 0) {
            alert('Please select at least one character to track');
            return;
        }

        // Build character name mapping and clean up ALL scene data
        const selectedNames = new Set(selectedCharacters.map(c => c.name));
        const mergeMapping = buildCharacterMergeMapping(selectedCharacters);
        console.log('Character merge mapping:', mergeMapping);

        // Clean up all scene data to use only selected/canonical names
        cleanupAllSceneCharacterData(selectedNames, mergeMapping);

        // Update confirmed characters in state
        state.confirmedCharacters = new Set(selectedCharacters.map(c => c.name));
        console.log('Confirmed characters set:', state.confirmedCharacters);

        // Update master context with confirmed characters
        if (window.masterContext?.characters) {
            const confirmedCharsObj = {};
            selectedCharacters.forEach(char => {
                if (window.masterContext.characters[char.name]) {
                    confirmedCharsObj[char.name] = {
                        ...window.masterContext.characters[char.name],
                        category: char.category,
                        characterAnalysis: {
                            ...window.masterContext.characters[char.name]?.characterAnalysis,
                            role: char.category?.toLowerCase() || 'supporting'
                        },
                        scenesPresent: char.scenesPresent || window.masterContext.characters[char.name]?.scenesPresent || []
                    };
                } else {
                    // Manually added or merged character
                    confirmedCharsObj[char.name] = {
                        category: char.category || 'SUPPORTING',
                        characterAnalysis: { role: (char.category || 'SUPPORTING').toLowerCase() },
                        storyPresence: {
                            totalScenes: char.sceneCount || 0,
                            scenesPresent: char.scenesPresent || []
                        },
                        firstAppearance: char.firstAppearance || 1,
                        lastAppearance: char.lastAppearance || state.scenes?.length || 1,
                        sceneCount: char.sceneCount || 0,
                        scenesPresent: char.scenesPresent || [],
                        mergedFrom: char.mergedFrom || []
                    };
                }

                // Handle mergedFrom - add data from merged characters
                if (char.mergedFrom && Array.isArray(char.mergedFrom)) {
                    char.mergedFrom.forEach(oldName => {
                        if (window.masterContext.characters[oldName]) {
                            const oldCharData = window.masterContext.characters[oldName];
                            const newScenes = oldCharData.scenesPresent || oldCharData.storyPresence?.scenesPresent || [];
                            confirmedCharsObj[char.name].scenesPresent = [
                                ...new Set([
                                    ...(confirmedCharsObj[char.name].scenesPresent || []),
                                    ...newScenes
                                ])
                            ];
                        }
                    });
                }
            });
            window.masterContext.confirmedCharacters = confirmedCharsObj;
        }

        // Initialize character tabs
        state.characterTabs = selectedCharacters.map(c => c.name);

        // Initialize cast profiles
        if (!state.castProfiles) {
            state.castProfiles = {};
        }
        selectedCharacters.forEach(char => {
            if (!state.castProfiles[char.name]) {
                state.castProfiles[char.name] = {
                    baseDescription: '',
                    physicalDescription: char.physicalDescription || '',
                    scenes: char.scenesPresent || [],
                    lookStates: [],
                    category: char.category || 'SUPPORTING'
                };
            }
        });

        // Render UI
        renderCharacterTabs();
        renderCharacterTabPanels();

        // Update script and scene list
        renderScript();
        renderSceneList();

        // Save project
        saveProject();

        // Close modal
        closeCharacterConfirmModal();

        console.log(`Character confirmation complete: ${selectedCharacters.length} characters confirmed`);
        showToast(`${selectedCharacters.length} character${selectedCharacters.length !== 1 ? 's' : ''} confirmed! Ready for breakdown.`, 'success');

    } catch (error) {
        console.error('Error in confirmCharactersAndContinue:', error);
        alert('Error confirming characters: ' + error.message);
    }
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    showCharacterConfirmationModal,
    closeCharacterConfirmModal
};

export { normalizeCharacterName };
