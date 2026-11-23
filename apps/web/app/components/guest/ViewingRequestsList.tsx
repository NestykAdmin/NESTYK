'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import type { GuestViewingRequest } from '@nestyk/types';
import { buildPublicRoomSpecs, formatPublicPrice } from '@nestyk/feature-listing/public';
import { Link } from '../../../i18n/navigation';
import { roomDisplayTitle } from '../../../lib/guest-home';
import { localePath } from '../../../lib/guest-site';
import { guestSessionToken } from '../../../lib/guest-supabase';
import {
  cancelViewingRequest,
  fetchMyViewingRequests,
  guestStage,
  progressStep,
  splitRequests,
  type GuestStage,
} from '../../../lib/guest-viewing-requests';
import { AccountLink } from './AccountLink';
import { CalendarIcon, CheckIcon, PhotoIcon } from './GuestIcons';
import { useGuestSession } from './GuestSession';
import { ErrorState } from './GuestStates';

type ListState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; requests: GuestViewingRequest[] };

function intlLocale(locale: string): string {
  return locale === 'th' ? 'th-TH-u-ca-gregory' : locale;
}

function shortDay(day: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));
}

function dateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(iso));
}

/**
 * Body of /viewing-requests (plan 23 Nov 2026, Mos picked "room card + 3-step bar"). Reads the sign-in in the
 * browser, so the page itself is the same for everyone.
 * - Signed out: the sign-in card. Signed in: open requests first, finished ones folded below.
 * - The guest sees 5 simple stages; who coordinates (admin or the agent) stays behind the scenes.
 * - Cancel asks once more in place (no browser dialog), then reloads the list.
 */
