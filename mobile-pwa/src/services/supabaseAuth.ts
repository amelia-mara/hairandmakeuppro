import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export interface SignUpData {
  email: string;
  password: string;
  name: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  tier: 'trainee' | 'artist' | 'supervisor' | 'designer';
  stripe_customer_id: string | null;
  created_at: string;
}

// Sign up a new user
export async function signUp({ email, password, name }: SignUpData): Promise<{ user: User | null; error: Error | null }> {
  try {
    // Create auth user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error('No user returned from sign up');

    // Create user profile in users table
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: data.user.id,
        email,
        name,
        tier: 'trainee', // Default tier
      });

    if (profileError) {
      console.error('Error creating user profile:', profileError);
      // Don't throw - the user can still use the app
    }

    return { user: data.user, error: null };
  } catch (error) {
    return { user: null, error: error as Error };
  }
}

// Sign in existing user
export async function signIn({ email, password }: SignInData): Promise<{ user: User | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    return { user: data.user, error: null };
  } catch (error) {
    return { user: null, error: error as Error };
  }
}

// Sign out
export async function signOut(): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

// Get current user
export async function getCurrentUser(): Promise<{ user: User | null; error: Error | null }> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return { user, error: null };
  } catch (error) {
    return { user: null, error: error as Error };
  }
}

// Get user profile from users table
export async function getUserProfile(userId: string): Promise<{ profile: UserProfile | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return { profile: data, error: null };
  } catch (error) {
    return { profile: null, error: error as Error };
  }
}

// Update user profile
export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'name' | 'tier'>>
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

// Update user tier
export async function updateUserTier(
  userId: string,
  tier: UserProfile['tier']
): Promise<{ error: Error | null }> {
  return updateUserProfile(userId, { tier });
}

// Request password reset
export async function resetPassword(email: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

// Update password (after reset)
export async function updatePassword(newPassword: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

// Listen for auth state changes
export function onAuthStateChange(
  callback: (event: string, session: any) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}

// Get current session
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}
