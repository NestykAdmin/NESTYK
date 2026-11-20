import React, { useMemo, useState } from "react";
import { useLocale } from "@nestyk/i18n";
import { MobileIcon, useMobileTheme } from "@nestyk/ui/native";
import { interpolate } from "@nestyk/feature-listing";
import { WebTable, type WebSort, type WebTableColumn } from "../agent-web/ui/WebTable";
import { StatusBadge } from "../agent-web/ui/StatusBadge";
import type { StatusIntent } from "../agent-web/ui/statusIntent";
import { AgentSelect } from "../agent-web/AgentSelect";
import { SELF_OWNER_LOCALE_TAG } from "../../lib/self-owner-dashboard";
import {
  SELF_OWNER_ROOMS_PAGE_SIZE,
  clampPage,
  columnToSort,
  countSelfOwnerRooms,
  filterSelfOwnerRooms,
  pageButtons,
  sortToColumn,
  type SelfOwnerRoom,
  type SelfOwnerRoomFilter,
  type SelfOwnerRoomSort,
  type SelfOwnerRoomState,
} from "../../lib/self-owner-rooms";
import type { SelfOwnerRoomsPageProps } from "./SelfOwnerRoomsPage.types";
import "./self-owner-rooms.css";

const STATES = ["occupied", "listed", "unlisted"] as const;
/** Same tones as the agent rooms page: available = done, rented = neutral; a room not listed yet needs attention. */
const STATE_INTENT: Record<SelfOwnerRoomState, StatusIntent> = { listed: "done", occupied: "neutral", unlisted: "attn" };

/** Photo cell like the agent rooms page; demo rooms have no photo, so it shows the building icon. */
function Thumb({ url }: { url?: string | null }) {
  const { theme } = useMobileTheme();
  return (
    <span className="sor-thumb" aria-hidden="true">
      {url ? <img src={url} alt="" loading="lazy" /> : <MobileIcon name="buildings" size={20} color={theme.textSecondary} />}
    </span>
  );
}

/**
 * Self owner "Rooms and listings" web page (UI round, 19 Nov 2026, ClickUp z8rcteng6c). Same layout as the agent
 * rooms page (AgentRoomsPage.web.tsx): toolbar (search, status dropdown, count), the table in a bordered card with
 * photo and status-pill cells, sort from the column headers, pager with range and numbered pages. Demo rooms; no detail yet.
 */
