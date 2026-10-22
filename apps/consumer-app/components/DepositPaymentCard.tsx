import React from "react";
import { Text, View } from "react-native";
import { MobileButton, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { AgentContract, DepositFinancialDocumentKind } from "@nestyk/types";
import { fillTemplate, useLocale } from "@nestyk/i18n";
import { localeTag } from "../lib/lead-format";

/**
 * D10: the deposit of a generated lease, issued in the landlord's name. The tenant sends the slip
 * (onUpload), the agent issues the receipt (onIssueReceipt) or issues the invoice again (onIssueInvoice).
 */
export function DepositPaymentCard({
  contract,
  busy,
  onOpen,
  onUpload,
  onIssueReceipt,
  onIssueInvoice,
}: {
  contract: AgentContract;
  busy: boolean;
  onOpen: (kind: DepositFinancialDocumentKind) => void;
  onUpload?: () => void;
  onIssueReceipt?: () => void;
  onIssueInvoice?: () => void;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const dc = t.contracts.deposit;
  const deposit = contract.depositPayment;
  if (!deposit) return null;
  const status = {
    not_issued: { color: "#6B7280", background: "#F3F4F6" },
    unpaid: { color: "#B45309", background: "#FFFBEB" },
    submitted: { color: "#1D4ED8", background: "#EFF6FF" },
    paid: { color: "#15803D", background: "#F0FDF4" },
  }[deposit.status];
  const label = dc.status[deposit.status];
  const closed = ["cancelled", "expired", "terminated"].includes(contract.status);
  const open = !closed && deposit.status !== "paid";
  const text = {
    color: theme.textSecondary,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
  };
  const amount = `฿${deposit.total.toLocaleString(localeTag(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const due = deposit.dueDate
    ? new Date(`${deposit.dueDate}T00:00:00`).toLocaleDateString(localeTag(locale), { day: "numeric", month: "short", year: "numeric" })
    : null;
  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <Text
          style={{
            color: theme.textHeading,
            fontFamily: tokens.typography.native.headingTh,
            fontSize: 18,
            lineHeight: 27,
          }}
        >
          {dc.title}
        </Text>
        <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: status.background }}>
          <Text
            accessibilityLabel={fillTemplate(dc.statusA11y, { status: label })}
            style={{ ...text, color: status.color, fontSize: 13 }}
          >
            {label}
          </Text>
        </View>
      </View>
      <Text style={text}>{fillTemplate(dc.linked, { no: contract.contractNo })}</Text>
      <Text style={text}>{fillTemplate(dc.total, { amount })}</Text>
      {due && <Text style={text}>{fillTemplate(dc.due, { date: due })}</Text>}
      {deposit.status === "submitted" && <Text style={text}>{dc.submittedHint}</Text>}
      {deposit.status === "paid" && <Text style={text}>{dc.paidHint}</Text>}
      {closed && <Text style={text}>{dc.closed}</Text>}
      {deposit.status === "not_issued" ? (
        <>
          <Text style={text}>{dc.notIssued}</Text>
          {onIssueInvoice && !closed && (
            <MobileButton disabled={busy} isLoading={busy} onPress={onIssueInvoice}>
              {dc.issue}
            </MobileButton>
          )}
        </>
      ) : (
        <MobileButton variant="outline" disabled={busy} onPress={() => onOpen("deposit-invoice")}>
          {dc.viewInvoice}
          {deposit.invoiceDocumentNo ? ` ${deposit.invoiceDocumentNo}` : ""}
        </MobileButton>
      )}
      {deposit.paymentSlipUrl && (
        <MobileButton variant="outline" disabled={busy} onPress={() => onOpen("deposit-payment-slip")}>
          {dc.viewSlip}
        </MobileButton>
      )}
      {onUpload && open && deposit.status !== "not_issued" && (
        <>
          <MobileButton disabled={busy} isLoading={busy} onPress={onUpload}>
            {deposit.status === "submitted" ? dc.reuploadSlip : dc.uploadSlip}
          </MobileButton>
          <Text style={text}>{dc.uploadHint}</Text>
        </>
      )}
      {deposit.receiptUrl ? (
        <MobileButton variant="outline" disabled={busy} onPress={() => onOpen("deposit-receipt")}>
          {dc.viewReceipt}
          {deposit.receiptDocumentNo ? ` ${deposit.receiptDocumentNo}` : ""}
        </MobileButton>
      ) : onIssueReceipt && open && deposit.status !== "not_issued" ? (
        <MobileButton disabled={busy} onPress={onIssueReceipt}>
          {dc.verify}
        </MobileButton>
      ) : null}
    </View>
  );
}
