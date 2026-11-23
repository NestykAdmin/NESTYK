'use client';

import React from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import { guestRoleChoices } from '../../../lib/guest-session';
import { guestAccountOrigin } from '../../../lib/guest-site';
import { AccountAvatar } from './AccountMenu';
import { AccountLink } from './AccountLink';
import { SignOutIcon, UserIcon } from './GuestIcons';
import { RoleAvatar, RoleOption } from './GuestRole';
import { useGuestSession } from './GuestSession';

/**
 * Top of the profile page (AUTH-2.4, design B mobile): the sign-in card when signed out, the account card and the
 * account's role pages when signed in. While checking, the sign-in card keeps its space but stays hidden.
 * Roles (Mos 20 Nov 2026, like the admin web): the picture has the role's ring and badge, and the role card lists
 * Guest (current) and the account's other roles with their tiles, each opening its own site.
 */
export function ProfileAccount() {
  const { t } = useLocale();
  const copy = t.guest.profile;
  const account = t.guest.account;
  const session = useGuestSession();

  if (session.status === 'signedIn') {
    const { profile } = session;
    const choices = guestRoleChoices(profile.roles);
    const roleCopy = t.agent.dashboard.webWorkspace;
    const origin = guestAccountOrigin();
    return (
      <>
        <section aria-label={account.title} className="nk-card nk-account-card" data-testid="profile.accountCard">
          <RoleAvatar role="guest">
            <AccountAvatar profile={profile} className="nk-avatar-initials--lg" />
          </RoleAvatar>
          <div className="nk-account__who">
            <h2 className="nk-card__title">{profile.displayName}</h2>
            <p className="nk-card__text nk-account__email">{profile.email}</p>
          </div>
        </section>
        <section aria-label={roleCopy.chooseRole} className="nk-card nk-list nk-role-list" data-testid="profile.workspace">
          <p className="nk-role-list__title">{t.mobile.profile.role}</p>
          {choices.map((choice) => (
            <RoleOption
              key={choice.role}
              role={choice.role}
              current={choice.current}
              href={choice.current ? undefined : `${origin}${choice.path}`}
              ariaLabel={choice.current ? undefined : fillTemplate(account.goToRole, { role: t.roles[choice.role] })}
              className="nk-row"
              testId={`profile.role.${choice.role}`}
            />
          ))}
          {choices.length > 1 ? <p className="nk-role-list__hint">{roleCopy.roleHint}</p> : null}
        </section>
      </>
    );
  }

  return (
    <section
      className={`nk-card nk-signin-card${session.status === 'checking' ? ' nk-signin-card--checking' : ''}`}
      aria-busy={session.status === 'checking' ? true : undefined}
      data-testid="profile.signInCard"
    >
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
  );
}

/** Sign-out at the end of the profile page, only when signed in. Stays on the page (it is public). */
export function ProfileSignOut() {
  const { t } = useLocale();
  const session = useGuestSession();
  if (session.status !== 'signedIn') return null;
  return (
    <button type="button" className="nk-btn nk-btn--signout" onClick={() => void session.signOut()} data-testid="profile.signOut">
      <SignOutIcon />
      {t.guest.account.signOut}
    </button>
  );
}
