import React from 'react';
import type { Metadata } from 'next';
import { fillTemplate, getTranslations, type SupportedLocale } from '@nestyk/i18n';
import { COOKIE_SETTINGS_HREF } from '@nestyk/ui/cookie-consent';
import Link from 'next/link';
import { guestPageMetadata } from '../../../../lib/guest-seo';
import {
  GUEST_CONTACT,
  guestAccountUrl,
  isGuestPageReady,
  LANGUAGE_OPTIONS,
  languageName,
  localePath,
  mailHref,
  mapsUrl,
  telHref,
} from '../../../../lib/guest-site';
import {
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  DocumentIcon,
  GlobeIcon,
  HeartIcon,
  HelpIcon,
  InfoIcon,
  MailIcon,
  PhoneIcon,
  ShieldIcon,
  SlidersIcon,
  SunIcon,
  UserIcon,
} from '../../../components/guest/GuestIcons';
import { AccountLink } from '../../../components/guest/AccountLink';
import { GuestSocialLinks } from '../../../components/guest/GuestSocialLinks';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const title = `${getTranslations(locale as SupportedLocale).guest.profile.title} · NESTYK`;
  return guestPageMetadata({ locale, path: '/profile', title, index: false });
}

type RowIcon = React.ComponentType<{ size?: number; className?: string }>;

function Chevron() {
  return <ChevronRightIcon size={18} className="nk-row__chevron" />;
}

/** A row whose page is not built yet: shown so people know it is coming, but it cannot be pressed. */
function SoonRow({ icon: Icon, label, soon }: { icon: RowIcon; label: string; soon: string }) {
  return (
    <span className="nk-row nk-row--soon" aria-disabled="true">
      <Icon className="nk-row__icon" />
      <span className="nk-row__label">{label}</span>
      <span className="nk-soon">{soon}</span>
    </span>
  );
}

/**
 * Profile page of the guest web (S2.9, design v2.3 "MobileProfileV23"). Signed-out view: sign in or sign up at
 * the central login, language, cookie settings, help and legal links, and on mobile the contact block that the
 * footer shows on wide screens. Role cards and notifications are left out on purpose (guest pages only).
 */
export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  const t = getTranslations(locale as SupportedLocale).guest;
  const copy = t.profile;
  const soon = t.nav.comingSoon;
  const year = new Date().getFullYear();

  return (
    <>
      <div className="nk-page-head">
        <h1 className="nk-page-head__title">{copy.title}</h1>
        <p className="nk-page-head__text">{copy.subtitle}</p>
      </div>
      <div className="nk-page">
        <section className="nk-card nk-signin-card" data-testid="profile.signInCard">
          <div className="nk-signin-card__head">
            <span className="nk-avatar">
              <UserIcon size={26} />
            </span>
            <div>
              <h2 className="nk-card__title">{copy.accountTitle}</h2>
              <p className="nk-card__text">{copy.accountBody}</p>
            </div>
          </div>
          <AccountLink page="signIn" className="nk-btn nk-btn--primary" data-testid="profile.signIn">
            {copy.signIn}
          </AccountLink>
          <AccountLink page="register" className="nk-btn nk-btn--secondary" data-testid="profile.register">
            {copy.register}
          </AccountLink>
        </section>

        <section aria-label={copy.activityLabel} className="nk-card nk-list">
          <Link href={localePath(locale, '/saved')} className="nk-row" data-testid="profile.saved">
            <HeartIcon className="nk-row__icon" />
            <span className="nk-row__label">{copy.saved}</span>
            <Chevron />
          </Link>
          {isGuestPageReady('viewingRequests') ? null : <SoonRow icon={CalendarIcon} label={copy.viewingRequests} soon={soon} />}
        </section>

        <section aria-label={copy.settingsLabel} className="nk-card nk-list">
          <details className="nk-details" data-testid="profile.language">
            <summary className="nk-row">
              <GlobeIcon className="nk-row__icon" />
              <span className="nk-row__label">{copy.language}</span>
              <span className="nk-row__value">{languageName(locale)}</span>
              <Chevron />
            </summary>
            <ul className="nk-details__list">
              {LANGUAGE_OPTIONS.map((option) => {
                const selected = option.code === locale;
                return (
                  <li key={option.code}>
                    <Link
                      href={localePath(option.code, '/profile')}
                      lang={option.code}
                      hrefLang={option.code}
                      aria-current={selected ? 'true' : undefined}
                      className="nk-lang__option"
                      data-testid={`profile.language.${option.code}`}
                    >
                      {option.name}
                      <span className="nk-lang__code">{option.short}</span>
                      {selected ? <CheckIcon size={18} className="nk-lang__check" /> : <span aria-hidden="true" className="nk-lang__check" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
          {isGuestPageReady('theme') ? null : <SoonRow icon={SunIcon} label={copy.theme} soon={soon} />}
        </section>

        <section aria-label={copy.helpLabel} className="nk-card nk-list">
          {isGuestPageReady('help') ? null : <SoonRow icon={HelpIcon} label={copy.help} soon={soon} />}
          {isGuestPageReady('about') ? null : <SoonRow icon={InfoIcon} label={copy.about} soon={soon} />}
          <a href={guestAccountUrl('privacy')} className="nk-row" data-testid="profile.privacy">
            <ShieldIcon className="nk-row__icon" />
            <span className="nk-row__label">{copy.privacy}</span>
            <Chevron />
          </a>
          <a href={guestAccountUrl('terms')} className="nk-row" data-testid="profile.terms">
            <DocumentIcon className="nk-row__icon" />
            <span className="nk-row__label">{copy.terms}</span>
            <Chevron />
          </a>
          <a href={COOKIE_SETTINGS_HREF} className="nk-row" data-testid="profile.cookies">
            <SlidersIcon className="nk-row__icon" />
            <span className="nk-row__label">{copy.cookies}</span>
            <Chevron />
          </a>
        </section>

        <section aria-label={copy.contactLabel} className="nk-card nk-list nk-page__mobile-only" data-testid="profile.contact">
          <a href={telHref(GUEST_CONTACT.phone)} className="nk-row">
            <PhoneIcon className="nk-row__icon" />
            <span className="nk-row__label">{copy.call}</span>
            <span className="nk-row__value">{GUEST_CONTACT.phone}</span>
          </a>
          <a href={mailHref(GUEST_CONTACT.email)} className="nk-row">
            <MailIcon className="nk-row__icon" />
            <span className="nk-row__label">{copy.email}</span>
            <span className="nk-row__value">{GUEST_CONTACT.email}</span>
          </a>
        </section>

        <div className="nk-page__mobile-only">
          <GuestSocialLinks label={t.footer.socialLabel} className="nk-profile-social" />
        </div>

        <p className="nk-legal-caption nk-page__mobile-only">
          {t.footer.companyName}
          <br />
          <a href={mapsUrl(t.footer.address)} target="_blank" rel="noopener" aria-label={`${t.footer.openMap}: ${t.footer.address}`}>
            {t.footer.address}
          </a>
          <br />
          {fillTemplate(t.footer.copyright, { year })}
        </p>
      </div>
    </>
  );
}
