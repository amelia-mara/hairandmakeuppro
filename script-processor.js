// Enhanced Script Processor with Better Scene Detection and AI Support
class ScriptProcessor {
    constructor() {
        this.scriptTypes = {
            SCENE_HEADING: 'scene_heading',
            CHARACTER: 'character',
            DIALOGUE: 'dialogue',
            PARENTHETICAL: 'parenthetical',
            ACTION: 'action',
            TRANSITION: 'transition'
        };
        
        // More comprehensive scene heading patterns
        this.scenePatterns = [
            // Standard format: INT. LOCATION - TIME
            /^(?:\d+[\.\s]+)?(?:INT\.?|EXT\.?|INT\.?\/EXT\.?|I\/E\.?)\s+.+(?:\s*[-–]\s*.+)?$/i,
            // With scene numbers: 1. INT. LOCATION
            /^\d+[\.\s]+(?:INT\.?|EXT\.?)\s+.+/i,
            // INTERIOR/EXTERIOR spelled out
            /^(?:INTERIOR|EXTERIOR)\s+.+/i,
            // More flexible - just INT/EXT at start
            /^(?:INT|EXT)[\.\s]+\w+/i,
            // With parenthetical additions
            /^(?:INT\.?|EXT\.?).*?\([^)]+\)/i,
            // Continuous scenes
            /^(?:INT\.?|EXT\.?).*?(?:CONTINUOUS|CONT'D|SAME|LATER|MOMENTS LATER)/i
        ];
    }

    // Enhanced PDF text extraction
    async extractPDFText(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            console.log(`📄 Processing PDF: ${pdf.numPages} pages`);
            
            let fullText = '';
            
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                
                // Group text items by Y position
                const lines = {};
                textContent.items.forEach(item => {
                    const y = Math.round(item.transform[5]);
                    if (!lines[y]) lines[y] = [];
                    lines[y].push({
                        x: item.transform[4],
                        text: item.str,
                        width: item.width,
                        height: item.height
                    });
                });
                
                // Sort lines from top to bottom
                const sortedYPositions = Object.keys(lines)
                    .map(y => parseInt(y))
                    .sort((a, b) => b - a);
                
                // Process each line
                sortedYPositions.forEach(y => {
                    const lineItems = lines[y].sort((a, b) => a.x - b.x);
                    
                    let lineText = '';
                    let lastX = 0;
                    
                    lineItems.forEach((item, i) => {
                        if (i > 0) {
                            const gap = item.x - lastX;
                            const avgCharWidth = item.width / (item.text.length || 1);
                            if (gap > avgCharWidth * 0.5) {
                                lineText += ' ';
                            }
                        }
                        
                        lineText += item.str;
                        lastX = item.x + item.width;
                    });
                    
                    fullText += lineText.trim() + '\n';
                });
                
                if (pageNum < pdf.numPages) {
                    fullText += '\n';
                }
            }
            
