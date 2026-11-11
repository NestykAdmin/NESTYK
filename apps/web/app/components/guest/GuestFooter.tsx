import React from 'react';
import { COOKIE_SETTINGS_HREF } from '@nestyk/ui/cookie-consent';
import { fillTemplate, getTranslations, type SupportedLocale } from '@nestyk/i18n';
import logoOnBlack from '@nestyk/ui/assets/nestyk/svg/logo-nestyk-onBlack.svg';
import Link from 'next/link';
import {
  GUEST_CONTACT,
  guestAccountUrl,
  isGuestPageReady,
  localePath,
  mailHref,
  mapsUrl,
  telHref,
} from '../../../lib/guest-site';
import { GuestSocialLinks } from './GuestSocialLinks';

const LOGO_HEIGHT = 36;
const LOGO_WIDTH = Math.round((LOGO_HEIGHT * 322) / 107);

const PROPERTY_TYPES = ['condo', 'apartment', 'house', 'townhome'] as const;
const AREAS = ['sukhumvitAsok', 'onnutUdomsuk', 'silomSathorn', 'nonthaburiChaengwattana'] as const;

type Item = { key: string; label: string; href?: string; external?: boolean; soon?: boolean };

/** One footer column. Items without a page yet show "coming soon"; a column of such items shows it once. */
function Column({
  locale,
  title,
  items,
  soonLabel,
  columnSoon,
}: {
  locale: SupportedLocale;
  title: string;
  items: Item[];
  soonLabel: string;
  columnSoon?: boolean;
}) {
  return (
    <nav aria-label={title} className="nk-footer__col">
      <h2 className="nk-footer__heading">
        {title}
        {columnSoon ? <span className="nk-soon nk-soon--on-dark">{soonLabel}</span> : null}
      </h2>
      {items.map((item) => {
        if (columnSoon || item.soon || !item.href) {
          return (
            <span key={item.key} className="nk-footer__link nk-footer__link--soon" aria-disabled="true">
              {item.label}
              {item.soon && !columnSoon ? <span className="nk-soon nk-soon--on-dark">{soonLabel}</span> : null}
            </span>
          );
        }
        return item.external ? (
          <a key={item.key} href={item.href} className="nk-footer__link">
            {item.label}
          </a>
        ) : (
          <Link key={item.key} href={localePath(locale, item.href)} className="nk-footer__link">
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Guest footer, design v2.3 (S2.5). Wide screens only: on mobile these items are on the profile page. */
export function GuestFooter({ locale }: { locale: SupportedLocale }) {
  const t = getTranslations(locale).guest;
  const copy = t.footer;
  const soon = t.nav.comingSoon;
  const searchReady = isGuestPageReady('search');

  return (
    <footer className="nk-footer" data-testid="guest.footer">
      <div className="nk-footer__inner">
        <div className="nk-footer__cols">
          <div className="nk-footer__brand">
            <img src={logoOnBlack.src} alt="NESTYK" width={LOGO_WIDTH} height={LOGO_HEIGHT} className="nk-logo" />
            <p className="nk-footer__tagline">{copy.tagline}</p>
            <div className="nk-footer__contact">
              <a href={telHref(GUEST_CONTACT.phone)} className="nk-footer__link">
                {fillTemplate(copy.call, { phone: GUEST_CONTACT.phone })}
              </a>
              <a href={mailHref(GUEST_CONTACT.email)} className="nk-footer__link">
                {GUEST_CONTACT.email}
              </a>
            </div>
            <p className="nk-footer__address">
              {copy.companyName}
              <br />
              <a href={mapsUrl(copy.address)} target="_blank" rel="noopener" aria-label={`${copy.openMap}: ${copy.address}`}>
                {copy.address}
              </a>
            </p>
            <GuestSocialLinks label={copy.socialLabel} />
          </div>
          <Column
            locale={locale}
            title={copy.findTitle}
            soonLabel={soon}
            columnSoon={!searchReady}
            items={PROPERTY_TYPES.map((type) => ({ key: type, label: t.propertyType[type], href: `/search?type=${type}` }))}
          />
          <Column
            locale={locale}
            title={t.nav.areas}
            soonLabel={soon}
            columnSoon={!searchReady}
            items={AREAS.map((area) => ({ key: area, label: copy.areas[area], href: `/search?area=${area}` }))}
          />
          <Column
            locale={locale}
            title={copy.companyTitle}
            soonLabel={soon}
            items={[
              { key: 'about', label: copy.about, href: '/about', soon: !isGuestPageReady('about') },
              { key: 'articles', label: t.nav.articles, href: '/articles', soon: !isGuestPageReady('articles') },
              { key: 'contact', label: copy.contact, href: mailHref(GUEST_CONTACT.email), external: true },
              { key: 'privacy', label: copy.privacy, href: guestAccountUrl('privacy'), external: true },
              { key: 'terms', label: copy.terms, href: guestAccountUrl('terms'), external: true },
              { key: 'cookies', label: copy.cookieSettings, href: COOKIE_SETTINGS_HREF, external: true },
            ]}
          />
          <Column
            locale={locale}
            title={copy.listersTitle}
            soonLabel={soon}
            items={[
              { key: 'owners', label: copy.forOwners, soon: true },
              { key: 'agents', label: copy.forAgents, soon: true },
            ]}
          />
        </div>
        <div className="nk-footer__bottom">
          <span>{fillTemplate(copy.copyright, { year: new Date().getFullYear() })}</span>
          <span>{copy.apps}</span>
        </div>
      </div>
    </footer>
  );
}
