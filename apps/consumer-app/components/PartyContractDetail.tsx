import type { ContractParty } from "@nestyk/types";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  MobileBottomSheet,
  MobileButton,
  MobileIcon,
  tokens,
  useMobileTheme,
} from "@nestyk/ui/native";
import type { AppIconName } from "@nestyk/ui/native";
import type {
  AgreementAttachmentChecklist,
  AgreementDocumentSubject,
  DepositFinancialDocumentKind,
  PartyContract,
} from "@nestyk/types";
import {
  listMyAttachments,
  openMyAttachment,
  openMyContractDocument,
  signMyContract,
  uploadMyAttachment,
  openMyFinancialDocument,
  uploadMyReservationPaymentSlip,
  uploadMyDepositPaymentSlip,
  openMyEarlyEndFile,
  uploadMyEarlyEndSlip,
} from "../lib/party-contracts-api";
import {
  ContractSignaturePad,
  type ContractSignaturePadHandle,
} from "./ContractSignaturePad";
import { ContractDocumentPreview } from "./ContractDocumentPreview";
import { ReservationPaymentCard } from "./ReservationPaymentCard";
import { ReservationTerms } from "./ReservationTerms";
import { DealCancellationSummary } from "./DealCancellationCard";
import { dateKey } from "../lib/tenant-detail";
import { DepositPaymentCard } from "./DepositPaymentCard";
import { HandoverCard } from "./HandoverCard";
import { DepositSettlementCard } from "./DepositSettlementCard";
import { RejectedAttachmentsNotice } from "./RejectedAttachmentsNotice";
import { rejectedAttachments } from "../lib/attachment-review";
import { TenantContractAttachments } from "./TenantContractList";
import { fillTemplate, localizedError, useLocale } from "@nestyk/i18n";
import { localeTag } from "../lib/lead-format";
import { bookingPaymentBlocksSigning } from "../lib/contract-signing";

const CONTRACT_ICON: Record<PartyContract["formKind"], AppIconName> = {
  reservation: "calendar",
  lease: "key",
  renewal: "file-text",
  broker_appointment: "handshake",
};

type SignerKey = "owner" | "tenant" | "agent";

function statusColor(status: PartyContract["status"]) {
  if (status === "active") return "#278268";
  if (status.startsWith("awaiting")) return "#BB7914";
  return "#788193";
}

function signerKeys(row: PartyContract): SignerKey[] {
  if (row.formKind === "lease" || row.formKind === "renewal") return ["owner", "tenant"];
  if (row.formKind === "broker_appointment") return ["owner", "agent"];
  return ["owner", "tenant", "agent"];
}

function signedAt(row: PartyContract, party: SignerKey) {
  if (party === "owner") return row.ownerSignedAt;
  if (party === "tenant") return row.tenantSignedAt;
  return row.agentSignedAt;
}

