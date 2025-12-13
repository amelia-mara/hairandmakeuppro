/**
 * breakdown-character-profile.js
 * Character profile view rendering
 *
 * Responsibilities:
 * - Render profile overview view with new hierarchy:
 *   1. Physical Profile (manual entry, editable)
 *   2. Visual Identity (AI generated)
 *   3. Lookbook Summary (from breakdown data)
 *   4. Script Descriptions (auto-detected, collapsible)
 * - Handle profile data updates
 * - AI visual identity generation
 */

import { escapeHtml, getState, showToast } from './breakdown-character-utils.js';
import { generateLooksFromBreakdown } from './breakdown-character-lookbook.js';

/**
 * Normalize AI-detected physical profile field names to match form fields
 * The AI analysis uses different field names than the form expects
 * @param {Object} aiProfile - AI-detected physical attributes with original field names
 * @returns {Object} Normalized profile with form-compatible field names
 */
function normalizeAiPhysicalProfile(aiProfile) {
    if (!aiProfile) return {};

    // Map AI field names to form field names
    const normalized = {
        age: aiProfile.age || '',
        gender: aiProfile.gender || '',
        hairColour: aiProfile.hairColor || aiProfile.hairColour || aiProfile.hair_color || '',
        hairType: aiProfile.hairStyle || aiProfile.hairType || aiProfile.hair_style || '',
        eyeColour: aiProfile.eyeColor || aiProfile.eyeColour || aiProfile.eye_color || '',
        skinTone: aiProfile.skinTone || aiProfile.skin_tone || aiProfile.ethnicity || '',
        build: aiProfile.build || aiProfile.height || '',
        distinguishing: '',
        notes: ''
    };

    // Handle distinctive features (may be array)
    if (aiProfile.distinctiveFeatures) {
        normalized.distinguishing = Array.isArray(aiProfile.distinctiveFeatures)
            ? aiProfile.distinctiveFeatures.filter(f => f).join(', ')
            : aiProfile.distinctiveFeatures;
    } else if (aiProfile.distinctive_features) {
        normalized.distinguishing = Array.isArray(aiProfile.distinctive_features)
            ? aiProfile.distinctive_features.filter(f => f).join(', ')
            : aiProfile.distinctive_features;
    }

    return normalized;
}

/**
 * Merge AI-detected physical profile with user-edited profile
 * User values take priority over AI-detected values
 * @param {Object} aiProfile - AI-detected physical attributes
 * @param {Object} userProfile - User-edited physical attributes
 * @returns {Object} Merged profile
 */
function mergePhysicalProfiles(aiProfile, userProfile) {
    const fields = ['age', 'gender', 'hairColour', 'hairType', 'eyeColour', 'skinTone', 'build', 'distinguishing', 'notes'];
    const merged = {};

    // Normalize AI profile field names first
    const normalizedAi = normalizeAiPhysicalProfile(aiProfile);

    for (const field of fields) {
        // User value takes priority, fall back to AI value
        if (userProfile[field] !== undefined && userProfile[field] !== '') {
            merged[field] = userProfile[field];
        } else if (normalizedAi[field] !== undefined && normalizedAi[field] !== '') {
            merged[field] = normalizedAi[field];
        } else {
            merged[field] = '';
        }
    }

    return merged;
}

/**
 * Render comprehensive character profile view
 * Shows all collected data with new hierarchy
 * @param {string} characterName - Character name
 * @returns {string} HTML for comprehensive profile view
 */
