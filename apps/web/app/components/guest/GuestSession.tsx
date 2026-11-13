'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ACTIVITY_KEY,
  ACTIVITY_WRITE_MS,
  AUTH_EVENT_KEY,
  SESSION_STORAGE_KEY,
  guestSessionChange,
  idleExpired,
  readGuestProfile,
  type GuestProfile,
} from '../../../lib/guest-session';
import { guestSupabase } from '../../../lib/guest-supabase';

/**
 * Who is signed in, for the guest web (AUTH-2.3, nestyk-guest-session-plan-20261112.md B3–B6).
 * The account pages (consumer-app) sign in on this same site and keep a profile copy in local storage; this reads
 * it in the browser after the page loads, so the public pages stay cacheable and the server never sees the sign-in.
 * - "checking" on the server and the first paint (the header keeps a same-size gap, no flash).
 * - Signed in only when the copy and the Supabase session agree on the user.
 * - Other tabs (and the account pages) signing in or out are followed through the "storage" event.
 * - 8 hours with no use on any tab signs this device out (the shared last-activity time, Mos D4).
 */
export type GuestSessionState =
  | { status: 'checking'; profile: null }
  | { status: 'signedOut'; profile: null }
  | { status: 'signedIn'; profile: GuestProfile };

type GuestSessionValue = GuestSessionState & { signOut: () => Promise<void> };

const CHECKING: GuestSessionState = { status: 'checking', profile: null };
const SIGNED_OUT: GuestSessionState = { status: 'signedOut', profile: null };
const IDLE_CHECK_MS = 15 * 1000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

const GuestSessionContext = createContext<GuestSessionValue>({ ...CHECKING, signOut: async () => {} });

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readKey(key: string): string | null {
  try {
    return browserStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function GuestSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GuestSessionState>(CHECKING);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = state.status === 'signedIn' ? state.profile.userId : null;

  /** Same order as the consumer-app (AuthContext signOut): reason → profile copy → Supabase, this device only. */
  const signOut = useCallback(async (reason: 'signedOut' | 'expired' = 'signedOut') => {
    const store = browserStorage();
    try {
      store?.setItem(AUTH_EVENT_KEY, reason);
      store?.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // storage blocked: the Supabase sign-out below still ends the session
    }
    try {
      await guestSupabase()?.auth.signOut({ scope: 'local' });
    } catch {
      // offline: the local session is gone either way
    }
    setState(SIGNED_OUT);
  }, []);

  // First look, in the browser only.
  useEffect(() => {
    let cancelled = false;
    const profile = readGuestProfile(readKey(SESSION_STORAGE_KEY));
    if (!profile) {
      setState(SIGNED_OUT);
      return;
    }
    if (idleExpired(readKey(ACTIVITY_KEY), Date.now())) {
      void signOut('expired');
      return;
    }
    const supabase = guestSupabase();
    if (!supabase) {
      setState({ status: 'signedIn', profile });
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setState(data.session?.user.id === profile.userId ? { status: 'signedIn', profile } : SIGNED_OUT);
      })
      .catch(() => {
        if (!cancelled) setState(SIGNED_OUT);
      });
    return () => {
      cancelled = true;
    };
  }, [signOut]);

  // Other tabs and the account pages.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== browserStorage()) return;
      const change = guestSessionChange({ currentUserId: userIdRef.current, key: event.key, newValue: event.newValue });
      if (change === 'signedOut') setState(SIGNED_OUT);
      else if (change === 'switchedUser') window.location.reload();
      else if (change === 'signedIn' || change === 'updated') {
        const profile = readGuestProfile(event.newValue);
        if (profile) setState({ status: 'signedIn', profile });
      }
    };
    window.addEventListener('storage', onStorage);
    const subscription = guestSupabase()?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setState(SIGNED_OUT);
    });
    return () => {
      window.removeEventListener('storage', onStorage);
      subscription?.data.subscription.unsubscribe();
    };
  }, []);

  // Idle: count use on this page into the shared time, and sign out after 8 hours with none on any tab.
  const signedIn = state.status === 'signedIn';
  useEffect(() => {
    if (!signedIn) return;
    let lastWrite = 0;
    const markActive = () => {
      const now = Date.now();
      if (now - lastWrite < ACTIVITY_WRITE_MS) return;
      lastWrite = now;
      try {
        browserStorage()?.setItem(ACTIVITY_KEY, String(now));
      } catch {
        // storage blocked: the other tabs' times still count
      }
    };
    markActive();
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, markActive, { passive: true });
    const timer = window.setInterval(() => {
      if (idleExpired(readKey(ACTIVITY_KEY), Date.now())) void signOut('expired');
    }, IDLE_CHECK_MS);
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, markActive);
      window.clearInterval(timer);
    };
  }, [signedIn, signOut]);

  const value = useMemo<GuestSessionValue>(() => ({ ...state, signOut: () => signOut('signedOut') }), [state, signOut]);
  return <GuestSessionContext.Provider value={value}>{children}</GuestSessionContext.Provider>;
}

export function useGuestSession(): GuestSessionValue {
  return useContext(GuestSessionContext);
}
