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
    const modal = document.getElementById('import-modal');
    if (!modal) {
        console.error('Import modal not found');
        return;
    }

    modal.style.display = 'flex';

    // Pre-fill with current script if available
    const scriptInput = document.getElementById('script-input');
    if (scriptInput && state.currentProject?.scriptContent) {
        scriptInput.value = state.currentProject.scriptContent;
    }
}

/**
 * Close import modal
 */
export function closeImportModal() {
    const modal = document.getElementById('import-modal');
    if (modal) modal.style.display = 'none';
}

/**
 * Process script from import modal
 */
export async function processScript() {
    const scriptInput = document.getElementById('script-input');
    if (!scriptInput) {
        console.error('Script input element not found');
        return;
    }

    const text = scriptInput.value;
    if (!text.trim()) {
        alert('Please paste your screenplay');
        return;
    }

    console.log('Processing script import...');

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
    console.log(`Found ${state.scenes.length} scenes`);

    // Extract characters from scenes
    extractCharactersFromScenes();

    // Create character tabs and profiles for extracted characters
    initializeCharacterTabs();

    // DIAGNOSTIC: Log after script processing
    console.log('✓ Script imported, scenes parsed:', state.scenes.length);
    console.log('✓ Characters detected:', Array.from(state.characters));
    console.log('✓ Character tabs initialized:', state.characterTabs.length);

    // Load and render
    loadScript(text);

    // Close modal after a brief delay
    setTimeout(() => {
        closeImportModal();
    }, 500);
}

/**
 * Extract characters from all scenes with smart filtering
 */
function extractCharactersFromScenes() {
    state.characters = new Set();
    const characterMap = new Map(); // Track character counts and variations

    console.log(`Extracting characters from ${state.scenes.length} scenes...`);

    // Exclusion patterns for false positives
    const excludePatterns = [
        /^\d+$/,                    // Pure numbers (15, 23, 24)
        /^\d+[A-Z]?$/,              // Scene numbers with optional letter (15A, 23B)
        /^CUT TO/i,                 // Transitions
        /^FADE/i,                   // Transitions
        /^DISSOLVE/i,               // Transitions
        /^BACK TO/i,                // Stage directions
        /^MOMENTS LATER/i,          // Time indicators
        /^LATER/i,                  // Time indicators
        /^CONTINUED/i,              // Screenplay formatting
        /^CONT'D$/i,                // Continued
        /^INT\./i,                  // Location markers
        /^EXT\./i,                  // Location markers
        /^INT\/EXT/i,               // Location markers
        /^[*]+$/,                   // Just asterisks
        /^\.\.\.$/,                 // Just ellipsis
        /\d{2,}/,                   // Contains 2+ digits (scene numbers)
        /^\(.+\)$/,                 // Entirely in parentheses
        /^V\.O\.$/i,                // Voice over only
        /^O\.S\.$/i,                // Off screen only
        /^O\.C\.$/i,                // Off camera only
        /^[:\-–—]+$/,               // Just punctuation
        /^THE END$/i,               // Script end marker
        /^TITLE/i,                  // Title cards
        /^SUPER/i,                  // Supers
        /^MONTAGE/i,                // Montage
        /^SERIES OF SHOTS/i,        // Series of shots
        /^INTERCUT/i,               // Intercut
        /^INSERT/i,                 // Insert shots
        /^FLASHBACK/i,              // Flashback
        /^FLASH FORWARD/i           // Flash forward
    ];

    // Generic roles that are often one-offs (optional to exclude)
    const genericRoles = new Set([
        'FERRY CAPTAIN', 'CREW MEMBER', 'TAXI DRIVER', 'WAITER', 'WAITRESS',
        'BARTENDER', 'RECEPTIONIST', 'NURSE', 'DOCTOR', 'OFFICER', 'POLICE OFFICER',
        'MAN', 'WOMAN', 'BOY', 'GIRL', 'CHILD', 'GUARD', 'SOLDIER',
        'CLERK', 'ASSISTANT', 'AGENT', 'VOICE', 'ANNOUNCER'
    ]);

    state.scenes.forEach((scene, sceneIndex) => {
        const lines = scene.content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';

            // Character name detection: all caps, short line, followed by dialogue
            if (line === line.toUpperCase() &&
                line.length > 0 &&
                line.length < 30 &&
                nextLine &&
                nextLine !== nextLine.toUpperCase()) {

                // Remove parentheticals like (V.O.) or (CONT'D)
                let cleanName = line.replace(/\s*\([^)]+\)$/g, '').trim();

                // Skip if empty after cleaning
                if (!cleanName) continue;

                // Skip if matches any exclude pattern
                if (excludePatterns.some(pattern => pattern.test(cleanName))) {
                    console.log(`  ✗ Excluded "${cleanName}" (matches exclusion pattern)`);
                    continue;
                }

                // Skip if too short (single letter) - likely an error
                if (cleanName.length < 2) {
                    console.log(`  ✗ Excluded "${cleanName}" (too short)`);
                    continue;
                }

                // Normalize the name (convert to title case)
                const normalizedName = normalizeCharacterName(cleanName);

                // Track character appearances
                if (characterMap.has(normalizedName)) {
                    characterMap.get(normalizedName).count++;
                } else {
                    characterMap.set(normalizedName, {
                        originalName: cleanName,
                        count: 1,
                        isGeneric: genericRoles.has(cleanName)
                    });
                }
            }
        }
    });

    // Filter characters: must appear at least 2 times OR not be generic
    characterMap.forEach((data, normalizedName) => {
        // Include if: appears 2+ times, OR appears once but is not a generic role
        if (data.count >= 2 || !data.isGeneric) {
            state.characters.add(normalizedName);
            console.log(`  → Character "${normalizedName}" (${data.count} appearances)`);
        } else {
            console.log(`  ✗ Excluded "${normalizedName}" (generic role, only ${data.count} appearance)`);
        }
    });

    console.log(`✓ Extracted ${state.characters.size} unique characters:`, Array.from(state.characters));

    // Create alias map to merge name variations (e.g., "Gwen" -> "Gwen Lawson")
    const aliasMap = createCharacterAliasMap();

    // Apply aliases to existing scene breakdowns
    if (aliasMap.size > 0) {
        Object.keys(state.sceneBreakdowns).forEach(sceneIndex => {
            const breakdown = state.sceneBreakdowns[sceneIndex];
            if (breakdown.cast) {
                breakdown.cast = breakdown.cast.map(char => aliasMap.get(char) || char);
            }
        });
        console.log(`✓ Applied character aliases to existing breakdowns`);
    }
}

