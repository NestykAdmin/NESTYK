'use client';

import React, { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import { isRentPreset } from '@nestyk/feature-search';
import { useRouter } from '../../../i18n/navigation';
import { BEDROOM_CHOICES, HOME_PROPERTY_TYPES, homeSearchHref, type HomeSearchInput } from '../../../lib/guest-home';
import { locationPatch, type LocationChoice } from '../../../lib/guest-location';
import { keyboardOffset } from '../../../lib/guest-keyboard';
import { addRecentSearch, FIND_FROM_SITE, parseRecentSearches, RECENT_KEY, recentSearchLabel, type RecentSearch } from '../../../lib/guest-recent';
import { RENT_PRESET_CHOICES, presetLabel, priceRangeLabel, type PriceWords } from '../../../lib/guest-search';
import { BedIcon, CheckIcon, ClockIcon, ChevronDownIcon, ChevronUpIcon, CloseIcon, CondoIcon, SlidersIcon } from './GuestIcons';
import { LocationPageBox, type LocationPageHandle } from './LocationCombobox';
import { PriceRangeField, type Price } from './PriceRangeField';

type Field = 'type' | 'price' | 'beds';

function readRecent(): RecentSearch[] {
  try {
    return parseRecentSearches(window.localStorage.getItem(RECENT_KEY));
  } catch {
    return [];
  }
}

function saveRecent(list: RecentSearch[]): void {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Private mode or storage off: the search still runs, it is just not remembered.
  }
}

/** One filter row (board D2) that opens its choices right under it (D3, D4, D6); one open at a time. */
const FilterField = forwardRef<
  HTMLButtonElement,
  {
    id: string;
    icon: React.ReactNode;
    label: string;
    value: string;
    set: boolean;
    open: boolean;
    onToggle: () => void;
    testId: string;
    /** "group" while the price field shows its custom range (slider and boxes are not radio choices). */
    menuRole?: 'radiogroup' | 'group';
    children: React.ReactNode;
  }
