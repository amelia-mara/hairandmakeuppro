/**
 * Lookbook Import Tab - Character Design
 * Hair & Makeup Pro
 */

// ═══════════════════════════════════════════════════════════════
// RENDER LOOKBOOK TAB
// ═══════════════════════════════════════════════════════════════

function renderLookbookTab() {
    const container = document.getElementById('lookbook-tab');
    if (!container) return;

    const characterName = window.currentCharacter;
    const castEntry = window.currentCastEntry;
    const looks = generateLooksFromBreakdown(characterName);
    const events = getContinuityEventsForCharacter(characterName);

    container.innerHTML = `
        <div class="lookbook-header">
            <p class="import-notice">Imported from Script Breakdown</p>
            <a href="script-breakdown.html" class="edit-link">Edit in Breakdown →</a>
        </div>

        <div class="looks-list" id="looks-list">
            ${looks.length > 0 ? looks.map(look => renderLookCard(look, castEntry)).join('') : `
                <div class="empty-state">
                    <h3>No Looks Defined</h3>
                    <p>Character looks will appear here once defined in the Script Breakdown.</p>
                </div>
            `}
        </div>

        ${events.length > 0 ? `
            <div class="continuity-events-section">
                <h3>CONTINUITY EVENTS</h3>
                <div class="events-list" id="events-list">
                    ${events.map(event => renderEventItem(event)).join('')}
                </div>
            </div>
        ` : ''}
    `;
}

// ═══════════════════════════════════════════════════════════════
// LOOK CARD RENDERING
// ═══════════════════════════════════════════════════════════════

function renderLookCard(look, castEntry) {
    const design = castEntry?.lookDesigns?.[look.id];
    const status = design?.status || 'not-started';
    const statusText = getStatusText(status);
    const scenesText = formatScenesText(look.scenes);

    return `
        <div class="look-card" data-look-id="${look.id}">

            <div class="look-card-header">
                <h3 class="look-name">${escapeHtml(look.name)}</h3>
                <span class="look-scenes">${scenesText}</span>
            </div>

            <div class="look-card-content">
                ${look.hair ? `
                    <div class="look-field">
                        <label>Hair</label>
                        <p>${escapeHtml(look.hair)}</p>
                    </div>
                ` : ''}

                ${look.makeup ? `
                    <div class="look-field">
                        <label>Makeup</label>
                        <p>${escapeHtml(look.makeup)}</p>
                    </div>
                ` : ''}

                ${look.notes ? `
                    <div class="look-field">
                        <label>Notes</label>
                        <p>${escapeHtml(look.notes)}</p>
                    </div>
                ` : ''}

                ${look.scenes && look.scenes.length > 0 ? `
                    <div class="look-applied">
                        <label>Applied</label>
                        <p>${formatAppliedScenes(look.scenes)}</p>
                    </div>
                ` : ''}
            </div>

            <div class="look-card-footer">
                <div class="design-status">
                    <span class="status-label">Design Status:</span>
                    <span class="status-value ${status}">${statusText}</span>
                </div>
                <button class="open-design-btn" onclick="openMoodboardForLook('${look.id}')">
                    Open Design Space
                </button>
            </div>

        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// CONTINUITY EVENTS
// ═══════════════════════════════════════════════════════════════

function getContinuityEventsForCharacter(characterName) {
    const events = [];
    const continuityEvents = window.breakdownState?.continuityEvents || {};
    const scenes = window.breakdownState?.scenes || [];

    Object.entries(continuityEvents).forEach(([sceneIdx, sceneEvents]) => {
        if (Array.isArray(sceneEvents)) {
            sceneEvents.forEach(event => {
                if (event.character === characterName || event.characters?.includes(characterName)) {
                    const scene = scenes[parseInt(sceneIdx)];
                    events.push({
                        sceneIdx: parseInt(sceneIdx),
                        sceneHeader: scene?.sceneHeading || `Scene ${parseInt(sceneIdx) + 1}`,
                        description: event.description || event.event || event.text || '',
                        type: event.type || 'general'
                    });
                }
            });
        } else if (typeof sceneEvents === 'object') {
            // Handle object format
            Object.entries(sceneEvents).forEach(([charName, charEvents]) => {
                if (charName === characterName) {
                    const scene = scenes[parseInt(sceneIdx)];
                    if (Array.isArray(charEvents)) {
                        charEvents.forEach(event => {
                            events.push({
                                sceneIdx: parseInt(sceneIdx),
                                sceneHeader: scene?.sceneHeading || `Scene ${parseInt(sceneIdx) + 1}`,
                                description: typeof event === 'string' ? event : (event.description || event.text || ''),
                                type: event.type || 'general'
                            });
                        });
                    } else if (typeof charEvents === 'string') {
                        events.push({
                            sceneIdx: parseInt(sceneIdx),
                            sceneHeader: scene?.sceneHeading || `Scene ${parseInt(sceneIdx) + 1}`,
                            description: charEvents,
                            type: 'general'
                        });
                    }
                }
            });
        }
    });

    // Sort by scene index
    events.sort((a, b) => a.sceneIdx - b.sceneIdx);

    return events;
}

function renderEventItem(event) {
    return `
        <div class="event-item">
            <div class="event-scene">${escapeHtml(event.sceneHeader)}</div>
            <div class="event-description">${escapeHtml(event.description)}</div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function getStatusText(status) {
    const statusMap = {
        'not-started': 'Not Started',
        'in-progress': 'In Progress',
        'complete': 'Complete'
    };
    return statusMap[status] || 'Not Started';
}

function formatScenesText(scenes) {
    if (!scenes || scenes.length === 0) return 'No scenes assigned';

    if (scenes.length === 1) return `Scene ${scenes[0] + 1}`;

    // Check if consecutive
    const sorted = [...scenes].sort((a, b) => a - b);
    let ranges = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === end + 1) {
            end = sorted[i];
        } else {
            ranges.push(start === end ? `${start + 1}` : `${start + 1}-${end + 1}`);
            start = sorted[i];
            end = sorted[i];
        }
    }
    ranges.push(start === end ? `${start + 1}` : `${start + 1}-${end + 1}`);

    return `Scenes ${ranges.join(', ')}`;
}

function formatAppliedScenes(scenes) {
    if (!scenes || scenes.length === 0) return 'Not specified';

    // Group scenes - simplified version
    return scenes.map(s => `Sc ${s + 1}`).join(', ');
}

function openMoodboardForLook(lookId) {
    // Store the selected look and switch to moodboard tab
    window.currentLookId = lookId;
    switchTab('moodboard');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally available
window.renderLookbookTab = renderLookbookTab;
window.openMoodboardForLook = openMoodboardForLook;
window.getContinuityEventsForCharacter = getContinuityEventsForCharacter;
