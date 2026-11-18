/**
 * Popular areas of the guest web (Mos 11 Nov 2026, H7: constants in code, no table yet).
 * A building belongs to an area when its `properties.district` matches one of the district names below.
 * Names shown to people come from i18n by slug (`guest.areaNames.<slug>`); `nameTh` is only the API fallback.
 * Transit lines are codes; their labels are in i18n too (`guest.transitLines.<code>`).
 */

export type TransitLineCode =
  | 'bts_sukhumvit'
  | 'bts_silom'
  | 'mrt_blue'
  | 'mrt_purple'
  | 'mrt_pink'
  | 'arl';

export interface PublicAreaDefinition {
  slug: string;
  nameTh: string;
  /** District names as stored for buildings, Thai and English. Compared without "เขต" / "District" and case. */
  districts: readonly string[];
  transitLines: readonly TransitLineCode[];
}

export const PUBLIC_AREAS: readonly PublicAreaDefinition[] = [
  {
    slug: 'sukhumvit-asok',
    nameTh: 'สุขุมวิท อโศก',
    districts: ['วัฒนา', 'คลองเตย', 'Watthana', 'Khlong Toei', 'Khlong Toei Nuea'],
    transitLines: ['bts_sukhumvit', 'mrt_blue'],
  },
  {
    slug: 'silom-sathorn',
    nameTh: 'สีลม สาทร',
    districts: ['บางรัก', 'สาทร', 'Bang Rak', 'Sathon', 'Sathorn'],
    transitLines: ['bts_silom', 'mrt_blue'],
  },
  {
    slug: 'onnut-udomsuk',
    nameTh: 'อ่อนนุช อุดมสุข',
    districts: ['พระโขนง', 'บางนา', 'Phra Khanong', 'Bang Na'],
    transitLines: ['bts_sukhumvit'],
  },
  {
    slug: 'ari-phayathai',
    nameTh: 'อารีย์ พญาไท',
    districts: ['พญาไท', 'ราชเทวี', 'Phaya Thai', 'Ratchathewi'],
    transitLines: ['bts_sukhumvit', 'arl'],
  },
  {
    slug: 'ladprao-chatuchak',
    nameTh: 'ลาดพร้าว จตุจักร',
    districts: ['จตุจักร', 'ลาดพร้าว', 'ห้วยขวาง', 'Chatuchak', 'Lat Phrao', 'Huai Khwang'],
    transitLines: ['mrt_blue'],
  },
  {
    slug: 'nonthaburi-chaengwattana',
    nameTh: 'นนทบุรี แจ้งวัฒนะ',
    districts: ['ปากเกร็ด', 'เมืองนนทบุรี', 'Pak Kret', 'Mueang Nonthaburi'],
    transitLines: ['mrt_purple', 'mrt_pink'],
  },
];

function normalizeDistrict(value: string): string {
  return value
    .trim()
    .replace(/^(เขต|อำเภอ|อ\.)\s*/u, '')
    .replace(/^(khet|amphoe)\s+/i, '')
    .replace(/\s+district$/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

const AREA_BY_DISTRICT = new Map<string, PublicAreaDefinition>();
for (const area of PUBLIC_AREAS) {
  for (const district of area.districts) AREA_BY_DISTRICT.set(normalizeDistrict(district), area);
}

export function areaOfDistrict(district: string | null | undefined): PublicAreaDefinition | null {
  if (!district) return null;
  return AREA_BY_DISTRICT.get(normalizeDistrict(district)) ?? null;
}
