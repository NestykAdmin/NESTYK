'use client';

import React, { useEffect, useState } from 'react';
import { useLocale } from '@nestyk/i18n';
import type { GuestSearchCriteria } from '@nestyk/feature-search';
import { activeFilterCount, clearedFilters, searchHref } from '../../../lib/guest-search';
import { SearchFilterFields, type FilterChange } from './SearchFilterFields';
import { useSearchNavigation } from './SearchNavigation';

/** Typing a price waits this long before searching, so each key press does not reload the results. */
export const PRICE_DEBOUNCE_MS = 400;

/** Filter panel beside the results on wide screens (design v2.3 SearchWebV23). Each change searches at once. */
export function SearchFilters({ criteria }: { criteria: GuestSearchCriteria }) {
  const { t } = useLocale();
  const copy = t.guest.results;
  const { update, replace, latest, waiting, pending } = useSearchNavigation();
  const [draft, setDraft] = useState(criteria);
  const key = searchHref(criteria);

  // Show the server's search, unless the guest has changed something newer that is still on its way (review R3).
  useEffect(() => {
    if (!waiting() && !pending) setDraft(criteria);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pending]);

  const onChange: FilterChange = (patch, options) => {
    setDraft(update(patch, { delay: options?.debounce ? PRICE_DEBOUNCE_MS : undefined }));
  };
  const count = activeFilterCount(draft);

  return (
    <div className="nk-search-aside__panel" data-testid="searchFilters">
      <div className="nk-search-aside__head">
        <h2 className="nk-search-aside__title">{copy.filtersTitle}</h2>
        <button
          type="button"
          className="nk-link-btn"
          disabled={count === 0}
          onClick={() => {
            const next = clearedFilters(latest());
            setDraft(next);
            replace(next);
          }}
          data-testid="searchFilters.clearAll"
        >
          {copy.clearAll}
        </button>
      </div>
      <SearchFilterFields value={draft} onChange={onChange} idPrefix="aside" />
    </div>
  );
}
