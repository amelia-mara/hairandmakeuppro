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

// Element categories for tagging
const categories = [
    { id: 'cast', name: 'Cast Members', color: '#fbbf24' },
    { id: 'hair', name: 'Hair', color: '#a855f7' },
    { id: 'makeup', name: 'Makeup (Beauty)', color: '#ec4899' },
    { id: 'sfx', name: 'SFX Makeup', color: '#ef4444' },
    { id: 'health', name: 'Health/Illness', color: '#f59e0b' },
    { id: 'injuries', name: 'Injuries/Wounds', color: '#dc2626' },
    { id: 'stunts', name: 'Stunts/Action', color: '#f97316' },
    { id: 'weather', name: 'Weather Effects', color: '#38bdf8' },
    { id: 'wardrobe', name: 'Costume/Wardrobe', color: '#34d399' },
    { id: 'extras', name: 'Supporting Artists', color: '#9ca3af' }
];

// Current text selection
let currentSelection = null;

/**
 * Handle clicking on a highlighted tag
 * @param {Event} event - Click event
 * @param {string} tagId - Tag ID
 */
export function handleTagClick(event, tagId) {
    event.stopPropagation();

    // Find the tag
    let tag = null;
    for (let sceneIndex in state.scriptTags) {
        const found = state.scriptTags[sceneIndex].find(t => t.id.toString() === tagId || t.id === tagId);
        if (found) {
            tag = found;
            break;
        }
    }

    if (!tag) return;

    // If it's a cast member, open their character tab
    if (tag.category === 'cast' && tag.character) {
        import('./character-panel.js').then(module => {
            module.switchCenterTab(`character-${tag.character}`);
        });
    } else {
        // For other tags, show the tag info
        showTagInfo(tag);
    }
}

/**
 * Show tag information in a tooltip
 * @param {Object} tag - Tag object
 */
function showTagInfo(tag) {
    const existing = document.getElementById('tagTooltip');
    if (existing) existing.remove();

    const tooltip = document.createElement('div');
    tooltip.id = 'tagTooltip';
    tooltip.className = 'tag-tooltip';
    tooltip.innerHTML = `
        <div class="tooltip-header">
            <span class="tooltip-category">${tag.category.toUpperCase()}</span>
            ${tag.character ? `<span class="tooltip-character">→ ${escapeHtml(tag.character)}</span>` : ''}
        </div>
        <div class="tooltip-text">${escapeHtml(tag.selectedText)}</div>
        <div class="tooltip-context">${escapeHtml(tag.fullContext)}</div>
        <div class="tooltip-actions">
            <button onclick="document.getElementById('tagTooltip').remove()">Close</button>
        </div>
    `;

    document.body.appendChild(tooltip);

    // Position near cursor
    const highlight = document.querySelector(`[data-tag-id="${tag.id}"]`);
    if (highlight) {
        const rect = highlight.getBoundingClientRect();
        tooltip.style.position = 'fixed';
        tooltip.style.left = rect.left + 'px';
        tooltip.style.top = (rect.bottom + 10) + 'px';
        tooltip.style.zIndex = '3000';
    }

    // Auto-close after 5 seconds
    setTimeout(() => {
        if (document.getElementById('tagTooltip')) {
            document.getElementById('tagTooltip').remove();
        }
    }, 5000);
}

/**
 * Show tag popup for creating new tag
 */
