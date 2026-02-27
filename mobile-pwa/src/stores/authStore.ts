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
  Project,
} from '@/types';
import { TIER_LIMITS, createDefaultSubscription, SubscriptionTier, BETA_MODE, createEmptyMakeupDetails, createEmptyHairDetails } from '@/types';
import type { CallSheet, ProductionSchedule } from '@/types';
import { useProjectStore } from './projectStore';
import { useScheduleStore } from './scheduleStore';
import { useCallSheetStore } from './callSheetStore';
import * as supabaseStorage from '@/services/supabaseStorage';

// Flag to prevent initializeAuth from racing with an in-progress signIn/signUp
let _manualAuthInProgress = false;

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

  // Pinned "current" project (shown at top of hub)
  pinnedProjectId: string | null;

  // Project settings navigation
  settingsProjectId: string | null;

  // Actions
  setScreen: (screen: AuthScreen, addToHistory?: boolean) => void;
  goBack: () => void;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signOut: () => void;
  joinProject: (code: string, role?: string) => Promise<{ success: boolean; projectName?: string; error?: string }>;
  createProject: (name: string, type: ProductionType, ownerRole?: string) => Promise<{ success: boolean; code?: string; error?: string }>;
  clearError: () => void;
  setHasCompletedOnboarding: (value: boolean) => void;
  canCreateProjects: () => boolean;
  updateLastAccessed: (projectId: string) => void;
  selectTier: (tier: SubscriptionTier, billingPeriod: BillingPeriod) => Promise<boolean>;
  updateSubscription: (subscription: Partial<SubscriptionData>) => void;
  // New Supabase-specific actions
  initializeAuth: () => Promise<void>;
  refreshUserProjects: () => Promise<void>;
  deleteProject: (projectId: string) => Promise<{ success: boolean; error?: string }>;
  leaveProject: (projectId: string) => Promise<{ success: boolean; error?: string }>;
  setPinnedProject: (projectId: string) => void;
  setSettingsProjectId: (projectId: string | null) => void;
}

// Valid tiers for lookup safety
const VALID_TIERS: UserTier[] = ['trainee', 'artist', 'supervisor', 'designer'];

