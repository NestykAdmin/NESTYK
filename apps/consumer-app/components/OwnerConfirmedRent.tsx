import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { localizedError, useLocale } from "@nestyk/i18n";
import { MobileBottomSheet, MobileButton, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { TenantBill } from "@nestyk/types";
import { billFormatters } from "../lib/bill-format";
import { listReceivedBills, openReceivedBillSlip } from "../lib/tenant-bills-api";
import { ContractDocumentPreview } from "./ContractDocumentPreview";

export function OwnerConfirmedRent({
  reloadToken = 0,
  onReloadSettled,
}: {
  reloadToken?: number;
  onReloadSettled?: (token: number) => void;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const copy = t.owner.bills;
  const { date, month, amount } = billFormatters(locale);
  const [rows, setRows] = useState<TenantBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listReceivedBills()
      .then((next) => {
        if (!cancelled) setRows(next.filter((bill) => bill.status === "paid"));
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

  async function viewSlip(bill: TenantBill) {
    setError("");
    try {
      const { url } = await openReceivedBillSlip(bill.id);
      setPreview({ url, title: bill.documentNo });
    } catch (e) {
      setError(localizedError(e, copy.loadFailed, locale));
    }
  }

  const title = { color: theme.textHeading, fontFamily: tokens.typography.native.headingTh };
  const body = { color: theme.textSecondary, fontFamily: tokens.typography.native.body };

  return (
    <View style={styles.root}>
      <Text style={[styles.heading, title]}>{copy.confirmedTitle}</Text>
      {loading ? <ActivityIndicator color={tokens.colors.roles.owner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !rows.length ? <Text style={[styles.copy, body]}>{copy.confirmedEmpty}</Text> : null}
      {rows.map((bill) => (
        <View key={bill.id} style={styles.item}>
          <View style={styles.grow}>
            <Text style={[styles.copy, title]} numberOfLines={1}>
              {copy.rentFor.replace("{month}", month(bill.period))}
            </Text>
            <Text style={[styles.caption, body]} numberOfLines={1}>
              {[bill.tenantName, bill.paidAt ? `${copy.paidAt} ${date(bill.paidAt)}` : ""].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <Text style={[styles.copy, title]}>{amount(bill.amount)}</Text>
          {bill.hasPaymentSlip ? (
            <MobileButton variant="outline" onPress={() => void viewSlip(bill)}>{copy.viewSlip}</MobileButton>
          ) : null}
        </View>
      ))}
      <MobileBottomSheet visible={preview != null} onClose={() => setPreview(null)} maxHeight="90%">
        <View style={styles.previewSheet}>
          <Text style={[styles.copy, title]} numberOfLines={1}>{preview?.title}</Text>
          <MobileButton variant="outline" onPress={() => setPreview(null)}>{copy.close}</MobileButton>
          {preview ? (
            <View style={styles.preview}>
              <ContractDocumentPreview url={preview.url} />
            </View>
          ) : null}
        </View>
      </MobileBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, marginTop: 8 },
  heading: { fontSize: 16, lineHeight: 24 },
  item: { gap: 6, paddingTop: 8 },
  grow: { gap: 2 },
  copy: { fontSize: 14, lineHeight: 22 },
  caption: { fontSize: 12, lineHeight: 18 },
  error: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20, color: tokens.colors.danger },
  previewSheet: { height: "90%", paddingHorizontal: 16, gap: 8 },
  preview: { flex: 1, minHeight: 280 },
});
