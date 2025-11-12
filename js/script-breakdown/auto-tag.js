/**
 * auto-tag.js
 * Narrative-aware auto-tagging system
 *
 * Enhances auto-tagging by:
 * - Prioritizing main characters (importance > 7)
 * - Focusing on plot-critical elements
 * - Tracking recurring motifs
 * - Identifying setup/payoff moments
 */

import { callAI } from './ai-integration.js';
import { state } from './main.js';
import { narrativeAnalyzer } from './narrative-analyzer.js';

/**
 * Perform smart auto-tagging using narrative importance
 * Prioritizes elements based on story significance
 */
export async function performSmartAutoTag(sceneIndex) {
    const context = window.scriptNarrativeContext;
    const scene = state.scenes[sceneIndex];

    if (!scene) {
        throw new Error('Scene not found');
    }

    // If no narrative context, fall back to basic tagging
    if (!context) {
        console.warn('⚠️ No narrative context available, using basic tagging');
        return performBasicAutoTag(scene);
    }

    // Build character importance map
    const characterWeights = {};
    if (context.characters) {
        context.characters.forEach(char => {
            characterWeights[char.name] = char.importance;
        });
    }

    // Get critical story elements for this scene
    const criticalElements = getCriticalElementsForScene(sceneIndex, context);

    const sceneText = scene.content || scene.text || '';
    const position = narrativeAnalyzer.getNarrativePosition(sceneIndex);

    const prompt = `Analyze this scene for professional continuity tagging using narrative importance.

NARRATIVE IMPORTANCE SCORES (1-10):
${Object.entries(characterWeights).map(([name, score]) => `- ${name}: ${score}/10`).join('\n') || 'No character scores available'}

CRITICAL STORY ELEMENTS TO WATCH:
${JSON.stringify(criticalElements, null, 2)}

SCENE POSITION: Act ${position.act} - ${position.phase}

SCENE TO TAG:
${scene.heading}

${sceneText}

TAGGING PRIORITY ORDER:
1. Main character appearance changes (importance > 7)
2. Plot-critical injuries/conditions
3. Recurring visual motifs
4. Setup/payoff elements
5. Key continuity markers

ONLY tag narratively significant elements. Filter out background details.

Categories: cast, hair, makeup, sfx, health, injuries, stunts, weather, wardrobe, extras

Return ONLY valid JSON:
{
    "tags": [
        {
            "text": "exact phrase from script to tag",
            "category": "category",
            "character": "CHARACTER NAME or null",
            "importance": 1-10,
            "reason": "why this matters to the story"
        }
    ]
}

Be selective - quality over quantity. Only include elements with importance >= 5.`;

    try {
        const response = await callAI(prompt, 2000);

        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn('No JSON in response, falling back to basic tagging');
            return performBasicAutoTag(scene);
        }

        const data = JSON.parse(jsonMatch[0]);

        // Filter to only high-importance tags
        const smartTags = (data.tags || []).filter(tag => tag.importance >= 5);

        console.log(`🏷️ Smart tags for Scene ${scene.number}:`, {
            totalDetected: data.tags?.length || 0,
            highImportance: smartTags.length,
            characters: smartTags.filter(t => t.character).length
        });

        return {
            tags: smartTags,
            method: 'narrative-aware'
        };

    } catch (error) {
        console.error('Error in smart auto-tagging:', error);
        return performBasicAutoTag(scene);
    }
}

/**
 * Get critical elements for a specific scene
 */
function getCriticalElementsForScene(sceneIndex, context) {
    const sceneNumber = sceneIndex + 1;
    const criticalElements = {
        injuries: [],
        changes: [],
        motifs: [],
        flags: []
    };

    // Check for injuries
    if (context.elements?.injuries) {
        context.elements.injuries.forEach(injury => {
            if (injury.scene === sceneNumber || injury.healingScenes?.includes(sceneNumber)) {
                if (injury.narrativeImportance >= 7) {
                    criticalElements.injuries.push({
                        character: injury.character,
                        type: injury.type,
                        severity: injury.severity
                    });
                }
            }
        });
    }

    // Check for makeup/hair changes
    if (context.elements?.makeupChanges) {
        context.elements.makeupChanges.forEach(change => {
            if (change.scene === sceneNumber && change.importance >= 7) {
                criticalElements.changes.push({
                    type: 'makeup',
                    character: change.character,
                    description: change.description
                });
            }
        });
    }

    if (context.elements?.hairChanges) {
        context.elements.hairChanges.forEach(change => {
            if (change.scene === sceneNumber && change.importance >= 7) {
                criticalElements.changes.push({
                    type: 'hair',
                    character: change.character,
                    description: change.description
                });
            }
        });
    }

    // Check for recurring motifs
    if (context.elements?.recurringMotifs) {
        context.elements.recurringMotifs.forEach(motif => {
            if (motif.scenes?.includes(sceneNumber)) {
                criticalElements.motifs.push({
                    element: motif.element,
                    significance: motif.significance
                });
            }
        });
    }

    // Check continuity flags
    if (context.continuityFlags) {
        context.continuityFlags.forEach(flag => {
            if (flag.critical && flag.scenes?.includes(sceneNumber)) {
                criticalElements.flags.push({
                    element: flag.element,
                    reason: flag.reason
                });
            }
        });
    }

    return criticalElements;
}

