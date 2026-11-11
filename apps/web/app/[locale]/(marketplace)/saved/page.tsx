import React from 'react';
import type { Metadata } from 'next';
import { getTranslations, type SupportedLocale } from '@nestyk/i18n';
import Link from 'next/link';
import { guestPageMetadata } from '../../../../lib/guest-seo';
import { isGuestPageReady, localePath } from '../../../../lib/guest-site';
import { HeartIcon } from '../../../components/guest/GuestIcons';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const title = `${getTranslations(locale as SupportedLocale).guest.saved.title} · NESTYK`;
  return guestPageMetadata({ locale, path: '/saved', title, index: false });
}

/**
 * Saved rooms (S2.4 placeholder; the real list is S4.5). For now it always shows the empty state, so the heart in
 * the header and the "Saved" tab open a real page.
 */
export default async function SavedPage({ params }: Props) {
  const { locale } = await params;
  const t = getTranslations(locale as SupportedLocale).guest;
  const copy = t.saved;
  const browseHref = isGuestPageReady('search') ? '/search' : '/';

  return (
    <>
      <div className="nk-page-head">
        <h1 className="nk-page-head__title">{copy.title}</h1>
        <p className="nk-page-head__text">{copy.subtitle}</p>
      </div>
      <div className="nk-page">
        <section className="nk-card nk-empty" data-testid="saved.empty">
          <span className="nk-empty__icon">
            <HeartIcon size={28} />
          </span>
          <h2 className="nk-empty__title">{copy.emptyTitle}</h2>
          <p className="nk-empty__text">{copy.emptyBody}</p>
          <Link href={localePath(locale, browseHref)} className="nk-btn nk-btn--primary" data-testid="saved.browse">
            {copy.browse}
          </Link>
        </section>
      </div>
    </>
  );
}
