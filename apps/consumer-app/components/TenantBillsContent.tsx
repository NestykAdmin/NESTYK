import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { useLocale } from "@nestyk/i18n";
import {
  MobileBottomSheet,
  MobileButton,
  MobileFilterChip,
  MobileIcon,
  MobileStatusPill,
  tokens,
  useMobileTheme,
} from "@nestyk/ui/native";
import type { TenantBill, TenantNextBill } from "@nestyk/types";
import { billFormatters } from "../lib/bill-format";
import { openMyBillSlip } from "../lib/tenant-bills-api";
import { tenantWorkspaceCopy } from "../lib/tenant-workspace-copy";
import { isPdfDocumentUrl } from "./ContractDocumentPreview";

export type SlipPreview = { uri: string; mimeType: string };

function SlipThumb({
  billId,
  preview,
  label,
  onPress,
}: {
  billId: number;
  preview?: SlipPreview;
  label: string;
  onPress?: () => void;
}) {
  const { theme } = useMobileTheme();
  const [remote, setRemote] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    setFailed(false);
    openMyBillSlip(billId)
      .then(({ url }) => {
        if (!cancelled) setRemote(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [billId, preview]);
  const uri = preview?.uri ?? remote;
  const pdf =
    preview?.mimeType === "application/pdf" || (!!uri && isPdfDocumentUrl(uri));
  const frame = [
    s.thumb,
    { backgroundColor: theme.background, borderColor: theme.border },
  ];
  const body = pdf ? (
    <Text style={s.thumbLabel}>PDF</Text>
  ) : uri ? (
    <Image
      source={{ uri }}
      style={s.thumbImage}
      contentFit="cover"
      accessibilityLabel={label}
    />
  ) : failed ? null : (
    <ActivityIndicator />
  );
  if (failed && !uri) return null;
  if (!onPress) return <View style={frame}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={frame}
    >
      {body}
    </Pressable>
  );
}

export function TenantBillsContent({
  rows,
  next,
  uploadingId,
  submittingId,
  error,
  slipPreviews,
  onUpload,
  onViewSlip,
  onSubmit,
  roomHistory = false,
  selectedRoom = null,
  onSelectRoom,
}: {
  rows: TenantBill[];
  next: TenantNextBill | null;
  uploadingId: number | null;
  submittingId: number | null;
  error: string;
  slipPreviews: Record<number, SlipPreview>;
  onUpload: (bill: TenantBill, source: "documents" | "photos") => void;
  onViewSlip: (bill: TenantBill) => void;
  onSubmit: (bill: TenantBill) => void;
  roomHistory?: boolean;
  selectedRoom?: { property: string; room: string | null } | null;
  onSelectRoom?: (room: { property: string; room: string | null }) => void;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const copy = t.tenant.bills;
  const labels = tenantWorkspaceCopy(locale);
  const format = billFormatters(locale);
  const [filter, setFilter] = useState<"unpaid" | "paid">("unpaid");
  const [selected, setSelected] = useState<{
    id: number;
    payment: boolean;
  } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<{
    billId: number;
    copied: boolean;
    error: string;
  } | null>(null);
  const [confirmBill, setConfirmBill] = useState<TenantBill | null>(null);
  const scoped = selectedRoom
    ? rows.filter(
        (bill) =>
          (bill.property?.trim() || labels.room) === selectedRoom.property &&
          (bill.room ?? "") === (selectedRoom.room ?? ""),
      )
    : rows;
  const roomGroups = [
    ...scoped
      .reduce((groups, bill) => {
        const property = bill.property?.trim() || labels.room;
        const key = `${property}\u0000${bill.room ?? ""}`;
        const current = groups.get(key) ?? {
          property,
          room: bill.room,
          bills: [] as TenantBill[],
        };
        current.bills.push(bill);
        groups.set(key, current);
        return groups;
      }, new Map<string, { property: string; room: string | null; bills: TenantBill[] }>())
      .values(),
  ].sort((a, b) => {
    const staying = (group: { bills: TenantBill[] }) =>
      group.bills.some((bill) => bill.leaseActive);
    const latest = (group: { bills: TenantBill[] }) =>
      group.bills.reduce((max, bill) => (bill.period > max ? bill.period : max), "");
    return (
      Number(staying(b)) - Number(staying(a)) ||
      latest(b).localeCompare(latest(a)) ||
      a.property.localeCompare(b.property, locale)
    );
  });
  const listed = selectedRoom ? scoped : rows.filter((bill) => bill.leaseActive);
  const open = listed
    .filter((bill) => bill.status !== "paid")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id);
  const history = listed
    .filter((bill) => bill.status === "paid")
    .sort((a, b) => b.period.localeCompare(a.period) || b.id - a.id);
  const upcomingHere =
    next?.status === "upcoming" &&
    (!selectedRoom ||
      (next.property === selectedRoom.property &&
        (next.room ?? "") === (selectedRoom.room ?? "")));
  const roomKey = selectedRoom
    ? `${selectedRoom.property}\u0000${selectedRoom.room ?? ""}`
    : "";
  const unpaidLocked =
    !!selectedRoom && !scoped.some((bill) => bill.leaseActive) && open.length === 0;
  useEffect(() => {
    setFilter(unpaidLocked ? "paid" : "unpaid");
  }, [roomKey, unpaidLocked]);
  const selectedBill = scoped.find((bill) => bill.id === selected?.id);
  useEffect(() => {
    if (
      confirmBill &&
      rows.find((bill) => bill.id === confirmBill.id)?.slipSubmitted
    )
      setConfirmBill(null);
  }, [rows, confirmBill]);
  const rooms = [
    ...new Map(listed.map((bill) => [bill.leaseContractId, bill])).values(),
  ];
  const ink = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };
  const surface = { backgroundColor: theme.surface, borderColor: theme.border };

  function select(bill: TenantBill, payment = false) {
    setSelected({ id: bill.id, payment });
  }
  function upload(source: "documents" | "photos") {
    if (!selectedBill || uploadingId != null) return;
    const bill = selectedBill;
    setSelected(null);
    setTimeout(() => onUpload(bill, source), 400);
  }
  function viewSlip(bill: TenantBill) {
    setSelected(null);
    setTimeout(() => onViewSlip(bill), 400);
  }
  function documentRow(label: string, onPress: () => void) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [s.history, surface, pressed && s.pressed]}
      >
        <View style={[s.documentIcon, { backgroundColor: theme.background }]}>
          <MobileIcon name="file-text" size={20} color={theme.screenTitle} />
        </View>
        <Text style={[s.body, ink, s.flex]}>{label}</Text>
        <MobileIcon name="chevron-right" size={18} color={tokens.colors.divider} />
      </Pressable>
    );
  }
  function askConfirm(bill: TenantBill) {
    if (selected) {
      setSelected(null);
      setTimeout(() => setConfirmBill(bill), 400);
      return;
    }
    setConfirmBill(bill);
  }
  function returnedMessage(reason: string) {
    return reason === "invalid_image"
      ? copy.slipReturned
      : copy.slipReturnedReason.replace("{reason}", reason);
  }
  function badge(bill: TenantBill) {
    return (
      <MobileStatusPill
        label={
          bill.status === "paid"
            ? copy.status.paid
            : bill.status === "overdue"
              ? copy.status.overdue
              : bill.slipSubmitted
                ? labels.reviewing
                : copy.status.pending
        }
        tone={
          bill.status === "paid"
            ? "green"
            : bill.status === "overdue"
              ? "red"
              : "yellow"
        }
      />
    );
  }
  function bank(bill: TenantBill) {
    if (!bill.payTo) return null;
    const feedback = copyFeedback?.billId === bill.id ? copyFeedback : null;
    return (
      <View
        style={[
          s.bank,
          { backgroundColor: theme.background, borderColor: theme.border },
        ]}
      >
        <Text style={[s.caption, muted]}>{copy.payTo}</Text>
        {!!bill.payTo.bankName && (
          <Text style={[s.body, ink]}>{bill.payTo.bankName}</Text>
        )}
        {!!bill.payTo.accountNo && (
          <View style={s.row}>
            <Text selectable style={[s.body, ink, s.flex]}>
              {bill.payTo.accountNo}
            </Text>
            <MobileButton
              variant="outline"
              onPress={() => {
                setCopyFeedback({ billId: bill.id, copied: false, error: "" });
                void Clipboard.setStringAsync(bill.payTo!.accountNo)
                  .then(() =>
                    setCopyFeedback({
                      billId: bill.id,
                      copied: true,
                      error: "",
                    }),
                  )
                  .catch(() =>
                    setCopyFeedback({
                      billId: bill.id,
                      copied: false,
                      error: labels.copyFailed,
                    }),
                  );
              }}
            >
              {feedback?.copied ? labels.copied : labels.copyAccount}
            </MobileButton>
          </View>
        )}
        {!!bill.payTo.accountName && (
          <Text style={[s.caption, muted]}>{bill.payTo.accountName}</Text>
        )}
        {!!feedback?.error && (
          <Text
            accessibilityRole="alert"
            style={[s.caption, { color: tokens.colors.danger }]}
          >
            {feedback.error}
          </Text>
        )}
      </View>
    );
  }

  if (roomHistory && !selectedRoom) {
    return (
      <View style={s.root}>
        <Text style={[s.body, muted]}>{labels.billHistoryHint}</Text>
        {roomGroups.length ? (
          roomGroups.map((group) => {
            const current = group.bills.some((bill) => bill.leaseActive);
            return (
            <Pressable
              key={`${group.property}\u0000${group.room ?? ""}`}
              accessibilityRole="button"
              accessibilityLabel={`${group.property} ${group.room ?? ""}`}
              onPress={() => onSelectRoom?.({ property: group.property, room: group.room })}
              style={({ pressed }) => [s.room, surface, pressed && s.pressed]}
            >
              <View
                style={[
                  s.roomIcon,
                  {
                    backgroundColor: current
                      ? "rgba(0, 198, 141, 0.14)"
                      : "rgba(100, 116, 139, 0.14)",
                  },
                ]}
              >
                <MobileIcon
                  name="home"
                  size={22}
                  color={current ? tokens.colors.roles.tenant : tokens.colors.textSecondary}
                />
              </View>
              <View style={s.flex}>
                <Text style={[s.roomTitle, ink]}>{group.property}</Text>
                {group.room ? (
                  <Text style={[s.caption, muted]}>
                    {labels.room} {group.room}
                  </Text>
                ) : null}
                <Text style={[s.caption, muted]}>
                  {current ? labels.currentStay : labels.pastStay}
                </Text>
              </View>
              <Text style={[s.caption, muted]}>
                {labels.billCount.replace("{count}", String(group.bills.length))}
              </Text>
              <MobileIcon name="chevron-right" size={18} color={tokens.colors.divider} />
            </Pressable>
            );
          })
        ) : (
          <Text style={[s.body, muted]}>{labels.emptyHistory}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={s.root}>
      {rooms.length === 1 && (
        <View style={[s.room, surface]}>
          <View style={[s.roomIcon, { backgroundColor: theme.background }]}>
            <MobileIcon name="home" size={22} color={theme.screenTitle} />
          </View>
          <View style={s.flex}>
            <Text style={[s.roomTitle, ink]}>{rooms[0]!.property}</Text>
            {rooms[0]!.room ? (
              <Text style={[s.caption, muted]}>
                {labels.room} {rooms[0]!.room}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      <Text style={[s.sectionTitle, ink]}>{labels.billsList}</Text>
      <View style={s.filters}>
        <MobileFilterChip
          label={labels.unpaid}
          selected={filter === "unpaid"}
          disabled={unpaidLocked}
          onPress={() => setFilter("unpaid")}
        />
        <MobileFilterChip
          label={labels.paid}
          selected={filter === "paid"}
          onPress={() => setFilter("paid")}
        />
      </View>

      {filter === "unpaid" &&
        open.map((bill) => (
          <View key={bill.id} style={[s.bill, surface]}>
            <View style={s.header}>
              <Text style={[s.caption, muted, s.flex]}>
                {labels.currentBill}
              </Text>
              {badge(bill)}
            </View>
            <Text style={[s.billTitle, ink]}>
              {copy.rentFor.replace("{month}", format.month(bill.period))}
            </Text>
            <Text style={[s.caption, muted]}>
              {labels.billNo} {bill.documentNo}
            </Text>
            {rooms.length !== 1 && (
              <Text style={[s.caption, muted]}>
                {[
                  bill.property,
                  bill.room ? `${labels.room} ${bill.room}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            )}
            <Text
              style={[
                s.amount,
                {
                  color:
                    bill.status === "overdue"
                      ? tokens.colors.danger
                      : theme.textHeading,
                },
              ]}
            >
              {format.amount(bill.amount)}
            </Text>
            <View style={[s.facts, { borderBottomColor: theme.border }]}>
              <View style={s.factDates}>
                <View style={s.fact}>
                  <Text style={[s.caption, muted]}>{copy.issuedOn}</Text>
                  <Text style={[s.body, ink]}>
                    {format.date(bill.issueDate)}
                  </Text>
                </View>
                <View style={s.fact}>
                  <Text style={[s.caption, muted]}>{copy.dueDate}</Text>
                  <Text style={[s.body, ink]}>{format.date(bill.dueDate)}</Text>
                </View>
              </View>
              <View style={s.row}>
                <Text style={[s.caption, muted]}>{copy.graceUntil}</Text>
                <Text style={[s.body, ink]}>
                  {format.date(bill.graceUntil)}
                </Text>
              </View>
            </View>
            {bank(bill)}
            {bill.hasPaymentSlip ? (
              <SlipThumb
                billId={bill.id}
                preview={slipPreviews[bill.id]}
                label={copy.viewSlip}
                onPress={() => viewSlip(bill)}
              />
            ) : null}
            {bill.slipSubmitted ? (
              <>
                <Text style={[s.caption, muted]}>{copy.slipUploaded}</Text>
              </>
            ) : bill.hasPaymentSlip ? (
              <>
                <Text style={[s.caption, muted]}>{copy.slipReady}</Text>
                <MobileButton
                  variant="outline"
                  disabled={uploadingId != null || submittingId != null}
                  onPress={() => select(bill, true)}
                >
                  {copy.replaceSlip}
                </MobileButton>
                <MobileButton
                  disabled={uploadingId != null || submittingId != null}
                  onPress={() => askConfirm(bill)}
                >
                  {copy.confirmPayment}
                </MobileButton>
              </>
            ) : (
              <>
                {bill.slipReturnReason ? (
                  <Text style={[s.caption, s.returned]}>
                    {returnedMessage(bill.slipReturnReason)}
                  </Text>
                ) : null}
                <MobileButton
                  isLoading={uploadingId === bill.id}
                  disabled={uploadingId != null}
                  onPress={() => select(bill, true)}
                >
                  {labels.pay}
                </MobileButton>
              </>
            )}
          </View>
        ))}

      {filter === "unpaid" && upcomingHere && next && (
        <View style={[s.upcoming, surface]}>
          <MobileIcon name="calendar" size={16} color={theme.textSecondary} />
          <View style={[s.flex, s.upcomingCopy]}>
            <Text style={[s.caption, muted]}>
              {labels.nextRentBill} · {format.month(next.period)}
            </Text>
            {(rooms.length !== 1 ||
              rooms[0].leaseContractId !== next.leaseContractId) && (
              <Text style={[s.caption, muted]}>
                {[next.property, next.room].filter(Boolean).join(" · ")}
              </Text>
            )}
            <Text style={[s.body, ink]}>
              {copy.issueOn} {format.date(next.issueDate)}
            </Text>
            <Text style={[s.caption, muted]}>
              {copy.dueDate} {format.date(next.dueDate)}
            </Text>
          </View>
        </View>
      )}

      {filter === "unpaid" && !open.length && !upcomingHere ? (
        <Text style={[s.body, muted]}>{labels.noUnpaidBills}</Text>
      ) : null}
      {filter === "paid" && !history.length ? (
        <Text style={[s.body, muted]}>{labels.noPaidBills}</Text>
      ) : null}
      {filter === "paid" &&
        history.map((bill) => (
        <Pressable
          key={bill.id}
          accessibilityRole="button"
          accessibilityLabel={`${format.month(bill.period)} · ${format.amount(bill.amount)} · ${copy.status.paid}`}
          onPress={() => select(bill)}
          style={({ pressed }) => [s.history, surface, pressed && s.pressed]}
        >
          <View style={[s.documentIcon, { backgroundColor: theme.background }]}>
            <MobileIcon name="file-text" size={20} color={theme.screenTitle} />
          </View>
          <View style={s.flex}>
            <Text style={[s.body, ink]}>{format.month(bill.period)}</Text>
            {rooms.length !== 1 && (
              <Text style={[s.caption, muted]}>
                {[bill.property, bill.room].filter(Boolean).join(" · ")}
              </Text>
            )}
            <Text style={[s.caption, muted]}>
              {bill.paidAt
                ? `${copy.paidAt} ${format.date(bill.paidAt)}`
                : bill.documentNo}
            </Text>
          </View>
          <View style={s.historyRight}>
            <Text style={[s.body, ink]}>{format.amount(bill.amount)}</Text>
            {badge(bill)}
          </View>
          <MobileIcon
            name="chevron-right"
            size={18}
            color={tokens.colors.divider}
          />
        </Pressable>
      ))}

      <MobileBottomSheet
        visible={!!selectedBill}
        onClose={() => setSelected(null)}
        maxHeight="88%"
      >
        {selectedBill && (
          <ScrollView style={s.sheetScroll} contentContainerStyle={s.sheet}>
            <View style={s.header}>
              <Text style={[s.sheetTitle, ink, s.flex]}>
                {selected?.payment ? copy.slipSourceTitle : labels.billDetails}
              </Text>
              <MobileButton variant="ghost" onPress={() => setSelected(null)}>
                {copy.close}
              </MobileButton>
            </View>
            <Text style={[s.caption, muted]}>{selectedBill.documentNo}</Text>
            <Text style={[s.body, ink]}>
              {[
                selectedBill.property,
                selectedBill.room
                  ? `${labels.room} ${selectedBill.room}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            <View style={s.header}>
              <Text style={[s.body, ink, s.flex]}>
                {copy.rentFor.replace(
                  "{month}",
                  format.month(selectedBill.period),
                )}
              </Text>
              {badge(selectedBill)}
            </View>
            <Text style={[s.amount, ink]}>
              {format.amount(selectedBill.amount)}
            </Text>
            {!selected?.payment && (
              <>
                <View style={s.row}>
                  <Text style={[s.caption, muted]}>{copy.issuedOn}</Text>
                  <Text style={[s.caption, ink]}>
                    {format.date(selectedBill.issueDate)}
                  </Text>
                </View>
                <View style={s.row}>
                  <Text style={[s.caption, muted]}>{copy.dueDate}</Text>
                  <Text style={[s.caption, ink]}>
                    {format.date(selectedBill.dueDate)}
                  </Text>
                </View>
                <View style={s.row}>
                  <Text style={[s.caption, muted]}>{copy.graceUntil}</Text>
                  <Text style={[s.caption, ink]}>
                    {format.date(selectedBill.graceUntil)}
                  </Text>
                </View>
              </>
            )}
            {selectedBill.paidAt && (
              <Text style={[s.caption, muted]}>
                {copy.paidAt} {format.date(selectedBill.paidAt)}
              </Text>
            )}
            {selectedBill.status === "paid" && !selected?.payment ? (
              <>
                {bank(selectedBill)}
                <Text style={[s.caption, muted]}>{copy.billDocuments}</Text>
                {selectedBill.hasPaymentSlip ? (
                  documentRow(copy.viewSlip, () => viewSlip(selectedBill))
                ) : (
                  <Text style={[s.body, muted]}>{copy.noBillDocuments}</Text>
                )}
              </>
            ) : null}
            {selectedBill.slipReturnReason && !selectedBill.hasPaymentSlip ? (
              <Text style={[s.caption, s.returned]}>
                {returnedMessage(selectedBill.slipReturnReason)}
              </Text>
            ) : null}
            {selectedBill.status !== "paid" && selectedBill.hasPaymentSlip && !selected?.payment ? (
              <MobileButton
                variant="outline"
                onPress={() => viewSlip(selectedBill)}
              >
                {copy.viewSlip}
              </MobileButton>
            ) : null}
            {selected?.payment && selectedBill.hasPaymentSlip ? (
              <SlipThumb
                billId={selectedBill.id}
                preview={slipPreviews[selectedBill.id]}
                label={copy.viewSlip}
              />
            ) : null}
            {selectedBill.status !== "paid" && selectedBill.slipSubmitted ? (
              <Text style={[s.caption, muted]}>{copy.slipUploaded}</Text>
            ) : selectedBill.status !== "paid" && selectedBill.hasPaymentSlip ? (
              <Text style={[s.caption, muted]}>{copy.slipReady}</Text>
            ) : null}
            {selectedBill.status !== "paid" &&
              !selectedBill.slipSubmitted &&
              (selected?.payment ? (
                <>
                  <MobileButton
                    disabled={uploadingId != null}
                    onPress={() => upload("photos")}
                  >
                    {copy.fromPhotos}
                  </MobileButton>
                  <MobileButton
                    variant="outline"
                    disabled={uploadingId != null}
                    onPress={() => upload("documents")}
                  >
                    {copy.fromFiles}
                  </MobileButton>
                </>
              ) : (
                <MobileButton
                  disabled={uploadingId != null || submittingId != null}
                  onPress={() => select(selectedBill, true)}
                >
                  {selectedBill.hasPaymentSlip ? copy.replaceSlip : labels.pay}
                </MobileButton>
              ))}
            {selectedBill.status !== "paid" &&
            selectedBill.hasPaymentSlip &&
            !selectedBill.slipSubmitted &&
            !selected?.payment ? (
              <MobileButton
                disabled={uploadingId != null || submittingId != null}
                onPress={() => askConfirm(selectedBill)}
              >
                {copy.confirmPayment}
              </MobileButton>
            ) : null}
          </ScrollView>
        )}
      </MobileBottomSheet>
      <MobileBottomSheet
        visible={confirmBill != null}
        onClose={() => {
          if (submittingId == null) setConfirmBill(null);
        }}
      >
        <View style={s.confirmSheet}>
          <Text style={[s.sheetTitle, ink]}>{copy.slipConfirmTitle}</Text>
          {confirmBill?.hasPaymentSlip ? (
            <SlipThumb
              billId={confirmBill.id}
              preview={slipPreviews[confirmBill.id]}
              label={copy.viewSlip}
            />
          ) : null}
          <Text style={[s.body, muted]}>{copy.slipConfirmBody}</Text>
          {error ? <Text style={[s.caption, s.returned]}>{error}</Text> : null}
          <View style={s.confirmActions}>
            <MobileButton
              style={s.confirmButton}
              variant="outline"
              disabled={submittingId != null}
              onPress={() => setConfirmBill(null)}
            >
              {t.common.cancel}
            </MobileButton>
            <MobileButton
              style={s.confirmButton}
              isLoading={submittingId != null}
              disabled={confirmBill == null || submittingId != null}
              onPress={() => {
                if (confirmBill) onSubmit(confirmBill);
              }}
            >
              {copy.confirmPayment}
            </MobileButton>
          </View>
        </View>
      </MobileBottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 16 },
  flex: { flex: 1, minWidth: 0 },
  room: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  roomIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  roomTitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
  },
  bill: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 10 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    justifyContent: "space-between",
  },
  billTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 17,
    lineHeight: 26,
  },
  amount: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 26,
    lineHeight: 38,
  },
  facts: { borderBottomWidth: 1, paddingBottom: 14, gap: 12 },
  factDates: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  fact: { flexGrow: 1, flexBasis: 100, minWidth: 0, gap: 4 },
  sectionTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
  },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  history: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  historyRight: { alignItems: "flex-end", gap: 4 },
  documentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.85 },
  body: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
  },
  caption: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
  },
  returned: { color: tokens.colors.danger },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImage: { width: 96, height: 96 },
  thumbLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
    color: "#334155",
  },
  upcoming: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
  },
  upcomingCopy: { gap: 3 },
  confirmSheet: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },
  confirmActions: { flexDirection: "row", gap: 8 },
  confirmButton: { flexGrow: 1, flexBasis: 120 },
  sheet: { padding: 16, gap: 12 },
  sheetScroll: { flexShrink: 1 },
  sheetTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 18,
    lineHeight: 27,
  },
  bank: { padding: 12, gap: 6, borderRadius: 12, borderWidth: 1 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
});
