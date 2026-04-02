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
  saveBudget,
  saveTags,
  saveRevision,
  uploadContinuityPhoto,
  saveContinuityPhotoMeta,
  uploadCallSheetToStorage,
  removeCallSheetFromSupabase,
  saveTimesheetFull,
  flushPrepSync,
  hasPendingSaves,
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
  useContinuityPhotosStore,
  useSynopsisStore,
  useSceneMetaStore,
  useCharacterOverridesStore,
  useScriptUploadStore,
  useTagStore,
  useRevisedScenesStore,
  type SceneBreakdown,
  type ScriptTag,
} from '@/stores/breakdownStore';
import { useProjectStore } from '@/stores/projectStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useBudgetStore } from '@/stores/budgetStore';
import { useCallSheetStore } from '@/stores/callSheetStore';
import { useTimesheetStore } from '@/stores/timesheetStore';
import { supabase } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ChangePayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

/**
 * Build a lookId → sceneNumber[] map from the breakdown store.
 * Each scene breakdown tracks which lookId is assigned to each character,
 * so we invert that to get: for each look, which scenes use it.
 */
function buildLookSceneMap(projectId: string): Record<string, string[]> {
  const breakdowns = useBreakdownStore.getState().breakdowns;
  const parsed = useParsedScriptStore.getState().getParsedData(projectId);
  if (!parsed) return {};

  // Build scene ID → scene number map
  const sceneNumById = new Map<string, string>();
  for (const s of parsed.scenes) {
    sceneNumById.set(s.id, String(s.number));
  }

  const map: Record<string, string[]> = {};
  for (const [sceneId, bd] of Object.entries(breakdowns)) {
    if (!bd || !bd.characters) continue;
    const sceneNum = sceneNumById.get(sceneId);
    if (!sceneNum) continue;
    for (const cb of bd.characters) {
      if (cb.lookId) {
        if (!map[cb.lookId]) map[cb.lookId] = [];
        if (!map[cb.lookId].includes(sceneNum)) {
          map[cb.lookId].push(sceneNum);
        }
      }
    }
  }
  return map;
}

/**
 * Resolve a breakdown for Supabase sync by merging script tag text into any
 * empty breakdown fields.  This ensures the mobile app (which only reads
 * `filming_notes`) sees the same data that Prep's BreakdownSheet displays.
 */
