import { BadRequestException } from "@nestjs/common";
import type { ReservationLetterInput } from "@nestyk/types";
import type { TenantEntity } from "../../entities/tenant.entity";
import { IDENTITY_NUMBER_MESSAGES, identityNumberProblem } from "../../common/identity-number";

const TEXT = [
  ["documentNo", 40],
  ["issueDate", 32],
  ["tenantName", 120],
  ["tenantFirstName", 120],
  ["tenantLastName", 120],
  ["tenantPhone", 40],
  ["tenantEmail", 120],
  ["tenantId", 40],
  ["tenantNationality", 40],
  ["landlordName", 120],
  ["landlordFirstName", 120],
  ["landlordLastName", 120],
  ["landlordPhone", 40],
  ["landlordEmail", 120],
  ["landlordId", 40],
  ["landlordNationality", 40],
  ["agentName", 80],
  ["companyName", 80],
  ["agentPhone", 40],
  ["project", 80],
  ["address", 160],
  ["unitNo", 24],
  ["floor", 16],
  ["area", 16],
  ["beds", 8],
  ["baths", 8],
  ["termMonths", 12],
  ["termFrom", 32],
  ["termTo", 32],
  ["monthlyRent", 40],
  ["advanceMonths", 8],
  ["advanceAmount", 40],
  ["depositMonths", 8],
  ["depositAmount", 40],
  ["reservationPayment", 40],
  ["reservationWords", 120],
  ["balanceDue", 40],
  ["payee", 80],
  ["paymentMethod", 16],
  ["bankAccount", 120],
  ["tenantSignName", 60],
  ["landlordSignName", 60],
  ["agentSignName", 60],
] as const;

const PAYMENT_METHODS = new Set(["", "transfer", "cash", "credit"]);

/** Calendar date in Asia/Bangkok (YYYY-MM-DD). */
export function bangkokDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Number and booking date are system-owned: keep a saved draft, otherwise assign today. */
export function stampReservationDocumentHeader(
  input: unknown,
  saved?: Partial<ReservationLetterInput> | null,
): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const savedDate = saved?.issueDate;
  const savedNo = saved?.documentNo;
  return {
    ...(input as Record<string, unknown>),
    documentNo: typeof savedNo === "string" ? savedNo : "",
    issueDate:
      typeof savedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(savedDate)
        ? savedDate
        : bangkokDate(),
  };
}

type TenantParty = Pick<
  TenantEntity,
  "name" | "first_name" | "last_name" | "phone" | "email" | "identity_number" | "nationality"
>;

/**
 * The tenant fields a reservation letter always takes from the tenant record (they are locked in the app form).
 * Used for new letters, on every draft save, and when the agent edits the tenant (draft sync).
 */
export function reservationTenantFields(tenant: TenantParty) {
  return {
    tenantName:
      [tenant.first_name, tenant.last_name].filter((part) => part?.trim()).join(" ") ||
      tenant.name ||
      "",
    tenantFirstName: tenant.first_name ?? "",
    tenantLastName: tenant.last_name ?? "",
    tenantPhone: tenant.phone ?? "",
    tenantEmail: tenant.email ?? "",
    tenantId: tenant.identity_number ?? "",
    tenantNationality: tenant.nationality ?? "",
  };
}

export function emptyReservationLetter(): ReservationLetterInput {
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

export function validateReservationLetter(
  input: unknown,
): ReservationLetterInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("กรุณาระบุข้อมูลหนังสือจอง");
  const b = input as Record<string, unknown>;
  const out = emptyReservationLetter();
  for (const [key, max] of TEXT) {
    const v = b[key];
    if (
      (key === "tenantEmail" ||
        key === "landlordEmail" ||
        key === "landlordFirstName" ||
        key === "landlordLastName" ||
        key === "tenantFirstName" ||
        key === "tenantLastName") &&
      (v == null || v === "")
    ) {
      out[key] = "";
      continue;
    }
    if (typeof v !== "string" || v.trim().length > max)
      throw new BadRequestException("ข้อมูลในฟอร์มไม่ครบหรือยาวเกินไป");
    out[key] = v.trim();
  }
  for (const key of ["tenantEmail", "landlordEmail"] as const) {
    if (out[key] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out[key]))
      throw new BadRequestException("รูปแบบอีเมลไม่ถูกต้อง");
  }
  if (out.tenantFirstName)
    out.tenantName = [out.tenantFirstName, out.tenantLastName].filter(Boolean).join(" ");
  if (out.landlordFirstName)
    out.landlordName = [out.landlordFirstName, out.landlordLastName].filter(Boolean).join(" ");
  out.applyToAdvance = b.applyToAdvance === true;
  out.applyToDeposit = b.applyToDeposit === true;
  if (!PAYMENT_METHODS.has(out.paymentMethod))
    throw new BadRequestException("วิธีชำระเงินไม่ถูกต้อง");
  for (const key of [
    "tenantName",
    "landlordName",
    "project",
    "issueDate",
    "reservationPayment",
  ] as const) {
    if (!out[key])
      throw new BadRequestException("กรุณากรอกข้อมูลที่จำเป็นให้ครบ");
  }
  for (const key of ["issueDate", "termFrom", "termTo"] as const) {
    if (out[key] && !/^\d{4}-\d{2}-\d{2}$/.test(out[key]))
      throw new BadRequestException("รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)");
  }
  // C3 (Aof, 22 Oct 2026): the tenant's account is matched by this number, so the letter needs it. It comes
  // from the tenant record (locked in the form), so the agent adds or fixes it there.
  if (!out.tenantId)
    throw new BadRequestException({ code: "TENANT_ID_REQUIRED", message: TENANT_ID_REQUIRED });
  const idProblem = identityNumberProblem(out.tenantId, out.tenantNationality);
  if (idProblem)
    throw new BadRequestException({ code: "TENANT_ID_INVALID", message: `${IDENTITY_NUMBER_MESSAGES[idProblem]} (แก้ในข้อมูลผู้เช่า)` });
  return out;
}

export const TENANT_ID_REQUIRED = "กรุณาเพิ่มเลขบัตรประชาชนหรือพาสปอร์ตในข้อมูลผู้เช่าก่อนบันทึกหนังสือจอง";
