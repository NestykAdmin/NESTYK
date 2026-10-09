import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  MobileBottomSheet,
  MobileButton,
  MobileIcon,
  MobileInput,
  tokens,
  useMobileTheme,
} from "@nestyk/ui/native";
import { fillTemplate, localizedError, useLocale } from "@nestyk/i18n";
import type {
  AgentContract,
  FinancialDocumentInput,
  FinancialDocumentKind,
  StandaloneInvoice,
} from "@nestyk/types";
import {
  createReceiptForInvoice,
  createStandaloneInvoice,
  generateFinancialDocument,
  getFinancialDocumentDefaults,
  getNextInvoiceNumber,
  getReceiptDefaults,
  listStandaloneInvoices,
} from "../lib/agent-contracts-api";

type TextField = Exclude<
  keyof FinancialDocumentInput,
  "items" | "vatRate" | "discount"
>;

function withCustomerNames(data: FinancialDocumentInput): FinancialDocumentInput {
  const first = data.customerFirstName?.trim() ?? "";
  const last = data.customerLastName?.trim() ?? "";
  if (first || last) {
    return {
      ...data,
      customerFirstName: first,
      customerLastName: last,
      customerName: [first, last].filter(Boolean).join(" ") || data.customerName,
    };
  }
  const parts = (data.customerName ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    ...data,
    customerFirstName: parts[0] ?? "",
    customerLastName: parts.slice(1).join(" "),
  };
}

const RECEIPT_FIELDS: TextField[] = [
  "documentNo",
  "issueDate",
  "receiverName",
  "paymentDetails",
  "notes",
];

