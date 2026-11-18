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
import { loadGuestSupabase } from '../../../lib/guest-supabase';

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

  /**
   * Same order as the consumer-app (AuthContext endSession, review R3): Supabase, this device only → the reason for
   * other tabs → the profile copy. The header changes at once; the network call does not hold it up.
   */
  const signOut = useCallback(async (reason: 'signedOut' | 'expired' = 'signedOut') => {
    setState(SIGNED_OUT);
    try {
      const supabase = await loadGuestSupabase();
      await supabase?.auth.signOut({ scope: 'local' });
    } catch {
      // The local session is removed even when the server call fails.
    }
    const store = browserStorage();
    try {
      store?.setItem(AUTH_EVENT_KEY, reason);
      store?.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // storage blocked: nothing more to clear
    }
  }, []);

  // First look, in the browser only. supabase-js loads only when there is a sign-in copy (review R5).
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    if (!readGuestProfile(readKey(SESSION_STORAGE_KEY))) {
      setState(SIGNED_OUT);
      return;
    }
    if (idleExpired(readKey(ACTIVITY_KEY), Date.now())) {
      void signOut('expired');
      return;
    }
    void loadGuestSupabase()
      .then(async (supabase) => {
        if (cancelled) return;
        const session = supabase ? (await supabase.auth.getSession()).data.session : null;
        if (cancelled) return;
        // Read the copy again: another tab may have switched the account meanwhile (review R6).
        const profile = readGuestProfile(readKey(SESSION_STORAGE_KEY));
        if (profile && (!supabase || session?.user.id === profile.userId)) setState({ status: 'signedIn', profile });
        else setState(SIGNED_OUT);
        const sub = supabase?.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_OUT') setState(SIGNED_OUT);
        });
        unsubscribe = sub ? () => sub.data.subscription.unsubscribe() : null;
      })
      .catch(() => {
        if (!cancelled) setState(SIGNED_OUT);
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
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
    return () => window.removeEventListener('storage', onStorage);
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
