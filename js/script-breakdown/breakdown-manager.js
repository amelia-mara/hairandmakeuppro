/**
 * breakdown-manager.js
 * Enhanced Scene Breakdown Manager with workflow integration
 *
 * Responsibilities:
 * - Manage scene breakdown workflow with character focus
 * - Provide quick-add functionality for continuity items
 * - Track character states and continuity across scenes
 * - Bi-directional sync with character profiles
 * - Real-time updates and data flow
 */

import { state } from './main.js';
import { renderBreakdownPanel } from './breakdown-form.js';

// ============================================================================
// SCENE BREAKDOWN MANAGER CLASS
// ============================================================================

/**
 * SceneBreakdownManager class
 * Manages scene breakdown workflow and character continuity tracking
 */
export class SceneBreakdownManager {
    constructor() {
        this.currentScene = null;
        this.focusCharacter = 'all';
        this.continuityStates = {};
        // Restore active panel from localStorage, default to 'continuity'
        this.activePanel = localStorage.getItem('breakdownActivePanel') || 'continuity';
    }

    /**
     * Load and render breakdown for a scene
     * @param {number} sceneIndex - Scene index
     */
    loadSceneBreakdown(sceneIndex) {
        this.currentScene = sceneIndex;
        const scene = state.scenes[sceneIndex];

        if (!scene) {
            console.error('Scene not found:', sceneIndex);
            return;
        }

        // Restore focus character for this scene (if previously set)
        const sceneKey = `breakdownFocusChar_scene${sceneIndex}`;
        const savedFocusChar = localStorage.getItem(sceneKey);
        if (savedFocusChar) {
            this.focusCharacter = savedFocusChar;
        } else {
            // Default to 'all' for new scenes
            this.focusCharacter = 'all';
        }

        // Get story position context
        const storyPosition = this.getStoryPosition(sceneIndex);

        // Load character states for this scene
        this.loadCharacterStates(sceneIndex, storyPosition);

        // Render the enhanced breakdown
        this.renderEnhancedBreakdown();
    }

    /**
     * Get story position context for a scene
     * @param {number} sceneIndex - Scene index
     * @returns {Object} Story position data
     */
    getStoryPosition(sceneIndex) {
        const scene = state.scenes[sceneIndex];
        const narrativeContext = window.scriptNarrativeContext;

        return {
            storyDay: scene.storyDay || 'Unassigned',
            timeOfDay: scene.timeOfDay || '',
            sceneNumber: scene.number,
            sceneHeading: scene.heading,
            narrativeImportance: this.getSceneNarrativeImportance(sceneIndex, narrativeContext)
        };
    }

    /**
     * Get narrative importance of scene from narrative context
     * @param {number} sceneIndex - Scene index
     * @param {Object} narrativeContext - Narrative context
     * @returns {number} Importance score (1-10)
     */
    getSceneNarrativeImportance(sceneIndex, narrativeContext) {
        if (!narrativeContext || !narrativeContext.storyStructure) return 5;

        // Check if scene is a turning point
        const turningPoints = narrativeContext.storyStructure.turningPoints || [];
        const isTurningPoint = turningPoints.some(tp =>
            tp.scenes && tp.scenes.includes(sceneIndex)
        );

        // Check if scene is part of climax
        const climax = narrativeContext.storyStructure.climax;
        const isClimax = climax && climax.scenes && climax.scenes.includes(sceneIndex);

        if (isClimax) return 10;
        if (isTurningPoint) return 9;
        return 5;
    }

    /**
     * Load character states for current scene
     * @param {number} sceneIndex - Scene index
     * @param {Object} storyPosition - Story position data
     */
    loadCharacterStates(sceneIndex, storyPosition) {
        const breakdown = state.sceneBreakdowns[sceneIndex] || {};
        let cast = breakdown.cast || [];

        // Auto-detect characters if none are explicitly set
        if (cast.length === 0) {
            cast = this.autoDetectSceneCharacters(sceneIndex);

            // Update breakdown with detected characters
            if (cast.length > 0 && !breakdown.cast) {
                if (!state.sceneBreakdowns[sceneIndex]) {
                    state.sceneBreakdowns[sceneIndex] = {};
                }
                state.sceneBreakdowns[sceneIndex].cast = cast;
            }
        }

        this.continuityStates = {};

        cast.forEach(character => {
            const charState = state.characterStates[sceneIndex]?.[character] || {};
            const lastAppearance = this.getLastAppearance(character, sceneIndex);
            const activeItems = this.getActiveItems(character, sceneIndex);

            this.continuityStates[character] = {
                character: character,
                currentState: charState,
                lastAppearance: lastAppearance,
                activeItems: activeItems,
                storyPosition: storyPosition
            };
        });
    }

