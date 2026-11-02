/** Public hCaptcha site key. Empty means the widget stays hidden until it is configured. */
export function hcaptchaSiteKey(): string {
  return (process.env.EXPO_PUBLIC_HCAPTCHA_SITE_KEY ?? '').trim();
}
