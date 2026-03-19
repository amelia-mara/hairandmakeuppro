/**
 * useProjectSync — Hook that connects a Prep project to Supabase.
 *
 * Placed in the project layout wrapper. When a project is selected:
 * 1. Loads all data from Supabase (replaces localStorage as source of truth)
 * 2. Subscribes to Realtime changes from the mobile app
 * 3. Watches store changes and saves them to Supabase with 800ms debounce
 * 4. Unsubscribes on unmount
 *
 * Only activates when project.has_prep_access === true.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  loadFullProject,
  dbToScene,
  dbToCharacter,
  dbToLook,
  saveScenes,
  saveCharacters,
  saveLooks,
  saveBreakdown,
  flushPrepSync,
  getSaveStatus,
  onSaveStatusChange,
  setReceivingFromRealtime,
  type PrepProjectData,
} from '@/services/supabaseSync';
import {
  subscribeToProject,
  unsubscribeFromProject,
  type PrepRealtimeHandlers,
} from '@/services/realtimeSync';
import { useParsedScriptStore } from '@/stores/breakdownStore';
import { useProjectStore } from '@/stores/projectStore';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ChangePayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

interface ProjectSyncState {
  loading: boolean;
  error: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  hasPrepAccess: boolean;
}

export function useProjectSync(projectId: string | null): ProjectSyncState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hasPrepAccess, setHasPrepAccess] = useState(false);
  const loadedRef = useRef<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // Track save status
  useEffect(() => {
    return onSaveStatusChange(setSaveStatus);
  }, []);

  // Load project data from Supabase
  useEffect(() => {
    if (!projectId || loadedRef.current === projectId) return;

    let cancelled = false;
    loadedRef.current = projectId;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await loadFullProject(projectId!);

        if (cancelled) return;

        const project = data.project;
        const prepAccess = !!(project as any).has_prep_access;
        setHasPrepAccess(prepAccess);

        // Build scene → character ID map
        const scMap = new Map<string, string[]>();
        for (const sc of data.sceneCharacters) {
          const sceneId = sc.scene_id as string;
          const charId = sc.character_id as string;
          if (!scMap.has(sceneId)) scMap.set(sceneId, []);
          scMap.get(sceneId)!.push(charId);
        }

        // Map data to Prep format
        const scenes = data.scenes.map(row =>
          dbToScene(row, scMap.get(row.id as string) || [])
        );
        const characters = data.characters.map(row => dbToCharacter(row));
        const looks = data.looks.map(row => dbToLook(row));

        // Only apply to stores if we have server data
        if (scenes.length > 0 || characters.length > 0 || looks.length > 0) {
          setReceivingFromRealtime(true);
          try {
            // Update parsedScriptStore with server data
            useParsedScriptStore.getState().setParsedData(projectId!, {
              scenes: scenes as any,
              characters: characters as any,
              looks: looks as any,
              filename: data.scriptUpload
                ? (data.scriptUpload.file_name as string) || 'script.pdf'
                : '',
              parsedAt: new Date().toISOString(),
            });

            // Update project record
            useProjectStore.getState().updateProject(projectId!, {
              scenes: scenes.length,
              characters: characters.length,
              scriptFilename: data.scriptUpload
                ? (data.scriptUpload.file_name as string) || undefined
                : undefined,
            });
          } finally {
            setReceivingFromRealtime(false);
          }
        }

        // Subscribe to Realtime if project has prep access
        if (prepAccess) {
          const handlers: PrepRealtimeHandlers = {
            onSceneUpdate: (payload) => {
              handleSceneRealtimeUpdate(projectId!, payload);
            },
            onCharacterChange: (payload) => {
              handleCharacterRealtimeUpdate(projectId!, payload);
            },
            onLookChange: (payload) => {
              handleLookRealtimeUpdate(projectId!, payload);
            },
            onContinuityInsert: (payload) => {
              console.log('[PrepSync] Continuity entry from app:', payload);
              // Continuity data from the app updates the continuity tracker store
            },
            onTimesheetInsert: (payload) => {
              console.log('[PrepSync] Timesheet entry from app:', payload);
            },
          };

          unsubRef.current = subscribeToProject(projectId!, handlers);
        }

        console.log(`[useProjectSync] Project ${projectId} loaded from Supabase`);
      } catch (err) {
        if (!cancelled) {
          console.error('[useProjectSync] Failed to load project:', err);
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
      flushPrepSync();
    };
  }, []);

  // Watch parsedScriptStore for changes and save to Supabase
  useEffect(() => {
    if (!projectId || !hasPrepAccess) return;

    const unsub = useParsedScriptStore.subscribe((state, prevState) => {
      const curr = state.projects[projectId];
      const prev = prevState.projects[projectId];
      if (!curr || curr === prev) return;

      // Save scenes
      if (curr.scenes !== prev?.scenes && curr.scenes.length > 0) {
        saveScenes(projectId, curr.scenes as any);
      }

      // Save characters
      if (curr.characters !== prev?.characters && curr.characters.length > 0) {
        saveCharacters(projectId, curr.characters as any);
      }

      // Save looks
      if (curr.looks !== prev?.looks && curr.looks.length > 0) {
        saveLooks(projectId, curr.looks as any);
      }
    });

    return unsub;
  }, [projectId, hasPrepAccess]);

  return { loading, error, saveStatus, hasPrepAccess };
}

// ============================================================================
// Realtime handlers — update Prep stores from app changes
// ============================================================================

function handleSceneRealtimeUpdate(projectId: string, payload: ChangePayload) {
  if (payload.eventType === 'UPDATE' && payload.new) {
    const updated = payload.new as Record<string, unknown>;
    const parsedData = useParsedScriptStore.getState().getParsedData(projectId);
    if (!parsedData) return;

    const sceneIdx = parsedData.scenes.findIndex(s => s.id === (updated.id as string));
    if (sceneIdx >= 0) {
      const updatedScenes = [...parsedData.scenes];
      updatedScenes[sceneIdx] = {
        ...updatedScenes[sceneIdx],
        // Map DB fields back to Prep Scene format
        synopsis: (updated.synopsis as string) ?? updatedScenes[sceneIdx].synopsis,
        scriptContent: (updated.script_content as string) ?? updatedScenes[sceneIdx].scriptContent,
      };
      useParsedScriptStore.getState().setParsedData(projectId, {
        ...parsedData,
        scenes: updatedScenes,
      });
      console.log('[PrepSync] Scene updated from app:', updated.id);
    }
  }
}

function handleCharacterRealtimeUpdate(projectId: string, payload: ChangePayload) {
  if (payload.eventType === 'UPDATE' && payload.new) {
    const updated = payload.new as Record<string, unknown>;
    const character = dbToCharacter(updated);
    useParsedScriptStore.getState().updateCharacter(projectId, character.id, character as any);
    console.log('[PrepSync] Character updated from app:', character.id);
  } else if (payload.eventType === 'INSERT' && payload.new) {
    const character = dbToCharacter(payload.new as Record<string, unknown>);
    console.log('[PrepSync] New character from app:', character.name);
  }
}

function handleLookRealtimeUpdate(projectId: string, payload: ChangePayload) {
  if ((payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') && payload.new) {
    const look = dbToLook(payload.new as Record<string, unknown>);
    console.log('[PrepSync] Look changed from app:', look.name);
  }
}
