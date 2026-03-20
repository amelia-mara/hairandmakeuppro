import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { useProjectStore } from './projectStore';

export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function toAppUser(supabaseUser: SupabaseUser, profileName?: string): User {
  const name =
    profileName ||
    supabaseUser.user_metadata?.name ||
    supabaseUser.email?.split('@')[0]?.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ||
    'User';
  return {
    id: supabaseUser.id,
    name,
    email: supabaseUser.email || '',
    initials: getInitials(name),
  };
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
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  session: null,
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
    // Fetch profile name from users table
    let profileName: string | undefined;
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('name')
        .eq('id', data.user.id)
        .single();
      if (profile?.name) profileName = profile.name;
    } catch { /* use metadata fallback */ }

    set({
      user: toAppUser(data.user, profileName),
      session: data.session,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  },

  signOut: async () => {
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
      // Fetch profile name
      let profileName: string | undefined;
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('name')
          .eq('id', data.session.user.id)
          .single();
        if (profile?.name) profileName = profile.name;
      } catch { /* use metadata fallback */ }

      set({
        session: data.session,
        user: toAppUser(data.session.user, profileName),
        isAuthenticated: true,
        isLoading: false,
      });
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

    set({
      user: toAppUser(data.user, name),
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
      useAuthStore.setState({
        session,
        user: {
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          initials: getInitials(session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'U'),
        },
        isAuthenticated: true,
        isLoading: false,
      });
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
