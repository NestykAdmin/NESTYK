import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiPost, setSessionExpiredHandler } from '../api';
import { DEV_AUTH_CONFIG, toDevAccessToken } from './dev-auth';
import { createSessionExpiry, restoreSession } from './session-expiry';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import {
  clearAuthSession,
  displayNameFrom,
  initialsFromName,
  loadAuthSession,
  saveAuthSession,
  StoredAuthSession,
} from './session-storage';

export type AuthUserResponse = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  profileCompleted: boolean;
  provisioned: boolean;
  roles: string[];
};

type AuthContextValue = {
  ready: boolean;
  session: StoredAuthSession | null;
  isAuthenticated: boolean;
  displayName: string;
  initials: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, firstName: string, lastName: string, forTesting?: boolean) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** The login ran out (or was ended elsewhere): the sign-in screen shows a notice until the next sign-in. */
  sessionExpired: boolean;
  dismissSessionExpired: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Without a token, api.ts sends the current Supabase token and renews it when needed. */
async function syncProfile(accessToken?: string): Promise<AuthUserResponse> {
  return apiPost<AuthUserResponse>('/auth/sync', {}, accessToken);
}

async function ensureAdminRole(accessToken: string, roles: string[]): Promise<AuthUserResponse | null> {
  if (roles.includes('admin')) return null;
  if (process.env.EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT === 'false') return null;
  try {
    return await apiPost<AuthUserResponse>('/auth/dev/roles', { role: 'admin' }, accessToken);
  } catch {
    return null;
  }
}

