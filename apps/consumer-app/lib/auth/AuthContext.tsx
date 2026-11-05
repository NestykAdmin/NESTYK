import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiPatch, apiPost, setSessionExpiredHandler } from '../api';
import { DEV_AUTH_CONFIG, toDevAccessToken } from './dev-auth';
import { createSessionExpiry, restoreSession } from './session-expiry';
import { providerRedirectPending } from './google-oauth';
import { signInWithFacebook as startFacebookSignIn, signInWithGoogle as startGoogleSignIn } from './google-sign-in';
import { isRecoveryLanding, requestPasswordReset as requestPasswordResetFlow, saveResetPassword as saveResetPasswordFlow, verifyRecoveryLink as verifyRecoveryLinkFlow } from './reset-password';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import {
  clearAuthSession,
  displayNameFrom,
  initialsFromName,
  loadAuthSession,
  saveAuthSession,
  StoredAuthSession,
} from './session-storage';
import { clearExpiryNotice, markAuthEvent, subscribeCrossTab, takeExpiryNotice } from './cross-tab';
import { requestGuestBrowse } from './role-gate';

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
  signIn: (email: string, password: string, captchaToken?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signUp: (email: string, password: string, firstName: string, lastName: string, phone?: string | boolean, forTesting?: boolean, captchaToken?: string) => Promise<{ needsEmailConfirmation: boolean }>;
  verifySignupCode: (email: string, token: string, profile: { firstName: string; lastName: string; phone: string }) => Promise<void>;
  resendSignupCode: (email: string, captchaToken?: string) => Promise<void>;
  requestPasswordReset: (email: string, captchaToken?: string, redirectTo?: string) => Promise<void>;
  /** The reset email's link: a used or expired link throws. */
  verifyRecoveryLink: (tokenHash: string) => Promise<void>;
  /** Whether this device holds a reset session (an older `?code=` link signed in). */
  hasResetSession: () => Promise<boolean>;
  saveResetPassword: (newPassword: string) => Promise<void>;
  enterAfterPasswordReset: () => Promise<void>;
  /** Signs out this device only; other phones and browsers stay signed in (Mos 4 Nov 2026). */
  signOut: () => Promise<void>;
  /** Signs out every device and browser of this account. Throws (and stays signed in) if Supabase cannot be reached. */
  signOutEverywhere: () => Promise<void>;
  /** Web idle limit reached: signs out this device and shows the "session expired" notice on the sign-in screen. */
  signOutIdle: () => Promise<void>;
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
  // Off unless a dev build opts in with EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT=true (it used to be on unless set to false).
  // The API also refuses outside NODE_ENV=development. Same switch as ensureAgentSession (lib/agent-session.ts).
  if (!(typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT === 'true')) return null;
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
    clearExpiryNotice(); // web: signed in again, an older "session expired" is no longer news
    setSession(next);
  }, []);

  // api.ts calls this when a signed-in user's session cannot be renewed (several requests may call it at once).
  useEffect(() => {
    const expire = createSessionExpiry({
      isSignedIn: () => !signingOutRef.current && sessionRef.current?.mode === 'supabase',
      clearStored: async () => {
        markAuthEvent('expired'); // web: other tabs go to /login with the notice too (no-op on mobile)
        await clearAuthSession();
      },
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

  // Web: another tab of this browser signed in or out (lib/auth/cross-tab-rules.ts). Mobile: never fires.
  useEffect(
    () =>
      subscribeCrossTab(
        (action, raw) => {
          if (action.kind === 'signOut') {
            sessionRef.current = null;
            if (action.reason === 'signedOut') {
              requestGuestBrowse(); // the home shell then opens "/" like a sign out in this tab
              setSessionExpired(false);
            } else {
              setSessionExpired(true); // the home shell sends a signed-in page to /login?next=
            }
            setSession(null);
          } else if (action.kind === 'adopt' && raw) {
            try {
              const next = JSON.parse(raw) as StoredAuthSession;
              sessionRef.current = next;
              setSession(next);
              setSessionExpired(false);
            } catch {
              // Unreadable copy: keep this tab as it is.
            }
          } else if (action.kind === 'reload' && typeof window !== 'undefined') {
            window.location.reload();
          }
        },
        () => sessionRef.current?.userId ?? null,
      ),
    [],
  );

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
        const href = typeof window !== 'undefined' && typeof window.location?.href === 'string' ? window.location.href : null;
        const result = await restoreSession({
          stored,
          client: getSupabaseClient(),
          sync: syncProfile,
          adoptProviderSession: !stored && providerRedirectPending(href) && !(href && isRecoveryLanding(href)),
        });
        if (cancelled) return;
        if (result.kind === 'synced') {
          await applySession(sessionFromSync(result.mode, result.accessToken, result.userId, result.profile));
        } else if (result.kind === 'cached') {
          await applySession(result.session);
        } else {
          if (stored) markAuthEvent(result.kind === 'expired' ? 'expired' : 'signedOut');
          await clearAuthSession();
          setSession(null);
          if (result.kind === 'expired') setSessionExpired(true);
          // Web: another tab's session ran out before this tab loaded (it found no session): say why here too, once.
          else if (!stored && takeExpiryNotice()) setSessionExpired(true);
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

  const finishSupabaseSession = useCallback(async (accessToken: string, userId: string) => {
    let profile = await syncProfile(accessToken);
    const granted = await ensureAdminRole(accessToken, profile.roles);
    if (granted) profile = granted;
    await applySession(sessionFromSync('supabase', accessToken, userId, profile));
    setSessionExpired(false);
  }, [applySession]);

  const signIn = useCallback(
    async (email: string, password: string, captchaToken?: string, supabaseOnly = false) => {
      const normalizedEmail = email.trim().toLowerCase();
      const supabase = getSupabaseClient();

      // Prefer Supabase when configured
      if (supabase && isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
          ...(captchaToken ? { options: { captchaToken } } : {}),
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
          try {
            await finishSupabaseSession(data.session.access_token, data.user.id);
          } catch (syncError) {
            // Signed in to Supabase but the API refused the profile: undo the Supabase sign-in,
            // so a guest is not left holding this account's session.
            await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
            throw syncError;
          }
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
    [finishSupabaseSession],
  );

  const signInWithOAuth = useCallback(async (start: typeof startGoogleSignIn) => {
    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured()) {
      throw Object.assign(new Error(), { code: 'SUPABASE_NOT_CONFIGURED' });
    }
    const oauthSession = await start(supabase);
    if (!oauthSession) return;
    try {
      let profile = await syncProfile(oauthSession.access_token);
      const granted = await ensureAdminRole(oauthSession.access_token, profile.roles);
      if (granted) profile = granted;
      await applySession(sessionFromSync('supabase', oauthSession.access_token, oauthSession.user.id, profile));
    } catch (syncError) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      throw syncError;
    }
    setSessionExpired(false);
  }, [applySession]);

  const signInWithGoogle = useCallback(() => signInWithOAuth(startGoogleSignIn), [signInWithOAuth]);
  const signInWithFacebook = useCallback(() => signInWithOAuth(startFacebookSignIn), [signInWithOAuth]);

  /**
   * scope 'local' = this device only (auth-js defaults to 'global', which signed every device out: review
   * nestyk-web-auth-session-check-20261104). 'global' is the separate "sign out of all devices" action.
   */
  const endSession = useCallback(async (scope: 'local' | 'global', reason: 'signedOut' | 'expired') => {
    // A request failing while signing out must not show "session expired".
    signingOutRef.current = true;
    try {
      const supabase = getSupabaseClient();
      if (supabase && session?.mode === 'supabase') {
        if (scope === 'global') {
          // Must reach Supabase, or the other devices stay signed in: report it and keep this one signed in.
          const { error } = await supabase.auth.signOut({ scope: 'global' });
          if (error) throw error;
        } else {
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch {
            // The local session is removed even when the server call fails.
          }
        }
      }
      markAuthEvent(reason); // web: other tabs follow (guest home, or /login for expired); no-op on mobile
      await clearAuthSession();
      sessionRef.current = null;
      setSession(null);
      setSessionExpired(reason === 'expired');
    } finally {
      signingOutRef.current = false;
    }
  }, [session?.mode]);

  const signOut = useCallback(() => endSession('local', 'signedOut'), [endSession]);
  const signOutEverywhere = useCallback(() => endSession('global', 'signedOut'), [endSession]);
  const signOutIdle = useCallback(() => endSession('local', 'expired'), [endSession]);

  const saveSignupProfile = useCallback(async (
    accessToken: string,
    profile: { firstName: string; lastName: string; phone: string },
  ) => {
    await apiPatch('/auth/profile', {
      firstName: profile.firstName.trim(),
      lastName: profile.lastName.trim(),
      phone: profile.phone.trim(),
    }, accessToken);
  }, []);

  const signUp = useCallback(async (email: string, password: string, firstName: string, lastName: string, phoneOrTesting: string | boolean = '', forTesting = false, captchaToken?: string) => {
    const phone = typeof phoneOrTesting === 'string' ? phoneOrTesting : '';
    const testing = typeof phoneOrTesting === 'boolean' ? phoneOrTesting : forTesting;
    if (testing && (typeof __DEV__ === 'undefined' || !__DEV__)) {
      throw Object.assign(new Error(), { code: 'TEST_REGISTRATION_UNAVAILABLE' });
    }
    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured()) {
      throw Object.assign(new Error(), { code: 'SUPABASE_NOT_CONFIGURED' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (testing) {
      await apiPost('/auth/dev/register', {
        email: normalizedEmail, password, firstName: firstName.trim(), lastName: lastName.trim(),
      });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          ...(captchaToken ? { captchaToken } : {}),
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name: [firstName.trim(), lastName.trim()].join(' '),
            phone: phone.trim(),
            registration_source: 'self_service',
          },
        },
      });
      const duplicate = error && ['user_already_exists', 'email_exists'].includes(String((error as { code?: string }).code));
      if (duplicate) return { needsEmailConfirmation: true };
      if (error) throw error;
      if (!data.user) throw new Error();
      if (!data.session) return { needsEmailConfirmation: true };
      try {
        await finishSupabaseSession(data.session.access_token, data.user.id);
      } catch (syncError) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
        throw syncError;
      }
      return { needsEmailConfirmation: false };
    }

    // Test registration has no Supabase session yet. A normal signup that already
    // returned a session does not sign in again, because that would spend a second captcha token.
    try {
      await signIn(normalizedEmail, password, undefined, true);
    } catch (signInError) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      throw signInError;
    }
    return { needsEmailConfirmation: false };
  }, [finishSupabaseSession, signIn]);

  const verifySignupCode = useCallback(async (
    email: string,
    token: string,
    profile: { firstName: string; lastName: string; phone: string },
  ) => {
    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured()) {
      throw Object.assign(new Error(), { code: 'SUPABASE_NOT_CONFIGURED' });
    }
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'signup',
    });
    if (error || !data.session) throw error ?? new Error();
    try {
      let synced = await syncProfile(data.session.access_token);
      await saveSignupProfile(data.session.access_token, profile);
      synced = await syncProfile(data.session.access_token);
      await applySession(sessionFromSync('supabase', data.session.access_token, data.session.user.id, synced));
    } catch (syncError) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      throw syncError;
    }
    setSessionExpired(false);
  }, [applySession, saveSignupProfile]);

  const resetClient = useCallback(() => {
    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured()) {
      throw Object.assign(new Error(), { code: 'SUPABASE_NOT_CONFIGURED' });
    }
    return supabase;
  }, []);

  const requestPasswordReset = useCallback(async (email: string, captchaToken?: string, redirectTo?: string) => {
    await requestPasswordResetFlow(resetClient(), email, captchaToken, redirectTo);
  }, [resetClient]);

  const verifyRecoveryLink = useCallback(async (tokenHash: string) => {
    await verifyRecoveryLinkFlow(resetClient(), tokenHash);
  }, [resetClient]);

  const hasResetSession = useCallback(async () => {
    try {
      const { data } = await resetClient().auth.getSession();
      return Boolean(data.session);
    } catch {
      return false;
    }
  }, [resetClient]);

  const saveResetPassword = useCallback(async (newPassword: string) => {
    await saveResetPasswordFlow(resetClient(), newPassword);
  }, [resetClient]);

  const enterAfterPasswordReset = useCallback(async () => {
    const supabase = resetClient();
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw error ?? new Error();
    const synced = await syncProfile(data.session.access_token);
    await applySession(sessionFromSync('supabase', data.session.access_token, data.session.user.id, synced));
    setSessionExpired(false);
  }, [applySession, resetClient]);

  const resendSignupCode = useCallback(async (email: string, captchaToken?: string) => {
    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured()) {
      throw Object.assign(new Error(), { code: 'SUPABASE_NOT_CONFIGURED' });
    }
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      ...(captchaToken ? { options: { captchaToken } } : {}),
    });
    if (error) throw error;
  }, []);

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
      signInWithGoogle,
      signInWithFacebook,
      signUp,
      verifySignupCode,
      resendSignupCode,
      requestPasswordReset,
      verifyRecoveryLink,
      hasResetSession,
      saveResetPassword,
      enterAfterPasswordReset,
      signOut,
      signOutEverywhere,
      signOutIdle,
      refreshProfile,
      sessionExpired,
      dismissSessionExpired,
    };
  }, [ready, session, signIn, signInWithGoogle, signInWithFacebook, signUp, verifySignupCode, resendSignupCode, requestPasswordReset, verifyRecoveryLink, hasResetSession, saveResetPassword, enterAfterPasswordReset, signOut, signOutEverywhere, signOutIdle, refreshProfile, sessionExpired, dismissSessionExpired]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
