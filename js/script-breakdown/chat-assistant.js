/**
 * chat-assistant.js
 * AI Chat Assistant for Script Breakdown
 *
 * Provides an interactive chat interface for querying breakdown data,
 * asking about story structure, character appearances, and continuity.
 */

import { state } from './main.js';

// ============================================================================
// CHAT STATE
// ============================================================================

const chatState = {
    messages: [],
    isOpen: false,
    isLoading: false,
    abortController: null
};

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are an expert Script Breakdown Assistant for the Hair & Makeup (H&MU) Department. You have access to comprehensive script breakdown data and help production staff with continuity tracking, character analysis, and breakdown management.

## Your Expertise
- **Continuity Tracking**: Wound progressions, healing stages, makeup changes across story days
- **H&MU Terminology**: Prosthetics, SFX makeup, aging, beauty makeup, hair styling, wigs
- **Production Workflow**: Scene scheduling, story day logic, character appearances
- **Script Analysis**: INT/EXT locations, time of day, character presence

## Your Capabilities
- Answer questions about which scenes characters appear in
- Track continuity elements (wounds, blood, dirt, makeup states) across scenes
- Identify gaps in breakdown data (missing notes, incomplete scenes)
- Cross-reference story days with character looks
- Provide summaries of character arcs and appearance changes

## Response Style
- Be concise and production-focused
- Use scene numbers when referencing specific scenes
- Format lists clearly when presenting multiple items
- Highlight continuity concerns or potential issues
- When data is missing, clearly state what information is not available

