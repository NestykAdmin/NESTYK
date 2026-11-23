import React from 'react';
import type { Metadata } from 'next';
import { getTranslations, type SupportedLocale } from '@nestyk/i18n';
import { guestPageMetadata } from '../../../../lib/guest-seo';
import { ViewingRequestsList } from '../../../components/guest/ViewingRequestsList';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const title = `${getTranslations(locale as SupportedLocale).guest.viewing.title} · NESTYK`;
  return guestPageMetadata({ locale, path: '/viewing-requests', title, index: false });
}

/**
 * The account's viewing requests (plan 23 Nov 2026, step 2). The page is the same for everyone; ViewingRequestsList
 * reads the sign-in in the browser and shows the sign-in card, the requests, or the empty card.
 */
export default async function ViewingRequestsPage({ params }: Props) {
  const { locale } = await params;
  const copy = getTranslations(locale as SupportedLocale).guest.viewing;

  return (
    <>
      <div className="nk-page-head">
        <h1 className="nk-page-head__title">{copy.title}</h1>
        <p className="nk-page-head__text">{copy.subtitle}</p>
      </div>
      <div className="nk-page">
        <ViewingRequestsList locale={locale} />
      </div>
    </>
  );
}
