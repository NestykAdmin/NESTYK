/**
 * Dev web only: when the API runs on this machine (localhost / 127.0.0.1) on another port, call it through the
 * Metro dev server on the page's own origin ("/api/..."), which forwards it (scripts/dev-api-proxy.cjs).
 * Claude's built-in browser blocks a page on :8081 from calling another local port; Chrome works either way.
 * Phones, builds and remote APIs (staging) keep the URL as it is. Off with EXPO_PUBLIC_WEB_API_PROXY=false.
 * No imports so the tests can load it bare.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export interface WebApiProxyContext {
  dev: boolean;
  isWeb: boolean;
  /** window.location.origin of the page, e.g. "http://127.0.0.1:8081". */
  origin: string | null | undefined;
  /** EXPO_PUBLIC_WEB_API_PROXY ("false" turns it off). */
  flag?: string | null;
}

export function webDevApiUrl(apiUrl: string, ctx: WebApiProxyContext): string {
  if (!ctx.dev || !ctx.isWeb || !ctx.origin) return apiUrl;
  if (String(ctx.flag ?? '').trim().toLowerCase() === 'false') return apiUrl;
  let api: URL;
  let page: URL;
  try {
    api = new URL(apiUrl);
    page = new URL(ctx.origin);
  } catch {
    return apiUrl;
  }
  if (!LOOPBACK_HOSTS.has(api.hostname) || !LOOPBACK_HOSTS.has(page.hostname)) return apiUrl;
  if (!api.pathname.startsWith('/api') || api.origin === page.origin) return apiUrl;
  return `${page.origin}${api.pathname.replace(/\/+$/, '')}`;
}
