'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLocale } from '@nestyk/i18n';
import { isRentPreset } from '@nestyk/feature-search';
import { RENT_PRESET_CHOICES, presetLabel, type PriceWords } from '../../../lib/guest-search';
import { PriceRangeSlider } from './PriceRangeSlider';

export type Price = { minPrice: number | undefined; maxPrice: number | undefined };
export type PriceChange = (price: Price, options?: { debounce?: boolean }) => void;

function priceText(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

function parsePrice(text: string): number | undefined {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) : undefined;
}

/**
 * Monthly rent: slider, the six preset chips shared with the app, and the two boxes for an exact amount. Used by
 * the search filter panel, the mobile filter sheet and the home search box. Dragging and typing report with
 * `debounce`; a preset applies at once.
 */
export function PriceRangeField({ minPrice, maxPrice, onChange, idPrefix }: Price & { onChange: PriceChange; idPrefix: string }) {
  const { t } = useLocale();
  const copy = t.guest;
  const words: PriceWords = {
    priceAny: copy.search.priceAny,
    priceUnder: copy.search.priceUnder,
    priceBetween: copy.search.priceBetween,
    priceOver: copy.results.priceFromChip,
  };
  const [minText, setMinText] = useState(priceText(minPrice));
  const [maxText, setMaxText] = useState(priceText(maxPrice));
  const minRef = useRef<HTMLInputElement>(null);
  const maxRef = useRef<HTMLInputElement>(null);

  // The slider, a preset, a removed chip or "clear all" change the price from outside. The box the guest is
  // typing in is left alone (review R3) and catches up when it loses focus.
  useEffect(() => {
    if (document.activeElement === minRef.current) return;
    setMinText((text) => (parsePrice(text) === minPrice ? text : priceText(minPrice)));
  }, [minPrice]);
  useEffect(() => {
    if (document.activeElement === maxRef.current) return;
    setMaxText((text) => (parsePrice(text) === maxPrice ? text : priceText(maxPrice)));
  }, [maxPrice]);

  return (
    <div className="nk-price-field">
      <PriceRangeSlider minPrice={minPrice} maxPrice={maxPrice} onChange={(price) => onChange(price, { debounce: true })} idPrefix={idPrefix} />
      <div className="nk-filters__chips nk-price-field__presets">
        {RENT_PRESET_CHOICES.map((preset, index) => (
          <button
            key={index}
            type="button"
            className="nk-chip nk-chip--small"
            aria-pressed={isRentPreset(minPrice, maxPrice, preset)}
            onClick={() => onChange({ minPrice: preset.min, maxPrice: preset.max })}
            data-testid={`priceField.preset.${index}`}
          >
            {presetLabel(preset, words)}
          </button>
        ))}
      </div>
      <div className="nk-filters__price">
        <label className="nk-filters__price-field" htmlFor={`${idPrefix}-min`}>
          <span className="nk-filters__hint">{copy.results.priceMin}</span>
          <input
            ref={minRef}
            id={`${idPrefix}-min`}
            className="nk-input"
            inputMode="numeric"
            autoComplete="off"
            value={minText}
            placeholder="0"
            onBlur={() => setMinText((text) => (parsePrice(text) === minPrice ? text : priceText(minPrice)))}
            onChange={(event) => {
              setMinText(event.target.value);
              onChange({ minPrice: parsePrice(event.target.value), maxPrice }, { debounce: true });
            }}
            data-testid="searchFilters.priceMin"
          />
        </label>
        <span className="nk-filters__dash" aria-hidden="true">
          –
        </span>
        <label className="nk-filters__price-field" htmlFor={`${idPrefix}-max`}>
          <span className="nk-filters__hint">{copy.results.priceMax}</span>
          <input
            ref={maxRef}
            id={`${idPrefix}-max`}
            className="nk-input"
            inputMode="numeric"
            autoComplete="off"
            value={maxText}
            placeholder="100,000"
            onBlur={() => setMaxText((text) => (parsePrice(text) === maxPrice ? text : priceText(maxPrice)))}
            onChange={(event) => {
              setMaxText(event.target.value);
              onChange({ minPrice, maxPrice: parsePrice(event.target.value) }, { debounce: true });
            }}
            data-testid="searchFilters.priceMax"
          />
        </label>
      </div>
    </div>
  );
}
