import React from "react";
import { Pressable, Text, View } from "react-native";
import { MobileInput, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { LeaseAgreementInput } from "@nestyk/types";
import { fillTemplate, useLocale, type ContractCopy } from "@nestyk/i18n";
import { localeTag } from "../lib/lead-format";

type TextField = Exclude<
  keyof LeaseAgreementInput,
  "landlordSignaturePng" | "tenantSignaturePng"
>;

function splitStoredName(name: string): [string, string] {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return [parts[0] ?? "", parts.slice(1).join(" ")];
}

export function completeLeaseNames(
  input: Partial<LeaseAgreementInput>,
): LeaseAgreementInput {
  const form = { ...emptyLeaseAgreementForm(), ...input };
  if (!form.landlordFirstName.trim() && !form.landlordLastName.trim()) {
    const [first, last] = splitStoredName(form.landlordName);
    form.landlordFirstName = first;
    form.landlordLastName = last;
  }
  if (!form.tenantFirstName.trim() && !form.tenantLastName.trim()) {
    const [first, last] = splitStoredName(form.tenantName);
    form.tenantFirstName = first;
    form.tenantLastName = last;
  }
  return form;
}

export function emptyLeaseAgreementForm(): LeaseAgreementInput {
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
    landlordEmail: "",
    tenantName: "",
    tenantFirstName: "",
    tenantLastName: "",
    tenantNationality: "",
    tenantId: "",
    tenantAddress: "",
    tenantPhone: "",
    tenantEmail: "",
    propertyType: "",
    project: "",
    houseNo: "",
    propertyAddress: "",
    roomType: "",
    floor: "",
    area: "",
    termMonths: "",
    termFrom: "",
    termTo: "",
    monthlyRent: "",
    monthlyRentWords: "",
    rentDueDay: "",
    graceDay: "",
    latePenalty: "",
    latePenaltyWords: "",
    bankName: "",
    accountName: "",
    accountNo: "",
    otherPaymentMethod: "",
    advanceMonths: "",
    advanceAmount: "",
    depositMonths: "",
    depositAmount: "",
    otherInitialPayment: "",
    additionalTerms: "",
    agentContact: "",
    landlordSignName: "",
    tenantSignName: "",
    witnessSignName: "",
    landlordSignaturePng: "",
    tenantSignaturePng: "",
  };
}

export const LEASE_AGREEMENT_REQUIRED: TextField[] = [
  "issueDate",
  "landlordFirstName",
  "tenantFirstName",
  "project",
  "termFrom",
  "termTo",
  "monthlyRent",
  "depositAmount",
];

/** Must match the `TEXT` limits in apps/api/src/agent/contracts/lease-agreement.ts. */
export const LEASE_AGREEMENT_MAX_LENGTH: Record<TextField, number> = {
  documentNo: 40,
  issueDate: 32,
  landlordName: 80,
  landlordFirstName: 80,
  landlordLastName: 80,
  landlordNationality: 40,
  landlordId: 40,
  landlordAddress: 160,
  landlordPhone: 40,
  landlordEmail: 80,
  tenantName: 80,
  tenantFirstName: 80,
  tenantLastName: 80,
  tenantNationality: 40,
  tenantId: 40,
  tenantAddress: 160,
  tenantPhone: 40,
  tenantEmail: 80,
  propertyType: 60,
  project: 80,
  houseNo: 40,
  propertyAddress: 160,
  roomType: 60,
  floor: 20,
  area: 20,
  termMonths: 12,
  termFrom: 32,
  termTo: 32,
  monthlyRent: 40,
  monthlyRentWords: 80,
  rentDueDay: 8,
  graceDay: 8,
  latePenalty: 24,
  latePenaltyWords: 60,
  bankName: 80,
  accountName: 80,
  accountNo: 40,
  otherPaymentMethod: 160,
  advanceMonths: 8,
  advanceAmount: 40,
  depositMonths: 8,
  depositAmount: 40,
  otherInitialPayment: 120,
  additionalTerms: 800,
  agentContact: 200,
  landlordSignName: 60,
  tenantSignName: 60,
  witnessSignName: 60,
};

/** Fields without their own input report length errors on the input they are derived from. */
const LENGTH_ERROR_FIELD: Partial<Record<TextField, TextField>> = {
  landlordName: "landlordFirstName",
  landlordSignName: "landlordFirstName",
  tenantName: "tenantFirstName",
  tenantSignName: "tenantFirstName",
  witnessSignName: "agentContact",
};

