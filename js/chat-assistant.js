/**
 * Chat Assistant - Global AI Assistant for Hair & Makeup Pro
 * Uses Claude API for intelligent conversations about scripts and continuity
 */

(function() {
    'use strict';

    // Chat state
    const chatState = {
        isOpen: false,
        isMinimized: false,
        messages: [],
        isLoading: false
    };

    // Storage keys
    const STORAGE_KEYS = {
        MESSAGES: 'chatAssistantMessages',
        API_KEY: 'anthropicApiKey',
        MODEL: 'anthropicModel'
    };

    // Default model
    const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

    /**
     * Initialize the chat assistant
     */
    function init() {
        // Load saved messages
        loadMessages();

        // Create chat UI
        createChatUI();

        // Set up event listeners
        setupEventListeners();

        console.log('Chat Assistant initialized');
    }

    /**
     * Create the chat UI elements
     */
    function createChatUI() {
        // Create chat container
        const chatContainer = document.createElement('div');
        chatContainer.id = 'chat-assistant-container';
        chatContainer.className = 'chat-assistant-container';
        chatContainer.innerHTML = `
            <!-- Chat Toggle Button -->
            <button id="chat-toggle-btn" class="chat-toggle-btn" title="Chat with Claude Assistant">
                <svg class="chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span class="chat-badge" style="display: none;">0</span>
            </button>

            <!-- Chat Window -->
            <div id="chat-window" class="chat-window" style="display: none;">
                <div class="chat-header">
                    <div class="chat-header-info">
                        <div class="chat-header-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                <line x1="15" y1="9" x2="15.01" y2="9"></line>
                            </svg>
                        </div>
                        <div class="chat-header-text">
                            <div class="chat-header-title">Claude Assistant</div>
                            <div class="chat-header-status" id="chat-status">Ready to help</div>
                        </div>
                    </div>
                    <div class="chat-header-actions">
                        <button class="chat-header-btn" id="chat-clear-btn" title="Clear conversation">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                        <button class="chat-header-btn" id="chat-minimize-btn" title="Minimize">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                        <button class="chat-header-btn" id="chat-close-btn" title="Close">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="chat-messages" id="chat-messages">
                    <div class="chat-welcome">
                        <div class="chat-welcome-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                <line x1="15" y1="9" x2="15.01" y2="9"></line>
                            </svg>
                        </div>
                        <h3>Welcome to Claude Assistant</h3>
                        <p>I can help you with script analysis, continuity tracking, character breakdowns, and more. Ask me anything about your production!</p>
                        <div class="chat-suggestions">
                            <button class="chat-suggestion" data-prompt="Summarize the main character arcs in my script">Summarize character arcs</button>
                            <button class="chat-suggestion" data-prompt="What continuity issues should I watch for?">Check continuity</button>
                            <button class="chat-suggestion" data-prompt="Help me create a makeup continuity plan">Makeup planning</button>
                        </div>
                    </div>
                </div>

                <div class="chat-input-area">
                    <div class="chat-api-warning" id="chat-api-warning" style="display: none;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <span>No API key configured. <a href="#" id="open-settings-link">Set up in AI Settings</a></span>
                    </div>
                    <div class="chat-input-wrapper">
                        <textarea
                            id="chat-input"
                            class="chat-input"
                            placeholder="Ask Claude anything..."
                            rows="1"
                        ></textarea>
                        <button id="chat-send-btn" class="chat-send-btn" title="Send message">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(chatContainer);
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Toggle button
        document.getElementById('chat-toggle-btn').addEventListener('click', toggleChat);

        // Close button
        document.getElementById('chat-close-btn').addEventListener('click', closeChat);

        // Minimize button
        document.getElementById('chat-minimize-btn').addEventListener('click', minimizeChat);

        // Clear button
        document.getElementById('chat-clear-btn').addEventListener('click', clearChat);

        // Send button
        document.getElementById('chat-send-btn').addEventListener('click', sendMessage);

        // Input handling
        const chatInput = document.getElementById('chat-input');
        chatInput.addEventListener('keydown', handleInputKeydown);
        chatInput.addEventListener('input', autoResizeInput);

        // Suggestion buttons
        document.querySelectorAll('.chat-suggestion').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.getAttribute('data-prompt');
                chatInput.value = prompt;
                sendMessage();
            });
        });

        // Settings link
        document.getElementById('open-settings-link').addEventListener('click', (e) => {
            e.preventDefault();
            openSettingsModal();
        });
    }

    /**
     * Toggle chat window
     */
    function toggleChat() {
        chatState.isOpen = !chatState.isOpen;
        const chatWindow = document.getElementById('chat-window');
        const toggleBtn = document.getElementById('chat-toggle-btn');

        if (chatState.isOpen) {
            chatWindow.style.display = 'flex';
            toggleBtn.classList.add('active');
            checkApiKey();
            renderMessages();
            // Focus input
            setTimeout(() => {
                document.getElementById('chat-input').focus();
            }, 100);
        } else {
            chatWindow.style.display = 'none';
            toggleBtn.classList.remove('active');
        }
    }

    /**
     * Close chat
     */
    function closeChat() {
        chatState.isOpen = false;
        document.getElementById('chat-window').style.display = 'none';
        document.getElementById('chat-toggle-btn').classList.remove('active');
    }

    /**
     * Minimize chat
     */
    function minimizeChat() {
        chatState.isMinimized = !chatState.isMinimized;
        const chatWindow = document.getElementById('chat-window');

        if (chatState.isMinimized) {
            chatWindow.classList.add('minimized');
        } else {
            chatWindow.classList.remove('minimized');
        }
    }

    /**
     * Clear chat history
     */
    function clearChat() {
        if (confirm('Clear all chat history?')) {
            chatState.messages = [];
            saveMessages();
            renderMessages();
        }
    }

    /**
     * Check if API key is configured
     */
    function checkApiKey() {
        const apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
        const warning = document.getElementById('chat-api-warning');

        if (!apiKey) {
            warning.style.display = 'flex';
        } else {
            warning.style.display = 'none';
        }
    }

    /**
     * Open settings modal (if available)
     */
    function openSettingsModal() {
        // Try to call the global function if it exists
        if (typeof window.openSettingsModal === 'function') {
            closeChat();
            window.openSettingsModal();
        } else {
            // Redirect to script breakdown page with settings
            window.location.href = 'script-breakdown.html?openSettings=true';
        }
    }

    /**
     * Handle input keydown
     */
    function handleInputKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    /**
     * Auto-resize input textarea
     */
    function autoResizeInput() {
        const input = document.getElementById('chat-input');
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    }

    /**
     * Send message to Claude
     */
    async function sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        if (!message || chatState.isLoading) return;

        const apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
        if (!apiKey) {
            showError('No Claude API key configured. Please set up AI Settings.');
            return;
        }

        // Add user message
        chatState.messages.push({
            role: 'user',
            content: message,
            timestamp: Date.now()
        });

        // Clear input
        input.value = '';
        input.style.height = 'auto';

        // Save and render
        saveMessages();
        renderMessages();

        // Set loading state
        chatState.isLoading = true;
        updateStatus('Thinking...');
        showTypingIndicator();

        try {
            // Call Claude API
            const response = await callClaudeAPI(message);

            // Add assistant message
            chatState.messages.push({
                role: 'assistant',
                content: response,
                timestamp: Date.now()
            });

            saveMessages();
            renderMessages();
            updateStatus('Ready to help');

        } catch (error) {
            console.error('Chat error:', error);
            showError(error.message);
            updateStatus('Error occurred');
        } finally {
            chatState.isLoading = false;
            hideTypingIndicator();
        }
    }

    /**
     * Call Claude API
     */
    async function callClaudeAPI(message) {
        const apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
        const model = localStorage.getItem(STORAGE_KEYS.MODEL) || DEFAULT_MODEL;

        // Build conversation context from history (already includes current message)
        // Filter out empty messages and limit to last 10
        const messages = chatState.messages
            .filter(m => m.content && m.content.trim())
            .slice(-10)
            .map(m => ({
                role: m.role,
                content: m.content
            }));

        // Ensure we have at least the current message
        if (messages.length === 0) {
            messages.push({ role: 'user', content: message });
        }

        // System prompt for context
        const systemPrompt = `You are a helpful AI assistant for Hair & Makeup Pro, a professional tool for film and TV production hair and makeup departments.

You help with:
- Script analysis and breakdown
- Continuity tracking for hair, makeup, wardrobe, and special effects
- Character appearance planning
- Production scheduling questions
- General production assistance

Be concise, professional, and helpful. When discussing script content, reference specific scenes and characters when relevant. Format responses with clear structure using markdown when helpful.`;

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
                max_tokens: 1024,
                system: systemPrompt,
                messages: messages
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Claude API error:', errorData);

            if (response.status === 401) {
                throw new Error('Invalid API key. Please check your Claude API key in settings.');
            }
            if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please wait a moment and try again.');
            }
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.content || !data.content[0]) {
            throw new Error('Invalid response from Claude');
        }

        return data.content[0].text;
    }

    /**
     * Render chat messages
     */
    function renderMessages() {
        const container = document.getElementById('chat-messages');

        if (chatState.messages.length === 0) {
            // Show welcome screen
            container.innerHTML = `
                <div class="chat-welcome">
                    <div class="chat-welcome-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                            <line x1="9" y1="9" x2="9.01" y2="9"></line>
                            <line x1="15" y1="9" x2="15.01" y2="9"></line>
                        </svg>
                    </div>
                    <h3>Welcome to Claude Assistant</h3>
                    <p>I can help you with script analysis, continuity tracking, character breakdowns, and more. Ask me anything about your production!</p>
                    <div class="chat-suggestions">
                        <button class="chat-suggestion" data-prompt="Summarize the main character arcs in my script">Summarize character arcs</button>
                        <button class="chat-suggestion" data-prompt="What continuity issues should I watch for?">Check continuity</button>
                        <button class="chat-suggestion" data-prompt="Help me create a makeup continuity plan">Makeup planning</button>
                    </div>
                </div>
            `;

            // Re-attach suggestion listeners
            container.querySelectorAll('.chat-suggestion').forEach(btn => {
                btn.addEventListener('click', () => {
                    const prompt = btn.getAttribute('data-prompt');
                    document.getElementById('chat-input').value = prompt;
                    sendMessage();
                });
            });
            return;
        }

        // Render messages
        let html = '';
        chatState.messages.forEach((msg, index) => {
            const isUser = msg.role === 'user';
            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            html += `
                <div class="chat-message ${isUser ? 'user' : 'assistant'}">
                    ${!isUser ? `
                        <div class="chat-message-avatar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                <line x1="15" y1="9" x2="15.01" y2="9"></line>
                            </svg>
                        </div>
                    ` : ''}
                    <div class="chat-message-content">
                        <div class="chat-message-text">${formatMessage(msg.content)}</div>
                        <div class="chat-message-time">${timeStr}</div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    /**
     * Format message content (basic markdown)
     */
    function formatMessage(content) {
        // Escape HTML
        let formatted = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Bold
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Italic
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Code blocks
        formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

        // Inline code
        formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');

        // Line breaks
        formatted = formatted.replace(/\n/g, '<br>');

        // Lists
        formatted = formatted.replace(/^- (.*?)(<br>|$)/gm, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');

        return formatted;
    }

    /**
     * Show typing indicator
     */
    function showTypingIndicator() {
        const container = document.getElementById('chat-messages');
        const indicator = document.createElement('div');
        indicator.id = 'typing-indicator';
        indicator.className = 'chat-message assistant';
        indicator.innerHTML = `
            <div class="chat-message-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                </svg>
            </div>
            <div class="chat-message-content">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
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
     * Update status text
     */
    function updateStatus(text) {
        document.getElementById('chat-status').textContent = text;
    }

    /**
     * Show error message
     */
    function showError(message) {
        // Add error message to chat
        chatState.messages.push({
            role: 'assistant',
            content: `**Error:** ${message}`,
            timestamp: Date.now(),
            isError: true
        });
        saveMessages();
        renderMessages();
    }

    /**
     * Load messages from storage
     */
    function loadMessages() {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Filter out any empty or invalid messages
                chatState.messages = parsed.filter(m =>
                    m && m.role && m.content && m.content.trim()
                );
                // Save cleaned version back
                if (chatState.messages.length !== parsed.length) {
                    saveMessages();
                }
            }
        } catch (e) {
            console.error('Failed to load chat messages:', e);
            chatState.messages = [];
        }
    }

    /**
     * Save messages to storage
     */
    function saveMessages() {
        try {
            // Keep only last 50 messages
            const toSave = chatState.messages.slice(-50);
            localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(toSave));
        } catch (e) {
            console.error('Failed to save chat messages:', e);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose for external use
    window.chatAssistant = {
        open: toggleChat,
        close: closeChat,
        clear: clearChat
    };

})();
