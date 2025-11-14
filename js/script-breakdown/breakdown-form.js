/**
 * breakdown-form.js
 * Right panel scene breakdown form
 *
 * Responsibilities:
 * - Render cast list with character details
 * - Render elements (hair, makeup, SFX, wardrobe, etc.)
 * - Handle add/remove elements
 * - Display scene metadata and navigation
 * - Show look states and transition indicators
 * - Handle AI fill for character fields
 * - Integrate with enhanced workflow manager
 */

import { state } from './main.js';
import { formatSceneRange, getComplexityIcon, extractLocation, detectTimeOfDay, detectIntExt } from './utils.js';
import { detectAIElements, generateDescription } from './ai-integration.js';
import './breakdown-manager.js'; // Import enhanced workflow manager
import { renderHybridSceneBreakdown } from './hybrid-renderer.js'; // Import hybrid breakdown renderer

// Element categories
const categories = [
    { id: 'cast', name: 'Cast Members', color: '#fbbf24' },
    { id: 'hair', name: 'Hair', color: '#a855f7' },
    { id: 'makeup', name: 'Makeup (Beauty)', color: '#ec4899' },
    { id: 'sfx', name: 'SFX Makeup', color: '#ef4444' },
    { id: 'health', name: 'Health/Illness', color: '#f59e0b' },
    { id: 'injuries', name: 'Injuries/Wounds', color: '#dc2626' },
    { id: 'stunts', name: 'Stunts/Action', color: '#f97316' },
    { id: 'weather', name: 'Weather Effects', color: '#38bdf8' },
    { id: 'wardrobe', name: 'Costume/Wardrobe', color: '#34d399' },
    { id: 'extras', name: 'Supporting Artists', color: '#9ca3af' }
];

// Current element category for add modal
let currentElementCategory = null;

/**
 * Render the breakdown panel for the current scene
 * Uses comprehensive single-view breakdown (no tabs)
 */
