import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Flag to check if Supabase is properly configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Create Supabase client only if configured, otherwise create a placeholder
// Note: Using 'any' for database type until schema is deployed and types are generated
export const supabase: SupabaseClient<any> = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: localStorage,
        storageKey: 'checks-happy-auth',
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

// Helper to get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

// Helper to get current session
export const getCurrentSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
};

// ── Startup diagnostic ──────────────────────────────────────────
// Log whether the Supabase client is properly configured.
// This helps diagnose "No API key" errors in production.
if (typeof window !== 'undefined') {
  const urlOk = !!supabaseUrl && supabaseUrl !== 'https://your-project.supabase.co';
  const keyOk = !!supabaseAnonKey && supabaseAnonKey !== 'your-anon-key-here' && supabaseAnonKey.length > 20;
  if (!urlOk || !keyOk) {
    console.error(
      '[Supabase] MISCONFIGURED — URL valid:', urlOk,
      '| Key valid:', keyOk,
      '| isSupabaseConfigured:', isSupabaseConfigured
    );
  } else {
    console.log('[Supabase] Client configured OK — URL:', supabaseUrl?.substring(0, 30) + '…');
  }
}
