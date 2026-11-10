/**
 * Sign-in and sign-up errors the screens can tell apart (QA 9 Nov 2026, login network error).
 * Only a real wrong password / wrong code gets that text; a network failure or any other cause gets the generic one.
 * No imports: tests load this file bare.
 */

type SupabaseAuthError = { message?: string; name?: unknown; status?: unknown; code?: unknown };

/** Text of the dev-login refusal in AuthContext, and Supabase's text when an old server sends no code. */
const WRONG_PASSWORD_TEXTS = ['Invalid email or password', 'Invalid login credentials'];

/** The error signIn throws for a Supabase refusal: same message as before, plus Supabase's name, status and code. */
export function signInFailure(error: SupabaseAuthError | null | undefined): Error {
  const failure = new Error(error?.message ?? 'Sign in failed');
  if (!error) return failure;
  if (typeof error.name === 'string' && error.name) failure.name = error.name;
  return Object.assign(failure, { status: error.status, code: error.code });
}

/** Supabase's "wrong email or password" (auth-js code invalid_credentials), or the dev-login refusal. */
export function isInvalidCredentials(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  if (code === 'invalid_credentials') return true;
  return code == null && WRONG_PASSWORD_TEXTS.includes(error.message);
}

/** Supabase's "this sign-up code is wrong or expired" (auth-js code otp_expired). */
export function isInvalidOtp(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'otp_expired';
}

export type SignInErrorKind = 'invalidCredentials' | 'network' | 'emailNotConfirmed' | 'rateLimited' | 'generic';

/**
 * Why a sign-in failed, so the login page shows one of its own texts and never Supabase's or the API's message
 * (QA reply on the login error cases, 9 Nov 2026). "network" = no answer, or a 5xx from Supabase or from
 * POST /auth/sync (a proxy error page included): the user can only wait or check their connection.
 */
export function signInErrorKind(error: unknown): SignInErrorKind {
  if (isInvalidCredentials(error)) return 'invalidCredentials';
  if (!(error instanceof Error)) return 'generic';
  const { code, status } = error as Error & { code?: unknown; status?: unknown };
  if (code === 'NETWORK_ERROR' || error.name === 'AuthRetryableFetchError' || error instanceof TypeError) return 'network';
  if (typeof status === 'number' && status >= 500) return 'network';
  if (code === 'email_not_confirmed') return 'emailNotConfirmed';
  if (code === 'over_request_rate_limit' || status === 429) return 'rateLimited';
  return 'generic';
}

/**
 * Text for a failed sign-up or password-reset request (QA reply item 3, 9 Nov 2026): the same causes as signInErrorKind,
 * our own text for each, never Supabase's or the API's message. The screen handles its own special cases first.
 */
export function authErrorText(error: unknown, texts: { network: string; rateLimited: string; fallback: string }): string {
  const kind = signInErrorKind(error);
  if (kind === 'network') return texts.network;
  if (kind === 'rateLimited') return texts.rateLimited;
  return texts.fallback;
}
