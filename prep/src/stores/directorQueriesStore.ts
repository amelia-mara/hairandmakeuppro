/**
 * Director Queries Store — Prep-only, not synced to mobile.
 *
 * Stores per-scene questions for the director when the script isn't clear.
 * Persisted to localStorage only. These are temporary flags that get
 * resolved in pre-production and are not part of the breakdown data
 * that flows to the mobile app.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DirectorQuery {
  id: string;
  text: string;
  resolved: boolean;
  createdAt: string;
}

interface DirectorQueriesState {
  queries: Record<string, DirectorQuery[]>; // keyed by sceneId
  getQueries: (sceneId: string) => DirectorQuery[];
  addQuery: (sceneId: string, text: string) => void;
  updateQuery: (sceneId: string, queryId: string, text: string) => void;
  toggleResolved: (sceneId: string, queryId: string) => void;
  removeQuery: (sceneId: string, queryId: string) => void;
  getAllUnresolved: () => { sceneId: string; query: DirectorQuery }[];
}

const storeCache = new Map<string, ReturnType<typeof createStore>>();

function createStore(projectId: string) {
  return create<DirectorQueriesState>()(
    persist(
      (set, get) => ({
        queries: {},

        getQueries: (sceneId) => get().queries[sceneId] || [],

        addQuery: (sceneId, text) => {
          const q: DirectorQuery = {
            id: crypto.randomUUID(),
            text,
            resolved: false,
            createdAt: new Date().toISOString(),
          };
          set((s) => ({
            queries: {
              ...s.queries,
              [sceneId]: [...(s.queries[sceneId] || []), q],
            },
          }));
        },

        updateQuery: (sceneId, queryId, text) => {
          set((s) => ({
            queries: {
              ...s.queries,
              [sceneId]: (s.queries[sceneId] || []).map((q) =>
                q.id === queryId ? { ...q, text } : q
              ),
            },
          }));
        },

        toggleResolved: (sceneId, queryId) => {
          set((s) => ({
            queries: {
              ...s.queries,
              [sceneId]: (s.queries[sceneId] || []).map((q) =>
                q.id === queryId ? { ...q, resolved: !q.resolved } : q
              ),
            },
          }));
        },

        removeQuery: (sceneId, queryId) => {
          set((s) => ({
            queries: {
              ...s.queries,
              [sceneId]: (s.queries[sceneId] || []).filter((q) => q.id !== queryId),
            },
          }));
        },

        getAllUnresolved: () => {
          const result: { sceneId: string; query: DirectorQuery }[] = [];
          for (const [sceneId, queries] of Object.entries(get().queries)) {
            for (const q of queries) {
              if (!q.resolved) result.push({ sceneId, query: q });
            }
          }
          return result;
        },
      }),
      { name: `prep-director-queries-${projectId}` },
    ),
  );
}

export function useDirectorQueriesStore(projectId: string) {
  if (!storeCache.has(projectId)) {
    storeCache.set(projectId, createStore(projectId));
  }
  return storeCache.get(projectId)!;
}