## Data Access
You have access to the current project's:
- Scene list with locations, INT/EXT, time of day, story days
- Character roster with their scene appearances
- Breakdown data: hair, makeup, SFX, wounds, continuity notes per scene
- Character profiles and look arc information`;

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

/**
 * Build context data from current state for API calls
 */
function buildContextData() {
    const context = {
        script_metadata: {
            title: state.currentProject?.name || 'Untitled Project',
            total_scenes: state.scenes?.length || 0,
            version: getCurrentVersionInfo()
        },
        scenes: [],
        characters: [],
        breakdowns: []
    };

    // Build scenes array
    if (state.scenes && state.scenes.length > 0) {
        context.scenes = state.scenes.map((scene, index) => ({
            scene_number: scene.number || index + 1,
            heading: scene.heading || '',
            location: scene.location || extractLocationFromHeading(scene.heading),
            int_ext: scene.intExt || detectIntExt(scene.heading),
            time_of_day: scene.timeOfDay || detectTimeOfDay(scene.heading),
            story_day: scene.storyDay || null,
            characters_present: getCharactersInScene(index),
            synopsis: scene.synopsis || null
        }));
    }

    // Build characters array from confirmedCharacters and masterContext
    const characterNames = getConfirmedCharacterNames();
    context.characters = characterNames.map(name => {
        const profile = getCharacterProfile(name);
        return {
            name: name,
            category: profile?.category || 'SUPPORTING',
            total_scenes: profile?.sceneCount || countCharacterScenes(name),
            first_appearance: profile?.firstAppearance || findFirstAppearance(name),
            last_appearance: profile?.lastAppearance || findLastAppearance(name),
            profile_notes: profile?.baseDescription || null
        };
    });

    // Build breakdowns array
    if (state.sceneBreakdowns) {
        Object.entries(state.sceneBreakdowns).forEach(([sceneIndex, breakdown]) => {
            const idx = parseInt(sceneIndex);
            const scene = state.scenes?.[idx];

            if (breakdown && scene) {
                const breakdownEntry = {
                    scene_number: scene.number || idx + 1,
                    cast: breakdown.cast || [],
                    elements: {}
                };

                // Include all element categories
                const categories = ['hair', 'makeup', 'sfx', 'wardrobe', 'health', 'injuries', 'stunts', 'weather', 'extras'];
                categories.forEach(cat => {
                    if (breakdown.elements?.[cat]?.length > 0) {
                        breakdownEntry.elements[cat] = breakdown.elements[cat];
                    } else if (breakdown[cat]?.length > 0) {
                        breakdownEntry.elements[cat] = breakdown[cat];
                    }
                });

                // Include notes and synopsis
                if (breakdown.synopsis) breakdownEntry.synopsis = breakdown.synopsis;
                if (breakdown.notes) breakdownEntry.notes = breakdown.notes;

                // Character-specific breakdown data
                if (breakdown.characterBreakdowns) {
                    breakdownEntry.character_details = breakdown.characterBreakdowns;
                }

                context.breakdowns.push(breakdownEntry);
            }
        });
    }

    return context;
}

/**
 * Get current version info
 */
function getCurrentVersionInfo() {
    if (window.versionManager?.getCurrentVersion) {
        const version = window.versionManager.getCurrentVersion();
        if (version) {
            return {
                name: version.version_name,
                color: version.version_color,
                date: version.upload_date
            };
        }
    }
    return null;
}

/**
 * Get confirmed character names
 */
function getConfirmedCharacterNames() {
    if (state.confirmedCharacters instanceof Set) {
        return Array.from(state.confirmedCharacters);
    }
    if (Array.isArray(state.confirmedCharacters)) {
        return state.confirmedCharacters;
    }
    if (window.masterContext?.characters) {
        return Object.keys(window.masterContext.characters);
    }
    return [];
}

/**
 * Get character profile from masterContext
 */
function getCharacterProfile(name) {
    if (window.masterContext?.characters?.[name]) {
        return window.masterContext.characters[name];
    }
    if (state.castProfiles?.[name]) {
        return state.castProfiles[name];
    }
    return null;
}

/**
 * Get characters present in a scene
 */
function getCharactersInScene(sceneIndex) {
    const characters = [];

    // From breakdown cast
    if (state.sceneBreakdowns?.[sceneIndex]?.cast) {
        characters.push(...state.sceneBreakdowns[sceneIndex].cast);
    }

    // From scene castMembers
    if (state.scenes?.[sceneIndex]?.castMembers) {
        state.scenes[sceneIndex].castMembers.forEach(c => {
            if (!characters.includes(c)) characters.push(c);
        });
    }

    return characters;
}

/**
 * Count how many scenes a character appears in
 */
function countCharacterScenes(name) {
    let count = 0;
    state.scenes?.forEach((scene, idx) => {
        const chars = getCharactersInScene(idx);
        if (chars.some(c => c.toLowerCase() === name.toLowerCase())) {
            count++;
        }
    });
    return count;
}

/**
 * Find first scene appearance
 */
function findFirstAppearance(name) {
    for (let i = 0; i < (state.scenes?.length || 0); i++) {
        const chars = getCharactersInScene(i);
        if (chars.some(c => c.toLowerCase() === name.toLowerCase())) {
            return state.scenes[i].number || i + 1;
        }
    }
    return null;
}

/**
 * Find last scene appearance
 */
function findLastAppearance(name) {
    for (let i = (state.scenes?.length || 0) - 1; i >= 0; i--) {
        const chars = getCharactersInScene(i);
        if (chars.some(c => c.toLowerCase() === name.toLowerCase())) {
            return state.scenes[i].number || i + 1;
        }
    }
    return null;
}

/**
 * Extract location from scene heading
 */
function extractLocationFromHeading(heading) {
    if (!heading) return '';
    let loc = heading.replace(/^(INT|EXT|INT\.\/EXT|I\/E)\.?\s*/i, '');
    loc = loc.replace(/\s*-\s*(DAY|NIGHT|MORNING|AFTERNOON|EVENING|DAWN|DUSK|CONTINUOUS|SAME|LATER|MOMENTS LATER).*$/i, '');
    return loc.trim();
}

/**
 * Detect INT/EXT from heading
 */
function detectIntExt(heading) {
    if (!heading) return '';
    const match = heading.match(/^(INT|EXT|INT\.\/EXT|I\/E)/i);
    return match ? match[0].toUpperCase() : '';
}

/**
 * Detect time of day from heading
 */
function detectTimeOfDay(heading) {
    if (!heading) return '';
    const match = heading.match(/\b(DAY|NIGHT|MORNING|AFTERNOON|EVENING|DAWN|DUSK)\b/i);
    return match ? match[0].toUpperCase() : '';
}

// ============================================================================
// API COMMUNICATION
// ============================================================================

/**
 * Send message to Claude API with streaming
 */
async function sendMessageToAPI(userMessage, onChunk, onComplete, onError) {
    // Build context
    const context = buildContextData();

    // Build messages array with conversation history
    const messages = [];

    // Add conversation history (last 10 messages for context)
    const historyToInclude = chatState.messages.slice(-10);
    historyToInclude.forEach(msg => {
        messages.push({
            role: msg.role,
            content: msg.content
        });
    });

    // Add current user message with context
    const contextString = JSON.stringify(context, null, 2);
    const userMessageWithContext = `## Current Breakdown Data
\`\`\`json
${contextString}
\`\`\`

## User Question
${userMessage}`;

    messages.push({
        role: 'user',
        content: userMessageWithContext
    });

    // Create abort controller for cancellation
    chatState.abortController = new AbortController();

    try {
        await streamAnthropicResponse(messages, onChunk, onComplete, onError);
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Chat request aborted');
        } else {
            onError(error.message);
        }
    }
}

