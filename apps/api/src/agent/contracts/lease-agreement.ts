import { BadRequestException } from "@nestjs/common";
import type { LeaseAgreementInput } from "@nestyk/types";

const TEXT = [
  ["documentNo", 40],
  ["issueDate", 32],
  ["landlordName", 80],
  ["landlordFirstName", 80],
  ["landlordLastName", 80],
  ["landlordNationality", 40],
  ["landlordId", 40],
  ["landlordAddress", 160],
  ["landlordPhone", 40],
  ["landlordEmail", 80],
  ["tenantName", 80],
  ["tenantFirstName", 80],
  ["tenantLastName", 80],
  ["tenantNationality", 40],
  ["tenantId", 40],
  ["tenantAddress", 160],
  ["tenantPhone", 40],
  ["tenantEmail", 80],
  ["propertyType", 60],
  ["project", 80],
  ["houseNo", 40],
  ["propertyAddress", 160],
  ["roomType", 60],
  ["floor", 20],
  ["area", 20],
  ["termMonths", 12],
  ["termFrom", 32],
  ["termTo", 32],
  ["monthlyRent", 40],
  ["monthlyRentWords", 80],
  ["rentDueDay", 8],
  ["graceDay", 8],
  ["latePenalty", 24],
  ["latePenaltyWords", 60],
  ["bankName", 80],
  ["accountName", 80],
  ["accountNo", 40],
  ["otherPaymentMethod", 160],
  ["advanceMonths", 8],
  ["advanceAmount", 40],
  ["depositMonths", 8],
  ["depositAmount", 40],
  ["otherInitialPayment", 120],
  ["additionalTerms", 800],
  ["agentContact", 200],
  ["landlordSignName", 60],
  ["tenantSignName", 60],
  ["witnessSignName", 60],
] as const;

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;
const PNG_MAGIC = "89504e470d0a1a0a";

function optionalPng(value: unknown, label: string): string {
  if (value == null || value === "") return "";
  if (typeof value !== "string")
    throw new BadRequestException(`${label}ไม่ถูกต้อง`);
  const raw = value.replace(/^data:image\/png;base64,/i, "");
  let png: Buffer;
  try {
    png = Buffer.from(raw, "base64");
  } catch {
    throw new BadRequestException(`${label}ไม่ถูกต้อง`);
  }
  if (
    png.length < 32 ||
    png.length > MAX_SIGNATURE_BYTES ||
    png.subarray(0, 8).toString("hex") !== PNG_MAGIC
  )
    throw new BadRequestException(`${label}ต้องเป็นไฟล์ PNG`);
  return value.startsWith("data:") ? value : `data:image/png;base64,${raw}`;
}

export function emptyLeaseAgreement(): LeaseAgreementInput {
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

export function validateLeaseAgreement(input: unknown): LeaseAgreementInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("กรุณาระบุข้อมูลสัญญาเช่า");
  const b = input as Record<string, unknown>;
  const out = emptyLeaseAgreement();
  for (const [key, max] of TEXT) {
    const v = b[key];
    if (
      (key === "landlordFirstName" ||
        key === "landlordLastName" ||
        key === "tenantFirstName" ||
        key === "tenantLastName") &&
      (v == null || v === "")
    ) {
      out[key] = "";
      continue;
    }
    if (typeof v !== "string" || v.trim().length > max)
      throw new BadRequestException(`ข้อมูลในฟอร์มไม่ครบหรือยาวเกินไป (${key} ไม่เกิน ${max} ตัวอักษร)`);
    out[key] = v.trim();
  }
  if (out.landlordFirstName)
    out.landlordName = [out.landlordFirstName, out.landlordLastName].filter(Boolean).join(" ");
  if (out.tenantFirstName)
    out.tenantName = [out.tenantFirstName, out.tenantLastName].filter(Boolean).join(" ");
  out.landlordSignaturePng = optionalPng(
    b.landlordSignaturePng,
    "ลายเซ็นผู้ให้เช่า",
  );
  out.tenantSignaturePng = optionalPng(
    b.tenantSignaturePng,
    "ลายเซ็นผู้เช่า",
  );
  for (const key of [
    "issueDate",
    "landlordName",
    "tenantName",
    "project",
    "termFrom",
    "termTo",
    "monthlyRent",
    "depositAmount",
  ] as const) {
    if (!out[key])
      throw new BadRequestException("กรุณากรอกข้อมูลที่จำเป็นให้ครบ");
  }
  for (const key of ["issueDate", "termFrom", "termTo"] as const) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(out[key]))
      throw new BadRequestException("รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)");
  }
  if (out.termTo <= out.termFrom)
    throw new BadRequestException("วันสิ้นสุดต้องอยู่หลังวันเริ่มเช่า");
  out.landlordSignName = out.landlordName;
  out.tenantSignName = out.tenantName;
  if (!out.witnessSignName) out.witnessSignName = out.agentContact;
  return out;
}

/** Persistable fields only — drop large signature payloads from contract JSON. */
export function leaseAgreementSnapshot(
  data: LeaseAgreementInput,
): Omit<LeaseAgreementInput, "landlordSignaturePng" | "tenantSignaturePng"> {
  const {
    landlordSignaturePng: _l,
    tenantSignaturePng: _t,
    ...rest
  } = data;
  return rest;
}

export function pickLeaseRentFromRoom(
  room:
    | {
        price_rows?: Array<{
          price: string;
          contract_type?: { term_months?: number } | null;
        }> | null;
        prices?: Record<string, unknown>[] | null;
        advance_rent_months?: number | null;
        deposit_months?: number | null;
      }
    | null
    | undefined,
  preferredMonths: number | null | undefined,
): {
  monthlyRent: string;
  termMonths: string;
  advanceMonths: string;
  depositMonths: string;
} {
  type Row = { price: number; termMonths: number | null };
  const rows: Row[] = [];
  if (room?.price_rows?.length) {
    for (const row of room.price_rows) {
      const price = Number(row.price);
      if (!Number.isFinite(price)) continue;
      rows.push({
        price,
        termMonths: row.contract_type?.term_months ?? null,
      });
    }
    rows.sort((a, b) => (a.termMonths ?? 0) - (b.termMonths ?? 0));
  } else if (room?.prices?.length) {
    for (const row of room.prices) {
      const price = Number(row.price);
      if (
        !Number.isFinite(price) ||
        typeof row.contractTypeCode !== "string"
      )
        continue;
      rows.push({
        price,
        termMonths:
          Number(String(row.contractTypeCode).replace("monthly_", "")) || null,
      });
    }
  }
  const fromLead =
    preferredMonths != null && preferredMonths > 0
      ? String(preferredMonths)
      : "";
  const advanceMonths =
    room?.advance_rent_months != null ? String(room.advance_rent_months) : "";
  const depositMonths =
    room?.deposit_months != null ? String(room.deposit_months) : "";
  if (!rows.length)
    return { monthlyRent: "", termMonths: fromLead, advanceMonths, depositMonths };
  const match =
    preferredMonths != null
      ? rows.find((r) => r.termMonths === preferredMonths)
      : undefined;
  const picked = match ?? rows[0]!;
  return {
    monthlyRent: String(picked.price),
    termMonths:
      fromLead || (picked.termMonths != null ? String(picked.termMonths) : ""),
    advanceMonths,
    depositMonths,
  };
}
