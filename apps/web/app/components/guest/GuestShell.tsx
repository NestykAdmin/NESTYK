import React from 'react';
import { getTranslations, type SupportedLocale } from '@nestyk/i18n';
import { CookieConsentPanel } from '@nestyk/ui/cookie-consent-panel';
import '@nestyk/ui/cookie-consent.css';
import { guestAccountUrl } from '../../../lib/guest-site';
import { GuestAppBar, GuestAppNavigator } from './GuestAppBar';
import { GuestFooter } from './GuestFooter';
import { GuestHeader } from './GuestHeader';
import { GuestPageTransition } from './GuestPageTransition';
import { GuestPullRefresh } from './GuestPullRefresh';
import { GuestSessionProvider } from './GuestSession';
import { GuestTabBar } from './GuestTabBar';
import { SavedRoomsProvider, SavedRoomsToast } from './SavedRooms';

/**
 * Frame of the guest pages (S2.6, design v2.3). Wide screens: header + page + footer.
 * 960px and below: page + bottom tab bar, as in the app (guest.css switches them).
 * Cookie consent: the panel shared with the agent web (design B), in guest colours (guest.css).
 * Sign-in: GuestSessionProvider reads the account pages' sign-in in the browser (AUTH-2).
 * Saved rooms: SavedRoomsProvider keeps the signed-in account's hearts and shows the toast (AUTH-3).
 * Inside the NESTYK app (step 2, design W): GuestAppBar on top, the 4th tab is "More", account parts are the app's.
 */
export function GuestShell({ locale, children }: { locale: SupportedLocale; children: React.ReactNode }) {
  const all = getTranslations(locale);
  const t = all.guest;
  return (
    <GuestSessionProvider>
      <SavedRoomsProvider>
        <div className="nk-guest">
          <a href="#main" className="nk-skip">
            {t.nav.skipToContent}
          </a>
          {/* In the NESTYK app only (html[data-nk-app], step 2 design W): the app bar replaces the header. */}
          <GuestAppBar />
          <GuestAppNavigator />
          <GuestHeader />
          {/* Phones and the app: page change animation (design A, Mos 27 Nov 2026). */}
          <GuestPageTransition />
          <main id="main" className="nk-main">
            {/* In the app only: pull to refresh (Mos 25 Nov 2026, canvas "ptr", design A). Inside the page: it moves with it. */}
            <GuestPullRefresh />
            {children}
          </main>
          <GuestFooter locale={locale} />
          <GuestTabBar />
          <SavedRoomsToast />
          <CookieConsentPanel copy={all.legal.cookieNotice} learnMoreHref={guestAccountUrl('cookies')} site="guest" />
        </div>
      </SavedRoomsProvider>
    </GuestSessionProvider>
  );
}
