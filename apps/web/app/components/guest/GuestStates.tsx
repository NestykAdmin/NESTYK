import React from 'react';
import Link from 'next/link';
import { PhotoIcon, SearchIcon } from './GuestIcons';

/** Nothing to show (S3.5): a calm message, optionally with one action. */
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: { label: string; href: string } }) {
  return (
    <div className="nk-state" role="status" data-testid="guest.emptyState">
      <span className="nk-state__icon" aria-hidden="true">
        <SearchIcon size={24} />
      </span>
      <p className="nk-state__title">{title}</p>
      {body ? <p className="nk-state__body">{body}</p> : null}
      {action ? (
        <Link href={action.href} className="nk-btn nk-btn--secondary">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

/** A section that could not load (S3.5). "Try again" reloads the page; the rest of the page still works. */
export function ErrorState({ title, body, retry }: { title: string; body: string; retry: { label: string; href: string } }) {
  return (
    <div className="nk-state nk-state--error" role="alert" data-testid="guest.errorState">
      <p className="nk-state__title">{title}</p>
      <p className="nk-state__body">{body}</p>
      <a href={retry.href} className="nk-btn nk-btn--secondary">
        {retry.label}
      </a>
    </div>
  );
}

/** Grey card shape while rooms load (S3.5). Hidden from screen readers; the list announces "กำลังโหลด" once. */
export function CardSkeleton() {
  return (
    <div className="nk-room nk-room--skeleton" aria-hidden="true" data-testid="roomCard.skeleton">
      <div className="nk-room__media">
        <span className="nk-room__placeholder">
          <PhotoIcon size={28} />
        </span>
      </div>
      <div className="nk-room__body">
        <span className="nk-skeleton nk-skeleton--price" />
        <span className="nk-skeleton" />
        <span className="nk-skeleton nk-skeleton--short" />
      </div>
    </div>
  );
}
