import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import * as supabaseAuth from '@/services/supabaseAuth';
import * as supabaseProjects from '@/services/supabaseProjects';
import type {
  User,
  UserTier,
  AuthScreen,
  ProjectMembership,
  ProductionType,
  ProjectRole,
  SubscriptionData,
  BillingPeriod,
} from '@/types';
import { TIER_LIMITS, createDefaultSubscription, SubscriptionTier } from '@/types';

interface AuthState {
  // Auth state
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;

  // Navigation
  currentScreen: AuthScreen;
  screenHistory: AuthScreen[];
  hasCompletedOnboarding: boolean;
  hasSelectedPlan: boolean;

  // Subscription data
  subscription: SubscriptionData;

  // Projects (for logged-in users)
  projectMemberships: ProjectMembership[];

  // Guest mode (joined project without account)
  guestProjectCode: string | null;

  // Actions
  setScreen: (screen: AuthScreen, addToHistory?: boolean) => void;
  goBack: () => void;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signOut: () => void;
  joinProject: (code: string) => Promise<{ success: boolean; projectName?: string; error?: string }>;
  createProject: (name: string, type: ProductionType) => Promise<{ success: boolean; code?: string; error?: string }>;
  clearError: () => void;
  setHasCompletedOnboarding: (value: boolean) => void;
  canCreateProjects: () => boolean;
  updateLastAccessed: (projectId: string) => void;
  selectTier: (tier: SubscriptionTier, billingPeriod: BillingPeriod) => Promise<boolean>;
  updateSubscription: (subscription: Partial<SubscriptionData>) => void;
  // New Supabase-specific actions
  initializeAuth: () => Promise<void>;
  refreshUserProjects: () => Promise<void>;
}

// Convert Supabase user profile to app User type
function toAppUser(profile: supabaseAuth.UserProfile): User {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    tier: profile.tier as UserTier,
    createdAt: new Date(profile.created_at),
  };
}