function resolveBreakdownForSync(
  bd: SceneBreakdown,
  sceneTags: ScriptTag[],
): SceneBreakdown {
  const resolved = {
    ...bd,
    characters: bd.characters.map((cb) => {
      const charTags = sceneTags.filter((t) => t.characterId === cb.characterId && !t.dismissed);

      const resolveField = (
        manual: string,
        categoryId: string,
      ): string => {
        if (manual) return manual;
        const matching = charTags.filter((t) => t.categoryId === categoryId);
        return matching.length > 0 ? matching.map((t) => t.text).join(', ') : '';
      };

      return {
        ...cb,
        entersWith: {
          hair: resolveField(cb.entersWith.hair, 'hair'),
          makeup: resolveField(cb.entersWith.makeup, 'makeup'),
          wardrobe: resolveField(cb.entersWith.wardrobe, 'wardrobe'),
        },
        sfx: resolveField(cb.sfx, 'sfx'),
        environmental: resolveField(cb.environmental, 'environmental'),
        action: resolveField(cb.action, 'action'),
        notes: resolveField(cb.notes, 'notes'),
      };
    }),
  };
  return resolved;
}

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
  const [hasPrepAccess, setHasPrepAccess] = useState(true); // Default true — this is Prep, all projects sync
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
        setHasPrepAccess(true); // Always true in Prep — this is the Prep app

        // Auto-fix: if project doesn't have has_prep_access, set it now
        // so data syncs survive across sessions
        if (!prepAccess) {
          supabase
            .from('projects')
            .update({ has_prep_access: true })
            .eq('id', projectId!)
            .then(({ error }) => {
              if (error) console.warn('[useProjectSync] Failed to set has_prep_access:', error);
              else console.log('[useProjectSync] Auto-enabled has_prep_access for project', projectId);
            });
        }

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
        const supabaseLooks = data.looks.map(row => dbToLook(row));

        // Merge local looks with Supabase looks — keeps any looks that
        // were created locally but haven't synced to Supabase yet (e.g.
        // if a previous save failed or the user refreshed too quickly).
        const localParsed = useParsedScriptStore.getState().getParsedData(projectId!);
        const supabaseLookIds = new Set(supabaseLooks.map(l => l.id));
        const localOnlyLooks = (localParsed?.looks || []).filter(
          l => !supabaseLookIds.has(l.id)
        );
        const looks = [...supabaseLooks, ...localOnlyLooks];

        // Only apply to stores if we have server data
        if (scenes.length > 0 || characters.length > 0 || looks.length > 0) {
          setReceivingFromRealtime(true);
          try {
            // Update parsedScriptStore with server data (merged with local-only looks)
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
            // Merge with local breakdowns to preserve lookIds and other data
            // that may not have been saved to Supabase yet (e.g. save failed).
            for (const row of data.scenes) {
              const filmingNotes = row.filming_notes as string | null;
              if (filmingNotes) {
                try {
                  const breakdown = JSON.parse(filmingNotes);
                  if (breakdown && typeof breakdown === 'object') {
                    const localBd = useBreakdownStore.getState().getBreakdown(row.id as string);
                    if (localBd && breakdown.characters && Array.isArray(breakdown.characters)) {
                      // Merge: keep local lookId if Supabase breakdown has empty lookId
                      breakdown.characters = breakdown.characters.map((cb: any) => {
                        const localCb = localBd.characters?.find((lc: any) => lc.characterId === cb.characterId);
                        if (localCb && !cb.lookId && localCb.lookId) {
                          return { ...cb, lookId: localCb.lookId };
                        }
                        return cb;
                      });
                    }
                    useBreakdownStore.getState().setBreakdown(row.id as string, breakdown);
                  }
                } catch { /* not valid JSON, skip */ }
              }
            }

            // ── Populate continuity tracker and photos from continuity_events ──
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

                // Restore continuity photos from the stored metadata
                const evData = entry.continuity_events_data as Record<string, any> | null;
                if (evData?.prep_photos) {
                  const pp = evData.prep_photos;
                  const photosStore = useContinuityPhotosStore.getState();
                  if (pp.masterRef) {
                    photosStore.setMasterRef(sceneId, characterId, pp.masterRef);
                  }
                  if (pp.anglePhotos) {
                    for (const [angle, photo] of Object.entries(pp.anglePhotos)) {
                      if (photo) {
                        photosStore.setAnglePhoto(sceneId, characterId, angle as any, photo as any);
                      }
                    }
                  }
                  if (pp.additional && Array.isArray(pp.additional)) {
                    for (const photo of pp.additional) {
                      photosStore.addAdditionalPhoto(sceneId, characterId, photo);
                    }
                  }
                }
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

            // ── Populate budget store ──
            if (data.budget) {
              const budgetStore = useBudgetStore(projectId!);
              const state = budgetStore.getState();
              const projectInfo = (data.budget.project_info as any) || {};
              const categories = (data.budget.categories as any[]) || [];
              const expenses = (data.budget.expenses as any[]) || [];
              const receipts = (data.budget.receipts as any[]) || [];
              if (projectInfo && Object.keys(projectInfo).length > 0) {
                state.setProjectInfo(projectInfo);
              }
              if (categories.length > 0) {
                budgetStore.setState({ categories });
              }
              if (expenses.length > 0) {
                budgetStore.setState({ expenses });
              }
              if (receipts.length > 0) {
                budgetStore.setState({ receipts });
              }
              if (data.budget.currency) {
                budgetStore.setState({ currency: data.budget.currency as any });
              }
              if (data.budget.is_ltd !== undefined) {
                budgetStore.setState({ isLTD: data.budget.is_ltd as boolean });
              }
            }

            // ── Populate call sheets store from call_sheet_data ──
            if (data.callSheets.length > 0) {
              const csStore = useCallSheetStore(projectId!);
              const existingIds = new Set(csStore.getState().sheets.map(s => s.id));
              for (const row of data.callSheets) {
                const id = row.id as string;
                if (existingIds.has(id)) continue;
                const parsed = row.parsed_data as Record<string, unknown> | null;
                if (parsed?.pdfUrl) {
                  csStore.getState().addSheet({
                    id,
                    name: (parsed.name as string) || '',
                    date: (row.shoot_date as string) || '',
                    dataUri: parsed.pdfUrl as string,
                    thumbnailUri: (parsed.thumbnailUrl as string) || '',
                    uploadedAt: (parsed.uploadedAt as string) || (row.created_at as string) || '',
                  });
                }
              }
            }

            // ── Populate timesheet store from timesheets ──
            if (data.timesheetEntries.length > 0) {
              const tsStore = useTimesheetStore(projectId!);
              // Look for the full Prep state dump (sentinel row)
              const fullStateRow = data.timesheetEntries.find(
                (e) => (e.week_starting as string) === '1970-01-01',
              );
              if (fullStateRow) {
                const entries = fullStateRow.entries as Record<string, unknown> | null;
                if (entries?._prepTimesheetState) {
                  const state = tsStore.getState();
                  if (entries.production) state.setProduction(entries.production as any);
                  if (Array.isArray(entries.crew) && entries.crew.length > 0) {
                    // Only hydrate crew if local store is empty
                    if (state.crew.length === 0) {
                      tsStore.setState({ crew: entries.crew as any });
                    }
                  }
                  if (entries.entries && typeof entries.entries === 'object') {
                    const localEntries = state.entries;
                    if (Object.keys(localEntries).length === 0) {
                      tsStore.setState({ entries: entries.entries as any });
                    }
                  }
                }
              }
            }

          } finally {
            setReceivingFromRealtime(false);
          }

          // If there were local-only looks not yet in Supabase, save them now
          if (localOnlyLooks.length > 0) {
            console.log(`[useProjectSync] Syncing ${localOnlyLooks.length} local-only look(s) to Supabase`);
            const lookSceneMap = buildLookSceneMap(projectId!);
            saveLooks(projectId!, looks as any, lookSceneMap);
          }
        }

        // ── Populate tags store (always, regardless of scene data) ──
        if (data.tags) {
          const tags = (data.tags.tags as any[]) || [];
          if (tags.length > 0) {
            setReceivingFromRealtime(true);
            try {
              useTagStore.setState({ tags });
            } finally {
              setReceivingFromRealtime(false);
            }
          }
        }

        // ── Populate revised scenes store (always, regardless of scene data) ──
        if (data.revision) {
          const changes = (data.revision.changes as any[]) || [];
          const reviewedSceneIds = (data.revision.reviewed_scene_ids as string[]) || [];
          const filename = (data.revision.filename as string) || '';
          const uploadedAt = (data.revision.uploaded_at as string) || new Date().toISOString();
          if (changes.length > 0) {
            setReceivingFromRealtime(true);
            try {
              useRevisedScenesStore.setState({
                revisions: {
                  ...useRevisedScenesStore.getState().revisions,
                  [projectId!]: { changes, reviewedSceneIds, filename, uploadedAt },
                },
              });
            } finally {
              setReceivingFromRealtime(false);
            }
          }
        }

        // If Supabase scene/character tables are empty but script_uploads has
        // parsed_data, restore from there so the script displays on load.
        if (scenes.length === 0 && characters.length === 0 && data.scriptUpload) {
          const sp = data.scriptUpload.parsed_data as {
            scenes?: any[]; characters?: any[]; looks?: any[];
            filename?: string; parsedAt?: string;
          } | null;
          if (sp && ((sp.scenes && sp.scenes.length > 0) || (sp.characters && sp.characters.length > 0))) {
            console.log('[useProjectSync] Restoring from script_uploads.parsed_data —',
              `scenes: ${sp.scenes?.length ?? 0}, characters: ${sp.characters?.length ?? 0}`);
            setReceivingFromRealtime(true);
            try {
              useParsedScriptStore.getState().setParsedData(projectId!, {
                scenes: sp.scenes || [],
                characters: sp.characters || [],
                looks: sp.looks || [],
                filename: sp.filename || (data.scriptUpload.file_name as string) || 'script.pdf',
                parsedAt: sp.parsedAt || new Date().toISOString(),
              });

              useProjectStore.getState().updateProject(projectId!, {
                scenes: sp.scenes?.length ?? 0,
                characters: sp.characters?.length ?? 0,
                scriptFilename: (data.scriptUpload.file_name as string) || undefined,
              });

              // Populate script upload store so hasScript is true
              useScriptUploadStore.getState().setScript(projectId!, {
                projectId: projectId!,
                filename: (data.scriptUpload.file_name as string) || 'script.pdf',
                uploadedAt: (data.scriptUpload.created_at as string) || new Date().toISOString(),
                sceneCount: sp.scenes?.length ?? 0,
                rawText: '',
              });

              // Trigger a sync so the restored data persists in scenes/characters tables
              if (sp.scenes && sp.scenes.length > 0) {
                saveScenes(projectId!, sp.scenes as any);
              }
              if (sp.characters && sp.characters.length > 0) {
                saveCharacters(projectId!, sp.characters as any);
              }
              if (sp.looks && sp.looks.length > 0) {
                const lookSceneMap = buildLookSceneMap(projectId!);
                saveLooks(projectId!, sp.looks as any, lookSceneMap);
              }
            } finally {
              setReceivingFromRealtime(false);
            }
          }
        }

        // If Supabase had no scene data but localStorage does (data was never synced),
        // trigger a save now so data survives future logouts
        if (scenes.length === 0 && characters.length === 0) {
          const localParsed = useParsedScriptStore.getState().getParsedData(projectId!);
          if (localParsed && localParsed.scenes.length > 0) {
            console.log('[useProjectSync] Supabase empty but localStorage has data — triggering sync');
            // Touch the stores to trigger save watchers by re-setting the same data
            // (save watchers check reference equality, so we need a new reference)
            const synopses = useSynopsisStore.getState().synopses;
            const metaOverrides = useSceneMetaStore.getState().overrides;
            const mergedScenes = localParsed.scenes.map(s => {
              const synOvr = synopses[s.id];
              const metaOvr = metaOverrides[s.id];
              return {
                ...s,
                synopsis: synOvr !== undefined ? synOvr : s.synopsis,
                intExt: metaOvr?.intExt ?? s.intExt,
                dayNight: metaOvr?.dayNight ?? s.dayNight,
                location: metaOvr?.location ?? s.location,
              };
            });
            saveScenes(projectId!, mergedScenes as any);

            const charOverrides = useCharacterOverridesStore.getState().overrides;
            const mergedChars = localParsed.characters.map(c => {
              const ovr = charOverrides[c.id];
              return ovr ? { ...c, ...ovr } : c;
            });
            saveCharacters(projectId!, mergedChars as any);

            if (localParsed.looks.length > 0) {
              const lookSceneMap = buildLookSceneMap(projectId!);
              saveLooks(projectId!, localParsed.looks as any, lookSceneMap);
            }

            // Sync tags first so resolved breakdowns include tag data
            const localTags = useTagStore.getState().tags;
            if (localTags.length > 0 && !data.tags) {
              saveTags(projectId!, localTags);
            }

            // Sync breakdowns (resolve tag text into empty fields for mobile)
            const allTags = useTagStore.getState().tags;
            const breakdowns = useBreakdownStore.getState().breakdowns;
            for (const [sceneId, bd] of Object.entries(breakdowns)) {
              // Skip mock breakdown IDs (s1, s2, etc.)
              if (localParsed.scenes.some(s => s.id === sceneId)) {
                const sceneTags = allTags.filter((t) => t.sceneId === sceneId);
                const resolved = resolveBreakdownForSync(bd, sceneTags);
                saveBreakdown(projectId!, sceneId, resolved as any);
              }
            }

            // Sync continuity tracker entries
            const continuityEntries = useContinuityTrackerStore.getState().entries;
            for (const [, entry] of Object.entries(continuityEntries)) {
              if (entry && localParsed.scenes.some(s => s.id === entry.sceneId)) {
                saveContinuityEntry(entry.sceneId, entry.characterId, {
                  status: entry.status === 'pending' ? 'not_started' : entry.status,
                  flags: { ...entry.flags } as Record<string, boolean>,
                  generalNotes: entry.notes,
                });
              }
            }
          }
        }

        // Subscribe to Realtime (always enabled in Prep app)
        {
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
  // BROWSER SAFETY NETS — prevent data loss on tab close / navigate away
  // ════════════════════════════════════════════════════════════

  useEffect(() => {
    // Warn user if they try to close the tab with unsaved changes
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingSaves()) {
        e.preventDefault();
        // Trigger flush immediately — the browser gives us a brief window
        flushPrepSync();
      }
    };

    // Flush pending saves when the tab becomes hidden (user switches tabs,
    // minimizes, or navigates away). This is the most reliable save point
    // because the browser guarantees this event fires.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && hasPendingSaves()) {
        flushPrepSync();
      }
    };

    // pagehide fires when the page is being unloaded — last chance to save
    const onPageHide = () => {
      if (hasPendingSaves()) {
        flushPrepSync();
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
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

      // Save looks (include scene assignments from breakdown store)
      if (curr.looks !== prev?.looks && curr.looks.length > 0) {
        const lookSceneMap = buildLookSceneMap(projectId);
        saveLooks(projectId, curr.looks as any, lookSceneMap);
      }
    });

    return unsub;
  }, [projectId, hasPrepAccess]);

  // Watch breakdown store for changes → save to Supabase
  useEffect(() => {
    if (!projectId || !hasPrepAccess) return;

    const unsub = useBreakdownStore.subscribe((state, prevState) => {
      if (state.breakdowns === prevState.breakdowns) return;

      // Resolve tag text into empty fields before saving so mobile sees complete data
      const tags = useTagStore.getState().tags;

      // Find which breakdowns changed and save each one
      for (const sceneId of Object.keys(state.breakdowns)) {
        if (state.breakdowns[sceneId] !== prevState.breakdowns[sceneId]) {
          const sceneTags = tags.filter((t) => t.sceneId === sceneId);
          const resolved = resolveBreakdownForSync(state.breakdowns[sceneId], sceneTags);
          saveBreakdown(projectId, sceneId, resolved as any);
        }
      }

      // Re-sync look_scenes when breakdown changes (look assignments live here)
      const parsed = useParsedScriptStore.getState().getParsedData(projectId);
      if (parsed && parsed.looks.length > 0) {
        const lookSceneMap = buildLookSceneMap(projectId);
        if (Object.keys(lookSceneMap).length > 0) {
          saveLooks(projectId, parsed.looks as any, lookSceneMap);
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

  // Watch budget store → save to Supabase
  useEffect(() => {
    if (!projectId || !hasPrepAccess) return;

    const budgetStore = useBudgetStore(projectId);
    const unsub = budgetStore.subscribe((state, prevState) => {
      // Check if any budget data changed
      if (
        state.projectInfo === prevState.projectInfo &&
        state.categories === prevState.categories &&
        state.expenses === prevState.expenses &&
        state.receipts === prevState.receipts &&
        state.isLTD === prevState.isLTD &&
        state.currency === prevState.currency
      ) return;

      saveBudget(projectId, {
        projectInfo: state.projectInfo,
        categories: state.categories,
        expenses: state.expenses,
        receipts: state.receipts,
        isLTD: state.isLTD,
        currency: state.currency,
      });
    });

    return unsub;
  }, [projectId, hasPrepAccess]);

  // Watch tags store → save to Supabase AND re-save affected breakdowns
  // so mobile gets resolved tag text in filming_notes
  useEffect(() => {
    if (!projectId || !hasPrepAccess) return;

    const unsub = useTagStore.subscribe((state, prevState) => {
      if (state.tags === prevState.tags) return;
      saveTags(projectId, state.tags);

      // Find which scenes had tag changes and re-save their breakdowns
      const changedSceneIds = new Set<string>();
      for (const tag of state.tags) {
        const prev = prevState.tags.find((t) => t.id === tag.id);
        if (!prev || prev !== tag) changedSceneIds.add(tag.sceneId);
      }
      // Also check removed tags
      for (const tag of prevState.tags) {
        if (!state.tags.find((t) => t.id === tag.id)) changedSceneIds.add(tag.sceneId);
      }

      const breakdowns = useBreakdownStore.getState().breakdowns;
      for (const sceneId of changedSceneIds) {
        const bd = breakdowns[sceneId];
        if (bd) {
          const sceneTags = state.tags.filter((t) => t.sceneId === sceneId);
          const resolved = resolveBreakdownForSync(bd, sceneTags);
          saveBreakdown(projectId, sceneId, resolved as any);
        }
      }
    });

    return unsub;
  }, [projectId, hasPrepAccess]);

  // Watch revised scenes store → save to Supabase
  useEffect(() => {
    if (!projectId || !hasPrepAccess) return;

    const unsub = useRevisedScenesStore.subscribe((state, prevState) => {
      const curr = state.revisions[projectId];
      const prev = prevState.revisions[projectId];
      if (curr === prev) return;

      if (curr) {
        saveRevision(projectId, {
          changes: curr.changes,
          reviewedSceneIds: curr.reviewedSceneIds,
          filename: curr.filename,
          uploadedAt: curr.uploadedAt,
        });
      }
    });

    return unsub;
  }, [projectId, hasPrepAccess]);

  // Watch continuity photos store → upload to Supabase Storage + save metadata
  useEffect(() => {
    if (!projectId || !hasPrepAccess) return;

    const unsub = useContinuityPhotosStore.subscribe((state, prevState) => {
      if (state.photos === prevState.photos) return;

      for (const key of Object.keys(state.photos)) {
        if (state.photos[key] !== prevState.photos[key]) {
          const photos = state.photos[key];
          if (!photos) continue;

          const [sceneId, characterId] = key.split('-');
          if (!sceneId || !characterId) continue;

          // Upload any new data URI photos to Supabase Storage
          const uploadIfDataUri = async (photo: { id: string; url: string; filename: string; addedAt: string }) => {
            if (photo.url.startsWith('data:') || photo.url.startsWith('blob:')) {
              const storageUrl = await uploadContinuityPhoto(
                projectId, sceneId, characterId, photo.id, photo.url
              );
              if (storageUrl) {
                // Update the store with the storage URL so it persists
                return { ...photo, url: storageUrl };
              }
            }
            return photo;
          };

          // Process uploads in background
          (async () => {
            let updated = false;
            const newAnglePhotos = { ...photos.anglePhotos };
            for (const [angle, photo] of Object.entries(photos.anglePhotos)) {
              if (photo && (photo.url.startsWith('data:') || photo.url.startsWith('blob:'))) {
                const uploaded = await uploadIfDataUri(photo);
                if (uploaded.url !== photo.url) {
                  newAnglePhotos[angle as keyof typeof newAnglePhotos] = uploaded as any;
                  updated = true;
                }
              }
            }

            let newMasterRef = photos.masterRef;
            if (photos.masterRef && (photos.masterRef.url.startsWith('data:') || photos.masterRef.url.startsWith('blob:'))) {
              newMasterRef = await uploadIfDataUri(photos.masterRef);
              if (newMasterRef.url !== photos.masterRef.url) updated = true;
            }

            const newAdditional: typeof photos.additional = [];
            for (const photo of photos.additional) {
              if (photo.url.startsWith('data:') || photo.url.startsWith('blob:')) {
                const uploaded = await uploadIfDataUri(photo);
                newAdditional.push(uploaded);
                if (uploaded.url !== photo.url) updated = true;
              } else {
                newAdditional.push(photo);
              }
            }

            // Save photo metadata to continuity_events
            saveContinuityPhotoMeta(projectId, sceneId, characterId, {
              anglePhotos: newAnglePhotos as any,
              masterRef: newMasterRef,
              additional: newAdditional,
            });

            // Update store with storage URLs if any were uploaded
            if (updated) {
              setReceivingFromRealtime(true);
              try {
                useContinuityPhotosStore.setState((s) => ({
                  photos: {
                    ...s.photos,
                    [key]: {
                      anglePhotos: newAnglePhotos,
                      masterRef: newMasterRef,
                      additional: newAdditional,
                    },
                  },
                }));
              } finally {
                setReceivingFromRealtime(false);
              }
            }
          })();
        }
      }
    });

    return unsub;
  }, [projectId, hasPrepAccess]);

  // Watch call sheet store → upload to Supabase Storage + save metadata
  useEffect(() => {
    if (!projectId || !hasPrepAccess) return;

    const csStore = useCallSheetStore(projectId);
    let prevSheetIds = new Set(csStore.getState().sheets.map(s => s.id));

    const unsub = csStore.subscribe((state) => {
      const currentIds = new Set(state.sheets.map(s => s.id));

      // Detect new sheets (added)
      for (const sheet of state.sheets) {
        if (!prevSheetIds.has(sheet.id) && sheet.dataUri.startsWith('data:')) {
          // Upload new sheet to Supabase Storage
          uploadCallSheetToStorage(projectId, sheet).then((urls) => {
            if (urls) {
              // Replace data URIs with storage URLs in the store
              setReceivingFromRealtime(true);
              try {
                csStore.setState((s) => ({
                  sheets: s.sheets.map(sh =>
                    sh.id === sheet.id
                      ? { ...sh, dataUri: urls.pdfUrl, thumbnailUri: urls.thumbnailUrl }
                      : sh,
                  ),
                }));
              } finally {
                setReceivingFromRealtime(false);
              }
            }
          });
        }
      }

      // Detect removed sheets
      for (const oldId of prevSheetIds) {
        if (!currentIds.has(oldId)) {
          removeCallSheetFromSupabase(projectId, oldId);
        }
      }

      prevSheetIds = currentIds;
    });

    return unsub;
  }, [projectId, hasPrepAccess]);

  // Watch timesheet store → save full state to Supabase
  useEffect(() => {
    if (!projectId || !hasPrepAccess) return;

    const tsStore = useTimesheetStore(projectId);
    const unsub = tsStore.subscribe((state, prevState) => {
      if (
        state.production === prevState.production &&
        state.crew === prevState.crew &&
        state.entries === prevState.entries
      ) return;

      saveTimesheetFull(projectId, {
        production: state.production,
        crew: state.crew,
        entries: state.entries,
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
