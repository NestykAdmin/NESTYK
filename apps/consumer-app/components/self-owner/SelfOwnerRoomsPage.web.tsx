import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@nestyk/i18n";
import { MobileIcon, useMobileTheme, type AppIconName } from "@nestyk/ui/native";
import { cookieConsentAllows } from "@nestyk/ui/cookie-consent";
import { interpolate } from "@nestyk/feature-listing";
import { WebTable, type WebSort, type WebTableColumn } from "../agent-web/ui/WebTable";
import { WebDialog } from "../agent-web/ui/WebDialog";
import { WebState } from "../agent-web/ui/WebState";
import { StatusBadge } from "../agent-web/ui/StatusBadge";
import type { StatusIntent } from "../agent-web/ui/statusIntent";
import { AgentSelect } from "../agent-web/AgentSelect";
import { parsePriceInput, validPriceRange } from "../room-price-range";
import { SELF_OWNER_LOCALE_TAG } from "../../lib/self-owner-dashboard";
import { selfOwnerListingDrafts } from "../../lib/self-owner-listing";
import {
  EMPTY_SELF_OWNER_FILTERS,
  SELF_OWNER_BEDROOM_FILTERS,
  SELF_OWNER_ROOMS_WEB_PAGE_SIZE,
  activeSelfOwnerFilterCount,
  applySelfOwnerRoomFilters,
  clampPage,
  columnToSort,
  countSelfOwnerRooms,
  filterSelfOwnerRooms,
  pageButtons,
  sortToColumn,
  type SelfOwnerRoom,
  type SelfOwnerRoomFilter,
  type SelfOwnerRoomFilters,
  type SelfOwnerRoomSort,
  type SelfOwnerRoomState,
} from "../../lib/self-owner-rooms";
import type { SelfOwnerRoomsPageProps } from "./SelfOwnerRoomsPage.types";
import { SelfOwnerRoomDetailModal } from "./SelfOwnerRoomDetailModal";
import "../agent-web/agent-rooms.css";
import "./self-owner-rooms.css";

const PAGE_SIZE = SELF_OWNER_ROOMS_WEB_PAGE_SIZE;
// Same key as the agent rooms page: it is the "room list view" item already listed on /privacy (one choice per browser).
const VIEW_KEY = "nestyk.agentRooms.view";
type RoomsView = "table" | "grid";
const STATES = ["occupied", "listed", "unlisted"] as const;
/** Same tones as the agent rooms page: available = done, rented = neutral; a room not listed yet needs attention. */
const STATE_INTENT: Record<SelfOwnerRoomState, StatusIntent> = { listed: "done", occupied: "neutral", unlisted: "attn" };

function readView(): RoomsView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "table";
  } catch {
    return "table";
  }
}

