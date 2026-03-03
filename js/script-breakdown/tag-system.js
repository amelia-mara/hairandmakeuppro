/**
 * tag-system.js
 * Tag creation, highlighting, and management
 *
 * Responsibilities:
 * - Create tags from text selection
 * - Apply color-coded highlights to script
 * - Link tags to characters and events
 * - Show tag tooltips and context menu
 * - Handle tag interactions
 */

import { state } from './main.js';
import { generateId } from './utils.js';
import { callAI } from './ai-integration.js';

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

// Current text selection
let currentSelection = null;

// Currently editing tag
let currentEditingTag = null;
let currentEditingSceneIndex = null;

/**
 * Handle clicking on a highlighted tag
 * @param {Event} event - Click event
 * @param {string} tagId - Tag ID
 */
export function handleTagClick(event, tagId) {
    event.stopPropagation();
    event.preventDefault();

    console.log('🏷️ Tag clicked:', tagId);

    // Find the tag and its scene index
    let tag = null;
    let sceneIndex = null;
    for (let idx in state.scriptTags) {
        const found = state.scriptTags[idx].find(t => t.id.toString() === tagId || t.id === tagId);
        if (found) {
            tag = found;
            sceneIndex = parseInt(idx);
            break;
        }
    }

    if (!tag) {
        console.warn('Tag not found:', tagId);
        return;
    }

    // Show edit modal
    showTagEditModal(tag, sceneIndex);
}

/**
 * Show tag edit modal
 * @param {Object} tag - Tag object
 * @param {number} sceneIndex - Scene index
 */
function showTagEditModal(tag, sceneIndex) {
    currentEditingTag = tag;
    currentEditingSceneIndex = sceneIndex;

    // Remove any existing modal
    const existing = document.getElementById('tag-edit-modal');
    if (existing) existing.remove();

    // Get all characters for dropdown
    const allCharacters = getAllCharactersInScene();

    // Build character options
    let characterOptions = `<option value="">General Note (no character)</option>`;
    allCharacters.forEach(char => {
        const selected = tag.character === char ? 'selected' : '';
        characterOptions += `<option value="${escapeHtml(char)}" ${selected}>${escapeHtml(char)}</option>`;
    });

    // Build category options
    const categoryOptions = categories.map(cat => {
        const selected = tag.category === cat.id ? 'selected' : '';
        return `<option value="${cat.id}" ${selected}>${cat.name}</option>`;
    }).join('');

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'tag-edit-modal';
    modal.className = 'tag-edit-modal';
    modal.innerHTML = `
        <div class="tag-edit-content">
            <div class="tag-edit-header">
                <h3>Edit Tag</h3>
                <button class="tag-edit-close" onclick="closeTagEditModal()">×</button>
            </div>
            <div class="tag-edit-body">
                <div class="tag-edit-field">
                    <label>Tagged Text</label>
                    <div class="tag-edit-text">${escapeHtml(tag.selectedText)}</div>
                </div>
                <div class="tag-edit-field">
                    <label>Context</label>
                    <div class="tag-edit-context">${escapeHtml(tag.fullContext || tag.selectedText)}</div>
                </div>
                <div class="tag-edit-field">
                    <label>Category</label>
                    <select id="tag-edit-category">
                        ${categoryOptions}
                    </select>
                </div>
                <div class="tag-edit-field">
                    <label>Character</label>
                    <select id="tag-edit-character">
                        ${characterOptions}
                    </select>
                </div>
                <div class="tag-edit-meta">
                    Scene ${(tag.sceneNumber || sceneIndex + 1)} • Created ${new Date(tag.created).toLocaleDateString()}
                </div>
            </div>
            <div class="tag-edit-footer">
                <button class="tag-edit-btn delete" onclick="deleteCurrentTag()">Delete Tag</button>
                <div class="tag-edit-footer-right">
                    <button class="tag-edit-btn cancel" onclick="closeTagEditModal()">Cancel</button>
                    <button class="tag-edit-btn save" onclick="saveTagEdits()">Save Changes</button>
                </div>
            </div>
        </div>
    `;

    // Add styles if not already present
    if (!document.getElementById('tag-edit-modal-styles')) {
        const styles = document.createElement('style');
        styles.id = 'tag-edit-modal-styles';
        styles.textContent = `
            .tag-edit-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                backdrop-filter: blur(4px);
            }
            .tag-edit-content {
                background: var(--glass-bg, rgba(28, 25, 22, 0.95));
                border: 1px solid var(--accent-gold, #d4af7a);
                border-radius: 12px;
                width: 420px;
                max-width: 90vw;
                max-height: 90vh;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            }
            .tag-edit-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid rgba(212, 175, 122, 0.2);
            }
            .tag-edit-header h3 {
                margin: 0;
                font-size: 1em;
                font-weight: 600;
                color: var(--accent-gold, #d4af7a);
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            .tag-edit-close {
                background: none;
                border: none;
                color: var(--text-muted, #9ca3af);
                font-size: 1.5em;
                cursor: pointer;
                padding: 0;
                line-height: 1;
            }
            .tag-edit-close:hover {
                color: var(--text-light, #e4e4e7);
            }
            .tag-edit-body {
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            .tag-edit-field {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .tag-edit-field label {
                font-size: 0.75em;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: var(--text-muted, #9ca3af);
            }
            .tag-edit-text {
                padding: 10px 12px;
                background: rgba(212, 175, 122, 0.1);
                border: 1px solid rgba(212, 175, 122, 0.3);
                border-radius: 6px;
                font-size: 0.9em;
                color: var(--accent-gold, #d4af7a);
                font-weight: 500;
            }
            .tag-edit-context {
                padding: 10px 12px;
                background: rgba(0, 0, 0, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                font-size: 0.85em;
                color: var(--text-secondary, #a1a1aa);
                max-height: 80px;
                overflow-y: auto;
                line-height: 1.4;
            }
            .tag-edit-field select {
                padding: 10px 12px;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                color: var(--text-primary, #e4e4e7);
                font-size: 0.9em;
            }
            .tag-edit-field select:focus {
                outline: none;
                border-color: var(--accent-gold, #d4af7a);
            }
            .tag-edit-meta {
                font-size: 0.75em;
                color: var(--text-muted, #9ca3af);
                text-align: center;
                padding-top: 8px;
                border-top: 1px solid rgba(255, 255, 255, 0.05);
            }
            .tag-edit-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                border-top: 1px solid rgba(212, 175, 122, 0.2);
                background: rgba(0, 0, 0, 0.2);
            }
            .tag-edit-footer-right {
                display: flex;
                gap: 8px;
            }
            .tag-edit-btn {
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 0.85em;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }
            .tag-edit-btn.cancel {
                background: transparent;
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: var(--text-secondary, #a1a1aa);
            }
            .tag-edit-btn.cancel:hover {
                background: rgba(255, 255, 255, 0.05);
                border-color: rgba(255, 255, 255, 0.3);
            }
            .tag-edit-btn.save {
                background: linear-gradient(135deg, var(--accent-gold, #d4af7a), #b89651);
                border: none;
                color: #0a0908;
            }
            .tag-edit-btn.save:hover {
                filter: brightness(1.1);
            }
            .tag-edit-btn.delete {
                background: transparent;
                border: 1px solid rgba(220, 38, 38, 0.5);
                color: #ef4444;
            }
            .tag-edit-btn.delete:hover {
                background: rgba(220, 38, 38, 0.1);
                border-color: #ef4444;
            }
        `;
        document.head.appendChild(styles);
    }

    document.body.appendChild(modal);

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeTagEditModal();
        }
    });

    // Close on Escape
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeTagEditModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

