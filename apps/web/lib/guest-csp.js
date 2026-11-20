/**
 * Content-Security-Policy of the guest pages (AUTH-2.6, nestyk-guest-session-plan-20261112.md B7, review R9).
 * nestyk.com is one site with one sign-in in local storage, so a script on a guest page could read it. The policy
 * lets only this site's own scripts run and lets the page connect only to this site (the API is behind /api) and
 * the Supabase project (token refresh). 'unsafe-inline' stays for Next's inline bootstrap: a nonce would make every
 * page dynamic and lose the page cache (plan F13). The account and role pages handed to the consumer-app
 * (lib/account-routes.js) are not covered; they load hCaptcha, Maps and the PDF viewer.
 * Plain CommonJS for next.config.js.
 */
const { ACCOUNT_PATHS } = require('./account-routes');

function originOf(value) {
  const text = String(value ?? '').trim();
  if (!/^https?:\/\/[^/]/i.test(text)) return '';
  try {
    return new URL(text).origin;
  } catch {
    return '';
  }
}

/**
 * Google Maps hosts for room pages (S7.3 plan D1, Mos 19 Nov 2026), from the allowlist in Google's "Content Security
 * Policy Guide" for the Maps JavaScript API. The map script itself loads only after the person allows the maps cookie
 * category (MapConsentGate), so these hosts are unused until then.
 */
const MAPS_SCRIPT = ['https://*.googleapis.com', 'https://*.gstatic.com', 'https://*.google.com', 'https://*.ggpht.com', 'https://*.googleusercontent.com', 'blob:'];
const MAPS_CONNECT = ['https://*.googleapis.com', 'https://*.google.com', 'https://*.gstatic.com', 'data:', 'blob:'];

/**
 * The policy text. `dev`: Next dev needs eval (fast refresh) and its websocket. `maps`: room pages, which may show a
 * Google map.
 */
function guestCsp({ supabaseUrl, dev, maps = false }) {
  const supabase = originOf(supabaseUrl);
  const script = ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), ...(maps ? MAPS_SCRIPT : [])];
  const connect = ["'self'", ...(supabase ? [supabase] : []), ...(dev ? ['ws:'] : []), ...(maps ? MAPS_CONNECT : [])];
  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    `style-src 'self' 'unsafe-inline'${maps ? ' https://fonts.googleapis.com' : ''}`,
    "img-src 'self' data: blob: https:",
    `font-src 'self' data:${maps ? ' https://fonts.gstatic.com' : ''}`,
    `connect-src ${connect.join(' ')}`,
    ...(maps ? ['worker-src blob:'] : []),
    maps ? 'frame-src https://*.google.com' : "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/** Paths the policy covers: everything except the API, Next files and the account paths. */
// Also skipped, like the middleware: the room share page /s/<token> and signing links /sign/<token> (Maps, full API URL).
// Room pages (/rooms/<id>, /en/rooms/<id>, ...) and the search page (/search, /en/search, ...) have the maps policy
// below: a page with two policies obeys both, so they are left out here.
const GUEST_CSP_GROUP = `((?!api(?:/|$)|_next/|_vercel/|s/|sign/|(?:(?:en|ja|zh)/)?rooms/|(?:(?:en|ja|zh)/)?search$|(?:${ACCOUNT_PATHS.map((p) => p.slice(1)).join('|')})(?:/|$)).*)`;
/** Next `headers()` source (named parameter form). */
const GUEST_CSP_SOURCE = `/:path${GUEST_CSP_GROUP}`;

/** Room pages in every language (the same languages as i18n/routing.ts). */
const GUEST_ROOM_CSP_SOURCES = ['/rooms/:id*', '/:locale(en|ja|zh)/rooms/:id*'];
/** The search page in every language: its map view (?view=map, S4.3 plan D1) shows a Google map. */
const GUEST_SEARCH_CSP_SOURCES = ['/search', '/:locale(en|ja|zh)/search'];

module.exports = { guestCsp, GUEST_CSP_GROUP, GUEST_CSP_SOURCE, GUEST_ROOM_CSP_SOURCES, GUEST_SEARCH_CSP_SOURCES };