export function showTagPopup() {
    if (!currentSelection) return;

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
    if (categoryEl) categoryEl.value = 'cast'; // Default to cast

    // Reset character field
    const characterField = document.getElementById('tag-character-field');
    if (characterField) characterField.style.display = 'block'; // Show by default for cast

    // Populate character dropdown
    if (characterSelect) {
        characterSelect.innerHTML = '<option value="">-- Select Character --</option>';

        // Add current scene cast if available
        if (state.currentScene !== null && state.sceneBreakdowns[state.currentScene]?.cast) {
            state.sceneBreakdowns[state.currentScene].cast.forEach(castMember => {
                const option = document.createElement('option');
                option.value = castMember;
                option.textContent = castMember;
                if (castMember === currentSelection.detectedCharacter) {
                    option.selected = true;
                }
                characterSelect.appendChild(option);
            });
        }
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

    if (categoryEl) categoryEl.value = 'cast';
    if (characterEl) characterEl.value = '';
}

/**
 * Handle category change in tag popup
 */
function handleCategoryChange() {
    // FIX: Use kebab-case IDs
    const category = document.getElementById('tag-category')?.value;
    const characterField = document.getElementById('tag-character-field');

    // Show character field for categories that need it
    const needsCharacter = ['cast', 'hair', 'makeup', 'sfx', 'wardrobe', 'injuries', 'health', 'stunts'];
    if (needsCharacter.includes(category)) {
        if (characterField) characterField.style.display = 'block';
    } else {
        if (characterField) characterField.style.display = 'none';
    }
}

// Expose handleCategoryChange to window for HTML onclick
window.handleCategoryChange = handleCategoryChange;

/**
 * Save tag
 */
export function saveTag() {
    if (!currentSelection || state.currentScene === null) return;

    // FIX: Use kebab-case IDs
    const categoryEl = document.getElementById('tag-category');
    const characterEl = document.getElementById('tag-character');

    if (!categoryEl || !characterEl) {
        console.error('❌ Tag form elements not found');
        return;
    }

    const category = categoryEl.value;
    const character = characterEl.value;

    // Validate: certain categories must have character
    const needsCharacter = ['cast', 'hair', 'makeup', 'sfx', 'wardrobe'];
    if (needsCharacter.includes(category) && !character) {
        alert(`Please select a character for ${category} tags`);
        return;
    }

    console.log('✓ Creating new tag...');
    console.log(`  Category: ${category}`);
    console.log(`  Character: ${character || 'none'}`);
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

    // Apply highlight
    applyHighlight(tag);

    // Add to scene breakdown
    addTagToBreakdown(tag);

    // Re-render breakdown panel
    import('./breakdown-form.js').then(module => module.renderBreakdownPanel());

    // Save project
    import('./export-handlers.js').then(module => module.saveProject());

    closeTagPopup();
}

/**
 * Apply highlight to tagged text
 * @param {Object} tag - Tag object
 */
export function applyHighlight(tag) {
    // Find the element and highlight the text
    const element = document.getElementById(tag.elementId);
    if (!element) return;

    // Find and wrap the selected text
    const text = element.innerHTML;
    const selectedText = tag.selectedText;

    // Check if already highlighted
    if (text.includes(`data-tag-id="${tag.id}"`)) return;

    // Escape special regex characters in the selected text
    const escapedText = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Get category color
    const category = categories.find(c => c.id === tag.category);
    const color = category?.color || '#667eea';

    // Wrap the text
    const highlightedText = `<span class="tag-highlight" data-tag-id="${tag.id}" data-category="${tag.category}" style="background-color: ${color}33; border-bottom: 2px solid ${color};" onclick="handleTagClick(event, '${tag.id}')">${selectedText}</span>`;

    const newText = text.replace(new RegExp(escapedText, 'i'), highlightedText);
    element.innerHTML = newText;
}

/**
 * Add tag to scene breakdown
 * @param {Object} tag - Tag object
 */
function addTagToBreakdown(tag) {
    if (!state.sceneBreakdowns[tag.sceneIndex]) {
        state.sceneBreakdowns[tag.sceneIndex] = {
            cast: [],
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

    if (breakdown[categoryKey] && !breakdown[categoryKey].includes(tag.selectedText)) {
        breakdown[categoryKey].push(tag.selectedText);
    }
}

/**
 * Render all highlights on the script
 * Called after script rendering to apply all saved tags
 */
export function renderAllHighlights() {
    console.log('Rendering all highlights...');
    console.log('Script tags:', state.scriptTags);

    // Wait for script to be fully rendered
    setTimeout(() => {
        let totalHighlighted = 0;

        Object.keys(state.scriptTags).forEach(sceneIndex => {
            const sceneTags = state.scriptTags[sceneIndex];
            console.log(`Scene ${sceneIndex} has ${sceneTags.length} tags`);

            sceneTags.forEach((tag, index) => {
                console.log(`Applying highlight ${index + 1}:`, tag.selectedText);
                applyHighlight(tag);
                totalHighlighted++;
            });
        });

        console.log(`✓ Applied ${totalHighlighted} highlights`);
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

    // Capture full context
    const fullContext = element.textContent || '';

    // Detect character from context
    const detectedCharacter = detectCharacter(fullContext);

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
 * Detect character from context
 * @param {string} text - Context text
 * @returns {string|null} Detected character name
 */
function detectCharacter(text) {
    if (!state.currentScene) return null;

    const breakdown = state.sceneBreakdowns[state.currentScene];
    if (!breakdown || !breakdown.cast) return null;

    // Look for character names in the context
    for (const character of breakdown.cast) {
        if (text.includes(character)) {
            return character;
        }
    }

    return null;
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

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.handleTagClick = handleTagClick;
window.showTagPopup = showTagPopup;
window.closeTagPopup = closeTagPopup;
window.saveTag = saveTag;
window.renderAllHighlights = renderAllHighlights;
window.handleTextSelection = handleTextSelection;
