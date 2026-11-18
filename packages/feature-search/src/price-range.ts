/**
 * Monthly rent scale shared by the guest web and the app (Mos 12 Nov 2026): one slider range, one step and one set
 * of presets, so a price picked on the web and in the app means the same thing. No React here.
 */
export const RENT_PRICE_LIMIT = 100000;
export const RENT_PRICE_STEP = 1000;

/** A preset range; a missing end means "no limit" on that side. */
export interface RentPricePreset {
  min?: number;
  max?: number;
}

/** All, up to 10k, 10–20k, 20–30k, 30–50k, 50k and up. */
export const RENT_PRICE_PRESETS: readonly RentPricePreset[] = [
  {},
  { max: 10000 },
  { min: 10000, max: 20000 },
  { min: 20000, max: 30000 },
  { min: 30000, max: 50000 },
  { min: 50000 },
];

/** Nearest step inside the scale. */
export function snapRentPrice(value: number): number {
  const stepped = Math.round(value / RENT_PRICE_STEP) * RENT_PRICE_STEP;
  return Math.min(RENT_PRICE_LIMIT, Math.max(0, stepped));
}

/** True when a price filter is exactly this preset. No minimum equals 0; no maximum equals an open top. */
export function isRentPreset(minPrice: number | undefined, maxPrice: number | undefined, preset: RentPricePreset): boolean {
  const low = minPrice ?? 0;
  const high = maxPrice ?? Number.POSITIVE_INFINITY;
  return low === (preset.min ?? 0) && high === (preset.max ?? Number.POSITIVE_INFINITY);
}
