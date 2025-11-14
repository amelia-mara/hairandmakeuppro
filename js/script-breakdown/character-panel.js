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
 * - Character name normalization and deduplication
 */

// ============================================================================
// CHARACTER MANAGER - Normalization and Deduplication
// ============================================================================

/**
 * CharacterManager class
 * Handles character name normalization and deduplication
 *
 * Resolves:
 * - Case variations: "GWEN LAWSON" vs "Gwen Lawson" vs "gwen lawson"
 * - Full name vs first name: "Gwen Lawson" vs "Gwen"
 * - Different extraction methods creating separate entries
 */
class CharacterManager {
    constructor() {
        this.characters = new Map(); // Canonical name -> character data
        this.aliases = new Map();     // All variations -> canonical name
    }

    /**
     * Add a character name, handling all variations and deduplication
     * @param {string} rawName - The character name to add
     * @returns {string|null} - The canonical name, or null if invalid
     */
    addCharacter(rawName) {
        if (!rawName || typeof rawName !== 'string') return null;

        const cleaned = rawName.trim();
        if (!cleaned) return null;

        // Check if we already know this name (any variation)
        const canonical = this.aliases.get(cleaned.toLowerCase());
        if (canonical) {
            // Already exists, return canonical name
            this.characters.get(canonical).count++;
            return canonical;
        }

        // Check if this matches an existing character's first name
        const firstName = cleaned.split(' ')[0];
        const matchingFull = this.findFullNameMatch(firstName);

        if (matchingFull) {
            // This is a short version of an existing full name
            this.addAlias(cleaned, matchingFull);
            this.characters.get(matchingFull).count++;
            return matchingFull;
        }

        // Check if any existing character is the short version of this name
        if (cleaned.split(' ').length > 1) {
            const existingShort = this.findByFirstName(firstName);
            if (existingShort) {
                // Upgrade the short name to the full name
                this.upgradeToFullName(existingShort, cleaned);
                return cleaned;
            }
        }

        // New character - normalize to title case
        const normalized = this.normalizeCase(cleaned);

        // Add to registry
        this.characters.set(normalized, {
            name: normalized,
            count: 1,
            appearances: []
        });

        // Add all case variations as aliases
        this.addAlias(cleaned, normalized);
        this.addAlias(cleaned.toUpperCase(), normalized);
        this.addAlias(cleaned.toLowerCase(), normalized);
        this.addAlias(normalized, normalized);

        return normalized;
    }

