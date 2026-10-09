import React from "react";
import { Pressable, Text, View } from "react-native";
import { tokens, useMobileTheme } from "@nestyk/ui/native";
import type { AgentContract } from "@nestyk/types";
import { fillTemplate, useLocale } from "@nestyk/i18n";
import { localeTag } from "../lib/lead-format";

export function bookingInvoicesForTenant(
  contracts: AgentContract[],
  tenantId?: number,
) {
  return contracts.filter(
    (contract) =>
      contract.formKind === "reservation" &&
      contract.invoiceUrl &&
      contract.reservationPayment &&
      (tenantId == null || contract.tenantId === tenantId),
  );
}

export function BookingInvoiceListCard({
  contract,
  busy,
  onOpen,
}: {
  contract: AgentContract;
  busy: boolean;
  onOpen: () => void;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const tc = t.contracts;
  const payment = contract.reservationPayment;
  if (!payment || !contract.invoiceUrl) return null;
  const text = {
    color: theme.textSecondary,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
  };
  const closed = ["cancelled", "expired", "terminated"].includes(contract.status);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tc.payment.viewInvoice} ${payment.invoiceDocumentNo}`}
      disabled={busy}
      onPress={onOpen}
      style={({ pressed }) => ({
        backgroundColor: theme.card,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        gap: 10,
        opacity: pressed || busy ? 0.65 : 1,
      })}
    >
      <Text style={{ ...text, color: theme.textHeading, fontSize: 18 }}>
        {payment.invoiceDocumentNo}
      </Text>
      <Text style={{ ...text, color: theme.textHeading }}>{contract.tenant}</Text>
      <Text style={text}>{fillTemplate(tc.payment.linkedFee, { no: contract.contractNo })}</Text>
      <Text style={text}>
        {contract.property}{contract.room ? ` · ${fillTemplate(tc.common.room, { room: contract.room })}` : ""}
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <Text style={text}>
          ฿{payment.total.toLocaleString(localeTag(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text style={{ ...text, color: payment.status === "paid" ? "#198460" : "#B45309" }}>
          {closed ? tc.payment.closed : payment.status === "paid" ? tc.payment.status.paid : payment.status === "submitted" ? tc.payment.submittedShort : tc.payment.unpaidShort}
        </Text>
      </View>
    </Pressable>
  );
}
