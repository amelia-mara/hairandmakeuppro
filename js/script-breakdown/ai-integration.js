/**
 * ai-integration.js
 * AI integration for auto-generating breakdowns, synopses, and detecting elements
 *
 * Provides:
 * - Universal AI API caller (OpenAI, Anthropic, serverless)
 * - Settings management (API keys, provider selection)
 * - Scene synopsis generation
 * - Element detection (cast, hair, makeup, SFX)
 * - Character introduction detection
 * - Look state suggestions
 */

import { state } from './main.js';

// ============================================================================
// API USAGE TRACKING
// ============================================================================

/**
 * API Usage Tracker
 * Tracks API calls, errors, and rate limits for debugging
 */
const apiUsageTracker = {
    calls: 0,
    errors: 0,
    rateLimits: 0,
    lastCall: null,

    logCall() {
        this.calls++;
        this.lastCall = new Date();
        this.saveToStorage();
        this.updateDisplay();
    },

    logError() {
        this.errors++;
        this.saveToStorage();
        this.updateDisplay();
    },

    logRateLimit() {
        this.rateLimits++;
        this.saveToStorage();
        this.updateDisplay();
    },

    reset() {
        this.calls = 0;
        this.errors = 0;
        this.rateLimits = 0;
        this.lastCall = null;
        this.saveToStorage();
        this.updateDisplay();
    },

    saveToStorage() {
        localStorage.setItem('apiUsageTracker', JSON.stringify({
            calls: this.calls,
            errors: this.errors,
            rateLimits: this.rateLimits,
            lastCall: this.lastCall
        }));
    },

    loadFromStorage() {
        const saved = localStorage.getItem('apiUsageTracker');
        if (saved) {
            const data = JSON.parse(saved);
            Object.assign(this, data);
        }
    },

    getStats() {
        return {
            totalCalls: this.calls,
            totalErrors: this.errors,
            totalRateLimits: this.rateLimits,
            lastCall: this.lastCall ? new Date(this.lastCall).toLocaleString() : 'Never'
        };
    },

    updateDisplay() {
        // Update UI elements
        const callsEl = document.getElementById('stat-calls');
        const errorsEl = document.getElementById('stat-errors');
        const rateLimitsEl = document.getElementById('stat-rate-limits');
        const lastCallEl = document.getElementById('stat-last-call');

        if (callsEl) callsEl.textContent = this.calls;
        if (errorsEl) errorsEl.textContent = this.errors;
        if (rateLimitsEl) rateLimitsEl.textContent = this.rateLimits;
        if (lastCallEl) lastCallEl.textContent = this.lastCall ? new Date(this.lastCall).toLocaleString() : 'Never';
    }
};

// Load saved stats on initialization
apiUsageTracker.loadFromStorage();

// Expose globally
window.apiUsageTracker = apiUsageTracker;

/**
 * Show error notification to user
 */
function showErrorNotification(message) {
    const notification = document.getElementById('error-notification');
    const messageEl = document.getElementById('error-message');

    if (!notification || !messageEl) {
        console.warn('Error notification elements not found');
        return;
    }

    messageEl.textContent = message;
    notification.style.display = 'block';

    // Auto-hide after 10 seconds
    setTimeout(() => {
        closeErrorNotification();
    }, 10000);
}

/**
 * Close error notification
 */
function closeErrorNotification() {
    const notification = document.getElementById('error-notification');
    if (notification) {
        notification.style.display = 'none';
    }
}

// Expose globally for HTML onclick
window.closeErrorNotification = closeErrorNotification;

/**
 * Reset API usage statistics
 */
function resetAPIUsage() {
    if (confirm('Reset API usage statistics?')) {
        apiUsageTracker.reset();
        showToast('API usage stats reset', 'success');
    }
}

// Expose globally
window.resetAPIUsage = resetAPIUsage;

/**
 * Show API limit help based on current provider
 */
function showAPILimitHelp() {
    const provider = state.aiProvider || localStorage.getItem('aiProvider') || 'openai';

    let helpText = '';
    if (provider === 'openai') {
        helpText = `Check your OpenAI usage and rate limits:

1. Go to: https://platform.openai.com/usage
2. Click "Rate limits" tab to see your current tier
3. Check requests per minute (RPM) and tokens per minute (TPM)

FREE TIER LIMITS:
- Very limited (3 requests/minute for GPT-4)
- Upgrade to at least Tier 1 ($5+ usage) for better limits

COMMON RATE LIMITS BY TIER:
- Tier 1: 500 RPM, 30K TPM (GPT-4)
- Tier 2: 5,000 RPM, 450K TPM (GPT-4)
- Tier 3: 10,000 RPM, 10M TPM (GPT-4)

TIP: If you're hitting rate limits, the app will automatically retry with exponential backoff.`;
    } else if (provider === 'anthropic') {
        helpText = `Check your Anthropic (Claude) usage and rate limits:

1. Go to: https://console.anthropic.com/settings/limits
2. View your rate limits for your current tier
3. Check your billing plan

RATE LIMITS DEPEND ON TIER:
- Free tier: Very limited
- Build tier: 50 requests/minute
- Scale tier: Custom limits

TIP: Anthropic has generous rate limits on paid tiers. The app will automatically retry with exponential backoff if you hit limits.`;
    }

    alert(helpText);
}

// Expose globally
window.showAPILimitHelp = showAPILimitHelp;

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// AI SETTINGS MANAGEMENT
// ============================================================================

/**
 * Open AI settings modal
 */
export function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    // Load Anthropic settings
    const anthropicKey = localStorage.getItem('anthropicApiKey') || localStorage.getItem('apiKey') || '';
    const anthropicKeyInput = document.getElementById('anthropic-api-key');
    if (anthropicKeyInput) anthropicKeyInput.value = anthropicKey;

    const anthropicModelSelect = document.getElementById('anthropic-model');
    if (anthropicModelSelect) anthropicModelSelect.value = state.anthropicModel;

    modal.style.display = 'flex';
}

/**
 * Close AI settings modal
 */
export function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
}

/**
 * Save AI settings
 */
export function saveSettings() {
    // Always use Anthropic
    state.aiProvider = 'anthropic';
    localStorage.setItem('aiProvider', 'anthropic');

    // Save Anthropic settings
    const anthropicKeyInput = document.getElementById('anthropic-api-key');
    const anthropicModelSelect = document.getElementById('anthropic-model');

    const anthropicKey = anthropicKeyInput ? anthropicKeyInput.value : '';
    const anthropicModel = anthropicModelSelect ? anthropicModelSelect.value : 'claude-sonnet-4-20250514';

    state.anthropicModel = anthropicModel;
    state.apiKey = anthropicKey;

    localStorage.setItem('anthropicApiKey', anthropicKey);
    localStorage.setItem('anthropicModel', anthropicModel);
    localStorage.setItem('apiKey', anthropicKey);

    showToast('AI settings saved successfully', 'success');
    closeSettingsModal();
}

/**
 * Toggle provider-specific settings visibility
 */
export function toggleProviderSettings() {
    // No-op - only Anthropic/Claude is used
}

/**
 * Test API connection
 */
