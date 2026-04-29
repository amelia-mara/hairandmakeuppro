import { useState, useCallback } from 'react';
import {
  useBreakdownStore,
  useSynopsisStore,
  useScriptUploadStore,
  useParsedScriptStore,
  useCharacterOverridesStore,
  type Scene,
  type Character,
} from '@/stores/breakdownStore';
import { parseScriptFile, type ParsedScript } from '@/utils/scriptParser';
import { generateLooksFromScript } from '@/utils/lookGenerator';
import { diffScripts, type DiffResult } from '@/utils/scriptDiff';
import { inferTimelineType } from '@/utils/inferTimelineType';
import { supabase } from '@/lib/supabase';
import { useProjectStore } from '@/stores/projectStore';

interface UseScriptUploadProcessorArgs {
  projectId: string;
  /** The file the user has selected in the modal. The hook reads this at
   *  pipeline start — the modal owns the picker UI and passes the current
   *  value in on every render. */
  selectedFile: File | null;
  /** Called with the uploaded filename (and diff result for revisions)
   *  after the entire pipeline succeeds. The parent closes the modal
   *  from this callback, so the hook deliberately does NOT reset
   *  `processing` on success — the component unmounts with it true. */
  onUploaded: (filename: string, diffResult?: DiffResult) => void;
  /** Called with a user-facing error message if the pipeline throws.
   *  The modal wires this to its own `setError` so the drop zone shows
   *  the error once `processing` resets to false. */
  onError: (message: string) => void;
}

/**
 * Script upload processing pipeline, extracted from ScriptUploadModal.
 *
 * Owns the full async sequence: PDF / FDX / Fountain / TXT parsing,
 * character ID generation, scene deduplication and construction, look
 * generation, revision detection (with breakdown / synopsis / story-day
 * / character-override remapping when a previous draft exists), local
 * store population, and Supabase storage + `script_uploads` insert.
 *
 * The modal retains ownership of the picker UI (selectedFile, dragOver,
 * validation error) and passes `selectedFile` into the hook. The hook
 * owns the three "what's happening" state fields — `processing`,
 * `progress`, `statusText` — which drive the progress bar and status
 * line during the pipeline.
 *
 * This is a behaviour-preserving extraction from
 * `prep/src/pages/ScriptBreakdown.tsx` — same pipeline order, same
 * store mutations, same Supabase calls, same console logs, same error
 * handling, same early-exit conditions, same `await sleep(200)` pacing
 * between stages. Only difference from the inline version: error and
 * success handoff are via callbacks instead of direct state setters.
 */
