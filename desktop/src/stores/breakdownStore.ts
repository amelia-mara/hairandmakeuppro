import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ParsedScene,
  DetectedCharacter,
  SceneBreakdown,
  CharacterSceneBreakdown,
  CharacterProfile,
  BreakdownStep,
} from '../types/breakdown';

interface BreakdownState {
  // Script data
  scriptFileName: string | null;
  rawScriptText: string | null;
  scenes: ParsedScene[];
  characters: DetectedCharacter[];

  // Workflow
  currentStep: BreakdownStep;

  // Breakdown data
  sceneBreakdowns: Record<string, SceneBreakdown>;
  characterProfiles: Record<string, CharacterProfile>;

  // UI state
  selectedSceneId: string | null;
  selectedCharacterId: string | null;

  // Actions
  setScript: (fileName: string, text: string, scenes: ParsedScene[]) => void;
  setCharacters: (characters: DetectedCharacter[]) => void;
  confirmCharacters: (confirmedIds: string[]) => void;
  setStep: (step: BreakdownStep) => void;
  updateSceneBreakdown: (sceneId: string, data: Partial<SceneBreakdown>) => void;
  updateCharacterSceneBreakdown: (
    sceneId: string,
    characterId: string,
    data: Partial<CharacterSceneBreakdown>,
  ) => void;
  updateCharacterProfile: (characterId: string, data: Partial<CharacterProfile>) => void;
  markSceneComplete: (sceneId: string, isComplete: boolean) => void;
  selectScene: (sceneId: string) => void;
  selectCharacter: (characterId: string | null) => void;
  clearProject: () => void;
}

const initialState = {
  scriptFileName: null,
  rawScriptText: null,
  scenes: [],
  characters: [],
  currentStep: 'upload' as BreakdownStep,
  sceneBreakdowns: {},
  characterProfiles: {},
  selectedSceneId: null,
  selectedCharacterId: null,
};

export const useBreakdownStore = create<BreakdownState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setScript: (fileName, text, scenes) => {
        set({
          scriptFileName: fileName,
          rawScriptText: text,
          scenes,
          // Initialize empty breakdowns for each scene
          sceneBreakdowns: Object.fromEntries(
            scenes.map((s) => [
              s.id,
              {
                sceneId: s.id,
                storyDay: '',
                timelineNotes: '',
                characterBreakdowns: {},
                isComplete: false,
              } satisfies SceneBreakdown,
            ]),
          ),
        });
      },

      setCharacters: (characters) => {
        set({ characters });
      },

      confirmCharacters: (confirmedIds) => {
        const { characters, scenes, sceneBreakdowns } = get();
        const confirmed = characters.filter((c) => confirmedIds.includes(c.id));

        // Initialize character profiles
        const characterProfiles: Record<string, CharacterProfile> = {};
        for (const c of confirmed) {
          characterProfiles[c.id] = {
            characterId: c.id,
            baseDescription: '',
            looks: [],
          };
        }

        // Initialize character breakdowns in each scene
        const updatedBreakdowns = { ...sceneBreakdowns };
        for (const scene of scenes) {
          const bd = updatedBreakdowns[scene.id];
          if (!bd) continue;
          const charBreakdowns: Record<string, CharacterSceneBreakdown> = {};
          for (const c of confirmed) {
            if (c.scenes.includes(scene.id)) {
              charBreakdowns[c.id] = {
                characterId: c.id,
                hairNotes: '',
                makeupNotes: '',
                generalNotes: '',
                hasChange: false,
              };
            }
          }
          updatedBreakdowns[scene.id] = { ...bd, characterBreakdowns: charBreakdowns };
        }

        set({
          characters: confirmed,
          characterProfiles,
          sceneBreakdowns: updatedBreakdowns,
          currentStep: 'breakdown',
          selectedSceneId: scenes.length > 0 ? scenes[0].id : null,
        });
      },

      setStep: (step) => set({ currentStep: step }),

      updateSceneBreakdown: (sceneId, data) => {
        const { sceneBreakdowns } = get();
        const existing = sceneBreakdowns[sceneId];
        if (!existing) return;
        set({
          sceneBreakdowns: {
            ...sceneBreakdowns,
            [sceneId]: { ...existing, ...data },
          },
        });
      },

      updateCharacterSceneBreakdown: (sceneId, characterId, data) => {
        const { sceneBreakdowns } = get();
        const sceneBd = sceneBreakdowns[sceneId];
        if (!sceneBd) return;
        const charBd = sceneBd.characterBreakdowns[characterId] || {
          characterId,
          hairNotes: '',
          makeupNotes: '',
          generalNotes: '',
          hasChange: false,
        };
        set({
          sceneBreakdowns: {
            ...sceneBreakdowns,
            [sceneId]: {
              ...sceneBd,
              characterBreakdowns: {
                ...sceneBd.characterBreakdowns,
                [characterId]: { ...charBd, ...data },
              },
            },
          },
        });
      },

      updateCharacterProfile: (characterId, data) => {
        const { characterProfiles } = get();
        const existing = characterProfiles[characterId] || {
          characterId,
          baseDescription: '',
          looks: [],
        };
        set({
          characterProfiles: {
            ...characterProfiles,
            [characterId]: { ...existing, ...data },
          },
        });
      },

      markSceneComplete: (sceneId, isComplete) => {
        const { sceneBreakdowns } = get();
        const existing = sceneBreakdowns[sceneId];
        if (!existing) return;
        set({
          sceneBreakdowns: {
            ...sceneBreakdowns,
            [sceneId]: { ...existing, isComplete },
          },
        });
      },

      selectScene: (sceneId) => set({ selectedSceneId: sceneId }),

      selectCharacter: (characterId) => set({ selectedCharacterId: characterId }),

      clearProject: () => set(initialState),
    }),
    {
      name: 'checks-happy-breakdown',
    },
  ),
);
