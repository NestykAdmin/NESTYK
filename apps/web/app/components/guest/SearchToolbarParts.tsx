'use client';

import React, { useId } from 'react';
import Link from 'next/link';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import type { GuestSearchCriteria } from '@nestyk/feature-search';
import { SEARCH_SORT_OPTIONS, type FilterChip } from '../../../lib/guest-search';
import { localePath } from '../../../lib/guest-site';
import { CloseIcon } from './GuestIcons';
import { useSearchNavigation } from './SearchNavigation';

type SortOption = (typeof SEARCH_SORT_OPTIONS)[number];

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