/**
 * Close tag edit modal
 */
function closeTagEditModal() {
    const modal = document.getElementById('tag-edit-modal');
    if (modal) modal.remove();
    currentEditingTag = null;
    currentEditingSceneIndex = null;
}

/**
 * Save tag edits
 */
function saveTagEdits() {
    if (!currentEditingTag || currentEditingSceneIndex === null) return;

    const categoryEl = document.getElementById('tag-edit-category');
    const characterEl = document.getElementById('tag-edit-character');

    if (!categoryEl || !characterEl) return;

    const newCategory = categoryEl.value;
    const newCharacter = characterEl.value || null;

    console.log('💾 Saving tag edits:', { newCategory, newCharacter });

    // Update the tag
    currentEditingTag.category = newCategory;
    currentEditingTag.character = newCharacter;

    // Save to localStorage
    import('./export-handlers.js').then(module => module.saveProject());

    // Re-apply highlights to update visuals
    renderAllHighlights();

    // Re-render breakdown panel
    import('./breakdown-form.js').then(module => module.renderBreakdownPanel());

    closeTagEditModal();

    console.log('✓ Tag updated successfully');
}

/**
 * Delete current tag
 */
function deleteCurrentTag() {
    if (!currentEditingTag || currentEditingSceneIndex === null) return;

    if (!confirm('Are you sure you want to delete this tag?')) return;

    const tagId = currentEditingTag.id;
    const sceneTags = state.scriptTags[currentEditingSceneIndex];

    if (sceneTags) {
        const index = sceneTags.findIndex(t => t.id === tagId);
        if (index !== -1) {
            sceneTags.splice(index, 1);
            console.log('🗑️ Tag deleted:', tagId);
        }
    }

    // Remove highlight from DOM
    const highlight = document.querySelector(`[data-tag-id="${tagId}"]`);
    if (highlight) {
        // Replace the span with its text content
        const text = document.createTextNode(highlight.textContent);
        highlight.parentNode.replaceChild(text, highlight);
    }

    // Save to localStorage
    import('./export-handlers.js').then(module => module.saveProject());

    // Re-render breakdown panel
    import('./breakdown-form.js').then(module => module.renderBreakdownPanel());

    closeTagEditModal();
}

// Expose functions globally
window.closeTagEditModal = closeTagEditModal;
window.saveTagEdits = saveTagEdits;
window.deleteCurrentTag = deleteCurrentTag;

/**
 * Show tag information in a tooltip (legacy - now redirects to edit modal)
 * @param {Object} tag - Tag object
 */
function showTagInfo(tag) {
    // Find scene index for this tag
    let sceneIndex = null;
    for (let idx in state.scriptTags) {
        if (state.scriptTags[idx].find(t => t.id === tag.id)) {
            sceneIndex = parseInt(idx);
            break;
        }
    }
    showTagEditModal(tag, sceneIndex);
}

/**
 * Get all characters available in the current scene
 * @returns {Array} Array of character names
 */
function getAllCharactersInScene() {
    const sceneIndex = state.currentScene;
    const characters = new Set();

    // Try to ensure masterContext is loaded
    let masterContext = window.masterContext || window.scriptMasterContext;

    // If not in window, try loading from localStorage
    if (!masterContext || !masterContext.characters) {
        try {
            const stored = localStorage.getItem('masterContext') || localStorage.getItem('scriptMasterContext');
            if (stored) {
                masterContext = JSON.parse(stored);
                // Also set on window for future use
                if (!window.masterContext) {
                    window.masterContext = masterContext;
                }
            }
        } catch (e) {
            console.warn('Could not load masterContext from localStorage:', e);
        }
    }

    // From masterContext (all detected characters)
    if (masterContext?.characters) {
        Object.keys(masterContext.characters).forEach(char => {
            characters.add(char);
        });
    }

    // From confirmed characters (handle both Set and Array)
    if (state.confirmedCharacters) {
        if (state.confirmedCharacters instanceof Set) {
            state.confirmedCharacters.forEach(char => {
                characters.add(char);
            });
        } else if (Array.isArray(state.confirmedCharacters)) {
            state.confirmedCharacters.forEach(char => {
                characters.add(char);
            });
        }
    }

    // From scene breakdown (manually added or featured characters)
    if (state.sceneBreakdowns?.[sceneIndex]?.cast) {
        state.sceneBreakdowns[sceneIndex].cast.forEach(char => {
            characters.add(char);
        });
    }

    // Also check all scene breakdowns for any characters
    if (state.sceneBreakdowns) {
        Object.values(state.sceneBreakdowns).forEach(breakdown => {
            if (breakdown?.cast) {
                breakdown.cast.forEach(char => characters.add(char));
            }
        });
    }

    // Also check castProfiles
    if (state.castProfiles) {
        Object.keys(state.castProfiles).forEach(char => {
            characters.add(char);
        });
    }

    console.log('📋 Characters found for dropdown:', Array.from(characters));
    return Array.from(characters).sort();
}

