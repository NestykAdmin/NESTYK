/**
 * Public Cloudflare Turnstile site key. Empty means the widget stays hidden until it is configured.
 * Replaced hCaptcha (Jom, 12 Nov 2026): the env name changed too, so an old hCaptcha key is never sent to Turnstile.
 */
export function captchaSiteKey(): string {
  return (process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim();
}
