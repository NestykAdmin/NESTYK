import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  Text,
  View,
} from "react-native";
import {
  MobileBottomSheet,
  MobileButton,
  MobileInput,
  useMobileTheme,
} from "@nestyk/ui/native";
import type {
  AgentContract,
  AgreementAttachmentChecklist,
  BrokerAppointmentInput,
} from "@nestyk/types";
import {
  generateBrokerAppointment,
  getBrokerAppointmentDefaults,
} from "../lib/agent-contracts-api";
import { fillTemplate, localizedError, useLocale, type ContractCopy } from "@nestyk/i18n";
import { completeBrokerNames } from "./BrokerAppointmentFields";
import {
  ContractSignaturePad,
  type ContractSignaturePadHandle,
} from "./ContractSignaturePad";

type TextField = Exclude<
  keyof BrokerAppointmentInput,
  "landlordSignaturePng" | "brokerSignaturePng"
>;

type SignParty = "landlord" | "broker";

const FIELDS: Array<{
  key: keyof ContractCopy["broker"]["fields"];
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
}> = [
  { key: "documentNo", required: true },
  { key: "issueDate", required: true },
  { key: "landlordFirstName", required: true },
  { key: "landlordLastName" },
  { key: "landlordNationality" },
  { key: "landlordId" },
  { key: "landlordAddress", multiline: true },
  { key: "landlordPhone" },
  { key: "brokerCompany", required: true },
  { key: "brokerContact", required: true },
  { key: "brokerNationality" },
  { key: "brokerId" },
  { key: "brokerPhone" },
  { key: "brokerAddress", multiline: true },
  {
    key: "propertyLine",
    required: true,
    multiline: true,
  },
  { key: "monthlyRent" },
  { key: "leaseMonths" },
  {
    key: "commissionFee",
  },
  {
    key: "commissionMonths",
  },
];

const SIGN_PARTIES: Array<{
  key: SignParty;
  title: "landlordSigner" | "brokerSigner";
  pngKey: "landlordSignaturePng" | "brokerSignaturePng";
}> = [
  {
    key: "landlord",
    title: "landlordSigner",
    pngKey: "landlordSignaturePng",
  },
  {
    key: "broker",
    title: "brokerSigner",
    pngKey: "brokerSignaturePng",
  },
];

