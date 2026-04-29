import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import type { TimesheetEntry } from '@/types';

// Mobile timesheet entries are stored locally; this thin layer pushes
// each week's entries to Supabase so the project's prep designer sees
// them on their crew row. One row per (project, user, week_starting).
//
// Failures are swallowed — losing a sync cycle shouldn't block local
// logging. Realtime push-back / approval flow lands in a follow-up.

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 600;

/** Monday of the week containing `dateStr`, in YYYY-MM-DD. */
export function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // ISO Monday start
  const monday = new Date(date);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

/**
 * Push the user's entries for one specific week to Supabase. Caller
 * supplies the slice of entries already filtered to that week so this
 * stays a pure I/O function.
 */
export async function pushTimesheetWeek(
  projectId: string,
  userId: string,
  weekStarting: string,
  entries: TimesheetEntry[],
): Promise<void> {
  if (!isSupabaseConfigured) return;
  // Empty week → delete the row so we don't leave stale data after the
  // user clears all their entries for that week.
  if (entries.length === 0) {
    const { error } = await supabase
      .from('timesheets')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('week_starting', weekStarting);
    if (error) {
      console.warn('[TimesheetSync] delete failed:', error.message);
    }
    return;
  }
  const { error } = await supabase
    .from('timesheets')
    .upsert(
      {
        project_id: projectId,
        user_id: userId,
        week_starting: weekStarting,
        entries: entries as unknown as Record<string, unknown>,
      },
      { onConflict: 'project_id,user_id,week_starting' },
    );
  if (error) {
    console.warn('[TimesheetSync] upsert failed:', error.message);
  }
}

/**
 * Convenience wrapper: pull project id + user id + the week's entries
 * straight from the local stores and push. Debounced per-week so a
 * burst of edits in the LogDay modal collapses into a single round-trip.
 */
export function syncWeekForCurrentUser(
  weekStarting: string,
  entries: TimesheetEntry[],
): void {
  const project = useProjectStore.getState().currentProject;
  const user = useAuthStore.getState().user;
  if (!project?.id || !user?.id) return;

  const key = `${project.id}:${user.id}:${weekStarting}`;
  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);
  debounceTimers.set(
    key,
    setTimeout(() => {
      debounceTimers.delete(key);
      pushTimesheetWeek(project.id, user.id, weekStarting, entries).catch(
        (err) => console.warn('[TimesheetSync] push error', err),
      );
    }, DEBOUNCE_MS),
  );
}

/**
 * One-shot pull on app load — fetch every week the user has on this
 * project so a fresh device sees prior history. Returns a flat array
 * of entries the caller can merge into their local store.
 */
export async function pullTimesheetForCurrentUser(): Promise<TimesheetEntry[]> {
  if (!isSupabaseConfigured) return [];
  const project = useProjectStore.getState().currentProject;
  const user = useAuthStore.getState().user;
  if (!project?.id || !user?.id) return [];
  const { data, error } = await supabase
    .from('timesheets')
    .select('entries')
    .eq('project_id', project.id)
    .eq('user_id', user.id);
  if (error) {
    console.warn('[TimesheetSync] pull failed:', error.message);
    return [];
  }
  const out: TimesheetEntry[] = [];
  for (const row of data ?? []) {
    const raw = row.entries as unknown;
    if (Array.isArray(raw)) out.push(...(raw as TimesheetEntry[]));
  }
  return out;
}