/**
 * Get response from Claude API via server endpoint
 */
async function streamAnthropicResponse(messages, onChunk, onComplete, onError) {
    const model = state.anthropicModel || localStorage.getItem('anthropicModel') || 'claude-sonnet-4-20250514';

    try {
        const response = await fetch('/api/ai', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                maxTokens: 2048,
                system: SYSTEM_PROMPT,
                messages: messages
            }),
            signal: chatState.abortController.signal
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please wait a moment and try again.');
            }
            throw new Error(errorData.error?.message || errorData.error || `API Error: ${response.status}`);
        }

        const data = await response.json();
        const fullResponse = data.content[0].text;

        // Simulate streaming by chunking the response
        onChunk(fullResponse);
        onComplete(fullResponse);

    } catch (error) {
        if (error.name !== 'AbortError') {
            throw error;
        }
    }
}

// ============================================================================
// UI RENDERING
// ============================================================================

/**
 * Toggle chat sidebar visibility
 */
function toggleChatSidebar() {
    chatState.isOpen = !chatState.isOpen;
    const sidebar = document.getElementById('chat-sidebar');
    const toggleBtn = document.getElementById('chat-toggle-btn');

    if (sidebar) {
        sidebar.classList.toggle('open', chatState.isOpen);
    }
    if (toggleBtn) {
        toggleBtn.classList.toggle('active', chatState.isOpen);
        toggleBtn.innerHTML = chatState.isOpen ? '×' : '💬';
        toggleBtn.title = chatState.isOpen ? 'Close Chat' : 'Open Project Chat';
    }

    // Focus input when opening
    if (chatState.isOpen) {
        setTimeout(() => {
            const input = document.getElementById('chat-input');
            if (input) input.focus();
        }, 300);
    }
}

/**
 * Render chat messages
 */
