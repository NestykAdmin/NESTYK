import { BadRequestException } from "@nestjs/common";
import { contractAmount } from './contract-money';
import type { LeaseRenewalInput } from "@nestyk/types";
import { asIsoDate, isIsoDate, leaseTermEnd, shiftIsoDate } from "./lease-term";

const TEXT: Array<[keyof LeaseRenewalInput, number]> = [
  ["documentNo", 40],
  ["issueDate", 32],
  ["landlordName", 120],
  ["tenantName", 120],
  ["propertyLine", 240],
  ["firstLeaseNo", 40],
  ["firstLeaseDate", 32],
  ["firstLeaseStart", 32],
  ["firstLeaseEnd", 32],
  ["originalLeaseNo", 40],
  ["originalLeaseDate", 32],
  ["originalExpiryDate", 32],
  ["renewMonths", 8],
  ["startDate", 32],
  ["endDate", 32],
  ["monthlyRent", 40],
  ["dueDay", 8],
  ["bankAccount", 160],
  ["depositCarried", 40],
  ["additionalChanges", 500],
  ["landlordSignName", 80],
  ["tenantSignName", 80],
];

/** A renewal can be opened at most this many days before the current lease ends. */
export const RENEWAL_ADVANCE_DAYS = 30;

function text(value: unknown, max: number, label: string) {
  if (value != null && typeof value !== "string") throw new BadRequestException(`${label}ต้องเป็นข้อความ`);
  const clean = typeof value === "string" ? value.replace(/[\r\n\t]+/g, " ").trim() : "";
  if (clean.length > max) throw new BadRequestException(`${label}ต้องไม่เกิน ${max} ตัวอักษร`);
  return clean;
}

function requireText(value: unknown, max: number, label: string) {
  const clean = text(value, max, label);
  if (!clean) throw new BadRequestException(`กรุณากรอก${label}`);
  return clean;
}

function dateField(value: unknown, label: string) {
  const clean = requireText(value, 32, label);
  if (!isIsoDate(clean))
    throw new BadRequestException(`${label}ต้องเป็น ค.ศ. ในรูปแบบ YYYY-MM-DD`);
  return clean;
}

export function emptyLeaseRenewal(): LeaseRenewalInput {
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

export function validateLeaseRenewal(input: unknown): LeaseRenewalInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("ข้อมูลหนังสือต่อสัญญาไม่ถูกต้อง");
  const raw = input as Record<string, unknown>;
  const out = emptyLeaseRenewal();
  for (const [key, max] of TEXT) out[key] = text(raw[key], max, key);
  out.issueDate = dateField(out.issueDate, "วันที่จัดทำ");
  out.landlordName = requireText(out.landlordName, 120, "ชื่อผู้ให้เช่า");
  out.tenantName = requireText(out.tenantName, 120, "ชื่อผู้เช่า");
  out.propertyLine = requireText(out.propertyLine, 240, "ที่อยู่ห้อง");
  out.originalLeaseNo = requireText(out.originalLeaseNo, 40, "เลขสัญญาเช่าเดิม");
  out.originalLeaseDate = dateField(out.originalLeaseDate, "วันที่สัญญาเดิม");
  out.originalExpiryDate = dateField(out.originalExpiryDate, "วันสิ้นสุดสัญญาเดิม");
  out.startDate = dateField(out.startDate, "วันเริ่มต่อสัญญา");
  out.endDate = dateField(out.endDate, "วันสิ้นสุดต่อสัญญา");
  const nextStart = shiftIsoDate(out.originalExpiryDate, 1);
  if (out.startDate !== nextStart)
    throw new BadRequestException(
      "สัญญาใหม่ต้องเริ่มวันถัดจากวันที่สัญญาเดิมหมดอายุ",
    );
  if (!/^\d{1,3}$/.test(out.renewMonths) || Number(out.renewMonths) < 1)
    throw new BadRequestException("กรุณากรอกจำนวนเดือนที่ต่อ");
  const termEnd = leaseTermEnd(out.startDate, Number(out.renewMonths));
  if (out.endDate !== termEnd)
    throw new BadRequestException(
      "วันสิ้นสุดต้องเป็นวันก่อนครบรอบตามจำนวนเดือนที่ต่อ เช่น เริ่ม 25 ธ.ค. ต่อ 12 เดือน สิ้นสุด 24 ธ.ค. ปีถัดไป",
    );
  out.monthlyRent = requireText(out.monthlyRent, 40, "ค่าเช่า");
  out.depositCarried = requireText(out.depositCarried, 40, "เงินประกันที่ยกยอด");
  contractAmount(out.monthlyRent, 'ค่าเช่า', true);
  contractAmount(out.depositCarried, 'เงินประกันที่ยกยอด');
  if (out.dueDay && (!/^\d{1,2}$/.test(out.dueDay) || Number(out.dueDay) < 1 || Number(out.dueDay) > 31))
    throw new BadRequestException("วันครบกำหนดชำระต้องเป็นวันที่ 1–31");
  out.landlordSignName = out.landlordSignName || out.landlordName;
  out.tenantSignName = out.tenantSignName || out.tenantName;
  return out;
}

/** Readable copy of the first lease, stored on every renewal in the chain. */
export function firstLeaseFields(root: {
  contract_no: string | null;
  start_date: unknown;
  end_date: unknown;
  data?: unknown;
}): Pick<
  LeaseRenewalInput,
  "firstLeaseNo" | "firstLeaseDate" | "firstLeaseStart" | "firstLeaseEnd"
> {
  const start = asIsoDate(root.start_date);
  const data =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as { leaseAgreement?: { issueDate?: unknown }; leaseRenewal?: { issueDate?: unknown } })
      : {};
  const issued = asIsoDate(data.leaseAgreement?.issueDate ?? data.leaseRenewal?.issueDate);
  return {
    firstLeaseNo: root.contract_no || "",
    firstLeaseDate: issued || start,
    firstLeaseStart: start,
    firstLeaseEnd: asIsoDate(root.end_date),
  };
}

export function leaseRenewalSnapshot(
  data: LeaseRenewalInput,
): Omit<LeaseRenewalInput, "landlordSignaturePng" | "tenantSignaturePng"> {
  const { landlordSignaturePng: _l, tenantSignaturePng: _t, ...rest } = data;
  return rest;
}

/**
 * AC-8.1 (Aof 29 Oct 2026): the renewal commission the agent agreed, typed in baht (0 allowed). Kept in the system
 * for the agent and the landlord; not on the renewal PDF and not shown to the tenant.
 */
export function parseRenewalCommission(value: unknown): string {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.replace(/,/g, "").trim() : "";
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(raw) || Number(raw) > 99_999_999.99)
    throw new BadRequestException("กรุณากรอกค่าคอมมิชชั่นการต่อสัญญาเป็นตัวเลข (0 ได้)");
  return Number(raw).toFixed(2);
}
