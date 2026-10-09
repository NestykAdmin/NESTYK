import type { AgentLead, LeadContactChannel } from '@nestyk/types';

const HONORIFIC = /^(คุณ|นางสาว|นาง|นาย|น\.ส\.|ด\.ช\.|ด\.ญ\.|mrs\.?|mr\.?|ms\.?|miss|dr\.?)\s*/i;
/** Thai consonants ก–ฮ; skips leading vowels (เ แ โ ใ ไ), tone marks and above/below vowels. */
const THAI_CONSONANT = /[\u0E01-\u0E2E]/g;

function firstLetter(word: string): string {
  return word.match(THAI_CONSONANT)?.[0] ?? word.charAt(0).toUpperCase();
}

/** Two-letter avatar label: "คุณนิดา" → "นด", "Somchai Jaidee" → "SJ". */
export function leadAvatarInitials(name: string): string {
  const stripped = name.trim().replace(HONORIFIC, '').trim() || name.trim();
  const parts = stripped.split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length > 1) return `${firstLetter(parts[0])}${firstLetter(parts[1])}`;
  const thai = parts[0].match(THAI_CONSONANT);
  if (thai?.length) return thai.slice(0, 2).join('');
  return parts[0].slice(0, 2).toUpperCase();
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCALE_TAGS: Record<string, string> = { th: 'th-TH', en: 'en-GB', zh: 'zh-CN', ja: 'ja-JP' };

export function localeTag(locale: string): string {
  return LOCALE_TAGS[locale] ?? locale;
}

/** ISO move-in dates render localized ("1 พ.ย. 2569"); legacy free text is returned as-is. */
export function formatMoveIn(value: string | null | undefined, locale: string): string | null {
  if (!value) return null;
  const m = ISO_DATE.exec(value);
  if (!m) return value;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  try {
    return date.toLocaleDateString(LOCALE_TAGS[locale] ?? locale, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return value;
  }
}

/** Display-only lead code, e.g. "L-202509-0012" (created month + zero-padded id); not stored. */
export function formatLeadCode(lead: Pick<AgentLead, 'id' | 'createdAt'>): string {
  const created = lead.createdAt ? new Date(lead.createdAt) : null;
  const month =
    created && !Number.isNaN(created.getTime())
      ? `${created.getFullYear()}${String(created.getMonth() + 1).padStart(2, '0')}`
      : null;
  return ['L', month, String(lead.id).padStart(4, '0')].filter(Boolean).join('-');
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | null | undefined, locale: string): string | null {
  const date = toDate(value);
  if (!date) return null;
  return date.toLocaleDateString(LOCALE_TAGS[locale] ?? locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "14 ก.ย. 2568 10:24" */
export function formatDateTime(value: string | null | undefined, locale: string): string | null {
  const date = toDate(value);
  if (!date) return null;
  const tag = LOCALE_TAGS[locale] ?? locale;
  const time = date.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${formatDate(value, locale)} ${time}`;
}

/** "5 ต.ค. 14:00" */
export function formatShortDateTime(value: string | null | undefined, locale: string): string | null {
  const date = toDate(value);
  if (!date) return null;
  const tag = LOCALE_TAGS[locale] ?? locale;
  const day = date.toLocaleDateString(tag, { day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day} ${time}`;
}

/** Calendar days from today in device time (0 = today); rounding absorbs DST shifts. */
export function daysFromToday(date: Date, now = new Date()): number {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((start(date) - start(now)) / 86400000);
}

/** "วันนี้" / "พรุ่งนี้" / weekday within the week / "อีก 9 วัน". */
export function viewingDayLabel(
  value: string | null | undefined,
  locale: string,
  copy: { today: string; tomorrow: string; inDays: string },
): string | null {
  const date = toDate(value);
  if (!date) return null;
  const days = daysFromToday(date);
  if (days <= 0) return copy.today;
  if (days === 1) return copy.tomorrow;
  if (days < 7) return date.toLocaleDateString(LOCALE_TAGS[locale] ?? locale, { weekday: 'short' });
  return copy.inDays.replace('{n}', String(days));
}

export function formatBudgetRange(lead: Pick<AgentLead, 'budgetMin' | 'budgetMax'>): string | null {
  if (lead.budgetMin == null && lead.budgetMax == null) return null;
  return [lead.budgetMin, lead.budgetMax]
    .filter((v): v is number => v != null)
    .map((v) => v.toLocaleString())
    .join(' – ');
}

export function formatKm(km: number): string {
  return km < 10 ? km.toFixed(1) : String(Math.round(km));
}

/**
 * Deep link that opens the chat app for a contact, or null when the channel has no public
 * link (WeChat, other) or the value cannot form one — callers fall back to copying.
 */
export function leadContactUrl(channel: LeadContactChannel | 'email', raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return channel === 'wechat' || channel === 'email' ? null : value;
  switch (channel) {
    case 'email':
      return `mailto:${value}`;
    case 'line':
      // Official accounts keep the "@"; personal IDs use the "~" prefix.
      return value.startsWith('@')
        ? `https://line.me/R/ti/p/@${encodeURIComponent(value.slice(1))}`
        : `https://line.me/R/ti/p/~${encodeURIComponent(value)}`;
    case 'whatsapp': {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 8) return null;
      return `https://wa.me/${/^0\d{9}$/.test(digits) ? `66${digits.slice(1)}` : digits}`;
    }
    case 'telegram': {
      const user = value.replace(/^@/, '');
      return /^\w{4,}$/.test(user) ? `https://t.me/${user}` : null;
    }
    case 'facebook':
      return /^[\w.]+$/.test(value) ? `https://m.me/${value}` : null;
    default:
      return null;
  }
}
