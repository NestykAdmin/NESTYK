type ResetClient = {
  auth: {
    resetPasswordForEmail(email: string, options?: { captchaToken?: string; redirectTo?: string }): Promise<{ error: { message: string } | null }>;
    verifyOtp(args: { token_hash: string; type: 'recovery' }): Promise<{ data: { session: unknown }; error: { message: string } | null }>;
    updateUser(args: { password: string }): Promise<{ error: { message: string; name?: string } | null }>;
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
  if (error) throw new Error(error.message);
}

/** The email link lands here. Supabase puts the recovery session in the hash or a `code` query. */
export function isRecoveryLanding(href: string): boolean {
  const url = new URL(href, 'http://localhost');
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  return hash.get('type') === 'recovery' || url.searchParams.get('type') === 'recovery' || url.searchParams.has('code');
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
    throw Object.assign(new Error(error.message), missing ? { code: RECOVERY_SESSION_MISSING } : {});
  }
  await client.auth.signOut({ scope: 'others' }).catch(() => undefined);
}
