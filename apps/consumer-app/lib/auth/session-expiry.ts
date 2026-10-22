import { SESSION_EXPIRED } from '../api';
import type { StoredAuthSession } from './session-storage';

/**
 * Start-up and "session expired" rules for AuthContext, kept free of React so they can be tested.
 *
 * Rules:
 * - Only a real expiry signs the user out: Supabase no longer has the session, or the API answered
 *   SESSION_EXPIRED. No network or an API error keeps the user signed in with the cached profile.
 * - When the session is dropped, the Supabase session on this phone is removed too
 *   (signOut scope 'local'), so a leftover Supabase session is never used by a guest.
 */

type SupabaseAuthLike = {
  auth: {
    getSession(): Promise<{
      data: { session: { access_token: string; user: { id: string } } | null };
      error: { name?: string } | null;
    }>;
    signOut(options: { scope: 'local' }): Promise<unknown>;
  };
};

export type RestoreResult<P> =
  /** Nothing to restore: show the app signed out, no notice. */
  | { kind: 'none' }
  /** Profile loaded from the API with a working token. */
  | { kind: 'synced'; mode: StoredAuthSession['mode']; accessToken: string; userId: string; profile: P }
  /** API or Supabase could not be reached: keep the saved profile. */
  | { kind: 'cached'; session: StoredAuthSession }
  /** The login is no longer valid: show the sign-in screen with the "session expired" notice. */
  | { kind: 'expired' };

function isSessionExpired(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === SESSION_EXPIRED);
}

async function signOutHere(client: SupabaseAuthLike | null): Promise<void> {
  try {
    await client?.auth.signOut({ scope: 'local' });
  } catch {
    // The local session is removed by Supabase even when the server call fails.
  }
}

/**
 * Decides what to show when the app starts, from the session saved at sign-in.
 * `sync(token)` calls POST /auth/sync; without a token, api.ts uses the current Supabase token
 * and renews it when needed.
 */
export async function restoreSession<P>(deps: {
  stored: StoredAuthSession | null;
  client: SupabaseAuthLike | null;
  sync: (accessToken?: string) => Promise<P>;
}): Promise<RestoreResult<P>> {
  const { stored, client, sync } = deps;
  if (!stored) return { kind: 'none' };

  // Dev login, or Supabase not set up: same as before (the saved token is the only one there is).
  if (stored.mode === 'dev' || !client) {
    try {
      const profile = await sync(stored.accessToken);
      return { kind: 'synced', mode: stored.mode, accessToken: stored.accessToken, userId: stored.userId, profile };
    } catch {
      return { kind: 'none' };
    }
  }

  let live: { access_token: string; user: { id: string } } | null = null;
  try {
    // Renews the access token first when it has expired while the app was closed.
    const { data, error } = await client.auth.getSession();
    live = data.session;
    if (!live) {
      // Network failure or Supabase 5xx: auth-js keeps the session, so keep the user signed in.
      if (error?.name === 'AuthRetryableFetchError') return { kind: 'cached', session: stored };
      await signOutHere(client);
      return { kind: 'expired' };
    }
  } catch {
    return { kind: 'cached', session: stored };
  }

  try {
    const profile = await sync();
    return { kind: 'synced', mode: 'supabase', accessToken: live.access_token, userId: live.user.id, profile };
  } catch (error) {
    if (isSessionExpired(error)) {
      await signOutHere(client);
      return { kind: 'expired' };
    }
    if (stored.userId === live.user.id) {
      // API unreachable or failing: keep the saved profile with the current token.
      return { kind: 'cached', session: { ...stored, accessToken: live.access_token } };
    }
    // The saved profile belongs to another account: drop both.
    await signOutHere(client);
    return { kind: 'none' };
  }
}

/**
 * Builds the handler that api.ts calls when a session cannot be renewed.
 * Safe to call many times at once (several requests failing together): only the first call
 * while signed in does the work, and it never throws.
 */
export function createSessionExpiry(deps: {
  isSignedIn: () => boolean;
  clearStored: () => Promise<void>;
  client: () => SupabaseAuthLike | null;
  onExpired: () => void;
}): () => Promise<void> {
  let running: Promise<void> | null = null;
  return () => {
    if (running) return running;
    if (!deps.isSignedIn()) return Promise.resolve();
    running = (async () => {
      try {
        await deps.clearStored();
      } catch {
        // Still sign out of Supabase and show the notice.
      }
      await signOutHere(deps.client());
      try {
        deps.onExpired();
      } catch {
        // ignore
      }
    })().finally(() => {
      running = null;
    });
    return running;
  };
}
