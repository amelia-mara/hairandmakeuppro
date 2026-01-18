/**
 * Hair & Makeup Pro - Script Processor
 * Enhanced PDF Processing Pipeline
 *
 * Pipeline: PDF Upload → Text Extraction → Pattern Matching → User Confirmation
 *
 * Handles PDF text extraction with line reconstruction, scene detection,
 * character extraction with confidence scoring, and duplicate detection.
 */

const ScriptProcessor = {
    // ============================================
    // CONFIGURATION
    // ============================================

    config: {
        // Scene heading patterns - comprehensive regex for screenplay conventions
        sceneHeadingPatterns: [
            // Standard: INT. LOCATION - DAY
            /^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s*(.+?)\s*[-–—]\s*(DAY|NIGHT|MORNING|EVENING|DAWN|DUSK|LATER|CONTINUOUS|SAME TIME|MOMENTS LATER|AFTERNOON|SUNRISE|SUNSET|NOON|MIDNIGHT)/i,

            // Without time: INT. LOCATION
            /^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s*(.+?)$/i,

            // Numbered: 1. INT. LOCATION - DAY
            /^(\d+[A-Z]?)\.\s*(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s*(.+?)\s*[-–—]?\s*(DAY|NIGHT|MORNING|EVENING|DAWN|DUSK|LATER|CONTINUOUS|SAME TIME|MOMENTS LATER|AFTERNOON)?$/i,

            // Full words: INTERIOR/EXTERIOR
            /^(INTERIOR|EXTERIOR)\s+(.+?)\s*[-–—]\s*(DAY|NIGHT|MORNING|EVENING|DAWN|DUSK|LATER|CONTINUOUS)/i
        ],

        // Character name pattern: ALL CAPS, may include (V.O.) (O.S.) (CONT'D)
        characterPattern: /^([A-Z][A-Z\s\-'\.]+?)(?:\s*\((?:V\.O\.|O\.S\.|O\.C\.|CONT'D|CONT|VO|OS|OC|VOICE OVER|OFF SCREEN|OFF CAMERA)\))?$/,

        // Things that LOOK like character names but aren't
        excludePatterns: [
            /^(INT|EXT|INTERIOR|EXTERIOR|FADE|CUT|DISSOLVE|TITLE|SUPER|INTERCUT|FLASHBACK|END|THE END|CONTINUED|MORE)/i,
            /^(MORNING|EVENING|NIGHT|DAY|LATER|CONTINUOUS|SAME|DAWN|DUSK|AFTERNOON)/i,
            /^\d/,  // Starts with number
            /^(A|AN|THE)\s/i,  // Articles
            /^(ANGLE|CLOSE|WIDE|INSERT|POV|ESTABLISHING|STOCK|ARCHIVE|FREEZE|SPLIT|BEGIN)/i,
            /^(ACT|SCENE|PAGE|REVISION|DRAFT|FINAL|SHOOTING|COLD OPEN|TEASER)/i,
            /^(BACK TO|TIME CUT|MATCH CUT|JUMP CUT|SMASH CUT|PRE-LAP)/i,
            /^(MONTAGE|SERIES OF|DREAM SEQUENCE)/i
        ],

        // Extended exclusions set
        excludedNames: new Set([
            'INT', 'EXT', 'INTERIOR', 'EXTERIOR', 'FADE IN', 'FADE OUT', 'FADE TO BLACK',
            'CUT TO', 'DISSOLVE TO', 'SMASH CUT', 'MATCH CUT', 'JUMP CUT', 'HARD CUT',
            'THE END', 'CONTINUED', 'CONT', 'CONTD', 'MORE', 'PRE-LAP', 'PRELAP',
            'V.O', 'V.O.', 'VO', 'O.S', 'O.S.', 'OS', 'O.C', 'O.C.', 'OC',
            'SUPER', 'SUPERIMPOSE', 'TITLE', 'SUBTITLE', 'CHYRON', 'TITLE CARD',
            'FLASHBACK', 'FLASH BACK', 'END FLASHBACK', 'DREAM SEQUENCE', 'END DREAM',
            'MONTAGE', 'END MONTAGE', 'SERIES OF SHOTS', 'END SERIES', 'INTERCUT',
            'BACK TO SCENE', 'BACK TO', 'ANGLE ON', 'CLOSE ON', 'WIDE ON', 'TIGHT ON',
            'INSERT', 'ESTABLISHING', 'STOCK SHOT', 'ARCHIVE FOOTAGE', 'NEWS FOOTAGE',
            'TIME CUT', 'FREEZE FRAME', 'SPLIT SCREEN', 'BEGIN', 'END',
            'ACT ONE', 'ACT TWO', 'ACT THREE', 'ACT FOUR', 'ACT FIVE',
            'COLD OPEN', 'TEASER', 'TAG', 'EPILOGUE', 'PROLOGUE',
            'SCENE', 'PAGE', 'REVISION', 'DRAFT', 'FINAL', 'SHOOTING',
            'LATER', 'MOMENTS LATER', 'CONTINUOUS', 'SAME TIME',
            'DAY', 'NIGHT', 'MORNING', 'EVENING', 'AFTERNOON', 'DAWN', 'DUSK'
        ]),

        // Minimum text length to consider PDF as valid (not scanned/image)
        minTextLength: 500,

        // Minimum occurrences to consider as a character
        minCharacterOccurrences: 2,

        // Similarity threshold for duplicate detection (0-1)
        duplicateSimilarityThreshold: 0.75
    },

    // ============================================
    // PDF TEXT EXTRACTION (Enhanced)
    // ============================================

    /**
     * Extract text from a PDF file with proper line reconstruction
     * @param {File} file - The PDF file to process
     * @returns {Promise<string>} - The extracted text
     */
    async extractTextFromPDF(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const typedArray = new Uint8Array(e.target.result);
                    const pdf = await pdfjsLib.getDocument(typedArray).promise;

                    const pages = [];
                    const numPages = pdf.numPages;

                    for (let i = 1; i <= numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();

                        // Sort items by Y position (top to bottom), then X (left to right)
                        const items = textContent.items.sort((a, b) => {
                            const yDiff = b.transform[5] - a.transform[5]; // Y is inverted in PDF
                            if (Math.abs(yDiff) > 5) return yDiff; // Different lines
                            return a.transform[4] - b.transform[4]; // Same line, sort by X
                        });

                        // Reconstruct lines based on Y position
                        const lines = [];
                        let currentLine = [];
                        let lastY = null;

                        items.forEach(item => {
                            const y = Math.round(item.transform[5]);
                            if (lastY !== null && Math.abs(y - lastY) > 5) {
                                // New line detected
                                if (currentLine.length > 0) {
                                    lines.push(currentLine.join(' ').trim());
                                }
                                currentLine = [];
                            }
                            if (item.str.trim()) {
                                currentLine.push(item.str);
                            }
                            lastY = y;
                        });

                        // Don't forget the last line
                        if (currentLine.length > 0) {
                            lines.push(currentLine.join(' ').trim());
                        }

                        pages.push(lines.join('\n'));
                    }

                    const fullText = pages.join('\n\n');

                    // Check if PDF is scanned/image-based
                    if (fullText.trim().length < this.config.minTextLength) {
                        reject(new Error('This PDF appears to be scanned or image-based. Please use a text-based PDF exported from screenwriting software (Final Draft, Highland, Fade In, etc.).'));
                        return;
                    }

                    resolve(fullText);
                } catch (error) {
                    reject(new Error(`Failed to extract PDF text: ${error.message}`));
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * Extract text from a plain text file
     * @param {File} file - The text file to process
     * @returns {Promise<string>} - The file contents
     */
    async extractTextFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    },

    /**
     * Process a script file (PDF or text)
     * @param {File} file - The script file
     * @returns {Promise<string>} - The extracted text
     */
    async extractText(file) {
        const extension = file.name.split('.').pop().toLowerCase();

        if (extension === 'pdf') {
            return this.extractTextFromPDF(file);
        } else {
            return this.extractTextFromFile(file);
        }
    },

    // ============================================
    // SCENE DETECTION (Pattern Matching)
    // ============================================

    /**
     * Check if a line is a scene heading and extract components
     * @param {string} line - The line to check
     * @returns {Object|null} - Scene data or null
     */
    parseSceneHeading(line) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length < 5) return null;

        for (const pattern of this.config.sceneHeadingPatterns) {
            const match = trimmed.match(pattern);
            if (match) {
                // Handle numbered scenes (pattern 3)
                if (match[2] && /^(INT|EXT|I\/E)/i.test(match[2])) {
                    return {
                        heading: trimmed,
                        extractedNumber: match[1],
                        intExt: this.normalizeIntExt(match[2]),
                        location: match[3]?.trim() || '',
                        timeOfDay: (match[4] || 'DAY').toUpperCase()
                    };
                }

                // Standard patterns
                return {
                    heading: trimmed,
                    extractedNumber: null,
                    intExt: this.normalizeIntExt(match[1]),
                    location: match[2]?.trim() || '',
                    timeOfDay: (match[3] || 'DAY').toUpperCase()
                };
            }
        }

        return null;
    },

    /**
     * Normalize INT/EXT indicator
     */
    normalizeIntExt(indicator) {
        const upper = indicator.toUpperCase().replace(/[.\s]/g, '');
        if (upper.includes('/') || upper === 'IE' || upper === 'EI') return 'INT/EXT';
        if (upper.startsWith('INT') || upper === 'INTERIOR') return 'INT';
        if (upper.startsWith('EXT') || upper === 'EXTERIOR') return 'EXT';
        return 'INT';
    },

    /**
     * Detect all scenes in the script text
     * @param {string} text - The script text
     * @returns {Array} - Array of scene objects
     */
    detectScenes(text) {
        const lines = text.split(/\r?\n/);
        const scenes = [];
        let currentScene = null;
        let sceneNumber = 0;

        lines.forEach((line, index) => {
            const sceneData = this.parseSceneHeading(line);

            if (sceneData) {
                // Save previous scene
                if (currentScene) {
                    currentScene.endLine = index - 1;
                    currentScene.content = lines.slice(currentScene.startLine + 1, index);
                    scenes.push(currentScene);
                }

                sceneNumber++;
                currentScene = {
                    index: sceneNumber - 1,
                    number: sceneData.extractedNumber || sceneNumber.toString(),
                    heading: sceneData.heading,
                    type: sceneData.intExt,
                    timeOfDay: sceneData.timeOfDay,
                    location: sceneData.location,
                    characters: [],
                    startLine: index,
                    endLine: null,
                    content: [],
                    status: 'pending'
                };
            }
        });

        // Save final scene
        if (currentScene) {
            currentScene.endLine = lines.length - 1;
            currentScene.content = lines.slice(currentScene.startLine + 1);
            scenes.push(currentScene);
        }

        return scenes;
    },

    // ============================================
    // CHARACTER EXTRACTION (Pattern Matching)
    // ============================================

    /**
     * Check if a name should be excluded
     * @param {string} name - The name to check
     * @returns {boolean}
     */
    isExcludedName(name) {
        const normalized = name.trim().toUpperCase();

        // Check against Set
        if (this.config.excludedNames.has(normalized)) return true;

        // Check against regex patterns
        for (const pattern of this.config.excludePatterns) {
            if (pattern.test(normalized)) return true;
        }

        return false;
    },

    /**
     * Check if a line looks like dialogue (not all caps, reasonable length)
     * @param {string} line - The line to check
     * @returns {boolean}
     */
    looksLikeDialogue(line) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length === 0) return false;

        // Dialogue is usually not all caps (except for emphasis)
        // And usually has some lowercase letters
        const hasLowercase = /[a-z]/.test(trimmed);
        const isAllCaps = trimmed === trimmed.toUpperCase();

        // Either has lowercase or is short enough to be emphasis in dialogue
        return hasLowercase || (isAllCaps && trimmed.length < 20);
    },

    /**
     * Extract character name from a potential character cue line
     * @param {string} line - The line to check
     * @param {string} nextLine - The next line (for dialogue verification)
     * @returns {string|null} - The character name or null
     */
    extractCharacterName(line, nextLine = '') {
        const trimmed = line.trim();

        // Must be reasonably short (character cues are typically short)
        if (trimmed.length < 2 || trimmed.length > 40) return null;

        // Must be mostly uppercase (at least 80%)
        const upperCount = (trimmed.match(/[A-Z]/g) || []).length;
        const letterCount = (trimmed.match(/[A-Za-z]/g) || []).length;
        if (letterCount === 0 || upperCount / letterCount < 0.8) return null;

        // Check against character pattern
        const match = trimmed.match(this.config.characterPattern);
        if (!match) return null;

        let name = match[1].trim();

        // Remove common suffixes that might have slipped through
        name = name.replace(/\s*(CONT'?D?|CONTINUED)$/i, '').trim();

        // Check exclusions
        if (this.isExcludedName(name)) return null;

        // Must have at least 2 letter characters
        if (name.replace(/[^A-Z]/gi, '').length < 2) return null;

        // Check if next line looks like dialogue (key improvement)
        if (nextLine && !this.looksLikeDialogue(nextLine)) {
            // If there's a next line but it doesn't look like dialogue,
            // this might not be a character cue - reduce confidence later
            return { name, hasDialogue: false };
        }

        return { name, hasDialogue: true };
    },

    /**
     * Calculate confidence score for a character
     * @param {Object} character - The character data
     * @param {Array} scenes - All scenes
     * @returns {number} - Confidence score (0-1)
     */
    calculateConfidence(character, scenes) {
        let confidence = 0.5; // Base confidence

        // More dialogue occurrences = higher confidence
        if (character.dialogueCount > 10) confidence += 0.25;
        else if (character.dialogueCount > 5) confidence += 0.15;
        else if (character.dialogueCount > 2) confidence += 0.1;

        // Appears in multiple scenes = higher confidence
        if (character.sceneCount > 5) confidence += 0.15;
        else if (character.sceneCount > 2) confidence += 0.1;

        // Name looks like a real name (not abbreviation)
        if (character.name.length > 3 && !/^[A-Z]{2,4}$/.test(character.name)) {
            confidence += 0.1;
        }

        // Has spaces (likely full name) = higher confidence
        if (character.name.includes(' ')) {
            confidence += 0.05;
        }

        // Reduce confidence if no verified dialogue
        if (character.verifiedDialogue === 0) {
            confidence -= 0.2;
        }

        return Math.max(0, Math.min(confidence, 1.0));
    },

    /**
     * Extract all character names from the script with confidence scoring
     * @param {string} text - The script text
     * @param {Array} scenes - The detected scenes
     * @returns {Array} - Array of character objects with confidence
     */
    extractCharacters(text, scenes) {
        const lines = text.split(/\r?\n/);
        const characterData = new Map(); // name -> { count, dialogueCount, scenes }

        let currentSceneIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const nextLine = lines[i + 1] || '';

            // Update current scene
            const sceneAtLine = scenes.find(s => s.startLine === i);
            if (sceneAtLine) {
                currentSceneIndex = sceneAtLine.index;
            }

            // Try to extract character name
            const result = this.extractCharacterName(line, nextLine);

            if (result) {
                const name = typeof result === 'string' ? result : result.name;
                const hasDialogue = typeof result === 'object' ? result.hasDialogue : true;

                if (!characterData.has(name)) {
                    characterData.set(name, {
                        name: name,
                        count: 0,
                        dialogueCount: 0,
                        scenes: new Set()
                    });
                }

                const data = characterData.get(name);
                data.count++;
                if (hasDialogue) data.dialogueCount++;
                if (currentSceneIndex >= 0) {
                    data.scenes.add(currentSceneIndex);
                }
            }
        }

        // Convert to array and calculate confidence
        const characters = [];
        characterData.forEach((data, name) => {
            // Filter by minimum occurrences
            if (data.count >= this.config.minCharacterOccurrences) {
                const character = {
                    name: name,
                    normalizedName: this.normalizeName(name),
                    occurrences: data.count,
                    dialogueCount: data.dialogueCount,
                    verifiedDialogue: data.dialogueCount,
                    sceneIndices: Array.from(data.scenes).sort((a, b) => a - b),
                    sceneCount: data.scenes.size,
                    selected: true
                };

                // Calculate confidence
                character.confidence = this.calculateConfidence(character, scenes);

                // Flag low confidence characters
                character.isLowConfidence = character.confidence < 0.6;
                character.isSuspicious = character.confidence < 0.4;

                characters.push(character);
            }
        });

        // Sort by confidence (high first), then by occurrence count
        characters.sort((a, b) => {
            if (Math.abs(a.confidence - b.confidence) > 0.1) {
                return b.confidence - a.confidence;
            }
            return b.occurrences - a.occurrences;
        });

        // Assign characters to scenes
        characters.forEach(char => {
            char.sceneIndices.forEach(sceneIndex => {
                const scene = scenes[sceneIndex];
                if (scene && !scene.characters.includes(char.name)) {
                    scene.characters.push(char.name);
                }
            });
        });

        return characters;
    },

    // ============================================
    // DUPLICATE DETECTION
    // ============================================

    /**
     * Normalize a character name for comparison
     * @param {string} name - The name to normalize
     * @returns {string}
     */
    normalizeName(name) {
        return name
            .toUpperCase()
            .replace(/[^A-Z\s]/g, '') // Remove non-letters except spaces
            .replace(/\s+/g, ' ')     // Normalize spaces
            .trim();
    },

    /**
     * Calculate similarity between two strings (Levenshtein-based)
     * @param {string} s1 - First string
     * @param {string} s2 - Second string
     * @returns {number} - Similarity score (0-1)
     */
    calculateSimilarity(s1, s2) {
        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;

        if (longer.length === 0) return 1.0;

        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    },

    /**
     * Calculate Levenshtein distance between two strings
     */
    levenshteinDistance(s1, s2) {
        const costs = [];

        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) {
                    costs[j] = j;
                } else if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    }
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
            if (i > 0) costs[s2.length] = lastValue;
        }

        return costs[s2.length];
    },

    /**
     * Check if one name is contained in another or shares components
     */
    isNameContained(name1, name2) {
        const n1 = this.normalizeName(name1);
        const n2 = this.normalizeName(name2);

        // Exact match after normalization
        if (n1 === n2) return true;

        // Check if one is a substring of the other
        if (n1.includes(n2) || n2.includes(n1)) return true;

        // Check if they share the same first or last name
        const parts1 = n1.split(' ');
        const parts2 = n2.split(' ');

        // If one is single name and matches part of the other
        if (parts1.length === 1 && parts2.includes(parts1[0])) return true;
        if (parts2.length === 1 && parts1.includes(parts2[0])) return true;

        // Check if first names match
        if (parts1[0] === parts2[0] && parts1[0].length > 2) return true;

        return false;
    },

    /**
     * Detect potential duplicate characters
     * @param {Array} characters - Array of character objects
     * @returns {Array} - Array of duplicate groups
     */
    detectDuplicates(characters) {
        const duplicateGroups = [];
        const processed = new Set();

        for (let i = 0; i < characters.length; i++) {
            if (processed.has(i)) continue;

            const char1 = characters[i];
            const group = [char1];

            for (let j = i + 1; j < characters.length; j++) {
                if (processed.has(j)) continue;

                const char2 = characters[j];

                // Check for similarity
                const similarity = this.calculateSimilarity(
                    char1.normalizedName,
                    char2.normalizedName
                );

                const isContained = this.isNameContained(char1.name, char2.name);

                if (similarity >= this.config.duplicateSimilarityThreshold || isContained) {
                    group.push(char2);
                    processed.add(j);
                }
            }

            if (group.length > 1) {
                // Determine the suggested merged name (prefer longer, higher confidence)
                const suggestedName = group.reduce((best, char) => {
                    // Prefer higher confidence
                    if (char.confidence > best.confidence + 0.1) return char;
                    if (best.confidence > char.confidence + 0.1) return best;

                    // Prefer names with more parts (first + last)
                    const bestParts = best.name.split(/\s+/).length;
                    const charParts = char.name.split(/\s+/).length;

                    if (charParts > bestParts) return char;
                    if (charParts < bestParts) return best;

                    // If same parts, prefer longer name
                    return char.name.length > best.name.length ? char : best;
                }, group[0]);

                duplicateGroups.push({
                    characters: group,
                    suggestedName: suggestedName.name,
                    totalScenes: new Set(group.flatMap(c => c.sceneIndices)).size,
                    totalOccurrences: group.reduce((sum, c) => sum + c.occurrences, 0)
                });

                processed.add(i);
            }
        }

        return duplicateGroups;
    },

    /**
     * Merge duplicate characters
     */
    mergeCharacters(characters, duplicates, mergeDecisions) {
        // Find all characters that are part of duplicate groups
        const duplicateNames = new Set();
        duplicates.forEach(group => {
            group.characters.forEach(char => {
                duplicateNames.add(char.name);
            });
        });

        // Start with non-duplicate characters
        const merged = characters.filter(char => !duplicateNames.has(char.name));

        // Add merged characters
        duplicates.forEach((group, index) => {
            const mergedName = mergeDecisions[index] || group.suggestedName;

            const mergedChar = {
                name: mergedName,
                normalizedName: this.normalizeName(mergedName),
                occurrences: group.totalOccurrences,
                sceneIndices: Array.from(new Set(group.characters.flatMap(c => c.sceneIndices))).sort((a, b) => a - b),
                sceneCount: group.totalScenes,
                confidence: Math.max(...group.characters.map(c => c.confidence)),
                selected: true,
                mergedFrom: group.characters.map(c => c.name)
            };

            merged.push(mergedChar);
        });

        // Re-sort by confidence and occurrence count
        merged.sort((a, b) => {
            if (Math.abs((a.confidence || 0.5) - (b.confidence || 0.5)) > 0.1) {
                return (b.confidence || 0.5) - (a.confidence || 0.5);
            }
            return b.occurrences - a.occurrences;
        });

        return merged;
    },

    // ============================================
    // MAIN PROCESSING
    // ============================================

    /**
     * Process a script file completely
     * @param {File} file - The script file
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Object>} - Processing results
     */
    async processScript(file, onProgress = () => {}) {
        try {
            // Step 1: Extract text with line reconstruction
            onProgress({ step: 'extracting', progress: 10, message: 'Extracting text from PDF...' });
            const text = await this.extractText(file);

            // Step 2: Detect scenes using pattern matching
            onProgress({ step: 'scenes', progress: 40, message: 'Detecting scenes...' });
            const scenes = this.detectScenes(text);

            if (scenes.length === 0) {
                throw new Error('No scenes detected. Please ensure this is a properly formatted screenplay with scene headings (INT./EXT.).');
            }

            // Step 3: Extract characters with confidence scoring
            onProgress({ step: 'characters', progress: 70, message: 'Identifying characters...' });
            const characters = this.extractCharacters(text, scenes);

            // Step 4: Detect duplicates
            onProgress({ step: 'duplicates', progress: 90, message: 'Checking for duplicates...' });
            const duplicates = this.detectDuplicates(characters);

            onProgress({ step: 'complete', progress: 100, message: 'Analysis complete!' });

            // Categorize characters by confidence
            const highConfidence = characters.filter(c => c.confidence >= 0.7);
            const mediumConfidence = characters.filter(c => c.confidence >= 0.4 && c.confidence < 0.7);
            const lowConfidence = characters.filter(c => c.confidence < 0.4);

            return {
                success: true,
                scenes,
                characters,
                duplicates,
                stats: {
                    totalScenes: scenes.length,
                    totalCharacters: characters.length,
                    highConfidenceCount: highConfidence.length,
                    mediumConfidenceCount: mediumConfidence.length,
                    lowConfidenceCount: lowConfidence.length,
                    duplicateGroups: duplicates.length
                }
            };
        } catch (error) {
            console.error('Script processing error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    // ============================================
    // DEMO DATA
    // ============================================

    /**
     * Generate demo script data for testing
     * @returns {Object} - Demo processing results
     */
    generateDemoData() {
        const scenes = [
            { index: 0, number: '1', heading: "INT. SARAH'S APARTMENT - MORNING", type: 'INT', timeOfDay: 'DAY', location: "SARAH'S APARTMENT", characters: ['SARAH CHEN', 'MIKE'], status: 'pending' },
            { index: 1, number: '2', heading: "EXT. CITY STREET - DAY", type: 'EXT', timeOfDay: 'DAY', location: "CITY STREET", characters: ['SARAH CHEN'], status: 'pending' },
            { index: 2, number: '3', heading: "INT. COFFEE SHOP - DAY", type: 'INT', timeOfDay: 'DAY', location: "COFFEE SHOP", characters: ['SARAH CHEN', 'MIKE', 'BARISTA'], status: 'pending' },
            { index: 3, number: '4', heading: "INT. MIKE'S OFFICE - DAY", type: 'INT', timeOfDay: 'DAY', location: "MIKE'S OFFICE", characters: ['MIKE', 'DR. WILSON'], status: 'pending' },
            { index: 4, number: '5', heading: "EXT. PARK - AFTERNOON", type: 'EXT', timeOfDay: 'DAY', location: "PARK", characters: ['SARAH CHEN', 'MIKE'], status: 'pending' },
            { index: 5, number: '6', heading: "INT. HOSPITAL - NIGHT", type: 'INT', timeOfDay: 'NIGHT', location: "HOSPITAL", characters: ['DR. WILSON', 'NURSE JACKSON'], status: 'pending' },
            { index: 6, number: '7', heading: "INT. SARAH'S APARTMENT - NIGHT", type: 'INT', timeOfDay: 'NIGHT', location: "SARAH'S APARTMENT", characters: ['SARAH CHEN'], status: 'pending' },
            { index: 7, number: '8', heading: "EXT. HOSPITAL ENTRANCE - MORNING", type: 'EXT', timeOfDay: 'DAY', location: "HOSPITAL ENTRANCE", characters: ['SARAH CHEN', 'DR. WILSON'], status: 'pending' }
        ];

        const characters = [
            { name: 'SARAH CHEN', normalizedName: 'SARAH CHEN', occurrences: 24, dialogueCount: 20, sceneIndices: [0, 1, 2, 4, 6, 7], sceneCount: 6, confidence: 0.95, selected: true },
            { name: 'MIKE', normalizedName: 'MIKE', occurrences: 18, dialogueCount: 15, sceneIndices: [0, 2, 3, 4], sceneCount: 4, confidence: 0.9, selected: true },
            { name: 'DR. WILSON', normalizedName: 'DR WILSON', occurrences: 12, dialogueCount: 10, sceneIndices: [3, 5, 7], sceneCount: 3, confidence: 0.85, selected: true },
            { name: 'BARISTA', normalizedName: 'BARISTA', occurrences: 4, dialogueCount: 3, sceneIndices: [2], sceneCount: 1, confidence: 0.7, selected: true },
            { name: 'NURSE JACKSON', normalizedName: 'NURSE JACKSON', occurrences: 3, dialogueCount: 2, sceneIndices: [5], sceneCount: 1, confidence: 0.65, selected: true }
        ];

        const duplicates = [];

        return {
            success: true,
            scenes,
            characters,
            duplicates,
            stats: {
                totalScenes: scenes.length,
                totalCharacters: characters.length,
                highConfidenceCount: 3,
                mediumConfidenceCount: 2,
                lowConfidenceCount: 0,
                duplicateGroups: 0
            }
        };
    }
};

// Export for global access
window.ScriptProcessor = ScriptProcessor;
