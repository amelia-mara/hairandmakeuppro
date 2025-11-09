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

Write a synopsis in EXACTLY 20-30 words. Be extremely concise and focus only on the key action or beat of the scene.
STRICT REQUIREMENT: The synopsis must be between 20-30 words. Count carefully.
Focus on the primary dramatic action or event in the scene.

Provide only the synopsis text, no additional commentary or explanations.`;

    try {
        const synopsis = await callAI(prompt, 200);
        return synopsis.trim();
    } catch (error) {
        console.error('Error generating synopsis:', error);
        throw error;
    }
}

/**
 * Detect elements using AI with enhanced continuity tracking
 * Captures descriptive sentences and phrases for professional hair/makeup/wardrobe continuity
 */
export async function detectAIElements(sceneIndex) {
    if (sceneIndex < 0 || sceneIndex >= state.scenes.length) return;

    const scene = state.scenes[sceneIndex];
    const sceneText = scene.content || scene.text || '';

    // Get confirmed character names for validation
    const confirmedCharNames = Array.from(state.confirmedCharacters);

    const prompt = `You are analyzing a screenplay scene for production continuity, specifically for hair, makeup, wardrobe, and SFX departments.

Scene Heading: ${scene.heading}

Scene Text:
${sceneText}

Confirmed Characters in Script: ${confirmedCharNames.join(', ')}

**CRITICAL**: Your task is to identify and extract ALL descriptive information about character appearance, condition, and any changes that occur. Capture COMPLETE SENTENCES or PHRASES that describe appearance - not just keywords.

**TAGGING RULES:**

1. HAIR - Capture descriptive phrases about:
   - Hairstyle: "long auburn hair", "hair tied in a messy bun", "slicked back"
   - Condition: "windswept hair", "wet and matted", "disheveled", "perfectly styled"
   - Changes: "cuts her hair short", "dyes it red", "removes the wig"
   - Accessories: "wearing a hat", "headband visible"
   - Environmental effects: "rain soaks her hair", "wind tangles his hair"

2. MAKEUP - Capture phrases about:
   - Application: "flawless makeup", "smoky eyes", "red lipstick", "natural look"
   - Condition: "smudged mascara", "makeup running", "faded lipstick"
   - Skin: "pale complexion", "flushed face", "tanned", "sunburned"
   - Changes: "wipes off her makeup", "applies fresh lipstick"

3. SFX (Special Effects) - Capture phrases about:
   - Prosthetics: "wearing a fake scar", "latex appliances", "aged 30 years"
   - Fantasy elements: "pointed ears", "alien skin texture", "vampire fangs"
   - Transformations: "transforms into a creature", "appears elderly"

4. HEALTH/ILLNESS - Capture phrases about:
   - Condition: "looks pale and sweaty", "feverish appearance", "exhausted"
   - Symptoms: "dark circles under eyes", "clammy skin", "shivering"
   - Recovery: "regaining color", "looking healthier"

5. INJURIES - Capture phrases about:
   - Wounds: "bleeding cut above eyebrow", "gash on forehead", "blood trickling down face"
   - Bruises: "black eye forming", "purple bruise on cheek"
   - Treatment: "bandaged wound", "fresh stitches", "wrapped in gauze"
   - Blood: "blood on face", "bloodstained shirt", "dried blood"

6. STUNTS - Capture action that affects appearance:
   - Physical action: "thrown into mud", "crashes through window"
   - Getting messy: "covered in dirt", "splashed with water", "dust cloud hits them"

7. WEATHER - Capture environmental effects on appearance:
   - Rain: "rain soaks them", "dripping wet"
   - Wind: "wind whips her hair"
   - Heat/Cold: "sweat beading on forehead", "frost in his beard"

8. WARDROBE - Capture clothing descriptions:
   - Descriptions: "wearing a red vintage jacket", "torn jeans", "pristine suit"
   - Condition: "mud-stained shirt", "ripped from the fight", "soaking wet clothes"
   - Changes: "changes into a blue dress", "removes his jacket"

9. EXTRAS - Background performers:
   - Crowds: "packed with passengers", "dozens of pedestrians"
   - Types: "tourists with cameras", "businessmen in suits"

