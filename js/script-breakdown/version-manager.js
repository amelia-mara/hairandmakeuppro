/**
 * version-manager.js
 * Script Version Management System
 *
 * Manages multiple script versions, allowing users to:
 * - Upload new script versions without losing breakdown data
 * - Switch between versions
 * - Compare versions
 * - Copy scenes between versions
 * - Track inheritance and changes
 */

// LAZY IMPORTS to avoid circular dependency with main.js
// These are loaded dynamically when needed
let _stateModule = null;
let _renderSceneList = null;
let _renderScript = null;
let _renderCharacterTabs = null;
let _renderCharacterTabPanels = null;
let _detectScenes = null;
let _saveProject = null;

// Lazy getter for state to avoid circular dependency
// Uses window.state as fallback since main.js sets it globally
function getState() {
    // First check if we have a cached module reference
    if (_stateModule) {
        return _stateModule;
    }
    // Fall back to window.state which is set by main.js after initialization
    // This is safe because version functions are only called after init
    if (typeof window !== 'undefined' && window.state) {
        _stateModule = window.state;
        return _stateModule;
    }
    // Last resort - try to get from imported module
    // But this may be null during initial load
    return null;
}

// Set state reference - called from main.js after state is ready
export function setStateReference(state) {
    _stateModule = state;
}

// Lazy loader for render functions
async function loadRenderFunctions() {
    if (!_renderSceneList) {
        const sceneListModule = await import('./scene-list.js');
        _renderSceneList = sceneListModule.renderSceneList;
    }
    if (!_renderScript) {
        const scriptDisplayModule = await import('./script-display.js');
        _renderScript = scriptDisplayModule.renderScript;
    }
    if (!_renderCharacterTabs || !_renderCharacterTabPanels) {
        const charPanelModule = await import('./character-panel.js');
        _renderCharacterTabs = charPanelModule.renderCharacterTabs;
        _renderCharacterTabPanels = charPanelModule.renderCharacterTabPanels;
    }
}

// Lazy loader for export handlers
async function loadExportHandlers() {
    if (!_detectScenes || !_saveProject) {
        const exportModule = await import('./export-handlers.js');
        _detectScenes = exportModule.detectScenes;
        _saveProject = exportModule.saveProject;
    }
}

// ============================================================================
// VERSION COLOR PRESETS
// ============================================================================

export const VERSION_COLORS = {
    'White': '#FFFFFF',
    'Blue': '#ADD8E6',
    'Pink': '#FFC0CB',
    'Yellow': '#FFFF00',
    'Green': '#90EE90',
    'Goldenrod': '#DAA520',
    'Buff': '#F0DC82',
    'Salmon': '#FA8072',
    'Cherry': '#DE3163',
    'Tan': '#D2B48C',
    'Gray': '#808080',
    'Ivory': '#FFFFF0'
};

// ============================================================================
// VERSION STATE MANAGEMENT
// ============================================================================

/**
 * Initialize version management in state
 * Call this on app initialization
 */
export function initVersionManagement() {
    const state = getState();
    // Initialize versions array if not present
    if (!state.currentProject) {
        state.currentProject = {
            id: generateProjectId(),
            name: 'Untitled Project',
            created: Date.now()
        };
    }

    if (!state.currentProject.script_versions) {
        state.currentProject.script_versions = [];
    }

    if (!state.currentProject.current_version_id) {
        state.currentProject.current_version_id = null;
    }

    console.log('Version management initialized');
}

/**
 * Generate unique project ID
 */
function generateProjectId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Generate version ID from name and date
 */
function generateVersionId(versionName, date = new Date()) {
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '-');
    return `${versionName.toLowerCase()}_${dateStr}`;
}

/**
 * Get all versions for current project
 */
export function getAllVersions() {
    const state = getState();
    return state.currentProject?.script_versions || [];
}

/**
 * Get current active version
 */
export function getCurrentVersion() {
    const state = getState();
    const versions = getAllVersions();
    const currentId = state.currentProject?.current_version_id;

    if (!currentId) {
        return versions.find(v => v.is_current) || versions[0] || null;
    }

    return versions.find(v => v.version_id === currentId) || null;
}

/**
 * Get version by ID
 */
