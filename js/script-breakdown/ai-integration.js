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

    const prompt = `You are a script breakdown assistant. Analyze this scene and provide a brief synopsis (2-3 sentences) focusing on the main action and key moments for hair/makeup continuity.

Scene Heading: ${scene.heading}

Scene Text:
${sceneText}

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

    const prompt = `You are a script breakdown assistant. Analyze this scene and extract breakdown information in JSON format.

Scene Heading: ${scene.heading}

Scene Text:
${sceneText}

Return ONLY valid JSON with this structure:
{
  "cast": ["Character Name 1", "Character Name 2"],
  "hair": ["Description of hair needs"],
  "makeup": ["Description of makeup needs"],
  "sfx": ["Description of special effects/prosthetics"],
  "wardrobe": ["Description of wardrobe/costume needs"]
}

Rules:
- Cast: Only speaking characters or named characters
- Hair: Specific hair styling, wigs, or notable hair elements
- Makeup: Beauty makeup, character makeup, aging, bruising, etc.
- SFX: Prosthetics, wounds, blood, special makeup effects
- Wardrobe: Costume changes, specific costume details

Return ONLY the JSON, no explanation.`;

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
                wardrobe: elements.wardrobe || []
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

// Expose functions globally for HTML onclick handlers
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveSettings = saveSettings;
