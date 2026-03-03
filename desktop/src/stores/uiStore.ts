import { create } from 'zustand';
import type { AppView, CenterTab } from '@/types';

interface UIState {
  // Navigation
  currentView: AppView;
  setView: (view: AppView) => void;

  // Scene selection
  selectedSceneId: string | null;
  selectScene: (sceneId: string | null) => void;

  // Center panel tabs
  activeCenterTab: CenterTab;
  characterTabs: string[]; // Character names with open tabs
  setActiveCenterTab: (tab: CenterTab) => void;
  openCharacterTab: (characterName: string) => void;
  closeCharacterTab: (characterName: string) => void;

  // Right panel - selected character for breakdown
  selectedCharacterName: string | null;
  selectCharacter: (name: string | null) => void;

  // Modals
  showScriptUpload: boolean;
  setShowScriptUpload: (show: boolean) => void;
  showExportModal: boolean;
  setShowExportModal: (show: boolean) => void;
  showLookEditor: boolean;
  setShowLookEditor: (show: boolean) => void;
  editingLookId: string | null;
  setEditingLookId: (id: string | null) => void;

  // Search
  sceneSearch: string;
  setSceneSearch: (query: string) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  currentView: 'home',
  setView: (view) => set({ currentView: view }),

  selectedSceneId: null,
  selectScene: (sceneId) => set({ selectedSceneId: sceneId }),

  activeCenterTab: 'script',
  characterTabs: [],
  setActiveCenterTab: (tab) => set({ activeCenterTab: tab }),
  openCharacterTab: (characterName) =>
    set((state) => ({
      characterTabs: state.characterTabs.includes(characterName)
        ? state.characterTabs
        : [...state.characterTabs, characterName],
      activeCenterTab: characterName,
    })),
  closeCharacterTab: (characterName) =>
    set((state) => ({
      characterTabs: state.characterTabs.filter((t) => t !== characterName),
      activeCenterTab: state.activeCenterTab === characterName ? 'script' : state.activeCenterTab,
    })),

  selectedCharacterName: null,
  selectCharacter: (name) => set({ selectedCharacterName: name }),

  showScriptUpload: false,
  setShowScriptUpload: (show) => set({ showScriptUpload: show }),
  showExportModal: false,
  setShowExportModal: (show) => set({ showExportModal: show }),
  showLookEditor: false,
  setShowLookEditor: (show) => set({ showLookEditor: show }),
  editingLookId: null,
  setEditingLookId: (id) => set({ editingLookId: id }),

  sceneSearch: '',
  setSceneSearch: (query) => set({ sceneSearch: query }),
}));
