/**
 * export-character-confirmation.js
 * Character confirmation modal and merge functionality
 *
 * Responsibilities:
 * - Show character confirmation modal after script analysis
 * - Handle character selection and category changes
 * - Merge duplicate characters
 * - Clean up character data after merge
 * - Confirm characters and continue with breakdown
 */

import { state } from '../main.js';
import { renderScript } from '../script-display.js';
import { renderSceneList } from '../scene-list.js';
import { renderCharacterTabs, renderCharacterTabPanels } from '../character-panel.js';
import { showToast } from './export-core.js';
import { saveProject } from './export-project.js';

// Track selected primary character for merge
let mergePrimaryIndex = null;

/**
 * Normalize character name to title case
 * @param {string} name - Character name
 * @returns {string} Normalized name
 */
function normalizeCharacterName(name) {
    return name.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Show character confirmation modal for user to review detected characters
 */
export function showCharacterConfirmationModal() {
    // Create modal if it doesn't exist
    let modal = document.getElementById('character-confirm-modal');
    if (!modal) {
        modal = createCharacterConfirmationModal();
        document.body.appendChild(modal);
    }

    // Populate character list
    populateCharacterConfirmationList();

    // Show modal
    modal.style.display = 'flex';
}

/**
 * Create the character confirmation modal HTML
 * @returns {HTMLElement} Modal element
 */
function createCharacterConfirmationModal() {
    const modal = document.createElement('div');
    modal.id = 'character-confirm-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px; max-height: 90vh; display: flex; flex-direction: column;">
            <div class="modal-title">Confirm Characters for H&MU Tracking</div>

            <div class="modal-section" style="flex: 1; overflow-y: auto; min-height: 0;">
                <div class="modal-note" style="margin-bottom: 16px;">
                    Review the detected characters below. Select which ones to include in your breakdown
                    and assign them to the correct category. Characters are sorted by scene count.
                </div>

                <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
                    <button class="modal-btn" onclick="selectAllCharactersByCategory('LEAD')">Select All Leads</button>
                    <button class="modal-btn" onclick="selectAllCharactersByCategory('SUPPORTING')">Select All Supporting</button>
                    <button class="modal-btn" onclick="selectAllCharactersByCategory('DAY_PLAYER')">Select All Day Players</button>
                    <button class="modal-btn" onclick="toggleAllCharacters(true)">Select All</button>
                    <button class="modal-btn" onclick="toggleAllCharacters(false)">Deselect All</button>
                </div>

                <div class="character-confirm-tabs" style="display: flex; gap: 8px; margin-bottom: 12px; border-bottom: 1px solid var(--glass-border); padding-bottom: 8px; flex-wrap: wrap;">
                    <button class="confirm-tab active" data-category="all" onclick="filterCharactersByCategory('all')">All (<span id="count-all">0</span>)</button>
                    <button class="confirm-tab" data-category="LEAD" onclick="filterCharactersByCategory('LEAD')">Lead (<span id="count-lead">0</span>)</button>
                    <button class="confirm-tab" data-category="SUPPORTING" onclick="filterCharactersByCategory('SUPPORTING')">Supporting (<span id="count-supporting">0</span>)</button>
                    <button class="confirm-tab" data-category="DAY_PLAYER" onclick="filterCharactersByCategory('DAY_PLAYER')">Day Player (<span id="count-dayplayer">0</span>)</button>
                    <button class="confirm-tab" data-category="BACKGROUND" onclick="filterCharactersByCategory('BACKGROUND')">Background (<span id="count-background">0</span>)</button>
                </div>

                <div id="character-confirm-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--glass-border); border-radius: 8px;">
                    <!-- Character items populated here -->
                </div>

                <div style="margin-top: 16px; display: flex; gap: 16px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 250px;">
                        <label class="modal-label">Add Character Manually</label>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <input type="text" class="modal-input" id="manual-character-name" placeholder="Character name..." style="flex: 1; min-width: 150px;">
                            <select class="modal-select" id="manual-character-category" style="width: 130px;">
                                <option value="LEAD">Lead</option>
                                <option value="SUPPORTING" selected>Supporting</option>
                                <option value="DAY_PLAYER">Day Player</option>
                                <option value="BACKGROUND">Background</option>
                            </select>
                            <button class="modal-btn primary" onclick="addManualCharacter()">Add</button>
                        </div>
                    </div>
                    <div style="flex: 1; min-width: 250px;">
                        <label class="modal-label">Merge Duplicate Characters</label>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="modal-btn" onclick="openMergeCharactersModal()" style="flex: 1;">
                                Merge Duplicates...
                            </button>
                        </div>
                        <div style="font-size: 0.75em; color: var(--text-muted); margin-top: 4px;">
                            Combine characters that are the same person (e.g., "JOHN" and "JOHN SMITH")
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal-actions" style="flex-shrink: 0; padding-top: 16px; border-top: 1px solid var(--glass-border); margin-top: 16px;">
                <button class="modal-btn" onclick="closeCharacterConfirmModal()">Cancel</button>
                <button class="modal-btn primary" onclick="confirmCharactersAndContinue()" style="background: var(--accent-gold); color: var(--bg-dark); font-weight: 600;">
                    Confirm Characters & Generate Breakdown
                </button>
            </div>
        </div>
    `;

    // Add styles for tabs and list items
    const style = document.createElement('style');
    style.textContent = `
        .confirm-tab {
            padding: 8px 16px;
            background: transparent;
            border: 1px solid var(--glass-border);
            border-radius: 6px 6px 0 0;
            color: var(--text-muted);
            cursor: pointer;
            font-size: 0.85em;
            transition: all 0.2s;
        }
        .confirm-tab:hover {
            border-color: var(--accent-gold);
            color: var(--accent-gold);
        }
        .confirm-tab.active {
            background: var(--accent-gold);
            border-color: var(--accent-gold);
            color: var(--bg-dark);
        }
        .character-confirm-item {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid var(--glass-border);
            transition: background 0.2s;
        }
        .character-confirm-item:hover {
            background: rgba(201, 169, 97, 0.05);
        }
        .character-confirm-item.unselected {
            opacity: 0.5;
        }
        .character-confirm-item .char-checkbox {
            width: 20px;
            height: 20px;
            margin-right: 12px;
            cursor: pointer;
        }
        .character-confirm-item .char-name {
            font-weight: 600;
            min-width: 150px;
        }
        .character-confirm-item .char-stats {
            color: var(--text-muted);
            font-size: 0.85em;
            flex: 1;
        }
        .character-confirm-item .char-category {
            margin-left: 12px;
        }
        .char-category select {
            padding: 4px 8px;
            background: var(--card-bg);
            border: 1px solid var(--glass-border);
            border-radius: 4px;
            color: var(--text-light);
            font-size: 0.85em;
        }
        .category-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.75em;
            font-weight: 600;
            margin-left: 8px;
        }
        .category-badge.lead { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        .category-badge.supporting { background: rgba(201, 169, 97, 0.2); color: var(--accent-gold); }
        .category-badge.day_player { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
        .category-badge.background { background: rgba(107, 114, 128, 0.2); color: #9ca3af; }
    `;
    document.head.appendChild(style);

    return modal;
}

/**
 * Populate the character confirmation list
 */
function populateCharacterConfirmationList() {
    const list = document.getElementById('character-confirm-list');
    if (!list) return;

    const characters = state.detectedCharacters || [];

    // Update counts
    const countAll = document.getElementById('count-all');
    const countLead = document.getElementById('count-lead');
    const countSupporting = document.getElementById('count-supporting');
    const countDayplayer = document.getElementById('count-dayplayer');
    const countBackground = document.getElementById('count-background');

    if (countAll) countAll.textContent = characters.length;
    if (countLead) countLead.textContent = characters.filter(c => c.category === 'LEAD').length;
    if (countSupporting) countSupporting.textContent = characters.filter(c => c.category === 'SUPPORTING').length;
    if (countDayplayer) countDayplayer.textContent = characters.filter(c => c.category === 'DAY_PLAYER').length;
    if (countBackground) countBackground.textContent = characters.filter(c => c.category === 'BACKGROUND').length;

    list.innerHTML = characters.map((char, idx) => `
        <div class="character-confirm-item ${char.selected ? '' : 'unselected'}" data-index="${idx}" data-category="${char.category}">
            <input type="checkbox" class="char-checkbox" ${char.selected ? 'checked' : ''} onchange="toggleCharacterSelection(${idx})">
            <span class="char-name">${char.name}</span>
            <span class="category-badge ${char.category.toLowerCase()}">${formatCategory(char.category)}</span>
            <span class="char-stats">
                ${char.sceneCount} scene${char.sceneCount !== 1 ? 's' : ''} (${char.firstAppearance}-${char.lastAppearance})
                ${char.hasDialogue ? '' : ' [No dialogue]'}
            </span>
            <span class="char-category">
                <select onchange="changeCharacterCategory(${idx}, this.value)">
                    <option value="LEAD" ${char.category === 'LEAD' ? 'selected' : ''}>Lead</option>
                    <option value="SUPPORTING" ${char.category === 'SUPPORTING' ? 'selected' : ''}>Supporting</option>
                    <option value="DAY_PLAYER" ${char.category === 'DAY_PLAYER' ? 'selected' : ''}>Day Player</option>
                    <option value="BACKGROUND" ${char.category === 'BACKGROUND' ? 'selected' : ''}>Background</option>
                </select>
            </span>
        </div>
    `).join('');
}

/**
 * Format category for display
 * @param {string} category - Category code
 * @returns {string} Formatted category name
 */
function formatCategory(category) {
    const formats = {
        'LEAD': 'Lead',
        'SUPPORTING': 'Supporting',
        'DAY_PLAYER': 'Day Player',
        'BACKGROUND': 'Background'
    };
    return formats[category] || category;
}

/**
 * Toggle character selection
 * @param {number} index - Character index
 */
window.toggleCharacterSelection = function(index) {
    if (state.detectedCharacters && state.detectedCharacters[index]) {
        state.detectedCharacters[index].selected = !state.detectedCharacters[index].selected;
        populateCharacterConfirmationList();
    }
};

/**
 * Change character category
 * @param {number} index - Character index
 * @param {string} newCategory - New category
 */
window.changeCharacterCategory = function(index, newCategory) {
    if (state.detectedCharacters && state.detectedCharacters[index]) {
        state.detectedCharacters[index].category = newCategory;
        populateCharacterConfirmationList();
    }
};

/**
 * Filter characters by category
 * @param {string} category - Category to filter by
 */
window.filterCharactersByCategory = function(category) {
    const items = document.querySelectorAll('.character-confirm-item');
    const tabs = document.querySelectorAll('.confirm-tab');

    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.category === category);
    });

    items.forEach(item => {
        if (category === 'all' || item.dataset.category === category) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
};

/**
 * Select all characters by category
 * @param {string} category - Category to select
 */
window.selectAllCharactersByCategory = function(category) {
    if (!state.detectedCharacters) return;

    state.detectedCharacters.forEach(char => {
        if (char.category === category) {
            char.selected = true;
        }
    });
    populateCharacterConfirmationList();
};

/**
 * Toggle all characters selection
 * @param {boolean} selected - Whether to select or deselect
 */
window.toggleAllCharacters = function(selected) {
    if (!state.detectedCharacters) return;

    state.detectedCharacters.forEach(char => {
        char.selected = selected;
    });
    populateCharacterConfirmationList();
};

/**
 * Add a character manually
 */
window.addManualCharacter = function() {
    const nameInput = document.getElementById('manual-character-name');
    const categorySelect = document.getElementById('manual-character-category');

    if (!nameInput || !categorySelect) return;

    const name = nameInput.value.trim();
    const category = categorySelect.value;

    if (!name) {
        alert('Please enter a character name');
        return;
    }

    // Check if character already exists
    const exists = state.detectedCharacters?.some(c =>
        c.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
        alert('This character already exists in the list');
        return;
    }

    // Add to detected characters
    if (!state.detectedCharacters) {
        state.detectedCharacters = [];
    }

    state.detectedCharacters.push({
        name: normalizeCharacterName(name),
        category: category,
        sceneCount: 0,
        firstAppearance: 1,
        lastAppearance: state.scenes.length,
        hasDialogue: true,
        selected: true,
        manuallyAdded: true
    });

    // Clear input and refresh list
    nameInput.value = '';
    populateCharacterConfirmationList();
};

/**
 * Open merge characters modal
 */
window.openMergeCharactersModal = function() {
    // Reset primary selection
    mergePrimaryIndex = null;

    // Create modal if it doesn't exist
    let modal = document.getElementById('merge-characters-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'merge-characters-modal';
        modal.className = 'modal';
        modal.style.zIndex = '10002';
        document.body.appendChild(modal);
    }

    const characters = state.detectedCharacters || [];

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px; max-height: 80vh; display: flex; flex-direction: column;">
            <div class="modal-title">Merge Duplicate Characters</div>

            <div class="modal-note" style="margin-bottom: 16px;">
                <strong>Step 1:</strong> Check the characters that are the same person.<br>
                <strong>Step 2:</strong> Click the star next to the name you want to keep as the primary name.
            </div>

            <div style="flex: 1; overflow-y: auto; min-height: 0;">
                <div id="merge-character-list" style="border: 1px solid var(--glass-border); border-radius: 8px; max-height: 300px; overflow-y: auto;">
                    ${renderMergeCharacterItems(characters)}
                </div>

                <div id="merge-primary-display" style="margin-top: 16px; padding: 12px; background: rgba(212, 175, 55, 0.1); border: 1px solid var(--accent-gold); border-radius: 8px; display: none;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.2em;">*</span>
                        <span style="color: var(--text-muted);">Primary name:</span>
                        <span id="merge-primary-name-display" style="font-weight: 700; color: var(--accent-gold);"></span>
                    </div>
                </div>

                <div style="margin-top: 12px;">
                    <label class="modal-label" style="font-size: 0.85em;">Or enter a custom name:</label>
                    <input type="text" class="modal-input" id="merge-primary-name" placeholder="Custom canonical name (optional)..." style="font-size: 0.9em;">
                </div>
            </div>

            <div class="modal-actions" style="flex-shrink: 0; padding-top: 16px; border-top: 1px solid var(--glass-border); margin-top: 16px;">
                <button class="modal-btn primary" onclick="performCharacterMerge()" style="background: var(--accent-gold); color: var(--bg-dark);">
                    Merge Selected
                </button>
                <button class="modal-btn" onclick="closeMergeCharactersModal()" style="background: var(--success-green); color: white;">
                    Done Merging
                </button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    // Add event listeners for checkboxes
    setupMergeCheckboxListeners();
};

/**
 * Render merge character list items
 * @param {Array} characters - Character array
 * @returns {string} HTML string
 */
function renderMergeCharacterItems(characters) {
    return characters.map((char, idx) => {
        const isPrimary = mergePrimaryIndex === idx;
        const primaryStyle = isPrimary ? 'background: rgba(212, 175, 55, 0.15); border-left: 3px solid var(--accent-gold);' : '';

        return `
            <div class="merge-char-item" data-index="${idx}" style="display: flex; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--glass-border); ${primaryStyle}">
                <input type="checkbox" class="merge-checkbox" data-index="${idx}" ${isPrimary ? 'checked' : ''} style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                <button class="set-primary-btn" onclick="setMergePrimary(${idx})" data-index="${idx}" title="Set as primary name" style="
                    background: ${isPrimary ? 'var(--accent-gold)' : 'transparent'};
                    border: 1px solid ${isPrimary ? 'var(--accent-gold)' : 'var(--glass-border)'};
                    border-radius: 4px;
                    padding: 2px 6px;
                    margin-right: 10px;
                    cursor: pointer;
                    font-size: 0.9em;
                    transition: all 0.2s;
                ">${isPrimary ? '*' : 'o'}</button>
                <span style="font-weight: ${isPrimary ? '700' : '600'}; min-width: 150px; color: ${isPrimary ? 'var(--accent-gold)' : 'inherit'};">${char.name}</span>
                <span style="color: var(--text-muted); font-size: 0.85em; margin-left: auto;">
                    ${char.sceneCount} scene${char.sceneCount !== 1 ? 's' : ''}
                    ${char.mergedFrom ? '<span style="color: var(--accent-gold);"> (merged)</span>' : ''}
                </span>
            </div>
        `;
    }).join('');
}

/**
 * Set up event listeners for merge checkboxes
 */
function setupMergeCheckboxListeners() {
    const checkboxes = document.querySelectorAll('#merge-character-list .merge-checkbox');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', function() {
            const idx = parseInt(this.dataset.index);
            // If this is the first checkbox checked, auto-set as primary
            const checkedBoxes = document.querySelectorAll('#merge-character-list .merge-checkbox:checked');
            if (checkedBoxes.length === 1 && this.checked) {
                setMergePrimary(idx);
            }
            // If unchecking the primary, reset primary to first checked
            if (!this.checked && mergePrimaryIndex === idx) {
                const firstChecked = document.querySelector('#merge-character-list .merge-checkbox:checked');
                if (firstChecked) {
                    setMergePrimary(parseInt(firstChecked.dataset.index));
                } else {
                    mergePrimaryIndex = null;
                    updatePrimaryDisplay();
                }
            }
        });
    });
}

/**
 * Set the primary character for merge
 * @param {number} index - Character index
 */
window.setMergePrimary = function(index) {
    mergePrimaryIndex = index;

    // Also check this character's checkbox
    const checkbox = document.querySelector(`#merge-character-list .merge-checkbox[data-index="${index}"]`);
    if (checkbox) checkbox.checked = true;

    // Refresh the list to show visual feedback
    const listContainer = document.getElementById('merge-character-list');
    if (listContainer) {
        const characters = state.detectedCharacters || [];
        listContainer.innerHTML = renderMergeCharacterItems(characters);
        setupMergeCheckboxListeners();
    }

    updatePrimaryDisplay();
};

/**
 * Update the primary name display
 */
function updatePrimaryDisplay() {
    const display = document.getElementById('merge-primary-display');
    const nameDisplay = document.getElementById('merge-primary-name-display');

    if (mergePrimaryIndex !== null && state.detectedCharacters[mergePrimaryIndex]) {
        const primaryChar = state.detectedCharacters[mergePrimaryIndex];
        if (nameDisplay) nameDisplay.textContent = primaryChar.name;
        if (display) display.style.display = 'block';
    } else {
        if (display) display.style.display = 'none';
    }
}

/**
 * Close merge characters modal
 */
window.closeMergeCharactersModal = function() {
    const modal = document.getElementById('merge-characters-modal');
    if (modal) modal.style.display = 'none';
};

/**
 * Perform the character merge
 */
window.performCharacterMerge = function() {
    const checkboxes = document.querySelectorAll('#merge-character-list .merge-checkbox:checked');
    const indices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));

    if (indices.length < 2) {
        alert('Please select at least 2 characters to merge');
        return;
    }

    const primaryNameInput = document.getElementById('merge-primary-name');
    let primaryName = primaryNameInput?.value.trim();

    // Get the characters to merge
    const charsToMerge = indices.map(idx => state.detectedCharacters[idx]).filter(Boolean);

    if (charsToMerge.length < 2) {
        alert('Error: Could not find selected characters');
        return;
    }

    // Use provided custom name, or selected primary, or first selected character's name
    if (!primaryName) {
        if (mergePrimaryIndex !== null && state.detectedCharacters[mergePrimaryIndex]) {
            primaryName = state.detectedCharacters[mergePrimaryIndex].name;
        } else {
            primaryName = charsToMerge[0].name;
        }
    }

    // Find the primary character for category
    const primaryChar = mergePrimaryIndex !== null && state.detectedCharacters[mergePrimaryIndex]
        ? state.detectedCharacters[mergePrimaryIndex]
        : charsToMerge[0];

    // Combine data from all characters
    const mergedChar = {
        name: normalizeCharacterName(primaryName),
        category: primaryChar.category,
        sceneCount: 0,
        firstAppearance: Infinity,
        lastAppearance: 0,
        hasDialogue: false,
        selected: charsToMerge.some(c => c.selected),
        scenesPresent: [],
        mergedFrom: charsToMerge.map(c => c.name)
    };

    // Aggregate data from all merged characters
    charsToMerge.forEach(char => {
        mergedChar.sceneCount += char.sceneCount || 0;
        mergedChar.firstAppearance = Math.min(mergedChar.firstAppearance, char.firstAppearance || Infinity);
        mergedChar.lastAppearance = Math.max(mergedChar.lastAppearance, char.lastAppearance || 0);
        mergedChar.hasDialogue = mergedChar.hasDialogue || char.hasDialogue;

        if (char.scenesPresent && Array.isArray(char.scenesPresent)) {
            mergedChar.scenesPresent = [...new Set([...mergedChar.scenesPresent, ...char.scenesPresent])];
        }
    });

    // Fix edge cases
    if (mergedChar.firstAppearance === Infinity) mergedChar.firstAppearance = 1;
    if (mergedChar.lastAppearance === 0) mergedChar.lastAppearance = state.scenes.length;

    // Remove scene duplicates and update count
    mergedChar.scenesPresent = [...new Set(mergedChar.scenesPresent)].sort((a, b) => a - b);
    if (mergedChar.scenesPresent.length > 0) {
        mergedChar.sceneCount = mergedChar.scenesPresent.length;
    }

    // Remove old characters (sort indices descending to remove from end first)
    indices.sort((a, b) => b - a).forEach(idx => {
        state.detectedCharacters.splice(idx, 1);
    });

    // Add merged character
    state.detectedCharacters.push(mergedChar);

    // Re-sort by scene count
    state.detectedCharacters.sort((a, b) => b.sceneCount - a.sceneCount);

    // Update master context if available
    if (window.masterContext?.characters) {
        const mergedMasterData = {};

        charsToMerge.forEach(char => {
            const charData = window.masterContext.characters[char.name];
            if (charData) {
                // Merge script descriptions
                if (!mergedMasterData.scriptDescriptions) {
                    mergedMasterData.scriptDescriptions = [];
                }
                if (charData.scriptDescriptions) {
                    mergedMasterData.scriptDescriptions.push(...charData.scriptDescriptions);
                }

                // Merge scenes present
                if (!mergedMasterData.scenesPresent) {
                    mergedMasterData.scenesPresent = [];
                }
                if (charData.scenesPresent || charData.storyPresence?.scenesPresent) {
                    const scenes = charData.scenesPresent || charData.storyPresence?.scenesPresent || [];
                    mergedMasterData.scenesPresent = [...new Set([...mergedMasterData.scenesPresent, ...scenes])];
                }

                // Take first available profile data
                if (!mergedMasterData.physicalProfile && charData.physicalProfile) {
                    mergedMasterData.physicalProfile = charData.physicalProfile;
                }
                if (!mergedMasterData.characterAnalysis && charData.characterAnalysis) {
                    mergedMasterData.characterAnalysis = charData.characterAnalysis;
                }
                if (!mergedMasterData.visualProfile && charData.visualProfile) {
                    mergedMasterData.visualProfile = charData.visualProfile;
                }

                // Delete old entry
                delete window.masterContext.characters[char.name];
            }
        });

        // Add merged entry with combined data
        window.masterContext.characters[mergedChar.name] = {
            ...mergedMasterData,
            sceneCount: mergedChar.sceneCount,
            firstAppearance: mergedChar.firstAppearance,
            lastAppearance: mergedChar.lastAppearance,
            mergedFrom: mergedChar.mergedFrom
        };

        // Update localStorage
        localStorage.setItem('masterContext', JSON.stringify(window.masterContext));
        window.scriptMasterContext = window.masterContext;
        localStorage.setItem('scriptMasterContext', JSON.stringify(window.masterContext));
    }

    // Get merged character names for cleanup
    const mergedNames = charsToMerge.map(c => c.name);
    const primaryCharName = mergedChar.name;

    // Clean up all character data structures to remove merged characters
    cleanupMergedCharacterData(mergedNames, primaryCharName);

    // Refresh both the merge modal list AND the confirmation list
    refreshMergeCharacterList();
    populateCharacterConfirmationList();

    // Refresh the scene list to show updated character names
    renderSceneList();

    showToast(`Merged ${charsToMerge.length} characters into "${mergedChar.name}"`, 'success');
    console.log('Merged characters:', mergedNames, '→', primaryCharName);

    // Run audit to verify no orphans remain
    const orphans = auditCharacterReferences();
    if (Object.values(orphans).some(arr => arr.length > 0)) {
        console.warn('Warning: Found orphaned character references after merge:', orphans);
    }
};

/**
 * Refresh the merge character list within the modal
 */
function refreshMergeCharacterList() {
    mergePrimaryIndex = null;

    const listContainer = document.getElementById('merge-character-list');
    if (!listContainer) return;

    const characters = state.detectedCharacters || [];
    listContainer.innerHTML = renderMergeCharacterItems(characters);
    setupMergeCheckboxListeners();

    // Clear the primary name input and hide the display
    const primaryNameInput = document.getElementById('merge-primary-name');
    if (primaryNameInput) primaryNameInput.value = '';

    updatePrimaryDisplay();
}

/**
 * Clean up all character data structures after a merge
 * @param {string[]} mergedNames - Names of characters that were merged
 * @param {string} primaryName - The new primary character name
 */
function cleanupMergedCharacterData(mergedNames, primaryName) {
    console.log('Cleaning up merged character data:', mergedNames, '→', primaryName);

    // 1. Update confirmedCharacters Set
    if (state.confirmedCharacters instanceof Set) {
        mergedNames.forEach(name => {
            if (name !== primaryName) {
                state.confirmedCharacters.delete(name);
            }
        });
        if (mergedNames.some(name => state.confirmedCharacters.has(name))) {
            state.confirmedCharacters.add(primaryName);
        }
    }

    // 2. Update castProfiles
    if (state.castProfiles) {
        const mergedProfile = { scenes: [], lookStates: [] };

        mergedNames.forEach(name => {
            const profile = state.castProfiles[name];
            if (profile) {
                if (profile.scenes) {
                    mergedProfile.scenes = [...new Set([...mergedProfile.scenes, ...profile.scenes])];
                }
                if (!mergedProfile.baseDescription && profile.baseDescription) {
                    mergedProfile.baseDescription = profile.baseDescription;
                }
                if (profile.lookStates) {
                    mergedProfile.lookStates = [...mergedProfile.lookStates, ...profile.lookStates];
                }
                if (name !== primaryName) {
                    delete state.castProfiles[name];
                }
            }
        });

        if (Object.keys(mergedProfile).length > 0) {
            state.castProfiles[primaryName] = {
                ...state.castProfiles[primaryName],
                ...mergedProfile,
                mergedFrom: mergedNames.filter(n => n !== primaryName)
            };
        }
    }

    // 3. Update sceneBreakdowns cast arrays
    if (state.sceneBreakdowns) {
        Object.keys(state.sceneBreakdowns).forEach(sceneIdx => {
            const breakdown = state.sceneBreakdowns[sceneIdx];
            if (breakdown?.cast && Array.isArray(breakdown.cast)) {
                const hasAnyMerged = breakdown.cast.some(c => mergedNames.includes(c));
                if (hasAnyMerged) {
                    breakdown.cast = breakdown.cast.filter(c => !mergedNames.includes(c));
                    if (!breakdown.cast.includes(primaryName)) {
                        breakdown.cast.push(primaryName);
                    }
                }
            }
        });
    }

    // 4. Update scriptTags
    if (state.scriptTags) {
        Object.keys(state.scriptTags).forEach(sceneIdx => {
            const tags = state.scriptTags[sceneIdx];
            if (Array.isArray(tags)) {
                tags.forEach(tag => {
                    if (tag.character && mergedNames.includes(tag.character) && tag.character !== primaryName) {
                        tag.character = primaryName;
                    }
                    if (tag.linkedCharacter && mergedNames.includes(tag.linkedCharacter) && tag.linkedCharacter !== primaryName) {
                        tag.linkedCharacter = primaryName;
                    }
                });
            }
        });
    }

    // 5. Update characterStates
    if (state.characterStates) {
        Object.keys(state.characterStates).forEach(sceneIdx => {
            const sceneStates = state.characterStates[sceneIdx];
            if (sceneStates) {
                const mergedState = {};

                mergedNames.forEach(name => {
                    if (sceneStates[name]) {
                        if (!mergedState.tags) mergedState.tags = [];
                        if (!mergedState.notes) mergedState.notes = '';

                        if (sceneStates[name].tags) {
                            mergedState.tags = [...mergedState.tags, ...sceneStates[name].tags];
                        }
                        if (sceneStates[name].notes) {
                            mergedState.notes += (mergedState.notes ? '\n' : '') + sceneStates[name].notes;
                        }

                        if (name !== primaryName) {
                            delete sceneStates[name];
                        }
                    }
                });

                if (Object.keys(mergedState).length > 0) {
                    sceneStates[primaryName] = {
                        ...sceneStates[primaryName],
                        ...mergedState
                    };
                }
            }
        });
    }

    // 6. Update characterLooks
    if (state.characterLooks) {
        const mergedLooks = [];

        mergedNames.forEach(name => {
            if (state.characterLooks[name]) {
                mergedLooks.push(...state.characterLooks[name]);
                if (name !== primaryName) {
                    delete state.characterLooks[name];
                }
            }
        });

        if (mergedLooks.length > 0) {
            state.characterLooks[primaryName] = [
                ...(state.characterLooks[primaryName] || []),
                ...mergedLooks
            ];
        }
    }

    // 7. Update continuityEvents
    if (state.continuityEvents) {
        const mergedEvents = [];

        mergedNames.forEach(name => {
            if (state.continuityEvents[name]) {
                mergedEvents.push(...state.continuityEvents[name]);
                if (name !== primaryName) {
                    delete state.continuityEvents[name];
                }
            }
        });

        if (mergedEvents.length > 0) {
            state.continuityEvents[primaryName] = [
                ...(state.continuityEvents[primaryName] || []),
                ...mergedEvents
            ];
        }
    }

    // 8. Update characterTabs
    if (state.characterTabs && Array.isArray(state.characterTabs)) {
        state.characterTabs = state.characterTabs.filter(tab =>
            !mergedNames.includes(tab) || tab === primaryName
        );
        if (!state.characterTabs.includes(primaryName) &&
            mergedNames.some(name => state.characterTabs.includes(name))) {
            state.characterTabs.push(primaryName);
        }
    }

    console.log('Character data cleanup complete');
}

/**
 * Close character confirmation modal
 */
window.closeCharacterConfirmModal = function() {
    const modal = document.getElementById('character-confirm-modal');
    if (modal) modal.style.display = 'none';
};

/**
 * Confirm characters and continue with breakdown
 */
window.confirmCharactersAndContinue = async function() {
    console.log('confirmCharactersAndContinue called');

    try {
        // Get selected characters
        const selectedCharacters = (state.detectedCharacters || []).filter(c => c.selected);
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
                            role: char.category.toLowerCase()
                        },
                        scenesPresent: char.scenesPresent || window.masterContext.characters[char.name]?.scenesPresent || []
                    };
                } else {
                    // Manually added character
                    confirmedCharsObj[char.name] = {
                        category: char.category,
                        characterAnalysis: { role: char.category.toLowerCase() },
                        storyPresence: {
                            totalScenes: char.sceneCount || 0,
                            scenesPresent: char.scenesPresent || []
                        },
                        firstAppearance: char.firstAppearance || 1,
                        lastAppearance: char.lastAppearance || state.scenes.length,
                        sceneCount: char.sceneCount || 0,
                        scenesPresent: char.scenesPresent || []
                    };
                }
            });

            window.confirmedMasterContext = {
                ...window.masterContext,
                characters: confirmedCharsObj
            };
            console.log('Created confirmedMasterContext with', Object.keys(confirmedCharsObj).length, 'characters');
        }

        // Store character categories for use in breakdown
        window.characterCategories = {};
        selectedCharacters.forEach(char => {
            window.characterCategories[char.name] = char.category;
        });

        // Populate initial data
        console.log('Calling populateInitialData...');
        const { populateInitialData } = await import('./export-master-context.js');
        populateInitialData(window.confirmedMasterContext || window.masterContext);

        // Close modal
        closeCharacterConfirmModal();

        // Render character tabs and panels
        console.log('Rendering character tabs and panels...');
        renderCharacterTabs();
        renderCharacterTabPanels();

        // Render the scene list to show updated character counts
        console.log('Rendering scene list...');
        renderSceneList();

        // Render the script display with highlights
        console.log('Rendering script...');
        renderScript();

        // Run audit to verify no orphans
        const orphans = auditCharacterReferences();
        if (Object.values(orphans).some(arr => arr.length > 0)) {
            console.warn('Warning: Found orphaned character references after confirmation:', orphans);
        }

        // Save project
        saveProject();

        // Show success message
        showToast(`${selectedCharacters.length} characters confirmed. Breakdown ready!`, 'success');
        console.log('Character confirmation complete');

    } catch (error) {
        console.error('Error in confirmCharactersAndContinue:', error);
        alert('Error confirming characters: ' + error.message);
    }
};