export function getVersionById(versionId) {
    return getAllVersions().find(v => v.version_id === versionId) || null;
}

/**
 * Check if a version name already exists
 */
export function versionNameExists(versionName) {
    return getAllVersions().some(v =>
        v.version_name.toLowerCase() === versionName.toLowerCase()
    );
}

// ============================================================================
// VERSION CREATION
// ============================================================================

/**
 * Create a new script version from uploaded/pasted script
 * @param {Object} options - Version creation options
 * @returns {Object} The created version object
 */
export function createNewVersion(options) {
    const state = getState();
    const {
        versionName,
        versionColor,
        scriptContent,
        scenes,
        characters,
        masterContext,
        notes = '',
        inheritFromVersionId = null
    } = options;

    const now = new Date();
    const versionId = generateVersionId(versionName, now);

    // Check for duplicate version name
    if (versionNameExists(versionName)) {
        // Append number to make unique
        let counter = 2;
        let uniqueName = `${versionName} ${counter}`;
        while (versionNameExists(uniqueName)) {
            counter++;
            uniqueName = `${versionName} ${counter}`;
        }
        options.versionName = uniqueName;
    }

    // Create version object
    const newVersion = {
        version_id: versionId,
        version_name: versionName,
        version_color: versionColor || VERSION_COLORS[versionName] || '#FFFFFF',
        upload_date: now.toISOString(),
        is_current: false,

        // Script file reference (for future file storage)
        script_file: {
            filename: `${state.currentProject?.name || 'Project'}_${versionName}_${now.toISOString().split('T')[0]}.txt`,
            content_length: scriptContent.length
        },

        // Store complete script content
        script_content: scriptContent,

        // Scene data
        scenes: scenes.map(scene => ({
            scene_number: scene.number?.toString() || scene.scene_number,
            setting: scene.intExt || scene.setting || '',
            location: scene.location || extractLocation(scene.heading),
            time_of_day: scene.timeOfDay || scene.time_of_day || '',
            story_day: scene.storyDay || scene.story_day || null,
            heading: scene.heading || '',
            full_text: scene.content || scene.full_text || '',
            synopsis: scene.synopsis || '',
            characters_present: scene.castMembers || scene.characters_present || []
        })),

        // Breakdowns - will be populated from inheritance or empty
        breakdowns: {},

        // Character data
        characters: characters || [],

        // Master context snapshot
        master_context: masterContext || null,

        // Metadata
        metadata: {
            total_scenes: scenes.length,
            breakdown_completion: 0,
            scenes_with_breakdown: 0,
            notes: notes,
            inherited_from: inheritFromVersionId,
            changes_from_previous: null,
            created_at: now.toISOString(),
            last_modified: now.toISOString()
        }
    };

    // If inheriting from previous version, copy breakdowns
    if (inheritFromVersionId) {
        const parentVersion = getVersionById(inheritFromVersionId);
        if (parentVersion) {
            const comparison = compareVersions(parentVersion, newVersion);
            newVersion.breakdowns = inheritBreakdowns(parentVersion, newVersion, comparison);
            newVersion.metadata.changes_from_previous = {
                scenes_changed: comparison.changed.map(c => c.scene_number),
                scenes_added: comparison.added,
                scenes_deleted: comparison.deleted,
                breakdown_updates_required: comparison.changed.map(c => c.scene_number)
            };

            // Update completion stats
            const breakdownCount = Object.keys(newVersion.breakdowns).length;
            newVersion.metadata.scenes_with_breakdown = breakdownCount;
            newVersion.metadata.breakdown_completion = Math.round(
                (breakdownCount / newVersion.scenes.length) * 100
            );
        }
    }

    // Add to versions array
    state.currentProject.script_versions.push(newVersion);

    console.log(`Created new version: ${versionId}`);
    return newVersion;
}

/**
 * Extract location from scene heading
 */
function extractLocation(heading) {
    if (!heading) return '';
    // Remove INT./EXT. and time of day
    const cleaned = heading
        .replace(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s*/i, '')
        .replace(/\s*-\s*(DAY|NIGHT|MORNING|EVENING|DAWN|DUSK|LATER|CONTINUOUS|SAME).*$/i, '')
        .trim();
    return cleaned;
}

// ============================================================================
// VERSION COMPARISON
// ============================================================================

