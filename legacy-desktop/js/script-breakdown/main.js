/**
 * main.js
 * Main application initialization and state management
 *
 * Responsibilities:
 * - Initialize the application on page load
 * - Manage global application state
 * - Coordinate between different modules
 * - Handle routing between views (script/character tabs)
 * - Set up event listeners for core UI interactions
 */

import { renderSceneList } from './scene-list.js';
import { renderScript, zoomIn, zoomOut } from './script-display.js';
import { renderBreakdownPanel } from './breakdown-form.js';
import { renderCharacterTabs, renderCharacterTabPanels, switchCenterTab } from './character-panel.js';
import { saveProject, loadProjectData } from './export-handlers.js';
import { openSettingsModal } from './ai-integration.js';
import { renderAllHighlights } from './tag-system.js';
import { debounce } from './utils.js';
// Hybrid breakdown system imports
import './hybrid-breakdown-manager.js';
import './hybrid-ui.js';
import './hybrid-renderer.js';
import './hybrid-export.js';
// Continuity tracking and supervisor integration
import './continuity-tracking.js';
// Master context utilities for rich character data access
import './master-context-utils.js';
// Debug utilities for troubleshooting data flow
import './debug-utils.js';
// Version management system
import { initVersionManagement, saveCurrentVersionState, setStateReference } from './version-manager.js';
import { renderVersionSelector } from './version-ui.js';
// AI Chat Assistant
import './chat-assistant.js';

// ============================================================================
// GLOBAL APPLICATION STATE
// ============================================================================

