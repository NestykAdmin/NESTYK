'use client';

import React, { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import logo from '@nestyk/ui/assets/nestyk/svg/logo-nestyk-standard.svg';
import logoOnBlack from '@nestyk/ui/assets/nestyk/svg/logo-nestyk-onBlack.svg';
import { Link, usePathname } from '../../../i18n/navigation';
import { GUEST_NAV, isGuestPageReady } from '../../../lib/guest-site';
import { AccountMenu } from './AccountMenu';
import { HeartIcon } from './GuestIcons';
import { GuestLanguageButtonStatic, GuestLanguageMenu } from './GuestLanguageMenu';

/** The logo SVG is 618 × 219 (CI, 12 Nov 2026). */
const LOGO_HEIGHT = 32;
const LOGO_WIDTH = Math.round((LOGO_HEIGHT * 618) / 219);
/** Mos 20 Nov 2026: white at the top of the page, ink once the page has scrolled past the header (its height). */
const DARK_AFTER_PX = 72;

function isCurrent(pathname: string, href: string): boolean {
  const path = href.split('#')[0];
  if (path === '/' || href.includes('#')) return false;
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * Guest header, design v2.3: logo, the 5 menu items (pages not built yet show "coming soon"), one language button,
 * saved rooms and one sign-in button to the central login (the account menu once signed in, AUTH-2 design B).
 * Hidden at 960px and below, where the tab bar takes over.
 */
export function GuestHeader() {
  const { t } = useLocale();
  const copy = t.guest.nav;
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const [dark, setDark] = useState(false);

  // Checked on load too: a page opened with "back" can start half way down.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setDark(window.scrollY > DARK_AFTER_PX);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

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
    <header className="nk-header" data-tone={dark ? 'dark' : undefined} data-testid="guest.header">
      <div className="nk-header__inner">
        <Link href="/" aria-label={copy.home} className="nk-header__brand">
          <img src={logo.src} alt="NESTYK" width={LOGO_WIDTH} height={LOGO_HEIGHT} className="nk-logo nk-logo--standard" />
          {/* Both logos load with the page; CSS shows the one for the header's tone. This one is not read out. */}
          <img src={logoOnBlack.src} alt="" width={LOGO_WIDTH} height={LOGO_HEIGHT} className="nk-logo nk-logo--on-dark" />
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
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
