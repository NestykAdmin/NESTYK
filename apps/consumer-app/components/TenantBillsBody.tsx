import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocale } from "@nestyk/i18n";
import {
  MobileButton,
  MobileFilterChip,
  MobileIcon,
  MobileStatusPill,
  tokens,
  useMobileTheme,
  type MobileStatusPillToneKey,
} from "@nestyk/ui/native";
import type { AgentTenantBill, AgentTenantBillStatus, AgentTenantBilling } from "@nestyk/types";
import { billFormatters } from "../lib/bill-format";
import { billingTotals } from "../lib/tenant-detail";
import { DemoNotice, DetailCard, ps } from "./TenantDetailParts";

type BillFilter = "all" | "outstanding" | "awaiting" | "paid";

const STATUS_TONE: Record<AgentTenantBillStatus, MobileStatusPillToneKey> = {
  pending: "blue",
  awaiting_review: "yellow",
  overdue: "red",
  paid: "green",
};

const matches = (bill: AgentTenantBill, filter: BillFilter) =>
  filter === "all" ||
  (filter === "outstanding" && (bill.status === "pending" || bill.status === "overdue")) ||
  (filter === "awaiting" && bill.status === "awaiting_review") ||
  (filter === "paid" && bill.status === "paid");

/** Rent bills for one tenant: totals, filters, the next bill to come, then each issued bill. */
export function TenantBillsBody({
  billing,
  leaseActive,
  demo,
  onReview,
}: {
  billing: AgentTenantBilling | null;
  leaseActive: boolean;
  demo: boolean;
  onReview: (bill: AgentTenantBill) => void;
}) {
  const { t, locale } = useLocale();
  const d = t.agent.tenants.detail;
  const { theme } = useMobileTheme();
  const fmt = billFormatters(locale);
  const [filter, setFilter] = useState<BillFilter>("all");
  const totals = billingTotals(billing);
  const bills = billing?.bills ?? [];

  if (!leaseActive) {
    return (
      <View style={s.root}>
        <DetailCard>
          <Text style={[ps.body, { color: theme.textSecondary }]}>{d.billsNoLease}</Text>
        </DetailCard>
      </View>
    );
  }

  const statusLabel: Record<AgentTenantBillStatus, string> = {
    pending: d.statusPending,
    awaiting_review: d.statusAwaiting,
    overdue: d.statusOverdue,
    paid: d.statusPaid,
  };
  const filters: Array<{ key: BillFilter; label: string }> = [
    { key: "all", label: d.filterAll },
    { key: "outstanding", label: d.filterOutstanding },
    { key: "awaiting", label: d.filterAwaiting },
    { key: "paid", label: d.filterPaid },
  ];
  const visible = bills.filter((b) => matches(b, filter));
  const summary = [
    {
      key: "outstanding",
      label: d.billsOutstandingLabel,
      value: fmt.amount(totals.outstandingAmount),
      color: totals.outstandingAmount ? tokens.colors.danger : theme.textHeading,
    },
    {
      key: "awaiting",
      label: d.billsAwaitingLabel,
      value: fmt.amount(totals.awaitingAmount),
      color: totals.awaiting.length ? tokens.colors.brand[700] : theme.textHeading,
    },
    {
      key: "paid",
      label: d.billsPaidLabel,
      value: d.periodsCount.replace("{count}", String(totals.paidCount)),
      color: theme.textHeading,
    },
  ];

  return (
    <View style={s.root}>
      <View style={s.summary}>
        {summary.map((item) => (
          <DetailCard key={item.key} style={s.summaryTile}>
            <Text style={[ps.small, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={[ps.value, { color: item.color }]} numberOfLines={1} adjustsFontSizeToFit>
              {item.value}
            </Text>
          </DetailCard>
        ))}
      </View>

      <View style={s.filters}>
        {filters.map((item) => (
          <MobileFilterChip
            key={item.key}
            label={item.label}
            count={bills.filter((b) => matches(b, item.key)).length}
            selected={filter === item.key}
            onPress={() => setFilter(item.key)}
          />
        ))}
      </View>

      {filter === "all" && billing?.upcoming ? (
        <View style={[s.upcoming, { borderColor: theme.border }]}>
          <View style={ps.row}>
            <MobileIcon name="calendar" size={18} color={theme.textSecondary} />
            <Text style={[ps.rowTitle, ps.grow, { color: theme.textHeading }]}>
              {d.upcomingTitle.replace("{month}", fmt.month(billing.upcoming.period))}
            </Text>
            <Text style={[ps.value, { color: theme.textSecondary }]}>{fmt.amount(billing.upcoming.amount)}</Text>
          </View>
          <Text style={[ps.small, { color: theme.textSecondary }]}>
            {d.upcomingBody
              .replace("{issue}", fmt.date(billing.upcoming.issueDate))
              .replace("{due}", fmt.date(billing.upcoming.dueDate))}
          </Text>
        </View>
      ) : null}

      {visible.map((bill) => (
        <DetailCard key={bill.id} style={s.bill}>
          <View style={s.billHead}>
            <View style={ps.grow}>
              <Text style={[ps.rowTitle, { color: theme.textHeading }]}>
                {d.billRent.replace("{month}", fmt.month(bill.period))}
              </Text>
              <Text style={[ps.small, { color: theme.textSecondary }]}>
                {[bill.documentNo, d.billDue.replace("{date}", fmt.date(bill.dueDate))].join(" · ")}
              </Text>
              {bill.status === "awaiting_review" && bill.slipSubmittedAt ? (
                <Text style={[ps.small, { color: theme.textSecondary }]}>
                  {d.billSlipAt.replace("{date}", fmt.date(bill.slipSubmittedAt))}
                </Text>
              ) : null}
              {bill.status === "paid" && bill.paidAt ? (
                <Text style={[ps.small, { color: theme.textSecondary }]}>
                  {d.billPaidAt.replace("{date}", fmt.date(bill.paidAt))}
                </Text>
              ) : null}
            </View>
            <View style={s.billSide}>
              <Text style={[ps.amount, { color: theme.textHeading }]}>{fmt.amount(bill.amount)}</Text>
              <MobileStatusPill label={statusLabel[bill.status]} tone={STATUS_TONE[bill.status]} />
            </View>
          </View>
          {bill.status === "awaiting_review" ? (
            <MobileButton onPress={() => onReview(bill)}>{d.reviewSlip}</MobileButton>
          ) : null}
        </DetailCard>
      ))}

      {!visible.length ? (
        <DetailCard>
          <Text style={[ps.body, { color: theme.textSecondary, textAlign: "center" }]}>{d.billsEmpty}</Text>
        </DetailCard>
      ) : null}

      {filter === "all" && billing?.advancePeriods.length ? (
        <DemoNotice
          text={d.advanceNote.replace("{months}", billing.advancePeriods.map((p) => fmt.month(p)).join(", "))}
        />
      ) : null}

      {demo ? <DemoNotice text={d.demoNotice} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 14 },
  summary: { flexDirection: "row", gap: 10 },
  summaryTile: { flex: 1, padding: 12, gap: 2 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  upcoming: { borderWidth: 1.5, borderStyle: "dashed", borderRadius: 16, padding: 14, gap: 6 },
  bill: { gap: 12 },
  billHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  billSide: { alignItems: "flex-end", gap: 6 },
});
