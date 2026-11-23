'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import { formatPublicPrice, type PriceOptionView } from '@nestyk/feature-listing/public';
import { CalendarIcon } from '../GuestIcons';
import { useGuestSession } from '../GuestSession';
import { SignInPrompt } from '../SignInPrompt';
import { ViewingRequestDialog, type ViewingRequestRoom } from '../ViewingRequestDialog';

type TermState = { options: PriceOptionView[]; months: number | null; choose: (months: number) => void };

const TermContext = createContext<TermState>({ options: [], months: null, choose: () => {} });

/**
 * One chosen contract length for the whole room page (design RoomMixWeb): the price cards and the viewing card show
 * the same choice. Starts on the lowest monthly price.
 */
export function RoomTermProvider({
  options,
  initialMonths,
  children,
}: {
  options: PriceOptionView[];
  initialMonths: number | null;
  children: React.ReactNode;
}) {
  const [months, setMonths] = useState<number | null>(initialMonths);
  return <TermContext.Provider value={{ options, months, choose: setMonths }}>{children}</TermContext.Provider>;
}

/** Three price cards (design B): the chosen one has a dark border, the lowest has a badge. */
export function RoomPriceCards() {
  const { t } = useLocale();
  const copy = t.guest.room;
  const { options, months } = useContext(TermContext);
  if (!options.length) return null;
  return (
    <>
      <ul className="nk-rp-prices" data-testid="roomPage.prices">
        {options.map((option) => (
          <li key={option.durationMonths} className={option.durationMonths === months ? 'nk-rp-price is-chosen' : 'nk-rp-price'}>
            <span className="nk-rp-price__term">
              {fillTemplate(copy.contractMonths, { count: option.durationMonths })}
              {option.lowest ? <span className="nk-rp-price__badge">{copy.lowestPrice}</span> : null}
            </span>
            <span className="nk-rp-price__value">
              {formatPublicPrice(option.pricePerMonth)}
              <span className="nk-rp-price__unit"> {t.guest.card.perMonth}</span>
            </span>
            {option.depositAmount != null ? (
              <span className="nk-rp-price__deposit">
                {copy.deposit} {formatPublicPrice(option.depositAmount)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {options.length > 1 ? <p className="nk-rp-note nk-rp-desk">{copy.selectedNote}</p> : null}
    </>
  );
}

/**
 * "ขอนัดดูห้อง" (viewing requests, plan 23 Nov 2026). Signed in: opens the request form. Signed out or still checking:
 * the sign-in prompt in place, worded for a viewing (as the heart does for saving).
 */
export function RoomViewingButton({ room, className = '' }: { room: ViewingRequestRoom; className?: string }) {
  const { t } = useLocale();
  const copy = t.guest.room;
  const session = useGuestSession();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`nk-btn nk-btn--primary nk-rp-viewing ${className}`.trim()}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        data-testid="roomPage.viewing"
      >
        <CalendarIcon size={20} />
        {copy.viewingCta}
      </button>
      {open && session.status === 'signedIn' ? <ViewingRequestDialog room={room} onClose={close} returnFocus={buttonRef} /> : null}
      {open && session.status !== 'signedIn' ? <SignInPrompt reason="viewing" room={room} onClose={close} returnFocus={buttonRef} /> : null}
    </>
  );
}

/** Sticky card beside the content on wide screens (design A): contract switch, price, deposit, move-in, viewing. */
export function RoomViewingCard({ moveIn, room }: { moveIn: string | null; room: ViewingRequestRoom }) {
  const { t } = useLocale();
  const copy = t.guest.room;
  const { options, months, choose } = useContext(TermContext);
  const chosen = options.find((option) => option.durationMonths === months) ?? options[0] ?? null;
  return (
    <aside className="nk-rp-card" aria-label={copy.viewingCardLabel} data-testid="roomPage.viewingCard">
      {options.length > 1 ? (
        <div role="radiogroup" aria-label={copy.termLabel} className="nk-rp-terms">
          {options.map((option) => {
            const on = option.durationMonths === chosen?.durationMonths;
            return (
              <button
                key={option.durationMonths}
                type="button"
                role="radio"
                aria-checked={on}
                className={on ? 'nk-rp-term is-on' : 'nk-rp-term'}
                onClick={() => choose(option.durationMonths)}
              >
                {fillTemplate(copy.monthsShort, { count: option.durationMonths })}
              </button>
            );
          })}
        </div>
      ) : null}
      {chosen ? (
        <p className="nk-rp-card__price" aria-live="polite">
          <span className="nk-rp-card__value">{formatPublicPrice(chosen.pricePerMonth)}</span>
          <span className="nk-rp-card__unit">{t.guest.card.perMonth}</span>
        </p>
      ) : null}
      <dl className="nk-rp-card__facts">
        {chosen?.depositAmount != null ? (
          <>
            <dt>{copy.deposit}</dt>
            <dd>{formatPublicPrice(chosen.depositAmount)}</dd>
          </>
        ) : null}
        {moveIn ? (
          <>
            <dt>{copy.moveIn}</dt>
            <dd>{moveIn}</dd>
          </>
        ) : null}
      </dl>
      <RoomViewingButton room={room} />
      <p className="nk-rp-note nk-rp-note--center">{copy.viewingNote}</p>
    </aside>
  );
}
