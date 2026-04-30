/**
 * Shopping Flag Store — Prep-only, not synced to mobile.
 *
 * Flags major HMU items that need to be sourced ahead of shooting:
 * wigs, facial hair, tattoos, prosthetics. Distinct from the
 * scene-level SFX/Prosthetics field (which describes what's
 * happening on the day) — these are budget-impacting items the
 * production has to procure once and reuse across scenes.
 *
 * Each flag is scoped:
 *   - look       — every scene where this character has the look
 *   - continuity — every scene from the event start to its end
 *   - storyline  — every scene the character appears in
 *
 * The Budget → Script Flags page rolls up by
 * (character, kind, scope, scopeRef) so duplicate ticks across
 * scenes collapse to one budget line item.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ShoppingFlagKind = 'wig' | 'facial_hair' | 'tattoo' | 'prosthetic';
export type ShoppingFlagScope = 'look' | 'continuity' | 'storyline';

export const SHOPPING_FLAG_KINDS: { id: ShoppingFlagKind; label: string }[] = [
  { id: 'wig',         label: 'Wig' },
  { id: 'facial_hair', label: 'Facial Hair' },
  { id: 'tattoo',      label: 'Tattoo' },
  { id: 'prosthetic',  label: 'Prosthetic' },
];

export interface ShoppingFlag {
  id: string;
  characterId: string;
  kind: ShoppingFlagKind;
  scope: ShoppingFlagScope;
  /** Required when scope === 'look' */
  lookId?: string;
  /** Required when scope === 'continuity' */
  continuityEventId?: string;
  createdAt: string;
}

interface ShoppingFlagState {
  flags: ShoppingFlag[];

  /** Find the flag matching exactly the given (character, kind, scope, ref). */
  findFlag: (
    characterId: string,
    kind: ShoppingFlagKind,
    scope: ShoppingFlagScope,
    scopeRef?: string,
  ) => ShoppingFlag | undefined;

  /** Toggle a flag on/off. If on, creates a flag with the given scope; if off, removes it. */
  toggleFlag: (
    characterId: string,
    kind: ShoppingFlagKind,
    scope: ShoppingFlagScope,
    scopeRef?: string,
  ) => void;

  /** Move an existing flag to a different scope. */
  setScope: (flagId: string, scope: ShoppingFlagScope, scopeRef?: string) => void;

  /** All flags in this project — used by the Budget rollup. */
  getAllFlags: () => ShoppingFlag[];

  /** All flags for a specific character (for the breakdown panel UI). */
  getFlagsForCharacter: (characterId: string) => ShoppingFlag[];
}

const storeCache = new Map<string, ReturnType<typeof createStore>>();

function createStore(projectId: string) {
  return create<ShoppingFlagState>()(
    persist(
      (set, get) => ({
        flags: [],

        findFlag: (characterId, kind, scope, scopeRef) => {
          return get().flags.find((f) =>
            f.characterId === characterId &&
            f.kind === kind &&
            f.scope === scope &&
            (scope === 'storyline'
              ? true
              : scope === 'look'
                ? f.lookId === scopeRef
                : f.continuityEventId === scopeRef)
          );
        },

        toggleFlag: (characterId, kind, scope, scopeRef) => {
          const existing = get().findFlag(characterId, kind, scope, scopeRef);
          if (existing) {
            set((s) => ({ flags: s.flags.filter((f) => f.id !== existing.id) }));
          } else {
            const flag: ShoppingFlag = {
              id: crypto.randomUUID(),
              characterId,
              kind,
              scope,
              lookId: scope === 'look' ? scopeRef : undefined,
              continuityEventId: scope === 'continuity' ? scopeRef : undefined,
              createdAt: new Date().toISOString(),
            };
            set((s) => ({ flags: [...s.flags, flag] }));
          }
        },

        setScope: (flagId, scope, scopeRef) => {
          set((s) => ({
            flags: s.flags.map((f) =>
              f.id === flagId
                ? {
                    ...f,
                    scope,
                    lookId: scope === 'look' ? scopeRef : undefined,
                    continuityEventId: scope === 'continuity' ? scopeRef : undefined,
                  }
                : f,
            ),
          }));
        },

        getAllFlags: () => get().flags,

        getFlagsForCharacter: (characterId) =>
          get().flags.filter((f) => f.characterId === characterId),
      }),
      { name: `prep-shopping-flags-${projectId}` },
    ),
  );
}

export function useShoppingFlagStore(projectId: string) {
  if (!storeCache.has(projectId)) {
    storeCache.set(projectId, createStore(projectId));
  }
  return storeCache.get(projectId)!;
}
