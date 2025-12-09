/**
 * script-display.js
 * Script rendering and viewer controls
 *
 * Responsibilities:
 * - Render script content with scene headings
 * - Handle zoom controls (in/out)
 * - Apply tag highlights to script text
 * - Scroll to specific scenes
 * - Format script elements (action, dialogue, parenthetical, etc.)
 */

import { state } from './main.js';

// ============================================================================
// SCRIPT RENDERING
// ============================================================================

/**
 * Render the full script with formatted elements
 * Displays script text with proper formatting for scene headings, dialogue, action lines, etc.
 */
export function renderScript() {
    const scriptText = state.currentProject?.scriptContent || '';

    if (!scriptText) {
        const container = document.getElementById('script-content');
        if (container) {
            container.innerHTML = '<div class="empty-state"><div class="empty-title">No Script Loaded</div><div class="empty-desc">Import your screenplay to begin</div></div>';
        }
        return;
    }

    const container = document.getElementById('script-content');
    if (!container) {
        console.error('Script container element not found');
        return;
    }

    const lines = scriptText.split('\n');
    let html = '';
    let inScene = false;
    let sceneIdx = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Check if this line is a scene heading
        const isSceneHeading = state.scenes.some(s => s.lineNumber === i);

        if (isSceneHeading) {
            if (inScene) html += '</div>';

            const scene = state.scenes[sceneIdx];
            html += `<div class="script-scene" id="scene-${scene.number}" data-scene-index="${sceneIdx}">`;
            html += `<div class="scene-header-wrapper" onclick="selectScene(${sceneIdx})" style="cursor: pointer;">`;
            html += `<span class="scene-number-badge">Scene ${scene.number}</span>`;
            html += `<div class="script-scene-heading">${escapeHtml(trimmed)}</div>`;
            html += `</div>`;

            inScene = true;
            sceneIdx++;
        } else if (trimmed) {
            // Detect line type and apply appropriate formatting
            const lineType = detectLineType(trimmed, i, lines);
            html += formatScriptLine(trimmed, lineType, i);
        }
    }

    if (inScene) html += '</div>';
    container.innerHTML = html;

    // DIAGNOSTIC: Log script rendering
    console.log('✓ Script rendered with', sceneIdx, 'scenes');

    // Reapply highlights after rendering
    import('./tag-system.js').then(module => {
        if (module.renderAllHighlights) {
            console.log('✓ Calling renderAllHighlights after script render');
            module.renderAllHighlights();
        }
    });

    // Highlight character names (MUST happen first, before descriptions)
    highlightCharacterNames();

    // Highlight character descriptions
    highlightCharacterDescriptions();

    // Highlight continuity references
    highlightContinuityReferences();
}

/**
 * Highlight character descriptions in the script based on master context
 * Uses both scriptDescriptions per character AND descriptionTags from Phase 5 analysis
 */
