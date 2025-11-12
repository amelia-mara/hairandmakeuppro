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