/**
 * Populate character dropdown with all available characters
 * @param {HTMLSelectElement} select - The dropdown element
 */
function populateCharacterDropdown(select) {
    const allCharacters = getAllCharactersInScene();
    console.log('🎭 Populating dropdown with characters:', allCharacters);

    // Build the HTML for the dropdown
    let optionsHTML = `
        <option value="">General Note (no character)</option>
        <option value="__ADD_NEW__" style="font-weight: bold; color: #667eea;">+ Add New Character</option>
    `;

    if (allCharacters.length > 0) {
        optionsHTML += '<option disabled>──────────</option>';
        allCharacters.forEach(char => {
            optionsHTML += `<option value="${escapeHtml(char)}">${escapeHtml(char)}</option>`;
        });
    }

    select.innerHTML = optionsHTML;
    console.log(`✓ Added ${allCharacters.length} character options to dropdown`);

    // Set up change handler for ADD_NEW option (use onclick attribute to avoid duplicate listeners)
    select.onchange = function() {
        if (this.value === '__ADD_NEW__') {
            handleAddNewCharacter(this);
        }
    };
}

/**
 * Handle adding a new character via dropdown
 * @param {HTMLSelectElement} dropdown - The dropdown element
 */
function handleAddNewCharacter(dropdown) {
    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Character name (e.g., JOHN)';
    input.className = 'modal-input';
    input.style.textTransform = 'uppercase';
    input.style.marginTop = '8px';

    // Hide dropdown, show input
    dropdown.style.display = 'none';
    dropdown.parentNode.insertBefore(input, dropdown.nextSibling);
    input.focus();

    // Handle input completion
    const completeInput = () => {
        const newName = input.value.trim().toUpperCase();
        if (newName) {
            // Add to system
            addCharacterToSystem(newName);
            // Update dropdown
            populateCharacterDropdown(dropdown);
            dropdown.value = newName;
        } else {
            // User canceled - reset dropdown
            dropdown.value = '';
        }
        input.remove();
        dropdown.style.display = 'block';
    };

    input.addEventListener('blur', completeInput);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            completeInput();
        }
    });
}

/**
 * Add a new character to the system
 * @param {string} characterName - Character name in uppercase
 */
function addCharacterToSystem(characterName) {
    console.log(`Adding new character: ${characterName}`);

    // Add to masterContext
    if (!window.masterContext) window.masterContext = { characters: {} };
    if (!window.masterContext.characters[characterName]) {
        window.masterContext.characters[characterName] = {
            characterAnalysis: {
                role: 'tracked',  // Not featured (no auto tab)
                addedManually: true
            }
        };
    }

    // Add to confirmed characters
    if (!state.confirmedCharacters) {
        state.confirmedCharacters = new Set();
    }
    state.confirmedCharacters.add(characterName);

    // Add to current scene's cast list
    const sceneIndex = state.currentScene;
    if (!state.sceneBreakdowns[sceneIndex]) {
        state.sceneBreakdowns[sceneIndex] = { cast: [] };
    }
    if (!state.sceneBreakdowns[sceneIndex].cast) {
        state.sceneBreakdowns[sceneIndex].cast = [];
    }
    if (!state.sceneBreakdowns[sceneIndex].cast.includes(characterName)) {
        state.sceneBreakdowns[sceneIndex].cast.push(characterName);
    }

    // Save to localStorage
    import('./export-handlers.js').then(module => module.saveProject());

    console.log(`✓ Character "${characterName}" added to system`);
}

/**
 * Show tag popup for creating new tag
 */
export function showTagPopup() {
    if (!currentSelection) return;

    console.log('🏷️ Opening tag popup...');

    // Populate popup - use correct ID 'tag-popup' (with hyphen)
    const popup = document.getElementById('tag-popup');
    if (!popup) {
        console.error('❌ tag-popup element not found');
        return;
    }

    // FIX: Use kebab-case IDs to match HTML
    const selectedTextEl = document.getElementById('tag-selected-text');
    const categoryEl = document.getElementById('tag-category');
    const characterSelect = document.getElementById('tag-character');

    if (selectedTextEl) selectedTextEl.textContent = currentSelection.selectedText;
    if (categoryEl) categoryEl.value = 'hair'; // Default to first category

    // Reset character field
    const characterField = document.getElementById('tag-character-field');
    if (characterField) characterField.style.display = 'block'; // Show by default

    // Populate character dropdown with "+ Add New Character" option
    if (characterSelect) {
        console.log('🔄 Populating character dropdown...');
        populateCharacterDropdown(characterSelect);
        console.log('📋 Dropdown options after populate:', characterSelect.options.length);

        // Auto-select detected character if found
        if (currentSelection.detectedCharacter) {
            characterSelect.value = currentSelection.detectedCharacter;
            console.log('✓ Auto-selected character:', currentSelection.detectedCharacter);
        }
    } else {
        console.error('❌ tag-character select element not found');
    }

    // Show character field for makeup/wardrobe
    handleCategoryChange();

    // Show popup
    popup.classList.add('active');
}

