import type { SceneCapture, Photo, ContinuityFlags, ContinuityEvent, SFXDetails } from '@/types';
import {
  createEmptyContinuityFlags,
  createEmptySFXDetails,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectSet, ProjectGet } from './types';

/**
 * Backfill required structural fields on a SceneCapture that was
 * persisted under an older schema (or arrived from cross-device sync
 * with fields the local schema marks required but the remote one
 * didn't yet have).
 *
 * Without this, CharacterProfile crashes on the first paint with
 * "Cannot read properties of undefined (reading 'sfxRequired')" /
 * "...reading 'length'" / similar — the ErrorBoundary catches and
 * surfaces the generic "something went wrong" page. The user reported
 * exactly that crash on the earliest scenes of a long-lived project
 * where the original captures predate the current schema.
 *
 * Returning a NEW object only when something was missing keeps the
 * Zustand referential-equality optimisation working for the common
 * case where the data is already well-formed.
 */
function normaliseCapture(c: SceneCapture | undefined): SceneCapture | undefined {
  if (!c) return c;
  const needsFix =
    !c.photos ||
    !c.additionalPhotos ||
    !c.continuityFlags ||
    !c.continuityEvents ||
    !c.sfxDetails;
  if (!needsFix) return c;
  return {
    ...c,
    photos: c.photos ?? {},
    additionalPhotos: c.additionalPhotos ?? [],
    continuityFlags: c.continuityFlags ?? createEmptyContinuityFlags(),
    continuityEvents: c.continuityEvents ?? [],
    sfxDetails: c.sfxDetails ?? createEmptySFXDetails(),
    notes: c.notes ?? '',
  };
}

export const createCaptureSlice = (set: ProjectSet, get: ProjectGet) => ({
  // Scene Capture actions
  getOrCreateSceneCapture: (sceneId: string, characterId: string): SceneCapture => {
    const state = get();
    const key = `${sceneId}-${characterId}`;
    const existing = normaliseCapture(state.sceneCaptures[key]);

    if (existing) {
      // If the normaliser had to backfill anything, persist the
      // repaired object back into the store so subsequent reads (and
      // saves) see a consistent shape and the structural-field guards
      // downstream don't have to handle undefined either.
      if (existing !== state.sceneCaptures[key]) {
        set((s) => ({ sceneCaptures: { ...s.sceneCaptures, [key]: existing } }));
      }
      return existing;
    }

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
    // Same defensive backfill as getOrCreateSceneCapture — callers
    // that branch on a missing capture (`getSceneCapture(...) ||
    // getOrCreateSceneCapture(...)`) still see "missing" as undefined,
    // but if a capture exists with an older shape they get a
    // structurally-complete object back.
    return normaliseCapture(get().sceneCaptures[`${sceneId}-${characterId}`]);
  },

  // ── Floor-team deviation record ────────────────────────────────────
  // Owned by the standby/floor team during shoot. Lives alongside the
  // existing notes/photos/flags/events on SceneCapture but is the only
  // place the floor team logs differences from the prep lookbook.

  setDeviationNote: (captureId: string, note: string) => {
    set((state) => {
      const capture = state.sceneCaptures[captureId];
      if (!capture) return state;
      const existing = capture.deviation ?? { note: '', photos: [] };
      const hasDeviation = note.trim().length > 0 || existing.photos.length > 0;
      return {
        sceneCaptures: {
          ...state.sceneCaptures,
          [captureId]: {
            ...capture,
            deviation: {
              ...existing,
              note,
              loggedAt: existing.loggedAt ?? new Date(),
            },
            floorTracking: {
              ...capture.floorTracking,
              hasDeviation,
              deviationNote: note,
            },
          },
        },
      };
    });
  },

  addDeviationPhoto: (captureId: string, photo: Photo) => {
    set((state) => {
      const capture = state.sceneCaptures[captureId];
      if (!capture) return state;
      const existing = capture.deviation ?? { note: '', photos: [] };
      return {
        sceneCaptures: {
          ...state.sceneCaptures,
          [captureId]: {
            ...capture,
            deviation: {
              ...existing,
              photos: [...existing.photos, photo],
              loggedAt: existing.loggedAt ?? new Date(),
            },
            floorTracking: {
              ...capture.floorTracking,
              hasDeviation: true,
            },
          },
        },
      };
    });
  },

  removeDeviationPhoto: (captureId: string, photoId: string) => {
    set((state) => {
      const capture = state.sceneCaptures[captureId];
      if (!capture || !capture.deviation) return state;
      const remainingPhotos = capture.deviation.photos.filter((p) => p.id !== photoId);
      const hasDeviation = capture.deviation.note.trim().length > 0 || remainingPhotos.length > 0;
      return {
        sceneCaptures: {
          ...state.sceneCaptures,
          [captureId]: {
            ...capture,
            deviation: {
              ...capture.deviation,
              photos: remainingPhotos,
            },
            floorTracking: {
              ...capture.floorTracking,
              hasDeviation,
            },
          },
        },
      };
    });
  },

  clearDeviation: (captureId: string) => {
    set((state) => {
      const capture = state.sceneCaptures[captureId];
      if (!capture) return state;
      const next = { ...capture };
      delete next.deviation;
      next.floorTracking = {
        ...next.floorTracking,
        hasDeviation: false,
        deviationNote: '',
      };
      return {
        sceneCaptures: { ...state.sceneCaptures, [captureId]: next },
      };
    });
  },
});
