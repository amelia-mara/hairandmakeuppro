/**
 * export-character-review.js
 * Character review modal functionality - Two Step Workflow
 *
 * Step 1: Merge Duplicates - Click to select characters for merging
 * Step 2: Confirm Selection - Check characters to include in breakdown
 *
 * IMPORTANT: This file only handles UI rendering and interaction.
 * The data flow (extraction → confirmation → profile creation) is PRESERVED.
 */

import { state } from '../main.js';
import { renderCharacterTabs, renderCharacterTabPanels } from '../character-panel.js';
import { extractCharactersFromScenes, normalizeCharacterName, initializeCharacterTabs } from './export-deep-analysis.js';
import { saveProject } from './export-project.js';

// ============================================================================
// MODULE STATE
// ============================================================================

// Current step (1 = merge, 2 = selection)
let currentStep = 1;

// Characters selected for merging (indices into window.detectedCharacterData)
let selectedForMerge = new Set();

// ============================================================================
// CHARACTER EXTRACTION (PRESERVED FROM ORIGINAL)
// ============================================================================

/**
 * Extract characters from scene breakdowns (fallback if screenplay parsing fails)
 * @returns {Array} Array of character objects
 */
function extractCharactersFromBreakdowns() {
    console.log('Extracting characters from scene breakdowns...');

    const characterMap = new Map();

    Object.keys(state.sceneBreakdowns).forEach(sceneIndex => {
        const breakdown = state.sceneBreakdowns[sceneIndex];

        if (breakdown && breakdown.cast && Array.isArray(breakdown.cast)) {
            breakdown.cast.forEach(characterName => {
                const cleaned = characterName.trim();
                if (!cleaned) return;

                const normalized = normalizeCharacterName(cleaned);

                if (!characterMap.has(normalized)) {
                    characterMap.set(normalized, {
                        primaryName: normalized,
                        aliases: [cleaned, normalized],
                        firstScene: parseInt(sceneIndex),
                        sceneAppearances: [parseInt(sceneIndex)],
                        dialogueCount: 1,
                        isConfirmed: false
                    });
                } else {
                    const char = characterMap.get(normalized);
                    char.dialogueCount++;
                    if (!char.sceneAppearances.includes(parseInt(sceneIndex))) {
                        char.sceneAppearances.push(parseInt(sceneIndex));
                    }
                    if (!char.aliases.includes(cleaned)) {
                        char.aliases.push(cleaned);
                    }
                }
            });
        }
    });

    // Also check script tags for cast category
    if (state.scriptTags) {
        Object.keys(state.scriptTags).forEach(sceneIndex => {
            const tags = state.scriptTags[sceneIndex];
            if (Array.isArray(tags)) {
                tags.forEach(tag => {
                    if (tag.category === 'cast' && tag.character) {
                        const cleaned = tag.character.trim();
                        if (!cleaned) return;

                        const normalized = normalizeCharacterName(cleaned);

                        if (!characterMap.has(normalized)) {
                            characterMap.set(normalized, {
                                primaryName: normalized,
                                aliases: [cleaned, normalized],
                                firstScene: parseInt(sceneIndex),
                                sceneAppearances: [parseInt(sceneIndex)],
                                dialogueCount: 1,
                                isConfirmed: false
                            });
                        } else {
                            const char = characterMap.get(normalized);
                            char.dialogueCount++;
                            if (!char.sceneAppearances.includes(parseInt(sceneIndex))) {
                                char.sceneAppearances.push(parseInt(sceneIndex));
                            }
                            if (!char.aliases.includes(cleaned)) {
                                char.aliases.push(cleaned);
                            }
                        }
                    }
                });
            }
        });
    }

    const characters = Array.from(characterMap.values())
        .sort((a, b) => b.dialogueCount - a.dialogueCount);

    console.log(`Found ${characters.length} characters from breakdowns`);

    return characters;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get confidence display info based on dialogue count
 */
function getConfidenceDisplay(dialogueCount) {
    if (dialogueCount >= 5) {
        return { label: 'High', bgColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981' };
    } else if (dialogueCount >= 3) {
        return { label: 'Medium', bgColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' };
    }
    return { label: 'Low', bgColor: 'rgba(107, 114, 128, 0.2)', color: '#6b7280' };
}

/**
 * Update step indicator UI
 */
function updateStepIndicators() {
    const step1 = document.getElementById('step-indicator-1');
    const step2 = document.getElementById('step-indicator-2');

    if (step1 && step2) {
        step1.classList.toggle('active', currentStep === 1);
        step2.classList.toggle('active', currentStep === 2);
    }
}

// ============================================================================
// STEP 1: MERGE DUPLICATES
// ============================================================================

/**
 * Render the merge list (Step 1)
 */
function renderMergeList() {
    const container = document.getElementById('character-merge-list');
    if (!container) return;

    const characters = window.detectedCharacterData || [];

    if (characters.length === 0) {
        container.innerHTML = `
            <div class="empty-character-list">
                <div class="empty-icon">👥</div>
                <div class="empty-text">No characters detected</div>
                <p class="empty-hint">Import a script and run character detection first.</p>
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
        const conf = getConfidenceDisplay(char.dialogueCount);

        return `
            <div class="character-merge-item ${isSelected ? 'selected' : ''}"
                 data-index="${originalIndex}"
                 onclick="toggleForMerge(${originalIndex})">
                <div class="character-merge-info">
                    <div class="character-merge-name">${char.primaryName}</div>
                    <div class="character-merge-meta">
                        ${char.dialogueCount} dialogue${char.dialogueCount !== 1 ? 's' : ''} ·
                        ${char.sceneAppearances?.length || 0} scene${(char.sceneAppearances?.length || 0) !== 1 ? 's' : ''}
                    </div>
                </div>
                <div class="character-merge-badge" style="background: ${conf.bgColor}; color: ${conf.color};">
                    ${conf.label}
                </div>
                <div class="character-select-indicator ${isSelected ? 'active' : ''}">
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
            <div class="merged-characters-section">
                <div class="merged-section-label">Merged Characters</div>
                ${mergedCharacters.map(char => `
                    <div class="character-merge-item merged">
                        <div class="character-merge-info">
                            <div class="character-merge-name">${char.primaryName}</div>
                            <div class="character-merge-meta">merged into ${char.mergedInto || 'another character'}</div>
                        </div>
                        <div class="merged-badge">MERGED</div>
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
window.toggleForMerge = function(index) {
    const characters = window.detectedCharacterData || [];
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
    const prompt = document.getElementById('merge-prompt');
    const previewNames = document.getElementById('merge-preview-names');
    const optionsContainer = document.getElementById('merge-options');

    if (!prompt || !previewNames || !optionsContainer) return;

    const characters = window.detectedCharacterData || [];
    const selected = Array.from(selectedForMerge).map(idx => characters[idx]).filter(Boolean);

    // Render preview pills
    previewNames.innerHTML = selected.map(c => `
        <span class="merge-name-pill">${c.primaryName}</span>
    `).join('');

    // Render radio options for each name
    optionsContainer.innerHTML = selected.map((c, i) => `
        <label class="merge-radio-label">
            <input type="radio" name="merge-name" value="${c.primaryName}" ${i === 0 ? 'checked' : ''}>
            <span>${c.primaryName}</span>
        </label>
    `).join('');

    // Clear custom input
    const customInput = document.getElementById('merge-custom-input');
    if (customInput) customInput.value = '';

    prompt.style.display = 'block';
}

/**
 * Hide the merge prompt
 */
function hideMergePrompt() {
    const prompt = document.getElementById('merge-prompt');
    if (prompt) prompt.style.display = 'none';
}

/**
 * Cancel merge operation
 */
window.cancelMerge = function() {
    selectedForMerge.clear();
    hideMergePrompt();
    renderMergeList();
};

/**
 * Confirm and execute the merge
 */
window.confirmMerge = function() {
    const characters = window.detectedCharacterData || [];
    const indices = Array.from(selectedForMerge);
    const selected = indices.map(idx => characters[idx]).filter(Boolean);

    if (selected.length < 2) {
        alert('Please select at least 2 characters to merge');
        return;
    }

    // Get the selected name (radio button or custom)
    const customRadio = document.getElementById('merge-custom-radio');
    const customInput = document.getElementById('merge-custom-input');
    let primaryName;

    if (customRadio && customRadio.checked && customInput && customInput.value.trim()) {
        primaryName = customInput.value.trim();
    } else {
        const selectedRadio = document.querySelector('input[name="merge-name"]:checked');
        primaryName = selectedRadio ? selectedRadio.value : selected[0].primaryName;
    }

    console.log(`Merging ${selected.length} characters into "${primaryName}"`);

    // Create merged character
    const merged = {
        primaryName: primaryName,
        aliases: [...new Set(selected.flatMap(c => c.aliases || [c.primaryName]))],
        firstScene: Math.min(...selected.map(c => c.firstScene || 0)),
        sceneAppearances: [...new Set(selected.flatMap(c => c.sceneAppearances || []))].sort((a, b) => a - b),
        dialogueCount: selected.reduce((sum, c) => sum + (c.dialogueCount || 0), 0),
        isConfirmed: false
    };

    console.log(`  Combined ${merged.dialogueCount} dialogue lines`);
    console.log(`  Appears in ${merged.sceneAppearances.length} scenes`);

    // Mark merged characters
    indices.forEach(idx => {
        if (characters[idx] && characters[idx].primaryName !== primaryName) {
            characters[idx].merged = true;
            characters[idx].mergedInto = primaryName;
        }
    });

    // Remove old entries and add merged one
    window.detectedCharacterData = characters.filter((c, i) => !indices.includes(i) || c.primaryName === primaryName);

    // If primary name was from custom or not in original selection, add merged
    const existingPrimary = window.detectedCharacterData.find(c => c.primaryName === primaryName);
    if (!existingPrimary) {
        window.detectedCharacterData.push(merged);
    } else {
        // Update the existing one with merged data
        Object.assign(existingPrimary, merged);
    }

    // Re-sort by dialogue count
    window.detectedCharacterData.sort((a, b) => b.dialogueCount - a.dialogueCount);

    // Reset selection and re-render
    selectedForMerge.clear();
    hideMergePrompt();
    renderMergeList();
};

// ============================================================================
// STEP 2: CONFIRM SELECTION
// ============================================================================

/**
 * Render the selection list (Step 2)
 */
function renderSelectionList() {
    const container = document.getElementById('character-selection-list');
    if (!container) return;

    const characters = (window.detectedCharacterData || []).filter(c => !c.merged);
    const autoSelectHigh = document.getElementById('auto-select-high')?.checked ?? true;

    if (characters.length === 0) {
        container.innerHTML = `
            <div class="empty-character-list">
                <div class="empty-icon">👥</div>
                <div class="empty-text">No characters to select</div>
                <p class="empty-hint">Go back and detect characters first.</p>
            </div>
        `;
        updateSelectionStats();
        return;
    }

    container.innerHTML = characters.map((char, index) => {
        const conf = getConfidenceDisplay(char.dialogueCount);
        const isChecked = autoSelectHigh ? char.dialogueCount >= 3 : false;

        // Check if previously selected (stored in character object)
        const checked = char.selected !== undefined ? char.selected : isChecked;

        return `
            <div class="character-selection-item">
                <input type="checkbox"
                       id="char-select-${index}"
                       data-character="${char.primaryName}"
                       data-index="${index}"
                       ${checked ? 'checked' : ''}
                       onchange="updateSelectionStats()">
                <div class="character-selection-info">
                    <label for="char-select-${index}" class="character-selection-name">${char.primaryName}</label>
                    <div class="character-selection-meta">
                        ${char.dialogueCount} dialogue${char.dialogueCount !== 1 ? 's' : ''} ·
                        ${char.sceneAppearances?.length || 0} scene${(char.sceneAppearances?.length || 0) !== 1 ? 's' : ''}
                    </div>
                </div>
                <div class="character-merge-badge" style="background: ${conf.bgColor}; color: ${conf.color};">
                    ${conf.label}
                </div>
            </div>
        `;
    }).join('');

    updateSelectionStats();
}

/**
 * Update selection statistics display
 */
window.updateSelectionStats = function() {
    const statsContainer = document.getElementById('selection-stats');
    if (!statsContainer) return;

    const checkboxes = document.querySelectorAll('#character-selection-list input[type="checkbox"]');
    const total = checkboxes.length;
    const selected = Array.from(checkboxes).filter(cb => cb.checked).length;

    statsContainer.innerHTML = `
        <div class="stat-item">
            <div class="stat-value">${total}</div>
            <div class="stat-label">Total</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${selected}</div>
            <div class="stat-label">Selected</div>
        </div>
    `;
};

/**
 * Toggle auto-select high confidence characters
 */
window.toggleAutoSelectHigh = function() {
    const autoSelectHigh = document.getElementById('auto-select-high')?.checked ?? true;
    const checkboxes = document.querySelectorAll('#character-selection-list input[type="checkbox"]');
    const characters = (window.detectedCharacterData || []).filter(c => !c.merged);

    checkboxes.forEach((cb, index) => {
        if (characters[index]) {
            cb.checked = autoSelectHigh ? characters[index].dialogueCount >= 3 : cb.checked;
        }
    });

    updateSelectionStats();
};

// ============================================================================
// NAVIGATION
// ============================================================================

/**
 * Navigate to Step 1 (Merge)
 */
window.goToStep1 = function() {
    currentStep = 1;
    updateStepIndicators();

    document.getElementById('step-1-content').style.display = 'flex';
    document.getElementById('step-2-content').style.display = 'none';

    renderMergeList();
};

/**
 * Navigate to Step 2 (Selection)
 */
window.goToStep2 = function() {
    currentStep = 2;
    updateStepIndicators();

    document.getElementById('step-1-content').style.display = 'none';
    document.getElementById('step-2-content').style.display = 'flex';

    renderSelectionList();
};

// ============================================================================
// MAIN ENTRY POINT (PRESERVED INTERFACE)
// ============================================================================

/**
 * Open character review modal to review and edit detected characters
 * THIS IS THE MAIN ENTRY POINT - Interface is preserved from original
 */
export function reviewCharacters() {
    if (!state.scenes || state.scenes.length === 0) {
        alert('Please import a script first');
        return;
    }

    console.log('Detect & Review Characters - Starting intelligent character detection...');

    // Run character detection (PRESERVED FROM ORIGINAL)
    let detectedChars = extractCharactersFromScenes();

    console.log(`Screenplay parsing found ${detectedChars.length} characters`);

    // FALLBACK: If no characters detected from screenplay parsing, extract from auto-tag results
    if (detectedChars.length === 0 && state.sceneBreakdowns) {
        console.log('No characters found via screenplay parsing - extracting from scene breakdowns...');
        detectedChars = extractCharactersFromBreakdowns();
        console.log(`Extracted ${detectedChars.length} characters from scene breakdowns`);
    }

    // Store detected characters in state (PRESERVED)
    state.detectedCharacters = detectedChars.map(c => c.primaryName);

    // Store full character data globally for merge functionality (PRESERVED)
    window.detectedCharacterData = detectedChars;

    console.log(`Final character count: ${detectedChars.length} unique characters`);

    // Get modal elements
    const modal = document.getElementById('character-review-modal');
    if (!modal) {
        console.error('Character review modal not found');
        return;
    }

    // Reset state for new session
    currentStep = 1;
    selectedForMerge.clear();

    // Update step indicators
    updateStepIndicators();

    // Show step 1, hide step 2
    const step1 = document.getElementById('step-1-content');
    const step2 = document.getElementById('step-2-content');
    if (step1) step1.style.display = 'flex';
    if (step2) step2.style.display = 'none';

    // Hide merge prompt initially
    hideMergePrompt();

    // Render merge list
    renderMergeList();

    // Show modal
    modal.style.display = 'flex';
    console.log('Character review modal opened with two-step workflow');
}

/**
 * Close character review modal
 */
export function closeCharacterReviewModal() {
    const modal = document.getElementById('character-review-modal');
    if (modal) modal.style.display = 'none';
}

/**
 * Select all characters in review modal (Step 2)
 */
export function selectAllCharacters() {
    const checkboxes = document.querySelectorAll('#character-selection-list input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
    updateSelectionStats();
}

/**
 * Deselect all characters in review modal (Step 2)
 */
export function deselectAllCharacters() {
    const checkboxes = document.querySelectorAll('#character-selection-list input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    updateSelectionStats();
}

/**
 * Confirm character selection and update character tabs
 * THIS IS THE MAIN OUTPUT - Interface is preserved from original
 */
export function confirmCharacterSelection() {
    const checkboxes = document.querySelectorAll('#character-selection-list input[type="checkbox"]');
    const selectedCharacters = new Set();

    checkboxes.forEach(cb => {
        if (cb.checked) {
            const charName = cb.getAttribute('data-character');
            selectedCharacters.add(charName);
        }
    });

    if (selectedCharacters.size === 0) {
        alert('Please select at least one character');
        return;
    }

    console.log(`User confirmed ${selectedCharacters.size} characters`);

    // Store confirmed characters in state (PRESERVED)
    state.confirmedCharacters = selectedCharacters;
    state.characters = selectedCharacters;

    console.log('Confirmed characters saved to state.confirmedCharacters:', Array.from(state.confirmedCharacters));

    // Re-initialize character tabs with confirmed characters (PRESERVED)
    initializeCharacterTabs();

    // Re-render character tabs and panels (PRESERVED)
    renderCharacterTabs();
    renderCharacterTabPanels();

    // Save project (PRESERVED)
    saveProject();

    // Close modal
    closeCharacterReviewModal();

    console.log(`Character tabs generated for ${selectedCharacters.size} characters`);
    alert(`${selectedCharacters.size} character${selectedCharacters.size !== 1 ? 's' : ''} confirmed!\n\nCharacter tabs created. You can now run "Auto Tag Script" to detect production elements.`);
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.reviewCharacters = reviewCharacters;
window.closeCharacterReviewModal = closeCharacterReviewModal;
window.selectAllCharacters = selectAllCharacters;
window.deselectAllCharacters = deselectAllCharacters;
window.confirmCharacterSelection = confirmCharacterSelection;
// Note: mergeSelectedCharacters is replaced by the new inline merge UI

export default {
    reviewCharacters,
    closeCharacterReviewModal,
    selectAllCharacters,
    deselectAllCharacters,
    confirmCharacterSelection
};
