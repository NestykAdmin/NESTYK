import { BadRequestException } from "@nestjs/common";
import type {
  FinancialDocumentInput,
  FinancialDocumentKind,
  ReceiptReceiver,
} from "@nestyk/types";

export function financialKind(kind: string): FinancialDocumentKind {
  if (kind !== "invoice" && kind !== "receipt")
    throw new BadRequestException("ชนิดเอกสารไม่ถูกต้อง");
  return kind;
}
export function financialTotals(
  data: Pick<FinancialDocumentInput, "items" | "discount" | "vatRate">,
) {
  const subtotal = data.items.reduce(
    (sum, item) =>
      sum + Math.round(item.quantity * Math.round(item.unitPrice * 100)),
    0,
  );
  const discount = Math.round(data.discount * 100);
  const vat = Math.round(((subtotal - discount) * data.vatRate) / 100);
  return {
    subtotal: subtotal / 100,
    discount: discount / 100,
    vat: vat / 100,
    total: (subtotal - discount + vat) / 100,
  };
}
export function validateFinancialDocument(
  input: unknown,
  kind: FinancialDocumentKind,
  options?: { paymentMethodOptional?: boolean },
): FinancialDocumentInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("ข้อมูลเอกสารไม่ถูกต้อง");
  const obj = input as Record<string, unknown>;
  const customerFirst =
    typeof obj.customerFirstName === "string" ? obj.customerFirstName.trim() : "";
  const customerLast =
    typeof obj.customerLastName === "string" ? obj.customerLastName.trim() : "";
  if (customerFirst)
    obj.customerName = [customerFirst, customerLast].filter(Boolean).join(" ");
  if (obj.customerFirstName == null) obj.customerFirstName = "";
  if (obj.customerLastName == null) obj.customerLastName = "";
  const result: Record<string, unknown> = {};
  const limits: Record<string, number> = {
    documentNo: 40,
    issueDate: 10,
    dueDate: 10,
    reference: 60,
    customerName: 120,
    customerFirstName: 120,
    customerLastName: 120,
    customerAddress: 240,
    customerTaxId: 13,
    customerPhone: 40,
    customerEmail: 120,
    issuerName: 120,
    issuerAddress: 240,
    issuerTaxId: 13,
    issuerPhone: 40,
    issuerEmail: 120,
    paymentMethod: 20,
    paymentDetails: 200,
    receiverName: 120,
    notes: 300,
  };
  const required = new Set([
    "documentNo",
    "issueDate",
    "customerName",
    "customerAddress",
    "issuerName",
    "issuerAddress",
    ...(kind === "invoice"
      ? ["dueDate"]
      : [
          ...(options?.paymentMethodOptional ? [] : ["paymentMethod"]),
          "receiverName",
        ]),
  ]);
  for (const [key, limit] of Object.entries(limits)) {
    if (obj[key] != null && typeof obj[key] !== "string")
      throw new BadRequestException(`ข้อมูล ${key} ไม่ถูกต้อง`);
    const value = ((obj[key] as string) || "").trim();
    if (
      (required.has(key) && !value) ||
      value.length > limit ||
      /[\x00-\x08\x0b-\x1f]/.test(value)
    )
      throw new BadRequestException(
        `กรุณาตรวจสอบ ${key} (สูงสุด ${limit} ตัวอักษร)`,
      );
    result[key] = value;
  }
  for (const key of ["issueDate", ...(kind === "invoice" ? ["dueDate"] : [])]) {
    const value = result[key] as string;
    const date = new Date(`${value}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException("วันที่ไม่ถูกต้อง");
  }
  if (kind === "invoice" && String(result.dueDate) < String(result.issueDate))
    throw new BadRequestException("วันครบกำหนดต้องไม่ก่อนวันที่ออกเอกสาร");
  for (const key of ["customerTaxId", "issuerTaxId"])
    if (result[key] && !/^\d{13}$/.test(String(result[key])))
      throw new BadRequestException("เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก");
  for (const key of ["customerEmail", "issuerEmail"])
    if (result[key] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(result[key])))
      throw new BadRequestException("รูปแบบอีเมลไม่ถูกต้อง");
  if (
    kind === "receipt" &&
    result.paymentMethod &&
    !["cash", "transfer"].includes(String(result.paymentMethod))
  )
    throw new BadRequestException("กรุณาเลือกวิธีชำระเงิน");
  if (
    kind === "receipt" &&
    result.paymentMethod === "transfer" &&
    !result.paymentDetails
  )
    throw new BadRequestException("กรุณาระบุรายละเอียดการชำระเงิน");
  if (!Array.isArray(obj.items) || obj.items.length < 1 || obj.items.length > 5)
    throw new BadRequestException("ระบุรายการ 1–5 รายการ");
  result.items = obj.items.map((item: unknown) => {
    if (!item || typeof item !== "object")
      throw new BadRequestException("รายการไม่ถูกต้อง");
    const row = item as Record<string, unknown>;
    if (
      typeof row.description !== "string" ||
      !row.description.trim() ||
      row.description.length > 160
    )
      throw new BadRequestException(
        "กรุณาระบุรายละเอียดรายการไม่เกิน 160 ตัวอักษร",
      );
    if (
      typeof row.quantity !== "number" ||
      !Number.isFinite(row.quantity) ||
      row.quantity <= 0 ||
      row.quantity > 9999 ||
      Math.abs(row.quantity * 100 - Math.round(row.quantity * 100)) > 0.00001
    )
      throw new BadRequestException(
        "จำนวนต้องมากกว่า 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง",
      );
    if (
      typeof row.unitPrice !== "number" ||
      !Number.isFinite(row.unitPrice) ||
      row.unitPrice < 0 ||
      row.unitPrice > 99999999 ||
      Math.abs(row.unitPrice * 100 - Math.round(row.unitPrice * 100)) > 0.00001
    )
      throw new BadRequestException(
        "ราคาต้องไม่ติดลบและมีทศนิยมไม่เกิน 2 ตำแหน่ง",
      );
    return {
      description: row.description.trim(),
      quantity: row.quantity,
      unitPrice: row.unitPrice,
    };
  });
  if (typeof obj.vatRate !== "number" || ![0, 7].includes(obj.vatRate))
    throw new BadRequestException("เลือก VAT 0% หรือ 7%");
  if (
    typeof obj.discount !== "number" ||
    !Number.isFinite(obj.discount) ||
    obj.discount < 0 ||
    Math.abs(obj.discount * 100 - Math.round(obj.discount * 100)) > 0.00001
  )
    throw new BadRequestException("ส่วนลดไม่ถูกต้อง");
  result.vatRate = obj.vatRate;
  result.discount = obj.discount;
  const data = result as unknown as FinancialDocumentInput;
  const totals = financialTotals(data);
  if (
    totals.total <= 0 ||
    totals.total > 999999999 ||
    totals.discount > totals.subtotal
  )
    throw new BadRequestException(
      "ยอดสุทธิต้องมากกว่า 0 และไม่เกิน 999,999,999 บาท",
    );
  return data;
}

/** Receipt money/parties/items always follow the invoice; only payment fields are free. */
export function buildReceiptFromInvoice(
  invoice: FinancialDocumentInput,
  overrides: Partial<FinancialDocumentInput>,
  defaults: { documentNo: string; issueDate: string },
  options?: { paymentMethodOptional?: boolean },
): FinancialDocumentInput {
  return validateFinancialDocument(
    {
      ...invoice,
      documentNo:
        String(overrides.documentNo ?? defaults.documentNo).trim() ||
        defaults.documentNo,
      issueDate:
        String(overrides.issueDate ?? defaults.issueDate).trim() ||
        defaults.issueDate,
      reference: invoice.documentNo,
      paymentMethod: String(overrides.paymentMethod ?? "").trim(),
      paymentDetails: String(overrides.paymentDetails ?? "").trim(),
      receiverName: String(overrides.receiverName ?? "").trim(),
      notes: String(overrides.notes ?? "").trim(),
      items: invoice.items,
      discount: invoice.discount,
      vatRate: invoice.vatRate,
    },
    "receipt",
    options,
  );
}

/**
 * D11 (AC-3.5): a booking or deposit receipt is received by the landlord, or by the agent when a power of attorney
 * is attached. The receipt prints the receiver's name (no drawn signature, Aof 22 Oct 2026).
 */
export const POWER_OF_ATTORNEY_REQUIRED = "POWER_OF_ATTORNEY_REQUIRED";
export const POWER_OF_ATTORNEY_MESSAGE =
  "นายหน้ารับเงินแทนผู้ให้เช่าได้เมื่อแนบหนังสือมอบอำนาจไว้ในเอกสารแนบแล้วเท่านั้น";
export function receiptReceiver(value: unknown): ReceiptReceiver {
  if (value == null || value === "") return "landlord";
  if (value === "landlord" || value === "agent") return value;
  throw new BadRequestException("กรุณาเลือกผู้รับเงิน");
}
/** The name printed as the receiver: the landlord, or the agent marked as the landlord's attorney. */
export function receiverLine(receiver: ReceiptReceiver, landlordName: string, agentName: string) {
  const line = receiver === "agent"
    ? `${agentName.trim() || "นายหน้า"} (ผู้รับมอบอำนาจ)`
    : landlordName.trim();
  return line.slice(0, 120);
}
/**
 * D11 (TC-3.15): the withholding tax the tenant deducted from the booking payment, in baht. The receipt keeps the
 * full amount and shows the tax and the net amount received. Empty = no tax.
 */
export function withholdingTaxOf(value: unknown, total: number): number {
  if (value == null || value === "") return 0;
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.replace(/,/g, "").trim() : "x";
  if (raw === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(raw))
    throw new BadRequestException("ภาษีหัก ณ ที่จ่ายไม่ถูกต้อง");
  const satang = Math.round(Number(raw) * 100);
  if (satang >= Math.round(total * 100))
    throw new BadRequestException("ภาษีหัก ณ ที่จ่ายต้องน้อยกว่ายอดรับชำระ");
  return satang / 100;
}

export function bahtText(amount: number): string {
  const digits = [
    "ศูนย์",
    "หนึ่ง",
    "สอง",
    "สาม",
    "สี่",
    "ห้า",
    "หก",
    "เจ็ด",
    "แปด",
    "เก้า",
  ];
  function read(n: number): string {
    if (n >= 1000000)
      return (
        read(Math.floor(n / 1000000)) +
        "ล้าน" +
        (n % 1000000 === 1 ? "เอ็ด" : n % 1000000 ? read(n % 1000000) : "")
      );
    const chars = String(n).split("").map(Number);
    return chars
      .map((d, i) => {
        const pos = chars.length - i - 1;
        if (!d) return "";
        if (pos === 1)
          return (d === 1 ? "" : d === 2 ? "ยี่" : digits[d]) + "สิบ";
        return (
          (pos === 0 && d === 1 && n > 10 ? "เอ็ด" : digits[d]) +
          ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"][pos]
        );
      })
      .join("");
  }
  const cents = Math.round(amount * 100);
  return (
    (Math.floor(cents / 100) ? read(Math.floor(cents / 100)) : "ศูนย์") +
    "บาท" +
    (cents % 100 ? read(cents % 100) + "สตางค์" : "ถ้วน")
  );
}
