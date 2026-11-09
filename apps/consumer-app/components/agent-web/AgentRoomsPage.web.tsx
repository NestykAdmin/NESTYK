import React, { useEffect, useMemo, useRef, useState } from "react";
import { MobileIcon, useMobileTheme, type AppIconName } from "@nestyk/ui/native";
import { localizedError, useLocale } from "@nestyk/i18n";
import { formatBedroomDisplay } from "@nestyk/feature-listing";
import { fetchMyAgentListings, type AgentListingCard } from "../../lib/agent-listings-api";
import {
  BEDROOM_FILTERS,
  EMPTY_ROOM_FILTERS,
  ROOM_STATUS_FILTERS,
  ROOM_TYPE_BEDROOMS,
  activeFilterCount,
  fromApiSort,
  listPrice,
  pageButtons,
  pageRange,
  roomStatusText,
  toApiSort,
  withBedrooms,
  withRoomType,
  type RoomFilters,
  type RoomsApiSort,
  type RoomsTableSort,
} from "../../lib/agent-room-filters";
import { parsePriceInput, validPriceRange } from "../room-price-range";
import { AgentRoomDetailModal } from "../AgentRoomDetailModal";
import { AgentSelect } from "./AgentSelect";
import {
  StatusBadge,
  WebDialog,
  WebSkeleton,
  WebState,
  WebTable,
  roomStatusIntent,
  type WebSort,
  type WebTableColumn,
} from "./ui";
import type { AgentRoomsPageProps } from "./AgentRoomsPage.types";
import "./agent-rooms.css";
import { cookieConsentAllows } from "@nestyk/ui/cookie-consent";

/** 24 = 6 rows of the 4-column card grid at 1440. */
const PAGE_SIZE = 24;
const VIEW_KEY = "nestyk.agentRooms.view";
type RoomsView = "table" | "grid";

function readView(): RoomsView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "table";
  } catch {
    return "table";
  }
}

function Thumb({ url, size }: { url: string | null; size: "row" | "card" }) {
  const { theme } = useMobileTheme();
  const [failed, setFailed] = useState(false);
  return (
    <span className={`awr-thumb awr-thumb-${size}`} aria-hidden="true">
      {url && !failed ? (
        <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <MobileIcon name="buildings" size={size === "card" ? 32 : 20} color={theme.textSecondary} />
      )}
    </span>
  );
}

/**
 * Agent web Room Listings (plan step 4, design W1): a real table or a 4-column card grid instead of the
 * phone list. Same API, filters and sorts as the app screen; the phone screen is untouched.
 */
