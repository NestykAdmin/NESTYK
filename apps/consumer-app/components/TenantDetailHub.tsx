import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocale } from "@nestyk/i18n";
import { MobileButton, MobileIcon, MobileStatusPill, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { AgentTenant, AgentTenantBilling } from "@nestyk/types";
import { billFormatters } from "../lib/bill-format";
import { formatPhoneDisplay } from "../lib/phone";
import {
  billingTotals,
  missingProfileFields,
  tenantLease,
  type TenantNextAction,
  type TenantProfileField,
  type TenantSection,
} from "../lib/tenant-detail";
import { CallButton, DemoNotice, DetailCard, DetailMenuRow, ps } from "./TenantDetailParts";

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
}: {
  tenant: AgentTenant;
  billing: AgentTenantBilling | null;
  demo: boolean;
  nextAction: TenantNextAction | null;
  onOpen: (section: TenantSection) => void;
  onAction: (action: TenantNextAction) => void;
}) {
  const { t, locale } = useLocale();
  const c = t.agent.tenants;
  const d = c.detail;
  const { theme, isDark } = useMobileTheme();
  const fmt = billFormatters(locale);

  const lease = tenantLease(tenant);
  const active = lease?.status === "active";
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
    if (next.kind === "sign") {
      return {
        title: d.nowSignTitle,
        body: d.nowSignBody.replace("{contract}", next.contract.agreementTypeName || next.contract.contractNo),
        cta: d.nowSignCta,
      };
    }
    return {
      title: c.nextStepTitle,
      body: tenant.email ? c.nextStepBody : c.reservedNeedsEmail,
      cta: tenant.email ? c.makeReservation : c.addEmail,
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
              label={active ? d.statusActive : d.statusSigning}
              tone={active ? "green" : "yellow"}
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
          summary={tenant.contracts.length ? d.attachmentsSummary : d.attachmentsEmpty}
          onPress={() => onOpen("attachments")}
          last
        />
      </DetailCard>

      {demo ? <DemoNotice text={d.demoNotice} /> : null}
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
});