// Convert Supabase project to ProjectMembership
function toProjectMembership(
  project: supabaseProjects.ProjectWithRole
): ProjectMembership {
  return {
    projectId: project.id,
    projectName: project.name,
    productionType: project.production_type as ProductionType,
    role: project.is_owner ? 'owner' : (project.role as ProjectRole),
    joinedAt: new Date(project.created_at),
    lastAccessedAt: new Date(),
    teamMemberCount: 0, // Will be fetched separately if needed
    sceneCount: 0, // Will be fetched separately if needed
    projectCode: project.invite_code,
    status: project.status === 'wrapped' ? 'wrapped' : 'active',
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null,
      currentScreen: 'welcome',
      screenHistory: [],
      hasCompletedOnboarding: false,
      hasSelectedPlan: false,
      subscription: createDefaultSubscription(),
      projectMemberships: [],
      guestProjectCode: null,

      // Initialize auth state from Supabase session
      initializeAuth: async () => {
        try {
          const session = await supabaseAuth.getSession();

          if (session?.user) {
            // Get user profile from database
            const { profile, error } = await supabaseAuth.getUserProfile(session.user.id);

            if (profile && !error) {
              const appUser = toAppUser(profile);

              // Get user's projects
              const { projects } = await supabaseProjects.getUserProjects(session.user.id);
              const memberships = projects.map(toProjectMembership);

              set({
                isAuthenticated: true,
                user: appUser,
                projectMemberships: memberships,
                hasCompletedOnboarding: true,
                hasSelectedPlan: true,
                currentScreen: 'hub',
              });
            }
          }
        } catch (error) {
          console.error('Error initializing auth:', error);
        }
      },

      // Refresh user's projects from Supabase
      refreshUserProjects: async () => {
        const { user } = get();
        if (!user) return;

        try {
          const { projects } = await supabaseProjects.getUserProjects(user.id);
          const memberships = projects.map(toProjectMembership);
          set({ projectMemberships: memberships });
        } catch (error) {
          console.error('Error refreshing projects:', error);
        }
      },

      // Set current auth screen
      setScreen: (screen, addToHistory = true) => {
        const { currentScreen, screenHistory } = get();
        if (screen === currentScreen) return;

        if (addToHistory) {
          set({
            currentScreen: screen,
            screenHistory: [...screenHistory, currentScreen],
            error: null,
          });
        } else {
          set({ currentScreen: screen, error: null });
        }
      },

      // Navigate back
      goBack: () => {
        const { screenHistory, isAuthenticated } = get();
        if (screenHistory.length > 0) {
          const newHistory = [...screenHistory];
          const previousScreen = newHistory.pop()!;
          set({
            currentScreen: previousScreen,
            screenHistory: newHistory,
            error: null,
          });
        } else {
          set({
            currentScreen: isAuthenticated ? 'hub' : 'welcome',
            error: null,
          });
        }
      },

      // Sign in with Supabase
      signIn: async (email, password) => {
        set({ isLoading: true, error: null });

        try {
          const { user: authUser, error: authError } = await supabaseAuth.signIn({
            email,
            password,
          });

          if (authError) {
            const errorMessage = authError.message.includes('Invalid login')
              ? 'Invalid email or password'
              : authError.message;
            set({ isLoading: false, error: errorMessage });
            return false;
          }

          if (!authUser) {
            set({ isLoading: false, error: 'Sign in failed. Please try again.' });
            return false;
          }

          // Get user profile
          const { profile, error: profileError } = await supabaseAuth.getUserProfile(authUser.id);

          if (profileError || !profile) {
            // Profile might not exist yet, create one
            await supabase.from('users').insert({
              id: authUser.id,
              email: authUser.email!,
              name: authUser.user_metadata?.name || email.split('@')[0],
              tier: 'trainee',
            });

            const appUser: User = {
              id: authUser.id,
              email: authUser.email!,
              name: authUser.user_metadata?.name || email.split('@')[0],
              tier: 'trainee',
              createdAt: new Date(),
            };

            set({
              isAuthenticated: true,
              user: appUser,
              isLoading: false,
              error: null,
              currentScreen: 'hub',
              hasCompletedOnboarding: true,
              hasSelectedPlan: true,
            });
          } else {
            const appUser = toAppUser(profile);

            // Get user's projects
            const { projects } = await supabaseProjects.getUserProjects(authUser.id);
            const memberships = projects.map(toProjectMembership);

            set({
              isAuthenticated: true,
              user: appUser,
              projectMemberships: memberships,
              isLoading: false,
              error: null,
              currentScreen: 'hub',
              hasCompletedOnboarding: true,
              hasSelectedPlan: true,
            });
          }

          return true;
        } catch (error) {
          console.error('Sign in error:', error);
          set({ isLoading: false, error: 'An error occurred. Please try again.' });
          return false;
        }
      },

      // Sign up with Supabase
      signUp: async (name, email, password) => {
        set({ isLoading: true, error: null });

        try {
          const { user: authUser, error: authError } = await supabaseAuth.signUp({
            email,
            password,
            name,
          });

          if (authError) {
            const errorMessage = authError.message.includes('already registered')
              ? 'An account with this email already exists'
              : authError.message;
            set({ isLoading: false, error: errorMessage });
            return false;
          }

          if (!authUser) {
            set({ isLoading: false, error: 'Sign up failed. Please try again.' });
            return false;
          }

          const appUser: User = {
            id: authUser.id,
            email: authUser.email!,
            name,
            tier: 'trainee',
            createdAt: new Date(),
          };

          set({
            isAuthenticated: true,
            user: appUser,
            isLoading: false,
            error: null,
            currentScreen: 'select-plan',
            hasCompletedOnboarding: false,
            hasSelectedPlan: false,
            subscription: createDefaultSubscription(),
            projectMemberships: [],
          });

          return true;
        } catch (error) {
          console.error('Sign up error:', error);
          set({ isLoading: false, error: 'An error occurred. Please try again.' });
          return false;
        }
      },

      // Sign out
      signOut: async () => {
        try {
          await supabaseAuth.signOut();
        } catch (error) {
          console.error('Sign out error:', error);
        }

        set({
          isAuthenticated: false,
          user: null,
          currentScreen: 'welcome',
          screenHistory: [],
          hasCompletedOnboarding: false,
          hasSelectedPlan: false,
          subscription: createDefaultSubscription(),
          projectMemberships: [],
          guestProjectCode: null,
        });
      },

      // Join a project with invite code
      joinProject: async (code) => {
        const { user, projectMemberships, isAuthenticated } = get();

        set({ isLoading: true, error: null });

        try {
          if (!isAuthenticated || !user) {
            // Guest mode - store code and enter project directly
            set({
              isLoading: false,
              guestProjectCode: code.toUpperCase(),
            });
            return { success: true, projectName: 'Project' };
          }

          // Join project via Supabase
          const { project, error } = await supabaseProjects.joinProject(code, user.id);

          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }

          if (!project) {
            set({ isLoading: false, error: 'Failed to join project' });
            return { success: false, error: 'Failed to join project' };
          }

          // Add to local state
          const newMembership: ProjectMembership = {
            projectId: project.id,
            projectName: project.name,
            productionType: project.production_type as ProductionType,
            role: 'floor',
            joinedAt: new Date(),
            lastAccessedAt: new Date(),
            teamMemberCount: 1,
            sceneCount: 0,
            projectCode: project.invite_code,
            status: 'active',
          };

          set({
            isLoading: false,
            projectMemberships: [...projectMemberships, newMembership],
            currentScreen: 'hub',
          });

          return { success: true, projectName: project.name };
        } catch (error) {
          console.error('Join project error:', error);
          set({ isLoading: false, error: 'Failed to join project. Please try again.' });
          return { success: false, error: 'Failed to join project' };
        }
      },

      // Create a new project
      createProject: async (name, type) => {
        const { user, projectMemberships } = get();

        if (!user || !TIER_LIMITS[user.tier].canCreateProjects) {
          set({ error: 'Your account tier does not allow creating projects' });
          return { success: false, error: 'Insufficient permissions' };
        }

        set({ isLoading: true, error: null });

        try {
          const { project, inviteCode, error } = await supabaseProjects.createProject(
            name,
            type,
            user.id
          );

          if (error || !project || !inviteCode) {
            set({ isLoading: false, error: error?.message || 'Failed to create project' });
            return { success: false, error: error?.message || 'Failed to create project' };
          }

          const newMembership: ProjectMembership = {
            projectId: project.id,
            projectName: project.name,
            productionType: type,
            role: 'owner',
            joinedAt: new Date(),
            lastAccessedAt: new Date(),
            teamMemberCount: 1,
            sceneCount: 0,
            projectCode: inviteCode,
            status: 'active',
          };

          set({
            isLoading: false,
            projectMemberships: [...projectMemberships, newMembership],
          });

          return { success: true, code: inviteCode };
        } catch (error) {
          console.error('Create project error:', error);
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

      // Select subscription tier
      selectTier: async (tier, billingPeriod) => {
        const { user } = get();
        if (!user) return false;

        set({ isLoading: true, error: null });

        try {
          // Update tier in Supabase
          const { error } = await supabaseAuth.updateUserTier(user.id, tier);

          if (error) {
            set({ isLoading: false, error: error.message });
            return false;
          }

          // Update local state
          const updatedUser: User = {
            ...user,
            tier: tier as UserTier,
          };

          const updatedSubscription: SubscriptionData = {
            tier,
            status: tier === 'trainee' ? null : 'active',
            billingPeriod: tier === 'trainee' ? null : billingPeriod,
            subscriptionStartedAt: tier !== 'trainee' ? new Date() : undefined,
            currentPeriodEndsAt: tier !== 'trainee'
              ? new Date(Date.now() + (billingPeriod === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000)
              : undefined,
          };

          set({
            user: updatedUser,
            subscription: updatedSubscription,
            hasSelectedPlan: true,
            hasCompletedOnboarding: true,
            currentScreen: 'hub',
            isLoading: false,
            error: null,
          });

          return true;
        } catch (error) {
          console.error('Select tier error:', error);
          set({ isLoading: false, error: 'Failed to update subscription. Please try again.' });
          return false;
        }
      },

      // Update subscription data
      updateSubscription: (subscriptionUpdate) => {
        const { subscription, user } = get();
        const updatedSubscription = { ...subscription, ...subscriptionUpdate };

        if (subscriptionUpdate.tier && user) {
          const updatedUser = { ...user, tier: subscriptionUpdate.tier as UserTier };

          // Also update in Supabase
          supabaseAuth.updateUserTier(user.id, subscriptionUpdate.tier).catch(console.error);

          set({
            subscription: updatedSubscription,
            user: updatedUser,
          });
        } else {
          set({ subscription: updatedSubscription });
        }
      },
    }),
    {
      name: 'checks-happy-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        currentScreen: state.currentScreen,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        hasSelectedPlan: state.hasSelectedPlan,
        subscription: state.subscription,
        projectMemberships: state.projectMemberships,
        guestProjectCode: state.guestProjectCode,
      }),
    }
  )
);

// Set up auth state listener only if Supabase is configured
if (isSupabaseConfigured) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      // User signed in - refresh state
      useAuthStore.getState().initializeAuth();
    } else if (event === 'SIGNED_OUT') {
      // User signed out - clear state
      useAuthStore.setState({
        isAuthenticated: false,
        user: null,
        projectMemberships: [],
      });
    }
  });
}
