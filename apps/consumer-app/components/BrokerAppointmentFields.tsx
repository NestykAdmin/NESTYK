import React from "react";
import { Text, View } from "react-native";
import { MobileInput, useMobileTheme } from "@nestyk/ui/native";
import type { BrokerAppointmentInput } from "@nestyk/types";
import { useLocale, type ContractCopy } from "@nestyk/i18n";

type TextField = Exclude<
  keyof BrokerAppointmentInput,
  "landlordSignaturePng" | "brokerSignaturePng"
>;

export function completeBrokerNames(
  input: Partial<BrokerAppointmentInput>,
): BrokerAppointmentInput {
  const form = { ...emptyBrokerAppointmentForm(), ...input };
  if (!form.landlordFirstName.trim() && !form.landlordLastName.trim()) {
    const parts = form.landlordName.trim().split(/\s+/).filter(Boolean);
    form.landlordFirstName = parts[0] ?? "";
    form.landlordLastName = parts.slice(1).join(" ");
  }
  return form;
}

export function emptyBrokerAppointmentForm(): BrokerAppointmentInput {
  return {
    documentNo: "",
    issueDate: "",
    landlordName: "",
    landlordFirstName: "",
    landlordLastName: "",
    landlordNationality: "",
    landlordId: "",
    landlordAddress: "",
    landlordPhone: "",
    brokerCompany: "",
    brokerContact: "",
    brokerNationality: "",
    brokerId: "",
    brokerPhone: "",
    brokerAddress: "",
    propertyLine: "",
    monthlyRent: "",
    leaseMonths: "",
    commissionFee: "",
    commissionMonths: "",
    landlordSignName: "",
    brokerSignName: "",
    landlordSignaturePng: "",
    brokerSignaturePng: "",
  };
}

export const BROKER_APPOINTMENT_REQUIRED: TextField[] = [
  "issueDate",
  "landlordFirstName",
  "brokerCompany",
  "brokerContact",
  "propertyLine",
];

export function brokerAppointmentFieldErrors(
  value: BrokerAppointmentInput,
  messages: ContractCopy["validation"],
): Partial<Record<TextField, string>> {
  const errors: Partial<Record<TextField, string>> = {};
  for (const key of BROKER_APPOINTMENT_REQUIRED) {
    if (!String(value[key] ?? "").trim()) errors[key] = messages.required;
  }
  if (value.issueDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(value.issueDate.trim()))
    errors.issueDate = messages.dateFormat;
  if (value.commissionFee.trim() && value.commissionMonths.trim())
    errors.commissionFee = messages.commissionEither;
  return errors;
}

const FIELDS: Array<{
  key: keyof ContractCopy["broker"]["fields"];
  required?: boolean;
  multiline?: boolean;
  placeholder?: string;
}> = [
  {
    key: "issueDate",
    required: true,
    placeholder: "2026-10-01",
  },
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

export function BrokerAppointmentFields({
  value,
  onChange,
  disabled,
  errors,
}: {
  value: BrokerAppointmentInput;
  onChange: (next: BrokerAppointmentInput) => void;
  disabled?: boolean;
  errors?: Partial<Record<TextField, string>>;
}) {
  const { theme } = useMobileTheme();
  const { t } = useLocale();
  const bc = t.contracts.broker;
  return (
    <View
      style={{
        gap: 10,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
      }}
    >
      <Text
        style={{
          fontSize: 16,
          lineHeight: 24,
          fontWeight: "600",
          color: theme.textHeading,
        }}
      >
        {bc.details}
      </Text>
      {FIELDS.map((field) => (
        <MobileInput
          key={field.key}
          label={bc.fields[field.key]}
          required={field.required}
          error={errors?.[field.key]}
          value={value[field.key]}
          onChangeText={(text) => {
            const next = { ...value, [field.key]: text };
            if (field.key === "landlordFirstName" || field.key === "landlordLastName") {
              const full = [next.landlordFirstName, next.landlordLastName]
                .map((part) => part.trim())
                .filter(Boolean)
                .join(" ");
              next.landlordName = full;
              next.landlordSignName = full;
            }
            if (field.key === "brokerContact" && !value.brokerSignName.trim())
              next.brokerSignName = text;
            onChange(next);
          }}
          placeholder={field.placeholder}
          editable={!disabled}
          multiline={field.multiline}
        />
      ))}
    </View>
  );
}
