/**
 * export-script-import.js
 * Script import and processing functionality
 *
 * Responsibilities:
 * - Open/close import modal
 * - Process imported script text
 * - Detect scenes from script
 * - Load script and render UI
 */

import { state, selectScene, showAutoSaveIndicator } from '../main.js';
import { renderScript } from '../script-display.js';
import { renderSceneList } from '../scene-list.js';
import { renderCharacterTabs, renderCharacterTabPanels } from '../character-panel.js';
import { detectTimeOfDay, detectIntExt, extractLocation } from '../utils.js';
import { showTopLoadingBar, updateTopLoadingBar, closeTopLoadingBar, showToast } from './export-core.js';
import { saveProject } from './export-project.js';

// Map of written-out number words to digits for scene heading normalization
const WORD_TO_NUM = {
    'ONE': '1', 'TWO': '2', 'THREE': '3', 'FOUR': '4', 'FIVE': '5',
    'SIX': '6', 'SEVEN': '7', 'EIGHT': '8', 'NINE': '9', 'TEN': '10',
    'ELEVEN': '11', 'TWELVE': '12', 'THIRTEEN': '13', 'FOURTEEN': '14',
    'FIFTEEN': '15', 'SIXTEEN': '16', 'SEVENTEEN': '17', 'EIGHTEEN': '18',
    'NINETEEN': '19', 'TWENTY': '20', 'TWENTY-ONE': '21', 'TWENTY-TWO': '22',
    'TWENTY-THREE': '23', 'TWENTY-FOUR': '24', 'TWENTY-FIVE': '25',
    'TWENTY-SIX': '26', 'TWENTY-SEVEN': '27', 'TWENTY-EIGHT': '28',
    'TWENTY-NINE': '29', 'THIRTY': '30', 'THIRTY-ONE': '31', 'THIRTY-TWO': '32',
    'THIRTY-THREE': '33', 'THIRTY-FOUR': '34', 'THIRTY-FIVE': '35',
    'THIRTY-SIX': '36', 'THIRTY-SEVEN': '37', 'THIRTY-EIGHT': '38',
    'THIRTY-NINE': '39', 'FORTY': '40', 'FORTY-ONE': '41', 'FORTY-TWO': '42',
    'FORTY-THREE': '43', 'FORTY-FOUR': '44', 'FORTY-FIVE': '45',
    'FORTY-SIX': '46', 'FORTY-SEVEN': '47', 'FORTY-EIGHT': '48',
    'FORTY-NINE': '49', 'FIFTY': '50',
};
const SCENE_WORD_KEYS_IMPORT = Object.keys(WORD_TO_NUM).sort((a, b) => b.length - a.length).join('|');
const SCENE_WORD_RE_IMPORT = new RegExp(`^\\s*SCENE\\s+(${SCENE_WORD_KEYS_IMPORT})\\s*[:\\-–—]?\\s*`, 'i');

/**
 * Normalize "SCENE WORD:" prefixes to numeric scene numbers.
 * e.g. "SCENE TWO: EXT. FARM LAND - DAY" → "2 EXT. FARM LAND - DAY"
 */
function normalizeScenePrefix(line) {
    const match = line.match(SCENE_WORD_RE_IMPORT);
    if (match) {
        const num = WORD_TO_NUM[match[1].toUpperCase()];
        if (num) return num + ' ' + line.slice(match[0].length);
    }
    const numMatch = line.match(/^\s*SCENE\s+(\d+[A-Z]?)\s*[:\-–—]?\s*/i);
    if (numMatch) {
        return numMatch[1] + ' ' + line.slice(numMatch[0].length);
    }
    return line;
}

// Dynamic import for script-analysis module (loaded when needed to avoid circular deps)
let scriptAnalysisModule = null;

/**
 * Get script analysis module (lazy loaded)
 * @returns {Promise<Object|null>} Script analysis module or null
 */
async function getScriptAnalysis() {
    if (!scriptAnalysisModule) {
        try {
            scriptAnalysisModule = await import('../script-analysis.js');
        } catch (e) {
            console.warn('Failed to load script-analysis module:', e);
            return null;
        }
    }
    return scriptAnalysisModule;
}

/**
 * Local fallback for character name extraction (used when module fails to load)
 * @param {string} scriptText - Script text
 * @returns {Set<string>} Set of character names
 */