export function AgentRoomsPage({ reloadToken, onReloadSettled, onAddRoom }: AgentRoomsPageProps) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.listings;
  const web = copy.web;
  const cr = t.agent.createRoom;
  const localeTag = locale === "th" ? "th-TH" : locale;

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<RoomFilters>(EMPTY_ROOM_FILTERS);
  const [draft, setDraft] = useState<RoomFilters>(EMPTY_ROOM_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [apiSort, setApiSort] = useState<RoomsApiSort>("updated_desc");
  const [view, setView] = useState<RoomsView>(readView);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AgentListingCard[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const loadedOnce = useRef(false);

  // Search waits for a short pause in typing, then starts again from page 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    if (loadedOnce.current) setBusy(true);
    else setStatus("loading");
    fetchMyAgentListings({
      page,
      limit: PAGE_SIZE,
      q: search,
      visibility: filters.visibility || undefined,
      roomStatus: filters.roomStatus || undefined,
      listingSource: filters.listingSource || undefined,
      propertyType: filters.propertyType || undefined,
      roomType: filters.roomType || undefined,
      bedrooms: filters.bedrooms || undefined,
      minPrice: filters.minPrice || undefined,
      maxPrice: filters.maxPrice || undefined,
      sort: apiSort,
    })
      .then((result) => {
        if (cancelled) return;
        // A page that emptied meanwhile (rooms removed): go back to the last page that has rows.
        if (!result.items.length && result.total > 0 && page > 1) {
          setPage(Math.max(1, Math.ceil(result.total / PAGE_SIZE)));
          return;
        }
        loadedOnce.current = true;
        setItems(result.items);
        setTotal(result.total);
        setErrorText(null);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorText(localizedError(err, copy.loadError, locale));
        setStatus("error");
      })
      .finally(() => {
        if (cancelled) return;
        setBusy(false);
        if (reloadToken) onReloadSettled?.(reloadToken);
      });
    return () => {
      cancelled = true;
    };
    // copy / locale only change the error text; they must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filters, apiSort, page, refresh, reloadToken]);

  const changeView = (next: RoomsView) => {
    setView(next);
    // PDPA cookie consent: remembered only when "Remember my settings" is allowed.
    if (!cookieConsentAllows('preferences')) return;
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* private mode: the choice lasts for this visit only */
    }
  };

  const goToPage = (next: number) => {
    setPage(next);
    rootRef.current?.closest(".aw-page-scroll")?.scrollTo({ top: 0 });
  };

  const applyFilters = (next: RoomFilters) => {
    setFilters(next);
    setPage(1);
  };
  const clearAll = () => {
    setQuery("");
    setSearch("");
    applyFilters(EMPTY_ROOM_FILTERS);
  };

  const filtered = !!search || activeFilterCount(filters) > 0;
  const draftValid = validPriceRange(draft);
  const range = pageRange(page, PAGE_SIZE, total);

  const money = (amount: number) => copy.rentAmount.replace("{price}", amount.toLocaleString(localeTag));
  const day = (iso: string | null | undefined) => {
    const date = iso ? new Date(iso) : null;
    return date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat(localeTag, { day: "numeric", month: "short", year: "numeric" }).format(date)
      : "—";
  };
  const bedsText = (value: string) =>
    value === "0"
      ? t.masters.roomTypes.studio
      : value === "4"
        ? copy.specBeds.replace("{count}", "4+")
        : value === "1"
          ? copy.specBed.replace("{count}", "1")
          : copy.specBeds.replace("{count}", value);
  const typeText = (room: AgentListingCard) => {
    const named = room.roomTypeCode
      ? t.masters.roomTypes[room.roomTypeCode as keyof typeof t.masters.roomTypes]
      : undefined;
    if (named) return named;
    const beds = formatBedroomDisplay(room.bedroomCount, t.masters.roomTypes.studio);
    if (!beds) return null;
    return beds === t.masters.roomTypes.studio ? beds : bedsText(Number(beds) >= 4 ? "4" : beds);
  };
  const sizeText = (room: AgentListingCard) =>
    [
      room.roomSizeSqm?.trim() ? copy.specSqm.replace("{size}", room.roomSizeSqm.trim()) : null,
      room.floor?.trim() ? copy.specFloor.replace("{floor}", room.floor.trim()) : null,
    ]
      .filter(Boolean)
      .join(" · ") || null;
  const titleOf = (room: AgentListingCard) => room.listingTitle || room.property?.name || `#${room.id}`;
  const placeOf = (room: AgentListingCard) =>
    [room.listingTitle ? room.property?.name : null, room.property?.district || room.property?.province]
      .filter(Boolean)
      .join(" · ");
  const visibilityText = (room: AgentListingCard) =>
    room.visibility === "published" ? cr.visibilityPublished : room.visibility === "private" ? cr.visibilityPrivate : null;
  const statusBadge = (room: AgentListingCard) => (
    <StatusBadge
      label={roomStatusText(copy, room.roomStatusCode, room.vacantFrom, locale)}
      intent={roomStatusIntent(room.roomStatusCode)}
    />
  );

  const columns: WebTableColumn<AgentListingCard>[] = [
    { key: "photo", header: "", width: "72px", hideBelow: "md", cell: (room) => <Thumb url={room.coverMediaUrl} size="row" /> },
    {
      key: "room",
      header: web.colRoom,
      cell: (room) => (
        <span className="awr-room">
          <strong>{titleOf(room)}</strong>
          {placeOf(room) ? <small>{placeOf(room)}</small> : null}
        </span>
      ),
    },
    { key: "size", header: web.colSize, hideBelow: "lg", cell: (room) => <span className="awr-nowrap">{sizeText(room) ?? "—"}</span> },
    { key: "type", header: web.colType, hideBelow: "lg", cell: (room) => <span className="awr-nowrap">{typeText(room) ?? "—"}</span> },
    {
      key: "price",
      header: web.colPrice,
      sortable: true,
      align: "end",
      cell: (room) => {
        const price = listPrice(room.prices);
        return price != null ? <span className="awr-price">{money(price)}</span> : <span className="awr-none">—</span>;
      },
    },
    { key: "status", header: web.colStatus, cell: statusBadge },
    {
      key: "visibility",
      header: copy.filterVisibility,
      hideBelow: "md",
      cell: (room) => <span className="awr-muted">{visibilityText(room) ?? "—"}</span>,
    },
    { key: "updated", header: web.colUpdated, sortable: true, hideBelow: "md", cell: (room) => <span className="awr-muted">{day(room.updatedAt)}</span> },
  ];

  const sortOptions: Array<{ value: RoomsApiSort; label: string }> = [
    { value: "updated_desc", label: copy.sortUpdatedDesc },
    { value: "updated_asc", label: copy.sortUpdatedAsc },
    { value: "price_asc", label: copy.sortPriceAsc },
    { value: "price_desc", label: copy.sortPriceDesc },
  ];

  // Active filters shown as removable chips (the status has its own select in the toolbar).
  const chips: Array<{ key: string; label: string; next: RoomFilters }> = [];
  if (filters.propertyType)
    chips.push({
      key: "propertyType",
      label: t.masters.propertyTypes[filters.propertyType as keyof typeof t.masters.propertyTypes] || filters.propertyType,
      next: { ...filters, propertyType: "" },
    });
  // A room type with a fixed bedroom count already says it ("2 ห้องนอน"): one chip, and removing it clears both.
  const bedsFromType = !!filters.roomType && ROOM_TYPE_BEDROOMS[filters.roomType] === filters.bedrooms;
  if (filters.roomType)
    chips.push({
      key: "roomType",
      label: t.masters.roomTypes[filters.roomType as keyof typeof t.masters.roomTypes] || filters.roomType,
      next: { ...filters, roomType: "", bedrooms: bedsFromType ? "" : filters.bedrooms },
    });
  if (filters.bedrooms && !bedsFromType) chips.push({ key: "bedrooms", label: bedsText(filters.bedrooms), next: { ...filters, bedrooms: "" } });
  if (filters.minPrice || filters.maxPrice)
    chips.push({
      key: "price",
      label: `${filters.minPrice ? money(Number(filters.minPrice)) : "0"} – ${filters.maxPrice ? money(Number(filters.maxPrice)) : copy.filterUnlimited}`,
      next: { ...filters, minPrice: "", maxPrice: "" },
    });
  if (filters.listingSource)
    chips.push({
      key: "source",
      label: filters.listingSource === "owner" ? cr.sourceOwner : cr.sourceCoAgent,
      next: { ...filters, listingSource: "" },
    });
  if (filters.visibility)
    chips.push({
      key: "visibility",
      label: filters.visibility === "published" ? cr.visibilityPublished : cr.visibilityPrivate,
      next: { ...filters, visibility: "" },
    });

  const emptyState = {
    title: web.emptyTitle,
    description: web.emptyBody,
    action: onAddRoom ? (
      <button type="button" className="awu-btn awu-btn-primary" onClick={onAddRoom}>
        {copy.addRoom}
      </button>
    ) : undefined,
  };

  const tableSort = useMemo(() => fromApiSort(apiSort), [apiSort]);

  const viewButton = (mode: RoomsView, icon: AppIconName, label: string) => (
    <button
      type="button"
      className={`awr-view-btn${view === mode ? " is-active" : ""}`}
      aria-pressed={view === mode}
      aria-label={label}
      title={label}
      onClick={() => changeView(mode)}
    >
      <MobileIcon name={icon} size={18} color="currentColor" />
    </button>
  );

  const grid = () => {
    if (status === "loading")
      return (
        <div className="awr-grid" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="awr-card awr-card-skeleton">
              <span className="awr-thumb awr-thumb-card" />
              <WebSkeleton rows={3} columns={1} />
            </div>
          ))}
        </div>
      );
    if (status === "error") return <WebState kind="error" description={errorText ?? undefined} onRetry={() => setRefresh((n) => n + 1)} />;
    if (!items.length)
      return filtered ? <WebState kind="filtered" onClearFilters={clearAll} /> : <WebState kind="empty" {...emptyState} />;
    return (
      <ul className="awr-grid" aria-label={web.tableLabel}>
        {items.map((room) => {
          const price = listPrice(room.prices);
          const facts = [typeText(room), sizeText(room)].filter(Boolean).join(" · ");
          return (
            <li key={room.id}>
              <button type="button" className="awr-card" onClick={() => setSelected(room.id)}>
                <Thumb url={room.coverMediaUrl} size="card" />
                <span className="awr-card-body">
                  <span className="awr-card-status">
                    {statusBadge(room)}
                    {visibilityText(room) ? <small>{visibilityText(room)}</small> : null}
                  </span>
                  <strong className="awr-card-title">{titleOf(room)}</strong>
                  {placeOf(room) ? <small className="awr-card-place">{placeOf(room)}</small> : null}
                  {facts ? <small className="awr-card-facts">{facts}</small> : null}
                  <span className="awr-card-price">
                    {price != null ? (
                      <>
                        <strong>{money(price)}</strong> <small>{copy.rentPeriod}</small>
                      </>
                    ) : (
                      <span className="awr-none">—</span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="awr-page" ref={rootRef} data-testid="rooms.page">
      <div className="awr-toolbar">
        <label className="awr-search">
          <MobileIcon name="search" size={18} color={theme.textSecondary} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.search}
            aria-label={copy.searchRooms}
            data-testid="rooms.search"
          />
        </label>
        <div className="awr-status-select">
          <AgentSelect
            aria-label={copy.filterAvailability}
            value={filters.roomStatus}
            onChange={(event) => applyFilters({ ...filters, roomStatus: event.target.value as RoomFilters["roomStatus"] })}
            data-testid="rooms.status"
          >
            <option value="">{`${copy.filterAvailability}: ${copy.filterAny}`}</option>
            {ROOM_STATUS_FILTERS.map((code) => (
              <option key={code} value={code}>
                {String(copy[code])}
              </option>
            ))}
          </AgentSelect>
        </div>
        <button
          type="button"
          className={`awu-btn awr-filter-btn${chips.length ? " is-on" : ""}`}
          onClick={() => {
            setDraft(filters);
            setFilterOpen(true);
          }}
          data-testid="rooms.filters"
        >
          <MobileIcon name="funnel" size={16} color="currentColor" />
          {web.filters}
          {chips.length ? <span className="awr-filter-count">{chips.length}</span> : null}
        </button>
        {view === "grid" ? (
          <div className="awr-sort-select">
            <AgentSelect aria-label={copy.sortTitle} value={apiSort} onChange={(event) => { setApiSort(event.target.value as RoomsApiSort); setPage(1); }}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AgentSelect>
          </div>
        ) : null}
        <span className="awr-count" aria-live="polite">
          {status === "ready" ? copy.results.replace("{count}", total.toLocaleString(localeTag)) : " "}
        </span>
        <div className="awr-view" role="group" aria-label={`${web.viewTable} / ${web.viewCards}`}>
          {viewButton("table", "list-rows", web.viewTable)}
          {viewButton("grid", "grid", web.viewCards)}
        </div>
      </div>

      {chips.length ? (
        <div className="awr-chips">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="awr-chip"
              onClick={() => applyFilters(chip.next)}
              aria-label={`${copy.filterClear} ${chip.label}`}
            >
              {chip.label}
              <MobileIcon name="close" size={12} color="currentColor" />
            </button>
          ))}
          <button type="button" className="awr-clear" onClick={() => applyFilters({ ...EMPTY_ROOM_FILTERS, roomStatus: filters.roomStatus })}>
            {copy.filterReset}
          </button>
        </div>
      ) : null}

      <div className={`awr-results${busy ? " is-busy" : ""}`} aria-busy={busy || status === "loading"}>
        {view === "table" ? (
          <div className="awr-table-card">
            <WebTable
              label={web.tableLabel}
              columns={columns}
              rows={items}
              rowKey={(room) => room.id}
              status={status === "ready" ? "ready" : status}
              onRetry={() => setRefresh((n) => n + 1)}
              filtered={filtered}
              onClearFilters={clearAll}
              empty={emptyState}
              sort={tableSort}
              onSortChange={(next: WebSort) => {
                setApiSort(toApiSort(next as RoomsTableSort));
                setPage(1);
              }}
              onRowPress={(room) => setSelected(room.id)}
              skeletonRows={8}
              testID="rooms.table"
            />
          </div>
        ) : (
          grid()
        )}
      </div>

      {status === "ready" && total > 0 ? (
        <nav className="awr-pager" aria-label={web.pages}>
          <span className="awr-pager-range">
            {web.pageRange
              .replace("{from}", range.from.toLocaleString(localeTag))
              .replace("{to}", range.to.toLocaleString(localeTag))
              .replace("{total}", total.toLocaleString(localeTag))}
          </span>
          {range.pages > 1 ? (
            <span className="awr-pager-buttons">
              <button type="button" className="awr-page-btn" onClick={() => goToPage(page - 1)} disabled={page <= 1} aria-label={web.prevPage}>
                <MobileIcon name="chevron-left" size={16} color="currentColor" />
              </button>
              {pageButtons(page, range.pages).map((n, i) =>
                n == null ? (
                  <span key={`gap-${i}`} className="awr-page-gap" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    className={`awr-page-btn${n === page ? " is-current" : ""}`}
                    aria-current={n === page ? "page" : undefined}
                    onClick={() => goToPage(n)}
                  >
                    {n.toLocaleString(localeTag)}
                  </button>
                ),
              )}
              <button type="button" className="awr-page-btn" onClick={() => goToPage(page + 1)} disabled={page >= range.pages} aria-label={web.nextPage}>
                <MobileIcon name="chevron-right" size={16} color="currentColor" />
              </button>
            </span>
          ) : null}
        </nav>
      ) : null}

      <WebDialog
        open={filterOpen}
        title={copy.filterRooms}
        onClose={() => setFilterOpen(false)}
        size="md"
        testID="rooms.filterDialog"
        footer={
          <>
            <button type="button" className="awu-btn" onClick={() => setDraft({ ...EMPTY_ROOM_FILTERS, roomStatus: draft.roomStatus })}>
              {copy.filterReset}
            </button>
            <button
              type="button"
              className="awu-btn awu-btn-primary"
              disabled={!draftValid}
              onClick={() => {
                applyFilters(draft);
                setFilterOpen(false);
              }}
            >
              {copy.filterShowResults}
            </button>
          </>
        }
      >
        <div className="awr-filter-grid">
          <label className="awr-field">
            <span>{cr.propertyType}</span>
            <AgentSelect value={draft.propertyType} onChange={(event) => setDraft({ ...draft, propertyType: event.target.value })}>
              <option value="">{copy.filterAny}</option>
              {Object.entries(t.masters.propertyTypes).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </AgentSelect>
          </label>
          <label className="awr-field">
            <span>{cr.roomType}</span>
            <AgentSelect value={draft.roomType} onChange={(event) => setDraft(withRoomType(draft, event.target.value))}>
              <option value="">{copy.filterAny}</option>
              {Object.entries(t.masters.roomTypes).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </AgentSelect>
          </label>
          <label className="awr-field">
            <span>{cr.bedroom}</span>
            <AgentSelect value={draft.bedrooms} onChange={(event) => setDraft(withBedrooms(draft, event.target.value))}>
              <option value="">{copy.filterAny}</option>
              {BEDROOM_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {bedsText(value)}
                </option>
              ))}
            </AgentSelect>
          </label>
          <fieldset className="awr-field awr-field-wide">
            <legend>{`${copy.filterPriceRange} (${copy.filterPricePerMonth})`}</legend>
            <div className="awr-price-row">
              <input
                inputMode="numeric"
                aria-label={copy.filterMinPrice}
                placeholder={copy.filterMinPrice}
                value={draft.minPrice}
                onChange={(event) => setDraft({ ...draft, minPrice: parsePriceInput(event.target.value) })}
                aria-invalid={!draftValid}
              />
              <span aria-hidden="true">–</span>
              <input
                inputMode="numeric"
                aria-label={copy.filterMaxPrice}
                placeholder={copy.filterUnlimited}
                value={draft.maxPrice}
                onChange={(event) => setDraft({ ...draft, maxPrice: parsePriceInput(event.target.value) })}
                aria-invalid={!draftValid}
              />
            </div>
            {!draftValid ? (
              <small className="awr-field-error" role="alert">
                {copy.filterPriceError}
              </small>
            ) : null}
          </fieldset>
          <label className="awr-field">
            <span>{copy.filterSource}</span>
            <AgentSelect
              value={draft.listingSource}
              onChange={(event) => setDraft({ ...draft, listingSource: event.target.value as RoomFilters["listingSource"] })}
            >
              <option value="">{copy.filterAny}</option>
              <option value="owner">{cr.sourceOwner}</option>
              <option value="co_agent">{cr.sourceCoAgent}</option>
            </AgentSelect>
          </label>
          <label className="awr-field">
            <span>{copy.filterVisibility}</span>
            <AgentSelect
              value={draft.visibility}
              onChange={(event) => setDraft({ ...draft, visibility: event.target.value as RoomFilters["visibility"] })}
            >
              <option value="">{copy.filterAny}</option>
              <option value="published">{cr.visibilityPublished}</option>
              <option value="private">{cr.visibilityPrivate}</option>
            </AgentSelect>
          </label>
        </div>
      </WebDialog>

      <AgentRoomDetailModal roomId={selected} onClose={() => setSelected(null)} onSaved={() => setRefresh((n) => n + 1)} />
    </div>
  );
}
