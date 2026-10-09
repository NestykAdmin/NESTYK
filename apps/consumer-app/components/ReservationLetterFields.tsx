import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { MobileInput, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { ReservationLetterInput } from "@nestyk/types";
import { fillTemplate, useLocale, type ContractCopy } from "@nestyk/i18n";
import { searchOwnerUsers } from "../lib/agent-contracts-api";
import { localeTag } from "../lib/lead-format";

export function emptyReservationLetterForm(): ReservationLetterInput {
  return {
    documentNo: "",
    issueDate: "",
    tenantName: "",
    tenantFirstName: "",
    tenantLastName: "",
    tenantPhone: "",
    tenantEmail: "",
    tenantId: "",
    tenantNationality: "",
    landlordName: "",
    landlordFirstName: "",
    landlordLastName: "",
    landlordPhone: "",
    landlordEmail: "",
    landlordId: "",
    landlordNationality: "",
    agentName: "",
    companyName: "",
    agentPhone: "",
    project: "",
    address: "",
    unitNo: "",
    floor: "",
    area: "",
    beds: "",
    baths: "",
    termMonths: "",
    termFrom: "",
    termTo: "",
    monthlyRent: "",
    advanceMonths: "",
    advanceAmount: "",
    depositMonths: "",
    depositAmount: "",
    reservationPayment: "",
    reservationWords: "",
    applyToAdvance: false,
    applyToDeposit: false,
    balanceDue: "",
    payee: "",
    paymentMethod: "",
    bankAccount: "",
    tenantSignName: "",
    landlordSignName: "",
    agentSignName: "",
  };
}

type TextKey = Exclude<
  keyof ReservationLetterInput,
  "applyToAdvance" | "applyToDeposit"
>;

export const RESERVATION_LETTER_REQUIRED: TextKey[] = [
  "tenantFirstName",
  "landlordFirstName",
  "project",
  "reservationPayment",
];

/** Booking date is the document date; keep a saved draft date, otherwise today in Bangkok. */
export function reservationIssueDate(saved?: string | null) {
  if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) return saved;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function reservationLetterFieldErrors(
  value: ReservationLetterInput,
  messages: ContractCopy["validation"],
): Partial<Record<TextKey, string>> {
  const errors: Partial<Record<TextKey, string>> = {};
  for (const key of RESERVATION_LETTER_REQUIRED) {
    if (!String(value[key] ?? "").trim()) errors[key] = messages.required;
  }
  if (
    value.issueDate.trim() &&
    !/^\d{4}-\d{2}-\d{2}$/.test(value.issueDate.trim())
  )
    errors.issueDate = messages.dateFormat;
  if (
    value.termFrom.trim() &&
    !/^\d{4}-\d{2}-\d{2}$/.test(value.termFrom.trim())
  )
    errors.termFrom = messages.dateFormat;
  if (value.termTo.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(value.termTo.trim()))
    errors.termTo = messages.dateFormat;
  if (!value.tenantPhone.trim()) errors.tenantPhone = messages.required;
  if (!value.tenantEmail.trim()) errors.tenantEmail = messages.required;
  if (!value.landlordPhone.trim()) errors.landlordPhone = messages.required;
  if (!value.landlordEmail.trim()) errors.landlordEmail = messages.required;
  for (const key of ["tenantEmail", "landlordEmail"] as const) {
    if (
      value[key].trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value[key].trim())
    )
      errors[key] = messages.emailFormat;
  }
  return errors;
}

type PartyField = {
  key: keyof ContractCopy["reservation"]["fields"];
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  email?: boolean;
  locked?: boolean;
};

const TENANT_FIELDS: PartyField[] = [
  { key: "tenantFirstName", required: true, locked: true },
  { key: "tenantLastName", locked: true },
  { key: "tenantPhone", required: true, locked: true },
  { key: "tenantEmail", email: true, required: true, locked: true },
  { key: "tenantId", locked: true },
  { key: "tenantNationality", locked: true },
];

const LANDLORD_FIELDS: PartyField[] = [
  { key: "landlordFirstName", required: true },
  { key: "landlordLastName" },
  { key: "landlordPhone", required: true },
  { key: "landlordEmail", email: true, required: true },
  { key: "landlordId" },
  { key: "landlordNationality" },
];

