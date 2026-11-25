'use client';

import React, { useEffect } from 'react';
import { useLocale } from '@nestyk/i18n';
import logoOnBlack from '@nestyk/ui/assets/nestyk/svg/logo-nestyk-onBlack.svg';
import { Link, usePathname, useRouter } from '../../../i18n/navigation';
import { inApp, onAppNavigate, openAppMenu, openAppNotifications } from '../../../lib/app-bridge-client';
import { showsTabBar } from '../../../lib/guest-site';
import { AccountAvatar } from './AccountMenu';
import { BellIcon, UserIcon } from './GuestIcons';
import { roleStyle } from './GuestRole';
import { useGuestSession } from './GuestSession';

/** The logo SVG is 618 × 219 (CI, 12 Nov 2026). */
const LOGO_HEIGHT = 28;
const LOGO_WIDTH = Math.round((LOGO_HEIGHT * 618) / 219);

/**
 * Top bar of the guest web inside the NESTYK app (step 2, design W, Mos 24 Nov 2026): the profile picture opens the
 * app's side menu (account, roles, settings, as for every other role), the logo sits on the left beside it and goes
 * home, the bell opens the app's notifications. guest.css shows it only when the app marked the page
 * (html[data-nk-app]); in a browser it never shows. Not on the room page, which has its own top bar.
 */
export function GuestAppBar() {
  const { t } = useLocale();
  const copy = t.guest.appBar;
  const pathname = usePathname();
  const session = useGuestSession();
  if (!showsTabBar(pathname)) return null;
  const profile = session.status === 'signedIn' ? session.profile : null;

  return (
    <div className="nk-appbar" data-testid="guest.appBar">
      <button
        type="button"
        className={`nk-appbar__avatar${profile ? ' nk-appbar__avatar--signed-in' : ''}`}
        style={profile ? roleStyle('guest') : undefined}
        aria-label={copy.myMenu}
        onClick={() => openAppMenu()}
        data-testid="guest.appBar.menu"
      >
        {profile ? <AccountAvatar profile={profile} /> : <UserIcon size={22} />}
      </button>
      <Link href="/" aria-label={t.guest.nav.home} className="nk-appbar__brand">
        {/* lazy: in a browser the bar is hidden, so the logo is never fetched there (review R5). */}
        <img src={logoOnBlack.src} alt="NESTYK" width={LOGO_WIDTH} height={LOGO_HEIGHT} loading="lazy" />
      </Link>
      <button
        type="button"
        className="nk-appbar__bell"
        aria-label={copy.notifications}
        onClick={() => openAppNotifications()}
        data-testid="guest.appBar.notifications"
      >
        <BellIcon size={22} />
      </button>
    </div>
  );
}

/** In the app: the app's side menu (Favourites, My viewing requests) moves this page (step 2). Renders nothing. */
export function GuestAppNavigator() {
  const router = useRouter();
  useEffect(() => {
    if (!inApp()) return;
    return onAppNavigate((path) => router.push(path));
  }, [router]);
  return null;
}
