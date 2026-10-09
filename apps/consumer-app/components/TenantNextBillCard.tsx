import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { localizedError, useLocale } from "@nestyk/i18n";
import { MobileButton, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { TenantNextBill } from "@nestyk/types";
import { getMyNextBill } from "../lib/tenant-bills-api";
import { billFormatters } from "../lib/bill-format";
import { BILL_STATUS_COLOR } from "./TenantBillsScreen";

/** Dashboard body: next rent round with its issue date and payable window. */
export function TenantNextBillCard({
  reloadToken = 0,
  onReloadSettled,
  onOpenBills,
  accentColor = tokens.colors.roles.tenant,
}: {
  reloadToken?: number;
  onReloadSettled?: (token: number) => void;
  onOpenBills?: () => void;
  accentColor?: string;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const copy = t.tenant.bills;
  const format = billFormatters(locale);
  const [next, setNext] = useState<TenantNextBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getMyNextBill()
      .then((row) => {
        if (!cancelled) setNext(row);
      })
      .catch((e) => {
        if (!cancelled) setError(localizedError(e, copy.loadFailed, locale));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        onReloadSettled?.(reloadToken);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const heading = { color: theme.textHeading, fontFamily: tokens.typography.native.headingTh };
  const body = { color: theme.textSecondary, fontFamily: tokens.typography.native.body };
  const strong = { color: theme.textHeading, fontFamily: tokens.typography.native.body };

  if (loading && !next) return <ActivityIndicator color={accentColor} />;
  if (error) return <Text style={[styles.copy, styles.error]}>{error}</Text>;
  if (!next) return <Text style={[styles.copy, body]}>{copy.noUpcoming}</Text>;

  const color = BILL_STATUS_COLOR[next.status];
  const room = [next.property, next.room].filter(Boolean).join(" · ");
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={[styles.caption, body]}>{copy.next}</Text>
        <View style={[styles.badge, { backgroundColor: `${color}1A` }]}>
          <Text style={[styles.badgeLabel, { color }]}>{copy.status[next.status]}</Text>
        </View>
      </View>
      <View style={styles.header}>
        <Text style={[styles.title, heading, styles.flex]} numberOfLines={1}>
          {copy.rentFor.replace("{month}", format.month(next.period))}
        </Text>
        <Text style={[styles.title, heading]}>{format.amount(next.amount)}</Text>
      </View>
      {room ? <Text style={[styles.copy, body]} numberOfLines={1}>{room}</Text> : null}
      <View style={styles.row}>
        <Text style={[styles.copy, body]}>{next.status === "upcoming" ? copy.issueOn : copy.issuedOn}</Text>
        <Text style={[styles.copy, strong]}>{format.date(next.issueDate)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.copy, body]}>{copy.dueDate}</Text>
        <Text style={[styles.copy, strong]}>{format.date(next.dueDate)}</Text>
      </View>
      <View style={[styles.window, { borderColor: `${color}55`, backgroundColor: `${color}0D` }]}>
        <Text style={[styles.caption, body]}>{copy.payWindow}</Text>
        <Text style={[styles.copy, strong]}>
          {format.date(next.issueDate)} – {format.date(next.graceUntil)}
        </Text>
      </View>
      {next.billId != null && onOpenBills ? (
        <MobileButton variant="outline" onPress={onOpenBills}>{copy.viewBills}</MobileButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8, marginTop: 8 },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { fontSize: 16, lineHeight: 24 },
  copy: { fontSize: 14, lineHeight: 22 },
  caption: { fontSize: 12, lineHeight: 18 },
  error: { fontFamily: tokens.typography.native.body, color: tokens.colors.danger },
  window: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 2 },
  badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  badgeLabel: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
});
