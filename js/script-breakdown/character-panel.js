/**
 * character-panel.js
 * Character timeline view in center panel
 *
 * Responsibilities:
 * - Render character tabs in center panel
 * - Render character tab panels with timeline
 * - Display look states and continuity events
 * - Handle tab switching between script and characters
 * - Show story day cards and scene breakdowns
 */

import { state } from './main.js';
import { formatSceneRange, getComplexityIcon } from './utils.js';

/**
 * Render character tabs in center panel
 * Shows script tab plus tabs for each character
 */
export function renderCharacterTabs() {
    const tabsContainer = document.querySelector('.center-tabs');
    if (!tabsContainer) return;

    // Keep script tab
    const scriptTab = tabsContainer.querySelector('[data-tab="script"]');

    // Remove everything except script tab
    tabsContainer.innerHTML = '';
    if (scriptTab) {
        tabsContainer.appendChild(scriptTab);
    }

    // Add character tabs (from state.characterTabs)
    state.characterTabs.forEach(character => {
        const tab = document.createElement('div');
        tab.className = 'center-tab';
        tab.setAttribute('data-tab', `character-${character}`);
        tab.onclick = () => switchCenterTab(`character-${character}`);
        tab.innerHTML = `
            <span>👤 ${escapeHtml(character)}</span>
            <span class="center-tab-close" onclick="event.stopPropagation(); removeCharacterTab('${escapeHtml(character).replace(/'/g, "\\'")}')">×</span>
        `;
        tabsContainer.appendChild(tab);
    });
}

/**
 * Render character tab panels
 * Creates panels for each character with their timeline
 */
export function renderCharacterTabPanels() {
    const contentContainer = document.querySelector('.center-tab-content');
    if (!contentContainer) return;

    // Remove old character panels (keep script panel)
    const panels = contentContainer.querySelectorAll('[id^="characterTab-"]');
    panels.forEach(panel => panel.remove());

    // Create new panels
    state.characterTabs.forEach(character => {
        const panel = document.createElement('div');
        panel.className = 'center-tab-panel';
        panel.id = `characterTab-${character}`;

        panel.innerHTML = renderCharacterTimeline(character);

        contentContainer.appendChild(panel);
    });
}

/**
 * Switch between center tabs (script or character)
 * @param {string} tabName - Tab identifier ('script' or 'character-{name}')
 */
