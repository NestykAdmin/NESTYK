import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fillTemplate, getTranslations, type SupportedLocale } from '@nestyk/i18n';
import type { PublicAreaSummary, PublicRoomSearchResult } from '@nestyk/types';
import { formatPublicPrice } from '@nestyk/feature-listing/public';
import { AreaCard } from '../../../../components/guest/AreaCard';
import { EmptyState } from '../../../../components/guest/GuestStates';
import { SearchIcon, TrainIcon, UsersIcon } from '../../../../components/guest/GuestIcons';
import { RoomCard } from '../../../../components/guest/RoomCard';
import { bangkokToday } from '../../../../../lib/guest-home';
import { loadAreaRooms, loadAreas } from '../../../../../lib/guest-area-data';
import { areaJsonLd, areaPageIndex, areaPagePath, isKnownArea, otherAreas } from '../../../../../lib/guest-areas';
import { jsonLdScript } from '../../../../../lib/guest-room-seo';
import { searchHref } from '../../../../../lib/guest-search';
import { guestPageMetadata, guestSiteOrigin } from '../../../../../lib/guest-seo';
import { localePath } from '../../../../../lib/guest-site';
import '../../../guest-areas.css';

type Props = { params: Promise<{ locale: string; area: string }> };

/** Kept for 5 minutes like the home page (AREA_DATA_REVALIDATE_SECONDS in lib/guest-area-data.ts). */
export const revalidate = 300;

type AreaData = { areas: PublicAreaSummary[]; rooms: PublicRoomSearchResult };

/** The area list (for the price, cover and other areas) and the first rooms of this area. Throws when the API fails. */
async function load(slug: string): Promise<AreaData> {
  const [areas, rooms] = await Promise.all([loadAreas(), loadAreaRooms(slug)]);
  return { areas, rooms };
}

function copyOf(locale: string) {
  return getTranslations(locale as SupportedLocale).guest;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, area: slug } = await params;
  const t = copyOf(locale);
  const names = t.areaNames as Record<string, string>;
  const path = areaPagePath(slug);
  if (!isKnownArea(slug, names)) return guestPageMetadata({ locale, path, index: false });
  const data = await load(slug).catch(() => null);
  if (!data) return guestPageMetadata({ locale, path, index: false });
  const name = names[slug];
  const info = t.areaInfo[slug as keyof typeof t.areaInfo];
  const summary = data.areas.find((area) => area.slug === slug);
  const cover = summary?.coverImageUrl ?? data.rooms.items[0]?.coverImageUrl ?? null;
  const title = fillTemplate(t.areaPage.title, { name });
  return guestPageMetadata({
    locale,
    path,
    title: `${title} · NESTYK`,
    description: fillTemplate(t.areaPage.metaDescription, { name, places: info?.places ?? '', highlight: info?.highlight ?? '' }),
    // Mos 20 Nov 2026: all 4 languages are indexed (hreflang on); an area with no rooms stays out of search.
    index: areaPageIndex(data.rooms.total),
    image: cover ? { url: cover, alt: title } : null,
  });
}

/**
 * Area page /rent/<slug> (SEO-1, design A "AreaAWeb / AreaAPhone" on the canvas page "area", Mos 20 Nov 2026).
 * The name, places, highlight and "who it suits" come from i18n by slug (Mos's area notes); rooms, the count and the
 * lowest rent come from GET /public/rooms/search?area= and GET /public/areas. An unknown slug is a 404.
 */
