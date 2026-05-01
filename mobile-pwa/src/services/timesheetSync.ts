import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import type { TimesheetEntry } from '@/types';

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 600;

export function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

/** Empty `entries` deletes the row instead of upserting. */
export async function pushTimesheetWeek(
  projectId: string,
  userId: string,
  weekStarting: string,
  entries: TimesheetEntry[],
): Promise<void> {
  if (!isSupabaseConfigured) return;
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
