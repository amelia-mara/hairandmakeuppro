/**
 * character-panel.js
 * Main entry point for character panel functionality
 *
 * This is a slim coordinator module that imports and re-exports
 * all character-related functionality from specialized modules.
 *
 * Module Structure:
 * - breakdown-character-manager.js: CharacterManager class for name normalization
 * - breakdown-character-filtering.js: Scene counts, categorization, deduplication
 * - breakdown-character-tabs.js: Tab rendering and switching
 * - breakdown-character-profile.js: Profile view rendering
 * - breakdown-character-lookbook.js: Look states and lookbook view
 * - breakdown-character-timeline.js: Timeline visualization
 * - breakdown-character-events.js: Continuity events tracking
 * - breakdown-character-utils.js: Utility functions
 */

// ============================================================================
// IMPORTS
// ============================================================================

// Character Manager
import { CharacterManager, characterManager } from './breakdown-character-manager.js';

// Utilities
import {
    getState,
    escapeHtml,
    showToast,
    openContinuityEditModal,
    closeContinuityEditModal,
    saveContinuityNote,
    updateQuickBaseDescription,
    debugCharacterProfile
} from './breakdown-character-utils.js';

// Filtering
import {
    getCharacterSceneCounts,
    getCharacterSceneCount,
    getMainCharacters,
    getSupportingCharacters,
    getCharacterRole,
    getCharacterScenes,
    groupScenesByStoryDay,
    aggressiveDeduplicate,
    deduplicateAllCharacters
} from './breakdown-character-filtering.js';

// Tabs
import {
    renderCharacterTabs,
    renderCharacterTabPanels,
    switchCenterTab,
    removeCharacterTab,
    regenerateCharacterTabs
} from './breakdown-character-tabs.js';

// Profile
import {
    renderProfileView,
    showProfileView
} from './breakdown-character-profile.js';

// Lookbook
import {
    getCharacterLooksByDay,
    renderLookCard,
    renderLookbookView,
    toggleDaySection,
    updateCharacterLook,
    applyLookForward
} from './breakdown-character-lookbook.js';

// Timeline
import {
    renderStoryDayTimeline,
    renderCharacterTimeline,
    renderTimelineView,
    renderStoryDayContinuityTimeline,
    scrollToStoryDay
} from './breakdown-character-timeline.js';

// Events
import {
    getAutoDetectedEvents,
    getCharacterContinuityEvents,
    renderContinuityEventsTimeline,
    renderEventsView,
    confirmAutoEvent,
    dismissAutoEvent,
    setEventEndScene,
    addContinuityEvent,
    editContinuityEvent,
    deleteContinuityEvent,
    deleteTrackedEvent,
    addProgressionStage,
    editProgressionStage,
    addEventProgression,
    fillProgressionGaps,
    clearDismissedAutoEvents
} from './breakdown-character-events.js';

// ============================================================================
// RE-EXPORTS
// ============================================================================

// Export everything for use by other modules
export {
    // Character Manager
    CharacterManager,
    characterManager,

    // Utilities
    getState,
    escapeHtml,
    showToast,
    openContinuityEditModal,
    closeContinuityEditModal,
    saveContinuityNote,
    updateQuickBaseDescription,
    debugCharacterProfile,

    // Filtering
    getCharacterSceneCounts,
    getCharacterSceneCount,
    getMainCharacters,
    getSupportingCharacters,
    getCharacterRole,
    getCharacterScenes,
    groupScenesByStoryDay,
    aggressiveDeduplicate,
    deduplicateAllCharacters,

    // Tabs
    renderCharacterTabs,
    renderCharacterTabPanels,
    switchCenterTab,
    removeCharacterTab,
    regenerateCharacterTabs,

    // Profile
    renderProfileView,
    showProfileView,

    // Lookbook
    getCharacterLooksByDay,
    renderLookCard,
    renderLookbookView,
    toggleDaySection,
    updateCharacterLook,
    applyLookForward,

    // Timeline
    renderStoryDayTimeline,
    renderCharacterTimeline,
    renderTimelineView,
    renderStoryDayContinuityTimeline,
    scrollToStoryDay,

    // Events
    getAutoDetectedEvents,
    getCharacterContinuityEvents,
    renderContinuityEventsTimeline,
    renderEventsView,
    confirmAutoEvent,
    dismissAutoEvent,
    setEventEndScene,
    addContinuityEvent,
    editContinuityEvent,
    deleteContinuityEvent,
    deleteTrackedEvent,
    addProgressionStage,
    editProgressionStage,
    addEventProgression,
    fillProgressionGaps,
    clearDismissedAutoEvents
};

// ============================================================================
// GLOBAL EVENT LISTENERS
// ============================================================================

/**
 * Close dropdown when clicking elsewhere
 */
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('supporting-dropdown');
    const dropdownTab = document.getElementById('supporting-characters-tab');

    if (dropdown && dropdownTab && !dropdownTab.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
    // Character Manager
    CharacterManager,
    characterManager,

    // Main exports
    renderCharacterTabs,
    renderCharacterTabPanels,
    switchCenterTab,
    renderCharacterTimeline,
    deduplicateAllCharacters,
    regenerateCharacterTabs,

    // Utilities
    escapeHtml,
    showToast
};
