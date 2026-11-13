import React from "react";
import { MobileIcon, MobileStatusPill, useMobileTheme, type AppIconName } from "@nestyk/ui/native";
import { useLocale } from "@nestyk/i18n";
import { billFormatters } from "../../lib/bill-format";
import { tenantLease } from "../../lib/tenant-detail";
import { TENANT_WORK_KINDS, workCounts, type TenantWorkItem, type TenantWorkKind } from "../../lib/tenant-work";
import { WORK_TONE } from "../TenantWorkBody";
import { WebTable, type WebTableColumn } from "./ui";
import type { TenantWorkTableProps } from "./TenantWorkTable.types";
import "./agent-rooms.css";
import "./agent-tenants.css";

const WORK_ICON: Record<TenantWorkKind, AppIconName> = {
  slip: "file-text",
  overdue: "warning",
  signing: "pencil",
  renewal: "calendar",
};

const itemKey = (item: TenantWorkItem) =>
  item.kind === "slip" ? `slip-${item.bill.id}` : item.kind === "signing" ? `sign-${item.contract.id}` : `${item.kind}-${item.tenant.id}`;

/**
 * Agent web "To do" tab (W3, Mos 5 Nov 2026): the four tiles in one row, then a table of open work. Same items, tiles,
 * wording, filter and buttons as `TenantWorkBody`; the row opens the tenant and the button opens the same section.
 */