    /**
     * Auto-detect characters from scene content
     * @param {number} sceneIndex - Scene index
     * @returns {Array} Detected character names
     */
    autoDetectSceneCharacters(sceneIndex) {
        const scene = state.scenes[sceneIndex];
        if (!scene || !scene.content) return [];

        const characters = new Set();
        const lines = scene.content.split('\n');

        // Method 1: Check confirmed characters from state
        if (state.characters && state.characters.size > 0) {
            const confirmedChars = Array.from(state.characters);

            confirmedChars.forEach(character => {
                const charPattern = new RegExp(`^\\s*${escapeRegex(character)}\\s*(?:\\(.*?\\))?\\s*$`, 'i');

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (charPattern.test(line) || line.toUpperCase() === character.toUpperCase()) {
                        characters.add(character);
                        break;
                    }
                }
            });
        }

        // Method 2: Direct pattern matching for character names (more aggressive)
        // Look for lines that are all caps and appear before dialogue
        for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();
            const nextLine = lines[i + 1]?.trim();

            // Skip empty lines
            if (!line) continue;

            // Character name pattern: all caps, not too long, not a scene heading
            if (line.length > 1 && line.length < 50 &&
                line === line.toUpperCase() &&
                !line.startsWith('INT') && !line.startsWith('EXT') &&
                !line.includes('CUT TO') && !line.includes('FADE') &&
                !line.includes('CONTINUOUS') &&
                nextLine && nextLine.length > 0) {

                // Clean the character name (remove parentheticals and extensions)
                let cleanName = line
                    .replace(/\s*\(.*?\)\s*/g, '') // Remove parentheticals
                    .replace(/\s*\(V\.O\.\)\s*/gi, '')
                    .replace(/\s*\(O\.S\.\)\s*/gi, '')
                    .replace(/\s*\(O\.C\.\)\s*/gi, '')
                    .replace(/\s*\(CONT'D\)\s*/gi, '')
                    .replace(/\s*\(CONT\.\)\s*/gi, '')
                    .trim();

                // Validate it looks like a character name (letters, spaces, dots, hyphens, apostrophes)
                if (cleanName.match(/^[A-Z][A-Z\s\.\-\']{1,35}$/)) {
                    // Normalize through CharacterManager if available
                    if (window.characterManager) {
                        cleanName = window.characterManager.addCharacter(cleanName);
                    }

                    if (cleanName) {
                        characters.add(cleanName);

                        // Also add to global state.characters if not present
                        if (state.characters && !state.characters.has(cleanName)) {
                            state.characters.add(cleanName);
                        }
                    }
                }
            }
        }

        // Method 3: Fallback - Check tags for this scene
        if (characters.size === 0) {
            const sceneTags = state.scriptTags?.[sceneIndex] || [];
            sceneTags.forEach(tag => {
                if (tag.character) {
                    characters.add(tag.character);
                }
            });
        }

        console.log(`Auto-detected ${characters.size} characters in scene ${sceneIndex}:`, Array.from(characters));
        return Array.from(characters);
    }

    /**
     * Get last appearance info for character
     * @param {string} character - Character name
     * @param {number} currentSceneIndex - Current scene index
     * @returns {Object|null} Last appearance data
     */
    getLastAppearance(character, currentSceneIndex) {
        for (let i = currentSceneIndex - 1; i >= 0; i--) {
            const breakdown = state.sceneBreakdowns[i] || {};
            if (breakdown.cast && breakdown.cast.includes(character)) {
                return {
                    sceneIndex: i,
                    sceneNumber: state.scenes[i].number,
                    storyDay: state.scenes[i].storyDay || 'Unassigned'
                };
            }
        }
        return null;
    }

    /**
     * Get active continuity items for character at this point in story
     * @param {string} character - Character name
     * @param {number} sceneIndex - Scene index
     * @returns {Array} Active items
     */
    getActiveItems(character, sceneIndex) {
        const items = [];
        const narrativeContext = window.scriptNarrativeContext;

        // Get injuries that are still healing
        if (narrativeContext?.elements?.injuries) {
            narrativeContext.elements.injuries
                .filter(inj => inj.character === character && inj.scene <= sceneIndex)
                .forEach(injury => {
                    const healingProgress = this.calculateHealingProgress(injury, sceneIndex);
                    if (healingProgress < 100) {
                        items.push({
                            type: 'injury',
                            category: 'injuries',
                            description: injury.type || injury.description,
                            scene: injury.scene,
                            healingProgress: healingProgress,
                            importance: injury.narrativeImportance || 8
                        });
                    }
                });
        }

        // Get recent appearance changes
        const recentScenes = Math.max(0, sceneIndex - 5);
        for (let i = recentScenes; i <= sceneIndex; i++) {
            const tags = state.scriptTags[i] || [];
            tags.forEach(tag => {
                if (tag.character === character && this.isAppearanceCategory(tag.category)) {
                    items.push({
                        type: tag.category,
                        category: tag.category,
                        description: tag.selectedText || tag.notes,
                        scene: i,
                        importance: tag.importance || 5
                    });
                }
            });
        }

        return items;
    }

    /**
     * Calculate healing progress for an injury
     * @param {Object} injury - Injury object
     * @param {number} currentSceneIndex - Current scene index
     * @returns {number} Healing percentage (0-100)
     */
    calculateHealingProgress(injury, currentSceneIndex) {
        const injuryScene = injury.scene;
        const scenesSince = currentSceneIndex - injuryScene;

        // Simple healing model: 10% per scene, capped at 100%
        const healingDays = injury.healingDays || 7;
        const progressPerScene = 100 / healingDays;

        return Math.min(100, scenesSince * progressPerScene);
    }

    /**
     * Check if category is appearance-related
     * @param {string} category - Category name
     * @returns {boolean} True if appearance-related
     */
    isAppearanceCategory(category) {
        const appearanceCategories = ['hair', 'makeup', 'sfx', 'wardrobe', 'injuries', 'health'];
        return appearanceCategories.includes(category);
    }

    /**
     * Render scene alerts and conditions
     * @returns {string} HTML string
     */
    renderSceneAlerts() {
        if (this.currentScene === null) return '';

        const scene = state.scenes[this.currentScene];
        const alerts = [];

        // Check for continuous from previous scene
        if (this.currentScene > 0) {
            const prevScene = state.scenes[this.currentScene - 1];
            if (prevScene?.heading?.toUpperCase().includes('CONTINUOUS')) {
                alerts.push({
                    type: 'continuous',
                    icon: '🔄',
                    text: 'CONTINUOUS from previous scene'
                });
            }
        }

        // Check for weather in heading
        const heading = scene.heading?.toUpperCase() || '';
        if (heading.includes('RAIN')) {
            alerts.push({
                type: 'weather',
                icon: '🌧️',
                text: 'Rain scene - waterproof makeup needed'
            });
        }
        if (heading.includes('SNOW')) {
            alerts.push({
                type: 'weather',
                icon: '❄️',
                text: 'Snow scene - cold weather considerations'
            });
        }

        // Check for time of day
        if (heading.includes('NIGHT')) {
            alerts.push({
                type: 'time',
                icon: '🌙',
                text: 'Night scene - consider lighting for continuity'
            });
        }
        if (heading.includes('DAWN') || heading.includes('DUSK')) {
            alerts.push({
                type: 'time',
                icon: '🌅',
                text: 'Transition lighting - monitor continuity closely'
            });
        }

        // Check for tagged elements (stunts, action)
        const sceneTags = state.scriptTags[this.currentScene] || [];
        const hasStunt = sceneTags.some(t => t.category === 'stunts');
        if (hasStunt) {
            alerts.push({
                type: 'action',
                icon: '🎬',
                text: 'Action/stunt sequence - prepare for touch-ups'
            });
        }

        // Check for injuries
        const hasInjury = sceneTags.some(t => t.category === 'injuries');
        if (hasInjury) {
            alerts.push({
                type: 'injury',
                icon: '🩹',
                text: 'Injuries in scene - SFX required'
            });
        }

        // Check for special effects
        const hasSFX = sceneTags.some(t => t.category === 'sfx');
        if (hasSFX) {
            alerts.push({
                type: 'sfx',
                icon: '🎭',
                text: 'Special effects makeup required'
            });
        }

        if (alerts.length === 0) return '';

        return `
            <div class="alerts-section">
                ${alerts.map(alert => `
                    <div class="alert-item ${alert.type}">
                        <span class="alert-icon">${alert.icon}</span>
                        <span class="alert-text">${alert.text}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render enhanced breakdown panel
     */
    renderEnhancedBreakdown() {
        const container = document.getElementById('breakdown-panel');
        if (!container) return;

        if (this.currentScene === null) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-title">Select a Scene</div>
                    <div class="empty-desc">Choose a scene to view and edit its breakdown</div>
                </div>
            `;
            return;
        }

        const scene = state.scenes[this.currentScene];
        const breakdown = state.sceneBreakdowns[this.currentScene] || {};
        const cast = breakdown.cast || [];

        let html = `
            <!-- Workspace Header with Scene Context -->
            <div class="workspace-header-enhanced">
                <div class="workspace-title">SCENE BREAKDOWN</div>
                <div class="scene-context">
                    Scene <span class="scene-num-highlight">${scene.number}</span>
                    ${scene.storyDay ? `| <span class="story-day-label">${escapeHtml(scene.storyDay)}</span>` : ''}
                    ${scene.timeOfDay ? `- <span class="time-label">${escapeHtml(scene.timeOfDay)}</span>` : ''}
                </div>
            </div>

            <!-- Scene Alerts -->
            ${this.renderSceneAlerts()}

            <!-- Character Quick Select -->
            ${this.renderCharacterQuickSelect(cast)}

            <!-- Breakdown Tabs -->
            ${this.renderBreakdownTabs()}

            <!-- Tab Content -->
            <div class="breakdown-tab-content">
                ${this.activePanel === 'continuity' ? this.renderContinuityPanel() : ''}
                ${this.activePanel === 'tags' ? this.renderTagsPanel() : ''}
                ${this.activePanel === 'classic' ? this.renderClassicPanel() : ''}
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * Render character quick select dropdown
     * @param {Array} cast - Cast members in scene
     * @returns {string} HTML string
     */
    renderCharacterQuickSelect(cast) {
        if (cast.length === 0) {
            return `
                <div class="character-quick-select">
                    <div class="no-cast-notice">No cast members in this scene yet</div>
                </div>
            `;
        }

        return `
            <div class="character-quick-select">
                <label class="quick-select-label">Focus Character:</label>
                <select id="focus-character" class="focus-character-select" onchange="window.breakdownManager.updateFocusCharacter(this.value)">
                    <option value="all" ${this.focusCharacter === 'all' ? 'selected' : ''}>All Characters</option>
                    ${cast.map(char => `
                        <option value="${escapeHtml(char)}" ${this.focusCharacter === char ? 'selected' : ''}>
                            ${escapeHtml(char)}
                        </option>
                    `).join('')}
                </select>
                ${this.focusCharacter !== 'all' ? `
                    <button class="quick-profile-btn" onclick="window.breakdownManager.jumpToCharacterProfile()">
                        View Profile →
                    </button>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render breakdown tabs
     * @returns {string} HTML string
     */
    renderBreakdownTabs() {
        return `
            <div class="breakdown-tabs">
                <div class="breakdown-tab ${this.activePanel === 'continuity' ? 'active' : ''}"
                     onclick="window.breakdownManager.switchPanel('continuity')">
                    Continuity
                </div>
                <div class="breakdown-tab ${this.activePanel === 'tags' ? 'active' : ''}"
                     onclick="window.breakdownManager.switchPanel('tags')">
                    Tags
                </div>
                <div class="breakdown-tab ${this.activePanel === 'classic' ? 'active' : ''}"
                     onclick="window.breakdownManager.switchPanel('classic')">
                    Classic View
                </div>
            </div>
        `;
    }

    /**
     * Render continuity panel with character state cards
     * @returns {string} HTML string
     */
    renderContinuityPanel() {
        const characters = this.focusCharacter === 'all'
            ? Object.keys(this.continuityStates)
            : [this.focusCharacter];

        return `
            <div class="continuity-panel-content">
                <!-- Character State Cards -->
                <div class="character-states-container">
                    ${characters.map(char => this.renderCharacterStateCard(char)).join('')}
                </div>

                <!-- Quick Add Section -->
                ${this.renderQuickAddSection()}
            </div>
        `;
    }

    /**
     * Render character state card
     * @param {string} character - Character name
     * @returns {string} HTML string
     */
    renderCharacterStateCard(character) {
        const charState = this.continuityStates[character];
        if (!charState) return '';

        const breakdown = state.sceneBreakdowns[this.currentScene] || {};
        const charData = breakdown.characterStates?.[character] || {};
        const prevState = this.getPreviousCharacterState(character, this.currentScene);

        const lastSeen = charState.lastAppearance
            ? `Scene ${charState.lastAppearance.sceneNumber}`
            : 'First appearance';

        return `
            <div class="character-block" data-character="${escapeHtml(character)}">
                <!-- Character Header -->
                <div class="character-header">
                    <h3 class="character-name">${escapeHtml(character)}</h3>
                    <div class="character-actions">
                        <button class="icon-btn" onclick="window.breakdownManager.copyFromLastScene('${escapeHtml(character).replace(/'/g, "\\'")}')">
                            <span title="Copy from previous scene">↓</span>
                        </button>
                        <button class="icon-btn" onclick="window.breakdownManager.viewCharacterTimeline('${escapeHtml(character).replace(/'/g, "\\'")}')">
                            <span title="View timeline">⏱</span>
                        </button>
                    </div>
                </div>

                <!-- Enters With -->
                <div class="continuity-row">
                    <label class="field-label">Enters with:</label>
                    <div class="field-grid">
                        <div class="field-item">
                            <input
                                type="text"
                                class="continuity-input"
                                placeholder="Hair"
                                value="${escapeHtml(charData.entersHair || '')}"
                                onchange="window.breakdownManager.updateCharacterField('${escapeHtml(character).replace(/'/g, "\\'")}', 'entersHair', this.value)"
                            />
                        </div>
                        <div class="field-item">
                            <input
                                type="text"
                                class="continuity-input"
                                placeholder="Makeup"
                                value="${escapeHtml(charData.entersMakeup || '')}"
                                onchange="window.breakdownManager.updateCharacterField('${escapeHtml(character).replace(/'/g, "\\'")}', 'entersMakeup', this.value)"
                            />
                        </div>
                        <div class="field-item">
                            <input
                                type="text"
                                class="continuity-input"
                                placeholder="Wardrobe"
                                value="${escapeHtml(charData.entersWardrobe || '')}"
                                onchange="window.breakdownManager.updateCharacterField('${escapeHtml(character).replace(/'/g, "\\'")}', 'entersWardrobe', this.value)"
                            />
                        </div>
                    </div>
                </div>

                <!-- Changes During Scene -->
                <div class="continuity-row">
                    <label class="field-label">Changes during scene:</label>
                    <textarea
                        class="continuity-textarea"
                        placeholder="Describe any changes to appearance during this scene..."
                        onchange="window.breakdownManager.updateCharacterField('${escapeHtml(character).replace(/'/g, "\\'")}', 'changes', this.value)"
                    >${escapeHtml(charData.changes || '')}</textarea>
                </div>

                <!-- Exits With -->
                <div class="continuity-row">
                    <label class="field-label">Exits with:</label>
                    <div class="field-grid">
                        <div class="field-item">
                            <input
                                type="text"
                                class="continuity-input"
                                placeholder="Hair"
                                value="${escapeHtml(charData.exitsHair || '')}"
                                onchange="window.breakdownManager.updateCharacterField('${escapeHtml(character).replace(/'/g, "\\'")}', 'exitsHair', this.value)"
                            />
                        </div>
                        <div class="field-item">
                            <input
                                type="text"
                                class="continuity-input"
                                placeholder="Makeup"
                                value="${escapeHtml(charData.exitsMakeup || '')}"
                                onchange="window.breakdownManager.updateCharacterField('${escapeHtml(character).replace(/'/g, "\\'")}', 'exitsMakeup', this.value)"
                            />
                        </div>
                        <div class="field-item">
                            <input
                                type="text"
                                class="continuity-input"
                                placeholder="Wardrobe"
                                value="${escapeHtml(charData.exitsWardrobe || '')}"
                                onchange="window.breakdownManager.updateCharacterField('${escapeHtml(character).replace(/'/g, "\\'")}', 'exitsWardrobe', this.value)"
                            />
                        </div>
                    </div>
                </div>

                <!-- Active Items Summary -->
                ${charState.activeItems.length > 0 ? `
                    <div class="continuity-row">
                        <label class="field-label">Active Continuity Items:</label>
                        <div class="active-items-compact">
                            ${charState.activeItems.map(item => `
                                <div class="active-item-tag ${item.category}">
                                    ${this.getCategoryIcon(item.category)} ${escapeHtml(item.description)}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Get previous character state for reference
     * @param {string} character - Character name
     * @param {number} currentSceneIndex - Current scene index
     * @returns {Object|null} Previous state or null
     */
    getPreviousCharacterState(character, currentSceneIndex) {
        for (let i = currentSceneIndex - 1; i >= 0; i--) {
            const breakdown = state.sceneBreakdowns[i] || {};
            if (breakdown.characterStates?.[character]) {
                return breakdown.characterStates[character];
            }
        }
        return null;
    }

    /**
     * Update character field
     * @param {string} character - Character name
     * @param {string} field - Field name
     * @param {string} value - Field value
     */
    async updateCharacterField(character, field, value) {
        if (this.currentScene === null) return;

        // Initialize structure if needed
        if (!state.sceneBreakdowns[this.currentScene]) {
            state.sceneBreakdowns[this.currentScene] = {};
        }
        if (!state.sceneBreakdowns[this.currentScene].characterStates) {
            state.sceneBreakdowns[this.currentScene].characterStates = {};
        }
        if (!state.sceneBreakdowns[this.currentScene].characterStates[character]) {
            state.sceneBreakdowns[this.currentScene].characterStates[character] = {};
        }

        // Update field
        state.sceneBreakdowns[this.currentScene].characterStates[character][field] = value;

        // Save project
        try {
            const { saveProject } = await import('./export-handlers.js');
            saveProject();
        } catch (error) {
            console.error('Error saving project:', error);
        }
    }

    /**
     * Render current state summary for character
     * @param {string} character - Character name
     * @param {Object} state - Character state
     * @returns {string} HTML string
     */
    renderCurrentStateSummary(character, state) {
        const currentState = state.currentState;
        const items = [];

        if (currentState.hair) {
            items.push({ category: 'hair', description: currentState.hair });
        }
        if (currentState.makeup) {
            items.push({ category: 'makeup', description: currentState.makeup });
        }
        if (currentState.sfx) {
            items.push({ category: 'sfx', description: currentState.sfx });
        }
        if (currentState.wardrobe) {
            items.push({ category: 'wardrobe', description: currentState.wardrobe });
        }

        if (items.length === 0) {
            return '<em class="no-state-data">No continuity data yet</em>';
        }

        return items.map(item => `
            <div class="state-item ${item.category}">
                <span class="state-item-icon">${this.getCategoryIcon(item.category)}</span>
                <span class="state-item-desc">${escapeHtml(item.description)}</span>
            </div>
        `).join('');
    }

    /**
     * Render active continuity item
     * @param {string} character - Character name
     * @param {Object} item - Continuity item
     * @returns {string} HTML string
     */
    renderActiveItem(character, item) {
        return `
            <div class="continuity-item ${item.category}" data-importance="${item.importance}">
                <div class="item-content">
                    <span class="item-icon">${this.getCategoryIcon(item.category)}</span>
                    <div class="item-details">
                        <div class="item-description">${escapeHtml(item.description)}</div>
                        <div class="item-meta">Scene ${state.scenes[item.scene]?.number || item.scene}</div>
                    </div>
                </div>
                ${item.healingProgress !== undefined ? `
                    <div class="progression-bar">
                        <div class="progression-fill" style="width: ${item.healingProgress}%"></div>
                    </div>
                    <div class="progression-label">${Math.round(item.healingProgress)}% healed</div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render quick add section
     * @returns {string} HTML string
     */
    renderQuickAddSection() {
        return `
            <div class="quick-add-section">
                <h4 class="quick-add-title">Quick Add Continuity</h4>
                <div class="quick-add-grid">
                    <button class="quick-add-btn" onclick="window.breakdownManager.quickAdd('injury')">
                        <span class="quick-add-icon">🩹</span>
                        <span class="quick-add-label">Injury</span>
                    </button>
                    <button class="quick-add-btn" onclick="window.breakdownManager.quickAdd('hair')">
                        <span class="quick-add-icon">✂️</span>
                        <span class="quick-add-label">Hair Change</span>
                    </button>
                    <button class="quick-add-btn" onclick="window.breakdownManager.quickAdd('makeup')">
                        <span class="quick-add-icon">💄</span>
                        <span class="quick-add-label">Makeup</span>
                    </button>
                    <button class="quick-add-btn" onclick="window.breakdownManager.quickAdd('wardrobe')">
                        <span class="quick-add-icon">👔</span>
                        <span class="quick-add-label">Wardrobe</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render tags panel
     * @returns {string} HTML string
     */
    renderTagsPanel() {
        const sceneTags = state.scriptTags[this.currentScene] || [];

        if (sceneTags.length === 0) {
            return `
                <div class="empty-panel-state">
                    <div class="empty-icon">🏷️</div>
                    <div class="empty-text">No tags in this scene yet</div>
                </div>
            `;
        }

        // Group tags by character
        const tagsByCharacter = {};
        sceneTags.forEach(tag => {
            const char = tag.character || 'General';
            if (!tagsByCharacter[char]) tagsByCharacter[char] = [];
            tagsByCharacter[char].push(tag);
        });

        return `
            <div class="tags-panel-content">
                ${Object.entries(tagsByCharacter).map(([char, tags]) => `
                    <div class="tags-group">
                        <h4 class="tags-group-header">${escapeHtml(char)}</h4>
                        <div class="tags-list">
                            ${tags.map(tag => `
                                <div class="tag-item ${tag.category}">
                                    <span class="tag-icon">${this.getCategoryIcon(tag.category)}</span>
                                    <span class="tag-text">${escapeHtml(tag.selectedText || tag.notes || 'No description')}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render classic panel (fallback to original breakdown view)
     * @returns {string} HTML string
     */
    renderClassicPanel() {
        return '<div id="classic-breakdown-container"></div>';
    }

    /**
     * Get icon for category
     * @param {string} category - Category name
     * @returns {string} Emoji icon
     */
    getCategoryIcon(category) {
        const icons = {
            'injury': '🩹',
            'injuries': '🩹',
            'hair': '✂️',
            'makeup': '💄',
            'wardrobe': '👔',
            'health': '🏥',
            'sfx': '🎭',
            'stunts': '🎬',
            'weather': '🌤️',
            'extras': '👥'
        };
        return icons[category] || '●';
    }

    /**
     * Update focus character
     * @param {string} character - Character name or 'all'
     */
    updateFocusCharacter(character) {
        this.focusCharacter = character;
        // Persist focus character choice (per scene basis)
        if (this.currentScene !== null) {
            const sceneKey = `breakdownFocusChar_scene${this.currentScene}`;
            localStorage.setItem(sceneKey, character);
        }
        this.renderEnhancedBreakdown();
    }

    /**
     * Switch active panel
     * @param {string} panel - Panel name
     */
    switchPanel(panel) {
        const previousPanel = this.activePanel;
        this.activePanel = panel;
        // Persist active panel choice
        localStorage.setItem('breakdownActivePanel', panel);

        if (panel === 'classic') {
            // Switching TO classic view
            this.renderEnhancedBreakdown();
            setTimeout(() => {
                const container = document.getElementById('classic-breakdown-container');
                if (container) {
                    // Clear any existing content
                    container.innerHTML = '';

                    // Create temporary div for classic breakdown
                    const tempDiv = document.createElement('div');
                    tempDiv.id = 'temp-breakdown-panel';
                    container.appendChild(tempDiv);

                    // Temporarily swap the breakdown panel ID
                    const originalContainer = document.getElementById('breakdown-panel');
                    if (originalContainer) {
                        originalContainer.id = 'enhanced-breakdown-panel-saved';
                        tempDiv.id = 'breakdown-panel';

                        // Render classic view
                        renderBreakdownPanel();
                    }
                }
            }, 0);
        } else {
            // Switching AWAY from classic or between enhanced tabs
            if (previousPanel === 'classic') {
                // Restore the original breakdown panel
                const savedContainer = document.getElementById('enhanced-breakdown-panel-saved');
                if (savedContainer) {
                    savedContainer.id = 'breakdown-panel';
                }

                // Remove temp classic container content
                const classicContainer = document.getElementById('classic-breakdown-container');
                if (classicContainer) {
                    classicContainer.innerHTML = '';
                }
            }

            // Re-render enhanced breakdown
            this.renderEnhancedBreakdown();
        }
    }

    /**
     * Jump to character profile tab
     */
    jumpToCharacterProfile() {
        if (this.focusCharacter === 'all') return;

        const charId = `character-${this.focusCharacter.toLowerCase().replace(/\s+/g, '-')}`;
        if (typeof window.switchCenterTab === 'function') {
            window.switchCenterTab(charId);
        }
    }

    /**
     * View character timeline
     * @param {string} character - Character name
     */
    viewCharacterTimeline(character) {
        const charId = `character-${character.toLowerCase().replace(/\s+/g, '-')}`;
        if (typeof window.switchCenterTab === 'function') {
            window.switchCenterTab(charId);
        }
    }

    /**
     * Quick add continuity item
     * @param {string} category - Category type
     */
    quickAdd(category) {
        const character = this.focusCharacter;

        if (character === 'all') {
            showToast('Please select a specific character first', 'warning');
            return;
        }

        // Show inline quick add form
        this.showQuickAddForm(category, character);
    }

    /**
     * Show quick add form
     * @param {string} category - Category type
     * @param {string} character - Character name
     */
    showQuickAddForm(category, character) {
        const formHtml = `
            <div class="quick-add-form-overlay" onclick="window.breakdownManager.cancelQuickAdd()">
                <div class="quick-add-form" onclick="event.stopPropagation()">
                    <h4 class="form-title">Add ${category} for ${escapeHtml(character)}</h4>
                    <input type="text"
                           id="quick-desc"
                           class="quick-input"
                           placeholder="Description..."
                           onkeyup="if(event.key==='Enter') window.breakdownManager.saveQuickAdd('${category}', '${escapeHtml(character).replace(/'/g, "\\'")}')">
                    ${category === 'injury' ? `
                        <select id="injury-severity" class="quick-select">
                            <option value="minor">Minor</option>
                            <option value="moderate">Moderate</option>
                            <option value="severe">Severe</option>
                        </select>
                        <input type="number"
                               id="healing-days"
                               class="quick-input"
                               placeholder="Healing days"
                               value="7">
                    ` : ''}
                    <div class="form-actions">
                        <button class="form-btn primary" onclick="window.breakdownManager.saveQuickAdd('${category}', '${escapeHtml(character).replace(/'/g, "\\'")}')">
                            Add
                        </button>
                        <button class="form-btn" onclick="window.breakdownManager.cancelQuickAdd()">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', formHtml);
        document.getElementById('quick-desc')?.focus();
    }

    /**
     * Save quick add item
     * @param {string} category - Category type
     * @param {string} character - Character name
     */
    async saveQuickAdd(category, character) {
        const descInput = document.getElementById('quick-desc');
        const description = descInput?.value.trim();

        if (!description) {
            showToast('Please enter a description', 'warning');
            return;
        }

        // Create tag in current scene
        const tag = {
            id: generateId(),
            category: category,
            character: character,
            selectedText: description,
            notes: '',
            sceneIndex: this.currentScene,
            timestamp: Date.now()
        };

        // Handle injury-specific data
        if (category === 'injury') {
            const severityInput = document.getElementById('injury-severity');
            const healingInput = document.getElementById('healing-days');

            tag.severity = severityInput?.value || 'moderate';
            tag.healingDays = parseInt(healingInput?.value) || 7;
        }

        // Add to scriptTags
        if (!state.scriptTags[this.currentScene]) {
            state.scriptTags[this.currentScene] = [];
        }
        state.scriptTags[this.currentScene].push(tag);

        // Update character state in breakdown
        if (!state.characterStates[this.currentScene]) {
            state.characterStates[this.currentScene] = {};
        }
        if (!state.characterStates[this.currentScene][character]) {
            state.characterStates[this.currentScene][character] = {};
        }

        // Add to appropriate field
        if (!state.characterStates[this.currentScene][character][category]) {
            state.characterStates[this.currentScene][character][category] = description;
        }

        // Save project
        try {
            const { saveProject } = await import('./export-handlers.js');
            saveProject();
        } catch (error) {
            console.error('Error saving project:', error);
        }

        // Update character timeline
        this.updateCharacterTimelineFromTag(character, tag);

        // Close form and refresh
        this.cancelQuickAdd();
        this.loadSceneBreakdown(this.currentScene);

        // Show confirmation
        showToast(`Added ${category} for ${character}`, 'success');

        // Dispatch event for other components
        document.dispatchEvent(new CustomEvent('tagCreated', {
            detail: { character, category, text: description, sceneId: this.currentScene, tag }
        }));
    }

    /**
     * Update character timeline from tag
     * @param {string} character - Character name
     * @param {Object} tag - Tag object
     */
    updateCharacterTimelineFromTag(character, tag) {
        // This will be picked up by the character profile when it re-renders
        // The profile already watches scriptTags, so no additional work needed
        console.log(`Timeline update queued for ${character}:`, tag);
    }

    /**
     * Cancel quick add form
     */
    cancelQuickAdd() {
        const overlay = document.querySelector('.quick-add-form-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    /**
     * Add continuity item (full modal)
     * @param {string} character - Character name
     */
    addContinuityItem(character) {
        // Open the full continuity modal
        if (typeof window.openContinuityEditModal === 'function') {
            window.openContinuityEditModal(this.currentScene, character);
        }
    }

    /**
     * Copy from last scene
     * @param {string} character - Character name
     */
    async copyFromLastScene(character) {
        const state = this.continuityStates[character];
        if (!state || !state.lastAppearance) return;

        const lastSceneIndex = state.lastAppearance.sceneIndex;
        const lastState = window.state.characterStates[lastSceneIndex]?.[character];

        if (!lastState) {
            showToast('No data to copy from previous scene', 'warning');
            return;
        }

        // Copy to current scene
        if (!window.state.characterStates[this.currentScene]) {
            window.state.characterStates[this.currentScene] = {};
        }
        window.state.characterStates[this.currentScene][character] = { ...lastState };

        // Save
        try {
            const { saveProject } = await import('./export-handlers.js');
            saveProject();
        } catch (error) {
            console.error('Error saving project:', error);
        }

        // Refresh
        this.loadSceneBreakdown(this.currentScene);
        showToast(`Copied data from Scene ${state.lastAppearance.sceneNumber}`, 'success');
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Escape HTML
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Escape regex special characters
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate unique ID
 * @returns {string} Unique ID
 */
function generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
        background: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
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

// ============================================================================
// INITIALIZE GLOBAL INSTANCE
// ============================================================================

// Create global breakdown manager instance
window.breakdownManager = new SceneBreakdownManager();

// Export for module use
export default window.breakdownManager;
