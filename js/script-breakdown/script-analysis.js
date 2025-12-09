/**
 * script-analysis.js
 * Comprehensive script analysis system using multi-pass AI prompts
 *
 * Implements the 5-prompt workflow:
 * 1. Scene structure extraction
 * 2. Character discovery & categorization
 * 3. Continuity event extraction
 * 4. Story day timeline construction
 * 5. Scene tagging & highlighting
 */

import { callAI } from './ai-integration.js';

// Note: We don't import state to avoid circular dependencies
// All data is passed as parameters to functions

// Analysis configuration
const CONFIG = {
    MAX_SCRIPT_LENGTH: 200000, // 200KB max total
    CHUNK_SIZE: 60000, // 60KB per chunk for safety
    MAX_TOKENS_SCENE_ANALYSIS: 8000,
    MAX_TOKENS_CHARACTER_ANALYSIS: 8000,
    MAX_TOKENS_CONTINUITY: 4000,
    MAX_TOKENS_TIMELINE: 4000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 2000
};

/**
 * Main entry point for comprehensive script analysis
 * Processes the entire script through all 5 analysis phases
 */
export async function analyzeScript(scriptText, scenes, progressCallback) {
    console.log('=== STARTING COMPREHENSIVE SCRIPT ANALYSIS ===');
    console.log(`Script length: ${scriptText.length} characters, ${scenes.length} scenes`);

    const results = {
        sceneStructure: null,
        characters: null,
        continuityEvents: null,
        timeline: null,
        success: false,
        errors: []
    };

    try {
        // Phase 1: Scene Structure Extraction
        if (progressCallback) progressCallback('Phase 1/4: Extracting scene structure...', 10);
        results.sceneStructure = await extractSceneStructure(scriptText, scenes);
        console.log('Phase 1 complete: Scene structure extracted');

        // Phase 2: Character Discovery & Categorization
        if (progressCallback) progressCallback('Phase 2/4: Discovering and categorizing characters...', 35);
        results.characters = await discoverAndCategorizeCharacters(scriptText, scenes, results.sceneStructure);
        console.log('Phase 2 complete: Characters discovered');

        // Phase 3: Continuity Event Extraction
        if (progressCallback) progressCallback('Phase 3/4: Extracting continuity events...', 60);
        results.continuityEvents = await extractContinuityEvents(scriptText, scenes, results.characters);
        console.log('Phase 3 complete: Continuity events extracted');

        // Phase 4: Story Day Timeline Construction
        if (progressCallback) progressCallback('Phase 4/4: Constructing story timeline...', 85);
        results.timeline = await constructTimeline(scenes, results.sceneStructure);
        console.log('Phase 4 complete: Timeline constructed');

        // Build master context from all phases
        if (progressCallback) progressCallback('Finalizing analysis...', 95);
        results.success = true;

        console.log('=== COMPREHENSIVE SCRIPT ANALYSIS COMPLETE ===');
        return buildMasterContext(results, scenes);

    } catch (error) {
        console.error('Script analysis failed:', error);
        results.errors.push(error.message);

        // Return partial results with fallback
        return buildFallbackContext(scriptText, scenes, results);
    }
}

/**
 * PHASE 1: Scene Structure Extraction
 * Uses PROMPT 1 to extract all scenes with metadata
 */
async function extractSceneStructure(scriptText, scenes) {
    console.log('Extracting scene structure...');

    // For very long scripts, process in chunks
    const chunks = chunkScript(scriptText);
    const allSceneData = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const isLastChunk = i === chunks.length - 1;

        const prompt = buildSceneExtractionPrompt(chunk, scenes, i, chunks.length);

        try {
            const response = await callAIWithRetry(prompt, CONFIG.MAX_TOKENS_SCENE_ANALYSIS);
            const parsed = parseJSONResponse(response);

            if (Array.isArray(parsed)) {
                allSceneData.push(...parsed);
            } else if (parsed.scenes) {
                allSceneData.push(...parsed.scenes);
            }
        } catch (error) {
            console.warn(`Chunk ${i + 1} scene extraction failed:`, error);
        }
    }

    // Merge with existing scene data
    return mergeSceneData(scenes, allSceneData);
}

