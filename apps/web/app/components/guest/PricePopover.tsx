'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { useLocale } from '@nestyk/i18n';
import { priceButtonText } from '../../../lib/guest-search';
import { ChevronDownIcon } from './GuestIcons';
import { PriceRangeField, type Price } from './PriceRangeField';

/**
 * Monthly rent field of the home search box (Mos 12 Nov 2026): a button showing the chosen range that opens a small
 * panel with the slider, the preset chips and the exact-amount boxes. "ตกลง" keeps the choice; Esc, a click outside
 * or leaving the panel with Tab closes it without changes. Focus goes back to the button.
 */
export function PricePopover({ value, onApply, labelId }: { value: Price; onApply: (price: Price) => void; labelId: string }) {
  const { t } = useLocale();
  const copy = t.guest;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Price>(value);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const words = {
    priceAny: copy.search.priceAny,
    priceUnder: copy.search.priceUnder,
    priceBetween: copy.search.priceBetween,
    priceOver: copy.results.priceFromChip,
  };

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    document.getElementById(panelId)?.querySelector<HTMLElement>('input')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="nk-price-pop"
      onBlur={(event) => {
        if (open && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) close(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="nk-input nk-price-pop__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-labelledby={`${labelId} ${panelId}-value`}
        onClick={() => {
          if (open) {
            close(false);
            return;
          }
          setDraft(value);
          setOpen(true);
        }}
        data-testid="guestHome.priceButton"
      >
        <span id={`${panelId}-value`} className="nk-price-pop__value">
          {priceButtonText(value.minPrice, value.maxPrice, words)}
        </span>
        <ChevronDownIcon size={18} />
      </button>
      {open ? (
        <div id={panelId} className="nk-price-pop__panel" role="dialog" aria-labelledby={labelId} data-testid="guestHome.pricePanel">
          <PriceRangeField minPrice={draft.minPrice} maxPrice={draft.maxPrice} onChange={(price) => setDraft(price)} idPrefix={`${panelId}-home`} />
          <div className="nk-price-pop__actions">
            <button
              type="button"
              className="nk-link-btn"
              disabled={draft.minPrice === undefined && draft.maxPrice === undefined}
              onClick={() => setDraft({ minPrice: undefined, maxPrice: undefined })}
              data-testid="guestHome.priceClear"
            >
              {copy.search.priceClear}
            </button>
            <button
              type="button"
              className="nk-btn nk-btn--dark nk-price-pop__apply"
              onClick={() => {
                onApply(draft);
                close(true);
              }}
              data-testid="guestHome.priceApply"
            >
              {copy.search.priceApply}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
