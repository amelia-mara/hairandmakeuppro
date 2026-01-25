import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useProjectStore } from '@/stores/projectStore';
import { useTimesheetStore } from '@/stores/timesheetStore';

// Suggestion prompts for quick start
const SUGGESTIONS = [
  {
    label: 'Character overview',
    prompt: 'Give me an overview of all characters and their looks in this project',
  },
  {
    label: 'Continuity tracking',
    prompt: 'What continuity events should I track across scenes?',
  },
  {
    label: 'Complex H&MU scenes',
    prompt: 'Which scenes have the most complex hair and makeup requirements?',
  },
];

export function ChatAssistant() {
  const {
    messages,
    isOpen,
    isLoading,
    error,
    toggleChat,
    closeChat,
    sendMessage,
    clearMessages,
  } = useChatStore();

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Build context from stores
  const buildContext = () => {
    const projectStore = useProjectStore.getState();
    const timesheetStore = useTimesheetStore.getState();

    const parts: string[] = [];

    // Project info
    if (projectStore.currentProject) {
      const project = projectStore.currentProject;
      parts.push(`Project: ${project.name}`);
      parts.push(`Characters: ${project.characters.length}`);
      parts.push(`Scenes: ${project.scenes.length}`);
      parts.push(`Looks: ${project.looks.length}`);

      // Character details
      if (project.characters.length > 0) {
        parts.push('\nCharacters:');
        project.characters.slice(0, 10).forEach((char) => {
          const charLooks = project.looks.filter((l) => l.characterId === char.id);
          parts.push(`- ${char.name} (${char.initials}): ${charLooks.length} looks`);
        });
      }

      // Scene status
      const completedScenes = project.scenes.filter((s) => s.isComplete).length;
      parts.push(`\nScenes: ${completedScenes}/${project.scenes.length} complete`);
    }

    // Timesheet summary
    const entries = Object.values(timesheetStore.entries);
    if (entries.length > 0) {
      const totalHours = entries.reduce((sum, entry) => {
        const calc = timesheetStore.calculateEntry(entry);
        return sum + calc.totalHours;
      }, 0);
      parts.push(`\nTimesheet: ${entries.length} days logged, ${totalHours.toFixed(1)} total hours`);
    }

    return parts.join('\n') || 'No project data available yet.';
  };

  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content || isLoading) return;

    setInputValue('');
    const context = buildContext();
    await sendMessage(content, context);
  };

  const handleSuggestionClick = (prompt: string) => {
    setInputValue(prompt);
    // Auto-send the suggestion
    const context = buildContext();
    sendMessage(prompt, context);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Format message content with basic markdown
  const formatContent = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-black/20 px-1 rounded text-sm">$1</code>')
      .replace(/\n/g, '<br />');
  };

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={toggleChat}
        className={`fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 ${
          isOpen ? 'gold-gradient rotate-0' : 'gold-gradient'
        }`}
        style={{
          boxShadow: '0 4px 20px rgba(201, 169, 97, 0.4)',
        }}
        aria-label={isOpen ? 'Close chat' : 'Open chat assistant'}
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        )}
      </button>

      {/* Chat Panel - z-30 to stay below BottomNav (z-40) so users can navigate away */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 flex flex-col"
          style={{ backgroundColor: 'var(--color-background)' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 safe-top"
            style={{
              backgroundColor: 'var(--color-card)',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Claude Assistant
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearMessages}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
                title="Clear chat"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
              <button
                onClick={closeChat}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {!hasMessages ? (
              // Welcome screen
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="text-5xl mb-4">🎬</div>
                <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Project Assistant
                </h3>
                <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
                  I have access to your project data including characters, looks, scenes, and timesheets. How can I help?
                </p>

                {/* Suggestions */}
                <div className="space-y-2 w-full max-w-sm">
                  {SUGGESTIONS.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(suggestion.prompt)}
                      className="w-full p-3 rounded-card text-left transition-all active:scale-[0.98]"
                      style={{
                        backgroundColor: 'var(--color-card)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {suggestion.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // Messages list
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'gold-gradient text-white rounded-br-sm'
                          : 'rounded-bl-sm'
                      }`}
                      style={
                        message.role === 'assistant'
                          ? {
                              backgroundColor: 'var(--color-card)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }
                          : undefined
                      }
                    >
                      <div
                        className="text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
                      />
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex justify-start">
                    <div
                      className="rounded-2xl rounded-bl-sm px-4 py-3"
                      style={{
                        backgroundColor: 'var(--color-card)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <div className="flex gap-1">
                        <span
                          className="w-2 h-2 rounded-full animate-bounce"
                          style={{ backgroundColor: 'var(--color-text-muted)', animationDelay: '0ms' }}
                        />
                        <span
                          className="w-2 h-2 rounded-full animate-bounce"
                          style={{ backgroundColor: 'var(--color-text-muted)', animationDelay: '150ms' }}
                        />
                        <span
                          className="w-2 h-2 rounded-full animate-bounce"
                          style={{ backgroundColor: 'var(--color-text-muted)', animationDelay: '300ms' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <div className="text-center py-2">
                    <span className="text-sm text-error">{error}</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area - extra bottom padding to sit above BottomNav */}
          <div
            className="px-4 pt-3 pb-24"
            style={{
              backgroundColor: 'var(--color-card)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your project..."
                rows={1}
                className="flex-1 input-field resize-none max-h-32"
                style={{ minHeight: '44px' }}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className="p-3 rounded-button gold-gradient text-white disabled:opacity-50 transition-all active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