/**
 * Close tag popup
 */
export function closeTagPopup() {
    const popup = document.getElementById('tag-popup');
    if (popup) popup.classList.remove('active');
    currentSelection = null;

    // Reset form - FIX: Use kebab-case IDs
    const categoryEl = document.getElementById('tag-category');
    const characterEl = document.getElementById('tag-character');

    if (categoryEl) categoryEl.value = 'hair';
    if (characterEl) characterEl.value = '';
}

/**
 * Handle category change in tag popup
 */
function handleCategoryChange() {
    // FIX: Use kebab-case IDs
    const category = document.getElementById('tag-category')?.value;
    const characterField = document.getElementById('tag-character-field');

    // Show character field for categories that need it (all except weather and extras)
    const needsCharacter = ['hair', 'makeup', 'sfx', 'wardrobe', 'injuries', 'health', 'stunts'];
    if (needsCharacter.includes(category)) {
        if (characterField) characterField.style.display = 'block';
    } else {
        if (characterField) characterField.style.display = 'none';
    }

    // Update event dropdown when category changes
    updateEventDropdown();
}

/**
 * Handle character selection change to populate event dropdown
 */
function handleCharacterChange() {
    updateEventDropdown();
}

/**
 * Update event dropdown based on selected character
 */
function updateEventDropdown() {
    const characterSelect = document.getElementById('tag-character');
    const eventField = document.getElementById('tag-event-field');
    const eventSelect = document.getElementById('tag-event');

    if (!characterSelect || !eventField || !eventSelect) return;

    const selectedCharacter = characterSelect.value;

    // Only show event dropdown if a character is selected
    if (!selectedCharacter || selectedCharacter === '__ADD_NEW__') {
        eventField.style.display = 'none';
        return;
    }

    // Get active events for this character in current scene
    const activeEvents = getActiveEventsForCharacter(selectedCharacter, state.currentScene);

    if (activeEvents.length === 0) {
        eventField.style.display = 'none';
        return;
    }

    // Populate event dropdown
    eventSelect.innerHTML = '<option value="">None</option>';
    activeEvents.forEach(event => {
        const option = document.createElement('option');
        option.value = event.id;
        option.textContent = `${event.name} (${event.category})`;
        eventSelect.appendChild(option);
    });

    eventField.style.display = 'block';
}

/**
 * Get active events for a character in a given scene
 */
function getActiveEventsForCharacter(character, sceneIndex) {
    if (!state.continuityEvents) {
        return [];
    }

    return state.continuityEvents.filter(event =>
        event.character === character &&
        event.startScene <= sceneIndex &&
        (!event.endScene || event.endScene >= sceneIndex)
    );
}

// Expose functions to window for HTML onclick handlers
window.handleCategoryChange = handleCategoryChange;
window.handleCharacterChange = handleCharacterChange;

/**
 * Link a tag to a continuity event's keyScenes array
 * @param {string} eventId - Event ID
 * @param {Object} tag - Tag object
 */
function linkTagToEvent(eventId, tag) {
    if (!state.continuityEvents) return;

    const event = state.continuityEvents.find(e => e.id === eventId);
    if (!event) {
        console.error(`❌ Event ${eventId} not found`);
        return;
    }

    // Initialize keyScenes if needed
    if (!event.keyScenes) {
        event.keyScenes = [];
    }

    // Add tag to keyScenes
    const keyScene = {
        scene: tag.sceneIndex,
        tagId: tag.id,
        scriptText: tag.fullContext || tag.selectedText,
        taggedPhrase: tag.selectedText,
        category: tag.category,
        note: '',
        timestamp: Date.now()
    };

    event.keyScenes.push(keyScene);

    // Sort keyScenes by scene
    event.keyScenes.sort((a, b) => a.scene - b.scene);

    console.log(`🔗 Linked tag to event: ${event.name} (Scene ${tag.sceneIndex + 1})`);
}

/**
 * Save tag
 */
export function saveTag() {
    if (!currentSelection || state.currentScene === null) return;

    // FIX: Use kebab-case IDs
    const categoryEl = document.getElementById('tag-category');
    const characterEl = document.getElementById('tag-character');
    const eventEl = document.getElementById('tag-event');

    if (!categoryEl || !characterEl) {
        console.error('❌ Tag form elements not found');
        return;
    }

    const category = categoryEl.value;
    let character = characterEl.value;
    const eventId = eventEl?.value || null;

    // Filter out __ADD_NEW__ if somehow it got through
    if (character === '__ADD_NEW__') {
        character = '';
    }

    // Validate: category must be selected
    if (!category) {
        alert('Please select a category');
        return;
    }

    console.log('✓ Creating new tag...');
    console.log(`  Category: ${category}`);
    console.log(`  Character: ${character || 'none'}`);
    console.log(`  Event: ${eventId || 'none'}`);
    console.log(`  Selected text: "${currentSelection.selectedText.substring(0, 50)}${currentSelection.selectedText.length > 50 ? '...' : '"'}`);

    // Create tag object
    const tag = {
        id: generateId(),
        sceneIndex: state.currentScene,
        sceneNumber: state.scenes[state.currentScene].number,
        category: category,
        selectedText: currentSelection.selectedText,
        fullContext: currentSelection.fullContext, // Full context from selection
        character: character || null,
        eventId: eventId || null, // NEW: Link to continuity event
        elementId: currentSelection.element.id || `element-${generateId()}`,
        created: Date.now()
    };

    // Ensure element has an ID
    if (!currentSelection.element.id) {
        currentSelection.element.id = tag.elementId;
    }

    // Store tag
    if (!state.scriptTags[state.currentScene]) {
        state.scriptTags[state.currentScene] = [];
    }
    state.scriptTags[state.currentScene].push(tag);
    console.log(`✓ Tag stored (Scene ${state.currentScene} now has ${state.scriptTags[state.currentScene].length} tag(s))`);

    // Link to continuity event if selected
    if (eventId) {
        linkTagToEvent(eventId, tag);
    }

    // Apply highlight
    applyHighlight(tag);

    // Add to scene breakdown
    addTagToBreakdown(tag);

    // CRITICAL: Add to character's continuity notes
    if (character && character !== '__ADD_NEW__') {
        addToCharacterContinuity(character, tag, state.currentScene);
    }

    // Re-render breakdown panel to show new continuity notes
    import('./breakdown-form.js').then(module => module.renderBreakdownPanel());

    // Save project
    import('./export-handlers.js').then(module => module.saveProject());

    closeTagPopup();
}

