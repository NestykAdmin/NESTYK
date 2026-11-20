'use client';

import React, { useEffect, useRef, useState } from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import type { GuestSearchCriteria } from '@nestyk/feature-search';
import type { PublicRoomCard, PublicRoomSearchResult } from '@nestyk/types';
import { localePath } from '../../../lib/guest-site';
import {
  SEARCH_PAGE_MAX,
  clearedFilters,
  publicSearchUrl,
  searchHref,
  toPublicQuery,
  type FilterChip,
} from '../../../lib/guest-search';
import { CardSkeleton, EmptyState } from './GuestStates';
import { GridIcon, ListIcon, MapIcon } from './GuestIcons';
import { RoomCard } from './RoomCard';
import { SearchFilterChips, SearchFiltersToggle, SearchSort, SearchViewSwitch } from './SearchToolbarParts';
import { useSearchNavigation } from './SearchNavigation';

const LOAD_MORE_SKELETONS = 3;

/**
 * Results of the search page (S4.2): count, sort, card / list view, the map button (opens /search?view=map, S4.3), the rooms and "โหลดเพิ่ม" (Q2). The page passes a `key` per search, so a new search
 * starts fresh. "โหลดเพิ่ม" adds the next page below and writes the page number into the URL, so a shared link
 * opens with the same rooms showing.
 */
export function SearchResults({
  criteria,
  initialItems,
  total: initialTotal,
  loadedPages,
  today,
  locale,
  chips = [],
}: {
  criteria: GuestSearchCriteria;
  initialItems: PublicRoomCard[];
  total: number;
  loadedPages: number;
  today: string;
  locale: string;
  /** Filters in use (activeFilterChips), shown after the count. */
  chips?: readonly FilterChip[];
}) {
  const { t } = useLocale();
  const copy = t.guest;
  const { pending, update, view, setView } = useSearchNavigation();
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [pages, setPages] = useState(loadedPages);
  const [ended, setEnded] = useState(loadedPages >= SEARCH_PAGE_MAX);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const request = useRef<AbortController | null>(null);

  // A new search replaces this list (the page gives it a new key): stop a "load more" that is still running, so it
  // can neither add old rooms nor write the old search into the address bar (review R2).
  useEffect(() => () => request.current?.abort(), []);

  const loadMore = async () => {
    if (loading) return;
    const next = pages + 1;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(publicSearchUrl(toPublicQuery(criteria, next, criteria.limit)), { signal: controller.signal });
      if (!response.ok) throw new Error(`Search failed: ${response.status}`);
      const result = (await response.json()) as PublicRoomSearchResult;
      if (controller.signal.aborted) return;
      setItems((current) => {
        const seen = new Set(current.map((card) => card.id));
        return [...current, ...result.items.filter((card) => !seen.has(card.id))];
      });
      // Rooms can be listed or taken down meanwhile; the API's own count wins, and an empty page or the last page
      // allowed ends the list (review R5).
      setTotal(result.total);
      setPages(next);
      if (!result.items.length || next >= SEARCH_PAGE_MAX) setEnded(true);
      window.history.replaceState(window.history.state, '', localePath(locale, searchHref({ ...criteria, page: next })));
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const hasMore = !ended && items.length < total;

  return (
    <div className="nk-search-results" aria-busy={pending || loading} data-testid="searchResults">
      <div className="nk-search-toolbar">
        <div className="nk-search-toolbar__lead">
          <SearchFiltersToggle criteria={criteria} />
          <p className="nk-search-toolbar__count" role="status" data-testid="searchResults.count">
            {fillTemplate(copy.results.found, { count: total.toLocaleString('en-US') })}
          </p>
          <SearchFilterChips chips={chips} locale={locale} />
        </div>
        <div className="nk-search-toolbar__actions">
          <SearchSort criteria={criteria} testId="searchResults.sort" />
          <div className="nk-view-toggle" role="group" aria-label={copy.results.viewLabel}>
            <button type="button" className="nk-icon-btn" aria-pressed={view === 'grid'} aria-label={copy.results.viewGrid} onClick={() => setView('grid')} data-testid="searchResults.viewGrid">
              <GridIcon size={20} />
            </button>
            <button type="button" className="nk-icon-btn" aria-pressed={view === 'list'} aria-label={copy.results.viewList} onClick={() => setView('list')} data-testid="searchResults.viewList">
              <ListIcon size={20} />
            </button>
          </div>
          <SearchViewSwitch view="list" />
          {/* Phones: the bottom-centre button, where the map's "แสดงรายการ" sits too. */}
          <button type="button" className="nk-btn nk-btn--outline nk-search-map-btn" onClick={() => update({ view: 'map' })} data-testid="searchResults.map">
            <MapIcon size={18} />
            {copy.results.showMap}
          </button>
        </div>
      </div>

      {total === 0 ? (
        <EmptyState
          title={copy.states.emptyTitle}
          body={copy.states.emptyBody}
          action={{ label: copy.states.emptyAction, href: localePath(locale, searchHref(clearedFilters(criteria, { keyword: true }))) }}
        />
      ) : (
        <>
          <div className={`nk-room-grid nk-search-list nk-search-list--${view}`} aria-label={copy.results.listLabel} data-testid="searchResults.list">
            {items.map((card) => (
              <RoomCard key={card.id} card={card} copy={copy} locale={locale} today={today} />
            ))}
            {loading ? Array.from({ length: LOAD_MORE_SKELETONS }, (_, index) => <CardSkeleton key={`skeleton-${index}`} />) : null}
          </div>
          <div className="nk-search-more">
            <p className="nk-search-more__text">
              {fillTemplate(copy.results.showingOf, { shown: items.length.toLocaleString('en-US'), total: total.toLocaleString('en-US') })}
            </p>
            {failed ? (
              <p className="nk-search-more__error" role="alert">
                {copy.results.loadMoreFailed}
              </p>
            ) : null}
            {hasMore ? (
              <button type="button" className="nk-btn nk-btn--outline" onClick={loadMore} disabled={loading} data-testid="searchResults.loadMore">
                {loading ? copy.states.loading : failed ? copy.states.retry : copy.results.loadMore}
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