**OUTPUT FORMAT** (JSON only, no explanation):
{
  "tags": [
    {
      "category": "hair|makeup|sfx|health|injuries|stunts|weather|wardrobe|extras|cast",
      "character": "EXACT CHARACTER NAME from confirmed list or null",
      "text": "The actual descriptive phrase from the script (complete sentence or phrase)",
      "confidence": "high|medium|low"
    }
  ]
}

**IMPORTANT**:
- Capture COMPLETE descriptive phrases, not keywords
- Link to specific CHARACTER when possible (use exact names from confirmed list)
- Tag the same text in MULTIPLE categories if relevant (e.g., "blood on face" = both injuries AND makeup)
- Include contextual action if it affects appearance
- Use "cast" category for character presence/introductions

Example:
Input: "GWEN's long auburn hair whips in the wind as rain soaks her jacket."
Output: {
  "tags": [
    {"category": "hair", "character": "Gwen Lawson", "text": "long auburn hair whips in the wind", "confidence": "high"},
    {"category": "weather", "character": "Gwen Lawson", "text": "wind", "confidence": "high"},
    {"category": "weather", "character": "Gwen Lawson", "text": "rain soaks her jacket", "confidence": "high"},
    {"category": "wardrobe", "character": "Gwen Lawson", "text": "rain soaks her jacket", "confidence": "high"}
  ]
}

Analyze the scene and return ALL relevant tags as JSON.`;

    try {
        const response = await callAI(prompt, 2000); // Increased token limit for detailed responses

        // Parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No valid JSON found in response');
        }

        const data = JSON.parse(jsonMatch[0]);

        // Process tags and organize by category
        const tagsByCategory = {
            cast: [],
            hair: [],
            makeup: [],
            sfx: [],
            health: [],
            injuries: [],
            stunts: [],
            weather: [],
            wardrobe: [],
            extras: []
        };

        const allTags = [];

        if (data.tags && Array.isArray(data.tags)) {
            data.tags.forEach(tag => {
                // Validate tag structure
                if (!tag.category || !tag.text) {
                    console.warn('Invalid tag structure:', tag);
                    return;
                }

                // Normalize character name using CharacterManager if available
                let normalizedCharacter = null;
                if (tag.character) {
                    if (window.characterManager) {
                        normalizedCharacter = window.characterManager.getCanonicalName(tag.character) || tag.character;
                    } else {
                        // Fallback: try to match against confirmed characters
                        const charUpper = tag.character.toUpperCase();
                        for (const confirmedChar of confirmedCharNames) {
                            if (confirmedChar.toUpperCase() === charUpper ||
                                confirmedChar.toUpperCase().includes(charUpper) ||
                                charUpper.includes(confirmedChar.toUpperCase())) {
                                normalizedCharacter = confirmedChar;
                                break;
                            }
                        }
                        if (!normalizedCharacter) {
                            normalizedCharacter = tag.character;
                        }
                    }
                }

                // Create structured tag object
                const structuredTag = {
                    category: tag.category,
                    character: normalizedCharacter,
                    text: tag.text,
                    confidence: tag.confidence || 'medium',
                    sceneIndex: sceneIndex,
                    sceneNumber: scene.number
                };

                // Add to category array
                if (tagsByCategory[tag.category]) {
                    tagsByCategory[tag.category].push(structuredTag);
                }

                // Add to all tags array
                allTags.push(structuredTag);
            });
        }

        // Extract unique cast members
        const cast = [...new Set(allTags
            .filter(t => t.category === 'cast' && t.character)
            .map(t => t.character))];

        // Return in compatible format
        return {
            cast: cast,
            elements: {
                hair: tagsByCategory.hair.map(t => t.text),
                makeup: tagsByCategory.makeup.map(t => t.text),
                sfx: tagsByCategory.sfx.map(t => t.text),
                health: tagsByCategory.health.map(t => t.text),
                injuries: tagsByCategory.injuries.map(t => t.text),
                stunts: tagsByCategory.stunts.map(t => t.text),
                weather: tagsByCategory.weather.map(t => t.text),
                wardrobe: tagsByCategory.wardrobe.map(t => t.text),
                extras: tagsByCategory.extras.map(t => t.text)
            },
            // Enhanced: return structured tags with character info
            structuredTags: allTags
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
export async function generateAllSynopses(event) {
    if (!state.scenes || state.scenes.length === 0) {
        alert('No scenes loaded. Please import a script first.');
        return;
    }

    // Get the button element from the event
    const button = event?.currentTarget;
    if (!button) {
        console.error('Button element not found in event');
        return;
    }

    // Reset cancellation flag
    batchCancelled = false;

    // Start button progress
    startButtonProgress(button, state.scenes.length);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < state.scenes.length; i++) {
        if (batchCancelled) {
            resetButton(button);
            alert(`Processing cancelled. ${successCount} synopses generated, ${errorCount} failed.`);
            return;
        }

        const scene = state.scenes[i];
        updateButtonProgress(button, i + 1, `Scene ${i + 1} / ${state.scenes.length}`);

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
            console.log(`✓ Scene ${scene.number} synopsis generated`);
        } catch (error) {
            console.error(`Error generating synopsis for scene ${i}:`, error);
            errorCount++;
            errors.push(`Scene ${scene.number}: ${error.message}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Deduplicate all characters after synopsis generation
    console.log('🔄 Running character deduplication...');
    const { deduplicateAllCharacters } = await import('./character-panel.js');
    deduplicateAllCharacters();

    // Save project data
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Complete with success
    const successMessage = errorCount > 0
        ? `${successCount} Synopses Created (${errorCount} errors)`
        : `${successCount} Synopses Created`;

    completeButtonProgress(button, successMessage);

    // Refresh UI if we're viewing a scene
    if (state.currentScene !== null) {
        const { renderBreakdownPanel } = await import('./breakdown-form.js');
        renderBreakdownPanel();
    }
}

