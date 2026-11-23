'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import { Link } from '../../../i18n/navigation';
import { guestRoleChoices, type GuestProfile } from '../../../lib/guest-session';
import { guestAccountOrigin } from '../../../lib/guest-site';
import { AccountLink } from './AccountLink';
import { CalendarIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, HeartIcon, SignOutIcon, UserIcon } from './GuestIcons';
import { RoleAvatar, RoleOption, RoleTile } from './GuestRole';
import { useGuestSession } from './GuestSession';

/** Picture, else initials (same rule as the consumer-app); a picture that fails shows the initials (review R8). */
export function AccountAvatar({ profile, className }: { profile: GuestProfile; className?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={`nk-avatar-initials${className ? ` ${className}` : ''}`} aria-hidden="true">
      {profile.avatarUrl && !broken ? (
        <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        profile.initials
      )}
    </span>
  );
}

/**
 * Header account control (AUTH-2.4, design B picked by Mos 13 Nov 2026).
 * Checking: a gap the size of the sign-in button. Signed out: the sign-in button (?next= back here).
 * Signed in: a chip with initials and first name that opens the account panel: a disclosure of plain links and
 * buttons (review R7), closed by Escape, a click outside or focus leaving it.
 * Role (Mos 20 Nov 2026, like the admin web): the chip has the role's ring and badge; the panel shows the current
 * role with "Change", which turns the panel into the role list (Guest current, other roles open their own site).
 */
export function AccountMenu() {
  const { t } = useLocale();
  const copy = t.guest.account;
  const session = useGuestSession();
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  /** Set when the role list opens or closes, so focus moves to its first control (and not on the first render). */
  const pickerToggled = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      setPickerOpen(false);
      return;
    }
    panelRef.current?.querySelector<HTMLElement>('a[href], button:not(:disabled)')?.focus();
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

  useEffect(() => {
    if (!pickerToggled.current) return;
    pickerToggled.current = false;
    panelRef.current?.querySelector<HTMLElement>('[data-role-focus]')?.focus();
  }, [pickerOpen]);

  const togglePicker = (next: boolean) => {
    pickerToggled.current = true;
    setPickerOpen(next);
  };

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
  const choices = guestRoleChoices(profile.roles);
  const canChange = choices.length > 1;
  const roleCopy = t.agent.dashboard.webWorkspace;
  const origin = guestAccountOrigin();
  const close = () => setOpen(false);

  return (
    <div
      ref={rootRef}
      className="nk-account"
      onBlur={(event) => {
        if (open && !rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="nk-account__chip"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={fillTemplate(copy.button, { name: profile.displayName })}
        onClick={() => setOpen((value) => !value)}
        data-testid="guest.account"
      >
        <RoleAvatar role="guest">
          <AccountAvatar profile={profile} className="nk-avatar-initials--sm" />
        </RoleAvatar>
        <span className="nk-account__name">{profile.firstName.trim() || profile.displayName}</span>
        <ChevronDownIcon size={16} />
      </button>
      {open ? (
        <div ref={panelRef} id={panelId} className="nk-account__menu" data-testid="guest.accountMenu">
          <div className="nk-account__head">
            <RoleAvatar role="guest">
              <AccountAvatar profile={profile} />
            </RoleAvatar>
            <div className="nk-account__who">
              <span className="nk-account__full">{profile.displayName}</span>
              <span className="nk-account__email">{profile.email}</span>
            </div>
          </div>
          {pickerOpen ? (
            <div role="group" aria-label={roleCopy.chooseRole} className="nk-account__group nk-role-picker">
              <button
                type="button"
                className="nk-account__item nk-role-picker__back"
                onClick={() => togglePicker(false)}
                data-role-focus
                data-testid="guest.roleBack"
              >
                <ChevronLeftIcon size={18} className="nk-account__icon" />
                {roleCopy.chooseRole}
              </button>
              <p className="nk-role-picker__hint">{roleCopy.roleHint}</p>
              {choices.map((choice) => (
                <RoleOption
                  key={choice.role}
                  role={choice.role}
                  current={choice.current}
                  href={choice.current ? undefined : `${origin}${choice.path}`}
                  ariaLabel={choice.current ? undefined : fillTemplate(copy.goToRole, { role: t.roles[choice.role] })}
                  className="nk-account__item"
                  testId={`guest.role.${choice.role}`}
                  onSelect={close}
                />
              ))}
            </div>
          ) : (
            <>
              <div className="nk-account__group">
                {canChange ? (
                  <button
                    type="button"
                    className="nk-account__item nk-role-row"
                    onClick={() => togglePicker(true)}
                    data-role-focus
                    data-testid="guest.roleRow"
                  >
                    <GuestRoleRow label={t.mobile.profile.role} name={t.roles.guest} />
                    <span className="nk-role-row__change">{roleCopy.changeRole}</span>
                    <ChevronRightIcon size={16} className="nk-account__icon" />
                  </button>
                ) : (
                  <div className="nk-account__item nk-role-row" data-testid="guest.roleRow">
                    <GuestRoleRow label={t.mobile.profile.role} name={t.roles.guest} />
                  </div>
                )}
              </div>
              <div className="nk-account__group">
                <Link href="/profile" className="nk-account__item" onClick={close}>
                  <UserIcon className="nk-account__icon" />
                  {copy.profile}
                </Link>
                <Link href="/saved" className="nk-account__item" onClick={close}>
                  <HeartIcon className="nk-account__icon" />
                  {copy.saved}
                </Link>
                <Link href="/viewing-requests" className="nk-account__item" onClick={close} data-testid="guest.viewingRequests">
                  <CalendarIcon className="nk-account__icon" />
                  {copy.viewingRequests}
                </Link>
              </div>
            </>
          )}
          {pickerOpen ? null : (
            <div className="nk-account__group">
              <button
                type="button"
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
          )}
        </div>
      ) : null}
    </div>
  );
}

/** The current role in the account panel: Guest's tile, a small "Role" label and the role name. */
function GuestRoleRow({ label, name }: { label: string; name: string }) {
  return (
    <>
      <RoleTile role="guest" />
      <span className="nk-role-option__text">
        <span className="nk-role-row__label">{label}</span>
        <span className="nk-role-option__name">{name}</span>
      </span>
    </>
  );
}
