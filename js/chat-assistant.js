/**
 * Chat Assistant Component
 * A standalone AI chat assistant for screenplay production assistance
 * Uses Claude/Anthropic API
 */

(function() {
    'use strict';

    // Chat state
    const chatState = {
        isOpen: false,
        messages: [],
        isLoading: false
    };

    // Create chat UI elements
    function createChatUI() {
        // Chat toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'chat-assistant-toggle';
        toggleBtn.className = 'chat-assistant-toggle';
        toggleBtn.innerHTML = '<span class="chat-icon">💬</span>';
        toggleBtn.title = 'Open AI Assistant';
        toggleBtn.onclick = toggleChat;

        // Chat container
        const container = document.createElement('div');
        container.id = 'chat-assistant-container';
        container.className = 'chat-assistant-container';
        container.innerHTML = `
            <div class="chat-assistant-header">
                <span class="chat-assistant-title">AI Assistant</span>
                <button class="chat-assistant-close" onclick="window.chatAssistant.close()">×</button>
            </div>
            <div class="chat-assistant-messages" id="chat-assistant-messages">
                <div class="chat-message assistant">
                    <div class="chat-message-content">
                        Hello! I'm your AI assistant for screenplay production. I can help with:
                        <ul>
                            <li>Hair & makeup continuity questions</li>
                            <li>Character appearance tracking</li>
                            <li>Scene breakdown assistance</li>
                            <li>Production planning</li>
                        </ul>
                        How can I help you today?
                    </div>
                </div>
            </div>
            <div class="chat-assistant-input-area">
                <textarea
                    id="chat-assistant-input"
                    class="chat-assistant-input"
                    placeholder="Ask me anything..."
                    rows="2"
                ></textarea>
                <button id="chat-assistant-send" class="chat-assistant-send" onclick="window.chatAssistant.send()">
                    Send
                </button>
            </div>
        `;

        document.body.appendChild(toggleBtn);
        document.body.appendChild(container);

        // Add enter key handler
        const input = document.getElementById('chat-assistant-input');
        if (input) {
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    window.chatAssistant.send();
                }
            });
        }
    }

    // Toggle chat open/closed
    function toggleChat() {
        chatState.isOpen = !chatState.isOpen;
        const container = document.getElementById('chat-assistant-container');
        const toggle = document.getElementById('chat-assistant-toggle');

        if (chatState.isOpen) {
            container.classList.add('open');
            toggle.classList.add('active');
            document.getElementById('chat-assistant-input').focus();
        } else {
            container.classList.remove('open');
            toggle.classList.remove('active');
        }
    }

    // Close chat
    function closeChat() {
        chatState.isOpen = false;
        const container = document.getElementById('chat-assistant-container');
        const toggle = document.getElementById('chat-assistant-toggle');
        container.classList.remove('open');
        toggle.classList.remove('active');
    }

    // Send message
    async function sendMessage() {
        const input = document.getElementById('chat-assistant-input');
        const message = input.value.trim();

        if (!message || chatState.isLoading) return;

        // Add user message to UI
        addMessageToUI('user', message);
        input.value = '';

        // Show loading indicator
        chatState.isLoading = true;
        const loadingId = addLoadingMessage();

        try {
            // Get API key from localStorage
            const apiKey = localStorage.getItem('anthropicApiKey') || localStorage.getItem('apiKey');

            if (!apiKey) {
                removeLoadingMessage(loadingId);
                addMessageToUI('assistant', 'Please configure your API key in AI Settings first.');
                chatState.isLoading = false;
                return;
            }

            // Build context from current state if available
            let contextInfo = '';
            if (window.state && window.state.currentScene !== null && window.state.scenes) {
                const scene = window.state.scenes[window.state.currentScene];
                if (scene) {
                    contextInfo = `\n\nCurrent context: Viewing Scene ${window.state.currentScene + 1} - ${scene.heading || 'Untitled'}`;
                }
            }

            // Call Claude API
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: localStorage.getItem('anthropicModel') || 'claude-sonnet-4-20250514',
                    max_tokens: 1024,
                    temperature: 0.7,
                    system: `You are a helpful AI assistant specializing in film/TV production, particularly hair and makeup continuity. You help with screenplay breakdowns, character appearance tracking, and production planning. Be concise but thorough in your responses.${contextInfo}`,
                    messages: [{
                        role: 'user',
                        content: message
                    }]
                })
            });

            removeLoadingMessage(loadingId);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `API error: ${response.status}`);
            }

            const data = await response.json();
            const assistantMessage = data.content[0].text;

            addMessageToUI('assistant', assistantMessage);

        } catch (error) {
            removeLoadingMessage(loadingId);
            console.error('Chat error:', error);
            addMessageToUI('assistant', `Error: ${error.message}`);
        }

        chatState.isLoading = false;
    }

    // Add message to UI
    function addMessageToUI(role, content) {
        const messagesContainer = document.getElementById('chat-assistant-messages');
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${role}`;
        messageEl.innerHTML = `<div class="chat-message-content">${escapeHtml(content)}</div>`;
        messagesContainer.appendChild(messageEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Add loading message
    function addLoadingMessage() {
        const messagesContainer = document.getElementById('chat-assistant-messages');
        const loadingEl = document.createElement('div');
        const loadingId = 'loading-' + Date.now();
        loadingEl.id = loadingId;
        loadingEl.className = 'chat-message assistant loading';
        loadingEl.innerHTML = '<div class="chat-message-content"><span class="loading-dots">Thinking<span>.</span><span>.</span><span>.</span></span></div>';
        messagesContainer.appendChild(loadingEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return loadingId;
    }

    // Remove loading message
    function removeLoadingMessage(loadingId) {
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) {
            loadingEl.remove();
        }
    }

    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/\n/g, '<br>');
    }

    // Initialize on DOM ready
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createChatUI);
        } else {
            createChatUI();
        }
    }

    // Expose public API
    window.chatAssistant = {
        toggle: toggleChat,
        close: closeChat,
        send: sendMessage,
        init: init
    };

    // Auto-initialize
    init();

})();