export async function testAPIConnection() {
    const anthropicKeyInput = document.getElementById('anthropic-api-key');
    const anthropicModelSelect = document.getElementById('anthropic-model');

    const apiKey = anthropicKeyInput ? anthropicKeyInput.value : '';
    const model = anthropicModelSelect ? anthropicModelSelect.value : 'claude-sonnet-4-20250514';

    if (!apiKey) {
        showToast('Please enter an API key first', 'warning');
        return;
    }

    // Temporarily update state for test
    const oldKey = state.apiKey;
    const oldAnthropicModel = state.anthropicModel;

    state.aiProvider = 'anthropic';
    state.apiKey = apiKey;
    state.anthropicModel = model;

    try {
        showToast('Testing connection...', 'info');
        const response = await callAI('Respond with exactly: "Connection successful"', 50);

        if (response && response.toLowerCase().includes('successful')) {
            showToast('Claude API connected successfully!', 'success');
        } else {
            showToast('API responded but format unexpected', 'warning');
        }
    } catch (error) {
        showToast(`Connection failed: ${error.message}`, 'error');
        console.error('API test error:', error);
    }

    // Restore original state
    state.apiKey = oldKey;
    state.anthropicModel = oldAnthropicModel;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast-notification');
    existingToasts.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        font-size: 0.9em;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================================================
// AI API CALLER WITH ERROR HANDLING & RETRY LOGIC
// ============================================================================

/**
 * Universal AI caller with comprehensive error logging and retry logic
 * Supports: Serverless API, OpenAI, Anthropic
 */
export async function callAI(prompt, maxTokens = 500, sceneNumber = null) {
    return await callAIWithRetry(prompt, maxTokens, sceneNumber, 3);
}

/**
 * Call AI with retry logic and exponential backoff
 */
async function callAIWithRetry(prompt, maxTokens, sceneNumber, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const sceneLabel = sceneNumber !== null ? `Scene ${sceneNumber}` : 'Request';
            console.log(`🔄 Attempt ${attempt}/${maxRetries} for ${sceneLabel}`);

            const result = await callAIInternal(prompt, maxTokens, sceneNumber);

            // Success! Log and return
            apiUsageTracker.logCall();
            return result;

        } catch (error) {
            lastError = error;

            // Check if this is a rate limit error
            const isRateLimit = error.message.includes('429') ||
                              error.message.includes('rate limit') ||
                              error.message.includes('Rate limit');

            const isAuthError = error.message.includes('401') ||
                              error.message.includes('403') ||
                              error.message.includes('authentication') ||
                              error.message.includes('Invalid API key');

            // Log the error
            apiUsageTracker.logError();

            if (isRateLimit) {
                apiUsageTracker.logRateLimit();
                const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                console.warn(`⏳ Rate limited. Waiting ${waitTime}ms before retry...`);

                const sceneLabel = sceneNumber !== null ? `Scene ${sceneNumber}` : 'Request';
                showErrorNotification(`Rate limited on ${sceneLabel}. Retrying in ${waitTime/1000}s...`);

                await sleep(waitTime);
                continue; // Retry
            }

            // If auth error, don't retry
            if (isAuthError) {
                console.error('🔑 AUTHENTICATION FAILED');
                showErrorNotification('Invalid API key. Check AI Settings.');
                throw error; // Don't retry
            }

            // For other errors, short wait and retry
            if (attempt < maxRetries) {
                console.warn(`⏳ Error occurred. Retrying in 2s...`);
                await sleep(2000);
                continue; // Retry
            }
        }
    }

    // All retries failed
    const sceneLabel = sceneNumber !== null ? `Scene ${sceneNumber}` : 'Request';
    console.error(`❌ All ${maxRetries} attempts failed for ${sceneLabel}`);
    showErrorNotification(`All retries failed for ${sceneLabel}: ${lastError.message}`);
    throw lastError;
}

/**
 * Internal AI caller with detailed logging - Claude/Anthropic only
 */
async function callAIInternal(prompt, maxTokens, sceneNumber) {
    const sceneLabel = sceneNumber !== null ? `Scene ${sceneNumber}` : 'Request';
    console.log(`🤖 AI Call Started - ${sceneLabel}`);
    console.log(`   Provider: anthropic`);
    console.log(`   Model: ${state.anthropicModel || 'claude-sonnet-4-20250514'}`);
    console.log(`   Max Tokens: ${maxTokens}`);

    // For deployed Vercel version - use secure serverless function
    if (window.location.hostname.includes('vercel.app')) {
        try {
            const response = await fetch("/api/ai", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    messages: [{
                        role: "user",
                        content: prompt
                    }],
                    maxTokens: maxTokens,
                    model: state.anthropicModel || 'claude-sonnet-4-20250514'
                })
            });

            console.log(`📡 Response Status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ API Error (${sceneLabel}):`, errorText);

                if (response.status === 429) {
                    console.error('🚫 RATE LIMIT HIT');
                    throw new Error(`Rate limit exceeded. Status: 429`);
                }

                if (response.status === 401 || response.status === 403) {
                    console.error('🔑 AUTHENTICATION FAILED');
                    throw new Error(`Invalid API key. Status: ${response.status}`);
                }

                throw new Error(`API Error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();

            // Extract text from Anthropic response format
            if (data.content && data.content[0] && data.content[0].text) {
                console.log(`✅ AI Call Success - ${sceneLabel}`);
                return data.content[0].text;
            }

            throw new Error('Invalid response format from API');

        } catch (error) {
            console.error(`💥 Exception in AI call (${sceneLabel}):`, error);
            throw error;
        }
    }

    // For local testing with API key
    if (!state.apiKey) {
        const error = new Error('No API key set. Please configure AI settings first or deploy to Vercel with serverless function.');
        console.error('❌ No API key configured');
        showErrorNotification('No API key configured. Open AI Settings to add your key.');
        throw error;
    }

    // Anthropic Claude API
    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": state.apiKey,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: state.anthropicModel || "claude-sonnet-4-20250514",
                max_tokens: maxTokens,
                temperature: 0.3,
                messages: [{
                    role: "user",
                    content: prompt
                }]
            })
        });

        console.log(`📡 Response Status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Anthropic API Error (${sceneLabel}):`, errorText);

            if (response.status === 429) {
                console.error('🚫 RATE LIMIT HIT');
                throw new Error(`Rate limit exceeded. Status: 429`);
            }

            if (response.status === 401) {
                console.error('🔑 AUTHENTICATION FAILED');
                throw new Error(`Invalid API key. Status: 401`);
            }

            throw new Error(`Anthropic API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (!data.content || !data.content[0]) {
            throw new Error('Invalid response format from Anthropic');
        }

        console.log(`✅ AI Call Success - ${sceneLabel}`);
        return data.content[0].text;

    } catch (error) {
        console.error(`💥 Exception in Anthropic call (${sceneLabel}):`, error);
        throw error;
    }
}

// ============================================================================
// AI GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate scene synopsis using AI
 * Uses narrative-aware synopsis if context is available
 */
