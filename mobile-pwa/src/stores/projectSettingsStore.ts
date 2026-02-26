import { create } from 'zustand';
import type {
  TeamMember,
  TeamMemberRole,
  ProjectSettings,
  ProjectStats,
  ProjectPermissions,
  PermissionLevel,
  ManualShootingDay,
  Project,
  SceneCapture,
} from '@/types';
import {
  generateProjectCode,
  createDefaultProjectPermissions,
} from '@/types';
import { useAuthStore } from './authStore';
import { useProjectStore } from './projectStore';
import * as supabaseProjects from '@/services/supabaseProjects';

interface ProjectSettingsState {
  // Project settings
  projectSettings: ProjectSettings | null;
  teamMembers: TeamMember[];
  projectStats: ProjectStats | null;
  shootingDays: ManualShootingDay[];

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  loadProjectSettings: (projectId: string) => Promise<void>;
  updateProjectName: (name: string) => Promise<void>;
  updateProjectType: (type: string) => Promise<void>;
  updateProjectStatus: (status: 'prep' | 'shooting' | 'wrapped') => Promise<void>;
  updatePermission: (key: keyof ProjectPermissions, value: PermissionLevel) => Promise<void>;
  regenerateInviteCode: () => Promise<string>;
  archiveProject: () => Promise<void>;
  deleteProject: () => Promise<void>;

  // Team management
  loadTeamMembers: (projectId: string) => Promise<void>;
  changeTeamMemberRole: (userId: string, newRole: TeamMemberRole) => Promise<void>;
  removeTeamMember: (userId: string) => Promise<void>;

  // Stats
  refreshProjectStats: (projectId: string) => void;

  // Schedule management
  saveShootingDay: (dayNumber: number, date: Date, sceneIds: string[]) => Promise<void>;

  // Clear state
  clearState: () => void;
}

// Mock delay for API simulation
const mockDelay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Build team members from the current authenticated user
const getTeamFromCurrentUser = (projectId: string): TeamMember[] => {
  const { user } = useAuthStore.getState();
  if (!user) return [];

  return [{
    userId: user.id,
    projectId,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: 'designer' as TeamMemberRole,
    isOwner: true,
    joinedAt: user.createdAt,
    lastActiveAt: new Date(),
    editCount: 0,
  }];
};

// Compute real project stats from actual project data
const computeProjectStats = (
  project: Project | null,
  sceneCaptures: Record<string, SceneCapture>,
  teamMemberCount: number
): ProjectStats => {
  if (!project) {
    return {
      sceneCount: 0,
      storyDays: 0,
      characterCount: 0,
      completedScenes: 0,
      completionPercentage: 0,
      photoCount: 0,
      storageUsed: 0,
      teamMemberCount,
      lastActivity: null,
      mostActiveUser: null,
    };
  }

  const sceneCount = project.scenes.length;
  const characterCount = project.characters.length;
  const completedScenes = project.scenes.filter(s => s.isComplete).length;
  const completionPercentage = sceneCount > 0 ? Math.round((completedScenes / sceneCount) * 100) : 0;

  // Count unique shooting days from scenes that have one assigned
  const uniqueShootingDays = new Set(
    project.scenes.filter(s => s.shootingDay != null).map(s => s.shootingDay)
  );
  const storyDays = uniqueShootingDays.size;

  // Count all photos across scene captures and looks
  let photoCount = 0;
  for (const capture of Object.values(sceneCaptures)) {
    // Standard 4-angle photos
    if (capture.photos.front) photoCount++;
    if (capture.photos.left) photoCount++;
    if (capture.photos.right) photoCount++;
    if (capture.photos.back) photoCount++;
    // Additional photos
    photoCount += capture.additionalPhotos.length;
    // SFX reference photos
    if (capture.sfxDetails?.sfxReferencePhotos) {
      photoCount += capture.sfxDetails.sfxReferencePhotos.length;
    }
  }
  // Look master reference photos
  for (const look of project.looks) {
    if (look.masterReference) photoCount++;
  }

  // Estimate storage (~500KB average per photo)
  const storageUsed = photoCount * 500 * 1024;

  // Find most recent capture as last activity
  let lastActivity: Date | null = null;
  for (const capture of Object.values(sceneCaptures)) {
    const capturedAt = new Date(capture.capturedAt);
    if (!lastActivity || capturedAt > lastActivity) {
      lastActivity = capturedAt;
    }
  }

  // Most active user — current user with their capture count
  const { user } = useAuthStore.getState();
  const captureCount = Object.keys(sceneCaptures).length;
  const mostActiveUser = user && captureCount > 0
    ? { name: user.name, editCount: captureCount }
    : null;

  return {
    sceneCount,
    storyDays,
    characterCount,
    completedScenes,
    completionPercentage,
    photoCount,
    storageUsed,
    teamMemberCount,
    lastActivity,
    mostActiveUser,
  };
};

