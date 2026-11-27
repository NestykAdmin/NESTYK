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
  applySelfOwnerSignatures,
  selfOwnerContractStore,
  selfOwnerToday,
  type SelfOwnerContract,
  type SelfOwnerContractFilter,
  type SelfOwnerContractStatus,
  type SelfOwnerRoomContracts,
  type SelfOwnerSignResult,
} from "../../lib/self-owner-contracts";
import { contractDetailView, contractParty } from "./contract-detail-rows";
import { SelfOwnerWebPager } from "./SelfOwnerWebPager";
import { SELF_OWNER_ROOMS_WEB_PAGE_SIZE, clampPage } from "../../lib/self-owner-rooms";
import type { SelfOwnerContractsPageProps } from "./SelfOwnerContractsPage.types";
import { SelfOwnerContractSigning } from "./SelfOwnerContractSigning.web";
import { SelfOwnerContractSignFlow } from "./SelfOwnerContractSignFlow.web";
import { SelfOwnerContractDocument } from "./SelfOwnerContractDocument.web";
import { useStepSlide } from "./useStepSlide";
import { FadeIn } from "./FadeIn.web";
import { selfOwnerDocumentLoader, selfOwnerHasDocument } from "./document-loader";
import "../agent-web/agent-rooms.css";
import "./self-owner-rooms.css";

const STATUSES: SelfOwnerContractStatus[] = ["awaiting_signature", "processing", "ending_soon", "active", "ended"];
export const CONTRACT_STATUS_INTENT: Record<SelfOwnerContractStatus, StatusIntent> = {
  active: "done",
  ending_soon: "attn",
  awaiting_signature: "prog",
  processing: "prog",
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
  onSign,
  isDemoPreview = true,
  loadDocument = selfOwnerDocumentLoader,
  initialContractId = null,
  initialSigning = false,
  initialView,
  now,
}: {
  room: SelfOwnerRoomContracts;
  /** Every contract, to find the one a renewal renews. */
  all: SelfOwnerContract[];
  onClose: () => void;
  /** The owner signs a contract awaiting signatures; `ok: false` keeps the sign page open with its message. */
  onSign: (contractId: string, signaturePng: string) => Promise<SelfOwnerSignResult> | SelfOwnerSignResult | void;
  /** Demo contracts: sample-file and "not saved" notes, the bundled sample files; the API has neither. */
  isDemoPreview?: boolean;
  /** The URL of a contract's file (a fresh one on every call). */
  loadDocument?: (contractId: string) => Promise<string>;
  initialContractId?: string | null;
  /** Opens the sign page of the initial contract (tests). */
  initialSigning?: boolean;
  /** Opens the initial contract's file (tests). */
  initialView?: "document";
  /** "Today" for the progress bar; defaults to now. */
  now?: Date;
}) {
  const { t } = useLocale();
  const so = t.selfOwnerContracts;
  const fmt = useFormat();
  const [selectedId, setSelectedIdState] = useState<string | null>(initialContractId);
  // The separate sign page (option B, Jom 25 Nov 2026) and the contract file replace the detail in this dialog.
  const [mode, setMode] = useState<"detail" | "sign" | "document">(initialSigning ? "sign" : initialView ?? "detail");
  const setSigning = (on: boolean) => setMode(on ? "sign" : "detail");
  const setSelectedId = (id: string | null) => {
    setMode("detail");
    setSelectedIdState(id);
  };
  const open = selectedId ? room.contracts.find((c) => c.id === selectedId) ?? null : null;
  // The list, a contract, then its file or sign page: the new content fades in where the dialog stays (Jom 25 Nov 2026).
  const screen = !open ? 0 : mode === "detail" ? 1 : 2;
  const slide = useStepSlide(screen);
  const screenKey = open ? `${mode}:${open.id}` : "list";
  const period = (c: SelfOwnerContract) => interpolate(so.period, { start: fmt.day(c.startDate), end: fmt.day(c.endDate) });

  const hasFile = open ? selfOwnerHasDocument(open.id, isDemoPreview) : false;
  if (open && hasFile && mode === "document") {
    return (
      <WebDialog open size="lg" title={so.viewDocument} description={`${so.kind[open.kind]} · ${open.roomTitle}`} onClose={onClose} testID="self-owner-contract-document">
        <FadeIn key={screenKey} active={slide !== null}>
          <button type="button" className="soc-back" data-testid="soc-back" onClick={() => setMode("detail")}>
            <MobileIcon name="chevron-left" size={16} color="currentColor" />
            {so.back}
          </button>
          {isDemoPreview ? (
            <p className="soc-pad-demo" role="note">
              <MobileIcon name="info" size={14} color="currentColor" />
              {so.sampleDocument}
            </p>
          ) : null}
          <SelfOwnerContractDocument load={() => loadDocument(open.id)} />
        </FadeIn>
      </WebDialog>
    );
  }
  if (open && mode === "sign") {
    return (
      <WebDialog open size="lg" title={so.signAction} description={`${so.kind[open.kind]} · ${open.roomTitle}`} onClose={onClose} testID="self-owner-contract-sign">
        <FadeIn key={screenKey} active={slide !== null}>
          <button type="button" className="soc-back" data-testid="soc-back" onClick={() => setSigning(false)}>
            <MobileIcon name="chevron-left" size={16} color="currentColor" />
            {so.back}
          </button>
          <SelfOwnerContractSignFlow key={open.id} contract={open} all={all} fmt={fmt} today={selfOwnerToday(now)} onSign={onSign} isDemoPreview={isDemoPreview} loadDocument={loadDocument} onDone={() => setSigning(false)} />
        </FadeIn>
      </WebDialog>
    );
  }
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
          <button
            type="button"
            className="awu-btn"
            data-testid="soc-document"
            disabled={!hasFile}
            aria-disabled={!hasFile}
            title={!hasFile ? so.noDocument : undefined}
            onClick={() => setMode("document")}
          >
            <MobileIcon name="file-text" size={16} color="currentColor" />
            {so.viewDocument}
          </button>
        }
      >
        <FadeIn key={screenKey} active={slide !== null}>
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
          {/* Who signs, last before the note; "ลงนามสัญญา" opens the sign page (Jom 25 Nov 2026, option B). */}
          <SelfOwnerContractSigning contract={open} day={fmt.day} onStart={() => setSigning(true)} />
          <p className="soc-note soc-readonly">
            <MobileIcon name="lock" size={14} color="currentColor" />
            {so.readOnlyNote}
          </p>
        </FadeIn>
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
      <FadeIn key={screenKey} active={slide !== null}>
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
      </FadeIn>
    </WebDialog>
  );
}

