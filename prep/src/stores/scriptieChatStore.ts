/**
 * Scriptie chat store — per-project conversation with the
 * project-aware AI assistant. Persists message history to
 * localStorage so the conversation survives reloads.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * NOTE: scriptieContext is dynamically imported inside sendMessage
 * rather than statically at the top of this file. The context
 * builder pulls in the entire breakdownStore (1500+ lines, 10+
 * sub-stores) which historically broke the app at module-load
 * time when imported into App.tsx's tree (see commit defe77d).
 * Lazy-loading keeps the project landing page fast and side-step
 * the breakage entirely.
 */

export interface ScriptieMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ScriptieState {
  messagesByProject: Record<string, ScriptieMessage[]>;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;

  toggleOpen: () => void;
  open: () => void;
  close: () => void;
  getMessages: (projectId: string) => ScriptieMessage[];
  sendMessage: (projectId: string, content: string) => Promise<void>;
  clearMessages: (projectId: string) => void;
}

const MAX_STORED = 60;
const HISTORY_FOR_API = 12;
const MAX_TOKENS = 800;

export const useScriptieChatStore = create<ScriptieState>()(
  persist(
    (set, get) => ({
      messagesByProject: {},
      isOpen: false,
      isLoading: false,
      error: null,

      toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),

      getMessages: (projectId) => get().messagesByProject[projectId] ?? [],

      clearMessages: (projectId) =>
        set((s) => ({
          messagesByProject: { ...s.messagesByProject, [projectId]: [] },
          error: null,
        })),

      sendMessage: async (projectId, content) => {
        if (!content.trim() || get().isLoading) return;

        const userMsg: ScriptieMessage = {
          id: `msg-${Date.now()}-u`,
          role: 'user',
          content: content.trim(),
          timestamp: Date.now(),
        };

        // Append user message immediately so the UI is responsive.
        set((s) => {
          const existing = s.messagesByProject[projectId] ?? [];
          return {
            messagesByProject: {
              ...s.messagesByProject,
              [projectId]: [...existing, userMsg].slice(-MAX_STORED),
            },
            isLoading: true,
            error: null,
          };
        });

        try {
          // Lazy-import to avoid pulling breakdownStore into App.tsx's
          // initial bundle (see header note).
          const { buildScriptieContext } = await import('@/services/scriptieContext');
          const { prompt } = buildScriptieContext(projectId);

          // Conversation window — recent N messages including the
          // one we just appended.
          const history = (get().messagesByProject[projectId] ?? []).slice(-HISTORY_FOR_API);
          const messagesForApi = history.map((m) => ({
            role: m.role,
            content: m.content,
          }));

          const response = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: messagesForApi,
              system: prompt,
              maxTokens: MAX_TOKENS,
              model: 'claude-sonnet-4-20250514',
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || errorData.error || `API error: ${response.status}`);
          }

          const data = await response.json();
          const text =
            data.content?.[0]?.text || data.completion || 'Sorry, I couldn\'t generate a response.';

          const assistantMsg: ScriptieMessage = {
            id: `msg-${Date.now()}-a`,
            role: 'assistant',
            content: text,
            timestamp: Date.now(),
          };

          set((s) => {
            const existing = s.messagesByProject[projectId] ?? [];
            return {
              messagesByProject: {
                ...s.messagesByProject,
                [projectId]: [...existing, assistantMsg].slice(-MAX_STORED),
              },
              isLoading: false,
            };
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to reach Scriptie';
          const errorMsg: ScriptieMessage = {
            id: `msg-${Date.now()}-e`,
            role: 'assistant',
            content: `Sorry, I hit an error: ${message}`,
            timestamp: Date.now(),
          };
          set((s) => {
            const existing = s.messagesByProject[projectId] ?? [];
            return {
              messagesByProject: {
                ...s.messagesByProject,
                [projectId]: [...existing, errorMsg].slice(-MAX_STORED),
              },
              isLoading: false,
              error: message,
            };
          });
        }
      },
    }),
    {
      name: 'prep-scriptie-chat',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        messagesByProject: Object.fromEntries(
          Object.entries(s.messagesByProject).map(([k, v]) => [k, v.slice(-MAX_STORED)]),
        ),
      }),
    },
  ),
);
