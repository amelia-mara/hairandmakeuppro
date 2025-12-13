/**
 * export-html.js
 * HTML export functionality for timelines, lookbooks, and bibles
 *
 * Responsibilities:
 * - Export timeline as HTML
 * - Export lookbook as HTML
 * - Export comprehensive continuity bible
 * - Generate HTML documents with styling
 */

import { state } from '../main.js';
import { showToast, downloadFile } from './export-core.js';
import { getCharacterTimeline, getCharacterLookbook, getCharacterContinuity } from './export-generation.js';

/**
 * Export character timelines as HTML
 */
export function exportTimeline() {
    const timelines = {};

    const characters = window.confirmedCharacters || [];
    characters.forEach(character => {
        const timeline = getCharacterTimeline(character);
        if (timeline) {
            timelines[character] = timeline;
        }
    });

    if (Object.keys(timelines).length === 0) {
        alert('No timelines generated yet. Please generate character timelines first.');
        return;
    }

    const html = generateTimelineHTML(timelines);
    downloadFile('character-timelines.html', html, 'text/html');
    showToast('Timeline exported successfully', 'success');
}

/**
 * Export character lookbooks as HTML
 */
export function exportLookbook() {
    const lookbooks = {};

    const characters = window.confirmedCharacters || [];
    characters.forEach(character => {
        const lookbook = getCharacterLookbook(character);
        if (lookbook) {
            lookbooks[character] = lookbook;
        }
    });

    if (Object.keys(lookbooks).length === 0) {
        alert('No lookbooks generated yet. Please generate character lookbooks first.');
        return;
    }

    const html = generateLookbookHTML(lookbooks);
    downloadFile('character-lookbooks.html', html, 'text/html');
    showToast('Lookbook exported successfully', 'success');
}

/**
 * Export comprehensive continuity bible
 */
export function exportBible() {
    const characters = window.confirmedCharacters || [];

    if (characters.length === 0) {
        alert('No characters found. Please detect characters first.');
        return;
    }

    const bible = {
        script: state.scriptData?.title || 'Untitled',
        generatedAt: new Date().toISOString(),
        totalScenes: state.scenes?.length || 0,
        characters: {},
        metadata: {
            narrativeContext: window.scriptNarrativeContext || null
        }
    };

    characters.forEach(character => {
        bible.characters[character] = {
            timeline: getCharacterTimeline(character),
            lookbook: getCharacterLookbook(character),
            continuity: getCharacterContinuity(character)
        };
    });

    const html = generateBibleHTML(bible);
    downloadFile('continuity-bible.html', html, 'text/html');
    showToast('Continuity Bible exported successfully', 'success');
}

/**
 * Generate HTML for timeline export
 * @param {Object} timelines - Timeline data by character
 * @returns {string} HTML string
 */
