import React from "react";
import { Text, View } from "react-native";
import { MobileButton, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { AgentContract } from "@nestyk/types";
import { fillTemplate, useLocale } from "@nestyk/i18n";
import { localeTag } from "../lib/lead-format";

export function ReservationPaymentCard({
  contract,
  busy,
  onOpen,
  onUpload,
  onIssueReceipt,
  onCreateInvoice,
}: {
  contract: AgentContract;
  busy: boolean;
  onOpen: (kind: "invoice" | "receipt" | "payment-slip") => void;
  onUpload?: () => void;
  onIssueReceipt?: () => void;
  onCreateInvoice?: () => void;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const pc = t.contracts.payment;
  const payment = contract.reservationPayment;
  const paymentStatus = contract.receiptUrl ? "paid" : payment?.status ?? "unpaid";
  const status = {
    unpaid: { label: pc.status.unpaid, color: "#B45309", background: "#FFFBEB" },
    submitted: { label: pc.status.submitted, color: "#1D4ED8", background: "#EFF6FF" },
    paid: { label: pc.status.paid, color: "#15803D", background: "#F0FDF4" },
  }[paymentStatus];
  const closed = ["cancelled", "expired", "terminated"].includes(
    contract.status,
  );
  const text = {
    color: theme.textSecondary,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
  };
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
          {pc.title}
        </Text>
        <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: status.background }}>
          <Text
            accessibilityLabel={fillTemplate(pc.statusA11y, { status: status.label })}
            style={{ ...text, color: status.color, fontSize: 13 }}
          >
            {status.label}
          </Text>
        </View>
      </View>
      <Text style={text}>{fillTemplate(pc.linked, { no: contract.contractNo })}</Text>
      <Text style={text}>
        {fillTemplate(pc.total, {
          amount: `฿${(payment?.total ?? contract.reservationFee ?? 0).toLocaleString(
            localeTag(locale),
            { minimumFractionDigits: 2, maximumFractionDigits: 2 },
          )}`,
        })}
      </Text>
      {paymentStatus !== "unpaid" && (
        <Text style={text}>
          {paymentStatus === "paid"
            ? pc.paidHint
            : pc.submittedHint}
        </Text>
      )}
      {closed && <Text style={text}>{pc.closed}</Text>}
      {contract.invoiceUrl ? (
        <MobileButton
          variant="outline"
          disabled={busy}
          onPress={() => onOpen("invoice")}
        >
          {pc.viewInvoice}
          {payment?.invoiceDocumentNo ? ` ${payment.invoiceDocumentNo}` : ""}
        </MobileButton>
      ) : onCreateInvoice && !closed ? (
        <MobileButton disabled={busy} onPress={onCreateInvoice}>
          {pc.createInvoice}
        </MobileButton>
      ) : (
        <Text style={text}>{pc.noInvoice}</Text>
      )}
      {contract.invoiceUrl &&
        !payment &&
        !contract.receiptUrl &&
        onCreateInvoice &&
        !closed && (
          <MobileButton disabled={busy} onPress={onCreateInvoice}>
            {pc.createLinkedInvoice}
          </MobileButton>
        )}
      {payment?.paymentSlipUrl && (
        <MobileButton
          variant="outline"
          disabled={busy}
          onPress={() => onOpen("payment-slip")}
        >
          {pc.viewSlip}
        </MobileButton>
      )}
      {onUpload &&
        payment &&
        contract.invoiceUrl &&
        !contract.receiptUrl &&
        !closed && (
          <>
            <MobileButton disabled={busy} isLoading={busy} onPress={onUpload}>
              {payment?.status === "submitted"
                ? pc.reuploadSlip
                : pc.uploadSlip}
            </MobileButton>
            <Text style={text}>
              {pc.uploadHint}
            </Text>
          </>
        )}
      {contract.receiptUrl ? (
        <MobileButton
          variant="outline"
          disabled={busy}
          onPress={() => onOpen("receipt")}
        >
          {pc.viewReceipt}
          {payment?.receiptDocumentNo ? ` ${payment.receiptDocumentNo}` : ""}
        </MobileButton>
      ) : onIssueReceipt && payment && contract.invoiceUrl && !closed ? (
        <MobileButton disabled={busy} onPress={onIssueReceipt}>
          {pc.verify}
        </MobileButton>
      ) : null}
    </View>
  );
}
