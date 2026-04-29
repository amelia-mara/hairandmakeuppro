import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// User profile carries the *personal* details that follow you between
// projects: who you are, who to invoice, where money lands. Per-project
// rate-card overrides live on the timesheet's CrewMember entry, NOT here.
//
// Stored locally for now; the same shape will sync to Supabase
// `user_profiles` once that table exists.

export type CrewType = 'paye' | 'ltd';

export interface UserProfile {
  // Identity — used to match the user against project team membership.
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  // Tax / employment status.
  crewType: CrewType;
  // PAYE fields
  niNumber: string;
  // LTD fields
  companyName: string;
  companyNumber: string;
  vatRegistered: boolean;
  vatNumber: string;
  // Bank / invoicing.
  bankName: string;
  accountName: string;
  sortCode: string;
  accountNumber: string;
  // Where invoices come from.
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  // Tracks whether the user dismissed the post-signup nudge so we
  // don't re-prompt them every reload.
  signupNudgeDismissed: boolean;
  updatedAt: string;
}

export const REQUIRED_PROFILE_FIELDS: Array<keyof UserProfile> = [
  'fullName',
  'email',
  'phone',
  'crewType',
  'bankName',
  'accountName',
  'sortCode',
  'accountNumber',
];

export function createEmptyProfile(userId: string, fullName = '', email = ''): UserProfile {
  return {
    userId,
    fullName,
    email,
    phone: '',
    crewType: 'paye',
    niNumber: '',
    companyName: '',
    companyNumber: '',
    vatRegistered: false,
    vatNumber: '',
    bankName: '',
    accountName: '',
    sortCode: '',
    accountNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    postcode: '',
    country: '',
    signupNudgeDismissed: false,
    updatedAt: new Date().toISOString(),
  };
}

export function isProfileComplete(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  for (const f of REQUIRED_PROFILE_FIELDS) {
    const v = profile[f];
    if (v == null) return false;
    if (typeof v === 'string' && v.trim() === '') return false;
  }
  // LTD users must have a company name on file.
  if (profile.crewType === 'ltd' && !profile.companyName.trim()) return false;
  return true;
}

interface UserProfileState {
  profiles: Record<string, UserProfile>;
  /**
   * Fetch (or initialise) the profile for a given auth user. Always
   * returns a profile object — never null — so callers don't need to
   * branch on first-run.
   */
  ensureProfile: (userId: string, fullName?: string, email?: string) => UserProfile;
  getProfile: (userId: string) => UserProfile | undefined;
  updateProfile: (userId: string, updates: Partial<UserProfile>) => void;
  dismissSignupNudge: (userId: string) => void;
  clearProfile: (userId: string) => void;
}

export const useUserProfileStore = create<UserProfileState>()(
  persist(
    (set, get) => ({
      profiles: {},

      ensureProfile: (userId, fullName, email) => {
        const existing = get().profiles[userId];
        if (existing) return existing;
        const created = createEmptyProfile(userId, fullName, email);
        set((s) => ({ profiles: { ...s.profiles, [userId]: created } }));
        return created;
      },

      getProfile: (userId) => get().profiles[userId],

      updateProfile: (userId, updates) =>
        set((s) => {
          const existing = s.profiles[userId] ?? createEmptyProfile(userId);
          return {
            profiles: {
              ...s.profiles,
              [userId]: {
                ...existing,
                ...updates,
                userId,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      dismissSignupNudge: (userId) =>
        set((s) => {
          const existing = s.profiles[userId] ?? createEmptyProfile(userId);
          return {
            profiles: {
              ...s.profiles,
              [userId]: { ...existing, signupNudgeDismissed: true, userId },
            },
          };
        }),

      clearProfile: (userId) =>
        set((s) => {
          const next = { ...s.profiles };
          delete next[userId];
          return { profiles: next };
        }),
    }),
    { name: 'prep-user-profiles' },
  ),
);
