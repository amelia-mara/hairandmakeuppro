/**
 * Hair & Makeup Pro - Script Processor
 * Stage 2: Script Upload & Analysis
 *
 * Handles PDF text extraction, scene detection, character extraction,
 * and duplicate detection using pattern matching.
 */

const ScriptProcessor = {
    // ============================================
    // CONFIGURATION
    // ============================================

    config: {
        // Scene heading patterns (INT./EXT.)
        scenePatterns: [
            /^(INT\.|INT |INTERIOR\s)/i,
            /^(EXT\.|EXT |EXTERIOR\s)/i,
            /^(INT\.\/EXT\.|INT\/EXT|I\/E\.?)/i,
            /^(EXT\.\/INT\.|EXT\/INT|E\/I\.?)/i
        ],

        // Time of day patterns
        timePatterns: {
            day: /\b(DAY|MORNING|AFTERNOON|SUNRISE|NOON)\b/i,
            night: /\b(NIGHT|EVENING|DUSK|DAWN|MIDNIGHT)\b/i,
            continuous: /\b(CONTINUOUS|CONT'?D?|SAME)\b/i,
            later: /\b(LATER|MOMENTS LATER)\b/i
        },

        // Character name patterns (ALL CAPS, may include parentheticals)
        characterPattern: /^([A-Z][A-Z\s\.\-\']+)(\s*\([^)]+\))?$/,

        // Exclude these as character names (common script elements)
        excludedNames: new Set([
            'INT', 'EXT', 'INTERIOR', 'EXTERIOR', 'FADE IN', 'FADE OUT',
            'CUT TO', 'DISSOLVE TO', 'SMASH CUT', 'MATCH CUT', 'JUMP CUT',
            'THE END', 'CONTINUED', 'CONT', 'CONTD', 'MORE', 'PRE-LAP',
            'V.O', 'V.O.', 'VO', 'O.S', 'O.S.', 'OS', 'O.C', 'O.C.', 'OC',
            'SUPER', 'SUPERIMPOSE', 'TITLE', 'SUBTITLE', 'CHYRON',
            'FLASHBACK', 'FLASH BACK', 'END FLASHBACK', 'DREAM SEQUENCE',
            'MONTAGE', 'END MONTAGE', 'SERIES OF SHOTS', 'INTERCUT',
            'BACK TO SCENE', 'BACK TO', 'ANGLE ON', 'CLOSE ON', 'WIDE ON',
            'INSERT', 'ESTABLISHING', 'STOCK SHOT', 'ARCHIVE FOOTAGE',
            'TIME CUT', 'FREEZE FRAME', 'SPLIT SCREEN', 'BEGIN', 'END',
            'ACT ONE', 'ACT TWO', 'ACT THREE', 'COLD OPEN', 'TEASER',
            'SCENE', 'PAGE', 'REVISION', 'DRAFT', 'FINAL', 'SHOOTING'
        ]),

        // Minimum occurrences to consider as a character
        minCharacterOccurrences: 1,

        // Similarity threshold for duplicate detection (0-1)
        duplicateSimilarityThreshold: 0.7
    },

    // ============================================
    // PDF TEXT EXTRACTION
    // ============================================

    /**
     * Extract text from a PDF file
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

                    let fullText = '';
                    const numPages = pdf.numPages;

                    for (let i = 1; i <= numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items
                            .map(item => item.str)
                            .join(' ');
                        fullText += pageText + '\n';
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
    // SCENE DETECTION
    // ============================================

    /**
     * Check if a line is a scene heading
     * @param {string} line - The line to check
     * @returns {boolean}
     */
    isSceneHeading(line) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length < 5) return false;

        return this.config.scenePatterns.some(pattern => pattern.test(trimmed));
    },

    /**
     * Parse scene type (INT/EXT) from heading
     * @param {string} heading - The scene heading
     * @returns {string} - 'INT', 'EXT', or 'INT/EXT'
     */
    parseSceneType(heading) {
        const upper = heading.toUpperCase();

        if (/^(INT\.\/EXT\.|INT\/EXT|I\/E)/i.test(upper)) return 'INT/EXT';
        if (/^(EXT\.\/INT\.|EXT\/INT|E\/I)/i.test(upper)) return 'INT/EXT';
        if (/^(INT\.|INT |INTERIOR)/i.test(upper)) return 'INT';
        if (/^(EXT\.|EXT |EXTERIOR)/i.test(upper)) return 'EXT';

        return 'INT'; // Default
    },

    /**
     * Parse time of day from heading
     * @param {string} heading - The scene heading
     * @returns {string} - 'DAY', 'NIGHT', 'CONTINUOUS', etc.
     */
    parseTimeOfDay(heading) {
        const patterns = this.config.timePatterns;

        if (patterns.continuous.test(heading)) return 'CONTINUOUS';
        if (patterns.later.test(heading)) return 'LATER';
        if (patterns.night.test(heading)) return 'NIGHT';
        if (patterns.day.test(heading)) return 'DAY';

        return 'DAY'; // Default
    },

    /**
     * Parse location from scene heading
     * @param {string} heading - The scene heading
     * @returns {string} - The location
     */
    parseLocation(heading) {
        // Remove the INT./EXT. prefix
        let location = heading.replace(/^(INT\.|INT |EXT\.|EXT |INTERIOR\s|EXTERIOR\s|INT\.\/EXT\.|INT\/EXT\s?|I\/E\.?\s?)/i, '');

        // Remove time of day suffix
        location = location.replace(/\s*[-–—]\s*(DAY|NIGHT|MORNING|AFTERNOON|EVENING|DUSK|DAWN|CONTINUOUS|CONT'?D?|LATER|MOMENTS LATER|SAME|SUNRISE|NOON|MIDNIGHT)\s*$/i, '');

        return location.trim();
    },

    /**
     * Detect all scenes in the script text
     * @param {string} text - The script text
     * @returns {Array} - Array of scene objects
     */
    detectScenes(text) {
        const lines = text.split(/\r?\n/);
        const scenes = [];
        let sceneNumber = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (this.isSceneHeading(line)) {
                sceneNumber++;

                // Try to extract scene number if present (e.g., "1. INT. HOUSE")
                let heading = line;
                let extractedNumber = null;

                const numberMatch = line.match(/^(\d+[A-Z]?)[\.\)\s]+(.+)/);
                if (numberMatch) {
                    extractedNumber = numberMatch[1];
                    heading = numberMatch[2];
                }

                scenes.push({
                    index: sceneNumber - 1,
                    number: extractedNumber || sceneNumber.toString(),
                    heading: heading,
                    type: this.parseSceneType(heading),
                    timeOfDay: this.parseTimeOfDay(heading),
                    location: this.parseLocation(heading),
                    characters: [],
                    lineIndex: i,
                    status: 'pending' // pending, partial, complete
                });
            }
        }

        return scenes;
    },

    // ============================================
    // CHARACTER EXTRACTION
    // ============================================

    /**
     * Check if a name should be excluded
     * @param {string} name - The name to check
     * @returns {boolean}
     */
    isExcludedName(name) {
        const normalized = name.trim().toUpperCase();
        return this.config.excludedNames.has(normalized);
    },

    /**
     * Check if a line looks like a character name (dialogue cue)
     * @param {string} line - The line to check
     * @param {string} nextLine - The next line (for context)
     * @returns {string|null} - The character name or null
     */
    extractCharacterName(line, nextLine = '') {
        const trimmed = line.trim();

        // Must be reasonably short (character cues are typically short)
        if (trimmed.length < 2 || trimmed.length > 50) return null;

        // Must be mostly uppercase
        const upperCount = (trimmed.match(/[A-Z]/g) || []).length;
        const letterCount = (trimmed.match(/[A-Za-z]/g) || []).length;
        if (letterCount === 0 || upperCount / letterCount < 0.8) return null;

        // Check against character pattern
        const match = trimmed.match(this.config.characterPattern);
        if (!match) return null;

        let name = match[1].trim();

        // Remove common suffixes
        name = name.replace(/\s*(CONT'?D?|CONTINUED|V\.?O\.?|O\.?S\.?|O\.?C\.?)$/i, '').trim();

        // Check exclusions
        if (this.isExcludedName(name)) return null;

        // Must have at least 2 characters
        if (name.length < 2) return null;

        // Shouldn't be all numbers or punctuation
        if (!/[A-Z]/.test(name)) return null;

        return name;
    },

    /**
     * Extract all character names from the script
     * @param {string} text - The script text
     * @param {Array} scenes - The detected scenes
     * @returns {Map} - Map of character names to their data
     */
    extractCharacters(text, scenes) {
        const lines = text.split(/\r?\n/);
        const characterOccurrences = new Map(); // name -> { count, scenes: Set }

        let currentSceneIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const nextLine = lines[i + 1] || '';

            // Update current scene
            const sceneAtLine = scenes.find(s => s.lineIndex === i);
            if (sceneAtLine) {
                currentSceneIndex = sceneAtLine.index;
            }

            // Try to extract character name
            const characterName = this.extractCharacterName(line, nextLine);

            if (characterName) {
                if (!characterOccurrences.has(characterName)) {
                    characterOccurrences.set(characterName, {
                        name: characterName,
                        count: 0,
                        scenes: new Set()
                    });
                }

                const data = characterOccurrences.get(characterName);
                data.count++;
                if (currentSceneIndex >= 0) {
                    data.scenes.add(currentSceneIndex);
                }
            }
        }

        // Filter by minimum occurrences and convert to array
        const characters = [];
        characterOccurrences.forEach((data, name) => {
            if (data.count >= this.config.minCharacterOccurrences) {
                characters.push({
                    name: name,
                    normalizedName: this.normalizeName(name),
                    occurrences: data.count,
                    sceneIndices: Array.from(data.scenes).sort((a, b) => a - b),
                    sceneCount: data.scenes.size,
                    selected: true // Default to selected
                });
            }
        });

        // Sort by occurrence count (most common first)
        characters.sort((a, b) => b.occurrences - a.occurrences);

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
     * @param {string} s1 - First string
     * @param {string} s2 - Second string
     * @returns {number}
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
     * Check if one name is contained in another
     * @param {string} name1 - First name
     * @param {string} name2 - Second name
     * @returns {boolean}
     */
    isNameContained(name1, name2) {
        const n1 = this.normalizeName(name1);
        const n2 = this.normalizeName(name2);

        // Check if one is a substring of the other
        if (n1.includes(n2) || n2.includes(n1)) return true;

        // Check if they share the same first or last name
        const parts1 = n1.split(' ');
        const parts2 = n2.split(' ');

        // If one is single name and matches part of the other
        if (parts1.length === 1 && parts2.includes(parts1[0])) return true;
        if (parts2.length === 1 && parts1.includes(parts2[0])) return true;

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
                // Determine the suggested merged name (prefer longer, more complete name)
                const suggestedName = group.reduce((best, char) => {
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
     * @param {Array} characters - Original character array
     * @param {Array} duplicates - Duplicate groups
     * @param {Object} mergeDecisions - Map of group index to merged name
     * @returns {Array} - Merged character array
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
                selected: true,
                mergedFrom: group.characters.map(c => c.name)
            };

            merged.push(mergedChar);
        });

        // Re-sort by occurrence count
        merged.sort((a, b) => b.occurrences - a.occurrences);

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
            // Step 1: Extract text
            onProgress({ step: 'extracting', progress: 10 });
            const text = await this.extractText(file);

            // Step 2: Detect scenes
            onProgress({ step: 'scenes', progress: 40 });
            const scenes = this.detectScenes(text);

            // Step 3: Extract characters
            onProgress({ step: 'characters', progress: 70 });
            const characters = this.extractCharacters(text, scenes);

            // Step 4: Detect duplicates
            onProgress({ step: 'duplicates', progress: 90 });
            const duplicates = this.detectDuplicates(characters);

            onProgress({ step: 'complete', progress: 100 });

            return {
                success: true,
                scenes,
                characters,
                duplicates,
                stats: {
                    totalScenes: scenes.length,
                    totalCharacters: characters.length,
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
            { index: 7, number: '8', heading: "EXT. HOSPITAL ENTRANCE - MORNING", type: 'EXT', timeOfDay: 'DAY', location: "HOSPITAL ENTRANCE", characters: ['SARAH CHEN', 'DR. WILSON'], status: 'pending' },
            { index: 8, number: '9', heading: "INT. DR. WILSON'S OFFICE - DAY", type: 'INT', timeOfDay: 'DAY', location: "DR. WILSON'S OFFICE", characters: ['SARAH CHEN', 'DR. WILSON'], status: 'pending' },
            { index: 9, number: '10', heading: "INT. COFFEE SHOP - EVENING", type: 'INT', timeOfDay: 'NIGHT', location: "COFFEE SHOP", characters: ['SARAH CHEN', 'MIKE', 'BARISTA'], status: 'pending' },
            { index: 10, number: '11', heading: "EXT. CITY STREET - NIGHT", type: 'EXT', timeOfDay: 'NIGHT', location: "CITY STREET", characters: ['SARAH CHEN', 'MIKE'], status: 'pending' },
            { index: 11, number: '12', heading: "INT. MIKE'S APARTMENT - NIGHT", type: 'INT', timeOfDay: 'NIGHT', location: "MIKE'S APARTMENT", characters: ['MIKE'], status: 'pending' }
        ];

        const characters = [
            { name: 'SARAH CHEN', normalizedName: 'SARAH CHEN', occurrences: 24, sceneIndices: [0, 1, 2, 4, 6, 7, 8, 9, 10], sceneCount: 9, selected: true },
            { name: 'MIKE', normalizedName: 'MIKE', occurrences: 18, sceneIndices: [0, 2, 3, 4, 9, 10, 11], sceneCount: 7, selected: true },
            { name: 'DR. WILSON', normalizedName: 'DR WILSON', occurrences: 12, sceneIndices: [3, 5, 7, 8], sceneCount: 4, selected: true },
            { name: 'BARISTA', normalizedName: 'BARISTA', occurrences: 4, sceneIndices: [2, 9], sceneCount: 2, selected: true },
            { name: 'NURSE JACKSON', normalizedName: 'NURSE JACKSON', occurrences: 3, sceneIndices: [5], sceneCount: 1, selected: true }
        ];

        // Simulate a duplicate for demo
        const duplicates = [
            {
                characters: [
                    { name: 'SARAH', normalizedName: 'SARAH', occurrences: 4, sceneIndices: [1, 6], sceneCount: 2, selected: true },
                    { name: 'SARAH CHEN', normalizedName: 'SARAH CHEN', occurrences: 24, sceneIndices: [0, 1, 2, 4, 6, 7, 8, 9, 10], sceneCount: 9, selected: true }
                ],
                suggestedName: 'SARAH CHEN',
                totalScenes: 9,
                totalOccurrences: 28
            }
        ];

        return {
            success: true,
            scenes,
            characters,
            duplicates,
            stats: {
                totalScenes: scenes.length,
                totalCharacters: characters.length,
                duplicateGroups: duplicates.length
            }
        };
    }
};

// Export for global access
window.ScriptProcessor = ScriptProcessor;
