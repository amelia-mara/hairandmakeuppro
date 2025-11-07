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
        // FALLBACK: Show story day continuity timeline if no looks defined
        html += renderStoryDayContinuityTimeline(character);
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
 * Render story day continuity timeline
 * Shows character's journey organized by story days with entering/exiting states
 */
function renderStoryDayContinuityTimeline(character) {
    // Get all scenes this character appears in
    const characterScenes = [];
    state.scenes.forEach((scene, index) => {
        const breakdown = state.sceneBreakdowns[index] || {};
        if (breakdown.cast && breakdown.cast.includes(character)) {
            characterScenes.push({ scene, index });
        }
    });

    if (characterScenes.length === 0) {
        return `
            <div class="empty-state" style="margin-top: 40px;">
                <div class="empty-icon">📋</div>
                <div class="empty-title">No Scenes Found</div>
                <div class="empty-desc">This character doesn't appear in any scenes yet.</div>
            </div>
        `;
    }

    // Group scenes by story day
    const scenesByDay = {};
    characterScenes.forEach(({ scene, index }) => {
        const storyDay = scene.storyDay || 'Unassigned';
        if (!scenesByDay[storyDay]) {
            scenesByDay[storyDay] = [];
        }
        scenesByDay[storyDay].push({ scene, index });
    });

    // Sort days (natural sort for "Day 1", "Day 2", etc.)
    const sortedDays = Object.keys(scenesByDay).sort((a, b) => {
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;

        const numA = parseInt(a.match(/\d+/)?.[0] || 0);
        const numB = parseInt(b.match(/\d+/)?.[0] || 0);
        return numA - numB;
    });

    // Check if any continuity data exists
    const hasAnyData = characterScenes.some(({ index }) => {
        const charState = state.characterStates[index]?.[character];
        return charState && (charState.hair || charState.makeup || charState.sfx || charState.wardrobe);
    });

    let html = `
        <div class="continuity-timeline-container">
            <div class="timeline-intro">
                <h3 class="timeline-title">STORY DAY CONTINUITY</h3>
                <p class="timeline-description">
                    Track ${escapeHtml(character)}'s appearance changes scene-by-scene.
                    Fill in scene breakdowns to auto-populate this timeline.
                </p>
            </div>
    `;

    if (!hasAnyData) {
        html += `
            <div class="empty-state-small" style="margin: 20px 0;">
                <div class="empty-icon-small">📝</div>
                <div class="empty-text-small">
                    No continuity data yet. Complete scene breakdowns (Hair, Makeup, SFX, Wardrobe fields) to populate this timeline.
                </div>
            </div>
        `;
    }

    // Render each story day
    sortedDays.forEach(day => {
        const dayScenes = scenesByDay[day];

        html += `
            <div class="story-day-group">
                <div class="story-day-header">
                    <span class="story-day-label">${escapeHtml(day)}</span>
                    <span class="story-day-count">${dayScenes.length} scene${dayScenes.length !== 1 ? 's' : ''}</span>
                </div>

                <div class="story-day-scenes">
                    ${dayScenes.map(({ scene, index }) => renderContinuitySceneCard(scene, index, character, characterScenes)).join('')}
                </div>
            </div>
        `;
    });

    html += `</div>`;
    return html;
}

/**
 * Render a single scene card with continuity states
 */
