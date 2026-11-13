'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import { Link } from '../../../i18n/navigation';
import { roleSiteLinks, type GuestProfile } from '../../../lib/guest-session';
import { guestAccountOrigin } from '../../../lib/guest-site';
import { AccountLink } from './AccountLink';
import { BriefcaseIcon, CalendarIcon, ChevronDownIcon, ExternalIcon, HeartIcon, SignOutIcon, UserIcon } from './GuestIcons';
import { useGuestSession } from './GuestSession';

/** Picture, else initials (same rule as the consumer-app). Decorative: the name is always next to it or in a label. */
export function AccountAvatar({ profile, className }: { profile: GuestProfile; className?: string }) {
  return (
    <span className={`nk-avatar-initials${className ? ` ${className}` : ''}`} aria-hidden="true">
      {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" /> : profile.initials}
    </span>
  );
}

/**
 * Header account control (AUTH-2.4, design B picked by Mos 13 Nov 2026).
 * Checking: a gap the size of the sign-in button. Signed out: the sign-in button (?next= back here).
 * Signed in: a chip with initials and first name that opens the account menu.
 */
export function AccountMenu() {
  const { t } = useLocale();
  const copy = t.guest.account;
  const session = useGuestSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (session.status === 'checking') {
    return <span className="nk-account nk-account--checking" role="status" aria-label={copy.checking} />;
  }
  if (session.status === 'signedOut') {
    return (
      <AccountLink page="signIn" className="nk-signin" data-testid="guest.signIn">
        {t.guest.nav.signIn}
      </AccountLink>
    );
  }

  const { profile } = session;
  const roleLinks = roleSiteLinks(profile.roles);
  const origin = guestAccountOrigin();
  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="nk-account">
      <button
        ref={buttonRef}
        type="button"
        className="nk-account__chip"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={fillTemplate(copy.button, { name: profile.displayName })}
        onClick={() => setOpen((value) => !value)}
        data-testid="guest.account"
      >
        <AccountAvatar profile={profile} className="nk-avatar-initials--sm" />
        <span className="nk-account__name">{profile.firstName.trim() || profile.displayName}</span>
        <ChevronDownIcon size={16} />
      </button>
      {open ? (
        <div ref={menuRef} id={menuId} role="menu" aria-label={copy.menuLabel} className="nk-account__menu" data-testid="guest.accountMenu">
          <div className="nk-account__head">
            <AccountAvatar profile={profile} />
            <div className="nk-account__who">
              <span className="nk-account__full">{profile.displayName}</span>
              <span className="nk-account__email">{profile.email}</span>
            </div>
          </div>
          <div className="nk-account__group">
            <Link href="/profile" role="menuitem" className="nk-account__item" onClick={close}>
              <UserIcon className="nk-account__icon" />
              {copy.profile}
            </Link>
            <Link href="/saved" role="menuitem" className="nk-account__item" onClick={close}>
              <HeartIcon className="nk-account__icon" />
              {copy.saved}
            </Link>
            <span role="menuitem" aria-disabled="true" className="nk-account__item nk-account__item--soon">
              <CalendarIcon className="nk-account__icon" />
              <span className="nk-account__text">{copy.viewingRequests}</span>
              <span className="nk-soon">{t.guest.nav.comingSoon}</span>
            </span>
          </div>
          {roleLinks.length > 0 ? (
            <div role="group" aria-label={copy.workspace} className="nk-account__group">
              <p className="nk-account__label" aria-hidden="true">
                {copy.workspace}
              </p>
              {roleLinks.map((link) => (
                <a
                  key={link.role}
                  href={`${origin}${link.path}`}
                  role="menuitem"
                  className="nk-account__item"
                  aria-label={fillTemplate(copy.goToRole, { role: t.roles[link.role] })}
                  data-testid={`guest.role.${link.role}`}
                >
                  <BriefcaseIcon className="nk-account__icon" />
                  <span className="nk-account__text">{t.roles[link.role]}</span>
                  <ExternalIcon size={16} className="nk-account__icon" />
                </a>
              ))}
            </div>
          ) : null}
          <div className="nk-account__group">
            <button
              type="button"
              role="menuitem"
              className="nk-account__item"
              onClick={() => {
                close();
                void session.signOut();
              }}
              data-testid="guest.signOut"
            >
              <SignOutIcon className="nk-account__icon" />
              {copy.signOut}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
