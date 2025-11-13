/**
 * hybrid-renderer.js
 * Rendering functions for hybrid breakdown system
 *
 * Provides rendering for:
 * - Scene review interface with suggestions
 * - Progress tracking display
 * - Suggestion cards with action buttons
 * - Confirmed and manual items display
 */

import { state } from './main.js';
import { SuggestionStatus, ReviewStatus } from './hybrid-breakdown-manager.js';

// ============================================================================
// MAIN RENDER FUNCTIONS
// ============================================================================

/**
 * Render hybrid breakdown view for a scene
 */
export function renderHybridSceneBreakdown(sceneIndex) {
    const manager = window.hybridBreakdownManager;
    if (!manager) return '';

    const scene = state.scenes[sceneIndex];
    if (!scene) return '<div class="empty-state">Scene not found</div>';

    const suggestions = manager.getSuggestionsForScene(sceneIndex);
    const confirmed = manager.getConfirmedForScene(sceneIndex);
    const manual = manager.getManualForScene(sceneIndex);
    const reviewStatus = manager.getSceneReviewStatus(sceneIndex);
    const progress = manager.getReviewProgress();

    return `
        <div class="hybrid-breakdown-container">
            ${renderProgressBar(progress)}
            ${renderSceneHeader(scene, sceneIndex, reviewStatus)}
            ${renderSuggestionsSection(suggestions, sceneIndex)}
            ${renderConfirmedSection(confirmed, sceneIndex)}
            ${renderManualSection(manual, sceneIndex)}
            ${renderSceneNavigation(sceneIndex, reviewStatus)}
        </div>
    `;
}

/**
 * Render progress bar
 */
