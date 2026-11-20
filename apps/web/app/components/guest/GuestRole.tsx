'use client';

import React from 'react';
import { useLocale } from '@nestyk/i18n';
import { roleTileColors } from '@nestyk/ui';
import { CheckIcon, HandshakeIcon, HomeIcon, KeyIcon, SearchIcon } from './GuestIcons';

/**
 * Role tiles of the guest web (Mos 20 Nov 2026: the role switcher like the admin web). The same colours as the admin
 * web and the app (`roleTileColors`, light mode: the guest web has no dark mode yet) and the same icon per role.
 */
export type GuestRole = 'guest' | 'agent' | 'landlord' | 'tenant';

const ROLE_ICON: Record<GuestRole, (props: { size?: number; className?: string }) => React.ReactElement> = {
  guest: SearchIcon,
  tenant: HomeIcon,
  landlord: KeyIcon,
  agent: HandshakeIcon,
};

/** The role's colours as CSS variables, read by guest.css (tile, avatar ring and badge). */
export function roleStyle(role: GuestRole): React.CSSProperties {
  const tile = roleTileColors(role, false);
  return { '--nk-role-bg': tile.bg, '--nk-role-fg': tile.fg, '--nk-role-ring': tile.ring } as React.CSSProperties;
}

export function RoleTile({ role }: { role: GuestRole }) {
  const Icon = ROLE_ICON[role];
  return (
    <span className="nk-role-tile" style={roleStyle(role)} aria-hidden="true">
      <Icon size={16} />
    </span>
  );
}

/** A profile picture or initials with the role's ring and a small role badge at the bottom right, like the admin web. */
export function RoleAvatar({ role, children }: { role: GuestRole; children: React.ReactNode }) {
  const Icon = ROLE_ICON[role];
  return (
    <span className="nk-role-avatar" style={roleStyle(role)}>
      {children}
      <span className="nk-role-avatar__badge" aria-hidden="true">
        <Icon size={10} />
      </span>
    </span>
  );
}

type RoleOptionProps = {
  role: GuestRole;
  current: boolean;
  /** Another site's role page: a link marked "other site". Without it, the current role: a button when it has
   *  onSelect (the menu closes), else plain text (the profile page). */
  href?: string;
  ariaLabel?: string;
  className: string;
  testId: string;
  onSelect?: () => void;
};

/** One role in the switcher: tile, name, the role's line, then a check (current) or the "other site" mark. */
export function RoleOption({ role, current, href, ariaLabel, className, testId, onSelect }: RoleOptionProps) {
  const { t } = useLocale();
  const body = (
    <>
      <RoleTile role={role} />
      <span className="nk-role-option__text">
        <span className="nk-role-option__name">{t.roles[role]}</span>
        <span className="nk-role-option__line">{t.mobile.profile.roleDescriptions[role]}</span>
      </span>
      {current ? (
        <CheckIcon size={18} className="nk-role-option__check" />
      ) : (
        <span className="nk-role-option__badge">{t.webSession.otherSite}</span>
      )}
    </>
  );
  const classes = `${className} nk-role-option${current ? ' is-current' : ''}`;
  if (href) {
    return (
      <a href={href} className={classes} aria-label={ariaLabel} data-testid={testId} onClick={onSelect}>
        {body}
      </a>
    );
  }
  if (!onSelect) {
    return (
      <div className={classes} aria-current={current ? 'true' : undefined} data-testid={testId}>
        {body}
      </div>
    );
  }
  return (
    <button type="button" className={classes} aria-current={current ? 'true' : undefined} data-testid={testId} onClick={onSelect}>
      {body}
    </button>
  );
}