function generateTimelineHTML(timelines) {
    const scriptTitle = state.scriptData?.title || 'Untitled';

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Character Timelines - ${scriptTitle}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 40px 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 20px rgba(0,0,0,0.1);
        }
        h1 { color: #1a1a1a; margin-bottom: 10px; font-size: 36px; }
        .subtitle { color: #666; margin-bottom: 40px; font-size: 18px; }
        .character-section { margin-bottom: 50px; page-break-inside: avoid; }
        .character-name {
            color: #c9a961;
            font-size: 28px;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #c9a961;
        }
        .timeline-item {
            background: #fafafa;
            padding: 20px;
            margin-bottom: 15px;
            border-left: 4px solid #c9a961;
            border-radius: 4px;
        }
        .scene-number { font-weight: bold; color: #c9a961; font-size: 16px; margin-bottom: 8px; }
        .description { margin-bottom: 12px; color: #444; }
        .label { font-weight: 600; color: #666; margin-bottom: 5px; }
        .tag {
            display: inline-block;
            background: #e8e8e8;
            padding: 4px 12px;
            border-radius: 12px;
            margin: 4px 4px 4px 0;
            font-size: 14px;
        }
        .emotional-state { color: #666; font-style: italic; margin-top: 8px; }
        .notes { margin-top: 10px; padding: 10px; background: white; border-radius: 4px; font-size: 14px; }
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Character Timelines</h1>
        <div class="subtitle">${scriptTitle}</div>
`;

    for (const [characterName, timelineData] of Object.entries(timelines)) {
        html += `
        <div class="character-section">
            <h2 class="character-name">${characterName}</h2>
            <p style="color: #666; margin-bottom: 20px;">Appears in ${timelineData.totalScenes} scenes</p>
`;

        if (timelineData.timeline && Array.isArray(timelineData.timeline)) {
            timelineData.timeline.forEach(item => {
                html += `
            <div class="timeline-item">
                <div class="scene-number">Scene ${item.sceneNumber}</div>
                <div class="description">${item.description || 'No description'}</div>
`;
                if (item.changes && item.changes.length > 0) {
                    html += `
                <div class="changes">
                    <div class="label">Appearance:</div>
                    ${item.changes.map(change => `<span class="tag">${change}</span>`).join('')}
                </div>
`;
                }
                if (item.injuries && item.injuries.length > 0) {
                    html += `
                <div class="injuries">
                    <div class="label">Injuries/Special FX:</div>
                    ${item.injuries.map(injury => `<span class="tag">${injury}</span>`).join('')}
                </div>
`;
                }
                if (item.emotional_state) {
                    html += `<div class="emotional-state">Emotional state: ${item.emotional_state}</div>`;
                }
                if (item.notes) {
                    html += `<div class="notes">${item.notes}</div>`;
                }
                html += `
            </div>
`;
            });
        }

        html += `
        </div>
`;
    }

    html += `
    </div>
</body>
</html>`;

    return html;
}

/**
 * Generate HTML for lookbook export
 * @param {Object} lookbooks - Lookbook data by character
 * @returns {string} HTML string
 */
function generateLookbookHTML(lookbooks) {
    const scriptTitle = state.scriptData?.title || 'Untitled';

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Character Lookbooks - ${scriptTitle}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 40px 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 20px rgba(0,0,0,0.1);
        }
        h1 { color: #1a1a1a; margin-bottom: 10px; font-size: 36px; }
        .subtitle { color: #666; margin-bottom: 40px; font-size: 18px; }
        .character-section { margin-bottom: 60px; page-break-inside: avoid; }
        .character-name {
            color: #c9a961;
            font-size: 32px;
            margin-bottom: 30px;
            padding-bottom: 15px;
            border-bottom: 3px solid #c9a961;
        }
        .section { margin-bottom: 30px; }
        .section-title { font-size: 20px; color: #444; margin-bottom: 15px; font-weight: 600; }
        .base-appearance { background: #fafafa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .appearance-item { margin-bottom: 12px; }
        .appearance-label { font-weight: 600; color: #666; margin-right: 8px; }
        .phase-card {
            background: #fafafa;
            padding: 20px;
            margin-bottom: 15px;
            border-left: 4px solid #c9a961;
            border-radius: 4px;
        }
        .phase-header { font-weight: 600; color: #c9a961; font-size: 18px; margin-bottom: 10px; }
        .phase-scenes { color: #666; font-size: 14px; margin-bottom: 12px; }
        .tag {
            display: inline-block;
            background: #e8e8e8;
            padding: 6px 14px;
            border-radius: 16px;
            margin: 4px 4px 4px 0;
            font-size: 14px;
        }
        ul { list-style-position: inside; margin-left: 10px; }
        li { margin-bottom: 8px; }
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Character Lookbooks</h1>
        <div class="subtitle">${scriptTitle} - Hair & Makeup Department Reference</div>
`;

    for (const [characterName, lookbookData] of Object.entries(lookbooks)) {
        html += `
        <div class="character-section">
            <h2 class="character-name">${characterName}</h2>
`;

        if (lookbookData.baseAppearance) {
            const base = lookbookData.baseAppearance;
            html += `
            <div class="section">
                <div class="section-title">Base Appearance</div>
                <div class="base-appearance">
                    <div class="appearance-item">
                        <span class="appearance-label">Hair:</span>
                        <span>${base.hair || 'Not specified'}</span>
                    </div>
                    <div class="appearance-item">
                        <span class="appearance-label">Makeup:</span>
                        <span>${base.makeup || 'Not specified'}</span>
                    </div>
                    <div class="appearance-item">
                        <span class="appearance-label">Skin Tone:</span>
                        <span>${base.skinTone || 'Not specified'}</span>
                    </div>
`;
            if (base.specialFeatures && base.specialFeatures.length > 0) {
                html += `
                    <div class="appearance-item">
                        <span class="appearance-label">Special Features:</span>
                        ${base.specialFeatures.map(f => `<span class="tag">${f}</span>`).join('')}
                    </div>
`;
            }
            html += `
                </div>
            </div>
`;
        }

        if (lookbookData.looksByPhase && lookbookData.looksByPhase.length > 0) {
            html += `
            <div class="section">
                <div class="section-title">Looks by Story Phase</div>
`;
            lookbookData.looksByPhase.forEach(phase => {
                html += `
                <div class="phase-card">
                    <div class="phase-header">${phase.phase || 'Unknown Phase'}</div>
                    <div class="phase-scenes">Scenes: ${phase.scenes || 'Not specified'}</div>
                    <p style="margin-bottom: 12px;">${phase.description || ''}</p>
                    ${phase.hair ? `<div style="margin-bottom: 8px;"><strong>Hair:</strong> ${phase.hair}</div>` : ''}
                    ${phase.makeup ? `<div style="margin-bottom: 8px;"><strong>Makeup:</strong> ${phase.makeup}</div>` : ''}
                    ${phase.continuity && phase.continuity.length > 0 ? `
                    <div style="margin-top: 12px;">
                        <strong>Continuity Notes:</strong>
                        <ul>${phase.continuity.map(note => `<li>${note}</li>`).join('')}</ul>
                    </div>
                    ` : ''}
                </div>
`;
            });
            html += `
            </div>
`;
        }

        if (lookbookData.specialRequirements && lookbookData.specialRequirements.length > 0) {
            html += `
            <div class="section">
                <div class="section-title">Special Requirements</div>
                <ul>${lookbookData.specialRequirements.map(req => `<li>${req}</li>`).join('')}</ul>
            </div>
`;
        }

        if (lookbookData.departmentNotes) {
            const notes = lookbookData.departmentNotes;
            html += `
            <div class="section">
                <div class="section-title">Department Notes</div>
`;
            if (notes.hair && notes.hair.length > 0) {
                html += `
                <div style="margin-bottom: 15px;">
                    <strong>Hair Department:</strong>
                    <ul>${notes.hair.map(note => `<li>${note}</li>`).join('')}</ul>
                </div>
`;
            }
            if (notes.makeup && notes.makeup.length > 0) {
                html += `
                <div style="margin-bottom: 15px;">
                    <strong>Makeup Department:</strong>
                    <ul>${notes.makeup.map(note => `<li>${note}</li>`).join('')}</ul>
                </div>
`;
            }
            html += `
            </div>
`;
        }

        html += `
        </div>
`;
    }

    html += `
    </div>
</body>
</html>`;

    return html;
}

/**
 * Generate comprehensive continuity bible HTML
 * @param {Object} bible - Bible data
 * @returns {string} HTML string
 */
function generateBibleHTML(bible) {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Continuity Bible - ${bible.script}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 40px 20px;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            padding: 50px;
            border-radius: 12px;
            box-shadow: 0 2px 20px rgba(0,0,0,0.1);
        }
        .cover {
            text-align: center;
            padding: 60px 20px;
            border-bottom: 3px solid #c9a961;
            margin-bottom: 50px;
        }
        h1 { color: #1a1a1a; margin-bottom: 20px; font-size: 48px; }
        .subtitle { color: #666; font-size: 24px; margin-bottom: 10px; }
        .meta { color: #999; font-size: 14px; margin-top: 20px; }
        .toc { margin-bottom: 50px; padding: 30px; background: #fafafa; border-radius: 8px; }
        .toc h2 { color: #c9a961; margin-bottom: 20px; }
        .toc ul { list-style: none; }
        .toc li { margin-bottom: 10px; padding-left: 20px; }
        .toc a { color: #333; text-decoration: none; }
        .toc a:hover { color: #c9a961; }
        .character-section { margin-bottom: 80px; page-break-inside: avoid; }
        .character-name {
            color: #c9a961;
            font-size: 36px;
            margin-bottom: 40px;
            padding-bottom: 15px;
            border-bottom: 3px solid #c9a961;
        }
        .subsection { margin-bottom: 40px; }
        .subsection-title { font-size: 24px; color: #444; margin-bottom: 20px; font-weight: 600; }
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
            .character-section { page-break-before: always; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="cover">
            <h1>Continuity Bible</h1>
            <div class="subtitle">${bible.script}</div>
            <div class="meta">
                Generated: ${new Date(bible.generatedAt).toLocaleString()}<br>
                Total Scenes: ${bible.totalScenes}
            </div>
        </div>

        <div class="toc">
            <h2>Table of Contents</h2>
            <ul>
`;

    for (const characterName of Object.keys(bible.characters)) {
        html += `                <li><a href="#char-${characterName.replace(/\s/g, '-')}">${characterName}</a></li>\n`;
    }

    html += `
            </ul>
        </div>
`;

    for (const [characterName, data] of Object.entries(bible.characters)) {
        html += `
        <div class="character-section" id="char-${characterName.replace(/\s/g, '-')}">
            <h2 class="character-name">${characterName}</h2>
`;

        if (data.timeline && data.timeline.timeline) {
            html += `
            <div class="subsection">
                <h3 class="subsection-title">Timeline</h3>
                ${generateTimelineSection(data.timeline)}
            </div>
`;
        }

        if (data.lookbook) {
            html += `
            <div class="subsection">
                <h3 class="subsection-title">Lookbook</h3>
                ${generateLookbookSection(data.lookbook)}
            </div>
`;
        }

        html += `
        </div>
`;
    }

    html += `
    </div>
</body>
</html>`;

    return html;
}

/**
 * Helper function to generate timeline section for bible
 * @param {Object} timelineData - Timeline data
 * @returns {string} HTML string
 */
function generateTimelineSection(timelineData) {
    let html = `<div style="background: #fafafa; padding: 20px; border-radius: 8px;">`;

    if (timelineData.timeline && Array.isArray(timelineData.timeline)) {
        timelineData.timeline.forEach(item => {
            html += `
            <div style="margin-bottom: 20px; padding: 15px; background: white; border-left: 4px solid #c9a961; border-radius: 4px;">
                <div style="font-weight: bold; color: #c9a961; margin-bottom: 8px;">Scene ${item.sceneNumber}</div>
                <div style="margin-bottom: 8px;">${item.description || 'No description'}</div>
`;
            if (item.changes && item.changes.length > 0) {
                html += `<div style="margin-top: 8px;"><strong>Changes:</strong> ${item.changes.join(', ')}</div>`;
            }
            if (item.injuries && item.injuries.length > 0) {
                html += `<div style="margin-top: 8px;"><strong>Injuries:</strong> ${item.injuries.join(', ')}</div>`;
            }
            if (item.emotional_state) {
                html += `<div style="margin-top: 8px; font-style: italic;">Emotional state: ${item.emotional_state}</div>`;
            }
            html += `
            </div>
`;
        });
    }

    html += `</div>`;
    return html;
}

/**
 * Helper function to generate lookbook section for bible
 * @param {Object} lookbookData - Lookbook data
 * @returns {string} HTML string
 */
function generateLookbookSection(lookbookData) {
    let html = `<div style="background: #fafafa; padding: 20px; border-radius: 8px;">`;

    if (lookbookData.baseAppearance) {
        const base = lookbookData.baseAppearance;
        html += `
        <div style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 4px;">
            <strong>Base Appearance:</strong>
            <div style="margin-top: 8px;">Hair: ${base.hair || 'Not specified'}</div>
            <div>Makeup: ${base.makeup || 'Not specified'}</div>
            <div>Skin Tone: ${base.skinTone || 'Not specified'}</div>
        </div>
`;
    }

    if (lookbookData.looksByPhase && lookbookData.looksByPhase.length > 0) {
        html += `<div style="margin-top: 20px;"><strong>Looks by Phase:</strong></div>`;
        lookbookData.looksByPhase.forEach(phase => {
            html += `
            <div style="margin-top: 15px; padding: 15px; background: white; border-radius: 4px;">
                <div style="font-weight: bold; color: #c9a961;">${phase.phase || 'Unknown Phase'} (${phase.scenes || 'Scenes not specified'})</div>
                <div style="margin-top: 8px;">${phase.description || ''}</div>
                ${phase.hair ? `<div style="margin-top: 8px;"><strong>Hair:</strong> ${phase.hair}</div>` : ''}
                ${phase.makeup ? `<div style="margin-top: 8px;"><strong>Makeup:</strong> ${phase.makeup}</div>` : ''}
            </div>
`;
        });
    }

    html += `</div>`;
    return html;
}

// ============================================================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================================================

window.exportTimeline = exportTimeline;
window.exportLookbook = exportLookbook;
window.exportBible = exportBible;

export default {
    exportTimeline,
    exportLookbook,
    exportBible
};