function renderContinuitySceneCard(scene, sceneIndex, character, allCharacterScenes) {
    // Get current scene's character state (DURING/EXITS)
    const currentState = state.characterStates[sceneIndex]?.[character] || {};

    // Get previous scene's state (ENTERS - what they looked like at end of previous scene)
    const previousSceneIndex = findPreviousSceneIndex(sceneIndex, allCharacterScenes);
    const enteringState = previousSceneIndex !== null
        ? state.characterStates[previousSceneIndex]?.[character] || {}
        : null;

    // Extract location from heading (e.g., "INT. FERRY - DAY" -> "FERRY")
    const locationMatch = scene.heading.match(/(?:INT\.|EXT\.|INT\/EXT\.?)\s+(.+?)(?:\s+-\s+|\s*$)/i);
    const location = locationMatch ? locationMatch[1].trim() : scene.heading;

    // Build entering notes (from previous scene)
    const enteringNotes = [];
    if (enteringState) {
        if (enteringState.hair) enteringNotes.push({ category: 'hair', text: enteringState.hair });
        if (enteringState.makeup) enteringNotes.push({ category: 'makeup', text: enteringState.makeup });
        if (enteringState.sfx) enteringNotes.push({ category: 'sfx', text: enteringState.sfx });
        if (enteringState.wardrobe) enteringNotes.push({ category: 'wardrobe', text: enteringState.wardrobe });
    }

    // Build during/exits notes (from current scene)
    const duringNotes = [];
    if (currentState.hair) duringNotes.push({ category: 'hair', text: currentState.hair });
    if (currentState.makeup) duringNotes.push({ category: 'makeup', text: currentState.makeup });
    if (currentState.sfx) duringNotes.push({ category: 'sfx', text: currentState.sfx });
    if (currentState.wardrobe) duringNotes.push({ category: 'wardrobe', text: currentState.wardrobe });

    return `
        <div class="continuity-scene-card">
            <div class="continuity-scene-header" onclick="navigateToScene(${sceneIndex})">
                <span class="scene-number-badge">Scene ${scene.number}</span>
                <span class="scene-location">${escapeHtml(location)}</span>
            </div>

            <div class="continuity-states">
                <!-- ENTERING STATE -->
                <div class="continuity-state entering">
                    <div class="state-label">ENTERS:</div>
                    <div class="state-notes">
                        ${enteringNotes.length > 0
                            ? enteringNotes.map(note => renderContinuityNote(note, sceneIndex, character, 'entering')).join('')
                            : '<div class="no-notes">—</div>'
                        }
                    </div>
                </div>

                <!-- DURING/EXITING STATE -->
                <div class="continuity-state during">
                    <div class="state-label">DURING/EXITS:</div>
                    <div class="state-notes">
                        ${duringNotes.length > 0
                            ? duringNotes.map(note => renderContinuityNote(note, sceneIndex, character, 'during')).join('')
                            : '<div class="no-notes">No changes noted</div>'
                        }
                        <button class="add-continuity-note-btn"
                                onclick="openContinuityEditModal(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}')">
                            + Add Note
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render a single continuity note with category color coding
 */
function renderContinuityNote(note, sceneIndex, character, phase) {
    const colors = {
        hair: '#a855f7',
        makeup: '#ec4899',
        sfx: '#ef4444',
        wardrobe: '#34d399',
        health: '#f59e0b',
        injuries: '#dc2626',
        stunts: '#f97316'
    };

    const categoryLabels = {
        hair: 'Hair',
        makeup: 'Makeup',
        sfx: 'SFX',
        wardrobe: 'Wardrobe',
        health: 'Health',
        injuries: 'Injuries',
        stunts: 'Stunts'
    };

    const color = colors[note.category] || '#9ca3af';
    const label = categoryLabels[note.category] || note.category;

    return `
        <div class="continuity-note"
             style="border-left: 3px solid ${color}; background: linear-gradient(90deg, ${color}15, transparent);"
             onclick="openContinuityEditModal(${sceneIndex}, '${escapeHtml(character).replace(/'/g, "\\'")}', '${note.category}')">
            <span class="note-category" style="color: ${color};">${label}:</span>
            <span class="note-text">${escapeHtml(note.text)}</span>
        </div>
    `;
}

/**
 * Find the previous scene index where this character appears
 */
function findPreviousSceneIndex(currentIndex, allCharacterScenes) {
    const currentSceneInList = allCharacterScenes.findIndex(s => s.index === currentIndex);
    if (currentSceneInList > 0) {
        return allCharacterScenes[currentSceneInList - 1].index;
    }
    return null;
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

/**
 * Open continuity edit modal
 */
window.openContinuityEditModal = function(sceneIndex, character, category = '') {
    const modal = document.getElementById('continuity-edit-modal');
    if (!modal) return;

    const scene = state.scenes[sceneIndex];
    const currentState = state.characterStates[sceneIndex]?.[character] || {};

    // Set modal data
    modal.dataset.sceneIndex = sceneIndex;
    modal.dataset.character = character;

    // Update modal title
    document.getElementById('continuity-modal-title').textContent = `Edit Continuity - Scene ${scene.number}`;
    document.getElementById('continuity-modal-character').textContent = character;

    // Set category selector
    const categorySelect = document.getElementById('continuity-category');
    categorySelect.value = category || 'hair';

    // Set note text
    const noteTextarea = document.getElementById('continuity-note-text');
    if (category) {
        noteTextarea.value = currentState[category] || '';
    } else {
        noteTextarea.value = '';
    }

    // Show modal
    modal.style.display = 'flex';
    noteTextarea.focus();
};

/**
 * Close continuity edit modal
 */
window.closeContinuityEditModal = function() {
    const modal = document.getElementById('continuity-edit-modal');
    if (modal) modal.style.display = 'none';
};

/**
 * Save continuity note
 */
window.saveContinuityNote = async function() {
    const modal = document.getElementById('continuity-edit-modal');
    const sceneIndex = parseInt(modal.dataset.sceneIndex);
    const character = modal.dataset.character;

    const category = document.getElementById('continuity-category').value;
    const noteText = document.getElementById('continuity-note-text').value.trim();

    // Initialize structures if needed
    if (!state.characterStates[sceneIndex]) {
        state.characterStates[sceneIndex] = {};
    }
    if (!state.characterStates[sceneIndex][character]) {
        state.characterStates[sceneIndex][character] = {};
    }

    // Save or delete note
    if (noteText) {
        state.characterStates[sceneIndex][character][category] = noteText;
    } else {
        delete state.characterStates[sceneIndex][character][category];
    }

    // Save project
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Refresh character timeline
    renderCharacterTabPanels();

    // Close modal
    closeContinuityEditModal();
};

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.switchCenterTab = switchCenterTab;
window.renderCharacterTabs = renderCharacterTabs;
window.renderCharacterTabPanels = renderCharacterTabPanels;
