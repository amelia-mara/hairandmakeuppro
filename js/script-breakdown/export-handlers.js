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
 * Character Detection Class - Handles intelligent character name extraction and deduplication
 */
class CharacterDetector {
    constructor() {
        this.characters = new Map(); // Map<primaryName, characterData>
        this.aliasMap = new Map();   // Map<alias, primaryName>
    }

    /**
     * Add a character or merge with existing variations
     */
    addCharacter(rawName, sceneIndex) {
        // Clean the name
        const cleaned = this.cleanName(rawName);
        if (!cleaned) return null;

        // Split into parts for matching
        const parts = cleaned.split(/\s+/);
        const upperName = cleaned.toUpperCase();

        // Check if this is a variation of an existing character
        const existingPrimary = this.findMatchingCharacter(parts, upperName);

        if (existingPrimary) {
            // Update existing character
            const char = this.characters.get(existingPrimary);

            // Add alias if it's new
            if (!char.aliases.includes(cleaned)) {
                char.aliases.push(cleaned);
            }

            // Update to longer name if this one is more complete
            if (cleaned.length > char.primaryName.length) {
                // Move old primary to aliases
                if (!char.aliases.includes(char.primaryName)) {
                    char.aliases.push(char.primaryName);
                }
                // Set new primary
                char.primaryName = cleaned;
                // Update map
                this.characters.set(cleaned, char);
                this.characters.delete(existingPrimary);
                // Update all aliases to point to new primary
                char.aliases.forEach(alias => {
                    this.aliasMap.set(alias.toUpperCase(), cleaned);
                });
                this.aliasMap.set(upperName, cleaned);
            }

            // Track dialogue count and scenes
            char.dialogueCount++;
            if (!char.sceneAppearances.includes(sceneIndex)) {
                char.sceneAppearances.push(sceneIndex);
            }

            return existingPrimary;
        } else {
            // New character
            const charData = {
                primaryName: cleaned,
                aliases: [cleaned, rawName],
                firstScene: sceneIndex,
                sceneAppearances: [sceneIndex],
                dialogueCount: 1,
                isConfirmed: false
            };

            this.characters.set(cleaned, charData);
            this.aliasMap.set(upperName, cleaned);

            // Also map parts as aliases if single word
            if (parts.length === 1) {
                this.aliasMap.set(upperName, cleaned);
            }

            return cleaned;
        }
    }

