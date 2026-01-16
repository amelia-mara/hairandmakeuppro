/**
 * breakdown-character-tabs.js
 * Character tab rendering and switching
 *
 * Responsibilities:
 * - Render character tabs in center panel
 * - Handle tab switching between script and characters
 * - Create character panel containers
 * - Manage right panel context updates
 */

import { getState, escapeHtml } from './breakdown-character-utils.js';
import { getCharacterSceneCount } from './breakdown-character-filtering.js';

/**
 * Render character tabs in center panel with file divider system
 * CRITICAL: Uses state.confirmedCharacters ONLY - tabs are only created after user confirmation
 * Shows script tab + confirmed character tabs
 */
export function renderCharacterTabs() {
    const state = getState();

    // Look for either .center-tabs (initial) or .file-dividers (after first render)
    const tabsContainer = document.querySelector('.center-tabs') || document.querySelector('.file-dividers');
    if (!tabsContainer) {
        console.error('Tabs container not found (.center-tabs or .file-dividers)!');
        return;
    }

    // Clear and replace with file divider structure
    tabsContainer.className = 'file-dividers';
    tabsContainer.innerHTML = '';

    // Add Script tab (always first)
    const scriptTab = document.createElement('div');
    scriptTab.className = 'file-tab active';
    scriptTab.setAttribute('data-tab', 'script');
    scriptTab.onclick = () => switchCenterTab('script');
    scriptTab.innerHTML = `
        <div class="file-tab-content">
            <div class="file-tab-label">Script</div>
        </div>
    `;
    tabsContainer.appendChild(scriptTab);

    // CRITICAL: Only generate tabs if characters have been confirmed
    if (!state?.confirmedCharacters || state.confirmedCharacters.size === 0) {
        return;
    }

    // Convert confirmed characters Set to Array
    const allConfirmedChars = Array.from(state.confirmedCharacters);

    // Filter to featured characters only (exclude extras, SAs, background)
    const featuredChars = allConfirmedChars.filter(charName => {
        const charData = window.masterContext?.characters?.[charName];
        const role = charData?.characterAnalysis?.role?.toLowerCase();

        // Include protagonist, main, supporting - exclude extras, background, SAs
        return role !== 'extra' && role !== 'background' && role !== 'sa';
    });

    // Sort by scene count (most appearances first), then alphabetically for ties
    featuredChars.sort((a, b) => {
        const countA = getCharacterSceneCount(a);
        const countB = getCharacterSceneCount(b);

        // If scene counts differ, sort by count (descending)
        if (countB !== countA) {
            return countB - countA;
        }

        // If scene counts are equal, sort alphabetically
        return a.localeCompare(b);
    });

    // Add tab for each featured character
    featuredChars.forEach(charName => {
        const charId = `character-${charName.toLowerCase().replace(/\s+/g, '-')}`;

        const tab = document.createElement('div');
        tab.className = 'file-tab';
        tab.setAttribute('data-tab', charId);
        tab.onclick = () => switchCenterTab(charId);

        tab.innerHTML = `
            <div class="file-tab-content">
                <div class="file-tab-label">${escapeHtml(charName)}</div>
            </div>
        `;

        tabsContainer.appendChild(tab);

        // Create corresponding panel (if it doesn't exist)
        createCharacterPanel(charId, charName);
    });

    // Update state.characterTabs to reflect featured characters
    state.characterTabs = featuredChars;
}

/**
 * Create character panel if it doesn't exist
 * @param {string} charId - Character tab ID (e.g., 'character-gwen-lawson')
 * @param {string} charName - Character display name
 */
function createCharacterPanel(charId, charName) {
    const contentContainer = document.querySelector('.center-tab-content');
    if (!contentContainer) return;

    // Check if panel already exists
    const existingPanel = document.getElementById(`${charId}-panel`);
    if (existingPanel) return;

    // Create new panel - content will be rendered when tab is switched to
    const panel = document.createElement('div');
    panel.className = 'center-tab-panel';
    panel.id = `${charId}-panel`;
    // Don't render content now - let switchCenterTab handle it
    panel.innerHTML = `<div class="loading-placeholder">Loading ${escapeHtml(charName)}...</div>`;

    contentContainer.appendChild(panel);
}

/**
 * Render character tab panels
 * Creates panels for each confirmed character with their timeline
 * CRITICAL: Only creates panels for confirmed characters
 */