/**
 * Basic auto-tagging without narrative context (fallback)
 */
async function performBasicAutoTag(scene) {
    const sceneText = scene.content || scene.text || '';

    const prompt = `Analyze this scene for continuity elements.

Scene: ${scene.heading}

${sceneText}

Identify and extract descriptive phrases about:
- Character appearance (hair, makeup, wardrobe)
- Injuries or physical conditions
- Weather effects
- Special effects

Return ONLY valid JSON:
{
    "tags": [
        {
            "text": "phrase to tag",
            "category": "hair|makeup|sfx|health|injuries|stunts|weather|wardrobe|cast|extras",
            "character": "name or null",
            "importance": 5
        }
    ]
}`;

    try {
        const response = await callAI(prompt, 1500);

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return { tags: [], method: 'basic-fallback' };
        }

        const data = JSON.parse(jsonMatch[0]);

        return {
            tags: data.tags || [],
            method: 'basic'
        };

    } catch (error) {
        console.error('Error in basic auto-tagging:', error);
        return { tags: [], method: 'error' };
    }
}

/**
 * Apply tags to scene with importance filtering
 */
export function applySmartTags(sceneIndex, tagsData) {
    if (!tagsData || !tagsData.tags) return;

    // Initialize scriptTags if needed
    if (!state.scriptTags[sceneIndex]) {
        state.scriptTags[sceneIndex] = [];
    }

    const scene = state.scenes[sceneIndex];
    const existingTagTexts = new Set();

    // Process each tag
    tagsData.tags.forEach(smartTag => {
        // Deduplication check
        const dedupeKey = `${smartTag.category}:${smartTag.character || 'none'}:${smartTag.text.toLowerCase()}`;

        if (existingTagTexts.has(dedupeKey)) {
            console.log(`⊘ Skipping duplicate tag: "${smartTag.text.substring(0, 30)}..."`);
            return;
        }
        existingTagTexts.add(dedupeKey);

        // Normalize character name if CharacterManager available
        let canonicalName = smartTag.character;
        if (canonicalName && window.characterManager) {
            canonicalName = window.characterManager.getCanonicalName(canonicalName) || canonicalName;
        }

        // Create tag object
        const tag = {
            id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sceneIndex: sceneIndex,
            sceneNumber: scene.number,
            category: smartTag.category,
            selectedText: smartTag.text.substring(0, 150),
            fullContext: smartTag.text,
            character: canonicalName,
            importance: smartTag.importance || 5,
            reason: smartTag.reason || '',
            confidence: smartTag.importance >= 8 ? 'high' : smartTag.importance >= 6 ? 'medium' : 'low',
            created: Date.now(),
            method: tagsData.method || 'narrative-aware'
        };

        state.scriptTags[sceneIndex].push(tag);

        // Also add to breakdown elements
        if (!state.sceneBreakdowns[sceneIndex]) {
            state.sceneBreakdowns[sceneIndex] = {};
        }
        if (!state.sceneBreakdowns[sceneIndex][smartTag.category]) {
            state.sceneBreakdowns[sceneIndex][smartTag.category] = [];
        }

        // Add to breakdown if not duplicate
        if (!state.sceneBreakdowns[sceneIndex][smartTag.category].includes(smartTag.text)) {
            state.sceneBreakdowns[sceneIndex][smartTag.category].push(smartTag.text);
        }

        // Log with importance indicator
        const importanceIcon = smartTag.importance >= 8 ? '🔴' : smartTag.importance >= 6 ? '🟡' : '🟢';
        console.log(`  ${importanceIcon} [${smartTag.importance}/10] ${smartTag.category}: "${smartTag.text.substring(0, 40)}..." ${canonicalName ? `(${canonicalName})` : ''}`);
    });

    console.log(`✓ Applied ${tagsData.tags.length} smart tags to Scene ${scene.number}`);
}

/**
 * Batch process all scenes with narrative-aware tagging
 */
export async function autoTagAllScenesWithContext(progressCallback) {
    const scenes = state.scenes;
    if (!scenes || scenes.length === 0) {
        throw new Error('No scenes to process');
    }

    const context = window.scriptNarrativeContext;
    if (!context) {
        console.warn('⚠️ No narrative context - running basic auto-tag instead');
    }

    let successCount = 0;
    let errorCount = 0;
    let totalTagsCreated = 0;

    for (let i = 0; i < scenes.length; i++) {
        try {
            if (progressCallback) {
                progressCallback(i + 1, scenes.length, `Tagging scene ${i + 1}...`);
            }

            const tagsData = await performSmartAutoTag(i);
            applySmartTags(i, tagsData);

            totalTagsCreated += tagsData.tags.length;
            successCount++;

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.error(`Error tagging scene ${i}:`, error);
            errorCount++;
        }
    }

    return {
        total: scenes.length,
        successCount,
        errorCount,
        totalTagsCreated
    };
}
