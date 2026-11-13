'use client';

import React from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import { roleSiteLinks } from '../../../lib/guest-session';
import { guestAccountOrigin } from '../../../lib/guest-site';
import { AccountAvatar } from './AccountMenu';
import { AccountLink } from './AccountLink';
import { BriefcaseIcon, ExternalIcon, SignOutIcon, UserIcon } from './GuestIcons';
import { useGuestSession } from './GuestSession';

/**
 * Top of the profile page (AUTH-2.4, design B mobile): the sign-in card when signed out, the account card and the
 * account's role pages when signed in. While checking, the sign-in card keeps its space but stays hidden.
 */
export function ProfileAccount() {
  const { t } = useLocale();
  const copy = t.guest.profile;
  const account = t.guest.account;
  const session = useGuestSession();

  if (session.status === 'signedIn') {
    const { profile } = session;
    const roleLinks = roleSiteLinks(profile.roles);
    const origin = guestAccountOrigin();
    return (
      <>
        <section aria-label={account.title} className="nk-card nk-account-card" data-testid="profile.accountCard">
          <AccountAvatar profile={profile} className="nk-avatar-initials--lg" />
          <div className="nk-account__who">
            <h2 className="nk-card__title">{profile.displayName}</h2>
            <p className="nk-card__text nk-account__email">{profile.email}</p>
          </div>
        </section>
        {roleLinks.length > 0 ? (
          <section aria-label={account.workspace} className="nk-card nk-list" data-testid="profile.workspace">
            {roleLinks.map((link) => (
              <a
                key={link.role}
                href={`${origin}${link.path}`}
                className="nk-row"
                aria-label={fillTemplate(account.goToRole, { role: t.roles[link.role] })}
                data-testid={`profile.role.${link.role}`}
              >
                <BriefcaseIcon className="nk-row__icon" />
                <span className="nk-row__label">{t.roles[link.role]}</span>
                <ExternalIcon size={18} className="nk-row__chevron" />
              </a>
            ))}
          </section>
        ) : null}
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
