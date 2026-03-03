import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SceneBreakdown, CharacterSceneData, Look } from '@/types';
import { v4 as uuid } from 'uuid';

interface BreakdownStore {
  sceneBreakdowns: Record<string, SceneBreakdown>;
  looks: Look[];

  getBreakdown: (sceneId: string) => SceneBreakdown;
  updateBreakdown: (sceneId: string, data: Partial<SceneBreakdown>) => void;
  updateCharacterBreakdown: (
    sceneId: string,
    charId: string,
    data: Partial<CharacterSceneData>
  ) => void;
  markSceneComplete: (sceneId: string) => void;

  addLook: (look: Omit<Look, 'id' | 'created' | 'modified'>) => string;
  updateLook: (id: string, data: Partial<Look>) => void;
  deleteLook: (id: string) => void;
  getLooksForCharacter: (characterId: string) => Look[];

  clearProjectData: () => void;
}

const createDefaultBreakdown = (sceneId: string): SceneBreakdown => ({
  sceneId,
  storyDay: undefined,
  synopsis: undefined,
  notes: undefined,
  isComplete: false,
  characters: {},
});

export const useBreakdownStore = create<BreakdownStore>()(
  persist(
    (set, get) => ({
      sceneBreakdowns: {},
      looks: [],

      getBreakdown: (sceneId: string) => {
        const { sceneBreakdowns } = get();
        if (sceneBreakdowns[sceneId]) {
          return sceneBreakdowns[sceneId];
        }
        const defaultBreakdown = createDefaultBreakdown(sceneId);
        set((state) => ({
          sceneBreakdowns: {
            ...state.sceneBreakdowns,
            [sceneId]: defaultBreakdown,
          },
        }));
        return defaultBreakdown;
      },

      updateBreakdown: (sceneId: string, data: Partial<SceneBreakdown>) => {
        set((state) => {
          const existing =
            state.sceneBreakdowns[sceneId] ??
            createDefaultBreakdown(sceneId);
          return {
            sceneBreakdowns: {
              ...state.sceneBreakdowns,
              [sceneId]: { ...existing, ...data },
            },
          };
        });
      },

      updateCharacterBreakdown: (
        sceneId: string,
        charId: string,
        data: Partial<CharacterSceneData>
      ) => {
        set((state) => {
          const existing =
            state.sceneBreakdowns[sceneId] ??
            createDefaultBreakdown(sceneId);
          const existingCharData: CharacterSceneData = existing.characters[
            charId
          ] ?? {
            characterId: charId,
            hairNotes: '',
            makeupNotes: '',
            sfxNotes: '',
            notes: '',
            hasChange: false,
          };
          return {
            sceneBreakdowns: {
              ...state.sceneBreakdowns,
              [sceneId]: {
                ...existing,
                characters: {
                  ...existing.characters,
                  [charId]: { ...existingCharData, ...data },
                },
              },
            },
          };
        });
      },

      markSceneComplete: (sceneId: string) => {
        set((state) => {
          const existing =
            state.sceneBreakdowns[sceneId] ??
            createDefaultBreakdown(sceneId);
          return {
            sceneBreakdowns: {
              ...state.sceneBreakdowns,
              [sceneId]: { ...existing, isComplete: true },
            },
          };
        });
      },

      addLook: (look: Omit<Look, 'id' | 'created' | 'modified'>) => {
        const id = uuid();
        const now = Date.now();
        const newLook: Look = {
          ...look,
          id,
          created: now,
          modified: now,
        };
        set((state) => ({
          looks: [...state.looks, newLook],
        }));
        return id;
      },

      updateLook: (id: string, data: Partial<Look>) => {
        set((state) => ({
          looks: state.looks.map((l) =>
            l.id === id ? { ...l, ...data, modified: Date.now() } : l
          ),
        }));
      },

      deleteLook: (id: string) => {
        set((state) => ({
          looks: state.looks.filter((l) => l.id !== id),
        }));
      },

      getLooksForCharacter: (characterId: string) => {
        return get().looks.filter((l) => l.characterId === characterId);
      },

      clearProjectData: () => {
        set({
          sceneBreakdowns: {},
          looks: [],
        });
      },
    }),
    {
      name: 'prep-happy-breakdown',
    }
  )
);
