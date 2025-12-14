/**
 * AI Generate Tab - Character Design
 * Hair & Makeup Pro
 *
 * Basic structure for AI-powered makeup reference generation
 */

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

let aiGenerateState = {
    isGenerating: false,
    savedReferences: []
};

// ═══════════════════════════════════════════════════════════════
// RENDER AI GENERATE TAB
// ═══════════════════════════════════════════════════════════════

function initAIGenerateTab() {
    const container = document.getElementById('ai-generate-tab');
    if (!container) return;

    const characterName = window.currentCharacter;
    const looks = generateLooksFromBreakdown(characterName);
    const castEntry = window.currentCastEntry;

    // Load saved references
    loadSavedReferences();

    container.innerHTML = `
        <div class="ai-generate-layout">

            <!-- Left: Generation Form -->
            <div class="generation-form">

                <h3>GENERATE MAKEUP REFERENCE</h3>
                <p class="ai-notice">Powered by AI - Creates reference images, not actor transformations</p>

                <div class="form-group">
                    <label>Based on Look</label>
                    <select id="ai-look-select" onchange="updateBaseDescription()">
                        <option value="">Select a look...</option>
                        ${looks.map(look => `
                            <option value="${look.id}" data-hair="${escapeAttr(look.hair || '')}" data-makeup="${escapeAttr(look.makeup || '')}">
                                ${escapeHtml(look.name)}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label>Base Description (from lookbook)</label>
                    <textarea id="ai-base-description" rows="3" readonly
                              placeholder="Select a look to populate..."></textarea>
                </div>

                <div class="form-group">
                    <label>Additional Direction</label>
                    <textarea id="ai-additional-prompt" rows="4"
                              placeholder="Add specific direction, era influences, techniques, mood..."></textarea>
                </div>

                <div class="form-row-inline">
                    <div class="form-group">
                        <label>Style</label>
                        <select id="ai-style">
                            <option value="editorial">Editorial/Fashion</option>
                            <option value="natural">Natural/Realistic</option>
                            <option value="glamour">Glamour</option>
                            <option value="artistic">Artistic/Creative</option>
                            <option value="period">Period/Historical</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Era</label>
                        <select id="ai-era">
                            <option value="contemporary">Contemporary</option>
                            <option value="1920s">1920s</option>
                            <option value="1940s">1940s</option>
                            <option value="1960s">1960s</option>
                            <option value="1970s">1970s</option>
                            <option value="1980s">1980s</option>
                            <option value="1990s">1990s</option>
                        </select>
                    </div>
                </div>

                <button class="generate-btn" onclick="generateAIReference()" id="generate-btn">
                    Generate Reference
                </button>

                <p style="margin-top: 16px; font-size: 0.75em; color: var(--text-muted); text-align: center;">
                    AI generation requires API key configuration
                </p>

            </div>

            <!-- Right: Results -->
            <div class="generation-results">

                <div class="current-generation" id="current-generation">
                    <div class="generation-placeholder" id="generation-placeholder">
                        <p>Generated images will appear here</p>
                    </div>
                </div>

                <div class="saved-references">
                    <h4>SAVED REFERENCES</h4>
                    <div class="saved-grid" id="saved-references-grid">
                        ${renderSavedReferences()}
                    </div>
                </div>

            </div>

        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// FORM HANDLERS
// ═══════════════════════════════════════════════════════════════

function updateBaseDescription() {
    const select = document.getElementById('ai-look-select');
    const textarea = document.getElementById('ai-base-description');

    if (!select || !textarea) return;

    const selectedOption = select.options[select.selectedIndex];
    if (!selectedOption || !selectedOption.value) {
        textarea.value = '';
        return;
    }

    const hair = selectedOption.dataset.hair || '';
    const makeup = selectedOption.dataset.makeup || '';

    let description = '';
    if (hair) description += `Hair: ${hair}\n`;
    if (makeup) description += `Makeup: ${makeup}`;

    textarea.value = description.trim() || 'No description available';
}

// ═══════════════════════════════════════════════════════════════
// AI GENERATION (Placeholder)
// ═══════════════════════════════════════════════════════════════

async function generateAIReference() {
    if (aiGenerateState.isGenerating) return;

    const lookSelect = document.getElementById('ai-look-select');
    const baseDescription = document.getElementById('ai-base-description')?.value || '';
    const additionalPrompt = document.getElementById('ai-additional-prompt')?.value || '';
    const style = document.getElementById('ai-style')?.value || 'natural';
    const era = document.getElementById('ai-era')?.value || 'contemporary';

    if (!lookSelect?.value) {
        alert('Please select a look first');
        return;
    }

    // Build prompt
    const prompt = buildGenerationPrompt(baseDescription, additionalPrompt, style, era);

    // Update UI to show generating state
    aiGenerateState.isGenerating = true;
    updateGenerateButton(true);
    showGeneratingState();

    try {
        // This is a placeholder - actual AI integration would go here
        // For now, show a demo result after a delay
        await simulateGeneration();

        // Show placeholder result
        showPlaceholderResult(prompt);

    } catch (error) {
        console.error('Generation error:', error);
        showGenerationError(error.message || 'Generation failed');
    } finally {
        aiGenerateState.isGenerating = false;
        updateGenerateButton(false);
    }
}

function buildGenerationPrompt(baseDescription, additionalPrompt, style, era) {
    let prompt = 'Professional makeup and hair reference image. ';

    if (baseDescription) {
        prompt += baseDescription + '. ';
    }

    if (additionalPrompt) {
        prompt += additionalPrompt + '. ';
    }

    prompt += `Style: ${style}. `;

    if (era !== 'contemporary') {
        prompt += `Era: ${era}. `;
    }

    prompt += 'High quality, detailed, professional lighting.';

    return prompt;
}

function simulateGeneration() {
    return new Promise(resolve => {
        setTimeout(resolve, 2000);
    });
}

function updateGenerateButton(isGenerating) {
    const btn = document.getElementById('generate-btn');
    if (!btn) return;

    if (isGenerating) {
        btn.textContent = 'Generating...';
        btn.disabled = true;
        btn.style.opacity = '0.6';
    } else {
        btn.textContent = 'Generate Reference';
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

function showGeneratingState() {
    const container = document.getElementById('current-generation');
    if (!container) return;

    container.innerHTML = `
        <div class="generation-placeholder">
            <div style="text-align: center;">
                <div style="font-size: 2em; margin-bottom: 16px; animation: pulse 1.5s infinite;">...</div>
                <p>Generating reference image...</p>
                <p style="font-size: 0.8em; color: var(--text-muted); margin-top: 8px;">This may take a moment</p>
            </div>
        </div>
        <style>
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        </style>
    `;
}

function showPlaceholderResult(prompt) {
    const container = document.getElementById('current-generation');
    if (!container) return;

    container.innerHTML = `
        <div style="padding: 20px; text-align: center;">
            <div style="background: linear-gradient(135deg, rgba(201, 169, 97, 0.2), rgba(201, 169, 97, 0.1));
                        border: 1px solid rgba(201, 169, 97, 0.3); border-radius: 12px;
                        padding: 40px; margin-bottom: 16px;">
                <p style="font-size: 1.1em; color: var(--accent-gold); margin-bottom: 12px;">
                    AI Generation Demo
                </p>
                <p style="font-size: 0.85em; color: var(--text-secondary); margin-bottom: 20px;">
                    This feature requires API configuration to generate actual images.
                </p>
                <p style="font-size: 0.75em; color: var(--text-muted); font-style: italic;">
                    Prompt: "${escapeHtml(prompt.substring(0, 150))}..."
                </p>
            </div>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button class="toolbar-btn" onclick="saveToMoodboard()" disabled style="opacity: 0.5;">
                    Save to Moodboard
                </button>
                <button class="toolbar-btn" onclick="saveReference()" disabled style="opacity: 0.5;">
                    Save Reference
                </button>
            </div>
        </div>
    `;
}

function showGenerationError(message) {
    const container = document.getElementById('current-generation');
    if (!container) return;

    container.innerHTML = `
        <div class="generation-placeholder">
            <div style="text-align: center; color: #e74c3c;">
                <p style="font-size: 1.1em; margin-bottom: 8px;">Generation Failed</p>
                <p style="font-size: 0.85em; opacity: 0.8;">${escapeHtml(message)}</p>
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// SAVED REFERENCES
// ═══════════════════════════════════════════════════════════════

function loadSavedReferences() {
    const castEntry = window.currentCastEntry;
    if (castEntry?.savedReferences) {
        aiGenerateState.savedReferences = castEntry.savedReferences;
    } else {
        aiGenerateState.savedReferences = [];
    }
}

function renderSavedReferences() {
    if (aiGenerateState.savedReferences.length === 0) {
        return '<div class="empty-state-small">No saved references yet</div>';
    }

    return aiGenerateState.savedReferences.map((ref, index) => `
        <div class="saved-reference-item" style="position: relative;">
            <img src="${ref.src}" alt="Reference ${index + 1}"
                 style="width: 100%; border-radius: 8px; cursor: pointer;"
                 onclick="viewReference(${index})">
            <button onclick="deleteReference(${index})"
                    style="position: absolute; top: 4px; right: 4px; width: 20px; height: 20px;
                           background: rgba(0,0,0,0.7); border: none; border-radius: 50%;
                           color: white; font-size: 12px; cursor: pointer;">x</button>
        </div>
    `).join('');
}

function saveReference() {
    // Placeholder - would save the generated image
    alert('Reference saved!');
}

function saveToMoodboard() {
    // Placeholder - would add to moodboard
    alert('Added to moodboard!');
}

function viewReference(index) {
    const ref = aiGenerateState.savedReferences[index];
    if (ref) {
        // Open in modal or new view
        alert('View reference: ' + ref.prompt?.substring(0, 50));
    }
}

function deleteReference(index) {
    if (!confirm('Delete this reference?')) return;

    aiGenerateState.savedReferences.splice(index, 1);

    // Save to cast entry
    const castEntry = window.currentCastEntry;
    if (castEntry?.id) {
        updateCastEntry(castEntry.id, 'savedReferences', aiGenerateState.savedReferences);
    }

    // Re-render
    const grid = document.getElementById('saved-references-grid');
    if (grid) {
        grid.innerHTML = renderSavedReferences();
    }
}

// ═══════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text) {
    if (!text) return '';
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Make functions globally available
window.initAIGenerateTab = initAIGenerateTab;
window.generateAIReference = generateAIReference;
window.updateBaseDescription = updateBaseDescription;
window.saveReference = saveReference;
window.saveToMoodboard = saveToMoodboard;
window.viewReference = viewReference;
window.deleteReference = deleteReference;