export function leaseAgreementFieldErrors(
  value: LeaseAgreementInput,
  messages: ContractCopy["validation"],
): Partial<Record<TextField, string>> {
  const errors: Partial<Record<TextField, string>> = {};
  for (const [key, max] of Object.entries(LEASE_AGREEMENT_MAX_LENGTH) as [TextField, number][]) {
    if (key === "documentNo" || String(value[key] ?? "").trim().length <= max) continue;
    const target = LENGTH_ERROR_FIELD[key];
    errors[target ?? key] = target === "landlordFirstName" || target === "tenantFirstName"
      ? fillTemplate(messages.nameMaxLength, { max })
      : fillTemplate(messages.maxLength, { max });
  }
  for (const key of LEASE_AGREEMENT_REQUIRED) {
    if (!String(value[key] ?? "").trim()) errors[key] = messages.required;
  }
  for (const key of ["issueDate", "termFrom", "termTo"] as const) {
    if (value[key].trim() && !/^\d{4}-\d{2}-\d{2}$/.test(value[key].trim()))
      errors[key] = messages.dateFormat;
  }
  if (
    value.termFrom.trim() &&
    value.termTo.trim() &&
    value.termTo.trim() <= value.termFrom.trim()
  )
    errors.termTo = messages.endAfterStart;
  return errors;
}

const FIELDS: Array<{
  key: keyof ContractCopy["lease"]["fields"];
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
  { key: "landlordEmail" },
  { key: "tenantFirstName", required: true },
  { key: "tenantLastName" },
  { key: "tenantNationality" },
  { key: "tenantId" },
  { key: "tenantAddress", multiline: true },
  { key: "tenantPhone" },
  { key: "tenantEmail" },
  { key: "propertyType" },
  { key: "project", required: true },
  { key: "houseNo" },
  { key: "propertyAddress", multiline: true },
  { key: "roomType" },
  { key: "floor" },
  { key: "area" },
  { key: "termMonths" },
  {
    key: "termFrom",
    required: true,
    placeholder: "2026-10-01",
  },
  {
    key: "termTo",
    required: true,
    placeholder: "2027-09-30",
  },
  { key: "monthlyRent", required: true },
  { key: "monthlyRentWords" },
  { key: "rentDueDay" },
  { key: "graceDay" },
  { key: "latePenalty" },
  { key: "latePenaltyWords" },
  { key: "bankName" },
  { key: "accountName" },
  { key: "accountNo" },
  {
    key: "otherPaymentMethod",
    multiline: true,
  },
  { key: "advanceMonths" },
  { key: "advanceAmount" },
  { key: "depositMonths" },
  {
    key: "depositAmount",
    required: true,
  },
  { key: "otherInitialPayment" },
  {
    key: "additionalTerms",
    multiline: true,
  },
  {
    key: "agentContact",
    multiline: true,
  },
];

/** Maps existing validation errors back to the section where they can be corrected. */
export function leaseAgreementFieldStep(key: string): number {
  if (
    key === "issueDate" ||
    key.startsWith("landlord") ||
    key.startsWith("tenant")
  )
    return 0;
  if (
    [
      "propertyType",
      "project",
      "houseNo",
      "propertyAddress",
      "roomType",
      "floor",
      "area",
      "termMonths",
      "termFrom",
      "termTo",
    ].includes(key)
  )
    return 1;
  if (["additionalTerms", "agentContact", "witnessSignName"].includes(key))
    return 3;
  return 2;
}

