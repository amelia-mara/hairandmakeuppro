import type {
  Character,
  Look,
  CharacterConfirmationStatus,
  CharacterDetectionStatus,
  CastProfile,
  ProductionSchedule,
} from '@/types';
import {
  createEmptyMakeupDetails,
  createEmptyHairDetails,
  createEmptyCastProfile,
} from '@/types';
import {
  syncCastDataToScenes,
  canSyncCastData,
  type CastSyncResult,
} from '@/services/castSyncService';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectSet, ProjectGet } from './types';

export const createCharacterSlice = (set: ProjectSet, get: ProjectGet) => ({
  // Character confirmation actions (for progressive scene-by-scene workflow)
  startCharacterDetection: () => {
    set((state) => {
      if (!state.currentProject) return state;

      return {
        currentProject: {
          ...state.currentProject,
          characterDetectionStatus: 'running' as CharacterDetectionStatus,
          scenes: state.currentProject.scenes.map((s) => ({
            ...s,
            characterConfirmationStatus: s.characterConfirmationStatus === 'confirmed'
              ? 'confirmed'
              : 'detecting' as CharacterConfirmationStatus,
          })),
        },
      };
    });
  },

  setCharacterDetectionStatus: (status: CharacterDetectionStatus) => {
    set((state) => {
      if (!state.currentProject) return state;

      return {
        currentProject: {
          ...state.currentProject,
          characterDetectionStatus: status,
        },
      };
    });
  },

  updateSceneSuggestedCharacters: (sceneId: string, characters: string[]) => {
    set((state) => {
      if (!state.currentProject) return state;

      return {
        currentProject: {
          ...state.currentProject,
          scenes: state.currentProject.scenes.map((s) =>
            s.id === sceneId
              ? {
                  ...s,
                  suggestedCharacters: characters,
                  characterConfirmationStatus: s.characterConfirmationStatus === 'confirmed'
                    ? 'confirmed'
                    : 'ready' as CharacterConfirmationStatus,
                }
              : s
          ),
        },
      };
    });
  },

  updateSceneConfirmationStatus: (sceneId: string, status: CharacterConfirmationStatus) => {
    set((state) => {
      if (!state.currentProject) return state;

      return {
        currentProject: {
          ...state.currentProject,
          scenes: state.currentProject.scenes.map((s) =>
            s.id === sceneId ? { ...s, characterConfirmationStatus: status } : s
          ),
        },
      };
    });
  },

  confirmSceneCharacters: (sceneId: string, confirmedCharacterIds: string[]) => {
    set((state) => {
      if (!state.currentProject) return state;

      // Get previous characters before updating (to detect removals)
      const previousScene = state.currentProject.scenes.find(s => s.id === sceneId);
      const previousCharacterIds = previousScene?.characters || [];

      const updatedScenes = state.currentProject.scenes.map((s) =>
        s.id === sceneId
          ? {
              ...s,
              characters: confirmedCharacterIds,
              characterConfirmationStatus: 'confirmed' as CharacterConfirmationStatus,
              suggestedCharacters: undefined, // Clear suggestions after confirmation
            }
          : s
      );

      // Count confirmed scenes
      const scenesConfirmed = updatedScenes.filter(
        (s) => s.characterConfirmationStatus === 'confirmed'
      ).length;

      const scene = updatedScenes.find((s) => s.id === sceneId);

      // Characters removed from this scene — their looks should drop this scene
      const removedCharacterIds = previousCharacterIds.filter(
        id => !confirmedCharacterIds.includes(id)
      );

      // Track which characters already have this scene in one of their looks
      const characterHasScene = new Set<string>();
      for (const look of state.currentProject.looks) {
        if (scene && look.scenes.includes(scene.sceneNumber)) {
          characterHasScene.add(look.characterId);
        }
      }

      // Track characters we've already added the scene to (for multi-look chars)
      const addedTo = new Set<string>();

      const updatedLooks = state.currentProject.looks.map((look) => {
        if (!scene) return look;

        // Remove scene from looks of characters no longer in this scene
        if (removedCharacterIds.includes(look.characterId) && look.scenes.includes(scene.sceneNumber)) {
          return {
            ...look,
            scenes: look.scenes.filter(s => s !== scene.sceneNumber),
          };
        }

        // Add scene to first look of newly confirmed characters (if not already in any of their looks)
        if (
          confirmedCharacterIds.includes(look.characterId) &&
          !characterHasScene.has(look.characterId) &&
          !addedTo.has(look.characterId)
        ) {
          addedTo.add(look.characterId);
          return {
            ...look,
            scenes: [...look.scenes, scene.sceneNumber].sort((a, b) =>
              a.localeCompare(b, undefined, { numeric: true })
            ),
          };
        }

        return look;
      });

      return {
        currentProject: {
          ...state.currentProject,
          scenes: updatedScenes,
          looks: updatedLooks,
          scenesConfirmed,
        },
      };
    });
  },

  addCharacterFromScene: (sceneId: string, characterName: string): Character => {
    const state = get();
    if (!state.currentProject) {
      throw new Error('No project loaded');
    }

    // Generate a new character
    const id = uuidv4();
    const initials = characterName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2);

    // Assign color based on existing character count
    const colors = ['#C9A961', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#6366F1'];
    const avatarColour = colors[state.currentProject.characters.length % colors.length];

    const newCharacter: Character = {
      id,
      name: characterName,
      initials,
      avatarColour,
    };

    // Find the scene to get its sceneNumber
    const scene = state.currentProject.scenes.find((s) => s.id === sceneId);

    set((state) => {
      if (!state.currentProject) return state;

      // Create a new look for this character
      const newLook: Look = {
        id: uuidv4(),
        characterId: newCharacter.id,
        name: 'Day 1',
        scenes: scene ? [scene.sceneNumber] : [],
        estimatedTime: 30,
        makeup: createEmptyMakeupDetails(),
        hair: createEmptyHairDetails(),
      };

      return {
        currentProject: {
          ...state.currentProject,
          characters: [...state.currentProject.characters, newCharacter],
          looks: [...state.currentProject.looks, newLook],
        },
      };
    });

    return newCharacter;
  },

  getUnconfirmedScenesCount: (): number => {
    const state = get();
    if (!state.currentProject) return 0;

    return state.currentProject.scenes.filter(
      (s) => s.characterConfirmationStatus !== 'confirmed'
    ).length;
  },

  getConfirmedScenesCount: (): number => {
    const state = get();
    if (!state.currentProject) return 0;

    return state.currentProject.scenes.filter(
      (s) => s.characterConfirmationStatus === 'confirmed'
    ).length;
  },

  // Cast profile actions
  getCastProfile: (characterId: string): CastProfile | undefined => {
    const state = get();
    if (!state.currentProject) return undefined;
    return state.currentProject.castProfiles?.find(cp => cp.characterId === characterId);
  },

  updateCastProfile: (characterId: string, updates: Partial<CastProfile>) => {
    set((state) => {
      if (!state.currentProject) return state;

      const existingProfiles = state.currentProject.castProfiles || [];
      const existingIndex = existingProfiles.findIndex(cp => cp.characterId === characterId);

      let updatedProfiles: CastProfile[];
      if (existingIndex >= 0) {
        // Update existing profile
        updatedProfiles = existingProfiles.map((cp, idx) =>
          idx === existingIndex ? { ...cp, ...updates } : cp
        );
      } else {
        // Create new profile with updates
        const newProfile = { ...createEmptyCastProfile(characterId), ...updates };
        updatedProfiles = [...existingProfiles, newProfile];
      }

      return {
        currentProject: {
          ...state.currentProject,
          castProfiles: updatedProfiles,
        },
      };
    });
  },

  // Cast Sync from Schedule
  syncCastDataFromSchedule: (
    schedule: ProductionSchedule,
    options: { createMissingCharacters?: boolean; overwriteExisting?: boolean; autoConfirm?: boolean } = {}
  ): CastSyncResult | null => {
    const state = get();
    if (!state.currentProject) return null;

    const { canSync, reason } = canSyncCastData(schedule);
    if (!canSync) {
      console.error('[ProjectStore] Cannot sync cast data:', reason);
      return null;
    }

    const { result, updatedScenes, updatedCharacters, updatedLooks } = syncCastDataToScenes(
      schedule,
      state.currentProject.scenes,
      state.currentProject.characters,
      state.currentProject.looks,
      options
    );

    if (result.scenesUpdated > 0 || result.charactersCreated > 0) {
      set((s) => {
        if (!s.currentProject) return {};

        // Migrate cast profiles from placeholder IDs (cast-N) to real character IDs.
        // Before the schedule finishes processing, the Lookbooks page shows placeholder
        // characters with IDs like "cast-1" from the cast list. If the user edits a
        // cast profile for one of these, the profile is saved under that placeholder ID.
        // When the sync creates real characters (char-XXXX), those profiles become
        // orphaned. This migrates them to the correct new character IDs.
        const existingProfiles = s.currentProject.castProfiles || [];
        const migratedProfiles = existingProfiles.map(profile => {
          const placeholderMatch = profile.characterId.match(/^cast-(\d+)$/);
          if (!placeholderMatch) return profile;

          const castNumber = parseInt(placeholderMatch[1], 10);
          const castMember = schedule.castList.find(c => c.number === castNumber);
          if (!castMember) return profile;

          const castName = (castMember.character || castMember.name)
            .replace(/^\d+\.\s*/, '').trim().toUpperCase();
          const realChar = updatedCharacters.find(
            c => c.name.trim().toUpperCase() === castName
          );
          if (!realChar) return profile;

          console.log(
            `[ProjectStore] Migrating cast profile from placeholder ${profile.characterId} to ${realChar.id} (${realChar.name})`
          );
          return {
            ...profile,
            characterId: realChar.id,
            id: `cast-${realChar.id}`,
          };
        });

        return {
          currentProject: {
            ...s.currentProject,
            scenes: updatedScenes,
            characters: updatedCharacters,
            looks: updatedLooks,
            castProfiles: migratedProfiles,
          },
        };
      });

      console.log('[ProjectStore] Cast sync complete:', {
        scenesUpdated: result.scenesUpdated,
        charactersCreated: result.charactersCreated,
      });
    }

    return result;
  },

  canSyncCastData: (schedule: ProductionSchedule | null) => canSyncCastData(schedule),

  getCharacter: (characterId: string) => {
    return get().currentProject?.characters.find(c => c.id === characterId);
  },
});
