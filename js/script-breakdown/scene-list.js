/**
 * scene-list.js
 * Left sidebar scene navigation
 *
 * Responsibilities:
 * - Render scene cards with metadata
 * - Show scene synopsis, cast, and elements summary
 * - Handle scene selection clicks
 * - Display scene type indicators (INT/EXT, DAY/NIGHT)
 * - Show expanded details with expand/collapse button
 */

import { state, selectScene } from './main.js';
import { getSceneType, getSceneTypeLabel } from './utils.js';

// Element categories for counting
const categories = [
    { id: 'cast', name: 'Cast', color: '#fbbf24' },
    { id: 'hair', name: 'Hair', color: '#a855f7' },
    { id: 'makeup', name: 'Makeup', color: '#ec4899' },
    { id: 'sfx', name: 'SFX', color: '#ef4444' },
    { id: 'health', name: 'Health', color: '#f59e0b' },
    { id: 'injuries', name: 'Injuries', color: '#dc2626' },
    { id: 'stunts', name: 'Stunts', color: '#f97316' },
    { id: 'weather', name: 'Weather', color: '#38bdf8' },
    { id: 'wardrobe', name: 'Wardrobe', color: '#34d399' },
    { id: 'extras', name: 'Extras', color: '#9ca3af' }
];

// Track which scenes are expanded (separate from selection)
const expandedScenes = new Set();

/**
 * Render the scene list in the left sidebar
 * Shows scene cards with metadata, cast, and element counts
 */
export function renderSceneList() {
    const container = document.getElementById('scene-list');
    if (!container) {
        console.error('Scene list container not found');
        return;
    }

    // Update scene count
    const sceneCountEl = document.getElementById('scene-count');
    if (sceneCountEl) {
        sceneCountEl.textContent = state.scenes.length;
    }

    if (state.scenes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-title">No Scenes</div>
                <div class="empty-desc">Import a screenplay to begin</div>
            </div>
        `;
        return;
    }

    container.innerHTML = state.scenes.map((scene, index) => {
        const sceneType = getSceneType(scene.heading);
        const sceneTypeLabel = getSceneTypeLabel(sceneType);
        const breakdown = state.sceneBreakdowns[index] || {};
        const cast = breakdown.cast || [];
        const isActive = state.currentScene === index;
        const isExpanded = expandedScenes.has(index);

        // Count elements by category
        const elementCounts = {};
        categories.forEach(cat => {
            const items = breakdown[cat.id] || [];
            if (items.length > 0) {
                elementCounts[cat.id] = {
                    count: items.length,
                    name: cat.name,
                    color: cat.color
                };
            }
        });

        return `
            <div class="scene-card ${isActive ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}"
                 data-scene-index="${index}">

                <!-- Scene Header (always visible) -->
                <div class="scene-header">
                    <div class="scene-icon" onclick="selectScene(${index})"></div>
                    <div class="scene-title-section" onclick="selectScene(${index})">
                        <div class="scene-title">${scene.number}. ${escapeHtml(scene.heading)}</div>
                        <div class="scene-meta">
                            ${scene.intExt ? `<span class="scene-location-badge">${scene.intExt}</span>` : ''}
                            ${scene.storyDay ? `<span class="scene-day-badge">${escapeHtml(scene.storyDay)}</span>` : ''}
                        </div>
                    </div>
                    <button class="scene-expand-btn" onclick="event.stopPropagation(); toggleSceneExpand(${index})">
                        ${isExpanded ? '▼' : '▶'}
                    </button>
                </div>

                <!-- Scene Overview (shows when expanded) -->
                ${isExpanded ? renderSceneOverview(scene, index, cast, elementCounts) : ''}
            </div>
        `;
    }).join('');
}

/**
 * Render scene overview section when expanded
 */
function renderSceneOverview(scene, sceneIndex, cast, elementCounts) {
    // Get tags for this scene to display tag summary
    const sceneTags = state.scriptTags[sceneIndex] || [];
    const tagCategoryCounts = {};

    sceneTags.forEach(tag => {
        if (tag.category) {
            tagCategoryCounts[tag.category] = (tagCategoryCounts[tag.category] || 0) + 1;
        }
    });

    return `
        <div class="scene-overview">
            <!-- Synopsis -->
            <div class="overview-section">
                <div class="overview-label">Synopsis</div>
                <div class="overview-content synopsis-text">
                    ${scene.synopsis ? escapeHtml(scene.synopsis) : '<em>No synopsis generated yet</em>'}
                </div>
            </div>

            <!-- Scene Details -->
            <div class="overview-section">
                <div class="overview-label">Scene Details</div>
                <div class="scene-details-grid">
                    <div class="detail-item">
                        <span class="detail-label">Scene #:</span>
                        <span class="detail-value">${scene.number}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Int/Ext:</span>
                        <span class="detail-value">${scene.intExt || '—'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Day:</span>
                        <span class="detail-value">${scene.storyDay || '—'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Time:</span>
                        <span class="detail-value">${scene.timeOfDay || '—'}</span>
                    </div>
                </div>
            </div>

            <!-- Cast Preview -->
            ${cast && cast.length > 0 ? `
                <div class="overview-section">
                    <div class="overview-label">Cast (${cast.length})</div>
                    <div class="cast-tags">
                        ${cast.map(char => `
                            <span class="cast-tag">${escapeHtml(char)}</span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <!-- Tag Summary -->
            ${Object.keys(tagCategoryCounts).length > 0 ? `
                <div class="overview-section">
                    <div class="overview-label">Tags</div>
                    <div class="tag-summary">
                        ${getTagSummaryHTML(tagCategoryCounts, elementCounts)}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Generate tag summary HTML with category counts and colors
 */
function getTagSummaryHTML(tagCategoryCounts, elementCounts) {
    const html = [];

    for (const [categoryId, count] of Object.entries(tagCategoryCounts)) {
        const categoryInfo = elementCounts[categoryId] ||
                            categories.find(c => c.id === categoryId);

        if (categoryInfo) {
            const color = categoryInfo.color || '#9ca3af';
            const name = categoryInfo.name || categoryId;

            html.push(`
                <span class="tag-count-badge" style="border-color: ${color};">
                    <span class="tag-color-dot" style="background: ${color};"></span>
                    ${name}: ${count}
                </span>
            `);
        }
    }

    return html.join('');
}

/**
 * Toggle scene expansion
 */
export function toggleSceneExpand(sceneIndex) {
    if (expandedScenes.has(sceneIndex)) {
        expandedScenes.delete(sceneIndex);
    } else {
        expandedScenes.add(sceneIndex);
    }

    renderSceneList();
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

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

// Make functions available globally for HTML onclick handlers (legacy support)
window.renderSceneList = renderSceneList;
window.toggleSceneExpand = toggleSceneExpand;
