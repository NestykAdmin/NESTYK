import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fillTemplate, getTranslations, type SupportedLocale } from '@nestyk/i18n';
import type { PublicRoomDetail } from '@nestyk/types';
import {
  buildPublicRoomSpecs,
  defaultPriceOption,
  formatPublicAvailability,
  formatPublicPrice,
  formatStationDistance,
  getPublicAvailability,
  NEAR_TRANSIT_METERS,
  roomPagePath,
  sortedPriceOptions,
} from '@nestyk/feature-listing/public';
import { FavoriteButton } from '../../../../components/guest/FavoriteButton';
import { AreaIcon, BathIcon, BedIcon, CheckIcon, ChevronRightIcon, CondoIcon, PinIcon, TrainIcon } from '../../../../components/guest/GuestIcons';
import { RoomCard } from '../../../../components/guest/RoomCard';
import { RoomAmenities } from '../../../../components/guest/room/RoomAmenities';
import { RoomDescription } from '../../../../components/guest/room/RoomDescription';
import { RoomGallery } from '../../../../components/guest/room/RoomGallery';
import { RoomLocationMap } from '../../../../components/guest/room/RoomLocation';
import { RoomBackLink } from '../../../../components/guest/room/RoomBackLink';
import { RoomSectionTabs } from '../../../../components/guest/room/RoomSectionTabs';
import { RoomShareButton } from '../../../../components/guest/room/RoomShareButton';
import { RoomPriceCards, RoomTermProvider, RoomViewingButton, RoomViewingCard } from '../../../../components/guest/room/RoomTerm';
import { bangkokToday, roomDisplayTitle } from '../../../../../lib/guest-home';
import { loadNearbyRooms, loadRoomDetail } from '../../../../../lib/guest-rooms';
import { searchHref } from '../../../../../lib/guest-search';
import { guestPageMetadata, roomPageIndex } from '../../../../../lib/guest-seo';
import { localePath } from '../../../../../lib/guest-site';

type Props = { params: Promise<{ locale: string; id: string }> };

/** Kept for 5 minutes like the home page (PUBLIC_DATA_REVALIDATE_SECONDS in lib/guest-rooms.ts). */
export const revalidate = 300;

type Load = { room: PublicRoomDetail } | { failed: true };

async function load(id: string): Promise<Load> {
  try {
    const room = await loadRoomDetail(id);
    if (!room) notFound();
    return { room };
  } catch (error) {
    // notFound() throws too: let Next handle it.
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    console.error('[guest room] detail failed:', error);
    return { failed: true };
  }
}

function titleOf(room: PublicRoomDetail, t: ReturnType<typeof getTranslations>['guest']): string {
  const [bedrooms] = buildPublicRoomSpecs({ bedrooms: room.bedrooms, bathrooms: null, areaSqm: null }, t.spec);
  return roomDisplayTitle(
    room,
    { titleFallback: t.card.titleFallback, roomFallback: t.card.roomFallback, propertyType: t.propertyType },
    bedrooms ?? null,
  );
}

function stationText(room: PublicRoomDetail): string | null {
  const station = room.nearestStation;
  if (!station) return null;
  return [station.type, station.name, formatStationDistance(station.distanceMeters)].filter(Boolean).join(' ');
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const t = getTranslations(locale as SupportedLocale).guest;
  const path = roomPagePath(id);
  const result = await load(id).catch(() => ({ failed: true }) as Load);
  if (!('room' in result)) return guestPageMetadata({ locale, path, index: false });
  const room = result.room;
  const title = titleOf(room, t);
  const place = [room.district, stationText(room)].filter(Boolean).join(' · ');
  const price = formatPublicPrice(room.priceFrom);
  // No price: the title and place only, never "from  a month" (review R6).
  const description = price ? fillTemplate(t.room.metaDescription, { title, price, place }).trim() : [title, place].filter(Boolean).join(' · ');
  return guestPageMetadata({ locale, path, title: `${title} · NESTYK`, description, index: roomPageIndex(locale) });
}

/**
 * Room page (S7.3, design "แบบผสม" RoomMixWeb / RoomMixPhone on the S7.1 canvas, Mos 19 Nov 2026).
 * Data: GET /public/rooms/:id only (a whitelist: no owner, contact or unit number). Rooms that are not public answer
 * 404, which shows the "no longer available" page. "ขอนัดดูห้อง" waits for its API and shows "เร็ว ๆ นี้".
 */
