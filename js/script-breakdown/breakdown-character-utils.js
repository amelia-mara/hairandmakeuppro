/**
 * breakdown-character-utils.js
 * Utility functions for character panel modules
 *
 * Responsibilities:
 * - HTML escaping for XSS prevention
 * - Toast notifications
 * - Debug utilities for character profiles
 * - Modal handlers for continuity editing
 */

import { state as importedState } from './main.js';

/**
 * Get the current state - handles circular dependency issues
 * @returns {Object} Application state
 */
export function getState() {
    if (typeof window !== 'undefined' && window.state) {
        return window.state;
    }
    return importedState;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (success, error, info, warning)
 */
export function showToast(message, type = 'info') {
    // Try to use existing toast system
    if (window.showToast && typeof window.showToast === 'function' && window.showToast !== showToast) {
        window.showToast(message, type);
        return;
    }

    // Fallback to simple implementation
    const existingToast = document.getElementById('simple-toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'simple-toast';
    toast.textContent = message;

    // Style based on type
    const colors = {
        success: '#22c55e',
        error: '#ef4444',
        info: '#d4af7a',
        warning: '#f59e0b'
    };

    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        padding: '12px 24px',
        background: colors[type] || colors.info,
        color: '#fff',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        zIndex: '10000',
        fontSize: '0.875em',
        fontWeight: '600',
        animation: 'slideIn 0.3s ease',
        maxWidth: '400px'
    });

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Close continuity edit modal
 */
export function closeContinuityEditModal() {
    const modal = document.getElementById('continuity-edit-modal');
    if (modal) modal.style.display = 'none';
}

/**
 * Open continuity edit modal
 * @param {number} sceneIndex - Scene index
 * @param {string} character - Character name
 * @param {string} category - Category (hair, makeup, sfx, etc.)
 */
export function openContinuityEditModal(sceneIndex, character, category = '') {
    const state = getState();
    const modal = document.getElementById('continuity-edit-modal');
    if (!modal) return;

    const scene = state.scenes[sceneIndex];
    const currentState = state.characterStates[sceneIndex]?.[character] || {};

    // Set modal data
    modal.dataset.sceneIndex = sceneIndex;
    modal.dataset.character = character;

    // Update modal title
    document.getElementById('continuity-modal-title').textContent = `Edit Continuity - Scene ${scene.number}`;
    document.getElementById('continuity-modal-character').textContent = character;

    // Set category selector
    const categorySelect = document.getElementById('continuity-category');
    categorySelect.value = category || 'hair';

    // Set note text
    const noteTextarea = document.getElementById('continuity-note-text');
    if (category) {
        noteTextarea.value = currentState[category] || '';
    } else {
        noteTextarea.value = '';
    }

    // Show modal
    modal.style.display = 'flex';
    noteTextarea.focus();
}

/**
 * Save continuity note
 */
export async function saveContinuityNote() {
    const state = getState();
    const modal = document.getElementById('continuity-edit-modal');
    const sceneIndex = parseInt(modal.dataset.sceneIndex);
    const character = modal.dataset.character;

    const category = document.getElementById('continuity-category').value;
    const noteText = document.getElementById('continuity-note-text').value.trim();

    // Initialize structures if needed
    if (!state.characterStates[sceneIndex]) {
        state.characterStates[sceneIndex] = {};
    }
    if (!state.characterStates[sceneIndex][character]) {
        state.characterStates[sceneIndex][character] = {};
    }

    // Save or delete note
    if (noteText) {
        state.characterStates[sceneIndex][character][category] = noteText;
    } else {
        delete state.characterStates[sceneIndex][character][category];
    }

    // Save project
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Refresh character timeline - import dynamically to avoid circular dependencies
    const { renderCharacterTabPanels } = await import('./breakdown-character-tabs.js');
    renderCharacterTabPanels();

    // Close modal
    closeContinuityEditModal();
}

/**
 * Update quick base description (called from textarea onchange)
 * @param {string} character - Character name
 * @param {string} value - New description value
 */
export async function updateQuickBaseDescription(character, value) {
    const state = getState();
    if (!state.castProfiles[character]) {
        state.castProfiles[character] = { name: character };
    }
    state.castProfiles[character].baseDescription = value;

    // Auto-save
    const { saveProject } = await import('./export-handlers.js');
    saveProject();
}

/**
 * Debug character profile data
 * Logs all available data sources for a character to help troubleshoot display issues
 * @param {string} characterName - Character name to debug
 * @returns {Object} Debug data from all sources
 */
export function debugCharacterProfile(characterName) {
    const state = getState();
    console.log(`\n=== Debugging Character Profile: ${characterName} ===\n`);

    // Check window.masterContext (primary source)
    console.log('Master Context (window.masterContext):');
    if (window.masterContext?.characters?.[characterName]) {
        console.log('Found in window.masterContext');
        console.log(window.masterContext.characters[characterName]);
    } else {
        console.log('Not found in window.masterContext');
        if (window.masterContext?.characters) {
            console.log('Available characters:', Object.keys(window.masterContext.characters));
        } else {
            console.log('window.masterContext not initialized or has no characters');
        }
    }

    // Check window.scriptMasterContext (secondary source)
    console.log('\nScript Master Context (window.scriptMasterContext):');
    if (window.scriptMasterContext?.characters?.[characterName]) {
        console.log('Found in window.scriptMasterContext');
        console.log(window.scriptMasterContext.characters[characterName]);
    } else {
        console.log('Not found in window.scriptMasterContext');
        if (window.scriptMasterContext?.characters) {
            console.log('Available characters:', Object.keys(window.scriptMasterContext.characters));
        } else {
            console.log('window.scriptMasterContext not initialized');
        }
    }

    // Check Narrative Context (old analysis format)
    console.log('\nNarrative Context (window.scriptNarrativeContext):');
    if (window.scriptNarrativeContext?.characters) {
        const char = window.scriptNarrativeContext.characters.find(c => c.name === characterName);
        if (char) {
            console.log('Found in Narrative Context');
            console.log(char);
        } else {
            console.log('Not found in Narrative Context');
            console.log('Available characters:', window.scriptNarrativeContext.characters.map(c => c.name));
        }
    } else {
        console.log('Narrative Context not initialized');
    }

    // Check State
    console.log('\nState Data:');
    console.log('Cast Profiles:', state?.castProfiles?.[characterName] || 'Not found');
    console.log('Character Looks:', state?.characterLooks?.[characterName] || 'Not found');
    console.log('Confirmed Characters:', state?.confirmedCharacters ? Array.from(state.confirmedCharacters) : 'Not set');

    // Check localStorage
    console.log('\nLocalStorage:');
    const storedMaster = localStorage.getItem('masterContext') || localStorage.getItem('scriptMasterContext');
    if (storedMaster) {
        try {
            const parsed = JSON.parse(storedMaster);
            console.log('Master Context in localStorage:', parsed.characters?.[characterName] ? 'Found' : 'Not found');
            if (parsed.characters?.[characterName]) {
                console.log('Character data from localStorage:', parsed.characters[characterName]);
            }
        } catch (e) {
            console.log('Error parsing localStorage:', e);
        }
    } else {
        console.log('No Master Context in localStorage');
    }

    console.log('\n=== End Debug ===\n');

    return {
        masterContext: window.masterContext?.characters?.[characterName],
        scriptMasterContext: window.scriptMasterContext?.characters?.[characterName],
        narrativeContext: window.scriptNarrativeContext?.characters?.find(c => c.name === characterName),
        castProfile: state?.castProfiles?.[characterName],
        characterLooks: state?.characterLooks?.[characterName]
    };
}

// Expose global functions for HTML onclick handlers
window.closeContinuityEditModal = closeContinuityEditModal;
window.openContinuityEditModal = openContinuityEditModal;
window.saveContinuityNote = saveContinuityNote;
window.updateQuickBaseDescription = updateQuickBaseDescription;
window.debugCharacterProfile = debugCharacterProfile;

export default {
    escapeHtml,
    showToast,
    getState,
    closeContinuityEditModal,
    openContinuityEditModal,
    saveContinuityNote,
    updateQuickBaseDescription,
    debugCharacterProfile
};
