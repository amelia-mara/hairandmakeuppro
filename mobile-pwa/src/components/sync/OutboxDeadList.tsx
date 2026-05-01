/**
 * Review panel for outbox entries that exhausted their retry budget.
 *
 * Each dead entry represents data that is still safe in local IndexedDB
 * but has failed 10+ Supabase write attempts. The user can either retry
 * (resets the attempts and reschedules) or discard (drops the queued
 * write — local state is unaffected).
 */

import { useEffect, useState } from 'react';
import { outboxService } from '@/services/outboxService';
import type { OutboxEntry } from '@/db';

const TYPE_LABEL: Record<OutboxEntry['type'], string> = {
  continuity_event: 'Continuity capture',
  photo_metadata: 'Photo',
  photo_storage: 'Photo upload',
};

export function OutboxDeadList({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const dead = await outboxService.getDeadEntries();
    setEntries(dead);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleRetry = async (id: number) => {
    setBusy(true);
    try {
      await outboxService.reviveDeadEntry(id);
      await outboxService.flushOutbox();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDiscard = async (id: number) => {
    const confirmed = window.confirm(
      'Discard this entry? The capture will stay on this device but will not sync. This cannot be undone.',
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      await outboxService.discardDeadEntry(id);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="absolute inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto bg-card rounded-2xl shadow-xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <h3 className="text-base font-bold text-text-primary">Could not be saved</h3>
          <p className="text-xs text-text-muted mt-1">
            These items are still on this device but failed to reach the server. Retry or discard each one.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {entries.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">Nothing to review.</p>
          ) : (
            <ul className="space-y-3">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-xl border border-border px-4 py-3"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">
                        {TYPE_LABEL[entry.type]}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {entry.attempts} attempts · queued {timeAgo(entry.createdAt)}
                      </p>
                      {entry.lastError && (
                        <p className="text-xs text-text-muted mt-1 break-words">
                          {entry.lastError}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => entry.id != null && handleRetry(entry.id)}
                      disabled={busy}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold gold-gradient text-white disabled:opacity-50"
                    >
                      Retry
                    </button>
                    <button
                      onClick={() => entry.id != null && handleDiscard(entry.id)}
                      disabled={busy}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold border border-border text-text-secondary disabled:opacity-50"
                    >
                      Discard
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg text-sm font-semibold text-text-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
