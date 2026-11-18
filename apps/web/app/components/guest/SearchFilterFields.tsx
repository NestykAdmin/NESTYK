'use client';

import React from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import type { GuestSearchCriteria } from '@nestyk/feature-search';
import type { PublicMoveIn } from '@nestyk/types';
import {
  BEDROOM_FILTERS,
  BEDROOMS_OR_MORE,
  MOVE_IN_OPTIONS,
  OTHER_FILTERS,
  SEARCH_PROPERTY_TYPES,
} from '../../../lib/guest-search';
import { PriceRangeField } from './PriceRangeField';

export type FilterChange = (patch: Partial<GuestSearchCriteria>, options?: { debounce?: boolean }) => void;

/**
 * The filter fields of the search page (design v2.3 filter panel / v2.2 filter sheet): property type, monthly rent,
 * bedrooms, move-in and "other". No state of its own except what is being typed in the price boxes;
 * the desktop panel applies each change at once, the mobile sheet on "ดูผลลัพธ์".
 */
export function SearchFilterFields({ value, onChange, idPrefix }: { value: GuestSearchCriteria; onChange: FilterChange; idPrefix: string }) {
  const { t } = useLocale();
  const copy = t.guest;
  const types = value.propertyType ?? [];
  const beds = value.bedrooms ?? [];
  const toggle = <T,>(list: readonly T[], item: T): T[] | undefined => {
    const next = list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
    return next.length ? next : undefined;
  };
  const bedLabel = (count: number) => {
    if (count === 0) return copy.spec.bedroom.studio;
    if (count >= BEDROOMS_OR_MORE) return copy.results.bedroomsThreePlus;
    return String(count);
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

  return (
    <div className="nk-filters">
      <fieldset className="nk-filters__group">
        <legend className="nk-filters__legend">{copy.search.typeLabel}</legend>
        <div className="nk-filters__chips">
          {SEARCH_PROPERTY_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className="nk-chip"
              aria-pressed={types.includes(type)}
              onClick={() => onChange({ propertyType: toggle(types, type) })}
              data-testid={`searchFilters.type.${type}`}
            >
              {copy.propertyType[type]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="nk-filters__group">
        <legend className="nk-filters__legend">{copy.results.priceRangeLabel}</legend>
        <PriceRangeField
          minPrice={value.minPrice}
          maxPrice={value.maxPrice}
          onChange={(price, options) => onChange(price, options)}
          idPrefix={idPrefix}
        />
      </fieldset>

      <fieldset className="nk-filters__group">
        <legend className="nk-filters__legend">{copy.search.bedroomsLabel}</legend>
        <div className="nk-filters__chips">
          <button
            type="button"
            className="nk-chip"
            aria-pressed={beds.length === 0}
            onClick={() => onChange({ bedrooms: undefined })}
            data-testid="searchFilters.beds.any"
          >
            {copy.search.bedroomsAny}
          </button>
          {BEDROOM_FILTERS.map((count) => (
            <button
              key={count}
              type="button"
              className="nk-chip"
              aria-pressed={beds.includes(count)}
              aria-label={bedFullLabel(count)}
              onClick={() => onChange({ bedrooms: toggle(beds, count) })}
              data-testid={`searchFilters.beds.${count}`}
            >
              {bedLabel(count)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="nk-filters__group">
        <label className="nk-filters__legend" htmlFor={`${idPrefix}-movein`}>
          {copy.results.availabilityLabel}
        </label>
        <select
          id={`${idPrefix}-movein`}
          className="nk-input"
          value={value.moveIn ?? ''}
          onChange={(event) => onChange({ moveIn: (event.target.value || undefined) as PublicMoveIn | undefined })}
          data-testid="searchFilters.moveIn"
        >
          <option value="">{copy.results.availabilityAny}</option>
          {MOVE_IN_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {moveInLabel[option]}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="nk-filters__group">
        <legend className="nk-filters__legend">{copy.results.more}</legend>
        {OTHER_FILTERS.map((code) => (
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
      </fieldset>
    </div>
  );
}
