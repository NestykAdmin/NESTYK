import React, { useState } from "react";
import { MobileFilterChip, MobileIcon, MobileStatusPill, STATUS_PILL_TONES, useMobileTheme, type MobileStatusPillTone } from "@nestyk/ui/native";
import { useLocale } from "@nestyk/i18n";
import type { AgentTenant } from "@nestyk/types";
import { billFormatters } from "../../lib/bill-format";
import { tenantLease } from "../../lib/tenant-detail";
import {
  groupByProperty,
  matchesDirectoryFilter as matchesFilter,
  tenantListStatus,
  type TenantDirectoryFilter,
} from "../../lib/tenant-work";
import { initials } from "../TenantDetailHub";
import { WORK_TONE } from "../TenantWorkBody";
import { WebState, WebTable, type WebTableColumn } from "./ui";
import type { TenantDirectoryTableProps } from "./TenantDirectoryTable.types";
import "./agent-rooms.css";
import "./agent-leads.css";
import "./agent-tenants.css";

/**
 * Agent web "All tenants" tab (W3, Mos 5 Nov 2026): search, the same status chips, then one table per project.
 * Same search, filters, grouping and status pills as `TenantDirectoryBody`; a row opens the same tenant page.
 */
export function TenantDirectoryTable({ tenants, items, loading, query, onQueryChange, filter, onFilterChange, onOpen, busy }: TenantDirectoryTableProps) {
  const { t, locale } = useLocale();
  const c = t.agent.tenants;
  const l = c.list;
  const web = l.web;
  const { theme } = useMobileTheme();
  const fmt = billFormatters(locale);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const needle = query.trim().toLowerCase();
  const visible = tenants.filter(
    (tenant) =>
      matchesFilter(tenant, filter) &&
      `${tenant.name} ${tenant.phone} ${tenant.property} ${tenant.room ?? ""} ${tenant.contracts.map((x) => `${x.property} ${x.room ?? ""} ${x.contractNo}`).join(" ")}`
        .toLowerCase()
        .includes(needle),
  );
  const groups = groupByProperty(visible, locale);
  const filters: Array<{ key: TenantDirectoryFilter; label: string }> = [
    { key: "all", label: l.filterAll },
    { key: "signing", label: l.filterSigning },
    { key: "active", label: l.filterActive },
  ];

  // Same rules and words as TenantDirectoryBody.status.
  const status = (tenant: AgentTenant): { label: string; tone: MobileStatusPillTone } => {
    const kind = tenantListStatus(tenant, items);
    if (kind === "slip") return { label: l.pillSlip, tone: WORK_TONE.slip };
    if (kind === "signing") {
      const signed = items.some(
        (item) => item.kind === "signing" && item.tenant.id === tenant.id && item.contract.status === "awaiting_agent_review",
      );
      return { label: signed ? l.pillConfirm : l.tileSigning, tone: WORK_TONE.signing };
    }
    if (kind === "renewal") {
      const renewal = items.find((item) => item.kind === "renewal" && item.tenant.id === tenant.id);
      const days = renewal?.kind === "renewal" ? renewal.daysLeft : 0;
      return { label: days === 0 ? l.pillRenewalToday : l.pillRenewal.replace("{days}", String(days)), tone: WORK_TONE.renewal };
    }
    if (kind === "active") return { label: l.pillActive, tone: STATUS_PILL_TONES.green };
    if (kind === "ended") return { label: l.pillEnded, tone: STATUS_PILL_TONES.slate };
    return { label: l.pillSigningContract, tone: STATUS_PILL_TONES.slate };
  };

  const toggle = (property: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(property)) next.delete(property);
      else next.add(property);
      return next;
    });

  const columns: WebTableColumn<AgentTenant>[] = [
    {
      key: "tenant",
      header: web.colTenant,
      cell: (tenant) => (
        <span className="awl-lead">
          <span className="awt-avatar" aria-hidden="true">
            {initials(tenant.name)}
          </span>
          <span className="awr-room">
            <strong>{tenant.name}</strong>
            {tenant.phone ? <small>{tenant.phone}</small> : null}
          </span>
        </span>
      ),
    },
    {
      key: "room",
      header: web.colUnit,
      // Fixed widths: one table per project, so the columns line up from group to group.
      width: "28%",
      hideBelow: "md",
      cell: (tenant) => <span className="awr-nowrap">{tenant.room ? l.metaRoom.replace("{room}", tenant.room) : "—"}</span>,
    },
    {
      key: "rent",
      header: web.colRent,
      width: "140px",
      align: "end",
      cell: (tenant) => {
        const rent = tenantLease(tenant)?.monthlyRent;
        return rent ? <span className="awr-price">{fmt.amount(rent)}</span> : <span className="awr-none">—</span>;
      },
    },
    {
      key: "status",
      header: web.colStatus,
      width: "200px",
      cell: (tenant) => {
        const pill = status(tenant);
        return <MobileStatusPill label={pill.label} tone={pill.tone} />;
      },
    },
  ];

  return (
    <div className="awt-page" data-testid="tenants.all">
      <div className="awr-toolbar">
        <label className="awr-search">
          <MobileIcon name="search" size={18} color={theme.textSecondary} />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={l.searchAll}
            aria-label={l.searchAll}
            data-testid="tenants.search"
          />
        </label>
        <div className="awl-status-row" role="group" aria-label={web.colStatus}>
          {filters.map((item) => (
            <MobileFilterChip
              key={item.key}
              label={item.label}
              count={loading ? "–" : tenants.filter((tenant) => matchesFilter(tenant, item.key)).length}
              selected={filter === item.key}
              onPress={() => onFilterChange(item.key)}
            />
          ))}
        </div>
        <span className="awr-count" aria-live="polite">
          {loading ? " " : l.showing.replace("{shown}", String(visible.length)).replace("{total}", String(tenants.length))}
        </span>
      </div>

      {loading && !tenants.length ? (
        <div className="awr-table-card">
          <WebTable label={web.tableAll} columns={columns} rows={[]} rowKey={(tenant) => tenant.id} status="loading" skeletonRows={6} />
        </div>
      ) : !visible.length ? (
        <div className="awr-table-card">
          {needle || filter !== "all" ? (
            <WebState
              kind="filtered"
              onClearFilters={() => {
                onQueryChange("");
                onFilterChange("all");
              }}
            />
          ) : (
            <WebState kind="empty" title={t.common.noData} />
          )}
        </div>
      ) : (
        groups.map((group) => {
          const open = !collapsed.has(group.property);
          const name = group.property || l.noProject;
          return (
            <section key={group.property} className="awt-group">
              <button
                type="button"
                className="awt-group-head"
                aria-expanded={open}
                aria-label={l.groupToggle.replace("{property}", name).replace("{count}", String(group.tenants.length))}
                onClick={() => toggle(group.property)}
              >
                <MobileIcon name={open ? "chevron-down" : "chevron-right"} size={16} color="currentColor" />
                <strong>{name}</strong>
                <small>{l.groupCount.replace("{count}", String(group.tenants.length))}</small>
              </button>
              {open ? (
                <div className="awr-table-card">
                  <WebTable
                    label={`${web.tableAll}: ${name}`}
                    columns={columns}
                    rows={group.tenants}
                    rowKey={(tenant) => tenant.id}
                    onRowPress={busy ? undefined : (tenant) => onOpen(tenant)}
                    testID="tenants.table"
                  />
                </div>
              ) : null}
            </section>
          );
        })
      )}
    </div>
  );
}
