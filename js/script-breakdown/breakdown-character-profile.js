/**
 * breakdown-character-profile.js
 * Character profile view rendering
 *
 * Responsibilities:
 * - Render profile overview view
 * - Render script descriptions section
 * - Render physical profile section
 * - Render character analysis section
 * - Render visual profile section
 * - Render continuity notes section
 * - Handle profile view tab switching
 */

import { escapeHtml } from './breakdown-character-utils.js';

/**
 * Render comprehensive character profile view
 * Shows all collected data from initial analysis
 * @param {string} characterName - Character name
 * @returns {string} HTML for comprehensive profile view
 */
export function renderProfileView(characterName) {
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
 * @param {Object} characterData - Character data object
 * @returns {string} HTML for script descriptions section
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
 * @param {Object} characterData - Character data object
 * @returns {string} HTML for physical profile section
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
 * @param {Object} characterData - Character data object
 * @returns {string} HTML for character analysis section
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
 * @param {Object} characterData - Character data object
 * @returns {string} HTML for visual profile section
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
 * @param {Object} characterData - Character data object
 * @returns {string} HTML for continuity notes section
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
 * Switch between profile views (Lookbook, Timeline, Events)
 * @param {string} characterName - Character name
 * @param {string} viewType - View type ('profile', 'lookbook', 'timeline', 'events')
 */
export async function showProfileView(characterName, viewType) {
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
        profilePanel.querySelector(`.view-tab:nth-child(${tabIndex})`)?.classList.add('active');
    }

    // Render the appropriate view
    switch (viewType) {
        case 'profile':
            contentDiv.innerHTML = renderProfileView(characterName);
            break;
        case 'lookbook': {
            const { renderLookbookView } = await import('./breakdown-character-lookbook.js');
            contentDiv.innerHTML = renderLookbookView(characterName);
            break;
        }
        case 'timeline': {
            const { renderCharacterTimeline } = await import('./breakdown-character-timeline.js');
            contentDiv.innerHTML = renderCharacterTimeline(characterName);
            break;
        }
        case 'events': {
            const { renderEventsView } = await import('./breakdown-character-events.js');
            contentDiv.innerHTML = renderEventsView(characterName);
            break;
        }
    }
}

// Expose global function for HTML onclick handlers
window.showProfileView = showProfileView;

export default {
    renderProfileView,
    showProfileView
};
