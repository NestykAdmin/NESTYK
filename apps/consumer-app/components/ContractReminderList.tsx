import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { tokens, useMobileTheme } from "@nestyk/ui/native";
import type { ContractReminder } from "@nestyk/types";
import { fillTemplate, useLocale } from "@nestyk/i18n";
import { billFormatters } from "../lib/bill-format";

/**
 * D4 (AC-3.6, 4.6, 5.5, 7.4 to 7.6; D5 refund_late): the agent's reminders (in the "to do" tab), or the landlord's (rent 15 days
 * late, on the contracts screen). Each one is tapped to open its contract or bill; nothing shows when there is none.
 * A failed load shows nothing either: the reminders are a help, the lists below still work.
 */
export function ContractReminderList({
  load,
  reloadKey,
  audience,
  onOpen,
}: {
  load: () => Promise<ContractReminder[]>;
  /** A new value loads the reminders again. */
  reloadKey?: unknown;
  audience: "agent" | "landlord";
  onOpen?: (reminder: ContractReminder) => void;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const rc = t.contracts.reminders;
  const fmt = billFormatters(locale);
  const [items, setItems] = useState<ContractReminder[]>([]);
  useEffect(() => {
    let live = true;
    load().then((rows) => { if (live) setItems(rows); }, () => { if (live) setItems([]); });
    return () => { live = false; };
  }, [load, reloadKey]);
  if (!items.length) return null;
  const text = { color: theme.textSecondary, fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20 };
  return (
    <View style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={{ ...text, color: theme.textHeading, fontFamily: tokens.typography.native.bodyBold, fontSize: 16 }}>
        {audience === "agent" ? rc.title : rc.landlordTitle}
      </Text>
      {items.map((r) => {
        const place = [r.property, r.room].filter(Boolean).join(` ${rc.room} `);
        const body = (
          <View style={{ gap: 2, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, backgroundColor: theme.card }}>
            <Text style={{ ...text, color: tokens.colors.danger, fontFamily: tokens.typography.native.bodyBold }}>{rc.kinds[r.kind]}</Text>
            <Text style={{ ...text, color: theme.textHeading }}>{`${r.contractNo} · ${r.tenantName} · ${place}`}</Text>
            {r.billPeriod ? (
              <Text style={text}>{fillTemplate(rc.bill, { period: fmt.month(r.billPeriod), amount: r.amount == null ? "" : fmt.amount(r.amount) })}</Text>
            ) : r.kind === "refund_late" && r.amount != null ? (
              <Text style={text}>{fillTemplate(rc.refund, { amount: fmt.amount(r.amount) })}</Text>
            ) : null}
            <Text style={text}>{fillTemplate(rc.dueLabel[r.kind], { date: fmt.date(r.dueDate) })}</Text>
          </View>
        );
        const key = `${r.kind}:${r.contractId}:${r.billId ?? 0}`;
        return onOpen ? (
          <Pressable key={key} accessibilityRole="button" onPress={() => onOpen(r)}>{body}</Pressable>
        ) : (
          <View key={key}>{body}</View>
        );
      })}
    </View>
  );
}