export function BrokerAppointmentForm({
  contractId: fixedContractId,
  hosts,
  onBack,
  onCreated,
}: {
  /** When opened from a reservation detail, the host is fixed. */
  contractId?: number;
  /** When opened from the create menu, user picks a reservation host. */
  hosts?: AgentContract[];
  onBack: () => void;
  onCreated: (
    value: AgreementAttachmentChecklist,
    hostContractId: number,
  ) => void;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const tc = t.contracts;
  const bc = tc.broker;
  const needsHostPick = fixedContractId == null;
  const [hostId, setHostId] = useState<number | null>(fixedContractId ?? null);
  const [form, setForm] = useState<BrokerAppointmentInput | null>(null);
  const [error, setError] = useState("");
  const [signError, setSignError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [signingParty, setSigningParty] = useState<SignParty | null>(null);
  const [signPadKey, setSignPadKey] = useState(0);
  const padRef = useRef<ContractSignaturePadHandle>(null);
  const saving = useRef(false);
  const title = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };
  const contractId = fixedContractId ?? hostId;

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (signingParty) {
        setSigningParty(null);
        setSignError("");
        return true;
      }
      if (!saving.current) onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, signingParty]);

  useEffect(() => {
    if (!signingParty) return;
    const id = requestAnimationFrame(() => padRef.current?.reinitialize?.());
    return () => cancelAnimationFrame(id);
  }, [signingParty, signPadKey]);

  useEffect(() => {
    if (contractId == null) {
      setForm(null);
      setLoading(false);
      setError("");
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    getBrokerAppointmentDefaults(contractId)
      .then((data) => {
        if (active)
          setForm(
            completeBrokerNames({
              ...data,
              landlordSignaturePng: data.landlordSignaturePng ?? "",
              brokerSignaturePng: data.brokerSignaturePng ?? "",
            }),
          );
      })
      .catch((e) => {
        if (active)
          setError(localizedError(e, t.agent.contracts.notice.loadFormFailed, locale));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [contractId, retry]);

  function openSignSheet(party: SignParty) {
    if (busy || saving.current) return;
    setSignError("");
    setSignPadKey((key) => key + 1);
    setSigningParty(party);
  }

  function clearSignature(party: SignParty) {
    const pngKey =
      party === "landlord" ? "landlordSignaturePng" : "brokerSignaturePng";
    setForm((current) =>
      current ? { ...current, [pngKey]: "" } : current,
    );
  }

  async function save() {
    if (!form || contractId == null || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      onCreated(await generateBrokerAppointment(contractId, form), contractId);
    } catch (e) {
      setError(localizedError(e, t.agent.contracts.notice.createDocumentFailed, locale));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const signingMeta = SIGN_PARTIES.find((row) => row.key === signingParty);
  const hostList = hosts ?? [];

  return (
    <View style={{ gap: 14, paddingBottom: 28 }}>
      <MobileButton variant="outline" disabled={busy} onPress={onBack}>
        {tc.common.back}
      </MobileButton>
      <Text
        style={{
          fontSize: 18,
          lineHeight: 28,
          color: theme.textHeading,
          fontWeight: "600",
        }}
      >
        {bc.create}
      </Text>
      <Text style={{ fontSize: 13, lineHeight: 20, color: theme.textSecondary }}>
        {bc.createHint}
      </Text>

      {needsHostPick && (
        <View style={{ gap: 8 }}>
          <Text style={[{ fontSize: 14, lineHeight: 22, fontWeight: "600" }, title]}>
            {tc.common.hostRequired}
          </Text>
          <Text style={[{ fontSize: 13, lineHeight: 20 }, muted]}>
            {bc.hostHint}
          </Text>
          {!hostList.length ? (
            <Text style={[{ fontSize: 13, lineHeight: 20 }, muted]}>
              {tc.common.noHost}
            </Text>
          ) : (
            hostList.map((host) => {
              const selected = hostId === host.id;
              return (
                <Pressable
                  key={host.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  disabled={busy}
                  onPress={() => setHostId(host.id)}
                  style={({ pressed }) => ({
                    borderWidth: 1,
                    borderColor: selected ? "#F8B615" : theme.border,
                    backgroundColor: selected ? "#FFF8E7" : theme.surface,
                    borderRadius: 12,
                    padding: 12,
                    gap: 4,
                    opacity: pressed || busy ? 0.7 : 1,
                  })}
                >
                  <Text style={[{ fontSize: 15, lineHeight: 24 }, title]}>
                    {host.contractNo}
                  </Text>
                  <Text style={[{ fontSize: 13, lineHeight: 20 }, muted]}>
                    {host.property}
                    {host.room ? ` · ${fillTemplate(tc.common.room, { room: host.room })}` : ""}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      )}

      {loading && <ActivityIndicator color={theme.textHeading} />}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: "#C43D4C" }}>
          {error}
        </Text>
      )}
      {!loading && !!error && contractId != null && !form && (
        <MobileButton onPress={() => setRetry((n) => n + 1)}>
          {tc.common.retry}
        </MobileButton>
      )}
      {form &&
        FIELDS.map((field) => (
          <View key={field.key} style={{ gap: 6 }}>
            <Text style={[{ fontSize: 14, lineHeight: 22 }, title]}>
              {bc.fields[field.key]}
              {field.required ? " *" : ""}
            </Text>
            <MobileInput
              accessibilityLabel={bc.fields[field.key]}
              value={form[field.key]}
              editable={!busy}
              multiline={field.multiline}
              numberOfLines={field.multiline ? 3 : 1}
              textAlignVertical={field.multiline ? "top" : "center"}
              style={
                field.multiline
                  ? { minHeight: 72, paddingTop: 11, paddingBottom: 11 }
                  : undefined
              }
              onChangeText={(value) =>
                setForm((current) => {
                  if (!current) return current;
                  const next = { ...current, [field.key]: value };
                  if (
                    field.key === "landlordFirstName" ||
                    field.key === "landlordLastName"
                  ) {
                    const full = [next.landlordFirstName, next.landlordLastName]
                      .map((part) => part.trim())
                      .filter(Boolean)
                      .join(" ");
                    next.landlordName = full;
                    next.landlordSignName = full;
                  }
                  return next;
                })
              }
              placeholder={field.placeholder}
              maxLength={field.multiline ? 240 : 160}
            />
          </View>
        ))}
      {form && (
        <>
          <Text style={[{ fontSize: 12, lineHeight: 18 }, muted]}>
            {bc.commissionHint}
          </Text>
          <View
            style={{
              gap: 14,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: theme.border,
            }}
          >
            <Text
              style={[
                { fontSize: 16, lineHeight: 26, fontWeight: "600" },
                title,
              ]}
            >
              {bc.signatures}
            </Text>
            <Text style={[{ fontSize: 13, lineHeight: 20 }, muted]}>
              {bc.signaturesHint}
            </Text>
            {SIGN_PARTIES.map((party) => {
              const signed = !!form[party.pngKey];
              return (
                <View
                  key={party.key}
                  style={{
                    gap: 10,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 12,
                    backgroundColor: theme.surface,
                  }}
                >
                  <Text style={[{ fontSize: 15, lineHeight: 24 }, title]}>
                    {bc[party.title]}
                  </Text>
                  <Text style={[{ fontSize: 13, lineHeight: 20 }, muted]}>
                    {signed ? bc.signatureSaved : bc.notSigned}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                    <MobileButton
                      disabled={busy}
                      onPress={() => openSignSheet(party.key)}
                    >
                      {signed ? bc.editSignature : tc.common.sign}
                    </MobileButton>
                    {signed ? (
                      <MobileButton
                        variant="outline"
                        disabled={busy}
                        onPress={() => clearSignature(party.key)}
                      >
                        {tc.common.clearSignature}
                      </MobileButton>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
          <MobileButton
            disabled={busy || contractId == null}
            onPress={() => {
              void save();
            }}
          >
            {busy ? bc.creating : bc.createPdf}
          </MobileButton>
        </>
      )}

      <MobileBottomSheet
        visible={signingParty != null}
        onClose={() => {
          if (busy) return;
          setSigningParty(null);
          setSignError("");
        }}
        maxHeight="90%"
      >
        <View style={{ gap: 12, paddingBottom: 8 }}>
          <Text
            style={{
              fontSize: 18,
              lineHeight: 28,
              fontWeight: "600",
              color: theme.textHeading,
            }}
          >
            {signingMeta ? fillTemplate(bc.signFor, { party: bc[signingMeta.title] }) : tc.common.sign}
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 20, color: theme.textSecondary }}>
            {tc.common.drawSignature}
          </Text>
          {!!signError && (
            <Text accessibilityRole="alert" style={{ color: "#C43D4C" }}>
              {signError}
            </Text>
          )}
          {signingParty ? (
            <ContractSignaturePad
              key={`${signPadKey}-${signingParty}`}
              ref={padRef}
              onOK={(image) => {
                const pngKey =
                  signingParty === "landlord"
                    ? "landlordSignaturePng"
                    : "brokerSignaturePng";
                setForm((current) =>
                  current ? { ...current, [pngKey]: image } : current,
                );
                setSigningParty(null);
                setSignError("");
              }}
              onEmpty={() => setSignError(tc.common.drawSignatureFirst)}
            />
          ) : null}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <MobileButton
              variant="outline"
              disabled={busy}
              onPress={() => padRef.current?.clearSignature()}
            >
              {tc.common.clearSignature}
            </MobileButton>
            <MobileButton
              disabled={busy}
              onPress={() => padRef.current?.readSignature()}
            >
              {tc.common.confirmSignature}
            </MobileButton>
          </View>
        </View>
      </MobileBottomSheet>
    </View>
  );
}
