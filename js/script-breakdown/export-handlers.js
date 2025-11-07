/**
 * export-handlers.js
 * Import/Export functionality
 *
 * Responsibilities:
 * - Export project as JSON
 * - Import screenplay text
 * - Parse screenplay into scenes
 * - Save/load from localStorage
 * - Handle project data management
 */

import { state, selectScene, showAutoSaveIndicator } from './main.js';
import { renderScript } from './script-display.js';
import { renderSceneList } from './scene-list.js';
import { renderCharacterTabs, renderCharacterTabPanels } from './character-panel.js';
import { detectTimeOfDay, detectIntExt, extractLocation } from './utils.js';

/**
 * Export project data as JSON file
 */
export function exportData() {
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
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.currentProject?.name || 'project').replace(/\s+/g, '-')}-breakdown.json`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Open import modal
 */
export function openImportModal() {
    const modal = document.getElementById('importModal');
    if (!modal) return;

    modal.classList.add('active');

    // Pre-fill with current script if available
    const scriptInput = document.getElementById('scriptInput');
    if (scriptInput && state.currentProject?.scriptContent) {
        scriptInput.value = state.currentProject.scriptContent;
    }
}

/**
 * Close import modal
 */
function closeImportModal() {
    const modal = document.getElementById('importModal');
    if (modal) modal.classList.remove('active');
}

/**
 * Process script from import modal
 */
export async function processScript() {
    const scriptInput = document.getElementById('scriptInput');
    if (!scriptInput) return;

    const text = scriptInput.value;
    if (!text.trim()) {
        alert('Please paste your screenplay');
        return;
    }

    const btn = document.getElementById('importBtn');
    const status = document.getElementById('importStatus');

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Processing...';
    }

    if (status) {
        status.style.display = 'block';
        status.textContent = '📝 Importing script and detecting scenes...';
    }

    // Store script text
    if (!state.currentProject) {
        state.currentProject = {
            id: generateProjectId(),
            name: 'Untitled Project',
            created: Date.now()
        };
    }

    state.currentProject.scriptContent = text;

    // Detect scenes
    state.scenes = detectScenes(text);

    if (status) {
        status.textContent = `✅ Found ${state.scenes.length} scenes. Ready!`;
    }

    // Load and render
    loadScript(text);

    setTimeout(() => {
        closeImportModal();
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Import & Analyze';
        }
        if (status) {
            status.style.display = 'none';
        }
    }, 1000);
}

/**
 * Detect scenes from script text
 * @param {string} text - Script text
 * @returns {Array} Array of scene objects
 */
export function detectScenes(text) {
    const lines = text.split('\n');
    const detected = [];

    const patterns = [
        /^(\d+\.?\s*)?(INT\.|EXT\.|INT\/EXT\.|I\/E\.).*$/i,
        /^(INT|EXT)\s+[-–—]\s+.+$/i
    ];

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        for (let pattern of patterns) {
            if (pattern.test(trimmed)) {
                const sceneIndex = detected.length;
                detected.push({
                    number: sceneIndex + 1,
                    heading: trimmed,
                    lineNumber: index,
                    synopsis: null,
                    storyDay: '',
                    timeOfDay: detectTimeOfDay(trimmed, sceneIndex),
                    intExt: detectIntExt(trimmed),
                    location: extractLocation(trimmed, sceneIndex),
                    content: '',
                    characters: {}
                });
                break;
            }
        }
    });

    // Extract scene content
    detected.forEach((scene, idx) => {
        const startLine = scene.lineNumber;
        let endLine = lines.length;

        if (idx < detected.length - 1) {
            endLine = detected[idx + 1].lineNumber;
        }

        scene.content = lines.slice(startLine, endLine).join('\n');
    });

    return detected;
}

/**
 * Load script and render UI
 * @param {string} text - Script text
 */
function loadScript(text) {
    // If project already has scenes, use those
    if (state.currentProject.scenes && Array.isArray(state.currentProject.scenes) && state.currentProject.scenes.length > 0) {
        state.scenes = state.currentProject.scenes;
    }

    // Render UI
    renderSceneList();
    renderCharacterTabs();
    renderCharacterTabPanels();
    renderScript();

    // Select first scene
    if (state.scenes.length > 0) {
        selectScene(0);
    }

    // Auto-save
    saveProject();
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
    state.currentProject.lastModified = Date.now();

    // Save to localStorage
    try {
        localStorage.setItem('currentProject', JSON.stringify(state.currentProject));

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
            state.continuityEvents = project.continuityEvents || {};
            state.sceneTimeline = project.sceneTimeline || {};
            state.scriptTags = project.scriptTags || {};

            // Initialize character tabs from cast profiles
            state.characterTabs = Object.keys(state.castProfiles);

            console.log('Project loaded successfully:', project.name);

            // If we have scenes, render the script
            if (state.scenes.length > 0 && project.scriptContent) {
                loadScript(project.scriptContent);
            }
        } else {
            console.log('No saved project found');

            // Initialize empty project
            state.currentProject = {
                id: generateProjectId(),
                name: 'Untitled Project',
                created: Date.now()
            };
        }
    } catch (error) {
        console.error('Error loading project:', error);
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
 * Generate unique project ID
 * @returns {string} Project ID
 */
function generateProjectId() {
    return `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
    state.currentScene = null;

    // Save and render
    saveProject();
    renderSceneList();
    renderCharacterTabs();
    renderCharacterTabPanels();
    renderScript();

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

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.exportData = exportData;
window.openImportModal = openImportModal;
window.closeImportModal = closeImportModal;
window.processScript = processScript;
window.saveProject = saveProject;
window.loadProjectData = loadProjectData;
window.importProjectFile = importProjectFile;
window.createNewProject = createNewProject;
window.renameProject = renameProject;