export function renderProfileView(characterName) {
    const state = getState();
    const masterContext = window.scriptMasterContext || window.masterContext;

    // Get character data from master context
    let characterData = null;
    if (masterContext?.characters?.[characterName]) {
        characterData = masterContext.characters[characterName];
    } else if (masterContext?.characters) {
        const matchingKey = Object.keys(masterContext.characters).find(
            key => key.toUpperCase() === characterName.toUpperCase()
        );
        if (matchingKey) {
            characterData = masterContext.characters[matchingKey];
        }
    }

    // Get AI-detected physical profile from master context
    const aiPhysicalProfile = characterData?.physicalProfile || {};

    // Get user-edited physical profile from state
    const userPhysicalProfile = state.castProfiles?.[characterName]?.physicalProfile || {};

    // Merge profiles: user edits take priority over AI-detected values
    const mergedPhysicalProfile = mergePhysicalProfiles(aiPhysicalProfile, userPhysicalProfile);

    const visualIdentity = state.castProfiles?.[characterName]?.visualIdentity || null;

    return `
        <div class="character-profile-content">

            <!-- 1. PHYSICAL PROFILE (Top - Editable) -->
            ${renderPhysicalProfileSection(characterName, mergedPhysicalProfile, aiPhysicalProfile)}

            <!-- 2. VISUAL IDENTITY (AI Generated) -->
            ${renderVisualIdentitySection(characterName, visualIdentity, characterData)}

            <!-- 3. LOOKBOOK SUMMARY -->
            ${renderLookbookSummarySection(characterName)}

            <!-- 4. SCRIPT DESCRIPTIONS (Bottom - Collapsible) -->
            ${renderScriptDescriptionsSection(characterName, characterData)}

        </div>
    `;
}

/**
 * Render editable physical profile section
 * Fields are auto-filled from AI analysis but remain manually editable
 * @param {string} characterName - Character name
 * @param {Object} profile - Merged physical profile data
 * @param {Object} aiProfile - AI-detected values (for showing source indicator)
 * @returns {string} HTML for physical profile section
 */
