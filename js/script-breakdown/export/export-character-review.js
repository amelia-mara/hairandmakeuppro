/**
 * export-character-review.js
 * Character review modal functionality
 *
 * Responsibilities:
 * - Open character review modal
 * - Display detected characters for review
 * - Handle character selection and confirmation
 * - Merge selected characters
 */

import { state } from '../main.js';
import { renderCharacterTabs, renderCharacterTabPanels } from '../character-panel.js';
import { extractCharactersFromScenes, normalizeCharacterName, initializeCharacterTabs } from './export-deep-analysis.js';
import { saveProject } from './export-project.js';

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

/**
 * Open character review modal to review and edit detected characters
 */
export function reviewCharacters() {
    if (!state.scenes || state.scenes.length === 0) {
        alert('Please import a script first');
        return;
    }

    console.log('Detect & Review Characters - Starting intelligent character detection...');

    // Run character detection
    let detectedChars = extractCharactersFromScenes();

    console.log(`Screenplay parsing found ${detectedChars.length} characters`);

    // FALLBACK: If no characters detected from screenplay parsing, extract from auto-tag results
    if (detectedChars.length === 0 && state.sceneBreakdowns) {
        console.log('No characters found via screenplay parsing - extracting from scene breakdowns...');
        detectedChars = extractCharactersFromBreakdowns();
        console.log(`Extracted ${detectedChars.length} characters from scene breakdowns`);
    }

    // Store detected characters in state
    state.detectedCharacters = detectedChars.map(c => c.primaryName);

    // Store full character data globally for merge functionality
    window.detectedCharacterData = detectedChars;

    console.log(`Final character count: ${detectedChars.length} unique characters`);

    const modal = document.getElementById('character-review-modal');
    const reviewList = document.getElementById('character-review-list');

    if (!modal || !reviewList) {
        console.error('Character review modal elements not found');
        return;
    }

    if (detectedChars.length === 0) {
        reviewList.innerHTML = `
            <div style="padding: 24px; text-align: center; color: var(--text-muted);">
                <p style="font-size: 1.1em; font-weight: 600; margin-bottom: 16px;">No characters detected</p>

                <p style="margin-bottom: 16px;">
                    Character detection works in two ways:
                </p>

                <div style="text-align: left; max-width: 500px; margin: 0 auto;">
                    <div style="background: rgba(212, 175, 122, 0.1); padding: 12px; border-radius: 6px; margin-bottom: 12px;">
                        <strong style="color: var(--accent-gold);">Method 1: Screenplay Parsing</strong>
                        <div style="font-size: 0.875em; margin-top: 6px;">
                            Requires proper screenplay formatting:
                            <br>- Character names in ALL CAPS
                            <br>- Character names indented/centered
                            <br>- Dialogue following character names
                        </div>
                    </div>

                    <div style="background: rgba(212, 175, 122, 0.1); padding: 12px; border-radius: 6px;">
                        <strong style="color: var(--accent-gold);">Method 2: Auto-Tag Results</strong>
                        <div style="font-size: 0.875em; margin-top: 6px;">
                            Uses characters identified by AI during Auto-Tag
                            <br>- Run "Auto Tag Script" first
                            <br>- Then run "Detect & Review Characters"
                        </div>
                    </div>
                </div>

                <p style="margin-top: 20px; font-size: 0.875em; color: var(--text-muted);">
                    <strong>Tip:</strong> If your script doesn't use standard formatting,
                    <br>run "Auto Tag Script" first, then try character detection again.
                </p>
            </div>
        `;
    } else {
        reviewList.innerHTML = detectedChars.map((char, index) => {
            let confidenceLabel = '';
            let confidenceColor = '';
            if (char.dialogueCount >= 5) {
                confidenceLabel = 'High confidence';
                confidenceColor = '#10b981';
            } else if (char.dialogueCount >= 3) {
                confidenceLabel = 'Medium confidence';
                confidenceColor = '#f59e0b';
            } else {
                confidenceLabel = 'Low confidence';
                confidenceColor = '#6b7280';
            }

            const uniqueAliases = [...new Set(char.aliases)]
                .filter(a => a !== char.primaryName && a.toUpperCase() !== char.primaryName.toUpperCase())
                .slice(0, 3);

            const aliasesHtml = uniqueAliases.length > 0
                ? `<div style="font-size: 0.75em; color: var(--text-muted); margin-top: 2px;">
                       Also appears as: ${uniqueAliases.join(', ')}
                   </div>`
                : '';

            const isChecked = char.dialogueCount >= 3 ? 'checked' : '';

            return `
                <div class="character-review-item" style="padding: 12px; border-bottom: 1px solid var(--border-light);">
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <input type="checkbox" ${isChecked} id="char-review-${index}" data-character="${char.primaryName}" data-index="${index}" style="width: 18px; height: 18px; cursor: pointer; margin-top: 2px;">
                        <div style="flex: 1;">
                            <label for="char-review-${index}" style="font-weight: 600; color: var(--text-primary); cursor: pointer; display: block;">
                                ${char.primaryName}
                            </label>
                            ${aliasesHtml}
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.875em; color: var(--text-muted); padding: 4px 8px; background: var(--bg-dark); border-radius: 4px; margin-bottom: 4px;">
                                ${char.dialogueCount} dialogue${char.dialogueCount !== 1 ? 's' : ''}
                            </div>
                            <div style="font-size: 0.75em; color: ${confidenceColor}; font-weight: 600;">
                                ${confidenceLabel}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    modal.style.display = 'flex';
    console.log('Character review modal opened with enhanced data');
}

/**
 * Close character review modal
 */
export function closeCharacterReviewModal() {
    const modal = document.getElementById('character-review-modal');
    if (modal) modal.style.display = 'none';
}

/**
 * Select all characters in review modal
 */
export function selectAllCharacters() {
    const checkboxes = document.querySelectorAll('#character-review-list input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
}

/**
 * Deselect all characters in review modal
 */
export function deselectAllCharacters() {
    const checkboxes = document.querySelectorAll('#character-review-list input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
}

/**
 * Confirm character selection and update character tabs
 */
export function confirmCharacterSelection() {
    const checkboxes = document.querySelectorAll('#character-review-list input[type="checkbox"]');
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

    // Store confirmed characters in state
    state.confirmedCharacters = selectedCharacters;
    state.characters = selectedCharacters;

    console.log('Confirmed characters saved to state.confirmedCharacters:', Array.from(state.confirmedCharacters));

    // Re-initialize character tabs with confirmed characters
    initializeCharacterTabs();

    // Re-render character tabs and panels
    renderCharacterTabs();
    renderCharacterTabPanels();

    // Save project
    saveProject();

    // Close modal
    closeCharacterReviewModal();

    console.log(`Character tabs generated for ${selectedCharacters.size} characters`);
    alert(`${selectedCharacters.size} character${selectedCharacters.size !== 1 ? 's' : ''} confirmed!\n\nCharacter tabs created. You can now run "Auto Tag Script" to detect production elements.`);
}

/**
 * Merge selected characters in the review modal
 */
export function mergeSelectedCharacters() {
    const checkboxes = document.querySelectorAll('#character-review-list input[type="checkbox"]:checked');

    if (checkboxes.length < 2) {
        alert('Please select at least 2 characters to merge');
        return;
    }

    const indices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
    const characters = indices.map(i => window.detectedCharacterData[i]);

    const names = characters.map(c => c.primaryName).join('\n');
    const primaryName = prompt(`Select primary name for merged character:\n\n${names}\n\nEnter the name to use:`);

    if (!primaryName || !primaryName.trim()) {
        return;
    }

    const merged = {
        primaryName: primaryName.trim(),
        aliases: [...new Set(characters.flatMap(c => c.aliases))],
        firstScene: Math.min(...characters.map(c => c.firstScene)),
        sceneAppearances: [...new Set(characters.flatMap(c => c.sceneAppearances))].sort((a,b) => a-b),
        dialogueCount: characters.reduce((sum, c) => sum + c.dialogueCount, 0),
        isConfirmed: false
    };

    console.log(`Merging ${characters.length} characters into "${primaryName}"`);
    console.log(`  Combined ${merged.dialogueCount} dialogue lines`);
    console.log(`  Appears in ${merged.sceneAppearances.length} scenes`);

    window.detectedCharacterData = window.detectedCharacterData.filter((c, i) => !indices.includes(i));
    window.detectedCharacterData.push(merged);
    window.detectedCharacterData.sort((a, b) => b.dialogueCount - a.dialogueCount);

    // Refresh modal
    reviewCharacters();
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.reviewCharacters = reviewCharacters;
window.closeCharacterReviewModal = closeCharacterReviewModal;
window.selectAllCharacters = selectAllCharacters;
window.deselectAllCharacters = deselectAllCharacters;
window.confirmCharacterSelection = confirmCharacterSelection;
window.mergeSelectedCharacters = mergeSelectedCharacters;

export default {
    reviewCharacters,
    closeCharacterReviewModal,
    selectAllCharacters,
    deselectAllCharacters,
    confirmCharacterSelection,
    mergeSelectedCharacters
};
