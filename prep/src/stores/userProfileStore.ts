import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type RateCard, createDefaultRateCard } from '@/stores/timesheetStore';

export type CrewType = 'paye' | 'ltd';

export interface UserProfile {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  crewType: CrewType;
  niNumber: string;
  companyName: string;
  companyNumber: string;
  vatRegistered: boolean;
  vatNumber: string;
  bankName: string;
  accountName: string;
  sortCode: string;
  accountNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  rateCard: RateCard;
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
    rateCard: createDefaultRateCard(),
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
  ensureProfile: (userId: string, fullName?: string, email?: string) => UserProfile;
  getProfile: (userId: string) => UserProfile | undefined;
  updateProfile: (userId: string, updates: Partial<UserProfile>) => void;
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

      clearProfile: (userId) =>
        set((s) => {
          const next = { ...s.profiles };
          delete next[userId];
          return { profiles: next };
        }),
    }),
    {
      name: 'prep-user-profiles',
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        if (version >= 2) return persisted;
        const s = persisted as { profiles?: Record<string, { rateCard?: Record<string, unknown> }> };
        for (const p of Object.values(s?.profiles ?? {})) {
          const rc = p.rateCard;
          if (!rc) continue;
          const legacy = typeof rc.dailyRate === 'number' ? rc.dailyRate : undefined;
          if (legacy != null) {
            if (rc.shootRate == null) rc.shootRate = legacy;
            if (rc.prepRate == null) rc.prepRate = legacy;
            delete rc.dailyRate;
          }
        }
        return s;
      },
    },
  ),
);
