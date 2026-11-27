'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { navDirection, ownCsp, type NavDirection } from '../../../lib/guest-transition';

/** Phones and tablets (the tab bar layout), and only when the person has not asked for less motion. */
const MOTION_QUERY = '(max-width: 960px) and (prefers-reduced-motion: no-preference)';
/** Longest the old page stays frozen while the new one loads; then the move plays with what is there. */
const NAV_WAIT_MS = 2500;
/** The browser calls the update on its next frame; a page that draws none (hidden, busy) changes without the move. */
const START_WAIT_MS = 300;
/** How long <html data-nk-enter> stays: a little longer than the enter move (guest.css). */
const ENTER_MS = 400;

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void>; skipTransition?: () => void };
};

function canMove(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(MOTION_QUERY).matches;
}

/** The new page moves in alone (no view transitions, Back, or a link to a page with its own CSP). */
function markEnter(direction: NavDirection): void {
  const html = document.documentElement;
  html.setAttribute('data-nk-enter', direction);
  window.setTimeout(() => {
    if (html.getAttribute('data-nk-enter') === direction) html.removeAttribute('data-nk-enter');
  }, ENTER_MS);
}

/**
 * Page change animation, design A (Mos 27 Nov 2026, canvas "pageanim"): a deeper page slides in from the right, going
 * back slides it away, tabs fade (lib/guest-transition.ts). In-page changes of this site run in a view transition;
 * full page loads (rooms and search have their own CSP) are animated by the head script (NAV_REVEAL_SCRIPT).
 * Browsers without view transitions get the enter-only move. guest.css limits all of it to phones without reduced motion.
 */
export function GuestPageTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const last = useRef(pathname);
  const waiting = useRef<(() => void) | null>(null);

  // The new page is on screen: the view transition can take its picture.
  useEffect(() => {
    last.current = pathname;
    waiting.current?.();
    waiting.current = null;
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!canMove()) return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const from = window.location.pathname;
      const to = url.pathname;
      const direction = navDirection(from, to);
      if (direction === 'none') return;
      const html = document.documentElement;
      if (ownCsp(from) || ownCsp(to)) {
        html.setAttribute('data-nk-nav', direction);
        markEnter(direction);
        return;
      }
      const start = (document as ViewTransitionDocument).startViewTransition;
      if (typeof start !== 'function') {
        markEnter(direction);
        return;
      }
      // Before the link changes the page itself: the old page is pictured first, then the new one comes in.
      event.preventDefault();
      html.setAttribute('data-nk-nav', direction);
      let pushed = false;
      const go = () => {
        if (pushed) return;
        pushed = true;
        router.push(`${to}${url.search}${url.hash}`);
      };
      const transition = start.call(
        document,
        () =>
          new Promise<void>((done) => {
            waiting.current = done;
            window.setTimeout(done, NAV_WAIT_MS);
            go();
          }),
      );
      window.setTimeout(() => {
        if (!pushed) {
          transition.skipTransition?.();
          go();
        }
      }, START_WAIT_MS);
      const clear = () => html.removeAttribute('data-nk-nav');
      transition.finished.then(clear, clear);
    };
    // Back and Forward inside the site: the page that comes back moves in alone.
    const onPop = () => {
      if (!canMove()) return;
      const direction = navDirection(last.current, window.location.pathname);
      if (direction !== 'none') markEnter(direction);
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPop);
    };
  }, [router]);

  return null;
}
