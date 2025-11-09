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
    let element = null;

    // MANUAL TAGS: Have elementId pointing to specific DOM element
    if (tag.elementId) {
        element = document.getElementById(tag.elementId);
        if (!element) {
            console.warn(`Element ${tag.elementId} not found for manual tag`);
            return;
        }
    }
    // AI TAGS: Don't have elementId, need to search for text in the scene
    else {
        // Find the scene container
        const sceneContainer = document.querySelector(`.script-scene[data-scene-index="${tag.sceneIndex}"]`);
        if (!sceneContainer) {
            console.warn(`Scene ${tag.sceneIndex} container not found for AI tag`);
            return;
        }

        // CAST TAGS: Search in character name elements first
        if (tag.category === 'cast') {
            // First try to find exact match in character elements
            const characterElements = sceneContainer.querySelectorAll('.script-character');
            for (const el of characterElements) {
                const charName = el.textContent.trim().toUpperCase();
                const searchName = tag.selectedText.trim().toUpperCase();

                // Exact match or contains (for character names with extensions like "JOHN (V.O.)")
                if (charName === searchName || charName.includes(searchName)) {
                    element = el;
                    if (!el.id) {
                        el.id = `element-${generateId()}`;
                    }
                    tag.elementId = el.id;
                    break;
                }
            }

            // If not found in character elements, try dialogue and action
            if (!element) {
                const textElements = sceneContainer.querySelectorAll('.script-dialogue, .script-action');
                for (const el of textElements) {
                    if (el.textContent.includes(tag.selectedText)) {
                        element = el;
                        if (!el.id) {
                            el.id = `element-${generateId()}`;
                        }
                        tag.elementId = el.id;
                        break;
                    }
                }
            }
        }
        // OTHER TAGS: Use keyword matching for AI-generated descriptions
        else {
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

    // For CAST tags, try to highlight just the character name
    if (tag.category === 'cast' && element.classList.contains('script-character')) {
        const charName = element.textContent.trim();
        const searchName = tag.selectedText.trim();

        // Highlight the character name portion
        const highlightedText = `<span class="tag-highlight" data-tag-id="${tag.id}" data-category="${tag.category}" style="background-color: ${color}33; border-bottom: 2px solid ${color}; padding: 2px 4px; border-radius: 2px;" onclick="handleTagClick(event, '${tag.id}')" title="${tag.fullContext}">${charName}</span>`;

        element.innerHTML = highlightedText;
    }
    // For OTHER tags, find and highlight the relevant text portion
    else {
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
            highlightedHTML = text.replace(regex, `<span class="tag-highlight" data-tag-id="${tag.id}" data-category="${tag.category}" style="background-color: ${color}33; border-bottom: 2px solid ${color}; padding: 2px 4px; border-radius: 2px;" onclick="handleTagClick(event, '${tag.id}')" title="${tag.fullContext}">$1</span>`);
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
                    highlightedHTML = text.replace(keywordRegex, `<span class="tag-highlight" data-tag-id="${tag.id}" data-category="${tag.category}" style="background-color: ${color}33; border-bottom: 2px solid ${color}; padding: 2px 4px; border-radius: 2px;" onclick="handleTagClick(event, '${tag.id}')" title="${escapeHtml(tag.fullContext)} - ${escapeHtml(tag.selectedText)}">$1</span>`);
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
