import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { MobileButton, MobileInput, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { AgentContract, CancelDeal, DealCancellation, DealCancellationParty, DealCancellationPreview } from "@nestyk/types";
import { fillTemplate, useLocale } from "@nestyk/i18n";
import { billFormatters } from "../lib/bill-format";
import {
  MAX_EVIDENCE_FILES,
  canCancelDeal,
  dealCancellationOutcome,
  isIsoDate,
  missingDealCancellationFields,
} from "../lib/deal-cancellation";

export type PickedFile = { uri: string; name: string; mimeType: string; file?: File };

async function pickFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png"], copyToCacheDirectory: true, multiple: false });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset?.uri) return null;
  return { uri: asset.uri, name: asset.name || "file", mimeType: asset.mimeType || "application/octet-stream", file: "file" in asset ? asset.file : undefined };
}

/**
 * D5 (AC-C.1 to C.4): a cancelled deal: who caused it, why, and the money (forfeited, or refunded by a day and when).
 * The agent also gets the evidence and the refund proof (`onOpen`); the landlord and the tenant get neither.
 */
export function DealCancellationSummary({
  cancellation,
  today,
  onOpen,
}: {
  cancellation: DealCancellation;
  today: string;
  onOpen?: (url: string, label: string) => void;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const dc = t.contracts.dealCancel;
  const fmt = billFormatters(locale);
  const text = { color: theme.textSecondary, fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20 };
  const late = cancellation.refundAmount > 0 && !cancellation.refundedOn && !!cancellation.refundDueOn && today > cancellation.refundDueOn;
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ ...text, color: theme.textHeading, fontFamily: tokens.typography.native.bodyBold, fontSize: 14 }}>{dc.cancelledTitle}</Text>
      <Text style={text}>{fillTemplate(dc.cancelledBy, { party: cancellation.atFault === "tenant" ? dc.tenant : dc.landlord })}</Text>
      <Text style={text}>{fillTemplate(dc.cancelledReason, { reason: cancellation.reason })}</Text>
      {cancellation.bookingReceived + cancellation.depositReceived > 0 ? (
        <Text style={text}>{fillTemplate(dc.receivedSummary, { booking: fmt.amount(cancellation.bookingReceived), deposit: fmt.amount(cancellation.depositReceived) })}</Text>
      ) : null}
      {cancellation.forfeitedAmount > 0 ? <Text style={text}>{fillTemplate(dc.forfeited, { amount: fmt.amount(cancellation.forfeitedAmount) })}</Text> : null}
      {cancellation.refundAmount > 0 ? (
        <Text style={text}>{fillTemplate(dc.refund, { amount: fmt.amount(cancellation.refundAmount), date: fmt.date(cancellation.refundDueOn ?? "") })}</Text>
      ) : null}
      {cancellation.refundAmount === 0 && cancellation.forfeitedAmount === 0 ? <Text style={text}>{dc.noMoney}</Text> : null}
      {cancellation.refundedOn ? <Text style={text}>{fillTemplate(dc.refunded, { date: fmt.date(cancellation.refundedOn) })}</Text> : null}
      {late ? <Text accessibilityRole="alert" style={{ ...text, color: tokens.colors.danger, fontFamily: tokens.typography.native.bodyBold }}>{dc.refundLate}</Text> : null}
      {cancellation.appointmentEnded ? <Text style={text}>{dc.appointmentEnded}</Text> : null}
      {onOpen ? cancellation.evidenceUrls.map((url, i) => {
        const label = fillTemplate(dc.openEvidence, { n: String(i + 1) });
        return <MobileButton key={url} variant="outline" onPress={() => onOpen(url, label)}>{label}</MobileButton>;
      }) : null}
      {onOpen && cancellation.refundProofUrl ? (
        <MobileButton variant="outline" onPress={() => onOpen(cancellation.refundProofUrl!, dc.openRefundProof)}>{dc.openRefundProof}</MobileButton>
      ) : null}
    </View>
  );
}

/**
 * D5, the agent's card on a booking letter or lease: "cancel the deal" (who caused it, a reason, the day told when
 * the landlord caused it, evidence files, and for the landlord whether to end the broker appointment), then the
 * cancelled summary and, when money is to be refunded, recording the refund once with its proof.
 * `onCancel` / `onRecordRefund` return true when saved; false keeps what was typed.
 */
