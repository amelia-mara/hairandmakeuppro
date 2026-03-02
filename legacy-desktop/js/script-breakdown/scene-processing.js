/**
 * scene-processing.js
 * Scene-by-scene processing functionality
 *
 * Handles individual scene processing with master context:
 * - Process entire scene (synopsis + tags)
 * - Generate synopsis only
 * - Generate tags only
 * - Track processing status
 */

import { state } from './main.js';
import { callAI } from './ai-integration.js';
import { renderSceneList } from './scene-list.js';
import { renderBreakdownPanel } from './breakdown-form.js';
import { saveProject } from './export-handlers.js';

/**
 * Process individual scene with both synopsis and tags
 * References the master context for intelligent generation
 */
export async function processThisScene(sceneIndex) {
    const scene = state.scenes[sceneIndex];
    if (!scene) return;

    console.log(`🔄 Processing scene ${scene.number}...`);

    try {
        // Generate both synopsis and tags
        await generateSceneSynopsis(sceneIndex);
        await generateSceneTags(sceneIndex);

        // Mark as processed
        scene.processed = true;
        scene.processedAt = Date.now();

        // Save project
        saveProject();

        // Refresh display
        renderBreakdownPanel();
        renderSceneList();

        showToast(`Scene ${scene.number} processed successfully`, 'success');

    } catch (error) {
        console.error('Failed to process scene:', error);
        showToast('Error processing scene: ' + error.message, 'error');
    }
}

/**
 * Generate synopsis for a scene using master context
 * Uses the comprehensive character and story context for better synopses
 */
export async function generateSceneSynopsis(sceneIndex) {
    if (!window.masterContext) {
        throw new Error('Please import and analyze a script first');
    }

    const scene = state.scenes[sceneIndex];
    const sceneText = scene.content || scene.text || '';

    // Get relevant context for this scene
    const relevantCharacters = getRelevantCharactersForScene(sceneIndex);
    const storyContext = getStoryContextForScene(sceneIndex);
    const continuityElements = getContinuityElementsForScene(sceneIndex);

    const prompt = `
MASTER CONTEXT:
${JSON.stringify(window.masterContext, null, 2)}

CURRENT SCENE ${sceneIndex + 1}:
${scene.heading}

${sceneText}

RELEVANT CHARACTERS IN THIS SCENE:
${relevantCharacters.map(c => `- ${c.name} (${c.role}): ${c.description}`).join('\n')}

STORY CONTEXT:
${storyContext}

CONTINUITY ELEMENTS TO TRACK:
${continuityElements.length > 0 ? continuityElements.join('\n') : 'None flagged'}

Generate a brief synopsis focusing on:
1. What happens that affects continuity
2. Character appearance changes
3. Emotional/physical state changes
4. Time of day and story day
5. Any visual continuity elements mentioned

Keep it concise (30-50 words) but include all visual continuity elements.
Return only the synopsis text, no additional formatting.
`;

    try {
        const synopsis = await callAI(prompt, 300);

        // Save to scene
        scene.synopsis = synopsis.trim();
        if (!state.sceneBreakdowns[sceneIndex]) {
            state.sceneBreakdowns[sceneIndex] = {};
        }
        state.sceneBreakdowns[sceneIndex].synopsis = synopsis.trim();

        console.log(`✓ Synopsis generated for scene ${scene.number}`);

    } catch (error) {
        console.error('Error generating synopsis:', error);
        throw error;
    }
}

/**
 * Generate tags for a scene using master context
 * Identifies visual elements that need tracking
 */
