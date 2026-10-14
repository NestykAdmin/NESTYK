import React from "react";
import { Text, View } from "react-native";
import { MobileInput, useMobileTheme } from "@nestyk/ui/native";
import type { LeaseRenewalInput } from "@nestyk/types";
import { useLocale, type ContractCopy } from "@nestyk/i18n";
import { isIsoDate, leaseTermEnd, positiveMonths, shiftIsoDate } from "../lib/lease-term";

type TextField = Exclude<
  keyof LeaseRenewalInput,
  "landlordSignaturePng" | "tenantSignaturePng"
>;

export function emptyLeaseRenewalForm(): LeaseRenewalInput {
  return {
    documentNo: "",
    issueDate: "",
    landlordName: "",
    tenantName: "",
    propertyLine: "",
    firstLeaseNo: "",
    firstLeaseDate: "",
    firstLeaseStart: "",
    firstLeaseEnd: "",
    originalLeaseNo: "",
    originalLeaseDate: "",
    originalExpiryDate: "",
    renewMonths: "",
    startDate: "",
    endDate: "",
    monthlyRent: "",
    dueDay: "",
    bankAccount: "",
    depositCarried: "",
    additionalChanges: "",
    landlordSignName: "",
    tenantSignName: "",
    landlordSignaturePng: "",
    tenantSignaturePng: "",
  };
}

export function leaseRenewalFieldErrors(
  value: LeaseRenewalInput,
  validation: ContractCopy["validation"],
): Partial<Record<TextField, string>> {
  const errors: Partial<Record<TextField, string>> = {};
  const required: TextField[] = [
    "issueDate",
    "landlordName",
    "tenantName",
    "propertyLine",
    "firstLeaseNo",
    "firstLeaseDate",
    "firstLeaseStart",
    "firstLeaseEnd",
    "originalLeaseNo",
    "originalLeaseDate",
    "originalExpiryDate",
    "startDate",
    "endDate",
    "monthlyRent",
    "depositCarried",
  ];
  for (const key of required) {
    if (!value[key].trim()) errors[key] = validation.required;
  }
  for (const key of [
    "issueDate",
    "firstLeaseDate",
    "firstLeaseStart",
    "firstLeaseEnd",
    "originalLeaseDate",
    "originalExpiryDate",
    "startDate",
    "endDate",
  ] as const) {
    if (value[key].trim() && !isIsoDate(value[key].trim()))
      errors[key] = validation.dateFormat;
  }
  return errors;
}

const LOCKED = new Set<TextField>([
  "firstLeaseNo",
  "firstLeaseDate",
  "firstLeaseStart",
  "firstLeaseEnd",
  "originalLeaseNo",
  "originalLeaseDate",
  "originalExpiryDate",
  "startDate",
  "endDate",
]);

function withRenewalTerm(value: LeaseRenewalInput): LeaseRenewalInput {
  const next = { ...value };
  if (isIsoDate(next.originalExpiryDate.trim()))
    next.startDate = shiftIsoDate(next.originalExpiryDate.trim(), 1);
  const months = positiveMonths(next.renewMonths);
  if (months && isIsoDate(next.startDate.trim()))
    next.endDate = leaseTermEnd(next.startDate.trim(), months);
  return next;
}

const FIELDS: Array<{
  key: TextField;
  label: keyof ContractCopy["renewalForm"];
  placeholder?: string;
}> = [
  { key: "issueDate", label: "issueDate", placeholder: "2026-10-12" },
  { key: "landlordName", label: "landlord" },
  { key: "tenantName", label: "tenant" },
  { key: "propertyLine", label: "property" },
  { key: "firstLeaseNo", label: "firstNo" },
  { key: "firstLeaseDate", label: "firstDate", placeholder: "2026-12-25" },
  { key: "firstLeaseStart", label: "firstStart", placeholder: "2026-12-25" },
  { key: "firstLeaseEnd", label: "firstEnd", placeholder: "2027-12-24" },
  { key: "originalLeaseNo", label: "originalNo" },
  { key: "originalLeaseDate", label: "originalDate", placeholder: "2026-11-01" },
  { key: "originalExpiryDate", label: "originalExpiry", placeholder: "2027-12-24" },
  { key: "renewMonths", label: "months", placeholder: "12" },
  { key: "startDate", label: "start", placeholder: "2027-12-25" },
  { key: "endDate", label: "end", placeholder: "2028-12-24" },
  { key: "monthlyRent", label: "rent", placeholder: "21000" },
  { key: "dueDay", label: "dueDay", placeholder: "1" },
  { key: "bankAccount", label: "bank" },
  { key: "depositCarried", label: "deposit", placeholder: "40000" },
  { key: "additionalChanges", label: "changes" },
  { key: "landlordSignName", label: "landlordSign" },
  { key: "tenantSignName", label: "tenantSign" },
];

export function LeaseRenewalFields({
  value,
  onChange,
  disabled,
  errors,
}: {
  value: LeaseRenewalInput;
  onChange: (next: LeaseRenewalInput) => void;
  disabled?: boolean;
  errors: Partial<Record<string, string>>;
}) {
  const { theme } = useMobileTheme();
  const { t } = useLocale();
  const copy = t.contracts.renewalForm;
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 22 }}>
        {copy.startsOnExpiry}
      </Text>
      {FIELDS.map((field) => (
        <View key={field.key} style={{ gap: 6 }}>
          <Text
            style={{
              color: theme.textHeading,
              fontSize: 14,
              lineHeight: 22,
            }}
          >
            {copy[field.label]}
          </Text>
          <MobileInput
            value={value[field.key]}
            editable={!disabled && !LOCKED.has(field.key)}
            placeholder={field.placeholder}
            onChangeText={(next) =>
              onChange(
                withRenewalTerm({ ...value, [field.key]: next }),
              )
            }
          />
          {!!errors[field.key] && (
            <Text style={{ color: "#DC2626", fontSize: 13, lineHeight: 20 }}>
              {errors[field.key]}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
