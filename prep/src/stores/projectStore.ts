import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Project {
  id: string;
  title: string;
  genre: string;
  type: string;
  status: 'active' | 'setup' | 'wrapped';
  progress: number;
  lastActive: string;
  scenes: number;
  characters: number;
  scriptFilename?: string;
  scheduleFilename?: string;
  createdAt: string;
}

interface ProjectState {
  projects: Project[];
  selectedProjectId: string | null;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  selectProject: (id: string | null) => void;
  getProject: (id: string) => Project | undefined;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      selectedProjectId: null,

      addProject: (project) =>
        set((state) => ({ projects: [...state.projects, project] })),

      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),

      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          selectedProjectId:
            state.selectedProjectId === id ? null : state.selectedProjectId,
        })),

      selectProject: (id) => set({ selectedProjectId: id }),

      getProject: (id) => get().projects.find((p) => p.id === id),
    }),
    {
      name: 'prep-happy-projects',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
