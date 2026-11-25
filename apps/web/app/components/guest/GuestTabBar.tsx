'use client';

import React from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import { Link, usePathname } from '../../../i18n/navigation';
import { activeTabKey, GUEST_TABS, isGuestPageReady, showsTabBar, type GuestTabKey } from '../../../lib/guest-site';
import { HeartIcon, HomeIcon, MoreIcon, SearchIcon, UserIcon } from './GuestIcons';
import { roleStyle } from './GuestRole';
import { useGuestSession } from './GuestSession';

const ICONS: Record<GuestTabKey, React.ComponentType<{ size?: number }>> = {
  home: HomeIcon,
  search: SearchIcon,
  saved: HeartIcon,
  profile: UserIcon,
};

/**
 * Bottom tab bar of the mobile web (S2.4), the same 4 tabs as the app. Shown at 960px and below (guest.css).
 * A tab whose page is not built yet is dimmed and cannot be pressed.
 * Inside the NESTYK app the 4th tab reads "More" (guest.css swaps .nk-web-only / .nk-app-only by html[data-nk-app]).
 */
export function GuestTabBar() {
  const { t } = useLocale();
  const copy = t.guest.tabs;
  const pathname = usePathname();
  const active = activeTabKey(pathname);
  // Signed in: the profile tab shows the account's initials (AUTH-2 design B).
  const session = useGuestSession();
  const initials = session.status === 'signedIn' ? session.profile.initials : null;
  if (!showsTabBar(pathname)) return null;

  return (
    <nav className="nk-tabbar" aria-label={copy.label} data-testid="guest.tabBar">
      {GUEST_TABS.map((tab) => {
        const Icon = ICONS[tab.key];
        const label = copy[tab.key];
        const webContent = (
          <>
            <span className="nk-tab__icon">
              {tab.key === 'profile' && initials ? (
                <span className="nk-tab__avatar" style={roleStyle('guest')} aria-hidden="true">
                  {initials}
                </span>
              ) : (
                <Icon size={22} />
              )}
            </span>
            {label}
          </>
        );
        // Inside the app the 4th tab is "More" (step 2, design W): the account is the app bar's avatar there.
        const content =
          tab.key === 'profile' ? (
            <>
              <span className="nk-tab__part nk-web-only">{webContent}</span>
              <span className="nk-tab__part nk-app-only">
                <span className="nk-tab__icon">
                  <MoreIcon size={22} />
                </span>
                {copy.more}
              </span>
            </>
          ) : (
            webContent
          );
        if (!isGuestPageReady(tab.key)) {
          return (
            <span
              key={tab.key}
              className="nk-tab nk-tab--soon"
              aria-disabled="true"
              aria-label={fillTemplate(t.guest.nav.soonItem, { label })}
              data-testid={`guest.tab.${tab.key}`}
            >
              {content}
            </span>
          );
        }
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className="nk-tab"
            aria-current={active === tab.key ? 'page' : undefined}
            data-testid={`guest.tab.${tab.key}`}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
