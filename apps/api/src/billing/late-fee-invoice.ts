import { BadRequestException, ConflictException } from "@nestjs/common";
import type { FinancialDocumentInput, LeaseAgreementInput } from "@nestyk/types";
import type { LeaseContractEntity } from "../entities/lease-contract.entity";
import { validateFinancialDocument } from "../agent/contracts/financial-document";
import { bangkokToday } from "./rent-schedule";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TAX_ID = /^\d{13}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONEY = /^\d+(\.\d{1,2})?$/;

/** D12: LF-<bill no> and REC-LF-<bill no>. A bill number is 14 characters, so both fit the 40-character columns. */
export function lateFeeInvoiceNo(billDocumentNo: string) {
  const no = `LF-${billDocumentNo}`;
  if (no.length > 40) throw new BadRequestException("เลขที่บิลยาวเกินไป");
  return no;
}
export function lateFeeReceiptNo(invoiceNo: string) {
  return `REC-${invoiceNo}`;
}

/** Days after the grace day, through `until` (the day the agent confirmed, or today). The grace day itself is 0. */
export function lateFeeDays(graceUntil: string, until: string) {
  if (!DATE.test(graceUntil) || !DATE.test(until) || until <= graceUntil) return 0;
  const [y1, m1, d1] = graceUntil.split("-").map(Number);
  const [y2, m2, d2] = until.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/**
 * A late fee can be issued once today is past the grace day. A bill already confirmed is late only when that
 * confirmation was after the grace day, so paying on the grace day never becomes late later.
 */
export function lateFeeOpen(graceUntil: string, today: string, paidOn: string | null) {
  return paidOn != null ? paidOn > graceUntil : today > graceUntil;
}

/** The Bangkok day a payment was confirmed, or null while the bill is still open. */
export function paidOn(paidAt: Date | string | null | undefined) {
  if (!paidAt) return null;
  const date = paidAt instanceof Date ? paidAt : new Date(paidAt);
  return Number.isFinite(date.getTime()) ? bangkokToday(date) : null;
}

/** The contract's late fee per day, for display only. Blank or unreadable values stay unset. */
export function lateFeeRate(value: unknown) {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.replace(/,/g, "").trim() : "";
  if (!MONEY.test(text)) return null;
  const amount = Number(text);
  return amount <= 9_999_999_999.99 ? amount : null;
}

/** The amount the agent types, and the due date (today when left blank). */
export function lateFeeInput(input: unknown, today: string) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? (input as { amount?: unknown; dueDate?: unknown }) : {};
  const raw = typeof body.amount === "number" ? String(body.amount) : typeof body.amount === "string" ? body.amount.replace(/,/g, "").trim() : "";
  if (!MONEY.test(raw) || Number(raw) <= 0 || Number(raw) > 9_999_999_999.99)
    throw new BadRequestException("กรุณากรอกยอดค่าปรับ");
  const dueDate = typeof body.dueDate === "string" && body.dueDate.trim() ? body.dueDate.trim() : today;
  if (!DATE.test(dueDate)) throw new BadRequestException("วันครบกำหนดไม่ถูกต้อง");
  return { amount: Number(raw), dueDate };
}

/** The slip the agent is looking at must still be the tenant's latest one. */
export function sameLateFeeSlip(input: unknown, submittedAt: Date | null) {
  const seen = input && typeof input === "object" && !Array.isArray(input) ? (input as { submittedAt?: unknown }).submittedAt : undefined;
  const current = submittedAt ? new Date(submittedAt).toISOString() : null;
  if (typeof seen !== "string" || !current || seen !== current)
    throw new ConflictException({ code: "SLIP_CHANGED", message: "ผู้เช่าส่งสลิปใหม่แล้ว กรุณาเปิดดูสลิปล่าสุดก่อนตีกลับ" });
}

/**
 * D12 (AC-7.8): a late fee invoice in the landlord's name, for one rent bill. The agent types the amount.
 * There is no withholding tax. The due date defaults to the issue date.
 */
export function lateFeeInvoice(c: LeaseContractEntity, billDocumentNo: string, amount: number, dueDate: string, today: string): FinancialDocumentInput {
  const lease = (c.data?.leaseAgreement ?? {}) as Partial<LeaseAgreementInput>;
  const snapshot = c.party_snapshot ?? {};
  const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
  const pick = (...values: unknown[]) => values.map((value) => String(value ?? "").trim()).find(Boolean) ?? "";
  const project = pick(lease.project, snapshot.property, c.rent_room?.property?.name, c.rent_room?.listing_title, "ห้องพัก");
  const room = pick(lease.houseNo, snapshot.room, c.rent_room?.room_id);
  const place = pick(lease.propertyAddress, snapshot.propertyAddress, project);
  const email = (value: unknown) => (EMAIL.test(text(value, 120)) ? text(value, 120) : "");
  const taxId = (value: unknown) => (TAX_ID.test(text(value, 13)) ? text(value, 13) : "");
  return validateFinancialDocument(
    {
      documentNo: lateFeeInvoiceNo(billDocumentNo),
      issueDate: today,
      dueDate,
      reference: text(billDocumentNo, 60),
      customerName: text(pick(lease.tenantName, snapshot.tenantName, c.tenant?.name), 120),
      customerFirstName: text(pick(lease.tenantFirstName, c.tenant?.first_name), 120),
      customerLastName: text(pick(lease.tenantLastName, c.tenant?.last_name), 120),
      customerAddress: text(pick(lease.tenantAddress, snapshot.tenantAddress, place), 240),
      customerTaxId: "",
      customerPhone: text(pick(lease.tenantPhone, snapshot.tenantPhone, c.tenant?.phone), 40),
      customerEmail: email(pick(lease.tenantEmail, snapshot.tenantEmail, c.tenant?.email)),
      issuerName: text(pick(lease.landlordName, snapshot.ownerName, "ผู้ให้เช่า"), 120),
      issuerAddress: text(pick(lease.landlordAddress, snapshot.ownerAddress, place), 240),
      issuerTaxId: taxId(snapshot.ownerTaxId),
      issuerPhone: text(pick(lease.landlordPhone, snapshot.ownerPhone), 40),
      issuerEmail: email(lease.landlordEmail),
      items: [
        {
          description: text(`ค่าปรับชำระค่าเช่าล่าช้า ${project}${room ? ` ห้อง ${room}` : ""} บิล ${billDocumentNo}`, 160),
          quantity: 1,
          unitPrice: amount,
        },
      ],
      vatRate: 0,
      discount: 0,
      paymentMethod: "",
      paymentDetails: text(
        [lease.bankName, lease.accountName, lease.accountNo].map((part) => String(part ?? "").trim()).filter(Boolean).join(" "),
        200,
      ),
      receiverName: "",
      notes: "",
    },
    "invoice",
  );
}