function sessionFromSync(
  mode: StoredAuthSession['mode'],
  accessToken: string,
  userId: string,
  profile: AuthUserResponse,
): StoredAuthSession {
  return {
    mode,
    accessToken,
    email: profile.email,
    userId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    avatarUrl: profile.avatarUrl,
    roles: profile.roles ?? [],
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<StoredAuthSession | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const sessionRef = useRef<StoredAuthSession | null>(null);
  sessionRef.current = session;
  // Set by signOut; a re-render does not reset it (unlike sessionRef).
  const signingOutRef = useRef(false);

  const applySession = useCallback(async (next: StoredAuthSession) => {
    await saveAuthSession(next);
    setSession(next);
  }, []);

  // api.ts calls this when a signed-in user's session cannot be renewed (several requests may call it at once).
  useEffect(() => {
    const expire = createSessionExpiry({
      isSignedIn: () => !signingOutRef.current && sessionRef.current?.mode === 'supabase',
      clearStored: clearAuthSession,
      client: getSupabaseClient,
      onExpired: () => {
        sessionRef.current = null; // before the next render, so later 401s do nothing
        setSession(null);
        setSessionExpired(true);
      },
    });
    setSessionExpiredHandler(() => {
      void expire();
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.accessToken) return;
    // Dev login keeps its own token; a Supabase login lets api.ts send the current one.
    const profile = await syncProfile(session.mode === 'dev' ? session.accessToken : undefined);
    // Signed out or expired while waiting: do not save the session back.
    if (sessionRef.current?.userId !== session.userId) return;
    const next = sessionFromSync(session.mode, session.accessToken, session.userId, profile);
    await applySession(next);
  }, [session, applySession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await loadAuthSession();
        if (cancelled) return;
        const result = await restoreSession({ stored, client: getSupabaseClient(), sync: syncProfile });
        if (cancelled) return;
        if (result.kind === 'synced') {
          await applySession(sessionFromSync(result.mode, result.accessToken, result.userId, result.profile));
        } else if (result.kind === 'cached') {
          await applySession(result.session);
        } else {
          await clearAuthSession();
          setSession(null);
          if (result.kind === 'expired') setSessionExpired(true);
        }
      } catch {
        // Storage failed: start signed out rather than stay on the splash screen.
        await clearAuthSession().catch(() => undefined);
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const signIn = useCallback(
    async (email: string, password: string, supabaseOnly = false) => {
      const normalizedEmail = email.trim().toLowerCase();
      const supabase = getSupabaseClient();

      // Prefer Supabase when configured
      if (supabase && isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error || !data.session) {
          // Fall through to local dev credentials when enabled
          if (
            !(
              !supabaseOnly && DEV_AUTH_CONFIG.enabled &&
              normalizedEmail === DEV_AUTH_CONFIG.email.toLowerCase() &&
              password === DEV_AUTH_CONFIG.password
            )
          ) {
            throw new Error(error?.message ?? 'Sign in failed');
          }
        } else {
          const accessToken = data.session.access_token;
          const userId = data.user.id;
          try {
            let profile = await syncProfile(accessToken);
            const granted = await ensureAdminRole(accessToken, profile.roles);
            if (granted) profile = granted;
            await applySession(sessionFromSync('supabase', accessToken, userId, profile));
          } catch (syncError) {
            // Signed in to Supabase but the API refused the profile: undo the Supabase sign-in,
            // so a guest is not left holding this account's session.
            await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
            throw syncError;
          }
          setSessionExpired(false);
          return;
        }
      }

      // Dev email/password (local Docker + ALLOW_DEV_AUTH)
      if (
        !supabaseOnly && DEV_AUTH_CONFIG.enabled &&
        normalizedEmail === DEV_AUTH_CONFIG.email.toLowerCase() &&
        password === DEV_AUTH_CONFIG.password
      ) {
        const accessToken = toDevAccessToken(
          DEV_AUTH_CONFIG.uuid,
          DEV_AUTH_CONFIG.email,
          DEV_AUTH_CONFIG.firstName,
          DEV_AUTH_CONFIG.lastName,
        );
        let profile = await syncProfile(accessToken);
        const granted = await ensureAdminRole(accessToken, profile.roles);
        if (granted) profile = granted;
        await applySession(
          sessionFromSync('dev', accessToken, DEV_AUTH_CONFIG.uuid, profile),
        );
        setSessionExpired(false);
        return;
      }

      throw new Error('Invalid email or password');
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    // A request failing while signing out must not show "session expired".
    signingOutRef.current = true;
    try {
      const supabase = getSupabaseClient();
      if (supabase && session?.mode === 'supabase') {
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
      }
      await clearAuthSession();
      sessionRef.current = null;
      setSession(null);
      setSessionExpired(false);
    } finally {
      signingOutRef.current = false;
    }
  }, [session?.mode]);

  const signUp = useCallback(async (email: string, password: string, firstName: string, lastName: string, forTesting = false) => {
    if (forTesting && (typeof __DEV__ === 'undefined' || !__DEV__)) {
      throw Object.assign(new Error(), { code: 'TEST_REGISTRATION_UNAVAILABLE' });
    }
    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured()) {
      throw Object.assign(new Error(), { code: 'SUPABASE_NOT_CONFIGURED' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (forTesting) {
      await apiPost('/auth/dev/register', {
        email: normalizedEmail, password, firstName: firstName.trim(), lastName: lastName.trim(),
      });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: [firstName.trim(), lastName.trim()].join(' '),
          registration_source: 'self_service',
        } },
      });
      if (error) throw error;
      if (!data.user) throw new Error();
      if (!data.session) return { needsEmailConfirmation: true };
    }

    // Use the existing sign-in/session flow; registration never constructs a token or grants DEV roles.
    try {
      await signIn(normalizedEmail, password, true);
    } catch (signInError) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      throw signInError;
    }
    return { needsEmailConfirmation: false };
  }, [signIn]);

  const dismissSessionExpired = useCallback(() => setSessionExpired(false), []);

  const value = useMemo<AuthContextValue>(() => {
    const firstName = session?.firstName ?? '';
    const lastName = session?.lastName ?? '';
    const email = session?.email ?? '';
    return {
      ready,
      session,
      isAuthenticated: Boolean(session),
      displayName: session ? displayNameFrom(firstName, lastName, email) : '',
      initials: session ? initialsFromName(firstName, lastName, email) : '?',
      signIn,
      signUp,
      signOut,
      refreshProfile,
      sessionExpired,
      dismissSessionExpired,
    };
  }, [ready, session, signIn, signUp, signOut, refreshProfile, sessionExpired, dismissSessionExpired]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
