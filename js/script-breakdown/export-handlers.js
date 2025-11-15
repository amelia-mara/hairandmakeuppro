/**
 * export-handlers.js - STREAMLINED
 * Core import/export and project management
 */

import { state, selectScene, showAutoSaveIndicator } from './main.js';
import { renderScript } from './script-display.js';
import { renderSceneList } from './scene-list.js';
import { renderCharacterTabs, renderCharacterTabPanels } from './character-panel.js';
import { detectTimeOfDay, detectIntExt, extractLocation } from './utils.js';
import { callAI } from './ai-integration.js';
import { renderAllHighlights } from './tag-system.js';
import { extractAllCharactersFromScript, buildCharacterProfile } from './character-extraction.js';

// ============================================================================
// CORE EXPORT/IMPORT
// ============================================================================

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

export function openImportModal() {
    const modal = document.getElementById('import-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    const scriptInput = document.getElementById('script-input');
    if (scriptInput && state.currentProject?.scriptContent) {
        scriptInput.value = state.currentProject.scriptContent;
    }
}

export function closeImportModal() {
    const modal = document.getElementById('import-modal');
    if (modal) modal.style.display = 'none';
}

// ============================================================================
// SCRIPT PROCESSING - CRITICAL HYBRID APPROACH
// ============================================================================

export async function processScript() {
    const scriptInput = document.getElementById('script-input');
    if (!scriptInput?.value.trim()) {
        alert('Please paste your screenplay');
        return;
    }

    const text = scriptInput.value;

    if (!state.currentProject) {
        state.currentProject = {
            id: generateProjectId(),
            name: 'Untitled Project',
            created: Date.now()
        };
    }

    state.currentProject.scriptContent = text;
    state.scenes = detectScenes(text);

    showTopLoadingBar('Analyzing Script', `Analyzing ${state.scenes.length} scenes...`, 0);

    try {
        updateTopLoadingBar('Analyzing Script', 'Performing deep narrative analysis...', 25);
        const masterContext = await performDeepAnalysis(text, state.scenes);

        updateTopLoadingBar('Analyzing Script', 'Building character profiles...', 50);

        window.masterContext = masterContext;
        window.scriptMasterContext = masterContext;
        localStorage.setItem('masterContext', JSON.stringify(masterContext));
        localStorage.setItem('scriptMasterContext', JSON.stringify(masterContext));

        updateTopLoadingBar('Analyzing Script', 'Populating initial data...', 75);
        populateInitialData(masterContext);

        updateTopLoadingBar('Analyzing Script', 'Creating character tabs...', 90);
        const { renderCharacterTabs, renderCharacterTabPanels } = await import('./character-panel.js');
        renderCharacterTabs();
        renderCharacterTabPanels();

        updateTopLoadingBar('Analysis Complete', `${state.scenes.length} scenes processed`, 100);
        showToast('Script imported successfully', 'success');

    } catch (error) {
        showToast('Failed to analyze script', 'warning');
        closeTopLoadingBar(0);
    }

    loadScript(text);
    closeTopLoadingBar();

    if (window.updateWorkflowStatus) {
        updateWorkflowStatus();
    }

    setTimeout(() => closeImportModal(), 500);
}

async function performDeepAnalysis(scriptText, scenes) {
    const extractedCharacters = extractAllCharactersFromScript(scriptText, scenes);
    const characterNames = extractedCharacters.characterNames;
    const characterData = extractedCharacters.characterData;

    const characters = {};
    characterNames.forEach(charName => {
        characters[charName] = buildCharacterProfile(charName, extractedCharacters);
    });

    const truncatedScript = scriptText.length > 80000
        ? scriptText.substring(0, 80000) + '\n\n[Script truncated for analysis...]'
        : scriptText;

    const prompt = `
Perform a COMPREHENSIVE analysis of this screenplay for HAIR & MAKEUP DEPARTMENT continuity tracking.
This analysis will be the PRIMARY SOURCE and MASTER CONTEXT for all future operations.
Extract EVERYTHING available about each character from the script text.

SCREENPLAY (Total Scenes: ${scenes.length}):
${truncatedScript}

Return detailed JSON with this EXACT structure (be extremely thorough):

{
    "title": "script title",
    "totalScenes": ${scenes.length},
    "storyStructure": {
        "totalDays": number,
        "timeline": [{"day": "Day 1", "scenes": [1, 2, 3], "description": "Introduction"}]
    },
    "characters": {
        "CHARACTER_NAME": {
            "scriptDescriptions": [{"text": "EXACT quote", "sceneNumber": 1, "type": "introduction"}],
            "physicalProfile": {"age": "", "gender": "", "build": "", "hairColor": "", "eyeColor": "", "skin": ""},
            "characterAnalysis": {"role": "", "occupation": "", "personality": "", "arc": ""},
            "visualProfile": {"overallVibe": "", "styleChoices": "", "groomingHabits": ""},
            "storyPresence": {"firstAppearance": 1, "lastAppearance": 10, "totalScenes": 5, "scenesPresent": [1,5,10]},
            "extractedElements": {"mentionedWardrobe": [], "mentionedAppearanceChanges": [], "physicalActions": []},
            "continuityNotes": {"keyLooks": "", "transformations": "", "signature": ""}
        }
    },
    "environments": {},
    "interactions": {},
    "emotionalBeats": {},
    "majorEvents": []
}

CRITICAL: Extract EXACT QUOTES, keep character names EXACTLY as they appear, be EXTREMELY thorough.
Return ONLY valid JSON (no markdown, no code fences).
`;

    try {
        const response = await callAI(prompt, 8000);
        let cleanedResponse = response.trim();
        if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No valid JSON found in AI response');
        }

        const aiMasterContext = JSON.parse(jsonMatch[0]);

        if (!aiMasterContext.characters) aiMasterContext.characters = {};
        if (!aiMasterContext.environments) aiMasterContext.environments = {};
        if (!aiMasterContext.storyStructure) aiMasterContext.storyStructure = { totalDays: 1, timeline: [] };

        const mergedCharacters = { ...characters };

        Object.entries(aiMasterContext.characters || {}).forEach(([aiCharName, aiCharData]) => {
            let matchedName = null;

            if (mergedCharacters[aiCharName]) {
                matchedName = aiCharName;
            } else {
                for (const extractedName of characterNames) {
                    if (extractedName.toLowerCase() === aiCharName.toLowerCase()) {
                        matchedName = extractedName;
                        break;
                    }
                }
            }

            if (matchedName) {
                const baseProfile = mergedCharacters[matchedName];
                mergedCharacters[matchedName] = {
                    ...baseProfile,
                    scriptDescriptions: aiCharData.scriptDescriptions?.length > 0 ? aiCharData.scriptDescriptions : baseProfile.scriptDescriptions,
                    physicalProfile: { ...baseProfile.physicalProfile, ...aiCharData.physicalProfile },
                    characterAnalysis: { ...baseProfile.characterAnalysis, ...aiCharData.characterAnalysis, role: baseProfile.characterAnalysis.role },
                    visualProfile: { ...baseProfile.visualProfile, ...aiCharData.visualProfile },
                    extractedElements: { ...baseProfile.extractedElements, ...aiCharData.extractedElements },
                    continuityNotes: { ...baseProfile.continuityNotes, ...aiCharData.continuityNotes }
                };
            } else {
                mergedCharacters[aiCharName] = aiCharData;
            }
        });

        const masterContext = {
            title: aiMasterContext.title || 'Untitled Script',
            totalScenes: scenes.length,
            characters: mergedCharacters,
            storyStructure: aiMasterContext.storyStructure,
            environments: aiMasterContext.environments || {},
            interactions: aiMasterContext.interactions || {},
            emotionalBeats: aiMasterContext.emotionalBeats || {},
            dialogueReferences: aiMasterContext.dialogueReferences || {},
            majorEvents: aiMasterContext.majorEvents || [],
            continuityNotes: aiMasterContext.continuityNotes || '',
            createdAt: new Date().toISOString(),
            analysisVersion: '3.0-hybrid'
        };

        return masterContext;

    } catch (error) {
        const storyStructure = {
            totalDays: Math.ceil(scenes.length / 10) || 1,
            timeline: []
        };

        const scenesPerDay = Math.ceil(scenes.length / storyStructure.totalDays);
        for (let day = 1; day <= storyStructure.totalDays; day++) {
            const startScene = ((day - 1) * scenesPerDay) + 1;
            const endScene = Math.min(day * scenesPerDay, scenes.length);
            const dayScenes = [];
            for (let s = startScene; s <= endScene; s++) {
                dayScenes.push(s);
            }
            storyStructure.timeline.push({
                day: `Day ${day}`,
                scenes: dayScenes,
                description: `Scenes ${startScene}-${endScene}`
            });
        }

        return {
            title: 'Untitled Script',
            totalScenes: scenes.length,
            characters: characters,
            storyStructure: storyStructure,
            environments: {},
            interactions: {},
            emotionalBeats: {},
            dialogueReferences: {},
            majorEvents: [],
            continuityNotes: 'Pattern extraction only',
            createdAt: new Date().toISOString(),
            analysisVersion: '3.0-pattern-only'
        };
    }
}

