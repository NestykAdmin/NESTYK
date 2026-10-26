/**
 * ID card / passport number input that works for any country: only A–Z and 0–9 are kept (uppercased),
 * with no per-country format enforced. A number that is a valid Thai-issued 13-digit ID (citizens and
 * the pink card for non-Thais) is shown in its usual `X-XXXX-XXXXX-XX-X` form.
 */

/** Longest number kept while typing; passports and national IDs worldwide fit well within it. */
export const IDENTITY_NUMBER_MAX = 20;

/** Thai 13-digit ID: the last digit is a mod-11 check over the first twelve. */
export function isThaiIdNumber(digits: string): boolean {
  if (!/^\d{13}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(digits[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(digits[12]);
}

export function formatThaiIdNumber(digits: string): string {
  return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`;
}

/** What the field shows after each keystroke or paste. */
export function nextIdentityNumberDraft(input: string): string {
  const raw = input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, IDENTITY_NUMBER_MAX);
  return isThaiIdNumber(raw) ? formatThaiIdNumber(raw) : raw;
}

/*
 * C3 (Aof, 22 Oct 2026): a tenant is matched by this number only, so a Thai ID must be right.
 * Same rule as the API (apps/api/src/common/identity-number.ts).
 */
const THAI_NATIONALITY = new Set(["thai", "ไทย", "th", "tha", "สัญชาติไทย"]);
export function isThaiNationality(value: string | null | undefined): boolean {
  return THAI_NATIONALITY.has((value ?? "").trim().toLowerCase());
}

export type IdentityNumberProblem = "format" | "thai_id";

/**
 * null when acceptable. A Thai national must give a valid Thai ID; with no nationality, 13 digits are taken as a
 * Thai ID and checked; any other nationality only needs 5–100 letters or digits (a Korean ID also has 13 digits).
 */
export function identityNumberProblem(value: string, nationality?: string | null): IdentityNumberProblem | null {
  const raw = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9\s/-]{4,99}$/.test(raw)) return "format";
  const digits = raw.replace(/[\s-]/g, "").toUpperCase();
  const thai = isThaiNationality(nationality) || (!(nationality ?? "").trim() && /^\d{13}$/.test(digits));
  return thai && !isThaiIdNumber(digits) ? "thai_id" : null;
}
