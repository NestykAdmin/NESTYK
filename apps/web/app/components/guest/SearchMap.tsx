'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import type { GuestSearchCriteria } from '@nestyk/feature-search';
import type { PublicRoomCard, PublicRoomSearchResult } from '@nestyk/types';
import { buildPublicRoomSpecs, formatPublicPrice } from '@nestyk/feature-listing/public';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  Circle,
  GoogleMap,
  MapConsentGate,
  useApiLoadingStatus,
  useMap,
  type MapEvent,
} from '@nestyk/feature-listing/desktop';
import { roomDisplayTitle } from '../../../lib/guest-home';
import {
  MAP_CIRCLE_STYLE,
  MAP_MAX_PAGES,
  MAP_PAGE_SIZE,
  MAP_ROOM_LIMIT,
  SEARCH_AS_MOVE_DELAY_MS,
  boundsOfCircle,
  boundsOfPins,
  circleFromBounds,
  inBounds,
  roomPins,
  type MapBounds,
  type RoomPin,
} from '../../../lib/guest-map';
import { isGuestPageReady, localePath } from '../../../lib/guest-site';
import { publicSearchUrl, searchHref, toPublicQuery, withFilters, type FilterChip } from '../../../lib/guest-search';
import { ChevronRightIcon, CloseIcon, LocateIcon, MinusIcon, PhotoIcon, PinIcon, PlusIcon, RefreshIcon, TrainIcon } from './GuestIcons';
import { RoomCard } from './RoomCard';
import { SearchKeywordBar } from './SearchKeywordBar';
import { SearchFilterChips, SearchSort, SearchViewSwitch } from './SearchToolbarParts';
import { useSearchNavigation } from './SearchNavigation';
import '../../[locale]/guest-map.css';

const MAP_ID = 'nk-search-map';
/** Opens on central Bangkok when the search has no place and no room has a position. */
const BANGKOK = { lat: 13.7563, lng: 100.5018 };
const BANGKOK_ZOOM = 11;
const PLACE_ZOOM = 15;
/** Room on each side when the map fits a place or the rooms. */
const FIT_PADDING = 56;
/** The list beside the map shows at this width and up (same as guest.css). */
const WIDE_QUERY = '(min-width: 961px)';

type Copy = ReturnType<typeof useLocale>['t']['guest'];

function toBox(literal: google.maps.LatLngBoundsLiteral): MapBounds {
  return { north: literal.north, south: literal.south, east: literal.east, west: literal.west };
}

function fitTo(map: google.maps.Map, box: MapBounds | null) {
  if (!box) {
    map.setCenter(BANGKOK);
    map.setZoom(BANGKOK_ZOOM);
    return;
  }
  // One spot (or rooms of one building) would zoom to the street: show the neighbourhood instead.
  if (box.north - box.south < 0.002 && box.east - box.west < 0.002) {
    map.setCenter({ lat: (box.north + box.south) / 2, lng: (box.east + box.west) / 2 });
    map.setZoom(PLACE_ZOOM);
    return;
  }
  map.fitBounds(box, FIT_PADDING);
}

/**
 * Map search (S4.3, design SearchMapWebV23 / MapMobileV22, Mos 20 Nov 2026). Wide screens: the rooms in view on the
 * left, the map on the right. Phones: the map fills the screen under a floating search bar, a picked pin shows its
 * room, and "แสดงรายการ" goes back to the cards. The page keeps this component across searches (one map), so moving
 * the map does not rebuild it. Google's script loads only after the maps cookie is allowed (MapConsentGate).
 */
