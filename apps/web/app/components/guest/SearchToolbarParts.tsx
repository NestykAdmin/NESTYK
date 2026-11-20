'use client';

import React, { useId } from 'react';
import Link from 'next/link';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import type { GuestSearchCriteria } from '@nestyk/feature-search';
import { SEARCH_SORT_OPTIONS, activeFilterCount, type FilterChip } from '../../../lib/guest-search';
import { localePath } from '../../../lib/guest-site';
import { CloseIcon, SlidersIcon } from './GuestIcons';
import { useSearchNavigation } from './SearchNavigation';

type SortOption = (typeof SEARCH_SORT_OPTIONS)[number];

/** id of the filter panel beside the cards, for the toggle's aria-controls. */
export const SEARCH_FILTERS_ID = 'search-filters';

/** "เรียงตาม" of the results toolbar, shared by the card and map views (S4.2 / S4.3). */
export function SearchSort({ criteria, testId }: { criteria: GuestSearchCriteria; testId: string }) {
  const { t } = useLocale();
  const copy = t.guest;
  const { update } = useSearchNavigation();
  const id = useId();
  const value: SortOption = (SEARCH_SORT_OPTIONS as readonly string[]).includes(criteria.sortBy) ? (criteria.sortBy as SortOption) : 'recommended';
  return (
    <label htmlFor={id} className="nk-search-toolbar__sort">
      <span className="nk-search-toolbar__sort-label">{copy.results.sortLabel}</span>
      <select id={id} className="nk-input nk-search-toolbar__select" value={value} onChange={(event) => update({ sortBy: event.target.value as SortOption })} data-testid={testId}>
        {SEARCH_SORT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {copy.results.sort[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * "การ์ด | แผนที่" (Mos 20 Nov 2026): the last item of the results toolbar in both views, so it stays in one place
 * when the view changes. Phones use the bottom-centre button instead (guest.css / guest-map.css).
 */
export function SearchViewSwitch({ view }: { view: GuestSearchCriteria['view'] }) {
  const { t } = useLocale();
  const copy = t.guest;
  const { update } = useSearchNavigation();
  const go = (target: GuestSearchCriteria['view']) => {
    if (target !== view) update({ view: target });
  };
  return (
    <div className="nk-view-switch" role="group" aria-label={copy.results.viewLabel} data-testid="searchView">
      <button type="button" aria-pressed={view === 'list'} onClick={() => go('list')} data-testid="searchView.cards">
        {copy.map.viewCards}
      </button>
      <button type="button" aria-pressed={view === 'map'} onClick={() => go('map')} data-testid="searchView.map">
        {copy.map.viewMap}
      </button>
    </div>
  );
}

/**
 * The filters in use after the count, each removing only itself (Mos 20 Nov 2026). The page sends them as data: JSX
 * made on the server and passed through a prop lost its list keys on the way.
 */
export function SearchFilterChips({ chips, locale }: { chips: readonly FilterChip[]; locale: string }) {
  const { t } = useLocale();
  if (!chips.length) return null;
  return (
    <ul className="nk-search-chips" aria-label={t.guest.results.activeFilters} data-testid="searchPage.activeFilters">
      {chips.map((chip) => (
        <li key={chip.key}>
          <Link
            href={localePath(locale, chip.href)}
            scroll={false}
            className="nk-filter-chip"
            aria-label={fillTemplate(t.guest.results.removeFilter, { label: chip.label })}
            data-testid={`searchPage.removeFilter.${chip.key}`}
          >
            {chip.label}
            <CloseIcon size={14} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * "ตัวกรอง" at the left of the card view's toolbar (Mos 20 Nov 2026, wide screens): folds the filter panel away so
 * the cards take the full width, and brings it back. Shows how many filters are on. Phones use the filter sheet.
 */
export function SearchFiltersToggle({ criteria }: { criteria: GuestSearchCriteria }) {
  const { t } = useLocale();
  const { filtersOpen, setFiltersOpen } = useSearchNavigation();
  const count = activeFilterCount(criteria);
  return (
    <button
      type="button"
      className="nk-btn nk-btn--outline nk-filters-toggle"
      aria-expanded={filtersOpen}
      aria-controls={SEARCH_FILTERS_ID}
      onClick={() => setFiltersOpen(!filtersOpen)}
      data-testid="searchResults.filtersToggle"
    >
      <SlidersIcon size={18} />
      {t.guest.results.filtersTitle}
      {count ? <span className="nk-filters-toggle__count">{count}</span> : null}
    </button>
  );
}
