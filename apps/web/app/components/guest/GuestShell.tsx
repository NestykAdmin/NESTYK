import React from 'react';
import { getTranslations, type SupportedLocale } from '@nestyk/i18n';
import { GuestCookieBar } from './GuestCookieBar';
import { GuestFooter } from './GuestFooter';
import { GuestHeader } from './GuestHeader';
import { GuestTabBar } from './GuestTabBar';

/**
 * Frame of the guest pages (S2.6, design v2.3). Wide screens: header + page + footer.
 * 960px and below: page + bottom tab bar, as in the app (guest.css switches them).
 */
export function GuestShell({ locale, children }: { locale: SupportedLocale; children: React.ReactNode }) {
  const t = getTranslations(locale).guest;
  return (
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
      <GuestCookieBar />
    </div>
  );
}
