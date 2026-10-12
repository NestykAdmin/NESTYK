import Ajv from "ajv";
import {
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { CreateAgentContract } from "@nestyk/types";

const ajv = new Ajv({ allErrors: false, strict: true, ownProperties: true });
/** Canonical operational fields always win over caller-supplied JSON. */
export function validateAgreementData(
  schema: Record<string, unknown>,
  input: unknown,
  contract: CreateAgentContract,
  formKind: "reservation" | "lease" | "broker_appointment" | "renewal",
): Record<string, unknown> {
  if (input != null && (typeof input !== "object" || Array.isArray(input)))
    throw new BadRequestException("ข้อมูลเฉพาะสัญญาต้องเป็น object");
  const data = {
    ...(input as Record<string, unknown> | undefined),
    startDate: contract.startDate,
    ...(formKind === "reservation"
      ? {
          moveInDate: contract.moveInDate,
          reservationFee: contract.reservationFee,
        }
      : formKind === "lease" || formKind === "renewal"
        ? {
            endDate: contract.endDate,
            monthlyRent: contract.monthlyRent,
            deposit: contract.deposit,
          }
        : {}),
  };
  if (JSON.stringify(data).length > 64000)
    throw new BadRequestException("ข้อมูลเฉพาะสัญญามีขนาดใหญ่เกินไป");
  let validate;
  try {
    validate = ajv.compile(schema);
  } catch {
    throw new ServiceUnavailableException("แม่แบบสัญญามี schema ไม่ถูกต้อง");
  }
  if (!validate(data))
    throw new BadRequestException("ข้อมูลไม่ตรงกับฟิลด์ที่กำหนดในแม่แบบสัญญา");
  return data;
}
