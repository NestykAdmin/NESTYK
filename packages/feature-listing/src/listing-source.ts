import type { AppIconName } from '@nestyk/ui/native';
import { tokens } from '@nestyk/ui/native';

export type ListingSourceCode = 'co_agent' | 'owner';

/** Shared source identity — picker + list cards. */
export const LISTING_SOURCE_OPTIONS = [
  {
    code: 'owner' as const,
    icon: 'user' as AppIconName,
    pickerIcon: 'user' as AppIconName,
    iconColor: '#211E1E',
    iconBg: '#FFF9E8',
  },
  {
    code: 'co_agent' as const,
    icon: 'users' as AppIconName,
    pickerIcon: 'handshake' as AppIconName,
    iconColor: '#64748B',
    iconBg: '#F1F5F9',
  },
] as const;

export const LISTING_SOURCE_BY_CODE = Object.fromEntries(
  LISTING_SOURCE_OPTIONS.map((opt) => [opt.code, opt]),
) as Record<ListingSourceCode, (typeof LISTING_SOURCE_OPTIONS)[number]>;

export const SOURCE_SELECT_BORDER = tokens.colors.brand[500];
export const SOURCE_SELECT_BG = '#FFFBEB';
export const SOURCE_IDLE_BORDER = tokens.colors.border;

export function listingSourceStyle(code: string | null | undefined) {
  if (code === 'owner' || code === 'co_agent') return LISTING_SOURCE_BY_CODE[code];
  return null;
}
