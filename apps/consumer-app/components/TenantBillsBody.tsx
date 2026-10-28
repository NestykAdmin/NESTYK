import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocale } from "@nestyk/i18n";
import {
  MobileBottomSheet,
  MobileButton,
  MobileFilterChip,
  MobileIcon,
  MobileInput,
  MobileStatusPill,
  tokens,
  useMobileTheme,
  type MobileStatusPillToneKey,
} from "@nestyk/ui/native";
import type { AgentTenantBill, AgentTenantBillStatus, AgentTenantBilling } from "@nestyk/types";
import { billFormatters } from "../lib/bill-format";
import { billingTotals } from "../lib/tenant-detail";
import { DemoNotice, DetailCard, ps } from "./TenantDetailParts";

function bangkokToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

type LateFeeDocument = "invoice" | "receipt" | "payment-slip";

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
  onOpenLateFee,
  onIssueReceipt,
  onCreateLateFee,
  onReturnLateFee,
}: {
  billing: AgentTenantBilling | null;
  leaseActive: boolean;
  demo: boolean;
  onReview: (bill: AgentTenantBill) => void;
  onOpenLateFee?: (bill: AgentTenantBill, kind: LateFeeDocument) => void;
  onIssueReceipt?: (bill: AgentTenantBill) => void;
  onCreateLateFee?: (bill: AgentTenantBill, input: { amount: number; dueDate: string }) => Promise<void>;
  onReturnLateFee?: (bill: AgentTenantBill, reason: string) => Promise<void>;
}) {
  const { t, locale } = useLocale();
  const d = t.agent.tenants.detail;
  const { theme } = useMobileTheme();
  const fmt = billFormatters(locale);
  const [filter, setFilter] = useState<BillFilter>("all");
  const [creating, setCreating] = useState<AgentTenantBill | null>(null);
  const [returning, setReturning] = useState<AgentTenantBill | null>(null);
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const totals = billingTotals(billing);
  const bills = billing?.bills ?? [];

  if (!leaseActive && !bills.length && !billing?.upcoming) {
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
  function openCreate(bill: AgentTenantBill) {
    setAmount("");
    setDueDate(bangkokToday());
    setFormError("");
    setCreating(bill);
  }
  async function submitCreate() {
    if (!creating || busy) return;
    const raw = amount.replace(/,/g, "").trim();
    if (!/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) <= 0) {
      setFormError(d.lateFeeInvalidAmount);
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || dueDate < bangkokToday()) {
      setFormError(d.lateFeeInvalidDate);
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await onCreateLateFee?.(creating, { amount: Number(raw), dueDate });
      setCreating(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : d.lateFeeInvalidAmount);
    } finally {
      setBusy(false);
    }
  }
  async function submitReturn() {
    const submittedAt = returning?.lateFee?.slipSubmittedAt;
    if (!returning || !submittedAt || busy || !reason.trim()) return;
    setBusy(true);
    setFormError("");
    try {
      await onReturnLateFee?.(returning, reason.trim());
      setReturning(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : d.lateFeeInvalidAmount);
    } finally {
      setBusy(false);
    }
  }
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
              {bill.reservationCredit ? (
                <Text style={[ps.small, { color: theme.textSecondary }]}>
                  {d.billReservationDeduction
                    .replace("{rent}", fmt.amount(bill.reservationCredit.rent))
                    .replace("{credit}", fmt.amount(bill.reservationCredit.credit))}
                </Text>
              ) : null}
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
          {bill.lateDays > 0 || bill.lateFee ? (
            <View style={s.lateFee}>
              <Text style={[ps.small, { color: theme.textSecondary }]}>
                {d.lateFeeDays.replace("{days}", String(bill.lateDays))}
                {bill.lateFeePerDay != null ? ` · ${d.lateFeeRate.replace("{amount}", fmt.amount(bill.lateFeePerDay))}` : ""}
              </Text>
              {bill.lateFee ? (
                <>
                  <Text style={[ps.rowTitle, { color: theme.textHeading }]}>
                    {d.lateFeeTitle} · {fmt.amount(bill.lateFee.amount)}
                  </Text>
                  <Text style={[ps.small, { color: theme.textSecondary }]}>{bill.lateFee.documentNo}</Text>
                  {bill.lateFee.slipReturnReason ? (
                    <Text style={[ps.small, { color: tokens.colors.danger }]}>{bill.lateFee.slipReturnReason}</Text>
                  ) : null}
                  <MobileButton variant="outline" onPress={() => onOpenLateFee?.(bill, "invoice")}>{d.lateFeeView}</MobileButton>
                  {bill.lateFee.receiptIssued ? (
                    <MobileButton variant="outline" onPress={() => onOpenLateFee?.(bill, "receipt")}>{d.lateFeeReceiptView}</MobileButton>
                  ) : null}
                  {bill.lateFee.slipSubmitted && !bill.lateFee.receiptIssued ? (
                    <>
                      <MobileButton variant="outline" onPress={() => onOpenLateFee?.(bill, "payment-slip")}>{d.lateFeeSlip}</MobileButton>
                      <MobileButton variant="outline" onPress={() => { setReason(""); setFormError(""); setReturning(bill); }}>{d.lateFeeReturn}</MobileButton>
                      <MobileButton onPress={() => onIssueReceipt?.(bill)}>{d.lateFeeReceipt}</MobileButton>
                    </>
                  ) : null}
                </>
              ) : (
                <MobileButton onPress={() => openCreate(bill)}>{d.lateFeeCreate}</MobileButton>
              )}
            </View>
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
      <MobileBottomSheet visible={creating != null} onClose={() => { if (!busy) setCreating(null); }} avoidKeyboard>
        <View style={s.sheet}>
          <Text style={[ps.rowTitle, { color: theme.textHeading }]}>{d.lateFeeCreate}</Text>
          {creating ? (
            <Text style={[ps.small, { color: theme.textSecondary }]}>
              {d.lateFeeDays.replace("{days}", String(creating.lateDays))}
              {creating.lateFeePerDay != null ? ` · ${d.lateFeeRate.replace("{amount}", fmt.amount(creating.lateFeePerDay))}` : ""}
            </Text>
          ) : null}
          <Text style={[ps.small, { color: theme.textSecondary }]}>{d.lateFeeHint}</Text>
          <MobileInput label={d.lateFeeAmount} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" maxLength={12} required />
          <MobileInput label={d.lateFeeDue} value={dueDate} onChangeText={setDueDate} maxLength={10} required />
          {formError ? <Text style={[ps.small, { color: tokens.colors.danger }]}>{formError}</Text> : null}
          <MobileButton isLoading={busy} disabled={busy} onPress={() => void submitCreate()}>{d.lateFeeCreate}</MobileButton>
        </View>
      </MobileBottomSheet>
      <MobileBottomSheet visible={returning != null} onClose={() => { if (!busy) setReturning(null); }} avoidKeyboard>
        <View style={s.sheet}>
          <Text style={[ps.rowTitle, { color: theme.textHeading }]}>{d.lateFeeReturn}</Text>
          <MobileInput label={d.rejectReason} placeholder={d.rejectReasonPlaceholder} value={reason} onChangeText={setReason} multiline maxLength={500} required />
          {formError ? <Text style={[ps.small, { color: tokens.colors.danger }]}>{formError}</Text> : null}
          <MobileButton isLoading={busy} disabled={busy || !reason.trim()} onPress={() => void submitReturn()}>{d.lateFeeReturn}</MobileButton>
        </View>
      </MobileBottomSheet>
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
  lateFee: { gap: 8 },
  sheet: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  billHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  billSide: { alignItems: "flex-end", gap: 6 },
});
