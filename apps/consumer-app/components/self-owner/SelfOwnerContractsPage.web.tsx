import React, { useMemo, useRef, useState } from "react";
import { useLocale } from "@nestyk/i18n";
import { MobileIcon, useMobileTheme } from "@nestyk/ui/native";
import { interpolate } from "@nestyk/feature-listing";
import { WebTable, type WebTableColumn } from "../agent-web/ui/WebTable";
import { WebDialog } from "../agent-web/ui/WebDialog";
import { StatusBadge } from "../agent-web/ui/StatusBadge";
import type { StatusIntent } from "../agent-web/ui/statusIntent";
import { AgentSelect } from "../agent-web/AgentSelect";
import { SELF_OWNER_LOCALE_TAG } from "../../lib/self-owner-dashboard";
import {
  countSelfOwnerRooms,
  filterSelfOwnerRooms,
  groupSelfOwnerContracts,
  isFulfilledReservation,
  isRentContract,
  selfOwnerToday,
  type SelfOwnerContract,
  type SelfOwnerContractFilter,
  type SelfOwnerContractStatus,
  type SelfOwnerRoomContracts,
} from "../../lib/self-owner-contracts";
import { contractDetailView, contractParty } from "./contract-detail-rows";
import { SelfOwnerWebPager } from "./SelfOwnerWebPager";
import { SELF_OWNER_ROOMS_WEB_PAGE_SIZE, clampPage } from "../../lib/self-owner-rooms";
import type { SelfOwnerContractsPageProps } from "./SelfOwnerContractsPage.types";
import "../agent-web/agent-rooms.css";
import "./self-owner-rooms.css";

const STATUSES: SelfOwnerContractStatus[] = ["awaiting_signature", "ending_soon", "active", "ended"];
export const CONTRACT_STATUS_INTENT: Record<SelfOwnerContractStatus, StatusIntent> = {
  active: "done",
  ending_soon: "attn",
  awaiting_signature: "prog",
  ended: "neutral",
};

function useFormat() {
  const { t, locale } = useLocale();
  const tag = SELF_OWNER_LOCALE_TAG[locale as keyof typeof SELF_OWNER_LOCALE_TAG] ?? SELF_OWNER_LOCALE_TAG.th;
  const money = (amount: number) => t.agent.listings.rentAmount.replace("{price}", amount.toLocaleString(tag));
  const day = (ymd: string) =>
    new Date(`${ymd}T00:00:00+07:00`).toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
  return { money, day };
}

function StatusPill({ contract }: { contract: SelfOwnerContract }) {
  const { t } = useLocale();
  const so = t.selfOwnerContracts;
  return <StatusBadge label={isFulfilledReservation(contract) ? so.fulfilled : so.status[contract.status]} intent={CONTRACT_STATUS_INTENT[contract.status]} />;
}

function StatusLine({ contract }: { contract: SelfOwnerContract }) {
  const { t } = useLocale();
  const so = t.selfOwnerContracts;
  return (
    <span className="sor-detail">
      <span className="sor-status-cell">
        <StatusBadge label={isFulfilledReservation(contract) ? so.fulfilled : so.status[contract.status]} intent={CONTRACT_STATUS_INTENT[contract.status]} />
      </span>
      {contract.daysLeft !== undefined ? <small>{interpolate(so.daysLeft, { n: contract.daysLeft })}</small> : null}
    </span>
  );
}

/**
 * All contracts of one room (contract kinds, Jom 24 Nov 2026): the list, newest first; a contract opens its read-only
 * details, with a back button to the list. The owner cannot change or sign anything here.
 */