/**
 * Build the scene extraction prompt (PROMPT 1)
 */
function buildSceneExtractionPrompt(scriptChunk, scenes, chunkIndex, totalChunks) {
    return `You are analyzing a film screenplay to extract structural information.

YOUR TASK:
Parse this script section and identify ALL scenes with their metadata.

${totalChunks > 1 ? `NOTE: This is chunk ${chunkIndex + 1} of ${totalChunks}. Process only the scenes in this portion.` : ''}

SCENE IDENTIFICATION RULES:
1. Scene headers follow these patterns:
   - "INT. LOCATION - TIME"
   - "EXT. LOCATION - TIME"
   - "INT./EXT. LOCATION - TIME"
   - May have scene numbers before or after (e.g., "1 INT. FERRY - DAY 1" or "INT. FERRY - DAY - 1")

2. Look for TIME indicators:
   - DAY, NIGHT, MORNING, AFTERNOON, EVENING, DAWN, DUSK
   - CONTINUOUS, SAME, MOMENTS LATER, LATER
   - May include story day markers like "DAY 1", "D1", "STORY DAY 3"

3. Scene numbers may appear as:
   - Plain numbers: "1", "47", "152"
   - With letters: "12A", "32B", "61A"
   - Before or after the scene header
   - Sometimes missing entirely

EXTRACT FOR EACH SCENE:
- scene_number: The scene number (string, e.g., "47" or "12A")
- location: The location name (e.g., "FERRY", "FARMHOUSE - KITCHEN")
- setting: INT, EXT, or INT./EXT.
- time_of_day: DAY, NIGHT, MORNING, etc.
- story_day: If mentioned (e.g., "DAY 1", "D4") - extract the number
- characters_present: Array of character names found in this scene
- synopsis: Brief 1-sentence description of scene action

SCRIPT SECTION:
${scriptChunk}

Return a JSON array of all scenes found:
[
  {
    "scene_number": "1",
    "setting": "EXT",
    "location": "FERRY",
    "time_of_day": "DAY",
    "story_day": 1,
    "characters_present": ["GWEN LAWSON", "PETER LAWSON"],
    "synopsis": "Gwen and Peter arrive on the ferry, looking somber"
  }
]

IMPORTANT:
- Process ALL scenes in this script section
- If you cannot determine a field, use null
- Do not skip scenes
- Maintain scene order
- Return ONLY valid JSON (no markdown, no code fences)`;
}

/**
 * PHASE 2: Character Discovery & Categorization
 * Uses PROMPT 2 to identify all characters and determine their importance
 */
async function discoverAndCategorizeCharacters(scriptText, scenes, sceneStructure) {
    console.log('Discovering and categorizing characters...');

    // First, do a quick regex pass to find all potential character names
    const potentialCharacters = extractCharacterNamesFromText(scriptText);
    console.log(`Found ${potentialCharacters.size} potential character names via regex`);

    // Build scene summaries for AI analysis
    const sceneSummaries = scenes.map((scene, idx) => {
        const heading = scene.heading || `Scene ${idx + 1}`;
        const content = (scene.content || scene.text || '').substring(0, 500);
        return `${heading}\n${content}`;
    }).join('\n---\n');

    // Truncate if needed but preserve character information
    const truncatedSummaries = sceneSummaries.length > 80000
        ? sceneSummaries.substring(0, 80000) + '\n[Additional scenes truncated...]'
        : sceneSummaries;

    const prompt = buildCharacterDiscoveryPrompt(truncatedSummaries, potentialCharacters, scenes.length);

    try {
        const response = await callAIWithRetry(prompt, CONFIG.MAX_TOKENS_CHARACTER_ANALYSIS);
        const parsed = parseJSONResponse(response);

        // Ensure all potential characters are included
        return enrichCharacterData(parsed, potentialCharacters, scenes);
    } catch (error) {
        console.warn('AI character analysis failed, using fallback:', error);
        return createFallbackCharacterData(potentialCharacters, scenes);
    }
}

/**
 * Build the character discovery prompt (PROMPT 2)
 */
