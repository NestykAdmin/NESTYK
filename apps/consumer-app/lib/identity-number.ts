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