/**
 * Normalize character name to title case and handle variations
 * "GWEN LAWSON" -> "Gwen Lawson"
 * "GWEN" -> "Gwen"
 * Also builds an alias map to handle "Gwen" referring to "Gwen Lawson"
 */
function normalizeCharacterName(name) {
    return name.split(' ')
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Create character alias map to handle name variations
 * Maps short names to full names: "Gwen" -> "Gwen Lawson"
 * Call this after extractCharactersFromScenes() to resolve aliases
 */
function createCharacterAliasMap() {
    const aliasMap = new Map();
    const characters = Array.from(state.characters);

    // First, add all full names (2+ words) to the map
    const fullNames = characters.filter(name => name.split(' ').length > 1);

    // For each full name, create alias for first name
    fullNames.forEach(fullName => {
        const firstName = fullName.split(' ')[0];

        // If we have a single-word character that matches this first name, merge them
        if (characters.includes(firstName)) {
            console.log(`  → Merging "${firstName}" into "${fullName}"`);
            state.characters.delete(firstName);
            aliasMap.set(firstName, fullName);
        }
    });

    console.log(`✓ Created ${aliasMap.size} character aliases`);
    return aliasMap;
}

/**
 * Initialize character tabs and profiles from extracted characters
 * Creates cast profiles and populates characterTabs for the UI
 */
function initializeCharacterTabs() {
    console.log('Initializing character tabs...');

    // Convert Set to Array for character tabs
    const characterArray = Array.from(state.characters);
    console.log(`  Converting ${characterArray.length} characters to tabs`);

    // Create cast profiles for each character if they don't exist
    characterArray.forEach(character => {
        if (!state.castProfiles[character]) {
            state.castProfiles[character] = {
                name: character,
                baseDescription: '',
                scenes: [],
                lookStates: []
            };
            console.log(`  → Created cast profile for "${character}"`);
        }
    });

    // Populate character tabs with all characters
    state.characterTabs = characterArray;

    console.log(`✓ Initialized ${state.characterTabs.length} character tabs:`, state.characterTabs);
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

        // DIAGNOSTIC: Verify scene content
        console.log(`  Scene ${scene.number} content length: ${scene.content.length} characters`);
        if (!scene.content || scene.content.trim().length === 0) {
            console.warn(`  ⚠ Warning: Scene ${scene.number} has no content!`);
        }
    });

    console.log(`✓ Scene content extracted for ${detected.length} scenes`);
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
            console.log(`✓ Loaded ${state.characterTabs.length} character tabs from saved project:`, state.characterTabs);

            console.log('Project loaded successfully:', project.name);
            console.log(`  Scenes: ${state.scenes.length}`);
            console.log(`  Characters: ${state.characterTabs.length}`);
            console.log(`  Tags: ${Object.keys(state.scriptTags).length} scenes with tags`);

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
