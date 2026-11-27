'use client';

import React from 'react';
import { useLocale } from '@nestyk/i18n';
import { CardSkeleton } from './GuestStates';

/**
 * Page outlines while a page loads, design A (Mos 27 Nov 2026, canvas page "skeleton"): Next shows these from the
 * routes' loading.tsx at once on a page change, then the real page fills in. Grey blocks only (guest.css .nk-skel).
 */

const range = (count: number) => Array.from({ length: count }, (_, index) => index);

/** Search results: the search bar, the chips, the count and three room rows. */
export function SearchPageSkeleton() {
  const { t } = useLocale();
  return (
    <div className="nk-skel nk-skel--search" aria-busy="true" data-testid="skeleton.search">
      <span className="nk-sr-only">{t.guest.states.loading}</span>
      <div className="nk-skel__top" aria-hidden="true">
        <div className="nk-skel__inner nk-skel__bar">
          <span className="nk-skel__box nk-skel__field" />
          <span className="nk-skel__box nk-skel__go" />
        </div>
        <div className="nk-skel__inner nk-skel__chips">
          {range(4).map((index) => (
            <span key={index} className="nk-skel__box nk-skel__chip" />
          ))}
        </div>
      </div>
      <div className="nk-skel__inner nk-skel__body" aria-hidden="true">
        <span className="nk-skeleton nk-skel__count" />
        <div className="nk-room-grid nk-search-list nk-search-list--list">
          {range(3).map((index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** A room: the photo, the title, the four facts, the text and (phones) the price bar. */
export function RoomPageSkeleton() {
  const { t } = useLocale();
  return (
    <div className="nk-skel nk-skel--room" aria-busy="true" data-testid="skeleton.room">
      <span className="nk-sr-only">{t.guest.states.loading}</span>
      <div className="nk-skel__inner nk-skel__room" aria-hidden="true">
        <span className="nk-skel__box nk-skel__photo" />
        <div className="nk-skel__text">
          <span className="nk-skeleton nk-skel__title" />
          <span className="nk-skeleton nk-skeleton--short" />
          <div className="nk-skel__facts">
            {range(4).map((index) => (
              <span key={index} className="nk-skel__box nk-skel__fact" />
            ))}
          </div>
          <span className="nk-skeleton" />
          <span className="nk-skeleton" />
          <span className="nk-skeleton nk-skeleton--short" />
        </div>
      </div>
      <div className="nk-skel__price" aria-hidden="true">
        <span className="nk-skeleton nk-skeleton--price" />
        <span className="nk-skel__box nk-skel__cta" />
      </div>
    </div>
  );
}

/** An area page or the area list: a heading and a grid of room cards. */
export function ListPageSkeleton() {
  const { t } = useLocale();
  return (
    <div className="nk-skel nk-skel--list" aria-busy="true" data-testid="skeleton.list">
      <span className="nk-sr-only">{t.guest.states.loading}</span>
      <div className="nk-skel__inner nk-skel__body" aria-hidden="true">
        <span className="nk-skeleton nk-skel__title" />
        <span className="nk-skeleton nk-skeleton--short" />
        <div className="nk-room-grid">
          {range(3).map((index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Home "ประกาศแนะนำสำหรับคุณ" while the rooms load: the tabs and a row of room cards. */
export function HomeListingsSkeleton() {
  const { t } = useLocale();
  return (
    <div className="nk-skel nk-skel--part" aria-busy="true" data-testid="skeleton.home.listings">
      <span className="nk-sr-only">{t.guest.states.loading}</span>
      <div className="nk-skel__tabs" aria-hidden="true">
        {range(2).map((index) => (
          <span key={index} className="nk-skel__box nk-skel__tab" />
        ))}
      </div>
      <div className="nk-room-grid" aria-hidden="true">
        {range(4).map((index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

/** Home areas while they load: the heading and a grid of area cards. */
export function HomeAreasSkeleton() {
  const { t } = useLocale();
  return (
    <div className="nk-skel nk-skel--part nk-areas" aria-busy="true" data-testid="skeleton.home.areas">
      <span className="nk-sr-only">{t.guest.states.loading}</span>
      <span className="nk-skeleton nk-skel__title" aria-hidden="true" />
      <div className="nk-area-grid nk-home-areas__grid" aria-hidden="true">
        {range(6).map((index) => (
          <div key={index} className="nk-area nk-area--skeleton">
            <div className="nk-area__media" />
            <div className="nk-area__body">
              <span className="nk-skeleton nk-skeleton--short" />
              <span className="nk-skeleton" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