export async function generateAISynopsis(sceneIndex) {
    if (sceneIndex < 0 || sceneIndex >= state.scenes.length) return;

    // Check if narrative context is available
    const hasNarrativeContext = window.scriptNarrativeContext;

    // Use context-aware synopsis if available
    if (hasNarrativeContext) {
        try {
            const { generateContextAwareSynopsis } = await import('./synopsis-generator.js');
            const result = await generateContextAwareSynopsis(sceneIndex);

            // Store additional context data if available
            if (result.importance) {
                state.scenes[sceneIndex].importance = result.importance;
            }
            if (result.narrativeSignificance) {
                state.scenes[sceneIndex].narrativeSignificance = result.narrativeSignificance;
            }

            return result.synopsis || result;
        } catch (error) {
            console.warn('Context-aware synopsis failed, falling back to basic:', error);
            // Fall through to basic synopsis
        }
    }

    // Basic synopsis (fallback or when no context)
    const scene = state.scenes[sceneIndex];
    const sceneText = scene.content || scene.text || '';

    const prompt = `You are a script breakdown assistant. Analyze this scene and provide a concise synopsis for quick scanning.

Scene Heading: ${scene.heading}

Scene Text:
${sceneText}

Write a synopsis in EXACTLY 20-30 words. Be extremely concise and focus only on the key action or beat of the scene.
STRICT REQUIREMENT: The synopsis must be between 20-30 words. Count carefully.
Focus on the primary dramatic action or event in the scene.

Provide only the synopsis text, no additional commentary or explanations.`;

    try {
        const sceneNumber = scene.number || sceneIndex + 1;
        const synopsis = await callAI(prompt, 200, sceneNumber);
        return synopsis.trim();
    } catch (error) {
        console.error('Error generating synopsis:', error);
        throw error;
    }
}

/**
 * Detect elements using AI with enhanced continuity tracking
 * Captures descriptive sentences and phrases for professional hair/makeup/wardrobe continuity
 * Uses narrative-aware tagging if context is available
 */
export async function detectAIElements(sceneIndex) {
    if (sceneIndex < 0 || sceneIndex >= state.scenes.length) return;

    // Check if narrative context is available
    const hasNarrativeContext = window.scriptNarrativeContext;

    // Use narrative-aware tagging if available
    if (hasNarrativeContext) {
        try {
            const { performSmartAutoTag, applySmartTags } = await import('./auto-tag.js');
            const tagsData = await performSmartAutoTag(sceneIndex);

            // Convert smart tags to legacy format for compatibility
            const cast = [];
            const elements = {
                hair: [],
                makeup: [],
                sfx: [],
                health: [],
                injuries: [],
                stunts: [],
                weather: [],
                wardrobe: [],
                extras: []
            };

            if (tagsData.tags) {
                tagsData.tags.forEach(tag => {
                    if (tag.category === 'cast' && tag.character) {
                        if (!cast.includes(tag.character)) {
                            cast.push(tag.character);
                        }
                    } else if (elements[tag.category]) {
                        if (!elements[tag.category].includes(tag.text)) {
                            elements[tag.category].push(tag.text);
                        }
                    }
                });
            }

            return {
                cast,
                elements,
                structuredTags: tagsData.tags || [],
                method: 'narrative-aware'
            };
        } catch (error) {
            console.warn('Narrative-aware tagging failed, falling back to basic:', error);
            // Fall through to basic detection
        }
    }

    // Basic element detection (fallback or when no context)
    const scene = state.scenes[sceneIndex];
    const sceneText = scene.content || scene.text || '';

    // Build comprehensive character reference with variations
    let characterContext = 'Characters will be detected automatically from the scene text.';
    if (window.characterManager) {
        characterContext = window.characterManager.buildCharacterReferenceForAI();
        console.log('📋 Character Reference for AI:');
        console.log(characterContext);
    }

    const prompt = `You are analyzing a screenplay scene for production continuity, specifically for hair, makeup, wardrobe, and SFX departments.

Scene Heading: ${scene.heading}

Scene Text:
${sceneText}

${characterContext}

**CRITICAL**: Your task is to identify and extract ALL descriptive information about character appearance, condition, and any changes that occur. Capture COMPLETE SENTENCES or PHRASES that describe appearance - not just keywords.

**TAGGING RULES:**

1. HAIR - Capture descriptive phrases about:
   - Hairstyle: "long auburn hair", "hair tied in a messy bun", "slicked back"
   - Condition: "windswept hair", "wet and matted", "disheveled", "perfectly styled"
   - Changes: "cuts her hair short", "dyes it red", "removes the wig"
   - Accessories: "wearing a hat", "headband visible"
   - Environmental effects: "rain soaks her hair", "wind tangles his hair"

2. MAKEUP - Capture phrases about:
   - Application: "flawless makeup", "smoky eyes", "red lipstick", "natural look"
   - Condition: "smudged mascara", "makeup running", "faded lipstick"
   - Skin: "pale complexion", "flushed face", "tanned", "sunburned"
   - Changes: "wipes off her makeup", "applies fresh lipstick"

3. SFX (Special Effects) - Capture phrases about:
   - Prosthetics: "wearing a fake scar", "latex appliances", "aged 30 years"
   - Fantasy elements: "pointed ears", "alien skin texture", "vampire fangs"
   - Transformations: "transforms into a creature", "appears elderly"

4. HEALTH/ILLNESS - Capture phrases about:
   - Condition: "looks pale and sweaty", "feverish appearance", "exhausted"
   - Symptoms: "dark circles under eyes", "clammy skin", "shivering"
   - Recovery: "regaining color", "looking healthier"

5. INJURIES - Capture phrases about:
   - Wounds: "bleeding cut above eyebrow", "gash on forehead", "blood trickling down face"
   - Bruises: "black eye forming", "purple bruise on cheek"
   - Treatment: "bandaged wound", "fresh stitches", "wrapped in gauze"
   - Blood: "blood on face", "bloodstained shirt", "dried blood"

6. STUNTS - Capture action that affects appearance:
   - Physical action: "thrown into mud", "crashes through window"
   - Getting messy: "covered in dirt", "splashed with water", "dust cloud hits them"

7. WEATHER - Capture environmental effects on appearance:
   - Rain: "rain soaks them", "dripping wet"
   - Wind: "wind whips her hair"
   - Heat/Cold: "sweat beading on forehead", "frost in his beard"

8. WARDROBE - Capture clothing descriptions:
   - Descriptions: "wearing a red vintage jacket", "torn jeans", "pristine suit"
   - Condition: "mud-stained shirt", "ripped from the fight", "soaking wet clothes"
   - Changes: "changes into a blue dress", "removes his jacket"

9. EXTRAS - Background performers:
   - Crowds: "packed with passengers", "dozens of pedestrians"
   - Types: "tourists with cameras", "businessmen in suits"

**OUTPUT FORMAT** (JSON only, no explanation):
{
  "tags": [
    {
      "category": "hair|makeup|sfx|health|injuries|stunts|weather|wardrobe|extras|cast",
      "character": "EXACT CHARACTER NAME from confirmed list or null",
      "text": "The actual descriptive phrase from the script (complete sentence or phrase)",
      "confidence": "high|medium|low"
    }
  ]
}

**IMPORTANT**:
- Capture COMPLETE descriptive phrases, not keywords
- Match character variations to their canonical names (e.g., "Gwen" → "GWEN LAWSON", "Peter" → "PETER LAWSON")
- Use the UPPERCASE canonical name from the CHARACTER REFERENCE above (e.g., "GWEN LAWSON", not "Gwen" or "gwen lawson")
- Tag the same text in MULTIPLE categories if relevant (e.g., "blood on face" = both injuries AND makeup)
- Include contextual action if it affects appearance
- Use "cast" category for character presence/introductions

Examples:
Input: "GWEN's long auburn hair whips in the wind as rain soaks her jacket."
Output: {
  "tags": [
    {"category": "hair", "character": "GWEN LAWSON", "text": "long auburn hair whips in the wind", "confidence": "high"},
    {"category": "weather", "character": "GWEN LAWSON", "text": "wind", "confidence": "high"},
    {"category": "weather", "character": "GWEN LAWSON", "text": "rain soaks her jacket", "confidence": "high"},
    {"category": "wardrobe", "character": "GWEN LAWSON", "text": "rain soaks her jacket", "confidence": "high"}
  ]
}

Input: "Gwen looks exhausted, dark circles under her eyes. Peter stands beside her, a fresh cut above his eyebrow."
Output: {
  "tags": [
    {"category": "health", "character": "GWEN LAWSON", "text": "looks exhausted", "confidence": "high"},
    {"category": "health", "character": "GWEN LAWSON", "text": "dark circles under her eyes", "confidence": "high"},
    {"category": "makeup", "character": "GWEN LAWSON", "text": "dark circles under her eyes", "confidence": "high"},
    {"category": "cast", "character": "PETER LAWSON", "text": "Peter stands beside her", "confidence": "high"},
    {"category": "injuries", "character": "PETER LAWSON", "text": "fresh cut above his eyebrow", "confidence": "high"},
    {"category": "makeup", "character": "PETER LAWSON", "text": "fresh cut above his eyebrow", "confidence": "high"}
  ]
}

Analyze the scene and return ALL relevant tags as JSON.`;

    try {
        const sceneNumber = scene.number || sceneIndex + 1;
        const response = await callAI(prompt, 2000, sceneNumber); // Increased token limit for detailed responses

        // Parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No valid JSON found in response');
        }

        const data = JSON.parse(jsonMatch[0]);

        // Process tags and organize by category
        const tagsByCategory = {
            cast: [],
            hair: [],
            makeup: [],
            sfx: [],
            health: [],
            injuries: [],
            stunts: [],
            weather: [],
            wardrobe: [],
            extras: []
        };

        const allTags = [];

        if (data.tags && Array.isArray(data.tags)) {
            data.tags.forEach(tag => {
                // Validate tag structure
                if (!tag.category || !tag.text) {
                    console.warn('Invalid tag structure:', tag);
                    return;
                }

                // Normalize character name using CharacterManager if available
                let normalizedCharacter = null;
                if (tag.character) {
                    if (window.characterManager) {
                        normalizedCharacter = window.characterManager.getCanonicalName(tag.character) || tag.character;
                    } else {
                        // Fallback: try to match against confirmed characters
                        const charUpper = tag.character.toUpperCase();
                        for (const confirmedChar of confirmedCharNames) {
                            if (confirmedChar.toUpperCase() === charUpper ||
                                confirmedChar.toUpperCase().includes(charUpper) ||
                                charUpper.includes(confirmedChar.toUpperCase())) {
                                normalizedCharacter = confirmedChar;
                                break;
                            }
                        }
                        if (!normalizedCharacter) {
                            normalizedCharacter = tag.character;
                        }
                    }
                }

                // Create structured tag object
                const structuredTag = {
                    category: tag.category,
                    character: normalizedCharacter,
                    text: tag.text,
                    confidence: tag.confidence || 'medium',
                    sceneIndex: sceneIndex,
                    sceneNumber: scene.number
                };

                // Add to category array
                if (tagsByCategory[tag.category]) {
                    tagsByCategory[tag.category].push(structuredTag);
                }

                // Add to all tags array
                allTags.push(structuredTag);
            });
        }

        // Extract unique cast members
        const cast = [...new Set(allTags
            .filter(t => t.category === 'cast' && t.character)
            .map(t => t.character))];

        // Return in compatible format
        return {
            cast: cast,
            elements: {
                hair: tagsByCategory.hair.map(t => t.text),
                makeup: tagsByCategory.makeup.map(t => t.text),
                sfx: tagsByCategory.sfx.map(t => t.text),
                health: tagsByCategory.health.map(t => t.text),
                injuries: tagsByCategory.injuries.map(t => t.text),
                stunts: tagsByCategory.stunts.map(t => t.text),
                weather: tagsByCategory.weather.map(t => t.text),
                wardrobe: tagsByCategory.wardrobe.map(t => t.text),
                extras: tagsByCategory.extras.map(t => t.text)
            },
            // Enhanced: return structured tags with character info
            structuredTags: allTags
        };
    } catch (error) {
        console.error('Error detecting elements:', error);
        throw error;
    }
}

