import React from 'react';
import type { Metadata } from 'next';
import { getTranslations, type SupportedLocale } from '@nestyk/i18n';
import { guestPageMetadata } from '../../../../lib/guest-seo';
import { SavedRoomsList } from '../../../components/guest/SavedRoomsList';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const title = `${getTranslations(locale as SupportedLocale).guest.saved.title} · NESTYK`;
  return guestPageMetadata({ locale, path: '/saved', title, index: false });
}

/**
 * Saved rooms (S2.4 / S4.5, AUTH-3). The page is the same for everyone; SavedRoomsList reads the sign-in in the
 * browser and shows the sign-in card, the saved rooms, or the empty card.
 */
export default async function SavedPage({ params }: Props) {
  const { locale } = await params;
  const copy = getTranslations(locale as SupportedLocale).guest.saved;

  return (
    <>
      <div className="nk-page-head">
        <h1 className="nk-page-head__title">{copy.title}</h1>
        <p className="nk-page-head__text">{copy.subtitle}</p>
      </div>
      <div className="nk-page">
        <SavedRoomsList locale={locale} />
      </div>
    </>
  );
}
