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
    // PDF TEXT EXTRACTION (Robust Position-Aware)
    // ============================================

    /**
     * Extract text fragments with X/Y positions from PDF
     * pdf.js returns text as fragments, not logical lines - we need positions to reconstruct
     * @param {File} file - The PDF file to process
     * @returns {Promise<Array>} - Array of text items with positions
     */
    async extractTextWithPositions(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        const allItems = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const viewport = page.getViewport({ scale: 1.0 });

            textContent.items.forEach(item => {
                if (item.str.trim() === '') return;  // Skip empty

                // Get position - Y is from bottom in PDF, flip it
                const x = Math.round(item.transform[4]);
                const y = Math.round(viewport.height - item.transform[5]);

                allItems.push({
                    text: item.str,
                    x: x,
                    y: y,
                    page: pageNum,
                    height: item.height || 12,
                    width: item.width || item.str.length * 6
                });
            });
        }

        return { items: allItems, numPages: pdf.numPages };
    },

    /**
     * Reconstruct logical lines from positioned text fragments
     * A single line like "INT. KITCHEN - DAY" might be 3 separate fragments
     * @param {Array} items - Text items with positions
     * @returns {Array} - Reconstructed lines with position metadata
     */
    reconstructLines(items) {
        // Sort by page, then Y (top to bottom), then X (left to right)
        items.sort((a, b) => {
            if (a.page !== b.page) return a.page - b.page;
            if (Math.abs(a.y - b.y) > 5) return a.y - b.y;  // Different lines
            return a.x - b.x;  // Same line, sort left to right
        });

        const lines = [];
        let currentLine = [];
        let lastY = null;
        let lastPage = null;

        items.forEach(item => {
            // New page or new line (Y changed by more than threshold)
            if (lastPage !== null && (item.page !== lastPage || Math.abs(item.y - lastY) > 8)) {
                if (currentLine.length > 0) {
                    lines.push(this.buildLine(currentLine));
                }
                currentLine = [];
            }

            currentLine.push(item);
            lastY = item.y;
            lastPage = item.page;
        });

        // Don't forget last line
        if (currentLine.length > 0) {
            lines.push(this.buildLine(currentLine));
        }

        return lines;
    },

    /**
     * Build a single line from text fragments with proper spacing
     * @param {Array} items - Text fragments that form one line
     * @returns {Object} - Line object with text and position metadata
     */
    buildLine(items) {
        // Sort items left to right
        items.sort((a, b) => a.x - b.x);

        // Calculate average X position (helps detect centered text like character names)
        const avgX = items.reduce((sum, i) => sum + i.x, 0) / items.length;

        // Join with appropriate spacing
        let text = '';
        let lastEndX = 0;

        items.forEach((item, idx) => {
            if (idx > 0) {
                const gap = item.x - lastEndX;
                if (gap > 20) {
                    text += '   ';  // Large gap = intentional spacing (like tab)
                } else if (gap > 3) {
                    text += ' ';    // Normal word spacing
                }
                // else no space - fragments of same word
            }
            text += item.text;
            lastEndX = item.x + item.width;
        });

        return {
            text: text.trim(),
            x: items[0].x,      // Leftmost X
            avgX: avgX,         // Average X (for detecting centered text)
            y: items[0].y,
            page: items[0].page
        };
    },

    /**
     * Analyze screenplay structure based on indentation patterns
     * Screenplays have consistent indentation for different elements
     * @param {Array} lines - Reconstructed lines with positions
     * @returns {Object} - Structure analysis with detection functions
     */
    analyzeStructure(lines) {
        // Find the most common X positions to detect margins
        const xCounts = {};
        lines.forEach(line => {
            const roundedX = Math.round(line.x / 10) * 10;  // Round to nearest 10
            xCounts[roundedX] = (xCounts[roundedX] || 0) + 1;
        });

        // Sort by frequency
        const commonX = Object.entries(xCounts)
            .sort((a, b) => b[1] - a[1])
            .map(e => parseInt(e[0]));

        // Typically: leftMargin is most common (action), then dialogue indent, then character center
        const leftMargin = commonX[0] || 70;

        return {
            leftMargin,
            // Character names are usually centered (X > 180 and line is ALL CAPS)
            isCharacterName: (line) => {
                return line.x > leftMargin + 80 &&
                       /^[A-Z][A-Z\s\-'\.]+(\s*\(.*\))?$/.test(line.text);
            },
            // Scene headings start with INT./EXT. at left margin
            isSceneHeading: (line) => {
                return line.x < leftMargin + 30 &&
                       /^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)/.test(line.text);
            }
        };
    },

    /**
     * Convert reconstructed lines to clean text for parsing
     * @param {Array} lines - Reconstructed lines
     * @returns {string} - Clean text with proper line breaks
     */
    toCleanText(lines) {
        return lines.map(l => l.text).join('\n');
    },

    /**
     * Check if PDF is scanned/image-based
     * @param {Array} items - Extracted text items
     * @param {number} numPages - Number of pages in PDF
     * @returns {Object} - Detection result with message if scanned
     */
    checkIfScanned(items, numPages) {
        // If very few text items relative to page count, probably scanned
        const textDensity = items.length / numPages;

        if (textDensity < 50) {  // Normal script has 200+ items per page
            return {
                isScanned: true,
                message: 'This PDF appears to be scanned or image-based. Text cannot be extracted. Please use a text-based PDF exported directly from screenwriting software (Final Draft, Highland, Fade In, etc.), or paste the script text manually.'
            };
        }

        return { isScanned: false };
    },

    /**
     * Full PDF extraction pipeline with robust text reconstruction
     * @param {File} file - The PDF file to process
     * @returns {Promise<Object>} - Extraction result with text and metadata
     */
    async extractScriptFromPDF(file) {
        try {
            // Step 1: Extract fragments with positions
            const { items, numPages } = await this.extractTextWithPositions(file);

            if (items.length === 0) {
                throw new Error('No text found in PDF. The file may be scanned/image-based.');
            }

            // Step 2: Check if scanned
            const scanCheck = this.checkIfScanned(items, numPages);
            if (scanCheck.isScanned) {
                throw new Error(scanCheck.message);
            }

            // Step 3: Reconstruct lines
            const lines = this.reconstructLines(items);

            // Step 4: Analyze structure (for future use/debugging)
            const structure = this.analyzeStructure(lines);

            // Step 5: Convert to clean text
            const cleanText = this.toCleanText(lines);

            // Additional validation
            if (cleanText.trim().length < this.config.minTextLength) {
                throw new Error('Very little text was extracted from this PDF. It may be corrupted, password-protected, or image-based.');
            }

            return {
                success: true,
                text: cleanText,
                lines: lines,
                structure: structure,
                stats: {
                    pages: numPages,
                    fragments: items.length,
                    lines: lines.length
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                suggestion: 'Try pasting the script text directly, or export as .fountain from your screenwriting software.'
            };
        }
    },

    /**
     * Legacy wrapper for backward compatibility
     * @param {File} file - The PDF file to process
     * @returns {Promise<string>} - The extracted text
     */
    async extractTextFromPDF(file) {
        const result = await this.extractScriptFromPDF(file);

        if (!result.success) {
            throw new Error(result.error);
        }

        return result.text;
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
    // EXTRACTION VALIDATION & OCR FALLBACK
    // ============================================

    /**
     * Validate extraction results to determine if OCR fallback is needed
     * @param {string} text - Extracted text
     * @param {Array} scenes - Detected scenes
     * @returns {Object} - Validation result with confidence score
     */
    validateExtraction(text, scenes) {
        const issues = [];

        // Check 1: Do we have enough text?
        if (!text || text.length < 500) {
            issues.push('Very little text extracted');
        }

        // Check 2: Did we find any scenes?
        if (!scenes || scenes.length === 0) {
            issues.push('No scene headings found');
        }

        // Check 3: Do scenes have reasonable content?
        if (scenes && scenes.length > 0) {
            const avgContentLength = scenes.reduce((sum, s) => {
                const contentLen = Array.isArray(s.content) ? s.content.join('\n').length : 0;
                return sum + contentLen;
            }, 0) / scenes.length;
            if (avgContentLength < 100) {
                issues.push('Scenes have very little content');
            }
        }

        // Check 4: Did we find characters?
        if (scenes && scenes.length > 0) {
            const totalCharacters = [...new Set(scenes.flatMap(s => s.characters || []))].length;
            if (totalCharacters === 0) {
                issues.push('No characters detected');
            }
        }

        // Check 5: Is the text garbled? (Look for too many special chars or no spaces)
        if (text && text.length > 0) {
            const alphaRatio = (text.match(/[a-zA-Z]/g) || []).length / text.length;
            if (alphaRatio < 0.5) {
                issues.push('Text appears garbled');
            }
        }

        // Check 6: Does it have screenplay markers?
        if (text) {
            const hasScreenplayMarkers = /INT\.|EXT\.|FADE IN|CUT TO/i.test(text);
            if (!hasScreenplayMarkers) {
                issues.push('No screenplay formatting detected');
            }
        }

        return {
            isValid: issues.length === 0,
            confidence: Math.max(0, 100 - (issues.length * 20)),  // Rough confidence score
            issues: issues
        };
    },

    /**
     * Lazy load an external script
     * @param {string} src - Script URL
     * @returns {Promise} - Resolves when script is loaded
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    },

    /**
     * Clean OCR text by fixing common misreads
     * @param {string} text - Raw OCR text
     * @returns {string} - Cleaned text
     */
    cleanOCRText(text) {
        return text
            // Fix common OCR misreads for screenplay terms
            .replace(/lNT\./g, 'INT.')
            .replace(/1NT\./g, 'INT.')
            .replace(/EX T\./g, 'EXT.')
            .replace(/EXT\s*\./g, 'EXT.')
            .replace(/\|/g, 'I')
            // Fix spacing issues
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            // Fix common character name issues
            .replace(/([A-Z]{2,})\s*\n\s*([A-Z]{2,})/g, '$1 $2')  // Broken names
            .trim();
    },

    /**
     * Extract text from PDF using OCR (Tesseract.js)
     * Used as fallback when text extraction fails or produces poor results
     * @param {File} file - The PDF file
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<string>} - OCR extracted text
     */
    async extractTextViaOCR(file, onProgress) {
        // Lazy load Tesseract if not already loaded
        if (!window.Tesseract) {
            onProgress?.({ step: 'ocr_loading', message: 'Loading OCR engine...' });
            await this.loadScript('https://unpkg.com/tesseract.js@4/dist/tesseract.min.js');
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        onProgress?.({ step: 'ocr_init', message: 'Initializing OCR...' });

        const worker = await Tesseract.createWorker('eng');
        await worker.setParameters({
            tessedit_pageseg_mode: '6',  // Assume uniform block of text
            preserve_interword_spaces: '1'
        });

        const allText = [];
        const totalPages = pdf.numPages;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const progress = Math.round((pageNum / totalPages) * 100);
            onProgress?.({
                step: 'ocr_page',
                message: `OCR: Reading page ${pageNum} of ${totalPages}...`,
                progress: progress,
                currentPage: pageNum,
                totalPages: totalPages
            });

            const page = await pdf.getPage(pageNum);
            const scale = 2.0;  // Higher scale = better OCR accuracy
            const viewport = page.getViewport({ scale });

            // Create canvas for rendering
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');

            // Render page to canvas
            await page.render({ canvasContext: ctx, viewport }).promise;

            // Run OCR on canvas
            const { data: { text } } = await worker.recognize(canvas);
            allText.push(text);

            // Clean up canvas
            canvas.remove();
        }

        await worker.terminate();

        return this.cleanOCRText(allText.join('\n\n'));
    },

    /**
     * Smart hybrid PDF import - tries text extraction first, falls back to OCR
     * @param {File} file - The PDF file
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Object>} - Import result with method used
     */
    async importPDFScript(file, onProgress) {
        const startTime = Date.now();

        // =====================
        // STEP 1: Try text extraction first (FAST)
        // =====================
        onProgress?.({
            step: 'text_extract',
            message: 'Extracting text...',
            progress: 10
        });

        let textResult;
        try {
            textResult = await this.extractScriptFromPDF(file);
        } catch (e) {
            textResult = { success: false, error: e.message };
        }

        if (textResult.success) {
            // Parse scenes from extracted text
            const scenes = this.detectScenes(textResult.text);
            const characters = this.extractCharacters(textResult.text, scenes);

            // Assign characters to scenes
            characters.forEach(char => {
                char.sceneIndices.forEach(sceneIndex => {
                    const scene = scenes[sceneIndex];
                    if (scene && !scene.characters.includes(char.name)) {
                        scene.characters.push(char.name);
                    }
                });
            });

            const validation = this.validateExtraction(textResult.text, scenes);

            if (validation.isValid || validation.confidence >= 60) {
                // Text extraction worked well enough
                console.log(`Text extraction succeeded (${Date.now() - startTime}ms, confidence: ${validation.confidence}%)`);

                return {
                    success: true,
                    method: 'text',
                    scenes: scenes,
                    characters: characters,
                    duplicates: this.detectDuplicates(characters),
                    rawText: textResult.text,
                    confidence: validation.confidence,
                    processingTime: Date.now() - startTime,
                    stats: {
                        ...textResult.stats,
                        totalScenes: scenes.length,
                        totalCharacters: characters.length
                    }
                };
            } else {
                console.log(`Text extraction quality poor: ${validation.issues.join(', ')}`);
                onProgress?.({
                    step: 'text_failed',
                    message: `Text extraction: Low quality (${validation.issues.join(', ')})`,
                    progress: 20
                });
            }
        } else {
            onProgress?.({
                step: 'text_failed',
                message: `Text extraction failed: ${textResult.error}`,
                progress: 20
            });
        }

        // =====================
        // STEP 2: Fall back to OCR (SLOWER but reliable)
        // =====================
        onProgress?.({
            step: 'ocr_start',
            message: 'Text extraction insufficient. Switching to OCR...',
            progress: 25
        });

        try {
            const ocrText = await this.extractTextViaOCR(file, onProgress);
            const ocrScenes = this.detectScenes(ocrText);
            const ocrCharacters = this.extractCharacters(ocrText, ocrScenes);

            // Assign characters to scenes
            ocrCharacters.forEach(char => {
                char.sceneIndices.forEach(sceneIndex => {
                    const scene = ocrScenes[sceneIndex];
                    if (scene && !scene.characters.includes(char.name)) {
                        scene.characters.push(char.name);
                    }
                });
            });

            const ocrValidation = this.validateExtraction(ocrText, ocrScenes);

            if (ocrScenes.length === 0) {
                throw new Error('OCR could not detect scene headings. This may not be a screenplay.');
            }

            console.log(`OCR succeeded (${Date.now() - startTime}ms, confidence: ${ocrValidation.confidence}%)`);

            return {
                success: true,
                method: 'ocr',
                scenes: ocrScenes,
                characters: ocrCharacters,
                duplicates: this.detectDuplicates(ocrCharacters),
                rawText: ocrText,
                confidence: ocrValidation.confidence,
                processingTime: Date.now() - startTime,
                stats: {
                    totalScenes: ocrScenes.length,
                    totalCharacters: ocrCharacters.length
                },
                warnings: ocrValidation.issues.length > 0 ? ocrValidation.issues : null
            };

        } catch (ocrError) {
            // Both methods failed
            const processingTime = Date.now() - startTime;
            console.error('Both text extraction and OCR failed:', ocrError);

            return {
                success: false,
                error: 'Could not read this PDF',
                details: `Text extraction: ${textResult?.error || 'Low quality'}. OCR: ${ocrError.message}`,
                suggestion: 'Please try pasting the script text directly, or export as .fountain from your screenwriting software.',
                processingTime: processingTime
            };
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
     * Process a script file completely with robust PDF extraction
     * @param {File} file - The script file
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Object>} - Processing results
     */
    async processScript(file, onProgress = () => {}) {
        try {
            const extension = file.name.split('.').pop().toLowerCase();

            // For PDFs, use hybrid import with OCR fallback
            if (extension === 'pdf') {
                onProgress({ step: 'extracting', progress: 10, message: 'Extracting text from PDF...' });

                // Use hybrid import - tries text extraction first, falls back to OCR
                const importResult = await this.importPDFScript(file, (progress) => {
                    // Map hybrid import progress to standard progress format
                    if (progress.step === 'text_extract') {
                        onProgress({ step: 'extracting', progress: 15, message: 'Extracting text...' });
                    } else if (progress.step === 'text_failed') {
                        onProgress({ step: 'extracting', progress: 20, message: progress.message });
                    } else if (progress.step === 'ocr_loading') {
                        onProgress({ step: 'ocr', progress: 25, message: 'Loading OCR engine...' });
                    } else if (progress.step === 'ocr_init') {
                        onProgress({ step: 'ocr', progress: 30, message: 'Initializing OCR...' });
                    } else if (progress.step === 'ocr_start') {
                        onProgress({ step: 'ocr', progress: 30, message: 'Text quality low. Switching to OCR...' });
                    } else if (progress.step === 'ocr_page') {
                        // Map OCR page progress (0-100) to our range (30-85)
                        const mappedProgress = 30 + Math.round((progress.progress / 100) * 55);
                        onProgress({
                            step: 'ocr',
                            progress: mappedProgress,
                            message: progress.message,
                            currentPage: progress.currentPage,
                            totalPages: progress.totalPages
                        });
                    }
                });

                if (!importResult.success) {
                    return {
                        success: false,
                        error: importResult.error,
                        details: importResult.details,
                        suggestion: importResult.suggestion,
                        errorType: 'extraction',
                        processingTime: importResult.processingTime
                    };
                }

                // Hybrid import already detected scenes and characters
                onProgress({ step: 'duplicates', progress: 90, message: 'Checking for duplicates...' });

                onProgress({ step: 'complete', progress: 100, message: 'Analysis complete!' });

                // Categorize characters by confidence
                const highConfidence = importResult.characters.filter(c => c.confidence >= 0.7);
                const mediumConfidence = importResult.characters.filter(c => c.confidence >= 0.4 && c.confidence < 0.7);
                const lowConfidence = importResult.characters.filter(c => c.confidence < 0.4);

                // Build warnings for potential issues
                const warnings = importResult.warnings || [];
                if (importResult.characters.length === 0) {
                    warnings.push('No characters were detected. You may need to add them manually.');
                } else if (importResult.characters.length < 3) {
                    warnings.push(`Only ${importResult.characters.length} character(s) found. Some may have been missed.`);
                }
                if (lowConfidence.length > highConfidence.length) {
                    warnings.push('Many low-confidence character detections. Review the list carefully.');
                }
                if (importResult.method === 'ocr') {
                    warnings.push('OCR was used - please review for any misread text.');
                }

                return {
                    success: true,
                    scenes: importResult.scenes,
                    characters: importResult.characters,
                    duplicates: importResult.duplicates,
                    rawText: importResult.rawText,
                    method: importResult.method,  // 'text' or 'ocr'
                    confidence: importResult.confidence,
                    processingTime: importResult.processingTime,
                    stats: {
                        ...importResult.stats,
                        highConfidenceCount: highConfidence.length,
                        mediumConfidenceCount: mediumConfidence.length,
                        lowConfidenceCount: lowConfidence.length,
                        duplicateGroups: importResult.duplicates.length
                    },
                    warnings: warnings.length > 0 ? warnings : null
                };
            }

            // For text files, use simple extraction
            onProgress({ step: 'extracting', progress: 10, message: 'Reading text file...' });
            const text = await this.extractTextFromFile(file);

            // Step 2: Detect scenes using pattern matching
            onProgress({ step: 'scenes', progress: 40, message: 'Detecting scenes...' });
            const scenes = this.detectScenes(text);

            if (scenes.length === 0) {
                return {
                    success: false,
                    error: 'No scene headings (INT./EXT.) detected. Is this a properly formatted screenplay?',
                    suggestion: 'Ensure your script uses standard scene headings like "INT. LOCATION - DAY" or "EXT. LOCATION - NIGHT".',
                    errorType: 'no_scenes',
                    rawText: text
                };
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

            // Build warnings for potential issues
            const warnings = [];
            if (characters.length === 0) {
                warnings.push('No characters were detected. You may need to add them manually.');
            } else if (characters.length < 3) {
                warnings.push(`Only ${characters.length} character(s) found. Some may have been missed.`);
            }
            if (lowConfidence.length > highConfidence.length) {
                warnings.push('Many low-confidence character detections. Review the list carefully.');
            }

            return {
                success: true,
                scenes,
                characters,
                duplicates,
                rawText: text,
                method: 'text',
                stats: {
                    totalScenes: scenes.length,
                    totalCharacters: characters.length,
                    highConfidenceCount: highConfidence.length,
                    mediumConfidenceCount: mediumConfidence.length,
                    lowConfidenceCount: lowConfidence.length,
                    duplicateGroups: duplicates.length
                },
                warnings: warnings.length > 0 ? warnings : null
            };
        } catch (error) {
            console.error('Script processing error:', error);

            let suggestion = 'Try pasting the script text directly, or export as .fountain from your screenwriting software.';

            if (error.message.includes('password')) {
                suggestion = 'This PDF may be password-protected. Please remove the password protection and try again.';
            }

            return {
                success: false,
                error: error.message,
                suggestion: suggestion
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
