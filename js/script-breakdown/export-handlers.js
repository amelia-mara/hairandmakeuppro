/**
 * export-handlers.js
 * Main entry point for export and import functionality
 *
 * This is a slim coordinator module that imports and re-exports
 * all export-related functionality from specialized modules in ./export/
 *
 * Module Structure:
 * - export/export-core.js: Progress modals, loading bars, toast, downloadFile
 * - export/export-project.js: Project save/load/import/export
 * - export/export-script-import.js: Script import and processing
 * - export/export-character-confirmation.js: Character confirmation modal and merge
 * - export/export-deep-analysis.js: Character detection and extraction
 * - export/export-master-context.js: Master context population
 * - export/export-character-review.js: Character review modal
 * - export/export-generation.js: Timeline and lookbook generation
 * - export/export-html.js: HTML exports for timelines/lookbooks/bible
 * - export/export-workflow.js: Workflow status and processing
 */

// ============================================================================
// IMPORTS FROM MODULAR STRUCTURE
// ============================================================================

// Core utilities
export {
    showProgressModal,
    updateProgressModal,
    closeProgressModal,
    showTopLoadingBar,
    updateTopLoadingBar,
    closeTopLoadingBar,
    showToast,
    downloadFile
} from './export/export-core.js';

// Project management
export {
    saveProject,
    loadProjectData,
    importProjectFile,
    createNewProject,
    renameProject,
    exportData
} from './export/export-project.js';

// Script import
export {
    openImportModal,
    closeImportModal,
    processScript,
    detectScenes,
    loadScript
} from './export/export-script-import.js';

// Character confirmation
export {
    showCharacterConfirmationModal
} from './export/export-character-confirmation.js';

// Deep analysis
export {
    CharacterDetector,
    extractCharactersFromScenes,
    normalizeCharacterName,
    normalizeCharacterNameWithAlias,
    createCharacterAliasMap,
    initializeCharacterTabs
} from './export/export-deep-analysis.js';

// Master context
export {
    populateInitialData,
    createTagsFromMasterContext
} from './export/export-master-context.js';

// Character review
export {
    reviewCharacters,
    closeCharacterReviewModal,
    selectAllCharacters,
    deselectAllCharacters,
    confirmCharacterSelection
} from './export/export-character-review.js';

// Generation
export {
    generateCharacterTimelines,
    generateCharacterLookbooks,
    getCharacterTimeline,
    getCharacterLookbook,
    getCharacterContinuity
} from './export/export-generation.js';

// HTML exports
export {
    exportTimeline,
    exportLookbook,
    exportBible
} from './export/export-html.js';

// Workflow
export {
    updateWorkflowStatus,
    processCurrentScene,
    processAllRemaining,
    validateAnalysisData,
    logMasterContextSummary,
    initializeAIContext,
    openToolsPanel,
    closeToolsPanel
} from './export/export-workflow.js';

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

// Import all for default export
import {
    showProgressModal,
    updateProgressModal,
    closeProgressModal,
    showTopLoadingBar,
    updateTopLoadingBar,
    closeTopLoadingBar,
    showToast,
    downloadFile
} from './export/export-core.js';

import {
    saveProject,
    loadProjectData,
    importProjectFile,
    createNewProject,
    renameProject,
    exportData
} from './export/export-project.js';

import {
    openImportModal,
    closeImportModal,
    processScript,
    detectScenes
} from './export/export-script-import.js';

import {
    showCharacterConfirmationModal
} from './export/export-character-confirmation.js';

import {
    CharacterDetector,
    extractCharactersFromScenes,
    normalizeCharacterName,
    createCharacterAliasMap,
    initializeCharacterTabs
} from './export/export-deep-analysis.js';

import {
    populateInitialData,
    createTagsFromMasterContext
} from './export/export-master-context.js';

import {
    reviewCharacters,
    closeCharacterReviewModal,
    selectAllCharacters,
    deselectAllCharacters,
    confirmCharacterSelection
} from './export/export-character-review.js';

import {
    generateCharacterTimelines,
    generateCharacterLookbooks,
    getCharacterTimeline,
    getCharacterLookbook,
    getCharacterContinuity
} from './export/export-generation.js';

import {
    exportTimeline,
    exportLookbook,
    exportBible
} from './export/export-html.js';

import {
    updateWorkflowStatus,
    processCurrentScene,
    processAllRemaining,
    validateAnalysisData,
    logMasterContextSummary,
    initializeAIContext,
    openToolsPanel,
    closeToolsPanel
} from './export/export-workflow.js';

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
