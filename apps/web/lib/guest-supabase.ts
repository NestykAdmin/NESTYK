import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client of the guest web (AUTH-2.1, nestyk-guest-session-plan-20261112.md B1/B3). Same project, same
 * browser storage and same settings as the consumer-app on this site, so both keep one sign-in: the session key in
 * local storage is shared, and auth-js locks token refresh across tabs and both apps. Sign-in itself only happens on
 * the account pages, so this client never reads a session out of the address bar. Browser only.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

let client: SupabaseClient | null = null;

export function guestSupabase(): SupabaseClient | null {
  if (!url || !anonKey || typeof window === 'undefined') return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  }
  return client;
}
