/**
 * export/index.js
 * Main entry point for export functionality
 *
 * This is a slim coordinator module that imports and re-exports
 * all export-related functionality from specialized modules.
 *
 * Module Structure:
 * - export-core.js: Progress modals, loading bars, toast, downloadFile
 * - export-project.js: Project save/load/import/export
 * - export-script-import.js: Script import and processing
 * - export-character-confirmation.js: Character confirmation modal and merge
 * - export-deep-analysis.js: Character detection and extraction
 * - export-master-context.js: Master context population
 * - export-character-review.js: Character review modal
 * - export-generation.js: Timeline and lookbook generation
 * - export-html.js: HTML exports for timelines/lookbooks/bible
 * - export-workflow.js: Workflow status and processing
 */

// ============================================================================
// IMPORTS
// ============================================================================

// Core utilities
import {
    showProgressModal,
    updateProgressModal,
    closeProgressModal,
    showTopLoadingBar,
    updateTopLoadingBar,
    closeTopLoadingBar,
    showToast,
    downloadFile
} from './export-core.js';

// Project management
import {
    saveProject,
    loadProjectData,
    importProjectFile,
    createNewProject,
    renameProject,
    exportData
} from './export-project.js';

// Script import
import {
    openImportModal,
    closeImportModal,
    processScript,
    detectScenes,
    loadScript
} from './export-script-import.js';

// Character confirmation
import {
    showCharacterConfirmationModal,
    normalizeCharacterName as normalizeCharacterNameConfirm
} from './export-character-confirmation.js';

// Deep analysis
import {
    CharacterDetector,
    extractCharactersFromScenes,
    normalizeCharacterName,
    normalizeCharacterNameWithAlias,
    createCharacterAliasMap,
    initializeCharacterTabs
} from './export-deep-analysis.js';

// Master context
import {
    populateInitialData,
    createTagsFromMasterContext
} from './export-master-context.js';

// Character review
import {
    reviewCharacters,
    closeCharacterReviewModal,
    selectAllCharacters,
    deselectAllCharacters,
    confirmCharacterSelection,
    mergeSelectedCharacters
} from './export-character-review.js';

// Generation
import {
    generateCharacterTimelines,
    generateCharacterLookbooks,
    getCharacterTimeline,
    getCharacterLookbook,
    getCharacterContinuity
} from './export-generation.js';

// HTML exports
import {
    exportTimeline,
    exportLookbook,
    exportBible
} from './export-html.js';

// Workflow
import {
    updateWorkflowStatus,
    processCurrentScene,
    processAllRemaining,
    validateAnalysisData,
    logMasterContextSummary,
    initializeAIContext,
    openToolsPanel,
    closeToolsPanel
} from './export-workflow.js';

// ============================================================================
// RE-EXPORTS
// ============================================================================

export {
    // Core utilities
    showProgressModal,
    updateProgressModal,
    closeProgressModal,
    showTopLoadingBar,
    updateTopLoadingBar,
    closeTopLoadingBar,
    showToast,
    downloadFile,

    // Project management
    saveProject,
    loadProjectData,
    importProjectFile,
    createNewProject,
    renameProject,
    exportData,

    // Script import
    openImportModal,
    closeImportModal,
    processScript,
    detectScenes,
    loadScript,

    // Character confirmation
    showCharacterConfirmationModal,

    // Deep analysis
    CharacterDetector,
    extractCharactersFromScenes,
    normalizeCharacterName,
    normalizeCharacterNameWithAlias,
    createCharacterAliasMap,
    initializeCharacterTabs,

    // Master context
    populateInitialData,
    createTagsFromMasterContext,

    // Character review
    reviewCharacters,
    closeCharacterReviewModal,
    selectAllCharacters,
    deselectAllCharacters,
    confirmCharacterSelection,
    mergeSelectedCharacters,

    // Generation
    generateCharacterTimelines,
    generateCharacterLookbooks,
    getCharacterTimeline,
    getCharacterLookbook,
    getCharacterContinuity,

    // HTML exports
    exportTimeline,
    exportLookbook,
    exportBible,

    // Workflow
    updateWorkflowStatus,
    processCurrentScene,
    processAllRemaining,
    validateAnalysisData,
    logMasterContextSummary,
    initializeAIContext,
    openToolsPanel,
    closeToolsPanel
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
    // Core utilities
    showProgressModal,
    updateProgressModal,
    closeProgressModal,
    showTopLoadingBar,
    updateTopLoadingBar,
    closeTopLoadingBar,
    showToast,
    downloadFile,

    // Project management
    saveProject,
    loadProjectData,
    importProjectFile,
    createNewProject,
    renameProject,
    exportData,

    // Script import
    openImportModal,
    closeImportModal,
    processScript,
    detectScenes,

    // Character confirmation
    showCharacterConfirmationModal,

    // Deep analysis
    CharacterDetector,
    extractCharactersFromScenes,
    normalizeCharacterName,
    createCharacterAliasMap,
    initializeCharacterTabs,

    // Master context
    populateInitialData,
    createTagsFromMasterContext,

    // Character review
    reviewCharacters,
    closeCharacterReviewModal,
    selectAllCharacters,
    deselectAllCharacters,
    confirmCharacterSelection,
    mergeSelectedCharacters,

    // Generation
    generateCharacterTimelines,
    generateCharacterLookbooks,
    getCharacterTimeline,
    getCharacterLookbook,
    getCharacterContinuity,

    // HTML exports
    exportTimeline,
    exportLookbook,
    exportBible,

    // Workflow
    updateWorkflowStatus,
    processCurrentScene,
    processAllRemaining,
    validateAnalysisData,
    logMasterContextSummary,
    initializeAIContext,
    openToolsPanel,
    closeToolsPanel
};