export function TenantWorkTable({ items, kind, onKindChange, query, onQueryChange, onOpenTenant, onAction, busy }: TenantWorkTableProps) {
  const { t, locale } = useLocale();
  const l = t.agent.tenants.list;
  const web = l.web;
  const { theme } = useMobileTheme();
  const fmt = billFormatters(locale);
  const counts = workCounts(items);

  const label: Record<TenantWorkKind, string> = {
    slip: l.tileSlip,
    overdue: l.tileOverdue,
    signing: l.tileSigning,
    renewal: l.tileRenewal,
  };
  const hint = (k: TenantWorkKind) => {
    if (k === "overdue") return l.tileOverdueHint;
    const first = items.find((item) => item.kind === k);
    if (!first) return l.tileNone;
    if (first.kind === "signing")
      return l.tileSigningHint.replace("{signed}", String(first.signed)).replace("{required}", String(first.required));
    if (first.kind === "renewal") return l.tileRenewalHint.replace("{days}", String(first.daysLeft));
    return l.tileSlipHint;
  };
  const pill = (item: TenantWorkItem) =>
    item.kind === "slip"
      ? l.pillSlip
      : item.kind === "signing"
        ? item.contract.status === "awaiting_agent_review"
          ? l.pillConfirm
          : l.pillSigning.replace("{signed}", String(item.signed)).replace("{required}", String(item.required))
        : item.kind === "renewal"
          ? item.daysLeft < 0
            ? l.pillRenewalLate
            : item.daysLeft === 0
              ? l.pillRenewalToday
              : l.pillRenewal.replace("{days}", String(item.daysLeft))
          : l.tileOverdue;
  const detail = (item: TenantWorkItem) => {
    const lease = tenantLease(item.tenant);
    return item.kind === "slip"
      ? l.metaRent.replace("{amount}", fmt.amount(item.bill.amount))
      : item.kind === "signing"
        ? item.contract.agreementTypeName
        : item.kind === "renewal" && item.contract.endDate
          ? l.metaUntil.replace("{date}", fmt.date(item.contract.endDate))
          : lease?.monthlyRent
            ? l.metaRent.replace("{amount}", fmt.amount(lease.monthlyRent))
            : null;
  };
  const cta: Record<TenantWorkKind, string> = {
    slip: l.ctaSlip,
    overdue: l.ctaSlip,
    signing: l.ctaSigning,
    renewal: l.ctaRenewal,
  };

  const needle = query.trim().toLowerCase();
  const visible = items.filter(
    (item) =>
      (!kind || item.kind === kind) &&
      `${item.tenant.name} ${item.tenant.property} ${item.tenant.room ?? ""}`.toLowerCase().includes(needle),
  );

  const columns: WebTableColumn<TenantWorkItem>[] = [
    {
      key: "work",
      header: web.colWork,
      cell: (item) => {
        const tone = WORK_TONE[item.kind];
        return (
          <span className="awt-work">
            <span className="awt-work-icon" style={{ background: tone.bg, color: tone.fg }} aria-hidden="true">
              <MobileIcon name={WORK_ICON[item.kind]} size={18} color={tone.fg} />
            </span>
            <MobileStatusPill label={pill(item)} tone={tone} />
          </span>
        );
      },
    },
    {
      key: "tenant",
      header: web.colTenant,
      cell: (item) => (
        <span className="awr-room">
          <strong>{item.tenant.name}</strong>
          {item.tenant.phone ? <small>{item.tenant.phone}</small> : null}
        </span>
      ),
    },
    {
      key: "room",
      header: web.colRoom,
      hideBelow: "md",
      cell: (item) => (
        <span className="awr-room">
          <span>{item.tenant.property || l.noProject}</span>
          {item.tenant.room ? <small>{l.metaRoom.replace("{room}", item.tenant.room)}</small> : null}
        </span>
      ),
    },
    { key: "detail", header: web.colDetail, hideBelow: "lg", cell: (item) => <span className="awr-muted">{detail(item) ?? "—"}</span> },
    {
      key: "action",
      header: "",
      align: "end",
      cell: (item) => (
        <button
          type="button"
          className="awu-btn awt-cta"
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            onAction(item);
          }}
        >
          {cta[item.kind]}
        </button>
      ),
    },
  ];

  return (
    <div className="awt-page" data-testid="tenants.work">
      <div className="awt-tiles" role="group" aria-label={web.tableWork}>
        {TENANT_WORK_KINDS.map((k) => {
          const tone = WORK_TONE[k];
          const selected = kind === k;
          const disabled = k === "overdue";
          return (
            <button
              key={k}
              type="button"
              className={`awt-tile${selected ? " is-selected" : ""}`}
              disabled={disabled}
              aria-pressed={selected}
              aria-label={`${label[k]} ${counts[k]}, ${hint(k)}`}
              onClick={() => onKindChange(selected ? null : k)}
            >
              <span className="awt-tile-top">
                <span className="awt-work-icon" style={{ background: tone.bg }} aria-hidden="true">
                  <MobileIcon name={WORK_ICON[k]} size={18} color={tone.fg} />
                </span>
                <span className="awt-tile-count" style={{ color: disabled ? theme.textSecondary : tone.fg }}>
                  {counts[k]}
                </span>
              </span>
              <strong>{label[k]}</strong>
              <small>{hint(k)}</small>
            </button>
          );
        })}
      </div>

      <div className="awt-list-head">
        <h2>{l.workTitle}</h2>
        <small>{l.workSort}</small>
      </div>
      {kind ? (
        <div className="awt-filtered" role="status">
          <span>{l.workFiltered.replace("{label}", label[kind])}</span>
          <button type="button" className="awr-clear" onClick={() => onKindChange(null)}>
            {l.showAllWork}
          </button>
        </div>
      ) : null}
      <div className="awr-toolbar">
        <label className="awr-search">
          <MobileIcon name="search" size={18} color={theme.textSecondary} />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={l.searchWork}
            aria-label={l.searchWork}
            data-testid="tenants.workSearch"
          />
        </label>
      </div>

      <div className="awr-table-card">
        <WebTable
          label={web.tableWork}
          columns={columns}
          rows={visible}
          rowKey={itemKey}
          filtered={!!kind || !!needle}
          onClearFilters={() => {
            onKindChange(null);
            onQueryChange("");
          }}
          empty={{ title: l.workEmpty }}
          onRowPress={busy ? undefined : (item) => onOpenTenant(item)}
          testID="tenants.workTable"
        />
      </div>
    </div>
  );
}