/**
 * Build a mapping of old/merged character names to their canonical names
 * @param {Array} selectedCharacters - Array of selected character objects
 * @returns {Map} Map of oldName → canonicalName
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
 * @param {Set} selectedNames - Set of selected canonical character names
 * @param {Map} mergeMapping - Map of oldName → canonicalName
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

        return [...cleanedSet];
    };

    // Clean state.scenes
    if (state.scenes && Array.isArray(state.scenes)) {
        state.scenes.forEach((scene, idx) => {
            let updated = false;

            if (scene.castMembers) {
                const before = scene.castMembers.length;
                scene.castMembers = cleanCharacterArray(scene.castMembers);
                if (scene.castMembers.length !== before) updated = true;
            }

            if (scene.characters_present) {
                const before = scene.characters_present.length;
                scene.characters_present = cleanCharacterArray(scene.characters_present);
                if (scene.characters_present.length !== before) updated = true;
            }

            if (scene.aiData?.characters_present) {
                const before = scene.aiData.characters_present.length;
                scene.aiData.characters_present = cleanCharacterArray(scene.aiData.characters_present);
                if (scene.aiData.characters_present.length !== before) updated = true;
            }

            if (updated) scenesUpdated++;
        });
    }

    // Clean state.sceneBreakdowns
    if (state.sceneBreakdowns) {
        Object.keys(state.sceneBreakdowns).forEach(sceneIdx => {
            const breakdown = state.sceneBreakdowns[sceneIdx];
            if (breakdown?.cast) {
                breakdown.cast = cleanCharacterArray(breakdown.cast);
            }
        });
    }

    // Clean state.castProfiles
    if (state.castProfiles) {
        const newProfiles = {};

        Object.entries(state.castProfiles).forEach(([name, profile]) => {
            const canonicalName = mergeMapping.get(name);

            if (canonicalName && selectedNames.has(canonicalName)) {
                if (!newProfiles[canonicalName]) {
                    newProfiles[canonicalName] = { ...profile, name: canonicalName };
                } else {
                    if (profile.scenes) {
                        newProfiles[canonicalName].scenes = [
                            ...new Set([...(newProfiles[canonicalName].scenes || []), ...profile.scenes])
                        ];
                    }
                    if (profile.lookStates) {
                        newProfiles[canonicalName].lookStates = [
                            ...(newProfiles[canonicalName].lookStates || []),
                            ...profile.lookStates
                        ];
                    }
                }
            } else if (selectedNames.has(name)) {
                newProfiles[name] = profile;
            }
        });

        state.castProfiles = newProfiles;
    }

    // Clean state.scriptTags
    if (state.scriptTags) {
        Object.keys(state.scriptTags).forEach(sceneIdx => {
            const tags = state.scriptTags[sceneIdx];
            if (Array.isArray(tags)) {
                state.scriptTags[sceneIdx] = tags.filter(tag => {
                    if (tag.character) {
                        const canonicalName = mergeMapping.get(tag.character);
                        if (canonicalName && selectedNames.has(canonicalName)) {
                            tag.character = canonicalName;
                            return true;
                        } else if (selectedNames.has(tag.character)) {
                            return true;
                        }
                        return false;
                    }
                    return true;
                });
            }
        });
    }

    // Clean state.characterStates
    if (state.characterStates) {
        Object.keys(state.characterStates).forEach(sceneIdx => {
            const sceneStates = state.characterStates[sceneIdx];
            if (sceneStates) {
                const newSceneStates = {};

                Object.entries(sceneStates).forEach(([name, charState]) => {
                    const canonicalName = mergeMapping.get(name);

                    if (canonicalName && selectedNames.has(canonicalName)) {
                        if (!newSceneStates[canonicalName]) {
                            newSceneStates[canonicalName] = charState;
                        } else {
                            if (charState.tags) {
                                newSceneStates[canonicalName].tags = [
                                    ...(newSceneStates[canonicalName].tags || []),
                                    ...charState.tags
                                ];
                            }
                            if (charState.notes) {
                                newSceneStates[canonicalName].notes =
                                    (newSceneStates[canonicalName].notes || '') +
                                    (newSceneStates[canonicalName].notes ? '\n' : '') +
                                    charState.notes;
                            }
                        }
                    } else if (selectedNames.has(name)) {
                        newSceneStates[name] = charState;
                    }
                });

                state.characterStates[sceneIdx] = newSceneStates;
            }
        });
    }

    // Clean state.characterLooks
    if (state.characterLooks) {
        const newLooks = {};

        Object.entries(state.characterLooks).forEach(([name, looks]) => {
            const canonicalName = mergeMapping.get(name);

            if (canonicalName && selectedNames.has(canonicalName)) {
                if (!newLooks[canonicalName]) {
                    newLooks[canonicalName] = looks;
                } else {
                    newLooks[canonicalName] = [...newLooks[canonicalName], ...looks];
                }
            } else if (selectedNames.has(name)) {
                newLooks[name] = looks;
            }
        });

        state.characterLooks = newLooks;
    }

    // Clean state.continuityEvents
    if (state.continuityEvents) {
        const newEvents = {};

        Object.entries(state.continuityEvents).forEach(([name, events]) => {
            const canonicalName = mergeMapping.get(name);

            if (canonicalName && selectedNames.has(canonicalName)) {
                if (!newEvents[canonicalName]) {
                    newEvents[canonicalName] = events;
                } else {
                    newEvents[canonicalName] = [...newEvents[canonicalName], ...events];
                }
            } else if (selectedNames.has(name)) {
                newEvents[name] = events;
            }
        });

        state.continuityEvents = newEvents;
    }

    // Clean state.characterTabs
    if (state.characterTabs && Array.isArray(state.characterTabs)) {
        const newTabs = new Set();

        state.characterTabs.forEach(name => {
            const canonicalName = mergeMapping.get(name);
            if (canonicalName && selectedNames.has(canonicalName)) {
                newTabs.add(canonicalName);
            } else if (selectedNames.has(name)) {
                newTabs.add(name);
            }
        });

        state.characterTabs = [...newTabs];
    }

    console.log('Scene character data cleanup complete:', {
        scenesUpdated,
        charactersRemoved,
        charactersMerged
    });
}

/**
 * Audit all character references to find orphaned names
 * Used for validation after merge operations
 * @returns {Object} Object with arrays of orphaned references by location
 */