/**
 * Detect character introductions using AI
 */
export async function detectCharacterIntroductions(scriptText) {
    const prompt = `Analyze this screenplay and identify character introductions (when a character first appears).

Return ONLY valid JSON with this structure:
{
  "introductions": [
    {
      "name": "Character Name",
      "scene": 1,
      "description": "Brief physical description from script"
    }
  ]
}

Screenplay:
${scriptText.substring(0, 10000)}

Return ONLY the JSON.`;

    try {
        const response = await callAI(prompt, 800);

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return [];

        const data = JSON.parse(jsonMatch[0]);
        return data.introductions || [];
    } catch (error) {
        console.error('Error detecting character introductions:', error);
        return [];
    }
}

/**
 * Generate description for specific element using AI
 */
export async function generateDescription(sceneIndex, character, category) {
    if (sceneIndex < 0 || sceneIndex >= state.scenes.length) return '';

    const scene = state.scenes[sceneIndex];
    const sceneText = scene.content || scene.text || '';

    const categoryLabels = {
        hair: 'hair styling',
        makeup: 'makeup application',
        sfx: 'special effects/prosthetics',
        wardrobe: 'wardrobe/costume'
    };

    const categoryLabel = categoryLabels[category] || category;

    const prompt = `Analyze this scene and describe the ${categoryLabel} needs for the character "${character}".

Scene: ${scene.heading}
${sceneText}

Provide a brief, specific description focusing on ${categoryLabel} requirements for continuity. 1-2 sentences maximum.`;

    try {
        const description = await callAI(prompt, 150);
        return description.trim();
    } catch (error) {
        console.error('Error generating description:', error);
        return '';
    }
}

/**
 * Generate continuity event progression using AI
 */
export async function generateProgression(eventType, description, startScene, endScene) {
    const prompt = `Create a progression timeline for a continuity event in a screenplay.

Event Type: ${eventType}
Description: ${description}
Start Scene: ${startScene}
End Scene: ${endScene}

Generate 3-5 progression stages showing how this event evolves from scene ${startScene} to scene ${endScene}.

Return ONLY valid JSON:
{
  "stages": [
    {
      "scene": ${startScene},
      "stage": "fresh",
      "description": "Initial state description"
    }
  ]
}

Make it realistic for the event type.`;

    try {
        const response = await callAI(prompt, 400);

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return [];

        const data = JSON.parse(jsonMatch[0]);
        return data.stages || [];
    } catch (error) {
        console.error('Error generating progression:', error);
        return [];
    }
}

/**
 * Auto-fill character base description using AI
 */
