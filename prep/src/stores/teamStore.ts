import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ── Types ── */

export type TeamRole =
  | 'designer'
  | 'supervisor'
  | 'key'
  | 'hair'
  | 'makeup'
  | 'sfx'
  | 'daily'
  | 'trainee';

export const TEAM_ROLES: { value: TeamRole; label: string; level: number }[] = [
  { value: 'designer', label: 'Designer (HoD)', level: 8 },
  { value: 'supervisor', label: 'Supervisor', level: 7 },
  { value: 'key', label: 'Key Artist', level: 6 },
  { value: 'hair', label: 'Hair Artist', level: 5 },
  { value: 'makeup', label: 'Makeup Artist', level: 4 },
  { value: 'sfx', label: 'SFX Artist', level: 3 },
  { value: 'daily', label: 'Daily', level: 2 },
  { value: 'trainee', label: 'Trainee', level: 1 },
];

export type PermissionLevel = 'all' | 'key_plus' | 'supervisor_plus' | 'owner_only';

export const PERMISSION_LEVELS: { value: PermissionLevel; label: string }[] = [
  { value: 'all', label: 'All team members' },
  { value: 'key_plus', label: 'Key artists and above' },
  { value: 'supervisor_plus', label: 'Supervisors and above' },
  { value: 'owner_only', label: 'Owner only' },
];

export interface ProjectPermissions {
  editScript: PermissionLevel;
  editBreakdown: PermissionLevel;
  editCharacterDesign: PermissionLevel;
  editContinuity: PermissionLevel;
  editBudget: PermissionLevel;
  editTimesheet: PermissionLevel;
  editSchedule: PermissionLevel;
  viewBudget: PermissionLevel;
  manageTeam: PermissionLevel;
}

export const DEFAULT_PERMISSIONS: ProjectPermissions = {
  editScript: 'supervisor_plus',
  editBreakdown: 'key_plus',
  editCharacterDesign: 'all',
  editContinuity: 'all',
  editBudget: 'supervisor_plus',
  editTimesheet: 'key_plus',
  editSchedule: 'supervisor_plus',
  viewBudget: 'key_plus',
  manageTeam: 'supervisor_plus',
};

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  isOwner: boolean;
  joinedAt: string;
  lastActiveAt: string;
  avatarColor: number;
}

/* ── Code generation (ABC-1234, no ambiguous chars) ── */
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < 3; i++) code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  code += '-';
  for (let i = 0; i < 4; i++) code += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
  return code;
}

/* ── Permission check ── */
export function hasPermission(role: TeamRole, isOwner: boolean, required: PermissionLevel): boolean {
  if (isOwner) return true;
  const level = TEAM_ROLES.find((r) => r.value === role)?.level ?? 0;
  switch (required) {
    case 'all': return true;
    case 'key_plus': return level >= 6;
    case 'supervisor_plus': return level >= 7;
    case 'owner_only': return false;
  }
}

export function getRoleLevel(role: TeamRole): number {
  return TEAM_ROLES.find((r) => r.value === role)?.level ?? 0;
}

/* ── Store ── */

interface TeamState {
  inviteCode: string;
  members: TeamMember[];
  permissions: ProjectPermissions;

  addMember: (member: Omit<TeamMember, 'id' | 'joinedAt' | 'lastActiveAt' | 'avatarColor'>) => void;
  removeMember: (id: string) => void;
  updateRole: (id: string, role: TeamRole) => void;
  updatePermissions: (perms: Partial<ProjectPermissions>) => void;
  regenerateCode: () => string;
}

const storeCache = new Map<string, ReturnType<typeof createStore>>();

function createStore(projectId: string) {
  return create<TeamState>()(
    persist(
      (set, get) => ({
        inviteCode: generateInviteCode(),
        members: [],
        permissions: { ...DEFAULT_PERMISSIONS },

        addMember: (member) => {
          const existing = get().members;
          if (existing.find((m) => m.email === member.email)) return;
          set({
            members: [
              ...existing,
              {
                ...member,
                id: crypto.randomUUID(),
                joinedAt: new Date().toISOString(),
                lastActiveAt: new Date().toISOString(),
                avatarColor: existing.length % 5,
              },
            ],
          });
        },

        removeMember: (id) =>
          set((s) => ({ members: s.members.filter((m) => m.id !== id) })),

        updateRole: (id, role) =>
          set((s) => ({
            members: s.members.map((m) => (m.id === id ? { ...m, role } : m)),
          })),

        updatePermissions: (perms) =>
          set((s) => ({ permissions: { ...s.permissions, ...perms } })),

        regenerateCode: () => {
          const code = generateInviteCode();
          set({ inviteCode: code });
          return code;
        },
      }),
      { name: `prep-team-${projectId}` },
    ),
  );
}

export function useTeamStore(projectId: string) {
  if (!storeCache.has(projectId)) {
    storeCache.set(projectId, createStore(projectId));
  }
  return storeCache.get(projectId)!;
}
