import React from 'react';
import type { Metadata } from 'next';
import { getTranslations, type SupportedLocale } from '@nestyk/i18n';
import { guestPageMetadata } from '../../../../lib/guest-seo';
import { guestAccountUrl } from '../../../../lib/guest-site';
import { HeartIcon } from '../../../components/guest/GuestIcons';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const title = `${getTranslations(locale as SupportedLocale).guest.saved.title} · NESTYK`;
  return guestPageMetadata({ locale, path: '/saved', title, index: false });
}

/**
 * Saved rooms (S2.4; the real list is S4.5). Saving needs an account, and the guest web cannot see the account
 * session until single sign-on, so the page asks the guest to sign in (Mos 11 Nov 2026). Once the session is known,
 * a signed-in guest gets the list, or emptyTitle / emptyBody / browse when nothing is saved yet.
 */
export default async function SavedPage({ params }: Props) {
  const { locale } = await params;
  const t = getTranslations(locale as SupportedLocale).guest;
  const copy = t.saved;

  return (
    <>
      <div className="nk-page-head">
        <h1 className="nk-page-head__title">{copy.title}</h1>
        <p className="nk-page-head__text">{copy.subtitle}</p>
      </div>
      <div className="nk-page">
        <section className="nk-card nk-empty" aria-labelledby="saved-gate-title" data-testid="saved.signIn">
          <span className="nk-empty__icon" aria-hidden="true">
            <HeartIcon size={28} />
          </span>
          <h2 id="saved-gate-title" className="nk-empty__title">
            {copy.gateTitle}
          </h2>
          <p className="nk-empty__text">{copy.gateBody}</p>
          <div className="nk-empty__actions">
            <a href={guestAccountUrl('signIn')} className="nk-btn nk-btn--primary" data-testid="saved.signInLink">
              {t.signInPrompt.signIn}
            </a>
            <a href={guestAccountUrl('register')} className="nk-btn nk-btn--outline" data-testid="saved.registerLink">
              {t.signInPrompt.register}
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