    /**
     * Clean character name - remove parentheticals and normalize
     */
    cleanName(rawName) {
        if (!rawName) return null;

        // Remove parentheticals: (V.O.), (O.S.), (CONT'D), etc.
        let cleaned = rawName.replace(/\s*\((?:V\.O\.|O\.S\.|O\.C\.|CONT'D|PRE-LAP|FILTERED|.*?)\)\s*/g, '');

        // Trim and normalize whitespace
        cleaned = cleaned.trim().replace(/\s+/g, ' ');

        // Convert to title case for consistency
        cleaned = this.toTitleCase(cleaned);

        return cleaned;
    }

    /**
     * Find matching character based on name parts
     */
    findMatchingCharacter(parts, upperName) {
        // Check if exact match exists in alias map
        if (this.aliasMap.has(upperName)) {
            return this.aliasMap.get(upperName);
        }

        // Check if this is a subset/superset of an existing character
        for (const [primaryName, charData] of this.characters) {
            const primaryUpper = primaryName.toUpperCase();
            const primaryParts = primaryUpper.split(/\s+/);

            // Check if new name is a subset of existing (e.g., "GWEN" vs "GWEN LAWSON")
            if (parts.length < primaryParts.length) {
                const isSubset = parts.every(part => primaryParts.includes(part));
                if (isSubset) {
                    return primaryName;
                }
            }

            // Check if existing name is a subset of new (e.g., "GWEN" exists, found "GWEN LAWSON")
            if (primaryParts.length < parts.length) {
                const isSuperset = primaryParts.every(part => parts.includes(part));
                if (isSuperset) {
                    return primaryName;
                }
            }

            // Check if first names match (common case)
            if (parts[0] === primaryParts[0] && parts.length > 1 && primaryParts.length > 1) {
                return primaryName;
            }
        }

        return null;
    }

    /**
     * Convert to title case
     */
    toTitleCase(str) {
        return str.split(' ')
            .map(word => word.charAt(0) + word.slice(1).toLowerCase())
            .join(' ');
    }

    /**
     * Get all detected characters sorted by importance
     */
    getCharacters() {
        return Array.from(this.characters.values())
            .sort((a, b) => b.dialogueCount - a.dialogueCount);
    }

    /**
     * Clear all data
     */
    clear() {
        this.characters.clear();
        this.aliasMap.clear();
    }
}

/**
 * Extract characters from all scenes with INTELLIGENT screenplay format parsing
 * Uses regex patterns and deduplication logic to identify unique characters
 */
function extractCharactersFromScenes() {
    console.log(`🎭 Extracting characters from ${state.scenes.length} scenes using INTELLIGENT detection...`);
    console.log(`📋 DEBUG: Starting character detection...`);

    // DIAGNOSTIC: Log scene data
    if (state.scenes.length === 0) {
        console.error('❌ No scenes found! Cannot detect characters.');
        return [];
    }

    console.log(`✓ Processing ${state.scenes.length} scenes`);
    state.scenes.forEach((scene, idx) => {
        console.log(`  Scene ${idx + 1}: "${scene.heading}" - ${scene.content?.length || 0} characters`);
    });

    // Create new character detector
    const detector = new CharacterDetector();

    // Regex patterns
    const sceneHeadingPattern = /^(?:INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)/i;
    const transitionPattern = /^(?:CUT TO:|FADE IN:|FADE OUT:|DISSOLVE TO:|BACK TO:)/i;
    const characterPattern = /^([A-Z][A-Z\s\-'\.]+?)(?:\s*\([^\)]+\))?\s*$/;

    // Invalid patterns to exclude
    const invalidPatterns = [
        /^\d+$/,                          // Just numbers
        /^\d+\s*\./,                      // Scene numbers
        /CONTINUED/i,                      // Continued
        /^MORE$/i,                        // More
        /LATER|MEANWHILE|MOMENTS/i,       // Time indicators
        /^[*\.\-\s]+$/,                   // Just punctuation
        /:/,                              // Contains colon
        /DAY|NIGHT|MORNING|EVENING|DUSK|DAWN/i, // Time of day
        /\d{2,}/,                         // Multiple digits
        /[!?\.]{2,}/,                     // Multiple punctuation
        /^THE END$/i,                     // Script end
        /^(?:TITLE|SUPER|MONTAGE|SERIES OF SHOTS|INTERCUT|INSERT|FLASHBACK|FLASH FORWARD)/i
    ];

    // Generic roles to exclude
    const genericRoles = new Set([
        'WAITER', 'WAITRESS', 'BARTENDER', 'DRIVER', 'TAXI DRIVER',
        'CREW MEMBER', 'PASSENGER', 'AGENT', 'RECEPTIONIST',
        'NURSE', 'DOCTOR', 'OFFICER', 'GUARD',
        'MAN', 'WOMAN', 'BOY', 'GIRL', 'PERSON',
        'VOICE', 'CROWD', 'ALL', 'EVERYONE', 'MORE'
    ]);

    // Location keywords
    const locationWords = ['HOUSE', 'ROOM', 'STREET', 'ROAD', 'FERRY', 'TAXI',
                          'FARMHOUSE', 'AIRPORT', 'KITCHEN', 'BEDROOM', 'BATHROOM',
                          'HALLWAY', 'OFFICE', 'CAR', 'BUILDING', 'LOBBY'];

    let totalDetected = 0;
    let debugSampleCount = 0;

    state.scenes.forEach((scene, sceneIndex) => {
        const lines = scene.content.split('\n');
        console.log(`\n📖 Scene ${sceneIndex + 1} - Processing ${lines.length} lines`);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Skip empty lines
            if (!trimmed) continue;

            // Skip scene headings
            if (sceneHeadingPattern.test(trimmed)) continue;

            // Skip transitions
            if (transitionPattern.test(trimmed)) continue;

            // Check indentation - FIXED: More flexible with spacing (10-60 spaces OR tabs)
            const leadingSpaces = line.length - line.trimStart().length;
            const hasTabs = line.startsWith('\t');
            const isCentered = (leadingSpaces >= 10 && leadingSpaces <= 60) || hasTabs;

            // Must be all caps
            const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);

            // DEBUG: Log some ALL CAPS lines to see what we're checking
            if (isAllCaps && debugSampleCount < 10 && trimmed.length > 2 && trimmed.length < 30) {
                console.log(`  🔍 ALL CAPS line: "${trimmed}" (indent: ${leadingSpaces}, hasTabs: ${hasTabs}, isCentered: ${isCentered})`);
                debugSampleCount++;
            }

            if (!isCentered || !isAllCaps) continue;

            // Check for dialogue following
            let nextLineIndex = i + 1;
            let nextLine = '';
            while (nextLineIndex < lines.length && !nextLine.trim()) {
                nextLine = lines[nextLineIndex];
                nextLineIndex++;
            }

            const nextLineIndent = nextLine ? nextLine.length - nextLine.trimStart().length : 0;

            // FIXED: More flexible dialogue detection
            // Dialogue can be indented differently (just needs to exist and not be a parenthetical)
            const hasDialogueAfter = nextLine &&
                                    nextLine.trim().length > 0 &&
                                    !sceneHeadingPattern.test(nextLine.trim()) &&
                                    !transitionPattern.test(nextLine.trim()) &&
                                    !nextLine.trim().startsWith('(') &&
                                    !(nextLine.trim() === nextLine.trim().toUpperCase() && /[A-Z]/.test(nextLine.trim()));

            if (!hasDialogueAfter) {
                if (isAllCaps && trimmed.length > 2 && trimmed.length < 30) {
                    console.log(`  ⏭️  Skipping "${trimmed}" - no dialogue after`);
                }
                continue;
            }

            // Extract character name
            const match = trimmed.match(characterPattern);
            if (!match) continue;

            let charName = match[1].trim();

            // Length validation
            if (charName.length < 2 || charName.length > 30) continue;

            // Skip invalid patterns
            if (invalidPatterns.some(pattern => pattern.test(charName))) continue;

            // Skip generic roles
            if (genericRoles.has(charName.toUpperCase())) continue;

            // Skip locations
            if (locationWords.some(word => charName.includes(word))) continue;

            // Add to detector
            console.log(`  ✅ Detected character: "${charName}"`);
            const added = detector.addCharacter(charName, sceneIndex);
            if (added) {
                totalDetected++;
            }
        }
    });

    // Get detected characters
    const detectedChars = detector.getCharacters();

    // FIXED: Allow characters with just 1 appearance (changed from >= 2 to >= 1)
    // This helps detect minor characters and can be filtered in the UI
    const validCharacters = detectedChars.filter(char => char.dialogueCount >= 1);

    console.log(`\n📊 DETECTION RESULTS:`);
    console.log(`✓ Detected ${totalDetected} character instances`);
    console.log(`✓ Found ${detectedChars.length} total unique characters`);
    console.log(`✓ ${validCharacters.length} characters after filtering`);

    if (validCharacters.length === 0) {
        console.error(`\n❌ NO CHARACTERS DETECTED!`);
        console.error(`   This usually means:`);
        console.error(`   1. Script formatting doesn't match expected patterns`);
        console.error(`   2. Character names are not in ALL CAPS`);
        console.error(`   3. Character names are not indented properly`);
        console.error(`   4. Dialogue is not following character names`);
        console.error(`\n   Tip: Check the debug logs above to see what ALL CAPS lines were found.`);
    }

    // Store in global state for review modal
    window.detectedCharacterData = validCharacters;

    // Also populate state.characters for backwards compatibility
    state.characters = new Set();
    validCharacters.forEach(char => state.characters.add(char.primaryName));

    // Log results
    validCharacters.forEach(char => {
        const aliases = char.aliases.filter(a => a !== char.primaryName).join(', ');
        console.log(`  ✓ ${char.primaryName} (${char.dialogueCount} dialogue${char.dialogueCount !== 1 ? 's' : ''})${aliases ? ` - Also: ${aliases}` : ''}`);
    });

    return validCharacters;
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

    console.log('🎭 Detect & Review Characters - Starting intelligent character detection...');

    // Run character detection with new intelligent system
    const detectedChars = extractCharactersFromScenes();

    // Store detected characters in state
    state.detectedCharacters = detectedChars.map(c => c.primaryName);
    console.log(`✓ Detected ${detectedChars.length} unique characters`);

    const modal = document.getElementById('character-review-modal');
    const reviewList = document.getElementById('character-review-list');

    if (!modal || !reviewList) {
        console.error('Character review modal elements not found');
        return;
    }

    if (detectedChars.length === 0) {
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
        reviewList.innerHTML = detectedChars.map((char, index) => {
            // Determine confidence level
            let confidenceLabel = '';
            let confidenceColor = '';
            if (char.dialogueCount >= 5) {
                confidenceLabel = 'High confidence';
                confidenceColor = '#10b981'; // Green
            } else if (char.dialogueCount >= 3) {
                confidenceLabel = 'Medium confidence';
                confidenceColor = '#f59e0b'; // Orange
            } else {
                confidenceLabel = 'Low confidence';
                confidenceColor = '#6b7280'; // Gray
            }

            // Get unique aliases (excluding primary name and duplicates)
            const uniqueAliases = [...new Set(char.aliases)]
                .filter(a => a !== char.primaryName && a.toUpperCase() !== char.primaryName.toUpperCase())
                .slice(0, 3); // Show max 3 aliases

            const aliasesHtml = uniqueAliases.length > 0
                ? `<div style="font-size: 0.75em; color: var(--text-muted); margin-top: 2px;">
                       Also appears as: ${uniqueAliases.join(', ')}
                   </div>`
                : '';

            // Pre-select characters with 3+ dialogue instances
            const isChecked = char.dialogueCount >= 3 ? 'checked' : '';

            return `
                <div class="character-review-item" style="padding: 12px; border-bottom: 1px solid var(--border-light);">
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <input type="checkbox" ${isChecked} id="char-review-${index}" data-character="${char.primaryName}" style="width: 18px; height: 18px; cursor: pointer; margin-top: 2px;">
                        <div style="flex: 1;">
                            <label for="char-review-${index}" style="font-weight: 600; color: var(--text-primary); cursor: pointer; display: block;">
                                ${char.primaryName}
                            </label>
                            ${aliasesHtml}
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.875em; color: var(--text-muted); padding: 4px 8px; background: var(--bg-dark); border-radius: 4px; margin-bottom: 4px;">
                                ${char.dialogueCount} dialogue${char.dialogueCount !== 1 ? 's' : ''}
                            </div>
                            <div style="font-size: 0.75em; color: ${confidenceColor}; font-weight: 600;">
                                ${confidenceLabel}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Show modal
    modal.style.display = 'flex';
    console.log('✓ Character review modal opened with enhanced data');
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