export function renderCharacterTabPanels() {
    const state = getState();
    const contentContainer = document.querySelector('.center-tab-content');
    if (!contentContainer) return;

    // Remove old character panels (keep script panel)
    const panels = contentContainer.querySelectorAll('[id^="character-"]');
    panels.forEach(panel => {
        if (panel.id !== 'script-tab-panel') {
            panel.remove();
        }
    });

    // Also remove any profile panels
    const profilePanels = contentContainer.querySelectorAll('.character-profile-panel');
    profilePanels.forEach(panel => panel.remove());

    // Only create panels if characters have been confirmed
    if (!state?.confirmedCharacters || state.confirmedCharacters.size === 0) {
        return;
    }

    // Create new panels for each confirmed character
    const confirmedCharArray = Array.from(state.confirmedCharacters).sort();
    confirmedCharArray.forEach(character => {
        const charId = `character-${character.toLowerCase().replace(/\s+/g, '-')}`;
        const panel = document.createElement('div');
        panel.className = 'center-tab-panel';
        panel.id = `${charId}-panel`;

        // Import and use renderCharacterTimeline dynamically to avoid circular dependency
        import('./breakdown-character-timeline.js').then(module => {
            panel.innerHTML = module.renderCharacterTimeline(character);
        }).catch(() => {
            panel.innerHTML = `<div class="loading-placeholder">Loading ${escapeHtml(character)}...</div>`;
        });

        contentContainer.appendChild(panel);
    });
}

/**
 * Switch between center tabs (script or character)
 * @param {string} tabName - Tab identifier ('script' or 'character-{name}')
 */
