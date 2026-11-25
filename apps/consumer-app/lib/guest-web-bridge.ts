import type { StoredAuthSession } from './auth/session-storage';

/**
 * The guest web shown inside the app (W1, project-docs nestyk-guest-app-webview-plan-20261124.md; Mos 24 Nov 2026:
 * the app keeps the sign-in and the page asks it for a token, so only the app ever refreshes it).
 * Pure rules only (type imports), so lib/guest-web-bridge.test.cjs loads this file bare. The page's side is
 * apps/web/lib/app-bridge.ts; apps/web/lib/app-bridge.test.cjs checks both sides against each other.
 */

/** Added to the WebView's user agent so the page knows it is inside the app (same as the web's APP_UA_MARK). */
export const APP_UA_MARK = 'NestykApp/1';

const LOCALE_PREFIX: Record<string, string> = { en: '/en', ja: '/ja', zh: '/zh' };

/** Origin of the guest web, or null when the address is not http(s). */
export function guestWebOrigin(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

/** A guest web page in the app's language: Thai has no prefix, the others are /en, /ja, /zh (the web's URLs). */
export function guestWebUrl(baseUrl: string, locale: string, path: string): string {
  const origin = guestWebOrigin(baseUrl) ?? baseUrl.replace(/\/+$/, '');
  const prefix = LOCALE_PREFIX[locale] ?? '';
  const rest = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return prefix || rest ? `${origin}${prefix}${rest}` : `${origin}/`;
}

export type NavigationDecision = 'allow' | 'app' | 'external' | 'block';

/** Screens of the app the guest web hands over to (step 2, design W): sign-in, sign-up, password reset and legal. */
export type AppPage = 'signIn' | 'register' | 'resetPassword' | 'privacy' | 'terms';

export const APP_PAGE_ROUTE: Record<AppPage, string> = {
  signIn: '/login',
  register: '/register',
  resetPassword: '/reset-password',
  privacy: '/privacy',
  terms: '/terms',
};

const APP_PAGES = Object.keys(APP_PAGE_ROUTE) as AppPage[];
const PAGE_BY_PATH = new Map(APP_PAGES.map((page) => [APP_PAGE_ROUTE[page], page] as const));

/**
 * The account web's other paths on our site (apps/web lib/account-routes.js ACCOUNT_PAGE_PATHS + ACCOUNT_ROLE_PATHS).
 * In the app they never load in the view: the app has its own screens and roles.
 */
const OTHER_ACCOUNT_PATHS = ['/no-access', '/agent', '/tenant', '/landlord', '/admin', '/self-owner', '/owner'];

function sameOriginPath(url: string, origin: string | null): string | null {
  if (!origin) return null;
  try {
    const parsed = new URL(url);
    return parsed.origin === origin ? parsed.pathname : null;
  } catch {
    return null;
  }
}

/** The app screen for an account page of our own site ("/login?next=…" → signIn), or null. */
export function appPageOf(url: string, origin: string | null): AppPage | null {
  const path = sameOriginPath(url, origin);
  return path ? (PAGE_BY_PATH.get(path.replace(/\/+$/, '') || '/') ?? null) : null;
}

function isOtherAccountPath(path: string): boolean {
  return OTHER_ACCOUNT_PATHS.some((root) => path === root || path.startsWith(`${root}/`));
}

/** Guest side-menu items (packages/ui mobileDrawerMenuMatrix) and the web page each opens in the view. */
const GUEST_MENU_WEB_PATH: Record<string, string> = { '/favorites': '/saved', '/viewings': '/viewing-requests' };

export function guestWebPathForMenu(path: string): string | null {
  return GUEST_MENU_WEB_PATH[path] ?? null;
}

/**
 * Where the page may go. Our site stays in the view; another site, a phone number or an email opens outside the
 * app; scripts, files, data and app intents never load. Frames other than the main one (the area map) may load
 * https pages, since the page's own CSP already limits them.
 */
export function navigationDecision(url: string, origin: string | null, isTopFrame: boolean): NavigationDecision {
  if (url === 'about:blank') return 'allow';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'block';
  }
  if (parsed.protocol === 'tel:' || parsed.protocol === 'mailto:') return 'external';
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'block';
  if (origin && parsed.origin === origin) {
    if (!isTopFrame) return 'allow';
    if (appPageOf(url, origin)) return 'app';
    return isOtherAccountPath(parsed.pathname) ? 'block' : 'allow';
  }
  if (!isTopFrame) return parsed.protocol === 'https:' ? 'allow' : 'block';
  return 'external';
}

