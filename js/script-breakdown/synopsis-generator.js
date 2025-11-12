/**
 * synopsis-generator.js
 * Context-aware synopsis generation using narrative understanding
 *
 * Enhances basic synopsis generation by incorporating:
 * - Character importance scores
 * - Narrative position (act, phase)
 * - Critical continuity elements
 * - Story structure awareness
 */

import { callAI } from './ai-integration.js';
import { state } from './main.js';
import { narrativeAnalyzer } from './narrative-analyzer.js';

/**
 * Generate context-aware synopsis for a scene
 * Uses narrative context to create more intelligent synopses
 */
export async function generateContextAwareSynopsis(sceneIndex) {
    const context = window.scriptNarrativeContext;
    const scene = state.scenes[sceneIndex];

    if (!scene) {
        throw new Error('Scene not found');
    }

    // If no narrative context available, fall back to basic synopsis
    if (!context) {
        console.warn('⚠️ No narrative context available, using basic synopsis');
        return generateBasicSynopsis(scene);
    }

    // Determine narrative position
    const position = narrativeAnalyzer.getNarrativePosition(sceneIndex);

    // Get relevant characters with importance scores
    const relevantCharacters = getSceneCharacters(scene, context);

    // Get continuity elements for this scene
    const continuityElements = getContinuityForScene(sceneIndex, context);

    // Check if this is a turning point or climax scene
    const isTurningPoint = context.storyStructure?.turningPoints?.some(
        tp => tp.scene === scene.number
    );
    const isClimaxScene = context.storyStructure?.climax?.scenes?.includes(scene.number);

    const sceneText = scene.content || scene.text || '';

    const prompt = `You are analyzing a scene within its full narrative context for a professional script breakdown.

NARRATIVE CONTEXT:
- Genre: ${context.genre}
- Tone: ${context.tone}
- Current Position: Act ${position.act} - ${position.phase}
- Scene ${sceneIndex + 1} of ${context.totalScenes} (${Math.round(((sceneIndex + 1) / context.totalScenes) * 100)}% through story)
- Dramatic Tension Level: ${position.tension}/10
${isTurningPoint ? '⚠️ This is a TURNING POINT in the narrative' : ''}
${isClimaxScene ? '🎯 This is part of the CLIMAX' : ''}

IMPORTANT CHARACTERS IN THIS SCENE:
${relevantCharacters.length > 0
    ? relevantCharacters.map(c => `- ${c.name} (importance: ${c.importance}/10)`).join('\n')
    : '- [Characters to be detected from scene text]'
}

SCENE TO ANALYZE:
${scene.heading}

${sceneText}

CONTINUITY TRACKING REQUIRED:
${continuityElements.length > 0
    ? continuityElements.join('\n')
    : 'No critical continuity elements flagged for this scene'
}

Generate a synopsis that:
1. Describes key dramatic action in 20-30 words
2. Highlights narrative significance based on story position
3. Flags important continuity elements (injuries, costume changes, makeup effects)
4. Rates scene importance: Critical/Important/Supporting/Transitional

Return ONLY valid JSON:
{
    "synopsis": "Concise 20-30 word synopsis focusing on dramatic action",
    "importance": "Critical|Important|Supporting|Transitional",
    "continuityNotes": ["note1", "note2"],
    "narrativeSignificance": "Brief note on why this scene matters to overall story"
}`;

    try {
        const response = await callAI(prompt, 500);

        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn('No JSON in response, falling back to basic synopsis');
            return generateBasicSynopsis(scene);
        }

        const data = JSON.parse(jsonMatch[0]);

        // Log context-aware insights
        console.log(`📝 Synopsis for Scene ${scene.number}:`, {
            position: `Act ${position.act} - ${position.phase}`,
            importance: data.importance,
            continuity: data.continuityNotes?.length || 0
        });

        return {
            synopsis: data.synopsis,
            importance: data.importance,
            continuityNotes: data.continuityNotes || [],
            narrativeSignificance: data.narrativeSignificance || ''
        };

    } catch (error) {
        console.error('Error generating context-aware synopsis:', error);
        // Fallback to basic synopsis
        return generateBasicSynopsis(scene);
    }
}

/**
 * Generate basic synopsis without narrative context (fallback)
 */
