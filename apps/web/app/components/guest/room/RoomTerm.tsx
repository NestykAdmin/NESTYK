'use client';

import React, { createContext, useContext, useState } from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import { formatPublicPrice, type PriceOptionView } from '@nestyk/feature-listing/public';
import { CalendarIcon } from '../GuestIcons';

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

/** "ขอนัดดูห้อง" while viewing requests have no API yet (Mos 19 Nov 2026): shown, cannot be pressed, "เร็ว ๆ นี้". */
export function RoomViewingButton({ className = '' }: { className?: string }) {
  const { t } = useLocale();
  const copy = t.guest.room;
  return (
    <button
      type="button"
      className={`nk-btn nk-btn--primary is-soon nk-rp-viewing ${className}`.trim()}
      disabled
      aria-disabled="true"
      data-testid="roomPage.viewing"
    >
      <CalendarIcon size={20} />
      {copy.viewingCta}
      <span className="nk-soon">{t.guest.nav.comingSoon}</span>
    </button>
  );
}

/** Sticky card beside the content on wide screens (design A): contract switch, price, deposit, move-in, viewing. */
export function RoomViewingCard({ moveIn }: { moveIn: string | null }) {
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
      <RoomViewingButton />
      <p className="nk-rp-note nk-rp-note--center">
        {copy.viewingSoonNote}
      </p>
    </aside>
  );
}