/**
 * Compare two versions to find differences
 * @param {Object} oldVersion - The previous version
 * @param {Object} newVersion - The new version
 * @returns {Object} Comparison result with unchanged, changed, added, deleted
 */
export function compareVersions(oldVersion, newVersion) {
    const comparison = {
        unchanged: [],
        changed: [],
        added: [],
        deleted: []
    };

    if (!oldVersion || !newVersion) {
        return comparison;
    }

    const oldScenes = oldVersion.scenes || [];
    const newScenes = newVersion.scenes || [];

    // Create maps for faster lookup
    const oldSceneMap = new Map(oldScenes.map(s => [s.scene_number, s]));
    const newSceneMap = new Map(newScenes.map(s => [s.scene_number, s]));

    // Check each new scene
    newScenes.forEach(newScene => {
        const oldScene = oldSceneMap.get(newScene.scene_number);

        if (!oldScene) {
            // New scene
            comparison.added.push(newScene.scene_number);
        } else if (areScenesEqual(oldScene, newScene)) {
            // Unchanged scene
            comparison.unchanged.push(newScene.scene_number);
        } else {
            // Changed scene
            comparison.changed.push({
                scene_number: newScene.scene_number,
                old: oldScene,
                new: newScene,
                changes: detectSceneChanges(oldScene, newScene)
            });
        }
    });

    // Find deleted scenes
    oldScenes.forEach(oldScene => {
        if (!newSceneMap.has(oldScene.scene_number)) {
            comparison.deleted.push(oldScene.scene_number);
        }
    });

    return comparison;
}

/**
 * Check if two scenes are equal
 */
function areScenesEqual(scene1, scene2) {
    return (
        scene1.location === scene2.location &&
        scene1.setting === scene2.setting &&
        scene1.time_of_day === scene2.time_of_day &&
        normalizeText(scene1.full_text) === normalizeText(scene2.full_text)
    );
}

/**
 * Normalize text for comparison (remove extra whitespace)
 */
function normalizeText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Detect specific changes between two scenes
 */
function detectSceneChanges(oldScene, newScene) {
    const changes = [];

    // Location change
    if (oldScene.location !== newScene.location) {
        changes.push({
            type: 'location',
            message: `Location: ${oldScene.location} → ${newScene.location}`,
            severity: 'high'
        });
    }

    // Setting change (INT/EXT)
    if (oldScene.setting !== newScene.setting) {
        changes.push({
            type: 'setting',
            message: `Setting: ${oldScene.setting} → ${newScene.setting}`,
            severity: 'medium'
        });
    }

    // Time of day change
    if (oldScene.time_of_day !== newScene.time_of_day) {
        changes.push({
            type: 'time',
            message: `Time: ${oldScene.time_of_day} → ${newScene.time_of_day}`,
            severity: 'low'
        });
    }

    // Synopsis changed
    if (normalizeText(oldScene.synopsis) !== normalizeText(newScene.synopsis)) {
        changes.push({
            type: 'synopsis',
            message: 'Synopsis changed',
            severity: 'low'
        });
    }

    // Detect H&MU keyword changes
    const hmuKeywords = [
        'soaked', 'wet', 'drenched', 'blood', 'bleeding', 'bloody',
        'wound', 'wounded', 'cut', 'cuts', 'bruise', 'bruised',
        'beard', 'shaves', 'shaved', 'hair', 'wig', 'bald',
        'makeup', 'scar', 'scarred', 'tattoo', 'dirty', 'muddy',
        'rain', 'snow', 'sweat', 'tears', 'crying', 'burned',
        'bandage', 'cast', 'crutch', 'black eye', 'fat suit',
        'prosthetic', 'aging', 'younger', 'older', 'pregnant'
    ];

    const oldText = (oldScene.full_text || '').toLowerCase();
    const newText = (newScene.full_text || '').toLowerCase();

    hmuKeywords.forEach(keyword => {
        const wasPresent = oldText.includes(keyword);
        const isPresent = newText.includes(keyword);

        if (wasPresent && !isPresent) {
            changes.push({
                type: 'hmu_removed',
                message: `H&MU keyword removed: "${keyword}"`,
                severity: 'high',
                keyword: keyword
            });
        } else if (!wasPresent && isPresent) {
            changes.push({
                type: 'hmu_added',
                message: `H&MU keyword added: "${keyword}"`,
                severity: 'high',
                keyword: keyword
            });
        }
    });

    // Characters changed
    const oldChars = new Set(oldScene.characters_present || []);
    const newChars = new Set(newScene.characters_present || []);

    const addedChars = [...newChars].filter(c => !oldChars.has(c));
    const removedChars = [...oldChars].filter(c => !newChars.has(c));

    if (addedChars.length > 0) {
        changes.push({
            type: 'characters_added',
            message: `Characters added: ${addedChars.join(', ')}`,
            severity: 'medium',
            characters: addedChars
        });
    }

    if (removedChars.length > 0) {
        changes.push({
            type: 'characters_removed',
            message: `Characters removed: ${removedChars.join(', ')}`,
            severity: 'medium',
            characters: removedChars
        });
    }

    // Content significantly changed
    if (normalizeText(oldScene.full_text) !== normalizeText(newScene.full_text)) {
        // Calculate similarity
        const similarity = calculateTextSimilarity(oldScene.full_text, newScene.full_text);
        if (similarity < 0.8) {
            changes.push({
                type: 'content',
                message: `Content significantly changed (${Math.round(similarity * 100)}% similar)`,
                severity: similarity < 0.5 ? 'high' : 'medium'
            });
        }
    }

    return changes;
}