export const state = {
    // Project data
    currentProject: null,

    // Scene data
    scenes: [],                    // Array of scene objects
    characters: new Set(),         // Unique character names (DEPRECATED - use confirmedCharacters)
    detectedCharacters: [],        // Temporary array of detected characters (before user confirmation)
    confirmedCharacters: new Set(), // User-approved characters (persisted)
    currentScene: null,            // Currently selected scene index

    // Breakdowns and profiles
    sceneBreakdowns: {},          // { sceneIndex: { cast: [], elements: {}, synopsis: '' } }
    castProfiles: {},             // { characterName: { baseDescription, scenes[], lookStates[] } }
    characterStates: {},          // { sceneIndex: { characterName: { tags, notes } } }

    // Look states and continuity
    characterLooks: {},           // { characterName: [look objects] }
    lookTransitions: [],          // Array of transition objects between looks
    continuityEvents: {},         // { characterName: [event objects] }
    sceneTimeline: {},            // { sceneIndex: { day, time, label } }

    // Tagging system
    scriptTags: {},               // { sceneIndex: [tag objects] }

    // UI state
    activeCenterTab: 'script',    // Current center panel tab ('script' or character name)
    characterTabs: [],            // List of open character tabs
    activeTab: 'breakdown',       // Active sidebar tab ('breakdown', 'notes', 'tags')

    // AI Configuration
    aiProvider: 'anthropic',
    apiKey: '',
    anthropicModel: 'claude-sonnet-4-20250514',

    // App state
    isInitialized: false,
    autoSaveEnabled: true
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the application
 * - Load saved project data
 * - Set up event listeners
 * - Render initial UI
 */
export async function init() {
    console.log('🚀 Initializing Script Breakdown application...');

    try {
        // CRITICAL: Initialize state arrays FIRST before loading anything
        if (!state.continuityEvents) {
            state.continuityEvents = [];
        }

        if (!Array.isArray(state.scenes)) {
            state.scenes = [];
        }

        if (!state.confirmedCharacters || !(state.confirmedCharacters instanceof Set)) {
            state.confirmedCharacters = new Set();
        }

        console.log('✅ State initialized with continuityEvents:', state.continuityEvents);

        // Expose state globally for version management modules
        window.state = state;
        setStateReference(state);

        // Load project data from localStorage
        loadProjectData();

        // Initialize version management system
        initVersionManagement();
        console.log('✅ Version management initialized');

        // Load AI settings
        loadAISettings();

        // Set up event listeners
        setupEventListeners();

        // Initialize tag system (CRITICAL: must be called to enable manual tagging)
        await initializeTagSystem();

        // Render initial UI
        renderInitialUI();

        // Mark as initialized
        state.isInitialized = true;

        // Check if script exists - if not, auto-open import modal
        const hasScript = state.currentProject?.scriptContent && state.scenes.length > 0;
        if (!hasScript) {
            console.log('No script found - opening import modal');
            // Use setTimeout to ensure DOM is ready
            setTimeout(async () => {
                const { openImportModal } = await import('./export-handlers.js');
                openImportModal();
            }, 100);
        }

        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Error initializing application:', error);
        alert('Failed to initialize application. Please refresh the page.');
    }
}

/**
 * Initialize the tag system
 * Sets up event listeners for manual text selection and tagging
 */
async function initializeTagSystem() {
    const { initializeTagSystem: initTags } = await import('./tag-system.js');
    if (initTags) {
        initTags();
        console.log('Tag system initialized');
    }
}

/**
 * Load AI settings from localStorage
 */
function loadAISettings() {
    state.aiProvider = 'anthropic';
    const anthropicKey = localStorage.getItem('anthropicApiKey') || localStorage.getItem('apiKey');
    if (anthropicKey) state.apiKey = anthropicKey;
    const anthropicModel = localStorage.getItem('anthropicModel');
    if (anthropicModel) state.anthropicModel = anthropicModel;
}

/**
 * Set up global event listeners
 */
function setupEventListeners() {
    // Scene search
    const sceneSearch = document.getElementById('scene-search');
    if (sceneSearch) {
        sceneSearch.addEventListener('input', handleSceneSearch);
    }

    // Toolbar buttons
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            import('./export-handlers.js').then(module => module.exportData());
        });
    }

    const importBtn = document.getElementById('import-btn');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            import('./export-handlers.js').then(module => module.openImportModal());
        });
    }

    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettingsModal);
    }

    // Zoom controls
    const zoomInBtn = document.getElementById('zoom-in');
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', zoomIn);
    }

    const zoomOutBtn = document.getElementById('zoom-out');
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', zoomOut);
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Auto-save on visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && state.autoSaveEnabled) {
            saveProject();
        }
    });

    // Auto-save on page unload
    window.addEventListener('beforeunload', () => {
        if (state.autoSaveEnabled) {
            saveProject();
        }
    });
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboardShortcuts(e) {
    // Escape key - close modals/popups
    if (e.key === 'Escape') {
        closeAllModals();
    }

    // Cmd/Ctrl + S - Save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveProject();
        showAutoSaveIndicator();
    }

    // Cmd/Ctrl + F - Focus search
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        const sceneSearch = document.getElementById('scene-search');
        if (sceneSearch) sceneSearch.focus();
    }
}

/**
 * Close all open modals and popups
 */
function closeAllModals() {
    // Close all modals with .modal class
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });

    // Close tag popup
    const tagPopup = document.getElementById('tag-popup');
    if (tagPopup) {
        tagPopup.classList.remove('active');
    }

    // Close context menu
    const contextMenu = document.getElementById('tag-context-menu');
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
}

/**
 * Handle scene search input - searches entire script content
 */
function handleSceneSearch(e) {
    const query = e.target.value.trim();

    // Clear search - show all scenes
    if (!query) {
        clearSearchHighlights();
        renderSceneList();
        return;
    }

    // Perform search
    const results = searchScenes(query);

    if (results.length === 0) {
        showNoSearchResults(query);
        return;
    }

    // Highlight matching scenes and hide non-matching
    highlightSearchResults(results);

    // Auto-select best match
    if (results.length > 0) {
        selectScene(results[0].sceneIndex);
    }
}

