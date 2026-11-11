'use client';

import React from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import { Link, usePathname } from '../../../i18n/navigation';
import { activeTabKey, GUEST_TABS, isGuestPageReady, type GuestTabKey } from '../../../lib/guest-site';
import { HeartIcon, HomeIcon, SearchIcon, UserIcon } from './GuestIcons';

const ICONS: Record<GuestTabKey, React.ComponentType<{ size?: number }>> = {
  home: HomeIcon,
  search: SearchIcon,
  saved: HeartIcon,
  profile: UserIcon,
};

/**
 * Bottom tab bar of the mobile web (S2.4), the same 4 tabs as the app. Shown at 960px and below (guest.css).
 * A tab whose page is not built yet is dimmed and cannot be pressed.
 */
export function GuestTabBar() {
  const { t } = useLocale();
  const copy = t.guest.tabs;
  const active = activeTabKey(usePathname());

  return (
    <nav className="nk-tabbar" aria-label={copy.label} data-testid="guest.tabBar">
      {GUEST_TABS.map((tab) => {
        const Icon = ICONS[tab.key];
        const label = copy[tab.key];
        const content = (
          <>
            <span className="nk-tab__icon">
              <Icon size={22} />
            </span>
            {label}
          </>
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
