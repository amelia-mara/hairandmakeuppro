import { useState, useEffect, useCallback } from 'react';
import {
  useParsedScriptStore,
  useScriptUploadStore,
  useBreakdownStore,
  useSynopsisStore,
  useCharacterOverridesStore,
  type ParsedCharacterData,
  type ParsedSceneData,
  type Look,
} from '@/stores/breakdownStore';
import { useProjectStore } from '@/stores/projectStore';
import { diffScripts } from '@/utils/scriptDiff';
import { supabase } from '@/lib/supabase';

/**
 * Single row of the `script_uploads` table hydrated with parsed data.
 * Kept local to this hook because it's only meaningful alongside the
 * drafts-loading flow below — parent components just iterate the
 * returned `drafts` array and read properties.
 */
export interface ScriptDraft {
  id: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  scene_count: number | null;
  character_count: number | null;
  version_number: number;
  version_label: string | null;
  is_active: boolean;
  created_at: string;
  parsed_data: {
    scenes: ParsedSceneData[];
    characters: ParsedCharacterData[];
    looks: Look[];
    filename: string;
    parsedAt: string;
  } | null;
}

interface UseScriptDraftsArgs {
  projectId: string;
  /** Whether the parent's Tools menu is currently open. When it closes
   *  the drafts sub-dropdown collapses and the cached drafts list is
   *  cleared so a fresh fetch happens next time it's opened. */
  isToolsMenuOpen: boolean;
  /** Called after a draft is successfully loaded or after a PDF
   *  preview URL is signed, so the parent's Tools menu closes itself. */
  onCloseToolsMenu: () => void;
}

/**
 * Drafts-drawer + auto-recover data flow for the ScriptBreakdown page.
 *
 * Owns four concerns that originally lived inline at the top of
 * `prep/src/pages/ScriptBreakdown.tsx`:
 *
 *   1. Fetching the `script_uploads` table for the current project the
 *      first time the drafts sub-dropdown is expanded (lazy load, one
 *      fetch per open).
 *   2. Loading a selected draft's `parsed_data` into the parsed-script
 *      store, marking that draft active in Supabase, and updating the
 *      project record's `scriptFilename`.
 *   3. Signing a time-limited preview URL for a draft's original PDF
 *      stored in the `project-documents` Supabase Storage bucket.
 *   4. Auto-recovering parsed data into the local store on mount when
 *      the store is empty but the active draft row in `script_uploads`
 *      still has a `parsed_data` blob — handles device switches and
 *      localStorage clears.
 *
 * The parent remains responsible for reading `parsedData` from the
 * parsed-script store (it needs it for ALL_SCENES / ALL_CHARACTERS /
 * ALL_LOOKS anyway); this hook subscribes to the same store
 * independently via `useParsedScriptStore()` and re-renders through
 * its own subscription, so both sides stay in sync.
 *
 * Behaviour-preserving extraction only — same fetch timing, same
 * fallback conditions, same error handling, same store interactions.
 */
