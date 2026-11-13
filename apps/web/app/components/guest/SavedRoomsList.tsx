'use client';

import React, { useEffect, useState } from 'react';
import { useLocale } from '@nestyk/i18n';
import type { PublicRoomCard } from '@nestyk/types';
import { Link } from '../../../i18n/navigation';
import { bangkokToday } from '../../../lib/guest-home';
import { fetchSavedRooms } from '../../../lib/guest-saved';
import { guestSessionToken } from '../../../lib/guest-supabase';
import { localePath } from '../../../lib/guest-site';
import { AccountLink } from './AccountLink';
import { HeartIcon } from './GuestIcons';
import { useGuestSession } from './GuestSession';
import { CardSkeleton, ErrorState } from './GuestStates';
import { RoomCard } from './RoomCard';

type ListState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; cards: PublicRoomCard[]; today: string };

const SKELETONS = 3;

/**
 * Body of /saved (S4.5 / AUTH-3). Reads the sign-in in the browser, so the page itself stays the same for everyone.
 * - Signed out: the sign-in card (as before).
 * - Signed in: the saved rooms, newest first; or an empty card with a way back to the rooms.
 * - Unsaving a room here keeps its card until the page is left, so a slip can be undone (Mos 13 Nov 2026).
 */
export function SavedRoomsList({ locale }: { locale: string }) {
  const { t } = useLocale();
  const copy = t.guest;
  const session = useGuestSession();
  const userId = session.status === 'signedIn' ? session.profile.userId : null;
  const [list, setList] = useState<ListState>({ status: 'loading' });

  useEffect(() => {
    if (!userId) return;
    setList({ status: 'loading' });
    const controller = new AbortController();
    void (async () => {
      const auth = await guestSessionToken();
      const cards = auth && auth.userId === userId ? await fetchSavedRooms(auth.token, undefined, controller.signal) : null;
      if (controller.signal.aborted) return;
      // "Today" is read here, not on the server: this page is built once and would keep the build day.
      setList(cards ? { status: 'ready', cards, today: bangkokToday() } : { status: 'error' });
    })();
    return () => controller.abort();
  }, [userId]);

  if (session.status === 'signedOut') {
    return (
      <section className="nk-card nk-empty" aria-labelledby="saved-gate-title" data-testid="saved.signIn">
        <span className="nk-empty__icon" aria-hidden="true">
          <HeartIcon size={28} />
        </span>
        <h2 id="saved-gate-title" className="nk-empty__title">
          {copy.saved.gateTitle}
        </h2>
        <p className="nk-empty__text">{copy.saved.gateBody}</p>
        <div className="nk-empty__actions">
          <AccountLink page="signIn" className="nk-btn nk-btn--primary" data-testid="saved.signInLink">
            {copy.signInPrompt.signIn}
          </AccountLink>
          <AccountLink page="register" className="nk-btn nk-btn--outline" data-testid="saved.registerLink">
            {copy.signInPrompt.register}
          </AccountLink>
        </div>
      </section>
    );
  }

  if (session.status === 'checking' || list.status === 'loading') {
    return (
      <div className="nk-room-grid" aria-busy="true" data-testid="saved.loading">
        <p className="nk-sr-only" role="status">
          {copy.states.loading}
        </p>
        {Array.from({ length: SKELETONS }, (_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (list.status === 'error') {
    return (
      <ErrorState
        title={copy.saved.errorTitle}
        body={copy.states.errorBody}
        retry={{ label: copy.states.retry, href: localePath(locale, '/saved') }}
      />
    );
  }

  if (list.cards.length === 0) {
    return (
      <section className="nk-card nk-empty" aria-labelledby="saved-empty-title" data-testid="saved.empty">
        <span className="nk-empty__icon" aria-hidden="true">
          <HeartIcon size={28} />
        </span>
        <h2 id="saved-empty-title" className="nk-empty__title">
          {copy.saved.emptyTitle}
        </h2>
        <p className="nk-empty__text">{copy.saved.emptyBody}</p>
        <div className="nk-empty__actions">
          <Link href="/" className="nk-btn nk-btn--primary" data-testid="saved.browse">
            {copy.saved.browse}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="nk-room-grid" aria-label={copy.saved.subtitle} data-testid="saved.list">
      {list.cards.map((card) => (
        <RoomCard key={card.id} card={card} copy={copy} locale={locale} today={list.today} />
      ))}
    </section>
  );
}
