import React from 'react';
import type { Metadata } from 'next';
import { getTranslations, type SupportedLocale } from '@nestyk/i18n';
import { guestPageMetadata } from '../../../../lib/guest-seo';
import { SearchStart } from '../../../components/guest/SearchStart';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const title = `${getTranslations(locale as SupportedLocale).guest.find.title} · NESTYK`;
  return guestPageMetadata({ locale, path: '/find', title, index: false });
}

/**
 * Mobile search page (Mos 25 Nov 2026, canvas page "searchnew", boards D2–D6): the home search box on phones opens
 * this page. Place, recent searches and the type / price / bedrooms dropdowns, then "ดูห้อง" opens /search.
 * Not indexed and not in the sitemap (a form, not content).
 */
export default async function FindPage() {
  return <SearchStart />;
}