export function PartyContractDetail({
  contract,
  accentColor = tokens.colors.roles.landlord,
  onUpdated,
  reloadToken = 0,
  onReloadSettled,
  refreshError,
  refreshing = false,
  mode = "owner",
}: {
  contract: PartyContract;
  accentColor?: string;
  reloadToken?: number;
  onReloadSettled?: (token: number) => void;
  refreshError?: string;
  refreshing?: boolean;
  mode?: ContractParty;
  onUpdated: (next: PartyContract) => void;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const pc = t.mobile.partyContracts;
  const tc = t.contracts;
  const money = (value: number | null) =>
    value == null
      ? tc.common.notSpecified
      : `฿${value.toLocaleString(localeTag(locale), { maximumFractionDigits: 2 })}`;
  const dateLabel = (value: string | null) =>
    value
      ? new Date(`${value}T00:00:00`).toLocaleDateString(localeTag(locale), {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : tc.common.notSpecified;
  const fileTooLarge = t.common.fileTooLarge.replace("{size}", "10");
  const [attachments, setAttachments] = useState<AgreementAttachmentChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [slipSourceOpen, setSlipSourceOpen] = useState(false);
  // D10: which payment the picked slip is for (the reservation fee, or the lease deposit).
  const slipTarget = useRef<"reservation" | "deposit" | "early">("reservation");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [signing, setSigning] = useState<ContractParty | null>(null);
  const [signPadKey, setSignPadKey] = useState(0);
  const padRef = useRef<ContractSignaturePadHandle>(null);

  const title = { color: theme.textHeading, fontFamily: tokens.typography.native.headingTh };
  const body = { color: theme.textSecondary, fontFamily: tokens.typography.native.body };
  const card = { backgroundColor: theme.card, borderColor: theme.border };
  const mine = contract.myParties;
  const collectInvoice = (contract.data as { endsOn?: { money?: { kind?: string; invoicePath?: string | null; slipPath?: string | null } } } | undefined)?.endsOn?.money;
  const showCollect = collectInvoice?.kind === "collect" && !!collectInvoice.invoicePath;
  async function openEarlyFile(kind: "invoice" | "slip") {
    setError("");
    try {
      const { url } = await openMyEarlyEndFile(contract.id, kind);
      setPreviewTitle(kind === "slip" ? t.tenant.bills.earlyEndSlip : t.tenant.bills.earlyEndInvoice);
      setPreviewUrl(url);
    } catch (e) {
      setError(localizedError(e, pc.openDocumentFailed, locale));
    }
  }
  const ownRequirements = (attachments?.requirements ?? []).filter((row) =>
    mine.includes(row.subject as ContractParty),
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    listMyAttachments(contract.id)
      .then((next) => {
        if (!cancelled) setAttachments(next);
      })
      .catch((e) => {
        if (!cancelled)
          setError(localizedError(e, pc.loadDocumentsFailed, locale));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          onReloadSettled?.(reloadToken);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [contract.id, reloadToken, onReloadSettled]);

  useEffect(() => {
    if (!signing) return;
    const timer = setTimeout(() => padRef.current?.reinitialize?.(), 320);
    return () => clearTimeout(timer);
  }, [signing, signPadKey]);

  async function upload(
    subject: AgreementDocumentSubject,
    documentTypeCode: string,
    supersedesDocumentId?: number,
  ) {
    setPicking(documentTypeCode);
    setError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (file.size && file.size > 10 * 1024 * 1024)
        throw new Error(fileTooLarge);
      setBusy(true);
      setAttachments(
        await uploadMyAttachment(
          contract.id,
          { subject, documentTypeCode, supersedesDocumentId },
          {
            uri: file.uri,
            name: file.name,
            mimeType: file.mimeType ?? "application/octet-stream",
            file: file.file,
          },
        ),
      );
      setNotice(pc.attached);
    } catch (e) {
      setError(localizedError(e, pc.attachFailed, locale));
    } finally {
      setBusy(false);
      setPicking(null);
    }
  }

  async function openDocument() {
    setPreviewBusy(true);
    setError("");
    setPreviewTitle(tc.party.contractDocument);
    try {
      const ready =
        contract.formKind === "reservation"
          ? contract.reservationLetterUrl
          : contract.formKind === "broker_appointment"
            ? contract.brokerAppointmentUrl
            : contract.leaseDocumentUrl;
      if (ready) {
        setPreviewUrl(ready);
        return;
      }
      const doc = await openMyContractDocument(contract.id);
      setPreviewUrl(doc.url);
    } catch (e) {
      setError(localizedError(e, pc.openContractFailed, locale));
    } finally {
      setPreviewBusy(false);
    }
  }

  async function openFile(documentId: number) {
    setBusy(true);
    setError("");
    setPreviewTitle(tc.party.attachment);
    try {
      const doc = await openMyAttachment(contract.id, documentId);
      setPreviewUrl(doc.url);
    } catch (e) {
      setError(localizedError(e, pc.openDocumentFailed, locale));
    } finally {
      setBusy(false);
    }
  }

  async function openPaymentDocument(kind: "invoice" | "receipt" | "payment-slip" | "commission-confirmation" | DepositFinancialDocumentKind) {
    setPreviewBusy(true);
    setError("");
    try {
      const doc = await openMyFinancialDocument(contract.id, kind);
      setPreviewTitle(kind === "commission-confirmation" ? tc.reservationTerms.openCommission
        : kind.endsWith("invoice") ? tc.common.paymentDocuments.invoice : kind.endsWith("receipt") ? tc.common.paymentDocuments.receipt : tc.common.paymentDocuments.paymentSlip);
      setPreviewUrl(doc.url);
    } catch (e) {
      setError(localizedError(e, pc.openDocumentFailed, locale));
    } finally {
      setPreviewBusy(false);
    }
  }

  function chooseSlipSource(source: "documents" | "photos") {
    setSlipSourceOpen(false);
    setTimeout(() => void uploadPaymentSlip(source), 400);
  }

  async function uploadPaymentSlip(source: "documents" | "photos") {
    if (busy || picking) return;
    setPicking("payment-slip");
    setError("");
    setNotice("");
    try {
      let file: { uri: string; name: string; mimeType: string; file?: File };
      if (source === "photos") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) throw new Error(pc.slipPermission);
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: false, quality: 1, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) throw new Error(fileTooLarge);
        file = { uri: asset.uri, name: asset.fileName || "slip.jpg", mimeType: asset.mimeType || "image/jpeg", file: asset.file };
      } else {
        const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png"], copyToCacheDirectory: true, multiple: false });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (asset.size && asset.size > 10 * 1024 * 1024) throw new Error(fileTooLarge);
        file = { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? "application/octet-stream", file: asset.file };
      }
      setBusy(true);
      const updated = slipTarget.current === "deposit"
        ? await uploadMyDepositPaymentSlip(contract.id, file)
        : slipTarget.current === "early"
          ? await uploadMyEarlyEndSlip(contract.id, file)
          : await uploadMyReservationPaymentSlip(contract.id, file);
      onUpdated(updated);
      setNotice(pc.slipSent);
    } catch (e) {
      setError(localizedError(e, pc.slipUploadFailed, locale));
    } finally {
      setBusy(false);
      setPicking(null);
    }
  }

  async function submit(image: string) {
    if (!signing || busy) return;
    if (bookingPaymentBlocksSigning(contract, signing)) {
      setError(pc.bookingPaymentBeforeSigning);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await signMyContract(contract.id, signing, image);
      onUpdated(saved);
      setSigning(null);
      setNotice(pc.signed);
    } catch (e) {
      setError(localizedError(e, pc.signFailed, locale));
    } finally {
      setBusy(false);
    }
  }

  const canSignNow = [
    "draft",
    "awaiting_signatures",
    "awaiting_agent_review",
  ].includes(contract.status);
  const signParty = canSignNow
    ? mine.find((party) => !signedAt(contract, party))
    : undefined;
  const paymentBlocksSigning = bookingPaymentBlocksSigning(contract, signParty);
  const partyReady = ownRequirements
    .filter((row) => row.subject === signParty)
    .every((row) => row.complete);

  return (
    <View style={styles.root}>
      {!!notice && <Text style={[styles.copy, { color: theme.textHeading }]}>{notice}</Text>}
      {!!refreshError && <Text accessibilityRole="alert" style={styles.error}>{refreshError}</Text>}
      {!!error && !signing && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <View style={[styles.card, card]}>
        <Text style={[styles.eyebrow, { color: tokens.colors.brand[500] }]}>E-CONTRACT</Text>
        <View style={styles.cardHeader}>
          <Text style={[styles.heading, title, styles.flex]}>{contract.property}</Text>
          <View style={[styles.badge, { backgroundColor: `${statusColor(contract.status)}15` }]}>
            <Text style={[styles.badgeLabel, { color: statusColor(contract.status) }]}>
              {tc.common.status[contract.status]}
            </Text>
          </View>
        </View>
        <View style={styles.contractLine}>
          <View style={[styles.kindIcon, { backgroundColor: mode === "tenant" ? theme.background : `${accentColor}18` }]}>
            <MobileIcon name={CONTRACT_ICON[contract.formKind]} size={18} color={mode === "tenant" ? theme.screenTitle : accentColor} />
          </View>
          <Text style={[styles.copy, title, styles.contractNoText]}>
            {fillTemplate(tc.common.contractNo, { no: contract.contractNo })}
          </Text>
        </View>
        <Text style={[styles.copy, body]}>
          {contract.tenant}
          {contract.room ? ` · ${fillTemplate(tc.common.room, { room: contract.room })}` : ""}
        </Text>
        <Text style={[styles.copy, body]}>
          {locale === "th" ? contract.agreementTypeName : tc.common.kinds[contract.formKind]}
          {contract.formKind === "reservation"
            ? ` · ${fillTemplate(tc.common.reservationFee, { amount: money(contract.reservationFee) })}`
            : contract.formKind === "lease" || contract.formKind === "renewal"
              ? ` · ${fillTemplate(tc.common.rent, { amount: money(contract.monthlyRent) })}`
              : ""}
        </Text>
        <Text style={[styles.copy, body]}>
          {contract.formKind === "reservation"
            ? fillTemplate(tc.common.bookingAndMoveIn, { booking: dateLabel(contract.bookingDate), moveIn: dateLabel(contract.moveInDate) })
            : contract.formKind === "broker_appointment"
              ? fillTemplate(tc.common.dated, { date: dateLabel(contract.startDate) })
              : `${dateLabel(contract.startDate)} – ${dateLabel(contract.endDate)}`}
        </Text>
        <MobileButton
          variant="outline"
          disabled={previewBusy}
          isLoading={previewBusy}
          onPress={() => void openDocument()}
        >
          {tc.party.viewContractDocument}
        </MobileButton>
      </View>

      {/* D5: a cancelled deal: who caused it, why, and what is forfeited or refunded (by when, and when refunded). */}
      {contract.cancellation ? (
        <View style={[styles.card, card]}>
          <DealCancellationSummary cancellation={contract.cancellation} today={dateKey(new Date())} />
        </View>
      ) : null}

      {/* D13: the landlord sees the commission confirmation they sign with the letter (the tenant's has none). */}
      <ReservationTerms
        contract={contract}
        today={dateKey(new Date())}
        showDue={false}
        onOpenCommission={() => void openPaymentDocument("commission-confirmation")}
      />

      {contract.formKind === "reservation" && (
        <ReservationPaymentCard
          contract={contract}
          busy={busy || previewBusy || refreshing || picking != null}
          onOpen={(kind) => void openPaymentDocument(kind)}
          onUpload={mine.includes("tenant") ? () => { slipTarget.current = "reservation"; setSlipSourceOpen(true); } : undefined}
        />
      )}

      {(contract.formKind === "lease" || contract.formKind === "renewal") && showCollect && collectInvoice ? (
        <View style={[styles.card, card]}>
          <Text style={[styles.copy, title]}>{t.tenant.bills.earlyEndInvoice}</Text>
          <MobileButton variant="outline" onPress={() => void openEarlyFile("invoice")}>{t.tenant.bills.earlyEndInvoice}</MobileButton>
          {mine.includes("tenant") && !collectInvoice.slipPath ? (
            <MobileButton disabled={busy} onPress={() => { slipTarget.current = "early"; setSlipSourceOpen(true); }}>
              {t.tenant.bills.earlyEndPay}
            </MobileButton>
          ) : null}
          {collectInvoice.slipPath ? (
            <MobileButton variant="outline" onPress={() => void openEarlyFile("slip")}>{t.tenant.bills.earlyEndSlip}</MobileButton>
          ) : null}
        </View>
      ) : null}

      {contract.formKind === "lease" && (
        <DepositPaymentCard
          contract={contract}
          busy={busy || previewBusy || refreshing || picking != null}
          onOpen={(kind) => void openPaymentDocument(kind)}
          onUpload={mine.includes("tenant") ? () => { slipTarget.current = "deposit"; setSlipSourceOpen(true); } : undefined}
        />
      )}

      {contract.formKind === "lease" && (
        // D6: the landlord and the tenant review the handover and sign their own side.
        <HandoverCard
          key={`handover:${contract.id}`}
          contractId={contract.id}
          mode="party"
          refreshKey={`${contract.status}:${contract.depositPayment?.status ?? ""}:${reloadToken}`}
        />
      )}
      {(contract.formKind === "lease" || contract.formKind === "renewal") && (
        <HandoverCard
          key={`move-out:${contract.id}`}
          contractId={contract.id}
          mode="party"
          kind="move_out"
          refreshKey={`${contract.status}:${reloadToken}`}
        />
      )}
      {(contract.formKind === "lease" || contract.formKind === "renewal") && (
        <DepositSettlementCard key={`deposit:${contract.id}`} contractId={contract.id} mode="party" />
      )}

      {mode === "tenant" && contract.formKind === "lease" ? <TenantContractAttachments
        attachments={attachments}
        loading={loading}
        disabled={busy || previewBusy || refreshing}
        onOpen={(id) => void openFile(id)}
      /> : null}

      <View style={[styles.card, card]}>
        <Text style={[styles.contractNo, title]}>{tc.party.myDocuments}</Text>
        {loading ? <ActivityIndicator color={tokens.colors.brand[500]} /> : null}
        {!loading && !ownRequirements.length ? (
          <Text style={[styles.copy, body]}>{tc.party.noMyDocuments}</Text>
        ) : null}
        {ownRequirements.map((requirement) => {
          const doc = attachments?.documents.find(
            (item) =>
              item.isCurrent &&
              item.subject === requirement.subject &&
              requirement.documentTypeCodes.includes(item.documentTypeCode),
          );
          const typeLabel = requirement.documentTypeCodes
            .map(
              (code) =>
                attachments?.documentTypes.find((type) => type.code === code)?.nameTh ??
                code,
            )
            .join(tc.common.or);
          return (
            <View key={requirement.groupKey} style={styles.requirement}>
              <Text style={[styles.copy, title]}>
                {requirement.complete ? "✓ " : "○ "}
                {requirement.label}
              </Text>
              <Text style={[styles.copy, body]}>{typeLabel}</Text>
              {doc ? (
                <MobileButton
                  variant="outline"
                  disabled={busy || refreshing}
                  onPress={() => void openFile(doc.id)}
                >
                  {fillTemplate(tc.common.viewFile, { name: doc.fileName })}
                </MobileButton>
              ) : null}
              {attachments?.editable ? (
                <MobileButton
                  disabled={busy || refreshing}
                  isLoading={picking != null && busy}
                  onPress={() => {
                    const current = doc?.id;
                    if (requirement.documentTypeCodes.length === 1) {
                      void upload(
                        requirement.subject,
                        requirement.documentTypeCodes[0]!,
                        current,
                      );
                      return;
                    }
                    setPicking(requirement.groupKey);
                  }}
                >
                  {doc ? tc.common.reupload : tc.common.attach}
                </MobileButton>
              ) : null}
              {picking === requirement.groupKey ? (
                <View style={styles.typeRow}>
                  {requirement.documentTypeCodes.map((code) => (
                    <MobileButton
                      key={code}
                      variant="outline"
                      disabled={busy || refreshing}
                      onPress={() => {
                        setPicking(null);
                        void upload(requirement.subject, code, doc?.id);
                      }}
                    >
                      {attachments?.documentTypes.find((type) => type.code === code)?.nameTh ??
                        code}
                    </MobileButton>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={[styles.card, card]}>
        <Text style={[styles.contractNo, title]}>{tc.party.signing}</Text>
        {signerKeys(contract).map((party) => {
          const signed = signedAt(contract, party);
          return (
            <Text key={party} style={[styles.copy, signed ? styles.signed : body]}>
              {tc.common.parties[party]}
              {signed ? tc.common.signedSuffix : tc.common.unsignedSuffix}
            </Text>
          );
        })}
        {signParty && attachments && !partyReady ? (
          <Text style={[styles.copy, body]}>{tc.party.attachMineFirst}</Text>
        ) : null}
        {signParty ? (
          <>
            {paymentBlocksSigning && (
              <Text style={[styles.copy, body]}>{pc.bookingPaymentBeforeSigning}</Text>
            )}
            <RejectedAttachmentsNotice items={rejectedAttachments(attachments)} />
            <MobileButton
              disabled={busy || refreshing || loading || !attachments || !partyReady || paymentBlocksSigning}
              onPress={() => {
                setError("");
                setNotice("");
                setSignPadKey((key) => key + 1);
                setSigning(signParty);
              }}
            >
              {fillTemplate(tc.common.signAs, { party: tc.common.parties[signParty] })}
            </MobileButton>
          </>
        ) : null}
      </View>

      <MobileBottomSheet visible={slipSourceOpen} onClose={() => setSlipSourceOpen(false)} maxHeight="50%">
        <View style={{ gap: 12, padding: 16 }}>
          <Text style={[styles.contractNo, title]}>{tc.party.slipTitle}</Text>
          <MobileButton onPress={() => chooseSlipSource("photos")}>{tc.party.fromPhotos}</MobileButton>
          <MobileButton variant="outline" onPress={() => chooseSlipSource("documents")}>{tc.party.fromFiles}</MobileButton>
          <MobileButton variant="outline" onPress={() => setSlipSourceOpen(false)}>{tc.common.cancel}</MobileButton>
        </View>
      </MobileBottomSheet>

      <MobileBottomSheet
        visible={previewUrl != null}
        onClose={() => setPreviewUrl(null)}
        maxHeight="94%"
        sheetStyle={styles.previewSheet}
      >
        <View style={styles.previewHeader}>
          <Text style={[styles.contractNo, title]}>{previewTitle} · {contract.contractNo}</Text>
          <MobileButton variant="outline" onPress={() => setPreviewUrl(null)}>
            {tc.common.close}
          </MobileButton>
        </View>
        {previewUrl ? (
          <View style={styles.preview}>
            <ContractDocumentPreview url={previewUrl} />
          </View>
        ) : null}
      </MobileBottomSheet>

      <MobileBottomSheet
        visible={signing != null}
        onClose={() => !busy && setSigning(null)}
        maxHeight="90%"
        sheetStyle={styles.signSheet}
      >
        {signing ? (
          <>
            <Text style={[styles.heading, title]}>{fillTemplate(tc.common.signAs, { party: tc.common.parties[signing] })}</Text>
            <Text style={[styles.copy, body]}>
              {contract.contractNo} · {contract.property}
              {contract.room ? ` ${fillTemplate(tc.common.room, { room: contract.room })}` : ""}
            </Text>
            <Text style={[styles.copy, body]}>{tc.common.drawSignature}</Text>
            {!!error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <ContractSignaturePad
              key={`${signPadKey}-${signing}`}
              ref={padRef}
              onOK={(image) => {
                void submit(image);
              }}
              onEmpty={() => setError(pc.drawSignatureFirst)}
            />
            <View style={styles.signActions}>
              <MobileButton
                variant="outline"
                style={styles.signButton}
                disabled={busy || refreshing}
                onPress={() => padRef.current?.clearSignature()}
              >
                {tc.common.clearSignature}
              </MobileButton>
              <MobileButton
                style={styles.signButton}
                disabled={busy || refreshing}
                isLoading={busy}
                onPress={() => {
                  if (!busy) padRef.current?.readSignature();
                }}
              >
                {tc.common.confirmSignature}
              </MobileButton>
            </View>
          </>
        ) : null}
      </MobileBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14, paddingBottom: 24 },
  heading: { fontSize: 22, lineHeight: 33 },
  eyebrow: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 1,
  },
  contractNo: { fontSize: 16, lineHeight: 24 },
  copy: { fontSize: 14, lineHeight: 22, fontFamily: tokens.typography.native.body },
  signed: { color: "#166534", fontFamily: tokens.typography.native.body },
  error: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
    color: "#C74747",
  },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  contractLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  kindIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  contractNoText: { flex: 1 },
  flex: { flex: 1 },
  badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  badgeLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
  },
  requirement: { gap: 6, paddingTop: 8 },
  typeRow: { gap: 8 },
  previewSheet: { height: "90%", paddingHorizontal: 16, gap: 8 },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  preview: { flex: 1, minHeight: 280 },
  signSheet: { paddingHorizontal: 20, gap: 12, flexGrow: 0 },
  signActions: { flexDirection: "row", gap: 10 },
  signButton: { flex: 1 },
});
