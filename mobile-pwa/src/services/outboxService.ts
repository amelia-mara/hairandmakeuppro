/**
 * Outbox Service
 *
 * Durable retry queue for Supabase writes that failed (continuity_events
 * and photos metadata). When the network is bad on set, capture data
 * stays safe in IndexedDB locally; the outbox holds the pending Supabase
 * write and retries it with bounded exponential backoff on reconnect.
 *
 * After 10 attempts, an entry is marked "dead" — it will not retry
 * automatically, and the UI surfaces a warning so the user can decide.
 */

import { supabase } from '@/lib/supabase';
import { db, OUTBOX_DEAD_NEXT_RETRY } from '@/db';
import type { OutboxEntry, OutboxEntryType } from '@/db';
import { useSyncStore } from '@/stores/syncStore';
import type { Database } from '@/types/supabase';

const MAX_ATTEMPTS = 10;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 10 * 60 * 1_000;

/** Add a failed write to the outbox; immediately eligible for retry. */
async function addToOutbox(
  entry: Omit<OutboxEntry, 'id' | 'attempts' | 'lastError' | 'nextRetry'>,
): Promise<number> {
  const id = await db.outbox.add({
    ...entry,
    attempts: 0,
    lastError: '',
    nextRetry: Date.now(),
  });
  await refreshSyncStoreCounts();
  return Number(id);
}

/** Get all entries whose nextRetry is due (excludes dead entries). */
async function getPendingEntries(): Promise<OutboxEntry[]> {
  const now = Date.now();
  return db.outbox
    .where('nextRetry')
    .belowOrEqual(now)
    .toArray();
}

/** Remove an entry — used when the retry succeeds. */
async function removeEntry(id: number): Promise<void> {
  await db.outbox.delete(id);
}

/**
 * Mark an entry as failed: increment attempts, schedule next retry with
 * exponential backoff. After MAX_ATTEMPTS, mark dead so it won't auto-retry.
 */
async function markFailed(id: number, error: string): Promise<void> {
  const entry = await db.outbox.get(id);
  if (!entry) return;

  const attempts = entry.attempts + 1;

  if (attempts >= MAX_ATTEMPTS) {
    await db.outbox.update(id, {
      attempts,
      lastError: error,
      nextRetry: OUTBOX_DEAD_NEXT_RETRY,
    });
    return;
  }

  // 5s, 15s, 45s, ~2m, ~5m, capped at 10m
  const backoff = Math.min(
    BASE_BACKOFF_MS * Math.pow(3, attempts - 1),
    MAX_BACKOFF_MS,
  );

  await db.outbox.update(id, {
    attempts,
    lastError: error,
    nextRetry: Date.now() + backoff,
  });
}

/** Pending entries currently due for retry. */
async function getPendingCount(): Promise<number> {
  const now = Date.now();
  return db.outbox
    .where('nextRetry')
    .belowOrEqual(now)
    .count();
}

/** Total pending (due + scheduled in the future, but excludes dead). */
async function getTotalPendingCount(): Promise<number> {
  return db.outbox
    .where('nextRetry')
    .below(OUTBOX_DEAD_NEXT_RETRY)
    .count();
}

/** Entries that exceeded MAX_ATTEMPTS — need user attention. */
async function getDeadCount(): Promise<number> {
  return db.outbox
    .where('nextRetry')
    .equals(OUTBOX_DEAD_NEXT_RETRY)
    .count();
}

async function getDeadEntries(): Promise<OutboxEntry[]> {
  return db.outbox
    .where('nextRetry')
    .equals(OUTBOX_DEAD_NEXT_RETRY)
    .toArray();
}

/**
 * Manually retry a dead entry. Resets attempts to 0 and reschedules
 * for immediate retry. Used by the UI when the user taps "retry".
 */
async function reviveDeadEntry(id: number): Promise<void> {
  await db.outbox.update(id, {
    attempts: 0,
    lastError: '',
    nextRetry: Date.now(),
  });
  await refreshSyncStoreCounts();
}

/**
 * Permanently discard a dead entry. The local IndexedDB state still
 * holds the underlying capture/photo blob — only the Supabase write
 * is being abandoned.
 */
async function discardDeadEntry(id: number): Promise<void> {
  await db.outbox.delete(id);
  await refreshSyncStoreCounts();
}

/** Update the syncStore counters so the UI reflects current state. */
async function refreshSyncStoreCounts(): Promise<void> {
  const [totalPending, dead] = await Promise.all([
    getTotalPendingCount(),
    getDeadCount(),
  ]);
  const sync = useSyncStore.getState();
  sync.setHasPendingOutbox(totalPending > 0);
  sync.setDeadOutboxCount(dead);
}

type ContinuityInsert = Database['public']['Tables']['continuity_events']['Insert'];
type PhotoInsert = Database['public']['Tables']['photos']['Insert'];

/** Apply one entry by writing to Supabase. Throws on failure. */
async function applyEntry(entry: OutboxEntry): Promise<void> {
  const payload = JSON.parse(entry.payload);

  if (entry.type === 'continuity_event') {
    const { error } = await supabase
      .from('continuity_events')
      .upsert(payload as ContinuityInsert, { onConflict: 'id' });
    if (error) throw error;
    return;
  }

  if (entry.type === 'photo_metadata') {
    const { error } = await supabase
      .from('photos')
      .upsert(payload as PhotoInsert, { onConflict: 'id' });
    if (error) throw error;
    return;
  }

  // photo_storage placeholder — the storage upload itself isn't queued
  // here today; this branch exists so the type union is exhaustive and
  // future work can extend it.
  throw new Error(`Unsupported outbox entry type: ${entry.type satisfies OutboxEntryType}`);
}

/**
 * Try to flush every due entry. Successful entries are removed; failed
 * ones are rescheduled. Returns counts so callers can log/announce.
 */
async function flushOutbox(): Promise<{ flushed: number; failed: number }> {
  const pending = await getPendingEntries();
  let flushed = 0;
  let failed = 0;

  for (const entry of pending) {
    if (entry.id == null) continue;
    try {
      await applyEntry(entry);
      await removeEntry(entry.id);
      flushed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markFailed(entry.id, message);
      failed++;
    }
  }

  await refreshSyncStoreCounts();
  return { flushed, failed };
}

export const outboxService = {
  addToOutbox,
  getPendingEntries,
  getPendingCount,
  getTotalPendingCount,
  getDeadCount,
  getDeadEntries,
  removeEntry,
  markFailed,
  reviveDeadEntry,
  discardDeadEntry,
  flushOutbox,
  refreshSyncStoreCounts,
};
