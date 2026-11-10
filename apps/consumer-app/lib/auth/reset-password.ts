import { signInFailure } from './auth-error';

/** Supabase's error in `{ error }`: name, status and code tell a 429 or a dropped connection apart (QA Aof 10 Nov 2026). */
type ResetError = { message: string; name?: string; status?: number; code?: string };

type ResetClient = {
  auth: {
    resetPasswordForEmail(email: string, options?: { captchaToken?: string; redirectTo?: string }): Promise<{ error: ResetError | null }>;
    verifyOtp(args: { token_hash: string; type: 'recovery' }): Promise<{ data: { session: unknown }; error: { message: string } | null }>;
    updateUser(args: { password: string }): Promise<{ error: ResetError | null }>;
    signOut(args: { scope: 'others' }): Promise<unknown>;
  };
};

export async function requestPasswordReset(
  client: ResetClient,
  email: string,
  captchaToken?: string,
  redirectTo?: string,
): Promise<void> {
  const options: { captchaToken?: string; redirectTo?: string } = {};
  if (captchaToken) options.captchaToken = captchaToken;
  if (redirectTo) options.redirectTo = redirectTo;
  const { error } = await client.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    Object.keys(options).length ? options : undefined,
  );
  // Keep Supabase's name, status and code: the page picks "too many attempts" / "can't connect" from them.
  if (error) throw signInFailure(error);
}

/**
 * The email link lands here with something that can sign in: a token hash, a PKCE `code` (emails sent before the
 * template changed), or an access token in the hash. "?type=recovery" alone is not a link (QA 4 Nov 2026 item 4).
 */
export function isRecoveryLanding(href: string): boolean {
  const url = new URL(href, 'http://localhost');
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  return url.searchParams.has('code') || recoveryTokenHash(href) !== null ||
    (hash.get('type') === 'recovery' && hash.has('access_token'));
}

/** Says it is a reset link (`type=recovery`, `token_hash`) but carries nothing to sign in with: cut or edited. */
export function brokenRecoveryLanding(href: string): boolean {
  if (!href) return false;
  const url = new URL(href, 'http://localhost');
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const saysRecovery = url.searchParams.get('type') === 'recovery' || hash.get('type') === 'recovery' || url.searchParams.has('token_hash');
  return saysRecovery && !isRecoveryLanding(href);
}

/**
 * The reset email links to `/reset-password?token_hash=…&type=recovery`. Unlike a PKCE `code`, a token hash needs
 * nothing saved in the browser that asked, so the link works on any device (a phone that asked in the app included).
 */
export function recoveryTokenHash(href: string): string | null {
  if (!href) return null;
  const url = new URL(href, 'http://localhost');
  const tokenHash = url.searchParams.get('token_hash')?.trim();
  return tokenHash && url.searchParams.get('type') === 'recovery' ? tokenHash : null;
}

/** Signs in with the link's token hash for the new-password step. A used or expired link throws. */
export async function verifyRecoveryLink(client: ResetClient, tokenHash: string): Promise<void> {
  const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
  if (error || !data.session) throw new Error(error?.message ?? 'Recovery link was not accepted');
}

/** Stores the new password, then signs the other devices out. The current session stays. */
/**
 * RECOVERY_SESSION_MISSING: there is no reset session to save with (a link without a token, or a `?code=` that did
 * not sign in). The screen says the link no longer works instead of Supabase's "Auth session missing!" (QA 4 Nov 2026).
 */
export const RECOVERY_SESSION_MISSING = 'RECOVERY_SESSION_MISSING';

export async function saveResetPassword(client: ResetClient, newPassword: string): Promise<void> {
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) {
    const missing = error.name === 'AuthSessionMissingError' || /auth session missing/i.test(error.message);
    throw Object.assign(signInFailure(error), missing ? { code: RECOVERY_SESSION_MISSING } : {});
  }
  await client.auth.signOut({ scope: 'others' }).catch(() => undefined);
}
