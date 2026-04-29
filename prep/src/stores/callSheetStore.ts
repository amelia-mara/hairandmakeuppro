import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CallSheet } from '@/utils/callSheet/types';

export interface CallSheetFile {
  id: string;
  name: string;
  date: string;          // ISO date string for sorting
  dataUri: string;       // base64 data URI of the PDF
  thumbnailUri: string;  // rendered first-page thumbnail
  uploadedAt: string;    // ISO timestamp
  // Parsed call sheet data — present when the PDF has been run through
  // the regex parser so mobile and prep dashboard widgets can consume
  // it. Older records may not have it yet; treat as optional.
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
      { name: `prep-callsheets-${projectId}` },
    ),
  );
}

export function useCallSheetStore(projectId: string) {
  if (!storeCache.has(projectId)) {
    storeCache.set(projectId, createStore(projectId));
  }
  return storeCache.get(projectId)!;
}
