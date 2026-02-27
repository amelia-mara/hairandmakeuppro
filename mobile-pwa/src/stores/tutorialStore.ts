import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface TutorialState {
  hasCompletedTutorial: boolean;
  hasSkippedTutorial: boolean;
  currentStep: number;
  completedAt: string | null;
  skippedAt: string | null;
  showTutorial: boolean;

  // Actions
  startTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
  resetTutorial: () => void;
  dismissTutorial: () => void;
}

export const TUTORIAL_TOTAL_STEPS = 7;

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set) => ({
      hasCompletedTutorial: false,
      hasSkippedTutorial: false,
      currentStep: 0,
      completedAt: null,
      skippedAt: null,
      showTutorial: false,

      startTutorial: () =>
        set({ showTutorial: true, currentStep: 0 }),

      nextStep: () =>
        set((state) => {
          const next = state.currentStep + 1;
          if (next >= TUTORIAL_TOTAL_STEPS) {
            return {
              currentStep: next,
              hasCompletedTutorial: true,
              completedAt: new Date().toISOString(),
              showTutorial: false,
            };
          }
          return { currentStep: next };
        }),

      prevStep: () =>
        set((state) => ({
          currentStep: Math.max(0, state.currentStep - 1),
        })),

      skipTutorial: () =>
        set({
          hasSkippedTutorial: true,
          skippedAt: new Date().toISOString(),
          showTutorial: false,
        }),

      completeTutorial: () =>
        set({
          hasCompletedTutorial: true,
          completedAt: new Date().toISOString(),
          showTutorial: false,
        }),

      resetTutorial: () =>
        set({
          hasCompletedTutorial: false,
          hasSkippedTutorial: false,
          currentStep: 0,
          completedAt: null,
          skippedAt: null,
          showTutorial: true,
        }),

      dismissTutorial: () =>
        set({ showTutorial: false }),
    }),
    {
      name: 'hair-makeup-tutorial-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