            return this.normalizeScriptText(fullText);
            
        } catch (error) {
            console.error('PDF extraction error:', error);
            throw error;
        }
    }

    // Improved text normalization
    normalizeScriptText(text) {
        console.log('🔧 Normalizing script text...');
        
        let normalized = text;
        
        // Fix split INT/EXT
        normalized = normalized.replace(/I\s+NT\s*\./gi, 'INT.');
        normalized = normalized.replace(/E\s+XT\s*\./gi, 'EXT.');
        normalized = normalized.replace(/I\s+N\s+T\s*\./gi, 'INT.');
        normalized = normalized.replace(/E\s+X\s+T\s*\./gi, 'EXT.');
        
        // Fix CONTINUOUS split
        normalized = normalized.replace(/C\s+O\s+N\s+T\s+I\s+N\s+U\s+O\s+U\s+S/gi, 'CONTINUOUS');
        normalized = normalized.replace(/CONTIN\s+UOUS/gi, 'CONTINUOUS');
        
        // Fix character names that might be split
        const lines = normalized.split('\n');
        normalized = lines.map(line => {
            // If line has mostly single characters with spaces, try to merge them
            if (/^(?:\s*\w\s+){3,}/.test(line)) {
                // This line might be split characters
                const cleaned = line.replace(/(\w)\s+(?=\w\s)/g, '$1');
                return cleaned;
            }
            return line;
        }).join('\n');
        
        // Clean up excessive line breaks
        normalized = normalized.replace(/\n{4,}/g, '\n\n\n');
        
        console.log('✅ Normalization complete');
        return normalized;
    }

    // Enhanced screenplay parser with better scene detection
    parseScreenplay(scriptText) {
        console.log('🎬 Parsing screenplay...');
        
        const lines = scriptText.split('\n');
        const scenes = [];
        let currentScene = null;
        let inDialogue = false;
        let lastWasEmpty = false;
        
        // First pass: identify all scene headings
        const sceneIndices = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            if (!trimmed) {
                lastWasEmpty = true;
                continue;
            }
            
            // Check if this is a scene heading
            let isScene = false;
            
            // Method 1: Pattern matching
            for (let pattern of this.scenePatterns) {
                if (pattern.test(trimmed)) {
                    isScene = true;
                    break;
                }
            }
            
            // Method 2: Heuristic checks
            if (!isScene) {
                const upperTrimmed = trimmed.toUpperCase();
                const hasINT = upperTrimmed.includes('INT.') || upperTrimmed.startsWith('INT ');
                const hasEXT = upperTrimmed.includes('EXT.') || upperTrimmed.startsWith('EXT ');
                const hasTimeOfDay = /\b(DAY|NIGHT|MORNING|AFTERNOON|EVENING|DUSK|DAWN|CONTINUOUS|LATER|SAME)\b/i.test(trimmed);
                const isMostlyUpper = (trimmed.match(/[A-Z]/g) || []).length / trimmed.replace(/\s/g, '').length > 0.6;
                const hasLocationKeywords = /\b(KITCHEN|BEDROOM|OFFICE|STREET|HOUSE|ROOM|HALLWAY|BATHROOM|CAR|RESTAURANT|BAR|HOSPITAL|SCHOOL)\b/i.test(trimmed);
                
                if ((hasINT || hasEXT) && (hasTimeOfDay || hasLocationKeywords || isMostlyUpper)) {
                    isScene = true;
                }
            }
            
            // Method 3: Scene numbering
            if (!isScene && /^\d+[\.\s]/.test(trimmed)) {
                const afterNumber = trimmed.replace(/^\d+[\.\s]+/, '');
                if (/^(INT|EXT|INTERIOR|EXTERIOR)/i.test(afterNumber)) {
                    isScene = true;
                }
            }
            
            if (isScene) {
                sceneIndices.push({
                    index: i,
                    heading: trimmed
                });
                console.log(`  📍 Found scene at line ${i}: ${trimmed.substring(0, 50)}...`);
            }
        }
        
        // If no scenes found, treat the whole script as one scene
        if (sceneIndices.length === 0) {
            console.log('⚠️ No scene headings detected, treating as single scene');
            sceneIndices.push({
                index: 0,
                heading: 'FULL SCRIPT'
            });
        }
        
        // Second pass: parse content for each scene
        sceneIndices.forEach((sceneInfo, idx) => {
            const startLine = sceneInfo.index;
            const endLine = idx < sceneIndices.length - 1 ? sceneIndices[idx + 1].index : lines.length;
            
            const scene = {
                type: this.scriptTypes.SCENE_HEADING,
                text: this.cleanSceneHeading(sceneInfo.heading),
                lineNumber: startLine,
                elements: [],
                rawText: lines.slice(startLine, endLine).join('\n')
            };
            
            // Parse elements within this scene
            let inDialogue = false;
            
            for (let i = startLine + 1; i < endLine; i++) {
                const line = lines[i];
                const trimmed = line.trim();
                const indent = line.search(/\S/);
                
                if (!trimmed) {
                    inDialogue = false;
                    continue;
                }
                
                // Character name detection
                if (this.isCharacterName(trimmed, indent, inDialogue)) {
                    scene.elements.push({
                        type: this.scriptTypes.CHARACTER,
                        text: trimmed,
                        lineNumber: i
                    });
                    inDialogue = true;
                }
                // Parenthetical
                else if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
                    scene.elements.push({
                        type: this.scriptTypes.PARENTHETICAL,
                        text: trimmed,
                        lineNumber: i
                    });
                }
                // Dialogue
                else if (inDialogue && indent > 10) {
                    scene.elements.push({
                        type: this.scriptTypes.DIALOGUE,
                        text: trimmed,
                        lineNumber: i
                    });
                }
                // Transition
                else if (this.isTransition(trimmed)) {
                    scene.elements.push({
                        type: this.scriptTypes.TRANSITION,
                        text: trimmed,
                        lineNumber: i
                    });
                    inDialogue = false;
                }
                // Action
                else {
                    scene.elements.push({
                        type: this.scriptTypes.ACTION,
                        text: trimmed,
                        lineNumber: i
                    });
                    inDialogue = false;
                }
            }
            
            scenes.push(scene);
        });
        
        console.log(`✅ Parsed ${scenes.length} scenes`);
        
        // Extract metadata
        const characters = this.extractCharacters(scenes);
        
        return {
            scenes: scenes,
            metadata: {
                totalScenes: scenes.length,
                totalLines: lines.length,
                characters: characters
            }
        };
    }

    // Clean up scene headings
    cleanSceneHeading(heading) {
        return heading
            .replace(/^\d+[\.\s]+/, '') // Remove scene numbers
            .replace(/^SCENE\s+\d+\s*/i, '') // Remove "SCENE X"
            .trim();
    }

    // Character name detection - improved to catch more formats
    isCharacterName(text, indent, wasInDialogue) {
        if (text.length > 50) return false; // Increased from 35 to catch longer names
        if (text.length < 2) return false; // Must be at least 2 characters

        const cleanText = text.replace(/\s*\([^)]+\)$/, '').replace(/\s*\(.*?\)\s*/g, '').trim();

        // Check if it's mostly uppercase
        const upperRatio = (cleanText.match(/[A-Z]/g) || []).length / cleanText.replace(/\s/g, '').length;

        // More inclusive detection:
        // 1. If it's mostly uppercase (>70%) and not too long
        if (upperRatio > 0.7 && cleanText.length > 0) {
            // Check it's not a scene heading or transition
            if (cleanText.startsWith('INT') || cleanText.startsWith('EXT') ||
                cleanText.includes('CUT TO') || cleanText.includes('FADE')) {
                return false;
            }

            // If indented at all (screenplay format) or was in dialogue context
            if (indent > 5 || wasInDialogue) {
                return true;
            }

            // Also accept if it looks like a name pattern (all caps, reasonable length)
            if (cleanText.match(/^[A-Z][A-Z\s\.\-\']+$/) && cleanText.length <= 35) {
                return true;
            }
        }

        return false;
    }

    // Transition detection
    isTransition(text) {
        const transitions = [
            'CUT TO:', 'FADE IN:', 'FADE OUT:', 'FADE TO:',
            'DISSOLVE TO:', 'MATCH CUT:', 'SMASH CUT:',
            'TIME CUT:', 'INTERCUT:', 'IRIS OUT:'
        ];
        
        return transitions.some(t => text.toUpperCase().includes(t));
    }

    // Extract characters - now uses CharacterManager for normalization
    extractCharacters(scenes) {
        // Use CharacterManager if available (for deduplication and normalization)
        const useCharacterManager = typeof window !== 'undefined' && window.characterManager;

        if (useCharacterManager) {
            console.log('📝 Extracting characters using CharacterManager for normalization...');

            scenes.forEach(scene => {
                scene.elements.forEach(element => {
                    if (element.type === this.scriptTypes.CHARACTER) {
                        const name = element.text.replace(/\s*\([^)]+\)$/, '').trim();
                        if (name && name !== name.toLowerCase()) {
                            // Add to CharacterManager (handles deduplication and normalization)
                            window.characterManager.addCharacter(name);
                        }
                    }
                });
            });

            // Return deduplicated, normalized list
            return window.characterManager.getAllCharacters();
        } else {
            // Fallback to original behavior if CharacterManager not available
            console.log('📝 Extracting characters (CharacterManager not available)...');
            const characters = new Set();

            scenes.forEach(scene => {
                scene.elements.forEach(element => {
                    if (element.type === this.scriptTypes.CHARACTER) {
                        const name = element.text.replace(/\s*\([^)]+\)$/, '').trim();
                        if (name && name !== name.toLowerCase()) {
                            characters.add(name);
                        }
                    }
                });
            });

            return Array.from(characters).sort();
        }
    }

    // Format to HTML
    formatScriptHTML(parsedScript) {
        let html = '';
        
        parsedScript.scenes.forEach((scene, index) => {
            html += `<div class="script-scene" id="scene-${index + 1}" data-scene-index="${index}">`;
            html += `<div class="script-scene-heading">${index + 1}. ${scene.text}</div>`;
            
            scene.elements.forEach(element => {
                switch (element.type) {
                    case this.scriptTypes.CHARACTER:
                        html += `<div class="script-character">${element.text}</div>`;
                        break;
                    case this.scriptTypes.DIALOGUE:
                        html += `<div class="script-dialogue">${element.text}</div>`;
                        break;
                    case this.scriptTypes.PARENTHETICAL:
                        html += `<div class="script-parenthetical">${element.text}</div>`;
                        break;
                    case this.scriptTypes.ACTION:
                        html += `<div class="script-action">${element.text}</div>`;
                        break;
                    case this.scriptTypes.TRANSITION:
                        html += `<div class="script-transition">${element.text}</div>`;
                        break;
                }
            });
            
            html += `</div>`;
        });
        
        return html;
    }

    // AI Analysis for tagging
    async analyzeSceneForTags(sceneText, apiKey, provider = 'openai') {
        const prompt = `Analyze this film scene and identify production elements. Return ONLY a valid JSON array.

Scene content:
${sceneText.substring(0, 2000)}

Identify elements in these categories:
- makeup: Special makeup effects, wounds, aging, etc.
- hair: Specific hairstyles, wigs, hair changes
- sfx: Special effects, blood, prosthetics, stunts
- cast: Character appearances (just names)
- wardrobe: Specific costumes, clothing changes
- props: Important props mentioned

Example response format:
[
  {"category": "makeup", "description": "bruised cheek on character"},
  {"category": "hair", "description": "disheveled hair after fight"},
  {"category": "props", "description": "vintage camera"},
  {"category": "wardrobe", "description": "police uniform"}
]

Return ONLY the JSON array, no other text.`;

        try {
            let response;
            
            if (provider === 'openai') {
                response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [{role: 'user', content: prompt}],
                        temperature: 0.3,
                        max_tokens: 500
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`OpenAI API error: ${response.status}`);
                }
                
                const data = await response.json();
                const content = data.choices[0].message.content;
                
                // Extract JSON from response
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                } else {
                    return JSON.parse(content);
                }
            } else {
                // Anthropic Claude
                response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: 'claude-3-5-sonnet-20241022',
                        max_tokens: 500,
                        messages: [{role: 'user', content: prompt}]
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Anthropic API error: ${response.status}`);
                }
                
                const data = await response.json();
                const content = data.content[0].text;
                
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                } else {
                    return JSON.parse(content);
                }
            }
        } catch (error) {
            console.error('AI Analysis error:', error);
            throw error;
        }
    }

    // Save/Load functions
    saveScriptData(projectId, scriptData) {
        try {
            const dataStr = JSON.stringify(scriptData);
            
            if (dataStr.length > 1000000) {
                const chunks = [];
                const chunkSize = 1000000;
                
                for (let i = 0; i < dataStr.length; i += chunkSize) {
                    chunks.push(dataStr.slice(i, i + chunkSize));
                }
                
                localStorage.setItem(`${projectId}_script_chunks`, chunks.length);
                chunks.forEach((chunk, i) => {
                    localStorage.setItem(`${projectId}_script_${i}`, chunk);
                });
            } else {
                localStorage.setItem(`${projectId}_script`, dataStr);
            }
            
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            return false;
        }
    }

    loadScriptData(projectId) {
        try {
            const chunkCount = localStorage.getItem(`${projectId}_script_chunks`);
            
            if (chunkCount) {
                let dataStr = '';
                for (let i = 0; i < parseInt(chunkCount); i++) {
                    dataStr += localStorage.getItem(`${projectId}_script_${i}`);
                }
                return JSON.parse(dataStr);
            } else {
                const data = localStorage.getItem(`${projectId}_script`);
                return data ? JSON.parse(data) : null;
            }
        } catch (e) {
            console.error('Load error:', e);
            return null;
        }
    }
}

// Export for use
window.ScriptProcessor = ScriptProcessor;
