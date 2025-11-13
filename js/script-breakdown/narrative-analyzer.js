/**
 * narrative-analyzer.js
 * Narrative Context Engine for comprehensive script analysis
 *
 * Analyzes entire screenplay once on import to understand:
 * - Story structure (acts, beats, climax)
 * - Character importance and arcs
 * - Narrative timeline and continuity elements
 * - Critical visual elements (injuries, changes)
 *
 * This context is then used for:
 * - Smarter AI synopsis generation
 * - Importance-based auto-tagging
 * - Continuity tracking prioritization
 */

import { callAI } from './ai-integration.js';
import { state } from './main.js';

/**
 * Narrative Context Engine
 * Performs deep analysis of entire screenplay to understand story structure
 */
export class NarrativeAnalyzer {
    constructor() {
        this.context = null;
        this.characterImportance = {};
        this.narrativeArcs = [];
        this.keyElements = {};
        this.storyTimeline = [];
    }

    /**
     * Main analysis - called once on script import
     * Analyzes entire screenplay to extract narrative context
     */
    async analyzeFullScript(scenes) {
        console.log('🎬 Starting comprehensive narrative analysis...');
        console.log(`📊 Analyzing ${scenes.length} scenes`);

        // Combine all scenes into full script text
        const fullText = scenes.map(s => {
            const sceneNum = s.number || '';
            const heading = s.heading || '';
            const content = s.content || s.text || '';
            return `SCENE ${sceneNum}\n${heading}\n\n${content}`;
        }).join('\n\n═══════════════════════════════════\n\n');

        // Limit text size for API call (approximately 30,000 characters)
        const truncatedText = fullText.length > 30000
            ? fullText.substring(0, 30000) + '\n\n[... script continues ...]'
            : fullText;

        try {
            // Show progress
            this.updateProgress('Analyzing narrative structure...', 20);

            // Comprehensive AI analysis
            const analysis = await this.performFullAnalysis(truncatedText, scenes);

            this.updateProgress('Processing character importance...', 60);

            // Store context globally
            this.context = {
                ...analysis,
                timestamp: Date.now(),
                scriptTitle: state.currentProject?.name || 'Untitled',
                totalScenes: scenes.length
            };

            // Make available globally
            window.scriptNarrativeContext = this.context;

            // Process key information
            this.processCharacterImportance(analysis.characters);
            this.mapStoryTimeline(analysis.timeline);
            this.catalogCriticalElements(analysis.elements);

            this.updateProgress('Analysis complete!', 100);

            console.log('✅ Narrative analysis complete');
            console.log('📋 Story structure:', analysis.storyStructure);
            console.log('👥 Characters analyzed:', analysis.characters?.length || 0);
            console.log('🎯 Critical elements identified:', Object.keys(analysis.elements || {}).length);

            return this.context;

        } catch (error) {
            console.error('❌ Narrative analysis failed:', error);
            this.updateProgress('Analysis failed: ' + error.message, 0);
            return null;
        }
    }

