import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project, Scene, Character, Look, SceneBreakdown, CharacterSceneData } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface ProjectState {
  // Project data
  currentProject: Project | null;

  // Actions
  createProject: (name: string, scriptContent: string, scenes: Scene[], characters: Character[]) => void;
  clearProject: () => void;

  // Scene breakdowns
  updateCharacterSceneData: (sceneId: string, characterName: string, data: Partial<CharacterSceneData>) => void;
  setSceneComplete: (sceneId: string, complete: boolean) => void;
  setSceneStoryDay: (sceneId: string, storyDay: string) => void;

  // Looks
  addLook: (look: Omit<Look, 'id'>) => string;
  updateLook: (lookId: string, updates: Partial<Look>) => void;
  deleteLook: (lookId: string) => void;

  // Characters
  updateCharacterDescription: (characterId: string, description: string) => void;
}

function createEmptyCharacterSceneData(): CharacterSceneData {
  return {
    hairNotes: '',
    makeupNotes: '',
    sfxNotes: '',
    generalNotes: '',
    hasChange: false,
  };
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      currentProject: null,

      createProject: (name, scriptContent, scenes, characters) => {
        // Initialize breakdowns for all scenes
        const sceneBreakdowns: Record<string, SceneBreakdown> = {};
        for (const scene of scenes) {
          const characterData: Record<string, CharacterSceneData> = {};
          for (const charName of scene.characters) {
            characterData[charName] = createEmptyCharacterSceneData();
          }
          sceneBreakdowns[scene.id] = {
            sceneId: scene.id,
            storyDay: '',
            isComplete: false,
            characterData,
          };
        }

        set({
          currentProject: {
            id: uuidv4(),
            name,
            created: new Date().toISOString(),
            scriptContent,
            scenes,
            characters,
            looks: [],
            sceneBreakdowns,
          },
        });
      },

      clearProject: () => set({ currentProject: null }),

      updateCharacterSceneData: (sceneId, characterName, data) => {
        const project = get().currentProject;
        if (!project) return;

        const breakdown = project.sceneBreakdowns[sceneId];
        if (!breakdown) return;

        const existing = breakdown.characterData[characterName] || createEmptyCharacterSceneData();

        set({
          currentProject: {
            ...project,
            sceneBreakdowns: {
              ...project.sceneBreakdowns,
              [sceneId]: {
                ...breakdown,
                characterData: {
                  ...breakdown.characterData,
                  [characterName]: { ...existing, ...data },
                },
              },
            },
          },
        });
      },

      setSceneComplete: (sceneId, complete) => {
        const project = get().currentProject;
        if (!project) return;

        const breakdown = project.sceneBreakdowns[sceneId];
        if (!breakdown) return;

        set({
          currentProject: {
            ...project,
            sceneBreakdowns: {
              ...project.sceneBreakdowns,
              [sceneId]: { ...breakdown, isComplete: complete },
            },
          },
        });
      },

      setSceneStoryDay: (sceneId, storyDay) => {
        const project = get().currentProject;
        if (!project) return;

        const breakdown = project.sceneBreakdowns[sceneId];
        if (!breakdown) return;

        set({
          currentProject: {
            ...project,
            sceneBreakdowns: {
              ...project.sceneBreakdowns,
              [sceneId]: { ...breakdown, storyDay },
            },
          },
        });
      },

      addLook: (lookData) => {
        const project = get().currentProject;
        if (!project) return '';

        const id = uuidv4();
        const look: Look = { ...lookData, id };

        set({
          currentProject: {
            ...project,
            looks: [...project.looks, look],
          },
        });

        return id;
      },

      updateLook: (lookId, updates) => {
        const project = get().currentProject;
        if (!project) return;

        set({
          currentProject: {
            ...project,
            looks: project.looks.map((l) => (l.id === lookId ? { ...l, ...updates } : l)),
          },
        });
      },

      deleteLook: (lookId) => {
        const project = get().currentProject;
        if (!project) return;

        set({
          currentProject: {
            ...project,
            looks: project.looks.filter((l) => l.id !== lookId),
          },
        });
      },

      updateCharacterDescription: (characterId, description) => {
        const project = get().currentProject;
        if (!project) return;

        set({
          currentProject: {
            ...project,
            characters: project.characters.map((c) =>
              c.id === characterId ? { ...c, baseDescription: description } : c
            ),
          },
        });
      },
    }),
    {
      name: 'prep-happy-storage',
    }
  )
);
