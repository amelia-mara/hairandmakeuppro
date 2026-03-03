import { create } from 'zustand';

interface UIStore {
  selectedSceneId: string | null;
  activeTab: string;
  sceneSearch: string;

  modals: {
    upload: boolean;
    export: boolean;
    lookEditor: boolean;
    newProject: boolean;
    settings: boolean;
  };
  editingLookId: string | null;

  selectScene: (id: string | null) => void;
  setActiveTab: (tab: string) => void;
  setSceneSearch: (search: string) => void;
  openModal: (modal: keyof UIStore['modals']) => void;
  closeModal: (modal: keyof UIStore['modals']) => void;
  closeAllModals: () => void;
  setEditingLookId: (id: string | null) => void;
}

export const useUIStore = create<UIStore>()((set) => ({
  selectedSceneId: null,
  activeTab: 'script',
  sceneSearch: '',

  modals: {
    upload: false,
    export: false,
    lookEditor: false,
    newProject: false,
    settings: false,
  },
  editingLookId: null,

  selectScene: (id: string | null) => {
    set({ selectedSceneId: id });
  },

  setActiveTab: (tab: string) => {
    set({ activeTab: tab });
  },

  setSceneSearch: (search: string) => {
    set({ sceneSearch: search });
  },

  openModal: (modal: keyof UIStore['modals']) => {
    set((state) => ({
      modals: { ...state.modals, [modal]: true },
    }));
  },

  closeModal: (modal: keyof UIStore['modals']) => {
    set((state) => ({
      modals: { ...state.modals, [modal]: false },
    }));
  },

  closeAllModals: () => {
    set({
      modals: {
        upload: false,
        export: false,
        lookEditor: false,
        newProject: false,
        settings: false,
      },
    });
  },

  setEditingLookId: (id: string | null) => {
    set({ editingLookId: id });
  },
}));