    /**
     * Perform comprehensive AI analysis of full script
     */
    async performFullAnalysis(fullText, scenes) {
        const prompt = `Analyze this screenplay for professional hair/makeup/continuity breakdown.

SCREENPLAY:
${fullText}

Provide comprehensive JSON analysis with the following structure. Be thorough and specific.

Return ONLY valid JSON (no markdown, no explanations):

{
    "genre": "string - genre of the story",
    "tone": "string - overall tone (dramatic, comedic, thriller, etc)",
    "logline": "one sentence summary of the story",
    "timeline": {
        "storyDays": number,
        "timeSpans": ["Day 1 - Morning", "Day 1 - Night", "Day 2 - Morning"],
        "flashbacks": []
    },
    "characters": [
        {
            "name": "CHARACTER_NAME",
            "importance": 1-10,
            "arc": "brief character transformation description",
            "sceneCount": number,
            "physicalChanges": [
                {
                    "scene": number,
                    "change": "description of physical change",
                    "type": "injury|aging|condition|hair|makeup"
                }
            ],
            "emotionalBeats": ["key emotional moment 1", "key emotional moment 2"],
            "relationships": ["relationship1", "relationship2"]
        }
    ],
    "storyStructure": {
        "acts": [
            {
                "number": 1,
                "scenes": [1, 2, 3],
                "description": "Setup and inciting incident",
                "tension": 1-10
            }
        ],
        "turningPoints": [
            {
                "scene": number,
                "description": "what happens",
                "impact": "high|medium|low"
            }
        ],
        "climax": {
            "scenes": [list of scene numbers],
            "description": "climax description"
        }
    },
    "elements": {
        "injuries": [
            {
                "character": "name",
                "scene": number,
                "type": "cut|bruise|burn|wound",
                "severity": 1-10,
                "healingScenes": [list of scenes showing progression],
                "narrativeImportance": 1-10
            }
        ],
        "makeupChanges": [
            {
                "character": "name",
                "scene": number,
                "description": "makeup change description",
                "importance": 1-10
            }
        ],
        "hairChanges": [
            {
                "character": "name",
                "scene": number,
                "description": "hair change description",
                "importance": 1-10
            }
        ],
        "costumeCritical": [
            {
                "character": "name",
                "scene": number,
                "description": "critical costume element",
                "importance": 1-10
            }
        ],
        "weatherEffects": [
            {
                "scene": number,
                "effect": "rain|snow|mud|wind|etc",
                "affectsCharacters": ["char1", "char2"]
            }
        ],
        "recurringMotifs": [
            {
                "element": "description of recurring visual element",
                "scenes": [list of scenes],
                "significance": "why it matters to story"
            }
        ]
    },
    "continuityFlags": [
        {
            "element": "description",
            "scenes": [list of scene numbers],
            "critical": true|false,
            "reason": "why this matters for continuity"
        }
    ]
}`;

        try {
            const response = await callAI(prompt, 3000); // Increased token limit for comprehensive response

            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('No JSON found in response:', response);
                throw new Error('No valid JSON found in AI response');
            }

            const data = JSON.parse(jsonMatch[0]);

            // Validate essential fields
            if (!data.characters) data.characters = [];
            if (!data.storyStructure) data.storyStructure = { acts: [], turningPoints: [], climax: {} };
            if (!data.elements) data.elements = {};
            if (!data.timeline) data.timeline = { storyDays: 1, timeSpans: [], flashbacks: [] };

            return data;

        } catch (error) {
            console.error('Error in AI analysis:', error);
            // Return minimal valid structure on error
            return {
                genre: 'Unknown',
                tone: 'Unknown',
                logline: 'Analysis incomplete',
                timeline: { storyDays: 1, timeSpans: [], flashbacks: [] },
                characters: [],
                storyStructure: { acts: [], turningPoints: [], climax: {} },
                elements: {},
                continuityFlags: []
            };
        }
    }

    /**
     * Process character importance scores
     * Creates quick-lookup map for character weights
     */
    processCharacterImportance(characters) {
        if (!characters || !Array.isArray(characters)) return;

        characters.forEach(char => {
            this.characterImportance[char.name] = {
                weight: char.importance || 5,
                arc: char.arc || '',
                changes: char.physicalChanges || [],
                sceneCount: char.sceneCount || 0,
                emotionalBeats: char.emotionalBeats || []
            };
        });

        // Sort by importance for UI display
        window.charactersByImportance = Object.entries(this.characterImportance)
            .sort((a, b) => b[1].weight - a[1].weight)
            .map(([name]) => name);

        console.log('📊 Character importance rankings:', window.charactersByImportance);
    }

    /**
     * Map story timeline for continuity tracking
     */
    mapStoryTimeline(timeline) {
        if (!timeline || !timeline.timeSpans) return;

        this.storyTimeline = timeline.timeSpans.map((span, index) => ({
            id: `story-day-${index}`,
            label: span,
            scenes: [],
            charactersPresent: new Set(),
            continuityNotes: []
        }));

        console.log('📅 Story timeline mapped:', this.storyTimeline.length, 'time periods');
    }

    /**
     * Catalog critical elements for quick lookup
     */
    catalogCriticalElements(elements) {
        if (!elements) return;

        this.keyElements = {
            injuries: this.processInjuries(elements.injuries || []),
            makeupChanges: elements.makeupChanges || [],
            hairChanges: elements.hairChanges || [],
            costumeCritical: elements.costumeCritical || [],
            weatherEffects: elements.weatherEffects || [],
            recurring: elements.recurringMotifs || []
        };

        console.log('🎯 Critical elements cataloged:', {
            injuries: this.keyElements.injuries.length,
            makeupChanges: this.keyElements.makeupChanges.length,
            hairChanges: this.keyElements.hairChanges.length,
            costumeCritical: this.keyElements.costumeCritical.length,
            weatherEffects: this.keyElements.weatherEffects.length,
            recurring: this.keyElements.recurring.length
        });
    }

    /**
     * Process injuries with healing progression
     */
    processInjuries(injuries) {
        if (!Array.isArray(injuries)) return [];

        return injuries.map(injury => ({
            ...injury,
            progression: this.generateHealingProgression(injury),
            affectedScenes: this.calculateAffectedScenes(injury)
        }));
    }

    /**
     * Generate realistic healing progression for injuries
     */
    generateHealingProgression(injury) {
        const progressions = {
            'cut': {
                stages: ['Fresh/bleeding', 'Scabbed', 'Healing/pink', 'Faint scar'],
                duration: [0, 2, 5, 10]
            },
            'bruise': {
                stages: ['Fresh/red', 'Purple/blue', 'Green/yellow', 'Fading'],
                duration: [0, 1, 4, 10]
            },
            'burn': {
                stages: ['Fresh/blistered', 'Scabbing', 'Healing', 'Scarred'],
                duration: [0, 3, 10, 20]
            },
            'wound': {
                stages: ['Fresh/open', 'Bandaged', 'Healing', 'Scarred'],
                duration: [0, 2, 7, 14]
            }
        };

        return progressions[injury.type] || progressions['cut'];
    }

    /**
     * Calculate which scenes are affected by an injury/element
     */
    calculateAffectedScenes(injury) {
        if (!injury.scene) return [];

        const startScene = injury.scene;
        const healingDuration = injury.healingScenes?.length || 10;
        const totalScenes = state.scenes?.length || 100;

        return Array.from(
            { length: healingDuration },
            (_, i) => startScene + i
        ).filter(s => s > 0 && s <= totalScenes);
    }

    /**
     * Update progress indicator
     */
    updateProgress(message, percentage) {
        // Try to update any visible progress indicators
        const progressMsg = document.getElementById('progress-message');
        const progressFill = document.getElementById('progress-fill');
        const progressLabel = document.getElementById('progress-label');

        if (progressMsg) progressMsg.textContent = message;
        if (progressFill) progressFill.style.width = `${percentage}%`;
        if (progressLabel) progressLabel.textContent = `${Math.round(percentage)}%`;

        console.log(`📊 Progress: ${percentage}% - ${message}`);
    }

    /**
     * Get character importance score
     */
    getCharacterImportance(characterName) {
        return this.characterImportance[characterName]?.weight || 5;
    }

    /**
     * Check if element is narratively critical
     */
    isElementCritical(elementType, sceneIndex) {
        if (!this.context || !this.context.continuityFlags) return false;

        return this.context.continuityFlags.some(flag =>
            flag.critical &&
            flag.scenes.includes(sceneIndex + 1)
        );
    }

    /**
     * Get narrative position of scene (act, phase)
     */
    getNarrativePosition(sceneIndex) {
        const totalScenes = state.scenes?.length || 1;
        const percent = ((sceneIndex + 1) / totalScenes) * 100;

        if (percent <= 25) return { act: 1, phase: 'Setup', tension: 3 };
        if (percent <= 50) return { act: 2, phase: 'Rising Action', tension: 5 };
        if (percent <= 75) return { act: 2, phase: 'Complications', tension: 7 };
        if (percent <= 90) return { act: 3, phase: 'Climax', tension: 9 };
        return { act: 3, phase: 'Resolution', tension: 4 };
    }
}

