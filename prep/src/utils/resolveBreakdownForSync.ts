import type { SceneBreakdown, ScriptTag, Look } from '@/stores/breakdownStore';

/**
 * Resolve a SceneBreakdown for cross-app sync by merging the three sources
 * the prep BreakdownSheet uses at render time:
 *
 *   1. Manual entry from the scene breakdown panel form (`cb.entersWith.*`,
 *      `cb.sfx`, `cb.environmental`, `cb.action`, `cb.notes`)
 *   2. Script tag text from useTagStore (joined by ", ")
 *   3. Look defaults from the assigned look (`charLook.hair/makeup/wardrobe`)
 *
 * This must stay in lock-step with the resolver in
 * `prep/src/pages/BreakdownSheet.tsx` so that the data the mobile app reads
 * out of `filming_notes` matches exactly what prep displays.
 *
 * Without this merge, a user who assigns a look to a character but never
 * manually edits the breakdown form (and never tags the script for those
 * fields) sees the look's hair/makeup/wardrobe in prep but empty fields in
 * mobile, because the synced payload only contained the unfilled form data.
 */
export function resolveBreakdownForSync(
  bd: SceneBreakdown,
  sceneTags: ScriptTag[],
  looks: Look[],
): SceneBreakdown {
  return {
    ...bd,
    characters: bd.characters.map((cb) => {
      const charLook = cb.lookId ? looks.find((l) => l.id === cb.lookId) : null;
      const charTags = sceneTags.filter(
        (t) => t.characterId === cb.characterId && !t.dismissed,
      );

      const resolveField = (
        manual: string,
        categoryId: string,
        lookField?: string,
      ): string => {
        if (manual) return manual;
        const matching = charTags.filter((t) => t.categoryId === categoryId);
        if (matching.length > 0) return matching.map((t) => t.text).join(', ');
        return lookField || '';
      };

      return {
        ...cb,
        entersWith: {
          hair: resolveField(cb.entersWith.hair, 'hair', charLook?.hair),
          makeup: resolveField(cb.entersWith.makeup, 'makeup', charLook?.makeup),
          wardrobe: resolveField(cb.entersWith.wardrobe, 'wardrobe', charLook?.wardrobe),
        },
        sfx: resolveField(cb.sfx, 'sfx'),
        environmental: resolveField(cb.environmental, 'environmental'),
        action: resolveField(cb.action, 'action'),
        notes: resolveField(cb.notes, 'notes'),
      };
    }),
  };
}
