/**
 * version-ui.js
 * UI Components for Script Version Management
 *
 * Provides:
 * - Version upload modal
 * - Version selector panel
 * - Version comparison view
 * - Copy scene from version dialog
 */

import { state } from './main.js';
import { detectScenes, saveProject } from './export-handlers.js';
import {
    getAllVersions,
    getCurrentVersion,
    getVersionById,
    createNewVersion,
    compareVersions,
    switchToVersion,
    copySceneFromVersion,
    deleteVersion,
    getVersionDisplayInfo,
    saveCurrentVersionState,
    VERSION_COLORS
} from './version-manager.js';

// ============================================================================
// VERSION UPLOAD MODAL
// ============================================================================

/**
 * Open the version upload modal
 */
export function openVersionUploadModal() {
    let modal = document.getElementById('version-upload-modal');

    if (!modal) {
        modal = createVersionUploadModal();
        document.body.appendChild(modal);
    }

    // Reset form
    document.getElementById('version-name-select').value = 'White';
    document.getElementById('version-upload-date').valueAsDate = new Date();
    document.getElementById('version-script-input').value = '';
    document.getElementById('version-notes').value = '';

    modal.style.display = 'flex';
}

/**
 * Create the version upload modal HTML
 */
function createVersionUploadModal() {
    const modal = document.createElement('div');
    modal.id = 'version-upload-modal';
    modal.className = 'modal';

    const colorOptions = Object.entries(VERSION_COLORS)
        .map(([name, color]) => `
            <option value="${name}" style="background-color: ${color};">${name}</option>
        `).join('');

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px; max-height: 90vh; display: flex; flex-direction: column;">
            <div class="modal-title">Upload New Script Version</div>

            <div style="flex: 1; overflow-y: auto; min-height: 0; padding-right: 8px;">
                <div class="modal-section">
                    <label class="modal-label">Version Name (Color)</label>
                    <select class="modal-select" id="version-name-select" onchange="updateVersionColorPreview()">
                        ${colorOptions}
                    </select>
                    <div id="version-color-preview" style="
                        width: 100%;
                        height: 8px;
                        border-radius: 4px;
                        margin-top: 8px;
                        background-color: #FFFFFF;
                        border: 1px solid var(--glass-border);
                    "></div>
                </div>

                <div class="modal-section">
                    <label class="modal-label">Upload Date</label>
                    <input type="date" class="modal-input" id="version-upload-date">
                </div>

                <div class="modal-section">
                    <label class="modal-label">Script Content</label>
                    <textarea
                        class="modal-textarea"
                        id="version-script-input"
                        rows="12"
                        placeholder="Paste your screenplay here..."
                        style="font-family: 'Courier Prime', monospace; font-size: 12px;"
                    ></textarea>
                    <div class="modal-note">Paste the full screenplay text. Scenes will be auto-detected.</div>
                </div>

                <div class="modal-section">
                    <label class="modal-label">Version Notes (Optional)</label>
                    <textarea
                        class="modal-textarea"
                        id="version-notes"
                        rows="3"
                        placeholder="e.g., Scene 47 rewritten, dialogue polish, etc."
                    ></textarea>
                </div>
            </div>

            <div class="modal-actions" style="flex-shrink: 0; padding-top: 16px; border-top: 1px solid var(--glass-border); margin-top: 16px;">
                <button class="modal-btn" onclick="closeVersionUploadModal()">Cancel</button>
                <button class="modal-btn primary" onclick="processVersionUpload()" style="background: var(--accent-gold); color: var(--bg-dark); font-weight: 600;">
                    Upload & Compare
                </button>
            </div>
        </div>
    `;

    return modal;
}

/**
 * Close version upload modal
 */
window.closeVersionUploadModal = function() {
    const modal = document.getElementById('version-upload-modal');
    if (modal) modal.style.display = 'none';
};

/**
 * Update color preview when version name changes
 */
window.updateVersionColorPreview = function() {
    const select = document.getElementById('version-name-select');
    const preview = document.getElementById('version-color-preview');
    if (select && preview) {
        preview.style.backgroundColor = VERSION_COLORS[select.value] || '#FFFFFF';
    }
};

/**
 * Process version upload
 */
window.processVersionUpload = async function() {
    const versionName = document.getElementById('version-name-select').value;
    const uploadDate = document.getElementById('version-upload-date').valueAsDate || new Date();
    const scriptContent = document.getElementById('version-script-input').value;
    const notes = document.getElementById('version-notes').value;

    if (!scriptContent.trim()) {
        alert('Please paste your screenplay');
        return;
    }

    // Show loading
    showVersionLoadingBar('Processing Script', 'Detecting scenes...', 10);

    try {
        // Detect scenes from script
        const scenes = detectScenes(scriptContent);
        updateVersionLoadingBar('Processing Script', `Found ${scenes.length} scenes`, 30);

        if (scenes.length === 0) {
            closeVersionLoadingBar();
            alert('No scenes detected. Please check the script format.');
            return;
        }

        // Get current version for comparison
        const currentVersion = getCurrentVersion();

        // Create new version object (without saving yet)
        const newVersionData = {
            versionName,
            versionColor: VERSION_COLORS[versionName],
            scriptContent,
            scenes,
            characters: Array.from(state.confirmedCharacters || []),
            masterContext: window.masterContext,
            notes,
            inheritFromVersionId: currentVersion?.version_id || null
        };

        updateVersionLoadingBar('Processing Script', 'Comparing versions...', 50);

        // If there's a current version, show comparison
        if (currentVersion) {
            // Create temporary version for comparison
            const tempNewVersion = {
                scenes: scenes.map(scene => ({
                    scene_number: scene.number?.toString(),
                    setting: scene.intExt || '',
                    location: scene.location || '',
                    time_of_day: scene.timeOfDay || '',
                    full_text: scene.content || '',
                    synopsis: scene.synopsis || '',
                    characters_present: scene.castMembers || []
                }))
            };

            const comparison = compareVersions(currentVersion, tempNewVersion);

            closeVersionLoadingBar();
            closeVersionUploadModal();

            // Show comparison results
            showVersionComparisonResults(comparison, newVersionData, currentVersion);
        } else {
            // First version - just create it
            updateVersionLoadingBar('Processing Script', 'Creating version...', 80);

            const newVersion = createNewVersion(newVersionData);
            newVersion.is_current = true;
            state.currentProject.current_version_id = newVersion.version_id;

            saveProject();

            closeVersionLoadingBar();
            closeVersionUploadModal();

            showToast(`Created version: ${versionName}`, 'success');

            // Reload the page to show new version
            window.location.reload();
        }

    } catch (error) {
        closeVersionLoadingBar();
        console.error('Error processing version upload:', error);
        alert('Error processing script: ' + error.message);
    }
};

// ============================================================================
// VERSION COMPARISON RESULTS MODAL
// ============================================================================

/**
 * Show comparison results after upload
 */
function showVersionComparisonResults(comparison, newVersionData, currentVersion) {
    let modal = document.getElementById('version-comparison-results-modal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'version-comparison-results-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const unchangedCount = comparison.unchanged.length;
    const changedCount = comparison.changed.length;
    const addedCount = comparison.added.length;
    const deletedCount = comparison.deleted.length;

    const hasHMUChanges = comparison.changed.some(c =>
        c.changes.some(ch => ch.type === 'hmu_added' || ch.type === 'hmu_removed')
    );

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px; max-height: 90vh; display: flex; flex-direction: column;">
            <div class="modal-title">Script Version Comparison</div>

            <div style="flex: 1; overflow-y: auto; min-height: 0;">
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 20px;
                    padding: 12px;
                    background: rgba(212, 175, 122, 0.1);
                    border-radius: 8px;
                ">
                    <div style="
                        width: 12px;
                        height: 12px;
                        border-radius: 50%;
                        background: ${newVersionData.versionColor};
                        border: 2px solid var(--glass-border);
                    "></div>
                    <span style="font-weight: 600;">${newVersionData.versionName}</span>
                    <span style="color: var(--text-muted);">vs</span>
                    <div style="
                        width: 12px;
                        height: 12px;
                        border-radius: 50%;
                        background: ${currentVersion.version_color};
                        border: 2px solid var(--glass-border);
                    "></div>
                    <span style="font-weight: 600;">${currentVersion.version_name}</span>
                </div>

                <div class="comparison-summary" style="margin-bottom: 20px;">
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                        <div style="text-align: center; padding: 16px; background: rgba(34, 197, 94, 0.1); border-radius: 8px;">
                            <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${unchangedCount}</div>
                            <div style="font-size: 12px; color: var(--text-muted);">Unchanged</div>
                        </div>
                        <div style="text-align: center; padding: 16px; background: rgba(251, 191, 36, 0.1); border-radius: 8px;">
                            <div style="font-size: 24px; font-weight: 700; color: #fbbf24;">${changedCount}</div>
                            <div style="font-size: 12px; color: var(--text-muted);">Changed</div>
                        </div>
                        <div style="text-align: center; padding: 16px; background: rgba(59, 130, 246, 0.1); border-radius: 8px;">
                            <div style="font-size: 24px; font-weight: 700; color: #3b82f6;">${addedCount}</div>
                            <div style="font-size: 12px; color: var(--text-muted);">Added</div>
                        </div>
                        <div style="text-align: center; padding: 16px; background: rgba(239, 68, 68, 0.1); border-radius: 8px;">
                            <div style="font-size: 24px; font-weight: 700; color: #ef4444;">${deletedCount}</div>
                            <div style="font-size: 12px; color: var(--text-muted);">Deleted</div>
                        </div>
                    </div>
                </div>

                ${unchangedCount > 0 ? `
                    <div style="padding: 12px; background: rgba(34, 197, 94, 0.05); border-radius: 8px; margin-bottom: 12px;">
                        <div style="color: #22c55e; font-weight: 600; margin-bottom: 4px;">
                            ✓ ${unchangedCount} scenes unchanged
                        </div>
                        <div style="color: var(--text-muted); font-size: 0.85em;">
                            Breakdown data will be automatically preserved for these scenes.
                        </div>
                    </div>
                ` : ''}

                ${changedCount > 0 ? `
                    <div style="padding: 12px; background: rgba(251, 191, 36, 0.05); border-radius: 8px; margin-bottom: 12px;">
                        <div style="color: #fbbf24; font-weight: 600; margin-bottom: 8px;">
                            ⚠️ ${changedCount} scene${changedCount > 1 ? 's' : ''} changed - needs review
                        </div>
                        <div style="max-height: 200px; overflow-y: auto;">
                            ${comparison.changed.map(change => `
                                <div style="
                                    padding: 8px 12px;
                                    margin: 4px 0;
                                    background: rgba(28, 25, 22, 0.3);
                                    border-radius: 4px;
                                    border-left: 3px solid ${change.changes.some(c => c.severity === 'high') ? '#ef4444' : '#fbbf24'};
                                ">
                                    <div style="font-weight: 600;">Scene ${change.scene_number}</div>
                                    <div style="font-size: 0.85em; color: var(--text-muted);">
                                        ${change.changes.map(c => `
                                            <div style="color: ${c.severity === 'high' ? '#ef4444' : 'inherit'};">
                                                ${c.type.startsWith('hmu') ? '🎨 ' : ''}${c.message}
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div style="color: var(--text-muted); font-size: 0.85em; margin-top: 8px;">
                            Breakdowns will be copied but flagged for review.
                        </div>
                    </div>
                ` : ''}

                ${addedCount > 0 ? `
                    <div style="padding: 12px; background: rgba(59, 130, 246, 0.05); border-radius: 8px; margin-bottom: 12px;">
                        <div style="color: #3b82f6; font-weight: 600; margin-bottom: 4px;">
                            + ${addedCount} new scene${addedCount > 1 ? 's' : ''} added
                        </div>
                        <div style="color: var(--text-muted); font-size: 0.85em;">
                            Scenes: ${comparison.added.join(', ')}
                        </div>
                    </div>
                ` : ''}

                ${deletedCount > 0 ? `
                    <div style="padding: 12px; background: rgba(239, 68, 68, 0.05); border-radius: 8px; margin-bottom: 12px;">
                        <div style="color: #ef4444; font-weight: 600; margin-bottom: 4px;">
                            - ${deletedCount} scene${deletedCount > 1 ? 's' : ''} removed
                        </div>
                        <div style="color: var(--text-muted); font-size: 0.85em;">
                            Scenes: ${comparison.deleted.join(', ')}
                        </div>
                    </div>
                ` : ''}

                ${hasHMUChanges ? `
                    <div style="
                        padding: 12px;
                        background: rgba(239, 68, 68, 0.1);
                        border: 1px solid rgba(239, 68, 68, 0.3);
                        border-radius: 8px;
                        margin-top: 12px;
                    ">
                        <div style="color: #ef4444; font-weight: 600;">
                            🎨 H&MU Keywords Changed
                        </div>
                        <div style="color: var(--text-muted); font-size: 0.85em; margin-top: 4px;">
                            Some scenes have changes to hair, makeup, or effects keywords.
                            Review these scenes after import.
                        </div>
                    </div>
                ` : ''}
            </div>

            <div class="modal-actions" style="flex-shrink: 0; padding-top: 16px; border-top: 1px solid var(--glass-border); margin-top: 16px;">
                <button class="modal-btn" onclick="closeComparisonResultsModal()">Cancel</button>
                <button class="modal-btn" onclick="showDetailedComparison()" style="margin-right: auto;">
                    View Details
                </button>
                <button class="modal-btn primary" onclick="acceptVersionUpload()" style="background: var(--accent-gold); color: var(--bg-dark); font-weight: 600;">
                    Accept & Create Version
                </button>
            </div>
        </div>
    `;

    // Store data for later use
    modal.dataset.newVersionData = JSON.stringify(newVersionData);
    modal.dataset.comparison = JSON.stringify(comparison);

    modal.style.display = 'flex';
}

window.closeComparisonResultsModal = function() {
    const modal = document.getElementById('version-comparison-results-modal');
    if (modal) modal.style.display = 'none';
};

window.acceptVersionUpload = function() {
    const modal = document.getElementById('version-comparison-results-modal');
    if (!modal) return;

    const newVersionData = JSON.parse(modal.dataset.newVersionData);

    showVersionLoadingBar('Creating Version', 'Saving version data...', 50);

    try {
        // Create the new version
        const newVersion = createNewVersion(newVersionData);

        // Set as current
        newVersion.is_current = true;
        state.currentProject.current_version_id = newVersion.version_id;

        // Update all other versions to not current
        getAllVersions().forEach(v => {
            if (v.version_id !== newVersion.version_id) {
                v.is_current = false;
            }
        });

        saveProject();

        closeVersionLoadingBar();
        closeComparisonResultsModal();

        showToast(`Created version: ${newVersionData.versionName}`, 'success');

        // Reload to show new version
        setTimeout(() => {
            window.location.reload();
        }, 500);

    } catch (error) {
        closeVersionLoadingBar();
        console.error('Error creating version:', error);
        alert('Error creating version: ' + error.message);
    }
};

// ============================================================================
// VERSION SELECTOR PANEL
// ============================================================================

/**
 * Render version selector panel
 * @param {string} containerId - ID of container element
 */
export function renderVersionSelector(containerId = 'version-selector-container') {
    let container = document.getElementById(containerId);

    if (!container) {
        // Create container if it doesn't exist
        container = document.createElement('div');
        container.id = containerId;
        // Insert after top bar or in sidebar
        const topBar = document.querySelector('.top-bar');
        if (topBar) {
            topBar.insertAdjacentElement('afterend', container);
        }
    }

    const versions = getAllVersions();
    const currentVersion = getCurrentVersion();

    if (versions.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div class="version-selector-panel" style="
            background: var(--panel-bg);
            border-bottom: 1px solid var(--glass-border);
            padding: 12px 20px;
        ">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="color: var(--text-muted); font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.5px;">
                        Script Version:
                    </span>
                    <div class="version-dropdown" style="position: relative;">
                        <button onclick="toggleVersionDropdown()" class="version-dropdown-btn" style="
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            padding: 8px 16px;
                            background: var(--card-bg);
                            border: 1px solid var(--glass-border);
                            border-radius: 6px;
                            color: var(--text-light);
                            cursor: pointer;
                            font-size: 0.9em;
                        ">
                            <span style="
                                width: 10px;
                                height: 10px;
                                border-radius: 50%;
                                background: ${currentVersion?.version_color || '#fff'};
                                border: 1px solid rgba(0,0,0,0.2);
                            "></span>
                            <span style="font-weight: 600;">${currentVersion?.version_name || 'No Version'}</span>
                            <span style="color: var(--text-muted); font-size: 0.85em;">
                                (${currentVersion ? new Date(currentVersion.upload_date).toLocaleDateString() : ''})
                            </span>
                            <span style="margin-left: 4px;">▼</span>
                        </button>

                        <div id="version-dropdown-menu" style="
                            display: none;
                            position: absolute;
                            top: 100%;
                            left: 0;
                            min-width: 300px;
                            background: var(--card-bg);
                            border: 1px solid var(--glass-border);
                            border-radius: 8px;
                            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                            z-index: 1000;
                            margin-top: 4px;
                        ">
                            ${versions.map(v => `
                                <div class="version-dropdown-item" style="
                                    display: flex;
                                    align-items: center;
                                    gap: 12px;
                                    padding: 12px 16px;
                                    cursor: pointer;
                                    border-bottom: 1px solid var(--glass-border);
                                    ${v.is_current ? 'background: rgba(212, 175, 122, 0.1);' : ''}
                                " onclick="selectVersion('${v.version_id}')" onmouseover="this.style.background='rgba(212, 175, 122, 0.05)'" onmouseout="this.style.background='${v.is_current ? 'rgba(212, 175, 122, 0.1)' : 'transparent'}'">
                                    <span style="
                                        width: 12px;
                                        height: 12px;
                                        border-radius: 50%;
                                        background: ${v.version_color};
                                        border: 1px solid rgba(0,0,0,0.2);
                                        flex-shrink: 0;
                                    "></span>
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; display: flex; align-items: center; gap: 8px;">
                                            ${v.version_name}
                                            ${v.is_current ? '<span style="font-size: 0.7em; background: var(--accent-gold); color: var(--bg-dark); padding: 2px 6px; border-radius: 4px;">CURRENT</span>' : ''}
                                        </div>
                                        <div style="font-size: 0.8em; color: var(--text-muted);">
                                            ${v.scenes?.length || 0} scenes • ${v.metadata?.breakdown_completion || 0}% complete
                                        </div>
                                    </div>
                                    <div style="font-size: 0.75em; color: var(--text-muted);">
                                        ${new Date(v.upload_date).toLocaleDateString()}
                                    </div>
                                </div>
                            `).join('')}

                            <div style="padding: 8px; border-top: 1px solid var(--glass-border);">
                                <button onclick="openVersionUploadModal(); toggleVersionDropdown();" style="
                                    width: 100%;
                                    padding: 10px;
                                    background: transparent;
                                    border: 1px dashed var(--glass-border);
                                    border-radius: 6px;
                                    color: var(--accent-gold);
                                    cursor: pointer;
                                    font-size: 0.9em;
                                ">
                                    + Upload New Version
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="display: flex; gap: 8px;">
                    <button onclick="openVersionComparisonModal()" class="version-action-btn" style="
                        padding: 6px 12px;
                        background: transparent;
                        border: 1px solid var(--glass-border);
                        border-radius: 4px;
                        color: var(--text-muted);
                        cursor: pointer;
                        font-size: 0.8em;
                    " ${versions.length < 2 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                        Compare Versions
                    </button>
                    <button onclick="openVersionManagerModal()" class="version-action-btn" style="
                        padding: 6px 12px;
                        background: transparent;
                        border: 1px solid var(--glass-border);
                        border-radius: 4px;
                        color: var(--text-muted);
                        cursor: pointer;
                        font-size: 0.8em;
                    ">
                        Manage Versions
                    </button>
                </div>
            </div>
        </div>
    `;
}

window.toggleVersionDropdown = function() {
    const menu = document.getElementById('version-dropdown-menu');
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
};

window.selectVersion = async function(versionId) {
    toggleVersionDropdown();

    const currentVersion = getCurrentVersion();
    if (currentVersion?.version_id === versionId) {
        return; // Already current
    }

    // Save current state first
    saveCurrentVersionState();

    // Show confirmation
    const targetVersion = getVersionById(versionId);
    const confirmed = confirm(
        `Switch to ${targetVersion.version_name} version?\n\n` +
        `Your current work on ${currentVersion.version_name} will be saved.`
    );

    if (!confirmed) return;

    showVersionLoadingBar('Switching Version', 'Loading version data...', 50);

    try {
        await switchToVersion(versionId);
        closeVersionLoadingBar();
        showToast(`Switched to ${targetVersion.version_name}`, 'success');

        // Refresh UI
        renderVersionSelector();

    } catch (error) {
        closeVersionLoadingBar();
        console.error('Error switching version:', error);
        alert('Error switching version: ' + error.message);
    }
};

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.querySelector('.version-dropdown');
    const menu = document.getElementById('version-dropdown-menu');
    if (menu && dropdown && !dropdown.contains(e.target)) {
        menu.style.display = 'none';
    }
});

// ============================================================================
// VERSION MANAGER MODAL
// ============================================================================

window.openVersionManagerModal = function() {
    let modal = document.getElementById('version-manager-modal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'version-manager-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const versions = getAllVersions();

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 90vh; display: flex; flex-direction: column;">
            <div class="modal-title">Manage Script Versions</div>

            <div style="flex: 1; overflow-y: auto; min-height: 0;">
                ${versions.length === 0 ? `
                    <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                        <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
                        <div>No script versions yet.</div>
                        <div style="margin-top: 8px;">Upload your first script to get started.</div>
                    </div>
                ` : `
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${versions.map(v => {
                            const info = getVersionDisplayInfo(v.version_id);
                            return `
                                <div style="
                                    display: flex;
                                    align-items: center;
                                    gap: 16px;
                                    padding: 16px;
                                    background: ${v.is_current ? 'rgba(212, 175, 122, 0.1)' : 'var(--card-bg)'};
                                    border: 1px solid ${v.is_current ? 'var(--accent-gold)' : 'var(--glass-border)'};
                                    border-radius: 8px;
                                ">
                                    <div style="
                                        width: 16px;
                                        height: 16px;
                                        border-radius: 50%;
                                        background: ${v.version_color};
                                        border: 2px solid rgba(0,0,0,0.2);
                                        flex-shrink: 0;
                                    "></div>

                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; display: flex; align-items: center; gap: 8px;">
                                            ${v.version_name}
                                            ${v.is_current ? '<span style="font-size: 0.7em; background: var(--accent-gold); color: var(--bg-dark); padding: 2px 8px; border-radius: 4px;">CURRENT</span>' : ''}
                                            ${info?.has_review_needed ? '<span style="font-size: 0.7em; background: #fbbf24; color: var(--bg-dark); padding: 2px 8px; border-radius: 4px;">NEEDS REVIEW</span>' : ''}
                                        </div>
                                        <div style="font-size: 0.85em; color: var(--text-muted); margin-top: 4px;">
                                            ${v.scenes?.length || 0} scenes • ${v.metadata?.breakdown_completion || 0}% complete
                                        </div>
                                        <div style="font-size: 0.8em; color: var(--text-muted);">
                                            Uploaded: ${new Date(v.upload_date).toLocaleDateString()} •
                                            Modified: ${info?.last_modified_relative || 'Unknown'}
                                        </div>
                                        ${v.metadata?.notes ? `
                                            <div style="font-size: 0.8em; color: var(--text-muted); margin-top: 4px; font-style: italic;">
                                                "${v.metadata.notes}"
                                            </div>
                                        ` : ''}
                                    </div>

                                    <div style="display: flex; gap: 8px; flex-shrink: 0;">
                                        ${!v.is_current ? `
                                            <button onclick="selectVersion('${v.version_id}')" style="
                                                padding: 6px 12px;
                                                background: var(--accent-gold);
                                                border: none;
                                                border-radius: 4px;
                                                color: var(--bg-dark);
                                                cursor: pointer;
                                                font-size: 0.8em;
                                                font-weight: 600;
                                            ">
                                                Set Current
                                            </button>
                                        ` : ''}
                                        <button onclick="exportVersion('${v.version_id}')" style="
                                            padding: 6px 12px;
                                            background: transparent;
                                            border: 1px solid var(--glass-border);
                                            border-radius: 4px;
                                            color: var(--text-light);
                                            cursor: pointer;
                                            font-size: 0.8em;
                                        ">
                                            Export
                                        </button>
                                        ${!v.is_current && versions.length > 1 ? `
                                            <button onclick="confirmDeleteVersion('${v.version_id}', '${v.version_name}')" style="
                                                padding: 6px 12px;
                                                background: transparent;
                                                border: 1px solid rgba(239, 68, 68, 0.5);
                                                border-radius: 4px;
                                                color: #ef4444;
                                                cursor: pointer;
                                                font-size: 0.8em;
                                            ">
                                                Delete
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>

            <div class="modal-actions" style="flex-shrink: 0; padding-top: 16px; border-top: 1px solid var(--glass-border); margin-top: 16px;">
                <button class="modal-btn" onclick="closeVersionManagerModal()">Close</button>
                <button class="modal-btn primary" onclick="openVersionUploadModal(); closeVersionManagerModal();" style="background: var(--accent-gold); color: var(--bg-dark);">
                    + Upload New Version
                </button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
};

window.closeVersionManagerModal = function() {
    const modal = document.getElementById('version-manager-modal');
    if (modal) modal.style.display = 'none';
};

window.confirmDeleteVersion = function(versionId, versionName) {
    const confirmName = prompt(
        `⚠️ DELETE VERSION?\n\n` +
        `This will permanently delete "${versionName}" and all its breakdown data.\n\n` +
        `Type the version name to confirm:`
    );

    if (confirmName !== versionName) {
        if (confirmName !== null) {
            alert('Version name does not match. Deletion cancelled.');
        }
        return;
    }

    const success = deleteVersion(versionId);
    if (success) {
        showToast(`Deleted version: ${versionName}`, 'info');
        openVersionManagerModal(); // Refresh
        renderVersionSelector();
    } else {
        alert('Could not delete version.');
    }
};

window.exportVersion = function(versionId) {
    const { exportVersionData } = window.versionManager;
    const data = exportVersionData(versionId);

    if (!data) {
        alert('Could not export version');
        return;
    }

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.project_name}_${data.version_name}_breakdown.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Exported ${data.version_name}`, 'success');
};

// ============================================================================
// VERSION COMPARISON MODAL
// ============================================================================

window.openVersionComparisonModal = function() {
    const versions = getAllVersions();
    if (versions.length < 2) {
        alert('Need at least 2 versions to compare');
        return;
    }

    let modal = document.getElementById('version-comparison-modal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'version-comparison-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const currentVersion = getCurrentVersion();

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px; max-height: 90vh; display: flex; flex-direction: column;">
            <div class="modal-title">Compare Script Versions</div>

            <div style="display: flex; gap: 16px; margin-bottom: 20px; align-items: center;">
                <div style="flex: 1;">
                    <label class="modal-label">Version A</label>
                    <select class="modal-select" id="compare-version-a" onchange="runVersionComparison()">
                        ${versions.map(v => `
                            <option value="${v.version_id}" ${v.is_current ? 'selected' : ''}>
                                ${v.version_name} (${new Date(v.upload_date).toLocaleDateString()})
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div style="font-size: 24px; color: var(--text-muted); padding-top: 20px;">↔</div>
                <div style="flex: 1;">
                    <label class="modal-label">Version B</label>
                    <select class="modal-select" id="compare-version-b" onchange="runVersionComparison()">
                        ${versions.map(v => `
                            <option value="${v.version_id}" ${!v.is_current && versions.indexOf(v) === 1 ? 'selected' : ''}>
                                ${v.version_name} (${new Date(v.upload_date).toLocaleDateString()})
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>

            <div id="comparison-results" style="flex: 1; overflow-y: auto; min-height: 0;">
                <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                    Select two different versions to compare
                </div>
            </div>

            <div class="modal-actions" style="flex-shrink: 0; padding-top: 16px; border-top: 1px solid var(--glass-border); margin-top: 16px;">
                <button class="modal-btn" onclick="closeVersionComparisonModal()">Close</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    // Run initial comparison
    runVersionComparison();
};

window.closeVersionComparisonModal = function() {
    const modal = document.getElementById('version-comparison-modal');
    if (modal) modal.style.display = 'none';
};

window.runVersionComparison = function() {
    const versionAId = document.getElementById('compare-version-a')?.value;
    const versionBId = document.getElementById('compare-version-b')?.value;
    const resultsContainer = document.getElementById('comparison-results');

    if (!versionAId || !versionBId || !resultsContainer) return;

    if (versionAId === versionBId) {
        resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                Select two different versions to compare
            </div>
        `;
        return;
    }

    const versionA = getVersionById(versionAId);
    const versionB = getVersionById(versionBId);

    if (!versionA || !versionB) return;

    const comparison = compareVersions(versionA, versionB);

    resultsContainer.innerHTML = `
        <div class="comparison-summary" style="margin-bottom: 20px;">
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                <div style="text-align: center; padding: 16px; background: rgba(34, 197, 94, 0.1); border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${comparison.unchanged.length}</div>
                    <div style="font-size: 12px; color: var(--text-muted);">Unchanged</div>
                </div>
                <div style="text-align: center; padding: 16px; background: rgba(251, 191, 36, 0.1); border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: 700; color: #fbbf24;">${comparison.changed.length}</div>
                    <div style="font-size: 12px; color: var(--text-muted);">Changed</div>
                </div>
                <div style="text-align: center; padding: 16px; background: rgba(59, 130, 246, 0.1); border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: 700; color: #3b82f6;">${comparison.added.length}</div>
                    <div style="font-size: 12px; color: var(--text-muted);">Added in B</div>
                </div>
                <div style="text-align: center; padding: 16px; background: rgba(239, 68, 68, 0.1); border-radius: 8px;">
                    <div style="font-size: 24px; font-weight: 700; color: #ef4444;">${comparison.deleted.length}</div>
                    <div style="font-size: 12px; color: var(--text-muted);">Removed in B</div>
                </div>
            </div>
        </div>

        ${comparison.changed.length > 0 ? `
            <div style="margin-bottom: 16px;">
                <h3 style="color: var(--accent-gold); margin-bottom: 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                    Changed Scenes (${comparison.changed.length})
                </h3>
                ${comparison.changed.map(change => `
                    <details style="margin-bottom: 8px;">
                        <summary style="
                            padding: 12px;
                            background: var(--card-bg);
                            border: 1px solid var(--glass-border);
                            border-radius: 8px;
                            cursor: pointer;
                            list-style: none;
                        ">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <span style="font-weight: 600;">Scene ${change.scene_number}</span>
                                <span style="color: var(--text-muted); font-size: 0.85em;">
                                    ${change.changes.length} change${change.changes.length !== 1 ? 's' : ''}
                                </span>
                                ${change.changes.some(c => c.severity === 'high') ?
                                    '<span style="background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7em;">HIGH IMPACT</span>' : ''}
                            </div>
                        </summary>
                        <div style="padding: 16px; background: rgba(28, 25, 22, 0.3); border-radius: 0 0 8px 8px; margin-top: -1px; border: 1px solid var(--glass-border); border-top: none;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                <div>
                                    <div style="font-weight: 600; color: ${versionA.version_color}; margin-bottom: 8px;">
                                        ${versionA.version_name}
                                    </div>
                                    <div style="font-size: 0.85em; padding: 8px; background: var(--panel-bg); border-radius: 4px;">
                                        <div><strong>Location:</strong> ${change.old.location}</div>
                                        <div><strong>Setting:</strong> ${change.old.setting} - ${change.old.time_of_day}</div>
                                        ${change.old.synopsis ? `<div><strong>Synopsis:</strong> ${change.old.synopsis}</div>` : ''}
                                    </div>
                                </div>
                                <div>
                                    <div style="font-weight: 600; color: ${versionB.version_color}; margin-bottom: 8px;">
                                        ${versionB.version_name}
                                    </div>
                                    <div style="font-size: 0.85em; padding: 8px; background: var(--panel-bg); border-radius: 4px;">
                                        <div><strong>Location:</strong> ${change.new.location}</div>
                                        <div><strong>Setting:</strong> ${change.new.setting} - ${change.new.time_of_day}</div>
                                        ${change.new.synopsis ? `<div><strong>Synopsis:</strong> ${change.new.synopsis}</div>` : ''}
                                    </div>
                                </div>
                            </div>
                            <div style="margin-top: 12px;">
                                <div style="font-weight: 600; margin-bottom: 8px;">Detected Changes:</div>
                                ${change.changes.map(c => `
                                    <div style="
                                        padding: 4px 8px;
                                        margin: 4px 0;
                                        background: ${c.severity === 'high' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(251, 191, 36, 0.1)'};
                                        border-left: 3px solid ${c.severity === 'high' ? '#ef4444' : '#fbbf24'};
                                        font-size: 0.85em;
                                    ">
                                        ${c.type.startsWith('hmu') ? '🎨 ' : ''}${c.message}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </details>
                `).join('')}
            </div>
        ` : ''}

        ${comparison.added.length > 0 ? `
            <div style="margin-bottom: 16px;">
                <h3 style="color: #3b82f6; margin-bottom: 12px; font-size: 14px;">
                    Added in ${versionB.version_name} (${comparison.added.length})
                </h3>
                <div style="font-size: 0.9em; color: var(--text-muted);">
                    Scenes: ${comparison.added.join(', ')}
                </div>
            </div>
        ` : ''}

        ${comparison.deleted.length > 0 ? `
            <div style="margin-bottom: 16px;">
                <h3 style="color: #ef4444; margin-bottom: 12px; font-size: 14px;">
                    Removed in ${versionB.version_name} (${comparison.deleted.length})
                </h3>
                <div style="font-size: 0.9em; color: var(--text-muted);">
                    Scenes: ${comparison.deleted.join(', ')}
                </div>
            </div>
        ` : ''}
    `;
};

// ============================================================================
// LOADING BAR HELPERS
// ============================================================================

function showVersionLoadingBar(title, message, progress) {
    let bar = document.getElementById('version-loading-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'version-loading-bar';
        bar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: var(--panel-bg);
            border-bottom: 1px solid var(--glass-border);
            padding: 12px 20px;
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 16px;
        `;
        document.body.appendChild(bar);
    }

    bar.innerHTML = `
        <div style="flex: 1;">
            <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
            <div style="font-size: 0.85em; color: var(--text-muted);">${message}</div>
        </div>
        <div style="width: 200px; height: 8px; background: var(--card-bg); border-radius: 4px; overflow: hidden;">
            <div style="width: ${progress}%; height: 100%; background: var(--accent-gold); transition: width 0.3s;"></div>
        </div>
    `;

    bar.style.display = 'flex';
}

function updateVersionLoadingBar(title, message, progress) {
    showVersionLoadingBar(title, message, progress);
}

function closeVersionLoadingBar() {
    const bar = document.getElementById('version-loading-bar');
    if (bar) bar.style.display = 'none';
}

// ============================================================================
// TOAST HELPER
// ============================================================================

function showToast(message, type = 'info') {
    if (window.showToast) {
        window.showToast(message, type);
        return;
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 12px 24px;
        background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#d4af7a'};
        color: ${type === 'info' ? 'var(--bg-dark)' : 'white'};
        border-radius: 8px;
        z-index: 10001;
        font-size: 0.9em;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    openVersionUploadModal,
    renderVersionSelector
};

// Window exports for HTML onclick handlers
window.openVersionUploadModal = openVersionUploadModal;
window.renderVersionSelector = renderVersionSelector;
