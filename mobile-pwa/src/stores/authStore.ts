import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  User,
  UserTier,
  AuthScreen,
  ProjectMembership,
  ProductionType,
  ProjectRole,
} from '@/types';
import { generateProjectCode, TIER_LIMITS } from '@/types';

interface AuthState {
  // Auth state
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;

  // Navigation
  currentScreen: AuthScreen;
  hasCompletedOnboarding: boolean;

  // Projects (for logged-in users)
  projectMemberships: ProjectMembership[];

  // Guest mode (joined project without account)
  guestProjectCode: string | null;

  // Actions
  setScreen: (screen: AuthScreen) => void;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signOut: () => void;
  joinProject: (code: string) => Promise<{ success: boolean; projectName?: string; error?: string }>;
  createProject: (name: string, type: ProductionType) => Promise<{ success: boolean; code?: string; error?: string }>;
  clearError: () => void;
  setHasCompletedOnboarding: (value: boolean) => void;
  canCreateProjects: () => boolean;
  updateLastAccessed: (projectId: string) => void;
}

// Mock delay to simulate API calls
const mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock user database (would be Supabase in production)
const mockUsers: Map<string, { user: User; password: string }> = new Map();

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null,
      currentScreen: 'welcome',
      hasCompletedOnboarding: false,
      projectMemberships: [],
      guestProjectCode: null,

      // Set current auth screen
      setScreen: (screen) => {
        set({ currentScreen: screen, error: null });
      },

      // Sign in with email/password
      signIn: async (email, password) => {
        set({ isLoading: true, error: null });

        try {
          await mockDelay(800);

          // Check mock database
          const userData = mockUsers.get(email.toLowerCase());

          if (!userData) {
            set({ isLoading: false, error: 'No account found with this email' });
            return false;
          }

          if (userData.password !== password) {
            set({ isLoading: false, error: 'Incorrect password' });
            return false;
          }

          set({
            isAuthenticated: true,
            user: userData.user,
            isLoading: false,
            error: null,
            currentScreen: 'hub',
            hasCompletedOnboarding: true,
          });

          return true;
        } catch {
          set({ isLoading: false, error: 'An error occurred. Please try again.' });
          return false;
        }
      },

      // Sign up with email/password
      signUp: async (name, email, password) => {
        set({ isLoading: true, error: null });

        try {
          await mockDelay(800);

          const emailLower = email.toLowerCase();

          // Check if user already exists
          if (mockUsers.has(emailLower)) {
            set({ isLoading: false, error: 'An account with this email already exists' });
            return false;
          }

          // Create new user
          const newUser: User = {
            id: crypto.randomUUID(),
            email: emailLower,
            name,
            tier: 'free' as UserTier,
            createdAt: new Date(),
          };

          // Store in mock database
          mockUsers.set(emailLower, { user: newUser, password });

          set({
            isAuthenticated: true,
            user: newUser,
            isLoading: false,
            error: null,
            currentScreen: 'hub',
            hasCompletedOnboarding: true,
            projectMemberships: [],
          });

          return true;
        } catch {
          set({ isLoading: false, error: 'An error occurred. Please try again.' });
          return false;
        }
      },

      // Sign out
      signOut: () => {
        set({
          isAuthenticated: false,
          user: null,
          currentScreen: 'welcome',
          projectMemberships: [],
          guestProjectCode: null,
        });
      },

      // Join a project with code
      joinProject: async (code) => {
        set({ isLoading: true, error: null });

        try {
          await mockDelay(600);

          const upperCode = code.toUpperCase();

          // Mock validation - in production this would check Supabase
          // For demo purposes, accept any valid format code
          const isValid = /^[A-Z]{3}-[A-Z0-9]{4}$/.test(upperCode);

          if (!isValid) {
            set({ isLoading: false, error: 'Invalid project code format' });
            return { success: false, error: 'Invalid project code format' };
          }

          // Mock project name based on code
          const mockProjectName = `Production ${upperCode.slice(0, 3)}`;

          const { isAuthenticated, projectMemberships } = get();

          if (isAuthenticated) {
            // Add to user's projects
            const newMembership: ProjectMembership = {
              projectId: crypto.randomUUID(),
              projectName: mockProjectName,
              productionType: 'film',
              role: 'artist' as ProjectRole,
              joinedAt: new Date(),
              lastAccessedAt: new Date(),
              teamMemberCount: Math.floor(Math.random() * 10) + 2,
              projectCode: upperCode,
            };

            set({
              isLoading: false,
              projectMemberships: [...projectMemberships, newMembership],
              currentScreen: 'hub',
            });
          } else {
            // Guest mode - store code and enter project directly
            set({
              isLoading: false,
              guestProjectCode: upperCode,
            });
          }

          return { success: true, projectName: mockProjectName };
        } catch {
          set({ isLoading: false, error: 'Failed to join project. Please try again.' });
          return { success: false, error: 'Failed to join project' };
        }
      },

      // Create a new project (Supervisor+ only)
      createProject: async (name, type) => {
        const { user, projectMemberships } = get();

        if (!user || !TIER_LIMITS[user.tier].canCreateProjects) {
          set({ error: 'Your account tier does not allow creating projects' });
          return { success: false, error: 'Insufficient permissions' };
        }

        set({ isLoading: true, error: null });

        try {
          await mockDelay(600);

          const code = generateProjectCode();

          const newMembership: ProjectMembership = {
            projectId: crypto.randomUUID(),
            projectName: name,
            productionType: type,
            role: 'owner' as ProjectRole,
            joinedAt: new Date(),
            lastAccessedAt: new Date(),
            teamMemberCount: 1,
            projectCode: code,
          };

          set({
            isLoading: false,
            projectMemberships: [...projectMemberships, newMembership],
          });

          return { success: true, code };
        } catch {
          set({ isLoading: false, error: 'Failed to create project. Please try again.' });
          return { success: false, error: 'Failed to create project' };
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Mark onboarding as completed
      setHasCompletedOnboarding: (value) => {
        set({ hasCompletedOnboarding: value });
      },

      // Check if user can create projects
      canCreateProjects: () => {
        const { user } = get();
        if (!user) return false;
        return TIER_LIMITS[user.tier].canCreateProjects;
      },

      // Update last accessed time for a project
      updateLastAccessed: (projectId) => {
        const { projectMemberships } = get();
        const updated = projectMemberships.map((pm) =>
          pm.projectId === projectId
            ? { ...pm, lastAccessedAt: new Date() }
            : pm
        );
        set({ projectMemberships: updated });
      },
    }),
    {
      name: 'checks-happy-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist these fields
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        projectMemberships: state.projectMemberships,
        guestProjectCode: state.guestProjectCode,
      }),
    }
  )
);