function buildCharacterDiscoveryPrompt(sceneSummaries, potentialCharacters, totalScenes) {
    const charList = Array.from(potentialCharacters).slice(0, 50).join(', ');

    return `You are analyzing a complete film screenplay to identify ALL characters and determine their importance.

TOTAL SCENES: ${totalScenes}

POTENTIAL CHARACTERS FOUND (from script parsing):
${charList}

SCREENPLAY SUMMARIES:
${sceneSummaries}

YOUR TASK - IDENTIFY AND CATEGORIZE ALL SPEAKING CHARACTERS:

CATEGORY DEFINITIONS:
- LEAD: Appears in 40%+ of scenes, has character arc, drives plot (1-3 characters max)
- SUPPORTING: Appears in 10-40% of scenes, recurring presence, contributes to story (3-8 characters)
- DAY_PLAYER: Appears in 1-5 scenes, functional role, limited dialogue
- BACKGROUND: No dialogue or 1-2 lines only, purely functional

For each character, extract:
1. Their canonical name (longest/most complete version)
2. All name variations used in script
3. Category (LEAD, SUPPORTING, DAY_PLAYER, BACKGROUND)
4. Scene count and appearance list
5. Physical description if mentioned
6. Character arc if applicable
7. Relationships to other characters

Return JSON:
{
  "characters": [
    {
      "name": "GWEN LAWSON",
      "name_variations": ["GWEN", "GWEN LAWSON"],
      "category": "LEAD",
      "scenes_appeared": [1, 2, 3, 4, 5],
      "total_scenes": 145,
      "total_lines": 523,
      "first_appearance": 1,
      "last_appearance": 177,
      "physical_description": "Late thirties, tattoo on wrist",
      "character_arc": "Hopeful partner trying to save Peter",
      "relationships": [
        {"character": "PETER LAWSON", "type": "Partner/romantic"}
      ]
    }
  ],
  "statistics": {
    "total_speaking_characters": 24,
    "lead_roles": 2,
    "supporting_roles": 6,
    "day_players": 16
  }
}

CRITICAL:
- Include EVERY character from the potential characters list
- Be thorough with categorization based on scene count
- For physical traits not explicitly stated, use null
- Return ONLY valid JSON (no markdown, no code fences)`;
}

/**
 * PHASE 3: Continuity Event Extraction
 * Uses PROMPT 3 to identify key continuity events
 */
async function extractContinuityEvents(scriptText, scenes, characterData) {
    console.log('Extracting continuity events...');

    // Extract events from script using pattern matching first
    const patternEvents = extractEventsViaPatterns(scriptText, scenes);

    // Build prompt with character context
    const characterNames = characterData.characters
        ? characterData.characters.map(c => c.name).join(', ')
        : 'Unknown';

    const scriptSummary = scenes.map((scene, idx) => {
        const heading = scene.heading || `Scene ${idx + 1}`;
        const content = (scene.content || scene.text || '').substring(0, 300);
        return `[Scene ${idx + 1}] ${heading}\n${content}`;
    }).join('\n---\n');

    const truncatedSummary = scriptSummary.length > 50000
        ? scriptSummary.substring(0, 50000) + '\n[Additional scenes truncated...]'
        : scriptSummary;

    const prompt = buildContinuityEventsPrompt(truncatedSummary, characterNames);

    try {
        const response = await callAIWithRetry(prompt, CONFIG.MAX_TOKENS_CONTINUITY);
        const parsed = parseJSONResponse(response);

        // Merge AI-discovered events with pattern-extracted events
        return mergeEvents(parsed, patternEvents);
    } catch (error) {
        console.warn('AI continuity extraction failed, using pattern-based fallback:', error);
        return { continuity_events: patternEvents };
    }
}

/**
 * Build the continuity events prompt (PROMPT 3)
 */