export function LeaseAgreementFields({
  value,
  onChange,
  disabled,
  errors,
  step,
  onStepChange,
}: {
  value: LeaseAgreementInput;
  onChange: (next: LeaseAgreementInput) => void;
  disabled?: boolean;
  errors?: Partial<Record<TextField, string>>;
  step?: number;
  onStepChange?: (step: number) => void;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const tc = t.contracts;
  const lc = tc.lease;
  const body = {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: theme.textHeading,
  };
  const renderFields = (keys: Array<keyof typeof lc.fields>) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {keys.map((key) => {
        const field = FIELDS.find((item) => item.key === key)!;
        const label = lc.fields[key];
        const wide =
          field.multiline ||
          /Email$|Id$|Words$/.test(key) ||
          [
            "project",
            "propertyType",
            "monthlyRent",
            "accountNo",
            "issueDate",
            "otherInitialPayment",
          ].includes(key);
        return (
          <View
            key={key}
            style={{
              flexGrow: 1,
              flexBasis: wide ? "100%" : "45%",
              minWidth: 130,
              justifyContent: "flex-end",
            }}
          >
            <MobileInput
              label={label}
              accessibilityLabel={label}
              required={field.required}
              error={errors?.[field.key]}
              value={value[field.key]}
              onChangeText={(text) => {
                const next = { ...value, [field.key]: text };
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
                if (
                  field.key === "tenantFirstName" ||
                  field.key === "tenantLastName"
                ) {
                  const full = [next.tenantFirstName, next.tenantLastName]
                    .map((part) => part.trim())
                    .filter(Boolean)
                    .join(" ");
                  next.tenantName = full;
                  next.tenantSignName = full;
                }
                if (
                  field.key === "agentContact" &&
                  !value.witnessSignName.trim()
                )
                  next.witnessSignName = text;
                onChange(next);
              }}
              placeholder={field.placeholder}
              editable={!disabled}
              maxLength={LEASE_AGREEMENT_MAX_LENGTH[field.key]}
              multiline={field.multiline}
              autoCapitalize={key.endsWith("Email") ? "none" : "sentences"}
              keyboardType={
                key.endsWith("Email")
                  ? "email-address"
                  : key.endsWith("Phone")
                    ? "phone-pad"
                    : /Months$|Amount$/.test(key) ||
                        [
                          "area",
                          "monthlyRent",
                          "latePenalty",
                          "rentDueDay",
                          "graceDay",
                        ].includes(key)
                      ? "decimal-pad"
                      : "default"
              }
              style={{ borderRadius: 12 }}
            />
          </View>
        );
      })}
    </View>
  );
  const card = (
    title: string,
    children: React.ReactNode,
    editStep?: number,
  ) => (
    <View
      style={{
        padding: 16,
        gap: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            ...body,
            fontFamily: tokens.typography.native.headingTh,
            fontSize: 16,
            lineHeight: 24,
            flex: 1,
          }}
        >
          {title}
        </Text>
        {editStep !== undefined && onStepChange && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={fillTemplate(tc.common.editSection, { label: title })}
            disabled={disabled}
            onPress={() => onStepChange(editStep)}
            style={{
              minHeight: 44,
              justifyContent: "center",
              paddingHorizontal: 8,
            }}
          >
            <Text style={{ ...body, color: theme.textSecondary }}>{tc.common.edit}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
  const row = (label: string, text: string) => (
    <View key={label} style={{ flexDirection: "row", gap: 12 }}>
      <Text style={{ ...body, color: theme.textSecondary, flex: 1 }}>
        {label}
      </Text>
      <Text style={{ ...body, flex: 1, textAlign: "right" }}>
        {text || tc.common.notSpecified}
      </Text>
    </View>
  );
  const amount = (text: string) => {
    const number = Number(text.replace(/,/g, ""));
    return text.trim() && Number.isFinite(number)
      ? fillTemplate(tc.common.baht, {
          amount: number.toLocaleString(localeTag(locale)),
        })
      : text;
  };
  const months = (count: string) => fillTemplate(tc.common.months, { count });
  const dateLabel = (text: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const date = new Date(`${text}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? text
      : date.toLocaleDateString(localeTag(locale), {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
  };
  const shown = (index: number) => step === undefined || step === index;
  return (
    <View style={{ gap: 16 }}>
      {shown(0) && (
        <>
          {card(lc.document, renderFields(["issueDate"]))}
          {card(
            tc.common.parties.owner,
            renderFields([
              "landlordFirstName",
              "landlordLastName",
              "landlordNationality",
              "landlordId",
              "landlordAddress",
              "landlordPhone",
              "landlordEmail",
            ]),
          )}
          {card(
            tc.common.parties.tenant,
            renderFields([
              "tenantFirstName",
              "tenantLastName",
              "tenantNationality",
              "tenantId",
              "tenantAddress",
              "tenantPhone",
              "tenantEmail",
            ]),
          )}
        </>
      )}
      {shown(1) && (
        <>
          {card(
            lc.property,
            renderFields([
              "propertyType",
              "project",
              "houseNo",
              "propertyAddress",
              "roomType",
              "floor",
              "area",
            ]),
          )}
          {card(
            lc.term,
            <>
              {renderFields(["termMonths", "termFrom", "termTo"])}
              {!!value.termFrom &&
                !!value.termTo &&
                !errors?.termFrom &&
                !errors?.termTo && (
                  <View
                    style={{
                      backgroundColor: tokens.colors.brand[50],
                      padding: 12,
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ ...body, color: tokens.colors.onBrand }}>
                      {[
                        value.termMonths ? months(value.termMonths) : "",
                        `${dateLabel(value.termFrom)} – ${dateLabel(value.termTo)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                )}
            </>,
          )}
        </>
      )}
      {shown(2) && (
        <>
          {card(
            lc.monthlyRent,
            renderFields(["monthlyRent", "monthlyRentWords"]),
          )}
          {card(
            lc.dueAndPenalty,
            renderFields([
              "rentDueDay",
              "graceDay",
              "latePenalty",
              "latePenaltyWords",
            ]),
          )}
          {card(
            lc.account,
            renderFields([
              "bankName",
              "accountName",
              "accountNo",
              "otherPaymentMethod",
            ]),
          )}
          {card(
            lc.initialCosts,
            renderFields([
              "advanceMonths",
              "advanceAmount",
              "depositMonths",
              "depositAmount",
              "otherInitialPayment",
            ]),
          )}
        </>
      )}
      {shown(3) && (
        <>
          {card(lc.additionalTerms, renderFields(["additionalTerms"]))}
          {card(lc.witness, renderFields(["agentContact"]))}
          {step === 3 && (
            <>
              {card(
                lc.parties,
                <>
                  {row(lc.issueDate, dateLabel(value.issueDate))}
                  {row(
                    tc.common.parties.owner,
                    value.landlordName ||
                      [value.landlordFirstName, value.landlordLastName]
                        .filter(Boolean)
                        .join(" "),
                  )}
                  {row(
                    lc.landlordContact,
                    [value.landlordPhone, value.landlordEmail]
                      .filter(Boolean)
                      .join("\n"),
                  )}
                  {row(
                    tc.common.parties.tenant,
                    value.tenantName ||
                      [value.tenantFirstName, value.tenantLastName]
                        .filter(Boolean)
                        .join(" "),
                  )}
                  {row(
                    lc.tenantContact,
                    [value.tenantPhone, value.tenantEmail]
                      .filter(Boolean)
                      .join("\n"),
                  )}
                </>,
                0,
              )}
              {card(
                lc.roomAndTerm,
                <>
                  {row(
                    lc.propertyRow,
                    [value.propertyType, value.project]
                      .filter(Boolean)
                      .join(" · "),
                  )}
                  {row(lc.houseNo, value.houseNo)}
                  {row(lc.propertyAddress, value.propertyAddress)}
                  {row(lc.roomType, value.roomType)}
                  {row(lc.floor, value.floor)}
                  {row(lc.area, value.area ? fillTemplate(tc.common.sqm, { area: value.area }) : "")}
                  {row(
                    lc.leaseTerm,
                    value.termMonths ? months(value.termMonths) : "",
                  )}
                  {row(lc.start, dateLabel(value.termFrom))}
                  {row(lc.end, dateLabel(value.termTo))}
                </>,
                1,
              )}
              {card(
                lc.rentAndPayment,
                <>
                  {row(lc.monthlyRent, amount(value.monthlyRent))}
                  {row(
                    lc.due,
                    value.rentDueDay
                      ? fillTemplate(lc.dueDay, { day: value.rentDueDay })
                      : "",
                  )}
                  {row(lc.grace, value.graceDay)}
                  {row(lc.penalty, amount(value.latePenalty))}
                  {row(
                    lc.advance,
                    [
                      amount(value.advanceAmount),
                      value.advanceMonths
                        ? `(${months(value.advanceMonths)})`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" "),
                  )}
                  {row(
                    lc.deposit,
                    [
                      amount(value.depositAmount),
                      value.depositMonths
                        ? `(${months(value.depositMonths)})`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" "),
                  )}
                  {row(lc.otherInitial, value.otherInitialPayment)}
                  {row(
                    lc.account,
                    [value.bankName, value.accountName, value.accountNo]
                      .filter(Boolean)
                      .join("\n"),
                  )}
                  {row(lc.otherPayment, value.otherPaymentMethod)}
                </>,
                2,
              )}
              {card(
                lc.signers,
                <>
                  {row(tc.common.parties.owner, value.landlordSignName)}
                  {row(tc.common.parties.tenant, value.tenantSignName)}
                  {row(lc.witnessRow, value.witnessSignName)}
                  <Text
                    style={{
                      ...body,
                      color: theme.textSecondary,
                      fontSize: 12,
                      lineHeight: 18,
                    }}
                  >
                    {lc.signersHint}
                  </Text>
                </>,
              )}
            </>
          )}
        </>
      )}
    </View>
  );
}
