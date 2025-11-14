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
import { callAI } from './ai-integration.js';

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

    // COMPREHENSIVE INITIAL ANALYSIS
    showProgressModal('Analyzing Script', 'Performing deep narrative analysis...');

    try {
        const masterContext = await performDeepAnalysis(text, state.scenes);

        // Store master context
        window.masterContext = masterContext;
        localStorage.setItem('masterContext', JSON.stringify(masterContext));

        // Populate initial data from master context
        populateInitialData(masterContext);

        showToast('Script imported successfully. Proceed with scene-by-scene breakdown.', 'success');

    } catch (error) {
        console.error('Analysis failed:', error);
        showToast('Failed to analyze script. You can still process scenes manually.', 'warning');
    }

    // Load and render
    loadScript(text);

    closeProgressModal();

    // Update workflow status
    if (window.updateWorkflowStatus) {
        updateWorkflowStatus();
    }

    // Close modal after a brief delay
    setTimeout(() => {
        closeImportModal();
    }, 500);
}

/**
 * Perform deep analysis of screenplay to create master context
 * This is the one-time comprehensive analysis that creates the foundation
 * for all future scene-by-scene operations.
 *
 * ENHANCED VERSION - Extracts rich character data for hair/makeup tracking
 */
async function performDeepAnalysis(scriptText, scenes) {
    console.log('🎬 Starting ENHANCED deep script analysis...');

    // Truncate script text for AI prompt if too long (max ~80k chars to stay within token limits)
    const truncatedScript = scriptText.length > 80000
        ? scriptText.substring(0, 80000) + '\n\n[Script truncated for analysis...]'
        : scriptText;

    // Add line numbers for reference extraction
    const scriptLines = scriptText.split('\n');

    const prompt = `
Perform a COMPREHENSIVE analysis of this screenplay for HAIR & MAKEUP DEPARTMENT continuity tracking.
This analysis will be the PRIMARY SOURCE and MASTER CONTEXT for all future operations.

SCREENPLAY (Total Scenes: ${scenes.length}):
${truncatedScript}

Return detailed JSON with this EXACT structure (be extremely thorough):

{
    "title": "script title",
    "totalScenes": ${scenes.length},

    "storyStructure": {
        "totalDays": number,
        "timeline": [
            {
                "day": "Day 1",
                "scenes": [1, 2, 3, 4, 5],
                "description": "Introduction, setup"
            }
        ],
        "flashbacks": [15, 30],
        "timeJumps": [
            {
                "afterScene": 14,
                "jump": "3 days later",
                "toDay": "Day 5"
            }
        ]
    },

    "characters": {
        "CHARACTER_NAME": {
            "scriptDescriptions": [
                {
                    "text": "EXACT quote from script describing character appearance",
                    "sceneNumber": 1,
                    "type": "introduction"
                }
            ],

            "physicalProfile": {
                "age": "52",
                "gender": "Male",
                "ethnicity": "Not specified",
                "build": "Athletic/Heavyset/Slim/etc",
                "hairColor": "Graying",
                "hairStyle": "Unkempt",
                "eyeColor": "Blue",
                "distinctiveFeatures": ["Weathered face", "Scar on cheek"]
            },

            "characterAnalysis": {
                "role": "protagonist",
                "personality": "Haunted, determined, carrying guilt",
                "occupation": "Former detective",
                "socialClass": "Working class",
                "arc": "Redemption - from broken to finding purpose",
                "emotionalJourney": "Guilt → Determination → Acceptance"
            },

            "visualProfile": {
                "overallVibe": "Tired detective who's been through hell",
                "styleChoices": "Practical, worn clothing",
                "groomingHabits": "Neglected, unkempt, stubble",
                "makeupNotes": "Bags under eyes, weathered skin",
                "quirks": "Rubs face when tired",
                "inspirations": "True Detective's Rust Cohle"
            },

            "continuityNotes": {
                "keyLooks": "Starts disheveled, cleans up for confrontation",
                "transformations": "Gets injured in Scene 45, bruising through Act 3",
                "signature": "Always wearing father's watch",
                "importantScenes": [1, 15, 45, 89]
            },

            "firstAppearance": 1,
            "lastAppearance": 98,
            "sceneCount": 45,
            "scenesPresent": [1, 2, 3, 5, 7, 8]
        }
    },

    "environments": {
        "scene_1": {
            "location": "EXT. FERRY - DAY",
            "conditions": ["windy", "ocean spray", "bright sun"],
            "impactOnAppearance": "Hair windswept, clothes damp from spray"
        }
    },

    "interactions": {
        "scene_15": {
            "type": "fight",
            "characters": ["PETER LAWSON", "ERIK"],
            "impact": "Peter gets cut on cheek, Erik's nose bleeding"
        },
        "scene_30": {
            "type": "intimate",
            "characters": ["GWEN", "JOHN"],
            "impact": "Lipstick smudged, hair disheveled"
        }
    },

    "emotionalBeats": {
        "scene_45": {
            "character": "GWEN",
            "emotion": "crying",
            "visualImpact": "Mascara running, red eyes, blotchy skin"
        }
    },

    "dialogueReferences": {
        "scene_8": {
            "line": "You look like hell",
            "character": "PETER",
            "speaker": "GWEN",
            "implication": "Peter needs to look exhausted/disheveled"
        }
    },

    "majorEvents": [
        {
            "scene": number,
            "type": "fight/accident/transformation/weather",
            "charactersAffected": ["names"],
            "visualImpact": "detailed description of visual changes"
        }
    ],

    "continuityNotes": "General observations about visual continuity needs across the script"
}

CRITICAL INSTRUCTIONS:
1. Extract EXACT QUOTES from script for scriptDescriptions - don't paraphrase
2. Keep character names EXACTLY as they appear in the script
3. For every character that speaks or is mentioned, create a complete profile
4. Identify ALL physical interactions that affect appearance (fights, kisses, weather, etc.)
5. Extract dialogue that references character appearance ("you look tired", "nice haircut", etc.)
6. Map environmental conditions that affect appearance (rain, wind, heat, mud, etc.)
7. Track emotional beats that require specific makeup looks (crying, bruising, exhaustion)
8. Be EXTREMELY thorough - this is the only time AI sees full script

Return ONLY valid JSON (no markdown, no code fences).
`;

    try {
        const response = await callAI(prompt, 8000); // Increased token limit for comprehensive response

        // Clean response
        let cleanedResponse = response.trim();
        if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        // Parse JSON response
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No valid JSON found in AI response');
        }

        const masterContext = JSON.parse(jsonMatch[0]);

        // Validate structure
        if (!masterContext.characters) masterContext.characters = {};
        if (!masterContext.environments) masterContext.environments = {};
        if (!masterContext.interactions) masterContext.interactions = {};
        if (!masterContext.emotionalBeats) masterContext.emotionalBeats = {};
        if (!masterContext.dialogueReferences) masterContext.dialogueReferences = {};
        if (!masterContext.majorEvents) masterContext.majorEvents = [];
        if (!masterContext.storyStructure) masterContext.storyStructure = { totalDays: 1, timeline: [], flashbacks: [], timeJumps: [] };

        // Add metadata
        masterContext.createdAt = new Date().toISOString();
        masterContext.analysisVersion = '2.0-enhanced';

        console.log('✅ ENHANCED Master context created:', {
            title: masterContext.title,
            characters: Object.keys(masterContext.characters).length,
            storyDays: masterContext.storyStructure.totalDays,
            majorEvents: masterContext.majorEvents.length,
            environments: Object.keys(masterContext.environments).length,
            interactions: Object.keys(masterContext.interactions).length,
            emotionalBeats: Object.keys(masterContext.emotionalBeats).length,
            dialogueReferences: Object.keys(masterContext.dialogueReferences).length
        });

        return masterContext;

    } catch (error) {
        console.error('❌ Deep analysis failed:', error);
        throw error;
    }
}