function renderChatMessages() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    if (chatState.messages.length === 0) {
        container.innerHTML = `
            <div class="chat-welcome">
                <div class="chat-welcome-icon">✨</div>
                <div class="chat-welcome-title">Scriptie</div>
                <div class="chat-welcome-text">
                    Here to help with your characters, looks, scenes, and schedule — just ask.
                </div>
                <div class="chat-suggestions">
                    <button class="chat-suggestion" onclick="window.chatAssistant.askSuggestion('How many scenes is each character in?')">
                        Character scene counts
                    </button>
                    <button class="chat-suggestion" onclick="window.chatAssistant.askSuggestion('Which scenes have SFX or blood effects?')">
                        SFX/Blood scenes
                    </button>
                    <button class="chat-suggestion" onclick="window.chatAssistant.askSuggestion('Which scenes are missing breakdown data?')">
                        Missing breakdowns
                    </button>
                    <button class="chat-suggestion" onclick="window.chatAssistant.askSuggestion('Summarize the story day timeline')">
                        Story day timeline
                    </button>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = chatState.messages.map((msg, index) => `
        <div class="chat-message ${msg.role}">
            <div class="chat-message-avatar">
                ${msg.role === 'user' ? '👤' : '🎬'}
            </div>
            <div class="chat-message-content">
                <div class="chat-message-text">${formatMessageContent(msg.content)}</div>
                ${msg.role === 'assistant' && index === chatState.messages.length - 1 && chatState.isLoading ?
                    '<span class="chat-typing-indicator"></span>' : ''}
            </div>
        </div>
    `).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

/**
 * Format message content with markdown-like formatting
 */
function formatMessageContent(content) {
    if (!content) return '';

    // Escape HTML
    let formatted = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Bold text **text**
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic text *text*
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Code blocks ```code```
    formatted = formatted.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');

    // Inline code `code`
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    // Lists (- item)
    formatted = formatted.replace(/^- (.+)$/gm, '• $1');

    return formatted;
}

/**
 * Add message to chat
 */
function addMessage(role, content) {
    chatState.messages.push({ role, content, timestamp: Date.now() });
    renderChatMessages();
}

/**
 * Update last assistant message (for streaming)
 */
function updateLastAssistantMessage(content) {
    const lastMsg = chatState.messages[chatState.messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
        lastMsg.content = content;
        renderChatMessages();
    }
}

/**
 * Handle sending a message
 */
async function handleSendMessage() {
    const input = document.getElementById('chat-input');
    if (!input) return;

    const message = input.value.trim();
    if (!message || chatState.isLoading) return;

    // Clear input
    input.value = '';

    // Add user message
    addMessage('user', message);

    // Add empty assistant message for streaming
    addMessage('assistant', '');
    chatState.isLoading = true;
    updateSendButtonState();

    let currentResponse = '';

    await sendMessageToAPI(
        message,
        // onChunk
        (chunk) => {
            currentResponse += chunk;
            updateLastAssistantMessage(currentResponse);
        },
        // onComplete
        (fullResponse) => {
            chatState.isLoading = false;
            updateSendButtonState();
            // Update API usage tracker
            if (window.apiUsageTracker) {
                window.apiUsageTracker.logCall();
            }
        },
        // onError
        (error) => {
            chatState.isLoading = false;
            updateSendButtonState();
            // Remove empty assistant message
            chatState.messages.pop();
            // Show error
            addMessage('assistant', `❌ Error: ${error}`);
            if (window.apiUsageTracker) {
                window.apiUsageTracker.logError();
            }
        }
    );
}

/**
 * Handle suggestion click
 */
function askSuggestion(question) {
    const input = document.getElementById('chat-input');
    if (input) {
        input.value = question;
        handleSendMessage();
    }
}

/**
 * Clear chat history
 */
function clearChat() {
    if (chatState.messages.length === 0) return;

    if (confirm('Clear chat history?')) {
        chatState.messages = [];
        renderChatMessages();
    }
}

/**
 * Cancel ongoing request
 */
function cancelRequest() {
    if (chatState.abortController) {
        chatState.abortController.abort();
        chatState.isLoading = false;
        updateSendButtonState();
    }
}

/**
 * Update send button state
 */
function updateSendButtonState() {
    const btn = document.getElementById('chat-send-btn');
    if (btn) {
        btn.disabled = chatState.isLoading;
        btn.innerHTML = chatState.isLoading ?
            '<span class="chat-loading-spinner"></span>' :
            '→';
    }
}

/**
 * Handle input keypress
 */
function handleInputKeypress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize chat assistant
 */
function initChatAssistant() {
    console.log('💬 Initializing Chat Assistant...');

    // Create chat sidebar HTML
    createChatSidebarHTML();

    // Set up event listeners
    setupChatEventListeners();

    console.log('✅ Chat Assistant initialized');
}

/**
 * Create chat sidebar HTML
 */
function createChatSidebarHTML() {
    // Check if sidebar already exists
    if (document.getElementById('chat-sidebar')) return;

    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'chat-toggle-btn';
    toggleBtn.className = 'chat-toggle-btn';
    toggleBtn.innerHTML = '💬';
    toggleBtn.title = 'Open Project Chat';
    toggleBtn.onclick = toggleChatSidebar;
    document.body.appendChild(toggleBtn);

    // Create sidebar
    const sidebar = document.createElement('div');
    sidebar.id = 'chat-sidebar';
    sidebar.className = 'chat-sidebar';
    const scriptieEnabled = localStorage.getItem('scriptieEnabled') === 'true';
    sidebar.innerHTML = `
        <div class="chat-header">
            <div class="chat-header-title">
                <span class="chat-header-icon">💬</span>
                <span>Project Chat</span>
            </div>
            <div class="chat-header-actions">
                <button class="chat-header-btn" onclick="window.chatAssistant.clearChat()" title="Clear chat">
                    🗑️
                </button>
                <button class="chat-header-btn" onclick="window.chatAssistant.toggleChatSidebar()" title="Close">
                    ×
                </button>
            </div>
        </div>
        <div class="chat-mode-toggle" style="display: flex; padding: 8px 12px; gap: 6px; border-bottom: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.15); flex-shrink: 0;">
            <button class="chat-mode-btn ${!scriptieEnabled ? 'active' : ''}" id="team-chat-tab-sb" onclick="window.chatAssistant.setMode('team')" style="flex: 1; padding: 8px 12px; background: ${!scriptieEnabled ? 'rgba(212,175,122,0.15)' : 'transparent'}; border: 1px solid ${!scriptieEnabled ? 'rgba(212,175,122,0.4)' : 'rgba(255,255,255,0.08)'}; border-radius: 8px; color: ${!scriptieEnabled ? 'var(--accent-gold)' : 'var(--text-muted)'}; font-size: 12px; cursor: pointer;">
                💬 Team Chat
            </button>
            <button class="chat-mode-btn ${scriptieEnabled ? 'active' : ''}" id="scriptie-tab-sb" onclick="window.chatAssistant.setMode('scriptie')" style="flex: 1; padding: 8px 12px; background: ${scriptieEnabled ? 'rgba(212,175,122,0.15)' : 'transparent'}; border: 1px solid ${scriptieEnabled ? 'rgba(212,175,122,0.4)' : 'rgba(255,255,255,0.08)'}; border-radius: 8px; color: ${scriptieEnabled ? 'var(--accent-gold)' : 'var(--text-muted)'}; font-size: 12px; cursor: pointer;">
                ✨ Scriptie
            </button>
        </div>
        <div id="team-chat-panel-sb" style="display: ${scriptieEnabled ? 'none' : 'flex'}; flex-direction: column; flex: 1; overflow: hidden;">
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px;">
                <div style="font-size: 48px; margin-bottom: 16px;">💬</div>
                <div style="font-size: 1.125rem; font-weight: 600; color: var(--text-light); margin-bottom: 8px;">Project Chat</div>
                <div style="font-size: 0.875rem; color: var(--text-muted); line-height: 1.5;">
                    Synced project messaging for your team. Share updates, notes, and coordinate on set.
                </div>
            </div>
            <div class="chat-input-container">
                <textarea class="chat-input" placeholder="Message your team..." rows="1"></textarea>
                <button class="chat-send-btn">→</button>
            </div>
        </div>
        <div id="scriptie-panel-sb" style="display: ${scriptieEnabled ? 'flex' : 'none'}; flex-direction: column; flex: 1; overflow: hidden;">
            <div class="chat-messages" id="chat-messages">
                <!-- Messages rendered here -->
            </div>
            <div class="chat-input-container">
                <textarea
                    id="chat-input"
                    class="chat-input"
                    placeholder="Ask Scriptie..."
                    rows="1"
                ></textarea>
                <button id="chat-send-btn" class="chat-send-btn" onclick="window.chatAssistant.handleSendMessage()">
                    →
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(sidebar);

    // Render initial messages
    renderChatMessages();
}