export default async function RoomPage({ params }: Props) {
  const { locale, id } = await params;
  const all = getTranslations(locale as SupportedLocale);
  const t = all.guest;
  const copy = t.room;
  const result = await load(id);
  // Review R2: throw instead of rendering an error page, so a failed regeneration keeps the last good page in the
  // cache; the first render shows error.tsx.
  if (!('room' in result)) throw new Error('Public rooms API unavailable');
  const room = result.room;
  const today = bangkokToday();
  const title = titleOf(room, t);
  const station = stationText(room);
  const prices = sortedPriceOptions(room.priceOptions);
  const initial = defaultPriceOption(prices);
  const lowest = initial ? formatPublicPrice(initial.pricePerMonth) : formatPublicPrice(room.priceFrom);
  const availability = getPublicAvailability(room.availableFrom, today);
  const moveIn = availability.status === 'now' ? t.availability.now : formatPublicAvailability(availability, t.availability, locale);
  const nearTransit = room.nearestStation != null && room.nearestStation.distanceMeters <= NEAR_TRANSIT_METERS;
  const nearby = await loadNearbyRooms(room);
  const nearbyPlace = room.nearestStation ? `${room.nearestStation.type} ${room.nearestStation.name}` : room.district ?? '';
  const nearbyHref = localePath(
    locale,
    room.nearestStation
      ? searchHref({ stationType: room.nearestStation.type, stationName: room.nearestStation.name })
      : searchHref({ keyword: room.district ?? undefined }),
  );
  const resultsHref = localePath(locale, '/search');
  const saveRoom = { title, priceText: lowest ? `${lowest} ${t.card.perMonthLong}` : null, coverImageUrl: room.coverImageUrl };

  const facts: { key: string; icon: React.ReactNode; value: string; label: string }[] = [];
  if (room.bedrooms != null) facts.push({ key: 'bed', icon: <BedIcon size={20} />, value: room.bedrooms === 0 ? copy.studio : String(room.bedrooms), label: copy.bedrooms });
  if (room.bathrooms != null) facts.push({ key: 'bath', icon: <BathIcon size={20} />, value: String(room.bathrooms), label: copy.bathrooms });
  if (room.areaSqm != null) facts.push({ key: 'size', icon: <AreaIcon size={20} />, value: fillTemplate(copy.sizeValue, { count: room.areaSqm }), label: copy.size });
  if (room.floor != null) facts.push({ key: 'floor', icon: <CondoIcon size={20} />, value: fillTemplate(copy.floorValue, { floor: room.floor }), label: copy.floor });

  const tags = [
    availability.status === 'now' ? copy.tagMoveInNow : null,
    room.shortTermAvailable ? copy.tagShortTerm : null,
    nearTransit ? copy.tagNearTransit : null,
    room.petFriendly ? copy.tagPetFriendly : null,
  ].filter((tag): tag is string => tag !== null);

  const favorite = (
    <FavoriteButton
      roomId={room.id}
      label={fillTemplate(t.card.saveNamed, { name: title })}
      unsaveLabel={fillTemplate(t.card.unsaveNamed, { name: title })}
      room={saveRoom}
    />
  );

  return (
    <article className="nk-rp" data-testid="roomPage">
      <div className="nk-rp-top">
        <nav className="nk-rp-crumbs" aria-label={copy.breadcrumbLabel}>
          <RoomBackLink href={resultsHref} className="nk-rp-back">
            <ChevronRightIcon size={18} />
            {copy.backToResults}
          </RoomBackLink>
          <span aria-hidden="true" className="nk-rp-crumbs__sep">
            |
          </span>
          <a href={localePath(locale, '/')}>{t.tabs.home}</a>
          <span aria-hidden="true">›</span>
          <span aria-current="page">{title}</span>
        </nav>

        <header className="nk-rp-head">
          <div className="nk-rp-head__text">
            <p className="nk-rp-badges">
              <span className="nk-badge nk-badge--dark">{t.card.rentBadge}</span>
              {room.isNew ? <span className="nk-badge nk-badge--brand">{t.card.newBadge}</span> : null}
              {room.propertyType ? <span className="nk-badge nk-rp-badge--plain">{t.propertyType[room.propertyType]}</span> : null}
            </p>
            <h1 className="nk-rp-title">{title}</h1>
            <p className="nk-rp-sub">
              {room.projectName || room.district ? (
                <span>
                  <PinIcon size={18} />
                  {[room.projectName, room.district].filter(Boolean).join(' · ')}
                </span>
              ) : null}
              {station ? (
                <span>
                  <TrainIcon size={18} />
                  {station}
                </span>
              ) : null}
            </p>
          </div>
          <div className="nk-rp-head__actions">
            <RoomShareButton title={title} variant="text" />
            <span className="nk-rp-fav">{favorite}</span>
          </div>
        </header>

        <RoomGallery
          images={room.imageUrls}
          title={title}
          overlay={
            <div className="nk-rp-overlay">
              <RoomBackLink href={resultsHref} className="nk-rp-round" label={copy.backToResults}>
                <ChevronRightIcon size={22} />
              </RoomBackLink>
              <span className="nk-rp-overlay__end">
                <RoomShareButton title={title} variant="icon" />
                <span className="nk-rp-fav">{favorite}</span>
              </span>
            </div>
          }
        />
      </div>

      <RoomSectionTabs
        label={copy.sectionsLabel}
        sections={[
          { id: 'overview', label: copy.tabOverview },
          ...(prices.length ? [{ id: 'price', label: copy.tabPrice }] : []),
          { id: 'amenities', label: copy.tabAmenities },
          { id: 'location', label: copy.tabLocation },
          ...(nearby.length ? [{ id: 'nearby', label: copy.tabNearby }] : []),
        ]}
      />

      <RoomTermProvider options={prices} initialMonths={initial?.durationMonths ?? null}>
        <div className="nk-rp-body">
          <div className="nk-rp-main">
            <section id="overview" className="nk-rp-section" aria-labelledby="rp-overview">
              <h2 id="rp-overview" className="nk-rp-h2">
                {copy.tabOverview}
              </h2>
              {facts.length ? (
                <ul className="nk-rp-facts" aria-label={copy.factsLabel}>
                  {facts.map((fact) => (
                    <li key={fact.key}>
                      <span className="nk-rp-facts__icon" aria-hidden="true">
                        {fact.icon}
                      </span>
                      <span className="nk-rp-facts__value">{fact.value}</span>
                      <span className="nk-rp-facts__label">{fact.label}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {tags.length ? (
                <ul className="nk-rp-tags">
                  {tags.map((tag) => (
                    <li key={tag}>
                      <CheckIcon size={16} />
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}
              {room.description ? <RoomDescription text={room.description} /> : null}
            </section>

            {prices.length ? (
              <section id="price" className="nk-rp-section" aria-labelledby="rp-price">
                <h2 id="rp-price" className="nk-rp-h2">
                  {copy.priceTitle}
                </h2>
                <RoomPriceCards />
                <p className="nk-rp-note">{copy.otherCosts}</p>
              </section>
            ) : null}

            <section id="amenities" className="nk-rp-section" aria-labelledby="rp-amenities">
              <h2 id="rp-amenities" className="nk-rp-h2">
                {copy.amenitiesTitle}
              </h2>
              <RoomAmenities codes={room.amenityCodes} />
            </section>

            <section id="location" className="nk-rp-section" aria-labelledby="rp-location">
              <h2 id="rp-location" className="nk-rp-h2">
                {copy.locationTitle}
              </h2>
              <div className="nk-rp-location">
                <RoomLocationMap latitude={room.latitude} longitude={room.longitude} />
                <ul className="nk-rp-location__facts">
                  {station ? (
                    <li>
                      <span>{copy.nearestStation}</span>
                      <strong>{station}</strong>
                    </li>
                  ) : null}
                  {room.district ? (
                    <li>
                      <span>{copy.district}</span>
                      <strong>{room.district}</strong>
                    </li>
                  ) : null}
                  <li className="nk-rp-note">{copy.approxNote}</li>
                </ul>
              </div>
            </section>
          </div>

          <RoomViewingCard moveIn={moveIn} />
        </div>
      </RoomTermProvider>

      {nearby.length ? (
        <section id="nearby" className="nk-rp-nearby" aria-labelledby="rp-nearby">
          <div className="nk-rp-nearby__head">
            <h2 id="rp-nearby" className="nk-rp-h2">
              {fillTemplate(copy.nearbyTitle, { place: nearbyPlace })}
            </h2>
            <a href={nearbyHref} className="nk-link-more">
              {copy.nearbyAll}
            </a>
          </div>
          <div className="nk-rp-nearby__grid">
            {nearby.map((card) => (
              <RoomCard key={card.id} card={card} copy={t} locale={locale} today={today} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="nk-rp-closing" aria-labelledby="rp-closing">
        <div className="nk-rp-closing__inner">
          <div>
            <h2 id="rp-closing" className="nk-rp-closing__title">
              {copy.closingTitle}
            </h2>
            <p className="nk-rp-closing__text">{copy.viewingSoonNote}</p>
          </div>
          <RoomViewingButton />
        </div>
      </section>

      <div className="nk-rp-bar" data-testid="roomPage.bar">
        <p className="nk-rp-bar__price">
          {lowest ? (
            <span>
              <span className="nk-rp-bar__value">{lowest}</span>
              <span className="nk-rp-bar__unit"> {t.card.perMonth}</span>
            </span>
          ) : null}
          {initial ? <span className="nk-rp-bar__term">{fillTemplate(copy.contractMonths, { count: initial.durationMonths })}</span> : null}
        </p>
        <RoomViewingButton className="nk-rp-bar__cta" />
      </div>
    </article>
  );
}
