/**
 * Chat Assistant Component
 * AI Project Specialist for Hair & Makeup Pro
 * Uses Claude API with full project data context
 */

(function() {
    'use strict';

    // Chat state
    const chatState = {
        isOpen: false,
        messages: [],
        isLoading: false,
        hasApiKey: false
    };

    // Constants
    const STORAGE_KEY = 'chatAssistantMessages';
    const MAX_STORED_MESSAGES = 50;
    const MAX_CONTEXT_SCENES = 30;
    const MAX_CONTEXT_BREAKDOWNS = 20;

    /**
     * Initialize chat assistant
     */
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setup);
        } else {
            setup();
        }
    }

    function setup() {
        loadMessages();
        checkApiKey();
        createChatUI();
    }

    /**
     * Check if API key is configured
     */
    function checkApiKey() {
        const apiKey = localStorage.getItem('anthropicApiKey') || localStorage.getItem('apiKey');
        chatState.hasApiKey = !!apiKey;
    }

    /**
     * Load messages from localStorage
     */
    function loadMessages() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                chatState.messages = JSON.parse(stored).filter(m => m && m.role && m.content);
            }
        } catch (e) {
            console.warn('Failed to load chat messages:', e);
            chatState.messages = [];
        }
    }

    /**
     * Save messages to localStorage
     */
    function saveMessages() {
        try {
            const toStore = chatState.messages.slice(-MAX_STORED_MESSAGES);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
        } catch (e) {
            console.warn('Failed to save chat messages:', e);
        }
    }

    /**
     * Create chat UI elements
     */
    function createChatUI() {
        // Toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'chat-assistant-toggle';
        toggleBtn.className = 'chat-assistant-toggle';
        toggleBtn.innerHTML = '<span class="chat-icon">💬</span>';
        toggleBtn.title = 'Open Claude Assistant';
        toggleBtn.onclick = toggleChat;

        // Chat container
        const container = document.createElement('div');
        container.id = 'chat-assistant-container';
        container.className = 'chat-assistant-container';
        container.innerHTML = buildChatHTML();

        document.body.appendChild(toggleBtn);
        document.body.appendChild(container);

        // Setup event listeners
        setupEventListeners();
    }

    /**
     * Build chat HTML structure
     */
    function buildChatHTML() {
        const hasMessages = chatState.messages.length > 0;

        return `
            <div class="chat-assistant-header">
                <div class="chat-assistant-header-left">
                    <div class="chat-assistant-status ${chatState.hasApiKey ? '' : 'error'}"></div>
                    <span class="chat-assistant-title">Claude Assistant</span>
                </div>
                <div class="chat-assistant-header-actions">
                    <button class="chat-assistant-header-btn" onclick="window.chatAssistant.clear()" title="Clear chat">🗑</button>
                    <button class="chat-assistant-header-btn" onclick="window.chatAssistant.close()" title="Close">✕</button>
                </div>
            </div>
            ${!chatState.hasApiKey ? `
                <div class="chat-assistant-warning">
                    <span>⚠</span>
                    <span>API key not configured. <a href="#" onclick="openSettingsModal && openSettingsModal(); return false;">Open Settings</a></span>
                </div>
            ` : ''}
            ${hasMessages ? `
                <div class="chat-assistant-messages" id="chat-assistant-messages"></div>
            ` : `
                <div class="chat-assistant-welcome" id="chat-assistant-welcome">
                    <div class="chat-assistant-welcome-icon">🎬</div>
                    <div class="chat-assistant-welcome-title">Project Assistant</div>
                    <div class="chat-assistant-welcome-text">
                        I have access to your entire project data including scenes, characters, breakdowns, and continuity events. How can I help?
                    </div>
                    <div class="chat-assistant-suggestions">
                        <button class="chat-assistant-suggestion" onclick="window.chatAssistant.sendSuggestion('Give me an overview of all characters in this project')">
                            Overview of all characters
                        </button>
                        <button class="chat-assistant-suggestion" onclick="window.chatAssistant.sendSuggestion('What continuity events should I track across scenes?')">
                            Continuity tracking summary
                        </button>
                        <button class="chat-assistant-suggestion" onclick="window.chatAssistant.sendSuggestion('Which scenes have the most complex hair and makeup requirements?')">
                            Complex H&M scenes
                        </button>
                    </div>
                </div>
            `}
            <div class="chat-assistant-input-area">
                <textarea
                    id="chat-assistant-input"
                    class="chat-assistant-input"
                    placeholder="Ask about your project..."
                    rows="1"
                ></textarea>
                <button id="chat-assistant-send" class="chat-assistant-send" onclick="window.chatAssistant.send()">
                    Send
                </button>
            </div>
        `;
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        const input = document.getElementById('chat-assistant-input');
        if (input) {
            // Enter to send (shift+enter for newline)
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });

            // Auto-resize textarea
            input.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 100) + 'px';
            });
        }

        // Render existing messages if any
        if (chatState.messages.length > 0) {
            renderMessages();
        }
    }

    /**
     * Toggle chat open/close
     */
    function toggleChat() {
        chatState.isOpen = !chatState.isOpen;
        const container = document.getElementById('chat-assistant-container');
        const toggle = document.getElementById('chat-assistant-toggle');

        if (chatState.isOpen) {
            checkApiKey();
            container.classList.add('open');
            toggle.classList.add('active');

            // Focus input
            setTimeout(() => {
                const input = document.getElementById('chat-assistant-input');
                if (input) input.focus();
            }, 100);

            // Scroll to bottom
            const messages = document.getElementById('chat-assistant-messages');
            if (messages) {
                messages.scrollTop = messages.scrollHeight;
            }
        } else {
            container.classList.remove('open');
            toggle.classList.remove('active');
        }
    }

    /**
     * Close chat
     */
    function closeChat() {
        chatState.isOpen = false;
        const container = document.getElementById('chat-assistant-container');
        const toggle = document.getElementById('chat-assistant-toggle');
        container.classList.remove('open');
        toggle.classList.remove('active');
    }

    /**
     * Clear chat history
     */
    function clearChat() {
        chatState.messages = [];
        saveMessages();

        // Rebuild UI
        const container = document.getElementById('chat-assistant-container');
        if (container) {
            container.innerHTML = buildChatHTML();
            setupEventListeners();
        }
    }

    /**
     * Send a suggestion prompt
     */
    function sendSuggestion(text) {
        const input = document.getElementById('chat-assistant-input');
        if (input) {
            input.value = text;
            sendMessage();
        }
    }

    /**
     * Send message
     */
    async function sendMessage() {
        const input = document.getElementById('chat-assistant-input');
        const message = input ? input.value.trim() : '';

        if (!message || chatState.isLoading) return;

        checkApiKey();
        if (!chatState.hasApiKey) {
            addMessage('assistant', 'Please configure your Anthropic API key in AI Settings first.');
            return;
        }

        // Clear input
        input.value = '';
        input.style.height = 'auto';

        // Switch from welcome to messages view if needed
        const welcome = document.getElementById('chat-assistant-welcome');
        if (welcome) {
            welcome.outerHTML = '<div class="chat-assistant-messages" id="chat-assistant-messages"></div>';
        }

        // Add user message
        addMessage('user', message);

        // Show typing indicator
        chatState.isLoading = true;
        showTypingIndicator();
        updateSendButton();

        try {
            const response = await callClaudeAPI(message);
            hideTypingIndicator();
            addMessage('assistant', response);
        } catch (error) {
            hideTypingIndicator();
            console.error('Chat error:', error);

            let errorMsg = 'Sorry, I encountered an error. ';
            if (error.message.includes('401')) {
                errorMsg += 'Your API key appears to be invalid. Please check your settings.';
            } else if (error.message.includes('429')) {
                errorMsg += 'Rate limit exceeded. Please wait a moment and try again.';
            } else {
                errorMsg += error.message;
            }
            addMessage('assistant', errorMsg);
        }

        chatState.isLoading = false;
        updateSendButton();
    }

    /**
     * Add message to chat
     */
    function addMessage(role, content) {
        chatState.messages.push({ role, content });
        saveMessages();
        renderMessages();
    }

    /**
     * Render all messages
     */
    function renderMessages() {
        const container = document.getElementById('chat-assistant-messages');
        if (!container) return;

        container.innerHTML = chatState.messages.map(msg => `
            <div class="chat-message ${msg.role}">
                <div class="chat-message-content">${formatMessage(msg.content)}</div>
            </div>
        `).join('');

        container.scrollTop = container.scrollHeight;
    }

    /**
     * Format message with basic markdown
     */
    function formatMessage(content) {
        if (!content) return '';

        let formatted = content
            // Escape HTML
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Line breaks
            .replace(/\n/g, '<br>');

        // Simple list handling
        formatted = formatted.replace(/^- (.+)$/gm, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

        return formatted;
    }

    /**
     * Show typing indicator
     */
    function showTypingIndicator() {
        const container = document.getElementById('chat-assistant-messages');
        if (!container) return;

        const indicator = document.createElement('div');
        indicator.id = 'typing-indicator';
        indicator.className = 'chat-message assistant typing';
        indicator.innerHTML = `
            <div class="chat-message-content">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        `;
        container.appendChild(indicator);
        container.scrollTop = container.scrollHeight;
    }

    /**
     * Hide typing indicator
     */
    function hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
    }

    /**
     * Update send button state
     */
    function updateSendButton() {
        const btn = document.getElementById('chat-assistant-send');
        if (btn) {
            btn.disabled = chatState.isLoading;
            btn.textContent = chatState.isLoading ? '...' : 'Send';
        }
    }

    /**
     * Call Claude API with project context
     */
    async function callClaudeAPI(userMessage) {
        const apiKey = localStorage.getItem('anthropicApiKey') || localStorage.getItem('apiKey');
        const model = localStorage.getItem('anthropicModel') || 'claude-sonnet-4-20250514';

        if (!apiKey) {
            throw new Error('API key not configured');
        }

        // Build project context
        const projectContext = buildProjectContext();

        // Build system prompt
        const systemPrompt = `You are the AI Project Specialist for this film/TV production, integrated into Hair & Makeup Pro. You have comprehensive knowledge of the entire project including:

- Script content and scene details
- All characters and their profiles
- Scene breakdowns (hair, makeup, SFX, wardrobe, injuries)
- Continuity events and tracking
- Character looks and transitions
- Budget information
- Production tags and notes

Your role:
1. Answer ANY question about the project using the data provided
2. Help with continuity tracking and identify potential issues
3. Assist with character appearance planning across scenes
4. Provide scene-specific information when asked
5. Help analyze patterns (which characters appear together, scene locations, etc.)
6. Support budget and resource planning

Be specific and reference actual scene numbers, character names, and data from the project. If you don't have data for something, say so clearly. Keep responses concise but informative.

========== PROJECT DATA ==========
${projectContext}
========== END PROJECT DATA ==========`;

        // Build messages array with recent history for context
        const recentMessages = chatState.messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
        }));

        // Add current message
        const messages = [
            ...recentMessages.filter(m => m.content), // Filter out empty messages
            { role: 'user', content: userMessage }
        ];

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: model,
                max_tokens: 2048,
                system: systemPrompt,
                messages: messages
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API error: ${response.status}`);
        }

        const data = await response.json();
        return data.content[0].text;
    }

    /**
     * Build project context from all available data sources
     */
    function buildProjectContext() {
        let context = '';

        // Try to get data from window.state first (script-breakdown page)
        const state = window.state;

        // Also try localStorage for when on other pages
        let storedProject = null;
        try {
            const stored = localStorage.getItem('scriptBreakdownProject');
            if (stored) {
                storedProject = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Could not parse stored project:', e);
        }

        // Scenes data
        const scenes = state?.scenes || storedProject?.scenes || [];
        if (scenes.length > 0) {
            context += `=== SCRIPT DATA ===\nTotal Scenes: ${scenes.length}\n\nSCENE LIST:\n`;
            scenes.slice(0, MAX_CONTEXT_SCENES).forEach((scene, idx) => {
                const heading = scene.heading || scene.text || `Scene ${idx + 1}`;
                const synopsis = scene.synopsis ? ` - ${scene.synopsis.substring(0, 100)}...` : '';
                context += `Scene ${idx + 1}: ${heading}${synopsis}\n`;
            });
            if (scenes.length > MAX_CONTEXT_SCENES) {
                context += `... and ${scenes.length - MAX_CONTEXT_SCENES} more scenes\n`;
            }
            context += '\n';
        }

        // Characters
        const characters = state?.confirmedCharacters || state?.characters || storedProject?.confirmedCharacters || storedProject?.characters;
        if (characters) {
            const charArray = characters instanceof Set ? Array.from(characters) :
                              Array.isArray(characters) ? characters : Object.keys(characters);
            if (charArray.length > 0) {
                context += `=== CHARACTERS (${charArray.length}) ===\n${charArray.join(', ')}\n\n`;
            }
        }

        // Cast profiles
        const castProfiles = state?.castProfiles || storedProject?.castProfiles;
        if (castProfiles && Object.keys(castProfiles).length > 0) {
            context += `=== CHARACTER PROFILES ===\n`;
            Object.entries(castProfiles).slice(0, 15).forEach(([name, profile]) => {
                context += `${name}:\n`;
                if (profile.baseDescription) {
                    context += `  Description: ${profile.baseDescription.substring(0, 150)}\n`;
                }
                if (profile.scenes && profile.scenes.length > 0) {
                    context += `  Appears in scenes: ${profile.scenes.slice(0, 10).join(', ')}${profile.scenes.length > 10 ? '...' : ''}\n`;
                }
            });
            context += '\n';
        }

        // Scene breakdowns
        const breakdowns = state?.sceneBreakdowns || storedProject?.sceneBreakdowns;
        if (breakdowns && Object.keys(breakdowns).length > 0) {
            context += `=== SCENE BREAKDOWNS ===\n`;
            const breakdownKeys = Object.keys(breakdowns).slice(0, MAX_CONTEXT_BREAKDOWNS);
            breakdownKeys.forEach(sceneIdx => {
                const bd = breakdowns[sceneIdx];
                if (!bd) return;

                context += `Scene ${parseInt(sceneIdx) + 1}:\n`;

                if (bd.cast && bd.cast.length > 0) {
                    context += `  Cast: ${bd.cast.join(', ')}\n`;
                }
                if (bd.hair && bd.hair.length > 0) {
                    context += `  Hair: ${bd.hair.map(h => h.description || h).join('; ')}\n`;
                }
                if (bd.makeup && bd.makeup.length > 0) {
                    context += `  Makeup: ${bd.makeup.map(m => m.description || m).join('; ')}\n`;
                }
                if (bd.sfx && bd.sfx.length > 0) {
                    context += `  SFX: ${bd.sfx.map(s => s.description || s).join('; ')}\n`;
                }
                if (bd.wardrobe && bd.wardrobe.length > 0) {
                    context += `  Wardrobe: ${bd.wardrobe.map(w => w.description || w).join('; ')}\n`;
                }
                if (bd.injuries && bd.injuries.length > 0) {
                    context += `  Injuries: ${bd.injuries.map(i => i.description || i).join('; ')}\n`;
                }
            });
            if (Object.keys(breakdowns).length > MAX_CONTEXT_BREAKDOWNS) {
                context += `... and ${Object.keys(breakdowns).length - MAX_CONTEXT_BREAKDOWNS} more scene breakdowns\n`;
            }
            context += '\n';
        }

        // Continuity events
        const continuityEvents = state?.continuityEvents || storedProject?.continuityEvents;
        if (continuityEvents) {
            const allEvents = Array.isArray(continuityEvents) ? continuityEvents :
                Object.values(continuityEvents).flat();

            if (allEvents.length > 0) {
                context += `=== CONTINUITY EVENTS (${allEvents.length}) ===\n`;
                allEvents.slice(0, 15).forEach(event => {
                    if (!event) return;
                    context += `${event.name || 'Unnamed'} (${event.character || 'Unknown'}):\n`;
                    context += `  Category: ${event.category || 'general'}\n`;
                    if (event.startScene !== undefined && event.endScene !== undefined) {
                        context += `  Scenes: ${event.startScene} to ${event.endScene}\n`;
                    }
                    if (event.observations && Object.keys(event.observations).length > 0) {
                        context += `  Observations:\n`;
                        Object.entries(event.observations).slice(0, 5).forEach(([scene, obs]) => {
                            context += `    Scene ${scene}: ${obs.substring(0, 80)}...\n`;
                        });
                    }
                });
                context += '\n';
            }
        }

        // Character looks
        const characterLooks = state?.characterLooks || storedProject?.characterLooks;
        if (characterLooks && Object.keys(characterLooks).length > 0) {
            context += `=== CHARACTER LOOKS ===\n`;
            Object.entries(characterLooks).slice(0, 10).forEach(([char, looks]) => {
                context += `${char}:\n`;
                if (Array.isArray(looks)) {
                    looks.slice(0, 5).forEach(look => {
                        const scenes = look.scenes ? ` (Scenes: ${look.scenes.slice(0, 5).join(', ')})` : '';
                        context += `  - ${look.name || 'Unnamed look'}${scenes}\n`;
                    });
                }
            });
            context += '\n';
        }

        // Tags
        const scriptTags = state?.scriptTags || storedProject?.scriptTags;
        if (scriptTags && Object.keys(scriptTags).length > 0) {
            const allTags = Object.values(scriptTags).flat();
            const tagCounts = {};
            allTags.forEach(tag => {
                if (tag && tag.category) {
                    tagCounts[tag.category] = (tagCounts[tag.category] || 0) + 1;
                }
            });

            if (Object.keys(tagCounts).length > 0) {
                context += `=== TAGS ===\nTotal tags: ${allTags.length}\n`;
                context += `By category: ${Object.entries(tagCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}\n\n`;
            }
        }

        // Budget data
        let budgetData = null;
        try {
            budgetData = JSON.parse(localStorage.getItem('budgetData') || localStorage.getItem('hmBudgetData') || 'null');
        } catch (e) {}

        if (budgetData) {
            context += `=== BUDGET ===\n`;
            if (budgetData.totalBudget) context += `Total Budget: $${budgetData.totalBudget.toLocaleString()}\n`;
            if (budgetData.spent) context += `Spent: $${budgetData.spent.toLocaleString()}\n`;
            if (budgetData.remaining) context += `Remaining: $${budgetData.remaining.toLocaleString()}\n`;
            context += '\n';
        }

        // If no data found
        if (!context.trim()) {
            context = 'No project data currently loaded. The user may need to import a script or load a project first.';
        }

        return context;
    }

    // Expose public API
    window.chatAssistant = {
        init: init,
        open: function() { if (!chatState.isOpen) toggleChat(); },
        close: closeChat,
        toggle: toggleChat,
        clear: clearChat,
        send: sendMessage,
        sendSuggestion: sendSuggestion
    };

    // Auto-initialize
    init();

})();
