import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Text, View } from "react-native";
import { MobileButton, MobileInput, useMobileTheme } from "@nestyk/ui/native";
import { localizedError, useLocale } from "@nestyk/i18n";
import type {
  AgentTenant,
  CommissionConfirmation,
  CommissionConfirmationInput,
} from "@nestyk/types";
import {
  createCommissionConfirmation,
  getNextCommissionNumber,
} from "../lib/agent-contracts-api";

type Field = keyof CommissionConfirmationInput;

const OPTIONAL = new Set<Field>([
  "documentNo",
  "landlordLastName",
  "tenantLastName",
  "landlordNationality",
  "landlordId",
  "agentNationality",
  "agentId",
  "propertyType",
  "project",
  "unitNo",
  "tenantNationality",
  "tenantIdentity",
  "leasePeriod",
  "leaseStart",
  "leaseEnd",
  "bankAccount",
  "landlordSignName",
  "agentSignName",
  "landlordSignDate",
  "agentSignDate",
]);

const ORDER: Field[] = [
  "documentNo",
  "issueDate",
  "landlordFirstName",
  "landlordLastName",
  "landlordNationality",
  "landlordId",
  "agentName",
  "agentNationality",
  "agentId",
  "propertyType",
  "project",
  "unitNo",
  "propertyAddress",
  "tenantFirstName",
  "tenantLastName",
  "tenantNationality",
  "tenantIdentity",
  "leasePeriod",
  "leaseStart",
  "leaseEnd",
  "monthlyRent",
  "agreedCommission",
  "bankAccount",
  "landlordSignName",
  "landlordSignDate",
  "agentSignName",
  "agentSignDate",
];

const EMPTY: CommissionConfirmationInput = {
  documentNo: "",
  issueDate: "",
  landlordName: "",
  landlordFirstName: "",
  landlordLastName: "",
  landlordNationality: "",
  landlordId: "",
  agentName: "",
  agentNationality: "",
  agentId: "",
  propertyType: "",
  project: "",
  unitNo: "",
  propertyAddress: "",
  tenantName: "",
  tenantFirstName: "",
  tenantLastName: "",
  tenantNationality: "",
  tenantIdentity: "",
  leasePeriod: "",
  leaseStart: "",
  leaseEnd: "",
  monthlyRent: "",
  agreedCommission: "",
  bankAccount: "",
  landlordSignName: "",
  agentSignName: "",
  landlordSignDate: "",
  agentSignDate: "",
};

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function CommissionConfirmationForm({
  tenant,
  onBack,
  onCreated,
}: {
  tenant?: AgentTenant;
  onBack: () => void;
  onCreated: (value: CommissionConfirmation) => void;
}) {
  const { t, locale } = useLocale();
  const labels = t.agent.contracts.commissionConfirmation;
  const shared = t.agent.contracts.financial;
  const { theme } = useMobileTheme();
  const [form, setForm] = useState<CommissionConfirmationInput>(() => ({
    ...EMPTY,
    issueDate: today(),
    project: tenant?.property ?? "",
    unitNo: tenant?.room ?? "",
    propertyAddress: (tenant?.fullAddress ?? "").slice(0, 180),
    ...(() => {
      const given = tenant?.firstName?.trim() ?? "";
      const family = tenant?.lastName?.trim() ?? "";
      const parts = (tenant?.name ?? "").trim().split(/\s+/).filter(Boolean);
      const tenantFirstName = given || parts[0] || "";
      const tenantLastName = family || (given ? "" : parts.slice(1).join(" "));
      return {
        tenantFirstName,
        tenantLastName,
        tenantName:
          [tenantFirstName, tenantLastName].filter(Boolean).join(" ") ||
          tenant?.name ||
          "",
      };
    })(),
    tenantNationality: tenant?.nationality ?? "",
    tenantIdentity: tenant?.identityNumber ?? "",
  }));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const saving = useRef(false);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!saving.current) onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    getNextCommissionNumber()
      .then((row) => {
        if (!active) return;
        setForm((current) => ({ ...current, documentNo: row.documentNo }));
        setError("");
      })
      .catch((e) => {
        if (active) setError(localizedError(e, t.common.errorGeneric, locale));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry, shared.invalid]);
  const fieldLabel = (key: Field) =>
    key === "documentNo"
      ? shared.documentNo
      : key === "issueDate"
        ? shared.issueDate
        : labels[key];
  async function submit() {
    if (saving.current) return;
    const missing = ORDER.some(
      (key) => !OPTIONAL.has(key) && !form[key].trim(),
    );
    if (missing || !form.documentNo.trim()) {
      setError(shared.required);
      return;
    }
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      onCreated(
        await createCommissionConfirmation({
          ...form,
          tenantId: tenant?.id ?? null,
        }),
      );
    } catch (e) {
      setError(localizedError(e, t.common.errorGeneric, locale));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 16, paddingBottom: 24 }}>
      <MobileButton variant="outline" disabled={busy} onPress={onBack}>
        {shared.back}
      </MobileButton>
      <Text style={{ fontSize: 22, lineHeight: 34, color: theme.textHeading }}>
        {labels.title}
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 22, color: theme.textSecondary }}>
        {labels.hint}
      </Text>
      {loading ? (
        <ActivityIndicator />
      ) : !form.documentNo ? (
        <MobileButton onPress={() => setRetry((n) => n + 1)}>
          {shared.retry}
        </MobileButton>
      ) : (
        ORDER.map((key) => (
          <MobileInput
            key={key}
            label={fieldLabel(key)}
            required={!OPTIONAL.has(key)}
            value={form[key]}
            editable={!busy && key !== "documentNo"}
            maxLength={key === "propertyAddress" || key === "bankAccount" ? 180 : 80}
            multiline={key === "propertyAddress" || key === "bankAccount"}
            placeholder={
              key === "issueDate" || key.endsWith("Date") || key.startsWith("lease")
                ? key === "leasePeriod"
                  ? shared.optional
                  : shared.dateHint
                : OPTIONAL.has(key)
                  ? shared.optional
                  : ""
            }
            keyboardType={
              key === "monthlyRent" || key === "agreedCommission"
                ? "decimal-pad"
                : "default"
            }
            onChangeText={(value) =>
              setForm((current) => {
                const next = { ...current, [key]: value };
                if (key === "landlordFirstName" || key === "landlordLastName") {
                  const full = [next.landlordFirstName, next.landlordLastName]
                    .map((part) => part.trim())
                    .filter(Boolean)
                    .join(" ");
                  next.landlordName = full;
                  if (!current.landlordSignName || current.landlordSignName === current.landlordName)
                    next.landlordSignName = full;
                }
                if (key === "tenantFirstName" || key === "tenantLastName") {
                  next.tenantName = [next.tenantFirstName, next.tenantLastName]
                    .map((part) => part.trim())
                    .filter(Boolean)
                    .join(" ");
                }
                return next;
              })
            }
          />
        ))
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: "#DC2626", lineHeight: 24 }}>
          {error}
        </Text>
      )}
      {form.documentNo ? (
        <MobileButton disabled={busy} isLoading={busy} onPress={() => void submit()}>
          {shared.confirm}
        </MobileButton>
      ) : null}
    </View>
  );
}
