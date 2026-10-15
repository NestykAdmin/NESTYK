import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocale } from "@nestyk/i18n";
import { MobileBottomSheet, MobileIcon, MobileInput, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { AgentTenantBill, AgentTenantBilling } from "@nestyk/types";
import { billFormatters } from "../lib/bill-format";
import { openAgentRentSlip } from "../lib/tenant-bills-api";
import { billingTotals } from "../lib/tenant-detail";
import { isPdfDocumentUrl } from "./ContractDocumentPreview";
import { DemoNotice, DetailCard, RIPPLE, SectionLabel, ps } from "./TenantDetailParts";

function ActionButton({
  label,
  onPress,
  disabled,
  outline,
  danger,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  outline?: boolean;
  danger?: boolean;
  loading?: boolean;
}) {
  const { theme } = useMobileTheme();
  const backgroundColor = outline
    ? theme.surface
    : danger
      ? disabled
        ? "#FECACA"
        : tokens.colors.danger
      : disabled
        ? "#FEF3C7"
        : tokens.colors.brand[500];
  const color = danger && !outline ? tokens.colors.white : disabled ? "#D1D5DB" : tokens.colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      android_ripple={{ color: outline ? "rgba(248,182,21,0.28)" : "rgba(33,30,30,0.12)" }}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor,
          borderColor: outline ? tokens.colors.brand[500] : "transparent",
        },
        (disabled || loading) && s.buttonDisabled,
        pressed && Platform.OS === "ios" ? ps.pressed : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <Text style={[s.buttonLabel, { color }]}>{label}</Text>
      )}
    </Pressable>
  );
}

