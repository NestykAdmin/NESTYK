import React, { useMemo, useState } from "react";
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
  countSelfOwnerContracts,
  filterSelfOwnerContracts,
  type SelfOwnerContract,
  type SelfOwnerContractFilter,
  type SelfOwnerContractStatus,
} from "../../lib/self-owner-contracts";
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

/** Read-only contract details (web dialog). The owner cannot change or sign anything here (Jom 24 Nov 2026). */
export function SelfOwnerContractDetail({ contract, onClose }: { contract: SelfOwnerContract; onClose: () => void }) {
  const { t } = useLocale();
  const so = t.selfOwnerContracts;
  const { money, day } = useFormat();
  const rows: Array<[string, string]> = [
    [so.room, `${contract.roomTitle} · ${contract.project}`],
    [so.tenant, contract.tenantName],
    [so.phone, contract.tenantPhone],
    [so.startDate, day(contract.startDate)],
    [so.endDate, day(contract.endDate)],
    [so.monthlyRent, money(contract.monthlyRent)],
    [so.advanceRent, interpolate(so.monthsAmount, { months: contract.advanceRentMonths, amount: money(contract.monthlyRent * contract.advanceRentMonths) })],
    [so.deposit, interpolate(so.monthsAmount, { months: contract.depositMonths, amount: money(contract.monthlyRent * contract.depositMonths) })],
  ];
  return (
    <WebDialog
      open
      title={so.detailTitle}
      description={contract.roomTitle}
      onClose={onClose}
      testID="self-owner-contract-detail"
      footer={
        <button type="button" className="awu-btn" disabled aria-disabled="true" title={so.noDocument}>
          <MobileIcon name="file-text" size={16} color="currentColor" />
          {so.viewDocument}
        </button>
      }
    >
      <div className="soc-detail-status">
        <StatusBadge label={so.status[contract.status]} intent={CONTRACT_STATUS_INTENT[contract.status]} />
        {contract.daysLeft !== undefined ? <small>{interpolate(so.daysLeft, { n: contract.daysLeft })}</small> : null}
      </div>
      <dl className="soc-detail-list">
        {rows.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="soc-note">{so.readOnlyNote}</p>
    </WebDialog>
  );
}

/**
 * Self owner contracts web page (UI round, 24 Nov 2026, ClickUp z8rcteng6e): read only, like the "my rooms" table.
 * Contracts come from NESTYK admin in the future; demo data until then.
 */
export function SelfOwnerContractsPage({ contracts, isDemoPreview, initialFilter = "all", initialQuery = "" }: SelfOwnerContractsPageProps) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const so = t.selfOwnerContracts;
  const shared = t.selfOwnerDashboard;
  const { money, day } = useFormat();
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<SelfOwnerContractFilter>(initialFilter);
  const [selected, setSelected] = useState<string | null>(null);

  const counts = useMemo(() => countSelfOwnerContracts(contracts), [contracts]);
  const shown = useMemo(() => filterSelfOwnerContracts(contracts, query, filter), [contracts, query, filter]);
  const filtered = !!query.trim() || filter !== "all";
  const open = selected ? contracts.find((c) => c.id === selected) ?? null : null;
  const clearAll = () => {
    setQuery("");
    setFilter("all");
  };

  const columns: WebTableColumn<SelfOwnerContract>[] = [
    {
      key: "room",
      header: so.colRoom,
      cell: (c) => (
        <span className="awr-room">
          <strong title={c.roomTitle}>{c.roomTitle}</strong>
          <small>{c.project}</small>
        </span>
      ),
    },
    { key: "tenant", header: so.colTenant, cell: (c) => <span className="awr-nowrap">{c.tenantName}</span> },
    { key: "period", header: so.colPeriod, hideBelow: "md", cell: (c) => <span className="awr-nowrap">{interpolate(so.period, { start: day(c.startDate), end: day(c.endDate) })}</span> },
    { key: "rent", header: so.colRent, align: "end", cell: (c) => <span className="awr-price">{money(c.monthlyRent)}</span> },
    {
      key: "status",
      header: so.colStatus,
      cell: (c) => (
        <span className="sor-detail">
          <span className="sor-status-cell">
            <StatusBadge label={so.status[c.status]} intent={CONTRACT_STATUS_INTENT[c.status]} />
          </span>
          {c.daysLeft !== undefined ? <small>{interpolate(so.daysLeft, { n: c.daysLeft })}</small> : null}
        </span>
      ),
    },
  ];

  return (
    <div className="awr-page" data-testid="self-owner-contracts-page">
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
            onChange={(event) => setQuery(event.target.value)}
            data-testid="soc-search"
          />
        </label>
        <div className="awr-status-select">
          <AgentSelect aria-label={so.filterLabel} value={filter} onChange={(event) => setFilter(event.target.value as SelfOwnerContractFilter)}>
            <option value="all">{`${so.filterLabel}: ${so.filterAll} (${counts.all})`}</option>
            {STATUSES.map((key) => (
              <option key={key} value={key}>{`${so.status[key]} (${counts[key]})`}</option>
            ))}
          </AgentSelect>
        </div>
        <span className="awr-count" aria-live="polite">
          {interpolate(so.count, { n: shown.length })}
        </span>
      </div>
      <div className="awr-results">
        <div className="awr-table-card">
          <WebTable
            label={t.selfOwnerWeb.contracts}
            columns={columns}
            rows={shown}
            rowKey={(c) => c.id}
            status="ready"
            filtered={filtered}
            onClearFilters={clearAll}
            empty={{ title: so.empty }}
            onRowPress={(c) => setSelected(c.id)}
            rowLabel={(c) => `${so.viewDetail} ${c.roomTitle}`}
            testID="self-owner-contracts-table"
          />
        </div>
      </div>
      {open ? <SelfOwnerContractDetail contract={open} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