/**
 * Search scenes by query - searches headings, content, characters, synopsis
 * @param {string} query - Search term
 * @returns {Array} Array of matching scene results with scores
 */
function searchScenes(query) {
    const searchTerm = query.toLowerCase();
    const results = [];

    state.scenes.forEach((scene, index) => {
        let score = 0;
        let matchType = null;

        const sceneNumber = String(scene.number || index + 1).toLowerCase();
        const heading = (scene.heading || '').toLowerCase();
        const content = (scene.content || '').toLowerCase();
        const synopsis = (scene.synopsis || '').toLowerCase();
        const breakdown = state.sceneBreakdowns[index] || {};
        const characters = (breakdown.cast || []).join(' ').toLowerCase();

        // Priority 1: Exact scene number match
        if (sceneNumber === searchTerm || `scene ${sceneNumber}` === searchTerm.toLowerCase()) {
            score = 100;
            matchType = 'scene_number';
        }
        // Priority 2: Scene number partial match
        else if (sceneNumber.startsWith(searchTerm) || searchTerm === sceneNumber.replace(/[a-z]/gi, '')) {
            score = 95;
            matchType = 'scene_number';
        }
        // Priority 3: Heading match
        else if (heading.includes(searchTerm)) {
            score = 80;
            matchType = 'heading';
        }
        // Priority 4: Character name match
        else if (characters.includes(searchTerm)) {
            score = 70;
            matchType = 'character';
        }
        // Priority 5: Synopsis match
        else if (synopsis.includes(searchTerm)) {
            score = 60;
            matchType = 'synopsis';
        }
        // Priority 6: FULL CONTENT match - this searches the actual script text
        else if (content.includes(searchTerm)) {
            // Count occurrences for ranking
            const occurrences = countOccurrences(content, searchTerm);
            score = 40 + Math.min(occurrences * 3, 25);
            matchType = 'content';
        }

        if (score > 0) {
            results.push({
                sceneIndex: index,
                sceneNumber: scene.number || index + 1,
                score: score,
                matchType: matchType
            });
        }
    });

    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);

    return results;
}

/**
 * Count occurrences of a term in text
 */
function countOccurrences(text, term) {
    if (!text || !term) return 0;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    const matches = text.match(regex);
    return matches ? matches.length : 0;
}

/**
 * Clear all search highlights
 */
function clearSearchHighlights() {
    document.querySelectorAll('.scene-item').forEach(item => {
        item.classList.remove('search-match', 'search-best-match', 'search-hidden');
        item.style.display = '';
    });

    // Remove "no results" message if shown
    const noResults = document.querySelector('.no-search-results');
    if (noResults) noResults.remove();
}

/**
 * Highlight scenes that match search
 */
