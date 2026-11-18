import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations } from '@nestyk/i18n';
import { routing } from '../../i18n/routing';
import { guestSiteIndexable, guestSiteOrigin } from '../../lib/guest-seo';
import { RootDocument } from '../../lib/root-document';
import { GuestLocaleProvider } from '../components/GuestLocaleProvider';
import './guest.css';

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const copy = getTranslations(locale).guest;
  const origin = guestSiteOrigin();
  // Defaults for every guest page. Each page adds its own canonical, hreflang and robots with
  // guestPageMetadata (lib/guest-seo.ts); a page that forgot stays noindex on a deploy that is not indexable.
  return {
    ...(origin ? { metadataBase: new URL(origin) } : {}),
    title: `NESTYK — ${copy.hero.title}`,
    description: copy.hero.subtitle,
    robots: guestSiteIndexable() ? { index: true, follow: true } : { index: false, follow: false },
  };
}

/** Root layout of the guest pages. The language comes from the URL only. */
export default async function GuestRootLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return (
    <RootDocument lang={locale}>
      <GuestLocaleProvider locale={locale}>{children}</GuestLocaleProvider>
    </RootDocument>
  );
}