export async function aiFillCharacterFields(character) {
    // Get all scenes with this character
    const characterScenes = [];

    state.scenes.forEach((scene, index) => {
        const breakdown = state.sceneBreakdowns[index];
        if (breakdown && breakdown.cast && breakdown.cast.includes(character)) {
            characterScenes.push({
                index,
                heading: scene.heading,
                text: scene.content || scene.text || ''
            });
        }
    });

    if (characterScenes.length === 0) {
        throw new Error('No scenes found with this character');
    }

    // Use first few scenes for context
    const context = characterScenes.slice(0, 3).map(s =>
        `Scene ${s.index + 1}: ${s.heading}\n${s.text.substring(0, 500)}`
    ).join('\n\n');

    const prompt = `Analyze these scenes and provide a brief base description for the character "${character}" focusing on physical appearance, age, and any notable features relevant for hair/makeup continuity.

${context}

Provide 2-3 sentences maximum, focusing on:
- Physical appearance
- Age/age range
- Notable features (scars, tattoos, distinctive looks)

Return only the description, no additional commentary.`;

    try {
        const description = await callAI(prompt, 200);
        return description.trim();
    } catch (error) {
        console.error('Error generating character description:', error);
        throw error;
    }
}

// ============================================================================
// BATCH PROCESSING FUNCTIONS
// ============================================================================

// Track cancellation state
let batchCancelled = false;

/**
 * Generate synopses for all scenes in the script
 */
