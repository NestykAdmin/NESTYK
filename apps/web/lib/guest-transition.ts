/**
 * Page change animation, design A (Mos 27 Nov 2026, canvas page "pageanim"): a deeper page slides in from the right,
 * going back slides it away, tabs and pages of the same level fade. Phones and the app only (guest.css), never with
 * reduced motion. Pure rules: lib/guest-transition.test.cjs loads this file bare.
 */

export type NavDirection = 'push' | 'back' | 'fade' | 'none';

/**
 * How deep each guest page sits: the tabs (0), the search and area list (1), results and an area (2), a room (3).
 * Paths without the language prefix. A path not listed is not a guest page and is never animated.
 */
export const PAGE_DEPTHS: readonly (readonly [string, number])[] = [
  ['^/(saved|viewing-requests|profile)?$', 0],
  ['^/(find|areas)$', 1],
  ['^/(search|rent/[^/]+)$', 2],
  ['^/rooms/[^/]+$', 3],
];

/** Languages with a prefix in the URL (i18n/routing.ts: Thai has none). */
const LOCALE_PREFIX = /^\/(en|ja|zh)(?=\/|$)/;

/** Session key: the path of the page that was just left (a full page load reads it). */
export const NAV_FROM_KEY = 'nk.nav.from';

export function stripLocale(pathname: string): string {
  return pathname.replace(LOCALE_PREFIX, '') || '/';
}

export function pageDepth(pathname: string): number | null {
  const path = stripLocale(pathname);
  const found = PAGE_DEPTHS.find(([pattern]) => new RegExp(pattern).test(path));
  return found ? found[1] : null;
}

/**
 * Pages served with their own CSP (maps: next.config, lib/guest-csp.js): a plain link there is a full page load and is
 * never turned into an in-page change.
 */
export function ownCsp(pathname: string): boolean {
  return /^\/(rooms\/[^/]+|search)$/.test(stripLocale(pathname));
}

/**
 * Deeper (or a room from a room) slides in; shallower slides back, except back to a tab from a middle page, which
 * fades like a tab change; the same level fades. Unknown pages and the same page are not animated.
 */
export function navDirection(from: string | null | undefined, to: string): NavDirection {
  if (from == null) return 'none';
  const a = pageDepth(from);
  const b = pageDepth(to);
  if (a === null || b === null || stripLocale(from) === stripLocale(to)) return 'none';
  if (b > a || (a === 3 && b === 3)) return 'push';
  if (b < a) return b > 0 || a === 3 ? 'back' : 'fade';
  return 'fade';
}

/**
 * Inline <head> script for full page loads (a room opens with a plain link for its own CSP, review R1): the leaving
 * page keeps its path (pagehide); the new page reads it before its first frame (pagereveal) and marks <html
 * data-nk-nav> for the cross-document view transition. Same rules as navDirection (the test runs both).
 */
export const NAV_REVEAL_SCRIPT =
  '(function(){var D=' +
  JSON.stringify(PAGE_DEPTHS) +
  ',K=' +
  JSON.stringify(NAV_FROM_KEY) +
  ',L=' +
  LOCALE_PREFIX.toString() +
  ';function p(x){return String(x).replace(L,"")||"/"}' +
  'function d(x){x=p(x);for(var i=0;i<D.length;i++)if(new RegExp(D[i][0]).test(x))return D[i][1];return null}' +
  'function r(f,t){if(f==null)return"none";var a=d(f),b=d(t);if(a===null||b===null||p(f)===p(t))return"none";' +
  'if(b>a||(a===3&&b===3))return"push";if(b<a)return b>0||a===3?"back":"fade";return"fade"}' +
  'function s(){try{return sessionStorage}catch(e){return null}}' +
  'addEventListener("pagereveal",function(e){var f=null;try{var st=s();if(st){f=st.getItem(K);st.removeItem(K)}}catch(x){}' +
  'if(!e.viewTransition)return;var v=r(f,location.pathname);if(v==="none")return;var h=document.documentElement;' +
  'h.setAttribute("data-nk-nav",v);var c=function(){h.removeAttribute("data-nk-nav")};e.viewTransition.finished.then(c,c)});' +
  'addEventListener("pagehide",function(){try{var st=s();if(st)st.setItem(K,location.pathname)}catch(x){}})})();';