/**
 * Populate initial data from master context
 * Sets up the application state with the comprehensive analysis results
 * ENHANCED - Now populates all rich character data
 */
function populateInitialData(masterContext) {
    console.log('📋 Populating initial data from ENHANCED master context...');

    // Update confirmed characters from master context
    if (masterContext.characters) {
        const characterNames = Object.keys(masterContext.characters);
        window.confirmedCharacters = characterNames;
        state.confirmedCharacters = new Set(characterNames);

        console.log(`✓ Added ${characterNames.length} characters from master context`);
    }

    // Create enhanced character importance mapping
    if (masterContext.characters) {
        window.characterImportance = {};
        window.characterProfiles = {};

        Object.entries(masterContext.characters).forEach(([name, data]) => {
            // Basic importance mapping
            window.characterImportance[name] = {
                role: data.characterAnalysis?.role || 'supporting',
                sceneCount: data.sceneCount || 0,
                firstAppearance: data.firstAppearance || 1,
                lastAppearance: data.lastAppearance || 1
            };

            // Rich character profile data
            window.characterProfiles[name] = {
                name: name,
                scriptDescriptions: data.scriptDescriptions || [],
                physicalProfile: data.physicalProfile || {},
                characterAnalysis: data.characterAnalysis || {},
                visualProfile: data.visualProfile || {},
                continuityNotes: data.continuityNotes || {},
                firstAppearance: data.firstAppearance || 1,
                lastAppearance: data.lastAppearance || 1,
                sceneCount: data.sceneCount || 0,
                scenesPresent: data.scenesPresent || []
            };

            // Initialize cast profile in state if not exists
            if (!state.castProfiles[name]) {
                state.castProfiles[name] = {
                    name: name,
                    baseDescription: data.scriptDescriptions?.[0]?.text || '',
                    physicalProfile: data.physicalProfile || {},
                    visualProfile: data.visualProfile || {},
                    scenes: data.scenesPresent || [],
                    lookStates: [],
                    continuityEvents: []
                };
            }
        });

        console.log(`✓ Created enhanced profiles for ${characterNames.length} characters`);
    }

    // Store story structure for timeline tracking
    if (masterContext.storyStructure) {
        window.storyTimeline = masterContext.storyStructure;
        console.log(`✓ Story timeline mapped: ${masterContext.storyStructure.totalDays} days`);

        // Pre-populate scene timeline data
        if (masterContext.storyStructure.timeline) {
            masterContext.storyStructure.timeline.forEach(dayData => {
                dayData.scenes.forEach(sceneNum => {
                    const sceneIndex = sceneNum - 1;
                    if (state.scenes[sceneIndex]) {
                        if (!state.sceneTimeline[sceneIndex]) {
                            state.sceneTimeline[sceneIndex] = {};
                        }
                        state.sceneTimeline[sceneIndex].day = dayData.day;
                        state.scenes[sceneIndex].storyDay = dayData.day;
                    }
                });
            });
        }
    }

    // Store environments affecting appearance
    if (masterContext.environments) {
        window.environmentalContext = masterContext.environments;
        console.log(`✓ Mapped ${Object.keys(masterContext.environments).length} environmental conditions`);

        // Apply environment data to scenes
        Object.entries(masterContext.environments).forEach(([sceneKey, envData]) => {
            const sceneMatch = sceneKey.match(/scene_(\d+)/);
            if (sceneMatch) {
                const sceneIndex = parseInt(sceneMatch[1]) - 1;
                if (state.scenes[sceneIndex]) {
                    state.scenes[sceneIndex].environment = envData;
                }
            }
        });
    }

    // Store physical interactions
    if (masterContext.interactions) {
        window.physicalInteractions = masterContext.interactions;
        console.log(`✓ Tracked ${Object.keys(masterContext.interactions).length} physical interactions`);

        // Apply interactions to scenes
        Object.entries(masterContext.interactions).forEach(([sceneKey, interaction]) => {
            const sceneMatch = sceneKey.match(/scene_(\d+)/);
            if (sceneMatch) {
                const sceneIndex = parseInt(sceneMatch[1]) - 1;
                if (state.scenes[sceneIndex]) {
                    if (!state.scenes[sceneIndex].interactions) {
                        state.scenes[sceneIndex].interactions = [];
                    }
                    state.scenes[sceneIndex].interactions.push(interaction);
                }
            }
        });
    }

    // Store emotional beats
    if (masterContext.emotionalBeats) {
        window.emotionalBeats = masterContext.emotionalBeats;
        console.log(`✓ Identified ${Object.keys(masterContext.emotionalBeats).length} emotional beats`);

        // Apply emotional beats to scenes
        Object.entries(masterContext.emotionalBeats).forEach(([sceneKey, beat]) => {
            const sceneMatch = sceneKey.match(/scene_(\d+)/);
            if (sceneMatch) {
                const sceneIndex = parseInt(sceneMatch[1]) - 1;
                if (state.scenes[sceneIndex]) {
                    if (!state.scenes[sceneIndex].emotionalBeats) {
                        state.scenes[sceneIndex].emotionalBeats = [];
                    }
                    state.scenes[sceneIndex].emotionalBeats.push(beat);
                }
            }
        });
    }

    // Store dialogue references to appearance
    if (masterContext.dialogueReferences) {
        window.dialogueReferences = masterContext.dialogueReferences;
        console.log(`✓ Extracted ${Object.keys(masterContext.dialogueReferences).length} dialogue appearance references`);
    }

    // Store major events for continuity tracking
    if (masterContext.majorEvents) {
        window.majorEvents = masterContext.majorEvents;
        console.log(`✓ Tracked ${masterContext.majorEvents.length} major continuity events`);

        // Apply major events to continuity system
        masterContext.majorEvents.forEach(event => {
            const sceneIndex = event.scene - 1;
            if (event.charactersAffected) {
                event.charactersAffected.forEach(characterName => {
                    if (!state.continuityEvents[characterName]) {
                        state.continuityEvents[characterName] = [];
                    }
                    state.continuityEvents[characterName].push({
                        sceneIndex: sceneIndex,
                        type: event.type,
                        description: event.visualImpact,
                        importance: 8
                    });
                });
            }
        });
    }

    // Update scene list to reflect new data
    renderSceneList();

    // Create character tabs if we have characters
    const characterNames = Object.keys(masterContext.characters || {});
    if (characterNames.length > 0) {
        renderCharacterTabs();
        renderCharacterTabPanels();
    }

    console.log('✅ ENHANCED initial data populated successfully:', {
        characters: characterNames.length,
        environments: Object.keys(masterContext.environments || {}).length,
        interactions: Object.keys(masterContext.interactions || {}).length,
        emotionalBeats: Object.keys(masterContext.emotionalBeats || {}).length,
        majorEvents: masterContext.majorEvents?.length || 0
    });
}

/**
 * Show progress modal for long operations
 */
function showProgressModal(title, message) {
    const modal = document.getElementById('progress-modal');
    if (!modal) return;

    const titleEl = document.getElementById('progress-title');
    const messageEl = document.getElementById('progress-message');
    const progressFill = document.getElementById('progress-fill');
    const progressLabel = document.getElementById('progress-label');
    const cancelBtn = document.getElementById('progress-cancel-btn');
    const doneBtn = document.getElementById('progress-done-btn');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (progressFill) progressFill.style.width = '0%';
    if (progressLabel) progressLabel.textContent = '0%';
    if (cancelBtn) cancelBtn.style.display = 'none'; // Hide cancel for analysis
    if (doneBtn) doneBtn.style.display = 'none';

    modal.style.display = 'flex';
}

/**
 * Update progress modal
 */
