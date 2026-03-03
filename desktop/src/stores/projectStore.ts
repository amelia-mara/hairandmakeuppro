import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project, ProjectMeta, Scene, Character } from '@/types';
import { v4 as uuid } from 'uuid';

interface ProjectStore {
  currentProject: Project | null;
  recentProjects: ProjectMeta[];
  scenes: Scene[];
  characters: Character[];

  createProject: (name: string) => string;
  loadProject: (id: string) => void;
  saveProject: () => void;
  deleteProject: (id: string) => void;
  setScenes: (scenes: Scene[]) => void;
  setCharacters: (characters: Character[]) => void;
  updateCharacter: (id: string, data: Partial<Character>) => void;
  updateScene: (id: string, data: Partial<Scene>) => void;
  setScriptContent: (content: string, fileName: string) => void;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      currentProject: null,
      recentProjects: [],
      scenes: [],
      characters: [],

      createProject: (name: string) => {
        const id = uuid();
        const now = Date.now();
        const project: Project = {
          id,
          name,
          created: now,
          modified: now,
        };
        const meta: ProjectMeta = {
          id,
          name,
          sceneCount: 0,
          characterCount: 0,
          lastOpened: now,
        };
        set((state) => ({
          currentProject: project,
          scenes: [],
          characters: [],
          recentProjects: [meta, ...state.recentProjects],
        }));
        return id;
      },

      loadProject: (id: string) => {
        const { recentProjects } = get();
        const meta = recentProjects.find((p) => p.id === id);
        if (!meta) return;

        const now = Date.now();
        const project: Project = {
          id: meta.id,
          name: meta.name,
          created: now,
          modified: now,
        };

        set((state) => ({
          currentProject: project,
          scenes: [],
          characters: [],
          recentProjects: state.recentProjects.map((p) =>
            p.id === id ? { ...p, lastOpened: now } : p
          ),
        }));
      },

      saveProject: () => {
        const { currentProject, scenes, characters, recentProjects } = get();
        if (!currentProject) return;

        const now = Date.now();
        set({
          currentProject: { ...currentProject, modified: now },
          recentProjects: recentProjects.map((p) =>
            p.id === currentProject.id
              ? {
                  ...p,
                  sceneCount: scenes.length,
                  characterCount: characters.length,
                  lastOpened: now,
                }
              : p
          ),
        });
      },

      deleteProject: (id: string) => {
        set((state) => ({
          recentProjects: state.recentProjects.filter((p) => p.id !== id),
          currentProject:
            state.currentProject?.id === id ? null : state.currentProject,
          scenes: state.currentProject?.id === id ? [] : state.scenes,
          characters:
            state.currentProject?.id === id ? [] : state.characters,
        }));
      },

      setScenes: (scenes: Scene[]) => {
        set((state) => {
          const updatedRecent = state.currentProject
            ? state.recentProjects.map((p) =>
                p.id === state.currentProject!.id
                  ? { ...p, sceneCount: scenes.length }
                  : p
              )
            : state.recentProjects;
          return { scenes, recentProjects: updatedRecent };
        });
      },

      setCharacters: (characters: Character[]) => {
        set((state) => {
          const updatedRecent = state.currentProject
            ? state.recentProjects.map((p) =>
                p.id === state.currentProject!.id
                  ? { ...p, characterCount: characters.length }
                  : p
              )
            : state.recentProjects;
          return { characters, recentProjects: updatedRecent };
        });
      },

      updateCharacter: (id: string, data: Partial<Character>) => {
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === id ? { ...c, ...data } : c
          ),
        }));
      },

      updateScene: (id: string, data: Partial<Scene>) => {
        set((state) => ({
          scenes: state.scenes.map((s) =>
            s.id === id ? { ...s, ...data } : s
          ),
        }));
      },

      setScriptContent: (content: string, fileName: string) => {
        const { currentProject } = get();
        if (!currentProject) return;

        set({
          currentProject: {
            ...currentProject,
            scriptContent: content,
            scriptFileName: fileName,
            modified: Date.now(),
          },
        });
      },
    }),
    {
      name: 'prep-happy-project',
      partialize: (state) => ({
        currentProject: state.currentProject,
        recentProjects: state.recentProjects,
        scenes: state.scenes,
        characters: state.characters,
      }),
    }
  )
);
