import React from "react";
import { Text, View } from "react-native";
import { MobileButton, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { AgentContract } from "@nestyk/types";
import { fillTemplate, useLocale } from "@nestyk/i18n";
import { billFormatters } from "../lib/bill-format";
import { reservationSigningOverdue } from "../lib/contract-signing";

/**
 * D13 (AC-3.7) and D3 (AC-3.6) on a reservation letter: the commission confirmation the landlord and the agent sign
 * with the letter (amount and how it was worked out, the PDF once generated), and the day everyone must have signed
 * by. The landlord's view passes showDue=false; the tenant's contract has no commission.
 */
export function ReservationTerms({
  contract,
  today,
  showDue = true,
  onOpenCommission,
}: {
  contract: Pick<AgentContract, "formKind" | "commission" | "signDueDate">;
  /** Today in Bangkok, YYYY-MM-DD. */
  today: string;
  showDue?: boolean;
  onOpenCommission?: (url: string) => void;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const rt = t.contracts.reservationTerms;
  if (contract.formKind !== "reservation") return null;
  const fmt = billFormatters(locale);
  const text = { color: theme.textSecondary, fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20 };
  const commission = contract.commission;
  const due = showDue ? contract.signDueDate : null;
  const late = !!due && reservationSigningOverdue(contract, today);
  if (!commission && !due) return null;
  return (
    <View style={{ gap: 4 }}>
      {due ? (
        <Text accessibilityRole={late ? "alert" : undefined} style={{ ...text, color: late ? tokens.colors.danger : theme.textSecondary }}>
          {fillTemplate(late ? rt.signLate : rt.signDue, { date: fmt.date(due) })}
        </Text>
      ) : null}
      {commission ? (
        <>
          <Text style={{ ...text, color: theme.textHeading, fontFamily: tokens.typography.native.bodyBold, fontSize: 14 }}>
            {fillTemplate(rt.commissionTitle, { no: commission.documentNo })}
          </Text>
          <Text style={{ ...text, color: theme.textHeading }}>
            {fillTemplate(rt.commissionAmount, { amount: fmt.amount(Number(commission.amount)) })}
          </Text>
          <Text style={text}>
            {fillTemplate(rt.commissionPeriod, {
              from: fmt.date(commission.leaseStart),
              to: fmt.date(commission.leaseEnd),
              rent: fmt.amount(Number(commission.monthlyRent)),
            })}
          </Text>
          {commission.fullYears ? <Text style={text}>{fillTemplate(rt.commissionYears, { years: String(commission.fullYears) })}</Text> : null}
          {commission.restDays ? <Text style={text}>{fillTemplate(rt.commissionDays, { days: String(commission.restDays) })}</Text> : null}
          <Text style={text}>{rt.commissionSignNote}</Text>
          {commission.url && onOpenCommission ? (
            <MobileButton variant="outline" onPress={() => onOpenCommission(commission.url!)}>
              {rt.openCommission}
            </MobileButton>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
