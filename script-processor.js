// Script Processor Module - Handles PDF conversion and screenplay parsing
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
    }

    // Enhanced PDF text extraction with better formatting preservation
    async extractPDFText(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            console.log(`📄 Processing PDF: ${pdf.numPages} pages`);
            
            let fullText = '';
            
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                
                // Group text items by Y position (line detection)
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
                        // Add space if there's a gap
                        if (i > 0) {
                            const gap = item.x - lastX;
                            // Adjust threshold based on average character width
                            const avgCharWidth = item.width / (item.text.length || 1);
                            if (gap > avgCharWidth * 0.5) {
                                lineText += ' ';
                            }
                        }
                        
                        lineText += item.text;
                        lastX = item.x + item.width;
                    });
                    
                    fullText += lineText.trim() + '\n';
                });
                
                // Add page break
                if (pageNum < pdf.numPages) {
                    fullText += '\n';
                }
            }
            
            return this.normalizeScriptText(fullText);
            
        } catch (error) {
            console.error('PDF extraction error:', error);
            throw new Error(`Failed to extract PDF text: ${error.message}`);
        }
    }

    // Advanced text normalization
    normalizeScriptText(text) {
        console.log('🔧 Normalizing script text...');
        
        let normalized = text;
        
        // Fix common PDF extraction issues
        
        // 1. Fix split words (e.g. "I NT." -> "INT.")
        normalized = normalized.replace(/I\s+NT\./gi, 'INT.');
        normalized = normalized.replace(/E\s+XT\./gi, 'EXT.');
        normalized = normalized.replace(/I\s+NT\s+\//gi, 'INT/');
        normalized = normalized.replace(/E\s+XT\s+\//gi, 'EXT/');
        
        // 2. Fix character names split across spaces
        normalized = normalized.replace(/([A-Z])\s+([A-Z])\s+([A-Z])/g, (match, p1, p2, p3) => {
            // Check if this looks like a split character name
            if (p1.length === 1 && p2.length === 1) {
                return p1 + p2 + p3;
            }
            return match;
        });
        
        // 3. Remove excessive spaces while preserving script structure
        const lines = normalized.split('\n');
        normalized = lines.map(line => {
            // Preserve indentation at start of line
            const indent = line.match(/^\s*/)[0];
            const content = line.trim();
            
            // Fix spacing within the content
            const fixed = content
                // Remove spaces between single characters that form words
                .replace(/\b(\w)\s+(\w)\s+(\w)\s+(\w)\b/g, '$1$2$3$4')
                .replace(/\b(\w)\s+(\w)\s+(\w)\b/g, '$1$2$3')
                .replace(/\b(\w)\s+(\w)\b/g, (match, p1, p2) => {
                    // Keep space if both are actual words
                    if (p1.length > 1 && p2.length > 1) return match;
                    // Otherwise remove space
                    return p1 + p2;
                })
                // Fix punctuation spacing
                .replace(/\s+([.,!?;:])/g, '$1')
                .replace(/([.,!?;:])\s*([a-zA-Z])/g, '$1 $2')
                // Normalize multiple spaces to single
                .replace(/\s+/g, ' ');
            
            return indent + fixed;
        }).join('\n');
        
        // 4. Clean up line breaks
        normalized = normalized
            .replace(/\n\n\n+/g, '\n\n')  // Max 2 consecutive line breaks
            .replace(/\n\s+\n/g, '\n\n');  // Remove whitespace-only lines
        
        console.log('✅ Normalization complete');
        return normalized;
    }

    // Parse script into structured format
    parseScreenplay(scriptText) {
        console.log('🎬 Parsing screenplay...');
        
        const lines = scriptText.split('\n');
        const elements = [];
        const scenes = [];
        
        let currentElement = null;
        let currentScene = null;
        let inDialogue = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            const upperTrimmed = trimmed.toUpperCase();
            const indent = line.search(/\S/);
            
            // Skip empty lines
            if (!trimmed) {
                inDialogue = false;
                continue;
            }
            
            // Scene Heading Detection - Multiple patterns
            const scenePatterns = [
                /^(INT\.?|EXT\.?|INT\.?\/EXT\.?|I\/E\.?)\s+.+/i,
                /^(INTERIOR|EXTERIOR)\s+.+/i,
                /^\d+\s+(INT\.?|EXT\.?|INT\.?\/EXT\.?)\s+.+/i,
                /^SCENE\s+\d+.*?(INT\.?|EXT\.?)/i
            ];
            
            const isSceneHeading = scenePatterns.some(pattern => pattern.test(trimmed));
            
            if (isSceneHeading) {
                // Clean up the scene heading
                let cleanHeading = trimmed
                    .replace(/^SCENE\s+\d+\s*/i, '')
                    .replace(/^\d+\s+/, '')
                    .replace(/^(\w)\s+/, '$1');
                
                currentScene = {
                    type: this.scriptTypes.SCENE_HEADING,
                    text: cleanHeading,
                    lineNumber: i,
                    elements: []
                };
                
                scenes.push(currentScene);
                inDialogue = false;
                
                console.log(`  📍 Found scene: ${cleanHeading}`);
            }
            // Character Name Detection
            else if (this.isCharacterName(trimmed, indent, inDialogue)) {
                currentElement = {
                    type: this.scriptTypes.CHARACTER,
                    text: trimmed,
                    lineNumber: i
                };
                
                if (currentScene) {
                    currentScene.elements.push(currentElement);
                }
                
                inDialogue = true;
            }
            // Parenthetical Detection
            else if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
                currentElement = {
                    type: this.scriptTypes.PARENTHETICAL,
                    text: trimmed,
                    lineNumber: i
                };
                
                if (currentScene) {
                    currentScene.elements.push(currentElement);
                }
            }
            // Dialogue Detection
            else if (inDialogue && indent > 10) {
                currentElement = {
                    type: this.scriptTypes.DIALOGUE,
                    text: trimmed,
                    lineNumber: i
                };
                
                if (currentScene) {
                    currentScene.elements.push(currentElement);
                }
            }
            // Transition Detection
            else if (this.isTransition(trimmed)) {
                currentElement = {
                    type: this.scriptTypes.TRANSITION,
                    text: trimmed,
                    lineNumber: i
                };
                
                if (currentScene) {
                    currentScene.elements.push(currentElement);
                }
                
                inDialogue = false;
            }
            // Action/Description
            else {
                currentElement = {
                    type: this.scriptTypes.ACTION,
                    text: trimmed,
                    lineNumber: i
                };
                
                if (currentScene) {
                    currentScene.elements.push(currentElement);
                }
                
                inDialogue = false;
            }
        }
        
        console.log(`✅ Parsed ${scenes.length} scenes`);
        
        return {
            scenes: scenes,
            metadata: {
                totalScenes: scenes.length,
                totalLines: lines.length,
                characters: this.extractCharacters(scenes)
            }
        };
    }

    // Helper: Detect character names
    isCharacterName(text, indent, wasInDialogue) {
        // Character names are usually:
        // - ALL CAPS
        // - Centered (indented around 20-40 chars)
        // - Not too long (< 35 chars)
        // - May have extensions like (CONT'D) or (O.S.)
        
        if (text.length > 35) return false;
        if (indent < 15) return false;
        
        // Remove extensions
        const cleanText = text.replace(/\s*\([^)]+\)$/, '').trim();
        
        // Check if mostly uppercase
        const upperRatio = (cleanText.match(/[A-Z]/g) || []).length / cleanText.length;
        
        return upperRatio > 0.7 && cleanText.length > 0;
    }

    // Helper: Detect transitions
    isTransition(text) {
        const transitions = [
            'CUT TO:', 'FADE IN:', 'FADE OUT:', 'FADE TO:',
            'DISSOLVE TO:', 'MATCH CUT:', 'SMASH CUT:',
            'TIME CUT:', 'INTERCUT:', 'IRIS OUT:'
        ];
        
        return transitions.some(t => text.toUpperCase().includes(t));
    }

    // Extract character list from scenes
    extractCharacters(scenes) {
        const characters = new Set();
        
        scenes.forEach(scene => {
            scene.elements.forEach(element => {
                if (element.type === this.scriptTypes.CHARACTER) {
                    // Remove extensions like (CONT'D)
                    const name = element.text.replace(/\s*\([^)]+\)$/, '').trim();
                    characters.add(name);
                }
            });
        });
        
        return Array.from(characters).sort();
    }

    // Convert parsed script back to formatted HTML
    formatScriptHTML(parsedScript) {
        let html = '';
        
        parsedScript.scenes.forEach((scene, index) => {
            html += `<div class="script-scene" id="scene-${index + 1}">`;
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

    // Save processed script to storage
    saveScriptData(projectId, scriptData) {
        try {
            // Store in chunks if too large
            const dataStr = JSON.stringify(scriptData);
            
            if (dataStr.length > 1000000) { // 1MB chunks
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

    // Load processed script from storage
    loadScriptData(projectId) {
        try {
            // Check for chunked data first
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

// Export for use in other scripts
window.ScriptProcessor = ScriptProcessor;
