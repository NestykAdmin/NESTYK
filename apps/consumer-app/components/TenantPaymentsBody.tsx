import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocale } from "@nestyk/i18n";
import { MobileButton, MobileIcon, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { AgentTenantBill, AgentTenantBilling } from "@nestyk/types";
import { billFormatters } from "../lib/bill-format";
import { billingTotals } from "../lib/tenant-detail";
import { DemoNotice, DetailCard, RIPPLE, SectionLabel, ps } from "./TenantDetailParts";

/** Money received from one tenant: totals, slips waiting for the agent, then the payment history. */
export function TenantPaymentsBody({
  billing,
  demo,
  notice,
  confirmingId,
  onConfirm,
  onViewSlip,
}: {
  billing: AgentTenantBilling | null;
  demo: boolean;
  notice: string;
  confirmingId: number | null;
  onConfirm: (bill: AgentTenantBill) => void;
  onViewSlip: (bill: AgentTenantBill) => void;
}) {
  const { t, locale } = useLocale();
  const d = t.agent.tenants.detail;
  const { theme, isDark } = useMobileTheme();
  const fmt = billFormatters(locale);
  const totals = billingTotals(billing);
  const payments = [...(billing?.payments ?? [])].sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  return (
    <View style={s.root}>
      <View style={s.summary}>
        <View style={s.summaryCol}>
          <Text style={s.summaryLabel}>{d.receivedTotal}</Text>
          <Text style={s.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
            {fmt.amount(totals.receivedAmount)}
          </Text>
          <Text style={s.summaryMeta}>{d.receivedCount.replace("{count}", String(payments.length))}</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryCol}>
          <Text style={s.summaryLabel}>{d.awaitingTotal}</Text>
          <Text style={[s.summaryValue, { color: tokens.colors.brand[500] }]} numberOfLines={1} adjustsFontSizeToFit>
            {fmt.amount(totals.awaitingAmount)}
          </Text>
          <Text style={s.summaryMeta}>{d.receivedCount.replace("{count}", String(totals.awaiting.length))}</Text>
        </View>
      </View>

      {!!notice && (
        <Text accessibilityRole="alert" style={[ps.body, { color: tokens.colors.success }]}>
          {notice}
        </Text>
      )}

      {totals.awaiting.map((bill) => (
        <DetailCard key={bill.id} style={{ borderColor: tokens.colors.brand[500] }}>
          <View style={s.slipHead}>
            <View style={ps.grow}>
              <Text style={[ps.rowTitle, { color: theme.textHeading }]}>
                {d.slipFor.replace("{month}", fmt.month(bill.period))}
              </Text>
              <Text style={[ps.small, { color: theme.textSecondary }]}>
                {d.slipBill.replace("{no}", bill.documentNo).replace("{amount}", fmt.amount(bill.amount))}
              </Text>
              {bill.slipSubmittedAt ? (
                <Text style={[ps.small, { color: theme.textSecondary }]}>
                  {d.slipSubmittedAt.replace("{date}", fmt.date(bill.slipSubmittedAt))}
                </Text>
              ) : null}
            </View>
            <Text style={[ps.amount, { color: theme.textHeading }]}>{fmt.amount(bill.amount)}</Text>
          </View>
          <Pressable
            onPress={() => onViewSlip(bill)}
            accessibilityRole="button"
            accessibilityLabel={d.viewSlip}
            android_ripple={RIPPLE}
            style={({ pressed }) => [
              s.slipImage,
              { borderColor: theme.border, backgroundColor: isDark ? "rgba(148,163,184,0.10)" : "#F1F5F9" },
              pressed && Platform.OS === "ios" ? ps.pressed : null,
            ]}
          >
            <MobileIcon name="camera" size={22} color={theme.textSecondary} />
            <Text style={[ps.small, { color: theme.textSecondary, textAlign: "center" }]}>{d.viewSlip}</Text>
          </Pressable>
          <MobileButton
            onPress={() => onConfirm(bill)}
            isLoading={confirmingId === bill.id}
            disabled={confirmingId != null}
          >
            {d.confirmPayment}
          </MobileButton>
        </DetailCard>
      ))}

      <SectionLabel>{d.history}</SectionLabel>
      {payments.length ? (
        <DetailCard style={s.history}>
          {payments.map((payment, index) => (
            <View
              key={payment.id}
              style={[
                s.historyRow,
                index < payments.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.border,
                },
              ]}
            >
              <View style={[s.paidIcon, { backgroundColor: isDark ? "rgba(34,197,94,0.18)" : "#DCFCE7" }]}>
                <MobileIcon name="check" size={16} color="#15803D" />
              </View>
              <View style={ps.grow}>
                <Text style={[ps.value, { color: theme.textHeading }]} numberOfLines={1}>
                  {payment.kind === "reservation" || !payment.period
                    ? d.reservationFee
                    : d.billRent.replace("{month}", fmt.month(payment.period))}
                </Text>
                <Text style={[ps.small, { color: theme.textSecondary }]} numberOfLines={1}>
                  {[
                    fmt.date(payment.paidAt),
                    payment.hasSlip ? d.hasSlip : null,
                    payment.receiptIssued ? d.receiptIssued : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <Text style={[ps.value, { color: theme.textHeading }]}>{fmt.amount(payment.amount)}</Text>
            </View>
          ))}
        </DetailCard>
      ) : (
        <DetailCard>
          <Text style={[ps.body, { color: theme.textSecondary, textAlign: "center" }]}>{d.historyEmpty}</Text>
        </DetailCard>
      )}

      {demo ? <DemoNotice text={d.demoNotice} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 14 },
  summary: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: tokens.colors.primary,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  summaryCol: { flex: 1, gap: 2, minWidth: 0 },
  summaryDivider: { width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.24)" },
  summaryLabel: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18, color: "#CBD5E1" },
  summaryValue: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 22,
    lineHeight: 33,
    color: tokens.colors.white,
  },
  summaryMeta: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18, color: "#CBD5E1" },
  slipHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  slipImage: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
  },
  history: { padding: 0, gap: 0 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  paidIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