function extractCharacterNamesLocal(scriptText) {
    const characters = new Set();

    // Pattern 1: Standard dialogue format (CHARACTER NAME on its own line)
    const dialoguePattern = /^([A-Z][A-Z\s\.'-]{1,30})\s*(?:\([^)]*\))?\s*$/gm;

    // Exclusion list
    const exclusions = new Set([
        'INT', 'EXT', 'FADE', 'CUT', 'DISSOLVE', 'CONTINUED', 'THE END',
        'TITLE', 'SUPER', 'INSERT', 'BACK TO', 'FLASHBACK', 'END FLASHBACK',
        'LATER', 'CONTINUOUS', 'SAME', 'MORNING', 'AFTERNOON', 'EVENING',
        'NIGHT', 'DAY', 'DAWN', 'DUSK', 'MOMENTS', 'THE NEXT'
    ]);

    let match;
    while ((match = dialoguePattern.exec(scriptText)) !== null) {
        let name = match[1].trim();
        // Remove V.O., O.S., (CONT'D) suffixes
        name = name.replace(/\s*\(?(V\.?O\.?|O\.?S\.?|CONT'?D?)\)?$/gi, '').trim();

        if (name.length >= 2 && name.length <= 40 && !exclusions.has(name) && !/^\d/.test(name)) {
            // Title case conversion
            const normalized = name.split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
            characters.add(normalized);
        }
    }

    return characters;
}

/**
 * Generate unique project ID
 * @returns {string} Project ID
 */
function generateProjectId() {
    return `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
        // Normalize "SCENE TWO:" style prefixes before matching
        const normalized = normalizeScenePrefix(trimmed);
        for (let pattern of patterns) {
            if (pattern.test(normalized)) {
                const sceneIndex = detected.length;
                detected.push({
                    number: sceneIndex + 1,
                    heading: normalized,
                    lineNumber: index,
                    synopsis: null,
                    storyDay: '',
                    timeOfDay: detectTimeOfDay(normalized, sceneIndex),
                    intExt: detectIntExt(normalized),
                    location: extractLocation(normalized, sceneIndex),
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
            console.warn(`  Warning: Scene ${scene.number} has no content!`);
        }
    });

    console.log(`Scene content extracted for ${detected.length} scenes`);
    return detected;
}

/**
 * Load script and render UI
 * @param {string} text - Script text
 */
export function loadScript(text) {
    // If project already has scenes, use those
    if (state.currentProject.scenes && Array.isArray(state.currentProject.scenes) && state.currentProject.scenes.length > 0) {
        state.scenes = state.currentProject.scenes;
    }

    // Render UI
    renderSceneList();
    renderScript();

    // CRITICAL: Auto-populate characters for all scenes from masterContext
    if (window.masterContext?.characters) {
        import('../tag-system.js').then(module => {
            if (module.populateCharactersForAllScenes) {
                module.populateCharactersForAllScenes();
            }
        });
    }

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
 * Process script from import modal
 * Uses multi-pass AI analysis for comprehensive script breakdown
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
    console.log(`Script length: ${text.length} characters`);

    // CRITICAL: Initialize state arrays if needed
    if (!state.continuityEvents || !Array.isArray(state.continuityEvents)) {
        console.log('Initializing continuityEvents array');
        state.continuityEvents = [];
    }

    if (!Array.isArray(state.scenes)) {
        state.scenes = [];
    }

    if (!state.confirmedCharacters || !(state.confirmedCharacters instanceof Set)) {
        state.confirmedCharacters = new Set();
    }

    // Store detected but unconfirmed characters
    if (!state.detectedCharacters) {
        state.detectedCharacters = [];
    }

    // Store script text
    if (!state.currentProject) {
        state.currentProject = {
            id: generateProjectId(),
            name: 'Untitled Project',
            created: Date.now()
        };
    }

    // Normalize text to handle "SCENE TWO:" style prefixes before detection
    const normalizedText = text.split('\n').map(line => normalizeScenePrefix(line)).join('\n');
    state.currentProject.scriptContent = normalizedText;

    // Detect scenes
    state.scenes = detectScenes(normalizedText);
    console.log(`Found ${state.scenes.length} scenes`);

    // AUTO-FILL: Apply story day detection and scene type detection immediately
    try {
        const scriptAnalysis = await getScriptAnalysis();
        if (scriptAnalysis) {
            // Apply story day detection to all scenes
            if (scriptAnalysis.detectStoryDays) {
                console.log('Auto-filling story days...');
                scriptAnalysis.detectStoryDays(text, state.scenes);
                console.log('Story days auto-filled for all scenes');
            }
            // Apply scene type detection to all scenes
            if (scriptAnalysis.detectAllSceneTypes) {
                console.log('Auto-detecting scene types...');
                scriptAnalysis.detectAllSceneTypes(state.scenes);
                console.log('Scene types auto-detected for all scenes');
            }
        }
    } catch (err) {
        console.warn('Auto-detection failed (non-critical):', err);
    }

    // CRITICAL: Update currentProject.scenes with the auto-detected data
    // This ensures loadScript() doesn't overwrite with old localStorage data
    state.currentProject.scenes = state.scenes;

    // Close import modal and show progress
    closeImportModal();
    showTopLoadingBar('Analyzing Script', `Analyzing ${state.scenes.length} scenes...`, 0);

    try {
        // Load script analysis module dynamically
        const scriptAnalysis = await getScriptAnalysis();

        if (scriptAnalysis && scriptAnalysis.analyzeScript) {
            // Use new multi-pass analysis system
            const progressCallback = (message, progress) => {
                updateTopLoadingBar('Analyzing Script', message, progress);
            };

            const masterContext = await scriptAnalysis.analyzeScript(text, state.scenes, progressCallback);

            // Store master context in all locations for compatibility
            window.masterContext = masterContext;
            window.scriptMasterContext = masterContext;
            localStorage.setItem('masterContext', JSON.stringify(masterContext));
            localStorage.setItem('scriptMasterContext', JSON.stringify(masterContext));

            // Store detected characters for confirmation step
            if (masterContext.characters) {
                // Filter function to exclude scene headings and non-character entries
                const isValidCharacter = (name) => {
                    if (!name || typeof name !== 'string') return false;
                    const upperName = name.toUpperCase().trim();

                    // Exclude scene heading patterns
                    if (/^(INT\.?|EXT\.?|I\/E\.?|INT\.?\/EXT\.?)\s/i.test(name)) return false;

                    // Exclude if contains scene heading keywords with location patterns
                    if (/\b(INT|EXT)\b.*\s*-\s*(DAY|NIGHT|MORNING|EVENING|DAWN|DUSK|LATER|CONTINUOUS)/i.test(name)) return false;

                    // Exclude common non-character words
                    const excludeWords = [
                        'FADE IN', 'FADE OUT', 'CUT TO', 'DISSOLVE TO', 'THE END',
                        'CONTINUED', 'MORE', 'CONT\'D', 'TITLE CARD', 'SUPER',
                        'FLASHBACK', 'END FLASHBACK', 'INTERCUT', 'MONTAGE',
                        'LATER', 'CONTINUOUS', 'SAME TIME', 'MOMENTS LATER'
                    ];
                    if (excludeWords.some(word => upperName === word || upperName.startsWith(word + ' '))) return false;

                    // Exclude if it's just a time of day or setting
                    if (/^(DAY|NIGHT|MORNING|EVENING|DAWN|DUSK|NOON|MIDNIGHT)$/i.test(name)) return false;

                    return true;
                };

                state.detectedCharacters = Object.entries(masterContext.characters)
                    .filter(([name]) => isValidCharacter(name))
                    .map(([name, data]) => ({
                        name: name,
                        category: data.category || data.characterAnalysis?.role?.toUpperCase() || 'SUPPORTING',
                        sceneCount: data.sceneCount || data.storyPresence?.totalScenes || 0,
                        firstAppearance: data.firstAppearance || data.storyPresence?.firstAppearance || 1,
                        lastAppearance: data.lastAppearance || data.storyPresence?.lastAppearance || state.scenes.length,
                        hasDialogue: data.storyPresence?.hasDialogue !== false,
                        physicalDescription: data.scriptDescriptions?.[0]?.text || '',
                        scenesPresent: data.scenesPresent || data.storyPresence?.scenesPresent || [],
                        selected: true,
                        originalData: data
                    }));

                // Sort by scene count descending
                state.detectedCharacters.sort((a, b) => b.sceneCount - a.sceneCount);

                console.log(`Detected ${state.detectedCharacters.length} characters for confirmation`);
            }

            closeTopLoadingBar();

            // Show character confirmation modal
            const { showCharacterConfirmationModal } = await import('./export-character-confirmation.js');
            showCharacterConfirmationModal();
        } else {
            // Fallback to original deep analysis if module failed to load
            throw new Error('Script analysis module not available');
        }

    } catch (error) {
        console.error('Analysis failed:', error);
        closeTopLoadingBar();

        // Try fallback processing using local character extraction
        const characters = extractCharacterNamesLocal(text);
        state.detectedCharacters = Array.from(characters).map(name => ({
            name: name,
            category: 'SUPPORTING',
            sceneCount: 0,
            selected: true
        }));

        showToast('Analysis failed. Basic character detection used. Please review characters.', 'warning');

        const { showCharacterConfirmationModal } = await import('./export-character-confirmation.js');
        showCharacterConfirmationModal();
    }

    // Load and render script display
    loadScript(text);

    // Update workflow status
    if (window.updateWorkflowStatus) {
        window.updateWorkflowStatus();
    }
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.openImportModal = openImportModal;
window.closeImportModal = closeImportModal;
window.processScript = processScript;
window.detectScenes = detectScenes;

export default {
    openImportModal,
    closeImportModal,
    processScript,
    detectScenes,
    loadScript
};
