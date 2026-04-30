import { supabase } from '@/lib/supabase';
import type { TimesheetEntry } from '@/stores/timesheetStore';

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 700;

export function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

/** Empty `entries` deletes the row instead of upserting. */
export async function pushMemberWeek(
  projectId: string,
  userId: string,
  weekStarting: string,
  entries: TimesheetEntry[],
): Promise<void> {
  if (entries.length === 0) {
    const { error } = await supabase
      .from('timesheets')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('week_starting', weekStarting);
    if (error) console.warn('[PrepTimesheetSync] delete failed:', error.message);
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
  if (error) console.warn('[PrepTimesheetSync] upsert failed:', error.message);
}

export function pushMemberWeekDebounced(
  projectId: string,
  userId: string,
  weekStarting: string,
  entries: TimesheetEntry[],
): void {
  const key = `${projectId}:${userId}:${weekStarting}`;
  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);
  debounceTimers.set(
    key,
    setTimeout(() => {
      debounceTimers.delete(key);
      pushMemberWeek(projectId, userId, weekStarting, entries).catch((err) =>
        console.warn('[PrepTimesheetSync] push error', err),
      );
    }, DEBOUNCE_MS),
  );
}
