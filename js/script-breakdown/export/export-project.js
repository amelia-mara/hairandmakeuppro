/**
 * export-project.js
 * Project save/load functionality
 *
 * Responsibilities:
 * - Save project to localStorage
 * - Load project data from localStorage
 * - Import project from JSON file
 * - Create new project
 * - Rename project
 * - Export project data as JSON
 */

import { state, showAutoSaveIndicator } from '../main.js';
import { renderScript } from '../script-display.js';
import { renderSceneList } from '../scene-list.js';
import { renderCharacterTabs, renderCharacterTabPanels } from '../character-panel.js';
import { getAllVersions, getCurrentVersion, exportVersionData } from '../version-manager.js';

/**
 * Generate unique project ID
 * @returns {string} Project ID
 */
function generateProjectId() {
    return `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Load script and render UI
 * @param {string} text - Script content
 */
function loadScript(text) {
    // Store script content
    state.scriptData = text;
    state.currentProject.scriptContent = text;

    // Render the script
    renderScript();
    renderSceneList();
}

/**
 * Save project to localStorage
 */
export function saveProject() {
    // Ensure we have a project
    if (!state.currentProject) {
        state.currentProject = {
            id: generateProjectId(),
            name: 'Untitled Project',
            created: Date.now()
        };
    }

    // CRITICAL: Ensure continuityEvents is an array before saving
    if (!state.continuityEvents || !Array.isArray(state.continuityEvents)) {
        console.warn('⚠️ continuityEvents was not array, fixing before save');
        state.continuityEvents = [];
    }

    // Update project data
    state.currentProject.sceneBreakdowns = state.sceneBreakdowns;
    state.currentProject.castProfiles = state.castProfiles;
    state.currentProject.characterStates = state.characterStates;
    state.currentProject.characterLooks = state.characterLooks;
    state.currentProject.lookTransitions = state.lookTransitions;
    state.currentProject.continuityEvents = state.continuityEvents;
    state.currentProject.sceneTimeline = state.sceneTimeline;
    state.currentProject.scenes = state.scenes;
    state.currentProject.scriptTags = state.scriptTags;
    // Save confirmedCharacters as array for JSON serialization
    state.currentProject.confirmedCharacters = Array.from(state.confirmedCharacters);
    state.currentProject.lastModified = Date.now();

    // Save to localStorage
    try {
        localStorage.setItem('currentProject', JSON.stringify(state.currentProject));

        // Save scenes separately for breakdown page access
        if (state.scenes && state.scenes.length > 0) {
            localStorage.setItem('checksHappyScenes', JSON.stringify(state.scenes));
        }

        // Save confirmed characters for breakdown page
        if (state.confirmedCharacters && state.confirmedCharacters.size > 0) {
            localStorage.setItem('checksHappyCharacters', JSON.stringify(Array.from(state.confirmedCharacters)));
        }

        // Save character categories if available
        if (window.characterCategories) {
            localStorage.setItem('checksHappyCharacterCategories', JSON.stringify(window.characterCategories));
        }

        // Save to projects list
        const projects = JSON.parse(localStorage.getItem('checksHappyProjects') || '[]');
        const index = projects.findIndex(p => p.id === state.currentProject.id);

        if (index !== -1) {
            projects[index] = state.currentProject;
        } else {
            projects.push(state.currentProject);
        }

        localStorage.setItem('checksHappyProjects', JSON.stringify(projects));

        console.log('Project saved successfully');
    } catch (error) {
        console.error('Error saving project:', error);
        alert('Failed to save project: ' + error.message);
    }
}

/**
 * Load project data from localStorage
 */
export function loadProjectData() {
    try {
        // CRITICAL: Load master context FIRST
        const savedMasterContext = localStorage.getItem('masterContext') || localStorage.getItem('scriptMasterContext');
        if (savedMasterContext) {
            try {
                const masterContext = JSON.parse(savedMasterContext);
                window.masterContext = masterContext;
                window.scriptMasterContext = masterContext;
                console.log('✅ Master context loaded from localStorage:', {
                    characters: Object.keys(masterContext.characters || {}).length,
                    scenes: masterContext.totalScenes,
                    version: masterContext.analysisVersion
                });
            } catch (e) {
                console.error('❌ Failed to parse master context:', e);
            }
        } else {
            console.log('⚠️ No master context found in localStorage');
        }

        const savedProject = localStorage.getItem('currentProject');

        if (savedProject) {
            const project = JSON.parse(savedProject);

            // Load project data
            state.currentProject = project;
            state.scenes = project.scenes || [];
            state.sceneBreakdowns = project.sceneBreakdowns || {};
            state.castProfiles = project.castProfiles || {};
            state.characterStates = project.characterStates || {};
            state.characterLooks = project.characterLooks || {};
            state.lookTransitions = project.lookTransitions || [];

            // CRITICAL: Ensure continuityEvents is an ARRAY, not an object
            if (!project.continuityEvents) {
                console.warn('⚠️ Project missing continuityEvents, adding empty array');
                state.continuityEvents = [];
            } else if (!Array.isArray(project.continuityEvents)) {
                console.error('❌ continuityEvents was not array:', typeof project.continuityEvents);
                state.continuityEvents = [];
            } else {
                state.continuityEvents = project.continuityEvents;
            }

            state.sceneTimeline = project.sceneTimeline || {};
            state.scriptTags = project.scriptTags || {};

            // Load confirmedCharacters from saved project (or fallback to master context or cast profiles)
            if (project.confirmedCharacters) {
                state.confirmedCharacters = new Set(project.confirmedCharacters);
            } else if (window.masterContext?.characters) {
                state.confirmedCharacters = new Set(Object.keys(window.masterContext.characters));
                console.log('✅ Populated confirmed characters from master context');
            } else if (Object.keys(state.castProfiles).length > 0) {
                state.confirmedCharacters = new Set(Object.keys(state.castProfiles));
            } else {
                state.confirmedCharacters = new Set();
            }

            // Also populate state.characters for backwards compatibility
            state.characters = new Set(state.confirmedCharacters);

            // Initialize character tabs from confirmed characters
            state.characterTabs = Array.from(state.confirmedCharacters);
            console.log(`✓ Loaded ${state.characterTabs.length} character tabs from confirmed characters`);
            console.log(`✓ Loaded ${state.confirmedCharacters.size} confirmed characters`);

            console.log('✅ Project loaded successfully:', project.name);

            // If we have scenes, render the script
            if (state.scenes.length > 0 && project.scriptContent) {
                loadScript(project.scriptContent);
            }

            // CRITICAL FIX: Populate characters for all scenes AFTER load is complete
            setTimeout(() => {
                if (window.masterContext?.characters && state.scenes.length > 0) {
                    console.log('🔄 Post-load character population...');
                    import('../tag-system.js').then(module => {
                        if (module.populateCharactersForAllScenes) {
                            module.populateCharactersForAllScenes();
                        }
                    }).catch(err => {
                        console.warn('Could not load tag-system for character population:', err);
                    });
                }
            }, 500);
        } else {
            console.log('⚠️ No saved project found');

            // Initialize empty project
            state.currentProject = {
                id: generateProjectId(),
                name: 'Untitled Project',
                created: Date.now()
            };

            // CRITICAL: Initialize continuityEvents for new projects
            state.continuityEvents = [];
        }
    } catch (error) {
        console.error('❌ Error loading project:', error);

        // Initialize fresh state on error
        if (!state.continuityEvents || !Array.isArray(state.continuityEvents)) {
            state.continuityEvents = [];
        }
        if (!Array.isArray(state.scenes)) {
            state.scenes = [];
        }
        if (!state.confirmedCharacters || !(state.confirmedCharacters instanceof Set)) {
            state.confirmedCharacters = new Set();
        }

        alert('Failed to load project: ' + error.message);
    }
}

/**
 * Import project from JSON file
 * @param {File} file - JSON file
 */
export async function importProjectFile(file) {
    try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validate data structure
        if (!data.project || !data.scenes) {
            throw new Error('Invalid project file format');
        }

        // Load data into state
        state.currentProject = data.project;
        state.scenes = data.scenes || [];
        state.sceneBreakdowns = data.sceneBreakdowns || {};
        state.castProfiles = data.castProfiles || {};
        state.characterStates = data.characterStates || {};
        state.characterLooks = data.characterLooks || {};
        state.lookTransitions = data.lookTransitions || [];
        state.continuityEvents = data.continuityEvents || {};
        state.sceneTimeline = data.sceneTimeline || {};
        state.scriptTags = data.scriptTags || {};

        // Load confirmedCharacters from imported project
        if (data.project.confirmedCharacters) {
            state.confirmedCharacters = new Set(data.project.confirmedCharacters);
        } else if (Object.keys(state.castProfiles).length > 0) {
            state.confirmedCharacters = new Set(Object.keys(state.castProfiles));
        } else {
            state.confirmedCharacters = new Set();
        }

        // Also populate state.characters for backwards compatibility
        state.characters = new Set(state.confirmedCharacters);

        // Initialize character tabs
        state.characterTabs = Object.keys(state.castProfiles);

        // Render UI
        if (state.currentProject.scriptContent) {
            loadScript(state.currentProject.scriptContent);
        } else {
            renderSceneList();
            renderCharacterTabs();
            renderCharacterTabPanels();
        }

        // Save to localStorage
        saveProject();

        alert('Project imported successfully!');
    } catch (error) {
        console.error('Error importing project:', error);
        alert('Failed to import project: ' + error.message);
    }
}

/**
 * Create new project
 */
export function createNewProject() {
    const confirmed = confirm('Create new project? Any unsaved changes will be lost.');
    if (!confirmed) return;

    // Clear state
    state.currentProject = {
        id: generateProjectId(),
        name: 'Untitled Project',
        created: Date.now()
    };
    state.scenes = [];
    state.sceneBreakdowns = {};
    state.castProfiles = {};
    state.characterStates = {};
    state.characterLooks = {};
    state.lookTransitions = [];
    state.continuityEvents = {};
    state.sceneTimeline = {};
    state.scriptTags = {};
    state.characterTabs = [];
    state.confirmedCharacters = new Set();
    state.currentScene = null;

    // Save and render
    saveProject();
    renderSceneList();
    renderScript();

    // Render character tabs and panels after DOM is ready
    setTimeout(() => {
        renderCharacterTabs();
        renderCharacterTabPanels();
    }, 0);

    alert('New project created');
}

/**
 * Rename project
 * @param {string} newName - New project name
 */
export function renameProject(newName) {
    if (!newName || !newName.trim()) return;

    if (state.currentProject) {
        state.currentProject.name = newName.trim();
        saveProject();
        showAutoSaveIndicator();
    }
}

/**
 * Export project data as JSON file
 */
export function exportData() {
    // Get version information
    const versions = getAllVersions();
    const currentVersion = getCurrentVersion();

    const data = {
        project: state.currentProject,
        scenes: state.scenes,
        sceneBreakdowns: state.sceneBreakdowns,
        castProfiles: state.castProfiles,
        characterStates: state.characterStates,
        characterLooks: state.characterLooks,
        lookTransitions: state.lookTransitions,
        continuityEvents: state.continuityEvents,
        sceneTimeline: state.sceneTimeline,
        scriptTags: state.scriptTags,
        confirmedCharacters: Array.from(state.confirmedCharacters),
        exportDate: new Date().toISOString(),
        version: '2.0',
        versionInfo: {
            currentVersion: currentVersion ? {
                id: currentVersion.id,
                name: currentVersion.name,
                description: currentVersion.description,
                timestamp: currentVersion.timestamp
            } : null,
            totalVersions: versions.length,
            versions: exportVersionData()
        }
    };

    // Create and download file
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.currentProject?.name || 'project'}-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.saveProject = saveProject;
window.loadProjectData = loadProjectData;
window.importProjectFile = importProjectFile;
window.createNewProject = createNewProject;
window.renameProject = renameProject;
window.exportData = exportData;

export default {
    saveProject,
    loadProjectData,
    importProjectFile,
    createNewProject,
    renameProject,
    exportData
};