function populateInitialData(masterContext) {
    if (masterContext.characters) {
        const characterNames = Object.keys(masterContext.characters);
        window.confirmedCharacters = characterNames;
        state.confirmedCharacters = new Set(characterNames);

        window.featuredCharacters = [];
        window.backgroundCharacters = [];

        Object.entries(masterContext.characters).forEach(([name, data]) => {
            const role = data.characterAnalysis?.role?.toLowerCase();
            const hasDialogue = data.storyPresence?.hasDialogue;
            const sceneCount = data.storyPresence?.totalScenes || data.sceneCount || 0;

            if ((role === 'protagonist' || role === 'antagonist' || role === 'supporting' || role === 'featured') &&
                hasDialogue && sceneCount >= 2) {
                window.featuredCharacters.push(name);
            } else {
                window.backgroundCharacters.push(name);
            }
        });

        state.featuredCharacters = window.featuredCharacters;
        state.backgroundCharacters = window.backgroundCharacters;

        window.characterImportance = {};
        window.characterProfiles = {};

        Object.entries(masterContext.characters).forEach(([name, data]) => {
            window.characterImportance[name] = {
                role: data.characterAnalysis?.role || 'supporting',
                sceneCount: data.sceneCount || 0,
                firstAppearance: data.firstAppearance || 1,
                lastAppearance: data.lastAppearance || 1
            };

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
    }

    if (masterContext.storyStructure) {
        window.storyTimeline = masterContext.storyStructure;
        if (masterContext.storyStructure.timeline) {
            masterContext.storyStructure.timeline.forEach(dayData => {
                dayData.scenes.forEach((sceneNum, idx) => {
                    const sceneIndex = sceneNum - 1;
                    if (!state.sceneTimeline[sceneIndex]) {
                        state.sceneTimeline[sceneIndex] = {};
                    }
                    state.sceneTimeline[sceneIndex].day = dayData.day;
                    state.sceneTimeline[sceneIndex].time = dayData.timeProgression?.[idx] || '';
                });
            });
        }
    }
}

// ============================================================================
// SCENE DETECTION
// ============================================================================

export function detectScenes(text) {
    const scenes = [];
    const lines = text.split('\n');
    let currentScene = null;
    let sceneNumber = 1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if ((trimmed.startsWith('INT.') || trimmed.startsWith('EXT.') ||
             trimmed.startsWith('INT ') || trimmed.startsWith('EXT ')) &&
            trimmed.length > 5) {

            if (currentScene) {
                scenes.push(currentScene);
            }

            currentScene = {
                number: sceneNumber++,
                heading: trimmed,
                content: '',
                intExt: detectIntExt(trimmed),
                timeOfDay: detectTimeOfDay(trimmed),
                location: extractLocation(trimmed)
            };
        } else if (currentScene) {
            currentScene.content += line + '\n';
        }
    }

    if (currentScene) {
        scenes.push(currentScene);
    }

    return scenes;
}

function loadScript(scriptText) {
    renderScript();
    renderSceneList();
    if (state.scenes.length > 0) {
        selectScene(0);
    }
}

// ============================================================================
// PROJECT MANAGEMENT
// ============================================================================

export function saveProject() {
    const projectData = {
        currentProject: state.currentProject,
        scenes: state.scenes,
        sceneBreakdowns: state.sceneBreakdowns,
        castProfiles: state.castProfiles,
        characterStates: state.characterStates,
        characterLooks: state.characterLooks,
        lookTransitions: state.lookTransitions,
        continuityEvents: state.continuityEvents,
        sceneTimeline: state.sceneTimeline,
        scriptTags: state.scriptTags,
        confirmedCharacters: Array.from(state.confirmedCharacters || []),
        featuredCharacters: state.featuredCharacters || [],
        backgroundCharacters: state.backgroundCharacters || [],
        lastSaved: Date.now()
    };

    try {
        localStorage.setItem('scriptBreakdownProject', JSON.stringify(projectData));
        return true;
    } catch (error) {
        return false;
    }
}

export function loadProjectData() {
    try {
        const saved = localStorage.getItem('scriptBreakdownProject');
        if (!saved) return;

        const data = JSON.parse(saved);

        state.currentProject = data.currentProject || null;
        state.scenes = data.scenes || [];
        state.sceneBreakdowns = data.sceneBreakdowns || {};
        state.castProfiles = data.castProfiles || {};
        state.characterStates = data.characterStates || {};
        state.characterLooks = data.characterLooks || {};
        state.lookTransitions = data.lookTransitions || [];
        state.continuityEvents = data.continuityEvents || {};
        state.sceneTimeline = data.sceneTimeline || {};
        state.scriptTags = data.scriptTags || {};
        state.confirmedCharacters = new Set(data.confirmedCharacters || []);
        state.featuredCharacters = data.featuredCharacters || [];
        state.backgroundCharacters = data.backgroundCharacters || [];

        window.confirmedCharacters = data.confirmedCharacters || [];
        window.featuredCharacters = data.featuredCharacters || [];
        window.backgroundCharacters = data.backgroundCharacters || [];

        const masterContextStored = localStorage.getItem('masterContext');
        if (masterContextStored) {
            try {
                window.masterContext = JSON.parse(masterContextStored);
                window.scriptMasterContext = window.masterContext;
            } catch (e) {}
        }

    } catch (error) {}
}

export async function importProjectFile(file) {
    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.scenes || !Array.isArray(data.scenes)) {
            throw new Error('Invalid project file format');
        }

        state.currentProject = data.project || { id: generateProjectId(), name: file.name.replace('.json', ''), created: Date.now() };
        state.scenes = data.scenes;
        state.sceneBreakdowns = data.sceneBreakdowns || {};
        state.castProfiles = data.castProfiles || {};
        state.characterStates = data.characterStates || {};
        state.characterLooks = data.characterLooks || {};
        state.lookTransitions = data.lookTransitions || [];
        state.continuityEvents = data.continuityEvents || {};
        state.sceneTimeline = data.sceneTimeline || {};
        state.scriptTags = data.scriptTags || {};

        saveProject();
        renderScript();
        renderSceneList();
        if (state.scenes.length > 0) {
            selectScene(0);
        }

        showToast('Project imported successfully', 'success');

    } catch (error) {
        alert('Failed to import project: ' + error.message);
    }
}

