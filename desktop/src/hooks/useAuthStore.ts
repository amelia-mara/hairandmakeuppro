import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from '@checks-happy/shared';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => void;
  clearError: () => void;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      isLoading: true,
      error: null,

      initializeAuth: async () => {
        if (!isSupabaseConfigured) {
          set({ isLoading: false });
          return;
        }

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            set({
              isAuthenticated: true,
              user: {
                id: session.user.id,
                email: session.user.email || '',
                name: session.user.user_metadata?.name || session.user.email || '',
              },
              isLoading: false,
            });
          } else {
            set({ isAuthenticated: false, user: null, isLoading: false });
          }
        } catch {
          set({ isLoading: false });
        }

        // Listen for auth state changes
        supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            set({
              isAuthenticated: true,
              user: {
                id: session.user.id,
                email: session.user.email || '',
                name: session.user.user_metadata?.name || session.user.email || '',
              },
            });
          } else {
            set({ isAuthenticated: false, user: null });
          }
        });
      },

      signIn: async (email: string, password: string) => {
        set({ error: null, isLoading: true });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            set({ error: error.message, isLoading: false });
            return false;
          }

          if (data.user) {
            set({
              isAuthenticated: true,
              user: {
                id: data.user.id,
                email: data.user.email || '',
                name: data.user.user_metadata?.name || data.user.email || '',
              },
              isLoading: false,
            });
            return true;
          }

          set({ isLoading: false });
          return false;
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Sign in failed',
            isLoading: false,
          });
          return false;
        }
      },

      signOut: async () => {
        await supabase.auth.signOut();
        set({ isAuthenticated: false, user: null });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'checks-happy-desktop-auth',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
    },
  ),
);

// Initialize auth on load — always call so isLoading becomes false.
// When Supabase is not configured, initializeAuth sets isLoading=false
// immediately so the app can render (skip-auth / local-only mode).
useAuthStore.getState().initializeAuth();