>(function FilterField({ id, icon, label, value, set, open, onToggle, testId, menuRole = 'radiogroup', children }, ref) {
  return (
    <div className="nk-find__filter">
      <button
        ref={ref}
        type="button"
        className={`nk-find__field-btn${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={onToggle}
        data-testid={testId}
      >
        <span className="nk-find__field-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="nk-find__field-text">
          <span className="nk-find__field-label">{label}</span>
          <span className={`nk-find__field-value${set ? ' is-set' : ''}`}>{value}</span>
        </span>
        {open ? <ChevronUpIcon size={18} /> : <ChevronDownIcon size={18} />}
      </button>
      {open ? (
        <div id={`${id}-menu`} className="nk-find__menu" role={menuRole} aria-label={label} data-testid={`${testId}.menu`}>
          {children}
        </div>
      ) : null}
    </div>
  );
});

function Option({ selected, onSelect, testId, children }: { selected: boolean; onSelect: () => void; testId?: string; children: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={selected} className="nk-find__option" onClick={onSelect} data-testid={testId}>
      <span className="nk-find__radio" aria-hidden="true" />
      <span className="nk-find__option-text">{children}</span>
      {selected ? <CheckIcon size={18} className="nk-find__check" /> : null}
    </button>
  );
}

/**
 * Mobile search page /find (Mos 25 Nov 2026, canvas page "searchnew", boards D2–D6): the place box with "near me" and
 * the rail lines, recent searches (this device only), the type / monthly rent / bedrooms dropdowns, and "ล้าง" /
 * "ดูห้อง" at the bottom. Picking a place fills the box; only "ดูห้อง" (or a recent search) opens the results.
 */
export function SearchStart() {
  const { t } = useLocale();
  const copy = t.guest;
  const find = copy.find;
  const router = useRouter();
  const id = useId();
  const [keyword, setKeyword] = useState('');
  const [place, setPlace] = useState<LocationChoice | null>(null);
  const [type, setType] = useState('');
  const [price, setPrice] = useState<Price>({ minPrice: undefined, maxPrice: undefined });
  const [bedrooms, setBedrooms] = useState('');
  const [openField, setOpenField] = useState<Field | null>(null);
  const [customPrice, setCustomPrice] = useState(false);
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  // True while the place suggestions cover the filters (canvas "findsummary").
  const [suggesting, setSuggesting] = useState(false);
  const placeBox = useRef<LocationPageHandle>(null);
  const toggles = useRef<Record<Field, HTMLButtonElement | null>>({ type: null, price: null, beds: null });

  useEffect(() => setRecent(readRecent()), []);

  // The bottom bar rides above the on-screen keyboard (iOS keeps the page height and only the visible area shrinks),
  // and the page keeps room under the list for the bar, whose height changes with the filter summary.
  const pageRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = pageRef.current;
    const bar = barRef.current;
    const viewport = window.visualViewport;
    if (!viewport || !node || !bar) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { height, lift } = keyboardOffset({ innerHeight: window.innerHeight, height: viewport.height, offsetTop: viewport.offsetTop, scale: viewport.scale });
        node.style.setProperty('--nk-find-kb', `${height}px`);
        node.style.setProperty('--nk-find-lift', `${lift}px`);
        node.toggleAttribute('data-keyboard', height > 0);
      });
    };
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    update();
    const resize = new ResizeObserver(() => node.style.setProperty('--nk-find-bar', `${bar.offsetHeight}px`));
    resize.observe(bar);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      resize.disconnect();
    };
  }, []);

  const words: PriceWords = {
    priceAny: copy.search.priceAny,
    priceUnder: copy.search.priceUnder,
    priceBetween: copy.search.priceBetween,
    priceOver: copy.results.priceFromChip,
  };
  const bedroomLabel = (choiceId: string) => {
    if (choiceId === 'studio') return copy.spec.bedroom.studio;
    if (choiceId === 'one') return fillTemplate(copy.spec.bedroom.one, { count: 1 });
    if (choiceId === 'two') return fillTemplate(copy.spec.bedroom.many, { count: 2 });
    return copy.spec.bedroom.threePlus;
  };
  const priceText = priceRangeLabel(price.minPrice, price.maxPrice, words);
  // One line of the filters set, shown above "ล้าง / ดูห้อง" while the suggestions cover them (FindSumA; none set: FindSumB).
  const summary = [type ? (copy.propertyType as Record<string, string>)[type] : null, priceText, bedrooms ? bedroomLabel(bedrooms) : null]
    .filter(Boolean)
    .join(' · ');
  // Back to the filters: the suggestions close and focus lands on the first filter, so the keyboard goes down too.
  const showFilters = () => {
    placeBox.current?.stopTyping();
    requestAnimationFrame(() => toggles.current.type?.focus());
  };
  // A choice closes its menu: focus goes back to that field's button, not to the top of the page (review R2).
  const done = (field: Field) => {
    setOpenField(null);
    setCustomPrice(false);
    requestAnimationFrame(() => toggles.current[field]?.focus());
  };
  const toggle = (field: Field) => {
    setOpenField((current) => (current === field ? null : field));
    setCustomPrice(false);
  };

  const pickLocation = (choice: LocationChoice) => {
    if (choice.kind === 'keyword') {
      setPlace(null);
      setKeyword(choice.text);
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

  const open = (input: HomeSearchInput) => {
    const next = addRecentSearch(readRecent(), input);
    saveRecent(next);
    router.push(homeSearchHref(input));
  };
  const submit = () => {
    const location = place ? locationPatch(place) : { keyword: keyword.trim() || undefined };
    open({ ...location, type: type || undefined, minPrice: price.minPrice, maxPrice: price.maxPrice, bedrooms: bedrooms || undefined });
  };
  const clearAll = () => {
    setKeyword('');
    setPlace(null);
    setType('');
    setPrice({ minPrice: undefined, maxPrice: undefined });
    setBedrooms('');
    setOpenField(null);
    setCustomPrice(false);
  };
  // Back to the page that opened this one when it was ours (the home search bar sets the mark); otherwise home
  // (review R6: history.length also counts other sites in this tab).
  const close = () => {
    let fromSite = false;
    try {
      fromSite = window.sessionStorage.getItem(FIND_FROM_SITE) === '1';
      window.sessionStorage.removeItem(FIND_FROM_SITE);
    } catch {
      fromSite = false;
    }
    if (fromSite) router.back();
    else router.push('/');
  };

  const recentWords = {
    areaNames: copy.areaNames as Record<string, string>,
    nearMe: copy.location.nearMe,
    anywhere: find.anywhere,
    propertyType: copy.propertyType as Record<string, string>,
    bedroom: Object.fromEntries(BEDROOM_CHOICES.map((choice) => [choice.id, bedroomLabel(choice.id)])),
    price: (min: number | undefined, max: number | undefined) => priceRangeLabel(min, max, words),
  };

  const idle = (
    <div className="nk-find__idle">
      {recent.length ? (
        <section className="nk-find__recent" aria-labelledby={`${id}-recent`}>
          <h2 id={`${id}-recent`} className="nk-find__heading">
            {find.recentHeading}
          </h2>
          <ul className="nk-find__recent-list">
            {recent.map((item) => (
              <li key={homeSearchHref(item)}>
                <button type="button" className="nk-find__recent-item" onClick={() => open(item)} data-testid="find.recent">
                  <ClockIcon size={18} className="nk-find__recent-icon" />
                  <span>{recentSearchLabel(item, recentWords)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="nk-find__filters" aria-labelledby={`${id}-filters`}>
        <h2 id={`${id}-filters`} className="nk-find__heading">
          {find.filtersHeading}
        </h2>
        <FilterField
          ref={(node) => {
            toggles.current.type = node;
          }}
          id={`${id}-type`}
          icon={<CondoIcon size={20} />}
          label={copy.search.typeLabel}
          value={type ? (copy.propertyType as Record<string, string>)[type] : copy.search.typeAll}
          set={Boolean(type)}
          open={openField === 'type'}
          onToggle={() => toggle('type')}
          testId="find.type"
        >
          <Option selected={!type} onSelect={() => (setType(''), done('type'))}>
            {copy.search.typeAll}
          </Option>
          {HOME_PROPERTY_TYPES.map((value) => (
            <Option key={value} selected={type === value} onSelect={() => (setType(value), done('type'))} testId={`find.type.${value}`}>
              {copy.propertyType[value]}
            </Option>
          ))}
        </FilterField>
        <FilterField
          ref={(node) => {
            toggles.current.price = node;
          }}
          menuRole={customPrice ? 'group' : 'radiogroup'}
          id={`${id}-price`}
          icon={<SlidersIcon size={20} />}
          label={copy.search.priceLabel}
          value={priceText ?? copy.search.priceAny}
          set={Boolean(priceText)}
          open={openField === 'price'}
          onToggle={() => toggle('price')}
          testId="find.price"
        >
          {customPrice ? (
            <div className="nk-find__custom">
              <PriceRangeField minPrice={price.minPrice} maxPrice={price.maxPrice} onChange={(next) => setPrice(next)} idPrefix={`${id}-price-custom`} presets="none" />
              <button type="button" className="nk-btn nk-btn--dark nk-find__apply" onClick={() => done('price')} data-testid="find.price.apply">
                {find.apply}
              </button>
            </div>
          ) : (
            <>
              {RENT_PRESET_CHOICES.map((preset, index) => (
                <Option
                  key={index}
                  selected={isRentPreset(price.minPrice, price.maxPrice, preset)}
                  onSelect={() => {
                    setPrice({ minPrice: preset.min, maxPrice: preset.max });
                    done('price');
                  }}
                  testId={`find.price.${index}`}
                >
                  {presetLabel(preset, words)}
                </Option>
              ))}
              <button type="button" className="nk-find__option nk-find__option--custom" onClick={() => {
                  setCustomPrice(true);
                  requestAnimationFrame(() => document.getElementById(`${id}-price-custom-min`)?.focus());
                }}
                data-testid="find.price.custom"
              >
                <SlidersIcon size={18} />
                <span className="nk-find__option-text">{find.customPrice}</span>
              </button>
            </>
          )}
        </FilterField>
        <FilterField
          ref={(node) => {
            toggles.current.beds = node;
          }}
          id={`${id}-beds`}
          icon={<BedIcon size={20} />}
          label={copy.search.bedroomsLabel}
          value={bedrooms ? bedroomLabel(bedrooms) : copy.search.bedroomsAny}
          set={Boolean(bedrooms)}
          open={openField === 'beds'}
          onToggle={() => toggle('beds')}
          testId="find.beds"
        >
          <Option selected={!bedrooms} onSelect={() => (setBedrooms(''), done('beds'))}>
            {copy.search.bedroomsAny}
          </Option>
          {BEDROOM_CHOICES.map((choice) => (
            <Option key={choice.id} selected={bedrooms === choice.id} onSelect={() => (setBedrooms(choice.id), done('beds'))} testId={`find.beds.${choice.id}`}>
              {bedroomLabel(choice.id)}
            </Option>
          ))}
        </FilterField>
      </section>
    </div>
  );

  return (
    <div ref={pageRef} className="nk-find" data-testid="find.page">
      <h1 className="nk-sr-only">{find.title}</h1>
      <div className="nk-find__top">
        <button type="button" className="nk-find__close" aria-label={find.close} onClick={close} data-testid="find.close">
          <CloseIcon size={22} />
        </button>
        <LocationPageBox
          ref={placeBox}
          inputId={`${id}-place`}
          value={keyword}
          onValueChange={(text) => {
            setKeyword(text);
            setPlace(null);
          }}
          onPick={pickLocation}
          placeholder={copy.search.keywordPlaceholder}
          inputClassName="nk-input nk-input--icon"
          testId="find.place"
          idle={idle}
          onSuggestingChange={setSuggesting}
        />
      </div>
      <div ref={barRef} className="nk-find__bar">
        {suggesting && summary ? (
          <button
            type="button"
            className="nk-find__summary"
            onClick={showFilters}
            aria-label={`${find.editFilters}: ${summary}`}
            data-testid="find.summary"
          >
            <SlidersIcon size={18} className="nk-find__summary-icon" />
            <span className="nk-find__summary-text">{summary}</span>
            <ChevronUpIcon size={18} />
          </button>
        ) : null}
        <button type="button" className="nk-link-btn nk-find__clear" onClick={clearAll} data-testid="find.clear">
          {find.clearAll}
        </button>
        <button type="button" className="nk-btn nk-btn--primary nk-find__go" onClick={submit} data-testid="find.submit">
          {find.showRooms}
        </button>
      </div>
    </div>
  );
}