/**
 * Self owner contracts web page: one row per room (contract kinds, Jom 24 Nov 2026), showing the room's current
 * contract; a row opens every contract of that room. Read only; contracts come from NESTYK admin, demo data until then.
 */
export function SelfOwnerContractsPage({ contracts, isDemoPreview, initialFilter = "all", initialQuery = "", initialPage = 1, status = "demo", onRetry, initialSignedOn }: SelfOwnerContractsPageProps) {
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

  // The owner's signatures of this session (demo, Jom 25 Nov 2026): the row, the room's list and the detail follow them.
  const [signedOn, setSignedOn] = useState<Record<string, string>>(() => initialSignedOn ?? {});
  const withSignatures = useMemo(() => applySelfOwnerSignatures(contracts, signedOn, selfOwnerToday()), [contracts, signedOn]);
  // Demo: the signature is kept on this page only. Connected: the API signs, the store holds the answer; any failure
  // comes back as `ok: false` with a message the sign page shows (a technical English message becomes the Thai one).
  const sign = async (contractId: string, signaturePng: string): Promise<SelfOwnerSignResult> => {
    if (isDemoPreview) {
      setSignedOn((previous) => ({ ...previous, [contractId]: selfOwnerToday() }));
      return { ok: true };
    }
    return selfOwnerContractStore.sign(contractId, signaturePng, so.signFailed);
  };
  const rooms = useMemo(() => groupSelfOwnerContracts(withSignatures), [withSignatures]);
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
  // Counts and the pager only once the contracts are in (no "0 rooms" while loading or after an error).
  const ready = status !== "loading" && status !== "error";
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
    <div className="awr-page so-skeleton-delay" ref={rootRef} data-testid="self-owner-contracts-page">
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
        {/* The dropdown sits at the right and there is no room count, like the income page (Jom 25 Nov 2026). */}
        <div className="awr-status-select so-filter-end">
          <AgentSelect
            aria-label={so.filterLabel}
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as SelfOwnerContractFilter);
              setPage(1);
            }}
          >
            <option value="all">{ready ? `${so.filterLabel}: ${so.filterAll} (${counts.all})` : `${so.filterLabel}: ${so.filterAll}`}</option>
            {STATUSES.map((key) => (
              <option key={key} value={key}>{ready ? `${so.status[key]} (${counts[key]})` : so.status[key]}</option>
            ))}
          </AgentSelect>
        </div>
      </div>
      <div className="awr-results">
        <div className="awr-table-card">
          <WebTable
            label={t.selfOwnerWeb.contracts}
            columns={columns}
            rows={shown}
            rowKey={(r) => r.roomId}
            status={status === "loading" ? "loading" : status === "error" ? "error" : "ready"}
            onRetry={onRetry}
            skeletonRows={6}
            filtered={filtered}
            onClearFilters={clearAll}
            empty={{ title: so.empty }}
            onRowPress={(r) => setSelected(r.roomId)}
            rowLabel={(r) => `${so.viewDetail} ${r.roomTitle}`}
            testID="self-owner-contracts-table"
          />
        </div>
      </div>
      {ready ? <SelfOwnerWebPager current={current} pages={pages} total={results.length} size={size} onPage={goToPage} /> : null}
      {open ? <SelfOwnerRoomContractsDialog room={open} all={withSignatures} onClose={() => setSelected(null)} onSign={sign} isDemoPreview={isDemoPreview} /> : null}
    </div>
  );
}