/**
 * Global instance
 */
export const narrativeAnalyzer = new NarrativeAnalyzer();

// ============================================================================
// PERSISTENT CONTEXT SYSTEM
// ============================================================================

/**
 * Perform comprehensive analysis with persistent context
 * This creates a master context that ALL future AI operations will reference
 */
export async function performComprehensiveAnalysis(scriptText, scriptTitle = 'Untitled') {
    console.log('🎬 Starting comprehensive analysis with persistent context...');

    const sceneCount = state.scenes?.length || 0;

    const prompt = `Perform a COMPLETE breakdown analysis of this screenplay for hair/makeup/continuity department.
This analysis will be used as reference for ALL future operations, so be extremely thorough.

SCREENPLAY TITLE: ${scriptTitle}
TOTAL SCENES: ${sceneCount}

SCREENPLAY TEXT:
${scriptText.substring(0, 100000)}

Return comprehensive JSON with this EXACT structure:
{
    "scriptTitle": "${scriptTitle}",
    "totalScenes": ${sceneCount},
    "genre": "genre/tone description",
    "storyTimeline": {
        "totalDays": 0,
        "dayBreakdown": [
            {
                "day": "Day 1",
                "scenes": [1, 2, 3],
                "timeProgression": ["morning", "afternoon", "evening"],
                "events": ["key story events"]
            }
        ],
        "specialTimelines": {
            "flashbacks": [],
            "flashforwards": [],
            "dreams": []
        }
    },
    "characters": {
        "CHARACTER_NAME": {
            "fullName": "Full Name",
            "importance": 1-10,
            "role": "protagonist/antagonist/supporting",
            "arc": "brief character arc description",
            "firstAppearance": 1,
            "lastAppearance": 10,
            "sceneList": [1, 2, 5, 10],
            "totalScenes": 4,
            "visualJourney": [
                {
                    "scene": 1,
                    "storyDay": "Day 1",
                    "timeOfDay": "morning",
                    "entering": {
                        "hair": "description",
                        "makeup": "description",
                        "wardrobe": "description",
                        "overall": "general appearance"
                    },
                    "changes": [],
                    "exiting": {
                        "hair": "description",
                        "makeup": "description",
                        "wardrobe": "description"
                    },
                    "continuityNotes": "important notes"
                }
            ],
            "continuityEvents": [],
            "baseAppearance": {
                "hair": "base hair description",
                "makeup": "base makeup style",
                "skinTone": "description",
                "specialFeatures": []
            },
            "keyLooks": []
        }
    },
    "allContinuityEvents": [],
    "sceneSynopses": {
        "1": "scene synopsis with continuity focus",
        "2": "scene synopsis with continuity focus"
    },
    "continuityRules": [],
    "weatherProgression": {},
    "locationNotes": {}
}

CRITICAL: Be thorough. This is the ONLY time you'll see the full script. Return valid JSON only.`;

    try {
        const response = await callAI(prompt, 10000);

        // Clean response
        let cleanedResponse = response.trim();
        if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        const masterContext = JSON.parse(cleanedResponse);

        // Validate structure
        if (!masterContext.characters || !masterContext.storyTimeline) {
            throw new Error('Invalid master context structure');
        }

        // Store in multiple places for redundancy
        masterContext.createdAt = new Date().toISOString();
        masterContext.scriptTitle = scriptTitle;

        window.scriptMasterContext = masterContext;
        localStorage.setItem('scriptMasterContext', JSON.stringify(masterContext));
        sessionStorage.setItem('currentScriptContext', JSON.stringify(masterContext));

        console.log('✅ Master context created successfully:', masterContext);

        return masterContext;
    } catch (error) {
        console.error('❌ Failed to create master context:', error);
        throw new Error(`Comprehensive analysis failed: ${error.message}`);
    }
}