/** The room's cover: from the API list, else what the owner saved in the form; demo rooms have none. */
function coverOf(room: SelfOwnerRoom): string | null {
  if (room.coverUrl) return room.coverUrl;
  const medias = selfOwnerListingDrafts.get(room.id)?.medias ?? [];
  return (medias.find((media) => media.isCover) ?? medias[0])?.mediaUrl ?? null;
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
 * Self owner "my rooms" web page, made to work like the agent rooms page (AgentRoomsPage.web.tsx, Jom 20 Nov 2026):
 * same toolbar (search, status, filters with chips, sort on cards, count, table / cards switch), rows that light up on
 * hover and open the room detail modal, 24 rooms a page. Demo rooms; filters are the ones the demo rooms have.
 */
export function SelfOwnerRoomsPage({
  rooms,
  status,
  isDemoPreview,
  initialQuery = "",
  initialFilter = "all",
  onAddListing,
  ownerContact,
}: SelfOwnerRoomsPageProps) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.selfOwnerRooms;
  const shared = t.selfOwnerDashboard;
  const listings = t.agent.listings;
  const web = listings.web;
  const tag = SELF_OWNER_LOCALE_TAG[locale as keyof typeof SELF_OWNER_LOCALE_TAG] ?? SELF_OWNER_LOCALE_TAG.th;

  const [query, setQuery] = useState(initialQuery);
  const [search, setSearch] = useState(initialQuery);
  const [filter, setFilter] = useState<SelfOwnerRoomFilter>(initialFilter);
  const [filters, setFilters] = useState<SelfOwnerRoomFilters>(EMPTY_SELF_OWNER_FILTERS);
  const [draft, setDraft] = useState<SelfOwnerRoomFilters>(EMPTY_SELF_OWNER_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState<SelfOwnerRoomSort>("updated_desc");
  const [view, setView] = useState<RoomsView>(readView);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Search waits for a short pause in typing, then starts again from page 1 (like the agent page).
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const counts = useMemo(() => countSelfOwnerRooms(rooms), [rooms]);
  const results = useMemo(
    () => applySelfOwnerRoomFilters(filterSelfOwnerRooms(rooms, search, filter, sort), filters),
    [rooms, search, filter, sort, filters],
  );
  const total = results.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = clampPage(page, total, PAGE_SIZE);
  const shown = results.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const filtered = !!search || filter !== "all" || activeSelfOwnerFilterCount(filters) > 0;
  // Counts only once the rooms are in: no "0 rooms" while loading or after an error.
  const ready = status === "available" || status === "demo";
  const draftValid = validPriceRange(draft);

  const number = (value: number) => value.toLocaleString(tag);
  const money = (amount: number) => listings.rentAmount.replace("{price}", number(amount));
  const day = (iso: string) =>
    new Date(iso.length === 10 ? `${iso}T00:00:00+07:00` : iso).toLocaleDateString(tag, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Bangkok",
    });
  const sizeText = (room: SelfOwnerRoom) =>
    room.bedrooms === 0 ? interpolate(copy.studioSize, { sqm: room.sizeSqm }) : interpolate(copy.sizeValue, { beds: room.bedrooms, sqm: room.sizeSqm });
  const bedsText = (value: string) =>
    value === "0"
      ? t.masters.roomTypes.studio
      : value === "4"
        ? listings.specBeds.replace("{count}", "4+")
        : value === "1"
          ? listings.specBed.replace("{count}", "1")
          : listings.specBeds.replace("{count}", value);
  const detailText = (room: SelfOwnerRoom) => {
    if (room.state === "occupied") {
      return (
        <span className="sor-detail">
          <span>{interpolate(shared.tenantLine, { name: room.tenantName ?? "" })}</span>
          {room.leaseEndsAt ? <small>{interpolate(shared.leaseEnds, { date: day(room.leaseEndsAt) })}</small> : null}
        </span>
      );
    }
    if (room.state === "listed") return <span className="awr-nowrap">{interpolate(shared.interests, { n: room.interestCount ?? 0 })}</span>;
    return <span className="awr-none">—</span>;
  };
  const statusBadge = (room: SelfOwnerRoom) => <StatusBadge label={shared.roomState[room.state]} intent={STATE_INTENT[room.state]} />;

  const columns: WebTableColumn<SelfOwnerRoom>[] = [
    { key: "photo", header: "", width: "72px", hideBelow: "md", cell: (room) => <Thumb url={coverOf(room)} size="row" /> },
    {
      key: "room",
      header: web.colRoom,
      cell: (room) => (
        <span className="awr-room">
          <strong title={room.title}>{room.title}</strong>
          <small>{room.project}</small>
        </span>
      ),
    },
    { key: "size", header: web.colSize, hideBelow: "lg", cell: (room) => <span className="awr-nowrap">{sizeText(room)}</span> },
    { key: "rent", header: web.colPrice, sortable: true, align: "end", cell: (room) => <span className="awr-price">{money(room.monthlyRent)}</span> },
    { key: "state", header: web.colStatus, cell: statusBadge },
    { key: "detail", header: copy.colDetail, hideBelow: "md", cell: detailText },
    { key: "updated", header: web.colUpdated, sortable: true, hideBelow: "md", cell: (room) => <span className="awr-muted">{day(room.updatedAt)}</span> },
  ];

  const sortOptions: Array<{ value: SelfOwnerRoomSort; label: string }> = [
    { value: "updated_desc", label: listings.sortUpdatedDesc },
    { value: "updated_asc", label: listings.sortUpdatedAsc },
    { value: "rent_asc", label: listings.sortPriceAsc },
    { value: "rent_desc", label: listings.sortPriceDesc },
  ];

  // Active filters as removable chips (the status has its own select in the toolbar), like the agent page.
  const chips: Array<{ key: string; label: string; next: SelfOwnerRoomFilters }> = [];
  if (filters.bedrooms) chips.push({ key: "bedrooms", label: bedsText(filters.bedrooms), next: { ...filters, bedrooms: "" } });
  if (filters.minPrice || filters.maxPrice)
    chips.push({
      key: "price",
      label: `${filters.minPrice ? money(Number(filters.minPrice)) : "0"} – ${filters.maxPrice ? money(Number(filters.maxPrice)) : listings.filterUnlimited}`,
      next: { ...filters, minPrice: "", maxPrice: "" },
    });

  const changeView = (next: RoomsView) => {
    setView(next);
    // PDPA cookie consent: remembered only when "Remember my settings" is allowed.
    if (!cookieConsentAllows("preferences")) return;
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* private mode: the choice lasts for this visit only */
    }
  };
  const goToPage = (next: number) => {
    setPage(clampPage(next, total, PAGE_SIZE));
    rootRef.current?.closest(".aw-page-scroll")?.scrollTo({ top: 0 });
  };
  const applyFilters = (next: SelfOwnerRoomFilters) => {
    setFilters(next);
    setPage(1);
  };
  const clearAll = () => {
    setQuery("");
    setSearch("");
    setFilter("all");
    applyFilters(EMPTY_SELF_OWNER_FILTERS);
  };

  const emptyState = {
    title: shared.noRooms,
    action: onAddListing ? (
      <button type="button" className="awu-btn awu-btn-primary" onClick={onAddListing}>
        {shared.addListing}
      </button>
    ) : undefined,
  };

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
            </div>
          ))}
        </div>
      );
    if (status === "error") return <WebState kind="error" />;
    if (!shown.length) return filtered ? <WebState kind="filtered" onClearFilters={clearAll} /> : <WebState kind="empty" {...emptyState} />;
    return (
      <ul className="awr-grid" aria-label={copy.title}>
        {shown.map((room) => (
          <li key={room.id}>
            <button type="button" className="awr-card" data-testid={`sor-card-${room.id}`} onClick={() => setSelected(room.id)}>
              <Thumb url={coverOf(room)} size="card" />
              <span className="awr-card-body">
                <span className="awr-card-status">{statusBadge(room)}</span>
                <strong className="awr-card-title">{room.title}</strong>
                <small className="awr-card-place">{room.project}</small>
                <small className="awr-card-facts">{sizeText(room)}</small>
                <span className="awr-card-price">
                  <strong>{money(room.monthlyRent)}</strong> <small>{listings.rentPeriod}</small>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  };

  const from = total === 0 ? 0 : (current - 1) * PAGE_SIZE + 1;
  const to = Math.min(current * PAGE_SIZE, total);

  return (
    <div className="awr-page" ref={rootRef} data-testid="self-owner-rooms-page">
      <div className="sor-head">
        {isDemoPreview ? (
          <p className="sor-demo" role="note">
            <MobileIcon name="info" size={16} color="currentColor" />
            {shared.demoNote}
          </p>
        ) : (
          <span />
        )}
        {onAddListing ? (
          <button type="button" className="sor-action" onClick={onAddListing}>
            <MobileIcon name="plus" size={16} color="currentColor" />
            {shared.addListing}
          </button>
        ) : (
          <button type="button" className="sor-action" disabled aria-disabled="true" title={shared.comingSoon}>
            <MobileIcon name="plus" size={16} color="currentColor" />
            {shared.addListing}
            <span className="sor-soon">{shared.comingSoon}</span>
          </button>
        )}
      </div>

      <div className="awr-toolbar">
        <label className="awr-search">
          <MobileIcon name="search" size={18} color={theme.textSecondary} />
          <input
            type="search"
            value={query}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
            data-testid="sor-search"
          />
        </label>
        <div className="awr-status-select">
          <AgentSelect
            aria-label={copy.filterLabel}
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as SelfOwnerRoomFilter);
              setPage(1);
            }}
          >
            <option value="all">{`${copy.filterLabel}: ${copy.filterAll}`}</option>
            {STATES.map((key) => (
              <option key={key} value={key}>
                {ready ? `${shared.roomState[key]} (${counts[key]})` : shared.roomState[key]}
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
          data-testid="sor-filters"
        >
          <MobileIcon name="funnel" size={16} color="currentColor" />
          {web.filters}
          {chips.length ? <span className="awr-filter-count">{chips.length}</span> : null}
        </button>
        {view === "grid" ? (
          <div className="awr-sort-select">
            <AgentSelect
              aria-label={listings.sortTitle}
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as SelfOwnerRoomSort);
                setPage(1);
              }}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AgentSelect>
          </div>
        ) : null}
        <span className="awr-count" aria-live="polite">
          {ready ? listings.results.replace("{count}", number(total)) : " "}
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
              aria-label={`${listings.filterClear} ${chip.label}`}
            >
              {chip.label}
              <MobileIcon name="close" size={12} color="currentColor" />
            </button>
          ))}
          <button type="button" className="awr-clear" onClick={() => applyFilters(EMPTY_SELF_OWNER_FILTERS)}>
            {listings.filterReset}
          </button>
        </div>
      ) : null}

      <div
        className="awr-results"
        aria-busy={status === "loading"}
        // A mouse press opens the room without focusing the row / card, so no focus ring shows when the modal hands
        // focus back on close (Jom 20 Nov 2026). Keyboard focus (Tab, Enter) is untouched and keeps its ring.
        onMouseDownCapture={(event) => {
          if ((event.target as Element | null)?.closest?.("tr.awu-row-press, button.awr-card")) event.preventDefault();
        }}
      >
        {view === "table" ? (
          <div className="awr-table-card">
            <WebTable
              label={copy.title}
              columns={columns}
              rows={shown}
              rowKey={(room) => room.id}
              status={status === "error" ? "error" : status === "loading" ? "loading" : "ready"}
              filtered={filtered}
              onClearFilters={clearAll}
              empty={emptyState}
              sort={sortToColumn(sort)}
              onSortChange={(next: WebSort) => {
                setSort(columnToSort(next.key, next.direction));
                setPage(1);
              }}
              onRowPress={(room) => setSelected(room.id)}
              rowLabel={(room) => room.title}
              skeletonRows={8}
              testID="self-owner-rooms-table"
            />
          </div>
        ) : (
          grid()
        )}
      </div>

      {ready && total > 0 ? (
        <nav className="awr-pager" aria-label={web.pages}>
          <span className="awr-pager-range">
            {web.pageRange.replace("{from}", number(from)).replace("{to}", number(to)).replace("{total}", number(total))}
          </span>
          {pages > 1 ? (
            <span className="awr-pager-buttons">
              <button type="button" className="awr-page-btn" onClick={() => goToPage(current - 1)} disabled={current <= 1} aria-label={web.prevPage}>
                <MobileIcon name="chevron-left" size={16} color="currentColor" />
              </button>
              {pageButtons(current, pages).map((n, i) =>
                n == null ? (
                  <span key={`gap-${i}`} className="awr-page-gap" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    className={`awr-page-btn${n === current ? " is-current" : ""}`}
                    aria-current={n === current ? "page" : undefined}
                    onClick={() => goToPage(n)}
                  >
                    {number(n)}
                  </button>
                ),
              )}
              <button type="button" className="awr-page-btn" onClick={() => goToPage(current + 1)} disabled={current >= pages} aria-label={web.nextPage}>
                <MobileIcon name="chevron-right" size={16} color="currentColor" />
              </button>
            </span>
          ) : null}
        </nav>
      ) : null}

      <WebDialog
        open={filterOpen}
        title={listings.filterRooms}
        onClose={() => setFilterOpen(false)}
        size="md"
        testID="sor-filter-dialog"
        footer={
          <>
            <button type="button" className="awu-btn" onClick={() => setDraft(EMPTY_SELF_OWNER_FILTERS)}>
              {listings.filterReset}
            </button>
            <button
              type="button"
              className="awu-btn awu-btn-primary"
              data-testid="sor-filter-apply"
              disabled={!draftValid}
              onClick={() => {
                applyFilters(draft);
                setFilterOpen(false);
              }}
            >
              {listings.filterShowResults}
            </button>
          </>
        }
      >
        <div className="awr-filter-grid">
          <label className="awr-field">
            <span>{t.agent.createRoom.bedroom}</span>
            <AgentSelect value={draft.bedrooms} onChange={(event) => setDraft({ ...draft, bedrooms: event.target.value })} data-testid="sor-filter-beds">
              <option value="">{listings.filterAny}</option>
              {SELF_OWNER_BEDROOM_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {bedsText(value)}
                </option>
              ))}
            </AgentSelect>
          </label>
          <fieldset className="awr-field awr-field-wide">
            <legend>{`${listings.filterPriceRange} (${listings.filterPricePerMonth})`}</legend>
            <div className="awr-price-row">
              <input
                inputMode="numeric"
                aria-label={listings.filterMinPrice}
                placeholder={listings.filterMinPrice}
                value={draft.minPrice}
                onChange={(event) => setDraft({ ...draft, minPrice: parsePriceInput(event.target.value) })}
                aria-invalid={!draftValid}
                data-testid="sor-filter-min"
              />
              <span aria-hidden="true">–</span>
              <input
                inputMode="numeric"
                aria-label={listings.filterMaxPrice}
                placeholder={listings.filterUnlimited}
                value={draft.maxPrice}
                onChange={(event) => setDraft({ ...draft, maxPrice: parsePriceInput(event.target.value) })}
                aria-invalid={!draftValid}
                data-testid="sor-filter-max"
              />
            </div>
            {!draftValid ? (
              <small className="awr-field-error" role="alert">
                {listings.filterPriceError}
              </small>
            ) : null}
          </fieldset>
        </div>
      </WebDialog>

      <SelfOwnerRoomDetailModal roomId={selected} onClose={() => setSelected(null)} ownerContact={ownerContact} />
    </div>
  );
}