/**
 * Auto-tag the entire script with AI detection
 * REQUIRES: Characters must be confirmed via "Detect & Review Characters" first
 * This function ONLY does AI tagging - no character detection
 */
export async function autoTagScript(event) {
    if (!state.scenes || state.scenes.length === 0) {
        alert('No scenes loaded. Please import a script first.');
        return;
    }

    // CRITICAL CHECK: Ensure characters have been confirmed first
    if (!state.confirmedCharacters || state.confirmedCharacters.size === 0) {
        console.warn('⚠️ Auto Tag Script blocked - no confirmed characters');
        // Show the error modal
        openCharactersNotConfirmedModal();
        return;
    }

    console.log('✓ Confirmed characters found:', Array.from(state.confirmedCharacters));

    // Get the button element from the event
    const button = event?.currentTarget;
    if (!button) {
        console.error('Button element not found in event');
        return;
    }

    console.log('🤖 Starting Auto Tag Script...');
    console.log('📊 Total scenes to process:', state.scenes.length);
    console.log('👥 Using confirmed characters:', Array.from(state.confirmedCharacters));

    // Reset cancellation flag
    batchCancelled = false;

    // Start button progress
    startButtonProgress(button, state.scenes.length);

    let successCount = 0;
    let errorCount = 0;
    let totalTagsCreated = 0;
    const errors = [];
    const allCategories = ['cast', 'hair', 'makeup', 'sfx', 'health', 'injuries', 'stunts', 'weather', 'wardrobe', 'extras'];

    console.log('📋 Will detect categories:', allCategories.join(', '));

    for (let i = 0; i < state.scenes.length; i++) {
        if (batchCancelled) {
            resetButton(button);
            alert(`Processing cancelled. ${successCount} scenes tagged, ${errorCount} failed.`);
            return;
        }

        const scene = state.scenes[i];
        console.log(`\n📋 Processing scene ${i + 1}/${state.scenes.length} (Scene #${scene.number})`);
        updateButtonProgress(button, i + 1, `Scene ${i + 1} / ${state.scenes.length}`);

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

            // Cast members - normalize through CharacterManager
            if (result.cast && result.cast.length > 0) {
                // Normalize all character names
                const normalizedCast = result.cast.map(char =>
                    window.characterManager.addCharacter(char)
                ).filter(Boolean);

                breakdown.cast = [...new Set([...(breakdown.cast || []), ...normalizedCast])];

                // Add to global characters set
                normalizedCast.forEach(char => state.characters.add(char));
            }

            // Other elements
            if (result.elements) {
                Object.keys(result.elements).forEach(category => {
                    if (result.elements[category] && result.elements[category].length > 0) {
                        breakdown[category] = [...new Set([...(breakdown[category] || []), ...result.elements[category]])];
                    }
                });
            }

            // Create tag objects in scriptTags for highlighting
            if (!state.scriptTags[i]) {
                state.scriptTags[i] = [];
            }

            let sceneTagsCreated = 0;
            const existingTagTexts = new Set(); // For deduplication

            // Use enhanced structured tags if available
            if (result.structuredTags && result.structuredTags.length > 0) {
                console.log(`  Processing ${result.structuredTags.length} structured tags...`);

                result.structuredTags.forEach(structuredTag => {
                    // Deduplication: Create unique key for tag
                    const dedupeKey = `${structuredTag.category}:${structuredTag.character || 'none'}:${structuredTag.text.toLowerCase()}`;

                    if (existingTagTexts.has(dedupeKey)) {
                        console.log(`    ⊘ Skipping duplicate: "${structuredTag.text.substring(0, 30)}..."`);
                        return;
                    }
                    existingTagTexts.add(dedupeKey);

                    // Normalize character name
                    let canonicalName = structuredTag.character;
                    if (canonicalName && window.characterManager) {
                        canonicalName = window.characterManager.getCanonicalName(canonicalName) || canonicalName;
                    }

                    const tag = {
                        id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        sceneIndex: i,
                        sceneNumber: scene.number,
                        category: structuredTag.category,
                        selectedText: structuredTag.text.substring(0, 150), // Capture full phrase
                        fullContext: structuredTag.text,
                        character: canonicalName,
                        confidence: structuredTag.confidence || 'medium',
                        created: Date.now()
                    };

                    state.scriptTags[i].push(tag);
                    sceneTagsCreated++;

                    const charInfo = canonicalName ? ` (${canonicalName})` : '';
                    const confidenceIcon = structuredTag.confidence === 'high' ? '✓' : structuredTag.confidence === 'low' ? '?' : '•';
                    console.log(`    ${confidenceIcon} ${structuredTag.category}: "${structuredTag.text.substring(0, 50)}..."${charInfo}`);
                });
            } else {
                // Fallback to legacy format
                console.log(`  Using legacy tag format...`);

                // Create tags for cast members
                if (result.cast && result.cast.length > 0) {
                    result.cast.forEach(castMember => {
                        const canonicalName = window.characterManager?.getCanonicalName(castMember) || castMember;

                        const tag = {
                            id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            sceneIndex: i,
                            sceneNumber: scene.number,
                            category: 'cast',
                            selectedText: canonicalName,
                            fullContext: `Cast member: ${canonicalName}`,
                            character: canonicalName,
                            confidence: 'high',
                            created: Date.now()
                        };
                        state.scriptTags[i].push(tag);
                        sceneTagsCreated++;
                    });
                }

                // Create tags for other elements
                if (result.elements) {
                    Object.keys(result.elements).forEach(category => {
                        if (result.elements[category] && result.elements[category].length > 0) {
                            result.elements[category].forEach(description => {
                                // Deduplication
                                const dedupeKey = `${category}:none:${description.toLowerCase()}`;
                                if (existingTagTexts.has(dedupeKey)) return;
                                existingTagTexts.add(dedupeKey);

                                // Try to detect character from description
                                let detectedCharacter = null;
                                if (result.cast) {
                                    for (const castMember of result.cast) {
                                        if (description.toLowerCase().includes(castMember.toLowerCase())) {
                                            detectedCharacter = window.characterManager?.getCanonicalName(castMember) || castMember;
                                            break;
                                        }
                                    }
                                }

                                const tag = {
                                    id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                    sceneIndex: i,
                                    sceneNumber: scene.number,
                                    category: category,
                                    selectedText: description.substring(0, 150),
                                    fullContext: description,
                                    character: detectedCharacter,
                                    confidence: 'medium',
                                    created: Date.now()
                                };
                                state.scriptTags[i].push(tag);
                                sceneTagsCreated++;
                            });
                        }
                    });
                }
            }

            totalTagsCreated += sceneTagsCreated;
            successCount++;

            const tagCount = state.scriptTags[i] ? state.scriptTags[i].length : 0;
            console.log(`✓ Scene ${scene.number} complete: ${sceneTagsCreated} tags created (total in scene: ${tagCount})`);
        } catch (error) {
            console.error(`Error auto-tagging scene ${i}:`, error);
            errorCount++;
            errors.push(`Scene ${scene.number}: ${error.message}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Deduplicate all characters after tagging
    console.log('🔄 Running character deduplication...');
    const { deduplicateAllCharacters } = await import('./character-panel.js');
    deduplicateAllCharacters();

    // Save project data
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Refresh scene list to show tagged indicators
    const { renderSceneList } = await import('./scene-list.js');
    renderSceneList();

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

    // Complete with success
    const successMessage = errorCount > 0
        ? `${totalTags} Tags Created (${errorCount} errors)`
        : `${totalTags} Tags Created`;

    completeButtonProgress(button, successMessage);

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
// INLINE BUTTON PROGRESS BAR UTILITIES
// ============================================================================

/**
 * Transform a button into a progress bar
 */
function startButtonProgress(buttonElement, totalSteps) {
    // Add processing class
    buttonElement.classList.add('processing');

    // Store original text
    buttonElement.dataset.originalText = buttonElement.textContent;

    // Create progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'toolbar-btn-progress';
    buttonElement.prepend(progressBar);

    // Update button text
    const textSpan = document.createElement('span');
    textSpan.className = 'toolbar-btn-text';
    textSpan.innerHTML = `
        <span class="toolbar-btn-spinner"></span>
        <span class="progress-text">0 / ${totalSteps}</span>
    `;
    buttonElement.innerHTML = '';
    buttonElement.appendChild(progressBar);
    buttonElement.appendChild(textSpan);

    // Store reference for updates
    buttonElement._progressBar = progressBar;
    buttonElement._progressText = textSpan.querySelector('.progress-text');
    buttonElement._totalSteps = totalSteps;
}

/**
 * Update button progress
 */
function updateButtonProgress(buttonElement, currentStep, message = null) {
    if (!buttonElement._progressBar) return;

    const percentage = (currentStep / buttonElement._totalSteps) * 100;
    buttonElement._progressBar.style.width = percentage + '%';

    if (buttonElement._progressText) {
        const displayMessage = message || `${currentStep} / ${buttonElement._totalSteps}`;
        buttonElement._progressText.textContent = displayMessage;
    }
}

/**
 * Complete button progress with success state
 */
function completeButtonProgress(buttonElement, successMessage = 'Complete') {
    if (!buttonElement._progressBar) return;

    // Full progress
    buttonElement._progressBar.style.width = '100%';

    // Show success state
    buttonElement.classList.remove('processing');
    buttonElement.classList.add('success');

    const textSpan = buttonElement.querySelector('.toolbar-btn-text');
    if (textSpan) {
        textSpan.innerHTML = successMessage;
    }

    // Reset after 2 seconds
    setTimeout(() => {
        resetButton(buttonElement);
    }, 2000);
}

/**
 * Reset button to original state
 */
function resetButton(buttonElement) {
    buttonElement.classList.remove('processing', 'success');

    // Remove progress elements
    const progressBar = buttonElement.querySelector('.toolbar-btn-progress');
    if (progressBar) progressBar.remove();

    // Restore original text
    const originalText = buttonElement.dataset.originalText || buttonElement.textContent;
    buttonElement.innerHTML = originalText;

    // Clean up stored references
    delete buttonElement._progressBar;
    delete buttonElement._progressText;
    delete buttonElement._totalSteps;
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

// ============================================================================
// CHARACTERS NOT CONFIRMED MODAL
// ============================================================================

/**
 * Open the characters not confirmed modal
 */
function openCharactersNotConfirmedModal() {
    const modal = document.getElementById('characters-not-confirmed-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

/**
 * Close the characters not confirmed modal
 */
function closeCharactersNotConfirmedModal() {
    const modal = document.getElementById('characters-not-confirmed-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Expose functions globally for HTML onclick handlers
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveSettings = saveSettings;
window.generateAllSynopses = generateAllSynopses;
window.autoTagScript = autoTagScript;
window.cancelBatchProcessing = cancelBatchProcessing;
window.closeProgressModal = closeProgressModal;
window.startButtonProgress = startButtonProgress;
window.updateButtonProgress = updateButtonProgress;
window.completeButtonProgress = completeButtonProgress;
window.resetButton = resetButton;
window.openCharactersNotConfirmedModal = openCharactersNotConfirmedModal;
window.closeCharactersNotConfirmedModal = closeCharactersNotConfirmedModal;