export function switchCenterTab(tabName) {
    const state = getState();
    state.activeCenterTab = tabName;

    // Close supporting dropdown if open
    const dropdown = document.getElementById('supporting-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }

    // Update tab styling - use file-tab instead of center-tab
    document.querySelectorAll('.file-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

    // Update panel visibility
    document.querySelectorAll('.center-tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    if (tabName === 'script') {
        // IMPORTANT: The correct element ID is 'script-tab-panel' (with hyphens)
        document.getElementById('script-tab-panel')?.classList.add('active');
    } else if (tabName.startsWith('character-')) {
        // Show character profile
        const charName = tabName.replace('character-', '').replace(/-/g, ' ');
        // Convert back to proper case - find matching character in confirmed list
        const matchingChar = Array.from(state.confirmedCharacters || [])
            .find(c => c.toLowerCase().replace(/\s+/g, '-') === charName.toLowerCase().replace(/\s+/g, '-'));

        if (matchingChar) {
            showCharacterProfile(matchingChar);
        }
    } else {
        // Fallback for other panels
        document.getElementById(`${tabName}-panel`)?.classList.add('active');
    }

    // Update right panel context
    updateRightPanelContext();
}

/**
 * Show character profile panel
 * Creates the panel if it doesn't exist, otherwise shows it
 * @param {string} characterName - Character name
 */
async function showCharacterProfile(characterName) {
    const profileId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-profile-panel`;

    // First, hide all character profile panels explicitly
    document.querySelectorAll('.character-profile-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    let profilePanel = document.getElementById(profileId);

    if (!profilePanel) {
        profilePanel = await createCharacterProfilePanel(characterName);
        document.querySelector('.center-tab-content').appendChild(profilePanel);
    }

    // Show only the requested panel
    profilePanel.classList.add('active');
}

/**
 * Create character profile panel with header, stats, and view tabs
 * @param {string} characterName - Character name
 * @returns {HTMLElement} The created panel element
 */
async function createCharacterProfilePanel(characterName) {
    const { getCharacterRole } = await import('./breakdown-character-filtering.js');
    const { renderProfileView } = await import('./breakdown-character-profile.js');

    const panel = document.createElement('div');
    panel.className = 'center-tab-panel character-profile-panel';
    panel.id = `${characterName.toLowerCase().replace(/\s+/g, '-')}-profile-panel`;

    const sceneCount = getCharacterSceneCount(characterName);
    const role = getCharacterRole(characterName);

    panel.innerHTML = `
        <div class="character-profile-header">
            <h2>${escapeHtml(characterName)}</h2>
            <div class="character-stats">
                <span>Scenes: ${sceneCount}</span>
                <span>Role: ${escapeHtml(role)}</span>
            </div>
        </div>

        <div class="profile-view-tabs">
            <button class="view-tab active" onclick="showProfileView('${escapeHtml(characterName).replace(/'/g, "\\'")}', 'profile')">
                Profile
            </button>
            <button class="view-tab" onclick="showProfileView('${escapeHtml(characterName).replace(/'/g, "\\'")}', 'lookbook')">
                Lookbook
            </button>
            <button class="view-tab" onclick="showProfileView('${escapeHtml(characterName).replace(/'/g, "\\'")}', 'timeline')">
                Timeline
            </button>
            <button class="view-tab" onclick="showProfileView('${escapeHtml(characterName).replace(/'/g, "\\'")}', 'events')">
                Events
            </button>
        </div>

        <div class="character-profile-content" id="${escapeHtml(characterName).toLowerCase().replace(/\s+/g, '-')}-content">
            <!-- Content will be loaded here -->
            ${renderProfileView(characterName)}
        </div>
    `;

    return panel;
}

/**
 * Update right panel based on active center tab
 */
function updateRightPanelContext() {
    const state = getState();
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
                    <div class="tab-panel active" id="breakdown-panel">
                        <div class="empty-state">
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
        const characterName = state.activeCenterTab.replace('character-', '').replace(/-/g, ' ');
        // Find matching character in confirmed list
        const matchingChar = Array.from(state.confirmedCharacters || [])
            .find(c => c.toLowerCase().replace(/\s+/g, '-') === characterName.toLowerCase().replace(/\s+/g, '-'));
        if (matchingChar) {
            renderCharacterQuickEditor(matchingChar);
        }
    }
}

/**
 * Render character quick editor in right panel
 * @param {string} character - Character name
 */
function renderCharacterQuickEditor(character) {
    const state = getState();
    const rightSidebar = document.querySelector('.right-sidebar');
    if (!rightSidebar) return;

    const profile = state.castProfiles[character] || { baseDescription: '' };

    // Get all scenes this character appears in
    const characterScenes = [];
    (state?.scenes || []).forEach((scene, index) => {
        const breakdown = state.sceneBreakdowns[index] || {};
        if (breakdown.cast && breakdown.cast.includes(character)) {
            characterScenes.push({ scene, index });
        }
    });

    rightSidebar.innerHTML = `
        <div class="workspace-tabs">
            <div class="workspace-tab active">
                ${escapeHtml(character)}
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
                        <div style="font-size: 1.5em; font-weight: 700; color: var(--accent-gold);">${(state.continuityEvents?.[character] || []).length}</div>
                        <div style="font-size: 0.75em; color: var(--text-muted);">Events</div>
                    </div>
                </div>

                <!-- Actions -->
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <button class="modal-btn primary" onclick="alert('Character profile feature coming soon')">
                        Open Full Profile
                    </button>
                    <button class="modal-btn" onclick="addContinuityEvent('${escapeHtml(character).replace(/'/g, "\\'")}')">
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
                                <button class="modal-btn" onclick="switchCenterTab('character-${escapeHtml(character).toLowerCase().replace(/\s+/g, '-')}')">
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
 * Remove character tab
 * @param {string} character - Character name
 */
export function removeCharacterTab(character) {
    const state = getState();
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
}

/**
 * Regenerate character tabs with deduplicated names
 * CRITICAL: This function is DEPRECATED and should not be used
 * Character tabs should only be generated from state.confirmedCharacters after user confirmation
 */
export function regenerateCharacterTabs() {
    const state = getState();

    // Simply re-render tabs from confirmed characters
    if (state.confirmedCharacters && state.confirmedCharacters.size > 0) {
        renderCharacterTabs();
        renderCharacterTabPanels();
    }
}

// Expose global functions for HTML onclick handlers
window.switchCenterTab = switchCenterTab;
window.renderCharacterTabs = renderCharacterTabs;
window.renderCharacterTabPanels = renderCharacterTabPanels;
window.regenerateCharacterTabs = regenerateCharacterTabs;
window.removeCharacterTab = removeCharacterTab;

// Stub function for merge characters modal (not yet implemented)
window.openMergeCharactersModal = function() {
    alert('Character merge functionality coming soon!');
};

export default {
    renderCharacterTabs,
    renderCharacterTabPanels,
    switchCenterTab,
    removeCharacterTab,
    regenerateCharacterTabs
};