function renderProgressBar(progress) {
    return `
        <div class="review-progress-container">
            <div class="progress-bar-wrapper">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress.percentage}%"></div>
                </div>
                <div class="progress-stats">
                    <span class="progress-label">Review Progress:</span>
                    <span class="progress-numbers">
                        ${progress.completed} of ${progress.total} scenes
                        (${Math.round(progress.percentage)}%)
                    </span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render scene header with status
 */
function renderSceneHeader(scene, sceneIndex, reviewStatus) {
    const statusBadge = getStatusBadge(reviewStatus);

    return `
        <div class="scene-review-header">
            <div class="scene-title-section">
                <h3 class="scene-title">Scene ${scene.number}</h3>
                <div class="scene-heading">${escapeHtml(scene.heading)}</div>
            </div>
            <div class="review-status-section">
                ${statusBadge}
            </div>
        </div>
    `;
}

/**
 * Render suggestions section
 */
function renderSuggestionsSection(suggestions, sceneIndex) {
    const pending = suggestions.filter(s => s.status === SuggestionStatus.PENDING);
    const accepted = suggestions.filter(s => s.status === SuggestionStatus.ACCEPTED);
    const rejected = suggestions.filter(s => s.status === SuggestionStatus.REJECTED);

    if (suggestions.length === 0) {
        return `
            <div class="suggestions-section empty">
                <div class="section-header">
                    <h4 class="section-title">AI Suggestions</h4>
                </div>
                <div class="empty-state">
                    <div class="empty-icon">🤖</div>
                    <div class="empty-message">No AI suggestions available</div>
                    <button onclick="generateSuggestions()" class="btn-primary">
                        Generate Suggestions
                    </button>
                </div>
            </div>
        `;
    }

    return `
        <div class="suggestions-section">
            <div class="section-header">
                <h4 class="section-title">
                    AI Suggestions
                    <span class="count-badge">${pending.length} pending</span>
                </h4>
                ${pending.length > 0 ? `
                    <button onclick="acceptAllSuggestions()" class="btn-accept-all">
                        Accept All Pending
                    </button>
                ` : ''}
            </div>

            <div class="suggestion-list">
                ${suggestions.map(s => renderSuggestionCard(s)).join('')}
            </div>

            ${suggestions.length > 0 ? `
                <div class="suggestions-summary">
                    ${accepted.length > 0 ? `<span class="summary-item accepted">${accepted.length} accepted</span>` : ''}
                    ${rejected.length > 0 ? `<span class="summary-item rejected">${rejected.length} rejected</span>` : ''}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render a single suggestion card
 */
function renderSuggestionCard(suggestion) {
    const statusClass = suggestion.status;
    const isPending = suggestion.status === SuggestionStatus.PENDING;

    return `
        <div class="suggestion-item ${statusClass}"
             data-suggestion-id="${suggestion.id}">
            <div class="suggestion-content">
                <div class="suggestion-header">
                    <span class="character-name">${escapeHtml(suggestion.character)}</span>
                    <span class="suggestion-type ${suggestion.category}">
                        ${getCategoryLabel(suggestion.category)}
                    </span>
                    ${suggestion.confidence ? `
                        <span class="confidence">
                            ${suggestion.confidence}% confident
                        </span>
                    ` : ''}
                </div>
                <div class="suggestion-description">
                    ${escapeHtml(suggestion.description)}
                </div>
                ${suggestion.metadata ? renderSuggestionMetadata(suggestion.metadata) : ''}
            </div>

            ${isPending ? `
                <div class="suggestion-actions">
                    <button onclick="acceptSuggestion('${suggestion.id}')"
                            class="action-btn accept-btn"
                            title="Accept">
                        <span class="btn-icon">✓</span>
                        <span class="btn-label">Accept</span>
                    </button>
                    <button onclick="editSuggestion('${suggestion.id}')"
                            class="action-btn edit-btn"
                            title="Edit">
                        <span class="btn-icon">✏️</span>
                        <span class="btn-label">Edit</span>
                    </button>
                    <button onclick="rejectSuggestion('${suggestion.id}')"
                            class="action-btn reject-btn"
                            title="Reject">
                        <span class="btn-icon">✗</span>
                        <span class="btn-label">Reject</span>
                    </button>
                </div>
            ` : `
                <div class="suggestion-status-label">
                    ${getStatusLabel(suggestion.status)}
                </div>
            `}
        </div>
    `;
}

/**
 * Render suggestion metadata
 */
function renderSuggestionMetadata(metadata) {
    const parts = [];

    if (metadata.severity) {
        parts.push(`Severity: ${metadata.severity}`);
    }

    if (metadata.duration) {
        parts.push(`Duration: ${metadata.duration}`);
    }

    if (parts.length === 0) return '';

    return `
        <div class="suggestion-metadata">
            ${parts.map(p => `<span class="metadata-tag">${p}</span>`).join('')}
        </div>
    `;
}

/**
 * Render confirmed items section
 */
function renderConfirmedSection(confirmed, sceneIndex) {
    if (confirmed.length === 0) return '';

    return `
        <div class="confirmed-section">
            <div class="section-header">
                <h4 class="section-title">
                    Confirmed Items
                    <span class="count-badge">${confirmed.length}</span>
                </h4>
            </div>

            <div class="confirmed-list">
                ${confirmed.map(item => renderConfirmedItem(item, sceneIndex)).join('')}
            </div>
        </div>
    `;
}

/**
 * Render a confirmed item
 */
function renderConfirmedItem(item, sceneIndex) {
    return `
        <div class="confirmed-item">
            <div class="item-content">
                <div class="item-header">
                    <span class="character-name">${escapeHtml(item.character)}</span>
                    <span class="item-type ${item.category}">
                        ${getCategoryLabel(item.category)}
                    </span>
                    <span class="item-source">
                        ${getSourceLabel(item.source)}
                    </span>
                </div>
                <div class="item-description">
                    ${escapeHtml(item.description)}
                </div>
            </div>
            <div class="item-actions">
                <button onclick="deleteItem(${sceneIndex}, '${item.id}', false)"
                        class="action-btn delete-btn"
                        title="Delete">
                    <span class="btn-icon">🗑️</span>
                </button>
            </div>
        </div>
    `;
}

/**
 * Render manual additions section
 */
function renderManualSection(manual, sceneIndex) {
    return `
        <div class="manual-section">
            <div class="section-header">
                <h4 class="section-title">
                    Your Additions
                    ${manual.length > 0 ? `<span class="count-badge">${manual.length}</span>` : ''}
                </h4>
                <button onclick="quickAddContinuity()" class="btn-add">
                    <span class="btn-icon">+</span>
                    Add Item
                </button>
            </div>

            ${manual.length > 0 ? `
                <div class="manual-list">
                    ${manual.map(item => renderManualItem(item, sceneIndex)).join('')}
                </div>
            ` : `
                <div class="empty-state-small">
                    Click "Add Item" to manually add continuity elements
                </div>
            `}
        </div>
    `;
}

/**
 * Render a manual item
 */
function renderManualItem(item, sceneIndex) {
    return `
        <div class="manual-item">
            <div class="item-content">
                <div class="item-header">
                    <span class="character-name">${escapeHtml(item.character)}</span>
                    <span class="item-type ${item.category}">
                        ${getCategoryLabel(item.category)}
                    </span>
                    ${item.importance ? `
                        <span class="importance-badge">
                            Priority: ${item.importance}/10
                        </span>
                    ` : ''}
                </div>
                <div class="item-description">
                    ${escapeHtml(item.description)}
                </div>
                ${item.duration ? `
                    <div class="item-duration">
                        Duration: ${escapeHtml(item.duration)}
                    </div>
                ` : ''}
                ${item.notes ? `
                    <div class="item-notes">
                        <strong>Notes:</strong> ${escapeHtml(item.notes)}
                    </div>
                ` : ''}
            </div>
            <div class="item-actions">
                <button onclick="deleteItem(${sceneIndex}, '${item.id}', true)"
                        class="action-btn delete-btn"
                        title="Delete">
                    <span class="btn-icon">🗑️</span>
                </button>
            </div>
        </div>
    `;
}

/**
 * Render scene navigation controls
 */
function renderSceneNavigation(sceneIndex, reviewStatus) {
    const isFirstScene = sceneIndex === 0;
    const isLastScene = sceneIndex === state.scenes.length - 1;
    const isCompleted = reviewStatus === ReviewStatus.COMPLETED;

    return `
        <div class="scene-navigation">
            <div class="nav-buttons">
                <button onclick="previousScene()"
                        class="nav-btn prev-btn"
                        ${isFirstScene ? 'disabled' : ''}>
                    <span class="btn-icon">←</span>
                    Previous Scene
                </button>

                <button onclick="markSceneComplete()"
                        class="complete-btn ${isCompleted ? 'completed' : ''}">
                    ${isCompleted ? '✓ Completed' : 'Mark Complete'}
                </button>

                <button onclick="nextScene()"
                        class="nav-btn next-btn"
                        ${isLastScene ? 'disabled' : ''}>
                    Next Scene
                    <span class="btn-icon">→</span>
                </button>
            </div>
        </div>
    `;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get status badge HTML
 */
function getStatusBadge(reviewStatus) {
    let className = 'status-badge';
    let label = 'Not Started';

    switch (reviewStatus) {
        case ReviewStatus.IN_PROGRESS:
            className += ' in-progress';
            label = 'In Progress';
            break;
        case ReviewStatus.COMPLETED:
            className += ' completed';
            label = 'Completed';
            break;
        default:
            className += ' not-started';
            break;
    }

    return `<span class="${className}">${label}</span>`;
}

/**
 * Get status label
 */
function getStatusLabel(status) {
    switch (status) {
        case SuggestionStatus.ACCEPTED:
            return '✓ Accepted';
        case SuggestionStatus.REJECTED:
            return '✗ Rejected';
        case SuggestionStatus.EDITED:
            return '✏️ Edited & Accepted';
        default:
            return 'Pending';
    }
}

/**
 * Get category label
 */
function getCategoryLabel(category) {
    const labels = {
        injuries: 'Injury',
        hair: 'Hair',
        makeup: 'Makeup',
        wardrobe: 'Wardrobe',
        condition: 'Condition',
        props: 'Props',
        other: 'Other'
    };

    return labels[category] || category;
}

/**
 * Get source label
 */
function getSourceLabel(source) {
    switch (source) {
        case 'ai-suggestion':
            return 'AI';
        case 'ai-suggestion-edited':
            return 'AI (Edited)';
        case 'manual':
            return 'Manual';
        default:
            return source;
    }
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Render hybrid breakdown toolbar button
 */
export function renderHybridToolbarButton() {
    const manager = window.hybridBreakdownManager;
    if (!manager) return '';

    const progress = manager.getReviewProgress();
    const hasSuggestions = progress.total > 0;

    return `
        <button class="toolbar-btn hybrid-mode-btn ${hasSuggestions ? 'has-suggestions' : ''}"
                onclick="toggleHybridMode()"
                title="Hybrid AI-Assisted Mode">
            🤖 Hybrid Mode
            ${progress.completed > 0 ? `<span class="progress-badge">${progress.completed}/${progress.total}</span>` : ''}
        </button>
    `;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    renderHybridSceneBreakdown,
    renderHybridToolbarButton
};
