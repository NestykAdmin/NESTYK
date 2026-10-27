import { BadRequestException } from "@nestjs/common";
import type { CommissionConfirmationInput } from "@nestyk/types";

export const COMMISSION_LIMITS: Record<keyof CommissionConfirmationInput, number> = {
  documentNo: 40,
  issueDate: 10,
  landlordName: 80,
  landlordFirstName: 80,
  landlordLastName: 80,
  landlordNationality: 40,
  landlordId: 40,
  agentName: 80,
  agentNationality: 40,
  agentId: 40,
  propertyType: 60,
  project: 60,
  unitNo: 40,
  propertyAddress: 180,
  tenantName: 80,
  tenantFirstName: 80,
  tenantLastName: 80,
  tenantNationality: 40,
  tenantIdentity: 40,
  leasePeriod: 40,
  leaseStart: 10,
  leaseEnd: 10,
  monthlyRent: 20,
  agreedCommission: 20,
  bankAccount: 160,
  landlordSignName: 80,
  agentSignName: 80,
  landlordSignDate: 10,
  agentSignDate: 10,
};

const REQUIRED = [
  "issueDate",
  "landlordName",
  "agentName",
  "tenantName",
  "propertyAddress",
  "monthlyRent",
  "agreedCommission",
] as const;

const DATES = [
  "issueDate",
  "leaseStart",
  "leaseEnd",
  "landlordSignDate",
  "agentSignDate",
] as const;

function validDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export function validateCommissionConfirmation(
  input: unknown,
): CommissionConfirmationInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("ข้อมูลเอกสารไม่ถูกต้อง");
  const obj = input as Record<string, unknown>;
  for (const [firstKey, lastKey, nameKey] of [
    ["landlordFirstName", "landlordLastName", "landlordName"],
    ["tenantFirstName", "tenantLastName", "tenantName"],
  ] as const) {
    const first = typeof obj[firstKey] === "string" ? obj[firstKey].trim() : "";
    const last = typeof obj[lastKey] === "string" ? obj[lastKey].trim() : "";
    if (first) obj[nameKey] = [first, last].filter(Boolean).join(" ");
    if (obj[firstKey] == null) obj[firstKey] = "";
    if (obj[lastKey] == null) obj[lastKey] = "";
  }
  const result = {} as CommissionConfirmationInput;
  for (const [key, limit] of Object.entries(COMMISSION_LIMITS) as Array<
    [keyof CommissionConfirmationInput, number]
  >) {
    if (obj[key] != null && typeof obj[key] !== "string")
      throw new BadRequestException(`ข้อมูล ${key} ไม่ถูกต้อง`);
    const value = String(obj[key] ?? "").trim();
    if (
      (REQUIRED.includes(key as (typeof REQUIRED)[number]) && !value) ||
      value.length > limit ||
      /[\x00-\x08\x0b-\x1f]/.test(value)
    )
      throw new BadRequestException(
        `กรุณาตรวจสอบ ${key} (สูงสุด ${limit} ตัวอักษร)`,
      );
    result[key] = value;
  }
  for (const key of DATES) {
    if (result[key] && !validDate(result[key]))
      throw new BadRequestException("วันที่ไม่ถูกต้อง");
  }
  if (
    result.leaseStart &&
    result.leaseEnd &&
    result.leaseEnd < result.leaseStart
  )
    throw new BadRequestException("วันสิ้นสุดสัญญาต้องไม่ก่อนวันเริ่ม");
  for (const key of ["monthlyRent", "agreedCommission"] as const) {
    const clean = result[key].replace(/,/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(clean) || Number(clean) <= 0)
      throw new BadRequestException("จำนวนเงินไม่ถูกต้อง");
    result[key] = clean;
  }
  if (!result.landlordSignName) result.landlordSignName = result.landlordName;
  if (!result.agentSignName) result.agentSignName = result.agentName;
  if (!result.landlordSignDate) result.landlordSignDate = result.issueDate;
  if (!result.agentSignDate) result.agentSignDate = result.issueDate;
  return result;
}