export async function generateAllSynopses(event) {
    if (!state.scenes || state.scenes.length === 0) {
        alert('No scenes loaded. Please import a script first.');
        return;
    }

    // Get the button element from the event
    const button = event?.currentTarget;
    if (!button) {
        console.error('Button element not found in event');
        return;
    }

    // Reset cancellation flag
    batchCancelled = false;

    // Start button progress
    startButtonProgress(button, state.scenes.length);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < state.scenes.length; i++) {
        if (batchCancelled) {
            resetButton(button);
            alert(`Processing cancelled. ${successCount} synopses generated, ${errorCount} failed.`);
            return;
        }

        const scene = state.scenes[i];
        updateButtonProgress(button, i + 1, `Scene ${i + 1} / ${state.scenes.length}`);

        try {
            const synopsis = await generateAISynopsis(i);

            // Save synopsis to scene
            state.scenes[i].synopsis = synopsis;

            // Also save to sceneBreakdowns if it exists
            if (!state.sceneBreakdowns[i]) {
                state.sceneBreakdowns[i] = {};
            }
            state.sceneBreakdowns[i].synopsis = synopsis;

            successCount++;
            console.log(`✓ Scene ${scene.number} synopsis generated`);
        } catch (error) {
            console.error(`Error generating synopsis for scene ${i}:`, error);
            errorCount++;
            errors.push(`Scene ${scene.number}: ${error.message}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Deduplicate all characters after synopsis generation
    console.log('🔄 Running character deduplication...');
    const { deduplicateAllCharacters } = await import('./character-panel.js');
    deduplicateAllCharacters();

    // Save project data
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Complete with success
    const successMessage = errorCount > 0
        ? `${successCount} Synopses Created (${errorCount} errors)`
        : `${successCount} Synopses Created`;

    completeButtonProgress(button, successMessage);

    // Refresh UI if we're viewing a scene
    if (state.currentScene !== null) {
        const { renderBreakdownPanel } = await import('./breakdown-form.js');
        renderBreakdownPanel();
    }
}

/**
 * Auto-tag the entire script with AI detection
 * Starts immediately when called - no prerequisites required beyond having imported script
 * Characters will be detected automatically during the tagging process if needed
 */
export async function autoTagScript(event) {
    if (!state.scenes || state.scenes.length === 0) {
        alert('No scenes loaded. Please import a script first.');
        return;
    }

    // Get the button element from the event
    const button = event?.currentTarget;
    if (!button) {
        console.error('Button element not found in event');
        return;
    }

    console.log('🤖 Starting Auto Tag Script...');
    console.log('📊 Total scenes to process:', state.scenes.length);

    // Reset cancellation flag
    batchCancelled = false;

    // Start button progress
    startButtonProgress(button, state.scenes.length);

    let successCount = 0;
    let errorCount = 0;
    let totalTagsCreated = 0;
    const errors = [];
    const allCategories = ['cast', 'hair', 'makeup', 'sfx', 'health', 'injuries', 'stunts', 'weather', 'wardrobe', 'extras'];

    console.log('📋 Will detect categories:', allCategories.join(', '));

    for (let i = 0; i < state.scenes.length; i++) {
        if (batchCancelled) {
            resetButton(button);
            alert(`Processing cancelled. ${successCount} scenes tagged, ${errorCount} failed.`);
            return;
        }

        const scene = state.scenes[i];
        console.log(`\n📋 Processing scene ${i + 1}/${state.scenes.length} (Scene #${scene.number})`);
        updateButtonProgress(button, i + 1, `Scene ${i + 1} / ${state.scenes.length}`);

        try {
            const result = await detectAIElements(i);
            console.log(`✓ Scene ${scene.number} - AI detected:`, {
                cast: result.cast?.length || 0,
                hair: result.elements?.hair?.length || 0,
                makeup: result.elements?.makeup?.length || 0,
                sfx: result.elements?.sfx?.length || 0,
                health: result.elements?.health?.length || 0,
                injuries: result.elements?.injuries?.length || 0,
                stunts: result.elements?.stunts?.length || 0,
                weather: result.elements?.weather?.length || 0,
                wardrobe: result.elements?.wardrobe?.length || 0,
                extras: result.elements?.extras?.length || 0
            });

            // Initialize breakdown if it doesn't exist
            if (!state.sceneBreakdowns[i]) {
                state.sceneBreakdowns[i] = {};
            }

            // Save detected elements
            const breakdown = state.sceneBreakdowns[i];

            // Cast members - normalize through CharacterManager
            if (result.cast && result.cast.length > 0) {
                // Normalize all character names
                const normalizedCast = result.cast.map(char =>
                    window.characterManager.addCharacter(char)
                ).filter(Boolean);

                breakdown.cast = [...new Set([...(breakdown.cast || []), ...normalizedCast])];

                // Add to global characters set
                normalizedCast.forEach(char => state.characters.add(char));
            }

            // Other elements
            if (result.elements) {
                Object.keys(result.elements).forEach(category => {
                    if (result.elements[category] && result.elements[category].length > 0) {
                        breakdown[category] = [...new Set([...(breakdown[category] || []), ...result.elements[category]])];
                    }
                });
            }

            // Create tag objects in scriptTags for highlighting
            if (!state.scriptTags[i]) {
                state.scriptTags[i] = [];
            }

            let sceneTagsCreated = 0;
            const existingTagTexts = new Set(); // For deduplication

            // Use enhanced structured tags if available
            if (result.structuredTags && result.structuredTags.length > 0) {
                console.log(`  Processing ${result.structuredTags.length} structured tags...`);

                result.structuredTags.forEach(structuredTag => {
                    // Deduplication: Create unique key for tag
                    const dedupeKey = `${structuredTag.category}:${structuredTag.character || 'none'}:${structuredTag.text.toLowerCase()}`;

                    if (existingTagTexts.has(dedupeKey)) {
                        console.log(`    ⊘ Skipping duplicate: "${structuredTag.text.substring(0, 30)}..."`);
                        return;
                    }
                    existingTagTexts.add(dedupeKey);

                    // Normalize character name
                    let canonicalName = structuredTag.character;
                    if (canonicalName && window.characterManager) {
                        canonicalName = window.characterManager.getCanonicalName(canonicalName) || canonicalName;
                    }

                    const tag = {
                        id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        sceneIndex: i,
                        sceneNumber: scene.number,
                        category: structuredTag.category,
                        selectedText: structuredTag.text.substring(0, 150), // Capture full phrase
                        fullContext: structuredTag.text,
                        character: canonicalName,
                        confidence: structuredTag.confidence || 'medium',
                        created: Date.now()
                    };

                    state.scriptTags[i].push(tag);
                    sceneTagsCreated++;

                    const charInfo = canonicalName ? ` (${canonicalName})` : '';
                    const confidenceIcon = structuredTag.confidence === 'high' ? '✓' : structuredTag.confidence === 'low' ? '?' : '•';
                    console.log(`    ${confidenceIcon} ${structuredTag.category}: "${structuredTag.text.substring(0, 50)}..."${charInfo}`);
                });
            } else {
                // Fallback to legacy format
                console.log(`  Using legacy tag format...`);

                // Create tags for cast members
                if (result.cast && result.cast.length > 0) {
                    result.cast.forEach(castMember => {
                        const canonicalName = window.characterManager?.getCanonicalName(castMember) || castMember;

                        const tag = {
                            id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            sceneIndex: i,
                            sceneNumber: scene.number,
                            category: 'cast',
                            selectedText: canonicalName,
                            fullContext: `Cast member: ${canonicalName}`,
                            character: canonicalName,
                            confidence: 'high',
                            created: Date.now()
                        };
                        state.scriptTags[i].push(tag);
                        sceneTagsCreated++;
                    });
                }

                // Create tags for other elements
                if (result.elements) {
                    Object.keys(result.elements).forEach(category => {
                        if (result.elements[category] && result.elements[category].length > 0) {
                            result.elements[category].forEach(description => {
                                // Deduplication
                                const dedupeKey = `${category}:none:${description.toLowerCase()}`;
                                if (existingTagTexts.has(dedupeKey)) return;
                                existingTagTexts.add(dedupeKey);

                                // Try to detect character from description
                                let detectedCharacter = null;
                                if (result.cast) {
                                    for (const castMember of result.cast) {
                                        if (description.toLowerCase().includes(castMember.toLowerCase())) {
                                            detectedCharacter = window.characterManager?.getCanonicalName(castMember) || castMember;
                                            break;
                                        }
                                    }
                                }

                                const tag = {
                                    id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                    sceneIndex: i,
                                    sceneNumber: scene.number,
                                    category: category,
                                    selectedText: description.substring(0, 150),
                                    fullContext: description,
                                    character: detectedCharacter,
                                    confidence: 'medium',
                                    created: Date.now()
                                };
                                state.scriptTags[i].push(tag);
                                sceneTagsCreated++;
                            });
                        }
                    });
                }
            }

            totalTagsCreated += sceneTagsCreated;
            successCount++;

            const tagCount = state.scriptTags[i] ? state.scriptTags[i].length : 0;
            console.log(`✓ Scene ${scene.number} complete: ${sceneTagsCreated} tags created (total in scene: ${tagCount})`);

            // DIAGNOSTIC: Verify tags were stored correctly
            if (tagCount === 0 && sceneTagsCreated > 0) {
                console.error(`⚠️  WARNING: Created ${sceneTagsCreated} tags but state.scriptTags[${i}] is empty!`);
            }

            // DIAGNOSTIC: Show sample tag from this scene
            if (state.scriptTags[i] && state.scriptTags[i].length > 0) {
                console.log(`   Sample tag:`, state.scriptTags[i][0]);
            }
        } catch (error) {
            console.error(`Error auto-tagging scene ${i}:`, error);
            errorCount++;
            errors.push(`Scene ${scene.number}: ${error.message}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Deduplicate all characters after tagging
    console.log('🔄 Running character deduplication...');
    const { deduplicateAllCharacters } = await import('./character-panel.js');
    deduplicateAllCharacters();

    // Save project data
    const { saveProject } = await import('./export-handlers.js');
    saveProject();

    // Refresh scene list to show tagged indicators
    const { renderSceneList } = await import('./scene-list.js');
    renderSceneList();

    // Count total tags created
    const totalTags = Object.values(state.scriptTags).reduce((sum, tags) => sum + (tags?.length || 0), 0);
    console.log(`\n✅ AUTO-TAGGING COMPLETE`);
    console.log(`📊 Summary:`);
    console.log(`  - Scenes processed: ${successCount}`);
    console.log(`  - Tags created this run: ${totalTagsCreated}`);
    console.log(`  - Total tags in state: ${totalTags}`);
    console.log(`  - Errors: ${errorCount}`);

    // DIAGNOSTIC: Show tag count per scene
    console.log(`\n📋 Tags per scene:`);
    Object.keys(state.scriptTags).forEach(sceneIndex => {
        const tags = state.scriptTags[sceneIndex];
        const sceneNum = state.scenes[sceneIndex]?.number || sceneIndex;
        console.log(`  Scene ${sceneNum} (index ${sceneIndex}): ${tags.length} tags`);
    });

    // DIAGNOSTIC: Show sample of tags created
    if (state.scriptTags[0]) {
        console.log(`\n🔍 Sample tag from scene 0:`, state.scriptTags[0][0]);
    }

    // Apply all highlights to script
    console.log(`\n🎨 Applying highlights to script...`);
    const { renderAllHighlights } = await import('./tag-system.js');
    renderAllHighlights();

    // Complete with success
    const successMessage = errorCount > 0
        ? `${totalTags} Tags Created (${errorCount} errors)`
        : `${totalTags} Tags Created`;

    completeButtonProgress(button, successMessage);

    // Refresh UI if we're viewing a scene
    if (state.currentScene !== null) {
        const { renderBreakdownPanel } = await import('./breakdown-form.js');
        renderBreakdownPanel();
    }
}

/**
 * Cancel batch processing
 */
export function cancelBatchProcessing() {
    batchCancelled = true;
}

// ============================================================================
// INLINE BUTTON PROGRESS BAR UTILITIES
// ============================================================================

/**
 * Transform a button into a progress bar
 */
function startButtonProgress(buttonElement, totalSteps) {
    // Add processing class
    buttonElement.classList.add('processing');

    // Store original text
    buttonElement.dataset.originalText = buttonElement.textContent;

    // Create progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'toolbar-btn-progress';
    buttonElement.prepend(progressBar);

    // Update button text
    const textSpan = document.createElement('span');
    textSpan.className = 'toolbar-btn-text';
    textSpan.innerHTML = `
        <span class="toolbar-btn-spinner"></span>
        <span class="progress-text">0 / ${totalSteps}</span>
    `;
    buttonElement.innerHTML = '';
    buttonElement.appendChild(progressBar);
    buttonElement.appendChild(textSpan);

    // Store reference for updates
    buttonElement._progressBar = progressBar;
    buttonElement._progressText = textSpan.querySelector('.progress-text');
    buttonElement._totalSteps = totalSteps;
}

/**
 * Update button progress
 */
function updateButtonProgress(buttonElement, currentStep, message = null) {
    if (!buttonElement._progressBar) return;

    const percentage = (currentStep / buttonElement._totalSteps) * 100;
    buttonElement._progressBar.style.width = percentage + '%';

    if (buttonElement._progressText) {
        const displayMessage = message || `${currentStep} / ${buttonElement._totalSteps}`;
        buttonElement._progressText.textContent = displayMessage;
    }
}

/**
 * Complete button progress with success state
 */
function completeButtonProgress(buttonElement, successMessage = 'Complete') {
    if (!buttonElement._progressBar) return;

    // Full progress
    buttonElement._progressBar.style.width = '100%';

    // Show success state
    buttonElement.classList.remove('processing');
    buttonElement.classList.add('success');

    const textSpan = buttonElement.querySelector('.toolbar-btn-text');
    if (textSpan) {
        textSpan.innerHTML = successMessage;
    }

    // Reset after 2 seconds
    setTimeout(() => {
        resetButton(buttonElement);
    }, 2000);
}

/**
 * Reset button to original state
 */
function resetButton(buttonElement) {
    buttonElement.classList.remove('processing', 'success');

    // Remove progress elements
    const progressBar = buttonElement.querySelector('.toolbar-btn-progress');
    if (progressBar) progressBar.remove();

    // Restore original text
    const originalText = buttonElement.dataset.originalText || buttonElement.textContent;
    buttonElement.innerHTML = originalText;

    // Clean up stored references
    delete buttonElement._progressBar;
    delete buttonElement._progressText;
    delete buttonElement._totalSteps;
}

// ============================================================================
// PROGRESS MODAL UTILITIES
// ============================================================================

/**
 * Open progress modal
 */
function openProgressModal(title, total) {
    const modal = document.getElementById('progress-modal');
    const titleEl = document.getElementById('progress-title');
    const messageEl = document.getElementById('progress-message');
    const labelEl = document.getElementById('progress-label');
    const fillEl = document.getElementById('progress-fill');
    const detailsEl = document.getElementById('progress-details');
    const cancelBtn = document.getElementById('progress-cancel-btn');
    const doneBtn = document.getElementById('progress-done-btn');

    if (!modal) return;

    titleEl.textContent = title;
    messageEl.textContent = 'Starting batch processing...';
    labelEl.textContent = `0 / ${total}`;
    fillEl.style.width = '0%';
    detailsEl.textContent = '';
    cancelBtn.style.display = 'inline-block';
    doneBtn.style.display = 'none';

    modal.style.display = 'flex';
}

/**
 * Update progress modal
 */
function updateProgressModal(current, total, message, isDone) {
    const messageEl = document.getElementById('progress-message');
    const labelEl = document.getElementById('progress-label');
    const fillEl = document.getElementById('progress-fill');
    const cancelBtn = document.getElementById('progress-cancel-btn');
    const doneBtn = document.getElementById('progress-done-btn');

    if (messageEl) messageEl.textContent = message;
    if (labelEl) labelEl.textContent = `${current} / ${total}`;
    if (fillEl) {
        const percentage = (current / total) * 100;
        fillEl.style.width = `${percentage}%`;
    }

    if (isDone) {
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (doneBtn) doneBtn.style.display = 'inline-block';
    }
}

/**
 * Update progress details
 */
function updateProgressDetails(detail) {
    const detailsEl = document.getElementById('progress-details');
    if (!detailsEl) return;

    // Keep last 5 details
    const lines = detailsEl.textContent.split('\n').filter(l => l.trim());
    lines.push(detail);
    if (lines.length > 5) lines.shift();

    detailsEl.textContent = lines.join('\n');
}

/**
 * Close progress modal
 */
function closeProgressModal() {
    const modal = document.getElementById('progress-modal');
    if (modal) modal.style.display = 'none';
}

// ============================================================================
// CHARACTERS NOT CONFIRMED MODAL
// ============================================================================

/**
 * Open the characters not confirmed modal
 */
function openCharactersNotConfirmedModal() {
    const modal = document.getElementById('characters-not-confirmed-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

/**
 * Close the characters not confirmed modal
 */
function closeCharactersNotConfirmedModal() {
    const modal = document.getElementById('characters-not-confirmed-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ============================================================================
// CONTINUITY EVENT TIMELINE GENERATION
// ============================================================================

/**
 * Generate AI timeline for a continuity event
 * Fills in gaps between logged observations with realistic progression
 */
window.generateEventTimeline = async function() {
    const eventId = window.currentTimelineEvent;
    if (!eventId) {
        alert('No event selected');
        return;
    }

    const event = state.continuityEvents.find(e => e.id === eventId);
    if (!event) {
        alert('Event not found');
        return;
    }

    // Disable button during generation
    const generateBtn = document.getElementById('generate-timeline-btn');
    const originalText = generateBtn.textContent;
    generateBtn.textContent = '⏳ Generating...';
    generateBtn.disabled = true;

    try {
        console.log(`🤖 Generating timeline for: ${event.name}`);

        // Build AI prompt
        const prompt = buildTimelinePrompt(event);

        // Call AI with higher token limit for detailed responses
        const result = await callAI(prompt, 3000);

        // Parse result
        const generatedEntries = parseTimelineResponse(result, event);

        // Store generated timeline in new structure
        if (!event.timeline) {
            event.timeline = [];
        }

        // Add generated entries with source field
        generatedEntries.forEach(entry => {
            // Check if entry for this scene already exists
            const existingIndex = event.timeline.findIndex(t => t.scene === entry.scene);
            if (existingIndex >= 0) {
                // Replace existing generated entry
                event.timeline[existingIndex] = {
                    ...entry,
                    source: 'ai',
                    timestamp: Date.now()
                };
            } else {
                // Add new entry
                event.timeline.push({
                    ...entry,
                    source: 'ai',
                    timestamp: Date.now()
                });
            }
        });

        // Sort timeline by scene
        event.timeline.sort((a, b) => a.scene - b.scene);

        // Backward compatibility: also store in generatedTimeline
        event.generatedTimeline = generatedEntries;

        // Save to localStorage
        saveToLocalStorage();

        // Refresh display using new render function from breakdown-form.js
        import('./breakdown-form.js').then(module => {
            const timelineEvent = state.continuityEvents.find(e => e.id === eventId);
            if (timelineEvent) {
                // Call the three-column render functions
                if (typeof window.renderTimelineEntries === 'function') {
                    window.renderTimelineEntries(timelineEvent);
                } else {
                    // Fallback to legacy render
                    renderEventTimelineEntries(timelineEvent);
                }
            }
        });

        console.log(`✅ Generated ${generatedEntries.length} timeline entries`);

        alert(`Generated ${generatedEntries.length} timeline entries successfully!`);

    } catch (error) {
        console.error('Error generating timeline:', error);
        alert(`Failed to generate timeline: ${error.message}`);
    } finally {
        // Re-enable button
        generateBtn.textContent = originalText;
        generateBtn.disabled = false;
    }
};

/**
 * Build AI prompt for timeline generation
 */
function buildTimelinePrompt(event) {
    // Sort observations by scene
    const sortedObs = [...event.observations].sort((a, b) => a.scene - b.scene);

    const observations = sortedObs.map(obs =>
        `Scene ${obs.scene + 1}: ${obs.description}`
    ).join('\n');

    // Get scenes that need generation
    const scenesToGenerate = getScenesToGenerate(event);

    // Actor presence information
    const actorPresence = event.actorPresence || [];
    const presenceInfo = actorPresence.length > 0
        ? `Character appears in scenes: ${actorPresence.map(s => s + 1).join(', ')}`
        : 'Actor presence not tracked';

    // Visibility information
    const visibility = event.visibility || [];
    const hiddenScenes = visibility
        .filter(v => v.status === 'hidden')
        .map(v => {
            const coverage = v.coverage ? ` (covered by ${v.coverage})` : '';
            return `Scene ${v.scene + 1}${coverage}`;
        });
    const visibilityInfo = hiddenScenes.length > 0
        ? `Event hidden/covered in: ${hiddenScenes.join(', ')}`
        : 'Event visible in all scenes';

    // Key scenes (script references)
    const keyScenes = event.keyScenes || [];
    const scriptRefs = keyScenes.length > 0
        ? keyScenes.map(ks =>
            `Scene ${ks.scene + 1}: "${ks.taggedPhrase}" - ${ks.scriptText.substring(0, 80)}...`
        ).join('\n')
        : 'No script references';

    // Category-specific guidance
    let categoryGuidance = '';
    switch (event.category) {
        case 'injuries':
            categoryGuidance = `For wounds/injuries, consider:
- Realistic healing timeline (fresh → dried blood → scab → scar)
- Color changes (red → purple → yellow for bruises)
- Texture changes (wet → dry → scab formation)
- Size/severity progression
- Swelling and inflammation progression`;
            break;
        case 'health':
            categoryGuidance = `For illness/health conditions, consider:
- Symptom progression or recovery
- Visible signs (pale, flushed, sweaty, dark circles)
- Energy level indicators
- Physical deterioration or improvement`;
            break;
        case 'dirt':
            categoryGuidance = `For dirt/blood/wear accumulation, consider:
- Gradual accumulation vs. sudden application
- Drying and color changes (wet blood → dried → brown)
- Spread patterns and coverage
- Wear patterns on clothing`;
            break;
        case 'aging':
            categoryGuidance = `For aging makeup progression, consider:
- Gradual introduction of age indicators
- Gray hair progression
- Wrinkle depth and coverage
- Posture and movement changes`;
            break;
        case 'pregnancy':
            categoryGuidance = `For pregnancy progression, consider:
- Gradual belly growth month by month
- Posture changes
- Face shape changes (fuller face)
- Movement difficulty progression`;
            break;
        default:
            categoryGuidance = `Consider realistic, gradual progression between observed states.`;
    }

    return `You are a professional makeup continuity supervisor creating a detailed progression timeline.

EVENT: ${event.name}
CHARACTER: ${event.character}
CATEGORY: ${event.category}
SCENES: ${event.startScene + 1} to ${event.endScene ? event.endScene + 1 : state.scenes.length}

ACTOR PRESENCE:
${presenceInfo}

VISIBILITY STATUS:
${visibilityInfo}

SCRIPT REFERENCES:
${scriptRefs}

LOGGED OBSERVATIONS (documented by crew):
${observations}

${categoryGuidance}

TASK:
Fill in the progression for scenes: ${scenesToGenerate}

Create smooth, realistic transitions between the logged observations. Each generated description must:
1. Flow logically from the previous state
2. Progress toward the next logged observation
3. Be specific and detailed enough for makeup department reference
4. Maintain medical/physical realism
5. Use professional continuity language
6. Account for visibility status (if hidden, note that it's covered but still progressing)

CRITICAL:
- The generated descriptions must create seamless transitions between logged observations
- Only generate for scenes where the character actually appears (check ACTOR PRESENCE)
- If an event is hidden/covered in certain scenes, still track its progression underneath
- Use script references to understand context and maintain consistency

OUTPUT FORMAT (JSON only, no explanation):
{
  "timeline": [
    {
      "scene": 11,
      "description": "Detailed, specific description of appearance"
    },
    {
      "scene": 12,
      "description": "Detailed, specific description of appearance"
    }
  ]
}

Generate realistic, detailed continuity notes for ONLY the scenes listed above. Do not include scenes that already have logged observations.`;
}

/**
 * Get list of scenes that need AI generation
 */
function getScenesToGenerate(event) {
    const logged = event.observations.map(o => o.scene).sort((a, b) => a - b);
    const scenesToGenerate = [];

    const endScene = event.endScene !== null ? event.endScene : state.scenes.length - 1;

    for (let i = event.startScene; i <= endScene; i++) {
        if (!logged.includes(i)) {
            scenesToGenerate.push(i + 1); // Convert to 1-indexed for display
        }
    }

    return scenesToGenerate.join(', ');
}

/**
 * Parse AI timeline response
 */
function parseTimelineResponse(response, event) {
    try {
        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No valid JSON found in response');
        }

        const data = JSON.parse(jsonMatch[0]);

        if (!data.timeline || !Array.isArray(data.timeline)) {
            throw new Error('Invalid timeline format');
        }

        // Convert scene numbers from 1-indexed to 0-indexed
        return data.timeline.map(entry => ({
            scene: typeof entry.scene === 'number' ? entry.scene - 1 : parseInt(entry.scene) - 1,
            description: entry.description,
            type: 'generated'
        }));

    } catch (error) {
        console.error('Error parsing timeline response:', error);
        throw new Error('Failed to parse AI response');
    }
}

/**
 * Render timeline entries (shared with breakdown-form.js)
 */
function renderEventTimelineEntries(event) {
    const container = document.getElementById('timeline-view');
    if (!container) return;

    let html = '';
    let lastLoggedScene = event.startScene - 1;

    // Sort observations by scene
    const sortedObs = [...event.observations].sort((a, b) => a.scene - b.scene);

    sortedObs.forEach((obs, index) => {
        // Check if there's a gap between this and previous observation
        if (obs.scene > lastLoggedScene + 1) {
            const gapStart = lastLoggedScene + 1;
            const gapEnd = obs.scene - 1;

            // Show generated entries for this gap if they exist
            const generated = event.generatedTimeline.filter(g => g.scene >= gapStart && g.scene <= gapEnd);

            if (generated.length === 0) {
                // Show gap indicator
                const sceneList = [];
                for (let i = gapStart; i <= gapEnd; i++) {
                    sceneList.push(i + 1);
                }
                html += `
                    <div class="timeline-gap">
                        <div class="gap-indicator">Scenes ${sceneList.join(', ')} (AI can generate)</div>
                    </div>
                `;
            } else {
                // Show generated entries
                generated.forEach(gen => {
                    html += `
                        <div class="timeline-entry generated">
                            <div class="timeline-scene">Scene ${gen.scene + 1}</div>
                            <div class="timeline-badge">AI GENERATED</div>
                            <div class="timeline-description">${escapeHtml(gen.description)}</div>
                        </div>
                    `;
                });
            }
        }

        // Add logged observation
        html += `
            <div class="timeline-entry logged">
                <div class="timeline-scene">Scene ${obs.scene + 1}</div>
                <div class="timeline-badge">LOGGED</div>
                <div class="timeline-description">${escapeHtml(obs.description)}</div>
            </div>
        `;

        lastLoggedScene = obs.scene;
    });

    container.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Expose functions globally for HTML onclick handlers
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveSettings = saveSettings;
window.toggleProviderSettings = toggleProviderSettings;
window.testAPIConnection = testAPIConnection;
window.generateAllSynopses = generateAllSynopses;
window.autoTagScript = autoTagScript;
window.cancelBatchProcessing = cancelBatchProcessing;
window.closeProgressModal = closeProgressModal;
window.startButtonProgress = startButtonProgress;
window.updateButtonProgress = updateButtonProgress;
window.completeButtonProgress = completeButtonProgress;
window.resetButton = resetButton;
window.openCharactersNotConfirmedModal = openCharactersNotConfirmedModal;
window.closeCharactersNotConfirmedModal = closeCharactersNotConfirmedModal;