function highlightSearchResults(results) {
    const matchingIndices = results.map(r => r.sceneIndex);

    document.querySelectorAll('.scene-item').forEach(item => {
        const index = parseInt(item.dataset.sceneIndex);

        if (matchingIndices.includes(index)) {
            item.style.display = '';
            item.classList.remove('search-hidden');
            item.classList.add('search-match');

            // Best match gets special highlight
            if (index === results[0].sceneIndex) {
                item.classList.add('search-best-match');
            } else {
                item.classList.remove('search-best-match');
            }
        } else {
            // Hide non-matching scenes
            item.style.display = 'none';
            item.classList.add('search-hidden');
            item.classList.remove('search-match', 'search-best-match');
        }
    });

    // Scroll best match into view
    const bestMatchItem = document.querySelector('.scene-item.search-best-match');
    if (bestMatchItem) {
        bestMatchItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * Show "no results" message
 */
function showNoSearchResults(query) {
    // Hide all scene items
    document.querySelectorAll('.scene-item').forEach(item => {
        item.style.display = 'none';
        item.classList.add('search-hidden');
    });

    const sceneList = document.getElementById('scene-list');
    if (!sceneList) return;

    // Remove existing message if any
    const existing = sceneList.querySelector('.no-search-results');
    if (existing) existing.remove();

    // Escape HTML
    const div = document.createElement('div');
    div.textContent = query;
    const escapedQuery = div.innerHTML;

    const message = document.createElement('div');
    message.className = 'no-search-results';
    message.innerHTML = `
        <div class="no-results-title">No scenes found for "${escapedQuery}"</div>
        <div class="no-results-hint">Search looks in: scene numbers, headings, full script content, character names, and synopsis</div>
    `;

    sceneList.prepend(message);
}

/**
 * Render initial UI
 */
function renderInitialUI() {
    // Render version selector panel (if versions exist)
    renderVersionSelector();

    // Render scene list
    renderSceneList();

    // Render script
    renderScript();

    // Render character tabs and panels after a short delay to ensure DOM is ready
    // This fixes a race condition where panels don't show on initial load
    setTimeout(() => {
        renderCharacterTabs();
        renderCharacterTabPanels();
        console.log('✓ Character tabs and panels rendered after DOM ready');
    }, 0);

    // Select first scene if available
    if (state.scenes.length > 0) {
        selectScene(0);
    }
}

/**
 * Select a scene and update all views
 */
export function selectScene(index) {
    if (index < 0 || index >= state.scenes.length) return;

    state.currentScene = index;

    // Re-render scene list to show expanded details for selected scene
    renderSceneList();

    // Update breakdown panel
    renderBreakdownPanel();

    // Re-render tags and highlights
    renderAllHighlights();

    // Scroll script to scene
    scrollToScene(index);

    // Scroll breakdown panel to top so user can start working on new scene
    scrollBreakdownPanelToTop();

    // Auto-save (debounced)
    if (state.autoSaveEnabled) {
        debouncedAutoSave();
    }
}

/**
 * Scroll the breakdown panel to top when navigating to a new scene
 */
function scrollBreakdownPanelToTop() {
    const panel = document.getElementById('breakdown-panel');
    if (panel) {
        panel.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/**
 * Update scene list selection highlighting
 */
function updateSceneListSelection() {
    const sceneItems = document.querySelectorAll('.scene-item');
    sceneItems.forEach((item, idx) => {
        if (idx === state.currentScene) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

/**
 * Scroll script viewer to specific scene
 */
function scrollToScene(index) {
    const sceneElement = document.querySelector(`.script-scene[data-scene-index="${index}"]`);
    if (sceneElement) {
        sceneElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * Navigate to specific scene
 */
export function navigateToScene(sceneIndex) {
    selectScene(sceneIndex);

    // Switch to script tab if not already there
    if (state.activeCenterTab !== 'script') {
        switchCenterTab('script');
    }
}

/**
 * Show auto-save indicator
 * DISABLED: Auto-save indicator removed per user preference
 */
export function showAutoSaveIndicator() {
    // Function disabled - auto-save indicator has been removed from UI
    return;
}

/**
 * Debounced auto-save function
 */
const debouncedAutoSave = debounce(() => {
    // Save current version state before saving project
    saveCurrentVersionState();
    saveProject();
    showAutoSaveIndicator();
}, 2000);

/**
 * Update scene metadata
 */
export function updateSceneMetadata(sceneIndex, field, value) {
    if (!state.scenes[sceneIndex]) return;

    state.scenes[sceneIndex][field] = value;

    // Re-render affected views
    renderSceneList();

    if (sceneIndex === state.currentScene) {
        renderBreakdownPanel();
    }

    // Auto-save
    debouncedAutoSave();
}

/**
 * Get current scene
 */
export function getCurrentScene() {
    return state.scenes[state.currentScene];
}

/**
 * Get current scene breakdown
 */
export function getCurrentBreakdown() {
    return state.sceneBreakdowns[state.currentScene] || {};
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

// Make key functions available globally for HTML onclick handlers (legacy)
window.selectScene = selectScene;
window.navigateToScene = navigateToScene;
window.init = init;

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export default state;
