import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';

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
  id: string;          // local fallback ID
  membershipId: string; // project_members PK (for Supabase updates)
  name: string;
  email: string;
  role: TeamRole;
  isOwner: boolean;
  joinedAt: string;
  lastActiveAt: string;
  avatarColor: number;
  // Per-member access toggles
  accessBreakdown: boolean;
  accessScript: boolean;
  accessLookbook: boolean;
  accessCallsheets: boolean;
  accessChat: boolean;
  accessContinuity: boolean;
  accessHours: boolean;
  accessReceipts: boolean;
  accessBudget: boolean;
  accessExportHours: boolean;
  accessExportInvoice: boolean;
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

/* ── Column map for access toggle Supabase writes ── */
const ACCESS_COLUMN_MAP: Record<string, string> = {
  accessBreakdown: 'access_breakdown',
  accessScript: 'access_script',
  accessLookbook: 'access_lookbook',
  accessCallsheets: 'access_callsheets',
  accessChat: 'access_chat',
  accessContinuity: 'access_continuity',
  accessHours: 'access_hours',
  accessReceipts: 'access_receipts',
  accessBudget: 'access_budget',
  accessExportHours: 'access_export_hours',
  accessExportInvoice: 'access_export_invoice',
};

/* ── Store ── */

interface TeamState {
  inviteCode: string;
  members: TeamMember[];
  permissions: ProjectPermissions;
  isLoading: boolean;

  addMember: (member: Omit<TeamMember, 'id' | 'membershipId' | 'joinedAt' | 'lastActiveAt' | 'avatarColor' | 'accessBreakdown' | 'accessScript' | 'accessLookbook' | 'accessCallsheets' | 'accessChat' | 'accessContinuity' | 'accessHours' | 'accessReceipts' | 'accessBudget' | 'accessExportHours' | 'accessExportInvoice'>) => void;
  removeMember: (id: string) => void;
  updateRole: (id: string, role: TeamRole) => void;
  updatePermissions: (perms: Partial<ProjectPermissions>) => void;
  regenerateCode: () => string;
  loadFromSupabase: (projectId: string) => Promise<void>;
  updateMemberAccess: (membershipId: string, field: string, value: boolean) => Promise<void>;
  removeMemberFromSupabase: (membershipId: string, projectId: string) => Promise<void>;
}

const storeCache = new Map<string, ReturnType<typeof createStore>>();

function createStore(projectId: string) {
  return create<TeamState>()(
    persist(
      (set, get) => ({
        inviteCode: generateInviteCode(),
        members: [],
        permissions: { ...DEFAULT_PERMISSIONS },
        isLoading: false,

        addMember: (member) => {
          const existing = get().members;
          if (existing.find((m) => m.email === member.email)) return;
          set({
            members: [
              ...existing,
              {
                ...member,
                id: crypto.randomUUID(),
                membershipId: '',
                joinedAt: new Date().toISOString(),
                lastActiveAt: new Date().toISOString(),
                avatarColor: existing.length % 5,
                accessBreakdown: true, accessScript: true, accessLookbook: true,
                accessCallsheets: true, accessChat: true, accessContinuity: true,
                accessHours: true, accessReceipts: true, accessBudget: false,
                accessExportHours: true, accessExportInvoice: true,
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

        loadFromSupabase: async (pid: string) => {
          set({ isLoading: true });
          try {
            const { data, error } = await supabase
              .from('project_members')
              .select('*, users (name, email)')
              .eq('project_id', pid)
              .order('joined_at');

            if (error) throw error;
            if (!data || data.length === 0) {
              set({ isLoading: false });
              return;
            }

            const members: TeamMember[] = data.map((pm: any, idx: number) => ({
              id: pm.user_id,
              membershipId: pm.id,
              name: pm.users?.name || pm.user_id.slice(0, 8),
              email: pm.users?.email || '',
              role: (pm.role as TeamRole) || 'trainee',
              isOwner: pm.is_owner,
              joinedAt: pm.joined_at,
              lastActiveAt: new Date().toISOString(),
              avatarColor: idx % 5,
              accessBreakdown: pm.access_breakdown ?? true,
              accessScript: pm.access_script ?? true,
              accessLookbook: pm.access_lookbook ?? true,
              accessCallsheets: pm.access_callsheets ?? true,
              accessChat: pm.access_chat ?? true,
              accessContinuity: pm.access_continuity ?? true,
              accessHours: pm.access_hours ?? true,
              accessReceipts: pm.access_receipts ?? true,
              accessBudget: pm.access_budget ?? false,
              accessExportHours: pm.access_export_hours ?? true,
              accessExportInvoice: pm.access_export_invoice ?? true,
            }));

            // Also read invite code from the project
            const { data: proj } = await supabase
              .from('projects')
              .select('invite_code')
              .eq('id', pid)
              .single();

            set({
              members,
              isLoading: false,
              inviteCode: proj?.invite_code || get().inviteCode,
            });
          } catch (err) {
            console.error('[TeamStore] Failed to load from Supabase:', err);
            set({ isLoading: false });
          }
        },

        updateMemberAccess: async (membershipId, field, value) => {
          const column = ACCESS_COLUMN_MAP[field];
          if (!column) return;

          // Optimistic update
          set((s) => ({
            members: s.members.map((m) =>
              m.membershipId === membershipId ? { ...m, [field]: value } : m
            ),
          }));

          const { error } = await supabase
            .from('project_members')
            .update({ [column]: value })
            .eq('id', membershipId);

          if (error) {
            // Roll back
            set((s) => ({
              members: s.members.map((m) =>
                m.membershipId === membershipId ? { ...m, [field]: !value } : m
              ),
            }));
          }
        },

        removeMemberFromSupabase: async (membershipId, pid) => {
          const { error } = await supabase
            .from('project_members')
            .delete()
            .eq('id', membershipId)
            .eq('project_id', pid);

          if (!error) {
            set((s) => ({
              members: s.members.filter((m) => m.membershipId !== membershipId),
            }));
          }
        },
      }),
      {
        name: `prep-team-${projectId}`,
        partialize: (state) => ({
          inviteCode: state.inviteCode,
          permissions: state.permissions,
        }),
      },
    ),
  );
}

export function useTeamStore(projectId: string) {
  if (!storeCache.has(projectId)) {
    storeCache.set(projectId, createStore(projectId));
  }
  return storeCache.get(projectId)!;
}
