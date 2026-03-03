/**
 * export-character-review.js
 * Character review functionality - For reviewing/modifying character selections AFTER initial detection
 *
 * This is NOT for initial detection - that happens automatically after script import.
 * This is for when the user wants to revisit their merge/selection decisions later.
 */

import { state } from '../main.js';
import { showCharacterConfirmationModal } from './export-character-confirmation.js';

/**
 * Open character review modal to review and modify character selections
 * This does NOT re-run detection - it uses existing detected/confirmed characters
 */
export function reviewCharacters() {
    // Check if we have any character data to review
    if (!state.detectedCharacters || state.detectedCharacters.length === 0) {
        // Try to rebuild from confirmed characters if available
        if (state.confirmedCharacters && state.confirmedCharacters.size > 0) {
            console.log('Rebuilding detectedCharacters from confirmedCharacters...');
            state.detectedCharacters = Array.from(state.confirmedCharacters).map(name => {
                const profile = state.castProfiles?.[name] || {};
                const masterChar = window.masterContext?.characters?.[name] || {};

                return {
                    name: name,
                    category: profile.category || masterChar.category || 'SUPPORTING',
                    sceneCount: masterChar.sceneCount || profile.scenes?.length || 0,
                    firstAppearance: masterChar.firstAppearance || 1,
                    lastAppearance: masterChar.lastAppearance || state.scenes?.length || 1,
                    hasDialogue: masterChar.storyPresence?.hasDialogue !== false,
                    scenesPresent: masterChar.scenesPresent || profile.scenes || [],
                    selected: true,
                    merged: false
                };
            });
        } else if (state.characterTabs && state.characterTabs.length > 0) {
            // Fallback to character tabs
            console.log('Rebuilding detectedCharacters from characterTabs...');
            state.detectedCharacters = state.characterTabs.map(name => {
                const profile = state.castProfiles?.[name] || {};
                return {
                    name: name,
                    category: profile.category || 'SUPPORTING',
                    sceneCount: profile.scenes?.length || 0,
                    firstAppearance: 1,
                    lastAppearance: state.scenes?.length || 1,
                    hasDialogue: true,
                    scenesPresent: profile.scenes || [],
                    selected: true,
                    merged: false
                };
            });
        } else {
            alert('No characters to review. Please import a script first - characters will be detected automatically after import.');
            return;
        }
    }

    console.log('Opening character review modal with', state.detectedCharacters.length, 'characters');

    // Open the confirmation modal (which now has the two-step UI)
    showCharacterConfirmationModal();
}

/**
 * Close character review modal
 * @deprecated Use closeCharacterConfirmModal from export-character-confirmation.js
 */
export function closeCharacterReviewModal() {
    const modal = document.getElementById('character-confirm-modal');
    if (modal) modal.style.display = 'none';

    // Also try the old modal ID just in case
    const oldModal = document.getElementById('character-review-modal');
    if (oldModal) oldModal.style.display = 'none';
}

// Re-export selection functions from confirmation module for backwards compatibility
export {
    selectAllConfirmCharacters as selectAllCharacters,
    deselectAllConfirmCharacters as deselectAllCharacters
} from './export-character-confirmation.js';

// For backwards compatibility, also export confirmCharacterSelection
export { confirmCharactersAndContinue as confirmCharacterSelection } from './export-character-confirmation.js';

// Expose to window for HTML onclick handlers
window.reviewCharacters = reviewCharacters;
window.closeCharacterReviewModal = closeCharacterReviewModal;

export default {
    reviewCharacters,
    closeCharacterReviewModal
};
