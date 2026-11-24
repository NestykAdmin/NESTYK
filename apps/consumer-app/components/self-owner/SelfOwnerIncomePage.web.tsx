import React, { useMemo, useState } from "react";
import { useLocale } from "@nestyk/i18n";
import { MobileIcon } from "@nestyk/ui/native";
import { interpolate } from "@nestyk/feature-listing";
import { AgentSelect } from "../agent-web/AgentSelect";
import { WebTable, type WebTableColumn } from "../agent-web/ui/WebTable";
import { StatusBadge } from "../agent-web/ui/StatusBadge";
import type { StatusIntent } from "../agent-web/ui/statusIntent";
import { SELF_OWNER_LOCALE_TAG, summarizeRent } from "../../lib/self-owner-dashboard";
import { selfOwnerRentForMonth, type SelfOwnerRent, type SelfOwnerRentState } from "../../lib/self-owner-contracts";
import type { SelfOwnerIncomePageProps } from "./SelfOwnerIncomePage.types";
import "../agent-web/agent-rooms.css";
import "./self-owner-rooms.css";

export const RENT_STATE_INTENT: Record<SelfOwnerRentState, StatusIntent> = { paid: "done", due: "neutral", overdue: "crit" };

/** Index of `month` in `months`, else the last (this month). */
export function monthIndex(months: SelfOwnerIncomePageProps["months"], month?: SelfOwnerIncomePageProps["initialMonth"]): number {
  const found = month ? months.findIndex((m) => m.year === month.year && m.month === month.month) : -1;
  return found >= 0 ? found : Math.max(0, months.length - 1);
}

/**
 * Self owner income web page (UI round, 24 Nov 2026, ClickUp z8rcteng6f): which rooms paid this month's rent and which
 * have not. Read only; demo data until the admin side and its API exist. Same rows as the Dashboard's rent section.
 */
export function SelfOwnerIncomePage({ contracts, months, isDemoPreview, initialMonth, now }: SelfOwnerIncomePageProps) {
  const { t, locale } = useLocale();
  const inc = t.selfOwnerIncome;
  const shared = t.selfOwnerDashboard;
  const tag = SELF_OWNER_LOCALE_TAG[locale as keyof typeof SELF_OWNER_LOCALE_TAG] ?? SELF_OWNER_LOCALE_TAG.th;
  const [index, setIndex] = useState(() => monthIndex(months, initialMonth));
  const shownMonth = months[index] ?? months[months.length - 1];
  const rows = useMemo(
    () => (shownMonth ? selfOwnerRentForMonth(contracts, shownMonth.year, shownMonth.month, now) : []),
    [contracts, shownMonth, now],
  );
  const sum = summarizeRent(rows);
  const money = (amount: number) => t.agent.listings.rentAmount.replace("{price}", amount.toLocaleString(tag));
  const day = (ymd: string) => new Date(`${ymd}T00:00:00+07:00`).toLocaleDateString(tag, { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
  const nameOf = (m: { year: number; month: number }) =>
    new Date(Date.UTC(m.year, m.month - 1, 15)).toLocaleDateString(tag, { month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
  const monthLabel = shownMonth ? nameOf(shownMonth) : "";
  const stateText = (row: SelfOwnerRent) => (row.state === "overdue" ? interpolate(inc.overdue, { n: row.overdueDays ?? 0 }) : inc[row.state]);

  const columns: WebTableColumn<SelfOwnerRent>[] = [
    // The room name wraps like the contracts table, so a long name does not push the status column out of the card;
    // the project sits under it, as on the contracts page (rooms can be in several projects, Jom 24 Nov 2026).
    {
      key: "room",
      header: inc.colRoom,
      cell: (r) => (
        <span className="awr-room">
          <strong title={r.roomTitle}>{r.roomTitle}</strong>
          <small>{r.project}</small>
        </span>
      ),
    },
    { key: "tenant", header: inc.colTenant, cell: (r) => <span className="awr-nowrap">{r.tenantName}</span> },
    { key: "amount", header: inc.colAmount, align: "end", cell: (r) => <span className="awr-price">{money(r.amount)}</span> },
    { key: "due", header: inc.colDue, hideBelow: "md", cell: (r) => <span className="awr-muted">{day(r.dueDate)}</span> },
    // The paid date has its own column (Jom 24 Nov 2026); "-" when the rent is not paid yet.
    { key: "paidAt", header: inc.colPaidAt, hideBelow: "md", cell: (r) => <span className="awr-muted">{r.paidAt ? day(r.paidAt) : "-"}</span> },
    {
      key: "status",
      header: inc.colStatus,
      cell: (r) => (
        <span className="sor-status-cell">
          <StatusBadge label={stateText(r)} intent={RENT_STATE_INTENT[r.state]} />
        </span>
      ),
    },
  ];


  const navButton = (label: string, icon: "chevron-left" | "chevron-right", next: number) => (
    <button
      type="button"
      className="soi-month-btn"
      aria-label={label}
      title={label}
      disabled={next < 0 || next >= months.length}
      onClick={() => setIndex(next)}
    >
      <MobileIcon name={icon} size={18} color="currentColor" />
    </button>
  );

  return (
    <div className="awr-page" data-testid="self-owner-income-page">
      {isDemoPreview ? (
        <div className="sor-head">
          <p className="sor-demo" role="note">
            <MobileIcon name="info" size={16} color="currentColor" />
            {shared.demoNote}
          </p>
        </div>
      ) : null}
      {/* Arrows step one month; the month itself is a dropdown, newest first (Jom 24 Nov 2026). */}
      <div className="soi-month">
        {navButton(inc.prevMonth, "chevron-left", index - 1)}
        <div className="awr-status-select">
          <AgentSelect aria-label={inc.month} value={String(index)} onChange={(event) => setIndex(Number(event.target.value))}>
            {months.map((m, i) => ({ m, i })).reverse().map(({ m, i }) => (
              <option key={`${m.year}-${m.month}`} value={String(i)}>{nameOf(m)}</option>
            ))}
          </AgentSelect>
        </div>
        {navButton(inc.nextMonth, "chevron-right", index + 1)}
      </div>
      <div className="soi-summary">
        {([
          [inc.summaryTotal, sum.total, ""],
          [inc.summaryReceived, sum.received, " is-received"],
          [inc.summaryOutstanding, sum.overdue, " is-overdue"],
        ] as const).map(([name, amount, tone]) => (
          <div key={name} className={`soi-tile${tone}`}>
            <span>{name}</span>
            <strong>{money(amount)}</strong>
          </div>
        ))}
      </div>
      <div className="awr-table-card">
        <WebTable
          label={monthLabel}
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          status="ready"
          empty={{ title: inc.empty }}
          testID="self-owner-income-table"
        />
      </div>
    </div>
  );
}