/**
 * Calculate text similarity (simple word overlap)
 */
function calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;

    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;

    return union > 0 ? intersection / union : 0;
}

// ============================================================================
// BREAKDOWN INHERITANCE
// ============================================================================

/**
 * Inherit breakdowns from old version to new version
 * @param {Object} oldVersion - Source version
 * @param {Object} newVersion - Target version
 * @param {Object} comparison - Comparison result
 * @returns {Object} New breakdowns object
 */
export function inheritBreakdowns(oldVersion, newVersion, comparison) {
    const newBreakdowns = {};

    // Copy breakdowns for unchanged scenes
    comparison.unchanged.forEach(sceneNum => {
        if (oldVersion.breakdowns[sceneNum]) {
            newBreakdowns[sceneNum] = JSON.parse(
                JSON.stringify(oldVersion.breakdowns[sceneNum])
            );
        }
    });

    // For changed scenes, copy but flag for review
    comparison.changed.forEach(change => {
        const sceneNum = change.scene_number;
        if (oldVersion.breakdowns[sceneNum]) {
            newBreakdowns[sceneNum] = JSON.parse(
                JSON.stringify(oldVersion.breakdowns[sceneNum])
            );
            newBreakdowns[sceneNum]._needs_review = true;
            newBreakdowns[sceneNum]._changes = change.changes;
            newBreakdowns[sceneNum]._inherited_from = oldVersion.version_id;
        }
    });

    // For added scenes, create empty breakdown placeholder
    comparison.added.forEach(sceneNum => {
        newBreakdowns[sceneNum] = {
            _is_new: true
        };
    });

    return newBreakdowns;
}

// ============================================================================
// VERSION SWITCHING
// ============================================================================

/**
 * Switch to a different version
 * @param {string} versionId - Version to switch to
 * @returns {boolean} Success status
 */
export async function switchToVersion(versionId) {
    const state = getState();
    const versions = getAllVersions();
    const targetVersion = versions.find(v => v.version_id === versionId);

    if (!targetVersion) {
        console.error('Version not found:', versionId);
        return false;
    }

    // Update is_current flags
    versions.forEach(v => {
        v.is_current = (v.version_id === versionId);
    });

    // Update current version ID
    state.currentProject.current_version_id = versionId;

    // Load version data into state
    loadVersionIntoState(targetVersion);

    // Save project - use dynamic import
    await loadExportHandlers();
    if (_saveProject) _saveProject();

    // Re-render UI - use dynamic imports
    await loadRenderFunctions();
    if (_renderSceneList) _renderSceneList();
    if (_renderScript) _renderScript();
    if (_renderCharacterTabs) _renderCharacterTabs();
    if (_renderCharacterTabPanels) _renderCharacterTabPanels();

    console.log('Switched to version:', versionId);
    return true;
}

/**
 * Load a version's data into the application state
 */