export default async function AreaPage({ params }: Props) {
  const { locale, area: slug } = await params;
  const t = copyOf(locale);
  const names = t.areaNames as Record<string, string>;
  if (!isKnownArea(slug, names)) notFound();
  let data: AreaData;
  try {
    data = await load(slug);
  } catch (error) {
    // As the room page (review R2): throw, so a failed regeneration keeps the last good page; error.tsx shows the state.
    console.error('[guest area] load failed:', error);
    throw new Error('Public rooms API unavailable');
  }

  const copy = t.areaPage;
  const name = names[slug];
  const info = t.areaInfo[slug as keyof typeof t.areaInfo];
  const summary = data.areas.find((area) => area.slug === slug);
  const rooms = data.rooms.items;
  const total = data.rooms.total;
  const price = formatPublicPrice(summary?.priceFrom);
  const lines = (summary?.transitLines ?? [])
    .map((code) => (t.transitLines as Record<string, string>)[code])
    .filter((label): label is string => !!label);
  const others = otherAreas(data.areas, slug);
  const today = bangkokToday();
  const areaSearch = localePath(locale, searchHref({ area: slug }));
  const jsonLd = areaJsonLd({ origin: guestSiteOrigin(), locale, slug, name, homeName: t.tabs.home, listName: copy.listTitle });

  return (
    <div className="nk-ap" data-testid="areaPage">
      {jsonLd ? (
        // jsonLdScript writes "<" as an escape, so no text can close the tag.
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      ) : null}
      <section className="nk-ap-hero" aria-labelledby="ap-title">
        <div className="nk-ap-hero__inner">
          <nav className="nk-ap-crumbs" aria-label={t.room.breadcrumbLabel}>
            <Link href={localePath(locale, '/')}>{t.tabs.home}</Link>
            <span aria-hidden="true">›</span>
            <Link href={localePath(locale, '/areas')}>{copy.listTitle}</Link>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{name}</span>
          </nav>
          <div className="nk-ap-hero__row">
            <div className="nk-ap-hero__text">
              <div className="nk-ap-hero__heading">
                <h1 id="ap-title" className="nk-ap-title">
                  {fillTemplate(copy.title, { name })}
                </h1>
                {info?.places ? <p className="nk-ap-places">{info.places}</p> : null}
              </div>
              {info?.highlight ? <p className="nk-ap-highlight">{info.highlight}</p> : null}
              {lines.length ? (
                <ul className="nk-ap-lines" aria-label={copy.linesLabel}>
                  {lines.map((label) => (
                    <li key={label}>
                      <TrainIcon size={16} />
                      {label}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {total > 0 ? (
              <dl className="nk-ap-stats">
                <div>
                  <dt>{copy.statRooms}</dt>
                  <dd>{total.toLocaleString('en-US')}</dd>
                </div>
                {price ? (
                  <div>
                    <dt>{copy.statPrice}</dt>
                    <dd className="nk-ap-stats__price">{price}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </div>
          {total > 0 ? (
            <Link href={areaSearch} className="nk-btn nk-btn--primary nk-ap-cta">
              <SearchIcon />
              {copy.searchCta}
            </Link>
          ) : null}
        </div>
      </section>

      <div className="nk-ap-body">
        {info?.tenants ? (
          <section className="nk-ap-fit" aria-labelledby="ap-fit">
            <span className="nk-ap-fit__icon" aria-hidden="true">
              <UsersIcon size={22} />
            </span>
            <div className="nk-ap-fit__text">
              <h2 id="ap-fit" className="nk-ap-fit__title">
                {copy.fitTitle}
              </h2>
              <p>{info.tenants}</p>
            </div>
          </section>
        ) : null}

        <section className="nk-ap-section" aria-labelledby="ap-rooms">
          <h2 id="ap-rooms" className="nk-section__title">
            {copy.roomsTitle}
          </h2>
          {rooms.length ? (
            <>
              <div className="nk-room-grid nk-search-list nk-search-list--card" data-testid="areaPage.rooms">
                {rooms.map((card) => (
                  <RoomCard key={card.id} card={card} copy={t} locale={locale} today={today} />
                ))}
              </div>
              {total > rooms.length ? (
                <Link href={areaSearch} className="nk-btn nk-btn--outline nk-ap-more">
                  {fillTemplate(copy.seeAllRooms, { count: total.toLocaleString('en-US') })}
                </Link>
              ) : null}
            </>
          ) : (
            <EmptyState
              title={copy.emptyTitle}
              body={copy.emptyBody}
              action={{ label: copy.seeAllAreas, href: localePath(locale, '/areas') }}
            />
          )}
        </section>

        {others.length ? (
          <section className="nk-ap-section" aria-labelledby="ap-others">
            <div className="nk-section__head">
              <h2 id="ap-others" className="nk-section__title">
                {copy.otherAreas}
              </h2>
              <Link href={localePath(locale, '/areas')} className="nk-link-more">
                {copy.seeAllAreas}
              </Link>
            </div>
            <div className="nk-area-grid nk-ap-others">
              {others.map((area) => (
                <AreaCard key={area.slug} area={area} copy={t} locale={locale} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