/**
 * Create abbreviated context for token efficiency
 */
export function createAbbreviatedContext(masterContext) {
    return {
        scriptTitle: masterContext.scriptTitle,
        totalScenes: masterContext.totalScenes,
        characterList: Object.keys(masterContext.characters || {}),
        storyDays: masterContext.storyTimeline?.totalDays,
        genre: masterContext.genre,
        majorEvents: (masterContext.allContinuityEvents || []).slice(0, 10)
    };
}

/**
 * Context-aware AI wrapper
 */
export async function callAIWithContext(task, additionalData = {}, useFullContext = false) {
    const masterContext = window.scriptMasterContext ||
                         JSON.parse(localStorage.getItem('scriptMasterContext') || 'null');

    if (!masterContext) {
        throw new Error('No master context found. Please analyze script first.');
    }

    const contextToUse = useFullContext ? masterContext : createAbbreviatedContext(masterContext);

    const contextualPrompt = `MASTER CONTEXT (reference for all decisions):
${JSON.stringify(contextToUse, null, 2)}

CURRENT TASK:
${task}

ADDITIONAL DATA:
${JSON.stringify(additionalData, null, 2)}

Base response on master context. Maintain continuity. Return in requested format.`;

    return await callAI(contextualPrompt);
}

/**
 * Generate synopsis with context
 */
