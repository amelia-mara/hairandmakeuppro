import { useEffect } from 'react';
import { isSupabaseConfigured } from '@checks-happy/shared';

/**
 * Desktop-specific sync hook.
 * In Phase 1, this is a placeholder that will be connected
 * to the shared sync service in later phases.
 */
export function useDesktopSync() {
  useEffect(() => {
    if (!isSupabaseConfigured) {
      console.log('[DesktopSync] Supabase not configured, skipping sync');
      return;
    }

    console.log('[DesktopSync] Ready for sync (will be connected in next phase)');
  }, []);
}
