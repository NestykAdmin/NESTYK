import type { PublicRoomCard } from '@nestyk/types';
import { formatBedroomSpec } from './bedroom-label';

/**
 * Display helpers for the public (guest) listing pages.
 * Pure functions: the caller passes in the translated labels and "today", so the output is
 * deterministic and the same code runs on the website and in the app.
 */

export type PublicRoomSpecLabels = {
  bedroom: { studio: string; one: string; many: string };
  bathroom: { one: string; many: string };
  /** Contains {count}. */
  area: string;
};

export type PublicAvailabilityLabels = {
  now: string;
  /** Contains {date}. */
  on: string;
};

export type PublicAvailability = { status: 'now' } | { status: 'on'; date: string };

/** Thai uses the Gregorian year (design v2.2), not the Buddhist one that plain th-TH gives. */
const DATE_LOCALES: Record<string, string> = { th: 'th-TH-u-ca-gregory', en: 'en-GB', ja: 'ja-JP', zh: 'zh-CN' };

/** "฿15,000" — whole baht with thousand separators; null when there is no usable price. */
export function formatPublicPrice(amount: number | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount) || amount < 0) return null;
  return `฿${Math.round(amount).toLocaleString('en-US')}`;
}

/** "350 m" below 1 km, "1.2 km" from 1 km up; null when the distance is unknown. */
export function formatStationDistance(meters: number | null | undefined): string | null {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return null;
  const rounded = Math.round(meters);
  if (rounded < 1000) return `${rounded} m`;
  return `${Number((rounded / 1000).toFixed(1))} km`;
}

/** Bedrooms, bathrooms and area as short strings, in that order; unknown values are skipped. */
export function buildPublicRoomSpecs(
  room: Pick<PublicRoomCard, 'bedrooms' | 'bathrooms' | 'areaSqm'>,
  labels: PublicRoomSpecLabels,
): string[] {
  const specs: string[] = [];
  const bedrooms = formatBedroomSpec(room.bedrooms, labels.bedroom);
  if (bedrooms) specs.push(bedrooms);
  if (room.bathrooms != null && Number.isFinite(room.bathrooms) && room.bathrooms > 0) {
    const text = String(room.bathrooms);
    specs.push((room.bathrooms === 1 ? labels.bathroom.one : labels.bathroom.many).replace('{count}', text));
  }
  if (room.areaSqm != null && Number.isFinite(room.areaSqm) && room.areaSqm > 0) {
    specs.push(labels.area.replace('{count}', String(room.areaSqm)));
  }
  return specs;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** A missing, invalid or already-passed date means the room can be moved into now. */
export function getPublicAvailability(
  availableFrom: string | null | undefined,
  today: string,
): PublicAvailability {
  if (!availableFrom || !isIsoDate(availableFrom)) return { status: 'now' };
  if (isIsoDate(today) && availableFrom <= today) return { status: 'now' };
  return { status: 'on', date: availableFrom };
}

export function formatPublicAvailability(
  availability: PublicAvailability,
  labels: PublicAvailabilityLabels,
  locale: string,
): string {
  if (availability.status === 'now') return labels.now;
  const date = new Intl.DateTimeFormat(DATE_LOCALES[locale] ?? DATE_LOCALES.en, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${availability.date}T00:00:00Z`));
  return labels.on.replace('{date}', date);
}