function buildContinuityEventsPrompt(scriptSummary, characterNames) {
    return `You are analyzing a screenplay to identify key continuity events that affect character appearance.

MAIN CHARACTERS: ${characterNames}

CONTINUITY EVENT CATEGORIES:
1. INJURY/WOUNDS: Cuts, bruises, abrasions, burns
2. ILLNESS/PHYSICAL STATE: Sickness, lesions, paleness, recovery
3. GROOMING CHANGES: Haircuts, beard growth/shaving, makeup application
4. GETTING WET/DIRTY: Water scenes, mud, blood
5. WARDROBE DAMAGE: Torn clothes, blood stains
6. TIME JUMPS: "WEEKS LATER", "MONTHS LATER"

SEARCH FOR THESE PHRASES:
- "cuts", "bruises", "wounds", "blood", "bleeding"
- "beard", "shaves", "hair grows", "haircut"
- "soaked", "wet", "drenched"
- "dirty", "mud", "grime"
- "pale", "sick", "healthy", "lesions"
- "weeks later", "months later"

SCREENPLAY:
${scriptSummary}

Return JSON:
{
  "continuity_events": [
    {
      "scene_number": "47",
      "character": "PETER LAWSON",
      "event_type": "INJURY",
      "description": "Forehead hits pier, creates abrasion",
      "start_scene": "47",
      "end_scene": "78",
      "visual_effect": "Forehead abrasion - fresh in 47-52, fading through 75, gone by 78"
    }
  ]
}

IMPORTANT:
- Track both start AND resolution of continuity
- Note progressive changes (healing, growing)
- Be specific about visual requirements
- Return ONLY valid JSON`;
}

/**
 * PHASE 4: Story Day Timeline Construction
 * Uses PROMPT 4 to build the story day timeline
 */
async function constructTimeline(scenes, sceneStructure) {
    console.log('Constructing story day timeline...');

    // Build scene list with temporal markers
    const sceneList = scenes.map((scene, idx) => {
        const heading = scene.heading || '';
        const storyDay = sceneStructure?.find(s => s.scene_number == (idx + 1))?.story_day;
        return {
            index: idx + 1,
            heading: heading,
            time_of_day: extractTimeOfDay(heading),
            explicit_story_day: storyDay,
            first_line: (scene.content || scene.text || '').split('\n')[0]?.substring(0, 100)
        };
    });

    const prompt = buildTimelinePrompt(sceneList);

    try {
        const response = await callAIWithRetry(prompt, CONFIG.MAX_TOKENS_TIMELINE);
        return parseJSONResponse(response);
    } catch (error) {
        console.warn('AI timeline construction failed, using heuristic fallback:', error);
        return buildHeuristicTimeline(scenes);
    }
}

/**
 * Build the timeline prompt (PROMPT 4)
 */
