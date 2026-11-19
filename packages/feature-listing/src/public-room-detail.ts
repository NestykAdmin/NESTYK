import type { PublicRoomPriceOption } from '@nestyk/types';

/**
 * Guest room page helpers (S7.3, project-docs/nestyk-guest-room-detail-s73-plan-20261119.md). Pure: no React, no i18n
 * import, so the Next.js web and the app can both use them and the tests load them bare.
 */

export type AmenityGroup =
  | 'furniture'
  | 'appliances'
  | 'room_features'
  | 'parking'
  | 'project_facilities'
  | 'security_services';

/** Same order as the amenities picker (i18n AMENITIES_CATALOG_GROUP_ORDER). */
export const AMENITY_GROUP_ORDER: readonly AmenityGroup[] = [
  'furniture',
  'appliances',
  'room_features',
  'parking',
  'project_facilities',
  'security_services',
];

const GROUP_CODES: Record<AmenityGroup, readonly string[]> = {
  // Current codes follow master_facilities (supabase/seed/masters.sql, groups 8–13); the test compares them.
  // Old codes (pop_, bed_, liv_, sec_, srv_) are placed by what their label says.
  furniture: [
    'bed_mattress', 'wardrobe', 'sofa', 'tv_stand', 'dining_table', 'desk', 'vanity_mirror', 'storage_cabinet', 'curtains',
    'bed_02', 'liv_02',
  ],
  appliances: [
    'air_conditioning', 'fan', 'tv', 'smart_tv', 'refrigerator', 'microwave', 'washing_machine', 'dryer', 'water_heater',
    'induction_stove', 'gas_stove', 'range_hood', 'water_filter', 'digital_door_lock', 'smart_home',
    'bed_01', 'liv_03', 'liv_05', 'liv_06', 'liv_08',
  ],
  room_features: [
    'open_kitchen', 'closed_kitchen', 'bathtub', 'balcony', 'mosquito_net', 'drying_area', 'storage_room',
    'wet_dry_bathroom', 'private_garden', 'private_pool',
    'bed_04', 'liv_04', 'liv_09',
  ],
  parking: [
    'car_parking', 'motorcycle_parking', 'bicycle_parking', 'fixed_parking_slot', 'indoor_parking', 'private_ev_charger',
    'pop_04', 'srv_04',
  ],
  project_facilities: [
    'shared_pool', 'gym', 'sauna', 'shared_garden', 'coworking', 'cokitchen', 'playground', 'parcel_room', 'shared_laundry',
    'shuttle', 'shared_ev_charger',
    'pop_01', 'pop_02', 'pop_03', 'srv_06', 'srv_07', 'srv_08', 'srv_09',
  ],
  security_services: [
    'security_24h', 'keycard_access', 'cctv', 'smoke_detector', 'fire_extinguisher', 'in_unit_internet', 'housekeeping',
    'pet_friendly',
    'pop_05', 'sec_01', 'sec_02', 'sec_03', 'sec_04', 'sec_05', 'sec_06', 'srv_02',
  ],
};

/** Amenity code → its group. The public API sends codes only (plan D2: a fixed table, no API change). */
export const AMENITY_CODE_GROUP: Readonly<Record<string, AmenityGroup>> = Object.fromEntries(
  AMENITY_GROUP_ORDER.flatMap((group) => GROUP_CODES[group].map((code) => [code, group] as const)),
);

export interface AmenityGroupView {
  group: AmenityGroup;
  labels: string[];
}

/**
 * The room's amenities as labelled groups, in picker order. A code without a group or a label is left out (it cannot
 * be shown in words); old and new codes with the same label show once.
 */
export function groupAmenityCodes(codes: readonly string[], labels: Readonly<Record<string, string>>): AmenityGroupView[] {
  const byGroup = new Map<AmenityGroup, string[]>();
  for (const code of codes) {
    const group = AMENITY_CODE_GROUP[code];
    const label = labels[code];
    if (!group || !label) continue;
    const list = byGroup.get(group) ?? [];
    if (!list.includes(label)) list.push(label);
    byGroup.set(group, list);
  }
  return AMENITY_GROUP_ORDER.filter((group) => byGroup.has(group)).map((group) => ({ group, labels: byGroup.get(group)! }));
}

export interface PriceOptionView extends PublicRoomPriceOption {
  /** The lowest monthly price of the room (only the first one when two are equal). */
  lowest: boolean;
}

/**
 * Longest contract first (12 → 6 → 3 → 1 months), with the lowest monthly price marked. Two prices for the same
 * contract length show once, at the lower price (review R5).
 */
export function sortedPriceOptions(options: readonly PublicRoomPriceOption[]): PriceOptionView[] {
  const byMonths = new Map<number, PublicRoomPriceOption>();
  for (const option of options) {
    const kept = byMonths.get(option.durationMonths);
    if (!kept || option.pricePerMonth < kept.pricePerMonth) byMonths.set(option.durationMonths, option);
  }
  const sorted = [...byMonths.values()].sort((a, b) => b.durationMonths - a.durationMonths);
  let lowestIndex = -1;
  sorted.forEach((option, index) => {
    if (lowestIndex === -1 || option.pricePerMonth < sorted[lowestIndex].pricePerMonth) lowestIndex = index;
  });
  return sorted.map((option, index) => ({ ...option, lowest: index === lowestIndex }));
}

/** The option the viewing card starts on: the lowest monthly price. */
export function defaultPriceOption(options: readonly PriceOptionView[]): PriceOptionView | null {
  return options.find((option) => option.lowest) ?? options[0] ?? null;
}

/** Room page path without the language prefix. */
export function roomPagePath(id: string): string {
  return `/rooms/${encodeURIComponent(id)}`;
}