async function generateBasicSynopsis(scene) {
    const sceneText = scene.content || scene.text || '';

    const prompt = `Analyze this scene and provide a concise synopsis.

Scene Heading: ${scene.heading}

Scene Text:
${sceneText}

Write a synopsis in EXACTLY 20-30 words. Focus on the key dramatic action.

Provide only the synopsis text.`;

    try {
        const synopsis = await callAI(prompt, 200);
        return {
            synopsis: synopsis.trim(),
            importance: 'Supporting',
            continuityNotes: [],
            narrativeSignificance: ''
        };
    } catch (error) {
        console.error('Error generating basic synopsis:', error);
        throw error;
    }
}

/**
 * Get characters present in scene with importance scores
 */
function getSceneCharacters(scene, context) {
    if (!context.characters) return [];

    const sceneText = (scene.content || scene.text || '').toUpperCase();
    const sceneNumber = scene.number;

    // Find characters likely in this scene
    return context.characters
        .filter(char => {
            // Check if character name appears in scene text
            const nameInText = sceneText.includes(char.name.toUpperCase());
            // Or if scene is in their physical changes list
            const hasChangeInScene = char.physicalChanges?.some(
                change => change.scene === sceneNumber
            );
            return nameInText || hasChangeInScene;
        })
        .sort((a, b) => b.importance - a.importance) // Sort by importance
        .slice(0, 5); // Top 5 most important characters
}

/**
 * Get continuity elements flagged for this scene
 */
function getContinuityForScene(sceneIndex, context) {
    if (!context.continuityFlags) return [];

    const sceneNumber = sceneIndex + 1;
    const elements = [];

    // Check continuity flags
    context.continuityFlags.forEach(flag => {
        if (flag.scenes.includes(sceneNumber)) {
            const priority = flag.critical ? '🔴 CRITICAL' : '⚠️';
            elements.push(`${priority} ${flag.element} - ${flag.reason || 'Track carefully'}`);
        }
    });

    // Check for injuries in this scene
    if (context.elements?.injuries) {
        context.elements.injuries.forEach(injury => {
            if (injury.scene === sceneNumber || injury.healingScenes?.includes(sceneNumber)) {
                const stage = injury.scene === sceneNumber ? 'NEW INJURY' : 'Healing progression';
                elements.push(`🩹 ${injury.character}: ${injury.type} (${stage})`);
            }
        });
    }

    // Check for makeup changes
    if (context.elements?.makeupChanges) {
        context.elements.makeupChanges.forEach(change => {
            if (change.scene === sceneNumber && change.importance >= 5) {
                elements.push(`💄 ${change.character}: ${change.description}`);
            }
        });
    }

    // Check for hair changes
    if (context.elements?.hairChanges) {
        context.elements.hairChanges.forEach(change => {
            if (change.scene === sceneNumber && change.importance >= 5) {
                elements.push(`💇 ${change.character}: ${change.description}`);
            }
        });
    }

    // Check for weather effects
    if (context.elements?.weatherEffects) {
        context.elements.weatherEffects.forEach(weather => {
            if (weather.scene === sceneNumber) {
                const chars = weather.affectsCharacters?.join(', ') || 'all characters';
                elements.push(`🌧️ Weather: ${weather.effect} affects ${chars}`);
            }
        });
    }

    return elements;
}

/**
 * Batch generate synopses for all scenes with narrative awareness
 */
export async function generateAllContextAwareSynopses(progressCallback) {
    const scenes = state.scenes;
    if (!scenes || scenes.length === 0) {
        throw new Error('No scenes to process');
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < scenes.length; i++) {
        try {
            if (progressCallback) {
                progressCallback(i + 1, scenes.length, `Processing scene ${i + 1}...`);
            }

            const result = await generateContextAwareSynopsis(i);

            // Save to state
            state.scenes[i].synopsis = result.synopsis;
            state.scenes[i].importance = result.importance;
            state.scenes[i].narrativeSignificance = result.narrativeSignificance;

            if (!state.sceneBreakdowns[i]) {
                state.sceneBreakdowns[i] = {};
            }
            state.sceneBreakdowns[i].synopsis = result.synopsis;
            state.sceneBreakdowns[i].importance = result.importance;

            results.push({ sceneIndex: i, success: true, data: result });
            successCount++;

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.error(`Error generating synopsis for scene ${i}:`, error);
            results.push({ sceneIndex: i, success: false, error: error.message });
            errorCount++;
        }
    }

    return {
        total: scenes.length,
        successCount,
        errorCount,
        results
    };
}
