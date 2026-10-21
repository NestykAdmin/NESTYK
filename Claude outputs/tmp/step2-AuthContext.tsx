import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiPost } from '../api';
import { DEV_AUTH_CONFIG, toDevAccessToken } from './dev-auth';
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
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function syncProfile(accessToken: string): Promise<AuthUserResponse> {
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

  const applySession = useCallback(async (next: StoredAuthSession) => {
    await saveAuthSession(next);
    setSession(next);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.accessToken) return;
    const profile = await syncProfile(session.accessToken);
    const next = sessionFromSync(session.mode, session.accessToken, session.userId, profile);
    await applySession(next);
  }, [session, applySession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadAuthSession();
      if (cancelled) return;
      if (stored) {
        try {
          const profile = await syncProfile(stored.accessToken);
          if (cancelled) return;
          await applySession(
            sessionFromSync(stored.mode, stored.accessToken, stored.userId, profile),
          );
        } catch {
          if (!cancelled) {
            await clearAuthSession();
            setSession(null);
          }
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
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
              DEV_AUTH_CONFIG.enabled &&
              normalizedEmail === DEV_AUTH_CONFIG.email.toLowerCase() &&
              password === DEV_AUTH_CONFIG.password
            )
          ) {
            throw new Error(error?.message ?? 'Sign in failed');
          }
        } else {
          const accessToken = data.session.access_token;
          const userId = data.user.id;
          let profile = await syncProfile(accessToken);
          const granted = await ensureAdminRole(accessToken, profile.roles);
          if (granted) profile = granted;
          await applySession(sessionFromSync('supabase', accessToken, userId, profile));
          return;
        }
      }

      // Dev email/password (local Docker + ALLOW_DEV_AUTH)
      if (
        DEV_AUTH_CONFIG.enabled &&
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
        return;
      }

      throw new Error('Invalid email or password');
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (supabase && session?.mode === 'supabase') {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    }
    await clearAuthSession();
    setSession(null);
  }, [session?.mode]);

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
      signOut,
      refreshProfile,
    };
  }, [ready, session, signIn, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