export function useScriptDrafts({
  projectId,
  isToolsMenuOpen,
  onCloseToolsMenu,
}: UseScriptDraftsArgs) {
  const parsedScriptStore = useParsedScriptStore();
  const scriptUpload = useScriptUploadStore();
  const updateProject = useProjectStore((s) => s.updateProject);

  const [draftsExpanded, setDraftsExpanded] = useState(false);
  const [drafts, setDrafts] = useState<ScriptDraft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [viewingDraftPdf, setViewingDraftPdf] = useState<{ url: string; name: string } | null>(null);
  const [loadingDraftId, setLoadingDraftId] = useState<string | null>(null);

  /* Fetch drafts when the drafts sub-dropdown is opened */
  useEffect(() => {
    if (!draftsExpanded || drafts.length > 0) return;
    async function fetchDrafts() {
      setDraftsLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('script_uploads')
          .select('id, file_name, storage_path, file_size, scene_count, character_count, version_number, version_label, is_active, created_at, parsed_data')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setDrafts(data || []);
      } catch (err) {
        console.error('Failed to fetch drafts:', err);
      } finally {
        setDraftsLoading(false);
      }
    }
    fetchDrafts();
  }, [draftsExpanded, projectId, drafts.length]);

  /* Reset drafts cache when tools menu closes */
  useEffect(() => {
    if (!isToolsMenuOpen) {
      setDraftsExpanded(false);
      setDrafts([]);
    }
  }, [isToolsMenuOpen]);

  /* Load a previous draft's parsed data */
  const handleLoadDraft = useCallback(async (draft: ScriptDraft) => {
    if (!draft.parsed_data) return;
    // Allow re-loading the active draft when the store is empty (e.g. after
    // switching devices or clearing cache)
    const previousParsed = parsedScriptStore.getParsedData(projectId);
    const storeHasData = !!previousParsed;
    if (draft.is_active && storeHasData) return;
    setLoadingDraftId(draft.id);
    try {
      // ── Preserve breakdown work across the draft swap ──
      // Each upload mints fresh UUIDs for every scene + character, so
      // switching drafts orphans every scene-keyed entry in the
      // breakdown / synopsis / scene-notes stores even when the
      // content is identical between drafts. Mirror the revision
      // pipeline in useScriptUploadProcessor: diff old vs new scenes
      // by content, then remap breakdowns, synopses, story days,
      // scene notes (localStorage), and character profile overrides
      // from the previously-active scene IDs onto the loaded
      // draft's IDs.
      if (previousParsed && previousParsed.scenes.length > 0) {
        const diff = diffScripts(
          previousParsed.scenes,
          draft.parsed_data.scenes,
          previousParsed.characters,
          draft.parsed_data.characters,
        );

        const breakdownStore = useBreakdownStore.getState();
        const synopsisStore = useSynopsisStore.getState();
        const overridesStore = useCharacterOverridesStore.getState();

        // Scene-keyed: breakdowns + synopses
        for (const [oldSceneId, newSceneId] of diff.idMap) {
          if (oldSceneId === newSceneId) continue;

          const oldBd = breakdownStore.getBreakdown(oldSceneId);
          if (oldBd) {
            const remappedChars = oldBd.characters.map((cb) => {
              const newCharId = diff.characterIdMap.get(cb.characterId);
              return newCharId ? { ...cb, characterId: newCharId } : cb;
            });
            breakdownStore.setBreakdown(newSceneId, {
              ...oldBd,
              sceneId: newSceneId,
              characters: remappedChars,
            });
          }

          const oldSynopsis = synopsisStore.getSynopsis(oldSceneId, '');
          if (oldSynopsis) {
            synopsisStore.setSynopsis(newSceneId, oldSynopsis);
          }
        }

        // Preserve story-day labels on scenes that map cleanly.
        const remappedScenes = draft.parsed_data.scenes.map((s) => {
          const oldId = [...diff.idMap.entries()].find(([, n]) => n === s.id)?.[0];
          if (!oldId) return s;
          const oldScene = previousParsed.scenes.find((p) => p.id === oldId);
          if (!oldScene?.storyDay) return s;
          return { ...s, storyDay: oldScene.storyDay };
        });

        // Character profile overrides
        for (const [oldCharId, newCharId] of diff.characterIdMap) {
          if (oldCharId === newCharId) continue;
          const existing = overridesStore.overrides[oldCharId];
          if (existing) overridesStore.updateCharacter(newCharId, existing);
        }

        // Notes & Queries (localStorage `prep-scene-notes-{projectId}`)
        try {
          const key = `prep-scene-notes-${projectId}`;
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as Record<string, { text: string; flagged: boolean }>;
            const next: Record<string, { text: string; flagged: boolean }> = { ...parsed };
            for (const [oldSceneId, newSceneId] of diff.idMap) {
              if (oldSceneId === newSceneId) continue;
              const oldNote = parsed[oldSceneId];
              if (oldNote && (oldNote.text || oldNote.flagged) && !next[newSceneId]) {
                next[newSceneId] = oldNote;
              }
            }
            localStorage.setItem(key, JSON.stringify(next));
          }
        } catch (err) {
          console.warn('[useScriptDrafts] failed to remap scene notes:', err);
        }

        parsedScriptStore.setParsedData(projectId, {
          scenes: remappedScenes,
          characters: draft.parsed_data.characters,
          looks: draft.parsed_data.looks,
          filename: draft.parsed_data.filename,
          parsedAt: draft.parsed_data.parsedAt,
        });
      } else {
        parsedScriptStore.setParsedData(projectId, {
          scenes: draft.parsed_data.scenes,
          characters: draft.parsed_data.characters,
          looks: draft.parsed_data.looks,
          filename: draft.parsed_data.filename,
          parsedAt: draft.parsed_data.parsedAt,
        });
      }

      // Update script upload store
      scriptUpload.setScript(projectId, {
        projectId,
        filename: draft.file_name,
        uploadedAt: draft.created_at,
        sceneCount: draft.scene_count || 0,
        rawText: '',
      });

      // Update active status in Supabase
      await supabase.from('script_uploads')
        .update({ is_active: false })
        .eq('project_id', projectId)
        .eq('is_active', true);

      await supabase.from('script_uploads')
        .update({ is_active: true })
        .eq('id', draft.id);

      // Update project filename
      updateProject(projectId, { scriptFilename: draft.file_name });

      // Refresh drafts list to show new active state
      setDrafts((prev) => prev.map((d) => ({
        ...d,
        is_active: d.id === draft.id,
      })));

      onCloseToolsMenu();
    } catch (err) {
      console.error('Failed to load draft:', err);
    } finally {
      setLoadingDraftId(null);
    }
  }, [projectId, parsedScriptStore, scriptUpload, updateProject, onCloseToolsMenu]);

  /* View a draft's original PDF */
  const handleViewDraftPdf = useCallback(async (e: React.MouseEvent, draft: ScriptDraft) => {
    e.stopPropagation();
    try {
      const { data, error: urlError } = await supabase.storage
        .from('project-documents')
        .createSignedUrl(draft.storage_path, 3600);

      if (urlError) throw urlError;
      if (data?.signedUrl) {
        setViewingDraftPdf({ url: data.signedUrl, name: draft.file_name });
        onCloseToolsMenu();
      }
    } catch (err) {
      console.error('Failed to get PDF URL:', err);
    }
  }, [onCloseToolsMenu]);

  /* Delete an inactive draft */
  const handleDeleteDraft = useCallback(async (e: React.MouseEvent, draft: ScriptDraft) => {
    e.stopPropagation();
    if (draft.is_active) {
      // Refuse to delete the currently-active draft — it would orphan the
      // breakdown / synopses / story-day work that's live for it. The user
      // would need to switch to another draft first, or upload a new one.
      alert('Switch to a different draft first — you can\'t delete the active script.');
      return;
    }
    const ok = window.confirm(`Delete draft "${draft.file_name}"? The original PDF and parsed data will be removed permanently.`);
    if (!ok) return;
    try {
      // Storage cleanup is best-effort — proceed with the row delete even
      // if the file is missing (it may have been pruned independently).
      if (draft.storage_path) {
        const { error: storageErr } = await supabase.storage
          .from('project-documents')
          .remove([draft.storage_path]);
        if (storageErr) console.warn('[useScriptDrafts] storage remove failed:', storageErr);
      }
      const { error: dbErr } = await supabase
        .from('script_uploads')
        .delete()
        .eq('id', draft.id);
      if (dbErr) throw dbErr;
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    } catch (err) {
      console.error('Failed to delete draft:', err);
      alert('Could not delete the draft. Check the console for details.');
    }
  }, []);

  /* Auto-recover: if parsedScriptStore is empty but the active draft in
     script_uploads has parsed_data, load it. This handles the case where
     the scenes/characters tables are empty AND localStorage was cleared. */
  const parsedData = parsedScriptStore.getParsedData(projectId);
  useEffect(() => {
    if (parsedData) return; // Already have data
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('script_uploads')
          .select('id, file_name, parsed_data, created_at, scene_count')
          .eq('project_id', projectId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled || error || !data?.parsed_data) return;
        const pd = data.parsed_data as {
          scenes?: any[]; characters?: any[]; looks?: any[];
          filename?: string; parsedAt?: string;
        };
        if (!pd.scenes || pd.scenes.length === 0) return;
        console.log('[ScriptBreakdown] Auto-recovering parsed data from script_uploads —', pd.scenes.length, 'scenes');
        parsedScriptStore.setParsedData(projectId, {
          scenes: pd.scenes || [],
          characters: pd.characters || [],
          looks: pd.looks || [],
          filename: pd.filename || data.file_name || 'script.pdf',
          parsedAt: pd.parsedAt || new Date().toISOString(),
        });
        scriptUpload.setScript(projectId, {
          projectId,
          filename: data.file_name || 'script.pdf',
          uploadedAt: data.created_at || new Date().toISOString(),
          sceneCount: data.scene_count || pd.scenes.length,
          rawText: '',
        });
      } catch (err) {
        console.error('[ScriptBreakdown] Auto-recover failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, parsedData, parsedScriptStore, scriptUpload]);

  return {
    drafts,
    draftsLoading,
    draftsExpanded,
    setDraftsExpanded,
    loadingDraftId,
    handleLoadDraft,
    handleViewDraftPdf,
    handleDeleteDraft,
    viewingDraftPdf,
    setViewingDraftPdf,
  };
}
