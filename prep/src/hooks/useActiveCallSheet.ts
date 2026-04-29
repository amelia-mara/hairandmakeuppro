import { useMemo } from 'react';
import { useCallSheetStore } from '@/stores/callSheetStore';
import type { CallSheet } from '@/utils/callSheet/types';

/**
 * Pick the call sheet to drive today-focused dashboard widgets.
 *
 * Priority:
 *   1. A sheet whose `date` matches today's ISO date.
 *   2. Otherwise the most recent uploaded sheet (by `date` desc, then
 *      `uploadedAt` desc) — useful before the day starts.
 *
 * Returns null when no parsed call sheet has been uploaded yet, or when
 * the sheets that exist are PDFs that the parser couldn't handle.
 */
export function useActiveCallSheet(projectId: string): CallSheet | null {
  const store = useCallSheetStore(projectId);
  const sheets = store((s) => s.sheets);

  return useMemo(() => {
    const parsed = sheets
      .filter((s) => s.parsed && s.parsed.scenes.length + (s.parsed.castCalls?.length ?? 0) > 0)
      .map((s) => s.parsed!) as CallSheet[];
    if (parsed.length === 0) return null;

    const today = new Date().toISOString().slice(0, 10);
    const todayMatch = parsed.find((p) => p.date === today);
    if (todayMatch) return todayMatch;

    return [...parsed].sort((a, b) => {
      if (a.date && b.date && a.date !== b.date) return a.date < b.date ? 1 : -1;
      const ua = a.uploadedAt instanceof Date ? a.uploadedAt.getTime() : 0;
      const ub = b.uploadedAt instanceof Date ? b.uploadedAt.getTime() : 0;
      return ub - ua;
    })[0];
  }, [sheets]);
}