/**
 * Add tag to character's continuity notes
 * @param {string} characterName - Character name
 * @param {Object} tag - Tag object
 * @param {number} sceneIndex - Scene index
 */
function addToCharacterContinuity(characterName, tag, sceneIndex) {
    console.log(`📝 Adding tag to ${characterName}'s continuity in scene ${sceneIndex}`);

    // Ensure characterStates structure exists
    if (!state.characterStates[sceneIndex]) {
        state.characterStates[sceneIndex] = {};
    }
    if (!state.characterStates[sceneIndex][characterName]) {
        state.characterStates[sceneIndex][characterName] = {
            enterHair: '',
            enterMakeup: '',
            enterWardrobe: '',
            changes: '',
            exitHair: '',
            exitMakeup: '',
            exitWardrobe: ''
        };
    }

    // Add tag to changes field
    const charState = state.characterStates[sceneIndex][characterName];
    const categoryLabel = categories.find(c => c.id === tag.category)?.name || tag.category.toUpperCase();
    const tagNote = `[${categoryLabel}] ${tag.selectedText}`;

    if (charState.changes) {
        // Append to existing changes
        charState.changes += '\n' + tagNote;
    } else {
        // First change
        charState.changes = tagNote;
    }

    console.log(`✓ Added to ${characterName}'s continuity:`, tagNote);
}

/**
 * Apply highlight to tagged text
 * @param {Object} tag - Tag object
 */
export function applyHighlight(tag) {
    console.log(`🏷️  Applying tag to Scene ${tag.sceneIndex}: "${tag.selectedText.substring(0, 40)}..."`);
    let element = null;

    // MANUAL TAGS: Have elementId pointing to specific DOM element
    if (tag.elementId) {
        element = document.getElementById(tag.elementId);
        if (!element) {
            console.warn(`⚠️  Element ${tag.elementId} not found for manual tag`);
            return;
        }
        console.log(`   Found element by ID: ${tag.elementId}`);
    }
    // AI TAGS: Don't have elementId, need to search for text in the scene
    else {
        // Find the scene container
        const sceneContainer = document.querySelector(`.script-scene[data-scene-index="${tag.sceneIndex}"]`);
        if (!sceneContainer) {
            console.warn(`⚠️  Scene ${tag.sceneIndex} container not found for AI tag`);
            return;
        }
        console.log(`   Searching for text in Scene ${tag.sceneIndex} container...`);

        // Use keyword matching for AI-generated descriptions
        {
            // Extract keywords from the tag description (words longer than 3 chars)
            const keywords = tag.selectedText.toLowerCase()
                .split(/\s+/)
                .filter(word => word.length > 3 && !['that', 'with', 'from', 'this', 'have'].includes(word));

            // Search all text elements in the scene
            const textElements = sceneContainer.querySelectorAll('.script-action, .script-dialogue, .script-parenthetical');

            let bestMatch = null;
            let maxMatches = 0;

            // Find the element with the most keyword matches
            for (const el of textElements) {
                const elText = el.textContent.toLowerCase();
                let matchCount = 0;

                for (const keyword of keywords) {
                    if (elText.includes(keyword)) {
                        matchCount++;
                    }
                }

                if (matchCount > maxMatches) {
                    maxMatches = matchCount;
                    bestMatch = el;
                }
            }

            // Accept if at least one keyword matches
            if (bestMatch && maxMatches > 0) {
                element = bestMatch;
                if (!element.id) {
                    element.id = `element-${generateId()}`;
                }
                tag.elementId = element.id;
            }
        }

        if (!element) {
            console.warn(`Could not find matching element for ${tag.category} tag "${tag.selectedText.substring(0, 30)}..." in scene ${tag.sceneIndex}`);
            return;
        }
    }

    // Check if already highlighted
    if (element.innerHTML.includes(`data-tag-id="${tag.id}"`)) return;

    // Get category color
    const category = categories.find(c => c.id === tag.category);
    const color = category?.color || '#667eea';

    // Find and highlight the relevant text portion
    const text = element.innerHTML;
    const selectedText = tag.selectedText;

    // Try to find exact match first
    let highlightedHTML = null;

    // Escape special regex characters in the selected text
    const escapedText = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Try case-insensitive match
    const regex = new RegExp(`(${escapedText})`, 'i');
    if (regex.test(element.textContent)) {
        // Found exact match, highlight it
        highlightedHTML = text.replace(regex, `<span class="tag-highlight" data-tag-id="${tag.id}" data-category="${tag.category}" style="background-color: ${color}33; border-bottom: 2px solid ${color}; padding: 2px 4px; border-radius: 2px; cursor: pointer;" onclick="handleTagClick(event, '${tag.id}')" title="${tag.fullContext}">$1</span>`);
    } else {
        // No exact match - highlight the first significant keyword found
        const keywords = selectedText.toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 3 && !['that', 'with', 'from', 'this', 'have'].includes(word))
            .sort((a, b) => b.length - a.length); // Sort by length, longest first

        for (const keyword of keywords) {
            const keywordEscaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const keywordRegex = new RegExp(`\\b(${keywordEscaped}\\w*)`, 'i');

            if (keywordRegex.test(element.textContent)) {
                highlightedHTML = text.replace(keywordRegex, `<span class="tag-highlight" data-tag-id="${tag.id}" data-category="${tag.category}" style="background-color: ${color}33; border-bottom: 2px solid ${color}; padding: 2px 4px; border-radius: 2px; cursor: pointer;" onclick="handleTagClick(event, '${tag.id}')" title="${escapeHtml(tag.fullContext)} - ${escapeHtml(tag.selectedText)}">$1</span>`);
                break;
            }
        }
    }

    // If we found a match, apply it
    if (highlightedHTML) {
        element.innerHTML = highlightedHTML;
    } else {
        // Fallback: Add a subtle indicator to the entire line
        element.style.borderLeft = `3px solid ${color}`;
        element.style.paddingLeft = '8px';
        element.dataset.tagId = tag.id;
        element.dataset.category = tag.category;
        element.title = `${tag.category.toUpperCase()}: ${tag.fullContext || tag.selectedText}`;
        element.style.cursor = 'pointer';
        element.onclick = (e) => handleTagClick(e, tag.id);
    }
}

