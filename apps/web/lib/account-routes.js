/**
 * Account web on the guest site (nestyk-guest-session-plan-20261112.md, A1–A3, Mos D1 12 Nov 2026).
 * nestyk.com is one site: the guest web (this Next app) owns it and hands these paths to the
 * consumer-app deploy, so both share one browser storage and the guest web can see the sign-in.
 * Plain CommonJS so next.config.js can use it. middleware.ts repeats the paths in its matcher
 * (Next needs a literal there); lib/account-routes.test.cjs keeps the two in step.
 */

/** Sign-in and legal pages (consumer-app AUTH_PATHS + LEGAL_PATHS). */
const ACCOUNT_PAGE_PATHS = ['/login', '/register', '/reset-password', '/no-access', '/privacy', '/terms'];

/** Role sites (consumer-app ROLE_PATH) with everything below them. */
const ACCOUNT_ROLE_PATHS = ['/agent', '/tenant', '/landlord', '/admin'];

/** Files of the Expo web build (scripts, styles, fonts, images). */
const ACCOUNT_ASSET_PATHS = ['/_expo', '/assets'];

const ACCOUNT_PATHS = [...ACCOUNT_PAGE_PATHS, ...ACCOUNT_ROLE_PATHS, ...ACCOUNT_ASSET_PATHS];

/**
 * Origin of the consumer-app deploy from ACCOUNT_WEB_UPSTREAM (server-only env).
 * Unset or not an http(s) address: '' and nothing is handed across (behaviour before this plan).
 */
function accountWebUpstream(value) {
  const text = String(value ?? '').trim();
  if (!/^https?:\/\/[^/]/i.test(text)) return '';
  try {
    return new URL(text).origin;
  } catch {
    return '';
  }
}

/** Next rewrites for the account paths. Query strings (e.g. ?next=) go across unchanged. */
function accountRewrites(upstream) {
  if (!upstream) return [];
  const pages = ACCOUNT_PAGE_PATHS.map((p) => ({ source: p, destination: `${upstream}${p}` }));
  const trees = [...ACCOUNT_ROLE_PATHS, ...ACCOUNT_ASSET_PATHS].flatMap((p) => [
    { source: p, destination: `${upstream}${p}` },
    { source: `${p}/:path*`, destination: `${upstream}${p}/:path*` },
  ]);
  return [...pages, ...trees];
}

/**
 * Local dev only (Mos 13 Nov 2026: one `npm run dev`, no web export): point ACCOUNT_WEB_UPSTREAM at the
 * Expo dev server (http://127.0.0.1:8081). Its scripts load from paths such as /node_modules/…/entry.bundle,
 * so anything this app has no page for goes there too. Never on a deploy: there the account web is a
 * static build and only ACCOUNT_PATHS go across. Live reload (HMR) does not pass through; refresh instead.
 */
function accountDevFallback(upstream, nodeEnv) {
  if (!upstream || nodeEnv !== 'development') return [];
  return [{ source: '/:path*', destination: `${upstream}/:path*` }];
}

module.exports = {
  ACCOUNT_PAGE_PATHS,
  ACCOUNT_ROLE_PATHS,
  ACCOUNT_ASSET_PATHS,
  ACCOUNT_PATHS,
  accountWebUpstream,
  accountRewrites,
  accountDevFallback,
};
