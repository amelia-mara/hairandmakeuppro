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

import { useEffect, useRef, useState } from 'react';
import {
  loadFullProject,
  dbToScene,
  dbToCharacter,
  dbToLook,
  saveScenes,
  saveCharacters,
  saveLooks,
  saveBreakdown,
  saveContinuityEntry,
  saveSchedule,
  flushPrepSync,
  onSaveStatusChange,
  setReceivingFromRealtime,
} from '@/services/supabaseSync';
import {
  subscribeToProject,
  type PrepRealtimeHandlers,
} from '@/services/realtimeSync';
import {
  useParsedScriptStore,
  useBreakdownStore,
  useContinuityTrackerStore,
  useSynopsisStore,
  useSceneMetaStore,
  useCharacterOverridesStore,
  useScriptUploadStore,
} from '@/stores/breakdownStore';
import { useProjectStore } from '@/stores/projectStore';
import { useScheduleStore } from '@/stores/scheduleStore';
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

            // ── Populate breakdown store from filming_notes ──
            for (const row of data.scenes) {
              const filmingNotes = row.filming_notes as string | null;
              if (filmingNotes) {
                try {
                  const breakdown = JSON.parse(filmingNotes);
                  if (breakdown && typeof breakdown === 'object') {
                    useBreakdownStore.getState().setBreakdown(row.id as string, breakdown);
                  }
                } catch { /* not valid JSON, skip */ }
              }
            }

            // ── Populate continuity tracker from continuity_events ──
            for (const entry of data.continuityEntries) {
              const sceneId = entry.scene_id as string;
              const characterId = entry.character_id as string;
              if (sceneId && characterId) {
                const flags = (entry.continuity_flags as Record<string, boolean>) || {};
                useContinuityTrackerStore.getState().setEntry(sceneId, characterId, {
                  sceneId,
                  characterId,
                  status: (entry.status as 'pending' | 'in-progress' | 'complete') || 'pending',
                  flags: {
                    sweat: flags.sweat || false,
                    dishevelled: flags.dishevelled || false,
                    blood: flags.blood || false,
                    dirt: flags.dirt || false,
                    wetHair: flags.wetHair || false,
                    tears: flags.tears || false,
                  },
                  notes: (entry.general_notes as string) || '',
                });
              }
            }

            // ── Populate schedule store ──
            if (data.schedule) {
              const schedStore = useScheduleStore(projectId!);
              const castList = (data.schedule.cast_list as any[]) || [];
              const days = (data.schedule.days as any[]) || [];
              const schedStatus = (data.schedule.status as string) || 'pending';
              schedStore.getState().upload({
                id: data.schedule.id as string,
                status: schedStatus as any,
                castList,
                days,
                totalDays: days.length,
                uploadedAt: (data.schedule.created_at as string) || new Date().toISOString(),
                rawText: (data.schedule.raw_pdf_text as string) || undefined,
              });
            }

            // ── Populate script upload store ──
            if (data.scriptUpload) {
              useScriptUploadStore.getState().setScript(projectId!, {
                projectId: projectId!,
                filename: (data.scriptUpload.file_name as string) || 'script.pdf',
                uploadedAt: (data.scriptUpload.created_at as string) || new Date().toISOString(),
                sceneCount: (data.scriptUpload.scene_count as number) || scenes.length,
                rawText: (data.scriptUpload.raw_text as string) || '',
              });
            }
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

  // ════════════════════════════════════════════════════════════
  // SAVE WATCHERS — push store changes to Supabase
  // ════════════════════════════════════════════════════════════

  // Watch parsedScriptStore for changes and save to Supabase
  useEffect(() => {
    if (!projectId || !hasPrepAccess) return;

    const unsub = useParsedScriptStore.subscribe((state, prevState) => {
      const curr = state.projects[projectId];
      const prev = prevState.projects[projectId];
      if (!curr || curr === prev) return;

      // Save scenes (merge in synopses and scene meta overrides)
      if (curr.scenes !== prev?.scenes && curr.scenes.length > 0) {
        const synopses = useSynopsisStore.getState().synopses;
        const metaOverrides = useSceneMetaStore.getState().overrides;
        const mergedScenes = curr.scenes.map(s => {
          const synopsisOverride = synopses[s.id];
          const metaOvr = metaOverrides[s.id];
          return {
            ...s,
            synopsis: synopsisOverride !== undefined ? synopsisOverride : s.synopsis,
            intExt: metaOvr?.intExt ?? s.intExt,
            dayNight: metaOvr?.dayNight ?? s.dayNight,
            location: metaOvr?.location ?? s.location,
          };
        });
        saveScenes(projectId, mergedScenes as any);
      }

      // Save characters (merge in character overrides)
      if (curr.characters !== prev?.characters && curr.characters.length > 0) {
        const charOverrides = useCharacterOverridesStore.getState().overrides;
        const mergedChars = curr.characters.map(c => {
          const ovr = charOverrides[c.id];
          return ovr ? { ...c, ...ovr } : c;
        });
        saveCharacters(projectId, mergedChars as any);
      }

      // Save looks
      if (curr.looks !== prev?.looks && curr.looks.length > 0) {
        saveLooks(projectId, curr.looks as any);
      }
    });

    return unsub;
  }, [projectId, hasPrepAccess]);

  // Watch breakdown store for changes → save to Supabase
  useEffect(() => {
    if (!projectId || !hasPrepAccess) return;

    const unsub = useBreakdownStore.subscribe((state, prevState) => {
      if (state.breakdowns === prevState.breakdowns) return;

      // Find which breakdowns changed and save each one
      for (const sceneId of Object.keys(state.breakdowns)) {
        if (state.breakdowns[sceneId] !== prevState.breakdowns[sceneId]) {
          saveBreakdown(projectId, sceneId, state.breakdowns[sceneId] as any);
        }
      }
    });

    return unsub;
  }, [projectId, hasPrepAccess]);

  // Watch continuity tracker for changes → save to Supabase
  useEffect(() => {
    if (!projectId || !hasPrepAccess) return;

    const unsub = useContinuityTrackerStore.subscribe((state, prevState) => {
      if (state.entries === prevState.entries) return;

      for (const key of Object.keys(state.entries)) {
        if (state.entries[key] !== prevState.entries[key]) {
          const entry = state.entries[key];
          if (entry) {
            saveContinuityEntry(entry.sceneId, entry.characterId, {
              status: entry.status === 'pending' ? 'not_started' : entry.status,
              flags: { ...entry.flags } as Record<string, boolean>,
              generalNotes: entry.notes,
            });
          }
        }
      }
    });

    return unsub;
  }, [projectId, hasPrepAccess]);

  // Watch synopsis overrides → push into parsedScriptStore to trigger scene save
  useEffect(() => {
    if (!projectId || !hasPrepAccess) return;

    const unsub = useSynopsisStore.subscribe((state, prevState) => {
      if (state.synopses === prevState.synopses) return;

      const parsed = useParsedScriptStore.getState().getParsedData(projectId);
      if (!parsed) return;

      // Find changed synopses and save the affected scenes
      const changedSceneIds = Object.keys(state.synopses).filter(
        id => state.synopses[id] !== prevState.synopses[id]
      );
      if (changedSceneIds.length === 0) return;

      const metaOverrides = useSceneMetaStore.getState().overrides;
      const mergedScenes = parsed.scenes.map(s => {
        const synOvr = state.synopses[s.id];
        const metaOvr = metaOverrides[s.id];
        return {
          ...s,
          synopsis: synOvr !== undefined ? synOvr : s.synopsis,
          intExt: metaOvr?.intExt ?? s.intExt,
          dayNight: metaOvr?.dayNight ?? s.dayNight,
          location: metaOvr?.location ?? s.location,
        };
      });
      saveScenes(projectId, mergedScenes as any);
    });

    return unsub;
  }, [projectId, hasPrepAccess]);

  // Watch scene meta overrides → save scenes with merged data
  useEffect(() => {
    if (!projectId || !hasPrepAccess) return;

    const unsub = useSceneMetaStore.subscribe((state, prevState) => {
      if (state.overrides === prevState.overrides) return;

      const parsed = useParsedScriptStore.getState().getParsedData(projectId);
      if (!parsed) return;

      const synopses = useSynopsisStore.getState().synopses;
      const mergedScenes = parsed.scenes.map(s => {
        const synOvr = synopses[s.id];
        const metaOvr = state.overrides[s.id];
        return {
          ...s,
          synopsis: synOvr !== undefined ? synOvr : s.synopsis,
          intExt: metaOvr?.intExt ?? s.intExt,
          dayNight: metaOvr?.dayNight ?? s.dayNight,
          location: metaOvr?.location ?? s.location,
        };
      });
      saveScenes(projectId, mergedScenes as any);
    });

    return unsub;
  }, [projectId, hasPrepAccess]);

  // Watch character overrides → save characters with merged data
  useEffect(() => {
    if (!projectId || !hasPrepAccess) return;

    const unsub = useCharacterOverridesStore.subscribe((state, prevState) => {
      if (state.overrides === prevState.overrides) return;

      const parsed = useParsedScriptStore.getState().getParsedData(projectId);
      if (!parsed) return;

      const mergedChars = parsed.characters.map(c => {
        const ovr = state.overrides[c.id];
        return ovr ? { ...c, ...ovr } : c;
      });
      saveCharacters(projectId, mergedChars as any);
    });

    return unsub;
  }, [projectId, hasPrepAccess]);

  // Watch schedule store → save to Supabase
  useEffect(() => {
    if (!projectId || !hasPrepAccess) return;

    const schedStore = useScheduleStore(projectId);
    const unsub = schedStore.subscribe((state, prevState) => {
      if (state.current === prevState.current) return;
      if (!state.current) return;

      saveSchedule(projectId, {
        id: state.current.id,
        rawText: state.current.rawText,
        castList: state.current.castList,
        days: state.current.days,
        status: state.current.status,
      });
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

function handleLookRealtimeUpdate(_projectId: string, payload: ChangePayload) {
  if ((payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') && payload.new) {
    const look = dbToLook(payload.new as Record<string, unknown>);
    console.log('[PrepSync] Look changed from app:', look.name);
  }
}