/**
 * Add tag to scene breakdown
 * @param {Object} tag - Tag object
 */
function addTagToBreakdown(tag) {
    if (!state.sceneBreakdowns[tag.sceneIndex]) {
        state.sceneBreakdowns[tag.sceneIndex] = {
            cast: [],  // Keep for character names, but not used for tagging
            hair: [],
            makeup: [],
            sfx: [],
            health: [],
            injuries: [],
            stunts: [],
            weather: [],
            wardrobe: [],
            extras: []
        };
    }

    const breakdown = state.sceneBreakdowns[tag.sceneIndex];
    const categoryKey = tag.category;

    // Only add to breakdown array if category exists and tag isn't already there
    if (breakdown[categoryKey] && !breakdown[categoryKey].includes(tag.selectedText)) {
        breakdown[categoryKey].push(tag.selectedText);
    }
}

/**
 * Render all highlights on the script
 * Called after script rendering to apply all saved tags
 */
export function renderAllHighlights() {
    console.log('🎨 Rendering all highlights...');
    console.log('📋 Script tags state:', state.scriptTags);
    console.log('📊 Total scenes with tags:', Object.keys(state.scriptTags).length);

    // Wait for script to be fully rendered
    setTimeout(() => {
        let totalHighlighted = 0;
        let totalAttempted = 0;

        Object.keys(state.scriptTags).forEach(sceneIndex => {
            const sceneTags = state.scriptTags[sceneIndex];
            console.log(`\n📄 Scene ${sceneIndex} has ${sceneTags.length} tags to apply`);

            sceneTags.forEach((tag, index) => {
                totalAttempted++;
                console.log(`  Highlight ${index + 1}/${sceneTags.length}:`);
                console.log(`    - Text: "${tag.selectedText.substring(0, 40)}..."`);
                console.log(`    - Category: ${tag.category}`);
                console.log(`    - Has elementId: ${!!tag.elementId}`);
                console.log(`    - Scene index: ${tag.sceneIndex}`);

                try {
                    applyHighlight(tag);
                    totalHighlighted++;
                    console.log(`    ✓ Highlight applied successfully`);
                } catch (error) {
                    console.error(`    ✗ Error applying highlight:`, error);
                }
            });
        });

        console.log(`\n✅ Highlight Rendering Complete:`);
        console.log(`   - Total tags attempted: ${totalAttempted}`);
        console.log(`   - Successfully highlighted: ${totalHighlighted}`);
        console.log(`   - Failed: ${totalAttempted - totalHighlighted}`);
    }, 800);
}

/**
 * Handle text selection on script
 * @param {Event} e - Mouse up event
 */
export function handleTextSelection(e) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // Don't show popup if no text selected or clicking on existing tag
    if (!selectedText || e.target.classList.contains('tag-highlight')) {
        return;
    }

    console.log('✓ Text selection detected:', selectedText.substring(0, 50) + (selectedText.length > 50 ? '...' : ''));

    // Get the full context (sentence or paragraph)
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === 3 ? container.parentElement : container;

    // Don't allow tagging scene headings
    if (element.classList.contains('script-scene-heading')) {
        alert('Cannot tag scene headings');
        return;
    }

    // CRITICAL: Detect which scene this selection is in
    const sceneIndex = detectSceneFromElement(element);
    if (sceneIndex === null) {
        console.warn('⚠️ Could not determine scene index from selection');
        alert('Could not determine which scene you are in. Please click on a scene first.');
        return;
    }

    // Set current scene so tag will be associated with correct scene
    state.currentScene = sceneIndex;
    console.log(`  Scene detected: ${sceneIndex + 1}`);

    // Capture full context
    const fullContext = element.textContent || '';

    // Detect character from context (now uses the detected scene)
    const detectedCharacter = detectCharacter(fullContext, sceneIndex);

    // Store selection data
    currentSelection = {
        selectedText: selectedText,
        fullContext: fullContext,
        detectedCharacter: detectedCharacter,
        element: element,
        range: range
    };

    console.log('  Detected character:', detectedCharacter || 'none');
    console.log('  Opening tag popup...');

    showTagPopup();
}

/**
 * Detect which scene an element belongs to by walking up the DOM tree
 * @param {HTMLElement} element - Element to start from
 * @returns {number|null} Scene index or null if not found
 */
function detectSceneFromElement(element) {
    // Walk up the DOM tree to find parent with data-scene-index
    let current = element;
    while (current && current !== document.body) {
        if (current.dataset && current.dataset.sceneIndex !== undefined) {
            return parseInt(current.dataset.sceneIndex);
        }
        current = current.parentElement;
    }

    // If not found in DOM, return current scene from state
    return state.currentScene;
}

