'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { GuestSearchCriteria } from '@nestyk/feature-search';
import { useRouter } from '../../../i18n/navigation';
import { searchHref, withFilters } from '../../../lib/guest-search';

type Patch = Partial<GuestSearchCriteria> | ((current: GuestSearchCriteria) => Partial<GuestSearchCriteria>);
export type ResultsView = 'grid' | 'list';

interface SearchNavigationValue {
  /** True while the next results are loading after a change. */
  pending: boolean;
  /** Changes some filters of the latest search (page 1 again). `delay` waits for more typing (price boxes). */
  update: (patch: Patch, options?: { delay?: number }) => GuestSearchCriteria;
  /** Replaces the whole search ("ล้างทั้งหมด", the filter sheet's "ดูผลลัพธ์"). */
  replace: (next: GuestSearchCriteria) => void;
  /** The latest search asked for, which may be ahead of the results on screen. */
  latest: () => GuestSearchCriteria;
  /** True while a delayed change is still waiting to be sent. */
  waiting: () => boolean;
  view: ResultsView;
  setView: (view: ResultsView) => void;
}

const noop = () => undefined;
const SearchNavigationContext = createContext<SearchNavigationValue | null>(null);

/**
 * Wraps the search page (S4.2) and is the one place a search changes. Every control builds on the latest search
 * asked for, not on the results on screen, so a chip clicked while a price is still being typed keeps both
 * (review R3). The URL holds the search and the server renders the results; `pending` dims the old ones meanwhile.
 * The card / list choice lives here too, so it survives a new search (review L8).
 */
export function SearchNavigation({ criteria, children }: { criteria: GuestSearchCriteria; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<ResultsView>('grid');
  const latestRef = useRef(criteria);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = searchHref(criteria);

  // Take the server's search once nothing newer is waiting or loading (also after Back / Forward or a chip link).
  useEffect(() => {
    if (!timer.current && !pending) latestRef.current = criteria;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pending]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const push = useCallback(
    (next: GuestSearchCriteria) => startTransition(() => router.push(searchHref(next), { scroll: false })),
    [router],
  );
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const update = useCallback(
    (patch: Patch, options?: { delay?: number }) => {
      const current = latestRef.current;
      const next = withFilters(current, typeof patch === 'function' ? patch(current) : patch);
      latestRef.current = next;
      cancel();
      if (options?.delay) {
        timer.current = setTimeout(() => {
          timer.current = null;
          push(latestRef.current);
        }, options.delay);
      } else {
        push(next);
      }
      return next;
    },
    [push],
  );
  const replace = useCallback(
    (next: GuestSearchCriteria) => {
      latestRef.current = next;
      cancel();
      push(next);
    },
    [push],
  );
  const value = useMemo<SearchNavigationValue>(
    () => ({ pending, update, replace, latest: () => latestRef.current, waiting: () => timer.current !== null, view, setView }),
    [pending, update, replace, view],
  );

  return (
    <SearchNavigationContext.Provider value={value}>
      <div className="nk-search-page" data-pending={pending ? 'true' : undefined} data-testid="searchPage">
        {children}
      </div>
    </SearchNavigationContext.Provider>
  );
}

export function useSearchNavigation(): SearchNavigationValue {
  const value = useContext(SearchNavigationContext);
  if (value) return value;
  // Outside the search page (for example the UI kit): controls render but change nothing.
  return { pending: false, update: (patch) => patch as GuestSearchCriteria, replace: noop, latest: () => ({}) as GuestSearchCriteria, waiting: () => false, view: 'grid', setView: noop };
}