export function SelfOwnerRoomsPage({ rooms, status, isDemoPreview, initialQuery = "", initialFilter = "all" }: SelfOwnerRoomsPageProps) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.selfOwnerRooms;
  const shared = t.selfOwnerDashboard;
  const web = t.agent.listings.web;
  const tag = SELF_OWNER_LOCALE_TAG[locale as keyof typeof SELF_OWNER_LOCALE_TAG] ?? SELF_OWNER_LOCALE_TAG.th;

  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<SelfOwnerRoomFilter>(initialFilter);
  const [sort, setSort] = useState<SelfOwnerRoomSort>("updated_desc");
  const [page, setPage] = useState(1);

  const counts = useMemo(() => countSelfOwnerRooms(rooms), [rooms]);
  const results = useMemo(() => filterSelfOwnerRooms(rooms, query, filter, sort), [rooms, query, filter, sort]);
  const total = results.length;
  const pages = Math.max(1, Math.ceil(total / SELF_OWNER_ROOMS_PAGE_SIZE));
  const current = clampPage(page, total);
  const shown = results.slice((current - 1) * SELF_OWNER_ROOMS_PAGE_SIZE, current * SELF_OWNER_ROOMS_PAGE_SIZE);
  const filtered = !!query.trim() || filter !== "all";
  // Counts only once the rooms are in: no "0 rooms" while loading or after an error.
  const ready = status === "available" || status === "demo";

  const number = (value: number) => value.toLocaleString(tag);
  const money = (amount: number) => new Intl.NumberFormat(tag, { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(amount);
  const day = (iso: string) =>
    new Date(iso.length === 10 ? `${iso}T00:00:00+07:00` : iso).toLocaleDateString(tag, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Bangkok",
    });
  const detail = (room: SelfOwnerRoom) => {
    if (room.state === "occupied") {
      return (
        <span className="sor-detail">
          <span>{interpolate(shared.tenantLine, { name: room.tenantName ?? "" })}</span>
          {room.leaseEndsAt ? <small>{interpolate(shared.leaseEnds, { date: day(room.leaseEndsAt) })}</small> : null}
        </span>
      );
    }
    if (room.state === "listed") return <span className="sor-nowrap">{interpolate(shared.interests, { n: room.interestCount ?? 0 })}</span>;
    return <span className="sor-none">—</span>;
  };

  const columns: WebTableColumn<SelfOwnerRoom>[] = [
    { key: "photo", header: "", width: "72px", hideBelow: "md", cell: () => <Thumb /> },
    {
      key: "room",
      header: web.colRoom,
      cell: (room) => (
        <span className="sor-room">
          <strong title={room.title}>{room.title}</strong>
          <small>{room.project}</small>
        </span>
      ),
    },
    {
      key: "size",
      header: web.colSize,
      hideBelow: "lg",
      cell: (room) => (
        <span className="sor-nowrap">
          {room.bedrooms === 0
            ? interpolate(copy.studioSize, { sqm: room.sizeSqm })
            : interpolate(copy.sizeValue, { beds: room.bedrooms, sqm: room.sizeSqm })}
        </span>
      ),
    },
    { key: "rent", header: web.colPrice, sortable: true, cell: (room) => <span className="sor-price">{money(room.monthlyRent)}</span> },
    { key: "state", header: web.colStatus, cell: (room) => <StatusBadge label={shared.roomState[room.state]} intent={STATE_INTENT[room.state]} /> },
    { key: "detail", header: copy.colDetail, hideBelow: "md", cell: detail },
    { key: "updated", header: web.colUpdated, sortable: true, hideBelow: "md", cell: (room) => <span className="sor-muted">{day(room.updatedAt)}</span> },
  ];

  const changeSort = (next: WebSort) => {
    setSort(columnToSort(next.key, next.direction));
    setPage(1);
  };
  const goToPage = (next: number) => setPage(clampPage(next, total));
  const from = total === 0 ? 0 : (current - 1) * SELF_OWNER_ROOMS_PAGE_SIZE + 1;
  const to = Math.min(current * SELF_OWNER_ROOMS_PAGE_SIZE, total);

  return (
    <div className="sor-page" data-testid="self-owner-rooms-page">
      <div className="sor-head">
        {isDemoPreview ? (
          <p className="sor-demo" role="note">
            <MobileIcon name="info" size={16} color="currentColor" />
            {shared.demoNote}
          </p>
        ) : (
          <span />
        )}
        <button type="button" className="sor-action" disabled aria-disabled="true" title={shared.comingSoon}>
          <MobileIcon name="plus" size={16} color="currentColor" />
          {shared.addListing}
          <span className="sor-soon">{shared.comingSoon}</span>
        </button>
      </div>

      <div className="sor-toolbar">
        <label className="sor-search">
          <MobileIcon name="search" size={18} color={theme.textSecondary} />
          <input
            type="search"
            value={query}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchPlaceholder}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <div className="sor-status-select">
          <AgentSelect
            aria-label={copy.filterLabel}
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as SelfOwnerRoomFilter);
              setPage(1);
            }}
          >
            <option value="all">{copy.filterAll}</option>
            {STATES.map((key) => (
              <option key={key} value={key}>
                {ready ? `${shared.roomState[key]} (${counts[key]})` : shared.roomState[key]}
              </option>
            ))}
          </AgentSelect>
        </div>
        {ready ? (
          <span className="sor-count" aria-live="polite">
            {interpolate(copy.resultCount, { n: total })}
          </span>
        ) : null}
      </div>

      <div className="sor-table-card">
        <WebTable
          label={copy.title}
          columns={columns}
          rows={shown}
          rowKey={(room) => room.id}
          status={status === "error" ? "error" : status === "loading" ? "loading" : "ready"}
          filtered={filtered}
          onClearFilters={() => {
            setQuery("");
            setFilter("all");
            setPage(1);
          }}
          empty={{ title: shared.noRooms }}
          sort={sortToColumn(sort)}
          onSortChange={changeSort}
          skeletonRows={8}
          testID="self-owner-rooms-table"
        />
      </div>

      {ready && total > 0 ? (
        <nav className="sor-pager" aria-label={web.pages}>
          <span className="sor-pager-range">
            {web.pageRange.replace("{from}", number(from)).replace("{to}", number(to)).replace("{total}", number(total))}
          </span>
          {pages > 1 ? (
            <span className="sor-pager-buttons">
              <button type="button" className="sor-page-btn" onClick={() => goToPage(current - 1)} disabled={current <= 1} aria-label={web.prevPage}>
                <MobileIcon name="chevron-left" size={16} color="currentColor" />
              </button>
              {pageButtons(current, pages).map((n, i) =>
                n == null ? (
                  <span key={`gap-${i}`} className="sor-page-gap" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    className={`sor-page-btn${n === current ? " is-current" : ""}`}
                    aria-current={n === current ? "page" : undefined}
                    onClick={() => goToPage(n)}
                  >
                    {number(n)}
                  </button>
                ),
              )}
              <button type="button" className="sor-page-btn" onClick={() => goToPage(current + 1)} disabled={current >= pages} aria-label={web.nextPage}>
                <MobileIcon name="chevron-right" size={16} color="currentColor" />
              </button>
            </span>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
