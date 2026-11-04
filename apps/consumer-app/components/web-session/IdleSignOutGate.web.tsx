import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import { useAuth } from '../../lib/auth/AuthContext';
import {
  ACTIVITY_KEY,
  ACTIVITY_WRITE_MS,
  IDLE_CHECK_MS,
  countdownLabel,
  idlePhase,
  parseLastActivity,
} from '../../lib/auth/idle-rules';
import './idle-gate.css';

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;

function readLast(): number | null {
  try {
    return parseLastActivity(window.localStorage.getItem(ACTIVITY_KEY));
  } catch {
    return null;
  }
}

function writeLast(time: number): void {
  try {
    window.localStorage.setItem(ACTIVITY_KEY, String(time));
  } catch {
    // Blocked storage: this tab keeps its own clock only.
  }
}

/**
 * Web idle sign out (lib/auth/idle-rules.ts): 8 hours with no input → this device signs out and the sign-in screen
 * shows the "session expired" notice; 2 minutes before, "Are you still there?". Mounted once in app/_layout.tsx.
 * A return after the limit (tab shown again, computer woke up, browser opened next day) signs out before the
 * returning click counts as activity.
 */
export function IdleSignOutGate() {
  const { ready, isAuthenticated, signOutIdle } = useAuth();
  const { t } = useLocale();
  const copy = t.webSession;
  const [warning, setWarning] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastWrite = useRef(0);
  const signingOut = useRef(false);
  const seenReady = useRef(false);
  const wasAuthenticated = useRef(false);

  const expire = useCallback(() => {
    if (signingOut.current) return;
    signingOut.current = true;
    setWarning(false);
    void signOutIdle().finally(() => {
      signingOut.current = false;
    });
  }, [signOutIdle]);

  /** Looks at the shared clock; true when this call signed the device out. */
  const check = useCallback((): boolean => {
    const time = Date.now();
    const phase = idlePhase(readLast(), time);
    setNow(time);
    if (phase === 'expired') {
      expire();
      return true;
    }
    setWarning(phase === 'warn');
    return false;
  }, [expire]);

  const touch = useCallback((force = false) => {
    const time = Date.now();
    if (!force && time - lastWrite.current < ACTIVITY_WRITE_MS) return;
    lastWrite.current = time;
    writeLast(time);
    setWarning(false);
  }, []);

  // A sign-in in this tab (or adopted from another tab) starts the clock. A session restored on load keeps the
  // saved time, so a tab opened the next morning on a shared computer is signed out.
  useEffect(() => {
    if (!ready) return;
    if (isAuthenticated && !wasAuthenticated.current && (seenReady.current || readLast() === null)) touch(true);
    seenReady.current = true;
    wasAuthenticated.current = isAuthenticated;
    if (!isAuthenticated) setWarning(false);
  }, [ready, isAuthenticated, touch]);

  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    if (check()) return;
    const onActivity = () => {
      // Mouse moves fire many times a second: look at the clock only when a write is due.
      if (Date.now() - lastWrite.current < ACTIVITY_WRITE_MS) return;
      if (!check()) touch();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === ACTIVITY_KEY) check();
    };
    const timer = window.setInterval(check, IDLE_CHECK_MS);
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { capture: true, passive: true });
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(timer);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity, { capture: true });
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  }, [ready, isAuthenticated, check, touch]);

  // Countdown: once a second while the warning shows.
  useEffect(() => {
    if (!warning) return;
    const timer = window.setInterval(check, 1000);
    return () => window.clearInterval(timer);
  }, [warning, check]);

  if (!warning || !isAuthenticated) return null;
  return (
    <div className="idle-gate" role="alertdialog" aria-modal="true" aria-labelledby="idle-gate-title" data-testid="session.idleWarning">
      <div className="idle-gate-card">
        <h2 id="idle-gate-title">{copy.idleTitle}</h2>
        <p>{fillTemplate(copy.idleBody, { time: countdownLabel(readLast(), now) })}</p>
        <div className="idle-gate-actions">
          <button type="button" className="idle-gate-secondary" onClick={expire} data-testid="session.idleSignOut">
            {copy.idleSignOut}
          </button>
          <button type="button" className="idle-gate-primary" onClick={() => touch(true)} autoFocus data-testid="session.idleStay">
            {copy.idleStay}
          </button>
        </div>
      </div>
    </div>
  );
}
