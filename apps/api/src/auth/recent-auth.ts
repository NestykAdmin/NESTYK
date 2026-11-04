/**
 * A (Jom, 3 Nov 2026; QA account-deletion doc): actions that cannot be taken back need an authentication in the last
 * few minutes, not just a valid token. Supabase lists how the session authenticated in the `amr` claim
 * ([{ method, timestamp }]); a refresh is listed as `token_refresh` and does not count. No imports: the token's
 * signature is checked by AuthGuard first, this only reads its payload.
 */
export const REAUTH_WINDOW_SECONDS = 5 * 60;

/** Unix seconds of the newest amr entry that is not a token refresh, or null. */
export function lastAuthenticatedAt(payload: unknown): number | null {
  const amr = payload && typeof payload === 'object' ? (payload as { amr?: unknown }).amr : undefined;
  if (!Array.isArray(amr)) return null;
  let last: number | null = null;
  for (const entry of amr) {
    if (!entry || typeof entry !== 'object') continue;
    const { method, timestamp } = entry as { method?: unknown; timestamp?: unknown };
    if (typeof method !== 'string' || method === 'token_refresh') continue;
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) continue;
    if (last === null || timestamp > last) last = timestamp;
  }
  return last;
}

function jwtPayload(token: string): unknown {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/** The token authenticated within REAUTH_WINDOW_SECONDS of `nowSeconds`. A dev token has no amr and never passes. */
export function recentlyAuthenticated(token: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  const at = lastAuthenticatedAt(jwtPayload(token));
  return at !== null && nowSeconds - at <= REAUTH_WINDOW_SECONDS;
}
