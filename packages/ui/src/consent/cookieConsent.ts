/**
 * PDPA cookie consent for the web (project-docs/nestyk-cookie-consent-plan-20261109.md; Mos 9 Nov 2026 17:08: people
 * see what the web keeps and choose; what is necessary cannot be turned off).
 *
 * - Necessary: sign-in, security, hCaptcha. Always on, only shown.
 * - preferences: language, theme, last workspace, room-list view. Kept in browser storage only with consent.
 * - maps: Google Maps (loads Google's script, which sees the IP and the area viewed). Loads only with consent.
 *
 * Shared by the consumer web app (consent bar, remembered settings) and @nestyk/feature-listing (maps wait for
 * consent). No imports, so tests load it bare. Outside a web page (the phone app, server render) nothing is asked and
 * nothing is blocked: these rules are about the browser.
 */

/** Change it when the categories or the cookie text change: everyone is asked again. */
export const COOKIE_CONSENT_VERSION = '2026-11-13';

/** Where the choice is kept (listed on /privacy#cookies). */
export const COOKIE_CONSENT_KEY = 'nestyk.web.cookieConsent';

/** Footer and privacy-page links with this href open the cookie settings instead of navigating. */
export const COOKIE_SETTINGS_HREF = '#cookie-settings';

export type OptionalCookieCategory = 'preferences' | 'maps';
export type CookieChoice = Record<OptionalCookieCategory, boolean>;
export interface CookieConsent extends CookieChoice {
  version: string;
  /** ISO time of the choice. */
  at: string;
}

/** The "preferences" items. Removed from the browser when that category is off. */
export const PREFERENCE_STORAGE_KEYS: readonly string[] = [
  '@nestyk/preferred_locale',
  'nestyk.web.theme',
  'nestyk.web.lastRole',
  'nestyk.agentRooms.view',
];

const CHANGE_EVENT = 'nestyk:cookie-consent';
const OPEN_EVENT = 'nestyk:cookie-settings';

/** A saved choice for the current version, or null (never chosen, unreadable, or an older version). */
export function parseCookieConsent(
  raw: string | null | undefined,
  version: string = COOKIE_CONSENT_VERSION,
): CookieConsent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CookieConsent> | null;
    if (!parsed || parsed.version !== version || typeof parsed.at !== 'string') return null;
    return { version, at: parsed.at, preferences: parsed.preferences === true, maps: parsed.maps === true };
  } catch {
    return null;
  }
}

export function cookieConsentRecord(
  choice: CookieChoice,
  now: Date = new Date(),
  version: string = COOKIE_CONSENT_VERSION,
): CookieConsent {
  return { version, at: now.toISOString(), preferences: choice.preferences === true, maps: choice.maps === true };
}

type BrowserWindow = {
  localStorage?: { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };
  addEventListener(type: string, listener: (event: { key?: string | null }) => void): void;
  removeEventListener(type: string, listener: (event: { key?: string | null }) => void): void;
  dispatchEvent(event: unknown): boolean;
};

/** A browser page (React Native has `window` but no `document`; a server render has neither). */
function webWindow(): BrowserWindow | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;
  return window as unknown as BrowserWindow;
}

function storage(): NonNullable<BrowserWindow['localStorage']> | null {
  try {
    return webWindow()?.localStorage ?? null;
  } catch {
    return null; // storage blocked by the browser
  }
}

/** When storage is blocked the choice lasts for this page load. */
let choiceThisPage: CookieConsent | null = null;

export function readCookieConsent(): CookieConsent | null {
  const store = storage();
  if (store) {
    try {
      const saved = parseCookieConsent(store.getItem(COOKIE_CONSENT_KEY));
      if (saved) return saved;
    } catch {
      // unreadable: fall through
    }
  }
  return choiceThisPage && choiceThisPage.version === COOKIE_CONSENT_VERSION ? choiceThisPage : null;
}

/** Whether the web may use this category now. Before a choice the answer is no (opt-in). */
export function cookieConsentAllows(category: OptionalCookieCategory): boolean {
  if (!webWindow()) return true;
  return readCookieConsent()?.[category] === true;
}

function emit(name: string): void {
  const win = webWindow();
  if (!win) return;
  try {
    win.dispatchEvent(new Event(name));
  } catch {
    // very old browser: listeners re-read on their next render
  }
}

/** Saves the choice, removes stored settings when "preferences" is off, and tells every listener on the page. */
export function saveCookieConsent(choice: CookieChoice, now: Date = new Date()): CookieConsent {
  const consent = cookieConsentRecord(choice, now);
  choiceThisPage = consent;
  const store = storage();
  if (store) {
    try {
      store.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
    } catch {
      // blocked: kept for this page load only
    }
    if (!consent.preferences) {
      for (const key of PREFERENCE_STORAGE_KEYS) {
        try {
          store.removeItem(key);
        } catch {
          // nothing to remove
        }
      }
    }
  }
  emit(CHANGE_EVENT);
  return consent;
}

/** Called after a choice on this page or in another tab. Returns the unsubscribe function. */
export function onCookieConsentChange(listener: () => void): () => void {
  const win = webWindow();
  if (!win) return () => {};
  const onChange = () => listener();
  const onStorage = (event: { key?: string | null }) => {
    if (event.key === COOKIE_CONSENT_KEY || event.key === null) listener();
  };
  win.addEventListener(CHANGE_EVENT, onChange);
  win.addEventListener('storage', onStorage);
  return () => {
    win.removeEventListener(CHANGE_EVENT, onChange);
    win.removeEventListener('storage', onStorage);
  };
}

/** Opens the cookie settings (the consent bar listens). */
export function openCookieSettings(): void {
  emit(OPEN_EVENT);
}

export function onCookieSettingsOpen(listener: () => void): () => void {
  const win = webWindow();
  if (!win) return () => {};
  const handler = () => listener();
  win.addEventListener(OPEN_EVENT, handler);
  return () => win.removeEventListener(OPEN_EVENT, handler);
}