export async function generateContextualSynopsis(sceneIndex) {
    const scene = state.scenes[sceneIndex];
    if (!scene) return '';

    const masterContext = window.scriptMasterContext;
    if (masterContext?.sceneSynopses?.[sceneIndex + 1]) {
        return masterContext.sceneSynopses[sceneIndex + 1];
    }

    const task = `Generate concise synopsis for Scene ${sceneIndex + 1} with continuity focus.

Scene: ${scene.heading}
Content: ${scene.text.substring(0, 1000)}

Include: who appears, continuity notes, story context.
Return plain text (2-3 sentences).`;

    const additionalData = {
        sceneNumber: sceneIndex + 1,
        sceneHeading: scene.heading,
        previousScene: sceneIndex > 0 ? {
            heading: state.scenes[sceneIndex - 1]?.heading,
            synopsis: state.scenes[sceneIndex - 1]?.synopsis
        } : null
    };

    return await callAIWithContext(task, additionalData, false);
}

/**
 * Tag scene with context
 */
export async function tagSceneWithContext(sceneIndex) {
    const scene = state.scenes[sceneIndex];
    if (!scene) return null;

    const task = `Analyze Scene ${sceneIndex + 1} and identify hair/makeup/continuity elements.

Scene: ${scene.heading}
Content: ${scene.text.substring(0, 1500)}

Return JSON:
{
    "cast": ["Character Name"],
    "hair": [],
    "makeup": [],
    "sfx": [],
    "injuries": [],
    "health": [],
    "wardrobe": [],
    "weather": [],
    "continuityNotes": []
}

Match character names exactly. Return valid JSON only.`;

    const additionalData = {
        sceneNumber: sceneIndex + 1,
        sceneHeading: scene.heading,
        previousTags: sceneIndex > 0 ? state.scriptTags?.[sceneIndex - 1] : null
    };

    try {
        const response = await callAIWithContext(task, additionalData, false);
        return JSON.parse(response);
    } catch (error) {
        console.error('Error tagging scene:', error);
        return null;
    }
}

/**
 * Generate timeline with context
 */
export async function generateContextualTimeline(characterName) {
    const masterContext = window.scriptMasterContext;

    if (masterContext?.characters?.[characterName]?.visualJourney) {
        return {
            character: characterName,
            timeline: masterContext.characters[characterName].visualJourney,
            continuityEvents: masterContext.characters[characterName].continuityEvents || [],
            totalScenes: masterContext.characters[characterName].totalScenes || 0
        };
    }

    const task = `Create detailed visual timeline for ${characterName}.

Use master context to generate scene-by-scene appearance tracking, continuity events, progression.

Return JSON with timeline array and continuity events.`;

    const additionalData = {
        characterName: characterName,
        characterScenes: masterContext?.characters?.[characterName]?.sceneList || []
    };

    try {
        const response = await callAIWithContext(task, additionalData, true);
        return JSON.parse(response);
    } catch (error) {
        console.error('Error generating timeline:', error);
        return null;
    }
}

/**
 * Generate lookbook with context
 */
export async function generateContextualLookbook(characterName) {
    const masterContext = window.scriptMasterContext;
    const characterData = masterContext?.characters?.[characterName];

    if (characterData) {
        return {
            character: characterName,
            baseAppearance: characterData.baseAppearance || {},
            keyLooks: characterData.keyLooks || [],
            continuityEvents: characterData.continuityEvents || [],
            arc: characterData.arc || '',
            totalScenes: characterData.totalScenes || 0
        };
    }

    const task = `Create professional lookbook for ${characterName} for hair/makeup department.

Compile base appearance, key looks, continuity requirements, special needs.

Return JSON with structured lookbook data.`;

    try {
        const response = await callAIWithContext(task, {characterName}, true);
        return JSON.parse(response);
    } catch (error) {
        console.error('Error generating lookbook:', error);
        return null;
    }
}

