import { defineRouting } from 'next-intl/routing';

/**
 * Guest web language routing (nestyk-i18n-multi-language-plan-20261111.md, section 9).
 * - Thai has no prefix (`/search`); other languages do (`/en/search`).
 * - No guessing from the browser language: the URL alone decides, so shared links and
 *   search engines always get the language in the link.
 * - No locale cookie from the library: remembering a language is a "preferences" item that
 *   needs cookie consent, so it goes through the consent-gated store instead.
 * Only the routing parts of next-intl are used; copy still comes from @nestyk/i18n.
 */
export const routing = defineRouting({
  locales: ['th', 'en', 'ja', 'zh'],
  defaultLocale: 'th',
  localePrefix: 'as-needed',
  localeDetection: false,
  localeCookie: false,
  // hreflang is written in each page's <head> (lib/guest-seo.ts), so each page controls its own set.
  alternateLinks: false,
});

export type GuestLocale = (typeof routing.locales)[number];
