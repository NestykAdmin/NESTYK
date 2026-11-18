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

/** The policy text. `dev`: Next dev needs eval (fast refresh) and its websocket. */
function guestCsp({ supabaseUrl, dev }) {
  const supabase = originOf(supabaseUrl);
  const script = ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])];
  const connect = ["'self'", ...(supabase ? [supabase] : []), ...(dev ? ['ws:'] : [])];
  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/** Paths the policy covers: everything except the API, Next files and the account paths. */
// Also skipped, like the middleware: the room share page /s/<token> and signing links /sign/<token> (Maps, full API URL).
const GUEST_CSP_GROUP = `((?!api(?:/|$)|_next/|_vercel/|s/|sign/|(?:${ACCOUNT_PATHS.map((p) => p.slice(1)).join('|')})(?:/|$)).*)`;
/** Next `headers()` source (named parameter form). */
const GUEST_CSP_SOURCE = `/:path${GUEST_CSP_GROUP}`;

module.exports = { guestCsp, GUEST_CSP_GROUP, GUEST_CSP_SOURCE };