/**
 * Context verification
 */
export function verifyContext() {
    if (!window.scriptMasterContext) {
        const stored = localStorage.getItem('scriptMasterContext');
        if (stored) {
            try {
                window.scriptMasterContext = JSON.parse(stored);
                console.log('✅ Master context restored from localStorage');
                return true;
            } catch (error) {
                console.error('❌ Failed to parse stored context:', error);
                return false;
            }
        }

        const sessionStored = sessionStorage.getItem('currentScriptContext');
        if (sessionStored) {
            try {
                window.scriptMasterContext = JSON.parse(sessionStored);
                console.log('✅ Master context restored from sessionStorage');
                return true;
            } catch (error) {
                console.error('❌ Failed to parse session context:', error);
                return false;
            }
        }

        console.warn('⚠️ No master context found');
        return false;
    }

    return true;
}

/**
 * Get master context
 */
export function getMasterContext() {
    if (verifyContext()) {
        return window.scriptMasterContext;
    }
    return null;
}

/**
 * Check if context ready
 */
export function isContextReady() {
    return verifyContext() && window.contextReady === true;
}

/**
 * Clear master context
 */
export function clearMasterContext() {
    window.scriptMasterContext = null;
    window.contextReady = false;
    localStorage.removeItem('scriptMasterContext');
    sessionStorage.removeItem('currentScriptContext');
    console.log('🗑️ Master context cleared');
}

/**
 * Populate state from master context
 */
export function populateFromMasterContext(context) {
    console.log('📊 Populating from master context...');

    // Pre-populate synopses
    if (context.sceneSynopses) {
        Object.entries(context.sceneSynopses).forEach(([sceneNum, synopsis]) => {
            const sceneIndex = parseInt(sceneNum) - 1;
            if (state.scenes[sceneIndex]) {
                state.scenes[sceneIndex].synopsis = synopsis;
            }
        });
    }

    // Pre-populate characters
    if (context.characters) {
        window.confirmedCharacters = Object.keys(context.characters);
        window.characterImportance = {};

        Object.entries(context.characters).forEach(([name, data]) => {
            window.characterImportance[name] = {
                importance: data.importance,
                role: data.role,
                totalScenes: data.totalScenes,
                arc: data.arc
            };

            if (data.baseAppearance) {
                if (!state.castProfiles[name]) {
                    state.castProfiles[name] = {};
                }
                state.castProfiles[name].baseAppearance = data.baseAppearance;
            }
        });
    }

    // Pre-populate timeline
    if (context.storyTimeline?.dayBreakdown) {
        context.storyTimeline.dayBreakdown.forEach(dayData => {
            dayData.scenes.forEach((sceneNum, idx) => {
                const sceneIndex = sceneNum - 1;
                if (!state.sceneTimeline[sceneIndex]) {
                    state.sceneTimeline[sceneIndex] = {};
                }
                state.sceneTimeline[sceneIndex].day = dayData.day;
                state.sceneTimeline[sceneIndex].time = dayData.timeProgression?.[idx] || '';
            });
        });
    }

    console.log('✅ Application state populated from master context');
}

/**
 * Show context status
 */
export function showContextStatus() {
    const context = getMasterContext();
    if (!context) {
        return 'No context available';
    }
    return `Context loaded: ${context.scriptTitle} (${context.totalScenes} scenes, ${Object.keys(context.characters || {}).length} characters)`;
}

// Expose globals
window.performComprehensiveAnalysis = performComprehensiveAnalysis;
window.callAIWithContext = callAIWithContext;
window.verifyContext = verifyContext;
window.getMasterContext = getMasterContext;
window.clearMasterContext = clearMasterContext;
window.isContextReady = isContextReady;
window.showContextStatus = showContextStatus;
window.populateFromMasterContext = populateFromMasterContext;
window.generateContextualSynopsis = generateContextualSynopsis;
window.tagSceneWithContext = tagSceneWithContext;
window.generateContextualTimeline = generateContextualTimeline;
window.generateContextualLookbook = generateContextualLookbook;

