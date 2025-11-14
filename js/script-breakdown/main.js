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
    aiProvider: 'openai',         // 'openai' or 'anthropic'
    apiKey: '',                   // Stored in localStorage
    openaiModel: 'gpt-4o',       // Selected OpenAI model
    anthropicModel: 'claude-3-5-sonnet-20241022', // Selected Anthropic model

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
    console.log('Initializing Script Breakdown application...');

    try {
        // Load project data from localStorage
        loadProjectData();

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
    const provider = localStorage.getItem('aiProvider');
    if (provider) state.aiProvider = provider;

    const apiKey = localStorage.getItem('apiKey');
    if (apiKey) state.apiKey = apiKey;

    const openaiModel = localStorage.getItem('openaiModel');
    if (openaiModel) state.openaiModel = openaiModel;

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
 * Handle scene search input
 */
function handleSceneSearch(e) {
    const query = e.target.value.toLowerCase().trim();

    const sceneItems = document.querySelectorAll('.scene-item');
    sceneItems.forEach(item => {
        const heading = item.querySelector('.scene-heading')?.textContent.toLowerCase() || '';
        const synopsis = item.querySelector('.scene-synopsis')?.textContent.toLowerCase() || '';

        if (heading.includes(query) || synopsis.includes(query)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

/**
 * Render initial UI
 */
function renderInitialUI() {
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

    // Auto-save (debounced)
    if (state.autoSaveEnabled) {
        debouncedAutoSave();
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
