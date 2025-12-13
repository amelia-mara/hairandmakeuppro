/**
 * export-workflow.js
 * Workflow status, validation, and processing functions
 *
 * Responsibilities:
 * - Update workflow status in tools panel
 * - Process current scene
 * - Batch process remaining scenes
 * - Validate analysis data
 * - Initialize AI context
 */

import { state } from '../main.js';
import { renderSceneList } from '../scene-list.js';
import { showProgressModal, updateProgressModal, closeProgressModal, showTopLoadingBar, updateTopLoadingBar, closeTopLoadingBar, showToast } from './export-core.js';

/**
 * Update workflow status in tools panel
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
            import('../scene-processing.js').then(module => {
                module.processThisScene(state.currentScene);
            });
        }
    } else {
        alert('Please select a scene first');
    }
}

/**
 * Batch process unprocessed scenes
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

    const { processThisScene } = await import('../scene-processing.js');

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

/**
 * Validate analysis data structure
 * @returns {boolean} True if validation passes
 */
export function validateAnalysisData() {
    if (!window.masterContext) {
        console.error('No masterContext found');
        return false;
    }

    console.log('=== ANALYSIS VALIDATION ===');

    const characters = window.masterContext.characters;
    if (!characters || Object.keys(characters).length === 0) {
        console.error('No characters found in masterContext');
        return false;
    }

    let issues = [];

    Object.entries(characters).forEach(([name, data]) => {
        console.group(`Validating: ${name}`);

        if (!data.scriptDescriptions || data.scriptDescriptions.length === 0) {
            issues.push(`${name}: Missing script descriptions`);
            console.warn('No script descriptions');
        } else {
            console.log(`Script descriptions: ${data.scriptDescriptions.length}`);
        }

        const physical = data.physicalProfile || {};
        const hasPhysical = Object.values(physical).some(v => v !== null && v !== undefined);
        if (!hasPhysical) {
            console.warn('No physical profile data');
        } else {
            console.log('Physical profile:', Object.keys(physical).filter(k => physical[k]).join(', '));
        }

        if (!data.characterAnalysis?.role) {
            issues.push(`${name}: Missing role classification`);
            console.warn('No role defined');
        } else {
            console.log(`Role: ${data.characterAnalysis.role}`);
        }

        const presence = data.storyPresence || {};
        if (!presence.totalScenes && !data.sceneCount) {
            issues.push(`${name}: Missing scene count`);
            console.warn('No scene count');
        } else {
            const scenes = presence.totalScenes || data.sceneCount;
            console.log(`Appears in ${scenes} scenes`);
        }

        if (presence.scenesPresent && presence.scenesPresent.length > 0) {
            console.log(`Scene list: ${presence.scenesPresent.slice(0, 5).join(', ')}${presence.scenesPresent.length > 5 ? '...' : ''}`);
        }

        const elements = data.extractedElements || {};
        const hasExtracted = Object.values(elements).some(arr => Array.isArray(arr) && arr.length > 0);
        if (hasExtracted) {
            console.log('Extracted elements:', Object.keys(elements).filter(k => elements[k]?.length > 0).join(', '));
        }

        console.groupEnd();
    });

    console.group('Story Structure');
    const structure = window.masterContext.storyStructure;
    if (structure) {
        console.log(`Total days: ${structure.totalDays || 'Not specified'}`);
        console.log(`Timeline entries: ${structure.timeline?.length || 0}`);
        console.log(`Flashbacks: ${structure.flashbacks?.length || 0}`);
        console.log(`Time jumps: ${structure.timeJumps?.length || 0}`);
    } else {
        console.warn('No story structure data');
    }
    console.groupEnd();

    console.group('Additional Context');
    console.log(`Environments: ${Object.keys(window.masterContext.environments || {}).length}`);
    console.log(`Interactions: ${Object.keys(window.masterContext.interactions || {}).length}`);
    console.log(`Emotional Beats: ${Object.keys(window.masterContext.emotionalBeats || {}).length}`);
    console.log(`Dialogue References: ${Object.keys(window.masterContext.dialogueReferences || {}).length}`);
    console.log(`Major Events: ${(window.masterContext.majorEvents || []).length}`);
    console.groupEnd();

    if (issues.length > 0) {
        console.error('Issues found:', issues);
        console.warn('These issues may not be critical if the data wasn\'t present in the script');
        return false;
    }

    console.log('Analysis data structure valid');
    console.log(`Total characters: ${Object.keys(characters).length}`);
    console.log(`Featured: ${window.featuredCharacters?.length || 0}`);
    console.log(`Background: ${window.backgroundCharacters?.length || 0}`);

    return true;
}