function loadVersionIntoState(version) {
    const state = getState();
    // Load scenes
    state.scenes = version.scenes.map((scene, index) => ({
        number: parseInt(scene.scene_number) || index + 1,
        heading: scene.heading || `${scene.setting}. ${scene.location} - ${scene.time_of_day}`,
        lineNumber: 0,
        synopsis: scene.synopsis || '',
        storyDay: scene.story_day || '',
        timeOfDay: scene.time_of_day || '',
        intExt: scene.setting || '',
        location: scene.location || '',
        content: scene.full_text || '',
        castMembers: scene.characters_present || []
    }));

    // Load breakdowns
    state.sceneBreakdowns = {};
    Object.entries(version.breakdowns || {}).forEach(([sceneNum, breakdown]) => {
        const sceneIndex = parseInt(sceneNum) - 1;
        if (sceneIndex >= 0) {
            state.sceneBreakdowns[sceneIndex] = breakdown;
        }
    });

    // Load characters
    if (version.characters && version.characters.length > 0) {
        state.confirmedCharacters = new Set(
            version.characters.map(c => c.name || c)
        );
    }

    // Load master context if available
    if (version.master_context) {
        window.masterContext = version.master_context;
        window.scriptMasterContext = version.master_context;
    }

    // Update script content
    if (version.script_content) {
        state.currentProject.scriptContent = version.script_content;
    }
}

/**
 * Save current state back to the active version
 */
export function saveCurrentVersionState() {
    const state = getState();
    const currentVersion = getCurrentVersion();
    if (!currentVersion) return;

    // Update scenes
    currentVersion.scenes = (state.scenes || []).map(scene => ({
        scene_number: scene.number?.toString(),
        setting: scene.intExt || '',
        location: scene.location || '',
        time_of_day: scene.timeOfDay || '',
        story_day: scene.storyDay || '',
        heading: scene.heading || '',
        full_text: scene.content || '',
        synopsis: scene.synopsis || '',
        characters_present: scene.castMembers || []
    }));

    // Update breakdowns
    currentVersion.breakdowns = {};
    Object.entries(state.sceneBreakdowns || {}).forEach(([sceneIndex, breakdown]) => {
        const sceneNum = (parseInt(sceneIndex) + 1).toString();
        currentVersion.breakdowns[sceneNum] = breakdown;
    });

    // Update characters
    currentVersion.characters = Array.from(state.confirmedCharacters || []).map(name => ({
        name: name,
        category: window.characterCategories?.[name] || 'SUPPORTING'
    }));

    // Update master context
    if (window.masterContext) {
        currentVersion.master_context = window.masterContext;
    }

    // Update metadata
    const breakdownCount = Object.keys(currentVersion.breakdowns).length;
    currentVersion.metadata.scenes_with_breakdown = breakdownCount;
    currentVersion.metadata.breakdown_completion = Math.round(
        (breakdownCount / currentVersion.scenes.length) * 100
    );
    currentVersion.metadata.last_modified = new Date().toISOString();

    console.log('Saved current version state');
}

// ============================================================================
// COPY SCENE FROM VERSION
// ============================================================================

/**
 * Copy a scene's breakdown from one version to another
 * @param {string} sceneNumber - Scene number to copy
 * @param {string} sourceVersionId - Source version ID
 * @param {string} targetVersionId - Target version ID (defaults to current)
 */
export async function copySceneFromVersion(sceneNumber, sourceVersionId, targetVersionId = null) {
    const state = getState();
    const sourceVersion = getVersionById(sourceVersionId);
    const targetVersion = targetVersionId
        ? getVersionById(targetVersionId)
        : getCurrentVersion();

    if (!sourceVersion || !targetVersion) {
        console.error('Source or target version not found');
        return false;
    }

    const sourceBreakdown = sourceVersion.breakdowns[sceneNumber];
    if (!sourceBreakdown) {
        console.warn('No breakdown exists in source version for scene', sceneNumber);
        return false;
    }

    // Deep copy breakdown
    targetVersion.breakdowns[sceneNumber] = JSON.parse(JSON.stringify(sourceBreakdown));

    // Remove review flags
    delete targetVersion.breakdowns[sceneNumber]._needs_review;
    delete targetVersion.breakdowns[sceneNumber]._changes;

    // Add copy metadata
    targetVersion.breakdowns[sceneNumber]._copied_from = {
        version_id: sourceVersionId,
        version_name: sourceVersion.version_name,
        copied_at: new Date().toISOString()
    };

    // Update state if this is the current version
    if (targetVersion.is_current) {
        const sceneIndex = parseInt(sceneNumber) - 1;
        state.sceneBreakdowns[sceneIndex] = targetVersion.breakdowns[sceneNumber];
    }

    // Save project - use dynamic import
    await loadExportHandlers();
    if (_saveProject) _saveProject();
    console.log(`Copied scene ${sceneNumber} from ${sourceVersionId} to ${targetVersion.version_id}`);
    return true;
}

