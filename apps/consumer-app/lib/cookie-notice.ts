/**
 * PDPA / cookie plan (project-docs/nestyk-cookie-consent-plan-20261109.md, Mos + QA 9 Nov 2026).
 * Pure helpers and data, no imports (tests load it bare):
 * - L3: the version of each legal text. Change a date when that text changes: new sign-ups record the new version.
 *   The cookie choice has its own version (COOKIE_CONSENT_VERSION in @nestyk/ui/cookie-consent).
 * - FE2: what the web keeps in browser storage, and which outside services may set their own cookies.
 *   Necessary items, plus settings and Google Maps only when the user allows them in the cookie bar. No advertising,
 *   analytics or tracking (R3: adding any of those needs a new consent category first).
 * - 3.3a: what a sign-up records in Supabase user metadata.
 */

export const TERMS_VERSION = '2026-11-13';
export const PRIVACY_VERSION = '2026-11-13';

/** The cookie part of the privacy page. */
export const COOKIES_HREF = '/privacy#cookies';

/** Same as COOKIE_SETTINGS_HREF in @nestyk/ui/cookie-consent (lib/cookie-notice.test.cjs checks): opens the settings. */
export const COOKIE_SETTINGS_HREF = '#cookie-settings';

export type StorageItemId =
  | 'supabase' | 'session' | 'lastActivity' | 'authEvent' | 'expiredAt' | 'cookieConsent'
  | 'locale' | 'theme' | 'lastRole' | 'roomsView';

export type StorageItemType = 'necessary' | 'preference';

/** Shown on /privacy#cookies. Keep in step with the keys the web writes (lib/cookie-notice.test.cjs checks the source). */
export const BROWSER_STORAGE_ITEMS: readonly { id: StorageItemId; name: string; type: StorageItemType }[] = [
  { id: 'supabase', name: 'sb-<project>-auth-token', type: 'necessary' },
  { id: 'session', name: 'nestyk.auth.session.v1', type: 'necessary' },
  { id: 'lastActivity', name: 'nestyk.web.lastActivity', type: 'necessary' },
  { id: 'authEvent', name: 'nestyk.web.authEvent', type: 'necessary' },
  { id: 'expiredAt', name: 'nestyk.web.expiredAt', type: 'necessary' },
  { id: 'cookieConsent', name: 'nestyk.web.cookieConsent', type: 'necessary' },
  { id: 'locale', name: '@nestyk/preferred_locale', type: 'preference' },
  { id: 'theme', name: 'nestyk.web.theme', type: 'preference' },
  { id: 'lastRole', name: 'nestyk.web.lastRole', type: 'preference' },
  { id: 'roomsView', name: 'nestyk.agentRooms.view', type: 'preference' },
];

export type ServiceId = 'turnstile' | 'googleMaps';

export const THIRD_PARTY_SERVICES: readonly { id: ServiceId; name: string; policyUrl: string }[] = [
  // hCaptcha → Turnstile (Jom, 12 Nov 2026). Policy link pending legal review (plan D5).
  { id: 'turnstile', name: 'Cloudflare Turnstile', policyUrl: 'https://www.cloudflare.com/privacypolicy/' },
  { id: 'googleMaps', name: 'Google Maps', policyUrl: 'https://policies.google.com/privacy' },
];

export interface SignupLegalMetadata {
  terms_version: string;
  terms_accepted_at: string;
  privacy_version_shown: string;
}

/**
 * 3.3a: saved with the sign-up (Supabase `raw_user_meta_data`). The terms are accepted (the register checkbox, which
 * must be ticked before sign-up runs). The privacy policy is only shown (PDPA s.23 notice), never "accepted".
 */
export function signupLegalMetadata(now: Date = new Date()): SignupLegalMetadata {
  return {
    terms_version: TERMS_VERSION,
    terms_accepted_at: now.toISOString(),
    privacy_version_shown: PRIVACY_VERSION,
  };
}
