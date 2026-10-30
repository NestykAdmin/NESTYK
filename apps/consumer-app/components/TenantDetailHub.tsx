import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocale } from "@nestyk/i18n";
import { MobileBottomSheet, MobileButton, MobileIcon, MobileInput, MobileStatusPill, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { AgentTenant, AgentTenantBilling } from "@nestyk/types";
import { billFormatters } from "../lib/bill-format";
import { formatPhoneDisplay } from "../lib/phone";
import {
  billingTotals,
  missingProfileFields,
  tenantLease,
  tenantDocuments,
  tenantStage,
  type TenantNextAction,
  type TenantProfileField,
  type TenantSection,
} from "../lib/tenant-detail";
import { CallButton, DemoNotice, DetailCard, DetailMenuRow, ps } from "./TenantDetailParts";
import { HandoverCard } from "./HandoverCard";
import { DepositSettlementCard } from "./DepositSettlementCard";
import { earlyEndMoneyOf, earlyEndSlipState } from "../lib/early-end-slip";
import { awaitingDecision } from "../lib/contract-renewal";

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => Array.from(n)[0])
    .join("")
    .toUpperCase();

/** Tenant landing page: who they are, the one thing to do now, and a menu into each section. */
export function TenantDetailHub({
  tenant,
  billing,
  demo,
  nextAction,
  onOpen,
  onAction,
  onNotRenewing,
  onEarlyEnd,
  onEarlyEndMoney,
  onOpenEarlyEndFile,
  onAttachEarlyEndProof,
  onConfirmEarlyEndSlip,
  onReturnEarlyEndSlip,
}: {
  tenant: AgentTenant;
  billing: AgentTenantBilling | null;
  demo: boolean;
  nextAction: TenantNextAction | null;
  onOpen: (section: TenantSection) => void;
  onAction: (action: TenantNextAction) => void;
  onNotRenewing?: (contractId: number, notRenewing: boolean) => void;
  onEarlyEnd?: (contractId: number, date: string, reason: string) => void;
  onEarlyEndMoney?: (contractId: number, kind: "refund" | "collect", amount: number, note: string) => void;
  onOpenEarlyEndFile?: (contractId: number, kind: "invoice" | "slip" | "proof") => void;
  onAttachEarlyEndProof?: (contractId: number) => void;
  /** M5: the agent confirms or returns the tenant's slip (with the submittedAt of the slip shown). */
  onConfirmEarlyEndSlip?: (contractId: number, submittedAt: string | null) => void;
  onReturnEarlyEndSlip?: (contractId: number, reason: string, submittedAt: string | null) => void;
}) {
  const { t, locale } = useLocale();
  const c = t.agent.tenants;
  const d = c.detail;
  const { theme, isDark } = useMobileTheme();
  const [ending, setEnding] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [endReason, setEndReason] = useState("");
  const [moneyKind, setMoneyKind] = useState<"refund" | "collect">("refund");
  const [moneyAmount, setMoneyAmount] = useState("");
  const [moneyNote, setMoneyNote] = useState("");
  const [slipReturnReason, setSlipReturnReason] = useState("");
  const fmt = billFormatters(locale);

  const lease = tenantLease(tenant);
  const stage = tenantStage(tenant);
  const active = stage === "active";
  const missing = missingProfileFields(tenant);
  const totals = billingTotals(billing);
  const fieldLabel: Record<TenantProfileField, string> = {
    phone: c.fieldPhone,
    email: d.fieldEmail,
    identityNumber: d.fieldIdentity,
    nationality: c.fieldNationality,
  };
  const pending = tenant.contracts.some((x) => x.status.startsWith("awaiting_"));

  const place = [tenant.property, tenant.room ? d.roomTitle.replace("{room}", tenant.room) : null]
    .filter(Boolean)
    .join(" · ");

  const billsSummary = active
    ? [
        totals.outstandingCount
          ? d.billsOutstanding.replace("{amount}", fmt.amount(totals.outstandingAmount))
          : d.billsClear,
        billing?.upcoming ? d.billsNext.replace("{date}", fmt.date(billing.upcoming.dueDate)) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : d.billsNoLease;

  const action = nextAction ? actionCopy(nextAction) : null;

  function actionCopy(next: TenantNextAction) {
    if (next.kind === "review_slip") {
      return {
        title: d.nowSlipTitle.replace("{month}", fmt.month(next.bill.period)),
        body: next.bill.slipSubmittedAt
          ? d.nowSlipBody
              .replace("{amount}", fmt.amount(next.bill.amount))
              .replace("{date}", fmt.date(next.bill.slipSubmittedAt))
          : `${fmt.amount(next.bill.amount)} · ${d.billDue.replace("{date}", fmt.date(next.bill.dueDate))}`,
        cta: d.nowSlipCta,
      };
    }
    if (next.kind === "broker_appointment") {
      return {
        title: d.nowBrokerTitle,
        body: d.nowBrokerBody,
        cta: next.contract ? d.nowBrokerOpen : d.nowBrokerCta,
      };
    }
    if (next.kind === "confirm") {
      return {
        title: d.nowConfirmTitle,
        body: d.nowConfirmBody.replace("{contract}", next.contract.agreementTypeName || next.contract.contractNo),
        cta: d.nowConfirmCta,
      };
    }
    if (next.kind === "deposit" || next.kind === "handover") {
      const deposit = next.kind === "deposit";
      return {
        title: deposit ? d.nowDepositTitle : d.nowHandoverTitle,
        body: (deposit ? d.nowDepositBody : d.nowHandoverBody).replace("{contract}", next.contract.agreementTypeName || next.contract.contractNo),
        cta: deposit ? d.nowDepositCta : d.nowHandoverCta,
      };
    }
    if (next.kind === "sign") {
      return {
        title: next.late ? d.nowSignLateTitle : d.nowSignTitle,
        body: (next.late ? d.nowSignLateBody.replace("{date}", next.contract.signDueDate ? fmt.date(next.contract.signDueDate) : "") : d.nowSignBody)
          .replace("{contract}", next.contract.agreementTypeName || next.contract.contractNo),
        cta: d.nowSignCta,
      };
    }
    return {
      title: c.nextStepTitle,
      // C3 (Aof, 22 Oct 2026): the reservation letter needs the tenant's email and ID or passport number.
      body: !tenant.email ? c.reservedNeedsEmail : !tenant.identityNumber ? c.reservedNeedsIdentity : c.nextStepBody,
      cta: !tenant.email ? c.addEmail : !tenant.identityNumber ? c.addIdentity : c.makeReservation,
    };
  }

  return (
    <View style={s.root}>
      <DetailCard>
        <View style={s.person}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials(tenant.name)}</Text>
          </View>
          <View style={[ps.grow, s.personCopy]}>
            <Text style={[s.name, { color: theme.textHeading }]} numberOfLines={2}>
              {tenant.name}
            </Text>
            <MobileStatusPill
              label={active ? d.statusActive : stage === "ended" ? d.statusEnded : d.statusSigning}
              tone={active ? "green" : stage === "ended" ? "slate" : "yellow"}
              style={s.pill}
            />
          </View>
        </View>
        {!!place && (
          <View style={ps.row}>
            <MobileIcon name="buildings" size={16} color={theme.textSecondary} />
            <Text style={[ps.body, ps.grow, { color: theme.textSecondary }]} numberOfLines={2}>
              {place}
            </Text>
          </View>
        )}
        <View style={[s.phoneRow, { borderTopColor: theme.border }]}>
          <View style={ps.grow}>
            <Text style={[ps.small, { color: theme.textSecondary }]}>{c.fieldPhone}</Text>
            <Text selectable style={[ps.value, { color: theme.textHeading }]}>
              {formatPhoneDisplay(tenant.phone) || d.notSet}
            </Text>
          </View>
          <CallButton phone={tenant.phone} label={d.callA11y.replace("{name}", tenant.name)} />
        </View>
      </DetailCard>

      {action && nextAction ? (
        <View
          style={[
            s.action,
            {
              backgroundColor: isDark ? "rgba(248,182,21,0.12)" : tokens.colors.brand[50],
              borderColor: tokens.colors.brand[500],
            },
          ]}
        >
          <View style={ps.row}>
            <MobileIcon name="warning" size={16} color={tokens.colors.brand[700]} />
            <Text style={[s.actionLabel, { color: tokens.colors.brand[700] }]}>{d.nowTitle}</Text>
          </View>
          <Text style={[ps.rowTitle, { color: theme.textHeading }]}>{action.title}</Text>
          <Text style={[ps.body, { color: theme.textSecondary }]}>{action.body}</Text>
          <MobileButton onPress={() => onAction(nextAction)} style={s.actionButton}>
            {action.cta}
          </MobileButton>
        </View>
      ) : null}

      <DetailCard style={s.menu}>
        <DetailMenuRow
          icon="user"
          title={d.sectionProfile}
          summary={
            missing.length
              ? d.profileMissing.replace("{fields}", missing.map((f) => fieldLabel[f]).join(", "))
              : d.profileComplete
          }
          pill={missing.length ? { label: d.pillMissing.replace("{count}", String(missing.length)), tone: "yellow" } : null}
          onPress={() => onOpen("profile")}
        />
        <DetailMenuRow
          icon="home"
          title={d.sectionRoom}
          summary={
            lease?.monthlyRent
              ? d.roomSummary
                  .replace("{room}", tenant.room || tenant.property)
                  .replace("{amount}", fmt.amount(lease.monthlyRent))
              : d.roomNoLease.replace("{property}", place || tenant.property)
          }
          onPress={() => onOpen("room")}
        />
        <DetailMenuRow
          icon="file-text"
          title={d.sectionContracts}
          summary={
            !tenant.contracts.length
              ? d.contractsNone
              : (lease?.endDate ? d.contractsUntil.replace("{date}", fmt.date(lease.endDate)) : d.contractsCount).replace(
                  "{count}",
                  String(tenant.contracts.length),
                )
          }
          pill={
            active
              ? { label: d.pillContractActive, tone: "green" }
              : pending
                ? { label: d.pillContractPending, tone: "yellow" }
                : null
          }
          onPress={() => onOpen("contracts")}
        />
        {lease && (lease.status === "active" || awaitingDecision(lease)) && onNotRenewing ? (
          <MobileButton
            variant="outline"
            onPress={() => onNotRenewing(lease.id, !Boolean((lease.data as { notRenewing?: unknown }).notRenewing))}
          >
            {(lease.data as { notRenewing?: unknown }).notRenewing ? d.notRenewingUndo : d.notRenewing}
          </MobileButton>
        ) : null}
        {lease?.status === "active" && onEarlyEnd && !(lease.data as { endsOn?: unknown }).endsOn ? (
          <MobileButton variant="outline" onPress={() => { setEndDate(""); setEndReason(""); setEnding(true); }}>
            {d.earlyEnd}
          </MobileButton>
        ) : null}
        {lease && onEarlyEndMoney && (lease.data as { endsOn?: { date?: string; money?: { kind?: string; amount?: number; dueOn?: string } } }).endsOn && !(lease.data as { endsOn?: { money?: unknown } }).endsOn?.money ? (
          <View style={s.sheet}>
            <Text style={[ps.body, { color: theme.textHeading }]}>{d.earlyEndAmount}</Text>
            <MobileButton variant={moneyKind === "refund" ? "primary" : "outline"} onPress={() => setMoneyKind("refund")}>{d.earlyEndRefund}</MobileButton>
            <MobileButton variant={moneyKind === "collect" ? "primary" : "outline"} onPress={() => setMoneyKind("collect")}>{d.earlyEndCollect}</MobileButton>
            <MobileInput label={d.earlyEndAmount} value={moneyAmount} onChangeText={setMoneyAmount} keyboardType="decimal-pad" maxLength={12} required />
            <MobileInput label={d.earlyEndReason} value={moneyNote} onChangeText={setMoneyNote} maxLength={500} />
            <MobileButton
              disabled={!/^\d+(\.\d{1,2})?$/.test(moneyAmount.replace(/,/g, "")) || Number(moneyAmount.replace(/,/g, "")) <= 0}
              onPress={() => onEarlyEndMoney(lease.id, moneyKind, Number(moneyAmount.replace(/,/g, "")), moneyNote.trim())}
            >
              {d.earlyEndMoneySave}
            </MobileButton>
          </View>
        ) : null}
        {(lease?.data as { endsOn?: { money?: { kind?: string; amount?: number; dueOn?: string; invoicePath?: string | null; proofPath?: string | null } } } | undefined)?.endsOn?.money ? (
          <>
            <Text style={[ps.body, { color: theme.textSecondary }]}>
              {d.earlyEndMoneyDone
                .replace("{amount}", fmt.amount(Number((lease!.data as { endsOn: { money: { amount: number } } }).endsOn.money.amount)))
                .replace("{due}", fmt.date((lease!.data as { endsOn: { money: { dueOn: string } } }).endsOn.money.dueOn))}
            </Text>
            {(lease!.data as { endsOn: { money: { kind?: string; invoicePath?: string | null } } }).endsOn.money.kind === "collect"
              && (lease!.data as { endsOn: { money: { invoicePath?: string | null } } }).endsOn.money.invoicePath ? (
              <MobileButton variant="outline" onPress={() => onOpenEarlyEndFile?.(lease!.id, "invoice")}>{d.earlyEndViewInvoice}</MobileButton>
            ) : null}
            {(lease!.data as { endsOn: { money: { kind?: string; slipPath?: string | null } } }).endsOn.money.kind === "collect"
              && (lease!.data as { endsOn: { money: { slipPath?: string | null } } }).endsOn.money.slipPath ? (
              <MobileButton variant="outline" onPress={() => onOpenEarlyEndFile?.(lease!.id, "slip")}>{d.earlyEndViewSlip}</MobileButton>
            ) : null}
            {(() => {
              const money = earlyEndMoneyOf(lease!.data);
              const state = earlyEndSlipState(money);
              if (state === "paid") return <Text style={[ps.body, { color: theme.textSecondary }]}>{d.earlyEndSlipPaid}</Text>;
              if (state === "returned")
                return <Text style={[ps.body, { color: theme.textSecondary }]}>{d.earlyEndSlipReturned.replace("{reason}", money?.returnNote ?? "")}</Text>;
              if (state !== "awaiting") return null;
              return (
                <>
                  {onConfirmEarlyEndSlip ? (
                    <MobileButton onPress={() => onConfirmEarlyEndSlip(lease!.id, money?.slipSubmittedAt ?? null)}>{d.earlyEndSlipConfirm}</MobileButton>
                  ) : null}
                  {onReturnEarlyEndSlip ? (
                    <>
                      <MobileInput label={d.earlyEndSlipReturnReason} value={slipReturnReason} onChangeText={setSlipReturnReason} maxLength={500} />
                      <MobileButton
                        variant="outline"
                        disabled={!slipReturnReason.trim()}
                        onPress={() => { onReturnEarlyEndSlip(lease!.id, slipReturnReason.trim(), money?.slipSubmittedAt ?? null); setSlipReturnReason(""); }}
                      >
                        {d.earlyEndSlipReturn}
                      </MobileButton>
                    </>
                  ) : null}
                </>
              );
            })()}
            {(lease!.data as { endsOn: { money: { kind?: string; proofPath?: string | null } } }).endsOn.money.kind === "refund"
              && !(lease!.data as { endsOn: { money: { proofPath?: string | null } } }).endsOn.money.proofPath ? (
              <MobileButton variant="outline" onPress={() => onAttachEarlyEndProof?.(lease!.id)}>{d.earlyEndAttachProof}</MobileButton>
            ) : null}
            {(lease!.data as { endsOn: { money: { kind?: string; proofPath?: string | null } } }).endsOn.money.kind === "refund"
              && (lease!.data as { endsOn: { money: { proofPath?: string | null } } }).endsOn.money.proofPath ? (
              <MobileButton variant="outline" onPress={() => onOpenEarlyEndFile?.(lease!.id, "proof")}>{d.earlyEndViewProof}</MobileButton>
            ) : null}
          </>
        ) : null}
        {lease && (lease.formKind === "lease" || lease.formKind === "renewal") ? (
          <HandoverCard key={`move-out:${lease.id}`} contractId={lease.id} mode="agent" kind="move_out" defaultDate={lease.endDate ?? undefined} />
        ) : null}
        {lease && (lease.formKind === "lease" || lease.formKind === "renewal") ? (
          <DepositSettlementCard key={`deposit:${lease.id}`} contractId={lease.id} mode="agent" />
        ) : null}
        <DetailMenuRow
          icon="credit-card"
          title={d.sectionBills}
          summary={billsSummary}
          pill={
            totals.overdueCount
              ? { label: d.pillOverdue.replace("{count}", String(totals.overdueCount)), tone: "red" }
              : totals.awaiting.length
                ? { label: d.pillAwaiting.replace("{count}", String(totals.awaiting.length)), tone: "yellow" }
                : null
          }
          onPress={() => onOpen("bills")}
        />
        <DetailMenuRow
          icon="wallet"
          title={d.sectionPayments}
          summary={
            totals.latestPayment
              ? d.paymentsSummary
                  .replace("{amount}", fmt.amount(totals.receivedAmount))
                  .replace("{date}", fmt.date(totals.latestPayment))
              : d.paymentsNone
          }
          pill={
            totals.awaiting.length
              ? { label: d.pillAwaiting.replace("{count}", String(totals.awaiting.length)), tone: "yellow" }
              : null
          }
          onPress={() => onOpen("payments")}
        />
        <DetailMenuRow
          icon="files"
          title={d.sectionAttachments}
          summary={tenantDocuments(tenant).length ? d.attachmentsSummary : d.attachmentsEmpty}
          onPress={() => onOpen("attachments")}
          last
        />
      </DetailCard>

      {demo ? <DemoNotice text={d.demoNotice} /> : null}
      <MobileBottomSheet visible={ending} onClose={() => setEnding(false)} avoidKeyboard>
        <View style={s.sheet}>
          <Text style={[s.name, { color: theme.textHeading, fontSize: 18, lineHeight: 28 }]}>{d.earlyEnd}</Text>
          <MobileInput label={d.earlyEndDate} value={endDate} onChangeText={setEndDate} maxLength={10} placeholder="2027-01-15" required />
          <MobileInput label={d.earlyEndReason} value={endReason} onChangeText={setEndReason} multiline maxLength={1000} required />
          <MobileButton
            disabled={!lease || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || !endReason.trim()}
            onPress={() => { if (lease) { onEarlyEnd?.(lease.id, endDate, endReason.trim()); setEnding(false); } }}
          >
            {d.earlyEndSave}
          </MobileButton>
        </View>
      </MobileBottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 16 },
  person: { flexDirection: "row", alignItems: "center", gap: 14 },
  personCopy: { gap: 6 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: tokens.colors.brand[100],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 22,
    lineHeight: 32,
    color: tokens.colors.onBrand,
  },
  name: { fontFamily: tokens.typography.native.headingTh, fontSize: 20, lineHeight: 30 },
  pill: { alignSelf: "flex-start" },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  action: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 6 },
  actionLabel: { fontFamily: tokens.typography.native.bodyBold, fontSize: 12, lineHeight: 18 },
  actionButton: { marginTop: 8, alignSelf: "stretch" },
  menu: { padding: 0, gap: 0 },
  sheet: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
});
