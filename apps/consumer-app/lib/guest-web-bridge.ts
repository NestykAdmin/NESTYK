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

export type NavigationDecision = 'allow' | 'external' | 'block';

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
  if (origin && parsed.origin === origin) return 'allow';
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

export type WebRequest = { type: 'session.get'; id: string } | { type: 'token.get'; id: string } | { type: 'auth.signOut' };

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
  const { type, id } = value as { type?: unknown; id?: unknown };
  if (type === 'auth.signOut') return { type };
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

/** Runs before the page loads: marks the page as inside the app, on our own origin only. */
export function bootScript(origin: string | null): string {
  return `(function(){try{if(location.origin===${JSON.stringify(origin ?? '')}){window.__NESTYK_APP__={v:1};}}catch(e){}})();true;`;
}
