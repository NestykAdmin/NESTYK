import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client of the guest web (AUTH-2.1, nestyk-guest-session-plan-20261112.md B1/B3). Same project, same
 * browser storage and same settings as the consumer-app on this site, so both keep one sign-in: the session key in
 * local storage is shared, and auth-js locks token refresh across tabs and both apps. Sign-in itself only happens on
 * the account pages, so this client never reads a session out of the address bar. Browser only.
 * Loaded on demand (review R5): only someone with a sign-in copy downloads supabase-js; public pages stay light.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

let client: Promise<SupabaseClient | null> | null = null;

export function loadGuestSupabase(): Promise<SupabaseClient | null> {
  if (!url || !anonKey || typeof window === 'undefined') return Promise.resolve(null);
  if (!client) {
    client = (async () => {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      });
    })().catch(() => {
      client = null; // a failed download can be tried again on the next page
      return null;
    });
  }
  return client;
}

/**
 * Access token of this tab's sign-in and the Supabase user it belongs to, for calls to our API (AUTH-3).
 * supabase-js refreshes an expired token here. Read per call and never stored elsewhere. Null when signed out or
 * when Supabase cannot be reached. The caller checks userId, so a switch of account mid-press is never sent.
 */
export async function guestSessionToken(): Promise<{ token: string; userId: string } | null> {
  const supabase = await loadGuestSupabase();
  if (!supabase) return null;
  try {
    const session = (await supabase.auth.getSession()).data.session;
    return session?.access_token ? { token: session.access_token, userId: session.user.id } : null;
  } catch {
    return null;
  }
}
