import React from 'react';
import type { Metadata } from 'next';
import { getTranslations, type SupportedLocale } from '@nestyk/i18n';
import { criteriaFromSearchParams } from '@nestyk/feature-search';
import type { PublicRoomSearchResult } from '@nestyk/types';
import { EmptyState, ErrorState } from '../../../components/guest/GuestStates';
import { SearchFilters } from '../../../components/guest/SearchFilters';
import { SearchKeywordBar } from '../../../components/guest/SearchKeywordBar';
import { SearchMap } from '../../../components/guest/SearchMap';
import { SEARCH_FILTERS_ID } from '../../../components/guest/SearchToolbarParts';
import { SearchNavigation } from '../../../components/guest/SearchNavigation';
import { SearchResults } from '../../../components/guest/SearchResults';
import { bangkokToday } from '../../../../lib/guest-home';
import { MAP_PAGE_SIZE } from '../../../../lib/guest-map';
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
/** The search box shows these with its own ✕ (location search), so no chip repeats them (Mos 20 Nov 2026). */
const BOX_CHIPS = new Set(['near', 'area', 'keyword']);
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
  const areaNames = t.areaNames as Record<string, string>;
  const title = searchTitle(criteria, {
    ...t.results,
    propertyType: t.propertyType,
    areaTitle: t.areaPage.title,
    areaNames,
    nearMeTitle: t.location.nearMeTitle,
    nearPlaceTitle: t.location.nearPlaceTitle,
    mapAreaTitle: t.location.mapAreaTitle,
  });
  const chips = activeFilterChips(criteria, {
    propertyType: t.propertyType,
    quick: t.quick,
    priceUnder: t.search.priceUnder,
    priceBetween: t.search.priceBetween,
    // The lower bound is included, so it reads "ตั้งแต่" (from), not "มากกว่า" (more than).
    priceOver: t.results.priceFromChip,
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
    areaChip: t.areaPage.filterChip,
    areaNames,
    nearMeChip: t.location.nearMeChip,
    nearPlaceChip: t.location.nearPlaceChip,
    mapAreaChip: t.location.mapArea,
  });

  const toolbarChips = chips.filter((chip) => !BOX_CHIPS.has(chip.key));

  // The map (S4.3) starts with the API's largest page and loads up to 3 more in the browser.
  const onMap = criteria.view === 'map';
  const load = onMap ? { page: 1, limit: MAP_PAGE_SIZE, loadedPages: 1 } : firstLoad(criteria);
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
  } else if (onMap) {
    // One key for every map search: the map stays put while it is moved and searched again.
    body = <SearchMap key="map" criteria={criteria} initialItems={result.items} total={result.total} today={today} locale={locale} chips={toolbarChips} />;
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
        chips={toolbarChips}
      />
    );
  }

  return (
    <SearchNavigation criteria={criteria}>
      <div className={`nk-search-top${onMap ? ' nk-search-top--map' : ''}`}>
        <div className="nk-search-top__inner">
          <SearchKeywordBar criteria={criteria} total={result?.total ?? null} />
        </div>
      </div>
      <div className={`nk-search-layout${onMap ? ' nk-search-layout--map' : ''}`}>
        {onMap ? null : (
          <aside id={SEARCH_FILTERS_ID} className="nk-search-aside" aria-label={t.results.filtersTitle}>
            <SearchFilters criteria={criteria} />
          </aside>
        )}
        <section className="nk-search-main" aria-labelledby="search-title">
          {/* Mos 20 Nov 2026: no heading on screen (more room for the map); screen readers still get it. */}
          <h1 id="search-title" className="nk-sr-only" data-testid="searchPage.title">
            {title}
          </h1>
          {body}
        </section>
      </div>
    </SearchNavigation>
  );
}