// Convert Supabase user profile to app User type
function toAppUser(profile: supabaseAuth.UserProfile): User {
  const tier = VALID_TIERS.includes(profile.tier as UserTier)
    ? (profile.tier as UserTier)
    : 'trainee';
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    tier,
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
    ownerName: project.owner_name,
    pendingDeletionAt: project.pending_deletion_at ? new Date(project.pending_deletion_at) : null,
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
      pinnedProjectId: null,
      settingsProjectId: null,

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
              const { projects, error: projectsError } = await supabaseProjects.getUserProjects(session.user.id);

              if (projectsError) {
                console.error('Error fetching projects during auth init:', projectsError);
                // Still set user as authenticated, but preserve any existing memberships
                set({
                  isAuthenticated: true,
                  user: appUser,
                  hasCompletedOnboarding: true,
                  hasSelectedPlan: true,
                  currentScreen: 'hub',
                });
                return;
              }

              // Finalize any owner projects whose grace period has expired
              for (const p of projects) {
                if (
                  p.is_owner &&
                  p.pending_deletion_at &&
                  supabaseProjects.isDeletionGracePeriodExpired(p.pending_deletion_at)
                ) {
                  await supabaseProjects.finalizeProjectDeletion(p.id, session.user.id).catch(console.error);
                }
              }

              // Hide owner's pending-deletion projects (synced members still see the warning)
              const visibleProjects = projects.filter(
                (p) => !(p.is_owner && p.pending_deletion_at)
              );
              const memberships = visibleProjects.map(toProjectMembership);

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
      // Also finalizes any expired pending deletions for owned projects
      refreshUserProjects: async () => {
        const { user } = get();
        if (!user) return;

        try {
          const { projects, error: projectsError } = await supabaseProjects.getUserProjects(user.id);

          if (projectsError) {
            console.error('Error refreshing projects:', projectsError);
            // Don't overwrite existing memberships on error
            return;
          }

          // For owned projects with expired grace periods, finalize deletion
          for (const p of projects) {
            if (
              p.is_owner &&
              p.pending_deletion_at &&
              supabaseProjects.isDeletionGracePeriodExpired(p.pending_deletion_at)
            ) {
              await supabaseProjects.finalizeProjectDeletion(p.id, user.id).catch(console.error);
            }
          }

          // For the owner, hide projects they marked for deletion immediately.
          // For synced (non-owner) members, keep showing until grace period expires.
          const remaining = projects.filter(
            (p) => !(p.is_owner && p.pending_deletion_at)
          );

          const memberships = remaining.map(toProjectMembership);
          set({ projectMemberships: memberships });
        } catch (error) {
          console.error('Error refreshing projects:', error);
          // Don't overwrite existing memberships on error
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
        _manualAuthInProgress = true;

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

          let appUser: User;

          if (profileError || !profile) {
            // Profile might not exist yet, create one
            await supabase.from('users').insert({
              id: authUser.id,
              email: authUser.email!,
              name: authUser.user_metadata?.name || email.split('@')[0],
              tier: 'trainee',
            });

            appUser = {
              id: authUser.id,
              email: authUser.email!,
              name: authUser.user_metadata?.name || email.split('@')[0],
              tier: 'trainee',
              createdAt: new Date(),
            };
          } else {
            appUser = toAppUser(profile);
          }

          // Always fetch user's projects (regardless of profile path)
          const { projects, error: projectsError } = await supabaseProjects.getUserProjects(authUser.id);

          // Only update projectMemberships if the fetch succeeded
          const memberships = !projectsError && projects.length > 0
            ? projects.map(toProjectMembership)
            : projectsError
              ? get().projectMemberships // Keep existing on error
              : []; // Genuinely empty

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

          return true;
        } catch (error) {
          console.error('Sign in error:', error);
          set({ isLoading: false, error: 'An error occurred. Please try again.' });
          return false;
        } finally {
          _manualAuthInProgress = false;
        }
      },

      // Sign up with Supabase
      signUp: async (name, email, password) => {
        set({ isLoading: true, error: null });
        _manualAuthInProgress = true;

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
            // In beta mode, all users get Designer tier
            tier: BETA_MODE ? 'designer' : 'trainee',
            createdAt: new Date(),
          };

          set({
            isAuthenticated: true,
            user: appUser,
            isLoading: false,
            error: null,
            // Skip plan selection in beta mode, go directly to hub
            currentScreen: BETA_MODE ? 'hub' : 'select-plan',
            hasCompletedOnboarding: BETA_MODE,
            hasSelectedPlan: BETA_MODE,
            subscription: createDefaultSubscription(),
            projectMemberships: [],
          });

          return true;
        } catch (error) {
          console.error('Sign up error:', error);
          set({ isLoading: false, error: 'An error occurred. Please try again.' });
          return false;
        } finally {
          _manualAuthInProgress = false;
        }
      },

      // Sign out
      signOut: async () => {
        try {
          await supabaseAuth.signOut();
        } catch (error) {
          console.error('Sign out error:', error);
        }

        // Clear local project stores to prevent stale data on next login
        try {
          useProjectStore.getState().clearProject();
          // Also clear any saved project snapshots
          useProjectStore.setState({ savedProjects: {}, archivedProjects: [] });
          useScheduleStore.getState().clearSchedule();
          useCallSheetStore.getState().clearAll();
        } catch (error) {
          console.error('Error clearing local stores on sign out:', error);
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
          pinnedProjectId: null,
        });
      },

      // Join a project with invite code and selected role
      joinProject: async (code, role) => {
        const { user, projectMemberships, isAuthenticated } = get();

        set({ isLoading: true, error: null });

        try {
          if (!isAuthenticated || !user) {
            // Users must create an account before joining projects
            set({ isLoading: false, error: 'Please create an account first to join a project.' });
            return { success: false, error: 'Account required' };
          }

          // Join project via Supabase (RPC with fallback) using the selected role
          const joinRole = (role || 'floor') as any;
          const { project: joinedProject, error } = await supabaseProjects.joinProject(code, user.id, joinRole);

          if (error) {
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
          }

          if (!joinedProject) {
            set({ isLoading: false, error: 'Failed to join project' });
            return { success: false, error: 'Failed to join project' };
          }

          // Fetch the project owner's name for the "Synced from" label
          let ownerName: string | undefined;
          try {
            const { members } = await supabaseProjects.getProjectMembers(joinedProject.id);
            const ownerMember = members.find((m) => m.is_owner);
            if (ownerMember) ownerName = ownerMember.user.name;
          } catch { /* non-critical */ }

          // Add to local memberships
          const newMembership: ProjectMembership = {
            projectId: joinedProject.id,
            projectName: joinedProject.name,
            productionType: joinedProject.production_type as ProductionType,
            role: joinRole as ProjectRole,
            joinedAt: new Date(),
            lastAccessedAt: new Date(),
            teamMemberCount: 1,
            sceneCount: 0,
            projectCode: joinedProject.invite_code,
            status: 'active',
            ownerName,
            pendingDeletionAt: null,
          };

          // Fetch project data and load into project store
          const {
            scenes, characters, looks, sceneCharacters, lookScenes,
            scheduleData, callSheetData, scriptData,
          } = await supabaseProjects.getProjectData(joinedProject.id);

          const pStore = useProjectStore.getState();

          if (scenes.length > 0 || characters.length > 0) {
            const sceneCharMap = new Map<string, string[]>();
            for (const sc of sceneCharacters) {
              const existing = sceneCharMap.get(sc.scene_id) || [];
              existing.push(sc.character_id);
              sceneCharMap.set(sc.scene_id, existing);
            }

            const lookSceneMap = new Map<string, string[]>();
            for (const ls of lookScenes) {
              const existing = lookSceneMap.get(ls.look_id) || [];
              existing.push(ls.scene_number);
              lookSceneMap.set(ls.look_id, existing);
            }

            const localScenes = scenes.map((s: any) => ({
              id: s.id,
              sceneNumber: s.scene_number,
              slugline: s.location || `Scene ${s.scene_number}`,
              intExt: (s.int_ext === 'EXT' ? 'EXT' : 'INT') as 'INT' | 'EXT',
              timeOfDay: (s.time_of_day || 'DAY') as 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS',
              synopsis: s.synopsis || undefined,
              scriptContent: s.script_content || undefined,
              characters: sceneCharMap.get(s.id) || [],
              isComplete: s.is_complete,
              completedAt: s.completed_at ? new Date(s.completed_at) : undefined,
              filmingStatus: s.filming_status as any,
              filmingNotes: s.filming_notes || undefined,
              shootingDay: s.shooting_day || undefined,
              characterConfirmationStatus: 'confirmed' as const,
            }));

            const localCharacters = characters.map((c: any) => ({
              id: c.id,
              name: c.name,
              initials: c.initials,
              avatarColour: c.avatar_colour,
            }));

            const localLooks = looks.map((l: any) => ({
              id: l.id,
              characterId: l.character_id,
              name: l.name,
              scenes: lookSceneMap.get(l.id) || [],
              estimatedTime: l.estimated_time,
              makeup: (l.makeup_details as any) || createEmptyMakeupDetails(),
              hair: (l.hair_details as any) || createEmptyHairDetails(),
            }));

            const loadedProject: Project = {
              id: joinedProject.id,
              name: joinedProject.name,
              createdAt: new Date(joinedProject.created_at),
              updatedAt: new Date(),
              scenes: localScenes,
              characters: localCharacters,
              looks: localLooks,
            };

            pStore.setProject(loadedProject);
          } else {
            const emptyProject: Project = {
              id: joinedProject.id,
              name: joinedProject.name,
              createdAt: new Date(joinedProject.created_at),
              updatedAt: new Date(),
              scenes: [],
              characters: [],
              looks: [],
            };
            pStore.setProject(emptyProject);
          }

          // Load documents (schedule, call sheets, script) into their stores
          if (scheduleData.length > 0) {
            const db = scheduleData[0];
            if (db.days || db.cast_list) {
              const schedule: ProductionSchedule = {
                id: db.id,
                status: db.status === 'complete' ? 'complete' : 'pending',
                castList: (db.cast_list as any[]) || [],
                days: (db.days as any[]) || [],
                totalDays: ((db.days as any[]) || []).length,
                uploadedAt: new Date(db.created_at),
                rawText: db.raw_pdf_text || undefined,
              };
              useScheduleStore.getState().setSchedule(schedule);
            }
          }

          if (callSheetData.length > 0) {
            const csStore = useCallSheetStore.getState();
            csStore.clearAll();
            const callSheets: CallSheet[] = callSheetData.map((db: any) => {
              const parsed = (db.parsed_data || {}) as any;
              return {
                ...parsed,
                id: db.id,
                date: db.shoot_date,
                productionDay: db.production_day,
                rawText: db.raw_text || parsed.rawText,
                pdfUri: undefined,
                uploadedAt: new Date(db.created_at),
                scenes: parsed.scenes || [],
              };
            });
            for (const cs of callSheets) {
              useCallSheetStore.setState((state) => ({
                callSheets: [...state.callSheets, cs].sort(
                  (a, b) => a.productionDay - b.productionDay
                ),
              }));
            }
            const latest = callSheets[callSheets.length - 1];
            if (latest) csStore.setActiveCallSheet(latest.id);

            for (const db of callSheetData) {
              if (db.storage_path) {
                supabaseStorage.downloadDocumentAsDataUri(db.storage_path).then(({ dataUri }) => {
                  if (!dataUri) return;
                  useCallSheetStore.setState((state) => ({
                    callSheets: state.callSheets.map((cs) =>
                      cs.id === db.id ? { ...cs, pdfUri: dataUri } : cs
                    ),
                  }));
                });
              }
            }
          }

          if (scriptData.length > 0 && scriptData[0].storage_path) {
            supabaseStorage.downloadDocumentAsDataUri(scriptData[0].storage_path).then(({ dataUri }) => {
              if (!dataUri) return;
              useProjectStore.getState().setScriptPdf(dataUri);
            });
          }

          pStore.setActiveTab('today');

          set({
            isLoading: false,
            projectMemberships: [...projectMemberships, newMembership],
          });

          return { success: true, projectName: joinedProject.name };
        } catch (error) {
          console.error('Join project error:', error);
          set({ isLoading: false, error: 'Failed to join project. Please try again.' });
          return { success: false, error: 'Failed to join project' };
        }
      },

      // Create a new project with the owner's selected role
      createProject: async (name, type, ownerRole) => {
        const { user, projectMemberships } = get();

        const tierLimits = user ? TIER_LIMITS[user.tier] : null;
        if (!user || (!BETA_MODE && !tierLimits?.canCreateProjects)) {
          set({ error: 'Your account tier does not allow creating projects' });
          return { success: false, error: 'Insufficient permissions' };
        }

        set({ isLoading: true, error: null });

        try {
          const { project, inviteCode, error } = await supabaseProjects.createProject(
            name,
            type,
            user.id,
            (ownerRole || 'designer') as any
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
        if (BETA_MODE) return true;
        const { user } = get();
        if (!user) return false;
        const limits = TIER_LIMITS[user.tier];
        if (!limits) return false;
        return limits.canCreateProjects;
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

      // Delete a project (owner only)
      // Initiates a soft-delete with a 48-hour grace period for synced members
      deleteProject: async (projectId) => {
        const { user, projectMemberships } = get();

        if (!user) {
          return { success: false, error: 'Not authenticated' };
        }

        set({ isLoading: true, error: null });

        try {
          // Check if this is a local-only project (ID starts with 'project-')
          const isLocalProject = projectId.startsWith('project-');

          if (!isLocalProject) {
            // Soft-delete in Supabase (sets pending_deletion_at)
            const { error } = await supabaseProjects.deleteProject(projectId, user.id);
            if (error) {
              set({ isLoading: false, error: error.message });
              return { success: false, error: error.message };
            }
          }

          // Remove from owner's local state immediately
          const updatedMemberships = projectMemberships.filter(
            (pm) => pm.projectId !== projectId
          );

          set({
            isLoading: false,
            projectMemberships: updatedMemberships,
            error: null,
          });

          return { success: true };
        } catch (error) {
          console.error('Delete project error:', error);
          set({ isLoading: false, error: 'Failed to delete project. Please try again.' });
          return { success: false, error: 'Failed to delete project' };
        }
      },

      // Leave a project (for non-owners)
      leaveProject: async (projectId) => {
        const { user, projectMemberships } = get();

        if (!user) {
          return { success: false, error: 'Not authenticated' };
        }

        set({ isLoading: true, error: null });

        try {
          // Check if this is a local-only project
          const isLocalProject = projectId.startsWith('project-');

          if (!isLocalProject) {
            // Leave project in Supabase
            const { error } = await supabaseProjects.leaveProject(projectId, user.id);
            if (error) {
              set({ isLoading: false, error: error.message });
              return { success: false, error: error.message };
            }
          }

          // Remove from local state
          const updatedMemberships = projectMemberships.filter(
            (pm) => pm.projectId !== projectId
          );

          set({
            isLoading: false,
            projectMemberships: updatedMemberships,
            error: null,
          });

          return { success: true };
        } catch (error) {
          console.error('Leave project error:', error);
          set({ isLoading: false, error: 'Failed to leave project. Please try again.' });
          return { success: false, error: 'Failed to leave project' };
        }
      },

      setPinnedProject: (projectId) => {
        set({ pinnedProjectId: projectId });
      },

      setSettingsProjectId: (projectId) => {
        set({ settingsProjectId: projectId });
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
        pinnedProjectId: state.pinnedProjectId,
        guestProjectCode: state.guestProjectCode,
      }),
    }
  )
);

// Set up auth state listener only if Supabase is configured
if (isSupabaseConfigured) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      // Skip if signIn()/signUp() is already handling auth state
      // to prevent a race condition where both set projectMemberships
      if (_manualAuthInProgress) return;
      useAuthStore.getState().initializeAuth();
    } else if (event === 'TOKEN_REFRESHED' && session?.user) {
      // Token refreshed - ensure state is still valid
      const state = useAuthStore.getState();
      if (!state.isAuthenticated) {
        useAuthStore.getState().initializeAuth();
      }
    } else if (event === 'USER_UPDATED' && session?.user) {
      // User profile updated (e.g., email change, password reset)
      useAuthStore.getState().initializeAuth();
    } else if (event === 'SIGNED_OUT') {
      // Only clear auth state — local store cleanup is handled in signOut()
      useAuthStore.setState({
        isAuthenticated: false,
        user: null,
        projectMemberships: [],
        currentScreen: 'welcome',
        screenHistory: [],
        hasCompletedOnboarding: false,
        hasSelectedPlan: false,
        subscription: createDefaultSubscription(),
        guestProjectCode: null,
        pinnedProjectId: null,
      });
    }
  });
}
