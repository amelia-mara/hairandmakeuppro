import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CallSheet } from '@/utils/callSheet/types';

export interface CallSheetFile {
  id: string;
  name: string;
  date: string;
  uploadedAt: string;
  // PDF and thumbnail are derived: a base64 data URI immediately after
  // upload, then short-lived signed URLs from Supabase Storage on
  // subsequent loads. Stripped from the persist payload (too large for
  // localStorage), so they may be undefined until hydration runs.
  dataUri?: string;
  thumbnailUri?: string;
  // Storage paths — the source of truth for re-generating signed URLs.
  storagePath?: string;
  thumbnailPath?: string;
  // Parsed call-sheet data — scene rows, cast calls, etc.
  parsed?: CallSheet;
}

interface CallSheetState {
  sheets: CallSheetFile[];
  addSheet: (sheet: CallSheetFile) => void;
  removeSheet: (id: string) => void;
}

const storeCache = new Map<string, ReturnType<typeof createStore>>();

function createStore(projectId: string) {
  return create<CallSheetState>()(
    persist(
      (set) => ({
        sheets: [],
        addSheet: (sheet) =>
          set((s) => ({ sheets: [...s.sheets, sheet] })),
        removeSheet: (id) =>
          set((s) => ({ sheets: s.sheets.filter((sh) => sh.id !== id) })),
      }),
      {
        name: `prep-callsheets-${projectId}`,
        partialize: (s) => ({
          sheets: s.sheets.map(({ dataUri: _du, thumbnailUri: _tu, ...rest }) => rest),
        }),
      },
    ),
  );
}

export function useCallSheetStore(projectId: string) {
  if (!storeCache.has(projectId)) {
    storeCache.set(projectId, createStore(projectId));
  }
  return storeCache.get(projectId)!;
}