function SlipImage({ billId, label, onPress }: { billId: number; label: string; onPress: () => void }) {
  const { theme } = useMobileTheme();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    openAgentRentSlip(billId)
      .then(({ url: next }) => {
        if (!cancelled) setUrl(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [billId]);
  const pdf = !!url && isPdfDocumentUrl(url);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={RIPPLE}
      style={({ pressed }) => [s.slipImage, { borderColor: theme.border, backgroundColor: theme.background }, pressed && Platform.OS === "ios" ? ps.pressed : null]}
    >
      {pdf ? (
        <Text style={[ps.body, { color: theme.textHeading }]}>PDF</Text>
      ) : url ? (
        <Image
          pointerEvents="none"
          source={{ uri: url }}
          style={s.slipPhoto}
          contentFit="cover"
          accessibilityLabel={label}
        />
      ) : failed ? (
        <MobileIcon name="camera" size={22} color={theme.textSecondary} />
      ) : (
        <ActivityIndicator color={tokens.colors.brand[500]} />
      )}
    </Pressable>
  );
}

/** Money received from one tenant: totals, slips waiting for the agent, then the payment history. */
export function TenantPaymentsBody({
  billing,
  demo,
  notice,
  confirmingId,
  onConfirm,
  onReject,
  onViewSlip,
}: {
  billing: AgentTenantBilling | null;
  demo: boolean;
  notice: string;
  confirmingId: number | null;
  onConfirm: (bill: AgentTenantBill) => Promise<boolean | void> | boolean | void;
  onReject: (bill: AgentTenantBill, reason: string) => Promise<boolean | void> | boolean | void;
  onViewSlip: (bill: AgentTenantBill) => void;
}) {
  const { t, locale } = useLocale();
  const d = t.agent.tenants.detail;
  const { theme, isDark } = useMobileTheme();
  const fmt = billFormatters(locale);
  const totals = billingTotals(billing);
  const payments = [...(billing?.payments ?? [])].sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const [decision, setDecision] = useState<{ kind: "confirm" | "reject"; bill: AgentTenantBill } | null>(null);
  const [reason, setReason] = useState("");
  const openedAt = useRef(0);
  const busy = confirmingId != null;
  function ask(kind: "confirm" | "reject", bill: AgentTenantBill) {
    if (busy) return;
    setReason("");
    openedAt.current = Date.now();
    setDecision({ kind, bill });
  }
  async function submitDecision() {
    if (!decision || busy) return;
    if (decision.kind === "reject" && !reason.trim()) return;
    const ok = decision.kind === "confirm"
      ? await onConfirm(decision.bill)
      : await onReject(decision.bill, reason.trim());
    if (ok !== false) setDecision(null);
  }

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
        <DetailCard key={bill.id} style={s.slipCard}>
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
          <SlipImage billId={bill.id} label={d.viewSlip} onPress={() => onViewSlip(bill)} />
          <Text style={[ps.small, { color: theme.textSecondary, textAlign: "center" }]}>{d.viewSlip}</Text>
          <View style={s.actions}>
            <ActionButton outline label={d.rejectPayment} disabled={busy} onPress={() => ask("reject", bill)} />
            <ActionButton label={d.confirmPayment} disabled={busy} onPress={() => ask("confirm", bill)} />
          </View>
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
      <MobileBottomSheet
        visible={decision != null}
        onClose={() => {
          if (busy || Date.now() - openedAt.current < 400) return;
          setDecision(null);
        }}
        avoidKeyboard
      >
        <View style={s.sheet}>
          <View
            style={[
              s.sheetIcon,
              {
                backgroundColor:
                  decision?.kind === "reject" ? "rgba(220,38,38,0.12)" : tokens.colors.brand[100],
              },
            ]}
          >
            <MobileIcon
              name={decision?.kind === "reject" ? "warning" : "check"}
              size={22}
              color={decision?.kind === "reject" ? tokens.colors.danger : tokens.colors.primary}
            />
          </View>
          <Text style={[s.sheetTitle, { color: theme.textHeading }]}>
            {decision?.kind === "reject" ? d.rejectPaymentTitle : d.confirmPaymentTitle}
          </Text>
          <Text style={[s.sheetBody, { color: theme.textSecondary }]}>
            {decision?.kind === "reject" ? d.rejectPaymentBody : d.confirmPaymentBody}
          </Text>
          {decision ? (
            <View style={[s.sheetBill, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Text style={[s.sheetBillTitle, { color: theme.textHeading }]}>
                {d.slipFor.replace("{month}", fmt.month(decision.bill.period))}
              </Text>
              <Text style={[s.sheetAmount, { color: theme.textHeading }]}>
                {fmt.amount(decision.bill.amount)}
              </Text>
              <Text style={[s.sheetMeta, { color: theme.textSecondary }]}>{decision.bill.documentNo}</Text>
            </View>
          ) : null}
          {decision?.kind === "reject" ? (
            <MobileInput
              label={d.rejectReason}
              placeholder={d.rejectReasonPlaceholder}
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={500}
              required
            />
          ) : null}
          <View style={s.sheetActions}>
            <ActionButton outline label={t.common.cancel} disabled={busy} onPress={() => setDecision(null)} />
            <ActionButton
              danger={decision?.kind === "reject"}
              label={decision?.kind === "reject" ? d.rejectPayment : d.confirmPayment}
              loading={busy}
              disabled={busy || (decision?.kind === "reject" && !reason.trim())}
              onPress={() => void submitDecision()}
            />
          </View>
        </View>
      </MobileBottomSheet>
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
  slipCard: { borderColor: tokens.colors.brand[500], overflow: "visible" },
  slipImage: {
    position: "relative",
    borderWidth: 1,
    borderRadius: 12,
    height: 180,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  slipPhoto: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  actions: { flexDirection: "row", alignItems: "stretch", gap: 8, zIndex: 2 },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonLabel: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },
  sheet: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },
  sheetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  sheetTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 20,
    lineHeight: 30,
    fontWeight: "500",
  },
  sheetBody: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
  },
  sheetBill: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 2 },
  sheetBillTitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
  },
  sheetAmount: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 22,
    lineHeight: 33,
    fontWeight: "500",
  },
  sheetMeta: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
  },
  sheetActions: { flexDirection: "row", alignItems: "stretch", gap: 8, marginTop: 4 },
  history: { padding: 0, gap: 0 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  paidIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
