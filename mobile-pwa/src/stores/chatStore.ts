import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatState {
  // Data
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  sendMessage: (content: string, context: string) => Promise<void>;
}

const MAX_STORED_MESSAGES = 50;
const API_ENDPOINT = '/api/ai';

// System prompt for mobile H&MU assistant
const SYSTEM_PROMPT = `You are Claude, an AI assistant specialized in film and television hair, makeup, and continuity production. You're helping a hair and makeup professional manage their work on set.

You have access to their project data including:
- Characters and their looks
- Scene breakdowns with H&MU requirements
- Continuity tracking and events
- Timesheet and hours data
- Budget information

Be helpful, concise, and production-focused. Use industry terminology appropriately. When discussing looks or continuity, be specific about products, techniques, and timing.

Keep responses focused and practical - these users are often on set and need quick, actionable information.`;

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Initial state
      messages: [],
      isOpen: false,
      isLoading: false,
      error: null,

      // Actions
      toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
      openChat: () => set({ isOpen: true }),
      closeChat: () => set({ isOpen: false }),

      addMessage: (role, content) => {
        const message: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role,
          content,
          timestamp: new Date(),
        };
        set((state) => ({
          messages: [...state.messages.slice(-MAX_STORED_MESSAGES + 1), message],
        }));
      },

      clearMessages: () => set({ messages: [], error: null }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      sendMessage: async (content, context) => {
        const { addMessage, setLoading, setError } = get();

        // Add user message
        addMessage('user', content);
        setLoading(true);
        setError(null);

        try {
          // Build messages array for API (last 10 messages for context)
          const recentMessages = get().messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          }));

          // Build full system prompt with context
          const fullSystemPrompt = `${SYSTEM_PROMPT}

Current Project Context:
${context}`;

          const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: recentMessages,
              system: fullSystemPrompt,
              maxTokens: 1024,
              model: 'claude-sonnet-4-20250514',
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API error: ${response.status}`);
          }

          const data = await response.json();

          // Extract response text from Claude API response
          const assistantContent =
            data.content?.[0]?.text ||
            data.completion ||
            'Sorry, I could not generate a response.';

          addMessage('assistant', assistantContent);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
          setError(errorMessage);
          addMessage('assistant', `Sorry, I encountered an error: ${errorMessage}`);
        } finally {
          setLoading(false);
        }
      },
    }),
    {
      name: 'hair-makeup-chat-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        messages: state.messages.slice(-MAX_STORED_MESSAGES),
      }),
    }
  )
);