const AGENT_FIELDS: PartyField[] = [
  { key: "agentName" },
  { key: "companyName" },
  { key: "agentPhone" },
];

const PROPERTY_FIELDS: PartyField[] = [
  { key: "project", required: true },
  { key: "address", multiline: true },
  { key: "unitNo" },
  { key: "floor" },
  { key: "area" },
  { key: "beds" },
  { key: "baths" },
  { key: "termMonths" },
  { key: "termFrom", placeholder: "2026-10-15" },
  { key: "termTo", placeholder: "2027-10-14" },
];

const PAYMENT_FIELDS: PartyField[] = [
  { key: "monthlyRent" },
  { key: "advanceMonths" },
  { key: "advanceAmount" },
  { key: "depositMonths" },
  { key: "depositAmount" },
  { key: "reservationPayment", required: true, placeholder: "5000" },
  { key: "balanceDue" },
  { key: "payee" },
  { key: "bankAccount", multiline: true },
  { key: "tenantSignName" },
  { key: "landlordSignName" },
  { key: "agentSignName" },
];

const PAYMENT_OPTIONS = ["transfer", "cash", "credit"] as const;

const THAI_DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];

function readThaiNumber(n: number): string {
  if (n >= 1000000)
    return (
      readThaiNumber(Math.floor(n / 1000000)) +
      "ล้าน" +
      (n % 1000000 === 1 ? "เอ็ด" : n % 1000000 ? readThaiNumber(n % 1000000) : "")
    );
  const chars = String(n).split("").map(Number);
  return chars
    .map((digit, index) => {
      const pos = chars.length - index - 1;
      if (!digit) return "";
      if (pos === 1) return (digit === 1 ? "" : digit === 2 ? "ยี่" : THAI_DIGITS[digit]) + "สิบ";
      return (
        (pos === 0 && digit === 1 && n > 10 ? "เอ็ด" : THAI_DIGITS[digit]) +
        ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"][pos]
      );
    })
    .join("");
}

/** Same wording the reservation PDF stamps into the amount blanks. */
function bahtWords(raw: string) {
  const clean = raw.replace(/[,\s]/g, "").trim();
  if (!clean || !/^\d+(\.\d+)?$/.test(clean)) return "";
  const cents = Math.round(Number(clean) * 100);
  if (!Number.isFinite(cents)) return "";
  return (
    (Math.floor(cents / 100) ? readThaiNumber(Math.floor(cents / 100)) : "ศูนย์") +
    "บาท" +
    (cents % 100 ? readThaiNumber(cents % 100) + "สตางค์" : "ถ้วน")
  );
}