/**
 * Detect character from context
 * @param {string} text - Context text
 * @param {number} sceneIndex - Scene index (optional, defaults to state.currentScene)
 * @returns {string|null} Detected character name
 */
function detectCharacter(text, sceneIndex = null) {
    const targetScene = sceneIndex !== null ? sceneIndex : state.currentScene;
    if (targetScene === null) return null;

    // First, try to get characters from scene breakdown
    const breakdown = state.sceneBreakdowns[targetScene];
    if (breakdown?.cast && breakdown.cast.length > 0) {
        for (const character of breakdown.cast) {
            if (text.includes(character)) {
                return character;
            }
        }
    }

    // Fallback: Look in masterContext for all characters and check if they appear in text
    if (window.masterContext?.characters) {
        const allCharacters = Object.keys(window.masterContext.characters);
        for (const character of allCharacters) {
            if (text.includes(character)) {
                return character;
            }
        }
    }

    return null;
}

/**
 * Auto-populate characters for all scenes from masterContext
 * This ensures characters are available in dropdowns even if user hasn't manually added them
 */
export function populateCharactersForAllScenes() {
    if (!window.masterContext?.characters || !state.scenes) {
        console.log('⚠️ Cannot populate characters: no masterContext or scenes');
        return;
    }

    const allCharacters = Object.keys(window.masterContext.characters);
    console.log(`🔄 Auto-populating characters for ${state.scenes.length} scenes from ${allCharacters.length} detected characters...`);

    let populatedCount = 0;

    state.scenes.forEach((scene, sceneIndex) => {
        // Get scene content
        const sceneContent = scene.content || scene.text || '';
        if (!sceneContent) return;

        // Find which characters appear in this scene
        const sceneCharacters = [];
        allCharacters.forEach(characterName => {
            // Use word boundary to avoid partial matches
            const regex = new RegExp('\\b' + characterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
            if (sceneContent.match(regex)) {
                sceneCharacters.push(characterName);
            }
        });

        // Only populate if characters were found
        if (sceneCharacters.length > 0) {
            // Ensure scene breakdown exists
            if (!state.sceneBreakdowns[sceneIndex]) {
                state.sceneBreakdowns[sceneIndex] = {};
            }

            // Set cast if not already set or if empty
            if (!state.sceneBreakdowns[sceneIndex].cast || state.sceneBreakdowns[sceneIndex].cast.length === 0) {
                state.sceneBreakdowns[sceneIndex].cast = sceneCharacters;
                populatedCount++;
                console.log(`  Scene ${sceneIndex + 1}: ${sceneCharacters.join(', ')}`);
            }
        }
    });

    console.log(`✅ Auto-populated ${populatedCount} scenes with character data`);

    // Save to localStorage
    import('./export-handlers.js').then(module => module.saveProject());
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
 * Initialize text selection handler
 */
export function initializeTagSystem() {
    // IMPORTANT: The correct element ID is 'script-content' (with hyphen)
    const scriptContent = document.getElementById('script-content');
    if (scriptContent) {
        scriptContent.addEventListener('mouseup', handleTextSelection);
        console.log('✓ Text selection event listener attached to script-content');
    } else {
        console.error('❌ script-content element not found - manual tagging will not work');
    }

    // Close popups on Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeTagPopup();
        }
    });

    // Handle category change - FIX: Use kebab-case ID
    const categoryEl = document.getElementById('tag-category');
    if (categoryEl) {
        categoryEl.addEventListener('change', handleCategoryChange);
        console.log('✓ Category change event listener attached');
    } else {
        console.error('❌ tag-category element not found');
    }
}

/**
 * Debug function to inspect tag data across all scenes
 * Call from console: debugTags()
 */