export function FinancialDocumentForm({
  contractId: fixedContractId,
  hosts,
  kind,
  payer,
  fixedInvoiceId,
  onBack,
  onCreated,
  onStandaloneCreated,
}: {
  contractId?: number;
  hosts?: AgentContract[];
  kind: FinancialDocumentKind;
  payer?: {
    tenantId: number;
    name: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    address: string;
    taxId: string;
  };
  fixedInvoiceId?: number;
  onBack: () => void;
  onCreated: (value: AgentContract) => void;
  onStandaloneCreated?: (value: StandaloneInvoice) => void;
}) {
  const { t, locale } = useLocale();
  const labels = t.agent.contracts.financial;
  const { theme } = useMobileTheme();
  const linked = fixedContractId != null;
  const standalone = kind === "invoice" && !linked;
  const needsHostPick = fixedContractId == null && !standalone && kind !== "receipt";
  const [hostId, setHostId] = useState<number | null>(fixedContractId ?? null);
  const contractId = fixedContractId ?? hostId;
  const [invoiceChoices, setInvoiceChoices] = useState<StandaloneInvoice[]>([]);
  const [invoiceId, setInvoiceId] = useState<number | null>(fixedInvoiceId ?? null);
  const [form, setForm] = useState<FinancialDocumentInput | null>(null);
  const [items, setItems] = useState<
    { description: string; quantity: string; unitPrice: string }[]
  >([]);
  const [discount, setDiscount] = useState("0");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(fixedInvoiceId != null);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [slip, setSlip] = useState<{
    uri: string;
    name: string;
    mimeType: string;
    file?: File;
  } | null>(null);
  const [slipSourceOpen, setSlipSourceOpen] = useState(false);
  const saving = useRef(false);
  const isReceipt = kind === "receipt";
  const title = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (slipSourceOpen) {
        setSlipSourceOpen(false);
        return true;
      }
      if (!saving.current) onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, slipSourceOpen]);
  useEffect(() => {
    if (isReceipt && !linked) {
      if (fixedInvoiceId != null) {
        setInvoiceId(fixedInvoiceId);
        setError("");
        return;
      }
      let active = true;
      setLoading(true);
      setError("");
      setForm(null);
      setInvoiceId(null);
      listStandaloneInvoices()
        .then((rows) => {
          if (!active) return;
          setInvoiceChoices(
            payer
              ? rows.filter((row) => row.tenantId === payer.tenantId)
              : rows,
          );
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
    }
    if (standalone) {
      let active = true;
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      setLoading(true);
      setError("");
      getNextInvoiceNumber()
        .then(({ documentNo }) => {
          if (!active) return;
          setForm({
            documentNo,
            issueDate: today,
            dueDate: today,
            reference: "",
            customerName:
              [payer?.firstName, payer?.lastName].filter(Boolean).join(" ") ||
              payer?.name ||
              "",
            customerFirstName: payer?.firstName ?? "",
            customerLastName: payer?.lastName ?? "",
            customerAddress: payer?.address ?? "",
            customerTaxId: payer?.taxId ?? "",
            customerPhone: payer?.phone ?? "",
            customerEmail: payer?.email ?? "",
            issuerName: "NESTYK",
            issuerAddress: "Bangkok",
            issuerTaxId: "",
            issuerPhone: "",
            issuerEmail: "",
            items: [{ description: "", quantity: 1, unitPrice: 0 }],
            vatRate: 0,
            discount: 0,
            paymentMethod: "",
            paymentDetails: "",
            receiverName: "",
            notes: "",
          });
          setItems([{ description: "", quantity: "1", unitPrice: "" }]);
          setDiscount("0");
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
    }
    if (contractId == null) {
      setForm(null);
      setLoading(false);
      setError("");
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    getFinancialDocumentDefaults(contractId, kind)
      .then((data) => {
        if (!active) return;
        setForm(withCustomerNames(data));
        setDiscount(String(data.discount));
        setItems(
          data.items.map((item) => ({
            ...item,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
          })),
        );
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
  }, [standalone, linked, contractId, kind, isReceipt, fixedInvoiceId, payer, retry, labels.invalid]);
  useEffect(() => {
    if (!isReceipt || linked || invoiceId == null) return;
    let active = true;
    setLoading(true);
    setError("");
    getReceiptDefaults(invoiceId)
      .then((data) => {
        if (!active) return;
        setForm(withCustomerNames(data));
        setDiscount(String(data.discount));
        setItems(
          data.items.map((item) => ({
            ...item,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
          })),
        );
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
  }, [isReceipt, linked, invoiceId, retry, labels.invalid]);
  const required: TextField[] = isReceipt
    ? [
        "documentNo",
        "issueDate",
        "receiverName",
        ...(form?.paymentMethod && form.paymentMethod !== "cash"
          ? (["paymentDetails"] as const)
          : []),
      ]
    : [
        "issueDate",
        "customerFirstName",
        "customerAddress",
        "issuerName",
        "issuerAddress",
        "dueDate",
      ];
  const decimal = (value: string) =>
    /^\d+(\.\d{1,2})?$/.test(value.trim()) ? Number(value) : NaN;
  const parsedItems = items.map((item) => ({
    description: item.description,
    quantity: decimal(item.quantity),
    unitPrice: decimal(item.unitPrice),
  }));
  const subtotal = (form?.items ?? parsedItems).reduce((sum, item) => {
    const quantity =
      typeof item.quantity === "number" ? item.quantity : decimal(String(item.quantity));
    const unitPrice =
      typeof item.unitPrice === "number"
        ? item.unitPrice
        : decimal(String(item.unitPrice));
    return sum + Math.round(quantity * Math.round(unitPrice * 100));
  }, 0);
  const discountValue = isReceipt
    ? form?.discount ?? 0
    : decimal(discount);
  const taxable = subtotal - Math.round(discountValue * 100);
  const vatRate = form?.vatRate ?? 0;
  const total =
    (taxable + Math.round((taxable * vatRate) / 100)) / 100;
  function chooseSlipSource(source: "documents" | "photos") {
    setSlipSourceOpen(false);
    setTimeout(() => {
      void pickSlip(source);
    }, 400);
  }
  async function pickSlip(source: "documents" | "photos") {
    const docs = t.agent.contracts;
    try {
      if (source === "photos") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setError(docs.photosPermission);
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: false,
          quality: 0.8,
          preferredAssetRepresentationMode:
            ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (!asset?.uri) return;
        setSlip({
          uri: asset.uri,
          name: asset.fileName || "slip.jpg",
          mimeType: asset.mimeType || "image/jpeg",
          file: "file" in asset ? asset.file : undefined,
        });
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["application/pdf", "image/jpeg", "image/png"],
          copyToCacheDirectory: true,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (!asset?.uri) return;
        setSlip({
          uri: asset.uri,
          name: asset.name || "slip",
          mimeType: asset.mimeType || "application/octet-stream",
          file: "file" in asset ? asset.file : undefined,
        });
      }
      setError("");
    } catch (e) {
      setError(localizedError(e, t.common.errorGeneric, locale));
    }
  }
  async function submit() {
    if (!form || saving.current) return;
    if (!isReceipt && !standalone && contractId == null) return;
    if (isReceipt) {
      if (!linked && invoiceId == null) return;
      const markingPaid = fixedInvoiceId != null;
      if (markingPaid && !slip) {
        setError(labels.slipRequired);
        return;
      }
      if (
        required.some((key) => !form[key].trim()) ||
        (!markingPaid &&
          (!form.paymentMethod ||
            (form.paymentMethod !== "cash" && !form.paymentDetails.trim())))
      ) {
        setError(labels.required);
        return;
      }
      saving.current = true;
      setBusy(true);
      setError("");
      try {
        if (linked) {
          onCreated(await generateFinancialDocument(contractId!, "receipt", {
            ...form,
            paymentMethod: form.paymentMethod,
            paymentDetails: form.paymentDetails,
            receiverName: form.receiverName,
          }));
          return;
        }
        if (!onStandaloneCreated) return;
        onStandaloneCreated(
          await createReceiptForInvoice(
            invoiceId!,
            {
              documentNo: form.documentNo,
              issueDate: form.issueDate,
              paymentMethod: markingPaid ? "" : form.paymentMethod,
              paymentDetails: markingPaid ? "" : form.paymentDetails,
              receiverName: form.receiverName,
              notes: form.notes,
            },
            markingPaid ? (slip ?? undefined) : undefined,
          ),
        );
      } catch (e) {
        setError(localizedError(e, t.common.errorGeneric, locale));
      } finally {
        saving.current = false;
        setBusy(false);
      }
      return;
    }
    if (
      required.some((key) => !form[key].trim()) ||
      items.some((item) => !item.description.trim())
    ) {
      setError(labels.required);
      return;
    }
    if (
      parsedItems.some(
        (item) =>
          !Number.isFinite(item.quantity) ||
          item.quantity <= 0 ||
          !Number.isFinite(item.unitPrice) ||
          item.unitPrice < 0,
      ) ||
      !Number.isFinite(total) ||
      total <= 0 ||
      taxable < 0
    ) {
      setError(labels.invalid);
      return;
    }
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...form,
        issuerName: "NESTYK",
        issuerAddress: "Bangkok",
        ...(payer
          ? {
              customerFirstName: payer.firstName,
              customerLastName: payer.lastName,
              customerName:
                [payer.firstName, payer.lastName].filter(Boolean).join(" ") ||
                payer.name,
              customerAddress: payer.address,
              tenantId: payer.tenantId,
            }
          : {}),
        items: parsedItems,
        discount: decimal(discount),
      };
      if (standalone) {
        if (!onStandaloneCreated) return;
        onStandaloneCreated(await createStandaloneInvoice(payload));
        return;
      }
      onCreated(await generateFinancialDocument(contractId!, kind, payload));
    } catch (e) {
      setError(localizedError(e, t.common.errorGeneric, locale));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const input = (key: TextField, maxLength = 120, multiline = false) =>
    form && (
      <MobileInput
        key={key}
        label={labels[key]}
        required={required.includes(key)}
        value={form[key]}
        editable={
          !busy &&
          key !== "documentNo" &&
          key !== "issuerName" &&
          key !== "issuerAddress" &&
          !(
            (isReceipt &&
              (key === "customerFirstName" || key === "customerLastName")) ||
            (payer &&
              (key === "customerName" ||
                key === "customerFirstName" ||
                key === "customerLastName" ||
                key === "customerAddress"))
          )
        }
        maxLength={maxLength}
        multiline={multiline}
        placeholder={
          key === "issueDate" || key === "dueDate"
            ? labels.dateHint
            : required.includes(key)
              ? ""
              : labels.optional
        }
        keyboardType={
          key.endsWith("TaxId")
            ? "number-pad"
            : key.endsWith("Phone")
              ? "phone-pad"
              : key.endsWith("Email")
                ? "email-address"
                : "default"
        }
        onChangeText={(value) =>
          setForm((current) => {
            if (!current) return current;
            const next = { ...current, [key]: value };
            if (key === "customerFirstName" || key === "customerLastName") {
              next.customerName = [next.customerFirstName, next.customerLastName]
                .map((part) => part.trim())
                .filter(Boolean)
                .join(" ");
            }
            return next;
          })
        }
      />
    );
  return (
    <View style={{ gap: 16, paddingBottom: 24 }}>
      <MobileButton variant="outline" disabled={busy} onPress={onBack}>
        {labels.back}
      </MobileButton>
      <Text style={{ fontSize: 22, lineHeight: 34, color: theme.textHeading }}>
        {fixedInvoiceId != null ? labels.markPaid : `${labels.create} ${t.agent.contracts[kind]}`}
      </Text>
      <Text
        style={{ fontSize: 14, lineHeight: 22, color: theme.textSecondary }}
      >
        {standalone
          ? payer
            ? labels.payerLocked
            : labels.standaloneHint
          : isReceipt
            ? fixedInvoiceId != null
              ? labels.markPaidHint
              : labels.receiptHint
            : labels.hint}
      </Text>
      {isReceipt && !linked && fixedInvoiceId == null && (
        <View style={{ gap: 8 }}>
          <Text style={[{ fontSize: 14, lineHeight: 22, fontWeight: "600" }, title]}>
            {labels.pickInvoice} *
          </Text>
          {loading && invoiceId == null ? (
            <ActivityIndicator />
          ) : !invoiceChoices.length ? (
            <Text style={[{ fontSize: 13, lineHeight: 20 }, muted]}>
              {labels.needInvoiceFirst}
            </Text>
          ) : (
            invoiceChoices.map((invoice) => {
              const selected = invoiceId === invoice.id;
              return (
                <Pressable
                  key={invoice.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  disabled={busy}
                  onPress={() => setInvoiceId(invoice.id)}
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
                    {invoice.documentNo}
                  </Text>
                  <Text style={[{ fontSize: 13, lineHeight: 20 }, muted]}>
                    {invoice.customerName} ·{" "}
                    {invoice.total.toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                  {invoice.receiptDocumentNo ? (
                    <Text style={[{ fontSize: 13, lineHeight: 20 }, muted]}>
                      {labels.invoiceHasReceipt} {invoice.receiptDocumentNo}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>
      )}
      {needsHostPick && (
        <View style={{ gap: 8 }}>
          <Text style={[{ fontSize: 14, lineHeight: 22, fontWeight: "600" }, title]}>
            {t.contracts.common.hostRequired}
          </Text>
          {!(hosts ?? []).length ? (
            <Text style={[{ fontSize: 13, lineHeight: 20 }, muted]}>
              {t.contracts.common.noHost}
            </Text>
          ) : (
            (hosts ?? []).map((host) => {
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
                    {host.room ? ` · ${fillTemplate(t.contracts.common.room, { room: host.room })}` : ""}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      )}
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: "#DC2626", lineHeight: 24 }}
        >
          {error}
        </Text>
      )}
      {isReceipt && !linked && invoiceId == null ? null : !standalone && !isReceipt && contractId == null ? null : loading ? (
        <ActivityIndicator />
      ) : !form ? (
        <MobileButton onPress={() => setRetry((n) => n + 1)}>
          {labels.retry}
        </MobileButton>
      ) : isReceipt ? (
        <>
          {input("customerFirstName")}
          {input("customerLastName")}
          <Text style={[{ fontSize: 14, lineHeight: 22 }, muted]}>
            {form.reference ? `${labels.reference} ${form.reference}` : ""}
          </Text>
          {RECEIPT_FIELDS.filter((key) => key !== "paymentDetails" && key !== "notes").map(
            (key) => input(key, key === "documentNo" ? 40 : key === "issueDate" ? 10 : 120),
          )}
          {fixedInvoiceId != null ? (
            <>
              <Text style={{ color: theme.textHeading, lineHeight: 24 }}>
                {labels.paymentSlip} *
              </Text>
              <MobileButton
                variant="outline"
                disabled={busy}
                onPress={() => setSlipSourceOpen(true)}
              >
                {labels.attachSlip}
              </MobileButton>
              {slip ? (
                <Text style={{ color: theme.textSecondary, lineHeight: 22 }}>
                  {slip.name}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={{ color: theme.textHeading, lineHeight: 24 }}>
                {labels.paymentMethod} *
              </Text>
              {(["cash", "transfer"] as const).map((method) => (
                <MobileButton
                  key={method}
                  variant={form.paymentMethod === method ? "primary" : "outline"}
                  disabled={busy}
                  onPress={() => setForm({ ...form, paymentMethod: method })}
                >
                  {labels[method]}
                </MobileButton>
              ))}
              {input("paymentDetails", 200, true)}
            </>
          )}
          {input("notes", 300, true)}
          <Text
            style={{ fontSize: 20, lineHeight: 30, color: theme.textHeading }}
          >
            {labels.total}:{" "}
            {Number.isFinite(total)
              ? total.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "—"}
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 20, color: theme.textSecondary }}>
            {labels.receiptTotalHint}
          </Text>
          {!!error && (
            <Text
              accessibilityRole="alert"
              style={{ color: "#DC2626", lineHeight: 24 }}
            >
              {error}
            </Text>
          )}
          <MobileButton
            disabled={busy}
            isLoading={busy}
            onPress={() => void submit()}
          >
            {fixedInvoiceId != null ? labels.markPaid : labels.confirm}
          </MobileButton>
        </>
      ) : (
        <>
          {input("documentNo", 40)}
          {input("issueDate", 10)}
          {input("dueDate", 10)}
          {input("reference", 60)}
          {input("customerFirstName")}
          {input("customerLastName")}
          {input("customerAddress", 240, true)}
          {input("customerTaxId", 13)}
          {input("customerPhone", 40)}
          {input("customerEmail")}
          {input("issuerName")}
          {input("issuerAddress", 240, true)}
          {input("issuerTaxId", 13)}
          {input("issuerPhone", 40)}
          {input("issuerEmail")}
          {items.map((item, index) => (
            <View
              key={index}
              style={{
                gap: 12,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 12,
                padding: 14,
              }}
            >
              <Text style={{ color: theme.textHeading, lineHeight: 24 }}>
                {labels.items} {index + 1}
              </Text>
              {(["description", "quantity", "unitPrice"] as const).map(
                (key) => (
                  <MobileInput
                    key={key}
                    label={labels[key]}
                    required
                    value={item[key]}
                    editable={!busy}
                    keyboardType={
                      key === "description" ? "default" : "decimal-pad"
                    }
                    maxLength={key === "description" ? 160 : 12}
                    multiline={key === "description"}
                    onChangeText={(value) =>
                      setItems((rows) =>
                        rows.map((row, i) =>
                          i === index ? { ...row, [key]: value } : row,
                        ),
                      )
                    }
                  />
                ),
              )}
              {items.length > 1 && (
                <MobileButton
                  variant="outline"
                  disabled={busy}
                  onPress={() =>
                    setItems((rows) => rows.filter((_, i) => i !== index))
                  }
                >
                  {labels.removeItem}
                </MobileButton>
              )}
            </View>
          ))}
          {items.length < 5 && (
            <MobileButton
              variant="outline"
              disabled={busy}
              onPress={() =>
                setItems((rows) => [
                  ...rows,
                  { description: "", quantity: "1", unitPrice: "" },
                ])
              }
            >
              {labels.addItem}
            </MobileButton>
          )}
          <MobileInput
            label={labels.discount}
            value={discount}
            onChangeText={setDiscount}
            keyboardType="decimal-pad"
            editable={!busy}
            maxLength={12}
          />
          <Text style={{ color: theme.textHeading, lineHeight: 24 }}>
            {labels.vatRate}
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {[0, 7].map((rate) => (
              <MobileButton
                key={rate}
                variant={form.vatRate === rate ? "primary" : "outline"}
                disabled={busy}
                onPress={() => setForm({ ...form, vatRate: rate })}
              >
                {rate}%
              </MobileButton>
            ))}
          </View>
          <Text
            style={{ fontSize: 20, lineHeight: 30, color: theme.textHeading }}
          >
            {labels.total}:{" "}
            {Number.isFinite(total)
              ? total.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "—"}
          </Text>
          {input("paymentDetails", 200, true)}
          {input("notes", 300, true)}
          {!!error && (
            <Text
              accessibilityRole="alert"
              style={{ color: "#DC2626", lineHeight: 24 }}
            >
              {error}
            </Text>
          )}
          <MobileButton
            disabled={busy}
            isLoading={busy}
            onPress={() => void submit()}
          >
            {labels.confirm}
          </MobileButton>
        </>
      )}
      <MobileBottomSheet
        visible={slipSourceOpen}
        onClose={() => setSlipSourceOpen(false)}
        maxHeight={420}
        sheetStyle={{ paddingHorizontal: 20 }}
      >
        <Text
          style={{
            fontFamily: tokens.typography.native.headingTh,
            fontSize: 18,
            lineHeight: 27,
            marginBottom: 4,
            color: theme.textHeading,
          }}
        >
          {t.agent.contracts.pickSourceTitle}
        </Text>
        <Text
          style={{
            fontFamily: tokens.typography.native.body,
            fontSize: 13,
            lineHeight: 20,
            color: theme.textSecondary,
            marginBottom: 16,
          }}
        >
          {t.agent.contracts.pickSourceHint}
        </Text>
        {(
          [
            {
              source: "documents" as const,
              icon: "note" as const,
              label: t.agent.contracts.pickFromDocuments,
              hint: t.agent.contracts.pickFromDocumentsHint,
            },
            {
              source: "photos" as const,
              icon: "camera" as const,
              label: t.agent.contracts.pickFromPhotos,
              hint: t.agent.contracts.pickFromPhotosHint,
            },
          ] as const
        ).map((option) => (
          <Pressable
            key={option.source}
            accessibilityRole="button"
            android_ripple={{ color: `${tokens.colors.roles.agent}22` }}
            onPress={() => chooseSlipSource(option.source)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              borderWidth: 1,
              borderRadius: 16,
              borderColor: theme.border,
              backgroundColor: theme.background,
              paddingVertical: 14,
              paddingHorizontal: 14,
              marginBottom: 10,
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: `${tokens.colors.roles.agent}18`,
              }}
            >
              <MobileIcon
                name={option.icon}
                size={22}
                color={tokens.colors.roles.agent}
                weight="bold"
              />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text
                style={{
                  fontFamily: tokens.typography.native.headingTh,
                  fontSize: 16,
                  lineHeight: 24,
                  color: theme.textHeading,
                }}
              >
                {option.label}
              </Text>
              <Text
                style={{
                  fontFamily: tokens.typography.native.body,
                  fontSize: 12,
                  lineHeight: 18,
                  color: theme.textSecondary,
                }}
              >
                {option.hint}
              </Text>
            </View>
            <MobileIcon name="chevron-right" size={18} tone="muted" />
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          android_ripple={{ color: `${tokens.colors.roles.agent}22` }}
          onPress={() => setSlipSourceOpen(false)}
          style={({ pressed }) => ({
            marginTop: 4,
            paddingVertical: 12,
            alignItems: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: tokens.typography.native.body,
              fontSize: 15,
              lineHeight: 23,
              color: theme.textSecondary,
            }}
          >
            {t.common.cancel}
          </Text>
        </Pressable>
      </MobileBottomSheet>
    </View>
  );
}
