import { BadRequestException } from "@nestjs/common";
import type { FinancialDocumentInput, LeaseAgreementInput } from "@nestyk/types";
import type { LeaseContractEntity } from "../../entities/lease-contract.entity";
import { validateFinancialDocument } from "./financial-document";
import { addDays } from "../../billing/rent-schedule";

const MONEY = /^\d+(\.\d{1,2})?$/;

export type EarlyEndMoney = {
  kind: "refund" | "collect";
  amount: number;
  note: string;
  /** Refund is due 7 days after the ending takes effect. A collection is due on that day. */
  dueOn: string;
};

/** D16 (AC-7.7): the agent types either a refund of unused rent or an amount to collect. The system does not calculate it. */
export function parseEarlyEndMoney(input: unknown, endsOnDate: string): EarlyEndMoney {
  const body = input && typeof input === "object" && !Array.isArray(input)
    ? input as { kind?: unknown; amount?: unknown; note?: unknown }
    : {};
  if (body.kind !== "refund" && body.kind !== "collect")
    throw new BadRequestException("เลือกได้เฉพาะยอดคืนหรือยอดที่ต้องเก็บ");
  const raw = typeof body.amount === "number" ? String(body.amount) : typeof body.amount === "string" ? body.amount.replace(/,/g, "").trim() : "";
  if (!MONEY.test(raw) || Number(raw) <= 0 || Number(raw) > 9_999_999_999.99)
    throw new BadRequestException("กรุณากรอกยอด");
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > 500) throw new BadRequestException("หมายเหตุต้องไม่เกิน 500 ตัวอักษร");
  return {
    kind: body.kind,
    amount: Number(raw),
    note,
    dueOn: body.kind === "refund" ? addDays(endsOnDate, 7) : endsOnDate,
  };
}

/** The invoice for rent still to collect after an early ending, in the landlord's name. */
export function earlyEndCollectInvoice(c: LeaseContractEntity, amount: number, dueOn: string, today: string): FinancialDocumentInput {
  const lease = (c.data?.leaseAgreement ?? {}) as Partial<LeaseAgreementInput>;
  const snapshot = c.party_snapshot ?? {};
  const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
  const pick = (...values: unknown[]) => values.map((value) => String(value ?? "").trim()).find(Boolean) ?? "";
  const project = pick(lease.project, snapshot.property, c.rent_room?.property?.name, "ห้องพัก");
  const no = `EE-${c.contract_no || `EC-${c.id}`}`.slice(0, 40);
  return validateFinancialDocument({
    documentNo: no,
    issueDate: today,
    dueDate: dueOn < today ? today : dueOn,
    reference: text(c.contract_no || String(c.id), 60),
    customerName: text(pick(lease.tenantName, snapshot.tenantName, c.tenant?.name, "ผู้เช่า"), 120),
    customerAddress: text(pick(lease.tenantAddress, snapshot.tenantAddress, project), 240),
    issuerName: text(pick(lease.landlordName, snapshot.ownerName, "ผู้ให้เช่า"), 120),
    issuerAddress: text(pick(lease.landlordAddress, snapshot.ownerAddress, project), 240),
    items: [{ description: text(`ค่าเช่าส่วนที่อยู่ถึงวันเลิกสัญญา ${project}`, 160), quantity: 1, unitPrice: amount }],
    vatRate: 0,
    discount: 0,
    paymentMethod: "",
    paymentDetails: "",
    receiverName: "",
    notes: "",
  }, "invoice");
}
