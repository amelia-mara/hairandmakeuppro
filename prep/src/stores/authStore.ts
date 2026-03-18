import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface User {
  name: string;
  email: string;
  initials: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => boolean;
  signup: (name: string, email: string, password: string) => boolean;
  logout: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      login: (email, _password) => {
        // Demo auth — accepts any credentials
        const name = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        set({
          user: { name, email, initials: getInitials(name) },
          isAuthenticated: true,
        });
        return true;
      },

      signup: (name, email, _password) => {
        set({
          user: { name, email, initials: getInitials(name) },
          isAuthenticated: true,
        });
        return true;
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'prep-happy-auth',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