/**
 * Log master context summary for debugging
 */
export function logMasterContextSummary() {
    if (!window.masterContext) {
        console.log('No master context available');
        return;
    }

    const mc = window.masterContext;
    console.log('MASTER CONTEXT SUMMARY');
    console.log('========================');
    console.log(`Title: ${mc.title || 'Untitled'}`);
    console.log(`Total Scenes: ${mc.totalScenes || 0}`);
    console.log(`\nCharacters: ${Object.keys(mc.characters || {}).length}`);
    console.log(`  Featured: ${window.featuredCharacters?.length || 0}`);
    console.log(`  Background: ${window.backgroundCharacters?.length || 0}`);
    console.log(`\nStory Structure:`);
    console.log(`  Days: ${mc.storyStructure?.totalDays || 0}`);
    console.log(`  Flashbacks: ${mc.storyStructure?.flashbacks?.length || 0}`);
    console.log(`  Time Jumps: ${mc.storyStructure?.timeJumps?.length || 0}`);
    console.log(`\nContext Data:`);
    console.log(`  Environments: ${Object.keys(mc.environments || {}).length}`);
    console.log(`  Interactions: ${Object.keys(mc.interactions || {}).length}`);
    console.log(`  Emotional Beats: ${Object.keys(mc.emotionalBeats || {}).length}`);
    console.log(`  Dialogue Refs: ${Object.keys(mc.dialogueReferences || {}).length}`);
    console.log(`  Major Events: ${(mc.majorEvents || []).length}`);
    console.log(`\nCreated: ${mc.createdAt || 'Unknown'}`);
    console.log(`Version: ${mc.analysisVersion || '1.0'}`);
}

/**
 * Initialize comprehensive AI context after script import
 * @returns {Promise<boolean>} True if successful
 */
export async function initializeAIContext() {
    if (!state.scriptData || !state.scenes || state.scenes.length === 0) {
        console.warn('Cannot initialize AI context: No script data loaded');
        return false;
    }

    try {
        const { performComprehensiveAnalysis, populateFromMasterContext } = await import('../narrative-analyzer.js');

        const fullScriptText = state.scenes.map((scene, idx) => {
            return `SCENE ${idx + 1}
${scene.heading || ''}

${scene.text || scene.content || ''}`;
        }).join('\n\n===========================\n\n');

        const scriptTitle = state.scriptData?.title || state.currentProject || 'Untitled';

        showTopLoadingBar('Creating AI Context', `Analyzing ${state.scenes.length} scenes...`, 0);

        updateTopLoadingBar('Creating AI Context', 'Performing comprehensive analysis...', 25);
        const masterContext = await performComprehensiveAnalysis(fullScriptText, scriptTitle);

        if (masterContext) {
            window.masterContext = masterContext;
            window.scriptMasterContext = masterContext;
            localStorage.setItem('masterContext', JSON.stringify(masterContext));
            localStorage.setItem('scriptMasterContext', JSON.stringify(masterContext));

            updateTopLoadingBar('Creating AI Context', 'Building character profiles...', 75);
            populateFromMasterContext(masterContext);

            window.contextReady = true;

            if (window.highlightCharacterNames) {
                console.log('Applying character name highlighting...');
                window.highlightCharacterNames();
            }

            updateTopLoadingBar('Analysis Complete', 'AI context created successfully', 100);
            showToast('AI context created successfully', 'success');
            console.log('AI context initialized successfully');

            closeTopLoadingBar();
            return true;
        }

        closeTopLoadingBar(0);
        return false;
    } catch (error) {
        console.error('Failed to initialize AI context:', error);
        showToast('AI context creation failed: ' + error.message, 'error');
        closeTopLoadingBar(0);
        return false;
    }
}

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
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.updateWorkflowStatus = updateWorkflowStatus;
window.processCurrentScene = processCurrentScene;
window.processAllRemaining = processAllRemaining;
window.validateAnalysisData = validateAnalysisData;
window.logMasterContextSummary = logMasterContextSummary;
window.initializeAIContext = initializeAIContext;
window.openToolsPanel = openToolsPanel;
window.closeToolsPanel = closeToolsPanel;

export default {
    updateWorkflowStatus,
    processCurrentScene,
    processAllRemaining,
    validateAnalysisData,
    logMasterContextSummary,
    initializeAIContext,
    openToolsPanel,
    closeToolsPanel
};