function updateProgressModal(current, total, message, isDone) {
    const messageEl = document.getElementById('progress-message');
    const labelEl = document.getElementById('progress-label');
    const fillEl = document.getElementById('progress-fill');
    const cancelBtn = document.getElementById('progress-cancel-btn');
    const doneBtn = document.getElementById('progress-done-btn');

    if (messageEl) messageEl.textContent = message;
    if (labelEl) labelEl.textContent = `${current} / ${total}`;
    if (fillEl) {
        const percentage = (current / total) * 100;
        fillEl.style.width = `${percentage}%`;
    }

    if (isDone) {
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (doneBtn) doneBtn.style.display = 'inline-block';
    }
}

/**
 * Close progress modal
 */
function closeProgressModal() {
    const modal = document.getElementById('progress-modal');
    if (modal) {
        // Small delay so user can see completion
        setTimeout(() => {
            modal.style.display = 'none';
        }, 1000);
    }
}

/**
 * Show toast notification
 * @param {string} message - Message to show
 * @param {string} type - Type (success, warning, error)
 */
function showToast(message, type = 'info') {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
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

            // Check indentation - VERY FLEXIBLE: Accept various indentation levels
            const leadingSpaces = line.length - line.trimStart().length;
            const hasTabs = line.startsWith('\t');
            // Accept: tabs, significant indentation (5+ spaces), or even minimal indentation if followed by dialogue
            const hasIndentation = hasTabs || leadingSpaces >= 5;

            // Must be all caps
            const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);

            // DEBUG: Log some ALL CAPS lines to see what we're checking
            if (isAllCaps && debugSampleCount < 15 && trimmed.length > 2 && trimmed.length < 30) {
                console.log(`  🔍 ALL CAPS line: "${trimmed}" (indent: ${leadingSpaces}, hasTabs: ${hasTabs}, hasIndentation: ${hasIndentation})`);
                debugSampleCount++;
            }

            if (!isAllCaps) continue;

            // For lines without proper indentation, we'll be extra strict about dialogue check
            const requireStrictDialogue = !hasIndentation;

            // Check for dialogue following
            let nextLineIndex = i + 1;
            let nextLine = '';
            while (nextLineIndex < lines.length && !nextLine.trim()) {
                nextLine = lines[nextLineIndex];
                nextLineIndex++;
            }

            const nextLineIndent = nextLine ? nextLine.length - nextLine.trimStart().length : 0;

            // FLEXIBLE dialogue detection
            // Dialogue can be indented differently (just needs to exist and not be a parenthetical)
            let hasDialogueAfter = nextLine &&
                                    nextLine.trim().length > 0 &&
                                    !sceneHeadingPattern.test(nextLine.trim()) &&
                                    !transitionPattern.test(nextLine.trim()) &&
                                    !(nextLine.trim() === nextLine.trim().toUpperCase() && /[A-Z]/.test(nextLine.trim()));

            // Allow parentheticals if they're followed by actual dialogue
            if (hasDialogueAfter && nextLine.trim().startsWith('(')) {
                // Look for dialogue after parenthetical
                let lookAhead = nextLineIndex;
                while (lookAhead < lines.length) {
                    const futureLinetext = lines[lookAhead].trim();
                    if (futureLinetext && !futureLinetext.startsWith('(') && !futureLinetext.match(/^[A-Z\s]+$/)) {
                        hasDialogueAfter = true;
                        break;
                    }
                    if (futureLinetext.match(/^[A-Z\s]+$/)) {
                        hasDialogueAfter = false;
                        break;
                    }
                    lookAhead++;
                }
            }

            // If requires strict dialogue check (no indentation), make sure it's really dialogue
            if (requireStrictDialogue && !hasDialogueAfter) {
                if (debugSampleCount < 15) {
                    console.log(`  ⏭️  Skipping "${trimmed}" - no indentation and no clear dialogue`);
                }
                continue;
            }

            if (!hasDialogueAfter) {
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
 * Initialize character tabs and profiles from confirmed characters
 * Creates cast profiles and populates characterTabs for the UI
 * CRITICAL: Only uses state.confirmedCharacters (user-confirmed list)
 */
function initializeCharacterTabs() {
    console.log('Initializing character tabs from confirmed characters...');

    // CRITICAL: Only use confirmed characters
    if (!state.confirmedCharacters || state.confirmedCharacters.size === 0) {
        console.log('⚠️ No confirmed characters - skipping tab initialization');
        console.log('   User must run "Detect & Review Characters" first');
        state.characterTabs = [];
        return;
    }

    // Convert confirmed characters Set to Array
    const characterArray = Array.from(state.confirmedCharacters);
    console.log(`  Initializing ${characterArray.length} confirmed characters`);

    // Create cast profiles for each confirmed character if they don't exist
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

    // Populate character tabs with confirmed characters only
    state.characterTabs = characterArray;

    console.log(`✓ Initialized ${state.characterTabs.length} character tabs from confirmed characters:`, state.characterTabs);
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
    renderScript();

    // Render character tabs and panels after DOM is ready
    setTimeout(() => {
        renderCharacterTabs();
        renderCharacterTabPanels();
    }, 0);

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

// ============================================================================
// CHARACTER REVIEW UI
// ============================================================================

/**
 * Extract characters from scene breakdowns (fallback if screenplay parsing fails)
 * This is useful when auto-tagging has already identified cast members
 */
function extractCharactersFromBreakdowns() {
    console.log('📋 Extracting characters from scene breakdowns...');

    const characterMap = new Map(); // Map<characterName, data>

    // Collect characters from all scene breakdowns
    Object.keys(state.sceneBreakdowns).forEach(sceneIndex => {
        const breakdown = state.sceneBreakdowns[sceneIndex];

        if (breakdown && breakdown.cast && Array.isArray(breakdown.cast)) {
            breakdown.cast.forEach(characterName => {
                const cleaned = characterName.trim();
                if (!cleaned) return;

                // Normalize to title case
                const normalized = normalizeCharacterName(cleaned);

                if (!characterMap.has(normalized)) {
                    characterMap.set(normalized, {
                        primaryName: normalized,
                        aliases: [cleaned, normalized],
                        firstScene: parseInt(sceneIndex),
                        sceneAppearances: [parseInt(sceneIndex)],
                        dialogueCount: 1,
                        isConfirmed: false
                    });
                } else {
                    const char = characterMap.get(normalized);
                    char.dialogueCount++;
                    if (!char.sceneAppearances.includes(parseInt(sceneIndex))) {
                        char.sceneAppearances.push(parseInt(sceneIndex));
                    }
                    if (!char.aliases.includes(cleaned)) {
                        char.aliases.push(cleaned);
                    }
                }
            });
        }
    });

    // Also check script tags for cast category
    if (state.scriptTags) {
        Object.keys(state.scriptTags).forEach(sceneIndex => {
            const tags = state.scriptTags[sceneIndex];
            if (Array.isArray(tags)) {
                tags.forEach(tag => {
                    if (tag.category === 'cast' && tag.character) {
                        const cleaned = tag.character.trim();
                        if (!cleaned) return;

                        const normalized = normalizeCharacterName(cleaned);

                        if (!characterMap.has(normalized)) {
                            characterMap.set(normalized, {
                                primaryName: normalized,
                                aliases: [cleaned, normalized],
                                firstScene: parseInt(sceneIndex),
                                sceneAppearances: [parseInt(sceneIndex)],
                                dialogueCount: 1,
                                isConfirmed: false
                            });
                        } else {
                            const char = characterMap.get(normalized);
                            char.dialogueCount++;
                            if (!char.sceneAppearances.includes(parseInt(sceneIndex))) {
                                char.sceneAppearances.push(parseInt(sceneIndex));
                            }
                            if (!char.aliases.includes(cleaned)) {
                                char.aliases.push(cleaned);
                            }
                        }
                    }
                });
            }
        });
    }

    // Convert to array and sort by dialogue count
    const characters = Array.from(characterMap.values())
        .sort((a, b) => b.dialogueCount - a.dialogueCount);

    console.log(`✓ Found ${characters.length} characters from breakdowns:`);
    characters.forEach(char => {
        console.log(`  - ${char.primaryName} (${char.dialogueCount} appearances in ${char.sceneAppearances.length} scenes)`);
    });

    return characters;
}

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
    let detectedChars = extractCharactersFromScenes();

    console.log(`📊 Screenplay parsing found ${detectedChars.length} characters`);

    // FALLBACK: If no characters detected from screenplay parsing, extract from auto-tag results
    if (detectedChars.length === 0 && state.sceneBreakdowns) {
        console.log('⚠️ No characters found via screenplay parsing - extracting from scene breakdowns...');
        detectedChars = extractCharactersFromBreakdowns();
        console.log(`✓ Extracted ${detectedChars.length} characters from scene breakdowns`);
    }

    // Store detected characters in state
    state.detectedCharacters = detectedChars.map(c => c.primaryName);

    // CRITICAL: Also store full character data globally for merge functionality
    window.detectedCharacterData = detectedChars;

    console.log(`✓ Final character count: ${detectedChars.length} unique characters`);

    const modal = document.getElementById('character-review-modal');
    const reviewList = document.getElementById('character-review-list');

    if (!modal || !reviewList) {
        console.error('Character review modal elements not found');
        return;
    }

    if (detectedChars.length === 0) {
        reviewList.innerHTML = `
            <div style="padding: 24px; text-align: center; color: var(--text-muted);">
                <p style="font-size: 1.1em; font-weight: 600; margin-bottom: 16px;">No characters detected</p>

                <p style="margin-bottom: 16px;">
                    Character detection works in two ways:
                </p>

                <div style="text-align: left; max-width: 500px; margin: 0 auto;">
                    <div style="background: rgba(212, 175, 122, 0.1); padding: 12px; border-radius: 6px; margin-bottom: 12px;">
                        <strong style="color: var(--accent-gold);">Method 1: Screenplay Parsing</strong>
                        <div style="font-size: 0.875em; margin-top: 6px;">
                            Requires proper screenplay formatting:
                            <br>• Character names in ALL CAPS
                            <br>• Character names indented/centered
                            <br>• Dialogue following character names
                        </div>
                    </div>

                    <div style="background: rgba(212, 175, 122, 0.1); padding: 12px; border-radius: 6px;">
                        <strong style="color: var(--accent-gold);">Method 2: Auto-Tag Results</strong>
                        <div style="font-size: 0.875em; margin-top: 6px;">
                            Uses characters identified by AI during Auto-Tag
                            <br>• Run "Auto Tag Script" first
                            <br>• Then run "Detect & Review Characters"
                        </div>
                    </div>
                </div>

                <p style="margin-top: 20px; font-size: 0.875em; color: var(--text-muted);">
                    💡 <strong>Tip:</strong> If your script doesn't use standard formatting,
                    <br>run "Auto Tag Script" first, then try character detection again.
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
                        <input type="checkbox" ${isChecked} id="char-review-${index}" data-character="${char.primaryName}" data-index="${index}" style="width: 18px; height: 18px; cursor: pointer; margin-top: 2px;">
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

/**
 * Merge selected characters in the review modal
 */
export function mergeSelectedCharacters() {
    const checkboxes = document.querySelectorAll('#character-review-list input[type="checkbox"]:checked');

    if (checkboxes.length < 2) {
        alert('Please select at least 2 characters to merge');
        return;
    }

    // Get selected character indices
    const indices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
    const characters = indices.map(i => window.detectedCharacterData[i]);

    // Prompt for primary name
    const names = characters.map(c => c.primaryName).join('\n');
    const primaryName = prompt(`Select primary name for merged character:\n\n${names}\n\nEnter the name to use:`);

    if (!primaryName || !primaryName.trim()) {
        return;
    }

    // Merge characters
    const merged = {
        primaryName: primaryName.trim(),
        aliases: [...new Set(characters.flatMap(c => c.aliases))],
        firstScene: Math.min(...characters.map(c => c.firstScene)),
        sceneAppearances: [...new Set(characters.flatMap(c => c.sceneAppearances))].sort((a,b) => a-b),
        dialogueCount: characters.reduce((sum, c) => sum + c.dialogueCount, 0),
        isConfirmed: false
    };

    console.log(`✓ Merging ${characters.length} characters into "${primaryName}"`);
    console.log(`  Combined ${merged.dialogueCount} dialogue lines`);
    console.log(`  Appears in ${merged.sceneAppearances.length} scenes`);

    // Remove old characters and add merged one
    window.detectedCharacterData = window.detectedCharacterData.filter((c, i) => !indices.includes(i));
    window.detectedCharacterData.push(merged);

    // Re-sort by dialogue count
    window.detectedCharacterData.sort((a, b) => b.dialogueCount - a.dialogueCount);

    // Refresh modal
    openCharacterReviewModal(window.detectedCharacterData);
}

// ============================================================================
// TOOLS PANEL FUNCTIONS
// ============================================================================

/**
 * Open the tools panel
 */
export function openToolsPanel() {
    const panel = document.getElementById('tools-panel');
    const overlay = document.getElementById('tools-panel-overlay');

    if (panel) panel.classList.add('active');
    if (overlay) overlay.classList.add('active');
}

/**
 * Close the tools panel
 */
export function closeToolsPanel() {
    const panel = document.getElementById('tools-panel');
    const overlay = document.getElementById('tools-panel-overlay');

    if (panel) panel.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

// ============================================================================
// CHARACTER TIMELINES AND LOOKBOOKS
// ============================================================================

/**
 * Generate character timelines for all characters
 * Creates visual continuity timelines showing appearance changes, injuries, emotional states
 */
export async function generateCharacterTimelines() {
    // Check if narrative analysis exists
    if (!window.scriptNarrativeContext) {
        alert('Please import and analyze a script first');
        return;
    }

    showProgressModal('Generating Timelines', 'Creating visual timelines for all characters...');

    const characters = window.confirmedCharacters || [];

    if (characters.length === 0) {
        closeProgressModal();
        alert('No characters found. Please run "Detect & Review Characters" first.');
        return;
    }

    // Initialize storage for timelines if not exists
    if (!window.characterTimelines) {
        window.characterTimelines = {};
    }

    for (let i = 0; i < characters.length; i++) {
        const character = characters[i];

        updateProgressModal(
            i + 1,
            characters.length,
            `Processing ${character}...`,
            false
        );

        try {
            // Generate timeline data
            const timeline = await buildCharacterTimeline(character);

            // Store in character profile
            storeCharacterTimeline(character, timeline);

            // Update character tab if exists
            updateCharacterProfileTab(character, timeline);
        } catch (error) {
            console.error(`Error generating timeline for ${character}:`, error);
        }
    }

    updateProgressModal(characters.length, characters.length, 'Timelines generated!', true);
    closeProgressModal();
    showToast('Character timelines generated successfully', 'success');
}

/**
 * Build timeline data for a specific character
 */
async function buildCharacterTimeline(characterName) {
    const context = window.scriptNarrativeContext;
    const scriptData = state.scriptData;

    // Collect all scenes where character appears
    const characterScenes = state.scenes
        .map((scene, idx) => ({
            sceneNumber: scene.sceneNumber || idx + 1,
            heading: scene.heading,
            text: scene.text,
            index: idx
        }))
        .filter(scene =>
            scene.text && scene.text.toUpperCase().includes(characterName.toUpperCase())
        );

    // Use AI to generate comprehensive timeline
    const prompt = `Generate a visual continuity timeline for the character "${characterName}" in this script.

Script Title: ${scriptData?.title || 'Untitled'}
Narrative Context: ${JSON.stringify(context).substring(0, 1000)}

Character appears in ${characterScenes.length} scenes:
${characterScenes.map(s => `Scene ${s.sceneNumber}: ${s.heading}`).join('\n')}

Scene details:
${characterScenes.map(s => `\nScene ${s.sceneNumber}:\n${s.text.substring(0, 500)}`).join('\n')}

Create a timeline showing:
1. All appearance changes (hair, makeup, wardrobe)
2. Injury progressions with healing stages
3. Emotional states affecting appearance
4. Time of day and lighting considerations
5. Key story moments affecting continuity

Return as JSON array with this structure:
[
  {
    "sceneNumber": "1",
    "description": "Brief continuity note",
    "changes": ["hair: neat bun", "makeup: fresh, natural"],
    "injuries": [],
    "emotional_state": "confident, composed",
    "notes": "Additional continuity notes"
  }
]

Keep descriptions concise and focused on visual continuity for hair and makeup departments.`;

    try {
        const response = await callAI(prompt, 2000);

        // Parse JSON response
        const timelineData = JSON.parse(response);

        return {
            character: characterName,
            totalScenes: characterScenes.length,
            timeline: timelineData,
            generatedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error parsing timeline:', error);
        // Return basic timeline if AI fails
        return {
            character: characterName,
            totalScenes: characterScenes.length,
            timeline: characterScenes.map(s => ({
                sceneNumber: s.sceneNumber,
                description: `Appears in ${s.heading}`,
                changes: [],
                injuries: [],
                emotional_state: 'unknown',
                notes: ''
            })),
            generatedAt: new Date().toISOString()
        };
    }
}

/**
 * Store character timeline data
 */
function storeCharacterTimeline(characterName, timeline) {
    if (!window.characterTimelines) {
        window.characterTimelines = {};
    }
    window.characterTimelines[characterName] = timeline;
}

/**
 * Get character timeline data
 */
function getCharacterTimeline(characterName) {
    return window.characterTimelines?.[characterName] || null;
}

/**
 * Update character profile tab with timeline data
 */
function updateCharacterProfileTab(characterName, timeline) {
    // This would update the character tab UI if it exists
    // For now, just log that it's available
    console.log(`Timeline available for ${characterName}:`, timeline);
}

/**
 * Generate character lookbooks for all characters
 * Creates visual reference guides for department use
 */
export async function generateCharacterLookbooks() {
    if (!window.scriptNarrativeContext) {
        alert('Please import and analyze a script first');
        return;
    }

    showProgressModal('Generating Lookbooks', 'Creating visual reference guides...');

    const characters = window.confirmedCharacters || [];

    if (characters.length === 0) {
        closeProgressModal();
        alert('No characters found. Please run "Detect & Review Characters" first.');
        return;
    }

    // Initialize storage for lookbooks if not exists
    if (!window.characterLookbooks) {
        window.characterLookbooks = {};
    }

    for (let i = 0; i < characters.length; i++) {
        const character = characters[i];

        updateProgressModal(
            i + 1,
            characters.length,
            `Creating lookbook for ${character}...`,
            false
        );

        try {
            // Generate lookbook data
            const lookbook = await createCharacterLookbook(character);

            // Store lookbook
            storeCharacterLookbook(character, lookbook);
        } catch (error) {
            console.error(`Error generating lookbook for ${character}:`, error);
        }
    }

    updateProgressModal(characters.length, characters.length, 'Lookbooks generated!', true);
    closeProgressModal();
    showToast('Character lookbooks generated successfully', 'success');
}

/**
 * Create lookbook for a specific character
 */
async function createCharacterLookbook(characterName) {
    const context = window.scriptNarrativeContext;
    const scriptData = state.scriptData;

    // Get character timeline if available
    const timeline = getCharacterTimeline(characterName);

    // Collect all scenes where character appears
    const characterScenes = state.scenes
        .map((scene, idx) => ({
            sceneNumber: scene.sceneNumber || idx + 1,
            heading: scene.heading,
            text: scene.text,
            index: idx
        }))
        .filter(scene =>
            scene.text && scene.text.toUpperCase().includes(characterName.toUpperCase())
        );

    const prompt = `Create a professional character lookbook for "${characterName}" for the hair and makeup department.

Script Title: ${scriptData?.title || 'Untitled'}
Narrative Context: ${JSON.stringify(context).substring(0, 1000)}

Character appears in ${characterScenes.length} scenes.

${timeline ? `Timeline data available:\n${JSON.stringify(timeline.timeline).substring(0, 1000)}` : ''}

Scene details:
${characterScenes.slice(0, 10).map(s => `\nScene ${s.sceneNumber}:\n${s.text.substring(0, 400)}`).join('\n')}

Include:
1. Base appearance description (hair, makeup, general look)
2. Key looks by story phase or act
3. Continuity requirements (injuries, aging, weather effects)
4. Special makeup/hair needs (SFX, period styling, etc.)
5. Reference notes for each major scene
6. Color palette and styling notes

Format as structured JSON:
{
  "character": "${characterName}",
  "baseAppearance": {
    "hair": "description",
    "makeup": "description",
    "skinTone": "description",
    "specialFeatures": []
  },
  "looksByPhase": [
    {
      "phase": "Act 1",
      "scenes": "1-10",
      "description": "Overall look description",
      "hair": "specific hair notes",
      "makeup": "specific makeup notes",
      "continuity": ["note1", "note2"]
    }
  ],
  "specialRequirements": [],
  "colorPalette": [],
  "departmentNotes": {
    "hair": [],
    "makeup": [],
    "wardrobe": []
  }
}

Focus on practical, actionable information for the crew.`;

    try {
        const response = await callAI(prompt, 2500);
        const lookbookData = JSON.parse(response);

        return {
            ...lookbookData,
            generatedAt: new Date().toISOString(),
            totalScenes: characterScenes.length
        };
    } catch (error) {
        console.error('Error parsing lookbook:', error);
        // Return basic lookbook if AI fails
        return {
            character: characterName,
            baseAppearance: {
                hair: 'Not analyzed',
                makeup: 'Not analyzed',
                skinTone: 'Not specified',
                specialFeatures: []
            },
            looksByPhase: [],
            specialRequirements: [],
            colorPalette: [],
            departmentNotes: {
                hair: [],
                makeup: [],
                wardrobe: []
            },
            generatedAt: new Date().toISOString(),
            totalScenes: characterScenes.length
        };
    }
}

/**
 * Store character lookbook data
 */
function storeCharacterLookbook(characterName, lookbook) {
    if (!window.characterLookbooks) {
        window.characterLookbooks = {};
    }
    window.characterLookbooks[characterName] = lookbook;
}

/**
 * Get character lookbook data
 */
function getCharacterLookbook(characterName) {
    return window.characterLookbooks?.[characterName] || null;
}

/**
 * Get character continuity data (combines timeline and lookbook)
 */
function getCharacterContinuity(characterName) {
    const timeline = getCharacterTimeline(characterName);
    const lookbook = getCharacterLookbook(characterName);

    return {
        timeline,
        lookbook,
        character: characterName
    };
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Export character timelines as HTML
 */
export function exportTimeline() {
    const timelines = {};

    // Collect all character timelines
    const characters = window.confirmedCharacters || [];
    characters.forEach(character => {
        const timeline = getCharacterTimeline(character);
        if (timeline) {
            timelines[character] = timeline;
        }
    });

    if (Object.keys(timelines).length === 0) {
        alert('No timelines generated yet. Please generate character timelines first.');
        return;
    }

    // Generate HTML report
    const html = generateTimelineHTML(timelines);
    downloadFile('character-timelines.html', html, 'text/html');
    showToast('Timeline exported successfully', 'success');
}

/**
 * Export character lookbooks as HTML
 */
export function exportLookbook() {
    const lookbooks = {};

    // Collect all lookbooks
    const characters = window.confirmedCharacters || [];
    characters.forEach(character => {
        const lookbook = getCharacterLookbook(character);
        if (lookbook) {
            lookbooks[character] = lookbook;
        }
    });

    if (Object.keys(lookbooks).length === 0) {
        alert('No lookbooks generated yet. Please generate character lookbooks first.');
        return;
    }

    // Generate PDF-ready HTML
    const html = generateLookbookHTML(lookbooks);
    downloadFile('character-lookbooks.html', html, 'text/html');
    showToast('Lookbook exported successfully', 'success');
}

/**
 * Export comprehensive continuity bible
 */
export function exportBible() {
    const characters = window.confirmedCharacters || [];

    if (characters.length === 0) {
        alert('No characters found. Please detect characters first.');
        return;
    }

    // Comprehensive continuity bible
    const bible = {
        script: state.scriptData?.title || 'Untitled',
        generatedAt: new Date().toISOString(),
        totalScenes: state.scenes?.length || 0,
        characters: {},
        metadata: {
            narrativeContext: window.scriptNarrativeContext || null
        }
    };

    // Compile all continuity data
    characters.forEach(character => {
        bible.characters[character] = {
            timeline: getCharacterTimeline(character),
            lookbook: getCharacterLookbook(character),
            continuity: getCharacterContinuity(character)
        };
    });

    // Generate comprehensive document
    const html = generateBibleHTML(bible);
    downloadFile('continuity-bible.html', html, 'text/html');
    showToast('Continuity Bible exported successfully', 'success');
}

/**
 * Generate HTML for timeline export
 */
function generateTimelineHTML(timelines) {
    const scriptTitle = state.scriptData?.title || 'Untitled';

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Character Timelines - ${scriptTitle}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 40px 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 20px rgba(0,0,0,0.1);
        }
        h1 {
            color: #1a1a1a;
            margin-bottom: 10px;
            font-size: 36px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 40px;
            font-size: 18px;
        }
        .character-section {
            margin-bottom: 50px;
            page-break-inside: avoid;
        }
        .character-name {
            color: #c9a961;
            font-size: 28px;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #c9a961;
        }
        .timeline-item {
            background: #fafafa;
            padding: 20px;
            margin-bottom: 15px;
            border-left: 4px solid #c9a961;
            border-radius: 4px;
        }
        .scene-number {
            font-weight: bold;
            color: #c9a961;
            font-size: 16px;
            margin-bottom: 8px;
        }
        .description {
            margin-bottom: 12px;
            color: #444;
        }
        .changes, .injuries {
            margin-top: 10px;
        }
        .label {
            font-weight: 600;
            color: #666;
            margin-bottom: 5px;
        }
        .tag {
            display: inline-block;
            background: #e8e8e8;
            padding: 4px 12px;
            border-radius: 12px;
            margin: 4px 4px 4px 0;
            font-size: 14px;
        }
        .emotional-state {
            color: #666;
            font-style: italic;
            margin-top: 8px;
        }
        .notes {
            margin-top: 10px;
            padding: 10px;
            background: white;
            border-radius: 4px;
            font-size: 14px;
        }
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Character Timelines</h1>
        <div class="subtitle">${scriptTitle}</div>
`;

    // Add each character's timeline
    for (const [characterName, timelineData] of Object.entries(timelines)) {
        html += `
        <div class="character-section">
            <h2 class="character-name">${characterName}</h2>
            <p style="color: #666; margin-bottom: 20px;">Appears in ${timelineData.totalScenes} scenes</p>
`;

        if (timelineData.timeline && Array.isArray(timelineData.timeline)) {
            timelineData.timeline.forEach(item => {
                html += `
            <div class="timeline-item">
                <div class="scene-number">Scene ${item.sceneNumber}</div>
                <div class="description">${item.description || 'No description'}</div>
`;

                if (item.changes && item.changes.length > 0) {
                    html += `
                <div class="changes">
                    <div class="label">Appearance:</div>
                    ${item.changes.map(change => `<span class="tag">${change}</span>`).join('')}
                </div>
`;
                }

                if (item.injuries && item.injuries.length > 0) {
                    html += `
                <div class="injuries">
                    <div class="label">Injuries/Special FX:</div>
                    ${item.injuries.map(injury => `<span class="tag">${injury}</span>`).join('')}
                </div>
`;
                }

                if (item.emotional_state) {
                    html += `
                <div class="emotional-state">Emotional state: ${item.emotional_state}</div>
`;
                }

                if (item.notes) {
                    html += `
                <div class="notes">${item.notes}</div>
`;
                }

                html += `
            </div>
`;
            });
        }

        html += `
        </div>
`;
    }

    html += `
    </div>
</body>
</html>`;

    return html;
}

/**
 * Generate HTML for lookbook export
 */
function generateLookbookHTML(lookbooks) {
    const scriptTitle = state.scriptData?.title || 'Untitled';

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Character Lookbooks - ${scriptTitle}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 40px 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 20px rgba(0,0,0,0.1);
        }
        h1 {
            color: #1a1a1a;
            margin-bottom: 10px;
            font-size: 36px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 40px;
            font-size: 18px;
        }
        .character-section {
            margin-bottom: 60px;
            page-break-inside: avoid;
        }
        .character-name {
            color: #c9a961;
            font-size: 32px;
            margin-bottom: 30px;
            padding-bottom: 15px;
            border-bottom: 3px solid #c9a961;
        }
        .section {
            margin-bottom: 30px;
        }
        .section-title {
            font-size: 20px;
            color: #444;
            margin-bottom: 15px;
            font-weight: 600;
        }
        .base-appearance {
            background: #fafafa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .appearance-item {
            margin-bottom: 12px;
        }
        .appearance-label {
            font-weight: 600;
            color: #666;
            margin-right: 8px;
        }
        .phase-card {
            background: #fafafa;
            padding: 20px;
            margin-bottom: 15px;
            border-left: 4px solid #c9a961;
            border-radius: 4px;
        }
        .phase-header {
            font-weight: 600;
            color: #c9a961;
            font-size: 18px;
            margin-bottom: 10px;
        }
        .phase-scenes {
            color: #666;
            font-size: 14px;
            margin-bottom: 12px;
        }
        .tag {
            display: inline-block;
            background: #e8e8e8;
            padding: 6px 14px;
            border-radius: 16px;
            margin: 4px 4px 4px 0;
            font-size: 14px;
        }
        .color-tag {
            display: inline-block;
            padding: 6px 14px;
            border-radius: 16px;
            margin: 4px 4px 4px 0;
            font-size: 14px;
            color: white;
            background: #888;
        }
        ul {
            list-style-position: inside;
            margin-left: 10px;
        }
        li {
            margin-bottom: 8px;
        }
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Character Lookbooks</h1>
        <div class="subtitle">${scriptTitle} - Hair & Makeup Department Reference</div>
`;

    // Add each character's lookbook
    for (const [characterName, lookbookData] of Object.entries(lookbooks)) {
        html += `
        <div class="character-section">
            <h2 class="character-name">${characterName}</h2>
`;

        // Base Appearance
        if (lookbookData.baseAppearance) {
            const base = lookbookData.baseAppearance;
            html += `
            <div class="section">
                <div class="section-title">Base Appearance</div>
                <div class="base-appearance">
                    <div class="appearance-item">
                        <span class="appearance-label">Hair:</span>
                        <span>${base.hair || 'Not specified'}</span>
                    </div>
                    <div class="appearance-item">
                        <span class="appearance-label">Makeup:</span>
                        <span>${base.makeup || 'Not specified'}</span>
                    </div>
                    <div class="appearance-item">
                        <span class="appearance-label">Skin Tone:</span>
                        <span>${base.skinTone || 'Not specified'}</span>
                    </div>
`;
            if (base.specialFeatures && base.specialFeatures.length > 0) {
                html += `
                    <div class="appearance-item">
                        <span class="appearance-label">Special Features:</span>
                        ${base.specialFeatures.map(f => `<span class="tag">${f}</span>`).join('')}
                    </div>
`;
            }
            html += `
                </div>
            </div>
`;
        }

        // Looks by Phase
        if (lookbookData.looksByPhase && lookbookData.looksByPhase.length > 0) {
            html += `
            <div class="section">
                <div class="section-title">Looks by Story Phase</div>
`;
            lookbookData.looksByPhase.forEach(phase => {
                html += `
                <div class="phase-card">
                    <div class="phase-header">${phase.phase || 'Unknown Phase'}</div>
                    <div class="phase-scenes">Scenes: ${phase.scenes || 'Not specified'}</div>
                    <p style="margin-bottom: 12px;">${phase.description || ''}</p>
                    ${phase.hair ? `<div style="margin-bottom: 8px;"><strong>Hair:</strong> ${phase.hair}</div>` : ''}
                    ${phase.makeup ? `<div style="margin-bottom: 8px;"><strong>Makeup:</strong> ${phase.makeup}</div>` : ''}
                    ${phase.continuity && phase.continuity.length > 0 ? `
                    <div style="margin-top: 12px;">
                        <strong>Continuity Notes:</strong>
                        <ul>
                            ${phase.continuity.map(note => `<li>${note}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                </div>
`;
            });
            html += `
            </div>
`;
        }

        // Special Requirements
        if (lookbookData.specialRequirements && lookbookData.specialRequirements.length > 0) {
            html += `
            <div class="section">
                <div class="section-title">Special Requirements</div>
                <ul>
                    ${lookbookData.specialRequirements.map(req => `<li>${req}</li>`).join('')}
                </ul>
            </div>
`;
        }

        // Color Palette
        if (lookbookData.colorPalette && lookbookData.colorPalette.length > 0) {
            html += `
            <div class="section">
                <div class="section-title">Color Palette</div>
                ${lookbookData.colorPalette.map(color => `<span class="color-tag">${color}</span>`).join('')}
            </div>
`;
        }

        // Department Notes
        if (lookbookData.departmentNotes) {
            const notes = lookbookData.departmentNotes;
            html += `
            <div class="section">
                <div class="section-title">Department Notes</div>
`;
            if (notes.hair && notes.hair.length > 0) {
                html += `
                <div style="margin-bottom: 15px;">
                    <strong>Hair Department:</strong>
                    <ul>
                        ${notes.hair.map(note => `<li>${note}</li>`).join('')}
                    </ul>
                </div>
`;
            }
            if (notes.makeup && notes.makeup.length > 0) {
                html += `
                <div style="margin-bottom: 15px;">
                    <strong>Makeup Department:</strong>
                    <ul>
                        ${notes.makeup.map(note => `<li>${note}</li>`).join('')}
                    </ul>
                </div>
`;
            }
            if (notes.wardrobe && notes.wardrobe.length > 0) {
                html += `
                <div style="margin-bottom: 15px;">
                    <strong>Wardrobe Department:</strong>
                    <ul>
                        ${notes.wardrobe.map(note => `<li>${note}</li>`).join('')}
                    </ul>
                </div>
`;
            }
            html += `
            </div>
`;
        }

        html += `
        </div>
`;
    }

    html += `
    </div>
</body>
</html>`;

    return html;
}

/**
 * Generate comprehensive continuity bible HTML
 */
function generateBibleHTML(bible) {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Continuity Bible - ${bible.script}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 40px 20px;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            padding: 50px;
            border-radius: 12px;
            box-shadow: 0 2px 20px rgba(0,0,0,0.1);
        }
        .cover {
            text-align: center;
            padding: 60px 20px;
            border-bottom: 3px solid #c9a961;
            margin-bottom: 50px;
        }
        h1 {
            color: #1a1a1a;
            margin-bottom: 20px;
            font-size: 48px;
        }
        .subtitle {
            color: #666;
            font-size: 24px;
            margin-bottom: 10px;
        }
        .meta {
            color: #999;
            font-size: 14px;
            margin-top: 20px;
        }
        .toc {
            margin-bottom: 50px;
            padding: 30px;
            background: #fafafa;
            border-radius: 8px;
        }
        .toc h2 {
            color: #c9a961;
            margin-bottom: 20px;
        }
        .toc ul {
            list-style: none;
        }
        .toc li {
            margin-bottom: 10px;
            padding-left: 20px;
        }
        .toc a {
            color: #333;
            text-decoration: none;
        }
        .toc a:hover {
            color: #c9a961;
        }
        .character-section {
            margin-bottom: 80px;
            page-break-inside: avoid;
        }
        .character-name {
            color: #c9a961;
            font-size: 36px;
            margin-bottom: 40px;
            padding-bottom: 15px;
            border-bottom: 3px solid #c9a961;
        }
        .subsection {
            margin-bottom: 40px;
        }
        .subsection-title {
            font-size: 24px;
            color: #444;
            margin-bottom: 20px;
            font-weight: 600;
        }
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
            .character-section { page-break-before: always; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="cover">
            <h1>Continuity Bible</h1>
            <div class="subtitle">${bible.script}</div>
            <div class="meta">
                Generated: ${new Date(bible.generatedAt).toLocaleString()}<br>
                Total Scenes: ${bible.totalScenes}
            </div>
        </div>

        <div class="toc">
            <h2>Table of Contents</h2>
            <ul>
`;

    // Add TOC entries
    for (const characterName of Object.keys(bible.characters)) {
        html += `                <li><a href="#char-${characterName.replace(/\s/g, '-')}">${characterName}</a></li>\n`;
    }

    html += `
            </ul>
        </div>
`;

    // Add each character's comprehensive data
    for (const [characterName, data] of Object.entries(bible.characters)) {
        html += `
        <div class="character-section" id="char-${characterName.replace(/\s/g, '-')}">
            <h2 class="character-name">${characterName}</h2>
`;

        // Timeline section
        if (data.timeline && data.timeline.timeline) {
            html += `
            <div class="subsection">
                <h3 class="subsection-title">Timeline</h3>
`;
            html += generateTimelineSection(data.timeline);
            html += `
            </div>
`;
        }

        // Lookbook section
        if (data.lookbook) {
            html += `
            <div class="subsection">
                <h3 class="subsection-title">Lookbook</h3>
`;
            html += generateLookbookSection(data.lookbook);
            html += `
            </div>
`;
        }

        html += `
        </div>
`;
    }

    html += `
    </div>
</body>
</html>`;

    return html;
}

/**
 * Helper function to generate timeline section for bible
 */
function generateTimelineSection(timelineData) {
    let html = `<div style="background: #fafafa; padding: 20px; border-radius: 8px;">`;

    if (timelineData.timeline && Array.isArray(timelineData.timeline)) {
        timelineData.timeline.forEach(item => {
            html += `
            <div style="margin-bottom: 20px; padding: 15px; background: white; border-left: 4px solid #c9a961; border-radius: 4px;">
                <div style="font-weight: bold; color: #c9a961; margin-bottom: 8px;">Scene ${item.sceneNumber}</div>
                <div style="margin-bottom: 8px;">${item.description || 'No description'}</div>
`;
            if (item.changes && item.changes.length > 0) {
                html += `<div style="margin-top: 8px;"><strong>Changes:</strong> ${item.changes.join(', ')}</div>`;
            }
            if (item.injuries && item.injuries.length > 0) {
                html += `<div style="margin-top: 8px;"><strong>Injuries:</strong> ${item.injuries.join(', ')}</div>`;
            }
            if (item.emotional_state) {
                html += `<div style="margin-top: 8px; font-style: italic;">Emotional state: ${item.emotional_state}</div>`;
            }
            html += `
            </div>
`;
        });
    }

    html += `</div>`;
    return html;
}

/**
 * Helper function to generate lookbook section for bible
 */
function generateLookbookSection(lookbookData) {
    let html = `<div style="background: #fafafa; padding: 20px; border-radius: 8px;">`;

    if (lookbookData.baseAppearance) {
        const base = lookbookData.baseAppearance;
        html += `
        <div style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 4px;">
            <strong>Base Appearance:</strong>
            <div style="margin-top: 8px;">Hair: ${base.hair || 'Not specified'}</div>
            <div>Makeup: ${base.makeup || 'Not specified'}</div>
            <div>Skin Tone: ${base.skinTone || 'Not specified'}</div>
        </div>
`;
    }

    if (lookbookData.looksByPhase && lookbookData.looksByPhase.length > 0) {
        html += `<div style="margin-top: 20px;"><strong>Looks by Phase:</strong></div>`;
        lookbookData.looksByPhase.forEach(phase => {
            html += `
            <div style="margin-top: 15px; padding: 15px; background: white; border-radius: 4px;">
                <div style="font-weight: bold; color: #c9a961;">${phase.phase || 'Unknown Phase'} (${phase.scenes || 'Scenes not specified'})</div>
                <div style="margin-top: 8px;">${phase.description || ''}</div>
                ${phase.hair ? `<div style="margin-top: 8px;"><strong>Hair:</strong> ${phase.hair}</div>` : ''}
                ${phase.makeup ? `<div style="margin-top: 8px;"><strong>Makeup:</strong> ${phase.makeup}</div>` : ''}
            </div>
`;
        });
    }

    html += `</div>`;
    return html;
}

/**
 * Helper function to download file
 */
function downloadFile(filename, content, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
window.mergeSelectedCharacters = mergeSelectedCharacters;
window.openToolsPanel = openToolsPanel;
window.closeToolsPanel = closeToolsPanel;
// New timeline and lookbook functions
window.generateCharacterTimelines = generateCharacterTimelines;
window.generateCharacterLookbooks = generateCharacterLookbooks;
window.exportTimeline = exportTimeline;
window.exportLookbook = exportLookbook;
window.exportBible = exportBible;

/**
 * Initialize comprehensive AI context after script import
 * This should be called after parseScreenplay and scene setup
 */
window.initializeAIContext = async function() {
    if (!state.scriptData || !state.scenes || state.scenes.length === 0) {
        console.warn('Cannot initialize AI context: No script data loaded');
        return false;
    }

    try {
        // Import narrative analyzer
        const { performComprehensiveAnalysis, populateFromMasterContext } = await import('./narrative-analyzer.js');

        // Get full script text
        const fullScriptText = state.scenes.map((scene, idx) => {
            return `SCENE ${idx + 1}
${scene.heading || ''}

${scene.text || scene.content || ''}`;
        }).join('\n\n═══════════════════════════\n\n');

        const scriptTitle = state.scriptData?.title || state.currentProject || 'Untitled';

        // Show progress
        showToast('Creating AI context...', 'info');

        // Perform comprehensive analysis
        const masterContext = await performComprehensiveAnalysis(fullScriptText, scriptTitle);

        if (masterContext) {
            // Populate application state from context
            populateFromMasterContext(masterContext);

            // Mark context as ready
            window.contextReady = true;

            showToast('AI context created successfully', 'success');
            console.log('✅ AI context initialized successfully');

            return true;
        }

        return false;
    } catch (error) {
        console.error('Failed to initialize AI context:', error);
        showToast('AI context creation failed: ' + error.message, 'error');
        return false;
    }
};

// ============================================================================
// WORKFLOW STATUS UPDATES
// ============================================================================

/**
 * Update workflow status in tools panel
 * Shows current state of script analysis and processing
 */
export function updateWorkflowStatus() {
    // Update script status
    const scriptStatusEl = document.getElementById('workflow-script-status');
    if (scriptStatusEl) {
        const hasScript = state.scenes && state.scenes.length > 0;
        const hasMasterContext = window.masterContext && window.masterContext.characters;
        
        if (hasMasterContext) {
            scriptStatusEl.innerHTML = `
                <span class="workflow-icon">✓</span>
                <span class="workflow-text">Script Analyzed</span>
            `;
            scriptStatusEl.style.color = 'var(--success)';
        } else if (hasScript) {
            scriptStatusEl.innerHTML = `
                <span class="workflow-icon">📄</span>
                <span class="workflow-text">Script Loaded</span>
            `;
            scriptStatusEl.style.color = 'var(--text-light)';
        } else {
            scriptStatusEl.innerHTML = `
                <span class="workflow-icon">📄</span>
                <span class="workflow-text">No Script Loaded</span>
            `;
            scriptStatusEl.style.color = 'var(--text-muted)';
        }
    }

    // Update characters status
    const charactersStatusEl = document.getElementById('workflow-characters-status');
    if (charactersStatusEl) {
        const characterCount = window.confirmedCharacters ? window.confirmedCharacters.length : 0;
        
        if (characterCount > 0) {
            charactersStatusEl.style.display = 'flex';
            charactersStatusEl.innerHTML = `
                <span class="workflow-icon">👥</span>
                <span class="workflow-text">Characters: ${characterCount}</span>
            `;
        } else {
            charactersStatusEl.style.display = 'none';
        }
    }

    // Update scenes status
    const scenesStatusEl = document.getElementById('workflow-scenes-status');
    if (scenesStatusEl) {
        const totalScenes = state.scenes ? state.scenes.length : 0;
        const processedScenes = state.scenes ? state.scenes.filter(s => s.processed || (s.synopsis && state.scriptTags[state.scenes.indexOf(s)])).length : 0;
        
        if (totalScenes > 0) {
            scenesStatusEl.style.display = 'flex';
            scenesStatusEl.innerHTML = `
                <span class="workflow-icon">🎬</span>
                <span class="workflow-text">Scenes: ${processedScenes}/${totalScenes} processed</span>
            `;
        } else {
            scenesStatusEl.style.display = 'none';
        }
    }

    // Enable/disable scene processing buttons
    const processCurrentBtn = document.getElementById('process-current-scene-btn');
    const processAllBtn = document.getElementById('process-all-remaining-btn');
    
    if (processCurrentBtn) {
        processCurrentBtn.disabled = !window.masterContext || state.currentScene === null;
    }
    
    if (processAllBtn) {
        processAllBtn.disabled = !window.masterContext || !state.scenes || state.scenes.length === 0;
    }
}

/**
 * Process current scene shortcut
 */
export function processCurrentScene() {
    if (state.currentScene !== null) {
        if (window.processThisScene) {
            window.processThisScene(state.currentScene);
        } else {
            import('./scene-processing.js').then(module => {
                module.processThisScene(state.currentScene);
            });
        }
    } else {
        alert('Please select a scene first');
    }
}

/**
 * Batch process unprocessed scenes (optional)
 */
export async function processAllRemaining() {
    if (!state.scenes || state.scenes.length === 0) {
        alert('No scenes to process');
        return;
    }

    const unprocessed = state.scenes.filter((s, i) => {
        const hasSynopsis = s.synopsis && s.synopsis.trim().length > 0;
        const hasTags = state.scriptTags[i] && state.scriptTags[i].length > 0;
        return !s.processed && !(hasSynopsis && hasTags);
    });

    if (unprocessed.length === 0) {
        alert('All scenes already processed');
        return;
    }

    if (!confirm(`Process ${unprocessed.length} remaining scenes?`)) {
        return;
    }

    // Import processing module
    const { processThisScene } = await import('./scene-processing.js');

    showProgressModal('Processing Scenes', `0 / ${unprocessed.length}`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < state.scenes.length; i++) {
        const scene = state.scenes[i];
        const hasSynopsis = scene.synopsis && scene.synopsis.trim().length > 0;
        const hasTags = state.scriptTags[i] && state.scriptTags[i].length > 0;
        
        if (!scene.processed && !(hasSynopsis && hasTags)) {
            try {
                updateProgressModal(
                    successCount + errorCount + 1,
                    unprocessed.length,
                    `Processing scene ${scene.number}...`,
                    false
                );

                await processThisScene(i);
                successCount++;
            } catch (error) {
                console.error(`Error processing scene ${scene.number}:`, error);
                errorCount++;
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    updateProgressModal(
        unprocessed.length,
        unprocessed.length,
        `Complete: ${successCount} successful, ${errorCount} failed`,
        true
    );

    setTimeout(() => {
        closeProgressModal();
        updateWorkflowStatus();
        renderSceneList();
    }, 2000);
}

// Expose functions globally
window.updateWorkflowStatus = updateWorkflowStatus;
window.processCurrentScene = processCurrentScene;
window.processAllRemaining = processAllRemaining;
