'use client';

import React, { useId, useRef, useState } from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import { GUEST_QUICK_FILTERS } from '@nestyk/feature-search';
import { Link, useRouter } from '../../../i18n/navigation';
import { BEDROOM_CHOICES, HOME_PROPERTY_TYPES, searchHrefIfReady, type HomeSearchInput } from '../../../lib/guest-home';
import { locationPatch, type LocationChoice } from '../../../lib/guest-location';
import { FIND_FROM_SITE } from '../../../lib/guest-recent';
import { isGuestPageReady, shownQuickFilters } from '../../../lib/guest-site';
import { SearchIcon } from './GuestIcons';
import { LocationCombobox } from './LocationCombobox';
import { PricePopover } from './PricePopover';
import type { Price } from './PriceRangeField';

/**
 * Home search box (S3.4, design v2.3): rent / buy (buy is "coming soon"), one search row, popular filters.
 * Sends the guest to /search with the chosen values in the URL. On phones (Mos 25 Nov 2026, canvas "searchnew" N1)
 * only a search bar shows, a link to the search page /find; the row and the popular filters are hidden (guest.css).
 */
export function SearchPanel() {
  const { t } = useLocale();
  const copy = t.guest;
  const router = useRouter();
  const id = useId();
  const [keyword, setKeyword] = useState('');
  // An area or "near me" picked in the keyword box; typing again turns the box back into a plain keyword.
  const [place, setPlace] = useState<Exclude<LocationChoice, { kind: 'keyword' }> | null>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const [type, setType] = useState('');
  const [price, setPrice] = useState<Price>({ minPrice: undefined, maxPrice: undefined });
  const [bedrooms, setBedrooms] = useState('');
  const [quick, setQuick] = useState<string[]>([]);

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
  const go = (location: Pick<HomeSearchInput, 'keyword' | 'area' | 'nearGps' | 'placeName'>) => {
    const href = searchHrefIfReady({ ...location, type, minPrice: price.minPrice, maxPrice: price.maxPrice, bedrooms, quick }, ready);
    if (href) router.push(href);
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    go(place ? locationPatch(place) : { keyword });
  };
  const pickLocation = (choice: LocationChoice) => {
    if (choice.kind === 'keyword') {
      setPlace(null);
      go({ keyword: choice.text });
      return;
    }
    // Phones show only the keyword row (no search button), so a picked place searches at once; on wider screens it
    // fills the box and the other fields can still be set before "ค้นหา".
    if (!submitRef.current || submitRef.current.offsetParent === null) {
      go(locationPatch(choice));
      return;
    }
    setPlace(choice);
    setKeyword(
      choice.kind === 'area'
        ? (copy.areaNames as Record<string, string>)[choice.slug] ?? choice.slug
        : choice.kind === 'place'
          ? choice.name
          : copy.location.nearMe,
    );
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
      <Link
        href="/find"
        className="nk-search__find"
        onClick={() => {
          try {
            window.sessionStorage.setItem(FIND_FROM_SITE, '1');
          } catch {
            // Storage off: ✕ on /find then goes to the home page instead of back.
          }
        }}
        data-testid="guestHome.findLink"
      >
        <SearchIcon size={18} />
        <span>{copy.search.keywordPlaceholder}</span>
      </Link>
      <div className="nk-search__row">
        <div className="nk-field nk-field--keyword">
          <label htmlFor={`${id}-q`} className="nk-field__label">
            {copy.search.keywordLabel}
          </label>
          <div className="nk-field__control">
            <SearchIcon size={18} className="nk-field__icon" />
            <LocationCombobox
              inputId={`${id}-q`}
              value={keyword}
              onValueChange={(text) => {
                setKeyword(text);
                setPlace(null);
              }}
              onPick={pickLocation}
              placeholder={copy.search.keywordPlaceholder}
              inputClassName="nk-input nk-input--icon"
              testId="guestHome.searchKeyword"
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
          <span id={`${id}-price-label`} className="nk-field__label">
            {copy.search.priceLabel}
          </span>
          <PricePopover value={price} onApply={setPrice} labelId={`${id}-price-label`} />
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
          ref={submitRef}
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
        {shownQuickFilters(GUEST_QUICK_FILTERS).map((code) => (
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
