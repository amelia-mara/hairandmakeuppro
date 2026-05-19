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

      /**
       * Split the parser's `sceneNumber` string into a numeric anchor
       * + alphabetic suffix. The slugline parser emits strings like
       * "132A", "7A", "23B" — these are screenplay sub-scenes that
       * slot under the parent scene number. They must NOT be turned
       * into independent scenes with new integer numbers, otherwise:
       *
       *   - 132A appears at the wrong position in the scene list
       *   - The diff key (number, suffix) doesn't match across drafts
       *   - The Story Day Breakdown's scene-cell lookup fails for the
       *     unsuffixed parent
       *
       * Returns { num, suffix } so the Scene record can carry both.
       * Falls back to { num: idx+1, suffix: undefined } when the
       * slugline had no number at all (intercut sluglines like
       * "INT. ALEXANDRA PALACE" without a leading number).
       */
      const parseSceneNumberString = (
        raw: string | null,
        idx: number,
      ): { num: number; suffix: string | undefined } => {
        if (!raw) return { num: idx + 1, suffix: undefined };
        const m = raw.trim().toUpperCase().match(/^(\d+)([A-Z]+)?$/);
        if (!m) {
          const parsed = parseInt(raw, 10);
          return { num: isNaN(parsed) ? idx + 1 : parsed, suffix: undefined };
        }
        return { num: parseInt(m[1], 10), suffix: m[2] || undefined };
      };

      // Track (number, suffix) pairs we've already minted so we can
      // detect TRUE duplicates (same parent + same suffix appearing
      // twice in the script — usually a parser misfire on revision
      // pages or a multi-page slugline echo). Replaces the old
      // unconditional "-2 / -3" rename, which silently split one
      // canonical scene into multiple Scene records numbered
      // identically and inflated the scene count.
      const seenKeys = new Set<string>();
      const scenes: Scene[] = [];
      let droppedDuplicates = 0;
      parsed.scenes.forEach((ps, idx) => {
        const { num, suffix } = parseSceneNumberString(ps.sceneNumber, idx);
        const isPreamble = ps.location === 'PREAMBLE' || ps.location === 'PRELUDE';
        // PRELUDE / unsuffixed-no-number scenes can't collide
        // meaningfully — let them through as separate entries.
        const dedupeKey = isPreamble
          ? `__preamble__${idx}`
          : `${num}|${suffix ?? ''}|${ps.intExt}|${ps.timeOfDay}|${ps.location}`;
        if (seenKeys.has(dedupeKey)) {
          droppedDuplicates++;
          return;
        }
        seenKeys.add(dedupeKey);

        const charIds = ps.characters
          .map((name) => charIdMap.get(name))
          .filter((id): id is string => !!id);

        const dayNight = ps.timeOfDay === 'MORNING' ? ('DAWN' as const)
          : ps.timeOfDay === 'EVENING' ? ('DUSK' as const)
          : ps.timeOfDay === 'CONTINUOUS' ? ('DAY' as const)
          : (ps.timeOfDay as 'DAY' | 'NIGHT');

        // Infer the breakdown form's Timeline → Type from the script's
        // own markers — `[FLASHBACK]`, `[MONTAGE]`, `[PRESENT]`, etc.
        const timelineType = inferTimelineType(ps.slugline, ps.titleCardBefore);

        scenes.push({
          id: crypto.randomUUID(),
          number: num,
          numberSuffix: suffix,
          intExt: ps.intExt,
          dayNight,
          location: isPreamble ? 'PRELUDE' : ps.location,
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
          backgroundCharacters: ps.backgroundCharacters,
          backgroundNotes: ps.backgroundNotes,
        });
      });
      if (droppedDuplicates > 0) {
        console.warn(
          `[scriptUpload] Dropped ${droppedDuplicates} duplicate scene(s) ` +
          `(same number+suffix+location+time appeared twice — likely a ` +
          `revision-page echo or parser misfire).`,
        );
      }

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

      // ━━━ F-37: Preserve existing DB character UUIDs across upload ━━━
      // Every upload mints fresh randomUUIDs for `characters` (L91). If
      // those go to saveCharacters as-is, upsertWithOrphanCleanup sees
      // the existing DB rows as orphans by id and DELETEs them — which
      // cascades via FK to wipe every attached look, look_scene, and
      // continuity_event for those characters. This single line of
      // destruction is why a green re-upload of THE PUNISHING dropped
      // 6 looks → 0 and 12 look_scenes → 0 in the 2026-05-19 dry-run.
      //
      // Fix: query existing DB characters BEFORE we hand the parsed
      // payload to setParsedData. Match by uppercase name (same key
      // scriptDiff uses internally at L246-253 and the cold-boot
      // remap uses at useProjectSync.ts:627-635) and rewrite each
      // matched character's `.id` to the existing DB id. Propagate
      // through scenes' characterIds[] and diffResult.characterIdMap
      // values so downstream code (mergedLooks, breakdown remap) sees
      // a consistent id-space. Union unmatched existing characters
      // back into the local set so they aren't seen as orphans either
      // (silent character deletion is the worst-case destruction).
      if (isRevision) {
        const { data: existingDbChars } = await supabase
          .from('characters')
          .select('id, name, metadata')
          .eq('project_id', projectId);

        if (existingDbChars && existingDbChars.length > 0) {
          const dbCharByUpperName = new Map<
            string,
            { id: string; metadata: Record<string, unknown> | null }
          >();
          for (const r of existingDbChars) {
            const key = String(r.name ?? '').toUpperCase().trim();
            dbCharByUpperName.set(key, {
              id: r.id as string,
              metadata: r.metadata as Record<string, unknown> | null,
            });
          }

          const matchedDbIds = new Set<string>();
          const dbIdMap = new Map<string, string>();
          for (let i = 0; i < characters.length; i++) {
            const c = characters[i];
            const existing = dbCharByUpperName.get(c.name.toUpperCase().trim());
            if (existing) {
              matchedDbIds.add(existing.id);
              if (existing.id !== c.id) {
                dbIdMap.set(c.id, existing.id);
                characters[i] = { ...c, id: existing.id };
              }
            }
          }

          if (dbIdMap.size > 0) {
            for (let i = 0; i < scenesWithStoryDays.length; i++) {
              const s = scenesWithStoryDays[i];
              scenesWithStoryDays[i] = {
                ...s,
                characterIds: s.characterIds.map((cid) => dbIdMap.get(cid) ?? cid),
              };
            }
            if (diffResult) {
              for (const [oldId, newId] of diffResult.characterIdMap) {
                const remapped = dbIdMap.get(newId);
                if (remapped) diffResult.characterIdMap.set(oldId, remapped);
              }
            }
          }

          // D1: union any DB characters that the new draft didn't match
          // (writer dropped them, parser missed them, etc.) back into
          // the local set with full metadata round-trip, so
          // upsertWithOrphanCleanup doesn't see them as orphans. Stale
          // characters stay visible in the breakdown UI; the user can
          // hand-remove via the existing "remove character entirely"
          // flow if the omission was intentional.
          let unmatchedRestored = 0;
          for (const r of existingDbChars) {
            const existingId = r.id as string;
            if (matchedDbIds.has(existingId)) continue;
            const md = (r.metadata as Record<string, unknown> | null) ?? {};
            characters.push({
              id: existingId,
              name: String(r.name ?? ''),
              billing:
                typeof md.billing === 'number'
                  ? md.billing
                  : characters.length + 1,
              category:
                md.category === 'supporting_artist'
                  ? 'supporting_artist'
                  : 'principal',
              age: String(md.age ?? ''),
              gender: String(md.gender ?? ''),
              hairColour: String(md.hairColour ?? ''),
              hairType: String(md.hairType ?? ''),
              eyeColour: String(md.eyeColour ?? ''),
              skinTone: String(md.skinTone ?? ''),
              build: String(md.build ?? ''),
              distinguishingFeatures: String(md.distinguishingFeatures ?? ''),
              notes: String(md.notes ?? ''),
            });
            unmatchedRestored++;
          }

          if (dbIdMap.size > 0 || unmatchedRestored > 0) {
            console.log(
              `[scriptUpload] F-37 remap — rewrote ${dbIdMap.size} parsed character id(s) ` +
                `to existing DB id(s); restored ${unmatchedRestored} unmatched existing ` +
                `character(s) to prevent orphan cleanup.`,
            );
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

      // ━━━ Manual-scene round-trip ━━━
      // If the user inserted any scenes by hand because the parser
      // missed a heading (right-click → Insert scene break here), we
      // need to either:
      //   1. Transfer their breakdown data onto the parsed scene if
      //      this re-parse picked up the heading, OR
      //   2. Re-inject the manual scene into the new list with a
      //      needsReview flag so the user can confirm placement.
      // Match by INT/EXT + time-of-day + location (case-insensitive)
      // since those are exactly the fields the user typed when
      // inserting the scene. Manual scenes are claimed at most once,
      // so a sequence of split inserts under the same parent number
      // doesn't all map to the same parsed scene.
      let mergedScenes: Scene[] = scenesWithStoryDays;
      if (isRevision && existingParsed) {
        const manualScenes = existingParsed.scenes.filter((s) => s.manuallyInserted);
        if (manualScenes.length > 0) {
          const matchKey = (s: { intExt: string; dayNight: string; location: string }) =>
            `${s.intExt}|${s.dayNight}|${(s.location || '').trim().toUpperCase()}`;
          const claimed = new Set<string>();
          mergedScenes = [...scenesWithStoryDays];
          for (const manual of manualScenes) {
            const k = matchKey(manual);
            const match = mergedScenes.find((s) => matchKey(s) === k && !claimed.has(s.id));
            if (match) {
              claimed.add(match.id);
              const bd = breakdownStore.getBreakdown(manual.id);
              if (bd) {
                breakdownStore.setBreakdown(match.id, { ...bd, sceneId: match.id });
              }
              const syn = synopsisStore.getSynopsis(manual.id, '');
              if (syn) synopsisStore.setSynopsis(match.id, syn);
            } else {
              // Best-effort placement: insert after whichever parsed
              // scene now sits where the manual scene's predecessor
              // used to live. Falls back to appending if neither
              // anchor can be located.
              const manualIdx = existingParsed.scenes.findIndex((s) => s.id === manual.id);
              const prev = manualIdx > 0 ? existingParsed.scenes[manualIdx - 1] : null;
              let insertAt = mergedScenes.length;
              if (prev) {
                const anchorIdx = mergedScenes.findIndex((s) => matchKey(s) === matchKey(prev));
                if (anchorIdx >= 0) insertAt = anchorIdx + 1;
              }
              mergedScenes.splice(insertAt, 0, { ...manual, needsReview: true } as Scene);
            }
          }
        }
      }

      setProgress(95);
      setStatusText('Saving...');
      await new Promise(r => setTimeout(r, 200));

      // Store parsed data
      setParsedData(projectId, {
        scenes: mergedScenes,
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
        scenes: mergedScenes.length,
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
            scene_count: mergedScenes.length,
            character_count: characters.length,
            parsed_data: {
              scenes: mergedScenes,
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