export function SearchMap({
  criteria,
  initialItems,
  total: initialTotal,
  today,
  locale,
  chips = [],
}: {
  criteria: GuestSearchCriteria;
  initialItems: PublicRoomCard[];
  total: number;
  today: string;
  locale: string;
  /** Filters in use (activeFilterChips), shown after the count. */
  chips?: readonly FilterChip[];
}) {
  const { t } = useLocale();
  const copy = t.guest;
  const { pending, update } = useSearchNavigation();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  // Wide screens: the list folds away for a full-width map (Mos 20 Nov 2026).
  const [listHidden, setListHidden] = useState(false);
  const listId = useId();
  const criteriaRef = useRef(criteria);
  criteriaRef.current = criteria;

  // A new search (the map moved, a filter changed): its first page comes from the server, then up to 4 pages of 48.
  useEffect(() => {
    setItems(initialItems);
    setTotal(initialTotal);
    setSelected(null);
    const controller = new AbortController();
    (async () => {
      let all = initialItems;
      let known = initialTotal;
      for (let page = 2; page <= MAP_MAX_PAGES && all.length < known; page += 1) {
        try {
          const response = await fetch(publicSearchUrl(toPublicQuery(criteriaRef.current, page, MAP_PAGE_SIZE)), { signal: controller.signal });
          if (!response.ok) return;
          const result = (await response.json()) as PublicRoomSearchResult;
          if (controller.signal.aborted || !result.items.length) return;
          const seen = new Set(all.map((card) => card.id));
          all = [...all, ...result.items.filter((card) => !seen.has(card.id))];
          known = result.total;
          setItems(all);
          setTotal(result.total);
        } catch {
          return;
        }
      }
    })();
    return () => controller.abort();
  }, [initialItems, initialTotal]);

  const pins = useMemo(() => roomPins(items), [items]);
  const pinOfRoom = useMemo(() => {
    const index = new Map<string, string>();
    for (const pin of pins) for (const id of pin.roomIds) index.set(id, pin.id);
    return index;
  }, [pins]);
  const visible = useMemo(() => (bounds ? items.filter((card) => inBounds(card, bounds)) : items), [items, bounds]);
  const selectedPin = pins.find((pin) => pin.id === selected) ?? null;
  const roomsById = useMemo(() => new Map(items.map((card) => [card.id, card])), [items]);

  const toCards = () => update({ view: 'list' });
  const pick = (pinId: string | null) => {
    setSelected(pinId);
    if (!pinId || typeof window === 'undefined' || !window.matchMedia?.(WIDE_QUERY).matches) return;
    const first = pins.find((pin) => pin.id === pinId)?.roomIds[0];
    if (first) document.querySelector(`[data-map-room="${CSS.escape(first)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const count = bounds ? visible.length : total;
  const countText = bounds ? fillTemplate(copy.map.foundInArea, { count: count.toLocaleString('en-US') }) : fillTemplate(copy.results.found, { count: count.toLocaleString('en-US') });
  const capped = total > items.length && items.length >= MAP_ROOM_LIMIT;

  return (
    <div className={`nk-map-view${listHidden ? ' is-full' : ''}`} aria-busy={pending} data-testid="searchMap">
      <div className="nk-search-toolbar">
        <div className="nk-search-toolbar__lead">
          <p className="nk-search-toolbar__count" role="status" data-testid="searchMap.count">
            {countText}
          </p>
          <SearchFilterChips chips={chips} locale={locale} />
        </div>
        <div className="nk-search-toolbar__actions">
          <SearchSort criteria={criteria} testId="searchMap.sort" />
          <SearchViewSwitch view="map" />
        </div>
      </div>
      <section id={listId} className="nk-map-list" aria-label={copy.results.listLabel} data-testid="searchMap.list">
        {capped ? <p className="nk-map-note">{fillTemplate(copy.map.capped, { shown: items.length.toLocaleString('en-US'), total: total.toLocaleString('en-US') })}</p> : null}
        {items.length && !pins.length ? <p className="nk-map-note">{copy.map.noPins}</p> : null}
        {visible.length ? (
          <div className="nk-search-list nk-search-list--list nk-map-list__rooms">
            {visible.map((card) => {
              const pinId = pinOfRoom.get(card.id) ?? null;
              // Hover lifts the card (CSS); the room of the pin picked on the map is marked yellow (Mos 20 Nov 2026).
              const picked = pinId !== null && pinId === selected;
              return (
                <div
                  key={card.id}
                  className={`nk-map-list__room${picked ? ' is-selected' : ''}`}
                  data-map-room={card.id}
                  onMouseEnter={() => setHovered(pinId)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <RoomCard card={card} copy={copy} locale={locale} today={today} />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="nk-map-note">{copy.states.emptyTitle}</p>
        )}
      </section>

      <section className="nk-map-stage" aria-label={copy.map.label} data-testid="searchMap.stage">
        <button
          type="button"
          className="nk-map-fold"
          aria-expanded={!listHidden}
          aria-controls={listId}
          aria-label={listHidden ? copy.map.showListPanel : copy.map.hideListPanel}
          title={listHidden ? copy.map.showListPanel : copy.map.hideListPanel}
          onClick={() => setListHidden((hidden) => !hidden)}
          data-testid="searchMap.fold"
        >
          <ChevronRightIcon size={18} className={listHidden ? undefined : 'nk-map-fold__left'} />
        </button>
        <div className="nk-map-top">
          <SearchKeywordBar criteria={criteria} total={total} variant="map" onBack={toCards} />
        </div>
        {apiKey ? (
          <MapConsentGate style={{ height: '100%', borderRadius: 0 }} testID="searchMap.consent">
            <APIProvider apiKey={apiKey}>
              <MapStage
                criteria={criteria}
                pins={pins}
                selected={selected}
                hovered={hovered}
                onPick={pick}
                onBounds={setBounds}
                onSearch={(box) => {
                  const circle = circleFromBounds(box);
                  update({ nearGps: circle, nearMap: true, placeName: undefined, area: undefined });
                }}
                searchKey={searchHref(withFilters(criteria, { view: 'map' }))}
                copy={copy}
              />
            </APIProvider>
          </MapConsentGate>
        ) : (
          <MapUnavailable copy={copy} onCards={toCards} />
        )}
        {selectedPin ? (
          <MapPeek
            pin={selectedPin}
            rooms={selectedPin.roomIds.map((id) => roomsById.get(id)).filter((card): card is PublicRoomCard => Boolean(card))}
            copy={copy}
            locale={locale}
            onClose={() => setSelected(null)}
          />
        ) : null}
        <button type="button" className="nk-map-handle" onClick={toCards} data-testid="searchMap.showList">
          <span className="nk-map-handle__grip" aria-hidden="true" />
          {fillTemplate(copy.map.showList, { count: count.toLocaleString('en-US') })}
        </button>
      </section>
    </div>
  );
}

function MapUnavailable({ copy, onCards }: { copy: Copy; onCards: () => void }) {
  return (
    <div className="nk-map-empty" role="status" data-testid="searchMap.unavailable">
      <p>{copy.map.unavailable}</p>
      <button type="button" className="nk-btn nk-btn--outline" onClick={onCards}>
        {copy.map.viewCards}
      </button>
    </div>
  );
}

function MapStage({
  criteria,
  pins,
  selected,
  hovered,
  onPick,
  onBounds,
  onSearch,
  searchKey,
  copy,
}: {
  criteria: GuestSearchCriteria;
  pins: RoomPin[];
  selected: string | null;
  hovered: string | null;
  onPick: (pinId: string | null) => void;
  onBounds: (box: MapBounds) => void;
  onSearch: (box: MapBounds) => void;
  searchKey: string;
  copy: Copy;
}) {
  const status = useApiLoadingStatus();
  const map = useMap(MAP_ID);
  const [searchAsMove, setSearchAsMove] = useState(true);
  const [moved, setMoved] = useState<MapBounds | null>(null);
  const [locating, setLocating] = useState(false);
  // Set by the person's own touch, wheel or keys on the map (and by the zoom and locate buttons). A camera move the
  // page makes (fitting a place or the rooms) leaves it off, so it never starts a search by itself.
  const intent = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fitted = useRef(false);
  const near = criteria.nearGps;

  // Fit the camera when the search's place changes: a station or place circle, else the rooms. A map area is where
  // the person put the map already, so it is fitted only when the page opens on one (a shared link).
  const fitKey = criteria.nearMap ? 'map' : near ? `near:${near.latitude},${near.longitude},${near.radiusKm}` : `rooms:${searchKey}`;
  useEffect(() => {
    if (!map) return;
    if (fitKey === 'map' && fitted.current) return;
    fitted.current = true;
    intent.current = false;
    fitTo(map, near ? boundsOfCircle(near) : boundsOfPins(pins));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return <MapUnavailable copy={copy} onCards={() => undefined} />;
  }
  if (status !== APILoadingStatus.LOADED) {
    return (
      <p role="status" className="nk-map-empty">
        {copy.states.loading}
      </p>
    );
  }

  const userMove = () => {
    intent.current = true;
    if (timer.current) clearTimeout(timer.current);
  };
  const idle = (event: MapEvent) => {
    const literal = event.map.getBounds()?.toJSON();
    if (!literal) return;
    const box = toBox(literal);
    onBounds(box);
    if (!intent.current) return;
    intent.current = false;
    if (!searchAsMove) {
      setMoved(box);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      onSearch(box);
    }, SEARCH_AS_MOVE_DELAY_MS);
  };
  const zoomBy = (step: number) => {
    if (!map) return;
    userMove();
    map.setZoom((map.getZoom() ?? BANGKOK_ZOOM) + step);
  };
  const locate = () => {
    if (!map || typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        userMove();
        map.setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
        map.setZoom(PLACE_ZOOM);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
  const center = near ? { lat: near.latitude, lng: near.longitude } : BANGKOK;

  return (
    <>
      <div
        className="nk-map-canvas"
        onPointerDownCapture={userMove}
        onWheelCapture={userMove}
        onKeyDownCapture={userMove}
        data-testid="searchMap.map"
      >
        <GoogleMap
          id={MAP_ID}
          mapId={mapId}
          defaultCenter={center}
          defaultZoom={near ? PLACE_ZOOM : BANGKOK_ZOOM}
          gestureHandling="greedy"
          disableDefaultUI
          clickableIcons={false}
          style={{ width: '100%', height: '100%' }}
          onIdle={idle}
          onClick={() => onPick(null)}
        >
          {near && !criteria.nearMap ? (
            <>
              <Circle
                center={{ lat: near.latitude, lng: near.longitude }}
                radius={near.radiusKm * 1000}
                {...MAP_CIRCLE_STYLE}
                clickable={false}
              />
              <AdvancedMarker position={{ lat: near.latitude, lng: near.longitude }} zIndex={1} title={criteria.placeName ?? copy.location.nearMe}>
                <span className="nk-map-place" aria-hidden="true">
                  {criteria.placeName ? <PlaceIcon name={criteria.placeName} /> : <LocateIcon size={16} />}
                </span>
              </AdvancedMarker>
            </>
          ) : null}
          {pins.map((pin) => {
            const isSelected = pin.id === selected;
            const title = pin.count > 1 ? `${pin.label} · ${fillTemplate(copy.map.pinRooms, { count: pin.count })}` : pin.label;
            return (
              <AdvancedMarker
                key={pin.id}
                position={{ lat: pin.latitude, lng: pin.longitude }}
                zIndex={isSelected ? 1000 : pin.id === hovered ? 999 : 10}
                title={title}
                onClick={() => {
                  intent.current = false;
                  onPick(isSelected ? null : pin.id);
                }}
              >
                <span className={`nk-map-pin${isSelected ? ' is-selected' : ''}${pin.id === hovered ? ' is-hover' : ''}`} data-testid="searchMap.pin">
                  <span className="nk-map-pin__label">
                    {pin.label}
                    {pin.count > 1 ? <span className="nk-map-pin__count">{pin.count}</span> : null}
                  </span>
                  <span className="nk-map-pin__tip" aria-hidden="true" />
                </span>
              </AdvancedMarker>
            );
          })}
        </GoogleMap>
      </div>

      <div className="nk-map-tools">
        <label className="nk-map-toggle">
          <input type="checkbox" checked={searchAsMove} onChange={(event) => setSearchAsMove(event.target.checked)} data-testid="searchMap.searchAsMove" />
          {copy.map.searchAsMove}
        </label>
        {!searchAsMove && moved ? (
          <button
            type="button"
            className="nk-map-search-here"
            onClick={() => {
              onSearch(moved);
              setMoved(null);
            }}
            data-testid="searchMap.searchHere"
          >
            <RefreshIcon size={16} />
            {copy.map.searchHere}
          </button>
        ) : null}
      </div>
      <div className="nk-map-controls">
        <button type="button" className="nk-map-fab" aria-label={copy.map.myLocation} aria-busy={locating || undefined} onClick={locate} data-testid="searchMap.locate">
          <LocateIcon size={20} />
        </button>
        <div className="nk-map-zoom">
          <button type="button" className="nk-map-fab" aria-label={copy.map.zoomIn} onClick={() => zoomBy(1)} data-testid="searchMap.zoomIn">
            <PlusIcon size={18} />
          </button>
          <button type="button" className="nk-map-fab" aria-label={copy.map.zoomOut} onClick={() => zoomBy(-1)} data-testid="searchMap.zoomOut">
            <MinusIcon size={18} />
          </button>
        </div>
      </div>
    </>
  );
}

/** Train for a station of our list ("BTS อโศก"), a pin for any other place. */
function PlaceIcon({ name }: { name: string }) {
  return /^(BTS|MRT|ARL|SRT)\s/.test(name) ? <TrainIcon size={16} /> : <PinIcon size={16} />;
}

function MapPeek({ pin, rooms, copy, locale, onClose }: { pin: RoomPin; rooms: PublicRoomCard[]; copy: Copy; locale: string; onClose: () => void }) {
  return (
    <div className="nk-map-peek" data-testid="searchMap.peek">
      <div className="nk-map-peek__head">
        {rooms.length > 1 ? <p className="nk-map-peek__title">{fillTemplate(copy.map.roomsHere, { count: pin.count })}</p> : null}
        <button type="button" className="nk-map-peek__close" aria-label={copy.map.close} onClick={onClose} data-testid="searchMap.peekClose">
          <CloseIcon size={18} />
        </button>
      </div>
      <ul className="nk-map-peek__rooms">
        {rooms.map((card) => (
          <PeekRoom key={card.id} card={card} copy={copy} locale={locale} />
        ))}
      </ul>
    </div>
  );
}

function PeekRoom({ card, copy, locale }: { card: PublicRoomCard; copy: Copy; locale: string }) {
  const specs = buildPublicRoomSpecs(card, copy.spec);
  const title = roomDisplayTitle(
    card,
    { titleFallback: copy.card.titleFallback, roomFallback: copy.card.roomFallback, propertyType: copy.propertyType },
    specs[0] ?? null,
  );
  const price = formatPublicPrice(card.priceFrom);
  const href = isGuestPageReady('rooms') ? localePath(locale, `/rooms/${encodeURIComponent(card.id)}`) : null;
  return (
    <li className="nk-map-peek__room">
      <div className="nk-map-peek__row">
        <span className="nk-map-peek__photo">
          {card.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.coverImageUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <PhotoIcon size={24} />
          )}
        </span>
        <span className="nk-map-peek__text">
          {price ? (
            <span className="nk-map-peek__price">
              <strong>{price}</strong> {copy.card.perMonthLong}
            </span>
          ) : null}
          <span className="nk-map-peek__name">{title}</span>
          {specs.length ? <span className="nk-map-peek__specs">{specs.join(' · ')}</span> : null}
        </span>
      </div>
      {href ? (
        <a href={href} className="nk-btn nk-btn--primary nk-map-peek__link" data-testid="searchMap.peekLink">
          {copy.map.viewDetails}
        </a>
      ) : null}
    </li>
  );
}
