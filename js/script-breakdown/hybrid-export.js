/**
 * hybrid-export.js
 * Export functionality for hybrid breakdown system
 *
 * Provides export functions with full audit trail:
 * - JSON export with complete metadata
 * - CSV export for scene-by-scene breakdown
 * - Integration with existing export system
 */

import { state } from './main.js';

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Export hybrid breakdown to JSON
 */
export function exportHybridBreakdownJSON() {
    const manager = window.hybridBreakdownManager;
    if (!manager) {
        throw new Error('Hybrid breakdown manager not available');
    }

    const breakdown = manager.exportBreakdown();

    // Create download
    const dataStr = JSON.stringify(breakdown, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `hybrid-breakdown-${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);
}

/**
 * Export hybrid breakdown to CSV
 */
export function exportHybridBreakdownCSV() {
    const manager = window.hybridBreakdownManager;
    if (!manager) {
        throw new Error('Hybrid breakdown manager not available');
    }

    const breakdown = manager.exportBreakdown();

    // Build CSV content
    let csv = 'Scene,Heading,Status,Total Suggestions,Pending,Accepted,Rejected,Confirmed Items,Manual Items\n';

    breakdown.scenes.forEach(scene => {
        const stats = scene.statistics;
        csv += `"${scene.sceneNumber}",`;
        csv += `"${escapeCSV(scene.heading)}",`;
        csv += `"${scene.reviewStatus}",`;
        csv += `${stats.totalSuggestions},`;
        csv += `${stats.pendingSuggestions},`;
        csv += `${stats.acceptedSuggestions},`;
        csv += `${stats.rejectedSuggestions},`;
        csv += `${stats.confirmedItems},`;
        csv += `${stats.manualItems}\n`;
    });

    // Create download
    const dataBlob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `hybrid-breakdown-summary-${Date.now()}.csv`;
    link.click();

    URL.revokeObjectURL(url);
}

/**
 * Export detailed continuity items to CSV
 */
export function exportHybridContinuityCSV() {
    const manager = window.hybridBreakdownManager;
    if (!manager) {
        throw new Error('Hybrid breakdown manager not available');
    }

    const breakdown = manager.exportBreakdown();

    // Build CSV content
    let csv = 'Scene,Heading,Character,Category,Description,Source,Status\n';

    breakdown.scenes.forEach(scene => {
        // Add confirmed items
        scene.confirmedItems.forEach(item => {
            csv += `"${scene.sceneNumber}",`;
            csv += `"${escapeCSV(scene.heading)}",`;
            csv += `"${escapeCSV(item.character)}",`;
            csv += `"${item.category}",`;
            csv += `"${escapeCSV(item.description)}",`;
            csv += `"${item.source}",`;
            csv += `"Confirmed"\n`;
        });

        // Add manual items
        scene.manualAdditions.forEach(item => {
            csv += `"${scene.sceneNumber}",`;
            csv += `"${escapeCSV(scene.heading)}",`;
            csv += `"${escapeCSV(item.character)}",`;
            csv += `"${item.category}",`;
            csv += `"${escapeCSV(item.description)}",`;
            csv += `"manual",`;
            csv += `"Manual"\n`;
        });

        // Add pending suggestions
        scene.suggestions
            .filter(s => s.status === 'pending')
            .forEach(item => {
                csv += `"${scene.sceneNumber}",`;
                csv += `"${escapeCSV(scene.heading)}",`;
                csv += `"${escapeCSV(item.character)}",`;
                csv += `"${item.category}",`;
                csv += `"${escapeCSV(item.description)}",`;
                csv += `"AI",`;
                csv += `"${item.statusLabel}"\n`;
            });
    });

    // Create download
    const dataBlob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `hybrid-breakdown-continuity-${Date.now()}.csv`;
    link.click();

    URL.revokeObjectURL(url);
}

/**
 * Get hybrid breakdown data for integration with existing exports
 */
export function getHybridBreakdownData() {
    const manager = window.hybridBreakdownManager;
    if (!manager) return null;

    return manager.exportBreakdown();
}

/**
 * Generate HTML report for hybrid breakdown
 */
export function exportHybridBreakdownHTML() {
    const manager = window.hybridBreakdownManager;
    if (!manager) {
        throw new Error('Hybrid breakdown manager not available');
    }

    const breakdown = manager.exportBreakdown();
    const progress = breakdown.reviewProgress;

    // Build HTML
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hybrid Breakdown Report - ${breakdown.script}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f5f5f5;
            color: #333;
            padding: 40px 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        }
        h1 { font-size: 2em; margin-bottom: 10px; color: #1a1a1a; }
        h2 { font-size: 1.5em; margin-top: 40px; margin-bottom: 20px; color: #2a2a2a; }
        h3 { font-size: 1.2em; margin-top: 30px; margin-bottom: 15px; color: #3a3a3a; }

        .header {
            border-bottom: 3px solid #d4af7a;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }

        .meta {
            color: #666;
            font-size: 0.9em;
            margin-top: 10px;
        }

        .progress-section {
            background: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }

        .progress-bar {
            width: 100%;
            height: 30px;
            background: #e0e0e0;
            border-radius: 15px;
            overflow: hidden;
            margin: 15px 0;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #d4af7a 0%, #e0c08f 100%);
            transition: width 0.5s ease;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
        }

        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #d4af7a;
        }

        .stat-label {
            color: #666;
            font-size: 0.9em;
            margin-top: 5px;
        }

        .scene-card {
            background: #fafafa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #d4af7a;
        }

        .scene-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .scene-number {
            font-weight: bold;
            font-size: 1.2em;
        }

        .scene-status {
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: 600;
        }

        .status-completed {
            background: #d4edda;
            color: #155724;
        }

        .status-in-progress {
            background: #fff3cd;
            color: #856404;
        }

        .status-not-started {
            background: #f8d7da;
            color: #721c24;
        }

        .item {
            background: white;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 10px;
            border-left: 3px solid #ccc;
        }

        .item.confirmed { border-left-color: #10b981; }
        .item.manual { border-left-color: #a855f7; }
        .item.pending { border-left-color: #fbbf24; }

        .item-header {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 8px;
        }

        .character-name {
            font-weight: 600;
        }

        .category-badge {
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.75em;
            background: #e0e0e0;
            color: #555;
        }

        .source-badge {
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.75em;
            background: #d4af7a;
            color: white;
        }

        .item-description {
            color: #444;
            line-height: 1.5;
        }

        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${breakdown.script}</h1>
            <div class="meta">
                Hybrid AI-Assisted Breakdown Report<br>
                Generated: ${new Date(breakdown.exportedAt).toLocaleString()}
            </div>
        </div>

        <div class="progress-section">
            <h2>Review Progress</h2>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress.percentage}%"></div>
            </div>
            <p style="text-align: center; color: #666; margin-top: 10px;">
                ${progress.completed} of ${progress.total} scenes reviewed (${Math.round(progress.percentage)}%)
            </p>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${progress.completed}</div>
                    <div class="stat-label">Completed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${progress.inProgress}</div>
                    <div class="stat-label">In Progress</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${progress.notStarted}</div>
                    <div class="stat-label">Not Started</div>
                </div>
            </div>
        </div>

        <h2>Scene Breakdown</h2>
    `;

    // Add each scene
    breakdown.scenes.forEach(scene => {
        const statusClass = scene.reviewStatus.replace('-', '');
        const statusLabel = scene.reviewStatus.replace(/-/g, ' ').toUpperCase();

        html += `
        <div class="scene-card">
            <div class="scene-header">
                <div>
                    <div class="scene-number">Scene ${scene.sceneNumber}</div>
                    <div style="color: #666; font-size: 0.9em; margin-top: 5px;">${escapeHTML(scene.heading)}</div>
                </div>
                <div class="scene-status status-${statusClass}">${statusLabel}</div>
            </div>
        `;

        // Add confirmed items
        if (scene.confirmedItems.length > 0) {
            html += '<h3>Confirmed Items</h3>';
            scene.confirmedItems.forEach(item => {
                html += `
                <div class="item confirmed">
                    <div class="item-header">
                        <span class="character-name">${escapeHTML(item.character)}</span>
                        <span class="category-badge">${item.category}</span>
                        <span class="source-badge">${item.source}</span>
                    </div>
                    <div class="item-description">${escapeHTML(item.description)}</div>
                </div>
                `;
            });
        }

        // Add manual items
        if (scene.manualAdditions.length > 0) {
            html += '<h3>Manual Additions</h3>';
            scene.manualAdditions.forEach(item => {
                html += `
                <div class="item manual">
                    <div class="item-header">
                        <span class="character-name">${escapeHTML(item.character)}</span>
                        <span class="category-badge">${item.category}</span>
                        <span class="source-badge">MANUAL</span>
                    </div>
                    <div class="item-description">${escapeHTML(item.description)}</div>
                </div>
                `;
            });
        }

        // Add pending suggestions
        const pendingSuggestions = scene.suggestions.filter(s => s.status === 'pending');
        if (pendingSuggestions.length > 0) {
            html += '<h3>Pending AI Suggestions</h3>';
            pendingSuggestions.forEach(item => {
                html += `
                <div class="item pending">
                    <div class="item-header">
                        <span class="character-name">${escapeHTML(item.character)}</span>
                        <span class="category-badge">${item.category}</span>
                        <span class="source-badge">AI (${item.confidence}%)</span>
                    </div>
                    <div class="item-description">${escapeHTML(item.description)}</div>
                </div>
                `;
            });
        }

        html += '</div>';
    });

    html += `
    </div>
</body>
</html>
    `;

    // Create download
    const dataBlob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `hybrid-breakdown-report-${Date.now()}.html`;
    link.click();

    URL.revokeObjectURL(url);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Escape CSV values
 */
function escapeCSV(str) {
    if (!str) return '';
    return str.replace(/"/g, '""');
}

/**
 * Escape HTML
 */
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.exportHybridBreakdownJSON = exportHybridBreakdownJSON;
window.exportHybridBreakdownCSV = exportHybridBreakdownCSV;
window.exportHybridContinuityCSV = exportHybridContinuityCSV;
window.exportHybridBreakdownHTML = exportHybridBreakdownHTML;

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    exportHybridBreakdownJSON,
    exportHybridBreakdownCSV,
    exportHybridContinuityCSV,
    exportHybridBreakdownHTML,
    getHybridBreakdownData
};