export const useProjectSettingsStore = create<ProjectSettingsState>((set, get) => ({
  // Initial state
  projectSettings: null,
  teamMembers: [],
  projectStats: null,
  shootingDays: [],
  isLoading: false,
  error: null,

  // Load project settings
  loadProjectSettings: async (projectId) => {
    // If settings already loaded for this project, just refresh the invite code
    const existing = get().projectSettings;
    if (existing && existing.id === projectId) {
      const { projectMemberships } = useAuthStore.getState();
      const membership = projectMemberships.find(pm => pm.projectId === projectId);
      if (membership?.projectCode && membership.projectCode !== existing.inviteCode) {
        set({ projectSettings: { ...existing, inviteCode: membership.projectCode } });
      }
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const { user, projectMemberships } = useAuthStore.getState();
      const { currentProject, sceneCaptures } = useProjectStore.getState();
      const teamMembers = getTeamFromCurrentUser(projectId);

      // Use the real invite code from the project membership (stored from DB)
      const membership = projectMemberships.find(pm => pm.projectId === projectId);
      const inviteCode = membership?.projectCode || generateProjectCode();

      const settings: ProjectSettings = {
        id: projectId,
        name: currentProject?.name || membership?.projectName || projectId,
        type: (membership?.productionType as ProjectSettings['type']) || 'film',
        status: 'shooting',
        inviteCode,
        ownerId: user?.id || '',
        permissions: createDefaultProjectPermissions(),
        createdAt: currentProject?.createdAt || new Date(),
        archivedAt: null,
      };

      const stats = computeProjectStats(currentProject, sceneCaptures, teamMembers.length);

      set({
        projectSettings: settings,
        projectStats: stats,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false, error: 'Failed to load project settings' });
    }
  },

  // Update project name
  updateProjectName: async (name) => {
    const { projectSettings } = get();
    if (!projectSettings) return;

    set({ isLoading: true });
    try {
      await mockDelay(300);
      set({
        projectSettings: { ...projectSettings, name },
        isLoading: false,
      });
    } catch {
      set({ isLoading: false, error: 'Failed to update project name' });
    }
  },

  // Update project type
  updateProjectType: async (type) => {
    const { projectSettings } = get();
    if (!projectSettings) return;

    set({ isLoading: true });
    try {
      await mockDelay(300);
      set({
        projectSettings: { ...projectSettings, type: type as ProjectSettings['type'] },
        isLoading: false,
      });
    } catch {
      set({ isLoading: false, error: 'Failed to update project type' });
    }
  },

  // Update project status
  updateProjectStatus: async (status) => {
    const { projectSettings } = get();
    if (!projectSettings) return;

    set({ isLoading: true });
    try {
      await mockDelay(300);
      set({
        projectSettings: { ...projectSettings, status },
        isLoading: false,
      });
    } catch {
      set({ isLoading: false, error: 'Failed to update project status' });
    }
  },

  // Update permission
  updatePermission: async (key, value) => {
    const { projectSettings } = get();
    if (!projectSettings) return;

    set({ isLoading: true });
    try {
      await mockDelay(300);
      set({
        projectSettings: {
          ...projectSettings,
          permissions: { ...projectSettings.permissions, [key]: value },
        },
        isLoading: false,
      });
    } catch {
      set({ isLoading: false, error: 'Failed to update permission' });
    }
  },

  // Regenerate invite code
  regenerateInviteCode: async () => {
    const { projectSettings } = get();
    if (!projectSettings) throw new Error('No project loaded');

    set({ isLoading: true });
    try {
      // Call Supabase to regenerate the code in the database
      const { inviteCode: newCode, error } = await supabaseProjects.regenerateInviteCode(projectSettings.id);

      if (error || !newCode) {
        throw error || new Error('Failed to regenerate invite code');
      }

      // Update local settings state
      set({
        projectSettings: { ...projectSettings, inviteCode: newCode },
        isLoading: false,
      });

      // Also update the authStore membership so the code stays in sync
      const authStore = useAuthStore.getState();
      const updatedMemberships = authStore.projectMemberships.map(pm =>
        pm.projectId === projectSettings.id
          ? { ...pm, projectCode: newCode }
          : pm
      );
      useAuthStore.setState({ projectMemberships: updatedMemberships });

      return newCode;
    } catch {
      set({ isLoading: false, error: 'Failed to regenerate invite code' });
      throw new Error('Failed to regenerate invite code');
    }
  },

  // Archive project
  archiveProject: async () => {
    const { projectSettings } = get();
    if (!projectSettings) return;

    set({ isLoading: true });
    try {
      await mockDelay(500);
      set({
        projectSettings: {
          ...projectSettings,
          status: 'archived',
          archivedAt: new Date(),
        },
        isLoading: false,
      });
    } catch {
      set({ isLoading: false, error: 'Failed to archive project' });
      throw new Error('Failed to archive project');
    }
  },

  // Delete project
  deleteProject: async () => {
    set({ isLoading: true });
    try {
      await mockDelay(800);
      set({
        projectSettings: null,
        teamMembers: [],
        projectStats: null,
        shootingDays: [],
        isLoading: false,
      });
    } catch {
      set({ isLoading: false, error: 'Failed to delete project' });
      throw new Error('Failed to delete project');
    }
  },

  // Load team members from Supabase (falls back to current user if fetch fails)
  loadTeamMembers: async (projectId) => {
    set({ isLoading: true, error: null });

    try {
      const { members, error } = await supabaseProjects.getProjectMembers(projectId);

      if (!error && members.length > 0) {
        const teamMembers: TeamMember[] = members.map((m) => ({
          userId: m.user_id,
          projectId: m.project_id,
          name: m.user?.name || 'Unknown',
          email: m.user?.email || '',
          role: m.role as TeamMemberRole,
          isOwner: m.is_owner,
          joinedAt: new Date(m.joined_at),
          lastActiveAt: new Date(),
          editCount: 0,
        }));
        set({ teamMembers, isLoading: false });
      } else {
        // Fallback to current user only
        const fallback = getTeamFromCurrentUser(projectId);
        set({ teamMembers: fallback, isLoading: false });
      }
    } catch {
      const fallback = getTeamFromCurrentUser(projectId);
      set({ teamMembers: fallback, isLoading: false, error: 'Failed to load team members' });
    }
  },

  // Change team member role (persisted to Supabase)
  changeTeamMemberRole: async (userId, newRole) => {
    const { teamMembers, projectSettings } = get();
    if (!projectSettings) return;

    set({ isLoading: true });
    try {
      const { error } = await supabaseProjects.updateMemberRole(
        projectSettings.id,
        userId,
        newRole as any
      );
      if (error) throw error;

      const updatedMembers = teamMembers.map((member) =>
        member.userId === userId ? { ...member, role: newRole } : member
      );
      set({ teamMembers: updatedMembers, isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Failed to change role' });
    }
  },

  // Remove team member (persisted to Supabase — immediate removal, no grace period)
  removeTeamMember: async (userId) => {
    const { teamMembers, projectStats, projectSettings } = get();
    if (!projectSettings) return;

    set({ isLoading: true });
    try {
      const { error } = await supabaseProjects.removeMember(
        projectSettings.id,
        userId
      );
      if (error) throw error;

      const updatedMembers = teamMembers.filter((member) => member.userId !== userId);
      set({
        teamMembers: updatedMembers,
        projectStats: projectStats
          ? { ...projectStats, teamMemberCount: updatedMembers.length }
          : null,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false, error: 'Failed to remove team member' });
    }
  },

  // Refresh project stats from live project data
  refreshProjectStats: (projectId: string) => {
    const { currentProject, sceneCaptures } = useProjectStore.getState();
    const teamMembers = getTeamFromCurrentUser(projectId);
    const stats = computeProjectStats(currentProject, sceneCaptures, teamMembers.length);
    set({ projectStats: stats });
  },

  // Save shooting day
  saveShootingDay: async (dayNumber, date, sceneIds) => {
    const { shootingDays, projectSettings } = get();
    if (!projectSettings) return;

    set({ isLoading: true });
    try {
      await mockDelay(400);

      const newDay: ManualShootingDay = {
        id: `day-${dayNumber}`,
        projectId: projectSettings.id,
        dayNumber,
        date,
        sceneIds,
        createdBy: 'current-user',
        createdAt: new Date(),
      };

      // Replace or add the day
      const existingIndex = shootingDays.findIndex((d) => d.dayNumber === dayNumber);
      const updatedDays =
        existingIndex >= 0
          ? shootingDays.map((d, i) => (i === existingIndex ? newDay : d))
          : [...shootingDays, newDay];

      set({ shootingDays: updatedDays, isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Failed to save shooting day' });
    }
  },

  // Clear state
  clearState: () => {
    set({
      projectSettings: null,
      teamMembers: [],
      projectStats: null,
      shootingDays: [],
      isLoading: false,
      error: null,
    });
  },
}));
