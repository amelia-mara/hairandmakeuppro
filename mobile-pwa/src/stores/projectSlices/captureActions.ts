import type { SceneCapture, Photo, ContinuityFlags, ContinuityEvent, SFXDetails, DeviationRecord } from '@/types';
import {
  createEmptyContinuityFlags,
  createEmptySFXDetails,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectSet, ProjectGet } from './types';

export const createCaptureSlice = (set: ProjectSet, get: ProjectGet) => ({
  // Scene Capture actions
  getOrCreateSceneCapture: (sceneId: string, characterId: string): SceneCapture => {
    const state = get();
    const key = `${sceneId}-${characterId}`;
    const existing = state.sceneCaptures[key];

    if (existing) return existing;

    const sceneNumber = state.currentProject?.scenes.find(s => s.id === sceneId)?.sceneNumber;
    const look = state.currentProject?.looks.find(
      l => l.characterId === characterId &&
      sceneNumber !== undefined && l.scenes.includes(sceneNumber)
    );

    const newCapture: SceneCapture = {
      id: uuidv4(),
      sceneId,
      characterId,
      lookId: look?.id ?? '',
      capturedAt: new Date(),
      photos: {},
      additionalPhotos: [],
      continuityFlags: createEmptyContinuityFlags(),
      continuityEvents: [],
      sfxDetails: createEmptySFXDetails(),
      notes: '',
    };

    set((state) => ({
      sceneCaptures: {
        ...state.sceneCaptures,
        [key]: newCapture,
      },
    }));

    return newCapture;
  },

  updateSceneCapture: (captureId: string, updates: Partial<SceneCapture>) => {
    set((state) => ({
      sceneCaptures: {
        ...state.sceneCaptures,
        [captureId]: {
          ...state.sceneCaptures[captureId],
          ...updates,
        },
      },
    }));
  },

  addPhotoToCapture: (captureId: string, photo: Photo, slot: keyof SceneCapture['photos'] | 'additional') => {
    set((state) => {
      const capture = state.sceneCaptures[captureId];
      if (!capture) return state;

      if (slot === 'additional') {
        return {
          sceneCaptures: {
            ...state.sceneCaptures,
            [captureId]: {
              ...capture,
              additionalPhotos: [...capture.additionalPhotos, photo],
            },
          },
        };
      }

      return {
        sceneCaptures: {
          ...state.sceneCaptures,
          [captureId]: {
            ...capture,
            photos: {
              ...capture.photos,
              [slot]: photo,
            },
          },
        },
      };
    });
  },

  removePhotoFromCapture: (captureId: string, slot: keyof SceneCapture['photos'] | 'additional', photoId?: string) => {
    set((state) => {
      const capture = state.sceneCaptures[captureId];
      if (!capture) return state;

      if (slot === 'additional' && photoId) {
        return {
          sceneCaptures: {
            ...state.sceneCaptures,
            [captureId]: {
              ...capture,
              additionalPhotos: capture.additionalPhotos.filter(p => p.id !== photoId),
            },
          },
        };
      }

      // Remove photo from specific slot (front, left, right, back)
      const photoSlot = slot as keyof SceneCapture['photos'];
      const newPhotos = { ...capture.photos };
      delete newPhotos[photoSlot];

      return {
        sceneCaptures: {
          ...state.sceneCaptures,
          [captureId]: {
            ...capture,
            photos: newPhotos,
          },
        },
      };
    });
  },

  toggleContinuityFlag: (captureId: string, flag: keyof ContinuityFlags) => {
    set((state) => {
      const capture = state.sceneCaptures[captureId];
      if (!capture) return state;

      return {
        sceneCaptures: {
          ...state.sceneCaptures,
          [captureId]: {
            ...capture,
            continuityFlags: {
              ...capture.continuityFlags,
              [flag]: !capture.continuityFlags[flag],
            },
          },
        },
      };
    });
  },

  addContinuityEvent: (captureId: string, event: ContinuityEvent) => {
    set((state) => {
      const capture = state.sceneCaptures[captureId];
      if (!capture) return state;

      return {
        sceneCaptures: {
          ...state.sceneCaptures,
          [captureId]: {
            ...capture,
            continuityEvents: [...capture.continuityEvents, event],
          },
        },
      };
    });
  },

  updateContinuityEvent: (captureId: string, eventId: string, updates: Partial<ContinuityEvent>) => {
    set((state) => {
      const capture = state.sceneCaptures[captureId];
      if (!capture) return state;

      return {
        sceneCaptures: {
          ...state.sceneCaptures,
          [captureId]: {
            ...capture,
            continuityEvents: capture.continuityEvents.map((e) =>
              e.id === eventId ? { ...e, ...updates } : e
            ),
          },
        },
      };
    });
  },

  removeContinuityEvent: (captureId: string, eventId: string) => {
    set((state) => {
      const capture = state.sceneCaptures[captureId];
      if (!capture) return state;

      return {
        sceneCaptures: {
          ...state.sceneCaptures,
          [captureId]: {
            ...capture,
            continuityEvents: capture.continuityEvents.filter((e) => e.id !== eventId),
          },
        },
      };
    });
  },

  // SFX actions
  updateSFXDetails: (captureId: string, sfx: SFXDetails) => {
    set((state) => {
      const capture = state.sceneCaptures[captureId];
      if (!capture) return state;

      return {
        sceneCaptures: {
          ...state.sceneCaptures,
          [captureId]: {
            ...capture,
            sfxDetails: sfx,
          },
        },
      };
    });
  },

  addSFXPhoto: (captureId: string, photo: Photo) => {
    set((state) => {
      const capture = state.sceneCaptures[captureId];
      if (!capture) return state;

      return {
        sceneCaptures: {
          ...state.sceneCaptures,
          [captureId]: {
            ...capture,
            sfxDetails: {
              ...capture.sfxDetails,
              sfxReferencePhotos: [...capture.sfxDetails.sfxReferencePhotos, photo],
            },
          },
        },
      };
    });
  },

  removeSFXPhoto: (captureId: string, photoId: string) => {
    set((state) => {
      const capture = state.sceneCaptures[captureId];
      if (!capture) return state;

      return {
        sceneCaptures: {
          ...state.sceneCaptures,
          [captureId]: {
            ...capture,
            sfxDetails: {
              ...capture.sfxDetails,
              sfxReferencePhotos: capture.sfxDetails.sfxReferencePhotos.filter(p => p.id !== photoId),
            },
          },
        },
      };
    });
  },

  getSceneCapture: (sceneId: string, characterId: string) => {
    return get().sceneCaptures[`${sceneId}-${characterId}`];
  },

  // ── Deviation tracking (floor team during shoot) ──

  /**
   * Log a deviation on a scene capture. Automatically sets hasDeviation
   * on the parent Scene so it's visible in the scene list.
   */
  logDeviation: (captureId: string, deviation: DeviationRecord) => {
    set((state) => {
      const capture = state.sceneCaptures[captureId];
      if (!capture) return state;

      const updatedCaptures = {
        ...state.sceneCaptures,
        [captureId]: { ...capture, deviation },
      };

      // Auto-flag the parent scene
      const updatedScenes = state.currentProject?.scenes.map(s =>
        s.id === capture.sceneId ? { ...s, hasDeviation: true } : s
      );

      return {
        sceneCaptures: updatedCaptures,
        ...(state.currentProject && updatedScenes ? {
          currentProject: { ...state.currentProject, scenes: updatedScenes },
        } : {}),
      };
    });
  },

  /**
   * Add a photo to an existing deviation record.
   */
  addDeviationPhoto: (captureId: string, photo: Photo) => {
    set((state) => {
      const capture = state.sceneCaptures[captureId];
      if (!capture?.deviation) return state;

      return {
        sceneCaptures: {
          ...state.sceneCaptures,
          [captureId]: {
            ...capture,
            deviation: {
              ...capture.deviation,
              photos: [...capture.deviation.photos, photo],
            },
          },
        },
      };
    });
  },

  /**
   * Remove a photo from a deviation record.
   */
  removeDeviationPhoto: (captureId: string, photoId: string) => {
    set((state) => {
      const capture = state.sceneCaptures[captureId];
      if (!capture?.deviation) return state;

      return {
        sceneCaptures: {
          ...state.sceneCaptures,
          [captureId]: {
            ...capture,
            deviation: {
              ...capture.deviation,
              photos: capture.deviation.photos.filter(p => p.id !== photoId),
            },
          },
        },
      };
    });
  },

  /**
   * Clear a deviation from a scene capture. Recomputes hasDeviation on
   * the parent Scene (may still be true if other captures have deviations).
   */
  clearDeviation: (captureId: string) => {
    set((state) => {
      const capture = state.sceneCaptures[captureId];
      if (!capture) return state;

      const updatedCaptures = {
        ...state.sceneCaptures,
        [captureId]: { ...capture, deviation: undefined },
      };

      // Recompute: does any OTHER capture for this scene still have a deviation?
      const sceneId = capture.sceneId;
      const stillHasDeviation = Object.values(updatedCaptures).some(
        c => c.sceneId === sceneId && c.deviation != null
      );

      const updatedScenes = state.currentProject?.scenes.map(s =>
        s.id === sceneId ? { ...s, hasDeviation: stillHasDeviation } : s
      );

      return {
        sceneCaptures: updatedCaptures,
        ...(state.currentProject && updatedScenes ? {
          currentProject: { ...state.currentProject, scenes: updatedScenes },
        } : {}),
      };
    });
  },

  /**
   * Check if any capture for a given scene has a deviation logged.
   * Use this for computing the flag without relying on the cached scene field.
   */
  sceneHasDeviation: (sceneId: string): boolean => {
    return Object.values(get().sceneCaptures).some(
      c => c.sceneId === sceneId && c.deviation != null
    );
  },
});
