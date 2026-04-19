import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { useProjectStore } from './projectStore';
import { loadUserProjects, type SupabaseProject } from '@/services/projectService';
import { flushPrepSync } from '@/services/supabaseSync';

export type UserTier = 'daily' | 'artist' | 'supervisor' | 'designer' | 'owner';

export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
  tier: UserTier;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function toAppUser(supabaseUser: SupabaseUser, profileName?: string, profileTier?: string): User {
  const name =
    profileName ||
    supabaseUser.user_metadata?.name ||
    supabaseUser.email?.split('@')[0]?.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ||
    'User';
  const validTiers: UserTier[] = ['daily', 'artist', 'supervisor', 'designer', 'owner'];
  const tier: UserTier = validTiers.includes(profileTier as UserTier)
    ? (profileTier as UserTier)
    : 'daily';
  return {
    id: supabaseUser.id,
    name,
    email: supabaseUser.email || '',
    initials: getInitials(name),
    tier,
  };
}

/** Convert Supabase project rows to the local Project shape. */
function supabaseToLocal(sp: SupabaseProject) {
  return {
    id: sp.id,
    title: sp.name,
    genre: '',
    type: sp.production_type || '',
    department: (sp.department as 'hmu' | 'costume') || 'hmu',
    status: 'setup' as const,
    progress: 0,
    lastActive: sp.created_at,
    scenes: sp.scene_count ?? 0,
    characters: sp.character_count ?? 0,
    scriptFilename: sp.script_filename,
    createdAt: sp.created_at,
  };
}

/** Fetch user's projects from Supabase and merge into the project store. */
async function hydrateProjects(userId: string) {
  const { projects: sbProjects } = await loadUserProjects(userId);
  if (sbProjects.length === 0) return;

  const store = useProjectStore.getState();
  const existingIds = new Set(store.projects.map((p) => p.id));

  // Merge: keep any local projects that already exist, add new ones from Supabase
  const newProjects = sbProjects
    .filter((sp) => !existingIds.has(sp.id))
    .map(supabaseToLocal);

  if (newProjects.length > 0) {
    useProjectStore.setState({
      projects: [...store.projects, ...newProjects],
    });
  }

  // Update existing projects with Supabase data (restores metadata after re-login)
  const existingFromSupa = sbProjects.filter((sp) => existingIds.has(sp.id));
  for (const sp of existingFromSupa) {
    const local = store.projects.find((p) => p.id === sp.id);
    if (!local) continue;
    useProjectStore.getState().updateProject(sp.id, {
      title: sp.name,
      type: sp.production_type || local.type,
      scenes: sp.scene_count ?? local.scenes,
      characters: sp.character_count ?? local.characters,
      scriptFilename: sp.script_filename ?? local.scriptFilename,
    });
  }
}

interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getSession: () => Promise<void>;

  // Legacy aliases used by existing components
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;

  // Tier preview mode (owner only, local state only, not persisted)
  previewTier: UserTier | null;
  setPreviewTier: (tier: UserTier | null) => void;
  getEffectiveTier: () => UserTier;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  session: null,
  previewTier: null,
  setPreviewTier: (tier) => set({ previewTier: tier }),
  getEffectiveTier: () => {
    const { user, previewTier } = get();
    if (previewTier && user?.tier === 'owner') return previewTier;
    return user?.tier ?? 'daily';
  },
  isAuthenticated: false,
  isLoading: true, // Start true — getSession will resolve on init
  error: null,

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
    // Fetch profile from users table
    let profileName: string | undefined;
    let profileTier: string | undefined;
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('name, tier')
        .eq('id', data.user.id)
        .single();
      if (profile?.name) profileName = profile.name;
      if (profile?.tier) profileTier = profile.tier as string;
    } catch { /* use metadata fallback */ }

    set({
      user: toAppUser(data.user, profileName, profileTier),
      session: data.session,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    // Load user's projects from Supabase
    hydrateProjects(data.user.id).catch(console.error);
  },

  signOut: async () => {
    // CRITICAL: Flush all pending Supabase saves BEFORE destroying the session.
    // The 800ms debounce means recent edits may still be queued — if we sign out
    // first, those writes fail silently and data is lost on other devices.
    try {
      await flushPrepSync();
    } catch (e) {
      console.error('[Auth] Failed to flush pending saves before sign-out:', e);
    }

    await supabase.auth.signOut();
    // Clear all project data from memory and localStorage
    useProjectStore.getState().selectProject(null);
    useProjectStore.setState({ projects: [], selectedProjectId: null });
    // Clear all prep-related localStorage keys
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('prep-')) {
        localStorage.removeItem(key);
      }
    });
    set({ user: null, session: null, isAuthenticated: false });
  },

  getSession: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      // Fetch profile
      let profileName: string | undefined;
      let profileTier: string | undefined;
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('name, tier')
          .eq('id', data.session.user.id)
          .single();
        if (profile?.name) profileName = profile.name;
        if (profile?.tier) profileTier = profile.tier as string;
      } catch { /* use metadata fallback */ }

      set({
        session: data.session,
        user: toAppUser(data.session.user, profileName, profileTier),
        isAuthenticated: true,
        isLoading: false,
      });

      // Load user's projects from Supabase
      hydrateProjects(data.session.user.id).catch(console.error);
    } else {
      set({
        session: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  // Legacy aliases — existing components call these
  login: async (email, password) => {
    try {
      await get().signIn(email, password);
      return true;
    } catch {
      return false;
    }
  },

  signup: async (name, email, password) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) {
      set({ isLoading: false, error: error.message });
      return false;
    }
    if (!data.user) {
      set({ isLoading: false, error: 'Sign up failed. Please try again.' });
      return false;
    }

    // Write beta access for new signups (same as mobile flow)
    let signupTier: string = 'designer';
    try {
      await supabase
        .from('users')
        .update({
          beta_access: true,
          beta_granted_at: new Date().toISOString(),
          tier: 'designer',
        })
        .eq('id', data.user.id);
    } catch (betaErr) {
      console.error('Failed to write beta_access:', betaErr);
    }

    // Fetch the tier back from DB to ensure local state matches
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('tier')
        .eq('id', data.user.id)
        .single();
      if (profile?.tier) signupTier = profile.tier as string;
    } catch { /* use the written value */ }

    set({
      user: toAppUser(data.user, name, signupTier),
      session: data.session,
      isAuthenticated: !!data.session,
      isLoading: false,
      error: null,
    });
    return true;
  },

  logout: async () => {
    await get().signOut();
  },
}));

// Listen for auth state changes (token refresh, sign out from another tab)
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    const current = useAuthStore.getState();
    // Only update session/auth state — avoid overwriting a richer user profile
    if (current.user?.id === session.user.id) {
      useAuthStore.setState({ session, isAuthenticated: true });
    } else {
      // New user session — fetch tier from DB so the Prep gate works correctly
      const userId = session.user.id;
      const userName = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User';
      (async () => {
        try {
          const { data: profile } = await supabase
            .from('users')
            .select('name, tier')
            .eq('id', userId)
            .single();
          useAuthStore.setState({
            session,
            user: toAppUser(
              session.user,
              profile?.name || userName,
              (profile?.tier as string) || undefined,
            ),
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          // Fallback without tier — user will get 'daily' default
          useAuthStore.setState({
            session,
            user: toAppUser(session.user, userName),
            isAuthenticated: true,
            isLoading: false,
          });
        }
      })();
    }
  } else {
    useAuthStore.setState({
      session: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }
});