export function DealCancellationCard({
  contract,
  busy,
  today,
  loadPreview,
  onCancel,
  onRecordRefund,
  onOpen,
  pick = pickFile,
}: {
  contract: Pick<AgentContract, "id" | "formKind" | "status" | "agreementKind" | "cancellation">;
  busy: boolean;
  today: string;
  loadPreview: () => Promise<DealCancellationPreview>;
  onCancel: (input: CancelDeal, evidence: PickedFile[]) => Promise<boolean>;
  onRecordRefund: (refundedOn: string, proof: PickedFile) => Promise<boolean>;
  onOpen: (url: string, label: string) => void;
  pick?: () => Promise<PickedFile | null>;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const dc = t.contracts.dealCancel;
  const fmt = billFormatters(locale);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<DealCancellationPreview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [atFault, setAtFault] = useState<DealCancellationParty | null>(null);
  const [reason, setReason] = useState("");
  const [notifiedOn, setNotifiedOn] = useState("");
  const [evidence, setEvidence] = useState<PickedFile[]>([]);
  const [endAppointment, setEndAppointment] = useState(false);
  const [issue, setIssue] = useState("");
  const [refundedOn, setRefundedOn] = useState("");
  const [proof, setProof] = useState<PickedFile | null>(null);
  const [refundIssue, setRefundIssue] = useState("");
  const text = { color: theme.textSecondary, fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20 };
  const heading = { ...text, color: theme.textHeading, fontFamily: tokens.typography.native.bodyBold, fontSize: 14 };
  // Same chips as the booking letter's options (ReservationLetterFields).
  const chip = (selected: boolean) => ({
    minHeight: 44, justifyContent: "center" as const, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
    borderColor: selected ? tokens.colors.brand[500] : theme.border, backgroundColor: selected ? tokens.colors.brand[50] : theme.background,
  });
  const chipText = (_selected: boolean) => ({ ...text, color: theme.textHeading });

  const cancellation = contract.cancellation;
  if (cancellation) {
    const canRefund = cancellation.refundAmount > 0 && !cancellation.refundedOn;
    async function saveRefund() {
      const day = refundedOn.trim();
      if (!isIsoDate(day)) return setRefundIssue(dc.dateInvalid);
      if (!proof) return setRefundIssue(dc.refundProofMissing);
      setRefundIssue("");
      if (await onRecordRefund(day, proof)) {
        setRefundedOn("");
        setProof(null);
      }
    }
    return (
      <View style={{ gap: 8 }}>
        <DealCancellationSummary cancellation={cancellation} today={today} onOpen={onOpen} />
        {canRefund ? (
          <View style={{ gap: 8 }}>
            <Text style={heading}>{dc.refundTitle}</Text>
            <MobileInput label={dc.refundedOn} value={refundedOn} placeholder={today} maxLength={10} editable={!busy}
              onChangeText={(value) => { setRefundedOn(value); setRefundIssue(""); }} />
            <MobileButton variant="outline" disabled={busy} onPress={() => void pick().then((file) => { if (file) { setProof(file); setRefundIssue(""); } })}>
              {proof ? proof.name : dc.refundProof}
            </MobileButton>
            {refundIssue ? <Text accessibilityRole="alert" style={{ ...text, color: tokens.colors.danger }}>{refundIssue}</Text> : null}
            <MobileButton disabled={busy} isLoading={busy} onPress={() => void saveRefund()}>{dc.saveRefund}</MobileButton>
          </View>
        ) : null}
      </View>
    );
  }
  if (!canCancelDeal(contract)) return null;

  function start() {
    setOpen(true);
    setPreview(null);
    setLoadError("");
    setIssue("");
    loadPreview().then(setPreview, (e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  }
  function close() {
    setOpen(false);
    setAtFault(null);
    setReason("");
    setNotifiedOn("");
    setEvidence([]);
    setEndAppointment(false);
    setIssue("");
  }
  async function confirm() {
    const missing = missingDealCancellationFields({ reason, evidenceCount: evidence.length, atFault, notifiedOn });
    if (missing.length) return setIssue(fillTemplate(dc.missing, { fields: missing.map((field) => dc.fields[field]).join(", ") }));
    if (atFault === "landlord" && !isIsoDate(notifiedOn.trim())) return setIssue(dc.dateInvalid);
    setIssue("");
    const input: CancelDeal = {
      atFault: atFault!,
      reason: reason.trim(),
      ...(atFault === "landlord" ? { notifiedOn: notifiedOn.trim(), endAppointment: endAppointment && !!preview?.appointmentActive } : {}),
    };
    if (await onCancel(input, evidence)) close();
  }

  if (!open)
    return (
      <View style={{ gap: 6 }}>
        <Text style={text}>{dc.hint}</Text>
        <MobileButton variant="outline" disabled={busy} onPress={start}>{dc.open}</MobileButton>
      </View>
    );
  const outcome = preview ? dealCancellationOutcome(preview, atFault, notifiedOn.trim()) : null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={heading}>{dc.title}</Text>
      {loadError ? <Text accessibilityRole="alert" style={{ ...text, color: tokens.colors.danger }}>{loadError}</Text> : null}
      {!preview && !loadError ? <Text style={text}>{dc.loading}</Text> : null}
      {preview ? (
        <>
          <Text style={text}>{fillTemplate(dc.willCancel, { list: preview.contracts.map((row) => row.contractNo).join(", ") })}</Text>
          <Text style={text}>{fillTemplate(dc.received, { booking: fmt.amount(preview.bookingReceived), deposit: fmt.amount(preview.depositReceived) })}</Text>
          {preview.pendingSlip ? <Text accessibilityRole="alert" style={{ ...text, color: tokens.colors.danger }}>{dc.pendingSlip}</Text> : null}
          <Text style={heading}>{dc.atFault}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["tenant", "landlord"] as const).map((party) => (
              <Pressable key={party} accessibilityRole="radio" accessibilityState={{ checked: atFault === party, disabled: busy }} disabled={busy}
                onPress={() => { setAtFault(party); setIssue(""); }} style={chip(atFault === party)}>
                <Text style={chipText(atFault === party)}>{party === "tenant" ? dc.tenant : dc.landlord}</Text>
              </Pressable>
            ))}
          </View>
          <MobileInput label={dc.reason} value={reason} multiline maxLength={1000} editable={!busy}
            onChangeText={(value) => { setReason(value); setIssue(""); }} />
          {atFault === "landlord" ? (
            <MobileInput label={dc.notifiedOn} value={notifiedOn} placeholder={today} maxLength={10} editable={!busy}
              onChangeText={(value) => { setNotifiedOn(value); setIssue(""); }} />
          ) : null}
          <Text style={text}>{fillTemplate(dc.evidence, { max: String(MAX_EVIDENCE_FILES) })}</Text>
          {evidence.map((file, i) => (
            <MobileButton key={`${file.uri}:${i}`} variant="outline" disabled={busy}
              onPress={() => setEvidence((files) => files.filter((_, index) => index !== i))}>
              {fillTemplate(dc.removeFile, { name: file.name })}
            </MobileButton>
          ))}
          {evidence.length < MAX_EVIDENCE_FILES ? (
            <MobileButton variant="outline" disabled={busy}
              onPress={() => void pick().then((file) => { if (file) { setEvidence((files) => [...files, file].slice(0, MAX_EVIDENCE_FILES)); setIssue(""); } })}>
              {dc.addEvidence}
            </MobileButton>
          ) : null}
          {atFault === "landlord" && preview.appointmentActive ? (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: endAppointment, disabled: busy }} disabled={busy}
              onPress={() => setEndAppointment((value) => !value)}>
              <Text style={{ ...text, color: theme.textHeading }}>{`${endAppointment ? "✓ " : "□ "}${dc.endAppointment}`}</Text>
            </Pressable>
          ) : null}
          {atFault === "landlord" && preview.appointmentActive && !endAppointment ? <Text style={text}>{dc.keepAppointment}</Text> : null}
          {outcome ? (
            <Text style={heading}>
              {outcome.kind === "forfeit"
                ? fillTemplate(dc.outcomeForfeit, { amount: fmt.amount(outcome.amount) })
                : outcome.kind === "refund"
                  ? outcome.dueOn
                    ? fillTemplate(dc.outcomeRefund, { amount: fmt.amount(outcome.amount), date: fmt.date(outcome.dueOn) })
                    : fillTemplate(dc.outcomeRefundNoDate, { amount: fmt.amount(outcome.amount), days: String(preview.refundDays) })
                  : dc.outcomeNone}
            </Text>
          ) : null}
          {issue ? <Text accessibilityRole="alert" style={{ ...text, color: tokens.colors.danger }}>{issue}</Text> : null}
          <MobileButton disabled={busy} isLoading={busy} onPress={() => void confirm()}>{dc.confirm}</MobileButton>
        </>
      ) : null}
      <MobileButton variant="outline" disabled={busy} onPress={close}>{dc.keep}</MobileButton>
    </View>
  );
}
