import type { ProjectLifecycle, ProjectLifecycleState } from '@/types';
import {
  createDefaultLifecycle,
  calculateDaysUntilDeletion,
  shouldTriggerWrap,
  PROJECT_RETENTION_DAYS,
  REMINDER_INTERVAL_DAYS,
} from '@/types';
import type { ProjectSet, ProjectGet } from './types';

export const createLifecycleSlice = (set: ProjectSet, get: ProjectGet) => ({
  // Lifecycle actions
  updateActivity: () => {
    set((state) => ({
      lifecycle: {
        ...state.lifecycle,
        lastActivityAt: new Date(),
      },
    }));
  },

  checkWrapTrigger: () => {
    const state = get();
    if (!state.currentProject) return;

    // Check if reminder should show again
    if (state.lifecycle.nextReminderAt) {
      const now = new Date();
      if (now >= new Date(state.lifecycle.nextReminderAt)) {
        set({
          showWrapPopup: true,
          wrapTriggerReason: state.lifecycle.wrapReason || 'manual',
        });
        return;
      }
    }

    const result = shouldTriggerWrap(state.currentProject, state.lifecycle);
    if (result.trigger && result.reason) {
      set({
        showWrapPopup: true,
        wrapTriggerReason: result.reason,
      });
    }
  },

  wrapProject: (reason: ProjectLifecycle['wrapReason']) => {
    const now = new Date();
    const deletionDate = new Date(now);
    deletionDate.setDate(deletionDate.getDate() + PROJECT_RETENTION_DAYS);

    set((state) => ({
      lifecycle: {
        ...state.lifecycle,
        state: 'wrapped',
        wrappedAt: now,
        wrapReason: reason,
        deletionDate: deletionDate,
      },
      showWrapPopup: false,
      wrapTriggerReason: null,
    }));
  },

  dismissWrapPopup: (remindLater: boolean) => {
    if (remindLater) {
      const nextReminder = new Date();
      nextReminder.setDate(nextReminder.getDate() + REMINDER_INTERVAL_DAYS);
      set((state) => ({
        showWrapPopup: false,
        lifecycle: {
          ...state.lifecycle,
          reminderDismissedAt: new Date(),
          nextReminderAt: nextReminder,
        },
      }));
    } else {
      set({ showWrapPopup: false });
    }
  },

  restoreProject: () => {
    set((state) => ({
      lifecycle: {
        ...state.lifecycle,
        state: 'active',
        wrappedAt: undefined,
        deletionDate: undefined,
        archiveDate: undefined,
        reminderDismissedAt: undefined,
        nextReminderAt: undefined,
        lastActivityAt: new Date(),
      },
    }));
  },

  archiveProject: () => {
    const state = get();
    if (!state.currentProject) return;

    const archiveDate = new Date();
    const archivedEntry = {
      project: state.currentProject,
      lifecycle: {
        ...state.lifecycle,
        state: 'archived' as ProjectLifecycleState,
        archiveDate: archiveDate,
      },
      sceneCaptures: state.sceneCaptures,
    };

    set((state) => ({
      archivedProjects: [...state.archivedProjects, archivedEntry],
      currentProject: null,
      sceneCaptures: {},
      lifecycle: createDefaultLifecycle(),
    }));
  },

  permanentlyDeleteProject: () => {
    set({
      currentProject: null,
      sceneCaptures: {},
      lifecycle: createDefaultLifecycle(),
    });
  },

  getArchivedProjects: () => {
    const state = get();
    return state.archivedProjects.map((archived) => {
      const photosCount = Object.values(archived.sceneCaptures).reduce((count, capture) => {
        let photos = 0;
        if (capture.photos.front) photos++;
        if (capture.photos.left) photos++;
        if (capture.photos.right) photos++;
        if (capture.photos.back) photos++;
        photos += capture.additionalPhotos.length;
        return count + photos;
      }, 0);

      return {
        id: archived.project.id,
        name: archived.project.name,
        state: archived.lifecycle.state,
        wrappedAt: archived.lifecycle.wrappedAt,
        daysUntilDeletion: archived.lifecycle.wrappedAt
          ? calculateDaysUntilDeletion(new Date(archived.lifecycle.wrappedAt))
          : 0,
        scenesCount: archived.project.scenes.length,
        charactersCount: archived.project.characters.length,
        photosCount,
      };
    });
  },

  loadArchivedProject: (projectId: string) => {
    const state = get();
    const archivedIndex = state.archivedProjects.findIndex(
      a => a.project.id === projectId
    );

    if (archivedIndex === -1) return;

    const archived = state.archivedProjects[archivedIndex];
    const newArchivedProjects = [...state.archivedProjects];
    newArchivedProjects.splice(archivedIndex, 1);

    set({
      currentProject: archived.project,
      sceneCaptures: archived.sceneCaptures,
      lifecycle: archived.lifecycle,
      archivedProjects: newArchivedProjects,
    });
  },

  getDaysUntilDeletion: (): number => {
    const state = get();
    if (state.lifecycle.state === 'active' || !state.lifecycle.wrappedAt) {
      return -1;
    }
    return calculateDaysUntilDeletion(new Date(state.lifecycle.wrappedAt));
  },

  getLifecycleBanner: () => {
    const state = get();
    if (state.lifecycle.state === 'active') return null;

    const daysRemaining = state.lifecycle.wrappedAt
      ? calculateDaysUntilDeletion(new Date(state.lifecycle.wrappedAt))
      : 0;

    if (state.lifecycle.state === 'wrapped') {
      return {
        show: true,
        message: `Project wrapped. ${daysRemaining} days until archive.`,
        daysRemaining,
      };
    }

    if (state.lifecycle.state === 'archived') {
      return {
        show: true,
        message: `Archived. Export to restore.`,
        daysRemaining,
      };
    }

    return null;
  },
});
