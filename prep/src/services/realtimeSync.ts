/**
 * Realtime Sync Service for Prep Happy
 *
 * Subscribes to Supabase Realtime changes pushed from the mobile app.
 * One channel per project. Handlers update local Zustand state directly
 * from the payload — no re-fetch needed.
 *
 * Channel naming: prep:project:{projectId}
 */

import { supabase } from '@/lib/supabase';
import { setReceivingFromRealtime } from './supabaseSync';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ChangePayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

export interface PrepRealtimeHandlers {
  /** App captured continuity — update Master Breakdown */
  onContinuityInsert?: (payload: ChangePayload) => void;
  /** App confirmed a look or updated scene character */
  onSceneCharacterUpdate?: (payload: ChangePayload) => void;
  /** App updated scene status on set */
  onSceneUpdate?: (payload: ChangePayload) => void;
  /** App logged hours */
  onTimesheetInsert?: (payload: ChangePayload) => void;
  /** App updated characters */
  onCharacterChange?: (payload: ChangePayload) => void;
  /** App updated looks */
  onLookChange?: (payload: ChangePayload) => void;
}

let activeChannel: RealtimeChannel | null = null;
let activeProjectId: string | null = null;

/**
 * Subscribe to Realtime changes for a project.
 * Only subscribes if project has_prep_access === true.
 * Returns an unsubscribe function.
 */
export function subscribeToProject(
  projectId: string,
  handlers: PrepRealtimeHandlers,
): () => void {
  // Don't create duplicate subscriptions
  if (activeProjectId === projectId && activeChannel) {
    return () => unsubscribeFromProject();
  }

  // Clean up any existing subscription
  if (activeChannel) {
    unsubscribeFromProject();
  }

  activeProjectId = projectId;

  const wrapHandler = (handler?: (payload: ChangePayload) => void) => {
    return (payload: ChangePayload) => {
      if (!handler) return;
      setReceivingFromRealtime(true);
      try {
        handler(payload);
      } finally {
        setReceivingFromRealtime(false);
      }
    };
  };

  activeChannel = supabase
    .channel(`prep:project:${projectId}`)

    // App captured continuity — update Master Breakdown
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'continuity_events',
      filter: `scene_id=in.(select id from scenes where project_id='${projectId}')`,
    }, wrapHandler(handlers.onContinuityInsert))

    // Also handle updates to continuity events
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'continuity_events',
    }, wrapHandler(handlers.onContinuityInsert))

    // App confirmed a look or updated scene character
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'scene_characters',
    }, wrapHandler(handlers.onSceneCharacterUpdate))

    // App updated scene status on set
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'scenes',
      filter: `project_id=eq.${projectId}`,
    }, wrapHandler(handlers.onSceneUpdate))

    // App logged hours
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'timesheets',
      filter: `project_id=eq.${projectId}`,
    }, wrapHandler(handlers.onTimesheetInsert))

    // App updated characters
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'characters',
      filter: `project_id=eq.${projectId}`,
    }, wrapHandler(handlers.onCharacterChange))

    // App updated looks
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'looks',
      filter: `project_id=eq.${projectId}`,
    }, wrapHandler(handlers.onLookChange))

    .subscribe((status) => {
      console.log(`[PrepRealtime] Channel prep:project:${projectId} status:`, status);
    });

  return () => unsubscribeFromProject();
}

/**
 * Unsubscribe from the active project channel.
 */
export function unsubscribeFromProject(): void {
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
    activeProjectId = null;
    console.log('[PrepRealtime] Unsubscribed from project');
  }
}

/**
 * Get the currently subscribed project ID.
 */
export function getActiveRealtimeProjectId(): string | null {
  return activeProjectId;
}