export function createNewProject() {
    if (!confirm('Create new project? Current work will be saved.')) return;

    saveProject();

    state.currentProject = {
        id: generateProjectId(),
        name: 'New Project',
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
    state.confirmedCharacters = new Set();

    saveProject();
    renderScript();
    renderSceneList();
    openImportModal();
}

export function renameProject(newName) {
    if (!state.currentProject) return;
    state.currentProject.name = newName;
    saveProject();
}

function generateProjectId() {
    return 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ============================================================================
// CHARACTER REVIEW
// ============================================================================

export function reviewCharacters() {
    const modal = document.getElementById('character-review-modal');
    if (!modal) return;

    const list = document.getElementById('character-review-list');
    if (!list) return;

    const allCharacters = window.confirmedCharacters || [];

    list.innerHTML = allCharacters.map(char => `
        <div class="character-review-item">
            <label>
                <input type="checkbox" class="char-checkbox" value="${escapeHtml(char)}" checked>
                <span>${escapeHtml(char)}</span>
            </label>
        </div>
    `).join('');

    modal.style.display = 'flex';
}

export function closeCharacterReviewModal() {
    const modal = document.getElementById('character-review-modal');
    if (modal) modal.style.display = 'none';
}

export function selectAllCharacters() {
    document.querySelectorAll('.char-checkbox').forEach(cb => cb.checked = true);
}

export function deselectAllCharacters() {
    document.querySelectorAll('.char-checkbox').forEach(cb => cb.checked = false);
}

export function confirmCharacterSelection() {
    const selected = [];
    document.querySelectorAll('.char-checkbox:checked').forEach(cb => {
        selected.push(cb.value);
    });

    window.confirmedCharacters = selected;
    state.confirmedCharacters = new Set(selected);

    saveProject();
    closeCharacterReviewModal();

    renderCharacterTabs();
    renderCharacterTabPanels();

    showToast(`${selected.length} characters confirmed`, 'success');
}

export function mergeSelectedCharacters() {
    alert('Character merging feature coming soon');
}

// ============================================================================
// UI HELPERS
// ============================================================================

export function openToolsPanel() {
    const panel = document.getElementById('tools-panel');
    const overlay = document.getElementById('tools-panel-overlay');
    if (panel) panel.classList.add('active');
    if (overlay) overlay.classList.add('active');
}

export function closeToolsPanel() {
    const panel = document.getElementById('tools-panel');
    const overlay = document.getElementById('tools-panel-overlay');
    if (panel) panel.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

function showTopLoadingBar(title, message, progress) {
    const bar = document.getElementById('top-loading-bar');
    const progressBar = document.getElementById('top-loading-progress');
    const messageEl = document.getElementById('top-loading-message');

    if (bar) {
        bar.style.display = 'flex';
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (messageEl) messageEl.textContent = message;
    }
}

function updateTopLoadingBar(title, message, progress) {
    const progressBar = document.getElementById('top-loading-progress');
    const messageEl = document.getElementById('top-loading-message');

    if (progressBar) progressBar.style.width = `${progress}%`;
    if (messageEl) messageEl.textContent = message;
}

function closeTopLoadingBar(delay = 1500) {
    setTimeout(() => {
        const bar = document.getElementById('top-loading-bar');
        if (bar) bar.style.display = 'none';
    }, delay);
}

function showToast(message, type = 'info') {
    const existingToasts = document.querySelectorAll('.toast-notification');
    existingToasts.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; bottom: 24px; right: 24px; padding: 12px 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white; border-radius: 8px; font-size: 0.9em; font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000;
    `;

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// TIMELINE & LOOKBOOK GENERATORS
// ============================================================================

export async function generateCharacterTimelines() {
    if (!window.confirmedCharacters || window.confirmedCharacters.length === 0) {
        alert('No characters confirmed. Please review characters first.');
        return;
    }

    showToast('Generating timelines...', 'info');

    try {
        const timelines = {};
        for (const charName of window.confirmedCharacters) {
            const charData = window.masterContext?.characters?.[charName];
            if (charData) {
                timelines[charName] = {
                    scenes: charData.scenesPresent || [],
                    firstAppearance: charData.firstAppearance,
                    lastAppearance: charData.lastAppearance,
                    totalScenes: charData.sceneCount
                };
            }
        }

        window.generatedTimelines = timelines;
        showToast('Timelines generated successfully', 'success');

    } catch (error) {
        showToast('Failed to generate timelines', 'error');
    }
}

export async function generateCharacterLookbooks() {
    if (!window.confirmedCharacters || window.confirmedCharacters.length === 0) {
        alert('No characters confirmed. Please review characters first.');
        return;
    }

    showToast('Generating lookbooks...', 'info');

    try {
        const lookbooks = {};
        for (const charName of window.confirmedCharacters) {
            const charData = window.masterContext?.characters?.[charName];
            if (charData) {
                lookbooks[charName] = {
                    name: charName,
                    physicalProfile: charData.physicalProfile || {},
                    visualProfile: charData.visualProfile || {},
                    scriptDescriptions: charData.scriptDescriptions || [],
                    continuityNotes: charData.continuityNotes || {}
                };
            }
        }

        window.generatedLookbooks = lookbooks;
        showToast('Lookbooks generated successfully', 'success');

    } catch (error) {
        showToast('Failed to generate lookbooks', 'error');
    }
}

export function exportTimeline() {
    if (!window.generatedTimelines) {
        alert('No timelines generated. Please generate timelines first.');
        return;
    }

    const data = JSON.stringify(window.generatedTimelines, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'character-timelines.json';
    a.click();
    URL.revokeObjectURL(url);
}

export function exportLookbook() {
    if (!window.generatedLookbooks) {
        alert('No lookbooks generated. Please generate lookbooks first.');
        return;
    }

    const data = JSON.stringify(window.generatedLookbooks, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'character-lookbooks.json';
    a.click();
    URL.revokeObjectURL(url);
}

export function exportBible() {
    const bible = {
        project: state.currentProject,
        masterContext: window.masterContext,
        scenes: state.scenes,
        characters: window.confirmedCharacters,
        timelines: window.generatedTimelines,
        lookbooks: window.generatedLookbooks,
        exportDate: new Date().toISOString()
    };

    const data = JSON.stringify(bible, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.currentProject?.name || 'project').replace(/\s+/g, '-')}-bible.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================================================
// WORKFLOW STATUS
// ============================================================================

export function updateWorkflowStatus() {
    const scriptStatus = document.getElementById('workflow-script-status');
    const charactersStatus = document.getElementById('workflow-characters-status');
    const scenesStatus = document.getElementById('workflow-scenes-status');

    if (scriptStatus) {
        if (state.scenes.length > 0) {
            scriptStatus.innerHTML = `<span class="workflow-icon">✅</span><span class="workflow-text">Script Loaded (${state.scenes.length} scenes)</span>`;
            scriptStatus.style.display = 'flex';
        }
    }

    if (charactersStatus) {
        const charCount = window.confirmedCharacters?.length || 0;
        if (charCount > 0) {
            charactersStatus.innerHTML = `<span class="workflow-icon">👥</span><span class="workflow-text">Characters: ${charCount}</span>`;
            charactersStatus.style.display = 'flex';
        }
    }

    if (scenesStatus) {
        const processedCount = state.scenes.filter(s => s.processed).length;
        if (state.scenes.length > 0) {
            scenesStatus.innerHTML = `<span class="workflow-icon">🎬</span><span class="workflow-text">Scenes: ${processedCount}/${state.scenes.length} processed</span>`;
            scenesStatus.style.display = 'flex';
        }
    }
}

export function processCurrentScene() {
    if (state.currentScene === null) {
        alert('Please select a scene first');
        return;
    }

    import('./scene-processing.js').then(module => {
        module.processThisScene(state.currentScene);
    });
}

export async function processAllRemaining() {
    const unprocessed = state.scenes.filter((s, i) => !s.processed);
    if (unprocessed.length === 0) {
        alert('All scenes already processed');
        return;
    }

    if (!confirm(`Process ${unprocessed.length} remaining scenes?`)) return;

    showToast(`Processing ${unprocessed.length} scenes...`, 'info');

    for (let i = 0; i < state.scenes.length; i++) {
        if (!state.scenes[i].processed) {
            await import('./scene-processing.js').then(module => {
                return module.processThisScene(i);
            });
        }
    }

    showToast('All scenes processed', 'success');
}

// ============================================================================
// WINDOW EXPORTS
// ============================================================================

window.showTopLoadingBar = showTopLoadingBar;
window.updateTopLoadingBar = updateTopLoadingBar;
window.closeTopLoadingBar = closeTopLoadingBar;
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
window.generateCharacterTimelines = generateCharacterTimelines;
window.generateCharacterLookbooks = generateCharacterLookbooks;
window.exportTimeline = exportTimeline;
window.exportLookbook = exportLookbook;
window.exportBible = exportBible;
window.updateWorkflowStatus = updateWorkflowStatus;
window.processCurrentScene = processCurrentScene;
window.processAllRemaining = processAllRemaining;