/** The app answers only a message sent by a page of our own guest web. */
export function fromGuestWeb(pageUrl: string | undefined, origin: string | null): boolean {
  if (!pageUrl || !origin) return false;
  try {
    return new URL(pageUrl).origin === origin;
  } catch {
    return false;
  }
}

export type WebRequest =
  | { type: 'session.get'; id: string }
  | { type: 'token.get'; id: string }
  | { type: 'auth.signOut' }
  | { type: 'app.menu' }
  | { type: 'app.notifications' }
  | { type: 'app.open'; page: AppPage };

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** A message from the page, or null for anything the app does not handle. */
export function parseWebMessage(data: string): WebRequest | null {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const { type, id, page } = value as { type?: unknown; id?: unknown; page?: unknown };
  if (type === 'auth.signOut' || type === 'app.menu' || type === 'app.notifications') return { type };
  if (type === 'app.open') return typeof page === 'string' && (APP_PAGES as string[]).includes(page) ? { type, page: page as AppPage } : null;
  if ((type === 'session.get' || type === 'token.get') && typeof id === 'string' && ID.test(id)) return { type, id };
  return null;
}

export type ProfileForWeb = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  roles: string[];
};

/** Who is signed in, as the page shows it. Never the token. */
export function profileForWeb(session: StoredAuthSession | null): ProfileForWeb | null {
  if (!session) return null;
  return {
    userId: session.userId,
    email: session.email,
    firstName: session.firstName,
    lastName: session.lastName,
    avatarUrl: session.avatarUrl ?? null,
    roles: [...session.roles],
  };
}

/**
 * Script that hands one reply to the page's receiver (apps/web lib/app-bridge.ts APP_RECEIVE). JSON keeps it one call.
 * It runs only on a page of the guest web's own origin, in case the view moved elsewhere while the app was answering.
 */
export function receiveScript(payload: object, origin: string | null): string {
  // Line and paragraph separators are written as escapes, so older JavaScript engines read the call as one line.
  const json = JSON.stringify(payload).split('\u2028').join('\\u2028').split('\u2029').join('\\u2029');
  return `(function(){try{if(location.origin===${JSON.stringify(origin ?? '')}&&window.__nestykAppReceive){window.__nestykAppReceive(${json});}}catch(e){}})();true;`;
}

export type ScreenEdges = { top: number; bottom: number };

function edge(value: number): number {
  return Number.isFinite(value) ? Math.min(200, Math.max(0, Math.round(value))) : 0;
}

/**
 * Runs before the page loads, on our own origin only: marks the page as inside the app (the flag, and the
 * data-nk-app attribute the page's CSS reads, so the app bar shows with no flash) and gives it the phone's status
 * bar and home bar heights (--nk-app-top / --nk-app-bottom), since the view now fills the screen (step 2).
 */
export function bootScript(origin: string | null, edges: ScreenEdges = { top: 0, bottom: 0 }): string {
  const top = edge(edges.top);
  const bottom = edge(edges.bottom);
  return (
    `(function(){try{if(location.origin===${JSON.stringify(origin ?? '')}){window.__NESTYK_APP__={v:1};` +
    `var mark=function(el){el.setAttribute('data-nk-app','1');el.style.setProperty('--nk-app-top','${top}px');el.style.setProperty('--nk-app-bottom','${bottom}px');};` +
    `if(typeof document!=='undefined'){if(document.documentElement){mark(document.documentElement);}` +
    `else if(typeof MutationObserver!=='undefined'){var o=new MutationObserver(function(){if(document.documentElement){o.disconnect();mark(document.documentElement);}});o.observe(document,{childList:true});}}` +
    `}}catch(e){}})();true;`
  );
}
