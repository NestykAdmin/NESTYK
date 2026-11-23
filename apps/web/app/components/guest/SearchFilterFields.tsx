'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import type { GuestSearchCriteria } from '@nestyk/feature-search';
import type { PublicMoveIn } from '@nestyk/types';
import {
  BEDROOM_FILTERS,
  BEDROOMS_OR_MORE,
  MOVE_IN_OPTIONS,
  OTHER_FILTERS,
  SEARCH_PROPERTY_TYPES,
  filterSummaries,
} from '../../../lib/guest-search';
import { shownQuickFilters } from '../../../lib/guest-site';
import { ChevronDownIcon } from './GuestIcons';
import { PriceRangeField } from './PriceRangeField';

export type FilterChange = (patch: Partial<GuestSearchCriteria>, options?: { debounce?: boolean }) => void;
type FilterId = 'type' | 'beds' | 'moveIn' | 'more';

/**
 * The filter fields of the search page (design v2.3 filter panel / v2.2 filter sheet): property type, monthly rent,
 * bedrooms, move-in and "other". Each but the rent is a dropdown (Mos 20 Nov 2026): a button shows what is chosen
 * and opens the choices right below it, one at a time; the rent range stays open. They open in place, not in a floating layer, so the phone sheet keeps the
 * keyboard inside it. The desktop panel applies each change at once, the mobile sheet on "ดูผลลัพธ์".
 */
export function SearchFilterFields({ value, onChange, idPrefix }: { value: GuestSearchCriteria; onChange: FilterChange; idPrefix: string }) {
  const { t } = useLocale();
  const copy = t.guest;
  const [openId, setOpenId] = useState<FilterId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const types = value.propertyType ?? [];
  const beds = value.bedrooms ?? [];
  const toggle = <T,>(list: readonly T[], item: T): T[] | undefined => {
    const next = list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
    return next.length ? next : undefined;
  };
  const bedFullLabel = (count: number) => {
    if (count === 0) return copy.spec.bedroom.studio;
    if (count >= BEDROOMS_OR_MORE) return copy.spec.bedroom.threePlus;
    return fillTemplate(count === 1 ? copy.spec.bedroom.one : copy.spec.bedroom.many, { count });
  };
  const moveInLabel: Record<PublicMoveIn, string> = {
    now: copy.results.availabilityNow,
    '30d': copy.results.availabilityWithin1Month,
    '90d': copy.results.availabilityWithin3Months,
  };
  const summary = filterSummaries(value, {
    typeAll: copy.search.typeAll,
    propertyType: copy.propertyType,
    price: { priceAny: copy.search.priceAny, priceUnder: copy.search.priceUnder, priceBetween: copy.search.priceBetween, priceOver: copy.results.priceFromChip },
    bedroomsAny: copy.search.bedroomsAny,
    bedroom: copy.spec.bedroom,
    moveInAny: copy.results.availabilityAny,
    moveIn: moveInLabel,
    quick: copy.quick,
    moreNone: copy.results.moreNone,
  });

  // A click outside the open dropdown closes it. Esc closes it too, wherever the focus is (a clicked button is not
  // focused in Safari): caught on the way down, before the phone sheet's own Esc, which would close the whole sheet.
  useEffect(() => {
    if (!openId) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.querySelector('[data-open="true"]')?.contains(event.target as Node)) setOpenId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpenId(null);
      document.getElementById(`${idPrefix}-${openId}-button`)?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [openId, idPrefix]);

  const props = (id: FilterId) => ({
    id,
    open: openId === id,
    onToggle: () => setOpenId((current) => (current === id ? null : id)),
    idPrefix,
  });

  return (
    <div className="nk-filters" ref={rootRef}>
      <FilterDropdown {...props('type')} label={copy.search.typeLabel} summary={summary.type}>
        {SEARCH_PROPERTY_TYPES.map((type) => (
          <label key={type} className="nk-check">
            <input
              type="checkbox"
              checked={types.includes(type)}
              onChange={() => onChange({ propertyType: toggle(types, type) })}
              data-testid={`searchFilters.type.${type}`}
            />
            <span>{copy.propertyType[type]}</span>
          </label>
        ))}
      </FilterDropdown>

      {/* The rent range stays open (Mos 20 Nov 2026): the slider is the quickest way to set it. */}
      <fieldset className="nk-filter-dd nk-filter-dd--open" data-testid="searchFilters.price">
        <legend className="nk-filters__legend">{copy.results.priceRangeLabel}</legend>
        <PriceRangeField minPrice={value.minPrice} maxPrice={value.maxPrice} onChange={(price, options) => onChange(price, options)} idPrefix={idPrefix} presets="select" />
      </fieldset>

      <FilterDropdown {...props('beds')} label={copy.search.bedroomsLabel} summary={summary.beds}>
        {BEDROOM_FILTERS.map((count) => (
          <label key={count} className="nk-check">
            <input
              type="checkbox"
              checked={beds.includes(count)}
              onChange={() => onChange({ bedrooms: toggle(beds, count) })}
              data-testid={`searchFilters.beds.${count}`}
            />
            <span>{bedFullLabel(count)}</span>
          </label>
        ))}
      </FilterDropdown>

      <FilterDropdown {...props('moveIn')} label={copy.results.availabilityLabel} summary={summary.moveIn}>
        {[undefined, ...MOVE_IN_OPTIONS].map((option) => (
          <label key={option ?? 'any'} className="nk-check">
            <input
              type="radio"
              name={`${idPrefix}-movein`}
              checked={value.moveIn === option}
              onChange={() => {
                onChange({ moveIn: option });
                setOpenId(null);
              }}
              data-testid={`searchFilters.moveIn.${option ?? 'any'}`}
            />
            <span>{option ? moveInLabel[option] : copy.results.availabilityAny}</span>
          </label>
        ))}
      </FilterDropdown>

      <FilterDropdown {...props('more')} label={copy.results.more} summary={summary.more}>
        {shownQuickFilters(OTHER_FILTERS).map((code) => (
          <label key={code} className="nk-check">
            <input
              type="checkbox"
              checked={value.quick.includes(code)}
              onChange={() =>
                onChange({ quick: value.quick.includes(code) ? value.quick.filter((item) => item !== code) : [...value.quick, code] })
              }
              data-testid={`searchFilters.other.${code}`}
            />
            <span>{copy.quick[code]}</span>
          </label>
        ))}
      </FilterDropdown>
    </div>
  );
}

/** One filter: its name, a button with what is chosen, and the choices below it while open. */
function FilterDropdown({
  id,
  idPrefix,
  label,
  summary,
  open,
  onToggle,
  children,
}: {
  id: FilterId;
  idPrefix: string;
  label: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const labelId = useId();
  const panelId = `${idPrefix}-${id}-panel`;
  return (
    <div className="nk-filter-dd" data-open={open ? 'true' : undefined} data-testid={`searchFilters.${id}`}>
      <span id={labelId} className="nk-filters__legend">
        {label}
      </span>
      <button
        type="button"
        id={`${idPrefix}-${id}-button`}
        className="nk-filter-dd__button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-labelledby={`${labelId} ${idPrefix}-${id}-value`}
        onClick={onToggle}
        data-testid={`searchFilters.${id}.button`}
      >
        <span id={`${idPrefix}-${id}-value`} className="nk-filter-dd__value">
          {summary}
        </span>
        <ChevronDownIcon size={18} className="nk-filter-dd__chevron" />
      </button>
      {open ? (
        <div id={panelId} className="nk-filter-dd__panel" role="group" aria-labelledby={labelId}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