// ============================================================================
// VERSION DELETION
// ============================================================================

/**
 * Delete a version (with safety checks)
 * @param {string} versionId - Version to delete
 * @returns {boolean} Success status
 */
export function deleteVersion(versionId) {
    const versions = getAllVersions();
    const versionIndex = versions.findIndex(v => v.version_id === versionId);

    if (versionIndex === -1) {
        console.error('Version not found:', versionId);
        return false;
    }

    const version = versions[versionIndex];

    // Cannot delete current version
    if (version.is_current) {
        console.error('Cannot delete the current active version');
        return false;
    }

    // Must have at least one version remaining
    if (versions.length <= 1) {
        console.error('Cannot delete the only remaining version');
        return false;
    }

    // Remove from array
    versions.splice(versionIndex, 1);

    // Save project - use dynamic import (async but we return sync for simplicity)
    loadExportHandlers().then(() => {
        if (_saveProject) _saveProject();
    });
    console.log('Deleted version:', versionId);
    return true;
}

// ============================================================================
// VERSION EXPORT
// ============================================================================

/**
 * Export a version with full metadata
 * @param {string} versionId - Version to export
 * @returns {Object} Export data
 */
export function exportVersionData(versionId) {
    const state = getState();
    const version = getVersionById(versionId) || getCurrentVersion();
    if (!version) return null;

    return {
        project_name: state.currentProject?.name || 'Untitled',
        version_name: version.version_name,
        version_id: version.version_id,
        version_color: version.version_color,
        upload_date: version.upload_date,
        export_date: new Date().toISOString(),

        metadata: {
            total_scenes: version.metadata.total_scenes,
            breakdown_completion: version.metadata.breakdown_completion,
            scenes_with_breakdown: version.metadata.scenes_with_breakdown,
            notes: version.metadata.notes,
            inherited_from: version.metadata.inherited_from
        },

        scenes: version.scenes,
        breakdowns: version.breakdowns,
        characters: version.characters
    };
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Get version display info for UI
 */
export function getVersionDisplayInfo(versionId) {
    const version = getVersionById(versionId);
    if (!version) return null;

    const uploadDate = new Date(version.upload_date);
    const lastModified = new Date(version.metadata.last_modified);

    return {
        id: version.version_id,
        name: version.version_name,
        color: version.version_color,
        is_current: version.is_current,
        upload_date: uploadDate.toLocaleDateString(),
        last_modified: lastModified.toLocaleDateString(),
        last_modified_relative: getRelativeTime(lastModified),
        scene_count: version.scenes.length,
        completion: version.metadata.breakdown_completion,
        has_review_needed: Object.values(version.breakdowns || {}).some(b => b._needs_review)
    };
}

/**
 * Get relative time string
 */
function getRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
}

// ============================================================================
// WINDOW EXPORTS
// ============================================================================

window.versionManager = {
    init: initVersionManagement,
    getAllVersions,
    getCurrentVersion,
    getVersionById,
    createNewVersion,
    compareVersions,
    switchToVersion,
    copySceneFromVersion,
    deleteVersion,
    exportVersionData,
    getVersionDisplayInfo,
    saveCurrentVersionState,
    VERSION_COLORS
};

export default {
    initVersionManagement,
    getAllVersions,
    getCurrentVersion,
    getVersionById,
    createNewVersion,
    compareVersions,
    inheritBreakdowns,
    switchToVersion,
    copySceneFromVersion,
    deleteVersion,
    exportVersionData,
    getVersionDisplayInfo,
    saveCurrentVersionState,
    VERSION_COLORS
};
