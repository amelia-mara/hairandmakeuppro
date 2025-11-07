/**
 * ai-integration.js
 * AI integration for auto-generating breakdowns, synopses, and detecting elements
 *
 * Provides:
 * - Universal AI API caller (OpenAI, Anthropic, serverless)
 * - Settings management (API keys, provider selection)
 * - Scene synopsis generation
 * - Element detection (cast, hair, makeup, SFX)
 * - Character introduction detection
 * - Look state suggestions
 */

import { state } from './main.js';

// ============================================================================
// AI SETTINGS MANAGEMENT
// ============================================================================

/**
 * Open AI settings modal
 */
export function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    // Load current settings into form
    document.getElementById('ai-provider').value = state.aiProvider;
    document.getElementById('api-key').value = state.apiKey || '';
    document.getElementById('openai-model').value = state.openaiModel;

    modal.style.display = 'flex';
}

/**
 * Close AI settings modal
 */
export function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
}

/**
 * Save AI settings
 */
export function saveSettings() {
    const provider = document.getElementById('ai-provider').value;
    const apiKey = document.getElementById('api-key').value;
    const model = document.getElementById('openai-model').value;

    state.aiProvider = provider;
    state.apiKey = apiKey;
    state.openaiModel = model;

    // Save to localStorage
    localStorage.setItem('aiProvider', provider);
    localStorage.setItem('apiKey', apiKey);
    localStorage.setItem('openaiModel', model);

    closeSettingsModal();
}

// ============================================================================
// AI API CALLER
// ============================================================================

/**
 * Universal AI caller
 * Supports: Serverless API, OpenAI, Anthropic
 */
