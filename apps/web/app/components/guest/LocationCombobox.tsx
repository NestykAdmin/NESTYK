'use client';

import React, { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as Ariakit from '@ariakit/react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import {
  matchRailStations,
  RAIL_LINES,
  railInterchanges,
  railLinePalette,
  railStationName,
  type RailHit,
  type RailLine,
  type RailStation,
} from '@nestyk/feature-search';
import {
  locationAreas,
  locationSuggestions,
  NEAR_ME_RADIUS_KM,
  STATION_RADIUS_KM,
  type LocationArea,
  type LocationChoice,
} from '../../../lib/guest-location';
import { PLACE_INPUT_MIN, placeSessionToken, type PlaceLocation, type PlaceSuggestion } from '../../../lib/guest-places';
import { ChevronRightIcon, CloseIcon, LocateIcon, MapIcon, PinIcon, SearchIcon, TrainIcon } from './GuestIcons';
import '../../[locale]/guest-location.css';

type Status = 'idle' | 'locating' | 'denied' | 'unavailable';
type View = 'list' | 'lines';

/** Wait for a pause in typing before asking Google (location search). */
const PLACE_DEBOUNCE_MS = 300;
/** Phones and tablets get the full-screen search (design LocPhoneType); the same width as guest.css. */
const PHONE_QUERY = '(max-width: 960px)';

function newSession(): string | null {
  // Not crypto.randomUUID alone: the app's WebView on the dev network is not a secure page (placeSessionToken).
  return placeSessionToken(typeof crypto === 'undefined' ? undefined : crypto);
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<{ status: number; data: T | null }> {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  return { status: response.status, data: response.ok ? ((await response.json()) as T) : null };
}

function usePhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia(PHONE_QUERY);
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return phone;
}

interface Props {
  inputId: string;
  /** Text in the box. */
  value: string;
  onValueChange: (text: string) => void;
  /** An area, a station, a place, "near me" (after the browser gave the position) or the typed text as a keyword. */
  onPick: (choice: LocationChoice) => void;
  placeholder: string;
  inputClassName: string;
  name?: string;
  testId?: string;
}

/** What /find can ask of its place box (canvas "findsummary"): stop typing, so the page shows its filters again. */
export interface LocationPageHandle {
  stopTyping: () => void;
}

interface PageOnly {
  idle?: React.ReactNode;
  /** True while the suggestions cover the page's own parts (the guest is typing). */
  onSuggestingChange?: (on: boolean) => void;
  handle?: React.Ref<LocationPageHandle>;
}

/**
 * Location box (Mos 20 Nov 2026, canvas page "ช่องค้นหารวม"): "near my location" and "choose from rail lines" first,
 * then stations from our list, areas, Google places (through /place-search, when this deploy has a Places key) and the
 * text as a keyword. Built on Ariakit's combobox (keyboard, screen readers, and a popover that flips or shrinks at the
 * edge of the screen). Phones open a full-screen search instead of a popover.
 */
export function LocationCombobox(props: Props) {
  const phone = usePhone();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Closing the sheet hands focus back to the box (Ariakit), and focus opens the sheet: that focus must not reopen it
  // (the back arrow did nothing, Mos 24 Nov 2026). A later focus (Tab, a tap) opens it as before.
  const closing = useRef(false);
  const closeSheet = () => {
    closing.current = true;
    setSheetOpen(false);
  };
  const { t } = useLocale();

  if (!phone) return <LocationBox {...props} mode="popover" />;
  return (
    <>
      <input
        id={props.inputId}
        name={props.name}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        readOnly
        value={props.value}
        placeholder={props.placeholder}
        className={props.inputClassName}
        onClick={() => {
          closing.current = false;
          setSheetOpen(true);
        }}
        onFocus={() => {
          if (closing.current) {
            closing.current = false;
            return;
          }
          setSheetOpen(true);
        }}
        aria-haspopup="dialog"
        data-testid={props.testId}
      />
      <Ariakit.Dialog
        open={sheetOpen}
        onClose={closeSheet}
        className="nk-loc-sheet"
        aria-label={t.guest.location.listLabel}
        unmountOnHide
      >
        <LocationBox
          {...props}
          inputClassName="nk-input"
          inputId={`${props.inputId}-sheet`}
          testId={props.testId ? `${props.testId}.sheet` : undefined}
          mode="sheet"
          onClose={closeSheet}
          onPick={(choice) => {
            closeSheet();
            props.onPick(choice);
          }}
        />
      </Ariakit.Dialog>
    </>
  );
}

