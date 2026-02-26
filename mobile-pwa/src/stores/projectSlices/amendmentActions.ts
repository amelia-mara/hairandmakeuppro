import {
  compareScriptAmendment,
  applyAmendmentToScenes,
  clearAmendmentFlags,
  getAmendmentCount,
  type AmendmentResult,
} from '@/services/scriptAmendmentService';
import type { FastParsedScene } from '@/utils/scriptParser';
import type { ProjectSet, ProjectGet } from './types';

export const createAmendmentSlice = (set: ProjectSet, get: ProjectGet) => ({
  // Script Amendment actions
  compareScriptAmendment: (newParsedScenes: FastParsedScene[]): AmendmentResult | null => {
    const { currentProject } = get();
    if (!currentProject?.scenes) return null;
    return compareScriptAmendment(currentProject.scenes, newParsedScenes);
  },

  applyScriptAmendment: (
    amendmentResult: AmendmentResult,
    options: { includeNew?: boolean; includeModified?: boolean; includeDeleted?: boolean } = { includeNew: true, includeModified: true, includeDeleted: false }
  ) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const updatedScenes = applyAmendmentToScenes(
      currentProject.scenes,
      amendmentResult,
      options
    );

    set({
      currentProject: {
        ...currentProject,
        scenes: updatedScenes,
        updatedAt: new Date(),
      },
    });
  },

  clearSceneAmendmentFlags: () => {
    const { currentProject } = get();
    if (!currentProject) return;

    const clearedScenes = clearAmendmentFlags(currentProject.scenes);

    set({
      currentProject: {
        ...currentProject,
        scenes: clearedScenes,
      },
    });
  },

  clearSingleSceneAmendment: (sceneId: string) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const updatedScenes = currentProject.scenes.map(scene =>
      scene.id === sceneId
        ? {
            ...scene,
            amendmentStatus: undefined,
            amendmentNotes: undefined,
            previousScriptContent: undefined,
          }
        : scene
    );

    set({
      currentProject: {
        ...currentProject,
        scenes: updatedScenes,
      },
    });
  },

  getAmendmentCounts: () => {
    const { currentProject } = get();
    if (!currentProject?.scenes) {
      return { total: 0, new: 0, modified: 0, deleted: 0 };
    }
    return getAmendmentCount(currentProject.scenes);
  },
});