export function switchCenterTab(tabName) {
    state.activeCenterTab = tabName;

    // Update tab styling
    document.querySelectorAll('.center-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

    // Update panel visibility
    document.querySelectorAll('.center-tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    if (tabName === 'script') {
        document.getElementById('scriptTabPanel')?.classList.add('active');
    } else {
        const character = tabName.replace('character-', '');
        document.getElementById(`characterTab-${character}`)?.classList.add('active');
    }

    // Update right panel context
    updateRightPanelContext();
}

/**
 * Update right panel based on active center tab
 */
function updateRightPanelContext() {
    const rightSidebar = document.querySelector('.right-sidebar');
    if (!rightSidebar) return;

    if (state.activeCenterTab === 'script') {
        // Script tab active - restore breakdown panel structure if needed
        const existingTabs = rightSidebar.querySelector('.workspace-tabs');
        if (!existingTabs || !existingTabs.innerHTML.includes('Scene Breakdown')) {
            rightSidebar.innerHTML = `
                <div class="workspace-tabs">
                    <div class="workspace-tab active" onclick="switchTab('breakdown')">Scene Breakdown</div>
                </div>

                <div class="workspace-content">
                    <div class="tab-panel active" id="breakdownPanel">
                        <div class="empty-state">
                            <div class="empty-icon">📋</div>
                            <div class="empty-title">Select a Scene</div>
                            <div class="empty-desc">Choose a scene to view and edit its breakdown</div>
                        </div>
                    </div>
                </div>
            `;

            // Re-render breakdown panel if scene is selected
            if (state.currentScene !== null) {
                import('./breakdown-form.js').then(module => module.renderBreakdownPanel());
            }
        }
    } else if (state.activeCenterTab.startsWith('character-')) {
        // Character tab active - show character quick editor
        const characterName = state.activeCenterTab.replace('character-', '');
        renderCharacterQuickEditor(characterName);
    }
}

/**
 * Render character quick editor in right panel
 */
function renderCharacterQuickEditor(character) {
    const rightSidebar = document.querySelector('.right-sidebar');
    if (!rightSidebar) return;

    const profile = state.castProfiles[character] || { baseDescription: '' };

    // Get all scenes this character appears in
    const characterScenes = [];
    state.scenes.forEach((scene, index) => {
        const breakdown = state.sceneBreakdowns[index] || {};
        if (breakdown.cast && breakdown.cast.includes(character)) {
            characterScenes.push({ scene, index });
        }
    });

    rightSidebar.innerHTML = `
        <div class="workspace-tabs">
            <div class="workspace-tab active">
                👤 ${escapeHtml(character)}
            </div>
        </div>

        <div class="workspace-content">
            <div class="tab-panel active" style="padding: 20px; overflow-y: auto;">

                <!-- Base Description -->
                <div class="profile-section" style="margin-bottom: 24px;">
                    <label class="profile-label">Base Description</label>
                    <textarea class="modal-textarea"
                              id="quickEditBaseDesc"
                              rows="3"
                              placeholder="Age, physical appearance, general characteristics..."
                              onchange="updateQuickBaseDescription('${escapeHtml(character).replace(/'/g, "\\'")}', this.value)">${escapeHtml(profile.baseDescription || '')}</textarea>
                    <div style="font-size: 0.75em; color: var(--text-muted); margin-top: 6px;">
                        This applies to all ${characterScenes.length} scenes
                    </div>
                </div>

                <!-- Quick Stats -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px;">
                    <div style="padding: 12px; background: rgba(212, 175, 122, 0.08); border-radius: 8px; text-align: center;">
                        <div style="font-size: 1.5em; font-weight: 700; color: var(--accent-gold);">${characterScenes.length}</div>
                        <div style="font-size: 0.75em; color: var(--text-muted);">Scenes</div>
                    </div>
                    <div style="padding: 12px; background: rgba(212, 175, 122, 0.08); border-radius: 8px; text-align: center;">
                        <div style="font-size: 1.5em; font-weight: 700; color: var(--accent-gold);">${(state.continuityEvents[character] || []).length}</div>
                        <div style="font-size: 0.75em; color: var(--text-muted);">Events</div>
                    </div>
                </div>

                <!-- Actions -->
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <button class="modal-btn primary" onclick="alert('Character profile feature coming soon')">
                        Open Full Profile
                    </button>
                    <button class="modal-btn" onclick="alert('Continuity event feature coming soon')">
                        + Add Continuity Event
                    </button>
                </div>

                <!-- Recent Scenes Preview -->
                ${characterScenes.length > 0 ? `
                    <div style="margin-top: 24px;">
                        <div style="font-size: 0.875em; font-weight: 600; color: var(--text-light); margin-bottom: 12px;">
                            Recent Scenes
                        </div>
                        ${characterScenes.slice(0, 5).map(({ scene, index }) => `
                            <div style="padding: 10px 12px; background: rgba(28, 25, 22, 0.3); border: 1px solid var(--glass-border); border-radius: 6px; margin-bottom: 6px; cursor: pointer;"
                                 onclick="navigateToScene(${index})">
                                <div style="font-size: 0.8125em; font-weight: 600; color: var(--text-light);">
                                    Scene ${scene.number}
                                </div>
                                <div style="font-size: 0.75em; color: var(--text-muted);">
                                    ${escapeHtml(scene.heading.substring(0, 40))}...
                                </div>
                            </div>
                        `).join('')}
                        ${characterScenes.length > 5 ? `
                            <div style="text-align: center; margin-top: 8px;">
                                <button class="modal-btn" onclick="switchCenterTab('character-${escapeHtml(character)}')">
                                    View All ${characterScenes.length} Scenes
                                </button>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

            </div>
        </div>
    `;
}

/**
 * Render character timeline
 * Shows look states, transitions, and story day progression
 * @param {string} character - Character name
 * @returns {string} HTML for character timeline
 */
export function renderCharacterTimeline(character) {
    const profile = state.castProfiles[character] || {};
    const looks = state.characterLooks[character] || [];
    const events = state.continuityEvents[character] || [];

    // Check if character has look states defined
    const hasLooks = looks.length > 0;

    // Get transition count
    const transitionCount = state.lookTransitions.filter(t => t.character === character).length;

    // Build HTML - Look State Timeline
    let html = `
        <div class="character-timeline-view">
            <!-- Header -->
            <div class="timeline-header">
                <div class="character-info">
                    <div class="character-name-title">${escapeHtml(character)}</div>
                    <div class="character-base-info">${escapeHtml(profile.baseDescription) || '<em style="opacity: 0.6;">No description yet</em>'}</div>
                </div>
                <div class="timeline-stats">
                    ${hasLooks ? `
                        <div class="stat">
                            <span class="stat-value">${looks.length}</span>
                            <span class="stat-label">Look States</span>
                        </div>
                    ` : ''}
                    <div class="stat">
                        <span class="stat-value">${transitionCount}</span>
                        <span class="stat-label">Transitions</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${events.length}</span>
                        <span class="stat-label">Events</span>
                    </div>
                </div>
            </div>

            <!-- Manage Look States Button -->
            <div class="timeline-controls">
                <button class="manage-looks-btn" onclick="alert('Manage look states feature coming soon')">
                    📊 Manage Look States
                </button>
            </div>
    `;

    if (hasLooks) {
        // LOOK STATE TIMELINE
        html += `<div class="look-state-timeline">`;
        html += `<div class="timeline-title">CHARACTER JOURNEY</div>`;

        // Sort looks chronologically
        const sortedLooks = [...looks].sort((a, b) => {
            const firstSceneA = Math.min(...(a.scenes || [Infinity]));
            const firstSceneB = Math.min(...(b.scenes || [Infinity]));
            return firstSceneA - firstSceneB;
        });

        sortedLooks.forEach((look, index) => {
            const previousLook = index > 0 ? sortedLooks[index - 1] : null;

            // TRANSITION CARD (if not first look)
            if (previousLook) {
                const transition = findTransition(character, previousLook.id, look.id);
                if (transition) {
                    html += renderTransitionCard(transition, character);
                } else {
                    html += renderUndefinedTransitionCard(character, look.id);
                }
            }

            // LOOK STATE CARD
            html += renderLookStateCard(look);
        });

        html += `</div>`;

    } else {
        // FALLBACK: Show scene-by-scene if no looks defined
        html += renderSceneBySceneView(character);
    }

    html += `</div>`;

    return html;
}

/**
 * Render transition card
 */
function renderTransitionCard(transition, character) {
    return `
        <div class="transition-card">
            <div class="transition-card-header">
                <span class="transition-icon">⚡</span>
                <span class="transition-scene-label">TRANSITION in Scene ${transition.transitionScene}</span>
            </div>
            <div class="transition-event">${escapeHtml(transition.scriptEvent || 'Transition event not defined')}</div>
            ${transition.scriptQuote ? `
                <div class="transition-quote">
                    <span class="quote-icon">📝</span>
                    "${escapeHtml(transition.scriptQuote)}"
                </div>
            ` : ''}
            <button class="edit-transition-mini-btn" onclick="alert('Edit transition feature coming soon')">
                Edit Transition
            </button>
        </div>
    `;
}

/**
 * Render undefined transition placeholder
 */
function renderUndefinedTransitionCard(character, lookId) {
    return `
        <div class="transition-card undefined">
            <div class="transition-card-header">
                <span class="transition-icon">⚠️</span>
                <span class="transition-scene-label">TRANSITION NOT DEFINED</span>
            </div>
            <button class="edit-transition-mini-btn" onclick="alert('Define transition feature coming soon')">
                Define Transition
            </button>
        </div>
    `;
}

/**
 * Render look state card
 */
function renderLookStateCard(look) {
    const sceneRangeText = formatSceneRange(look.scenes || []);
    const complexityIcon = getComplexityIcon(look.complexity);

    // Build appearance preview
    const appearancePreviews = [];
    if (look.appearance?.hair) {
        const preview = look.appearance.hair.substring(0, 40);
        appearancePreviews.push(`💇 ${preview}${look.appearance.hair.length > 40 ? '...' : ''}`);
    }
    if (look.appearance?.makeup) {
        const preview = look.appearance.makeup.substring(0, 40);
        appearancePreviews.push(`💄 ${preview}${look.appearance.makeup.length > 40 ? '...' : ''}`);
    }
    if (look.appearance?.sfx) {
        const preview = look.appearance.sfx.substring(0, 40);
        appearancePreviews.push(`🩸 ${preview}${look.appearance.sfx.length > 40 ? '...' : ''}`);
    }
    if (look.appearance?.wardrobe) {
        const preview = look.appearance.wardrobe.substring(0, 40);
        appearancePreviews.push(`👔 ${preview}${look.appearance.wardrobe.length > 40 ? '...' : ''}`);
    }

    return `
        <div class="look-state-timeline-card">
            <div class="look-card-header">
                <div class="look-card-title">
                    <span class="look-name">${escapeHtml(look.lookName || 'Untitled Look')}</span>
                    <span class="complexity-badge">${complexityIcon} ${(look.complexity || 'low').toUpperCase()}</span>
                </div>
            </div>

            <div class="look-card-body">
                <div class="look-info-row">
                    <span class="info-label">Scenes:</span>
                    <span class="info-value">${sceneRangeText} (${(look.scenes || []).length} scenes)</span>
                </div>

                ${look.storyTime ? `
                    <div class="look-info-row">
                        <span class="info-label">Story Time:</span>
                        <span class="info-value">${escapeHtml(look.storyTime)}</span>
                    </div>
                ` : ''}

                ${appearancePreviews.length > 0 ? `
                    <div class="appearance-preview">
                        ${appearancePreviews.map(preview => `
                            <div class="preview-line">${escapeHtml(preview)}</div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>

            <div class="look-card-actions">
                <button class="look-card-btn primary" onclick="alert('Edit look feature coming soon')">
                    Edit Look
                </button>
            </div>
        </div>
    `;
}

/**
 * Render scene-by-scene view (fallback when no look states)
 */
function renderSceneBySceneView(character) {
    const characterScenes = [];
    state.scenes.forEach((scene, index) => {
        const breakdown = state.sceneBreakdowns[index] || {};
        if (breakdown.cast && breakdown.cast.includes(character)) {
            characterScenes.push({ scene, index });
        }
    });

    return `
        <div class="no-looks-message">
            <p>No look states defined. Showing all ${characterScenes.length} scenes:</p>
        </div>
        <div class="story-day-timeline">
            ${characterScenes.map(({ scene, index }) => `
                <div class="scene-item" onclick="navigateToScene(${index})" style="cursor: pointer;">
                    <div class="scene-number">Scene ${scene.number}</div>
                    <div class="scene-heading">${escapeHtml(scene.heading)}</div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Find transition between two looks
 */
function findTransition(character, fromLookId, toLookId) {
    return state.lookTransitions.find(t =>
        t.character === character &&
        t.fromLookId === fromLookId &&
        t.toLookId === toLookId
    );
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
 * Update quick base description (called from textarea onchange)
 */
window.updateQuickBaseDescription = function(character, value) {
    if (!state.castProfiles[character]) {
        state.castProfiles[character] = { name: character };
    }
    state.castProfiles[character].baseDescription = value;

    // Auto-save
    import('./export-handlers.js').then(module => module.saveProject());
};

/**
 * Remove character tab
 */
window.removeCharacterTab = function(character) {
    const index = state.characterTabs.indexOf(character);
    if (index > -1) {
        state.characterTabs.splice(index, 1);
        renderCharacterTabs();
        renderCharacterTabPanels();

        // Switch to script tab if current tab was removed
        if (state.activeCenterTab === `character-${character}`) {
            switchCenterTab('script');
        }
    }
};

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.switchCenterTab = switchCenterTab;
window.renderCharacterTabs = renderCharacterTabs;
window.renderCharacterTabPanels = renderCharacterTabPanels;
