import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { fillTemplate, getTranslations, type SupportedLocale } from '@nestyk/i18n';
import { criteriaFromSearchParams } from '@nestyk/feature-search';
import type { PublicRoomSearchResult } from '@nestyk/types';
import { EmptyState, ErrorState } from '../../../components/guest/GuestStates';
import { CloseIcon } from '../../../components/guest/GuestIcons';
import { SearchFilters } from '../../../components/guest/SearchFilters';
import { SearchKeywordBar } from '../../../components/guest/SearchKeywordBar';
import { SearchNavigation } from '../../../components/guest/SearchNavigation';
import { SearchResults } from '../../../components/guest/SearchResults';
import { bangkokToday } from '../../../../lib/guest-home';
import { loadSearchResults } from '../../../../lib/guest-rooms';
import {
  activeFilterChips,
  firstLoad,
  normalizeSearchCriteria,
  searchHref,
  searchTitle,
  toPublicQuery,
  withFilters,
} from '../../../../lib/guest-search';
import { guestPageMetadata } from '../../../../lib/guest-seo';
import { localePath } from '../../../../lib/guest-site';

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

/** Search pages are not indexed: endless filter combinations would crowd out the area pages (SEO plan). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const title = `${getTranslations(locale as SupportedLocale).guest.nav.search} · NESTYK`;
  return guestPageMetadata({ locale, path: '/search', title, index: false });
}

/**
 * Search results (S4.2, design v2.3 SearchWebV23; ≤ 960px SearchMobileV22 + SearchSheetV22).
 * The URL holds the whole search, so a link can be shared and the server renders the first rooms.
 */
export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const t = getTranslations(locale as SupportedLocale).guest;
  const criteria = normalizeSearchCriteria(criteriaFromSearchParams(await searchParams));
  const today = bangkokToday();
  const title = searchTitle(criteria, { ...t.results, propertyType: t.propertyType });
  const chips = activeFilterChips(criteria, {
    propertyType: t.propertyType,
    quick: t.quick,
    priceUnder: t.search.priceUnder,
    priceBetween: t.search.priceBetween,
    priceOver: t.search.priceOver,
    studio: t.spec.bedroom.studio,
    bedroomOne: t.spec.bedroom.one,
    bedroomMany: t.spec.bedroom.many,
    threePlus: t.spec.bedroom.threePlus,
    moveIn: {
      now: t.results.availabilityNow,
      '30d': t.results.availabilityWithin1Month,
      '90d': t.results.availabilityWithin3Months,
    },
    durationChip: t.results.durationChip,
  });

  const load = firstLoad(criteria);
  let result: PublicRoomSearchResult | null = null;
  if (criteria.mode === 'rent') {
    try {
      result = await loadSearchResults(toPublicQuery(criteria, load.page, load.limit));
    } catch (error) {
      console.error('[guest search] search failed:', error);
    }
  }

  let body: React.ReactNode;
  if (criteria.mode === 'buy') {
    // No sale listings yet: say so and offer the rent search with the same filters.
    body = (
      <EmptyState
        title={t.results.buyComingSoon}
        action={{ label: t.nav.search, href: localePath(locale, searchHref(withFilters(criteria, { mode: 'rent' }))) }}
      />
    );
  } else if (!result) {
    body = (
      <ErrorState
        title={t.states.errorTitle}
        body={t.states.errorBody}
        retry={{ label: t.states.retry, href: localePath(locale, searchHref(criteria)) }}
      />
    );
  } else {
    body = (
      <SearchResults
        key={searchHref(withFilters(criteria, {}))}
        criteria={criteria}
        initialItems={result.items}
        total={result.total}
        loadedPages={load.loadedPages}
        today={today}
        locale={locale}
      />
    );
  }

  return (
    <SearchNavigation criteria={criteria}>
      <div className="nk-search-top">
        <div className="nk-search-top__inner">
          <SearchKeywordBar criteria={criteria} total={result?.total ?? null} />
        </div>
      </div>
      <div className="nk-search-layout">
        <aside className="nk-search-aside" aria-label={t.results.filtersTitle}>
          <SearchFilters criteria={criteria} />
        </aside>
        <section className="nk-search-main" aria-labelledby="search-title">
          <h1 id="search-title" className="nk-search-title" data-testid="searchPage.title">
            {title}
          </h1>
          {chips.length ? (
            <ul className="nk-search-chips" aria-label={t.results.activeFilters} data-testid="searchPage.activeFilters">
              {chips.map((chip) => (
                <li key={chip.key}>
                  <Link
                    href={localePath(locale, chip.href)}
                    scroll={false}
                    className="nk-filter-chip"
                    aria-label={fillTemplate(t.results.removeFilter, { label: chip.label })}
                    data-testid={`searchPage.removeFilter.${chip.key}`}
                  >
                    {chip.label}
                    <CloseIcon size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {body}
        </section>
      </div>
    </SearchNavigation>
  );
}
