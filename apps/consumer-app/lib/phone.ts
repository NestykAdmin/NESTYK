import {
  AsYouType,
  getCountryCallingCode,
  getExampleNumber,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
} from 'libphonenumber-js/max';
import examples from 'libphonenumber-js/mobile/examples';

/** Thailand first, then lead nationalities and neighbours; `OTHER` takes a typed "+code". */
export const PHONE_COUNTRIES = [
  'TH', 'CN', 'JP', 'KR', 'IN', 'MM', 'LA', 'KH', 'VN', 'MY', 'SG',
  'PH', 'ID', 'TW', 'HK', 'US', 'GB', 'AU', 'DE', 'FR', 'RU',
] as const satisfies readonly CountryCode[];
export type PhoneCountry = (typeof PHONE_COUNTRIES)[number];
export const PHONE_OTHER = 'OTHER' as const;
export type PhoneRegion = PhoneCountry | typeof PHONE_OTHER;

const DEFAULT_COUNTRY: PhoneCountry = 'TH';
/** E.164 allows at most 15 digits including the country code. */
const MAX_DIGITS = 15;

/** Form state: national digits for a listed country, or "+digits" for {@link PHONE_OTHER}. */
export type PhoneDraft = { region: PhoneRegion; digits: string };

const NATIONALITY_COUNTRY: Record<string, PhoneCountry> = {
  thai: 'TH', chinese: 'CN', japanese: 'JP', korean: 'KR', indian: 'IN',
  myanmar: 'MM', vietnamese: 'VN', filipino: 'PH', american: 'US', british: 'GB',
};

function isListed(code: string | undefined): code is PhoneCountry {
  return !!code && (PHONE_COUNTRIES as readonly string[]).includes(code);
}

export function flagEmoji(region: PhoneRegion): string {
  if (region === PHONE_OTHER) return '🌐';
  return String.fromCodePoint(...[...region].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

export function callingCode(country: PhoneCountry): string {
  return `+${getCountryCallingCode(country)}`;
}

export function countryForNationality(code: string | null): PhoneCountry | null {
  return (code && NATIONALITY_COUNTRY[code]) || null;
}

export function examplePhone(region: PhoneRegion): string {
  if (region === PHONE_OTHER) return '+86 138 0013 8000';
  return getExampleNumber(region, examples)?.formatNational() ?? '';
}

/** Splits a stored value; Thai local numbers ("08…") without "+" are read as TH. */
export function parseStoredPhone(raw: string | null | undefined): PhoneDraft {
  const value = (raw ?? '').trim();
  if (!value) return { region: DEFAULT_COUNTRY, digits: '' };
  const parsed = parsePhoneNumberFromString(value, DEFAULT_COUNTRY);
  if (parsed && isListed(parsed.country)) {
    return { region: parsed.country, digits: parsed.formatNational().replace(/\D/g, '') };
  }
  if (parsed && value.startsWith('+')) return { region: PHONE_OTHER, digits: parsed.number.slice(1) };
  return { region: DEFAULT_COUNTRY, digits: value.replace(/\D/g, '').slice(0, MAX_DIGITS) };
}

export function formatPhoneDraft({ region, digits }: PhoneDraft): string {
  if (!digits) return '';
  return region === PHONE_OTHER ? new AsYouType().input(`+${digits}`) : new AsYouType(region).input(digits);
}

/**
 * Applies a keystroke or paste: keeps digits only, refuses input past the country's number
 * length, and switches country when a "+code" number is pasted.
 */
export function nextPhoneDraft(current: PhoneDraft, text: string): PhoneDraft {
  if (text.includes('+')) {
    const parsed = parsePhoneNumberFromString(text);
    if (parsed && isListed(parsed.country)) {
      return { region: parsed.country, digits: parsed.formatNational().replace(/\D/g, '') };
    }
    return { region: PHONE_OTHER, digits: text.replace(/\D/g, '').slice(0, MAX_DIGITS) };
  }
  let digits = text.replace(/\D/g, '');
  // Backspace over a formatting space leaves the digits unchanged; drop the last digit instead.
  if (digits === current.digits && text.length < formatPhoneDraft(current).length) digits = digits.slice(0, -1);
  if (digits.length > MAX_DIGITS) return current;
  const length =
    current.region === PHONE_OTHER
      ? validatePhoneNumberLength(`+${digits}`)
      : validatePhoneNumberLength(digits, current.region);
  if (length === 'TOO_LONG') return current;
  const next = { region: current.region, digits };
  // Lock once the number is complete: a digit that turns a valid number invalid is refused.
  if (digits.length > current.digits.length && phoneDraftToE164(current) && !phoneDraftToE164(next)) return current;
  return next;
}

/** E.164 ("+66812345678") when the number is valid for its country, otherwise null. */
export function phoneDraftToE164({ region, digits }: PhoneDraft): string | null {
  if (!digits) return null;
  const parsed =
    region === PHONE_OTHER
      ? parsePhoneNumberFromString(`+${digits}`)
      : parsePhoneNumberFromString(digits, region);
  return parsed?.isValid() ? parsed.number : null;
}

/** Country pick: keeps typed digits, carrying the calling code into or out of {@link PHONE_OTHER}. */
export function switchPhoneRegion(draft: PhoneDraft, region: PhoneRegion): PhoneDraft {
  if (region === draft.region || !draft.digits) return { region, digits: draft.digits };
  if (region === PHONE_OTHER) {
    const from = draft.region as PhoneCountry;
    const e164 = phoneDraftToE164(draft);
    return { region, digits: e164 ? e164.slice(1) : `${getCountryCallingCode(from)}${draft.digits.replace(/^0+/, '')}` };
  }
  if (draft.region === PHONE_OTHER) {
    const parsed = parsePhoneNumberFromString(`+${draft.digits}`);
    return { region, digits: parsed?.country === region ? parsed.formatNational().replace(/\D/g, '') : '' };
  }
  return { region, digits: draft.digits };
}

export function samePhoneDraft(a: PhoneDraft, b: PhoneDraft): boolean {
  return a.region === b.region && a.digits === b.digits;
}

/**
 * The phone the lead form can save, or '' when it cannot: a number that is valid for its country or, when editing and
 * the number is untouched, the stored one (free text from before the country picker, so other edits are not blocked).
 * The Save button and the agent web readiness panel both ask this, so they cannot disagree.
 */
export function savablePhone(phone: PhoneDraft, initial: PhoneDraft, stored: string | null | undefined): string {
  return phoneDraftToE164(phone) ?? (stored != null && samePhoneDraft(phone, initial) ? stored : '');
}

/** Thai numbers in local format ("081 234 5678"); others with their country code. */
export function formatPhoneDisplay(raw: string): string {
  const parsed = parsePhoneNumberFromString(raw.trim(), DEFAULT_COUNTRY);
  if (!parsed) return raw;
  return parsed.country === DEFAULT_COUNTRY ? parsed.formatNational() : parsed.formatInternational();
}

/** Dialable form for `tel:` links. */
export function phoneDialString(raw: string): string {
  return parsePhoneNumberFromString(raw.trim(), DEFAULT_COUNTRY)?.number ?? raw.replace(/[^\d+]/g, '');
}
