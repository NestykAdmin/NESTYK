'use client';

import React, { useId, useState } from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import { GUEST_QUICK_FILTERS } from '@nestyk/feature-search';
import { formatPublicPrice } from '@nestyk/feature-listing/public';
import { useRouter } from '../../../i18n/navigation';
import { BEDROOM_CHOICES, HOME_PROPERTY_TYPES, PRICE_RANGES, searchHrefIfReady } from '../../../lib/guest-home';
import { isGuestPageReady } from '../../../lib/guest-site';
import { SearchIcon } from './GuestIcons';

/**
 * Home search box (S3.4, design v2.3): rent / buy (buy is "coming soon"), one search row, popular filters.
 * Sends the guest to /search with the chosen values in the URL. On mobile only the keyword row and the popular
 * filters show (guest.css), as in MobileHomeV23.
 */
export function SearchPanel() {
  const { t } = useLocale();
  const copy = t.guest;
  const router = useRouter();
  const id = useId();
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState('');
  const [price, setPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [quick, setQuick] = useState<string[]>([]);

  const priceLabel = (range: (typeof PRICE_RANGES)[number]) => {
    const min = range.min != null ? formatPublicPrice(range.min) ?? '' : '';
    const max = range.max != null ? formatPublicPrice(range.max) ?? '' : '';
    if (range.min == null) return fillTemplate(copy.search.priceUnder, { max });
    if (range.max == null) return fillTemplate(copy.search.priceOver, { min });
    return fillTemplate(copy.search.priceBetween, { min, max });
  };
  const bedroomLabel = (choiceId: string) => {
    if (choiceId === 'studio') return copy.spec.bedroom.studio;
    if (choiceId === 'one') return fillTemplate(copy.spec.bedroom.one, { count: 1 });
    if (choiceId === 'two') return fillTemplate(copy.spec.bedroom.many, { count: 2 });
    return copy.spec.bedroom.threePlus;
  };
  const toggleQuick = (code: string) =>
    setQuick((current) => (current.includes(code) ? current.filter((value) => value !== code) : [...current, code]));

  // Until the search page is built (S4.2) the button is off and says "เร็ว ๆ นี้" (R4, Mos 11 Nov 2026).
  const ready = isGuestPageReady('search');
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const href = searchHrefIfReady({ keyword, type, price, bedrooms, quick }, ready);
    if (href) router.push(href);
  };

  return (
    <form className="nk-search" role="search" aria-label={copy.search.submit} onSubmit={submit} data-testid="guestHome.searchPanel">
      <div role="radiogroup" aria-label={copy.search.modeLabel} className="nk-search__modes">
        <button type="button" role="radio" aria-checked="true" className="nk-search__mode">
          {copy.search.modeRent}
        </button>
        <button type="button" role="radio" aria-checked="false" aria-disabled="true" disabled className="nk-search__mode">
          {copy.search.modeBuy}
          <span className="nk-soon">{copy.search.comingSoon}</span>
        </button>
      </div>
      <div className="nk-search__row">
        <div className="nk-field nk-field--keyword">
          <label htmlFor={`${id}-q`} className="nk-field__label">
            {copy.search.keywordLabel}
          </label>
          <div className="nk-field__control">
            <SearchIcon size={18} className="nk-field__icon" />
            <input
              id={`${id}-q`}
              type="search"
              value={keyword}
              maxLength={100}
              placeholder={copy.search.keywordPlaceholder}
              onChange={(event) => setKeyword(event.target.value)}
              className="nk-input nk-input--icon"
              data-testid="guestHome.searchKeyword"
            />
          </div>
        </div>
        <div className="nk-field nk-search__more">
          <label htmlFor={`${id}-type`} className="nk-field__label">
            {copy.search.typeLabel}
          </label>
          <select id={`${id}-type`} value={type} onChange={(event) => setType(event.target.value)} className="nk-input">
            <option value="">{copy.search.typeAll}</option>
            {HOME_PROPERTY_TYPES.map((value) => (
              <option key={value} value={value}>
                {copy.propertyType[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="nk-field nk-search__more">
          <label htmlFor={`${id}-price`} className="nk-field__label">
            {copy.search.priceLabel}
          </label>
          <select id={`${id}-price`} value={price} onChange={(event) => setPrice(event.target.value)} className="nk-input">
            <option value="">{copy.search.priceAny}</option>
            {PRICE_RANGES.map((range) => (
              <option key={range.id} value={range.id}>
                {priceLabel(range)}
              </option>
            ))}
          </select>
        </div>
        <div className="nk-field nk-search__more">
          <label htmlFor={`${id}-beds`} className="nk-field__label">
            {copy.search.bedroomsLabel}
          </label>
          <select id={`${id}-beds`} value={bedrooms} onChange={(event) => setBedrooms(event.target.value)} className="nk-input">
            <option value="">{copy.search.bedroomsAny}</option>
            {BEDROOM_CHOICES.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {bedroomLabel(choice.id)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="nk-btn nk-btn--primary nk-search__submit"
          disabled={!ready}
          data-testid="guestHome.searchSubmit"
        >
          <SearchIcon size={18} />
          {copy.search.submit}
          {ready ? null : <span className="nk-soon">{copy.search.comingSoon}</span>}
        </button>
      </div>
      <div className="nk-search__quick">
        <span className="nk-search__quick-label">{copy.search.popularFilters}</span>
        {GUEST_QUICK_FILTERS.map((code) => (
          <button
            key={code}
            type="button"
            aria-pressed={quick.includes(code)}
            onClick={() => toggleQuick(code)}
            className="nk-chip"
            data-testid={`guestHome.quick.${code}`}
          >
            {copy.quick[code]}
          </button>
        ))}
      </div>
    </form>
  );
}
