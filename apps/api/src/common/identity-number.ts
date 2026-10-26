/**
 * Identity numbers of tenants: a Thai national ID card number (13 digits) or a passport number.
 * Decided by Aof on 22 Oct 2026 (C3): a person is matched by this number only, and a Thai ID must be valid.
 */

/** The number without spaces and dashes, upper case: "1-2345-67890-12-1" and "1234567890121" are the same number. */
export function normalizeIdentityNumber(value: string | null | undefined): string {
  return (value ?? "").replace(/[\s-]/g, "").toUpperCase();
}

const THAI_NATIONALITY = new Set(["thai", "ไทย", "th", "tha", "สัญชาติไทย"]);
/** True for the ways the app stores Thai nationality (the lead form stores "Thai"; the tenant form is free text). */
export function isThaiNationality(value: string | null | undefined): boolean {
  return THAI_NATIONALITY.has((value ?? "").trim().toLowerCase());
}

/** The check digit of a Thai ID card: the 13th digit is (11 − Σ digit × (13 − position)) mod 11, then mod 10. */
export function isValidThaiId(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(value[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(value[12]);
}

export type IdentityNumberProblem = "format" | "thai_id";

/**
 * null when the number is acceptable. A Thai national must give a valid Thai ID; with no nationality, 13 digits
 * are taken as a Thai ID and checked; any other nationality only needs 5–100 letters or digits (a Korean ID also
 * has 13 digits, and a pink-card holder's Thai-issued ID passes the same check anyway).
 */
export function identityNumberProblem(value: string, nationality?: string | null): IdentityNumberProblem | null {
  const raw = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9\s/-]{4,99}$/.test(raw)) return "format";
  const digits = normalizeIdentityNumber(raw);
  const thai = isThaiNationality(nationality) || (!(nationality ?? "").trim() && /^\d{13}$/.test(digits));
  return thai && !isValidThaiId(digits) ? "thai_id" : null;
}

export const IDENTITY_NUMBER_MESSAGES: Record<IdentityNumberProblem, string> = {
  format: "กรุณาระบุเลขบัตรประชาชนหรือพาสปอร์ตให้ถูกต้อง",
  thai_id: "เลขบัตรประชาชนไม่ถูกต้อง ตรวจ 13 หลักหรือสัญชาติอีกครั้ง (สัญชาติไทยต้องใช้เลขบัตรประชาชน)",
};
