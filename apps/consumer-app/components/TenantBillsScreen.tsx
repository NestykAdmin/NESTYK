import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { localizedError, useLocale } from "@nestyk/i18n";
import { MobileBottomSheet, MobileButton, MobileIcon, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { TenantBill, TenantBillStatus } from "@nestyk/types";
import { listMyBills, listReceivedBills, openMyBillSlip, openReceivedBillSlip, uploadMyBillSlip } from "../lib/tenant-bills-api";
import { billFormatters } from "../lib/bill-format";
import { ContractDocumentPreview } from "./ContractDocumentPreview";

const MAX_SLIP_BYTES = 10 * 1024 * 1024;

export const BILL_STATUS_COLOR: Record<TenantBillStatus | "upcoming", string> = {
  upcoming: tokens.colors.info,
  pending: tokens.colors.warning,
  paid: tokens.colors.success,
  overdue: tokens.colors.danger,
};

export function TenantBillsScreen({
  mode = "tenant",
  reloadToken = 0,
  onReloadSettled,
  accentColor = mode === "owner" ? tokens.colors.roles.owner : tokens.colors.roles.tenant,
}: {
  mode?: "tenant" | "owner";
  reloadToken?: number;
  onReloadSettled?: (token: number) => void;
  accentColor?: string;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const tenantCopy = t.tenant.bills;
  const copy = mode === "owner" ? t.owner.bills : tenantCopy;
  const canUpload = mode === "tenant";
  const { date: formatDate, month: formatMonth, amount: formatAmount } = billFormatters(locale);
  const [rows, setRows] = useState<TenantBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [slipFor, setSlipFor] = useState<TenantBill | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    (mode === "owner" ? listReceivedBills() : listMyBills())
      .then((next) => {
        if (!cancelled) setRows(next);
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
  }, [mode, reloadToken, retryKey]);

  function chooseSlipSource(source: "documents" | "photos") {
    const bill = slipFor;
    setSlipFor(null);
    if (bill) setTimeout(() => void uploadSlip(bill, source), 400);
  }

  async function uploadSlip(bill: TenantBill, source: "documents" | "photos") {
    if (uploadingId != null) return;
    setError("");
    setNotice("");
    try {
      let file: { uri: string; name: string; mimeType: string; file?: File };
      if (source === "photos") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) throw new Error(tenantCopy.photoPermission);
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: false, quality: 1, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > MAX_SLIP_BYTES) throw new Error(tenantCopy.fileTooLarge);
        file = { uri: asset.uri, name: asset.fileName || "slip.jpg", mimeType: asset.mimeType || "image/jpeg", file: asset.file };
      } else {
        const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png"], copyToCacheDirectory: true, multiple: false });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (asset.size && asset.size > MAX_SLIP_BYTES) throw new Error(tenantCopy.fileTooLarge);
        file = { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? "application/octet-stream", file: asset.file };
      }
      setUploadingId(bill.id);
      const updated = await uploadMyBillSlip(bill.id, file);
      setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      setNotice(tenantCopy.slipUploaded);
    } catch (e) {
      setError(localizedError(e, copy.loadFailed, locale));
    } finally {
      setUploadingId(null);
    }
  }

  async function viewSlip(bill: TenantBill) {
    setError("");
    try {
      const { url } = await (mode === "owner" ? openReceivedBillSlip : openMyBillSlip)(bill.id);
      setPreview({ url, title: `${copy.viewSlip} · ${bill.documentNo}` });
    } catch (e) {
      setError(localizedError(e, copy.loadFailed, locale));
    }
  }

  const heading = { color: theme.textHeading, fontFamily: tokens.typography.native.headingTh };
  const body = { color: theme.textSecondary, fontFamily: tokens.typography.native.body };
  const strong = { color: theme.textHeading, fontFamily: tokens.typography.native.body };
  const card = { backgroundColor: theme.card, borderColor: theme.border };
  const open = rows.filter((row) => row.status !== "paid");
  const history = rows.filter((row) => row.status === "paid");

  const statusBadge = (status: TenantBillStatus) => (
    <View style={[styles.badge, { backgroundColor: `${BILL_STATUS_COLOR[status]}1A` }]}>
      <Text style={[styles.badgeLabel, { color: BILL_STATUS_COLOR[status] }]}>{copy.status[status]}</Text>
    </View>
  );

  const roomLine = (bill: TenantBill) => [bill.property, bill.room].filter(Boolean).join(" · ");

  return (
    <View style={styles.root}>
      {!!error && (
        <View style={styles.errorRow}>
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          {!rows.length && !loading ? (
            <MobileButton variant="outline" onPress={() => setRetryKey((key) => key + 1)}>{copy.retry}</MobileButton>
          ) : null}
        </View>
      )}
      {!!notice && <Text style={[styles.copy, styles.notice]}>{notice}</Text>}
      {loading && !rows.length ? <ActivityIndicator color={accentColor} /> : null}

      {!loading && !rows.length && !error ? (
        <View style={[styles.card, card]}>
          <View style={[styles.icon, { backgroundColor: `${accentColor}18` }]}>
            <MobileIcon name="credit-card" size={20} color={accentColor} />
          </View>
          <Text style={[styles.title, heading]}>{copy.empty}</Text>
          <Text style={[styles.copy, body]}>{copy.emptyHint}</Text>
        </View>
      ) : null}

      {open.length ? <Text style={[styles.section, heading]}>{copy.current}</Text> : null}
      {open.map((bill) => (
        <View key={bill.id} style={[styles.card, card, bill.status === "overdue" ? { borderColor: tokens.colors.danger } : null]}>
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={[styles.title, heading]} numberOfLines={1}>
                {copy.rentFor.replace("{month}", formatMonth(bill.period))}
              </Text>
              {mode === "owner" && bill.tenantName ? <Text style={[styles.copy, body]} numberOfLines={1}>{t.owner.bills.tenant} {bill.tenantName}</Text> : null}
              {roomLine(bill) ? <Text style={[styles.copy, body]} numberOfLines={1}>{roomLine(bill)}</Text> : null}
            </View>
            {statusBadge(bill.status)}
          </View>
          <Text style={[styles.amount, { color: bill.status === "overdue" ? tokens.colors.danger : theme.textHeading }]}>
            {formatAmount(bill.amount)}
          </Text>
          <View style={styles.row}>
            <Text style={[styles.copy, body]}>{copy.dueDate}</Text>
            <Text style={[styles.copy, strong]}>{formatDate(bill.dueDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.copy, body]}>{copy.graceUntil}</Text>
            <Text style={[styles.copy, strong]}>{formatDate(bill.graceUntil)}</Text>
          </View>
          {mode === "tenant" && bill.payTo ? (
            <View style={[styles.payTo, { borderColor: theme.border }]}>
              <Text style={[styles.caption, body]}>{tenantCopy.payTo}</Text>
              <Text style={[styles.copy, strong]}>{[bill.payTo.bankName, bill.payTo.accountNo].filter(Boolean).join(" ")}</Text>
              {bill.payTo.accountName ? <Text style={[styles.copy, body]}>{bill.payTo.accountName}</Text> : null}
            </View>
          ) : null}
          {canUpload && !bill.hasPaymentSlip ? (
            <MobileButton isLoading={uploadingId === bill.id} disabled={uploadingId != null} onPress={() => setSlipFor(bill)}>
              {tenantCopy.uploadSlip}
            </MobileButton>
          ) : null}
          {canUpload && bill.hasPaymentSlip ? (
            <View style={styles.actions}>
              <View style={styles.flex}>
                <MobileButton variant="outline" onPress={() => void viewSlip(bill)}>{copy.viewSlip}</MobileButton>
              </View>
              <View style={styles.flex}>
                <MobileButton variant="outline" disabled={uploadingId != null} onPress={() => setSlipFor(bill)}>
                  {tenantCopy.replaceSlip}
                </MobileButton>
              </View>
            </View>
          ) : null}
          {canUpload && bill.hasPaymentSlip ? (
            <Text style={[styles.caption, body]}>{tenantCopy.slipUploaded}</Text>
          ) : null}
          {!canUpload && bill.status === "paid" && bill.hasPaymentSlip ? (
            <MobileButton variant="outline" onPress={() => void viewSlip(bill)}>{copy.viewSlip}</MobileButton>
          ) : null}
          <Text style={[styles.caption, body]}>{bill.documentNo}</Text>
        </View>
      ))}

      {history.length ? <Text style={[styles.section, heading]}>{copy.history}</Text> : null}
      {history.map((bill) => (
        <View key={bill.id} style={[styles.card, card]}>
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={[styles.copy, strong]} numberOfLines={1}>
                {copy.rentFor.replace("{month}", formatMonth(bill.period))}
              </Text>
              <Text style={[styles.caption, body]}>
                {bill.paidAt ? `${copy.paidAt} ${formatDate(bill.paidAt)}` : bill.documentNo}
              </Text>
            </View>
            <View style={styles.historyRight}>
              <Text style={[styles.copy, strong]}>{formatAmount(bill.amount)}</Text>
              {statusBadge(bill.status)}
            </View>
          </View>
          <View style={styles.actions}>
            {bill.status === "paid" && bill.hasPaymentSlip ? (
              <View style={styles.flex}>
                <MobileButton variant="outline" onPress={() => void viewSlip(bill)}>{copy.viewSlip}</MobileButton>
              </View>
            ) : null}
          </View>
        </View>
      ))}

      <MobileBottomSheet visible={canUpload && slipFor != null} onClose={() => setSlipFor(null)} maxHeight="50%">
        <View style={styles.sheet}>
          <Text style={[styles.title, heading]}>{tenantCopy.slipSourceTitle}</Text>
          <MobileButton onPress={() => chooseSlipSource("photos")}>{tenantCopy.fromPhotos}</MobileButton>
          <MobileButton variant="outline" onPress={() => chooseSlipSource("documents")}>{tenantCopy.fromFiles}</MobileButton>
          <MobileButton variant="outline" onPress={() => setSlipFor(null)}>{t.common.cancel}</MobileButton>
        </View>
      </MobileBottomSheet>

      <MobileBottomSheet visible={preview != null} onClose={() => setPreview(null)} maxHeight="94%" sheetStyle={styles.previewSheet}>
        <View style={styles.previewHeader}>
          <Text style={[styles.copy, heading, styles.flex]} numberOfLines={1}>{preview?.title}</Text>
          <MobileButton variant="outline" onPress={() => setPreview(null)}>{copy.close}</MobileButton>
        </View>
        {preview ? (
          <View style={styles.preview}>
            <ContractDocumentPreview url={preview.url} />
          </View>
        ) : null}
      </MobileBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14, paddingBottom: 24 },
  flex: { flex: 1 },
  section: { fontSize: 16, lineHeight: 24, marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  historyRight: { alignItems: "flex-end", gap: 4 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, lineHeight: 24 },
  amount: { fontFamily: tokens.typography.native.headingTh, fontSize: 26, lineHeight: 38 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  copy: { fontSize: 14, lineHeight: 22 },
  caption: { fontSize: 12, lineHeight: 18 },
  payTo: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 2 },
  actions: { flexDirection: "row", gap: 8 },
  badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  badgeLabel: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  errorRow: { gap: 8 },
  error: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 22, color: tokens.colors.danger },
  notice: { fontFamily: tokens.typography.native.body, color: "#166534" },
  sheet: { gap: 12, padding: 16 },
  previewSheet: { height: "90%", paddingHorizontal: 16, gap: 8 },
  previewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  preview: { flex: 1, minHeight: 280 },
});