function debugTags() {
    const scenes = state.scenes || [];

    console.log('=== TAG DEBUG ===');
    console.log(`Total scenes in state: ${scenes.length}`);
    console.log(`Scenes with tags in scriptTags:`, Object.keys(state.scriptTags).length);

    // Show tag count per scene
    scenes.forEach((scene, index) => {
        const tags = state.scriptTags[index] || [];
        const sceneNum = scene.number || index + 1;

        if (tags.length > 0) {
            console.log(`\n📄 Scene ${sceneNum} (index ${index}): ${tags.length} tags`);
            tags.forEach((tag, tagIndex) => {
                console.log(`   ${tagIndex + 1}. [${tag.category}] "${tag.selectedText.substring(0, 50)}..."${tag.character ? ` (${tag.character})` : ''}`);
            });
        } else {
            console.log(`📄 Scene ${sceneNum} (index ${index}): No tags`);
        }
    });

    // Summary
    const totalTags = Object.values(state.scriptTags).reduce((sum, tags) => sum + (tags?.length || 0), 0);
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total tags across all scenes: ${totalTags}`);
    console.log(`=== END TAG DEBUG ===`);

    return {
        totalScenes: scenes.length,
        scenesWithTags: Object.keys(state.scriptTags).length,
        totalTags: totalTags
    };
}

// ============================================================================
// TAG CONTEXT MENU FUNCTIONS
// ============================================================================

/**
 * Currently selected tag for context menu operations
 */
let contextMenuTagId = null;

/**
 * Edit tag from context menu
 */
function editTagFromContext() {
    if (!contextMenuTagId) return;

    // Find the tag
    let foundTag = null;
    let foundSceneIndex = null;

    for (const [sceneIndex, tags] of Object.entries(state.scriptTags)) {
        const tag = tags.find(t => t.id === contextMenuTagId);
        if (tag) {
            foundTag = tag;
            foundSceneIndex = parseInt(sceneIndex);
            break;
        }
    }

    if (!foundTag) {
        console.warn('Tag not found:', contextMenuTagId);
        closeContextMenu();
        return;
    }

    // Show edit popup
    showTagPopup(null, foundTag, foundSceneIndex);
    closeContextMenu();
}

/**
 * Remove tag from context menu
 */
function removeTagFromContext() {
    if (!contextMenuTagId) return;

    if (!confirm('Are you sure you want to delete this tag?')) {
        closeContextMenu();
        return;
    }

    // Find and remove the tag
    for (const [sceneIndex, tags] of Object.entries(state.scriptTags)) {
        const tagIndex = tags.findIndex(t => t.id === contextMenuTagId);
        if (tagIndex !== -1) {
            tags.splice(tagIndex, 1);

            // Re-render highlights
            renderAllHighlights();

            // Save
            if (typeof saveToLocalStorage === 'function') {
                saveToLocalStorage();
            }

            console.log('Tag deleted:', contextMenuTagId);
            break;
        }
    }

    closeContextMenu();
}

/**
 * Link tag to continuity event from context menu
 */
function linkToContinuityFromContext() {
    if (!contextMenuTagId) return;

    // Find the tag
    let foundTag = null;

    for (const tags of Object.values(state.scriptTags)) {
        const tag = tags.find(t => t.id === contextMenuTagId);
        if (tag) {
            foundTag = tag;
            break;
        }
    }

    if (!foundTag) {
        closeContextMenu();
        return;
    }

    // Show continuity event linking modal (if available)
    if (window.showLinkEventModal) {
        window.showLinkEventModal(foundTag);
    } else {
        alert('Continuity event linking is not yet available for this tag.\n\nCharacter: ' + (foundTag.character || 'Unspecified'));
    }

    closeContextMenu();
}

/**
 * Jump to tags tab from context menu
 */
function jumpToTagsTab() {
    closeContextMenu();

    // Switch to tags tab if it exists
    const tagsTab = document.querySelector('[data-tab="tags"]');
    if (tagsTab) {
        tagsTab.click();
    } else {
        // Try opening tools panel with tags section
        if (window.openToolsPanel) {
            window.openToolsPanel();
        }
    }
}

/**
 * Close the context menu
 */
function closeContextMenu() {
    const menu = document.getElementById('tag-context-menu');
    if (menu) {
        menu.style.display = 'none';
    }
    contextMenuTagId = null;
}

/**
 * Show context menu for a tag
 */
function showTagContextMenu(event, tagId) {
    event.preventDefault();
    event.stopPropagation();

    contextMenuTagId = tagId;

    const menu = document.getElementById('tag-context-menu');
    if (menu) {
        menu.style.display = 'block';
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';
    }
}

// ============================================================================
// ADD ELEMENT MODAL FUNCTIONS
// ============================================================================

/**
 * Current element category being added
 */
let currentAddElementCategory = null;
let currentAddElementSceneIndex = null;

/**
 * Open add element modal
 */
function openAddElementModal(category, sceneIndex) {
    currentAddElementCategory = category;
    currentAddElementSceneIndex = sceneIndex;

    const modal = document.getElementById('addElementModal');
    const input = document.getElementById('elementInput');

    if (modal && input) {
        // Update modal title if needed
        const title = modal.querySelector('.modal-title');
        if (title) {
            title.textContent = `Add ${category.charAt(0).toUpperCase() + category.slice(1)} Element`;
        }

        input.value = '';
        input.placeholder = `Enter ${category} element...`;
        modal.style.display = 'flex';
        input.focus();
    }
}

/**
 * Close add element modal
 */
function closeAddElementModal() {
    const modal = document.getElementById('addElementModal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentAddElementCategory = null;
    currentAddElementSceneIndex = null;
}

/**
 * Confirm adding element
 */
function confirmAddElement() {
    const input = document.getElementById('elementInput');
    if (!input) return;

    const value = input.value.trim();
    if (!value) {
        alert('Please enter an element name');
        return;
    }

    const category = currentAddElementCategory;
    const sceneIndex = currentAddElementSceneIndex ?? state.currentScene;

    if (sceneIndex === null || sceneIndex === undefined) {
        alert('No scene selected');
        closeAddElementModal();
        return;
    }

    // Initialize breakdown if needed
    if (!state.sceneBreakdowns[sceneIndex]) {
        state.sceneBreakdowns[sceneIndex] = {
            cast: [],
            elements: {}
        };
    }

    if (!state.sceneBreakdowns[sceneIndex].elements) {
        state.sceneBreakdowns[sceneIndex].elements = {};
    }

    if (!state.sceneBreakdowns[sceneIndex].elements[category]) {
        state.sceneBreakdowns[sceneIndex].elements[category] = [];
    }

    // Add element if not already present
    if (!state.sceneBreakdowns[sceneIndex].elements[category].includes(value)) {
        state.sceneBreakdowns[sceneIndex].elements[category].push(value);

        // Save
        if (typeof saveToLocalStorage === 'function') {
            saveToLocalStorage();
        }

        // Re-render breakdown panel
        if (window.renderBreakdownPanel) {
            window.renderBreakdownPanel();
        }

        console.log(`Added ${category} element:`, value);
    }

    closeAddElementModal();
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.handleTagClick = handleTagClick;
window.showTagPopup = showTagPopup;
window.closeTagPopup = closeTagPopup;
window.saveTag = saveTag;
window.renderAllHighlights = renderAllHighlights;
window.handleTextSelection = handleTextSelection;
window.debugTags = debugTags;

// Tag context menu functions
window.editTagFromContext = editTagFromContext;
window.removeTagFromContext = removeTagFromContext;
window.linkToContinuityFromContext = linkToContinuityFromContext;
window.jumpToTagsTab = jumpToTagsTab;
window.showTagContextMenu = showTagContextMenu;
window.closeContextMenu = closeContextMenu;

// Add element modal functions
window.openAddElementModal = openAddElementModal;
window.closeAddElementModal = closeAddElementModal;
window.confirmAddElement = confirmAddElement;