export function highlightCharacterDescriptions() {
    // Check both sources for master context
    const masterContext = window.scriptMasterContext || window.masterContext;
    if (!masterContext) {
        console.log('⚠️ No master context for description highlighting');
        return;
    }

    const scriptContent = document.getElementById('script-content');
    if (!scriptContent) {
        return;
    }

    // Collect all character descriptions from multiple sources
    const descriptions = [];

    // Source 1: scriptDescriptions from each character
    if (masterContext.characters) {
        Object.entries(masterContext.characters).forEach(([characterName, data]) => {
            if (data.scriptDescriptions && Array.isArray(data.scriptDescriptions)) {
                data.scriptDescriptions.forEach(desc => {
                    if (desc.text && desc.text.length > 10) { // Skip very short descriptions
                        descriptions.push({
                            text: desc.text,
                            character: characterName,
                            sceneNumber: desc.sceneNumber,
                            type: desc.type || 'description',
                            category: desc.category || 'physical'
                        });
                    }
                });
            }
        });
    }

    // Source 2: descriptionTags from Phase 5 analysis
    if (masterContext.descriptionTags && Array.isArray(masterContext.descriptionTags)) {
        masterContext.descriptionTags.forEach(tag => {
            if (tag.quote && tag.quote.length > 10) {
                // Avoid duplicates
                const isDuplicate = descriptions.some(d =>
                    d.text === tag.quote && d.character === tag.character
                );
                if (!isDuplicate) {
                    descriptions.push({
                        text: tag.quote,
                        character: tag.character,
                        sceneNumber: tag.scene,
                        type: tag.category || 'description',
                        category: tag.category || 'appearance'
                    });
                }
            }
        });
    }

    if (descriptions.length === 0) {
        console.log('⚠️ No descriptions found to highlight');
        return;
    }

    // Sort by length (longest first) to avoid partial matches
    descriptions.sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0));

    // Get current HTML
    let html = scriptContent.innerHTML;
    let highlightCount = 0;

    // Category-based colors
    const categoryColors = {
        physical_appearance: '#FFD70033', // Gold
        physical: '#FFD70033',
        hair: '#E6E6FA33', // Lavender
        wardrobe: '#98FB9833', // Pale green
        injury: '#FF634733', // Coral
        condition: '#87CEEB33', // Sky blue
        age: '#DDA0DD33', // Plum
        introduction: '#FFD70033',
        description: '#F5F5DC33' // Beige (default)
    };

    // Highlight each description
    descriptions.forEach(desc => {
        if (!desc.text) return;

        try {
            const escapedText = escapeHtml(desc.text);
            // Create a regex that's more flexible with whitespace
            const flexibleText = escapeRegex(escapedText).replace(/\s+/g, '\\s+');
            const regex = new RegExp(flexibleText, 'gi');

            const color = categoryColors[desc.category] || categoryColors[desc.type] || categoryColors.description;
            const categoryLabel = (desc.category || desc.type || 'description').replace(/_/g, ' ');

            const highlighted = `<span class="character-description" data-character="${escapeHtml(desc.character)}" data-scene="${desc.sceneNumber}" data-category="${desc.category || desc.type}" style="background-color: ${color}; border-bottom: 2px solid var(--accent-gold);" title="${escapeHtml(desc.character)} - ${categoryLabel}">$&</span>`;

            const newHtml = html.replace(regex, highlighted);
            if (newHtml !== html) {
                html = newHtml;
                highlightCount++;
            }
        } catch (e) {
            console.warn('Failed to highlight description:', desc.text?.substring(0, 50), e);
        }
    });

    scriptContent.innerHTML = html;

    console.log(`✓ Highlighted ${highlightCount} character descriptions (from ${descriptions.length} found)`);
}

/**
 * Highlight continuity-related text in script display
 * Adds visual highlighting to dialogue and action lines that reference appearance
 */
export function highlightContinuityReferences() {
    const analysis = window.scriptMasterContext || window.masterContext;
    if (!analysis) return;

    const scriptContent = document.getElementById('script-content');
    if (!scriptContent) return;

    // Get all scene elements
    const scenes = scriptContent.querySelectorAll('.script-scene');

    scenes.forEach((sceneElement, index) => {
        // Highlight dialogue about appearance
        if (analysis.dialogueReferences?.[`scene_${index}`]) {
            const ref = analysis.dialogueReferences[`scene_${index}`];
            if (ref.line) {
                highlightTextInElement(sceneElement, ref.line, 'dialogue-appearance', {
                    character: ref.character || '',
                    note: ref.implication || 'Appearance reference'
                });
            }
        }

        // Highlight action line cues
        if (analysis.actionLineCues?.[`scene_${index}`]) {
            const cue = analysis.actionLineCues[`scene_${index}`];
            if (cue.cue) {
                highlightTextInElement(sceneElement, cue.cue, 'action-cue', {
                    character: cue.character || '',
                    note: cue.visualNotes || 'Visual cue'
                });
            }
        }

        // Highlight character descriptions (additional to what's already done)
        if (analysis.characters) {
            Object.entries(analysis.characters).forEach(([charName, data]) => {
                if (data.scriptDescriptions && Array.isArray(data.scriptDescriptions)) {
                    data.scriptDescriptions.forEach(desc => {
                        if (desc.sceneNumber === index + 1 && desc.text) {
                            highlightTextInElement(sceneElement, desc.text, 'character-description', {
                                character: charName,
                                note: 'Character introduction'
                            });
                        }
                    });
                }
            });
        }
    });

    console.log('✓ Highlighted continuity references');
}

