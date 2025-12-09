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
     * Get all variations/aliases for a canonical character name
     * @param {string} canonicalName - The canonical character name
     * @returns {string[]} - Array of all known variations for this character
     */
    getVariations(canonicalName) {
        const variations = new Set();

        // Add the canonical name itself
        variations.add(canonicalName);

        // Find all aliases that map to this canonical name
        for (const [variation, canonical] of this.aliases.entries()) {
            if (canonical === canonicalName) {
                variations.add(variation);
            }
        }

        // Add common variations
        const parts = canonicalName.split(' ');
        if (parts.length > 1) {
            // Add first name only
            variations.add(parts[0]);
            // Add last name only
            variations.add(parts[parts.length - 1]);
            // Add first name with common prefixes
            variations.add(`Mr. ${parts[parts.length - 1]}`);
            variations.add(`Ms. ${parts[parts.length - 1]}`);
            variations.add(`Mrs. ${parts[parts.length - 1]}`);
            variations.add(`Dr. ${parts[parts.length - 1]}`);
        }

        // Remove duplicates and return sorted
        return Array.from(variations).sort();
    }

    /**
     * Build character reference for AI prompts
     * Returns formatted string with all characters and their variations
     * @returns {string} - Formatted character reference
     */
    buildCharacterReferenceForAI() {
        const confirmedChars = window.scriptBreakdownState?.confirmedCharacters || state.confirmedCharacters;
        if (!confirmedChars || confirmedChars.size === 0) {
            return 'Characters will be detected automatically from the scene text.';
        }

        const lines = ['**CHARACTER REFERENCE** (use these names when tagging):'];

        for (const canonicalName of confirmedChars) {
            const variations = this.getVariations(canonicalName);
            // Filter to show most useful variations (remove case duplicates)
            const uniqueVariations = new Set(variations.map(v => v.toLowerCase()));
            const displayVariations = Array.from(uniqueVariations)
                .filter(v => v !== canonicalName.toLowerCase())
                .slice(0, 5); // Limit to 5 most common

            if (displayVariations.length > 0) {
                lines.push(`- ${canonicalName.toUpperCase()} (also matches: ${displayVariations.join(', ')})`);
            } else {
                lines.push(`- ${canonicalName.toUpperCase()}`);
            }
        }

        lines.push('');
        lines.push('**IMPORTANT**: When you find "Gwen" or "Peter" in action lines, match them to the full character names above. Use the UPPERCASE canonical name (e.g., "GWEN LAWSON") in your character field.');

        return lines.join('\n');
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

    console.log(`✓ Generating tabs for ${featuredChars.length} featured characters (sorted by scene count):`,
        featuredChars.map(c => `${c} (${getCharacterSceneCount(c)} scenes)`));

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

    console.log(`✓ Rendered ${featuredChars.length} character tabs from featured characters`);
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

    // First, hide all character profile panels explicitly
    document.querySelectorAll('.character-profile-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    let profilePanel = document.getElementById(profileId);

    if (!profilePanel) {
        profilePanel = createCharacterProfilePanel(characterName);
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
        const tabIndex = viewType === 'profile' ? 1 : viewType === 'lookbook' ? 2 : viewType === 'timeline' ? 3 : 4;
        profilePanel.querySelector(`.view-tab:nth-child(${tabIndex})`).classList.add('active');
    }

    // Render the appropriate view
    switch (viewType) {
        case 'profile':
            contentDiv.innerHTML = renderProfileView(characterName);
            break;
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
 * Render comprehensive character profile view
 * Shows all collected data from initial analysis
 * @param {string} characterName - Character name
 * @returns {string} HTML for comprehensive profile view
 */
function renderProfileView(characterName) {
    // Check multiple sources for master context (different code paths store it differently)
    const masterContext = window.scriptMasterContext || window.masterContext;
    const narrativeContext = window.scriptNarrativeContext;

    // Get character data from master context (new format) or narrative context (old format)
    let characterData = null;

    // Try exact match first
    if (masterContext?.characters?.[characterName]) {
        characterData = masterContext.characters[characterName];
    }
    // Try case-insensitive match
    else if (masterContext?.characters) {
        const matchingKey = Object.keys(masterContext.characters).find(
            key => key.toUpperCase() === characterName.toUpperCase()
        );
        if (matchingKey) {
            characterData = masterContext.characters[matchingKey];
        }
    }
    // Fall back to narrative context
    else if (narrativeContext?.characters) {
        characterData = narrativeContext.characters.find(c => c.name === characterName);
    }

    // Debug logging
    console.log(`📋 Loading profile for ${characterName}:`, {
        hasMasterContext: !!masterContext,
        hasCharacters: !!masterContext?.characters,
        characterKeys: Object.keys(masterContext?.characters || {}),
        foundData: !!characterData
    });

    // If no data available, show helpful message with debug option
    if (!characterData) {
        return `
            <div class="empty-state" style="margin-top: 40px;">
                <div class="empty-title">No Character Profile Data</div>
                <div class="empty-desc">
                    No detailed character analysis available yet.<br>
                    Run initial script analysis to generate comprehensive character profiles.
                </div>
                <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
                    <button class="btn-primary" onclick="window.debugCharacterProfile('${escapeHtml(characterName)}')" style="padding: 8px 16px;">
                        Check Data in Console
                    </button>
                    <button class="btn-secondary" onclick="window.rerunCharacterAnalysis && window.rerunCharacterAnalysis('${escapeHtml(characterName)}')" style="padding: 8px 16px;">
                        Re-analyze Character
                    </button>
                </div>
            </div>
        `;
    }

    return `
        <div class="character-profile-overview" style="padding: 20px;">
            ${renderScriptDescriptionsSection(characterData)}
            ${renderPhysicalProfileSection(characterData)}
            ${renderCharacterAnalysisSection(characterData)}
            ${renderVisualProfileSection(characterData)}
            ${renderContinuityNotesSection(characterData)}
        </div>
    `;
}

/**
 * Render script descriptions section
 */
function renderScriptDescriptionsSection(characterData) {
    const descriptions = characterData?.scriptDescriptions || [];

    if (descriptions.length === 0) return '';

    return `
        <div class="profile-section" style="margin-bottom: 30px;">
            <h3 style="color: var(--accent-blue); margin-bottom: 15px; font-size: 14px; font-weight: 600; letter-spacing: 0.5px;">
                SCRIPT DESCRIPTIONS
            </h3>
            ${descriptions.map(desc => `
                <div class="description-block" style="background: var(--panel-bg); padding: 15px; margin-bottom: 10px; border-left: 3px solid var(--accent-blue); border-radius: 4px;">
                    <div style="font-style: italic; color: var(--text-primary); margin-bottom: 8px; line-height: 1.5;">
                        "${escapeHtml(desc.text)}"
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        Scene ${desc.sceneNumber} ${desc.type ? `• ${desc.type}` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Render physical profile section
 */
function renderPhysicalProfileSection(characterData) {
    const physical = characterData?.physicalProfile || {};

    const hasData = Object.keys(physical).length > 0;
    if (!hasData) return '';

    const fields = [
        { key: 'age', label: 'Age' },
        { key: 'gender', label: 'Gender' },
        { key: 'ethnicity', label: 'Ethnicity' },
        { key: 'height', label: 'Height' },
        { key: 'build', label: 'Build' },
        { key: 'hairColor', label: 'Hair Color' },
        { key: 'hairStyle', label: 'Hair Style' },
        { key: 'eyeColor', label: 'Eye Color' }
    ];

    const fieldsHtml = fields
        .filter(field => physical[field.key])
        .map(field => `
            <div style="display: flex; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                <div style="width: 120px; color: var(--text-secondary); font-size: 13px;">${field.label}:</div>
                <div style="flex: 1; color: var(--text-primary); font-size: 13px;">${escapeHtml(physical[field.key])}</div>
            </div>
        `).join('');

    const distinctiveFeatures = physical.distinctiveFeatures || [];
    const featuresHtml = distinctiveFeatures.length > 0 ? `
        <div style="display: flex; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
            <div style="width: 120px; color: var(--text-secondary); font-size: 13px;">Distinctive:</div>
            <div style="flex: 1; color: var(--text-primary); font-size: 13px;">${distinctiveFeatures.map(f => escapeHtml(f)).join(', ')}</div>
        </div>
    ` : '';

    return `
        <div class="profile-section" style="margin-bottom: 30px;">
            <h3 style="color: var(--accent-blue); margin-bottom: 15px; font-size: 14px; font-weight: 600; letter-spacing: 0.5px;">
                PHYSICAL PROFILE
            </h3>
            <div style="background: var(--panel-bg); padding: 15px; border-radius: 4px;">
                ${fieldsHtml}
                ${featuresHtml}
            </div>
        </div>
    `;
}

/**
 * Render character analysis section
 */
function renderCharacterAnalysisSection(characterData) {
    const analysis = characterData?.characterAnalysis || {};

    const hasData = Object.keys(analysis).length > 0;
    if (!hasData) return '';

    const fields = [
        { key: 'role', label: 'Role' },
        { key: 'personality', label: 'Personality' },
        { key: 'socialClass', label: 'Social Class' },
        { key: 'occupation', label: 'Occupation' },
        { key: 'arc', label: 'Character Arc' },
        { key: 'emotionalJourney', label: 'Emotional Journey' }
    ];

    const fieldsHtml = fields
        .filter(field => analysis[field.key])
        .map(field => `
            <div style="margin-bottom: 15px;">
                <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${field.label}
                </div>
                <div style="color: var(--text-primary); font-size: 13px; line-height: 1.5;">
                    ${escapeHtml(analysis[field.key])}
                </div>
            </div>
        `).join('');

    const relationships = analysis.relationships || [];
    const relationshipsHtml = relationships.length > 0 ? `
        <div style="margin-bottom: 15px;">
            <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px;">
                Key Relationships
            </div>
            <div style="color: var(--text-primary); font-size: 13px;">
                ${relationships.map(r => `<div style="margin: 5px 0;">• ${escapeHtml(r)}</div>`).join('')}
            </div>
        </div>
    ` : '';

    return `
        <div class="profile-section" style="margin-bottom: 30px;">
            <h3 style="color: var(--accent-blue); margin-bottom: 15px; font-size: 14px; font-weight: 600; letter-spacing: 0.5px;">
                CHARACTER ANALYSIS
            </h3>
            <div style="background: var(--panel-bg); padding: 15px; border-radius: 4px;">
                ${fieldsHtml}
                ${relationshipsHtml}
            </div>
        </div>
    `;
}

/**
 * Render visual profile section
 */
function renderVisualProfileSection(characterData) {
    const visual = characterData?.visualProfile || {};

    const hasData = Object.keys(visual).length > 0;
    if (!hasData) return '';

    const fields = [
        { key: 'overallVibe', label: 'Overall Vibe' },
        { key: 'styleChoices', label: 'Style Choices' },
        { key: 'groomingHabits', label: 'Grooming Habits' },
        { key: 'makeupStyle', label: 'Makeup Style' },
        { key: 'quirks', label: 'Visual Quirks' }
    ];

    const fieldsHtml = fields
        .filter(field => visual[field.key])
        .map(field => `
            <div style="margin-bottom: 15px;">
                <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${field.label}
                </div>
                <div style="color: var(--text-primary); font-size: 13px; line-height: 1.5;">
                    ${escapeHtml(visual[field.key])}
                </div>
            </div>
        `).join('');

    const inspirations = visual.inspirations || [];
    const inspirationsHtml = inspirations.length > 0 ? `
        <div style="margin-bottom: 15px;">
            <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px;">
                Visual Inspirations
            </div>
            <div style="color: var(--text-primary); font-size: 13px;">
                ${inspirations.map(i => `<div style="margin: 5px 0;">• ${escapeHtml(i)}</div>`).join('')}
            </div>
        </div>
    ` : '';

    return `
        <div class="profile-section" style="margin-bottom: 30px;">
            <h3 style="color: var(--accent-blue); margin-bottom: 15px; font-size: 14px; font-weight: 600; letter-spacing: 0.5px;">
                VISUAL IDENTITY
            </h3>
            <div style="background: var(--panel-bg); padding: 15px; border-radius: 4px;">
                ${fieldsHtml}
                ${inspirationsHtml}
            </div>
        </div>
    `;
}

/**
 * Render continuity notes section
 */
function renderContinuityNotesSection(characterData) {
    const notes = characterData?.continuityNotes || {};

    const hasData = Object.keys(notes).length > 0;
    if (!hasData) return '';

    const fields = [
        { key: 'keyLooks', label: 'Key Looks' },
        { key: 'transformations', label: 'Transformations' },
        { key: 'signature', label: 'Signature Elements' }
    ];

    const fieldsHtml = fields
        .filter(field => notes[field.key])
        .map(field => `
            <div style="margin-bottom: 15px;">
                <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${field.label}
                </div>
                <div style="color: var(--text-primary); font-size: 13px; line-height: 1.5;">
                    ${escapeHtml(notes[field.key])}
                </div>
            </div>
        `).join('');

    return `
        <div class="profile-section" style="margin-bottom: 30px;">
            <h3 style="color: var(--accent-blue); margin-bottom: 15px; font-size: 14px; font-weight: 600; letter-spacing: 0.5px;">
                CONTINUITY NOTES
            </h3>
            <div style="background: var(--panel-bg); padding: 15px; border-radius: 4px;">
                ${fieldsHtml}
            </div>
        </div>
    `;
}

/**
 * Get character looks organized by story day
 * @param {string} characterName - Character name
 * @returns {Object} Object mapping story days to arrays of look objects
 */
function getCharacterLooksByDay(characterName) {
    const dayGroups = {};

    // Get all scenes where character appears
    state.scenes.forEach((scene, sceneIndex) => {
        const breakdown = state.sceneBreakdowns[sceneIndex];
        if (!breakdown || !breakdown.cast || !breakdown.cast.includes(characterName)) {
            return;
        }

        const storyDay = scene.storyDay || 'Unassigned';
        const charState = state.characterStates[sceneIndex]?.[characterName] || {};

        // Initialize day group if needed
        if (!dayGroups[storyDay]) {
            dayGroups[storyDay] = [];
        }

        // Create look object from scene data
        const look = {
            sceneIndex: sceneIndex,
            sceneNumber: scene.number,
            heading: scene.heading,
            storyDay: storyDay,
            hair: charState.hair || '',
            makeup: charState.makeup || '',
            sfx: charState.sfx || '',
            wardrobe: charState.wardrobe || '',
            notes: charState.notes || ''
        };

        dayGroups[storyDay].push(look);
    });

    return dayGroups;
}

/**
 * Render a single look card with editable fields
 * @param {string} characterName - Character name
 * @param {Object} look - Look object with scene and appearance data
 * @returns {string} HTML for look card
 */
function renderLookCard(characterName, look) {
    const hasContent = look.hair || look.makeup || look.sfx || look.wardrobe || look.notes;

    return `
        <div class="look-card ${hasContent ? 'has-content' : ''}" data-scene="${look.sceneIndex}">
            <div class="look-card-header" onclick="navigateToScene(${look.sceneIndex})">
                <span class="look-scene-badge">Scene ${look.sceneNumber}</span>
                <span class="look-scene-heading">${escapeHtml(look.heading.substring(0, 50))}${look.heading.length > 50 ? '...' : ''}</span>
            </div>

            <div class="look-details">
                <div class="look-field">
                    <label>Hair:</label>
                    <input type="text"
                           value="${escapeHtml(look.hair)}"
                           placeholder="Hair description..."
                           onchange="updateCharacterLook('${escapeHtml(characterName).replace(/'/g, "\\'")}', ${look.sceneIndex}, 'hair', this.value)">
                </div>

                <div class="look-field">
                    <label>Makeup:</label>
                    <input type="text"
                           value="${escapeHtml(look.makeup)}"
                           placeholder="Makeup description..."
                           onchange="updateCharacterLook('${escapeHtml(characterName).replace(/'/g, "\\'")}', ${look.sceneIndex}, 'makeup', this.value)">
                </div>

                <div class="look-field">
                    <label>SFX:</label>
                    <input type="text"
                           value="${escapeHtml(look.sfx)}"
                           placeholder="SFX/prosthetics..."
                           onchange="updateCharacterLook('${escapeHtml(characterName).replace(/'/g, "\\'")}', ${look.sceneIndex}, 'sfx', this.value)">
                </div>

                <div class="look-field">
                    <label>Wardrobe:</label>
                    <input type="text"
                           value="${escapeHtml(look.wardrobe)}"
                           placeholder="Wardrobe description..."
                           onchange="updateCharacterLook('${escapeHtml(characterName).replace(/'/g, "\\'")}', ${look.sceneIndex}, 'wardrobe', this.value)">
                </div>

                <div class="look-field look-field-notes">
                    <label>Notes:</label>
                    <textarea
                        placeholder="Additional continuity notes..."
                        onchange="updateCharacterLook('${escapeHtml(characterName).replace(/'/g, "\\'")}', ${look.sceneIndex}, 'notes', this.value)">${escapeHtml(look.notes)}</textarea>
                </div>
            </div>

            <div class="look-actions">
                <button class="look-action-btn" onclick="applyLookForward('${escapeHtml(characterName).replace(/'/g, "\\'")}', ${look.sceneIndex})" title="Copy this look to all following scenes in this day">
                    Apply Forward →
                </button>
                <button class="look-action-btn" onclick="alert('Photo attachment feature coming soon')" title="Attach reference photos">
                    📎 Add Photo
                </button>
            </div>
        </div>
    `;
}

/**
 * Render lookbook view with expandable story day sections
 * @param {string} characterName - Character name
 * @returns {string} HTML for lookbook view
 */
function renderLookbookView(characterName) {
    const profile = state.castProfiles[characterName] || {};
    const dayGroups = getCharacterLooksByDay(characterName);

    // Sort days (natural sort for "Day 1", "Day 2", etc.)
    const sortedDays = Object.keys(dayGroups).sort((a, b) => {
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;

        const numA = parseInt(a.match(/\d+/)?.[0] || 0);
        const numB = parseInt(b.match(/\d+/)?.[0] || 0);
        return numA - numB;
    });

    if (sortedDays.length === 0) {
        return `
            <div class="lookbook-view">
                <div class="view-section">
                    <h3>Base Description</h3>
                    <p>${escapeHtml(profile.baseDescription || 'No base description yet')}</p>
                </div>
                <div class="empty-message">
                    This character doesn't appear in any scenes yet.
                </div>
            </div>
        `;
    }

    return `
        <div class="lookbook-view">
            <div class="view-section">
                <h3>Base Description</h3>
                <div class="base-description-field">
                    <textarea
                        class="base-description-input"
                        placeholder="Enter base character description (age, build, general appearance, etc.)..."
                        onchange="updateQuickBaseDescription('${escapeHtml(characterName).replace(/'/g, "\\'")}', this.value)">${escapeHtml(profile.baseDescription || '')}</textarea>
                </div>
            </div>

            <div class="lookbook-container">
                ${sortedDays.map(day => {
                    const looks = dayGroups[day];
                    const dayId = day.toLowerCase().replace(/\s+/g, '-');

                    return `
                        <div class="story-day-section" id="lookbook-day-${dayId}">
                            <div class="day-section-header" onclick="toggleDaySection('${dayId}')">
                                <span class="expand-icon">▼</span>
                                <h3 class="day-section-title">${escapeHtml(day)}</h3>
                                <span class="day-scene-count">${looks.length} scene${looks.length !== 1 ? 's' : ''}</span>
                            </div>

                            <div class="day-looks expanded" id="day-looks-${dayId}">
                                ${looks.map(look => renderLookCard(characterName, look)).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
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
 * Get character continuity events with scene data
 * Now includes auto-detected events from masterContext
 * @param {string} characterName - Character name
 * @returns {Array} Array of continuity event objects
 */
function getCharacterContinuityEvents(characterName) {
    const manualEvents = state.continuityEvents[characterName] || [];
    const autoDetectedEvents = getAutoDetectedEvents(characterName);

    // Combine manual and auto-detected events
    const allEvents = [...manualEvents];

    // Add auto-detected events that don't already exist as manual events
    autoDetectedEvents.forEach(autoEvent => {
        const isDuplicate = manualEvents.some(manual =>
            manual.startScene === autoEvent.startScene &&
            manual.type === autoEvent.type &&
            manual.character === autoEvent.character
        );
        if (!isDuplicate) {
            allEvents.push(autoEvent);
        }
    });

    // Enrich events with scene information and ensure IDs
    return allEvents.map(event => {
        const enrichedEvent = { ...event };

        // Ensure event has an ID
        if (!enrichedEvent.id) {
            enrichedEvent.id = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        return enrichedEvent;
    });
}

/**
 * Get auto-detected continuity events from masterContext
 * Extracts events from appearanceChanges and descriptionTags
 * @param {string} characterName - Character name
 * @returns {Array} Array of auto-detected event objects
 */
function getAutoDetectedEvents(characterName) {
    const events = [];
    const masterContext = window.masterContext || window.scriptMasterContext;

    if (!masterContext) return events;

    // Source 1: appearanceChanges from Phase 5
    if (masterContext.appearanceChanges && Array.isArray(masterContext.appearanceChanges)) {
        masterContext.appearanceChanges.forEach(change => {
            if (change.character?.toUpperCase() === characterName.toUpperCase()) {
                events.push({
                    id: `auto-${change.character}-${change.start_scene}-${change.change_type}`,
                    character: characterName,
                    type: mapChangeTypeToEventType(change.change_type),
                    category: change.change_type,
                    description: change.description || change.visual_notes || 'Auto-detected event',
                    startScene: change.start_scene,
                    endScene: change.end_scene || null,
                    source: 'auto-detected',
                    progression: [],
                    visualNotes: change.visual_notes || ''
                });
            }
        });
    }

    // Source 2: descriptionTags that indicate changes
    if (masterContext.descriptionTags && Array.isArray(masterContext.descriptionTags)) {
        const changeCategories = ['injury', 'fight', 'weather', 'illness', 'time_passage', 'condition'];

        // Group tags by scene for change detection
        const tagsByScene = {};
        masterContext.descriptionTags.forEach(tag => {
            if (tag.character?.toUpperCase() === characterName.toUpperCase() &&
                changeCategories.includes(tag.category)) {

                const sceneKey = tag.scene;
                if (!tagsByScene[sceneKey]) {
                    tagsByScene[sceneKey] = [];
                }
                tagsByScene[sceneKey].push(tag);
            }
        });

        // Create events from grouped tags
        Object.entries(tagsByScene).forEach(([scene, tags]) => {
            tags.forEach(tag => {
                // Check if this event already exists
                const existingEvent = events.find(e =>
                    e.startScene === parseInt(scene) &&
                    e.category === tag.category
                );

                if (!existingEvent) {
                    events.push({
                        id: `auto-tag-${characterName}-${scene}-${tag.category}`,
                        character: characterName,
                        type: mapChangeTypeToEventType(tag.category),
                        category: tag.category,
                        description: tag.quote || 'Auto-detected from script',
                        startScene: parseInt(scene),
                        endScene: null,
                        source: 'auto-detected',
                        progression: [],
                        visualNotes: ''
                    });
                }
            });
        });
    }

    // Source 3: Character's extractedElements
    const charData = masterContext.characters?.[characterName];
    if (charData?.extractedElements?.mentionedAppearanceChanges) {
        charData.extractedElements.mentionedAppearanceChanges.forEach(change => {
            const existingEvent = events.find(e =>
                e.startScene === change.scene &&
                e.category === change.type
            );

            if (!existingEvent) {
                events.push({
                    id: `auto-extracted-${characterName}-${change.scene}-${change.type}`,
                    character: characterName,
                    type: mapChangeTypeToEventType(change.type),
                    category: change.type,
                    description: change.description || 'Auto-detected change',
                    startScene: change.scene,
                    endScene: null,
                    source: 'auto-detected',
                    progression: [],
                    visualNotes: change.notes || ''
                });
            }
        });
    }

    // Filter out dismissed events
    const dismissedEvents = state.dismissedAutoEvents || new Set();
    const filteredEvents = events.filter(e => !dismissedEvents.has(e.id));

    // Sort by start scene
    filteredEvents.sort((a, b) => a.startScene - b.startScene);

    return filteredEvents;
}

/**
 * Map change type strings to standardized event types
 * @param {string} changeType - Raw change type from detection
 * @returns {string} Standardized event type
 */
function mapChangeTypeToEventType(changeType) {
    const typeMap = {
        'injury': 'Injury',
        'injury_acquired': 'Injury',
        'fight': 'Fight/Action',
        'weather': 'Weather Effect',
        'illness': 'Illness/Health',
        'time_passage': 'Time Passage',
        'condition': 'Condition Change',
        'hair': 'Hair Change',
        'wardrobe': 'Wardrobe Change',
        'makeup': 'Makeup Change',
        'physical': 'Physical Change',
        'physical_appearance': 'Physical Change'
    };
    return typeMap[changeType?.toLowerCase()] || changeType || 'Event';
}

/**
 * Get color for progression stage based on severity
 * @param {number} severity - Severity level (0-100)
 * @returns {string} CSS color value
 */
function getStageColor(severity) {
    if (severity >= 70) {
        // High severity - red
        return 'rgba(239, 68, 68, 0.8)';
    } else if (severity >= 40) {
        // Medium severity - yellow/orange
        return 'rgba(251, 191, 36, 0.8)';
    } else if (severity >= 10) {
        // Low severity - light green
        return 'rgba(132, 204, 22, 0.8)';
    } else {
        // Healed - green
        return 'rgba(34, 197, 94, 0.8)';
    }
}

/**
 * Render progression stages for a continuity event
 * @param {Object} event - Event object with progression data
 * @param {string} characterName - Character name
 * @returns {string} HTML for progression stages
 */
function renderProgressionStages(event, characterName) {
    if (!event.progression || event.progression.length === 0) {
        return `
            <div class="progression-empty">
                <span>No progression stages defined</span>
                <button class="small-stage-btn" onclick="addProgressionStage('${escapeHtml(characterName).replace(/'/g, "\\'")}', '${event.id}')">
                    + Add Stage
                </button>
            </div>
        `;
    }

    const characterScenes = getCharacterScenes(characterName);
    const totalScenes = characterScenes.length;

    return `
        <div class="progression-stages">
            ${event.progression.map((stage, index) => {
                const stageScenes = stage.endScene - stage.startScene + 1;
                const width = totalScenes > 0 ? (stageScenes / totalScenes) * 100 : 0;
                const color = getStageColor(stage.severity || 50);

                return `
                    <div class="progression-stage"
                         style="width: ${width}%; background: ${color};"
                         onclick="editProgressionStage('${escapeHtml(characterName).replace(/'/g, "\\'")}', '${event.id}', ${index})"
                         title="Click to edit stage">
                        <div class="stage-content">
                            <span class="stage-label">${escapeHtml(stage.name || 'Stage ' + (index + 1))}</span>
                            <span class="stage-scenes">Sc ${stage.startScene}-${stage.endScene}</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Render continuity events timeline
 * Now shows auto-detected events with visual indicator
 * @param {string} characterName - Character name
 * @returns {string} HTML for continuity events timeline
 */
function renderContinuityEventsTimeline(characterName) {
    const events = getCharacterContinuityEvents(characterName);

    // Separate auto-detected from manual events
    const autoEvents = events.filter(e => e.source === 'auto-detected');
    const manualEvents = events.filter(e => e.source !== 'auto-detected');

    if (events.length === 0) {
        return `
            <div class="continuity-events-section">
                <div class="empty-message">
                    No continuity events tracked yet.
                </div>
                <button class="add-event-btn" onclick="addContinuityEvent('${escapeHtml(characterName).replace(/'/g, "\\'")}')">
                    + Add Continuity Event
                </button>
            </div>
        `;
    }

    // Get event type color
    const getEventColor = (category) => {
        const colors = {
            'injury': '#FF6347', // Coral
            'fight': '#FF6347',
            'weather': '#87CEEB', // Sky blue
            'illness': '#90EE90', // Light green
            'time_passage': '#DDA0DD', // Plum
            'condition': '#87CEEB',
            'hair': '#E6E6FA', // Lavender
            'wardrobe': '#98FB98', // Pale green
            'makeup': '#FFB6C1', // Pink
            'physical': '#FFD700' // Gold
        };
        return colors[category?.toLowerCase()] || '#C9A961';
    };

    return `
        <div class="continuity-events-section">
            <!-- Auto-detected events section -->
            ${autoEvents.length > 0 ? `
                <div class="auto-events-header" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--glass-border);">
                    <span style="color: var(--accent-gold); font-weight: 600;">⚡ Auto-Detected Events</span>
                    <span style="font-size: 0.8em; opacity: 0.7;">(${autoEvents.length} found from script analysis)</span>
                </div>
                ${autoEvents.map(event => `
                    <div class="event-timeline auto-detected" data-event-id="${event.id}" style="background: rgba(201, 169, 97, 0.1); border: 1px solid var(--accent-gold); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
                        <div class="event-timeline-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                            <div class="event-info">
                                <span class="event-type-badge" style="background: ${getEventColor(event.category)}; color: #000; padding: 2px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600;">
                                    ${escapeHtml(event.type || event.category || 'Event')}
                                </span>
                                <span class="auto-badge" style="background: var(--accent-gold); color: var(--bg-dark); padding: 2px 6px; border-radius: 4px; font-size: 0.7em; margin-left: 4px;">
                                    AUTO
                                </span>
                            </div>
                            <div class="event-meta" style="font-size: 0.85em; opacity: 0.8;">
                                Scene ${event.startScene || '?'}${event.endScene ? ` - ${event.endScene}` : ' (ongoing)'}
                            </div>
                        </div>
                        <div class="event-description" style="font-size: 0.9em; margin-bottom: 8px; line-height: 1.4;">
                            ${escapeHtml(event.description || 'No description')}
                        </div>
                        ${event.visualNotes ? `
                            <div class="visual-notes" style="font-size: 0.8em; opacity: 0.8; font-style: italic; margin-bottom: 8px;">
                                Visual notes: ${escapeHtml(event.visualNotes)}
                            </div>
                        ` : ''}
                        <div class="event-timeline-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="event-action-btn" onclick="confirmAutoEvent('${escapeHtml(characterName).replace(/'/g, "\\'")}', '${event.id}')" title="Confirm and track this event" style="background: var(--accent-gold); color: var(--bg-dark); border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">
                                ✓ Confirm & Track
                            </button>
                            <button class="event-action-btn" onclick="setEventEndScene('${escapeHtml(characterName).replace(/'/g, "\\'")}', '${event.id}')" title="Set when this event ends" style="background: var(--glass-bg); border: 1px solid var(--glass-border); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">
                                Set End Scene
                            </button>
                            <button class="event-action-btn" onclick="dismissAutoEvent('${escapeHtml(characterName).replace(/'/g, "\\'")}', '${event.id}')" title="Dismiss this detection" style="background: transparent; border: 1px solid var(--glass-border); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em; opacity: 0.7;">
                                Dismiss
                            </button>
                        </div>
                    </div>
                `).join('')}
            ` : ''}

            <!-- Manual/Confirmed events section -->
            ${manualEvents.length > 0 ? `
                <div class="manual-events-header" style="display: flex; align-items: center; gap: 8px; margin-top: 16px; margin-bottom: 12px;">
                    <span style="font-weight: 600;">Tracked Events</span>
                    <span style="font-size: 0.8em; opacity: 0.7;">(${manualEvents.length} events)</span>
                </div>
                ${manualEvents.map(event => `
                    <div class="event-timeline" data-event-id="${event.id}" style="background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
                        <div class="event-timeline-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                            <div class="event-info">
                                <span class="event-type-badge" style="background: ${getEventColor(event.category)}; color: #000; padding: 2px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600;">
                                    ${escapeHtml(event.category || event.type || 'Event')}
                                </span>
                            </div>
                            <div class="event-meta" style="font-size: 0.85em; opacity: 0.8;">
                                Scene ${event.startScene || '?'}${event.endScene ? ` - ${event.endScene}` : ' (ongoing)'}
                            </div>
                        </div>
                        <div class="event-description" style="font-size: 0.9em; margin-bottom: 8px;">
                            ${escapeHtml(event.description || 'Untitled Event')}
                        </div>

                        <div class="progression-bar">
                            ${renderProgressionStages(event, characterName)}
                        </div>

                        <div class="event-timeline-actions" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
                            <button class="event-action-btn" onclick="fillProgressionGaps('${escapeHtml(characterName).replace(/'/g, "\\'")}', '${event.id}')" title="Use AI to fill progression gaps" style="background: var(--glass-bg); border: 1px solid var(--glass-border); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">
                                ✨ Fill Gaps with AI
                            </button>
                            <button class="event-action-btn" onclick="editContinuityEvent('${escapeHtml(characterName).replace(/'/g, "\\'")}', '${event.id}')" title="Edit event details" style="background: var(--glass-bg); border: 1px solid var(--glass-border); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">
                                ✏️ Edit
                            </button>
                            <button class="event-action-btn danger" onclick="deleteContinuityEvent('${escapeHtml(characterName).replace(/'/g, "\\'")}', '${event.id}')" title="Delete event" style="background: transparent; border: 1px solid #ef4444; color: #ef4444; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                `).join('')}
            ` : ''}

            <button class="add-event-btn" onclick="addContinuityEvent('${escapeHtml(characterName).replace(/'/g, "\\'")}')">
                + Add Continuity Event
            </button>
        </div>
    `;
}

/**
 * Render events view with timeline visualization
 * @param {string} characterName - Character name
 * @returns {string} HTML for events view
 */
function renderEventsView(characterName) {
    return `
        <div class="events-view">
            ${renderContinuityEventsTimeline(characterName)}
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
 * Toggle expansion of a story day section
 * @param {string} dayId - Day identifier (e.g., 'day-1', 'unassigned')
 */
window.toggleDaySection = function(dayId) {
    const dayLooks = document.getElementById(`day-looks-${dayId}`);
    const section = document.getElementById(`lookbook-day-${dayId}`);

    if (!dayLooks || !section) return;

    const expandIcon = section.querySelector('.expand-icon');

    if (dayLooks.classList.contains('expanded')) {
        dayLooks.classList.remove('expanded');
        dayLooks.classList.add('collapsed');
        if (expandIcon) expandIcon.textContent = '▶';
    } else {
        dayLooks.classList.remove('collapsed');
        dayLooks.classList.add('expanded');
        if (expandIcon) expandIcon.textContent = '▼';
    }
};

/**
 * Update character look for a specific scene
 * @param {string} characterName - Character name
 * @param {number} sceneIndex - Scene index
 * @param {string} field - Field to update (hair, makeup, sfx, wardrobe, notes)
 * @param {string} value - New value
 */
window.updateCharacterLook = async function(characterName, sceneIndex, field, value) {
    // Initialize structures if needed
    if (!state.characterStates[sceneIndex]) {
        state.characterStates[sceneIndex] = {};
    }
    if (!state.characterStates[sceneIndex][characterName]) {
        state.characterStates[sceneIndex][characterName] = {};
    }

    // Update the field
    state.characterStates[sceneIndex][characterName][field] = value;

    // Save project
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Update visual indicator on the card
    const card = document.querySelector(`.look-card[data-scene="${sceneIndex}"]`);
    if (card) {
        const hasContent = Object.values(state.characterStates[sceneIndex][characterName])
            .some(val => val && val.trim() !== '');
        if (hasContent) {
            card.classList.add('has-content');
        } else {
            card.classList.remove('has-content');
        }
    }

    console.log(`Updated ${characterName} ${field} for scene ${sceneIndex}:`, value);
};

/**
 * Apply current look forward to all following scenes in the same day
 * @param {string} characterName - Character name
 * @param {number} sourceSceneIndex - Scene index to copy from
 */
window.applyLookForward = async function(characterName, sourceSceneIndex) {
    const sourceScene = state.scenes[sourceSceneIndex];
    if (!sourceScene) return;

    const sourceState = state.characterStates[sourceSceneIndex]?.[characterName];
    if (!sourceState || Object.keys(sourceState).length === 0) {
        showToast('No look data to copy from this scene', 'warning');
        return;
    }

    const storyDay = sourceScene.storyDay || 'Unassigned';

    // Find all following scenes in the same story day where character appears
    let updatedCount = 0;

    state.scenes.forEach((scene, sceneIndex) => {
        if (sceneIndex <= sourceSceneIndex) return;
        if ((scene.storyDay || 'Unassigned') !== storyDay) return;

        const breakdown = state.sceneBreakdowns[sceneIndex];
        if (!breakdown || !breakdown.cast || !breakdown.cast.includes(characterName)) return;

        // Initialize structures if needed
        if (!state.characterStates[sceneIndex]) {
            state.characterStates[sceneIndex] = {};
        }
        if (!state.characterStates[sceneIndex][characterName]) {
            state.characterStates[sceneIndex][characterName] = {};
        }

        // Copy all look fields
        ['hair', 'makeup', 'sfx', 'wardrobe'].forEach(field => {
            if (sourceState[field]) {
                state.characterStates[sceneIndex][characterName][field] = sourceState[field];
            }
        });

        updatedCount++;
    });

    if (updatedCount > 0) {
        // Save project
        const { saveProject } = await import('./export-handlers.js');
        saveProject();

        // Refresh the view
        const contentId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-content`;
        const contentDiv = document.getElementById(contentId);
        if (contentDiv) {
            contentDiv.innerHTML = renderLookbookView(characterName);
        }

        showToast(`Applied look forward to ${updatedCount} scene${updatedCount !== 1 ? 's' : ''} in ${storyDay}`, 'success');
    } else {
        showToast(`No following scenes found in ${storyDay}`, 'info');
    }
};

/**
 * Add a new continuity event for a character
 * @param {string} characterName - Character name
 */
window.addContinuityEvent = async function(characterName) {
    const eventName = prompt('Enter event name (e.g., "Bruised Left Eye", "Broken Arm"):');
    if (!eventName || !eventName.trim()) return;

    const category = prompt('Enter category (injury, health, sfx, other):', 'injury');
    const startScene = parseInt(prompt('Enter starting scene number:', '1'));

    if (isNaN(startScene)) {
        alert('Invalid scene number');
        return;
    }

    // Initialize continuity events if needed
    if (!state.continuityEvents[characterName]) {
        state.continuityEvents[characterName] = [];
    }

    // Create new event
    const newEvent = {
        id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        description: eventName.trim(),
        category: category || 'injury',
        startScene: startScene,
        endScene: null,
        progression: []
    };

    state.continuityEvents[characterName].push(newEvent);

    // Save project
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Refresh the view
    const contentId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-content`;
    const contentDiv = document.getElementById(contentId);
    if (contentDiv) {
        contentDiv.innerHTML = renderEventsView(characterName);
    }

    alert(`Added continuity event: ${eventName}`);
};

/**
 * Edit a continuity event
 * @param {string} characterName - Character name
 * @param {string} eventId - Event ID
 */
window.editContinuityEvent = async function(characterName, eventId) {
    const events = state.continuityEvents[characterName] || [];
    const event = events.find(e => e.id === eventId);

    if (!event) {
        alert('Event not found');
        return;
    }

    const newName = prompt('Event name:', event.description);
    if (newName === null) return;

    if (newName.trim()) {
        event.description = newName.trim();
    }

    const newCategory = prompt('Category (injury, health, sfx, other):', event.category);
    if (newCategory && newCategory.trim()) {
        event.category = newCategory.trim();
    }

    const newEnd = prompt('End scene (leave empty if ongoing):', event.endScene || '');
    if (newEnd.trim()) {
        const endScene = parseInt(newEnd);
        if (!isNaN(endScene)) {
            event.endScene = endScene;
        }
    } else {
        event.endScene = null;
    }

    // Save project
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Refresh the view
    const contentId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-content`;
    const contentDiv = document.getElementById(contentId);
    if (contentDiv) {
        contentDiv.innerHTML = renderEventsView(characterName);
    }
};

/**
 * Delete a continuity event
 * @param {string} characterName - Character name
 * @param {string} eventId - Event ID
 */
window.deleteContinuityEvent = async function(characterName, eventId) {
    if (!confirm('Are you sure you want to delete this continuity event?')) {
        return;
    }

    const events = state.continuityEvents[characterName] || [];
    const index = events.findIndex(e => e.id === eventId);

    if (index !== -1) {
        events.splice(index, 1);

        // Save project
        const { saveProject } = await import('./export-handlers.js');
        saveProject();

        // Refresh the view
        const contentId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-content`;
        const contentDiv = document.getElementById(contentId);
        if (contentDiv) {
            contentDiv.innerHTML = renderEventsView(characterName);
        }
    }
};

/**
 * Add a progression stage to an event
 * @param {string} characterName - Character name
 * @param {string} eventId - Event ID
 */
window.addProgressionStage = async function(characterName, eventId) {
    const events = state.continuityEvents[characterName] || [];
    const event = events.find(e => e.id === eventId);

    if (!event) {
        alert('Event not found');
        return;
    }

    const stageName = prompt('Stage name (e.g., "Fresh wound", "Healing", "Scabbed over"):');
    if (!stageName || !stageName.trim()) return;

    const startScene = parseInt(prompt('Start scene:', event.startScene));
    const endScene = parseInt(prompt('End scene:', startScene + 5));
    const severity = parseInt(prompt('Severity (0-100, where 100 is worst):', '70'));

    if (isNaN(startScene) || isNaN(endScene) || isNaN(severity)) {
        alert('Invalid input');
        return;
    }

    if (!event.progression) {
        event.progression = [];
    }

    event.progression.push({
        name: stageName.trim(),
        startScene: startScene,
        endScene: endScene,
        severity: Math.max(0, Math.min(100, severity))
    });

    // Sort by start scene
    event.progression.sort((a, b) => a.startScene - b.startScene);

    // Save project
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Refresh the view
    const contentId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-content`;
    const contentDiv = document.getElementById(contentId);
    if (contentDiv) {
        contentDiv.innerHTML = renderEventsView(characterName);
    }
};

/**
 * Edit a progression stage
 * @param {string} characterName - Character name
 * @param {string} eventId - Event ID
 * @param {number} stageIndex - Stage index
 */
window.editProgressionStage = async function(characterName, eventId, stageIndex) {
    const events = state.continuityEvents[characterName] || [];
    const event = events.find(e => e.id === eventId);

    if (!event || !event.progression || !event.progression[stageIndex]) {
        alert('Stage not found');
        return;
    }

    const stage = event.progression[stageIndex];

    const newName = prompt('Stage name:', stage.name);
    if (newName === null) return;

    if (newName.trim()) {
        stage.name = newName.trim();
    }

    const newSeverity = prompt('Severity (0-100):', stage.severity);
    if (newSeverity && newSeverity.trim()) {
        const severity = parseInt(newSeverity);
        if (!isNaN(severity)) {
            stage.severity = Math.max(0, Math.min(100, severity));
        }
    }

    // Save project
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Refresh the view
    const contentId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-content`;
    const contentDiv = document.getElementById(contentId);
    if (contentDiv) {
        contentDiv.innerHTML = renderEventsView(characterName);
    }
};

/**
 * Fill progression gaps with AI
 * @param {string} characterName - Character name
 * @param {string} eventId - Event ID
 */
window.fillProgressionGaps = async function(characterName, eventId) {
    const events = state.continuityEvents[characterName] || [];
    const event = events.find(e => e.id === eventId);

    if (!event) {
        showToast('Event not found', 'error');
        return;
    }

    // Check if event has basic info
    if (!event.startScene) {
        showToast('Event needs a start scene before generating progression', 'error');
        return;
    }

    // Get character scenes for context
    const characterScenes = getCharacterScenes(characterName);
    const sceneCount = characterScenes.length;
    const endScene = event.endScene || Math.min(event.startScene + 20, sceneCount);

    const duration = endScene - event.startScene;

    if (duration < 2) {
        showToast('Event duration too short for meaningful progression', 'error');
        return;
    }

    try {
        showToast('Generating progression stages with AI...', 'info');

        const { callAI } = await import('./ai-integration.js');

        const prompt = `You are a film continuity expert. Generate realistic healing/progression stages for a character continuity event.

Event Type: ${event.category || 'injury'}
Description: ${event.description}
Start Scene: ${event.startScene}
End Scene: ${endScene}
Duration: ${duration} scenes

Create 3-5 progression stages showing realistic healing/recovery over time. For each stage:
1. Name (brief description of the stage)
2. Start scene number
3. End scene number
4. Severity (0-100, where 100 is worst/most severe)

Format as JSON array:
[
  {"name": "Fresh wound", "startScene": ${event.startScene}, "endScene": ${event.startScene + Math.floor(duration * 0.2)}, "severity": 95},
  ...
]

Important:
- Severity should decrease over time (healing progression)
- Scene ranges should be continuous with no gaps
- Be realistic for the type of injury/condition
- Consider typical healing timelines
- Final stage should have low severity (nearly healed)

Return ONLY the JSON array, no other text.`;

        const response = await callAI(prompt, 1000);

        // Parse AI response
        let progressionStages;
        try {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                progressionStages = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('Failed to parse AI response:', response);
            showToast('AI generated invalid progression data', 'error');
            return;
        }

        // Validate progression stages
        if (!Array.isArray(progressionStages) || progressionStages.length === 0) {
            showToast('AI generated empty progression', 'error');
            return;
        }

        // Ensure all stages have required fields
        progressionStages = progressionStages.map((stage, index) => ({
            name: stage.name || `Stage ${index + 1}`,
            startScene: parseInt(stage.startScene) || event.startScene,
            endScene: parseInt(stage.endScene) || event.startScene + 1,
            severity: Math.max(0, Math.min(100, parseInt(stage.severity) || 50))
        }));

        // Sort by start scene
        progressionStages.sort((a, b) => a.startScene - b.startScene);

        // Update event with new progression
        event.progression = progressionStages;

        // Save project
        const { saveProject } = await import('./export-handlers.js');
        saveProject();

        // Refresh the view
        const contentId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-content`;
        const contentDiv = document.getElementById(contentId);
        if (contentDiv) {
            contentDiv.innerHTML = renderEventsView(characterName);
        }

        showToast(`Generated ${progressionStages.length} progression stages`, 'success');

    } catch (error) {
        console.error('Error filling progression gaps:', error);
        showToast(`Error: ${error.message}`, 'error');
    }
};

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (success, error, info)
 */
function showToast(message, type = 'info') {
    // Try to use existing toast system
    if (window.showToast && typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }

    // Fallback to simple implementation
    const existingToast = document.getElementById('simple-toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'simple-toast';
    toast.textContent = message;

    // Style based on type
    const colors = {
        success: '#22c55e',
        error: '#ef4444',
        info: '#d4af7a',
        warning: '#f59e0b'
    };

    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        padding: '12px 24px',
        background: colors[type] || colors.info,
        color: '#fff',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        zIndex: '10000',
        fontSize: '0.875em',
        fontWeight: '600',
        animation: 'slideIn 0.3s ease',
        maxWidth: '400px'
    });

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
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

// ============================================================================
// DEBUG UTILITIES
// ============================================================================

/**
 * Debug character profile data
 * Logs all available data sources for a character to help troubleshoot display issues
 * @param {string} characterName - Character name to debug
 */
window.debugCharacterProfile = function(characterName) {
    console.log(`\n=== 🔍 Debugging Character Profile: ${characterName} ===\n`);

    // Check window.masterContext (primary source)
    console.log('📦 Master Context (window.masterContext):');
    if (window.masterContext?.characters?.[characterName]) {
        console.log('✅ Found in window.masterContext');
        console.log(window.masterContext.characters[characterName]);
    } else {
        console.log('❌ Not found in window.masterContext');
        if (window.masterContext?.characters) {
            console.log('Available characters:', Object.keys(window.masterContext.characters));
        } else {
            console.log('window.masterContext not initialized or has no characters');
        }
    }

    // Check window.scriptMasterContext (secondary source)
    console.log('\n📦 Script Master Context (window.scriptMasterContext):');
    if (window.scriptMasterContext?.characters?.[characterName]) {
        console.log('✅ Found in window.scriptMasterContext');
        console.log(window.scriptMasterContext.characters[characterName]);
    } else {
        console.log('❌ Not found in window.scriptMasterContext');
        if (window.scriptMasterContext?.characters) {
            console.log('Available characters:', Object.keys(window.scriptMasterContext.characters));
        } else {
            console.log('window.scriptMasterContext not initialized');
        }
    }

    // Check Narrative Context (old analysis format)
    console.log('\n📊 Narrative Context (window.scriptNarrativeContext):');
    if (window.scriptNarrativeContext?.characters) {
        const char = window.scriptNarrativeContext.characters.find(c => c.name === characterName);
        if (char) {
            console.log('✅ Found in Narrative Context');
            console.log(char);
        } else {
            console.log('❌ Not found in Narrative Context');
            console.log('Available characters:', window.scriptNarrativeContext.characters.map(c => c.name));
        }
    } else {
        console.log('❌ Narrative Context not initialized');
    }

    // Check State
    console.log('\n💾 State Data:');
    console.log('Cast Profiles:', state?.castProfiles?.[characterName] || 'Not found');
    console.log('Character Looks:', state?.characterLooks?.[characterName] || 'Not found');
    console.log('Confirmed Characters:', state?.confirmedCharacters ? Array.from(state.confirmedCharacters) : 'Not set');

    // Check localStorage
    console.log('\n💿 LocalStorage:');
    const storedMaster = localStorage.getItem('masterContext') || localStorage.getItem('scriptMasterContext');
    if (storedMaster) {
        try {
            const parsed = JSON.parse(storedMaster);
            console.log('Master Context in localStorage:', parsed.characters?.[characterName] ? '✅ Found' : '❌ Not found');
            if (parsed.characters?.[characterName]) {
                console.log('Character data from localStorage:', parsed.characters[characterName]);
            }
        } catch (e) {
            console.log('Error parsing localStorage:', e);
        }
    } else {
        console.log('No Master Context in localStorage');
    }

    console.log('\n=== End Debug ===\n');

    return {
        masterContext: window.masterContext?.characters?.[characterName],
        scriptMasterContext: window.scriptMasterContext?.characters?.[characterName],
        narrativeContext: window.scriptNarrativeContext?.characters?.find(c => c.name === characterName),
        castProfile: state?.castProfiles?.[characterName],
        characterLooks: state?.characterLooks?.[characterName]
    };
};

// ============================================================================
// AUTO-DETECTED EVENT MANAGEMENT
// ============================================================================

// Initialize storage for dismissed auto-detected events
if (!state.dismissedAutoEvents) {
    state.dismissedAutoEvents = new Set();
    // Try to restore from localStorage
    try {
        const stored = localStorage.getItem('dismissedAutoEvents');
        if (stored) {
            state.dismissedAutoEvents = new Set(JSON.parse(stored));
        }
    } catch (e) {
        console.warn('Could not restore dismissed auto events:', e);
    }
}

/**
 * Save dismissed auto events to localStorage
 */
function saveDismissedAutoEvents() {
    try {
        localStorage.setItem('dismissedAutoEvents', JSON.stringify([...state.dismissedAutoEvents]));
    } catch (e) {
        console.warn('Could not save dismissed auto events:', e);
    }
}

/**
 * Confirm an auto-detected event and add it to the tracked continuity events
 * @param {string} characterName - Character name
 * @param {string} eventId - Auto-detected event ID
 */
window.confirmAutoEvent = async function(characterName, eventId) {
    console.log(`Confirming auto-detected event: ${eventId} for ${characterName}`);

    // Get the auto-detected event
    const autoEvents = getAutoDetectedEvents(characterName);
    const autoEvent = autoEvents.find(e => e.id === eventId);

    if (!autoEvent) {
        console.error('Auto-detected event not found:', eventId);
        showToast('Event not found', 'error');
        return;
    }

    // Initialize continuity events storage if needed
    if (!state.continuityEvents) {
        state.continuityEvents = {};
    }
    if (!state.continuityEvents[characterName]) {
        state.continuityEvents[characterName] = [];
    }

    // Create a confirmed event from the auto-detected one
    const confirmedEvent = {
        id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        character: characterName,
        type: autoEvent.type,
        category: autoEvent.category,
        description: autoEvent.description,
        startScene: autoEvent.startScene,
        endScene: autoEvent.endScene,
        source: 'confirmed',
        originalAutoId: eventId,
        progression: autoEvent.progression || [],
        visualNotes: autoEvent.visualNotes || '',
        confirmedAt: new Date().toISOString()
    };

    // Add to confirmed events
    state.continuityEvents[characterName].push(confirmedEvent);

    // Dismiss the auto-detected event so it doesn't show again
    state.dismissedAutoEvents.add(eventId);
    saveDismissedAutoEvents();

    // Save project
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Show success notification
    showToast(`Event confirmed and added to tracking for ${characterName}`, 'success');

    // Refresh the events view
    const contentId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-content`;
    const contentDiv = document.getElementById(contentId);
    if (contentDiv) {
        contentDiv.innerHTML = renderEventsView(characterName);
    }

    console.log('Confirmed event:', confirmedEvent);
};

/**
 * Set the end scene for an auto-detected or tracked event
 * @param {string} characterName - Character name
 * @param {string} eventId - Event ID
 */
window.setEventEndScene = async function(characterName, eventId) {
    console.log(`Setting end scene for event: ${eventId}`);

    // Get current scene index
    const currentSceneIndex = state.currentSceneIndex !== undefined ? state.currentSceneIndex : (state.currentScene || 0);
    const currentScene = state.scenes[currentSceneIndex];
    const sceneNumber = currentScene?.number || (currentSceneIndex + 1);

    // Check if it's a tracked event first
    if (state.continuityEvents?.[characterName]) {
        const trackedEvent = state.continuityEvents[characterName].find(e => e.id === eventId);
        if (trackedEvent) {
            trackedEvent.endScene = sceneNumber;
            const { saveProject } = await import('./export-handlers.js');
            saveProject();
            showToast(`Event end scene set to Scene ${sceneNumber}`, 'success');

            // Refresh the view
            const contentId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-content`;
            const contentDiv = document.getElementById(contentId);
            if (contentDiv) {
                contentDiv.innerHTML = renderEventsView(characterName);
            }
            return;
        }
    }

    // If it's an auto-detected event, confirm it first then set end scene
    const autoEvents = getAutoDetectedEvents(characterName);
    const autoEvent = autoEvents.find(e => e.id === eventId);

    if (autoEvent) {
        // Confirm the event first
        await window.confirmAutoEvent(characterName, eventId);

        // Then set the end scene on the newly confirmed event
        const confirmedEvents = state.continuityEvents?.[characterName] || [];
        const newlyConfirmed = confirmedEvents.find(e => e.originalAutoId === eventId);
        if (newlyConfirmed) {
            newlyConfirmed.endScene = sceneNumber;
            const { saveProject } = await import('./export-handlers.js');
            saveProject();
            showToast(`Event confirmed and end scene set to Scene ${sceneNumber}`, 'success');

            // Refresh the view
            const contentId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-content`;
            const contentDiv = document.getElementById(contentId);
            if (contentDiv) {
                contentDiv.innerHTML = renderEventsView(characterName);
            }
        }
        return;
    }

    showToast('Event not found', 'error');
};

/**
 * Dismiss an auto-detected event (mark as not relevant)
 * @param {string} characterName - Character name
 * @param {string} eventId - Auto-detected event ID
 */
window.dismissAutoEvent = function(characterName, eventId) {
    console.log(`Dismissing auto-detected event: ${eventId} for ${characterName}`);

    // Add to dismissed set
    state.dismissedAutoEvents.add(eventId);
    saveDismissedAutoEvents();

    showToast('Event dismissed', 'info');

    // Refresh the events view
    const contentId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-content`;
    const contentDiv = document.getElementById(contentId);
    if (contentDiv) {
        contentDiv.innerHTML = renderEventsView(characterName);
    }
};

/**
 * Clear all dismissed auto events (for testing/reset purposes)
 */
window.clearDismissedAutoEvents = function() {
    state.dismissedAutoEvents.clear();
    saveDismissedAutoEvents();
    showToast('Dismissed events cleared', 'info');
};

/**
 * Add a progression stage to a tracked event
 * @param {string} characterName - Character name
 * @param {string} eventId - Event ID
 * @param {number} sceneNumber - Scene number for this progression stage
 * @param {string} description - Description of progression at this point
 */
window.addEventProgression = async function(characterName, eventId, sceneNumber, description) {
    if (!state.continuityEvents?.[characterName]) {
        showToast('No tracked events for this character', 'error');
        return;
    }

    const event = state.continuityEvents[characterName].find(e => e.id === eventId);
    if (!event) {
        showToast('Event not found', 'error');
        return;
    }

    // Initialize progression array if needed
    if (!event.progression) {
        event.progression = [];
    }

    // Add progression stage
    event.progression.push({
        sceneNumber: sceneNumber,
        description: description,
        addedAt: new Date().toISOString()
    });

    // Sort by scene number
    event.progression.sort((a, b) => a.sceneNumber - b.sceneNumber);

    const { saveProject } = await import('./export-handlers.js');
    saveProject();
    showToast(`Progression stage added at Scene ${sceneNumber}`, 'success');

    // Refresh the view
    const contentId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-content`;
    const contentDiv = document.getElementById(contentId);
    if (contentDiv) {
        contentDiv.innerHTML = renderEventsView(characterName);
    }
};

/**
 * Delete a tracked continuity event
 * @param {string} characterName - Character name
 * @param {string} eventId - Event ID to delete
 */
window.deleteTrackedEvent = async function(characterName, eventId) {
    if (!state.continuityEvents?.[characterName]) {
        return;
    }

    const index = state.continuityEvents[characterName].findIndex(e => e.id === eventId);
    if (index !== -1) {
        state.continuityEvents[characterName].splice(index, 1);
        const { saveProject } = await import('./export-handlers.js');
        saveProject();
        showToast('Event deleted', 'info');

        // Refresh the view
        const contentId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-content`;
        const contentDiv = document.getElementById(contentId);
        if (contentDiv) {
            contentDiv.innerHTML = renderEventsView(characterName);
        }
    }
};