function renderPhysicalProfileSection(characterName, profile, aiProfile = {}) {
    const escapedName = escapeHtml(characterName).replace(/'/g, "\\'");
    const state = getState();
    const userProfile = state.castProfiles?.[characterName]?.physicalProfile || {};

    // Normalize AI profile for comparison
    const normalizedAi = normalizeAiPhysicalProfile(aiProfile);

    /**
     * Helper to check if a field value came from AI (not user-edited)
     */
    const isAiValue = (field) => {
        // Value exists and matches normalized AI value, and user hasn't overwritten it
        return normalizedAi[field] && profile[field] === normalizedAi[field] &&
               (!userProfile[field] || userProfile[field] === '');
    };

    /**
     * Render a profile field with AI indicator
     */
    const renderField = (field, label, placeholder, isTextarea = false) => {
        const value = escapeHtml(profile[field] || '');
        const aiDetected = isAiValue(field);
        const aiIndicator = aiDetected ? '<span class="ai-indicator" title="Auto-detected from script">AI</span>' : '';

        if (isTextarea) {
            return `
                <div class="profile-field full-width ${aiDetected ? 'ai-filled' : ''}">
                    <label>${label}${aiIndicator}</label>
                    <textarea
                        placeholder="${placeholder}"
                        onchange="updatePhysicalProfile('${escapedName}', '${field}', this.value)"
                    >${value}</textarea>
                </div>
            `;
        }

        return `
            <div class="profile-field ${aiDetected ? 'ai-filled' : ''}">
                <label>${label}${aiIndicator}</label>
                <input type="text"
                       value="${value}"
                       placeholder="${placeholder}"
                       onchange="updatePhysicalProfile('${escapedName}', '${field}', this.value)">
            </div>
        `;
    };

    // Check if any fields have AI values (using normalized profile)
    const hasAiData = Object.keys(normalizedAi).some(k => normalizedAi[k]);

    return `
        <div class="profile-section physical-profile">
            <div class="section-header">
                <h3>PHYSICAL PROFILE</h3>
                ${hasAiData ? '<span class="ai-hint">Fields marked "AI" were auto-detected from script</span>' : ''}
            </div>

            <div class="profile-grid">
                ${renderField('age', 'Age', 'e.g., 40s, late 20s')}
                ${renderField('gender', 'Gender', 'e.g., Female, Male')}
                ${renderField('hairColour', 'Hair Colour', 'e.g., Dark brown, Blonde')}
                ${renderField('hairType', 'Hair Type', 'e.g., Straight, shoulder length')}
                ${renderField('eyeColour', 'Eye Colour', 'e.g., Brown, Blue')}
                ${renderField('skinTone', 'Skin Tone', 'e.g., Fair, Medium, Dark')}
                ${renderField('build', 'Build', 'e.g., Slim, Athletic')}
                ${renderField('distinguishing', 'Distinguishing Features', 'e.g., Scar on left cheek, tattoo')}
                ${renderField('notes', 'Notes', 'Additional physical notes...', true)}
            </div>
        </div>
    `;
}

/**
 * Render visual identity section (AI generated)
 * @param {string} characterName - Character name
 * @param {Object} identity - Visual identity data (null if not generated)
 * @param {Object} characterData - Master context character data
 * @returns {string} HTML for visual identity section
 */
function renderVisualIdentitySection(characterName, identity, characterData) {
    const escapedName = escapeHtml(characterName).replace(/'/g, "\\'");

    // Check if there's existing visual profile data from master context
    const masterVisual = characterData?.visualProfile || {};
    const masterAnalysis = characterData?.characterAnalysis || {};

    // Use AI-generated identity if available, otherwise show generate button
    const hasIdentity = identity && (identity.vibe || identity.approach);

    // Also check if we have legacy data to display
    const hasLegacyData = masterVisual.overallVibe || masterAnalysis.arc || masterAnalysis.emotionalJourney;

    if (hasIdentity) {
        return `
            <div class="profile-section visual-identity">
                <div class="section-header">
                    <h3>VISUAL IDENTITY</h3>
                    <button class="generate-btn" onclick="generateVisualIdentity('${escapedName}')">
                        Regenerate
                    </button>
                </div>

                <div class="identity-content">
                    ${identity.vibe ? `
                        <div class="identity-block">
                            <h4>CHARACTER VIBE</h4>
                            <p>${escapeHtml(identity.vibe)}</p>
                        </div>
                    ` : ''}

                    ${identity.approach ? `
                        <div class="identity-block">
                            <h4>VISUAL APPROACH</h4>
                            <p>${escapeHtml(identity.approach)}</p>
                        </div>
                    ` : ''}

                    ${identity.arcInfluence ? `
                        <div class="identity-block">
                            <h4>ARC INFLUENCE</h4>
                            <p>${escapeHtml(identity.arcInfluence)}</p>
                        </div>
                    ` : ''}

                    ${identity.keyMoments && identity.keyMoments.length > 0 ? `
                        <div class="identity-block">
                            <h4>KEY VISUAL MOMENTS</h4>
                            <ul>
                                ${identity.keyMoments.map(m => `<li>${escapeHtml(m)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}

                    ${identity.colourPalette ? `
                        <div class="identity-block">
                            <h4>SUGGESTED COLOUR PALETTE</h4>
                            <p>${escapeHtml(identity.colourPalette)}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Show legacy data if available, with option to generate proper analysis
    if (hasLegacyData) {
        return `
            <div class="profile-section visual-identity">
                <div class="section-header">
                    <h3>VISUAL IDENTITY</h3>
                    <button class="generate-btn" onclick="generateVisualIdentity('${escapedName}')">
                        Generate Analysis
                    </button>
                </div>

                <div class="identity-content legacy-data">
                    ${masterVisual.overallVibe ? `
                        <div class="identity-block">
                            <h4>OVERALL VIBE</h4>
                            <p>${escapeHtml(masterVisual.overallVibe)}</p>
                        </div>
                    ` : ''}

                    ${masterAnalysis.arc ? `
                        <div class="identity-block">
                            <h4>CHARACTER ARC</h4>
                            <p>${escapeHtml(masterAnalysis.arc)}</p>
                        </div>
                    ` : ''}

                    ${masterAnalysis.emotionalJourney ? `
                        <div class="identity-block">
                            <h4>EMOTIONAL JOURNEY</h4>
                            <p>${escapeHtml(masterAnalysis.emotionalJourney)}</p>
                        </div>
                    ` : ''}

                    ${masterVisual.styleChoices ? `
                        <div class="identity-block">
                            <h4>STYLE CHOICES</h4>
                            <p>${escapeHtml(masterVisual.styleChoices)}</p>
                        </div>
                    ` : ''}
                </div>

                <div class="identity-hint">
                    Click "Generate Analysis" for a comprehensive visual identity analysis tailored for hair and makeup.
                </div>
            </div>
        `;
    }

    // Show empty state with generate button
    return `
        <div class="profile-section visual-identity">
            <div class="section-header">
                <h3>VISUAL IDENTITY</h3>
                <button class="generate-btn" onclick="generateVisualIdentity('${escapedName}')">
                    Generate Analysis
                </button>
            </div>

            <div class="identity-empty">
                <p>Click "Generate Analysis" to create an AI-powered visual identity analysis for this character.</p>
                <p class="hint">The analysis will consider the character's role, personality, story arc, and how these could influence their hair and makeup throughout the film.</p>
            </div>
        </div>
    `;
}

/**
 * Render lookbook summary section
 * @param {string} characterName - Character name
 * @returns {string} HTML for lookbook summary section
 */
function renderLookbookSummarySection(characterName) {
    const state = getState();
    const escapedName = escapeHtml(characterName).replace(/'/g, "\\'");

    // Get looks from breakdown data
    let looks = [];
    try {
        looks = generateLooksFromBreakdown(characterName);
    } catch (e) {
        console.warn('Could not generate looks:', e);
    }

    // Get continuity events
    const events = state.continuityEvents?.[characterName] || [];

    // Filter out undefined looks for display
    const definedLooks = looks.filter(l => l.id !== '__undefined__');
    const totalScenes = looks.reduce((sum, l) => sum + l.scenes.length, 0);

    if (totalScenes === 0) {
        return `
            <div class="profile-section lookbook-summary">
                <div class="section-header">
                    <h3>LOOKBOOK</h3>
                    <button class="tab-link" onclick="showProfileView('${escapedName}', 'lookbook')">View Lookbook</button>
                </div>
                <div class="section-content">
                    <p class="empty-hint">No looks defined yet. Complete scene breakdowns to generate looks.</p>
                </div>
            </div>
        `;
    }

    return `
        <div class="profile-section lookbook-summary">
            <div class="section-header">
                <h3>LOOKBOOK</h3>
                <button class="tab-link" onclick="showProfileView('${escapedName}', 'lookbook')">View Full Lookbook</button>
            </div>

            <div class="lookbook-stats">
                <div class="stat">
                    <span class="stat-value">${definedLooks.length}</span>
                    <span class="stat-label">Distinct Look${definedLooks.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="stat">
                    <span class="stat-value">${totalScenes}</span>
                    <span class="stat-label">Scene${totalScenes !== 1 ? 's' : ''}</span>
                </div>
                <div class="stat">
                    <span class="stat-value">${events.length}</span>
                    <span class="stat-label">Event${events.length !== 1 ? 's' : ''}</span>
                </div>
            </div>

            ${definedLooks.length > 0 ? `
                <div class="looks-preview">
                    ${definedLooks.slice(0, 3).map(look => `
                        <div class="look-preview-item">
                            <span class="look-name">${escapeHtml(look.name)}</span>
                            <span class="look-scenes">${look.scenes.length} scene${look.scenes.length !== 1 ? 's' : ''}</span>
                        </div>
                    `).join('')}
                    ${definedLooks.length > 3 ? `<p class="more-hint">+${definedLooks.length - 3} more looks</p>` : ''}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Render script descriptions section (collapsible, at bottom)
 * @param {string} characterName - Character name
 * @param {Object} characterData - Master context character data
 * @returns {string} HTML for script descriptions section
 */
function renderScriptDescriptionsSection(characterName, characterData) {
    const descriptions = characterData?.scriptDescriptions || [];

    if (descriptions.length === 0) {
        return `
            <div class="profile-section script-descriptions collapsed">
                <div class="section-header" onclick="toggleProfileSection(this)">
                    <h3>SCRIPT DESCRIPTIONS</h3>
                    <span class="description-count">0 found</span>
                    <span class="toggle-icon">+</span>
                </div>
                <div class="section-content">
                    <p class="empty-hint">No descriptions found in script.</p>
                </div>
            </div>
        `;
    }

    return `
        <div class="profile-section script-descriptions collapsed">
            <div class="section-header" onclick="toggleProfileSection(this)">
                <h3>SCRIPT DESCRIPTIONS</h3>
                <span class="description-count">${descriptions.length} found</span>
                <span class="toggle-icon">+</span>
            </div>

            <div class="section-content">
                ${descriptions.map(desc => `
                    <div class="description-item">
                        <blockquote>"${escapeHtml(desc.text)}"</blockquote>
                        <div class="description-meta">
                            Scene ${desc.sceneNumber || desc.scene || '?'} ${desc.type ? `- ${desc.type}` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Toggle profile section collapse state
 * @param {HTMLElement} header - Section header element
 */
export function toggleProfileSection(header) {
    const section = header.closest('.profile-section');
    if (!section) return;

    const isCollapsed = section.classList.contains('collapsed');
    const toggleIcon = header.querySelector('.toggle-icon');

    if (isCollapsed) {
        section.classList.remove('collapsed');
        if (toggleIcon) toggleIcon.textContent = '-';
    } else {
        section.classList.add('collapsed');
        if (toggleIcon) toggleIcon.textContent = '+';
    }
}

/**
 * Update physical profile field
 * @param {string} characterName - Character name
 * @param {string} field - Field name
 * @param {string} value - New value
 */
export async function updatePhysicalProfile(characterName, field, value) {
    const state = getState();

    // Initialize cast profile if needed
    if (!state.castProfiles[characterName]) {
        state.castProfiles[characterName] = { name: characterName };
    }
    if (!state.castProfiles[characterName].physicalProfile) {
        state.castProfiles[characterName].physicalProfile = {};
    }

    // Update field
    state.castProfiles[characterName].physicalProfile[field] = value;

    // Auto-save
    const { saveProject } = await import('./export-handlers.js');
    saveProject();
}

/**
 * Generate visual identity using AI
 * @param {string} characterName - Character name
 */
export async function generateVisualIdentity(characterName) {
    const state = getState();
    const masterContext = window.scriptMasterContext || window.masterContext;

    // Gather character context
    let characterData = masterContext?.characters?.[characterName] || {};
    const physicalProfile = state.castProfiles?.[characterName]?.physicalProfile || {};
    const scriptDescriptions = characterData.scriptDescriptions || [];
    const role = characterData.characterAnalysis?.role || 'unknown';

    // Count scenes
    let sceneCount = 0;
    const characterScenes = [];
    (state.scenes || []).forEach((scene, index) => {
        const breakdown = state.sceneBreakdowns?.[index];
        if (breakdown?.cast?.includes(characterName)) {
            sceneCount++;
            characterScenes.push({
                number: scene.number || index + 1,
                heading: scene.heading,
                storyDay: scene.storyDay,
                synopsis: scene.synopsis || ''
            });
        }
    });

    // Build AI prompt
    const prompt = buildVisualIdentityPrompt(characterName, {
        role,
        sceneCount,
        scriptDescriptions,
        physicalProfile,
        characterScenes: characterScenes.slice(0, 15),
        characterAnalysis: characterData.characterAnalysis || {}
    });

    // Show loading state
    showToast('Generating visual identity analysis...', 'info');

    try {
        // Get API settings
        const aiProvider = state.aiProvider || localStorage.getItem('aiProvider') || 'openai';
        const apiKey = localStorage.getItem(`${aiProvider}ApiKey`) || state.apiKey;

        if (!apiKey) {
            showToast('Please configure your AI API key in Settings', 'error');
            return;
        }

        let response;
        if (aiProvider === 'anthropic') {
            response = await callAnthropicAPI(prompt, apiKey);
        } else {
            response = await callOpenAIAPI(prompt, apiKey, state.openaiModel || 'gpt-4o');
        }

        // Parse response
        const identity = parseVisualIdentityResponse(response);

        // Save to state
        if (!state.castProfiles[characterName]) {
            state.castProfiles[characterName] = { name: characterName };
        }
        state.castProfiles[characterName].visualIdentity = identity;

        // Save project
        const { saveProject } = await import('./export-handlers.js');
        saveProject();

        // Re-render profile
        const contentId = `${characterName.toLowerCase().replace(/\s+/g, '-')}-content`;
        const contentDiv = document.getElementById(contentId);
        if (contentDiv) {
            contentDiv.innerHTML = renderProfileView(characterName);
        }

        showToast('Visual identity analysis generated!', 'success');

    } catch (error) {
        console.error('Failed to generate visual identity:', error);
        showToast('Failed to generate analysis. Please try again.', 'error');
    }
}

/**
 * Build prompt for visual identity generation
 */
function buildVisualIdentityPrompt(characterName, context) {
    return `You are a Hair & Makeup Department Head analysing a character for visual design.

CHARACTER: ${characterName}
ROLE: ${context.role}
APPEARS IN: ${context.sceneCount} scenes

SCRIPT DESCRIPTIONS:
${context.scriptDescriptions.length > 0
    ? context.scriptDescriptions.map(d => `- "${d.text}" (Scene ${d.sceneNumber || d.scene || '?'})`).join('\n')
    : 'None found in script'}

PHYSICAL PROFILE:
${Object.entries(context.physicalProfile).filter(([k,v]) => v).map(([k,v]) => `- ${k}: ${v}`).join('\n') || 'Not yet defined'}

${context.characterAnalysis.arc ? `CHARACTER ARC: ${context.characterAnalysis.arc}` : ''}
${context.characterAnalysis.emotionalJourney ? `EMOTIONAL JOURNEY: ${context.characterAnalysis.emotionalJourney}` : ''}

STORY ARC (Scene appearances):
${context.characterScenes.slice(0, 10).map(s =>
    `- Scene ${s.number} (${s.storyDay || 'Unknown day'}): ${s.synopsis || s.heading}`
).join('\n')}

Based on this information, provide a visual identity analysis with the following sections:

1. CHARACTER VIBE (2-3 sentences)
Describe the overall feeling/energy this character projects. What impression should their appearance give the audience?

2. VISUAL APPROACH (3-4 sentences)
Specific recommendations for hair and makeup approach. What style, level of glamour/naturalism, key features to emphasise or downplay?

3. ARC INFLUENCE (2-3 sentences)
How might the character's journey through the story be reflected in subtle changes to their appearance? What visual evolution could support their emotional arc?

4. KEY VISUAL MOMENTS (bullet points)
Identify 2-3 specific scenes or moments where appearance could be particularly significant or require special consideration.

5. SUGGESTED COLOUR PALETTE (1-2 sentences)
If appropriate, suggest colours that would work well for this character's makeup (lips, eyes, cheeks).

Format your response as JSON:
{
  "vibe": "...",
  "approach": "...",
  "arcInfluence": "...",
  "keyMoments": ["...", "...", "..."],
  "colourPalette": "..."
}`;
}

/**
 * Parse visual identity response from AI
 */
function parseVisualIdentityResponse(response) {
    try {
        // Try to parse as JSON first
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (e) {
        console.warn('Could not parse as JSON, extracting sections');
    }

    // Fallback: return raw text as vibe
    return {
        vibe: response,
        approach: '',
        arcInfluence: '',
        keyMoments: [],
        colourPalette: ''
    };
}

/**
 * Call OpenAI API
 */
async function callOpenAIAPI(prompt, apiKey, model) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model || 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are an expert Hair & Makeup Department Head for film productions. Provide detailed visual analysis for characters.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 1500
        })
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

/**
 * Call Anthropic API
 */
async function callAnthropicAPI(prompt, apiKey) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1500,
            messages: [
                { role: 'user', content: prompt }
            ]
        })
    });

    if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
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

// Expose global functions for HTML onclick handlers
window.showProfileView = showProfileView;
window.toggleProfileSection = toggleProfileSection;
window.updatePhysicalProfile = updatePhysicalProfile;
window.generateVisualIdentity = generateVisualIdentity;

export default {
    renderProfileView,
    showProfileView,
    toggleProfileSection,
    updatePhysicalProfile,
    generateVisualIdentity
};
