import { create } from 'zustand';
import type {
  TeamMember,
  TeamMemberRole,
  ProjectSettings,
  ProjectStats,
  ProjectPermissions,
  PermissionLevel,
  ManualShootingDay,
} from '@/types';
import {
  generateProjectCode,
  createDefaultProjectPermissions,
} from '@/types';

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

  // Schedule management
  saveShootingDay: (dayNumber: number, date: Date, sceneIds: string[]) => Promise<void>;

  // Clear state
  clearState: () => void;
}

// Mock delay for API simulation
const mockDelay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Generate mock team members
const generateMockTeamMembers = (projectId: string): TeamMember[] => {
  const names = [
    { name: 'Sarah Chen', role: 'designer' as TeamMemberRole, isOwner: true },
    { name: 'Mike Torres', role: 'supervisor' as TeamMemberRole, isOwner: false },
    { name: 'Emma Wright', role: 'key' as TeamMemberRole, isOwner: false },
    { name: 'David Park', role: 'key' as TeamMemberRole, isOwner: false },
    { name: 'Lucy Hammond', role: 'floor' as TeamMemberRole, isOwner: false },
    { name: 'Alex Rivera', role: 'floor' as TeamMemberRole, isOwner: false },
    { name: 'Jordan Lee', role: 'floor' as TeamMemberRole, isOwner: false },
    { name: 'James Cole', role: 'daily' as TeamMemberRole, isOwner: false },
  ];

  return names.map((member, index) => ({
    userId: `user-${index + 1}`,
    projectId,
    name: member.name,
    email: `${member.name.toLowerCase().replace(' ', '.')}@example.com`,
    role: member.role,
    isOwner: member.isOwner,
    joinedAt: new Date(Date.now() - (30 - index) * 24 * 60 * 60 * 1000),
    lastActiveAt: new Date(Date.now() - index * 60 * 60 * 1000),
    editCount: Math.floor(Math.random() * 500) + 50,
  }));
};

// Generate mock project stats
const generateMockStats = (): ProjectStats => ({
  sceneCount: 142,
  storyDays: 23,
  characterCount: 14,
  completedScenes: 94,
  completionPercentage: 67,
  photoCount: 1247,
  storageUsed: 2.3 * 1024 * 1024 * 1024, // 2.3 GB
  teamMemberCount: 8,
  lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000),
  mostActiveUser: { name: 'Sarah Chen', editCount: 342 },
});

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
    set({ isLoading: true, error: null });

    try {
      await mockDelay(400);

      // Mock project settings
      const settings: ProjectSettings = {
        id: projectId,
        name: 'The Punishing',
        type: 'film',
        status: 'shooting',
        inviteCode: 'TMK-4827',
        ownerId: 'user-1',
        permissions: createDefaultProjectPermissions(),
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        archivedAt: null,
      };

      const stats = generateMockStats();

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
      await mockDelay(500);
      const newCode = generateProjectCode();
      set({
        projectSettings: { ...projectSettings, inviteCode: newCode },
        isLoading: false,
      });
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

  // Load team members
  loadTeamMembers: async (projectId) => {
    set({ isLoading: true, error: null });

    try {
      await mockDelay(400);
      const members = generateMockTeamMembers(projectId);
      set({ teamMembers: members, isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Failed to load team members' });
    }
  },

  // Change team member role
  changeTeamMemberRole: async (userId, newRole) => {
    const { teamMembers } = get();

    set({ isLoading: true });
    try {
      await mockDelay(300);
      const updatedMembers = teamMembers.map((member) =>
        member.userId === userId ? { ...member, role: newRole } : member
      );
      set({ teamMembers: updatedMembers, isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Failed to change role' });
    }
  },

  // Remove team member
  removeTeamMember: async (userId) => {
    const { teamMembers, projectStats } = get();

    set({ isLoading: true });
    try {
      await mockDelay(400);
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