export function auditCharacterReferences() {
    // Get valid character names from both confirmed and detected
    const validCharacters = new Set();

    if (state.confirmedCharacters instanceof Set) {
        state.confirmedCharacters.forEach(name => validCharacters.add(name));
    } else if (Array.isArray(state.confirmedCharacters)) {
        state.confirmedCharacters.forEach(name => validCharacters.add(name));
    }

    // Also include detected characters if not yet confirmed
    if (state.detectedCharacters && Array.isArray(state.detectedCharacters)) {
        state.detectedCharacters
            .filter(c => c.selected)
            .forEach(c => validCharacters.add(c.name));
    }

    const orphans = {
        inScenes: [],
        inBreakdowns: [],
        inTags: [],
        inCharacterStates: [],
        inCharacterLooks: [],
        inContinuityEvents: [],
        inCastProfiles: [],
        inCharacterTabs: []
    };

    // Check state.scenes
    if (state.scenes && Array.isArray(state.scenes)) {
        state.scenes.forEach((scene, index) => {
            ['castMembers', 'characters_present'].forEach(field => {
                const chars = scene[field];
                if (Array.isArray(chars)) {
                    chars.forEach(char => {
                        if (!validCharacters.has(char)) {
                            orphans.inScenes.push({ scene: index, field, character: char });
                        }
                    });
                }
            });
            if (scene.aiData?.characters_present) {
                scene.aiData.characters_present.forEach(char => {
                    if (!validCharacters.has(char)) {
                        orphans.inScenes.push({ scene: index, field: 'aiData.characters_present', character: char });
                    }
                });
            }
        });
    }

    // Check state.sceneBreakdowns
    if (state.sceneBreakdowns) {
        Object.keys(state.sceneBreakdowns).forEach(sceneIdx => {
            const breakdown = state.sceneBreakdowns[sceneIdx];
            if (breakdown?.cast && Array.isArray(breakdown.cast)) {
                breakdown.cast.forEach(char => {
                    if (!validCharacters.has(char)) {
                        orphans.inBreakdowns.push({ scene: sceneIdx, character: char });
                    }
                });
            }
        });
    }

    // Check state.scriptTags
    if (state.scriptTags) {
        Object.keys(state.scriptTags).forEach(sceneIdx => {
            const tags = state.scriptTags[sceneIdx];
            if (Array.isArray(tags)) {
                tags.forEach((tag, tagIdx) => {
                    if (tag.character && !validCharacters.has(tag.character)) {
                        orphans.inTags.push({ scene: sceneIdx, tagIndex: tagIdx, character: tag.character });
                    }
                    if (tag.linkedCharacter && !validCharacters.has(tag.linkedCharacter)) {
                        orphans.inTags.push({ scene: sceneIdx, tagIndex: tagIdx, character: tag.linkedCharacter, field: 'linkedCharacter' });
                    }
                });
            }
        });
    }

    // Check state.characterStates
    if (state.characterStates) {
        Object.keys(state.characterStates).forEach(sceneIdx => {
            const sceneStates = state.characterStates[sceneIdx];
            if (sceneStates) {
                Object.keys(sceneStates).forEach(char => {
                    if (!validCharacters.has(char)) {
                        orphans.inCharacterStates.push({ scene: sceneIdx, character: char });
                    }
                });
            }
        });
    }

    // Check state.characterLooks
    if (state.characterLooks) {
        Object.keys(state.characterLooks).forEach(char => {
            if (!validCharacters.has(char)) {
                orphans.inCharacterLooks.push({ character: char });
            }
        });
    }

    // Check state.continuityEvents
    if (state.continuityEvents) {
        Object.keys(state.continuityEvents).forEach(char => {
            if (!validCharacters.has(char)) {
                orphans.inContinuityEvents.push({ character: char });
            }
        });
    }

    // Check state.castProfiles
    if (state.castProfiles) {
        Object.keys(state.castProfiles).forEach(char => {
            if (!validCharacters.has(char)) {
                orphans.inCastProfiles.push({ character: char });
            }
        });
    }

    // Check state.characterTabs
    if (state.characterTabs && Array.isArray(state.characterTabs)) {
        state.characterTabs.forEach(char => {
            if (!validCharacters.has(char)) {
                orphans.inCharacterTabs.push({ character: char });
            }
        });
    }

    // Log summary
    const totalOrphans = Object.values(orphans).reduce((sum, arr) => sum + arr.length, 0);
    if (totalOrphans > 0) {
        console.log(`Audit found ${totalOrphans} orphaned character references:`, orphans);
    } else {
        console.log('Audit complete: No orphaned character references found');
    }

    return orphans;
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.showCharacterConfirmationModal = showCharacterConfirmationModal;
window.closeCharacterConfirmModal = closeCharacterConfirmModal;
window.auditCharacterReferences = auditCharacterReferences;

export default {
    showCharacterConfirmationModal,
    closeCharacterConfirmModal,
    normalizeCharacterName,
    auditCharacterReferences
};

// Note: auditCharacterReferences is already exported inline
export { normalizeCharacterName };
