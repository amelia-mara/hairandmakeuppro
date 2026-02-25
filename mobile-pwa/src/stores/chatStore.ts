import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { parseUserQuery, executeQuery } from '@/services/chatQueryRouter';
import {
  generateSystemPrompt,
  getProjectContext,
} from '@/services/chatSystemPrompt';

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
  sendMessage: (content: string) => Promise<void>;
}

const MAX_STORED_MESSAGES = 50;
const MAX_CONVERSATION_HISTORY = 10;
const MAX_TOKENS = 500;
const API_ENDPOINT = '/api/ai';

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

      sendMessage: async (content) => {
        const { addMessage, setLoading, setError } = get();

        // Add user message
        addMessage('user', content);
        setLoading(true);
        setError(null);

        try {
          // 1. Parse intent & extract parameters
          const parsed = parseUserQuery(content);

          // 2. Execute queries to get relevant data
          const queryResults = executeQuery(parsed);

          // 3. Build system prompt with cached project context
          const projectCtx = getProjectContext();
          const systemPrompt = generateSystemPrompt(projectCtx);

          // 4. Build conversation history (last N messages for context)
          const recentMessages = get()
            .messages.slice(-MAX_CONVERSATION_HISTORY)
            .map((m) => ({
              role: m.role,
              content: m.content,
            }));

          // 5. Compose the user turn with data context
          const userTurn =
            queryResults && queryResults !== 'No specific data matched for this query.'
              ? `[DATA CONTEXT]\n${queryResults}\n\n[USER QUESTION]\n${content}`
              : content;

          // Replace the last message (which is the raw user content) with the
          // enriched version for the API, but keep the original in history
          const messagesForApi = [
            ...recentMessages.slice(0, -1),
            { role: 'user' as const, content: userTurn },
          ];

          // 6. Call the API
          const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: messagesForApi,
              system: systemPrompt,
              maxTokens: MAX_TOKENS,
              model: 'claude-sonnet-4-20250514',
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `API error: ${response.status}`);
          }

          const data = await response.json();

          const assistantContent =
            data.content?.[0]?.text ||
            data.completion ||
            'Sorry, I could not generate a response.';

          addMessage('assistant', assistantContent);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to send message';
          setError(errorMessage);
          addMessage(
            'assistant',
            `Sorry, I encountered an error: ${errorMessage}`,
          );
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
