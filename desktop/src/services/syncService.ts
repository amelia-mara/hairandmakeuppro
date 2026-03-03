// Sync service — placeholder for future Supabase integration

export function generateSyncCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = () =>
    Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${part()}-${part()}`;
}

export interface SyncStatus {
  connected: boolean;
  lastSync: number | null;
  syncCode: string | null;
}

export function getSyncStatus(): SyncStatus {
  return {
    connected: false,
    lastSync: null,
    syncCode: null,
  };
}