    /**
     * Convert to title case: "GWEN LAWSON" → "Gwen Lawson"
     * @param {string} name - The name to normalize
     * @returns {string} - The normalized name
     */
    normalizeCase(name) {
        return name.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    /**
     * Add an alias mapping
     * @param {string} variation - The variation to map
     * @param {string} canonicalName - The canonical name to map to
     */
    addAlias(variation, canonicalName) {
        this.aliases.set(variation.toLowerCase(), canonicalName);
    }

    /**
     * Find if a first name matches any existing full name
     * @param {string} firstName - The first name to check
     * @returns {string|null} - The matching full name, or null
     */
    findFullNameMatch(firstName) {
        const lowerFirst = firstName.toLowerCase();

        for (const [canonical, data] of this.characters.entries()) {
            const parts = canonical.split(' ');
            if (parts.length > 1 && parts[0].toLowerCase() === lowerFirst) {
                return canonical;
            }
        }
        return null;
    }

    /**
     * Find character by first name only
     * @param {string} firstName - The first name to find
     * @returns {string|null} - The character name, or null
     */
    findByFirstName(firstName) {
        const lowerFirst = firstName.toLowerCase();

        for (const [canonical, data] of this.characters.entries()) {
            const parts = canonical.split(' ');
            if (parts[0].toLowerCase() === lowerFirst) {
                return canonical;
            }
        }
        return null;
    }

    /**
     * Upgrade a short name to full name
     * @param {string} oldName - The short name
     * @param {string} newName - The full name
     */
    upgradeToFullName(oldName, newName) {
        const data = this.characters.get(oldName);
        this.characters.delete(oldName);

        const normalized = this.normalizeCase(newName);
        this.characters.set(normalized, data);
        data.name = normalized;

        // Update all aliases pointing to old name
        for (const [alias, canonical] of this.aliases.entries()) {
            if (canonical === oldName) {
                this.aliases.set(alias, normalized);
            }
        }

        // Add new aliases for full name
        this.addAlias(newName, normalized);
        this.addAlias(newName.toUpperCase(), normalized);
        this.addAlias(newName.toLowerCase(), normalized);
    }

    /**
     * Get canonical name for any variation
     * @param {string} rawName - The name to look up
     * @returns {string|null} - The canonical name, or null
     */
    getCanonicalName(rawName) {
        if (!rawName) return null;

        const lower = rawName.trim().toLowerCase();
        return this.aliases.get(lower) || null;
    }

    /**
     * Get all characters as sorted array
     * @returns {string[]} - Array of canonical character names
     */
    getAllCharacters() {
        return Array.from(this.characters.values())
            .sort((a, b) => b.count - a.count)
            .map(data => data.name);
    }

    /**
     * Clear all data
     */
    clear() {
        this.characters.clear();
        this.aliases.clear();
    }
}

// Create global instance
window.characterManager = new CharacterManager();

// ============================================================================
// CHARACTER FILTERING AND CATEGORIZATION
// ============================================================================

/**
 * Get character scene counts
 * @returns {Map} - Map of character name -> scene count
 */
function getCharacterSceneCounts() {
    const characterSceneCounts = new Map();

    state.scenes.forEach((scene, index) => {
        const breakdown = state.sceneBreakdowns[index];
        if (breakdown && breakdown.cast) {
            breakdown.cast.forEach(char => {
                characterSceneCounts.set(char, (characterSceneCounts.get(char) || 0) + 1);
            });
        }
    });

    return characterSceneCounts;
}

/**
 * Get main characters (appear in 5+ scenes)
 * @param {number} maxCount - Maximum number of main characters to return (default 8)
 * @returns {string[]} - Array of main character names
 */
function getMainCharacters(maxCount = 8) {
    const characterSceneCounts = getCharacterSceneCounts();

    // Filter characters appearing in 5+ scenes
    const mainCharacters = Array.from(characterSceneCounts.entries())
        .filter(([name, count]) => count >= 5)
        .sort((a, b) => b[1] - a[1]) // Sort by scene count (descending)
        .slice(0, maxCount) // Limit to maxCount
        .map(([name, count]) => name);

    console.log(`Main characters (5+ scenes, max ${maxCount}):`, mainCharacters);

    return mainCharacters;
}

/**
 * Get supporting characters (appear in 2-4 scenes)
 * @returns {string[]} - Array of supporting character names
 */
function getSupportingCharacters() {
    const characterSceneCounts = getCharacterSceneCounts();

    // Filter characters appearing in 2-4 scenes
    const supportingCharacters = Array.from(characterSceneCounts.entries())
        .filter(([name, count]) => count >= 2 && count < 5)
        .sort((a, b) => b[1] - a[1]) // Sort by scene count (descending)
        .map(([name, count]) => name);

    console.log(`Supporting characters (2-4 scenes):`, supportingCharacters);

    return supportingCharacters;
}

/**
 * Aggressive deduplication - merge all duplicate character names
 * This runs before generating tabs to ensure no duplicates
 */
function aggressiveDeduplicate() {
    console.log('🔄 Running aggressive deduplication...');

    // Manual duplicate mappings for common issues
    const duplicateMap = {
        'gwen': 'Gwen Lawson',
        'GWEN': 'Gwen Lawson',
        'peter': 'Peter Lawson',
        'PETER': 'Peter Lawson',
        'Peter': 'Peter Lawson',
        'inga': 'Inga Olafsson',
        'Inga': 'Inga Olafsson',
        'jon': 'Jon Olafsson',
        'Jon': 'Jon Olafsson',
    };

    state.scenes.forEach((scene, index) => {
        const breakdown = state.sceneBreakdowns[index];
        if (breakdown && breakdown.cast) {
            breakdown.cast = breakdown.cast.map(char =>
                duplicateMap[char] || window.characterManager.getCanonicalName(char) || char
            );

            // Remove exact duplicates
            breakdown.cast = [...new Set(breakdown.cast)];
        }

        // Also normalize tags
        if (state.scriptTags[index]) {
            state.scriptTags[index].forEach(tag => {
                if (tag.character) {
                    tag.character = duplicateMap[tag.character] ||
                                   window.characterManager.getCanonicalName(tag.character) ||
                                   tag.character;
                }
            });
        }
    });

    console.log('✓ Aggressive deduplication complete');
}

// ============================================================================
// CHARACTER TAB RENDERING
// ============================================================================

import { state } from './main.js';
import { formatSceneRange, getComplexityIcon } from './utils.js';
import { buildCharacterProfile } from './character-profiles.js';

/**
 * Render character tabs in center panel with file divider system
 * CRITICAL: Uses state.confirmedCharacters ONLY - tabs are only created after user confirmation
 * Shows script tab + confirmed character tabs
 */
export function renderCharacterTabs() {
    console.log('🔄 Rendering character tabs from confirmed characters...');

    const tabsContainer = document.querySelector('.center-tabs');
    if (!tabsContainer) {
        console.error('❌ .center-tabs container not found!');
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
    if (!state.confirmedCharacters || state.confirmedCharacters.size === 0) {
        console.log('⚠️ No confirmed characters - only showing Script tab');
        console.log('   User must run "Detect & Review Characters" and confirm selection first');
        return;
    }

    // Convert confirmed characters Set to Array and sort alphabetically
    const confirmedCharArray = Array.from(state.confirmedCharacters).sort();
    console.log(`✓ Generating tabs for ${confirmedCharArray.length} confirmed characters:`, confirmedCharArray);

    // Add tab for each confirmed character
    confirmedCharArray.forEach(charName => {
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

    // Update state.characterTabs to reflect confirmed characters
    state.characterTabs = confirmedCharArray;

    console.log(`✓ Rendered ${confirmedCharArray.length} character tabs from confirmed characters`);
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

    // Create new panel
    const panel = document.createElement('div');
    panel.className = 'center-tab-panel';
    panel.id = `${charId}-panel`;
    panel.innerHTML = renderCharacterTimeline(charName);

    contentContainer.appendChild(panel);
}

/**
 * Render character tab panels
 * Creates panels for each confirmed character with their timeline
 * CRITICAL: Only creates panels for confirmed characters
 */
export function renderCharacterTabPanels() {
    const contentContainer = document.querySelector('.center-tab-content');
    if (!contentContainer) return;

    // Remove old character panels (keep script panel)
    const panels = contentContainer.querySelectorAll('[id^="character-"]');
    panels.forEach(panel => {
        if (panel.id !== 'script-tab-panel') {
            panel.remove();
        }
    });

    // Only create panels if characters have been confirmed
    if (!state.confirmedCharacters || state.confirmedCharacters.size === 0) {
        console.log('⚠️ No confirmed characters - no character panels created');
        return;
    }

    // Create new panels for each confirmed character
    const confirmedCharArray = Array.from(state.confirmedCharacters).sort();
    confirmedCharArray.forEach(character => {
        const charId = `character-${character.toLowerCase().replace(/\s+/g, '-')}`;
        const panel = document.createElement('div');
        panel.className = 'center-tab-panel';
        panel.id = `${charId}-panel`;

        panel.innerHTML = renderCharacterTimeline(character);

        contentContainer.appendChild(panel);
    });

    console.log(`✓ Created ${confirmedCharArray.length} character panels`);
}

/**
 * Switch between center tabs (script or character)
 * @param {string} tabName - Tab identifier ('script' or 'character-{name}')
 */
export function switchCenterTab(tabName) {
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
function showCharacterProfile(characterName) {
    const profileId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-profile-panel`;
    let profilePanel = document.getElementById(profileId);

    if (!profilePanel) {
        profilePanel = createCharacterProfilePanel(characterName);
        document.querySelector('.center-tab-content').appendChild(profilePanel);
    }

    profilePanel.classList.add('active');
}

/**
 * Create character profile panel with header, stats, and view tabs
 * @param {string} characterName - Character name
 * @returns {HTMLElement} The created panel element
 */
function createCharacterProfilePanel(characterName) {
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
            <button class="view-tab active" onclick="showProfileView('${escapeHtml(characterName).replace(/'/g, "\\'")}', 'lookbook')">
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
            ${renderLookbookView(characterName)}
        </div>
    `;

    return panel;
}

/**
 * Get character scene count
 * @param {string} characterName - Character name
 * @returns {number} Number of scenes the character appears in
 */
function getCharacterSceneCount(characterName) {
    let count = 0;
    state.scenes.forEach((scene, index) => {
        const breakdown = state.sceneBreakdowns[index];
        if (breakdown && breakdown.cast && breakdown.cast.includes(characterName)) {
            count++;
        }
    });
    return count;
}

/**
 * Get character role based on scene count
 * @param {string} characterName - Character name
 * @returns {string} Character role (Lead, Supporting, Minor)
 */
function getCharacterRole(characterName) {
    const sceneCount = getCharacterSceneCount(characterName);

    if (sceneCount >= 10) {
        return 'Lead';
    } else if (sceneCount >= 5) {
        return 'Supporting';
    } else if (sceneCount >= 2) {
        return 'Minor';
    } else {
        return 'Extra';
    }
}

/**
 * Switch between profile views (Lookbook, Timeline, Events)
 * @param {string} characterName - Character name
 * @param {string} viewType - View type ('lookbook', 'timeline', 'events')
 */
window.showProfileView = function(characterName, viewType) {
    const contentId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-content`;
    const contentDiv = document.getElementById(contentId);

    if (!contentDiv) return;

    // Update active tab
    const profilePanel = contentDiv.closest('.character-profile-panel');
    if (profilePanel) {
        profilePanel.querySelectorAll('.view-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        profilePanel.querySelector(`.view-tab:nth-child(${viewType === 'lookbook' ? 1 : viewType === 'timeline' ? 2 : 3})`).classList.add('active');
    }

    // Render the appropriate view
    switch (viewType) {
        case 'lookbook':
            contentDiv.innerHTML = renderLookbookView(characterName);
            break;
        case 'timeline':
            contentDiv.innerHTML = renderTimelineView(characterName);
            break;
        case 'events':
            contentDiv.innerHTML = renderEventsView(characterName);
            break;
    }
};

/**
 * Render lookbook view
 * @param {string} characterName - Character name
 * @returns {string} HTML for lookbook view
 */
function renderLookbookView(characterName) {
    const profile = state.castProfiles[characterName] || {};
    const looks = state.characterLooks[characterName] || [];

    return `
        <div class="lookbook-view">
            <div class="view-section">
                <h3>Base Description</h3>
                <p>${escapeHtml(profile.baseDescription || 'No base description yet')}</p>
            </div>

            <div class="view-section">
                <h3>Look States (${looks.length})</h3>
                ${looks.length > 0 ? `
                    <div class="look-states-grid">
                        ${looks.map(look => `
                            <div class="look-state-card">
                                <div class="look-state-name">${escapeHtml(look.lookName || 'Untitled Look')}</div>
                                <div class="look-state-scenes">Scenes: ${formatSceneRange(look.scenes || [])}</div>
                                ${look.appearance ? `
                                    <div class="look-state-details">
                                        ${look.appearance.hair ? `<div><strong>Hair:</strong> ${escapeHtml(look.appearance.hair)}</div>` : ''}
                                        ${look.appearance.makeup ? `<div><strong>Makeup:</strong> ${escapeHtml(look.appearance.makeup)}</div>` : ''}
                                        ${look.appearance.sfx ? `<div><strong>SFX:</strong> ${escapeHtml(look.appearance.sfx)}</div>` : ''}
                                        ${look.appearance.wardrobe ? `<div><strong>Wardrobe:</strong> ${escapeHtml(look.appearance.wardrobe)}</div>` : ''}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : '<p class="empty-message">No look states defined yet</p>'}
            </div>
        </div>
    `;
}

/**
 * Render timeline view
 * @param {string} characterName - Character name
 * @returns {string} HTML for timeline view
 */
function renderTimelineView(characterName) {
    // Reuse the existing renderCharacterTimeline function
    return renderCharacterTimeline(characterName);
}

/**
 * Render events view
 * @param {string} characterName - Character name
 * @returns {string} HTML for events view
 */
function renderEventsView(characterName) {
    const events = state.continuityEvents[characterName] || [];

    return `
        <div class="events-view">
            <div class="view-section">
                <h3>Continuity Events (${events.length})</h3>
                ${events.length > 0 ? `
                    <div class="events-list">
                        ${events.map(event => `
                            <div class="event-card">
                                <div class="event-scene">Scene ${event.sceneNumber || 'Unknown'}</div>
                                <div class="event-category">${escapeHtml(event.category || '')}</div>
                                <div class="event-description">${escapeHtml(event.description || '')}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p class="empty-message">No continuity events recorded yet</p>'}
            </div>
        </div>
    `;
}

/**
 * Get all scenes where a character appears
 * @param {string} characterName - Character name
 * @returns {Array} Array of scene indices
 */
function getCharacterScenes(characterName) {
    const sceneIndices = [];
    state.scenes.forEach((scene, index) => {
        const breakdown = state.sceneBreakdowns[index];
        if (breakdown && breakdown.cast && breakdown.cast.includes(characterName)) {
            sceneIndices.push(index);
        }
    });
    return sceneIndices;
}

/**
 * Group scenes by story day
 * @param {Array} sceneIndices - Array of scene indices
 * @returns {Object} Object mapping story days to arrays of scene indices
 */
function groupScenesByStoryDay(sceneIndices) {
    const groups = {};
    sceneIndices.forEach(sceneIndex => {
        const scene = state.scenes[sceneIndex];
        const day = scene.storyDay || 'Unassigned';
        if (!groups[day]) {
            groups[day] = [];
        }
        groups[day].push(sceneIndex);
    });
    return groups;
}

/**
 * Render story day timeline visualization
 * Shows a horizontal timeline with clickable day segments
 * @param {string} characterName - Character name
 * @returns {string} HTML for story day timeline
 */
function renderStoryDayTimeline(characterName) {
    const characterScenes = getCharacterScenes(characterName);

    if (characterScenes.length === 0) {
        return '';
    }

    const dayGroups = groupScenesByStoryDay(characterScenes);

    // Sort days (natural sort for "Day 1", "Day 2", etc.)
    const sortedDays = Object.keys(dayGroups).sort((a, b) => {
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;

        const numA = parseInt(a.match(/\d+/)?.[0] || 0);
        const numB = parseInt(b.match(/\d+/)?.[0] || 0);
        return numA - numB;
    });

    if (sortedDays.length === 0) {
        return '';
    }

    return `
        <div class="story-day-timeline">
            ${sortedDays.map(day => {
                const scenes = dayGroups[day];
                const sceneNumbers = scenes.map(idx => state.scenes[idx].number);
                const firstScene = Math.min(...sceneNumbers);
                const lastScene = Math.max(...sceneNumbers);
                const sceneRange = firstScene === lastScene ? `Sc ${firstScene}` : `Sc ${firstScene}-${lastScene}`;

                return `
                    <div class="timeline-day" onclick="scrollToStoryDay('${escapeHtml(day).replace(/'/g, "\\'")}', '${escapeHtml(characterName).replace(/'/g, "\\'")}')">
                        <div class="day-label">${escapeHtml(day)}</div>
                        <div class="day-bar" data-scenes="${scenes.length}">
                            <div class="scene-range">${sceneRange}</div>
                            <div class="scene-count">${scenes.length} scene${scenes.length !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Scroll to a specific story day section in the character timeline
 * @param {string} storyDay - Story day label
 * @param {string} characterName - Character name
 */
window.scrollToStoryDay = function(storyDay, characterName) {
    // Find the story day section in the current view
    const storyDayGroups = document.querySelectorAll('.story-day-group');

    for (const group of storyDayGroups) {
        const dayLabel = group.querySelector('.story-day-label');
        if (dayLabel && dayLabel.textContent.trim() === storyDay) {
            group.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Add highlight effect
            group.style.transition = 'background 0.5s ease';
            group.style.background = 'rgba(212, 175, 122, 0.15)';
            setTimeout(() => {
                group.style.background = '';
            }, 1500);

            break;
        }
    }
};

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
 * Render enhanced character profile with narrative context
 * @param {string} character - Character name
 * @returns {string} HTML for enhanced character profile
 */
function renderEnhancedCharacterProfile(character) {
    try {
        return buildCharacterProfile(character);
    } catch (error) {
        console.error('Error building character profile:', error);
        return `
            <div class="empty-state" style="margin-top: 40px;">
                <div class="empty-title">Error Loading Profile</div>
                <div class="empty-desc">${escapeHtml(error.message)}</div>
            </div>
        `;
    }
}

/**
 * Render character timeline
 * Shows look states, transitions, and story day progression
 * If narrative context is available, uses enhanced profile system
 * @param {string} character - Character name
 * @returns {string} HTML for character timeline
 */
export function renderCharacterTimeline(character) {
    // Check if narrative context is available and use enhanced profile
    if (window.scriptNarrativeContext && window.scriptNarrativeContext.characters) {
        try {
            // Use enhanced profile system
            return renderEnhancedCharacterProfile(character);
        } catch (error) {
            console.error('Error rendering enhanced profile, falling back to classic view:', error);
        }
    }

    // Fallback to classic timeline view
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

            <!-- Story Day Timeline Visualization -->
            ${renderStoryDayTimeline(character)}
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
        appearancePreviews.push(`Hair: ${preview}${look.appearance.hair.length > 40 ? '...' : ''}`);
    }
    if (look.appearance?.makeup) {
        const preview = look.appearance.makeup.substring(0, 40);
        appearancePreviews.push(`Makeup: ${preview}${look.appearance.makeup.length > 40 ? '...' : ''}`);
    }
    if (look.appearance?.sfx) {
        const preview = look.appearance.sfx.substring(0, 40);
        appearancePreviews.push(`SFX: ${preview}${look.appearance.sfx.length > 40 ? '...' : ''}`);
    }
    if (look.appearance?.wardrobe) {
        const preview = look.appearance.wardrobe.substring(0, 40);
        appearancePreviews.push(`Wardrobe: ${preview}${look.appearance.wardrobe.length > 40 ? '...' : ''}`);
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
// CHARACTER DEDUPLICATION AND REGENERATION
// ============================================================================

/**
 * Deduplicate all character names across all scenes
 * Rebuilds character manager from scratch and normalizes all references
 */
export function deduplicateAllCharacters() {
    console.log('🔄 Deduplicating character names across all scenes...');

    // Rebuild character manager from scratch
    window.characterManager.clear();

    // First pass: collect all unique names from scenes
    state.scenes.forEach((scene, index) => {
        // Process cast in scene breakdowns
        const breakdown = state.sceneBreakdowns[index];
        if (breakdown && breakdown.cast) {
            breakdown.cast = breakdown.cast.map(char =>
                window.characterManager.addCharacter(char)
            ).filter(Boolean);

            // Remove duplicates within scene
            breakdown.cast = [...new Set(breakdown.cast)];
        }

        // Process character names in script tags
        if (state.scriptTags[index]) {
            state.scriptTags[index] = state.scriptTags[index].map(tag => {
                if (tag.character) {
                    tag.character = window.characterManager.getCanonicalName(tag.character) ||
                                   window.characterManager.addCharacter(tag.character);
                }
                // Also normalize cast category tags
                if (tag.category === 'cast' && tag.selectedText) {
                    const canonical = window.characterManager.getCanonicalName(tag.selectedText) ||
                                     window.characterManager.addCharacter(tag.selectedText);
                    tag.selectedText = canonical;
                    tag.character = canonical;
                }
                return tag;
            });
        }

        // Process character states
        if (state.characterStates[index]) {
            const newStates = {};
            Object.keys(state.characterStates[index]).forEach(char => {
                const canonical = window.characterManager.getCanonicalName(char) ||
                                 window.characterManager.addCharacter(char);
                newStates[canonical] = state.characterStates[index][char];
            });
            state.characterStates[index] = newStates;
        }
    });

    // Update global characters set
    state.characters.clear();
    window.characterManager.getAllCharacters().forEach(char => {
        state.characters.add(char);
    });

    // Update cast profiles with canonical names
    const newProfiles = {};
    Object.keys(state.castProfiles).forEach(char => {
        const canonical = window.characterManager.getCanonicalName(char) ||
                         window.characterManager.addCharacter(char);
        newProfiles[canonical] = state.castProfiles[char];
        if (newProfiles[canonical].name) {
            newProfiles[canonical].name = canonical;
        }
    });
    state.castProfiles = newProfiles;

    // Update character looks with canonical names
    const newLooks = {};
    Object.keys(state.characterLooks).forEach(char => {
        const canonical = window.characterManager.getCanonicalName(char) ||
                         window.characterManager.addCharacter(char);
        newLooks[canonical] = state.characterLooks[char];
    });
    state.characterLooks = newLooks;

    // Update continuity events with canonical names
    const newEvents = {};
    Object.keys(state.continuityEvents).forEach(char => {
        const canonical = window.characterManager.getCanonicalName(char) ||
                         window.characterManager.addCharacter(char);
        newEvents[canonical] = state.continuityEvents[char];
    });
    state.continuityEvents = newEvents;

    // Update look transitions
    state.lookTransitions = state.lookTransitions.map(transition => {
        if (transition.character) {
            transition.character = window.characterManager.getCanonicalName(transition.character) ||
                                  window.characterManager.addCharacter(transition.character);
        }
        return transition;
    });

    console.log('✓ Deduplication complete');
    console.log('✓ Unique characters:', window.characterManager.getAllCharacters());

    // Regenerate character tabs
    regenerateCharacterTabs();
}

/**
 * Regenerate character tabs with deduplicated names
 * CRITICAL: This function is DEPRECATED and should not be used
 * Character tabs should only be generated from state.confirmedCharacters after user confirmation
 */
export function regenerateCharacterTabs() {
    console.log('⚠️ regenerateCharacterTabs() called - this function is deprecated');
    console.log('   Character tabs should only be generated from confirmed characters');

    // Simply re-render tabs from confirmed characters
    if (state.confirmedCharacters && state.confirmedCharacters.size > 0) {
        renderCharacterTabs();
        renderCharacterTabPanels();
        console.log('✓ Character tabs re-rendered from confirmed characters');
    } else {
        console.log('⚠️ No confirmed characters - skipping tab generation');
    }
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.switchCenterTab = switchCenterTab;
window.renderCharacterTabs = renderCharacterTabs;
window.renderCharacterTabPanels = renderCharacterTabPanels;
window.deduplicateAllCharacters = deduplicateAllCharacters;
window.regenerateCharacterTabs = regenerateCharacterTabs;

// Stub function for merge characters modal (not yet implemented)
window.openMergeCharactersModal = function() {
    alert('Character merge functionality coming soon!');
};

// ============================================================================
// GLOBAL EVENT LISTENERS FOR FILE DIVIDER SYSTEM
// ============================================================================

/**
 * Close dropdown when clicking elsewhere
 */
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('supporting-dropdown');
    const dropdownTab = document.getElementById('supporting-characters-tab');

    if (dropdown && dropdownTab && !dropdownTab.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});