export async function callAI(prompt, maxTokens = 500) {
    // For deployed Vercel version - use secure serverless function
    if (window.location.hostname.includes('vercel.app')) {
        try {
            const response = await fetch("/api/ai", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    messages: [{
                        role: "user",
                        content: prompt
                    }],
                    maxTokens: maxTokens
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(`API returned ${response.status}: ${JSON.stringify(data)}`);
            }

            // Extract text from response
            if (data.choices && data.choices[0] && data.choices[0].message) {
                return data.choices[0].message.content;
            }

            throw new Error('Invalid response format from API');

        } catch (error) {
            console.error('Serverless API Error:', error);
            throw error;
        }
    }

    // For local testing with API key
    if (!state.apiKey) {
        throw new Error('No API key set. Please configure AI settings first or deploy to Vercel with serverless function.');
    }

    // OpenAI
    if (state.aiProvider === 'openai') {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${state.apiKey}`
            },
            body: JSON.stringify({
                model: state.openaiModel,
                messages: [{
                    role: "user",
                    content: prompt
                }],
                max_tokens: maxTokens,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI API Error:', errorText);
            throw new Error(`OpenAI API returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from OpenAI');
        }

        return data.choices[0].message.content;
    }

    // Anthropic
    if (state.aiProvider === 'anthropic') {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": state.apiKey,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: maxTokens,
                messages: [{
                    role: "user",
                    content: prompt
                }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Anthropic API Error:', errorText);
            throw new Error(`Anthropic API returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        if (!data.content || !data.content[0]) {
            throw new Error('Invalid response format from Anthropic');
        }

        return data.content[0].text;
    }

    throw new Error(`Unknown AI provider: ${state.aiProvider}`);
}

// ============================================================================
// AI GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate scene synopsis using AI
 */
export async function generateAISynopsis(sceneIndex) {
    if (sceneIndex < 0 || sceneIndex >= state.scenes.length) return;

    const scene = state.scenes[sceneIndex];
    const sceneText = scene.content || scene.text || '';

    const prompt = `You are a script breakdown assistant. Analyze this scene and provide a concise synopsis for quick scanning.

Scene Heading: ${scene.heading}

Scene Text:
${sceneText}

Write a synopsis in EXACTLY 2-4 sentences. Be concise and focus on key actions and character interactions only.
Maximum length: 250 characters total.
Focus on visual and continuity elements relevant to hair/makeup departments.

Provide only the synopsis, no additional commentary.`;

    try {
        const synopsis = await callAI(prompt, 200);
        return synopsis.trim();
    } catch (error) {
        console.error('Error generating synopsis:', error);
        throw error;
    }
}

/**
 * Detect elements using AI (cast, hair, makeup, SFX, wardrobe)
 */
export async function detectAIElements(sceneIndex) {
    if (sceneIndex < 0 || sceneIndex >= state.scenes.length) return;

    const scene = state.scenes[sceneIndex];
    const sceneText = scene.content || scene.text || '';

    const prompt = `You are a script breakdown assistant for hair and makeup departments. Analyze this scene and extract ALL relevant tags for continuity tracking.

Scene Heading: ${scene.heading}

Scene Text:
${sceneText}

Return ONLY valid JSON with this structure:
{
  "cast": ["Character Name 1", "Character Name 2"],
  "hair": ["Hairstyle description 1", "Hair change description 2"],
  "makeup": ["Makeup description 1", "Makeup need 2"],
  "sfx": ["Special effect 1", "Prosthetic 2"],
  "health": ["Health condition 1", "Appearance description 2"],
  "injuries": ["Injury 1", "Wound description 2"],
  "stunts": ["Stunt action 1", "Physical activity 2"],
  "weather": ["Weather effect 1", "Environmental impact 2"],
  "wardrobe": ["Costume description 1", "Wardrobe change 2"],
  "extras": ["Background performer 1", "Crowd description 2"]
}

DETAILED DETECTION RULES:

CAST:
- All speaking characters with names
- Named characters who appear but don't speak
- DO NOT include generic roles like "Waiter" or "Guard" unless they have significant interaction

HAIR:
- Specific hairstyles mentioned (bun, ponytail, curls, straight, etc.)
- Hair color or length descriptions
- Hair being wet, messy, disheveled, windblown
- Hair changes (takes down her hair, puts hair up, cuts hair)
- Wigs or hair pieces mentioned

MAKEUP:
- Beauty makeup mentioned (natural look, glamorous, etc.)
- Makeup application or removal scenes
- Aged appearance, youthful appearance
- Specific makeup mentions (lipstick, eye makeup, etc.)
- Makeup running or smudged

SFX (Special Effects Makeup):
- Wounds, cuts, gashes, lacerations
- Blood (on face, body, clothing)
- Bruises, black eyes, swelling
- Burns, scars, tattoos
- Prosthetics, creature makeup
- Aging effects requiring prosthetics
- Dirt, grime, or filth requiring special application

HEALTH:
- Illness (fever, pale, sickly, clammy)
- Exhaustion, tiredness (bags under eyes, pale)
- Sweating profusely, flushed
- Drugged or intoxicated appearance
- Malnourished or gaunt appearance

INJURIES:
- Recent injuries mentioned (bandages, stitches)
- Healing wounds or scars
- Limping, favoring a body part
- Physical trauma visible on face/body
- Medical devices (casts, braces, eye patches)

STUNTS:
- Fight scenes, physical altercations
- Falls, jumps, or dangerous physical activity
- Car chases or vehicle stunts
- Running, climbing, athletic activities
- Any action that might affect hair/makeup continuity

WEATHER:
- Rain (hair/makeup getting wet)
- Wind (affecting hair)
- Snow (on hair, face, clothing)
- Extreme heat (sweating, flushed)
- Mud, dirt, or environmental elements

WARDROBE:
- Specific costume descriptions
- Costume changes within scene
- Wardrobe malfunctions or tears
- Getting dressed or undressed
- Removing or adding clothing items (jacket, hat, etc.)

EXTRAS:
- Background performers with specific looks
- Crowd descriptions requiring coordination
- Period-specific crowd appearances

Be THOROUGH - extract EVERY relevant detail. Multiple items per category are expected.
Each description should be specific enough for continuity tracking.

Return ONLY the JSON, no explanation or commentary.`;

    try {
        const response = await callAI(prompt, 600);

        // Parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No valid JSON found in response');
        }

        const elements = JSON.parse(jsonMatch[0]);

        return {
            cast: elements.cast || [],
            elements: {
                hair: elements.hair || [],
                makeup: elements.makeup || [],
                sfx: elements.sfx || [],
                health: elements.health || [],
                injuries: elements.injuries || [],
                stunts: elements.stunts || [],
                weather: elements.weather || [],
                wardrobe: elements.wardrobe || [],
                extras: elements.extras || []
            }
        };
    } catch (error) {
        console.error('Error detecting elements:', error);
        throw error;
    }
}

/**
 * Detect character introductions using AI
 */
export async function detectCharacterIntroductions(scriptText) {
    const prompt = `Analyze this screenplay and identify character introductions (when a character first appears).

Return ONLY valid JSON with this structure:
{
  "introductions": [
    {
      "name": "Character Name",
      "scene": 1,
      "description": "Brief physical description from script"
    }
  ]
}

Screenplay:
${scriptText.substring(0, 10000)}

Return ONLY the JSON.`;

    try {
        const response = await callAI(prompt, 800);

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return [];

        const data = JSON.parse(jsonMatch[0]);
        return data.introductions || [];
    } catch (error) {
        console.error('Error detecting character introductions:', error);
        return [];
    }
}

/**
 * Generate description for specific element using AI
 */
export async function generateDescription(sceneIndex, character, category) {
    if (sceneIndex < 0 || sceneIndex >= state.scenes.length) return '';

    const scene = state.scenes[sceneIndex];
    const sceneText = scene.content || scene.text || '';

    const categoryLabels = {
        hair: 'hair styling',
        makeup: 'makeup application',
        sfx: 'special effects/prosthetics',
        wardrobe: 'wardrobe/costume'
    };

    const categoryLabel = categoryLabels[category] || category;

    const prompt = `Analyze this scene and describe the ${categoryLabel} needs for the character "${character}".

Scene: ${scene.heading}
${sceneText}

Provide a brief, specific description focusing on ${categoryLabel} requirements for continuity. 1-2 sentences maximum.`;

    try {
        const description = await callAI(prompt, 150);
        return description.trim();
    } catch (error) {
        console.error('Error generating description:', error);
        return '';
    }
}

/**
 * Generate continuity event progression using AI
 */
export async function generateProgression(eventType, description, startScene, endScene) {
    const prompt = `Create a progression timeline for a continuity event in a screenplay.

Event Type: ${eventType}
Description: ${description}
Start Scene: ${startScene}
End Scene: ${endScene}

Generate 3-5 progression stages showing how this event evolves from scene ${startScene} to scene ${endScene}.

Return ONLY valid JSON:
{
  "stages": [
    {
      "scene": ${startScene},
      "stage": "fresh",
      "description": "Initial state description"
    }
  ]
}

Make it realistic for the event type.`;

    try {
        const response = await callAI(prompt, 400);

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return [];

        const data = JSON.parse(jsonMatch[0]);
        return data.stages || [];
    } catch (error) {
        console.error('Error generating progression:', error);
        return [];
    }
}

/**
 * Auto-fill character base description using AI
 */
export async function aiFillCharacterFields(character) {
    // Get all scenes with this character
    const characterScenes = [];

    state.scenes.forEach((scene, index) => {
        const breakdown = state.sceneBreakdowns[index];
        if (breakdown && breakdown.cast && breakdown.cast.includes(character)) {
            characterScenes.push({
                index,
                heading: scene.heading,
                text: scene.content || scene.text || ''
            });
        }
    });

    if (characterScenes.length === 0) {
        throw new Error('No scenes found with this character');
    }

    // Use first few scenes for context
    const context = characterScenes.slice(0, 3).map(s =>
        `Scene ${s.index + 1}: ${s.heading}\n${s.text.substring(0, 500)}`
    ).join('\n\n');

    const prompt = `Analyze these scenes and provide a brief base description for the character "${character}" focusing on physical appearance, age, and any notable features relevant for hair/makeup continuity.

${context}

Provide 2-3 sentences maximum, focusing on:
- Physical appearance
- Age/age range
- Notable features (scars, tattoos, distinctive looks)

Return only the description, no additional commentary.`;

    try {
        const description = await callAI(prompt, 200);
        return description.trim();
    } catch (error) {
        console.error('Error generating character description:', error);
        throw error;
    }
}

// ============================================================================
// BATCH PROCESSING FUNCTIONS
// ============================================================================

// Track cancellation state
let batchCancelled = false;

/**
 * Generate synopses for all scenes in the script
 */
export async function generateAllSynopses() {
    if (!state.scenes || state.scenes.length === 0) {
        alert('No scenes loaded. Please import a script first.');
        return;
    }

    // Reset cancellation flag
    batchCancelled = false;

    // Show corner progress notification
    showCornerProgress('Generating All Synopses', state.scenes.length);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < state.scenes.length; i++) {
        if (batchCancelled) {
            updateCornerProgress(i, state.scenes.length, `Cancelled at scene ${i + 1}`);
            break;
        }

        const scene = state.scenes[i];
        updateCornerProgress(i + 1, state.scenes.length, `Generating synopsis for Scene ${scene.number}...`);

        try {
            const synopsis = await generateAISynopsis(i);

            // Save synopsis to scene
            state.scenes[i].synopsis = synopsis;

            // Also save to sceneBreakdowns if it exists
            if (!state.sceneBreakdowns[i]) {
                state.sceneBreakdowns[i] = {};
            }
            state.sceneBreakdowns[i].synopsis = synopsis;

            successCount++;
            updateCornerProgress(i + 1, state.scenes.length, `Generating synopsis for Scene ${scene.number}...`, `Scene ${scene.number} completed`);
        } catch (error) {
            console.error(`Error generating synopsis for scene ${i}:`, error);
            errorCount++;
            errors.push(`Scene ${scene.number}: ${error.message}`);
            updateCornerProgress(i + 1, state.scenes.length, `Generating synopsis for Scene ${scene.number}...`, `✗ Scene ${scene.number} failed`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Save project data
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Show completion message
    const message = batchCancelled
        ? `Processing cancelled. ${successCount} synopses generated, ${errorCount} failed.`
        : `Complete! ${successCount} synopses generated successfully.`;

    updateCornerProgress(state.scenes.length, state.scenes.length, message, 'Processing complete');

    // Auto-close after 3 seconds
    setTimeout(closeCornerProgress, 3000);

    // Refresh UI if we're viewing a scene
    if (state.currentScene !== null) {
        const { renderBreakdownPanel } = await import('./breakdown-form.js');
        renderBreakdownPanel();
    }
}

/**
 * Auto-tag the entire script with AI detection
 */
export async function autoTagScript() {
    if (!state.scenes || state.scenes.length === 0) {
        alert('No scenes loaded. Please import a script first.');
        return;
    }

    console.log('🤖 Starting Auto Tag Script...');
    console.log('📊 Total scenes to process:', state.scenes.length);

    // Reset cancellation flag
    batchCancelled = false;

    // Show corner progress notification
    showCornerProgress('Auto-Tagging Script', state.scenes.length);

    let successCount = 0;
    let errorCount = 0;
    let totalTagsCreated = 0;
    const errors = [];
    const allCategories = ['cast', 'hair', 'makeup', 'sfx', 'health', 'injuries', 'stunts', 'weather', 'wardrobe', 'extras'];

    console.log('📋 Will detect categories:', allCategories.join(', '));

    for (let i = 0; i < state.scenes.length; i++) {
        if (batchCancelled) {
            updateCornerProgress(i, state.scenes.length, `Cancelled at scene ${i + 1}`);
            break;
        }

        const scene = state.scenes[i];
        console.log(`\n📋 Processing scene ${i + 1}/${state.scenes.length} (Scene #${scene.number})`);
        updateCornerProgress(i + 1, state.scenes.length, `Auto-detecting elements in Scene ${scene.number}...`);

        try {
            const result = await detectAIElements(i);
            console.log(`✓ Scene ${scene.number} - AI detected:`, {
                cast: result.cast?.length || 0,
                hair: result.elements?.hair?.length || 0,
                makeup: result.elements?.makeup?.length || 0,
                sfx: result.elements?.sfx?.length || 0,
                health: result.elements?.health?.length || 0,
                injuries: result.elements?.injuries?.length || 0,
                stunts: result.elements?.stunts?.length || 0,
                weather: result.elements?.weather?.length || 0,
                wardrobe: result.elements?.wardrobe?.length || 0,
                extras: result.elements?.extras?.length || 0
            });

            // Initialize breakdown if it doesn't exist
            if (!state.sceneBreakdowns[i]) {
                state.sceneBreakdowns[i] = {};
            }

            // Save detected elements
            const breakdown = state.sceneBreakdowns[i];

            // Cast members
            if (result.cast && result.cast.length > 0) {
                breakdown.cast = [...new Set([...(breakdown.cast || []), ...result.cast])];

                // Add to global characters set
                result.cast.forEach(char => state.characters.add(char));
            }

            // Other elements
            if (result.elements) {
                Object.keys(result.elements).forEach(category => {
                    if (result.elements[category] && result.elements[category].length > 0) {
                        breakdown[category] = [...new Set([...(breakdown[category] || []), ...result.elements[category]])];
                    }
                });
            }

            // CRITICAL FIX: Create tag objects in scriptTags for highlighting
            if (!state.scriptTags[i]) {
                state.scriptTags[i] = [];
            }

            let sceneTagsCreated = 0;

            // Create tags for cast members
            if (result.cast && result.cast.length > 0) {
                console.log(`  Creating ${result.cast.length} cast tags...`);
                result.cast.forEach(castMember => {
                    const tag = {
                        id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        sceneIndex: i,
                        sceneNumber: scene.number,
                        category: 'cast',
                        selectedText: castMember,
                        fullContext: `Cast member: ${castMember}`,
                        character: castMember,
                        created: Date.now()
                    };
                    state.scriptTags[i].push(tag);
                    sceneTagsCreated++;
                    console.log(`    ✓ Cast tag: "${castMember}"`);
                });
            }

            // Create tags for other elements (hair, makeup, SFX, wardrobe)
            if (result.elements) {
                Object.keys(result.elements).forEach(category => {
                    if (result.elements[category] && result.elements[category].length > 0) {
                        console.log(`  Creating ${result.elements[category].length} ${category} tags...`);
                        result.elements[category].forEach(description => {
                            // Try to detect character from description
                            let detectedCharacter = null;
                            if (result.cast) {
                                for (const castMember of result.cast) {
                                    if (description.toLowerCase().includes(castMember.toLowerCase())) {
                                        detectedCharacter = castMember;
                                        break;
                                    }
                                }
                            }

                            const tag = {
                                id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                sceneIndex: i,
                                sceneNumber: scene.number,
                                category: category,
                                selectedText: description.substring(0, 100), // Truncate long descriptions
                                fullContext: description,
                                character: detectedCharacter,
                                created: Date.now()
                            };
                            state.scriptTags[i].push(tag);
                            sceneTagsCreated++;
                            console.log(`    ✓ ${category} tag: "${description.substring(0, 40)}..." ${detectedCharacter ? `(${detectedCharacter})` : ''}`);
                        });
                    }
                });
            }

            totalTagsCreated += sceneTagsCreated;
            successCount++;

            const tagCount = state.scriptTags[i] ? state.scriptTags[i].length : 0;
            console.log(`✓ Scene ${scene.number} complete: ${sceneTagsCreated} tags created (total in scene: ${tagCount})`);
            updateCornerProgress(i + 1, state.scenes.length, `Auto-detecting elements in Scene ${scene.number}...`, `Scene ${scene.number}: ${sceneTagsCreated} tags created`);
        } catch (error) {
            console.error(`Error auto-tagging scene ${i}:`, error);
            errorCount++;
            errors.push(`Scene ${scene.number}: ${error.message}`);
            updateCornerProgress(i + 1, state.scenes.length, `Auto-detecting elements in Scene ${scene.number}...`, `✗ Scene ${scene.number} failed`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Save project data
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Refresh scene list to show tagged indicators
    const { renderSceneList } = await import('./scene-list.js');
    renderSceneList();

    // Refresh character tabs in case new characters were detected
    const { renderCharacterTabs, renderCharacterTabPanels } = await import('./character-panel.js');

    // Update character tabs array from characters set
    state.characterTabs = Array.from(state.characters);
    renderCharacterTabs();
    renderCharacterTabPanels();

    // Count total tags created
    const totalTags = Object.values(state.scriptTags).reduce((sum, tags) => sum + (tags?.length || 0), 0);
    console.log(`\n✅ AUTO-TAGGING COMPLETE`);
    console.log(`📊 Summary:`);
    console.log(`  - Scenes processed: ${successCount}`);
    console.log(`  - Tags created this run: ${totalTagsCreated}`);
    console.log(`  - Total tags in state: ${totalTags}`);
    console.log(`  - Errors: ${errorCount}`);

    // DIAGNOSTIC: Show tag count per scene
    console.log(`\n📋 Tags per scene:`);
    Object.keys(state.scriptTags).forEach(sceneIndex => {
        const tags = state.scriptTags[sceneIndex];
        const sceneNum = state.scenes[sceneIndex]?.number || sceneIndex;
        console.log(`  Scene ${sceneNum} (index ${sceneIndex}): ${tags.length} tags`);
    });

    // DIAGNOSTIC: Show sample of tags created
    if (state.scriptTags[0]) {
        console.log(`\n🔍 Sample tag from scene 0:`, state.scriptTags[0][0]);
    }

    // Apply all highlights to script
    console.log(`\n🎨 Applying highlights to script...`);
    const { renderAllHighlights } = await import('./tag-system.js');
    renderAllHighlights();

    // Show completion message
    const message = batchCancelled
        ? `Processing cancelled. ${successCount} scenes tagged, ${errorCount} failed.`
        : `Complete! ${totalTags} total tags created across ${successCount} scenes.`;

    updateCornerProgress(state.scenes.length, state.scenes.length, message, 'Processing complete');

    // Auto-close after 3 seconds
    setTimeout(closeCornerProgress, 3000);

    // Refresh UI if we're viewing a scene
    if (state.currentScene !== null) {
        const { renderBreakdownPanel } = await import('./breakdown-form.js');
        renderBreakdownPanel();
    }
}

/**
 * Cancel batch processing
 */
export function cancelBatchProcessing() {
    batchCancelled = true;
}

// ============================================================================
// CORNER PROGRESS NOTIFICATION UTILITIES
// ============================================================================

/**
 * Show corner progress notification
 */
function showCornerProgress(title, total) {
    const corner = document.getElementById('corner-progress');
    if (!corner) return;

    document.getElementById('corner-progress-title').textContent = title;
    document.getElementById('corner-progress-message').textContent = 'Starting...';
    document.getElementById('corner-progress-fill').style.width = '0%';
    document.getElementById('corner-progress-label').textContent = `0 / ${total}`;
    document.getElementById('corner-progress-details').innerHTML = '';

    corner.style.display = 'block';
    corner.classList.remove('minimized');
}

/**
 * Update corner progress notification
 */
function updateCornerProgress(current, total, message, details = '') {
    const percentage = (current / total) * 100;

    const messageEl = document.getElementById('corner-progress-message');
    const fillEl = document.getElementById('corner-progress-fill');
    const labelEl = document.getElementById('corner-progress-label');

    if (messageEl) messageEl.textContent = message;
    if (fillEl) fillEl.style.width = percentage + '%';
    if (labelEl) labelEl.textContent = `${current} / ${total}`;

    if (details) {
        const detailsDiv = document.getElementById('corner-progress-details');
        if (detailsDiv) {
            detailsDiv.innerHTML += `<div>✓ ${details}</div>`;
            detailsDiv.scrollTop = detailsDiv.scrollHeight;
        }
    }
}

/**
 * Close corner progress notification
 */
function closeCornerProgress() {
    const corner = document.getElementById('corner-progress');
    if (corner) corner.style.display = 'none';
}

/**
 * Toggle corner progress minimized state
 */
function toggleCornerProgress() {
    const corner = document.getElementById('corner-progress');
    if (corner) corner.classList.toggle('minimized');
}

// ============================================================================
// PROGRESS MODAL UTILITIES
// ============================================================================

/**
 * Open progress modal
 */
function openProgressModal(title, total) {
    const modal = document.getElementById('progress-modal');
    const titleEl = document.getElementById('progress-title');
    const messageEl = document.getElementById('progress-message');
    const labelEl = document.getElementById('progress-label');
    const fillEl = document.getElementById('progress-fill');
    const detailsEl = document.getElementById('progress-details');
    const cancelBtn = document.getElementById('progress-cancel-btn');
    const doneBtn = document.getElementById('progress-done-btn');

    if (!modal) return;

    titleEl.textContent = title;
    messageEl.textContent = 'Starting batch processing...';
    labelEl.textContent = `0 / ${total}`;
    fillEl.style.width = '0%';
    detailsEl.textContent = '';
    cancelBtn.style.display = 'inline-block';
    doneBtn.style.display = 'none';

    modal.style.display = 'flex';
}

/**
 * Update progress modal
 */
function updateProgressModal(current, total, message, isDone) {
    const messageEl = document.getElementById('progress-message');
    const labelEl = document.getElementById('progress-label');
    const fillEl = document.getElementById('progress-fill');
    const cancelBtn = document.getElementById('progress-cancel-btn');
    const doneBtn = document.getElementById('progress-done-btn');

    if (messageEl) messageEl.textContent = message;
    if (labelEl) labelEl.textContent = `${current} / ${total}`;
    if (fillEl) {
        const percentage = (current / total) * 100;
        fillEl.style.width = `${percentage}%`;
    }

    if (isDone) {
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (doneBtn) doneBtn.style.display = 'inline-block';
    }
}

/**
 * Update progress details
 */
function updateProgressDetails(detail) {
    const detailsEl = document.getElementById('progress-details');
    if (!detailsEl) return;

    // Keep last 5 details
    const lines = detailsEl.textContent.split('\n').filter(l => l.trim());
    lines.push(detail);
    if (lines.length > 5) lines.shift();

    detailsEl.textContent = lines.join('\n');
}

/**
 * Close progress modal
 */
function closeProgressModal() {
    const modal = document.getElementById('progress-modal');
    if (modal) modal.style.display = 'none';
}

// Expose functions globally for HTML onclick handlers
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveSettings = saveSettings;
window.generateAllSynopses = generateAllSynopses;
window.autoTagScript = autoTagScript;
window.cancelBatchProcessing = cancelBatchProcessing;
window.closeProgressModal = closeProgressModal;
window.toggleCornerProgress = toggleCornerProgress;
