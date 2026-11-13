/**
 * Fixed data of the guest web (design v2.3, project-docs/nestyk-guest-listing-v23-design-and-s2-plan-20261111.md).
 * Pure data and helpers, no imports: lib/guest-site.test.cjs loads it bare.
 * Labels live in @nestyk/i18n (`t.guest.*`); keys here are English and are looked up there at render time.
 */

/** Pages of the guest web. A page that is not ready shows as "coming soon" in the menu and the tab bar. */
export type GuestPageKey =
  | 'home'
  | 'search'
  | 'areas'
  | 'commute'
  | 'articles'
  | 'about'
  | 'saved'
  | 'profile'
  | 'help'
  | 'viewingRequests'
  | 'theme'
  /** Room detail /rooms/<id> (S7). */
  | 'rooms'
  /** Area pages /rent/<area> (SEO-1). */
  | 'rent';

/** Turn a page on here when its task is done (S3 home and areas, S4 search, ...). */
const GUEST_PAGE_READY: Record<GuestPageKey, boolean> = {
  home: true,
  search: true,
  areas: false,
  commute: false,
  articles: false,
  about: false,
  saved: true,
  profile: true,
  help: false,
  viewingRequests: false,
  theme: false,
  rooms: false,
  rent: false,
};

export function isGuestPageReady(key: GuestPageKey): boolean {
  return GUEST_PAGE_READY[key] === true;
}

export type GuestNavKey = 'search' | 'areas' | 'commute' | 'articles' | 'about';

/** Header menu: all 5 items are always shown (Mos 11 Nov 2026). */
export const GUEST_NAV: readonly { key: GuestNavKey; href: string }[] = [
  { key: 'search', href: '/search' },
  { key: 'areas', href: '/#areas' },
  { key: 'commute', href: '/commute' },
  { key: 'articles', href: '/articles' },
  { key: 'about', href: '/about' },
];

export type GuestTabKey = 'home' | 'search' | 'saved' | 'profile';

/** Bottom tab bar of the mobile web, the same 4 tabs as the app. */
export const GUEST_TABS: readonly { key: GuestTabKey; href: string }[] = [
  { key: 'home', href: '/' },
  { key: 'search', href: '/search' },
  { key: 'saved', href: '/saved' },
  { key: 'profile', href: '/profile' },
];

/** The tab of a path without the locale prefix ("/search/map" → search). Null for pages outside the tabs. */
export function activeTabKey(pathname: string): GuestTabKey | null {
  if (pathname === '/' || pathname === '') return 'home';
  const tab = GUEST_TABS.find((item) => item.href !== '/' && (pathname === item.href || pathname.startsWith(`${item.href}/`)));
  return tab ? tab.key : null;
}

/** Default language of the URL rules (i18n/routing.ts: localePrefix "as-needed"): its paths have no prefix. */
const DEFAULT_LOCALE = 'th';

/**
 * In-site path for a locale: "/profile" → "/en/profile", Thai unchanged. For links rendered on the server with
 * next/link (next-intl's Link needs its request config on the server, which this app does not use).
 */
