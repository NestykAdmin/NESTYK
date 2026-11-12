'use client';

import React, { Suspense, useLayoutEffect, useRef } from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import logo from '@nestyk/ui/assets/nestyk/svg/logo-nestyk-standard.svg';
import { Link, usePathname } from '../../../i18n/navigation';
import { GUEST_NAV, guestAccountUrl, isGuestPageReady } from '../../../lib/guest-site';
import { HeartIcon } from './GuestIcons';
import { GuestLanguageButtonStatic, GuestLanguageMenu } from './GuestLanguageMenu';

/** The logo SVG is 618 × 219 (CI, 12 Nov 2026). */
const LOGO_HEIGHT = 32;
const LOGO_WIDTH = Math.round((LOGO_HEIGHT * 618) / 219);

function isCurrent(pathname: string, href: string): boolean {
  const path = href.split('#')[0];
  if (path === '/' || href.includes('#')) return false;
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * Guest header, design v2.3: logo, the 5 menu items (pages not built yet show "coming soon"), one language button,
 * saved rooms and one sign-in button to the central login. Hidden at 960px and below, where the tab bar takes over.
 */
export function GuestHeader() {
  const { t } = useLocale();
  const copy = t.guest.nav;
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  // Long languages, or many "coming soon" items, can make the menu wider than the header (e.g. English with all
  // 5 items soon, or any language between 961 and ~1100px). Then the pills are hidden; the items stay dimmed and
  // their accessible name still says "coming soon".
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      nav.dataset.compact = 'false';
      nav.dataset.compact = nav.scrollWidth > nav.clientWidth + 1 ? 'true' : 'false';
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(nav.parentElement ?? nav);
    return () => observer.disconnect();
  }, [copy]);

  return (
    <header className="nk-header" data-testid="guest.header">
      <div className="nk-header__inner">
        <Link href="/" aria-label={copy.home} className="nk-header__brand">
          <img src={logo.src} alt="NESTYK" width={LOGO_WIDTH} height={LOGO_HEIGHT} className="nk-logo" />
        </Link>
        <nav ref={navRef} className="nk-nav" aria-label={copy.mainMenu}>
          {GUEST_NAV.map((item) => {
            const label = copy[item.key];
            if (!isGuestPageReady(item.key)) {
              return (
                <span
                  key={item.key}
                  className="nk-nav__item nk-nav__item--soon"
                  aria-disabled="true"
                  aria-label={fillTemplate(copy.soonItem, { label })}
                  title={fillTemplate(copy.soonItem, { label })}
                  data-testid={`guest.nav.${item.key}`}
                >
                  {label}
                  <span className="nk-soon" aria-hidden="true">
                    {copy.comingSoon}
                  </span>
                </span>
              );
            }
            return (
              <Link
                key={item.key}
                href={item.href}
                className="nk-nav__item"
                aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}
                data-testid={`guest.nav.${item.key}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="nk-header__actions">
          <Suspense fallback={<GuestLanguageButtonStatic />}>
            <GuestLanguageMenu />
          </Suspense>
          <Link
            href="/saved"
            className="nk-icon-btn"
            aria-label={copy.saved}
            aria-current={isCurrent(pathname, '/saved') ? 'page' : undefined}
            data-testid="guest.saved"
          >
            <HeartIcon />
          </Link>
          <a href={guestAccountUrl('signIn')} className="nk-signin" data-testid="guest.signIn">
            {copy.signIn}
          </a>
        </div>
      </div>
    </header>
  );
}