export function ViewingRequestsList({ locale }: { locale: string }) {
  const { t } = useLocale();
  const copy = t.guest.viewing;
  const session = useGuestSession();
  const userId = session.status === 'signedIn' ? session.profile.userId : null;
  const [list, setList] = useState<ListState>({ status: 'loading' });

  const load = useCallback(async (owner: string, signal?: AbortSignal) => {
    const auth = await guestSessionToken();
    const requests = auth && auth.userId === owner ? await fetchMyViewingRequests(auth.token) : null;
    if (signal?.aborted) return;
    setList(requests ? { status: 'ready', requests } : { status: 'error' });
  }, []);

  useEffect(() => {
    if (!userId) return;
    setList({ status: 'loading' });
    const controller = new AbortController();
    void load(userId, controller.signal);
    return () => controller.abort();
  }, [userId, load]);

  if (session.status === 'signedOut') {
    return (
      <section className="nk-card nk-empty" aria-labelledby="vr-gate-title" data-testid="viewingRequests.signIn">
        <span className="nk-empty__icon" aria-hidden="true">
          <CalendarIcon size={28} />
        </span>
        <h2 id="vr-gate-title" className="nk-empty__title">
          {copy.gateTitle}
        </h2>
        <p className="nk-empty__text">{copy.gateBody}</p>
        <div className="nk-empty__actions">
          <AccountLink page="signIn" className="nk-btn nk-btn--primary">
            {t.guest.signInPrompt.signIn}
          </AccountLink>
          <AccountLink page="register" className="nk-btn nk-btn--outline">
            {t.guest.signInPrompt.register}
          </AccountLink>
        </div>
      </section>
    );
  }

  if (session.status === 'checking' || list.status === 'loading') {
    return (
      <div className="nk-vr-list" aria-busy="true" data-testid="viewingRequests.loading">
        <p className="nk-sr-only" role="status">
          {t.guest.states.loading}
        </p>
        <div className="nk-card nk-vr-item nk-vr-item--skeleton" aria-hidden="true" />
        <div className="nk-card nk-vr-item nk-vr-item--skeleton" aria-hidden="true" />
      </div>
    );
  }

  if (list.status === 'error') {
    return <ErrorState title={copy.errorTitle} body={t.guest.states.errorBody} retry={{ label: t.guest.states.retry, href: localePath(locale, '/viewing-requests') }} />;
  }

  if (!list.requests.length) {
    return (
      <section className="nk-card nk-empty" aria-labelledby="vr-empty-title" data-testid="viewingRequests.empty">
        <span className="nk-empty__icon" aria-hidden="true">
          <CalendarIcon size={28} />
        </span>
        <h2 id="vr-empty-title" className="nk-empty__title">
          {copy.emptyTitle}
        </h2>
        <p className="nk-empty__text">{copy.emptyBody}</p>
        <div className="nk-empty__actions">
          <Link href="/search" className="nk-btn nk-btn--primary">
            {copy.browse}
          </Link>
        </div>
      </section>
    );
  }

  const { open, ended } = splitRequests(list.requests);
  const reload = () => (userId ? load(userId) : Promise.resolve());
  return (
    <div className="nk-vr-list" data-testid="viewingRequests.list">
      {open.length ? (
        <section aria-labelledby="vr-open-title">
          <h2 id="vr-open-title" className="nk-vr-list__title">
            {fillTemplate(copy.openTitle, { count: open.length })}
          </h2>
          <ul className="nk-vr-list__items">
            {open.map((request) => (
              <li key={request.id}>
                <RequestCard request={request} locale={locale} onChanged={reload} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {ended.length ? (
        <details className="nk-vr-list__ended" open={!open.length}>
          <summary className="nk-vr-list__title">{fillTemplate(copy.endedTitle, { count: ended.length })}</summary>
          <ul className="nk-vr-list__items">
            {ended.map((request) => (
              <li key={request.id}>
                <RequestCard request={request} locale={locale} onChanged={reload} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function RequestCard({ request, locale, onChanged }: { request: GuestViewingRequest; locale: string; onChanged: () => Promise<void> }) {
  const { t } = useLocale();
  const copy = t.guest.viewing;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const stage = guestStage(request.status);
  const step = progressStep(stage);
  const stageName: Record<GuestStage, string> = {
    sent: copy.stageSent,
    coordinating: copy.stageCoordinating,
    scheduled: copy.stageScheduled,
    viewed: copy.stageViewed,
    ended: copy.stageEnded,
  };
  const card = request.room;
  const [bedrooms] = card ? buildPublicRoomSpecs({ bedrooms: card.bedrooms, bathrooms: null, areaSqm: null }, t.guest.spec) : [];
  const title = card
    ? roomDisplayTitle(card, { titleFallback: t.guest.card.titleFallback, roomFallback: t.guest.card.roomFallback, propertyType: t.guest.propertyType }, bedrooms ?? null)
    : copy.roomGone;
  const price = card ? formatPublicPrice(card.priceFrom) : null;

  const cancel = async () => {
    setBusy(true);
    setProblem(null);
    const auth = await guestSessionToken();
    const result = auth ? await cancelViewingRequest(auth.token, request.id) : 'signedOut';
    setBusy(false);
    if (result === 'ok' || result === 'closed') {
      if (result === 'closed') setProblem(copy.cancelClosed);
      setConfirming(false);
      await onChanged();
      return;
    }
    setProblem(result === 'signedOut' ? copy.errorSignedOut : copy.cancelFailed);
  };

  return (
    <article className={`nk-card nk-vr-item is-${stage}`} data-testid="viewingRequests.item">
      <div className="nk-vr-item__room">
        {card?.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.coverImageUrl} alt="" className="nk-vr-item__photo" />
        ) : (
          <span className="nk-vr-item__photo nk-vr-item__photo--empty" aria-hidden="true">
            <PhotoIcon size={22} />
          </span>
        )}
        <div className="nk-vr-item__text">
          {card ? (
            <a href={localePath(locale, `/rooms/${encodeURIComponent(request.roomId)}`)} className="nk-vr-item__title">
              {title}
            </a>
          ) : (
            <span className="nk-vr-item__title is-gone">{title}</span>
          )}
          {price ? (
            <span className="nk-vr-item__price">
              {price} {t.guest.card.perMonth}
            </span>
          ) : null}
        </div>
        <span className={`nk-vr-item__stage is-${stage}`}>{stageName[stage]}</span>
      </div>

      {step > 0 ? (
        <ol className="nk-vr-steps" aria-label={fillTemplate(copy.progressLabel, { stage: stageName[stage] })}>
          {[copy.stepSent, copy.stepCoordinating, copy.stepScheduled].map((label, i) => (
            <li key={label} className={i < step ? 'is-done' : undefined} aria-current={i === step - 1 ? 'step' : undefined}>
              <span className="nk-vr-steps__dot" aria-hidden="true">
                {i < step ? <CheckIcon size={12} /> : null}
              </span>
              <span className="nk-vr-steps__label">{label}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {request.scheduledAt && (stage === 'scheduled' || stage === 'viewed') ? (
        <p className="nk-vr-item__when">
          <CalendarIcon size={18} />
          {fillTemplate(copy.scheduledAt, { date: dateTime(request.scheduledAt, locale) })}
        </p>
      ) : (
        <p className="nk-vr-item__meta">
          <span>{copy.preferred}</span> {request.preferredDates.map((day) => shortDay(day, locale)).join(', ')} ·{' '}
          {
            {
              morning: copy.slotMorning,
              afternoon: copy.slotAfternoon,
              evening: copy.slotEvening,
              any: copy.slotAny,
            }[request.preferredSlot]
          }
        </p>
      )}

      {problem ? (
        <p className="nk-vr__error" role="alert">
          {problem}
        </p>
      ) : null}

      {request.cancellable ? (
        <div className="nk-vr-item__actions">
          {confirming ? (
            <>
              <span className="nk-vr-item__confirm">{copy.cancelConfirm}</span>
              <button type="button" className="nk-btn nk-btn--outline nk-btn--sm" onClick={() => setConfirming(false)} disabled={busy}>
                {copy.cancelNo}
              </button>
              <button type="button" className="nk-btn nk-btn--danger nk-btn--sm" onClick={() => void cancel()} disabled={busy} aria-busy={busy || undefined} data-testid="viewingRequests.cancelYes">
                {copy.cancelYes}
              </button>
            </>
          ) : (
            <button type="button" className="nk-vr-item__cancel" onClick={() => setConfirming(true)} data-testid="viewingRequests.cancel">
              {copy.cancel}
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}