function LocationBox({
  inputId,
  value,
  onValueChange,
  onPick,
  placeholder,
  inputClassName,
  name,
  testId,
  mode,
  onClose,
  idle,
  onSuggestingChange,
  handle,
}: Props & PageOnly & { mode: 'popover' | 'sheet' | 'page'; onClose?: () => void }) {
  const { t, locale } = useLocale();
  const copy = t.guest;
  const lineNames = copy.transitLines as Record<string, string>;
  const headingId = useId();
  const [open, setOpen] = useState(mode !== 'popover');
  // Page mode (/find): the suggestions show while the guest types; after a pick the page shows its own parts again.
  const [typing, setTyping] = useState(false);
  const [view, setView] = useState<View>('list');
  const [line, setLine] = useState<RailLine>(RAIL_LINES[0]);
  const [status, setStatus] = useState<Status>('idle');
  const [places, setPlaces] = useState<PlaceSuggestion[]>([]);
  const [placeBusy, setPlaceBusy] = useState<string | null>(null);
  const [placeFailed, setPlaceFailed] = useState<string | null>(null);
  // Off for the rest of the page once the site answers that it has no Places key (503).
  const placesOn = useRef(true);
  const session = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const areas = useMemo<LocationArea[]>(
    () => locationAreas(copy.areaNames as Record<string, string>, copy.areaInfo as Record<string, { places?: string }>),
    [copy],
  );
  const base = useMemo(() => locationSuggestions(value, areas), [value, areas]);
  const areaItems = base.filter((item): item is Extract<typeof item, { kind: 'area' }> => item.kind === 'area');
  const keyword = base.find((item): item is Extract<typeof item, { kind: 'keyword' }> => item.kind === 'keyword');
  const stations = useMemo(() => matchRailStations(value), [value]);
  const isOpen = mode !== 'popover' || open;
  const suggesting = mode !== 'page' || (typing && value.trim() !== '');

  useEffect(() => {
    onSuggestingChange?.(mode === 'page' && suggesting && view === 'list');
  }, [mode, suggesting, view, onSuggestingChange]);
  useImperativeHandle(handle, () => ({
    stopTyping: () => {
      setTyping(false);
      setView('list');
      inputRef.current?.blur();
    },
  }));

  useEffect(() => {
    const input = value.trim();
    // Page mode: Google is asked only while the guest types (review R1: a picked name in the box is not a question).
    if (!isOpen || !suggesting || view !== 'list' || !placesOn.current || input.length < PLACE_INPUT_MIN) {
      setPlaces([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      session.current ??= newSession();
      if (!session.current) return;
      try {
        const { status: code, data } = await postJson<{ places: PlaceSuggestion[] }>(
          '/place-search/autocomplete',
          { input, session: session.current, lang: locale },
          controller.signal,
        );
        if (code === 503) placesOn.current = false;
        setPlaces(data?.places ?? []);
      } catch {
        if (!controller.signal.aborted) setPlaces([]);
      }
    }, PLACE_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, isOpen, suggesting, view, locale]);

  const close = () => {
    setOpen(false);
    setView('list');
    onClose?.();
  };
  const finish = (choice: LocationChoice) => {
    setOpen(false);
    setView('list');
    setTyping(false);
    onPick(choice);
  };
  const locate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStatus('idle');
        finish({ kind: 'nearMe', latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      (error) => setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };
  const pickStation = (hitLine: RailLine, station: RailStation) =>
    finish({ kind: 'place', name: railStationName(hitLine, station, locale), latitude: station.latitude, longitude: station.longitude, station: true });
  const pickPlace = async (place: PlaceSuggestion) => {
    if (!session.current || placeBusy) return;
    setPlaceBusy(place.id);
    setPlaceFailed(null);
    try {
      const { data } = await postJson<PlaceLocation>('/place-search/details', { id: place.id, session: session.current });
      if (!data) throw new Error('no position');
      // The details call ends Google's session; the next search starts a new one.
      session.current = null;
      finish({ kind: 'place', name: place.name, latitude: data.latitude, longitude: data.longitude, station: data.station || place.station });
    } catch {
      setPlaceFailed(place.id);
    } finally {
      setPlaceBusy(null);
    }
  };

  const stationName = (station: RailStation) => (locale === 'th' ? station.th : station.en);
  const interchangeText = (hit: RailHit) => {
    const other = railInterchanges(hit.line, hit.station)[0];
    if (!other) return '';
    // Siam, Bang Wa and the like keep one name on both lines: name the other line instead ("ต่อ BTS สายสีลม").
    const sameName = other.station.th === hit.station.th || other.station.en === hit.station.en;
    const target = sameName ? (lineNames[other.line.code] ?? other.line.code) : railStationName(other.line, other.station, locale);
    return fillTemplate(copy.location.interchange, { station: target });
  };
  const nearMeText = () => {
    if (status === 'locating') return copy.location.locating;
    if (status === 'denied') return copy.location.denied;
    if (status === 'unavailable') return copy.location.unavailable;
    return fillTemplate(copy.location.nearMeHint, { km: NEAR_ME_RADIUS_KM });
  };
  const badge = (code: RailLine['code'], text: string) => {
    const palette = railLinePalette(code);
    return (
      <span className="nk-loc__code" style={{ background: palette.color, color: palette.ink }}>
        {text}
      </span>
    );
  };

  // "Near me" and "choose from rail lines": first in the list, and alone on /find before the guest types.
  const quickItems = (
    <>
      <Ariakit.ComboboxItem className="nk-loc__option" hideOnClick={false} setValueOnClick={false} onClick={locate} data-testid="location.nearMe">
        <span className="nk-loc__icon nk-loc__icon--ink" aria-hidden="true">
          <LocateIcon size={18} />
        </span>
        <span className="nk-loc__text">
          <span className="nk-loc__title">{copy.location.nearMe}</span>
          <span className={`nk-loc__sub${status === 'denied' || status === 'unavailable' ? ' is-error' : ''}`} role={status === 'idle' ? undefined : 'status'}>
            {nearMeText()}
          </span>
        </span>
      </Ariakit.ComboboxItem>
      {RAIL_LINES.length ? (
        <Ariakit.ComboboxItem className="nk-loc__option" hideOnClick={false} setValueOnClick={false} onClick={() => setView('lines')} data-testid="location.browseLines">
          <span className="nk-loc__icon nk-loc__icon--ink" aria-hidden="true">
            <TrainIcon size={18} />
          </span>
          <span className="nk-loc__text">
            <span className="nk-loc__title">{copy.location.browseLines}</span>
            <span className="nk-loc__sub">
              {fillTemplate(copy.location.browseLinesHint, { lines: RAIL_LINES.length, stations: RAIL_LINES.reduce((sum, item) => sum + item.stations.length, 0) })}
            </span>
          </span>
          <ChevronRightIcon size={18} className="nk-loc__chevron" />
        </Ariakit.ComboboxItem>
      ) : null}

    </>
  );

  const listView = (
    <>
      {mode === 'page' ? null : quickItems}
      {stations.length ? (
        <Ariakit.ComboboxGroup className="nk-loc__group">
          <Ariakit.ComboboxGroupLabel className="nk-loc__heading">{copy.location.stationsHeading}</Ariakit.ComboboxGroupLabel>
          {stations.map((hit) => {
            const palette = railLinePalette(hit.line.code);
            const change = interchangeText(hit);
            return (
              <Ariakit.ComboboxItem
                key={`${hit.line.code}-${hit.station.code}`}
                className="nk-loc__option"
                setValueOnClick={false}
                onClick={() => pickStation(hit.line, hit.station)}
                data-testid={`location.station.${hit.station.code}`}
              >
                <span className="nk-loc__icon" style={{ background: palette.tint, color: palette.deep }} aria-hidden="true">
                  <TrainIcon size={18} />
                </span>
                <span className="nk-loc__text">
                  <span className="nk-loc__title">{railStationName(hit.line, hit.station, locale)}</span>
                  <span className="nk-loc__sub nk-loc__sub--row">
                    {badge(hit.line.code, hit.station.code)}
                    <span>{[lineNames[hit.line.code] ?? hit.line.code, change].filter(Boolean).join(' · ')}</span>
                  </span>
                </span>
              </Ariakit.ComboboxItem>
            );
          })}
        </Ariakit.ComboboxGroup>
      ) : null}

      {areaItems.length ? (
        <Ariakit.ComboboxGroup className="nk-loc__group">
          <Ariakit.ComboboxGroupLabel className="nk-loc__heading">{copy.location.areasHeading}</Ariakit.ComboboxGroupLabel>
          {areaItems.map((area) => (
            <Ariakit.ComboboxItem
              key={area.slug}
              className="nk-loc__option"
              setValueOnClick={false}
              onClick={() => finish({ kind: 'area', slug: area.slug })}
              data-testid={`location.area.${area.slug}`}
            >
              <span className="nk-loc__icon nk-loc__icon--area" aria-hidden="true">
                <MapIcon size={18} />
              </span>
              <span className="nk-loc__text">
                <span className="nk-loc__title">{area.name}</span>
                {area.places ? <span className="nk-loc__sub">{area.places}</span> : null}
              </span>
            </Ariakit.ComboboxItem>
          ))}
        </Ariakit.ComboboxGroup>
      ) : null}

      {places.length ? (
        <Ariakit.ComboboxGroup className="nk-loc__group">
          <Ariakit.ComboboxGroupLabel className="nk-loc__heading">{copy.location.placesHeading}</Ariakit.ComboboxGroupLabel>
          {places.map((place) => (
            <Ariakit.ComboboxItem
              key={place.id}
              className="nk-loc__option"
              hideOnClick={false}
              setValueOnClick={false}
              aria-busy={placeBusy === place.id || undefined}
              onClick={() => void pickPlace(place)}
              data-testid="location.place"
            >
              <span className="nk-loc__icon nk-loc__icon--place" aria-hidden="true">
                {place.station ? <TrainIcon size={18} /> : <PinIcon size={18} />}
              </span>
              <span className="nk-loc__text">
                <span className="nk-loc__title">{place.name}</span>
                {placeFailed === place.id ? (
                  <span className="nk-loc__sub is-error" role="status">
                    {copy.location.placeFailed}
                  </span>
                ) : place.secondary ? (
                  <span className="nk-loc__sub nk-loc__sub--clip">{place.secondary}</span>
                ) : null}
              </span>
            </Ariakit.ComboboxItem>
          ))}
          {/* Google asks for this credit wherever Places results show without a Google map. */}
          <div className="nk-loc__credit" aria-hidden="true">
            Google Maps
          </div>
        </Ariakit.ComboboxGroup>
      ) : null}

      {keyword ? (
        <Ariakit.ComboboxItem className="nk-loc__option" setValueOnClick={false} onClick={() => finish({ kind: 'keyword', text: keyword.text })} data-testid="location.keyword">
          <span className="nk-loc__icon" aria-hidden="true">
            <SearchIcon size={18} />
          </span>
          <span className="nk-loc__text">
            <span className="nk-loc__title">{fillTemplate(copy.location.searchFor, { text: keyword.text })}</span>
            <span className="nk-loc__sub">{copy.location.searchForHint}</span>
          </span>
        </Ariakit.ComboboxItem>
      ) : null}
    </>
  );

  const linesView = (
    <div className="nk-loc-lines" data-testid="location.lines">
      <div className="nk-loc-lines__head">
        <Ariakit.ComboboxItem className="nk-loc-lines__back" hideOnClick={false} setValueOnClick={false} onClick={() => setView('list')}>
          <ChevronRightIcon size={16} className="nk-loc-lines__back-icon" />
          {copy.location.back}
        </Ariakit.ComboboxItem>
        <p id={headingId} className="nk-loc-lines__title">
          {copy.location.browseLines}
        </p>
        <span className="nk-loc-lines__hint">{fillTemplate(copy.transit.hint, { km: STATION_RADIUS_KM })}</span>
      </div>
      <div className="nk-loc-lines__body" aria-labelledby={headingId}>
        <Ariakit.ComboboxGroup className="nk-loc-lines__lines" aria-label={copy.transit.linesLabel}>
          {RAIL_LINES.map((item) => (
            <Ariakit.ComboboxItem
              key={item.code}
              className={`nk-loc-lines__line${item.code === line.code ? ' is-on' : ''}`}
              hideOnClick={false}
              setValueOnClick={false}
              aria-pressed={item.code === line.code}
              onClick={() => setLine(item)}
              data-testid={`location.line.${item.code}`}
            >
              <span className="nk-loc-lines__dot" style={{ background: railLinePalette(item.code).color }} aria-hidden="true" />
              {lineNames[item.code] ?? item.code}
            </Ariakit.ComboboxItem>
          ))}
        </Ariakit.ComboboxGroup>
        <Ariakit.ComboboxGroup className="nk-loc-lines__stations" aria-label={`${copy.transit.stationsLabel} · ${lineNames[line.code] ?? line.code}`}>
          {line.stations.map((station) => (
            <Ariakit.ComboboxItem
              key={station.code}
              className="nk-loc-lines__station"
              setValueOnClick={false}
              onClick={() => pickStation(line, station)}
              data-testid={`location.lineStation.${station.code}`}
            >
              {badge(line.code, station.code)}
              <span>{stationName(station)}</span>
            </Ariakit.ComboboxItem>
          ))}
        </Ariakit.ComboboxGroup>
      </div>
    </div>
  );

  const input = (
    <Ariakit.Combobox
      ref={inputRef}
      id={inputId}
      name={name}
      type="text"
      inputMode="search"
      enterKeyHint="search"
      autoComplete="off"
      autoSelect={false}
      placeholder={placeholder}
      className={inputClassName}
      autoFocus={mode === 'sheet'}
      onFocus={() => {
        if (mode === 'page' && value.trim()) setTyping(true);
      }}
      onKeyDown={(event) => {
        // Page mode: Escape hides the suggestions and brings back the recent searches and filters (review R3).
        if (mode === 'page' && event.key === 'Escape') setTyping(false);
      }}
      data-testid={testId}
    />
  );

  return (
    <Ariakit.ComboboxProvider
      value={value}
      setValue={(next) => {
        setTyping(true);
        onValueChange(next);
        setView('list');
        setStatus('idle');
      }}
      open={isOpen}
      setOpen={(next) => {
        if (mode !== 'popover') return;
        setOpen(next);
        if (!next) setView('list');
      }}
      resetValueOnHide={false}
    >
      {mode === 'page' ? (
        <div className="nk-find__loc">
          <div className="nk-loc-sheet__field nk-find__field">
            <SearchIcon size={18} className="nk-find__field-icon" />
            {input}
            {value ? (
              <button type="button" className="nk-loc-sheet__clear" aria-label={copy.location.clear} onClick={() => onValueChange('')}>
                <CloseIcon size={16} />
              </button>
            ) : null}
          </div>
          <Ariakit.ComboboxList className="nk-find__list" aria-label={copy.location.listLabel}>
            {view === 'lines' ? linesView : suggesting ? listView : quickItems}
          </Ariakit.ComboboxList>
          {view === 'list' && !suggesting ? idle : null}
        </div>
      ) : mode === 'sheet' ? (
        <div className="nk-loc-sheet__inner">
          <div className="nk-loc-sheet__bar">
            <button type="button" className="nk-loc-sheet__close" aria-label={copy.transit.close} onClick={close}>
              <ChevronRightIcon size={22} className="nk-loc-lines__back-icon" />
            </button>
            <div className="nk-loc-sheet__field">
              {input}
              {value ? (
                <button type="button" className="nk-loc-sheet__clear" aria-label={copy.location.clear} onClick={() => onValueChange('')}>
                  <CloseIcon size={16} />
                </button>
              ) : null}
            </div>
          </div>
          <Ariakit.ComboboxList className="nk-loc-sheet__list" aria-label={copy.location.listLabel}>
            {view === 'lines' ? linesView : listView}
          </Ariakit.ComboboxList>
        </div>
      ) : (
        <>
          {input}
          <Ariakit.ComboboxPopover
            className="nk-loc__list"
            aria-label={copy.location.listLabel}
            gutter={4}
            fitViewport
            unmountOnHide
            data-view={view}
          >
            {view === 'lines' ? linesView : listView}
          </Ariakit.ComboboxPopover>
        </>
      )}
    </Ariakit.ComboboxProvider>
  );
}

/**
 * The place box of the mobile search page /find (Mos 25 Nov 2026, canvas "searchnew"): "near me" and the rail lines
 * under it; while the guest types, the suggestions take the place of `idle` (recent searches and the filters).
 * A pick fills the box and brings `idle` back; the page searches when the guest presses "ดูห้อง".
 */
export const LocationPageBox = forwardRef<LocationPageHandle, Props & Omit<PageOnly, 'handle'> & { idle: React.ReactNode }>(
  function LocationPageBox(props, ref) {
    return <LocationBox {...props} handle={ref} mode="page" />;
  },
);
