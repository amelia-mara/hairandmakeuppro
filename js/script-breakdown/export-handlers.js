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
 * Extract characters from all scenes with STRICT screenplay format parsing
 * Only detects properly formatted character names (centered, all caps, followed by dialogue)
 */
function extractCharactersFromScenes() {
    state.characters = new Set();
    const characterCounts = new Map(); // Track character appearance counts

    // Clear CharacterManager for fresh extraction
    if (window.characterManager) {
        window.characterManager.clear();
    }

    console.log(`🎭 Extracting characters from ${state.scenes.length} scenes using STRICT detection...`);

    // Critical: These patterns DISQUALIFY something from being a character
    const invalidPatterns = [
        /^\d+$/,                          // Just numbers: "4", "15"
        /^\d+\s*\./,                      // Scene numbers: "1.", "15."
        /^(INT|EXT)\./i,                  // Scene headings start
        /^(INT|EXT)\s/i,                  // Scene headings
        /FADE|CUT TO|DISSOLVE/i,          // Transitions
        /CONTINUED|CONT'D/i,              // Continuations (when alone)
        /^BACK TO/i,                      // Transitions
        /LATER|MEANWHILE|MOMENTS/i,       // Time indicators
        /^[*\.\-\s]+$/,                   // Just punctuation
        /:/,                              // Contains colon (likely dialogue/action)
        /DAY|NIGHT|MORNING|EVENING|DUSK|DAWN/i, // Time of day
        /\d{2,}/,                         // Contains multiple digits
        /[!?\.]{2,}/,                     // Multiple punctuation
        /^(THE|A|AN)\s/i,                 // Starts with article (likely location)
        /^V\.O\.$/i,                      // Voice over only
        /^O\.S\.$/i,                      // Off screen only
        /^O\.C\.$/i,                      // Off camera only
        /^THE END$/i,                     // Script end marker
        /^TITLE/i,                        // Title cards
        /^SUPER/i,                        // Supers
        /^MONTAGE/i,                      // Montage
        /^SERIES OF SHOTS/i,              // Series of shots
        /^INTERCUT/i,                     // Intercut
        /^INSERT/i,                       // Insert shots
        /^FLASHBACK/i,                    // Flashback
        /^FLASH FORWARD/i,                // Flash forward
        /^SMACK|^BANG|^CRASH|^BOOM|^THUD|^CLICK/i  // Sound effects
    ];

    // Generic roles to exclude (or mark as minor)
    const genericRoles = new Set([
        'WAITER', 'WAITRESS', 'BARTENDER', 'DRIVER', 'TAXI DRIVER',
        'CREW MEMBER', 'PASSENGER', 'AGENT', 'AIRLINE AGENT',
        'RECEPTIONIST', 'NURSE', 'DOCTOR', 'OFFICER', 'GUARD',
        'MAN', 'WOMAN', 'BOY', 'GIRL', 'PERSON',
        'VOICE', 'CROWD', 'ALL', 'EVERYONE'
    ]);

    // Location keywords that often appear in all caps
    const locationWords = ['HOUSE', 'ROOM', 'STREET', 'ROAD', 'FERRY', 'TAXI',
                          'FARMHOUSE', 'AIRPORT', 'KITCHEN', 'BEDROOM', 'BATHROOM',
                          'HALLWAY', 'OFFICE', 'CAR', 'BUILDING', 'LOBBY'];

    state.scenes.forEach((scene, sceneIndex) => {
        // Split scene content into lines (preserve original formatting for indentation check)
        const lines = scene.content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Skip empty lines
            if (!trimmed) continue;

            // STRICT CHECK 1: Measure indentation (character names are centered ~20-50 spaces)
            const leadingSpaces = line.length - line.trimStart().length;
            const isCentered = leadingSpaces >= 20 && leadingSpaces <= 50;

            // STRICT CHECK 2: Must be all caps (allowing spaces, hyphens, apostrophes)
            const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);

            // STRICT CHECK 3: Check if there's dialogue following (next non-empty line)
            let nextLineIndex = i + 1;
            let nextLine = '';
            while (nextLineIndex < lines.length) {
                nextLine = lines[nextLineIndex];
                if (nextLine.trim()) break;
                nextLineIndex++;
            }

            // Dialogue should be indented less than character name (typically 10-20 spaces)
            const nextLineIndent = nextLine ? nextLine.length - nextLine.trimStart().length : 0;
            const hasDialogueAfter = nextLine &&
                                    nextLine.trim().length > 0 &&
                                    nextLineIndent > 0 &&
                                    nextLineIndent < leadingSpaces &&
                                    !nextLine.trim().startsWith('('); // Skip if next is parenthetical

            // If not properly formatted, skip
            if (!isCentered || !isAllCaps) continue;

            // Clean the potential character name
            let charName = trimmed
                .replace(/\(.*?\)/g, '')  // Remove (V.O.), (CONT'D), (O.S.), etc.
                .replace(/\s+/g, ' ')     // Normalize whitespace
                .trim();

            // Skip if empty after cleaning
            if (!charName) continue;

            // STRICT CHECK 4: Length validation (2-30 characters)
            if (charName.length < 2 || charName.length > 30) continue;

            // STRICT CHECK 5: Skip if matches any invalid pattern
            if (invalidPatterns.some(pattern => pattern.test(charName))) {
                console.log(`  ✗ Excluded "${charName}" (invalid pattern)`);
                continue;
            }

            // STRICT CHECK 6: Skip generic roles
            if (genericRoles.has(charName.toUpperCase())) {
                console.log(`  ✗ Excluded "${charName}" (generic role)`);
                continue;
            }

            // STRICT CHECK 7: Skip if it's obviously a location
            if (locationWords.some(word => charName.includes(word))) {
                console.log(`  ✗ Excluded "${charName}" (location keyword)`);
                continue;
            }

            // At this point, it's LIKELY a character name
            // Normalize through CharacterManager for deduplication and case handling
            const normalized = window.characterManager
                ? window.characterManager.addCharacter(charName)
                : normalizeCharacterName(charName);

            if (!normalized) continue;

            // Track appearances
            if (characterCounts.has(normalized)) {
                characterCounts.set(normalized, characterCounts.get(normalized) + 1);
            } else {
                characterCounts.set(normalized, 1);
            }

            console.log(`  ✓ Found character "${normalized}" at scene ${sceneIndex + 1}, line ${i}`);
        }
    });

    // STRICT CHECK 8: Only include characters that appear at least 2 times
    // (filters out one-off mistakes)
    const characters = Array.from(characterCounts.entries())
        .filter(([name, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1]) // Sort by frequency
        .map(([name, count]) => name);

    // Add to state.characters
    characters.forEach(char => state.characters.add(char));

    console.log("✓ Characters extracted:", characters);
    console.log("Character appearance counts:",
        characters.map(c => `${c}: ${characterCounts.get(c)}`).join(', ')
    );

    // Store character counts globally for review UI
    window.characterCounts = characterCounts;

    // NOTE: CharacterManager now handles all aliasing and normalization automatically
    // The old createCharacterAliasMap() function is no longer needed
    console.log('✓ Character deduplication handled by CharacterManager');
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
 * Also maps various case variations to canonical form
 * Call this after extractCharactersFromScenes() to resolve aliases
 */
function createCharacterAliasMap() {
    const aliasMap = new Map();
    const characters = Array.from(state.characters);

    console.log('🔗 Creating character alias map...');

    // Build map of first names to full names
    const firstNameToFull = new Map();

    characters.forEach(fullName => {
        const parts = fullName.split(' ');

        // Map full name to itself (canonical form)
        aliasMap.set(fullName, fullName);
        aliasMap.set(fullName.toUpperCase(), fullName);
        aliasMap.set(fullName.toLowerCase(), fullName);

        if (parts.length > 1) {
            const firstName = parts[0];

            // If this is the first time seeing this first name, map it to this full name
            if (!firstNameToFull.has(firstName)) {
                firstNameToFull.set(firstName, fullName);
            }
        }
    });

    // Add first name aliases
    firstNameToFull.forEach((fullName, firstName) => {
        // If we have a single-word character that matches this first name, merge them
        if (characters.includes(firstName)) {
            console.log(`  → Merging "${firstName}" into "${fullName}"`);
            state.characters.delete(firstName);
        }

        aliasMap.set(firstName, fullName);
        aliasMap.set(firstName.toUpperCase(), fullName);
        aliasMap.set(firstName.toLowerCase(), fullName);
        console.log(`  ✓ Alias: "${firstName}" → "${fullName}"`);
    });

    // Store alias map globally for use in tag system and other modules
    window.characterAliasMap = aliasMap;

    console.log(`✓ Created ${aliasMap.size} character aliases`);
    return aliasMap;
}

/**
 * Normalize a raw character name using the alias map
 * Use this when processing AI-generated tags or user input
 */
function normalizeCharacterNameWithAlias(rawName, aliasMap) {
    if (!rawName) return '';

    const cleaned = rawName.trim();

    // Try direct lookup
    if (aliasMap.has(cleaned)) {
        return aliasMap.get(cleaned);
    }

    // Try case variations
    if (aliasMap.has(cleaned.toUpperCase())) {
        return aliasMap.get(cleaned.toUpperCase());
    }

    if (aliasMap.has(cleaned.toLowerCase())) {
        return aliasMap.get(cleaned.toLowerCase());
    }

    // Return as-is if no match (but normalize to title case)
    return normalizeCharacterName(cleaned);
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
    // Save confirmedCharacters as array for JSON serialization
    state.currentProject.confirmedCharacters = Array.from(state.confirmedCharacters);
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

            // Load confirmedCharacters from saved project (or fallback to cast profiles)
            if (project.confirmedCharacters) {
                // If saved as array, convert to Set
                state.confirmedCharacters = new Set(project.confirmedCharacters);
            } else if (Object.keys(state.castProfiles).length > 0) {
                // Migrate old projects: use cast profiles as confirmed characters
                state.confirmedCharacters = new Set(Object.keys(state.castProfiles));
            } else {
                state.confirmedCharacters = new Set();
            }

            // Also populate state.characters for backwards compatibility
            state.characters = new Set(state.confirmedCharacters);

            // Initialize character tabs from cast profiles
            state.characterTabs = Object.keys(state.castProfiles);
            console.log(`✓ Loaded ${state.characterTabs.length} character tabs from saved project:`, state.characterTabs);
            console.log(`✓ Loaded ${state.confirmedCharacters.size} confirmed characters:`, Array.from(state.confirmedCharacters));

            console.log('Project loaded successfully:', project.name);
            console.log(`  Scenes: ${state.scenes.length}`);
            console.log(`  Characters: ${state.characterTabs.length}`);
            console.log(`  Confirmed Characters: ${state.confirmedCharacters.size}`);
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

        // Load confirmedCharacters from imported project
        if (data.project.confirmedCharacters) {
            state.confirmedCharacters = new Set(data.project.confirmedCharacters);
        } else if (Object.keys(state.castProfiles).length > 0) {
            // Migrate old projects: use cast profiles as confirmed characters
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
// CHARACTER REVIEW UI
// ============================================================================

/**
 * Open character review modal to review and edit detected characters
 * This is a LOCAL OPERATION ONLY - no AI calls, just regex parsing
 */
export function reviewCharacters() {
    if (!state.scenes || state.scenes.length === 0) {
        alert('Please import a script first');
        return;
    }

    console.log('🎭 Detect & Review Characters - Starting character detection...');

    // Always run character detection when this button is clicked
    // This ensures we get the latest characters from the script
    extractCharactersFromScenes();

    // Store detected characters in temporary array
    state.detectedCharacters = Array.from(state.characters);
    console.log(`✓ Detected ${state.detectedCharacters.length} characters:`, state.detectedCharacters);

    const modal = document.getElementById('character-review-modal');
    const reviewList = document.getElementById('character-review-list');

    if (!modal || !reviewList) {
        console.error('Character review modal elements not found');
        return;
    }

    // Build character review list from detected characters
    const characters = state.detectedCharacters;
    const counts = window.characterCounts || new Map();

    if (characters.length === 0) {
        reviewList.innerHTML = `
            <div style="padding: 24px; text-align: center; color: var(--text-muted);">
                <p>No characters detected in your script.</p>
                <p style="margin-top: 8px; font-size: 0.875em;">
                    Make sure your script uses proper screenplay formatting:
                    <br>- Character names in ALL CAPS
                    <br>- Character names centered
                    <br>- Character names followed by dialogue
                </p>
            </div>
        `;
    } else {
        reviewList.innerHTML = characters.map((char, index) => {
            const count = counts.get(char) || 0;
            return `
                <div class="character-review-item" style="padding: 12px; border-bottom: 1px solid var(--border-light); display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                        <input type="checkbox" checked id="char-review-${index}" data-character="${char}" style="width: 18px; height: 18px; cursor: pointer;">
                        <label for="char-review-${index}" style="font-weight: 600; color: var(--text-primary); cursor: pointer; flex: 1;">
                            ${char}
                        </label>
                        <span class="char-count" style="font-size: 0.875em; color: var(--text-muted); padding: 4px 8px; background: var(--bg-dark); border-radius: 4px;">
                            ${count} appearance${count !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Show modal
    modal.style.display = 'flex';
    console.log('✓ Character review modal opened');
}

/**
 * Close character review modal
 */
export function closeCharacterReviewModal() {
    const modal = document.getElementById('character-review-modal');
    if (modal) modal.style.display = 'none';
}

/**
 * Select all characters in review modal
 */
export function selectAllCharacters() {
    const checkboxes = document.querySelectorAll('#character-review-list input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
}

/**
 * Deselect all characters in review modal
 */
export function deselectAllCharacters() {
    const checkboxes = document.querySelectorAll('#character-review-list input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
}

/**
 * Confirm character selection and update character tabs
 * This commits the selected characters to confirmedCharacters (persisted state)
 */
export function confirmCharacterSelection() {
    const checkboxes = document.querySelectorAll('#character-review-list input[type="checkbox"]');
    const selectedCharacters = new Set();

    checkboxes.forEach(cb => {
        if (cb.checked) {
            const charName = cb.getAttribute('data-character');
            selectedCharacters.add(charName);
        }
    });

    if (selectedCharacters.size === 0) {
        alert('Please select at least one character');
        return;
    }

    console.log(`✓ User confirmed ${selectedCharacters.size} characters`);

    // CRITICAL: Store confirmed characters in the new confirmedCharacters state
    state.confirmedCharacters = selectedCharacters;

    // Also update state.characters for backwards compatibility
    state.characters = selectedCharacters;

    console.log('✓ Confirmed characters saved to state.confirmedCharacters:', Array.from(state.confirmedCharacters));

    // Re-initialize character tabs with confirmed characters
    initializeCharacterTabs();

    // Re-render character tabs and panels
    renderCharacterTabs();
    renderCharacterTabPanels();

    // Save project
    saveProject();

    // Close modal
    closeCharacterReviewModal();

    // Show confirmation
    console.log(`✓ Character tabs generated for ${selectedCharacters.size} characters`);
    alert(`${selectedCharacters.size} character${selectedCharacters.size !== 1 ? 's' : ''} confirmed!\n\nCharacter tabs created. You can now run "Auto Tag Script" to detect production elements.`);
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
window.reviewCharacters = reviewCharacters;
window.closeCharacterReviewModal = closeCharacterReviewModal;
window.selectAllCharacters = selectAllCharacters;
window.deselectAllCharacters = deselectAllCharacters;
window.confirmCharacterSelection = confirmCharacterSelection;