/**
 * Highlight all character names in the script
 * Characters are highlighted with yellow background and gold underline
 * This is called automatically after script rendering
 */
export function highlightCharacterNames() {
    // Get characters from various sources (checking all for compatibility)
    let characters = new Set();

    // Primary source: masterContext from AI analysis
    if (window.masterContext?.characters) {
        Object.keys(window.masterContext.characters).forEach(char => characters.add(char));
    }

    // Secondary source: scriptMasterContext
    if (window.scriptMasterContext?.characters) {
        Object.keys(window.scriptMasterContext.characters).forEach(char => characters.add(char));
    }

    // Tertiary source: window.confirmedCharacters
    if (window.confirmedCharacters && window.confirmedCharacters.size > 0) {
        window.confirmedCharacters.forEach(char => characters.add(char));
    }

    // Quaternary source: state.confirmedCharacters
    if (state.confirmedCharacters && state.confirmedCharacters.size > 0) {
        state.confirmedCharacters.forEach(char => characters.add(char));
    }

    // Fifth source: Extract from scene breakdowns
    if (state.sceneBreakdowns) {
        Object.values(state.sceneBreakdowns).forEach(breakdown => {
            if (breakdown.cast && Array.isArray(breakdown.cast)) {
                breakdown.cast.forEach(char => characters.add(char));
            }
        });
    }

    // Convert Set to Array
    characters = Array.from(characters);

    if (characters.length === 0) {
        console.log('⚠️ No characters found to highlight');
        return;
    }

    const scriptContent = document.getElementById('script-content');
    if (!scriptContent) {
        console.log('⚠️ Script content element not found');
        return;
    }

    // Get current HTML
    let html = scriptContent.innerHTML;

    // Sort characters by length (longest first) to avoid partial matches
    const sortedCharacters = [...characters].sort((a, b) => b.length - a.length);

    // Highlight each character name
    sortedCharacters.forEach(characterName => {
        // Escape special regex characters
        const escapedName = characterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Create regex that matches the character name as a whole word
        // Use negative lookahead to avoid matching text already inside HTML tags
        const regex = new RegExp(`\\b(${escapedName})\\b(?![^<]*>|[^<]*<\/span>)`, 'gi');

        // Replace with highlighted version
        // Using inline styles to ensure highlighting works
        html = html.replace(regex,
            '<span class="character-name-highlight" style="background-color: rgba(251, 191, 36, 0.3); border-bottom: 2px solid #fbbf24; cursor: pointer;" title="Character: $1">$1</span>'
        );
    });

    // Update the display
    scriptContent.innerHTML = html;

    console.log(`✅ Highlighted ${characters.length} character names:`, characters.join(', '));
}

/**
 * Highlight specific text within an element
 * @param {HTMLElement} element - Container element to search within
 * @param {string} searchText - Text to highlight
 * @param {string} className - CSS class to apply to highlight
 * @param {Object} data - Data attributes to add to highlight span
 */
