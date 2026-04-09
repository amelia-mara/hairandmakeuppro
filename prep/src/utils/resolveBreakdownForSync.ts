import type { SceneBreakdown, ScriptTag, Look } from '@/stores/breakdownStore';

/**
 * Sideband tag payload attached to every synced breakdown. Mirrors the
 * shape mobile-pwa consumes to render tag pills next to each column.
 */
export interface SyncedBreakdownTag {
  id: string;
  characterId?: string;
  categoryId: string;
  text: string;
}

/**
 * Extended SceneBreakdown shape used for cross-app sync. Adds a `tags`
 * sideband so the mobile app can render tags as pills alongside the
 * resolved form-field values rather than merging tag text into them.
 */
export interface SyncedSceneBreakdown extends SceneBreakdown {
  tags?: SyncedBreakdownTag[];
}

/**
 * Resolve a SceneBreakdown for cross-app sync.
 *
 * Field values (`entersWith.*`, `sfx`, `environmental`, `action`, `notes`)
 * carry ONLY what the user manually entered in the scene breakdown panel,
 * falling back to the assigned look's hair/makeup/wardrobe strings when a
 * field is empty. Script tags are NO LONGER merged into these fields — they
 * are attached as a sideband `tags[]` array so the consumer (mobile or
 * prep's BreakdownSheet) can render them as pills that remain visible
 * even when the user overwrites the field with manual text or a look.
 *
 * This must stay in lock-step with the render logic in
 * `prep/src/pages/BreakdownSheet.tsx` and
 * `mobile-pwa/src/components/breakdown/Breakdown.tsx`.
 */
export function resolveBreakdownForSync(
  bd: SceneBreakdown,
  sceneTags: ScriptTag[],
  looks: Look[],
): SyncedSceneBreakdown {
  const resolved: SyncedSceneBreakdown = {
    ...bd,
    characters: bd.characters.map((cb) => {
      const charLook = cb.lookId ? looks.find((l) => l.id === cb.lookId) : null;

      const resolveField = (manual: string, lookField?: string): string => {
        if (manual) return manual;
        return lookField || '';
      };

      return {
        ...cb,
        entersWith: {
          hair: resolveField(cb.entersWith.hair, charLook?.hair),
          makeup: resolveField(cb.entersWith.makeup, charLook?.makeup),
          wardrobe: resolveField(cb.entersWith.wardrobe, charLook?.wardrobe),
        },
        sfx: cb.sfx || '',
        environmental: cb.environmental || '',
        action: cb.action || '',
        notes: cb.notes || '',
      };
    }),
    tags: sceneTags
      .filter((t) => !t.dismissed)
      .map((t) => ({
        id: t.id,
        characterId: t.characterId,
        categoryId: t.categoryId,
        text: t.text,
      })),
  };
  return resolved;
}
