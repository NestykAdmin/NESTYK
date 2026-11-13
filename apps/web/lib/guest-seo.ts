import type { Metadata, MetadataRoute } from 'next';
import { localePath } from './guest-site';

/**
 * Search engine rules of the guest web (SEO-0, project-docs/nestyk-guest-seo-plan-20261111.md).
 * - The site address comes from NEXT_PUBLIC_SITE_ORIGIN: no domain is written in the code.
 * - Search engines may index only a deploy that sets NEXT_PUBLIC_SITE_INDEXABLE=true with an https address
 *   (prod). Everything else (this machine, dev, sit, a prod that forgot the setting) is noindex.
 * - Each page states its own canonical URL and the same page in the other languages (hreflang), with
 *   x-default on the Thai page. Private pages are noindex; they are not blocked in robots.txt, because a
 *   blocked page is never fetched and its noindex is never seen.
 * Pure helpers (lib/guest-seo.test.cjs loads this file bare); the two guest* functions read the env.
 */

/** Same list and default as i18n/routing.ts (the test compares them). */
export const SEO_LOCALES = ['th', 'en', 'ja', 'zh'] as const;
export const DEFAULT_SEO_LOCALE = 'th';

/** apps/web on this machine (npm run dev). */
const LOCAL_SITE = 'http://localhost:3000';

const OG_LOCALE: Record<string, string> = { th: 'th_TH', en: 'en_US', ja: 'ja_JP', zh: 'zh_CN' };

/** Unset or not an http(s) address: this machine during development, no address in a build. */
export function siteOrigin(value: string | undefined, nodeEnv: string | undefined): string {
  const fallback = nodeEnv === 'production' ? '' : LOCAL_SITE;
  const text = (value ?? '').trim();
  if (!/^https?:\/\//i.test(text)) return fallback;
  try {
    return new URL(text).origin;
  } catch {
    return fallback;
  }
}

export function isIndexableSite(flag: string | undefined, origin: string): boolean {
  return (flag ?? '').trim().toLowerCase() === 'true' && origin.startsWith('https://');
}

/** Address of this deploy. Next inlines NEXT_PUBLIC_* at build time. */
export function guestSiteOrigin(): string {
  return siteOrigin(process.env.NEXT_PUBLIC_SITE_ORIGIN, process.env.NODE_ENV);
}

export function guestSiteIndexable(): boolean {
  return isIndexableSite(process.env.NEXT_PUBLIC_SITE_INDEXABLE, guestSiteOrigin());
}

/** The same page in every language, plus x-default (the Thai page). `path` has no language prefix. */
function languageUrls(origin: string, path: string): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const locale of SEO_LOCALES) urls[locale] = `${origin}${localePath(locale, path)}`;
  urls['x-default'] = urls[DEFAULT_SEO_LOCALE];
  return urls;
}

export interface PageSeo {
  canonical: string | null;
  languages: Record<string, string> | null;
  robots: { index: boolean; follow: boolean };
}

export interface PageSeoInput {
  origin: string;
  /** Whether this deploy may be indexed at all (isIndexableSite). */
  indexable: boolean;
  locale: string;
  /** Path without the language prefix, e.g. "/" or "/rent/asok". */
  path: string;
  /** False for pages that must never be indexed (saved rooms, profile, developer pages). Default true. */
  index?: boolean;
}

export function pageSeo({ origin, indexable, locale, path, index = true }: PageSeoInput): PageSeo {
  const canonical = origin ? `${origin}${localePath(locale, path)}` : null;
  // hreflang only for pages meant for search; also on dev and sit, so the real head can be checked there.
  const languages = origin && index ? languageUrls(origin, path) : null;
  const robots = indexable ? { index, follow: true } : { index: false, follow: false };
  return { canonical, languages, robots };
}

export interface PageMetaInput {
  locale: string;
  /** Left out: the page keeps the title and description of the layout. */
  title?: string;
  description?: string;
}

export function toMetadata(seo: PageSeo, { locale, title, description }: PageMetaInput): Metadata {
  const alternates = seo.canonical
    ? { canonical: seo.canonical, ...(seo.languages ? { languages: seo.languages } : {}) }
    : undefined;
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    alternates,
    robots: seo.robots,
    openGraph: {
      type: 'website',
      siteName: 'NESTYK',
      locale: OG_LOCALE[locale] ?? OG_LOCALE[DEFAULT_SEO_LOCALE],
      ...(seo.canonical ? { url: seo.canonical } : {}),
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
    },
  };
}

/** Metadata of one guest page for this deploy. Every page under app/[locale] calls this (the test checks). */
export function guestPageMetadata(input: PageMetaInput & { path: string; index?: boolean }): Metadata {
  const seo = pageSeo({
    origin: guestSiteOrigin(),
    indexable: guestSiteIndexable(),
    locale: input.locale,
    path: input.path,
    index: input.index,
  });
  return toMetadata(seo, input);
}

/** Pages that search engines should find, without the language prefix. Add /rent/<area> and rooms in SEO-1. */
export const INDEXABLE_PATHS: readonly string[] = ['/'];

export function sitemapEntries(origin: string, indexable: boolean, paths: readonly string[]): MetadataRoute.Sitemap {
  if (!indexable || !origin) return [];
  return paths.flatMap((path) => {
    const languages = languageUrls(origin, path);
    return SEO_LOCALES.map((locale) => ({ url: languages[locale], alternates: { languages } }));
  });
}

/**
 * Kept out of search: the API, and the sign-in and role pages this site hands to the consumer-app (AUTH-1,
 * lib/account-routes.js; a test keeps the two in step). Privacy and terms stay crawlable.
 */
const ROBOTS_PAGES = ['/login', '/register', '/reset-password', '/no-access'];
const ROBOTS_TREES = ['/agent', '/tenant', '/landlord', '/admin', '/owner'];
/** Exact pages ("$" = end, "?" = with a query) and whole trees, so a guest page starting the same way stays open. */
export const ROBOTS_DISALLOW = [
  '/api/',
  ...ROBOTS_PAGES.flatMap((p) => [`${p}$`, `${p}?`]),
  ...ROBOTS_TREES.flatMap((p) => [`${p}$`, `${p}?`, `${p}/`]),
];

export function robotsRules(origin: string, indexable: boolean): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ROBOTS_DISALLOW }],
    ...(indexable && origin ? { sitemap: `${origin}/sitemap.xml` } : {}),
  };
}