export function renderBreakdownPanel() {
    const container = document.getElementById('breakdown-panel');
    if (!container) return;

    if (state.currentScene === null) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-title">Select a Scene</div>
                <div class="empty-desc">Choose a scene to view and edit its breakdown</div>
            </div>
        `;
        return;
    }

    // Always use comprehensive breakdown rendering with data collection
    renderSceneBreakdown(state.currentScene);
}

/**
 * Check if hybrid mode should be used
 * @returns {boolean} True if hybrid mode should be used
 */
function shouldUseHybridMode() {
    // Check user preference
    const hybridModeEnabled = localStorage.getItem('useHybridMode') === 'true';

    // Check if hybrid manager exists and has suggestions
    const hasHybridManager = typeof window.hybridBreakdownManager !== 'undefined';
    if (!hasHybridManager) return false;

    // If hybrid mode is enabled, use it
    if (hybridModeEnabled) return true;

    // Auto-enable if there are suggestions for current scene
    if (state.currentScene !== null) {
        const suggestions = window.hybridBreakdownManager.getSuggestionsForScene(state.currentScene);
        const hasSuggestions = suggestions && suggestions.length > 0;

        if (hasSuggestions) {
            // Auto-enable hybrid mode if suggestions exist
            localStorage.setItem('useHybridMode', 'true');
            return true;
        }
    }

    return false;
}

/**
 * Check if enhanced workflow should be used
 * @returns {boolean} True if enhanced workflow should be used
 */
function shouldUseEnhancedWorkflow() {
    // Use enhanced workflow if:
    // 1. Narrative context is available
    // 2. User preference is enabled (stored in localStorage)
    // 3. Breakdown manager is available

    const hasNarrativeContext = window.scriptNarrativeContext &&
                                 window.scriptNarrativeContext.characters;

    // Check user preference
    let userPreference = localStorage.getItem('useEnhancedBreakdown');

    // If no preference set yet and narrative context is available, set it to true
    if (userPreference === null && hasNarrativeContext) {
        localStorage.setItem('useEnhancedBreakdown', 'true');
        userPreference = 'true';
    }

    // Default to enhanced if narrative context available
    const useEnhanced = userPreference === null ? hasNarrativeContext : userPreference === 'true';

    return useEnhanced && typeof window.breakdownManager !== 'undefined';
}

/**
 * Render classic breakdown panel
 */
function renderClassicBreakdown() {
    const container = document.getElementById('breakdown-panel');
    if (!container) return;

    const scene = state.scenes[state.currentScene];
    const breakdown = state.sceneBreakdowns[state.currentScene] || {};
    const cast = breakdown.cast || [];

    // Count tagged elements
    const sceneTags = state.scriptTags[state.currentScene] || [];
    const tagCounts = {};
    sceneTags.forEach(tag => {
        if (!tagCounts[tag.category]) tagCounts[tag.category] = 0;
        tagCounts[tag.category]++;
    });

    // DIAGNOSTIC: Log breakdown rendering
    console.log(`✓ Rendering breakdown for scene ${scene.number}:`, {
        cast: cast.length,
        tags: sceneTags.length,
        tagCounts
    });

    // Scene navigation data
    const hasPrevious = state.currentScene > 0;
    const hasNext = state.currentScene < state.scenes.length - 1;
    const previousScene = hasPrevious ? state.scenes[state.currentScene - 1] : null;
    const nextScene = hasNext ? state.scenes[state.currentScene + 1] : null;

    // Check for transitions in this scene
    const sceneTransitions = getSceneTransitions(state.currentScene);

    let html = `
        <!-- SCENE NAVIGATION BAR - STICKY AT TOP -->
        <div class="breakdown-scene-nav-sticky">
            <button class="scene-nav-btn-compact ${!hasPrevious ? 'disabled' : ''}"
                    onclick="navigateToScene(${state.currentScene - 1})"
                    ${!hasPrevious ? 'disabled' : ''}>
                ← ${hasPrevious ? `Scene ${previousScene.number}` : ''}
            </button>
            <div class="scene-nav-current-compact">
                SCENE ${scene.number}
            </div>
            <button class="scene-nav-btn-compact ${!hasNext ? 'disabled' : ''}"
                    onclick="navigateToScene(${state.currentScene + 1})"
                    ${!hasNext ? 'disabled' : ''}>
                ${hasNext ? `Scene ${nextScene.number}` : ''} →
            </button>
        </div>

        ${renderSceneProcessingButtons(scene, state.currentScene)}

        ${sceneTransitions.length > 0 ? renderTransitionBanner(sceneTransitions) : ''}

        <!-- SCENE INFORMATION - COLLAPSIBLE -->
        ${renderSceneInfoSection(scene)}

        <!-- TAGGED ELEMENTS PILLS -->
        ${Object.keys(tagCounts).length > 0 ? `
            <div class="tagged-pills">
                ${Object.entries(tagCounts).map(([cat, count]) => {
                    const category = categories.find(c => c.id === cat);
                    return `<div class="tagged-pill">${category?.name || cat}: ${count}</div>`;
                }).join('')}
            </div>
        ` : ''}

        <!-- CAST IN THIS SCENE -->
        ${renderCastSection(cast)}
    `;

    // Render all category sections EXCEPT cast (handled separately above)
    categories.filter(cat => cat.id !== 'cast').forEach(cat => {
        const elements = breakdown[cat.id] || [];

        // ONLY render if category has elements
        if (elements.length > 0) {
            html += renderCategorySection(cat, elements);
        }
    });

    container.innerHTML = html;
}

/**
 * Render scene processing buttons
 * Shows options to process the scene with AI using master context
 */
function renderSceneProcessingButtons(scene, sceneIndex) {
    const hasSynopsis = scene.synopsis && scene.synopsis.trim().length > 0;
    const hasTags = state.scriptTags[sceneIndex] && state.scriptTags[sceneIndex].length > 0;
    const isProcessed = scene.processed || (hasSynopsis && hasTags);

    // Check if master context is available
    const hasMasterContext = window.masterContext && window.masterContext.characters;

    if (!hasMasterContext) {
        return `
            <div class="scene-processing-section warning">
                <div class="processing-warning-icon">⚠️</div>
                <div class="processing-warning-text">
                    Master context not available. Import a script to enable AI processing.
                </div>
            </div>
        `;
    }

    return `
        <div class="scene-processing-section">
            <div class="processing-header">
                <span class="processing-title">Scene Processing</span>
                <span class="processing-status ${isProcessed ? 'processed' : 'pending'}">
                    ${isProcessed ? '✓ Processed' : '○ Not Processed'}
                </span>
            </div>
            <div class="processing-buttons">
                <button class="processing-btn primary" onclick="handleProcessScene(${sceneIndex})" title="Generate both synopsis and tags">
                    ${isProcessed ? '✓ Reprocess Scene' : '⚡ Process Scene'}
                </button>
                <button class="processing-btn secondary" onclick="handleGenerateSynopsisOnly(${sceneIndex})" title="Generate synopsis only">
                    📝 ${hasSynopsis ? 'Regenerate' : 'Generate'} Synopsis
                </button>
                <button class="processing-btn secondary" onclick="handleGenerateTagsOnly(${sceneIndex})" title="Generate tags only">
                    🏷️ ${hasTags ? 'Regenerate' : 'Generate'} Tags
                </button>
            </div>
        </div>
    `;
}

/**
 * Handle process scene button click
 */
async function handleProcessScene(sceneIndex) {
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Processing...';

    try {
        const { processThisScene } = await import('./scene-processing.js');
        await processThisScene(sceneIndex);
    } catch (error) {
        console.error('Error processing scene:', error);
        alert('Error processing scene: ' + error.message);
    } finally {
        btn.disabled = false;
        renderBreakdownPanel();
    }
}

/**
 * Handle generate synopsis only
 */
async function handleGenerateSynopsisOnly(sceneIndex) {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generating...';

    try {
        const { generateSceneSynopsis } = await import('./scene-processing.js');
        await generateSceneSynopsis(sceneIndex);

        // Save project
        const { saveProject } = await import('./export-handlers.js');
        saveProject();

        // Refresh displays
        renderBreakdownPanel();
        renderSceneList();

        showProcessingToast('Synopsis generated successfully', 'success');
    } catch (error) {
        console.error('Error generating synopsis:', error);
        showProcessingToast('Error: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

/**
 * Handle generate tags only
 */
async function handleGenerateTagsOnly(sceneIndex) {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generating...';

    try {
        const { generateSceneTags } = await import('./scene-processing.js');
        await generateSceneTags(sceneIndex);

        // Save project
        const { saveProject } = await import('./export-handlers.js');
        saveProject();

        // Refresh displays
        renderBreakdownPanel();
        renderSceneList();

        showProcessingToast('Tags generated successfully', 'success');
    } catch (error) {
        console.error('Error generating tags:', error);
        showProcessingToast('Error: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

/**
 * Show toast notification for processing actions
 */
function showProcessingToast(message, type = 'info') {
    const existingToasts = document.querySelectorAll('.toast-notification');
    existingToasts.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        font-size: 0.9em;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
    `;

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

/**
 * Render transition banner for scenes with transitions
 */
function renderTransitionBanner(sceneTransitions) {
    return `
        <div class="transition-scene-banner">
            <div class="transition-banner-header">
                <span class="transition-banner-icon">⚡</span>
                <span class="transition-banner-title">TRANSITION SCENE</span>
            </div>
            <div class="transition-banner-list">
                ${sceneTransitions.map(t => {
                    const characterLooksList = state.characterLooks[t.character] || [];
                    const fromLook = characterLooksList.find(l => l.id === t.fromLookId);
                    const toLook = characterLooksList.find(l => l.id === t.toLookId);

                    return `
                        <div class="transition-banner-item">
                            <div class="transition-character-line">
                                <strong>${escapeHtml(t.character)}:</strong>
                                <span class="transition-looks">${escapeHtml(fromLook?.lookName || 'Previous')} → ${escapeHtml(toLook?.lookName || 'New Look')}</span>
                            </div>
                            ${t.scriptEvent ? `
                                <div class="transition-event-line">
                                    Event: ${escapeHtml(t.scriptEvent.substring(0, 60))}${t.scriptEvent.length > 60 ? '...' : ''}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

/**
 * Render scene information section
 */
function renderSceneInfoSection(scene) {
    return `
        <div class="scene-info-section" id="sceneInfoSection">
            <div class="scene-info-header" onclick="toggleSceneInfo()">
                <span class="scene-info-title">ℹ️ Scene Info ${(scene.storyDay && scene.timeOfDay && scene.intExt && scene.location) ? '✓' : '⚠'}</span>
                <button class="scene-info-toggle">▶</button>
            </div>
            <div class="scene-info-content" style="display: none;">
                <div class="scene-info-compact">
                    <div class="info-row">
                        <div class="info-field">
                            <label>Story Day</label>
                            <input type="text"
                                   value="${escapeHtml(scene.storyDay || '')}"
                                   placeholder="Day 1..."
                                   onchange="updateSceneMetadata(${state.currentScene}, 'storyDay', this.value)">
                        </div>
                        <div class="info-field">
                            <label>Time</label>
                            <select onchange="updateSceneMetadata(${state.currentScene}, 'timeOfDay', this.value)">
                                <option value="">-- Time --</option>
                                <option value="Day" ${(scene.timeOfDay || detectTimeOfDay(scene.heading)) === 'Day' ? 'selected' : ''}>Day</option>
                                <option value="Morning" ${(scene.timeOfDay || detectTimeOfDay(scene.heading)) === 'Morning' ? 'selected' : ''}>Morning</option>
                                <option value="Afternoon" ${(scene.timeOfDay || detectTimeOfDay(scene.heading)) === 'Afternoon' ? 'selected' : ''}>Afternoon</option>
                                <option value="Evening" ${(scene.timeOfDay || detectTimeOfDay(scene.heading)) === 'Evening' ? 'selected' : ''}>Evening</option>
                                <option value="Night" ${(scene.timeOfDay || detectTimeOfDay(scene.heading)) === 'Night' ? 'selected' : ''}>Night</option>
                            </select>
                        </div>
                        <div class="info-field">
                            <label>INT/EXT</label>
                            <select onchange="updateSceneMetadata(${state.currentScene}, 'intExt', this.value)">
                                <option value="">-- Type --</option>
                                <option value="INT" ${scene.intExt === 'INT' ? 'selected' : ''}>INT</option>
                                <option value="EXT" ${scene.intExt === 'EXT' ? 'selected' : ''}>EXT</option>
                                <option value="INT/EXT" ${scene.intExt === 'INT/EXT' ? 'selected' : ''}>INT/EXT</option>
                            </select>
                        </div>
                    </div>
                    <div class="info-row">
                        <div class="info-field full-width">
                            <label>Location</label>
                            <input type="text"
                                   value="${escapeHtml(scene.location || extractLocation(scene.heading) || '')}"
                                   placeholder="FERRY"
                                   onchange="updateSceneMetadata(${state.currentScene}, 'location', this.value)">
                        </div>
                    </div>
                    <div class="ai-detect-row">
                        <button class="ai-btn-compact" onclick="handleDetectAIElements(${state.currentScene})" title="Auto-detect cast & elements">
                            🔍 Auto-Detect Elements
                        </button>
                        <div class="ai-status" id="aiStatus"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render cast section
 */
function renderCastSection(cast) {
    if (cast.length === 0) {
        return `
            <div style="margin: 24px 0;">
                <div class="empty-state-small">
                    <div class="empty-text-small">No cast members in this scene. Use AI detection or add manually.</div>
                </div>
                <button class="add-element-btn" style="width: 100%; margin-top: 12px;" onclick="openAddElement('cast')">
                    + Add Cast Member to Scene
                </button>
            </div>
        `;
    }

    return `
        <div style="margin: 24px 0;">
            <div class="section-title" style="margin-bottom: 16px;">
                <span class="section-icon" style="background: rgba(251, 191, 36, 0.5);"></span>
                CAST (${cast.length})
            </div>

            ${cast.map((castMember, index) => renderCastMemberCard(castMember, index)).join('')}

            <button class="add-element-btn" style="width: 100%; margin-top: 12px;" onclick="openAddElement('cast')">
                + Add Cast Member to Scene
            </button>
        </div>
    `;
}

/**
 * Render cast member card
 */
function renderCastMemberCard(castMember, index = 0) {
    const profile = state.castProfiles[castMember] || {};
    const characterState = state.characterStates[state.currentScene]?.[castMember] || {};

    // Get look state for this character in this scene
    const lookState = getLookStateForScene(castMember, state.currentScene);

    // Check if this character is transitioning in this scene
    const characterTransition = getTransitionForScene(castMember, state.currentScene);

    // Create inline preview for collapsed state
    let inlinePreview = '';
    if (characterTransition) {
        const characterLooksList = state.characterLooks[castMember] || [];
        const fromLook = characterLooksList.find(l => l.id === characterTransition.fromLookId);
        const toLook = characterLooksList.find(l => l.id === characterTransition.toLookId);
        inlinePreview = `⚡ <strong>LOOK CHANGES:</strong> ${escapeHtml(fromLook?.lookName || 'Previous')} → ${escapeHtml(toLook?.lookName || 'New Look')}`;
    } else if (lookState) {
        const complexityIcon = getComplexityIcon(lookState.complexity);
        const sceneRangeText = formatSceneRange(lookState.scenes);
        inlinePreview = `Look: ${escapeHtml(lookState.lookName)} (${complexityIcon} ${(lookState.complexity || 'low').toUpperCase()})<br>
            <span style="font-size: 0.85em; opacity: 0.8;">${sceneRangeText}</span>`;
    }

    // First cast member expanded by default
    const isExpanded = index === 0;
    const toggleIcon = isExpanded ? '▼' : '▶';
    const bodyDisplay = isExpanded ? 'block' : 'none';

    return `
        <div class="cast-member-card" id="castCard${castMember.replace(/\s/g, '')}">
            <div class="cast-member-header" onclick="toggleCastCard('${castMember.replace(/\s/g, '')}')">
                <span class="cast-member-name">${escapeHtml(castMember)}</span>
                <div class="header-actions">
                    <button class="remove-cast-btn" onclick="event.stopPropagation(); removeElement('cast', '${escapeHtml(castMember).replace(/'/g, "\\'")}')">×</button>
                    <span class="cast-member-toggle">${toggleIcon}</span>
                </div>
            </div>

            ${inlinePreview ? `<div class="cast-member-preview">${inlinePreview}</div>` : ''}

            <div class="cast-member-body" style="display: ${bodyDisplay};">
                <div class="cast-member-base">
                    Base: ${escapeHtml(profile.baseDescription) || 'No base description set'}
                </div>

                ${lookState ? `
                    <div class="look-state-section">
                        <div class="look-state-section-title">━━━ LOOK STATE ━━━</div>
                        <div class="look-state-info">
                            <div class="look-state-name-badge">
                                <span class="look-name-text">${escapeHtml(lookState.lookName)}</span>
                                <span class="look-complexity-mini">${getComplexityIcon(lookState.complexity)} ${(lookState.complexity || 'low').toUpperCase()}</span>
                            </div>
                            <div class="look-state-meta">
                                ${formatSceneRange(lookState.scenes)} • ${(lookState.scenes || []).length} scenes total
                            </div>
                        </div>
                    </div>
                ` : ''}

                <div class="department-fields">
                    <div class="department-field">
                        <label class="department-label">Hair</label>
                        <input type="text"
                               class="department-input"
                               value="${escapeHtml(characterState.hair || '')}"
                               placeholder="Hairstyle, condition, changes..."
                               oninput="updateCharacterField('${escapeHtml(castMember).replace(/'/g, "\\'")}', 'hair', this.value)">
                    </div>

                    <div class="department-field">
                        <label class="department-label">Makeup</label>
                        <input type="text"
                               class="department-input"
                               value="${escapeHtml(characterState.makeup || '')}"
                               placeholder="Makeup look, details..."
                               oninput="updateCharacterField('${escapeHtml(castMember).replace(/'/g, "\\'")}', 'makeup', this.value)">
                    </div>

                    <div class="department-field">
                        <label class="department-label">SFX</label>
                        <input type="text"
                               class="department-input"
                               value="${escapeHtml(characterState.sfx || '')}"
                               placeholder="Injuries, wounds, prosthetics..."
                               oninput="updateCharacterField('${escapeHtml(castMember).replace(/'/g, "\\'")}', 'sfx', this.value)">
                    </div>

                    <div class="department-field">
                        <label class="department-label">Wardrobe</label>
                        <input type="text"
                               class="department-input"
                               value="${escapeHtml(characterState.wardrobe || '')}"
                               placeholder="Costume description, accessories..."
                               oninput="updateCharacterField('${escapeHtml(castMember).replace(/'/g, "\\'")}', 'wardrobe', this.value)">
                    </div>

                    <div class="department-field">
                        <label class="department-label">Notes</label>
                        <input type="text"
                               class="department-input"
                               value="${escapeHtml(characterState.notes || '')}"
                               placeholder="Additional notes..."
                               oninput="updateCharacterField('${escapeHtml(castMember).replace(/'/g, "\\'")}', 'notes', this.value)">
                    </div>
                </div>

                <button class="ai-btn-compact" onclick="handleAIFillCharacter(${state.currentScene}, '${escapeHtml(castMember).replace(/'/g, "\\'")}');" style="width: 100%; margin-top: 12px;" title="Auto-fill fields with AI">
                    AI Fill Character Fields
                </button>
            </div>
        </div>
    `;
}

/**
 * Render category section
 */
function renderCategorySection(cat, elements) {
    return `
        <div class="breakdown-section has-content"
             id="category-${cat.id}"
             data-category="${cat.id}">
            <div class="section-header" onclick="toggleCategory('${cat.id}')">
                <div class="section-header-left">
                    <span class="section-icon" style="background: ${cat.color}"></span>
                    <span class="section-title">${cat.name}</span>
                    <span class="category-count has-items">${elements.length}</span>
                </div>
                <button class="category-toggle" onclick="event.stopPropagation();">▶</button>
            </div>
            <div class="section-content">
                <div class="element-list">
                    ${elements.map(el => `
                        <div class="element-item">
                            <div class="element-text">${escapeHtml(el)}</div>
                            <button class="element-remove" onclick="removeElement('${cat.id}', '${escapeHtml(el).replace(/'/g, "\\'")}')">×</button>
                        </div>
                    `).join('')}
                </div>
                <button class="add-element-btn" style="width: 100%; margin-top: 8px;" onclick="openAddElement('${cat.id}')">+ Add ${cat.name}</button>
            </div>
        </div>
    `;
}

// ============================================================================
// ADD/REMOVE ELEMENTS
// ============================================================================

/**
 * Open add element modal
 */
export function openAddElement(categoryId) {
    currentElementCategory = categoryId;
    const modal = document.getElementById('addElementModal');
    if (!modal) return;

    modal.classList.add('active');
    const input = document.getElementById('elementInput');
    if (input) {
        input.value = '';
        input.focus();
    }
}

/**
 * Close add element modal
 */
function closeAddElementModal() {
    const modal = document.getElementById('addElementModal');
    if (modal) modal.classList.remove('active');
    currentElementCategory = null;
}

/**
 * Confirm add element
 */
export function confirmAddElement() {
    const input = document.getElementById('elementInput');
    if (!input) return;

    const value = input.value.trim();
    if (!value || !currentElementCategory) return;

    if (!state.sceneBreakdowns[state.currentScene]) {
        state.sceneBreakdowns[state.currentScene] = {};
    }
    if (!state.sceneBreakdowns[state.currentScene][currentElementCategory]) {
        state.sceneBreakdowns[state.currentScene][currentElementCategory] = [];
    }

    // Check for duplicates
    if (state.sceneBreakdowns[state.currentScene][currentElementCategory].includes(value)) {
        alert('This element already exists in this scene');
        return;
    }

    state.sceneBreakdowns[state.currentScene][currentElementCategory].push(value);

    // If adding cast, create profile
    if (currentElementCategory === 'cast') {
        if (!state.castProfiles[value]) {
            state.castProfiles[value] = {
                name: value,
                baseDescription: '',
                scenes: []
            };
        }
        if (!state.castProfiles[value].scenes.includes(state.scenes[state.currentScene].number)) {
            state.castProfiles[value].scenes.push(state.scenes[state.currentScene].number);
        }
    }

    // Re-render and save
    renderBreakdownPanel();
    import('./scene-list.js').then(module => module.renderSceneList());
    import('./export-handlers.js').then(module => module.saveProject());

    closeAddElementModal();
}

/**
 * Remove element from scene
 */
export function removeElement(categoryId, element) {
    if (!state.sceneBreakdowns[state.currentScene] || !state.sceneBreakdowns[state.currentScene][categoryId]) return;

    state.sceneBreakdowns[state.currentScene][categoryId] = state.sceneBreakdowns[state.currentScene][categoryId].filter(e => e !== element);

    // If removing cast, update profile
    if (categoryId === 'cast' && state.castProfiles[element]) {
        state.castProfiles[element].scenes = state.castProfiles[element].scenes.filter(s => s !== state.scenes[state.currentScene].number);
    }

    // Re-render and save
    renderBreakdownPanel();
    import('./scene-list.js').then(module => module.renderSceneList());
    import('./export-handlers.js').then(module => module.saveProject());
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get transitions for a specific scene
 */
function getSceneTransitions(sceneIndex) {
    return state.lookTransitions.filter(t => t.transitionScene === sceneIndex + 1);
}

/**
 * Get look state for character in specific scene
 */
function getLookStateForScene(character, sceneIndex) {
    const looks = state.characterLooks[character] || [];
    return looks.find(look => (look.scenes || []).includes(sceneIndex + 1));
}

/**
 * Get transition for character in specific scene
 */
function getTransitionForScene(character, sceneIndex) {
    return state.lookTransitions.find(t =>
        t.character === character &&
        t.transitionScene === sceneIndex + 1
    );
}

/**
 * Toggle cast card expanded state
 */
window.toggleCastCard = function(cardId) {
    const card = document.getElementById(`castCard${cardId}`);
    if (!card) return;

    const body = card.querySelector('.cast-member-body');
    const toggle = card.querySelector('.cast-member-toggle');

    if (body.style.display === 'block') {
        body.style.display = 'none';
        toggle.textContent = '▶';
    } else {
        body.style.display = 'block';
        toggle.textContent = '▼';
    }
};

/**
 * Toggle category expanded state
 */
window.toggleCategory = function(categoryId) {
    const section = document.getElementById(`category-${categoryId}`);
    if (!section) return;

    const content = section.querySelector('.section-content');
    const toggle = section.querySelector('.category-toggle');
    const isExpanded = section.classList.contains('expanded');

    if (isExpanded) {
        section.classList.remove('expanded');
        content.style.display = 'none';
        toggle.textContent = '▶';
    } else {
        section.classList.add('expanded');
        content.style.display = 'block';
        toggle.textContent = '▼';
    }
};

/**
 * Toggle scene info section
 */
window.toggleSceneInfo = function() {
    const section = document.getElementById('sceneInfoSection');
    if (!section) return;

    const content = section.querySelector('.scene-info-content');
    const toggle = section.querySelector('.scene-info-toggle');

    if (content.style.display === 'block') {
        content.style.display = 'none';
        toggle.textContent = '▶';
    } else {
        content.style.display = 'block';
        toggle.textContent = '▼';
    }
};

/**
 * Update character field
 */
window.updateCharacterField = function(character, field, value) {
    if (!state.characterStates[state.currentScene]) {
        state.characterStates[state.currentScene] = {};
    }
    if (!state.characterStates[state.currentScene][character]) {
        state.characterStates[state.currentScene][character] = {};
    }

    state.characterStates[state.currentScene][character][field] = value;

    // Auto-save
    import('./export-handlers.js').then(module => module.saveProject());
};

/**
 * Handle detect AI elements
 */
window.handleDetectAIElements = async function(sceneIndex) {
    try {
        const status = document.getElementById('aiStatus');
        if (status) status.textContent = 'Detecting elements...';

        const detected = await detectAIElements(sceneIndex);

        // Merge detected elements
        if (!state.sceneBreakdowns[sceneIndex]) {
            state.sceneBreakdowns[sceneIndex] = {};
        }

        // Add detected cast
        if (detected.cast) {
            state.sceneBreakdowns[sceneIndex].cast = [...new Set([...(state.sceneBreakdowns[sceneIndex].cast || []), ...detected.cast])];
        }

        // Add detected elements
        if (detected.elements) {
            Object.keys(detected.elements).forEach(key => {
                if (!state.sceneBreakdowns[sceneIndex][key]) {
                    state.sceneBreakdowns[sceneIndex][key] = [];
                }
                state.sceneBreakdowns[sceneIndex][key] = [...new Set([...state.sceneBreakdowns[sceneIndex][key], ...detected.elements[key]])];
            });
        }

        renderBreakdownPanel();
        import('./scene-list.js').then(module => module.renderSceneList());
        import('./export-handlers.js').then(module => module.saveProject());

        if (status) status.textContent = '✓ Elements detected';
        setTimeout(() => { if (status) status.textContent = ''; }, 2000);
    } catch (error) {
        console.error('Error detecting elements:', error);
        const status = document.getElementById('aiStatus');
        if (status) status.textContent = '✗ Error: ' + error.message;
    }
};

/**
 * Toggle expandable section
 */
window.toggleSection = function(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const content = section.querySelector('.section-content');
    const toggle = section.querySelector('.category-toggle');
    const isExpanded = section.classList.contains('expanded');

    if (isExpanded) {
        section.classList.remove('expanded');
        content.style.display = 'none';
        toggle.textContent = '▶';
    } else {
        section.classList.add('expanded');
        content.style.display = 'block';
        toggle.textContent = '▼';
    }
};

/**
 * Handle AI Fill for character in current scene
 */
window.handleAIFillCharacter = async function(sceneIndex, character) {
    try {
        const status = document.getElementById('aiStatus');
        if (status) status.textContent = `Generating breakdown for ${character}...`;

        const scene = state.scenes[sceneIndex];
        const sceneText = scene.content || scene.text || '';

        // Generate descriptions for all categories
        const categories = ['hair', 'makeup', 'sfx', 'wardrobe'];
        const descriptions = {};

        for (const category of categories) {
            const description = await generateDescription(sceneIndex, character, category);
            if (description) {
                descriptions[category] = description;
            }
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Update character state
        if (!state.characterStates[sceneIndex]) {
            state.characterStates[sceneIndex] = {};
        }
        if (!state.characterStates[sceneIndex][character]) {
            state.characterStates[sceneIndex][character] = {};
        }

        // Merge with existing data (don't overwrite if field already has content)
        Object.keys(descriptions).forEach(category => {
            if (!state.characterStates[sceneIndex][character][category] ||
                state.characterStates[sceneIndex][character][category].trim() === '') {
                state.characterStates[sceneIndex][character][category] = descriptions[category];
            }
        });

        // Re-render and save
        renderBreakdownPanel();
        import('./export-handlers.js').then(module => module.saveProject());

        if (status) status.textContent = `✓ ${character} breakdown generated`;
        setTimeout(() => { if (status) status.textContent = ''; }, 2000);
    } catch (error) {
        console.error('Error filling character fields:', error);
        const status = document.getElementById('aiStatus');
        if (status) status.textContent = '✗ Error: ' + error.message;
    }
};

/**
 * Extract scene alerts from master context
 * @param {Object} scene - Scene object
 * @param {number} sceneIndex - Scene index
 * @param {Object} analysis - Master context analysis
 * @returns {Array} Array of alert objects
 */
function extractSceneAlerts(scene, sceneIndex, analysis) {
    const alerts = [];

    // Check if continuous from previous
    if (analysis.sceneFlow?.continuous) {
        for (let group of analysis.sceneFlow.continuous) {
            if (group.includes(sceneIndex) && group.includes(sceneIndex - 1)) {
                alerts.push({
                    type: 'continuous',
                    icon: '⚡',
                    text: 'CONTINUOUS from previous scene'
                });
                break;
            }
        }
    }

    // Check for weather
    const environment = analysis.environments?.[`scene_${sceneIndex}`];
    if (environment?.conditions) {
        const conditions = Array.isArray(environment.conditions) ? environment.conditions : [];
        if (conditions.some(c => c.toLowerCase().includes('rain'))) {
            alerts.push({
                type: 'weather',
                icon: '🌧️',
                text: 'Rain - waterproof makeup needed'
            });
        }
        if (conditions.some(c => c.toLowerCase().includes('snow'))) {
            alerts.push({
                type: 'weather',
                icon: '❄️',
                text: 'Snow - weather protection needed'
            });
        }
        if (conditions.some(c => c.toLowerCase().includes('wind'))) {
            alerts.push({
                type: 'weather',
                icon: '💨',
                text: 'Wind - hair protection needed'
            });
        }
    }

    // Check for stunts
    if (analysis.doublingNeeds?.[`scene_${sceneIndex}`]) {
        alerts.push({
            type: 'stunt',
            icon: '🎬',
            text: 'Stunt double required'
        });
    }

    // Check for crowds
    if (analysis.crowdScenes?.[`scene_${sceneIndex}`]) {
        const crowd = analysis.crowdScenes[`scene_${sceneIndex}`];
        alerts.push({
            type: 'crowd',
            icon: '👥',
            text: `${crowd.extras || 'Multiple'} extras - ${crowd.lookRequirements || 'special looks required'}`
        });
    }

    // Check for action sequences
    const interactions = analysis.interactions?.[`scene_${sceneIndex}`];
    if (interactions?.type === 'fight') {
        alerts.push({
            type: 'action',
            icon: '⚔️',
            text: 'Fight scene - injury makeup may be needed'
        });
    }

    return alerts;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Extract story day from master context timeline
 * @param {number} sceneIndex - Scene index
 * @returns {string} Story day (e.g., "Day 1") or empty string
 */
function extractStoryDay(sceneIndex) {
    if (!window.masterContext?.storyStructure?.timeline) return '';

    const timeline = window.masterContext.storyStructure.timeline;
    const sceneNumber = state.scenes[sceneIndex]?.number;

    if (!sceneNumber) return '';

    // Find the day that includes this scene number
    for (const day of timeline) {
        if (day.scenes && day.scenes.includes(sceneNumber)) {
            return day.day || '';
        }
    }

    return '';
}

/**
 * Extract time of day from scene heading
 * @param {string} heading - Scene heading
 * @returns {string} Time of day or empty string
 */
function extractTimeFromHeading(heading) {
    if (!heading) return '';
    const upper = heading.toUpperCase();

    if (upper.includes('EARLY MORNING')) return 'Early Morning';
    if (upper.includes('MORNING')) return 'Morning';
    if (upper.includes('AFTERNOON')) return 'Afternoon';
    if (upper.includes('EVENING') || upper.includes('DUSK')) return 'Evening';
    if (upper.includes('NIGHT') || upper.includes('MIDNIGHT')) return 'Night';
    if (upper.includes('LATE NIGHT')) return 'Late Night';
    if (upper.includes('DAY') && !upper.includes('HOLIDAY')) return 'Afternoon';

    return '';
}

// ============================================================================
// NEW COMPREHENSIVE DATA COLLECTION INTERFACE
// ============================================================================

/**
 * Render comprehensive scene breakdown with data collection interface
 * @param {number} sceneIndex - Scene index to render
 */
function renderSceneBreakdown(sceneIndex) {
    const scene = state.scenes[sceneIndex];
    const panel = document.getElementById('breakdown-panel');
    if (!scene || !panel) return;

    // Pre-populate from existing data or AI suggestions
    const storyDay = scene.storyDay || extractStoryDay(sceneIndex) || scene.aiSuggestions?.storyDay || '';
    const timeOfDay = scene.timeOfDay || extractTimeFromHeading(scene.heading) || scene.aiSuggestions?.timeOfDay || '';
    const breakdown = state.sceneBreakdowns[sceneIndex] || {};
    const characters = breakdown.cast || [];

    // Extract relevant data for this scene from master context
    const analysis = window.scriptMasterContext || window.masterContext || {};
    const alerts = extractSceneAlerts(scene, sceneIndex, analysis);
    const environment = analysis.environments?.[`scene_${sceneIndex}`];
    const emotional = analysis.emotionalBeats?.[`scene_${sceneIndex}`];
    const interactions = analysis.interactions?.[`scene_${sceneIndex}`];
    const specialReq = analysis.specialRequirements?.[`scene_${sceneIndex}`];

    panel.innerHTML = `
        <div class="scene-breakdown-wrapper">
            <!-- Scene Header -->
            <div class="breakdown-scene-header">
                <h3>Scene ${sceneIndex + 1}</h3>
                <div class="scene-heading">${escapeHtml(scene.heading)}</div>
            </div>

            ${alerts.length > 0 ? `
                <!-- ALERTS BAR -->
                <div class="alerts-bar">
                    ${alerts.map(alert => `
                        <div class="alert-item ${alert.type}">
                            <span class="alert-icon">${alert.icon}</span>
                            <span class="alert-text">${escapeHtml(alert.text)}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${environment || emotional || specialReq ? `
                <!-- SCENE CONDITIONS -->
                <div class="conditions-section">
                    <h4 class="section-title">SCENE CONDITIONS</h4>

                    ${environment ? `
                        <div class="condition-box">
                            <div class="condition-label">Environment:</div>
                            <div class="condition-tags">
                                ${(Array.isArray(environment.conditions) ? environment.conditions : []).map(c =>
                                    `<div class="condition-tag">${escapeHtml(c)}</div>`
                                ).join('')}
                            </div>
                            ${environment.impactOnAppearance ? `
                                <div class="impact-note">
                                    💡 ${escapeHtml(environment.impactOnAppearance)}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}

                    ${emotional ? `
                        <div class="condition-box">
                            <div class="condition-label">Emotional State:</div>
                            <div class="emotional-info">
                                ${emotional.character ? `<strong>${escapeHtml(emotional.character)}</strong>: ` : ''}
                                ${escapeHtml(emotional.emotion || '')}
                                ${emotional.visualImpact ? `
                                    <div class="impact-note">
                                        💄 ${escapeHtml(emotional.visualImpact)}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}

                    ${specialReq ? `
                        <div class="condition-box">
                            <div class="condition-label">Special Requirements:</div>
                            <div class="special-req-info">
                                ${escapeHtml(specialReq.type || '')}
                                ${(specialReq.note || specialReq.impact) ? `
                                    <div class="impact-note">
                                        ⚠️ ${escapeHtml(specialReq.note || specialReq.impact)}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
            ` : ''}

            <!-- TIMELINE SECTION -->
            <div class="breakdown-section timeline-section">
                <h4 class="section-title">TIMELINE</h4>

                <div class="field-row">
                    <div class="field-group">
                        <label>Story Day</label>
                        <input type="text"
                               id="scene-story-day"
                               value="${escapeHtml(storyDay)}"
                               placeholder="Day 1, Day 2, etc."
                               onchange="updateSceneField(${sceneIndex}, 'storyDay', this.value)">
                    </div>

                    <div class="field-group">
                        <label>Time</label>
                        <select id="scene-time"
                                onchange="updateSceneField(${sceneIndex}, 'timeOfDay', this.value)">
                            <option value="">Select...</option>
                            <option ${timeOfDay === 'Early Morning' ? 'selected' : ''}>Early Morning</option>
                            <option ${timeOfDay === 'Morning' ? 'selected' : ''}>Morning</option>
                            <option ${timeOfDay === 'Afternoon' ? 'selected' : ''}>Afternoon</option>
                            <option ${timeOfDay === 'Evening' ? 'selected' : ''}>Evening</option>
                            <option ${timeOfDay === 'Night' ? 'selected' : ''}>Night</option>
                            <option ${timeOfDay === 'Late Night' ? 'selected' : ''}>Late Night</option>
                        </select>
                    </div>
                </div>

                <div class="field-row">
                    <label class="checkbox-field">
                        <input type="checkbox"
                               ${scene.isFlashback ? 'checked' : ''}
                               onchange="updateSceneField(${sceneIndex}, 'isFlashback', this.checked)">
                        Flashback
                    </label>
                    <label class="checkbox-field">
                        <input type="checkbox"
                               ${scene.isFlashforward ? 'checked' : ''}
                               onchange="updateSceneField(${sceneIndex}, 'isFlashforward', this.checked)">
                        Flash-forward
                    </label>
                    <label class="checkbox-field">
                        <input type="checkbox"
                               ${scene.isDream ? 'checked' : ''}
                               onchange="updateSceneField(${sceneIndex}, 'isDream', this.checked)">
                        Dream
                    </label>
                </div>

                <div class="field-group">
                    <label>Time Jump</label>
                    <input type="text"
                           value="${escapeHtml(scene.timeJump || '')}"
                           placeholder="e.g., '3 days later', '2 weeks earlier'"
                           onchange="updateSceneField(${sceneIndex}, 'timeJump', this.value)">
                </div>
            </div>

            <!-- CHARACTER CONTINUITY SECTION -->
            <div class="breakdown-section character-section">
                <h4 class="section-title">CHARACTER CONTINUITY</h4>
                ${characters.length > 0 ?
                    characters.map(char => renderCharacterFields(char, sceneIndex, scene)).join('')
                    : '<div class="no-characters">No characters in this scene</div>'}
            </div>

            <!-- CONTINUITY EVENTS SECTION -->
            <div class="breakdown-section events-section">
                <h4 class="section-title">CONTINUITY EVENTS</h4>
                <div class="event-controls">
                    <button class="small-btn" onclick="startNewEvent(${sceneIndex})">+ Start Event</button>
                    <button class="small-btn" onclick="linkExistingEvent(${sceneIndex})">Link Event</button>
                </div>
                <div id="scene-events">
                    ${renderSceneEvents(sceneIndex)}
                </div>
            </div>

            <!-- NAVIGATION -->
            <div class="breakdown-nav">
                <button onclick="navigateToScene(${sceneIndex - 1})"
                        ${sceneIndex === 0 ? 'disabled' : ''}>
                    ← Previous
                </button>
                <span>${sceneIndex + 1} / ${state.scenes.length}</span>
                <button onclick="navigateToScene(${sceneIndex + 1})"
                        ${sceneIndex >= state.scenes.length - 1 ? 'disabled' : ''}>
                    Next →
                </button>
            </div>
        </div>
    `;
}

/**
 * Extract AI suggestions from tags for a character
 * @param {number} sceneIndex - Scene index
 * @param {string} character - Character name
 * @returns {Object} Suggestions object
 */
function extractSuggestionsFromTags(sceneIndex, character) {
    const sceneTags = state.scriptTags[sceneIndex] || [];
    const suggestions = {
        hair: '',
        makeup: '',
        wardrobe: '',
        changes: []
    };

    sceneTags.forEach(tag => {
        if (tag.character === character) {
            const text = tag.selectedText || tag.notes || '';
            if (tag.category === 'hair' && !suggestions.hair) {
                suggestions.hair = text;
            } else if (tag.category === 'makeup' && !suggestions.makeup) {
                suggestions.makeup = text;
            } else if (tag.category === 'wardrobe' && !suggestions.wardrobe) {
                suggestions.wardrobe = text;
            } else if (['injuries', 'sfx', 'health'].includes(tag.category)) {
                suggestions.changes.push(text);
            }
        }
    });

    return suggestions;
}

/**
 * Render character continuity fields with enter/change/exit tracking
 * @param {string} character - Character name
 * @param {number} sceneIndex - Scene index
 * @param {Object} scene - Scene object
 * @returns {string} HTML for character fields
 */
function renderCharacterFields(character, sceneIndex, scene) {
    const charData = state.characterStates[sceneIndex]?.[character] || {};
    const prevScene = findPreviousCharacterAppearance(character, sceneIndex);
    const suggestions = extractSuggestionsFromTags(sceneIndex, character);

    // Use suggestions if no data exists
    const enterHair = charData.enterHair || suggestions.hair || '';
    const enterMakeup = charData.enterMakeup || suggestions.makeup || '';
    const enterWardrobe = charData.enterWardrobe || suggestions.wardrobe || '';
    const changes = charData.changes || suggestions.changes.join('; ') || '';

    return `
        <div class="character-continuity-block" data-character="${escapeHtml(character)}">
            <div class="character-header">
                <h5>${escapeHtml(character)}</h5>
                <button class="copy-btn"
                        onclick="copyFromPrevious('${escapeHtml(character).replace(/'/g, "\\'")}', ${sceneIndex})"
                        title="Copy from previous scene"
                        ${!prevScene ? 'disabled' : ''}>
                    ↓ Copy Previous
                </button>
            </div>

            <!-- ENTERS WITH -->
            <div class="continuity-row">
                <label class="row-label">Enters with:</label>
                <div class="continuity-fields">
                    <input type="text"
                           placeholder="Hair"
                           value="${escapeHtml(enterHair)}"
                           onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'enterHair', this.value)">
                    <input type="text"
                           placeholder="Makeup"
                           value="${escapeHtml(enterMakeup)}"
                           onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'enterMakeup', this.value)">
                    <input type="text"
                           placeholder="Wardrobe"
                           value="${escapeHtml(enterWardrobe)}"
                           onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'enterWardrobe', this.value)">
                    <input type="text"
                           placeholder="Condition"
                           value="${escapeHtml(charData.enterCondition || '')}"
                           onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'enterCondition', this.value)">
                </div>
            </div>

            <!-- CHANGES DURING -->
            <div class="continuity-row">
                <label class="row-label">Changes:</label>
                <div class="continuity-fields">
                    <textarea placeholder="Describe any changes during the scene..."
                              onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'changes', this.value)"
                              >${escapeHtml(changes)}</textarea>
                </div>
            </div>

            <!-- EXITS WITH -->
            <div class="continuity-row">
                <label class="row-label">Exits with:</label>
                <div class="continuity-fields">
                    <input type="text"
                           placeholder="Hair"
                           value="${escapeHtml(charData.exitHair || '')}"
                           onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'exitHair', this.value)">
                    <input type="text"
                           placeholder="Makeup"
                           value="${escapeHtml(charData.exitMakeup || '')}"
                           onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'exitMakeup', this.value)">
                    <input type="text"
                           placeholder="Wardrobe"
                           value="${escapeHtml(charData.exitWardrobe || '')}"
                           onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'exitWardrobe', this.value)">
                    <input type="text"
                           placeholder="Condition"
                           value="${escapeHtml(charData.exitCondition || '')}"
                           onchange="updateCharField(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', 'exitCondition', this.value)">
                </div>
            </div>
        </div>
    `;
}

/**
 * Render scene events list
 * @param {number} sceneIndex - Scene index
 * @returns {string} HTML for scene events
 */
function renderSceneEvents(sceneIndex) {
    const events = Array.from(window.continuityTracker?.events?.values() || []);
    const sceneEvents = events.filter(e =>
        sceneIndex >= e.startScene && (!e.endScene || sceneIndex <= e.endScene)
    );

    if (sceneEvents.length === 0) {
        return '<div class="no-events">No active continuity events</div>';
    }

    return sceneEvents.map(event => {
        const canEnd = !event.endScene && sceneIndex > event.startScene;
        const canGenerateProgression = event.endScene && !event.progression;
        const hasProgression = event.progression && event.progression.length > 0;

        // Get current stage if progression exists
        let currentStage = '';
        if (hasProgression) {
            const stageIndex = sceneIndex - event.startScene;
            if (stageIndex >= 0 && stageIndex < event.progression.length) {
                currentStage = event.progression[stageIndex];
            }
        }

        return `
            <div class="event-item">
                <div class="event-header">
                    <div class="event-header-left">
                        <span class="event-type-badge event-type-${event.type}">${escapeHtml(event.type)}</span>
                        <span class="event-character-name">${escapeHtml(event.character)}</span>
                    </div>
                    <div class="event-actions">
                        ${canEnd ? `
                            <button class="event-action-btn"
                                    onclick="endEventAtScene('${event.id}', ${sceneIndex})"
                                    title="End event at this scene">
                                ✓ End Here
                            </button>
                        ` : ''}
                        ${canGenerateProgression ? `
                            <button class="event-action-btn primary"
                                    onclick="generateEventProgression('${event.id}')"
                                    title="Generate AI progression">
                                ✨ Generate Progression
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="event-description">${escapeHtml(event.description)}</div>
                <div class="event-meta">
                    <span class="event-range">Scene ${event.startScene + 1} → ${event.endScene ? `Scene ${event.endScene + 1}` : 'Ongoing'}</span>
                    ${hasProgression ? `<span class="event-has-progression">📊 Has progression</span>` : ''}
                </div>
                ${currentStage ? `
                    <div class="event-current-stage">
                        <strong>Current stage:</strong> ${escapeHtml(currentStage)}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

/**
 * Find previous appearance of character
 * @param {string} character - Character name
 * @param {number} currentSceneIndex - Current scene index
 * @returns {Object|null} Previous character state or null
 */
function findPreviousCharacterAppearance(character, currentSceneIndex) {
    for (let i = currentSceneIndex - 1; i >= 0; i--) {
        const breakdown = state.sceneBreakdowns[i];
        if (breakdown?.cast?.includes(character) && state.characterStates[i]?.[character]) {
            return state.characterStates[i][character];
        }
    }
    return null;
}

/**
 * Update scene field
 * @param {number} sceneIndex - Scene index
 * @param {string} field - Field name
 * @param {*} value - Field value
 */
window.updateSceneField = function(sceneIndex, field, value) {
    if (!state.scenes[sceneIndex]) return;

    state.scenes[sceneIndex][field] = value;
    saveToLocalStorage();
    console.log(`Updated scene ${sceneIndex} ${field}: ${value}`);
};

/**
 * Update character field
 * @param {number} sceneIndex - Scene index
 * @param {string} character - Character name
 * @param {string} field - Field name
 * @param {*} value - Field value
 */
window.updateCharField = function(sceneIndex, character, field, value) {
    const scene = state.scenes[sceneIndex];
    if (!scene) return;

    if (!state.characterStates[sceneIndex]) state.characterStates[sceneIndex] = {};
    if (!state.characterStates[sceneIndex][character]) state.characterStates[sceneIndex][character] = {};

    state.characterStates[sceneIndex][character][field] = value;
    saveToLocalStorage();
    console.log(`Updated ${character} ${field}: ${value}`);
};

/**
 * Save to localStorage
 */
function saveToLocalStorage() {
    import('./export-handlers.js').then(module => module.saveProject());
}

/**
 * Copy character state from previous scene
 * @param {string} character - Character name
 * @param {number} sceneIndex - Current scene index
 */
window.copyFromPrevious = function(character, sceneIndex) {
    const prevState = findPreviousCharacterAppearance(character, sceneIndex);
    if (!prevState) {
        alert('No previous appearance found for ' + character);
        return;
    }

    if (!state.characterStates[sceneIndex]) {
        state.characterStates[sceneIndex] = {};
    }
    if (!state.characterStates[sceneIndex][character]) {
        state.characterStates[sceneIndex][character] = {};
    }

    // Copy exit states from previous scene to enter states of current scene
    state.characterStates[sceneIndex][character] = {
        ...state.characterStates[sceneIndex][character],
        enterHair: prevState.exitHair || prevState.enterHair || prevState.hair || '',
        enterMakeup: prevState.exitMakeup || prevState.enterMakeup || prevState.makeup || '',
        enterWardrobe: prevState.exitWardrobe || prevState.enterWardrobe || prevState.wardrobe || '',
        enterCondition: prevState.exitCondition || prevState.enterCondition || ''
    };

    renderSceneBreakdown(sceneIndex);
    saveToLocalStorage();
};

/**
 * Start new continuity event
 * @param {number} sceneIndex - Scene index
 */
window.startNewEvent = function(sceneIndex) {
    const breakdown = state.sceneBreakdowns[sceneIndex];
    const cast = breakdown?.cast || [];

    if (cast.length === 0) {
        alert('No characters in this scene. Add characters first.');
        return;
    }

    const character = prompt(`Character name (${cast.join(', ')}):`);
    if (!character || !cast.includes(character)) {
        alert('Invalid character name');
        return;
    }

    const type = prompt('Event type (injury, condition, transformation, wardrobe_change, makeup_effect):');
    if (!type) return;

    const description = prompt('Description:');
    if (!description) return;

    if (window.continuityTracker) {
        window.continuityTracker.createEvent(sceneIndex, character, type, description);
        renderSceneBreakdown(sceneIndex);
        saveToLocalStorage();
    } else {
        alert('Continuity tracker not available');
    }
};

/**
 * Link to existing event
 * @param {number} sceneIndex - Scene index
 */
window.linkExistingEvent = function(sceneIndex) {
    alert('Feature coming soon: Link this scene to an existing continuity event');
};

/**
 * End continuity event at a specific scene
 * @param {string} eventId - Event ID
 * @param {number} sceneIndex - Scene index where event ends
 */
window.endEventAtScene = function(eventId, sceneIndex) {
    if (!window.continuityTracker) {
        alert('Continuity tracker not available');
        return;
    }

    const events = Array.from(window.continuityTracker.events.values());
    const event = events.find(e => e.id === eventId);

    if (!event) {
        alert('Event not found');
        return;
    }

    if (confirm(`End "${event.description}" at Scene ${sceneIndex + 1}?`)) {
        event.endScene = sceneIndex;
        window.continuityTracker.events.set(eventId, event);
        renderSceneBreakdown(sceneIndex);
        saveToLocalStorage();

        // Show message suggesting progression generation
        if (confirm('Event ended successfully! Would you like to generate progression stages now?')) {
            generateEventProgression(eventId);
        }
    }
};

/**
 * Generate AI progression for a continuity event
 * @param {string} eventId - Event ID
 */
window.generateEventProgression = async function(eventId) {
    if (!window.continuityTracker) {
        alert('Continuity tracker not available');
        return;
    }

    const events = Array.from(window.continuityTracker.events.values());
    const event = events.find(e => e.id === eventId);

    if (!event || !event.endScene) {
        alert('Event not found or not ended yet');
        return;
    }

    // Import AI module
    const { callAI } = await import('./ai-integration.js');

    const totalScenes = event.endScene - event.startScene + 1;
    const sceneNumbers = [];
    for (let i = event.startScene; i <= event.endScene; i++) {
        sceneNumbers.push(state.scenes[i]?.number || (i + 1));
    }

    const prompt = `Generate realistic progression stages for this continuity event:

Type: ${event.type}
Character: ${event.character}
Description: ${event.description}
Start Scene: ${event.startScene + 1} (Scene #${sceneNumbers[0]})
End Scene: ${event.endScene + 1} (Scene #${sceneNumbers[sceneNumbers.length - 1]})
Total Scenes: ${totalScenes}

Please create a progression stage for each scene from start to end.

Guidelines:
- For injuries: Show realistic healing stages (fresh wound → bandaged → scabbing → healing → healed/scarred)
- For conditions: Show progression or improvement over time
- For transformations: Show gradual change
- For wardrobe/makeup changes: Show how they evolve

Return as JSON array with exactly ${totalScenes} entries, one per scene.
Each entry should be a concise description (1-2 sentences) of the state at that scene.

Example format:
["Fresh cut on forehead, bleeding", "Wound cleaned and bandaged", "Bandage still on, slight bruising visible", "Bandage removed, scab forming", "Scab healing, slight scar visible"]

Return ONLY the JSON array, no other text.`;

    try {
        // Show loading state
        const currentScene = state.currentScene;
        if (currentScene !== null) {
            const eventsContainer = document.getElementById('scene-events');
            if (eventsContainer) {
                const loadingMsg = document.createElement('div');
                loadingMsg.className = 'loading-message';
                loadingMsg.textContent = '✨ Generating progression with AI...';
                eventsContainer.prepend(loadingMsg);
            }
        }

        const response = await callAI(prompt);

        // Parse response
        let progression;
        try {
            // Try to parse as JSON
            progression = JSON.parse(response);
        } catch (parseError) {
            // If parsing fails, try to extract JSON from response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                progression = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Could not parse AI response as JSON');
            }
        }

        // Validate progression
        if (!Array.isArray(progression) || progression.length !== totalScenes) {
            throw new Error(`Expected ${totalScenes} progression stages, got ${progression?.length || 0}`);
        }

        // Save progression to event
        event.progression = progression;
        window.continuityTracker.events.set(eventId, event);

        // Apply progression to character states
        applyProgressionToScenes(event);

        // Save and refresh
        saveToLocalStorage();
        if (state.currentScene !== null) {
            renderSceneBreakdown(state.currentScene);
        }

        alert('Progression generated successfully!');

    } catch (error) {
        console.error('Failed to generate progression:', error);
        alert(`Error generating progression: ${error.message}`);

        // Re-render to remove loading state
        if (state.currentScene !== null) {
            renderSceneBreakdown(state.currentScene);
        }
    }
};

/**
 * Apply progression to scene character states
 * @param {Object} event - Event with progression
 */
function applyProgressionToScenes(event) {
    if (!event.progression || !Array.isArray(event.progression)) return;

    for (let i = 0; i < event.progression.length; i++) {
        const sceneIndex = event.startScene + i;
        const stage = event.progression[i];

        if (!state.characterStates[sceneIndex]) {
            state.characterStates[sceneIndex] = {};
        }
        if (!state.characterStates[sceneIndex][event.character]) {
            state.characterStates[sceneIndex][event.character] = {};
        }

        // Add progression to changes field
        const existingChanges = state.characterStates[sceneIndex][event.character].changes || '';
        const progressionNote = `[${event.type}] ${stage}`;

        // Only add if not already there
        if (!existingChanges.includes(progressionNote)) {
            state.characterStates[sceneIndex][event.character].changes =
                existingChanges ? `${existingChanges}\n${progressionNote}` : progressionNote;
        }
    }
}

// ============================================================================
// COMPREHENSIVE BREAKDOWN RENDERING (Character States & Continuity Events)
// ============================================================================

/**
 * Render comprehensive breakdown with character states and continuity events
 */
export function renderComprehensiveBreakdown() {
    const scene = state.scenes[state.currentScene];
    if (!scene) return;

    const sceneIndex = state.currentScene;
    const breakdown = state.sceneBreakdowns[sceneIndex] || { cast: [] };
    const cast = breakdown.cast || [];

    const html = `
        <div class="comprehensive-breakdown">
            ${renderSceneNavigationBar()}

            <!-- Story Timeline Section -->
            <div class="breakdown-section timeline-section">
                <div class="section-header" onclick="toggleSection('timeline-section')">
                    <div class="section-title-row">
                        <span class="section-icon">📅</span>
                        <span class="section-title">STORY TIMELINE</span>
                    </div>
                    <span class="section-toggle">▼</span>
                </div>
                <div class="section-content">
                    ${renderTimelineFields(sceneIndex)}
                </div>
            </div>

            <!-- Character States Section -->
            <div class="breakdown-section character-states-section">
                <div class="section-header" onclick="toggleSection('character-states-section')">
                    <div class="section-title-row">
                        <span class="section-icon">👤</span>
                        <span class="section-title">CHARACTER STATES</span>
                        <span class="section-count">${cast.length}</span>
                    </div>
                    <span class="section-toggle">▼</span>
                </div>
                <div class="section-content">
                    <div id="character-states-container">
                        ${cast.length > 0 ?
                            cast.map(character => renderCharacterState(character, sceneIndex)).join('') :
                            '<div class="empty-message">No characters in this scene</div>'
                        }
                    </div>
                </div>
            </div>

            <!-- Continuity Events Section -->
            <div class="breakdown-section events-section">
                <div class="section-header" onclick="toggleSection('events-section')">
                    <div class="section-title-row">
                        <span class="section-icon">🔗</span>
                        <span class="section-title">CONTINUITY EVENTS</span>
                    </div>
                    <span class="section-toggle">▼</span>
                </div>
                <div class="section-content">
                    ${renderContinuityEventsSection(sceneIndex)}
                </div>
            </div>

            <!-- Scene Navigation -->
            <div class="scene-navigation">
                <button class="nav-btn" onclick="navigatePreviousScene()" ${sceneIndex === 0 ? 'disabled' : ''}>
                    ← Previous
                </button>
                <button class="nav-btn primary" onclick="navigateNextScene()" ${sceneIndex >= state.scenes.length - 1 ? 'disabled' : ''}>
                    Save & Next →
                </button>
            </div>
        </div>
    `;

    const container = document.getElementById('breakdown-panel');
    if (container) container.innerHTML = html;
}

/**
 * Render timeline fields with supervisor cross-reference
 */
function renderTimelineFields(sceneIndex) {
    const timeline = state.sceneTimeline[sceneIndex] || {};
    const supervisorData = timeline.supervisorData;

    return `
        <div class="timeline-fields">
            <div class="field-group">
                <label>Story Day</label>
                ${renderFieldWithReference('story-day', timeline.day || '', supervisorData?.day)}
            </div>

            <div class="field-group">
                <label>Time of Day</label>
                <select id="time-of-day" onchange="updateTimelineField('time', this.value)">
                    <option value="" ${!timeline.time ? 'selected' : ''}>Select...</option>
                    <option value="Early Morning" ${timeline.time === 'Early Morning' ? 'selected' : ''}>Early Morning</option>
                    <option value="Morning" ${timeline.time === 'Morning' ? 'selected' : ''}>Morning</option>
                    <option value="Midday" ${timeline.time === 'Midday' ? 'selected' : ''}>Midday</option>
                    <option value="Afternoon" ${timeline.time === 'Afternoon' ? 'selected' : ''}>Afternoon</option>
                    <option value="Evening" ${timeline.time === 'Evening' ? 'selected' : ''}>Evening</option>
                    <option value="Night" ${timeline.time === 'Night' ? 'selected' : ''}>Night</option>
                    <option value="Late Night" ${timeline.time === 'Late Night' ? 'selected' : ''}>Late Night</option>
                </select>
                ${supervisorData?.time ? renderSupervisorIndicator(supervisorData.time, timeline.time) : ''}
            </div>

            <div class="field-group">
                <label>Special Timeline</label>
                <div class="checkbox-group">
                    <label><input type="checkbox" id="is-flashback" onchange="updateTimelineFlag('flashback', this.checked)" ${timeline.flashback ? 'checked' : ''}> Flashback</label>
                    <label><input type="checkbox" id="is-flashforward" onchange="updateTimelineFlag('flashforward', this.checked)" ${timeline.flashforward ? 'checked' : ''}> Flash-forward</label>
                    <label><input type="checkbox" id="is-dream" onchange="updateTimelineFlag('dream', this.checked)" ${timeline.dream ? 'checked' : ''}> Dream/Fantasy</label>
                </div>
            </div>

            <div class="field-group">
                <label>Time Jump</label>
                <input type="text" id="time-jump" placeholder="e.g., '3 days later', '2 weeks earlier'" value="${escapeHtml(timeline.timeJump || '')}" onchange="updateTimelineField('timeJump', this.value)">
            </div>

            ${supervisorData?.notes ? `
            <div class="field-group">
                <label>Supervisor Notes</label>
                <div class="supervisor-notes">${escapeHtml(supervisorData.notes)}</div>
            </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render field with supervisor cross-reference
 */
function renderFieldWithReference(fieldId, ourValue, supervisorValue) {
    const matches = ourValue === supervisorValue;
    const hasSupData = supervisorValue !== undefined && supervisorValue !== null && supervisorValue !== '';

    return `
        <div class="field-with-reference">
            <input type="text"
                   id="${fieldId}"
                   value="${escapeHtml(ourValue)}"
                   placeholder="Enter value"
                   onchange="updateTimelineField('day', this.value)"
                   class="${hasSupData && !matches ? 'discrepancy' : ''}">
            ${hasSupData ? renderSupervisorIndicator(supervisorValue, ourValue) : ''}
        </div>
    `;
}

/**
 * Render supervisor reference indicator
 */
function renderSupervisorIndicator(supervisorValue, ourValue) {
    const matches = supervisorValue === ourValue;
    return `
        <span class="supervisor-ref ${matches ? 'match' : 'mismatch'}"
              title="Supervisor: ${escapeHtml(supervisorValue)}">
            ${matches ? '✓' : '⚠️'}
        </span>
    `;
}

/**
 * Render character state component with enter/exit states
 */
function renderCharacterState(character, sceneIndex) {
    const charState = state.characterStates[sceneIndex]?.[character] || {};
    const previousState = getPreviousCharacterState(character, sceneIndex);
    const activeEvents = window.continuityTracker?.getCharacterEvents(character).filter(e =>
        sceneIndex >= e.startScene && (!e.endScene || sceneIndex <= e.endScene)
    ) || [];

    return `
        <div class="character-state-card" data-character="${escapeHtml(character)}">
            <div class="character-header" onclick="toggleCharacterDetails('${escapeHtml(character)}')">
                <h5>${escapeHtml(character)}</h5>
                ${activeEvents.length > 0 ? `<span class="event-badge">${activeEvents.length}</span>` : ''}
                <button class="expand-btn">▼</button>
            </div>

            <div class="character-details" id="details-${escapeHtml(character).replace(/\s/g, '-')}">
                <!-- ENTERING LOOK -->
                <div class="state-section">
                    <div class="state-section-header">
                        <label>Enters Scene With:</label>
                        <button class="helper-btn" onclick="copyFromPrevious('${escapeHtml(character)}')">
                            📋 Copy from Previous
                        </button>
                    </div>
                    <div class="state-fields">
                        <div class="department-field">
                            <label class="department-label">Hair</label>
                            <input type="text"
                                   class="department-input"
                                   placeholder="Hair description"
                                   value="${escapeHtml(charState.hair || previousState?.hair || '')}"
                                   onchange="updateCharacterField('${escapeHtml(character)}', 'hair', this.value)">
                        </div>
                        <div class="department-field">
                            <label class="department-label">Makeup</label>
                            <input type="text"
                                   class="department-input"
                                   placeholder="Makeup description"
                                   value="${escapeHtml(charState.makeup || previousState?.makeup || '')}"
                                   onchange="updateCharacterField('${escapeHtml(character)}', 'makeup', this.value)">
                        </div>
                        <div class="department-field">
                            <label class="department-label">Wardrobe</label>
                            <input type="text"
                                   class="department-input"
                                   placeholder="Wardrobe description"
                                   value="${escapeHtml(charState.wardrobe || previousState?.wardrobe || '')}"
                                   onchange="updateCharacterField('${escapeHtml(character)}', 'wardrobe', this.value)">
                        </div>
                        <div class="department-field">
                            <label class="department-label">Notes</label>
                            <textarea class="department-input"
                                      rows="2"
                                      placeholder="Additional notes"
                                      onchange="updateCharacterField('${escapeHtml(character)}', 'notes', this.value)">${escapeHtml(charState.notes || '')}</textarea>
                        </div>
                    </div>
                </div>

                <!-- CHANGES DURING SCENE -->
                <div class="state-section">
                    <div class="state-section-header">
                        <label>Changes During Scene:</label>
                        <button class="helper-btn" onclick="addCharacterChange('${escapeHtml(character)}')">
                            + Add Change
                        </button>
                    </div>
                    <div id="changes-${escapeHtml(character).replace(/\s/g, '-')}">
                        ${renderSceneChanges(character, sceneIndex)}
                    </div>
                </div>

                <!-- ACTIVE CONTINUITY -->
                ${activeEvents.length > 0 ? `
                <div class="state-section">
                    <label>Active Continuity:</label>
                    <div class="active-continuity">
                        ${activeEvents.map(event => renderActiveEventBadge(event, sceneIndex)).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- AI FILL BUTTON -->
                <div class="state-section">
                    <button class="ai-fill-btn" onclick="fillCharacterFieldsAI('${escapeHtml(character)}')">
                        ✨ AI Fill Character Details
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Get previous character state
 */
function getPreviousCharacterState(character, currentSceneIndex) {
    for (let i = currentSceneIndex - 1; i >= 0; i--) {
        if (state.characterStates[i] && state.characterStates[i][character]) {
            return state.characterStates[i][character];
        }
    }
    return null;
}

/**
 * Render scene changes for a character
 */
function renderSceneChanges(character, sceneIndex) {
    const changes = state.characterStates[sceneIndex]?.[character]?.changes || [];

    if (changes.length === 0) {
        return '<div class="empty-message">No changes recorded</div>';
    }

    return changes.map((change, index) => `
        <div class="change-item">
            <div class="change-description">${escapeHtml(change.description)}</div>
            <button class="remove-change-btn" onclick="removeCharacterChange('${escapeHtml(character)}', ${index})">×</button>
        </div>
    `).join('');
}

/**
 * Render active event badge
 */
function renderActiveEventBadge(event, sceneIndex) {
    const stage = window.continuityTracker?.getCurrentStage(event, sceneIndex);
    return `
        <div class="event-badge-item" onclick="viewEventDetails('${event.id}')">
            <span class="event-type">${event.type}</span>
            <span class="event-stage">${stage?.stage || 'active'}</span>
        </div>
    `;
}

/**
 * Render continuity events section
 */
function renderContinuityEventsSection(sceneIndex) {
    const activeEvents = window.continuityTracker?.getActiveEvents(sceneIndex) || [];

    return `
        <div class="events-toolbar">
            <button class="add-event-btn" onclick="addContinuityEvent()">+ New Event</button>
            <button class="link-event-btn" onclick="linkToExistingEvent()">Link Existing</button>
        </div>

        <div id="continuity-events-list">
            ${activeEvents.length > 0 ?
                activeEvents.map(event => renderContinuityEvent(event, sceneIndex)).join('') :
                '<div class="empty-message">No active continuity events</div>'
            }
        </div>
    `;
}

/**
 * Render individual continuity event
 */
function renderContinuityEvent(event, currentScene) {
    const isActive = currentScene >= event.startScene &&
                    (!event.endScene || currentScene <= event.endScene);
    const stage = window.continuityTracker?.getCurrentStage(event, currentScene);

    return `
        <div class="continuity-event ${isActive ? 'active' : 'inactive'}"
             data-event-id="${event.id}">
            <div class="event-header">
                <span class="event-type-tag">${event.type}</span>
                <span class="event-character-tag">${escapeHtml(event.character)}</span>
            </div>

            <div class="event-body">
                <div class="event-description">${escapeHtml(event.description)}</div>

                <div class="event-timeline">
                    <div class="event-timeline-info">
                        Start: Scene ${event.startScene}
                        ${event.endScene ? ` → End: Scene ${event.endScene}` : ' → Ongoing'}
                    </div>
                </div>

                ${isActive && stage ? `
                    <div class="event-current-stage">
                        <strong>Current Stage:</strong> ${escapeHtml(stage.description)}
                        ${stage.makeupNotes ? `<div class="stage-notes">Makeup: ${escapeHtml(stage.makeupNotes)}</div>` : ''}
                        ${stage.hairNotes ? `<div class="stage-notes">Hair: ${escapeHtml(stage.hairNotes)}</div>` : ''}
                    </div>
                ` : ''}

                <div class="event-actions">
                    ${!event.endScene ? `
                        <button class="event-action-btn" onclick="closeEvent('${event.id}', ${currentScene})">
                            Mark as Resolved
                        </button>
                    ` : ''}
                    <button class="event-action-btn" onclick="editEvent('${event.id}')">Edit</button>
                    <button class="event-action-btn" onclick="viewEventProgression('${event.id}')">View Timeline</button>
                    <button class="event-action-btn danger" onclick="deleteEvent('${event.id}')">Delete</button>
                </div>
            </div>
        </div>
    `;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Toggle character details visibility
 */
window.toggleCharacterDetails = function(character) {
    const detailsId = 'details-' + character.replace(/\s/g, '-');
    const details = document.getElementById(detailsId);
    if (details) {
        details.classList.toggle('collapsed');
    }
};

/**
 * Copy character state from previous scene
 */
window.copyFromPrevious = function(character) {
    const previousState = getPreviousCharacterState(character, state.currentScene);
    if (!previousState) {
        alert('No previous state found for this character');
        return;
    }

    if (!state.characterStates[state.currentScene]) {
        state.characterStates[state.currentScene] = {};
    }
    if (!state.characterStates[state.currentScene][character]) {
        state.characterStates[state.currentScene][character] = {};
    }

    state.characterStates[state.currentScene][character] = {
        ...state.characterStates[state.currentScene][character],
        hair: previousState.hair,
        makeup: previousState.makeup,
        wardrobe: previousState.wardrobe
    };

    renderBreakdownPanel();
    import('./export-handlers.js').then(module => module.saveProject());
};

/**
 * Add character change during scene
 */
window.addCharacterChange = function(character) {
    const description = prompt('Describe the change:');
    if (!description) return;

    if (!state.characterStates[state.currentScene]) {
        state.characterStates[state.currentScene] = {};
    }
    if (!state.characterStates[state.currentScene][character]) {
        state.characterStates[state.currentScene][character] = {};
    }
    if (!state.characterStates[state.currentScene][character].changes) {
        state.characterStates[state.currentScene][character].changes = [];
    }

    state.characterStates[state.currentScene][character].changes.push({
        description: description,
        timestamp: new Date().toISOString()
    });

    renderBreakdownPanel();
    import('./export-handlers.js').then(module => module.saveProject());
};

/**
 * Remove character change
 */
window.removeCharacterChange = function(character, index) {
    if (!confirm('Remove this change?')) return;

    const changes = state.characterStates[state.currentScene]?.[character]?.changes;
    if (changes) {
        changes.splice(index, 1);
        renderBreakdownPanel();
        import('./export-handlers.js').then(module => module.saveProject());
    }
};

/**
 * Update timeline field
 */
window.updateTimelineField = function(field, value) {
    if (!state.sceneTimeline[state.currentScene]) {
        state.sceneTimeline[state.currentScene] = {};
    }

    state.sceneTimeline[state.currentScene][field] = value;
    import('./export-handlers.js').then(module => module.saveProject());
};

/**
 * Update timeline flag (checkbox)
 */
window.updateTimelineFlag = function(flag, checked) {
    if (!state.sceneTimeline[state.currentScene]) {
        state.sceneTimeline[state.currentScene] = {};
    }

    state.sceneTimeline[state.currentScene][flag] = checked;
    import('./export-handlers.js').then(module => module.saveProject());
};

/**
 * Navigate to previous scene
 */
window.navigatePreviousScene = function() {
    if (state.currentScene > 0) {
        import('./main.js').then(module => module.selectScene(state.currentScene - 1));
    }
};

/**
 * Navigate to next scene
 */
window.navigateNextScene = function() {
    if (state.currentScene < state.scenes.length - 1) {
        import('./main.js').then(module => module.selectScene(state.currentScene + 1));
    }
};

/**
 * Toggle section collapsed/expanded
 */
window.toggleSection = function(sectionClass) {
    const section = document.querySelector(`.${sectionClass}`);
    if (section) {
        section.classList.toggle('collapsed');
    }
};

/**
 * Add continuity event
 */
window.addContinuityEvent = function() {
    // Get characters in current scene
    const breakdown = state.sceneBreakdowns[state.currentScene];
    const cast = breakdown?.cast || [];

    if (cast.length === 0) {
        alert('No characters in this scene');
        return;
    }

    // Simple prompt-based creation (can be enhanced with modal)
    const character = prompt(`Enter character name (${cast.join(', ')}):`);
    if (!character || !cast.includes(character)) {
        alert('Invalid character name');
        return;
    }

    const type = prompt('Event type (injury, condition, transformation, wardrobe_change, makeup_effect):');
    if (!type) return;

    const description = prompt('Description:');
    if (!description) return;

    const event = window.continuityTracker.createEvent(state.currentScene, character, type, description);

    renderBreakdownPanel();
    import('./export-handlers.js').then(module => module.saveProject());
};

/**
 * Close/resolve event
 */
window.closeEvent = function(eventId, endScene) {
    if (!confirm('Mark this event as resolved in this scene?')) return;

    window.continuityTracker.closeEvent(eventId, endScene);

    renderBreakdownPanel();
    import('./export-handlers.js').then(module => module.saveProject());
};

/**
 * Delete event
 */
window.deleteEvent = function(eventId) {
    if (!confirm('Delete this continuity event? This cannot be undone.')) return;

    window.continuityTracker.deleteEvent(eventId);

    renderBreakdownPanel();
    import('./export-handlers.js').then(module => module.saveProject());
};

/**
 * View event details (placeholder - can be enhanced)
 */
window.viewEventDetails = function(eventId) {
    const event = window.continuityTracker.events.get(eventId);
    if (!event) return;

    alert(`Event: ${event.type}\nCharacter: ${event.character}\nScenes: ${event.startScene} to ${event.endScene || 'ongoing'}\nDescription: ${event.description}`);
};

/**
 * Edit event (placeholder - can be enhanced)
 */
window.editEvent = function(eventId) {
    const event = window.continuityTracker.events.get(eventId);
    if (!event) return;

    const newDescription = prompt('Edit description:', event.description);
    if (newDescription) {
        event.description = newDescription;
        renderBreakdownPanel();
        import('./export-handlers.js').then(module => module.saveProject());
    }
};

/**
 * View event progression timeline (placeholder - can be enhanced)
 */
window.viewEventProgression = function(eventId) {
    const event = window.continuityTracker.events.get(eventId);
    if (!event) return;

    let msg = `Progression for ${event.character} - ${event.type}:\n\n`;

    if (event.progression && event.progression.length > 0) {
        for (const stage of event.progression) {
            msg += `Scene ${stage.sceneIndex}: ${stage.stage}\n${stage.description}\n\n`;
        }
    } else {
        msg += 'No progression generated yet.';
    }

    alert(msg);
};

/**
 * Link to existing event (placeholder - can be enhanced)
 */
window.linkToExistingEvent = function() {
    alert('Feature coming soon: Link this scene to an existing continuity event');
};

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.openAddElement = openAddElement;
window.closeAddElementModal = closeAddElementModal;
window.confirmAddElement = confirmAddElement;
window.removeElement = removeElement;
window.renderBreakdownPanel = renderBreakdownPanel;

// ============================================================================
// COMPREHENSIVE SCENE BREAKDOWN WITH ENTER/CHANGE/EXIT WORKFLOW
// ============================================================================

/**
 * Enhanced selectScene function with comprehensive breakdown panel
 * This provides a dedicated workflow for tracking character states and continuity
 */
export function selectScene(sceneIndex) {
    const scene = state.scenes[sceneIndex];
    if (!scene) return;

    state.currentScene = sceneIndex;

    const panel = document.getElementById('breakdown-panel');
    if (!panel) return;

    const breakdown = state.sceneBreakdowns[sceneIndex] || {};
    const cast = breakdown.cast || [];

    panel.innerHTML = `
        <div class="scene-breakdown-content">
            <!-- Scene Header -->
            <div class="breakdown-header">
                <h3>Scene ${sceneIndex + 1} of ${state.scenes.length}</h3>
                <div class="scene-heading">${escapeHtml(scene.heading || '')}</div>
                ${window.supervisorReference?.scenes?.[sceneIndex] ?
                    `<div class="supervisor-ref">📋 Supervisor: ${escapeHtml(window.supervisorReference.scenes[sceneIndex].day)}</div>` : ''}
            </div>

            <!-- Story Timeline Section -->
            <div class="breakdown-section" id="timeline-section">
                <h4 class="section-title-compact" onclick="toggleBreakdownSection('timeline-section')">
                    <span class="section-toggle-icon">▼</span>
                    STORY TIMELINE
                </h4>
                <div class="section-content-compact">
                    ${renderStoryTimeline(scene, sceneIndex)}
                </div>
            </div>

            <!-- Character States Section -->
            <div class="breakdown-section" id="character-continuity-section">
                <h4 class="section-title-compact" onclick="toggleBreakdownSection('character-continuity-section')">
                    <span class="section-toggle-icon">▼</span>
                    CHARACTER CONTINUITY
                    <span class="section-count-badge">${cast.length}</span>
                </h4>
                <div class="section-content-compact">
                    <div id="character-states">
                        ${renderCharacterContinuityStates(scene, sceneIndex, cast)}
                    </div>
                </div>
            </div>

            <!-- Active Continuity Events -->
            <div class="breakdown-section" id="continuity-events-section">
                <h4 class="section-title-compact" onclick="toggleBreakdownSection('continuity-events-section')">
                    <span class="section-toggle-icon">▼</span>
                    CONTINUITY EVENTS
                </h4>
                <div class="section-content-compact">
                    <div class="events-toolbar">
                        <button onclick="startContinuityEvent(${sceneIndex})" class="small-btn">+ Start New Event</button>
                        <button onclick="linkExistingEvent(${sceneIndex})" class="small-btn">Link Existing</button>
                    </div>
                    <div id="continuity-events">
                        ${renderActiveContinuityEvents(scene, sceneIndex)}
                    </div>
                </div>
            </div>

            <!-- Navigation -->
            <div class="breakdown-navigation">
                <button onclick="navigateToScene(${Math.max(0, sceneIndex - 1)})"
                        class="nav-btn-compact"
                        ${sceneIndex === 0 ? 'disabled' : ''}>
                    ← Previous Scene
                </button>
                <span class="scene-counter">${sceneIndex + 1} / ${state.scenes.length}</span>
                <button onclick="navigateToScene(${Math.min(state.scenes.length - 1, sceneIndex + 1)})"
                        class="nav-btn-compact"
                        ${sceneIndex === state.scenes.length - 1 ? 'disabled' : ''}>
                    Next Scene →
                </button>
            </div>
        </div>
    `;
}

/**
 * Render story timeline fields
 */
function renderStoryTimeline(scene, sceneIndex) {
    const timeline = state.sceneTimeline[sceneIndex] || {};
    const supervisorData = window.supervisorReference?.scenes?.[sceneIndex];

    return `
        <div class="field-row">
            <div class="field-group">
                <label>Story Day</label>
                <input type="text" id="story-day"
                       value="${escapeHtml(timeline.day || scene.storyDay || '')}"
                       placeholder="Day 1, Day 2, etc."
                       onchange="updateSceneData(${sceneIndex}, 'storyDay', this.value)">
                ${supervisorData?.day ?
                    `<span class="cross-ref">Sup: ${escapeHtml(supervisorData.day)}</span>` : ''}
            </div>

            <div class="field-group">
                <label>Time of Day</label>
                <select id="time-of-day"
                        onchange="updateSceneData(${sceneIndex}, 'timeOfDay', this.value)">
                    <option value="">Select...</option>
                    <option ${(timeline.time || scene.timeOfDay) === 'Early Morning' ? 'selected' : ''}>Early Morning</option>
                    <option ${(timeline.time || scene.timeOfDay) === 'Morning' ? 'selected' : ''}>Morning</option>
                    <option ${(timeline.time || scene.timeOfDay) === 'Midday' ? 'selected' : ''}>Midday</option>
                    <option ${(timeline.time || scene.timeOfDay) === 'Afternoon' ? 'selected' : ''}>Afternoon</option>
                    <option ${(timeline.time || scene.timeOfDay) === 'Evening' ? 'selected' : ''}>Evening</option>
                    <option ${(timeline.time || scene.timeOfDay) === 'Night' ? 'selected' : ''}>Night</option>
                    <option ${(timeline.time || scene.timeOfDay) === 'Late Night' ? 'selected' : ''}>Late Night</option>
                </select>
            </div>
        </div>

        <div class="field-row">
            <label class="checkbox-label">
                <input type="checkbox"
                       ${timeline.flashback || scene.isFlashback ? 'checked' : ''}
                       onchange="updateSceneData(${sceneIndex}, 'isFlashback', this.checked)">
                Flashback
            </label>
            <label class="checkbox-label">
                <input type="checkbox"
                       ${timeline.flashforward || scene.isFlashforward ? 'checked' : ''}
                       onchange="updateSceneData(${sceneIndex}, 'isFlashforward', this.checked)">
                Flash-forward
            </label>
            <label class="checkbox-label">
                <input type="checkbox"
                       ${timeline.dream || scene.isDream ? 'checked' : ''}
                       onchange="updateSceneData(${sceneIndex}, 'isDream', this.checked)">
                Dream/Fantasy
            </label>
        </div>

        <div class="field-group">
            <label>Time Jump</label>
            <input type="text"
                   value="${escapeHtml(timeline.timeJump || scene.timeJump || '')}"
                   placeholder="e.g., '3 days later', '2 weeks earlier'"
                   onchange="updateSceneData(${sceneIndex}, 'timeJump', this.value)">
        </div>
    `;
}

/**
 * Render character continuity states with enter/change/exit workflow
 */
function renderCharacterContinuityStates(scene, sceneIndex, cast) {
    if (cast.length === 0) {
        return '<div class="empty-state">No characters in this scene. Use AI detection or add manually.</div>';
    }

    return cast.map(char => {
        const state_data = state.characterStates[sceneIndex]?.[char] || {};
        const prevState = getPreviousCharacterState(char, sceneIndex);

        return `
            <div class="character-continuity-card" data-character="${escapeHtml(char)}">
                <div class="character-header" onclick="toggleCharacterCard('${escapeHtml(char).replace(/\s/g, '_')}')">
                    <h5>${escapeHtml(char)}</h5>
                    <button onclick="event.stopPropagation(); copyFromPreviousScene('${escapeHtml(char).replace(/'/g, "\\'")}', ${sceneIndex})"
                            class="copy-btn"
                            title="Copy from previous appearance">
                        ↓
                    </button>
                </div>

                <div class="character-card-body" id="char-card-${escapeHtml(char).replace(/\s/g, '_')}">
                    <!-- ENTERS WITH -->
                    <div class="continuity-phase">
                        <label class="phase-label">Enters Scene With:</label>
                        <div class="continuity-fields">
                            <input type="text"
                                   placeholder="Hair (${prevState?.hair || 'describe'})"
                                   value="${escapeHtml(state_data.enterHair || '')}"
                                   onchange="updateCharacterPhaseField(${sceneIndex}, '${escapeHtml(char).replace(/'/g, "\\'")}', 'enterHair', this.value)">
                            <input type="text"
                                   placeholder="Makeup (${prevState?.makeup || 'describe'})"
                                   value="${escapeHtml(state_data.enterMakeup || '')}"
                                   onchange="updateCharacterPhaseField(${sceneIndex}, '${escapeHtml(char).replace(/'/g, "\\'")}', 'enterMakeup', this.value)">
                            <input type="text"
                                   placeholder="Wardrobe (${prevState?.wardrobe || 'describe'})"
                                   value="${escapeHtml(state_data.enterWardrobe || '')}"
                                   onchange="updateCharacterPhaseField(${sceneIndex}, '${escapeHtml(char).replace(/'/g, "\\'")}', 'enterWardrobe', this.value)">
                            <input type="text"
                                   placeholder="Condition/Health"
                                   value="${escapeHtml(state_data.enterCondition || '')}"
                                   onchange="updateCharacterPhaseField(${sceneIndex}, '${escapeHtml(char).replace(/'/g, "\\'")}', 'enterCondition', this.value)">
                        </div>
                    </div>

                    <!-- CHANGES DURING -->
                    <div class="continuity-phase">
                        <label class="phase-label">Changes During Scene:</label>
                        <div class="continuity-fields">
                            <textarea placeholder="Describe any changes that happen during the scene..."
                                      onchange="updateCharacterPhaseField(${sceneIndex}, '${escapeHtml(char).replace(/'/g, "\\'")}', 'changes', this.value)"
                                      >${escapeHtml(state_data.changes || '')}</textarea>
                            <button onclick="addDetailedChange('${escapeHtml(char).replace(/'/g, "\\'")}', ${sceneIndex})"
                                    class="add-change-btn">
                                + Add Specific Change
                            </button>
                        </div>
                    </div>

                    <!-- EXITS WITH -->
                    <div class="continuity-phase">
                        <label class="phase-label">Exits Scene With:</label>
                        <div class="continuity-fields">
                            <input type="text"
                                   placeholder="Hair"
                                   value="${escapeHtml(state_data.exitHair || '')}"
                                   onchange="updateCharacterPhaseField(${sceneIndex}, '${escapeHtml(char).replace(/'/g, "\\'")}', 'exitHair', this.value)">
                            <input type="text"
                                   placeholder="Makeup"
                                   value="${escapeHtml(state_data.exitMakeup || '')}"
                                   onchange="updateCharacterPhaseField(${sceneIndex}, '${escapeHtml(char).replace(/'/g, "\\'")}', 'exitMakeup', this.value)">
                            <input type="text"
                                   placeholder="Wardrobe"
                                   value="${escapeHtml(state_data.exitWardrobe || '')}"
                                   onchange="updateCharacterPhaseField(${sceneIndex}, '${escapeHtml(char).replace(/'/g, "\\'")}', 'exitWardrobe', this.value)">
                            <input type="text"
                                   placeholder="Condition/Health"
                                   value="${escapeHtml(state_data.exitCondition || '')}"
                                   onchange="updateCharacterPhaseField(${sceneIndex}, '${escapeHtml(char).replace(/'/g, "\\'")}', 'exitCondition', this.value)">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Render active continuity events for the scene
 */
function renderActiveContinuityEvents(scene, sceneIndex) {
    const events = Array.from(window.continuityTracker?.events?.values() || []);
    const sceneEvents = events.filter(e =>
        sceneIndex >= e.startScene && (!e.endScene || sceneIndex <= e.endScene)
    );

    if (sceneEvents.length === 0) {
        return '<div class="empty-state">No active continuity events</div>';
    }

    return sceneEvents.map(event => `
        <div class="event-card ${event.type}">
            <div class="event-header">
                <span class="event-type">${escapeHtml(event.type)}</span>
                <span class="event-character">${escapeHtml(event.character)}</span>
            </div>
            <div class="event-body">
                <div class="event-description">${escapeHtml(event.description)}</div>
                <div class="event-status">
                    Scene ${event.startScene + 1} → ${event.endScene ? `Scene ${event.endScene + 1}` : 'Ongoing'}
                </div>
                ${!event.endScene ? `
                    <button onclick="endContinuityEvent('${event.id}', ${sceneIndex})" class="end-event-btn">
                        Mark as Resolved in This Scene
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

/**
 * Get previous character state from earlier scenes
 */
function getPreviousCharacterStateEnhanced(character, currentSceneIndex) {
    for (let i = currentSceneIndex - 1; i >= 0; i--) {
        const scene = state.scenes[i];
        const breakdown = state.sceneBreakdowns[i];

        if (breakdown?.cast?.includes(character) && state.characterStates[i]?.[character]) {
            const charState = state.characterStates[i][character];

            // Return exit state if available, otherwise enter state
            return {
                hair: charState.exitHair || charState.enterHair || charState.hair || '',
                makeup: charState.exitMakeup || charState.enterMakeup || charState.makeup || '',
                wardrobe: charState.exitWardrobe || charState.enterWardrobe || charState.wardrobe || '',
                condition: charState.exitCondition || charState.enterCondition || ''
            };
        }
    }
    return null;
}

// ============================================================================
// EVENT HANDLERS FOR COMPREHENSIVE BREAKDOWN
// ============================================================================

/**
 * Toggle breakdown section expanded/collapsed
 */
window.toggleBreakdownSection = function(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const content = section.querySelector('.section-content-compact');
    const icon = section.querySelector('.section-toggle-icon');

    if (content && icon) {
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.textContent = '▼';
        } else {
            content.style.display = 'none';
            icon.textContent = '▶';
        }
    }
};

/**
 * Toggle character card expanded/collapsed
 */
window.toggleCharacterCard = function(characterId) {
    const cardBody = document.getElementById(`char-card-${characterId}`);
    if (cardBody) {
        cardBody.style.display = cardBody.style.display === 'none' ? 'block' : 'none';
    }
};

/**
 * Copy character state from previous scene
 */
window.copyFromPreviousScene = function(character, sceneIndex) {
    const prevState = getPreviousCharacterStateEnhanced(character, sceneIndex);
    if (!prevState) {
        alert('No previous appearance found for ' + character);
        return;
    }

    if (!state.characterStates[sceneIndex]) {
        state.characterStates[sceneIndex] = {};
    }
    if (!state.characterStates[sceneIndex][character]) {
        state.characterStates[sceneIndex][character] = {};
    }

    state.characterStates[sceneIndex][character] = {
        ...state.characterStates[sceneIndex][character],
        enterHair: prevState.hair,
        enterMakeup: prevState.makeup,
        enterWardrobe: prevState.wardrobe,
        enterCondition: prevState.condition
    };

    selectScene(sceneIndex); // Refresh display
    import('./export-handlers.js').then(module => module.saveProject());
};

/**
 * Update character phase field (enter/exit states)
 */
window.updateCharacterPhaseField = function(sceneIndex, character, field, value) {
    if (!state.characterStates[sceneIndex]) {
        state.characterStates[sceneIndex] = {};
    }
    if (!state.characterStates[sceneIndex][character]) {
        state.characterStates[sceneIndex][character] = {};
    }

    state.characterStates[sceneIndex][character][field] = value;

    // Auto-save
    import('./export-handlers.js').then(module => module.saveProject());
};

/**
 * Update scene data (timeline fields)
 */
window.updateSceneData = function(sceneIndex, field, value) {
    if (!state.scenes[sceneIndex]) return;

    // Update scene metadata
    if (field === 'storyDay' || field === 'timeOfDay' || field === 'isFlashback' ||
        field === 'isFlashforward' || field === 'isDream' || field === 'timeJump') {
        state.scenes[sceneIndex][field] = value;

        // Also update timeline
        if (!state.sceneTimeline[sceneIndex]) {
            state.sceneTimeline[sceneIndex] = {};
        }

        if (field === 'storyDay') {
            state.sceneTimeline[sceneIndex].day = value;
        } else if (field === 'timeOfDay') {
            state.sceneTimeline[sceneIndex].time = value;
        } else if (field === 'isFlashback') {
            state.sceneTimeline[sceneIndex].flashback = value;
        } else if (field === 'isFlashforward') {
            state.sceneTimeline[sceneIndex].flashforward = value;
        } else if (field === 'isDream') {
            state.sceneTimeline[sceneIndex].dream = value;
        } else if (field === 'timeJump') {
            state.sceneTimeline[sceneIndex].timeJump = value;
        }
    }

    // Auto-save
    import('./export-handlers.js').then(module => module.saveProject());
};

/**
 * Add detailed change for character
 */
window.addDetailedChange = function(character, sceneIndex) {
    const description = prompt('Describe the specific change:');
    if (!description) return;

    if (!state.characterStates[sceneIndex]) {
        state.characterStates[sceneIndex] = {};
    }
    if (!state.characterStates[sceneIndex][character]) {
        state.characterStates[sceneIndex][character] = {};
    }
    if (!state.characterStates[sceneIndex][character].detailedChanges) {
        state.characterStates[sceneIndex][character].detailedChanges = [];
    }

    state.characterStates[sceneIndex][character].detailedChanges.push({
        description: description,
        timestamp: new Date().toISOString()
    });

    selectScene(sceneIndex); // Refresh
    import('./export-handlers.js').then(module => module.saveProject());
};

/**
 * Start new continuity event
 */
window.startContinuityEvent = function(sceneIndex) {
    const breakdown = state.sceneBreakdowns[sceneIndex];
    const cast = breakdown?.cast || [];

    if (cast.length === 0) {
        alert('No characters in this scene. Add characters first.');
        return;
    }

    const character = prompt(`Character name (${cast.join(', ')}):`);
    if (!character || !cast.includes(character)) {
        alert('Invalid character name');
        return;
    }

    const type = prompt('Event type (injury, condition, transformation, wardrobe_change, makeup_effect):');
    if (!type) return;

    const description = prompt('Description:');
    if (!description) return;

    if (window.continuityTracker) {
        window.continuityTracker.createEvent(sceneIndex, character, type, description);
        selectScene(sceneIndex); // Refresh
        import('./export-handlers.js').then(module => module.saveProject());
    }
};

/**
 * Link to existing event
 */
window.linkExistingEvent = function(sceneIndex) {
    alert('Feature coming soon: Link this scene to an existing continuity event');
};

/**
 * End continuity event
 */
window.endContinuityEvent = function(eventId, sceneIndex) {
    if (!confirm('Mark this event as resolved in this scene?')) return;

    if (window.continuityTracker) {
        window.continuityTracker.closeEvent(eventId, sceneIndex);
        selectScene(sceneIndex); // Refresh
        import('./export-handlers.js').then(module => module.saveProject());
    }
};

// Expose scene processing functions globally for HTML onclick handlers
window.handleProcessScene = handleProcessScene;
window.handleGenerateSynopsisOnly = handleGenerateSynopsisOnly;
window.handleGenerateTagsOnly = handleGenerateTagsOnly;

// Expose selectScene globally
window.selectScene = selectScene;