export function ReservationLetterFields({
  value,
  onChange,
  disabled,
  errors,
  step = 0,
  onStepChange,
}: {
  step?: number;
  onStepChange?: (step: number) => void;
  value: ReservationLetterInput;
  onChange: (next: ReservationLetterInput) => void;
  disabled?: boolean;
  errors?: Partial<Record<TextKey, string>>;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const tc = t.contracts;
  const rc = tc.reservation;
  const title = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };
  const [ownerQuery, setOwnerQuery] = useState("");
  const [ownerHits, setOwnerHits] = useState<
    Array<{
      id: number;
      name: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      identityNumber: string;
      nationality: string;
    }>
  >([]);
  const [ownerSearchError, setOwnerSearchError] = useState("");
  const [landlordOpen, setLandlordOpen] = useState(!!value.landlordFirstName);
  const searchSeq = useRef(0);
  const set = (key: TextKey, text: string) => {
    const next = { ...value, [key]: text };
    if (key === "landlordFirstName" || key === "landlordLastName") {
      const full = [next.landlordFirstName, next.landlordLastName]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" ");
      if (!value.payee || value.payee === value.landlordName) next.payee = full;
      if (
        !value.landlordSignName ||
        value.landlordSignName === value.landlordName
      )
        next.landlordSignName = full;
      next.landlordName = full;
    }
    onChange(next);
  };
  useEffect(() => {
    const seq = ++searchSeq.current;
    const q = ownerQuery.trim();
    if (q.length < 1) {
      setOwnerHits([]);
      setOwnerSearchError("");
      return;
    }
    const timer = setTimeout(() => {
      void searchOwnerUsers(q)
        .then((rows) => {
          if (seq === searchSeq.current) {
            setOwnerHits(rows);
            setOwnerSearchError("");
          }
        })
        .catch(() => {
          if (seq === searchSeq.current) {
            setOwnerHits([]);
            setOwnerSearchError(rc.searchFailed);
          }
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      searchSeq.current++;
    };
  }, [ownerQuery]);
  const pickOwner = (owner: {
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    identityNumber: string;
    nationality: string;
  }) => {
    onChange({
      ...value,
      landlordFirstName: owner.firstName,
      landlordLastName: owner.lastName,
      landlordName: owner.name,
      landlordPhone: owner.phone,
      landlordEmail: owner.email,
      landlordId: owner.identityNumber,
      landlordNationality: owner.nationality,
      landlordSignName: owner.name,
      payee:
        !value.payee || value.payee === value.landlordName
          ? owner.name
          : value.payee,
    });
    setLandlordOpen(true);
    setOwnerQuery("");
    setOwnerHits([]);
  };
  const addLandlord = () => {
    onChange({
      ...value,
      landlordName: "",
      landlordFirstName: "",
      landlordLastName: "",
      landlordPhone: "",
      landlordEmail: "",
      landlordId: "",
      landlordNationality: "",
      landlordSignName:
        value.landlordSignName === value.landlordName
          ? ""
          : value.landlordSignName,
      payee: value.payee === value.landlordName ? "" : value.payee,
    });
    setLandlordOpen(true);
    setOwnerQuery("");
    setOwnerHits([]);
  };
  useEffect(() => {
    if (value.landlordFirstName || errors?.landlordFirstName)
      setLandlordOpen(true);
  }, [value.landlordFirstName, errors?.landlordFirstName]);

  const renderField = (field: PartyField) => {
    const label = rc.fields[field.key];
    return (
    <View
      key={field.key}
      style={{
        flexGrow: 1,
        flexBasis:
          field.multiline || field.email || field.key.endsWith("Id")
            ? "100%"
            : "45%",
        minWidth: 130,
      }}
    >
      <MobileInput
        label={label}
        accessibilityLabel={label}
        required={field.required}
        error={errors?.[field.key]}
        value={value[field.key]}
        onChangeText={(text) => set(field.key, text)}
        placeholder={field.placeholder}
        editable={!disabled && !field.locked}
        multiline={field.multiline}
        keyboardType={
          field.email
            ? "email-address"
            : /Phone$/.test(field.key)
              ? "phone-pad"
              : /Amount$|Months$|monthlyRent|reservationPayment|balanceDue|^area$|^beds$|^baths$/.test(
                    field.key,
                  )
                ? "decimal-pad"
                : "default"
        }
        autoCapitalize={field.email ? "none" : "sentences"}
        style={{ borderRadius: 12 }}
      />
    </View>
    );
  };
  const fields = (items: PartyField[]) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {items.map(renderField)}
    </View>
  );
  const heading = {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    color: theme.textHeading,
  };
  const card = (
    label: string,
    children: React.ReactNode,
    editStep?: number,
  ) => (
    <View
      style={{
        gap: 14,
        padding: 16,
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
        }}
      >
        <Text style={heading}>{label}</Text>
        {editStep !== undefined && (
          <Pressable
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={fillTemplate(tc.common.editSection, { label })}
            onPress={() => onStepChange?.(editStep)}
            style={{
              minHeight: 44,
              justifyContent: "center",
              paddingHorizontal: 8,
            }}
          >
            <Text style={{ color: theme.textSecondary }}>{tc.common.edit}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
  const amount = (raw: string) => {
    if (!raw.trim()) return tc.common.notSpecified;
    const number = Number(raw.replace(/,/g, ""));
    return Number.isFinite(number)
      ? fillTemplate(tc.common.baht, {
          amount: number.toLocaleString(localeTag(locale)),
        })
      : raw;
  };
  const months = (count: string) => fillTemplate(tc.common.months, { count });
  const row = (label: string, text: string) => (
    <View
      key={label}
      style={{ flexDirection: "row", gap: 12, justifyContent: "space-between" }}
    >
      <Text style={{ ...muted, flex: 1, lineHeight: 22 }}>{label}</Text>
      <Text style={{ ...title, flex: 1, textAlign: "right", lineHeight: 22 }}>
        {text || tc.common.notSpecified}
      </Text>
    </View>
  );
  const chips = (children: React.ReactNode) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {children}
    </View>
  );
  const chipStyle = (selected: boolean) => ({
    minHeight: 44,
    justifyContent: "center" as const,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: selected ? tokens.colors.brand[500] : theme.border,
    backgroundColor: selected ? tokens.colors.brand[50] : theme.background,
  });
  const propertyFields = PROPERTY_FIELDS;
  const paymentFields = PAYMENT_FIELDS;
  return (
    <View style={{ gap: 16 }}>
      {step === 0 && (
        <>
          {card(
            rc.tenant,
            <>
              <Text style={muted}>{rc.tenantLocked}</Text>
              {fields(TENANT_FIELDS)}
            </>,
          )}
          {card(
            rc.landlord,
            <>
              <MobileInput
                label={rc.searchLandlord}
                value={ownerQuery}
                onChangeText={setOwnerQuery}
                placeholder={rc.searchPlaceholder}
                editable={!disabled}
              />
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                onPress={addLandlord}
                style={chipStyle(false)}
              >
                <Text style={title}>{rc.addLandlord}</Text>
              </Pressable>
              {!!ownerSearchError && (
                <Text style={{ color: tokens.colors.error }}>
                  {ownerSearchError}
                </Text>
              )}
              {ownerHits.map((owner) => (
                <Pressable
                  key={owner.id}
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={() => pickOwner(owner)}
                  style={chipStyle(false)}
                >
                  <Text style={title}>{owner.name}</Text>
                  <Text style={muted}>
                    {[owner.email, owner.phone].filter(Boolean).join(" · ")}
                  </Text>
                </Pressable>
              ))}
              {landlordOpen ? (
                fields(LANDLORD_FIELDS)
              ) : (
                <Text style={muted}>{rc.pickLandlord}</Text>
              )}
            </>,
          )}
          {card(rc.coordinator, fields(AGENT_FIELDS))}
        </>
      )}
      {step === 1 && (
        <>
          <Text style={{ ...muted, lineHeight: 22 }}>
            {fillTemplate(rc.documentMeta, {
              no: value.documentNo || rc.documentNoAuto,
              date: reservationIssueDate(value.issueDate),
            })}
          </Text>
          {card(rc.property, fields(propertyFields.slice(0, 7)))}
          {card(rc.term, fields(propertyFields.slice(7)))}
        </>
      )}
      {step === 2 && (
        <>
          {card(
            rc.monthlyRent,
            <>
              {fields(paymentFields.slice(0, 1))}
              <Text style={{ ...muted, lineHeight: 22 }}>
                ({bahtWords(value.monthlyRent) || rc.rentWordsBlank})
              </Text>
            </>,
          )}
          {card(
            rc.advance,
            <>
              {fields(paymentFields.slice(1, 3))}
              <Text style={{ ...muted, lineHeight: 22 }}>{rc.advanceHint}</Text>
            </>,
          )}
          {card(
            rc.deposit,
            <>
              {fields(paymentFields.slice(3, 5))}
              <Text style={{ ...muted, lineHeight: 22 }}>{rc.depositHint}</Text>
            </>,
          )}
          {card(
            rc.reservationFee,
            <>
              {fields(paymentFields.slice(5, 6))}
              <Text style={{ ...muted, lineHeight: 22 }}>
                {fillTemplate(rc.inWords, {
                  words: bahtWords(value.reservationPayment) || "……………………",
                })}
              </Text>
              <Text style={title}>{rc.applyTo}</Text>
              {chips(
                (
                  [
                    ["applyToAdvance", rc.advance],
                    ["applyToDeposit", rc.deposit],
                  ] as const
                ).map(([key, label]) => (
                  <Pressable
                    key={key}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: value[key] }}
                    disabled={disabled}
                    onPress={() => onChange({ ...value, [key]: !value[key] })}
                    style={chipStyle(value[key])}
                  >
                    <Text
                      style={{
                        color: value[key]
                          ? tokens.colors.onBrand
                          : theme.textHeading,
                        lineHeight: 22,
                      }}
                    >
                      {value[key] ? "✓ " : "□ "}
                      {label}
                    </Text>
                  </Pressable>
                )),
              )}
              {fields([paymentFields[6]])}
            </>,
          )}
          {card(rc.payee, fields(paymentFields.slice(7, 8)))}
          {card(
            rc.paymentMethod,
            <>
              {chips(
                PAYMENT_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: value.paymentMethod === option,
                    }}
                    disabled={disabled}
                    onPress={() =>
                      onChange({
                        ...value,
                        paymentMethod:
                          value.paymentMethod === option ? "" : option,
                      })
                    }
                    style={chipStyle(value.paymentMethod === option)}
                  >
                    <Text
                      style={{
                        color:
                          value.paymentMethod === option
                            ? tokens.colors.onBrand
                            : theme.textHeading,
                        lineHeight: 22,
                      }}
                    >
                      {rc.paymentMethods[option]}
                    </Text>
                  </Pressable>
                )),
              )}
              {fields(paymentFields.slice(8, 9))}
            </>,
          )}
        </>
      )}
      {step === 3 && (
        <>
          {card(
            rc.parties,
            <>
              {row(
                rc.booker,
                [value.tenantFirstName, value.tenantLastName]
                  .filter(Boolean)
                  .join(" ") || value.tenantName,
              )}
              {row(
                rc.bookerContact,
                [value.tenantPhone, value.tenantEmail]
                  .filter(Boolean)
                  .join("\n"),
              )}
              {row(
                rc.landlord,
                value.landlordName ||
                  [value.landlordFirstName, value.landlordLastName]
                    .filter(Boolean)
                    .join(" "),
              )}
              {row(
                rc.landlordContact,
                [value.landlordPhone, value.landlordEmail]
                  .filter(Boolean)
                  .join("\n"),
              )}
              {row(
                rc.coordinator,
                [value.agentName, value.companyName, value.agentPhone]
                  .filter(Boolean)
                  .join("\n"),
              )}
            </>,
            0,
          )}
          {card(
            rc.roomAndContract,
            <>
              {row(rc.fields.project, value.project)}
              {row(rc.fields.address, value.address)}
              {row(
                rc.unitAndFloor,
                [value.unitNo, value.floor].filter(Boolean).join(" / "),
              )}
              {row(
                rc.areaBedsBaths,
                [
                  value.area ? fillTemplate(tc.common.sqm, { area: value.area }) : "—",
                  value.beds || "—",
                  value.baths || "—",
                ].join(" / "),
              )}
              {row(rc.duration, value.termMonths ? months(value.termMonths) : "")}
              {row(rc.moveIn, value.termFrom)}
              {row(rc.end, value.termTo)}
            </>,
            1,
          )}
          {card(
            rc.amounts,
            <>
              {row(rc.monthlyRent, amount(value.monthlyRent))}
              {row(
                `${rc.advance}${value.advanceMonths ? ` (${months(value.advanceMonths)})` : ""}`,
                amount(value.advanceAmount),
              )}
              {row(
                `${rc.deposit}${value.depositMonths ? ` (${months(value.depositMonths)})` : ""}`,
                amount(value.depositAmount),
              )}
              {row(rc.reservationFee, amount(value.reservationPayment))}
              {row(
                rc.applyTo,
                [
                  value.applyToAdvance && rc.advance,
                  value.applyToDeposit && rc.deposit,
                ]
                  .filter(Boolean)
                  .join(" / "),
              )}
              {row(rc.balance, amount(value.balanceDue))}
              {row(
                rc.method,
                rc.paymentMethods[
                  value.paymentMethod as keyof typeof rc.paymentMethods
                ] || value.paymentMethod,
              )}
              {row(rc.payee, value.payee)}
              {row(rc.account, value.bankAccount)}
            </>,
            2,
          )}
          {card(rc.signNames, fields(paymentFields.slice(9)))}
          <Text style={{ ...muted, lineHeight: 20 }}>{rc.termsNote}</Text>
        </>
      )}
    </View>
  );
}
