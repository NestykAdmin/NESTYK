import React from 'react';
import { getTranslations, type SupportedLocale } from '@nestyk/i18n';
import { CookieConsentPanel } from '@nestyk/ui/cookie-consent-panel';
import '@nestyk/ui/cookie-consent.css';
import { guestAccountUrl } from '../../../lib/guest-site';
import { GuestFooter } from './GuestFooter';
import { GuestHeader } from './GuestHeader';
import { GuestSessionProvider } from './GuestSession';
import { GuestTabBar } from './GuestTabBar';
import { SavedRoomsProvider, SavedRoomsToast } from './SavedRooms';

/**
 * Frame of the guest pages (S2.6, design v2.3). Wide screens: header + page + footer.
 * 960px and below: page + bottom tab bar, as in the app (guest.css switches them).
 * Cookie consent: the panel shared with the agent web (design B), in guest colours (guest.css).
 * Sign-in: GuestSessionProvider reads the account pages' sign-in in the browser (AUTH-2).
 * Saved rooms: SavedRoomsProvider keeps the signed-in account's hearts and shows the toast (AUTH-3).
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
          <GuestHeader />
          <main id="main" className="nk-main">
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