/**
 * Set up event listeners
 */
function setupChatEventListeners() {
    // Input auto-resize and enter handling
    const input = document.getElementById('chat-input');
    if (input) {
        input.addEventListener('keydown', handleInputKeypress);
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });
    }

    // Keyboard shortcut to toggle chat (Ctrl+/)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
            e.preventDefault();
            toggleChatSidebar();
        }
    });
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Switch between Team Chat and Scriptie modes
 */
function setMode(mode) {
    const teamPanel = document.getElementById('team-chat-panel-sb');
    const scriptiePanel = document.getElementById('scriptie-panel-sb');
    const teamTab = document.getElementById('team-chat-tab-sb');
    const scriptieTab = document.getElementById('scriptie-tab-sb');

    if (mode === 'scriptie') {
        if (teamPanel) teamPanel.style.display = 'none';
        if (scriptiePanel) scriptiePanel.style.display = 'flex';
        if (teamTab) { teamTab.style.background = 'transparent'; teamTab.style.borderColor = 'rgba(255,255,255,0.08)'; teamTab.style.color = 'var(--text-muted)'; teamTab.classList.remove('active'); }
        if (scriptieTab) { scriptieTab.style.background = 'rgba(212,175,122,0.15)'; scriptieTab.style.borderColor = 'rgba(212,175,122,0.4)'; scriptieTab.style.color = 'var(--accent-gold)'; scriptieTab.classList.add('active'); }
        localStorage.setItem('scriptieEnabled', 'true');
    } else {
        if (teamPanel) teamPanel.style.display = 'flex';
        if (scriptiePanel) scriptiePanel.style.display = 'none';
        if (teamTab) { teamTab.style.background = 'rgba(212,175,122,0.15)'; teamTab.style.borderColor = 'rgba(212,175,122,0.4)'; teamTab.style.color = 'var(--accent-gold)'; teamTab.classList.add('active'); }
        if (scriptieTab) { scriptieTab.style.background = 'transparent'; scriptieTab.style.borderColor = 'rgba(255,255,255,0.08)'; scriptieTab.style.color = 'var(--text-muted)'; scriptieTab.classList.remove('active'); }
        localStorage.setItem('scriptieEnabled', 'false');
    }
}

// Expose to window for HTML onclick handlers
window.chatAssistant = {
    toggle: toggleChatSidebar,
    toggleChatSidebar,
    handleSendMessage,
    clearChat,
    cancelRequest,
    askSuggestion,
    setMode,
    init: initChatAssistant
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatAssistant);
} else {
    // Delay slightly to ensure main.js has initialized
    setTimeout(initChatAssistant, 100);
}

export {
    initChatAssistant,
    toggleChatSidebar,
    clearChat,
    buildContextData
};
