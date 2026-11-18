'use client';

import React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { LocaleProvider, type SupportedLocale } from '@nestyk/i18n';

/**
 * Copy for the guest pages comes from @nestyk/i18n; next-intl only needs to know the
 * locale for its language-aware links, so it gets no messages.
 * `key` resets the copy when the URL language changes during client navigation.
 */
export function GuestLocaleProvider({ locale, children }: { locale: SupportedLocale; children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale={locale}>
      <LocaleProvider key={locale} defaultLocale={locale}>
        {children}
      </LocaleProvider>
    </NextIntlClientProvider>
  );
}