export function SelfOwnerRoomContractsDialog({
  room,
  all,
  onClose,
  initialContractId = null,
  now,
}: {
  room: SelfOwnerRoomContracts;
  /** Every contract, to find the one a renewal renews. */
  all: SelfOwnerContract[];
  onClose: () => void;
  initialContractId?: string | null;
  /** "Today" for the progress bar; defaults to now. */
  now?: Date;
}) {
  const { t } = useLocale();
  const so = t.selfOwnerContracts;
  const fmt = useFormat();
  const [selectedId, setSelectedId] = useState<string | null>(initialContractId);
  const open = selectedId ? room.contracts.find((c) => c.id === selectedId) ?? null : null;
  const period = (c: SelfOwnerContract) => interpolate(so.period, { start: fmt.day(c.startDate), end: fmt.day(c.endDate) });

  if (open) {
    // Layout A (Jom 24 Nov 2026): period and progress, the other party, money tiles, then the rest.
    const view = contractDetailView(open, all, so, fmt, selfOwnerToday(now));
    return (
      <WebDialog
        open
        title={so.detailTitle}
        onClose={onClose}
        testID="self-owner-contract-detail"
        footer={
          <button type="button" className="awu-btn" disabled aria-disabled="true" title={so.noDocument}>
            <MobileIcon name="file-text" size={16} color="currentColor" />
            {so.viewDocument}
          </button>
        }
      >
        <button type="button" className="soc-back" data-testid="soc-back" onClick={() => setSelectedId(null)}>
          <MobileIcon name="chevron-left" size={16} color="currentColor" />
          {so.back}
        </button>
        <div className="soc-hero">
          <div className="soc-hero-tags">
            <span className="soc-kind">{so.kind[open.kind]}</span>
            <StatusPill contract={open} />
          </div>
          <p className="soc-period">{view.period}</p>
          <p className="soc-room">{view.room}</p>
          {view.progress ? (
            <>
              <div
                className="soc-progress"
                role="progressbar"
                aria-label={view.progressLabel}
                aria-valuemin={1}
                aria-valuemax={view.progress.months}
                aria-valuenow={view.progress.month}
              >
                <span style={{ width: `${Math.round(view.progress.ratio * 100)}%` }} />
              </div>
              <div className="soc-progress-meta">
                <span>{view.progressLabel}</span>
                <span>{interpolate(so.daysLeft, { n: view.progress.daysLeft })}</span>
              </div>
            </>
          ) : null}
        </div>
        <div className="soc-party">
          <span className="soc-avatar" aria-hidden="true">{view.party.initial}</span>
          <span className="soc-party-name">
            <strong>{view.party.name}</strong>
            <small>{view.party.role}</small>
          </span>
          {view.party.phone ? (
            <a className="soc-phone" href={`tel:${view.party.phone.replace(/[^0-9+]/g, "")}`}>
              <MobileIcon name="phone" size={14} color="currentColor" />
              {view.party.phone}
            </a>
          ) : null}
        </div>
        <div className="soc-tiles">
          {view.tiles.map((tile) => (
            <div key={tile.label} className="soc-tile">
              <span>{tile.label}</span>
              <strong>{tile.value}</strong>
              {tile.note ? <small>{tile.note}</small> : null}
            </div>
          ))}
        </div>
        {view.extra.length ? (
          <dl className="soc-extra">
            {view.extra.map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {view.renewsFrom ? (
          <button type="button" className="soc-link" data-testid="soc-renews-from" onClick={() => setSelectedId(view.renewsFrom!.id)}>
            <MobileIcon name="files" size={16} color="currentColor" />
            <span>{view.renewsFrom.label}</span>
            <MobileIcon name="chevron-right" size={16} color="currentColor" />
          </button>
        ) : null}
        <p className="soc-note soc-readonly">
          <MobileIcon name="lock" size={14} color="currentColor" />
          {so.readOnlyNote}
        </p>
      </WebDialog>
    );
  }
  return (
    <WebDialog
      open
      title={interpolate(so.roomContractsTitle, { room: room.roomTitle })}
      description={room.project}
      onClose={onClose}
      testID="self-owner-room-contracts"
    >
      <ul className="soc-contract-list">
        {room.contracts.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="soc-contract"
              data-testid={`soc-contract-${c.id}`}
              aria-label={`${so.viewDetail} ${so.kind[c.kind]} ${period(c)}`}
              onClick={() => setSelectedId(c.id)}
            >
              <span className="soc-contract-main">
                <strong>{so.kind[c.kind]}</strong>
                <small>{period(c)}</small>
                {contractParty(c) ? <small>{contractParty(c)}</small> : null}
              </span>
              <StatusLine contract={c} />
            </button>
          </li>
        ))}
      </ul>
      <p className="soc-note">{so.readOnlyNote}</p>
    </WebDialog>
  );
}

/**
 * Self owner contracts web page: one row per room (contract kinds, Jom 24 Nov 2026), showing the room's current
 * contract; a row opens every contract of that room. Read only; contracts come from NESTYK admin, demo data until then.
 */
export function SelfOwnerContractsPage({ contracts, isDemoPreview, initialFilter = "all", initialQuery = "", initialPage = 1 }: SelfOwnerContractsPageProps) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const so = t.selfOwnerContracts;
  const shared = t.selfOwnerDashboard;
  const { money, day } = useFormat();
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<SelfOwnerContractFilter>(initialFilter);
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(initialPage);
  const rootRef = useRef<HTMLDivElement>(null);

  const rooms = useMemo(() => groupSelfOwnerContracts(contracts), [contracts]);
  const counts = useMemo(() => countSelfOwnerRooms(rooms), [rooms]);
  const results = useMemo(() => filterSelfOwnerRooms(rooms, query, filter), [rooms, query, filter]);
  // 24 rooms a page, like "my rooms" (Jom 25 Nov 2026); a search or filter starts again from page 1.
  const size = SELF_OWNER_ROOMS_WEB_PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(results.length / size));
  const current = clampPage(page, results.length, size);
  const shown = results.slice((current - 1) * size, current * size);
  const goToPage = (next: number) => {
    setPage(clampPage(next, results.length, size));
    rootRef.current?.closest(".aw-page-scroll")?.scrollTo({ top: 0 });
  };
  const filtered = !!query.trim() || filter !== "all";
  const open = selected ? rooms.find((room) => room.roomId === selected) ?? null : null;
  const clearAll = () => {
    setQuery("");
    setFilter("all");
    setPage(1);
  };

  const columns: WebTableColumn<SelfOwnerRoomContracts>[] = [
    {
      key: "room",
      header: so.colRoom,
      cell: (r) => (
        <span className="awr-room">
          <strong title={r.roomTitle}>{r.roomTitle}</strong>
          <small>{r.project}</small>
        </span>
      ),
    },
    // Tenant and rent come from a lease or renewal; a room with only a broker appointment or a reservation shows "-".
    { key: "tenant", header: so.colTenant, cell: (r) => <span className="awr-nowrap">{isRentContract(r.current) && r.current.tenantName ? r.current.tenantName : "-"}</span> },
    {
      key: "current",
      header: so.colCurrent,
      hideBelow: "md",
      cell: (r) => (
        <span className="soc-current">
          <span>{so.kind[r.current.kind]}</span>
          <small>{interpolate(so.period, { start: day(r.current.startDate), end: day(r.current.endDate) })}</small>
        </span>
      ),
    },
    { key: "rent", header: so.colRent, align: "end", cell: (r) => <span className="awr-price">{isRentContract(r.current) ? money(r.current.monthlyRent) : "-"}</span> },
    { key: "status", header: so.colStatus, cell: (r) => <StatusLine contract={r.current} /> },
    { key: "contracts", header: so.colContracts, cell: (r) => <span className="awr-muted">{interpolate(so.contractCount, { n: r.contracts.length })}</span> },
  ];

  return (
    <div className="awr-page" ref={rootRef} data-testid="self-owner-contracts-page">
      {isDemoPreview ? (
        <div className="sor-head">
          <p className="sor-demo" role="note">
            <MobileIcon name="info" size={16} color="currentColor" />
            {shared.demoNote}
          </p>
        </div>
      ) : null}
      <div className="awr-toolbar">
        <label className="awr-search">
          <MobileIcon name="search" size={18} color={theme.textSecondary} />
          <input
            type="search"
            value={query}
            placeholder={so.searchPlaceholder}
            aria-label={so.searchPlaceholder}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            data-testid="soc-search"
          />
        </label>
        <div className="awr-status-select">
          <AgentSelect
            aria-label={so.filterLabel}
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as SelfOwnerContractFilter);
              setPage(1);
            }}
          >
            <option value="all">{`${so.filterLabel}: ${so.filterAll} (${counts.all})`}</option>
            {STATUSES.map((key) => (
              <option key={key} value={key}>{`${so.status[key]} (${counts[key]})`}</option>
            ))}
          </AgentSelect>
        </div>
        <span className="awr-count" aria-live="polite">
          {interpolate(so.count, { n: results.length })}
        </span>
      </div>
      <div className="awr-results">
        <div className="awr-table-card">
          <WebTable
            label={t.selfOwnerWeb.contracts}
            columns={columns}
            rows={shown}
            rowKey={(r) => r.roomId}
            status="ready"
            filtered={filtered}
            onClearFilters={clearAll}
            empty={{ title: so.empty }}
            onRowPress={(r) => setSelected(r.roomId)}
            rowLabel={(r) => `${so.viewDetail} ${r.roomTitle}`}
            testID="self-owner-contracts-table"
          />
        </div>
      </div>
      <SelfOwnerWebPager current={current} pages={pages} total={results.length} size={size} onPage={goToPage} />
      {open ? <SelfOwnerRoomContractsDialog room={open} all={contracts} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
