import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { MobileButton, MobileInput, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { DepositDeductionType, DepositSettlementView } from "@nestyk/types";
import { fillTemplate, localizedError, useLocale } from "@nestyk/i18n";
import {
  addDepositDeduction,
  approveDepositSettlement,
  completeDepositRefund,
  getDepositSettlement,
  openDepositSettlement,
  removeDepositDeduction,
} from "../lib/agent-contracts-api";
import { getMyDepositSettlement } from "../lib/party-contracts-api";

const TYPES: DepositDeductionType[] = ["damage", "rent", "utilities", "other"];
type Picked = { uri: string; name: string; mimeType: string; file?: File };

async function pickFile(): Promise<Picked | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/jpeg", "image/png"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? "application/octet-stream", file: asset.file };
}

/** D16 (AC-8.4 to 8.6): deductions against the deposit, then one refund. Hidden until the stay is ending. */
export function DepositSettlementCard({ contractId, mode }: { contractId: number; mode: "agent" | "party" }) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const copy = t.contracts.depositSettlement;
  const text = { color: theme.textSecondary, fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 22 };
  const heading = { color: theme.textHeading, fontFamily: tokens.typography.native.headingTh, fontSize: 18, lineHeight: 27 };
  const [view, setView] = useState<DepositSettlementView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState<DepositDeductionType>("damage");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [refund, setRefund] = useState("");
  const [note, setNote] = useState("");
  const [received, setReceived] = useState<Picked | null>(null);
  const [transfer, setTransfer] = useState<Picked | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setView(mode === "agent" ? await getDepositSettlement(contractId) : await getMyDepositSettlement(contractId));
      setError("");
    } catch (e) {
      setError(localizedError(e, copy.open, locale));
    } finally {
      setLoading(false);
    }
  }, [contractId, mode, copy.open, locale]);

  useEffect(() => { void load(); }, [load]);

  async function run(action: () => Promise<DepositSettlementView>) {
    setBusy(true);
    setError("");
    try {
      setView(await action());
    } catch (e) {
      setError(localizedError(e, copy.open, locale));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !view) return <ActivityIndicator color={tokens.colors.brand[500]} />;
  if (!view) return error ? <Text style={{ ...text, color: tokens.colors.danger }}>{error}</Text> : null;
  if (view.blockedReason === "not_leaving") return null;
  const left = view.depositReceived && view.deductionTotal
    ? (Number(view.depositReceived) - Number(view.deductionTotal)).toFixed(2)
    : null;
  return (
    <View style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 }}>
      <Text style={heading}>{copy.title}</Text>
      {view.status === "blocked" && view.blockedReason ? (
        <Text style={text}>{view.blockedReason === "no_deposit" ? copy.noDeposit : view.blockedReason === "has_successor" ? t.contracts.handover.blocked.has_successor : view.blockedReason === "contract_ended" ? t.contracts.handover.blocked.contract_ended : t.contracts.handover.blocked.not_lease}</Text>
      ) : null}
      {view.status === "not_started" && mode === "agent" ? (
        <MobileButton disabled={busy} onPress={() => void run(() => openDepositSettlement(contractId))}>{copy.open}</MobileButton>
      ) : null}
      {view.depositReceived ? <Text style={text}>{fillTemplate(copy.received, { amount: view.depositReceived })}</Text> : null}
      {view.items.length ? view.items.map((item) => (
        <View key={item.id} style={{ gap: 4 }}>
          <Text style={text}>{copy.types[item.type]} · {item.description} · {item.amount}</Text>
          {item.evidenceUrl ? <MobileButton variant="outline" onPress={() => void Linking.openURL(item.evidenceUrl!)}>{copy.evidence}</MobileButton> : null}
          {mode === "agent" && view.status === "draft" ? (
            <MobileButton variant="outline" disabled={busy} onPress={() => void run(() => removeDepositDeduction(contractId, item.id))}>{copy.remove}</MobileButton>
          ) : null}
        </View>
      )) : view.status === "draft" ? <Text style={text}>{copy.none}</Text> : null}
      {mode === "agent" && view.status === "draft" ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {TYPES.map((item) => (
              <MobileButton key={item} variant={type === item ? "primary" : "outline"} onPress={() => setType(item)}>{copy.types[item]}</MobileButton>
            ))}
          </View>
          <MobileInput label={copy.description} value={description} onChangeText={setDescription} maxLength={1000} />
          <MobileInput label={copy.amount} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" maxLength={12} />
          <MobileButton variant="outline" disabled={busy} onPress={() => void (async () => {
            const file = await pickFile();
            if (!file) return;
            await run(() => addDepositDeduction(contractId, { type, description, amount }, file));
            setDescription("");
            setAmount("");
          })()}>{copy.add}</MobileButton>
          {left != null ? <Text style={text}>{fillTemplate(copy.remainder, { amount: left })}</Text> : null}
          <MobileInput label={copy.refund} value={refund} onChangeText={setRefund} keyboardType="decimal-pad" maxLength={12} />
          <MobileInput label={copy.note} value={note} onChangeText={setNote} maxLength={1000} />
          <MobileButton disabled={busy} onPress={() => void run(() => approveDepositSettlement(contractId, refund, note))}>{copy.approve}</MobileButton>
        </View>
      ) : null}
      {view.status === "approved" ? <Text style={text}>{fillTemplate(copy.approved, { amount: view.refundAmount ?? "" })}</Text> : null}
      {mode === "agent" && view.status === "approved" && Number(view.refundAmount) > 0 ? (
        <View style={{ gap: 8 }}>
          <MobileButton variant="outline" onPress={() => void pickFile().then((file) => file && setReceived(file))}>{received ? received.name : copy.receivedProof}</MobileButton>
          <MobileButton variant="outline" onPress={() => void pickFile().then((file) => file && setTransfer(file))}>{transfer ? transfer.name : copy.transferProof}</MobileButton>
          <MobileButton disabled={busy || !received || !transfer} onPress={() => received && transfer && void run(() => completeDepositRefund(contractId, received, transfer))}>{copy.complete}</MobileButton>
        </View>
      ) : null}
      {view.status === "completed" ? <Text style={text}>{copy.done}</Text> : null}
      {view.returnReceivedUrl ? <MobileButton variant="outline" onPress={() => void Linking.openURL(view.returnReceivedUrl!)}>{copy.receivedProof}</MobileButton> : null}
      {view.refundProofUrl ? <MobileButton variant="outline" onPress={() => void Linking.openURL(view.refundProofUrl!)}>{copy.transferProof}</MobileButton> : null}
      {error ? <Text style={{ ...text, color: tokens.colors.danger }}>{error}</Text> : null}
    </View>
  );
}
