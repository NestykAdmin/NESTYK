'use client';

import React, { useEffect, useState } from 'react';
import { useLocale } from '@nestyk/i18n';
import {
  PRICE_SLIDER,
  moveSliderHandle,
  priceFromSlider,
  sliderFromPrice,
  sliderText,
  sliderValueText,
  type SliderRange,
} from '../../../lib/guest-search';

/**
 * Monthly rent slider with two handles (Mos 12 Nov 2026): ฿0 – ฿100,000+, ฿1,000 a step. Two native range inputs
 * share one track, so mouse, touch and the arrow keys all work and screen readers hear each handle's price.
 * Every move is reported with `debounce`, so the desktop panel searches once the guest lets go; the mobile sheet
 * keeps it until "ดูผลลัพธ์".
 */
export function PriceRangeSlider({
  minPrice,
  maxPrice,
  onChange,
  idPrefix,
}: {
  minPrice: number | undefined;
  maxPrice: number | undefined;
  onChange: (price: { minPrice: number | undefined; maxPrice: number | undefined }) => void;
  idPrefix: string;
}) {
  const { t } = useLocale();
  const copy = t.guest.results;
  const [range, setRange] = useState<SliderRange>(() => sliderFromPrice(minPrice, maxPrice));

  // Typed prices, a removed chip or "clear all" move the handles too.
  useEffect(() => {
    setRange(sliderFromPrice(minPrice, maxPrice));
  }, [minPrice, maxPrice]);

  const move = (handle: 'min' | 'max', value: number) => {
    const next = moveSliderHandle(range, handle, value);
    setRange(next);
    onChange(priceFromSlider(next[0], next[1]));
  };
  const span = PRICE_SLIDER.max - PRICE_SLIDER.min;
  const style = {
    '--nk-range-from': `${((range[0] - PRICE_SLIDER.min) / span) * 100}%`,
    '--nk-range-to': `${((range[1] - PRICE_SLIDER.min) / span) * 100}%`,
  } as React.CSSProperties;
  // When both handles sit at the top end, the lower one must stay reachable.
  const lowOnTop = range[0] > PRICE_SLIDER.max - PRICE_SLIDER.step * 2;

  return (
    <div className="nk-range" style={style} data-testid="searchFilters.priceSlider">
      <p className="nk-range__value" aria-hidden="true">
        {sliderText(range, copy.priceOpenMax)}
      </p>
      <div className="nk-range__track">
        <input
          id={`${idPrefix}-slider-min`}
          type="range"
          className={lowOnTop ? 'nk-range__input nk-range__input--top' : 'nk-range__input'}
          min={PRICE_SLIDER.min}
          max={PRICE_SLIDER.max}
          step={PRICE_SLIDER.step}
          value={range[0]}
          aria-label={copy.priceSliderMin}
          aria-valuetext={sliderValueText(range[0], copy.priceOpenMax)}
          onChange={(event) => move('min', Number(event.target.value))}
          data-testid="searchFilters.priceSliderMin"
        />
        <input
          id={`${idPrefix}-slider-max`}
          type="range"
          className="nk-range__input"
          min={PRICE_SLIDER.min}
          max={PRICE_SLIDER.max}
          step={PRICE_SLIDER.step}
          value={range[1]}
          aria-label={copy.priceSliderMax}
          aria-valuetext={sliderValueText(range[1], copy.priceOpenMax)}
          onChange={(event) => move('max', Number(event.target.value))}
          data-testid="searchFilters.priceSliderMax"
        />
      </div>
    </div>
  );
}