export function localePath(locale: string, href: string): string {
  if (locale === DEFAULT_LOCALE) return href;
  const cut = href.search(/[?#]/);
  const path = cut === -1 ? href : href.slice(0, cut);
  const rest = cut === -1 ? '' : href.slice(cut);
  return `/${locale}${path === '/' ? '' : path}${rest}`;
}

/** Each language in its own name: the same in every locale on purpose. */
export const LANGUAGE_OPTIONS: readonly { code: string; name: string; short: string }[] = [
  { code: 'th', name: 'ไทย', short: 'TH' },
  { code: 'en', name: 'English', short: 'EN' },
  { code: 'ja', name: '日本語', short: 'JA' },
  { code: 'zh', name: '中文', short: 'ZH' },
];

export function languageName(code: string): string {
  return (LANGUAGE_OPTIONS.find((option) => option.code === code) ?? LANGUAGE_OPTIONS[0]).name;
}

/** Pages of the account web (consumer-app): central sign-in, sign-up and the legal pages. */
const ACCOUNT_PATHS = {
  signIn: '/login',
  register: '/register',
  privacy: '/privacy',
  terms: '/terms',
  cookies: '/privacy#cookies',
} as const;

export type AccountPage = keyof typeof ACCOUNT_PATHS;

/** consumer-app on this machine (npx expo start --web). */
const LOCAL_ACCOUNT_WEB = 'http://localhost:8081';

/**
 * Where the account web lives: NEXT_PUBLIC_ACCOUNT_WEB_ORIGIN (dev / sit / prod each set their own).
 * Unset or not an http(s) address: the local consumer-app during development, the same site in a build.
 */
export function accountWebOrigin(value: string | undefined, nodeEnv: string | undefined): string {
  const fallback = nodeEnv === 'production' ? '' : LOCAL_ACCOUNT_WEB;
  const text = (value ?? '').trim();
  if (!/^https?:\/\//i.test(text)) return fallback;
  try {
    return new URL(text).origin;
  } catch {
    return fallback;
  }
}

export function accountUrl(page: AccountPage, origin: string): string {
  return `${origin}${ACCOUNT_PATHS[page]}`;
}

/**
 * Origin for account links. When this site hands the account pages to the consumer-app itself
 * (ACCOUNT_WEB_UPSTREAM set; next.config.js then sets NEXT_PUBLIC_ACCOUNT_SAME_SITE=1), links stay on this
 * site so both share one sign-in (nestyk-guest-session-plan-20261112.md, AUTH-1.4). Otherwise as before.
 */
export function accountOrigin(sameSite: string | undefined, value: string | undefined, nodeEnv: string | undefined): string {
  return sameSite === '1' ? '' : accountWebOrigin(value, nodeEnv);
}

/**
 * Longest `next` we send, the same limit as the consumer-app's check (app-routes safeNextPath / guestWebPath).
 * Longer ones are dropped rather than cut (a cut query would be a different search).
 */
const NEXT_MAX_LENGTH = 512;

/**
 * The page to come back to after sign-in: an in-site path with its query, never another site
 * (no scheme, no `//` or `/\`, no control characters). The consumer-app checks it again (app-routes).
 */
export function safeGuestNext(here: string | undefined | null): string | null {
  const path = String(here ?? '').split('#')[0];
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return null;
  if (/[\u0000-\u001f\u007f]/.test(path) || path.length > NEXT_MAX_LENGTH) return null;
  return path;
}

/** Sign-in / sign-up link that brings the guest back to `here` (path + query, with the language prefix). */
export function accountUrlWithNext(page: 'signIn' | 'register', origin: string, here: string | undefined | null): string {
  const base = accountUrl(page, origin);
  const next = safeGuestNext(here);
  return next ? `${base}?${new URLSearchParams({ next }).toString()}` : base;
}

/** Origin of the account web for this deploy. Next inlines NEXT_PUBLIC_* at build time. */
export function guestAccountOrigin(): string {
  return accountOrigin(process.env.NEXT_PUBLIC_ACCOUNT_SAME_SITE, process.env.NEXT_PUBLIC_ACCOUNT_WEB_ORIGIN, process.env.NODE_ENV);
}

/** Account web of this deploy. Sign-in and sign-up links use <AccountLink> instead, which adds ?next=. */
export function guestAccountUrl(page: AccountPage): string {
  return accountUrl(page, guestAccountOrigin());
}

/** Company contact (Mos 11 Nov 2026). The company name and address are copy: t.guest.footer.companyName / address. */
export const GUEST_CONTACT = {
  phone: '097-824-2922',
  email: 'contact@nestyk.com',
} as const;

/** "097-824-2922" → "tel:+66978242922" (Thai number in international form). */
export function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `tel:${digits.startsWith('0') ? `+66${digits.slice(1)}` : `+${digits}`}`;
}

export function mailHref(email: string): string {
  return `mailto:${email}`;
}

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export type SocialId = 'facebook' | 'instagram' | 'youtube' | 'tiktok' | 'line' | 'whatsapp' | 'linkedin';

export interface SocialLink {
  id: SocialId;
  label: string;
  url: string;
}

/**
 * NESTYK channels (Mos 12 Nov 2026). Links without tracking parameters; WhatsApp needs the number with the country
 * code (66). An empty url hides the icon. Linktree is kept off the web on purpose (it repeats these links).
 */
export const GUEST_SOCIAL: readonly SocialLink[] = [
  { id: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/profile.php?id=61595854473149' },
  { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/nestyk_thailand' },
  { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@Nestykthailand' },
  { id: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@nestyk_thailand' },
  { id: 'line', label: 'LINE', url: 'https://line.me/R/ti/p/@370llprm' },
  { id: 'whatsapp', label: 'WhatsApp', url: 'https://wa.me/66978242922' },
  { id: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/nestyk-thailand-80452944a/' },
];

export function visibleSocialLinks<T extends { url: string }>(list: readonly T[]): T[] {
  return list.filter((item) => /^https:\/\/[^\s/]+\.[^\s]+$/i.test(item.url));
}