function highlightTextInElement(element, searchText, className, data) {
    if (!searchText || !element) return;

    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    const nodesToProcess = [];
    let node;
    while (node = walker.nextNode()) {
        if (node.nodeValue && node.nodeValue.includes(searchText)) {
            // Don't highlight if already inside a highlighted element
            let parent = node.parentNode;
            let alreadyHighlighted = false;
            while (parent && parent !== element) {
                if (parent.classList && (parent.classList.contains('highlighted') || parent.classList.contains('character-description'))) {
                    alreadyHighlighted = true;
                    break;
                }
                parent = parent.parentNode;
            }
            if (!alreadyHighlighted) {
                nodesToProcess.push(node);
            }
        }
    }

    // Process nodes (done separately to avoid walker issues during DOM modification)
    nodesToProcess.forEach(node => {
        const span = document.createElement('span');
        span.className = `highlighted ${className}`;
        if (data.character) span.setAttribute('data-character', data.character);
        if (data.note) span.setAttribute('data-note', data.note);
        span.textContent = searchText;

        // Add hover tooltip
        if (data.note) span.setAttribute('title', data.note);

        const parent = node.parentNode;
        const text = node.nodeValue;
        const index = text.indexOf(searchText);

        // Split the text node
        const before = document.createTextNode(text.substring(0, index));
        const after = document.createTextNode(text.substring(index + searchText.length));

        parent.replaceChild(after, node);
        parent.insertBefore(span, after);
        parent.insertBefore(before, span);
    });
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect the type of script line (character, dialogue, action, etc.)
 */
function detectLineType(line, index, lines) {
    // Character name (all caps, short, followed by dialogue)
    if (line === line.toUpperCase() && line.length < 30 && !line.includes('.')) {
        const nextLine = lines[index + 1] ? lines[index + 1].trim() : '';
        if (nextLine && nextLine !== nextLine.toUpperCase()) {
            return 'character';
        }
    }

    // Parenthetical (wrapped in parentheses)
    if (line.startsWith('(') && line.endsWith(')')) {
        return 'parenthetical';
    }

    // Transition (contains CUT TO, FADE, etc.)
    if (line.includes('CUT TO:') || line.includes('FADE') || line.includes('DISSOLVE')) {
        return 'transition';
    }

    // Dialogue (follows character name)
    const prevLine = index > 0 ? lines[index - 1].trim() : '';
    if (prevLine === prevLine.toUpperCase() && prevLine.length < 30) {
        return 'dialogue';
    }

    // Default to action
    return 'action';
}

/**
 * Format a script line based on its type
 */
function formatScriptLine(text, type, lineIndex) {
    const elementId = `line-${lineIndex}`;
    const className = `script-${type}`;

    return `<div class="${className}" id="${elementId}">${escapeHtml(text)}</div>`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// ZOOM CONTROLS
// ============================================================================

/**
 * Zoom in (increase font size)
 */
export function zoomIn() {
    const el = document.querySelector('.script-content');
    if (!el) return;

    const currentSize = parseFloat(window.getComputedStyle(el).fontSize);
    const newSize = currentSize * 1.1;

    // Limit maximum zoom
    if (newSize > 24) return;

    el.style.fontSize = newSize + 'px';
}

/**
 * Zoom out (decrease font size)
 */
export function zoomOut() {
    const el = document.querySelector('.script-content');
    if (!el) return;

    const currentSize = parseFloat(window.getComputedStyle(el).fontSize);
    const newSize = currentSize * 0.9;

    // Limit minimum zoom
    if (newSize < 10) return;

    el.style.fontSize = newSize + 'px';
}

// ============================================================================
// NAVIGATION
// ============================================================================

/**
 * Scroll script viewer to specific scene
 * @param {number} index - Scene index to scroll to
 */
export function scrollToScene(index) {
    if (index < 0 || index >= state.scenes.length) return;

    const sceneElement = document.querySelector(`.script-scene[data-scene-index="${index}"]`);
    if (sceneElement) {
        sceneElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

// Make functions available globally for HTML onclick handlers (legacy support)
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.scrollToScene = scrollToScene;
window.highlightCharacterDescriptions = highlightCharacterDescriptions;
window.highlightCharacterNames = highlightCharacterNames;
