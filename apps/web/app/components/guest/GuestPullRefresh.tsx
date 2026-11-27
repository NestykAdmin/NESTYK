'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@nestyk/i18n';
import { inApp } from '../../../lib/app-bridge-client';
import {
  PULL_LOADING,
  PULL_START,
  PULL_THRESHOLD,
  pullAllowed,
  pullOffset,
  pullProgress,
  requestRefresh,
} from '../../../lib/guest-pull';
import { CheckIcon } from './GuestIcons';

type Phase = 'idle' | 'pulling' | 'loading';
type Notice = 'done' | 'failed';

const SETTLE_MS = 250;
/** The smile runs at least this long, so a quick reload still reads as one. */
const MIN_LOADING_MS = 600;
const NOTICE_MS = 2000;
const SMILE = 'M8 6 Q60 52 112 6';

/**
 * Pull to refresh inside the NESTYK app (Mos 25 Nov 2026, canvas page "ptr", design A). Phone browsers have their
 * own, so in a browser this does nothing. At the top of a page with lists (lib/guest-pull.ts), a downward drag moves
 * the page with the finger; the gap above is ink and the yellow smile fills up. Letting go past 72 px reloads the
 * page's data without reloading the page: Next re-renders the server parts (router.refresh) and the lists loaded in
 * the browser load again (nk:refresh). Not while a dialog or a sheet is open.
 * Rendered at the top of the page (inside <main>): the page moves with `top`, not a transform, so bars fixed to the
 * screen inside it stay where they are, and the ink gap with the smile moves with the page under the app bar.
 */
export function GuestPullRefresh() {
  const { t } = useLocale();
  const copy = t.guest.pull;
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [armed, setArmed] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const arc = useRef<SVGPathElement>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!inApp()) return;
    const root = document.documentElement;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let engaged = false;
    let offset = 0;
    let frame = 0;
    let settleTimer = 0;

    const paint = (value: number) => {
      offset = value;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty('--nk-pull', `${value}px`);
        arc.current?.setAttribute('stroke-dasharray', `${Math.round(pullProgress(value) * 100)} 100`);
      });
    };
    const settle = (to: number) => {
      window.clearTimeout(settleTimer);
      root.setAttribute('data-nk-pull', 'settle');
      paint(to);
      if (to > 0) return;
      settleTimer = window.setTimeout(() => {
        root.removeAttribute('data-nk-pull');
        root.style.removeProperty('--nk-pull');
      }, SETTLE_MS);
    };
    const blocked = () =>
      busy.current ||
      window.scrollY > 0 ||
      !pullAllowed(window.location.pathname, window.location.search) ||
      Boolean(document.querySelector('[aria-modal="true"], dialog[open]'));

    const start = (event: TouchEvent) => {
      tracking = false;
      engaged = false;
      if (event.touches.length !== 1 || blocked()) return;
      tracking = true;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    };
    const move = (event: TouchEvent) => {
      if (!tracking) return;
      const dx = event.touches[0].clientX - startX;
      const dy = event.touches[0].clientY - startY;
      if (!engaged) {
        // Up or sideways: the page scrolls (or a rail swipes) as usual.
        if (dy < 0 || Math.abs(dx) > Math.abs(dy)) {
          tracking = false;
          return;
        }
        if (dy < PULL_START) return;
        engaged = true;
        window.clearTimeout(settleTimer);
        root.setAttribute('data-nk-pull', 'drag');
        setPhase('pulling');
        setNotice(null);
      }
      event.preventDefault();
      const next = pullOffset(dy - PULL_START);
      paint(next);
      setArmed(next >= PULL_THRESHOLD);
    };
    const end = () => {
      if (!tracking) return;
      tracking = false;
      if (!engaged) return;
      engaged = false;
      setArmed(false);
      if (offset < PULL_THRESHOLD) {
        setPhase('idle');
        settle(0);
        return;
      }
      busy.current = true;
      setPhase('loading');
      settle(PULL_LOADING);
      const minimum = new Promise((resolve) => window.setTimeout(resolve, MIN_LOADING_MS));
      router.refresh();
      void Promise.all([requestRefresh(window), minimum]).then(([ok]) => {
        busy.current = false;
        setPhase('idle');
        setNotice(ok ? 'done' : 'failed');
        settle(0);
      });
    };

    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', end);
    return () => {
      document.removeEventListener('touchstart', start);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end);
      document.removeEventListener('touchcancel', end);
      cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      root.removeAttribute('data-nk-pull');
      root.style.removeProperty('--nk-pull');
    };
  }, [router]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const label = phase === 'loading' ? copy.loading : armed ? copy.release : copy.hint;
  const spoken = phase === 'loading' ? copy.loading : notice ? copy[notice] : '';

  return (
    <>
      <div className="nk-ptr" aria-hidden="true" data-testid="guest.pull">
        <svg className={`nk-ptr__arc${phase === 'loading' ? ' is-loading' : ''}`} width="64" height="18" viewBox="0 0 120 34" fill="none">
          <path d={SMILE} stroke="rgba(255,255,255,0.16)" strokeWidth="9" strokeLinecap="round" />
          <path
            ref={arc}
            className="nk-ptr__fill"
            d={SMILE}
            stroke="var(--nk-color-brand)"
            strokeWidth="9"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="0 100"
          />
        </svg>
        <span className="nk-ptr__label">{label}</span>
      </div>
      <p className="nk-sr-only" role="status" aria-live="polite">
        {spoken}
      </p>
      {notice ? (
        <div className={`nk-ptr-toast${notice === 'failed' ? ' is-failed' : ''}`} aria-hidden="true" data-testid="guest.pullNotice">
          {notice === 'done' ? <CheckIcon size={16} /> : null}
          {copy[notice]}
        </div>
      ) : null}
    </>
  );
}