export function useScriptUploadProcessor({
  projectId,
  selectedFile,
  onUploaded,
  onError,
}: UseScriptUploadProcessorArgs) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  const setScript = useScriptUploadStore((s) => s.setScript);
  const setParsedData = useParsedScriptStore((s) => s.setParsedData);
  const existingParsed = useParsedScriptStore((s) => s.getParsedData(projectId));
  const breakdownStore = useBreakdownStore();
  const synopsisStore = useSynopsisStore();

  const processFile = useCallback(async () => {
    if (!selectedFile) return;
    setProcessing(true);
    setProgress(10);
    setStatusText('Reading file...');

    try {
      const parsed: ParsedScript = await parseScriptFile(selectedFile, (status) => {
        setStatusText(status);
      });

      setProgress(50);
      setStatusText('Detecting characters...');
      await new Promise(r => setTimeout(r, 200));

      // Build character ID mapping
      const charIdMap = new Map<string, string>();
      const characters: Character[] = parsed.characters.map((pc, idx) => {
        const id = crypto.randomUUID();
        charIdMap.set(pc.normalizedName, id);
        return {
          id,
          name: pc.name,
          billing: idx + 1,
          category: pc.category || 'principal',
          age: '',
          gender: '',
          hairColour: '',
          hairType: '',
          eyeColour: '',
          skinTone: '',
          build: '',
          distinguishingFeatures: '',
          notes: `Appears in ${pc.sceneCount} scene${pc.sceneCount !== 1 ? 's' : ''}`,
        };
      });

      setProgress(70);
      setStatusText('Building scenes...');

      // Deduplicate scene numbers
      const seenSceneNumbers = new Map<string, number>();
      const scenes: Scene[] = parsed.scenes.map((ps, idx) => {
        let sceneNum = ps.sceneNumber;
        const count = (seenSceneNumbers.get(sceneNum) || 0) + 1;
        seenSceneNumbers.set(sceneNum, count);
        if (count > 1) sceneNum = `${sceneNum}-${count}`;

        const charIds = ps.characters
          .map(name => charIdMap.get(name))
          .filter((id): id is string => !!id);

        const dayNight = ps.timeOfDay === 'MORNING' ? 'DAWN' as const
          : ps.timeOfDay === 'EVENING' ? 'DUSK' as const
          : ps.timeOfDay === 'CONTINUOUS' ? 'DAY' as const
          : ps.timeOfDay as 'DAY' | 'NIGHT';

        const parsedNum = parseInt(sceneNum, 10);
        const isPreamble = ps.location === 'PREAMBLE';
        // Infer the breakdown form's Timeline → Type from the script's
        // own markers — `[FLASHBACK]`, `[MONTAGE]`, `[PRESENT]`, etc.
        // appear in the slugline or on the title card line above the
        // heading. Saves the user tagging every flagged scene by hand.
        const timelineType = inferTimelineType(ps.slugline, ps.titleCardBefore);
        return {
          id: crypto.randomUUID(),
          number: isNaN(parsedNum) ? idx + 1 : parsedNum,
          intExt: ps.intExt,
          dayNight,
          location: isPreamble ? 'PREAMBLE' : ps.location,
          storyDay: '',
          titleCardBefore: ps.titleCardBefore ?? null,
          timelineType: timelineType || undefined,
          timeInfo: '',
          characterIds: charIds,
          synopsis: '',
          // For real scenes the parser stores the slugline as the
          // first line of content, so we strip it for display. For
          // omitted scenes the verbatim line ("30 OMITTED 30") IS
          // the content, so we keep it untouched.
          scriptContent: isPreamble
            ? ps.content.trim()
            : ps.isOmitted
              ? ps.content.trim()
              : ps.content.replace(/^[^\n]*\n/, '').trim(),
          isOmitted: ps.isOmitted || undefined,
        };
      });

      setProgress(85);
      setStatusText('Generating looks...');
      await new Promise(r => setTimeout(r, 200));

      const { looks: generatedLooks, scenes: scenesWithStoryDays } = generateLooksFromScript(scenes, characters);

      // ━━━ REVISION DETECTION: if existing script data exists, remap breakdowns ━━━
      const isRevision = !!existingParsed;
      let diffResult: DiffResult | undefined;

      if (isRevision) {
        setProgress(90);
        setStatusText('Comparing with previous draft...');
        await new Promise(r => setTimeout(r, 200));

        diffResult = diffScripts(
          existingParsed.scenes,
          scenesWithStoryDays,
          existingParsed.characters,
          characters,
        );

        // Remap breakdown data from old scene IDs → new scene IDs
        // This preserves all breakdown work (HMW entries, continuity, synopses, etc.)
        for (const [oldSceneId, newSceneId] of diffResult.idMap) {
          if (oldSceneId === newSceneId) continue;

          // Remap main breakdown
          const existingBreakdown = breakdownStore.getBreakdown(oldSceneId);
          if (existingBreakdown) {
            // Also remap character IDs within the breakdown
            const remappedCharBreakdowns = existingBreakdown.characters.map((cb) => {
              const newCharId = diffResult!.characterIdMap.get(cb.characterId);
              return newCharId ? { ...cb, characterId: newCharId } : cb;
            });
            breakdownStore.setBreakdown(newSceneId, {
              ...existingBreakdown,
              sceneId: newSceneId,
              characters: remappedCharBreakdowns,
            });
          }

          // Remap synopsis
          const existingSynopsis = synopsisStore.getSynopsis(oldSceneId, '');
          if (existingSynopsis) {
            synopsisStore.setSynopsis(newSceneId, existingSynopsis);
          }
        }

        // For matched scenes, preserve story day assignments from previous breakdown
        for (const [oldSceneId, newSceneId] of diffResult.idMap) {
          const oldScene = existingParsed.scenes.find((s) => s.id === oldSceneId);
          const newScene = scenesWithStoryDays.find((s) => s.id === newSceneId);
          if (oldScene?.storyDay && newScene) {
            newScene.storyDay = oldScene.storyDay;
          }
        }

        // Preserve character profile overrides by remapping character IDs
        const charOverrides = useCharacterOverridesStore.getState();
        for (const [oldCharId, newCharId] of diffResult.characterIdMap) {
          if (oldCharId === newCharId) continue;
          const existing = charOverrides.overrides[oldCharId];
          if (existing) {
            charOverrides.updateCharacter(newCharId, existing);
          }
        }
      }

      // ━━━ Preserve user-created looks across the upload ━━━
      // Looks belong to the project, not to a specific draft snapshot.
      // Each upload mints fresh character UUIDs, so remap any existing
      // looks' characterId via the diff and merge them into the new
      // looks list. Without this step, every "+ New Look" the user
      // created since the last upload would silently disappear when
      // they upload a revision.
      let mergedLooks = generatedLooks;
      if (isRevision && existingParsed && existingParsed.looks.length > 0) {
        const generatedIds = new Set(generatedLooks.map((l) => l.id));
        const remappedExistingLooks = existingParsed.looks
          .map((lk) => {
            const newCharId = diffResult?.characterIdMap.get(lk.characterId) ?? lk.characterId;
            // Only keep the look if its character still exists in the
            // new draft (either via the diff map, or because the
            // character id matched directly).
            const newCharIdValid = characters.some((c) => c.id === newCharId);
            if (!newCharIdValid) return null;
            if (generatedIds.has(lk.id)) return null;
            return { ...lk, characterId: newCharId };
          })
          .filter((l): l is typeof generatedLooks[number] => !!l);
        mergedLooks = [...generatedLooks, ...remappedExistingLooks];
      }

      setProgress(95);
      setStatusText('Saving...');
      await new Promise(r => setTimeout(r, 200));

      // Store parsed data
      setParsedData(projectId, {
        scenes: scenesWithStoryDays,
        characters,
        looks: mergedLooks,
        filename: selectedFile.name,
        parsedAt: new Date().toISOString(),
      });

      // Store in script upload store for backward compat
      setScript(projectId, {
        projectId,
        filename: selectedFile.name,
        uploadedAt: new Date().toISOString(),
        sceneCount: scenes.length,
        rawText: parsed.rawText,
      });

      // Refresh the ProjectHub card counts so they update without a reload
      useProjectStore.getState().updateProject(projectId, {
        scenes: scenesWithStoryDays.length,
        characters: characters.length,
        scriptFilename: selectedFile.name,
        lastActive: new Date().toISOString(),
      });

      // Upload PDF to Supabase storage and create script_uploads record
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const timestamp = Date.now();
          const storagePath = `${projectId}/scripts/${timestamp}_${selectedFile.name}`;

          await supabase.storage
            .from('project-documents')
            .upload(storagePath, selectedFile, { upsert: false });

          const { data: versions } = await supabase
            .from('script_uploads')
            .select('version_number')
            .eq('project_id', projectId)
            .order('version_number', { ascending: false })
            .limit(1);

          const nextVersion = (versions?.[0]?.version_number ?? 0) + 1;

          // Deactivate all previous versions for this project
          await supabase.from('script_uploads')
            .update({ is_active: false })
            .eq('project_id', projectId)
            .eq('is_active', true);

          await supabase.from('script_uploads').insert({
            project_id: projectId,
            version_number: nextVersion,
            storage_path: storagePath,
            file_name: selectedFile.name,
            file_size: selectedFile.size,
            raw_text: parsed.rawText,
            scene_count: scenesWithStoryDays.length,
            character_count: characters.length,
            parsed_data: {
              scenes: scenesWithStoryDays,
              characters,
              looks: mergedLooks,
              filename: selectedFile.name,
              parsedAt: new Date().toISOString(),
            },
            is_active: true,
            status: 'parsed',
            uploaded_by: session.user.id,
          });
        }
      } catch (uploadErr) {
        console.warn('Failed to sync script to Supabase:', uploadErr);
      }

      setProgress(100);
      setStatusText('Done!');
      await new Promise(r => setTimeout(r, 300));

      onUploaded(selectedFile.name, diffResult);
    } catch (err) {
      console.error('Script processing error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      onError(`Failed to process file: ${message}`);
      setProcessing(false);
    }
  }, [
    projectId,
    selectedFile,
    onUploaded,
    onError,
    setScript,
    setParsedData,
    existingParsed,
    breakdownStore,
    synopsisStore,
  ]);

  return { processFile, processing, progress, statusText };
}
