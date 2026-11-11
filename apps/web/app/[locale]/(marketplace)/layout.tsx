import React from 'react';
import type { SupportedLocale } from '@nestyk/i18n';
import { GuestShell } from '../../components/guest/GuestShell';

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

/** Guest pages: header, footer and mobile tab bar of design v2.3 (S2.6). The locale is checked in [locale]/layout. */
export default async function MarketplaceLayout({ children, params }: Props) {
  const { locale } = await params;
  return <GuestShell locale={locale as SupportedLocale}>{children}</GuestShell>;
}
