type ResetClient = {
  auth: {
    resetPasswordForEmail(email: string, options?: { captchaToken?: string; redirectTo?: string }): Promise<{ error: { message: string } | null }>;
    verifyOtp(args: { email: string; token: string; type: 'recovery' } | { token_hash: string; type: 'recovery' }): Promise<{ data: { session: unknown }; error: { message: string } | null }>;
    updateUser(args: { password: string }): Promise<{ error: { message: string } | null }>;
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

export async function verifyRecoveryCode(client: ResetClient, email: string, token: string): Promise<void> {
  const { data, error } = await client.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'recovery',
  });
  if (error || !data.session) throw new Error(error?.message ?? 'Recovery code was not accepted');
}

/** Stores the new password, then signs the other devices out. The current session stays. */
export async function saveResetPassword(client: ResetClient, newPassword: string): Promise<void> {
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
  await client.auth.signOut({ scope: 'others' }).catch(() => undefined);
}