export async function generateSceneTags(sceneIndex) {
    if (!window.masterContext) {
        throw new Error('Please import and analyze a script first');
    }

    const scene = state.scenes[sceneIndex];
    const sceneText = scene.content || scene.text || '';

    // Get confirmed character names for validation
    const confirmedCharNames = window.confirmedCharacters || [];

    const prompt = `
MASTER CONTEXT:
${JSON.stringify(window.masterContext, null, 2)}

CURRENT SCENE ${sceneIndex + 1}:
${scene.heading}

${sceneText}

Generate tags for visual elements that need tracking:
- Hair changes/mentions
- Makeup/injuries
- Wardrobe descriptions
- Health conditions
- Weather effects
- Any visual continuity elements

Return as JSON array of tags with:
{
    "tags": [
        {
            "text": "tagged text from script",
            "category": "hair/makeup/wardrobe/injury/health/weather/stunts/sfx/extras",
            "character": "character name if applicable (use exact names from master context)"
        }
    ]
}

Be selective - only tag what matters for continuity.
Use exact character names from the master context.
Return ONLY valid JSON, no additional text.
`;

    try {
        const response = await callAI(prompt, 2000);

        // Parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No valid JSON found in response');
        }

        const data = JSON.parse(jsonMatch[0]);

        if (!data.tags || !Array.isArray(data.tags)) {
            console.warn('No tags returned for scene');
            return;
        }

        // Initialize scriptTags if needed
        if (!state.scriptTags[sceneIndex]) {
            state.scriptTags[sceneIndex] = [];
        }

        // Initialize breakdown if needed
        if (!state.sceneBreakdowns[sceneIndex]) {
            state.sceneBreakdowns[sceneIndex] = {};
        }

        // Process each tag
        const breakdown = state.sceneBreakdowns[sceneIndex];
        let tagsCreated = 0;

        data.tags.forEach(tag => {
            // Validate tag structure
            if (!tag.category || !tag.text) {
                console.warn('Invalid tag structure:', tag);
                return;
            }

            // Normalize character name if present
            let normalizedCharacter = null;
            if (tag.character) {
                // Try to match against confirmed characters
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

            // Create structured tag object
            const structuredTag = {
                id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                sceneIndex: sceneIndex,
                sceneNumber: scene.number,
                category: tag.category,
                selectedText: tag.text.substring(0, 150),
                fullContext: tag.text,
                character: normalizedCharacter,
                confidence: 'high',
                created: Date.now()
            };

            // Add to scriptTags for highlighting
            state.scriptTags[sceneIndex].push(structuredTag);

            // Add to breakdown by category
            if (tag.category === 'cast' && normalizedCharacter) {
                if (!breakdown.cast) breakdown.cast = [];
                if (!breakdown.cast.includes(normalizedCharacter)) {
                    breakdown.cast.push(normalizedCharacter);
                }
            } else {
                if (!breakdown[tag.category]) breakdown[tag.category] = [];
                if (!breakdown[tag.category].includes(tag.text)) {
                    breakdown[tag.category].push(tag.text);
                }
            }

            tagsCreated++;
        });

        console.log(`✓ ${tagsCreated} tags generated for scene ${scene.number}`);

        // Apply tags to script display
        const { renderAllHighlights } = await import('./tag-system.js');
        renderAllHighlights();

    } catch (error) {
        console.error('Error generating tags:', error);
        throw error;
    }
}

/**
 * Get relevant characters for a scene from master context
 */
function getRelevantCharactersForScene(sceneIndex) {
    if (!window.masterContext || !window.masterContext.characters) {
        return [];
    }

    const scene = state.scenes[sceneIndex];
    const sceneText = (scene.content || scene.text || '').toUpperCase();

    const characters = [];
    Object.entries(window.masterContext.characters).forEach(([name, data]) => {
        // Check if character name appears in scene text
        if (sceneText.includes(name.toUpperCase())) {
            characters.push({
                name: name,
                role: data.role,
                description: data.description
            });
        }
    });

    return characters;
}

/**
 * Get story context for a scene
 */
function getStoryContextForScene(sceneIndex) {
    if (!window.masterContext || !window.masterContext.storyStructure) {
        return 'No story context available';
    }

    const structure = window.masterContext.storyStructure;
    const scene = state.scenes[sceneIndex];
    const sceneNumber = scene.number;

    // Find which story day this scene belongs to
    let storyDay = null;
    if (structure.timeline) {
        for (const day of structure.timeline) {
            if (day.scenes && day.scenes.includes(sceneNumber)) {
                storyDay = day;
                break;
            }
        }
    }

    if (storyDay) {
        return `${storyDay.day} - ${storyDay.description}`;
    }

    return `Scene ${sceneIndex + 1} of ${structure.totalScenes || state.scenes.length}`;
}

/**
 * Get continuity elements flagged for this scene
 */
function getContinuityElementsForScene(sceneIndex) {
    const elements = [];
    const scene = state.scenes[sceneIndex];
    const sceneNumber = scene.number;

    // Check major events
    if (window.masterContext && window.masterContext.majorEvents) {
        window.masterContext.majorEvents.forEach(event => {
            if (event.scene === sceneNumber) {
                elements.push(`${event.type}: ${event.visualImpact} (affects ${event.charactersAffected.join(', ')})`);
            }
        });
    }

    return elements;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast-notification');
    existingToasts.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        font-size: 0.9em;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Expose functions globally for HTML onclick handlers
window.processThisScene = processThisScene;
window.generateSceneSynopsis = generateSceneSynopsis;
window.generateSceneTags = generateSceneTags;

export default {
    processThisScene,
    generateSceneSynopsis,
    generateSceneTags
};