function buildTimelinePrompt(sceneList) {
    const sceneInfo = sceneList.map(s =>
        `Scene ${s.index}: ${s.heading} ${s.explicit_story_day ? `[Day ${s.explicit_story_day}]` : ''}`
    ).join('\n');

    return `You are constructing a timeline of story days for a screenplay.

SCENE LIST:
${sceneInfo}

STORY DAY INFERENCE RULES:
1. EXPLICIT MARKERS (highest confidence): "DAY 1", "D3", etc.
2. TEMPORAL TRANSITIONS: "THE NEXT DAY" = increment, "CONTINUOUS" = same time
3. TIME OF DAY LOGIC: DAY → EVENING → NIGHT = same day; NIGHT → MORNING = next day
4. DIALOGUE CLUES: "Yesterday", "Tomorrow", "It's been three weeks"

Group consecutive scenes into story days and return:
{
  "timeline": [
    {
      "story_day": 1,
      "scenes": [1, 2, 3, 4, 5],
      "confidence": "high",
      "reasoning": "Scene 1 marked as 'DAY 1', continuous through scene 5",
      "time_span": "Morning through Evening"
    }
  ],
  "total_story_days": 4,
  "ambiguous_ranges": []
}

IMPORTANT:
- Mark uncertainty with confidence levels: "high", "medium", "low"
- Don't guess wildly - mark uncertainty
- Return ONLY valid JSON`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Split script into manageable chunks
 */
function chunkScript(scriptText) {
    if (scriptText.length <= CONFIG.CHUNK_SIZE) {
        return [scriptText];
    }

    const chunks = [];
    let remaining = scriptText;

    while (remaining.length > 0) {
        if (remaining.length <= CONFIG.CHUNK_SIZE) {
            chunks.push(remaining);
            break;
        }

        // Find a good break point (scene header or paragraph)
        let breakPoint = CONFIG.CHUNK_SIZE;
        const sceneHeaderPattern = /\n\s*\d*\s*(INT|EXT)/gi;

        // Look for scene header near the break point
        const searchStart = Math.max(0, CONFIG.CHUNK_SIZE - 5000);
        const searchText = remaining.substring(searchStart, CONFIG.CHUNK_SIZE + 1000);
        let lastMatch = null;
        let match;

        while ((match = sceneHeaderPattern.exec(searchText)) !== null) {
            lastMatch = match;
        }

        if (lastMatch) {
            breakPoint = searchStart + lastMatch.index;
        }

        chunks.push(remaining.substring(0, breakPoint));
        remaining = remaining.substring(breakPoint);
    }

    console.log(`Script split into ${chunks.length} chunks`);
    return chunks;
}

/**
 * Extract character names using regex patterns
 */
function extractCharacterNamesFromText(scriptText) {
    const characters = new Set();

    // Pattern 1: Standard dialogue format (CHARACTER NAME on its own line followed by dialogue)
    const dialoguePattern = /^([A-Z][A-Z\s\.'-]{1,30})\s*(?:\([^)]*\))?\s*$/gm;

    // Pattern 2: Character name with parenthetical
    const withParenPattern = /^([A-Z][A-Z\s\.'-]{1,30})\s*\(/gm;

    // Exclusion list
    const exclusions = new Set([
        'INT', 'EXT', 'FADE', 'CUT', 'DISSOLVE', 'CONTINUED', 'THE END',
        'TITLE', 'SUPER', 'INSERT', 'BACK TO', 'FLASHBACK', 'END FLASHBACK',
        'LATER', 'CONTINUOUS', 'SAME', 'MORNING', 'AFTERNOON', 'EVENING',
        'NIGHT', 'DAY', 'DAWN', 'DUSK', 'MOMENTS', 'THE NEXT'
    ]);

    let match;

    while ((match = dialoguePattern.exec(scriptText)) !== null) {
        const name = match[1].trim();
        if (isValidCharacterName(name, exclusions)) {
            characters.add(normalizeCharacterName(name));
        }
    }

    while ((match = withParenPattern.exec(scriptText)) !== null) {
        const name = match[1].trim();
        if (isValidCharacterName(name, exclusions)) {
            characters.add(normalizeCharacterName(name));
        }
    }

    return characters;
}

/**
 * Validate character name
 */
function isValidCharacterName(name, exclusions) {
    if (!name || name.length < 2 || name.length > 40) return false;
    if (/^\d/.test(name)) return false;
    if (exclusions.has(name.trim())) return false;
    if (/^(V\.O\.|O\.S\.|CONT'D|CONT)$/i.test(name.trim())) return false;
    return true;
}

/**
 * Normalize character name
 */
function normalizeCharacterName(name) {
    // Remove V.O., O.S., (CONT'D) suffixes
    let normalized = name.replace(/\s*\(?(V\.?O\.?|O\.?S\.?|CONT'?D?)\)?$/gi, '').trim();

    // Title case conversion
    normalized = normalized.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

    return normalized;
}

/**
 * Extract continuity events via pattern matching
 */
function extractEventsViaPatterns(scriptText, scenes) {
    const events = [];
    const lines = scriptText.split('\n');

    const eventPatterns = [
        { pattern: /\b(cuts?|bleeding|blood|wound|bruise|abrasion)\b/i, type: 'INJURY' },
        { pattern: /\b(sick|ill|pale|fever|cough|lesions?|vomit)\b/i, type: 'ILLNESS' },
        { pattern: /\b(beard|shave|haircut|hair\s+grows?)\b/i, type: 'GROOMING' },
        { pattern: /\b(soaked|wet|drenched|rain|sweat)\b/i, type: 'WET' },
        { pattern: /\b(dirty|mud|grime|stain|torn)\b/i, type: 'DIRTY' },
        { pattern: /\b(weeks?\s+later|months?\s+later|years?\s+later|time\s+jump)\b/i, type: 'TIME_JUMP' }
    ];

    let currentScene = 0;

    lines.forEach(line => {
        // Track scene changes
        if (/^\s*\d*\s*(INT|EXT)/i.test(line)) {
            currentScene++;
        }

        // Check for event patterns
        eventPatterns.forEach(({ pattern, type }) => {
            if (pattern.test(line)) {
                events.push({
                    scene_number: String(currentScene),
                    event_type: type,
                    description: line.trim().substring(0, 200),
                    start_scene: String(currentScene)
                });
            }
        });
    });

    return events;
}

/**
 * Extract time of day from scene heading
 */
function extractTimeOfDay(heading) {
    if (!heading) return null;
    const match = heading.match(/\b(DAY|NIGHT|MORNING|AFTERNOON|EVENING|DAWN|DUSK|CONTINUOUS|SAME|LATER|MOMENTS LATER)\b/i);
    return match ? match[1].toUpperCase() : null;
}

/**
 * Call AI with retry logic
 */
async function callAIWithRetry(prompt, maxTokens, attempts = CONFIG.RETRY_ATTEMPTS) {
    for (let i = 0; i < attempts; i++) {
        try {
            const response = await callAI(prompt, maxTokens);
            if (response && response.trim()) {
                return response;
            }
            throw new Error('Empty response from AI');
        } catch (error) {
            console.warn(`AI call attempt ${i + 1} failed:`, error.message);
            if (i < attempts - 1) {
                await sleep(CONFIG.RETRY_DELAY * (i + 1));
            } else {
                throw error;
            }
        }
    }
}

/**
 * Parse JSON from AI response
 */
function parseJSONResponse(response) {
    if (!response) return null;

    // Clean response
    let cleaned = response.trim();

    // Remove markdown code fences
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    // Try to find JSON object or array
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[1]);
        } catch (e) {
            console.warn('JSON parse failed:', e.message);
            // Try to fix common JSON issues
            const fixed = jsonMatch[1]
                .replace(/,\s*}/g, '}')
                .replace(/,\s*]/g, ']')
                .replace(/'/g, '"');
            return JSON.parse(fixed);
        }
    }

    throw new Error('No valid JSON found in response');
}

/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Merge scene data from AI with existing scene data
 */
function mergeSceneData(existingScenes, aiSceneData) {
    return existingScenes.map((scene, idx) => {
        const aiScene = aiSceneData.find(s =>
            s.scene_number == (idx + 1) ||
            s.scene_number == scene.number
        );

        if (aiScene) {
            return {
                ...scene,
                aiData: aiScene,
                characters_present: aiScene.characters_present || [],
                story_day: aiScene.story_day || scene.storyDay,
                synopsis: aiScene.synopsis || scene.synopsis
            };
        }
        return scene;
    });
}

/**
 * Enrich character data with pattern-extracted names
 */
function enrichCharacterData(aiData, patternCharacters, scenes) {
    const result = aiData || { characters: [], statistics: {} };

    if (!result.characters) {
        result.characters = [];
    }

    const aiCharacterNames = new Set(
        result.characters.map(c => normalizeCharacterName(c.name))
    );

    // Add any characters found by pattern matching but missed by AI
    patternCharacters.forEach(name => {
        const normalized = normalizeCharacterName(name);
        if (!aiCharacterNames.has(normalized)) {
            // Find appearances in scenes
            const appearances = findCharacterAppearances(name, scenes);

            result.characters.push({
                name: normalized,
                name_variations: [name, normalized],
                category: appearances.length >= 10 ? 'SUPPORTING' :
                         appearances.length >= 3 ? 'DAY_PLAYER' : 'BACKGROUND',
                scenes_appeared: appearances,
                total_scenes: appearances.length,
                first_appearance: appearances[0] || 1,
                last_appearance: appearances[appearances.length - 1] || 1,
                source: 'pattern_extraction'
            });
        }
    });

    // Update statistics
    result.statistics = {
        total_speaking_characters: result.characters.length,
        lead_roles: result.characters.filter(c => c.category === 'LEAD').length,
        supporting_roles: result.characters.filter(c => c.category === 'SUPPORTING').length,
        day_players: result.characters.filter(c => c.category === 'DAY_PLAYER').length,
        background: result.characters.filter(c => c.category === 'BACKGROUND').length
    };

    return result;
}

/**
 * Find character appearances in scenes
 */
function findCharacterAppearances(characterName, scenes) {
    const appearances = [];
    const namePattern = new RegExp(`\\b${characterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

    scenes.forEach((scene, idx) => {
        const content = scene.content || scene.text || '';
        if (namePattern.test(content)) {
            appearances.push(idx + 1);
        }
    });

    return appearances;
}

/**
 * Create fallback character data when AI fails
 */
function createFallbackCharacterData(patternCharacters, scenes) {
    const characters = [];

    patternCharacters.forEach(name => {
        const normalized = normalizeCharacterName(name);
        const appearances = findCharacterAppearances(name, scenes);

        // Determine category by scene count
        let category = 'BACKGROUND';
        if (appearances.length >= scenes.length * 0.4) category = 'LEAD';
        else if (appearances.length >= scenes.length * 0.1) category = 'SUPPORTING';
        else if (appearances.length >= 3) category = 'DAY_PLAYER';

        characters.push({
            name: normalized,
            name_variations: [name, normalized],
            category: category,
            scenes_appeared: appearances,
            total_scenes: appearances.length,
            first_appearance: appearances[0] || 1,
            last_appearance: appearances[appearances.length - 1] || 1,
            source: 'fallback_extraction'
        });
    });

    // Sort by scene count descending
    characters.sort((a, b) => b.total_scenes - a.total_scenes);

    return {
        characters,
        statistics: {
            total_speaking_characters: characters.length,
            lead_roles: characters.filter(c => c.category === 'LEAD').length,
            supporting_roles: characters.filter(c => c.category === 'SUPPORTING').length,
            day_players: characters.filter(c => c.category === 'DAY_PLAYER').length,
            background: characters.filter(c => c.category === 'BACKGROUND').length
        }
    };
}

/**
 * Merge AI and pattern-extracted events
 */
function mergeEvents(aiEvents, patternEvents) {
    const result = aiEvents || { continuity_events: [] };

    if (!result.continuity_events) {
        result.continuity_events = [];
    }

    // Add pattern events that don't overlap with AI events
    patternEvents.forEach(pe => {
        const exists = result.continuity_events.some(ae =>
            ae.scene_number === pe.scene_number && ae.event_type === pe.event_type
        );
        if (!exists) {
            result.continuity_events.push(pe);
        }
    });

    // Sort by scene number
    result.continuity_events.sort((a, b) =>
        parseInt(a.scene_number) - parseInt(b.scene_number)
    );

    return result;
}

/**
 * Build heuristic timeline when AI fails
 */
function buildHeuristicTimeline(scenes) {
    const timeline = [];
    let currentDay = 1;
    let lastTimeOfDay = null;
    let currentDayScenes = [];

    scenes.forEach((scene, idx) => {
        const heading = scene.heading || '';
        const timeOfDay = extractTimeOfDay(heading);

        // Check for explicit day markers
        const dayMatch = heading.match(/DAY\s*(\d+)|D(\d+)|STORY\s*DAY\s*(\d+)/i);
        if (dayMatch) {
            const explicitDay = parseInt(dayMatch[1] || dayMatch[2] || dayMatch[3]);
            if (explicitDay !== currentDay && currentDayScenes.length > 0) {
                timeline.push({
                    story_day: currentDay,
                    scenes: [...currentDayScenes],
                    confidence: 'high'
                });
                currentDayScenes = [];
            }
            currentDay = explicitDay;
        }

        // Check for time progression suggesting new day
        if (lastTimeOfDay === 'NIGHT' &&
            (timeOfDay === 'MORNING' || timeOfDay === 'DAY')) {
            if (currentDayScenes.length > 0) {
                timeline.push({
                    story_day: currentDay,
                    scenes: [...currentDayScenes],
                    confidence: 'medium'
                });
                currentDayScenes = [];
                currentDay++;
            }
        }

        // Check for time jump indicators
        const content = scene.content || scene.text || '';
        if (/WEEKS?\s+LATER|MONTHS?\s+LATER|YEARS?\s+LATER/i.test(content) ||
            /WEEKS?\s+LATER|MONTHS?\s+LATER|YEARS?\s+LATER/i.test(heading)) {
            if (currentDayScenes.length > 0) {
                timeline.push({
                    story_day: currentDay,
                    scenes: [...currentDayScenes],
                    confidence: 'high'
                });
                currentDayScenes = [];
                currentDay++;
            }
        }

        currentDayScenes.push(idx + 1);
        lastTimeOfDay = timeOfDay;
    });

    // Add remaining scenes
    if (currentDayScenes.length > 0) {
        timeline.push({
            story_day: currentDay,
            scenes: currentDayScenes,
            confidence: 'medium'
        });
    }

    return {
        timeline,
        total_story_days: timeline.length,
        ambiguous_ranges: []
    };
}

/**
 * Build master context from all analysis results
 */
function buildMasterContext(results, scenes) {
    const characters = {};

    // Convert character array to object format
    if (results.characters?.characters) {
        results.characters.characters.forEach(char => {
            const name = char.name;
            characters[name] = {
                scriptDescriptions: char.physical_description ? [{
                    text: char.physical_description,
                    sceneNumber: char.first_appearance,
                    type: 'description'
                }] : [],
                physicalProfile: {
                    age: char.age || null,
                    gender: char.gender || null,
                    build: char.build || null
                },
                characterAnalysis: {
                    role: char.category?.toLowerCase() || 'supporting',
                    arc: char.character_arc || '',
                    personality: ''
                },
                visualProfile: {
                    overallVibe: '',
                    styleChoices: ''
                },
                storyPresence: {
                    firstAppearance: char.first_appearance || 1,
                    lastAppearance: char.last_appearance || scenes.length,
                    totalScenes: char.total_scenes || 0,
                    scenesPresent: char.scenes_appeared || [],
                    hasDialogue: true,
                    speakingScenes: char.scenes_appeared || []
                },
                extractedElements: {
                    mentionedWardrobe: [],
                    mentionedAppearanceChanges: [],
                    physicalActions: [],
                    environmentalExposure: []
                },
                continuityNotes: {
                    keyLooks: '',
                    transformations: char.character_arc || '',
                    signature: ''
                },
                relationships: char.relationships || [],
                category: char.category || 'SUPPORTING',
                firstAppearance: char.first_appearance || 1,
                lastAppearance: char.last_appearance || scenes.length,
                sceneCount: char.total_scenes || 0,
                scenesPresent: char.scenes_appeared || []
            };
        });
    }

    // Build story structure from timeline
    const storyStructure = {
        totalDays: results.timeline?.total_story_days || 1,
        timeline: results.timeline?.timeline || [],
        dayBreakdown: results.timeline?.timeline?.map(t => ({
            day: `Day ${t.story_day}`,
            scenes: t.scenes,
            description: t.reasoning || ''
        })) || [],
        flashbacks: [],
        timeJumps: []
    };

    // Build major events from continuity data
    const majorEvents = results.continuityEvents?.continuity_events?.map(e => ({
        scene: parseInt(e.scene_number),
        type: e.event_type?.toLowerCase() || 'other',
        charactersAffected: e.character ? [e.character] : [],
        visualImpact: e.visual_effect || e.description
    })) || [];

    return {
        title: 'Analyzed Script',
        totalScenes: scenes.length,
        characters,
        storyStructure,
        environments: {},
        interactions: {},
        emotionalBeats: {},
        dialogueReferences: {},
        majorEvents,
        continuityNotes: 'Generated by comprehensive multi-pass analysis',
        createdAt: new Date().toISOString(),
        analysisVersion: '3.0-multipass',
        statistics: results.characters?.statistics || {}
    };
}

/**
 * Build fallback context when analysis fails
 */
function buildFallbackContext(scriptText, scenes, partialResults) {
    console.log('Building fallback master context from partial results...');

    // Use whatever we got from partial results
    if (partialResults.characters || partialResults.sceneStructure) {
        return buildMasterContext(partialResults, scenes);
    }

    // Full fallback using pattern extraction only
    const patternCharacters = extractCharacterNamesFromText(scriptText);
    const characterData = createFallbackCharacterData(patternCharacters, scenes);
    const timeline = buildHeuristicTimeline(scenes);

    return buildMasterContext({
        characters: characterData,
        timeline,
        sceneStructure: scenes,
        continuityEvents: { continuity_events: [] }
    }, scenes);
}

// Export for use in export-handlers.js
export {
    extractCharacterNamesFromText,
    normalizeCharacterName,
    findCharacterAppearances,
    buildHeuristicTimeline,
    extractTimeOfDay
};
