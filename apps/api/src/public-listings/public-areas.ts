/**
 * Areas of the guest web (Mos 11 Nov 2026, H7: constants in code, no table yet). The list follows Mos's notes on
 * the areas people look for (20 Nov 2026): 10 in Bangkok and nearby, 10 province zones ("โซนต่างจังหวัด").
 * A building belongs to an area when its `properties.district` matches one of the district names below; a district
 * belongs to one area only. Names, places and the area texts shown to people come from i18n by slug
 * (`guest.areaNames.<slug>`, `guest.areaInfo.<slug>`); `nameTh` is only the API fallback.
 * Transit lines are codes; their labels are in i18n too (`guest.transitLines.<code>`).
 */

export type TransitLineCode =
  | 'bts_sukhumvit'
  | 'bts_silom'
  | 'mrt_blue'
  | 'mrt_purple'
  | 'mrt_pink'
  | 'mrt_yellow'
  | 'mrt_orange'
  | 'arl';

/** bangkok = Bangkok and nearby provinces; province = a zone in another province (shown apart on the web). */
export type AreaRegion = 'bangkok' | 'province';

export interface PublicAreaDefinition {
  slug: string;
  nameTh: string;
  region: AreaRegion;
  /** District names as stored for buildings, Thai and English. Compared without "เขต" / "อำเภอ" / "District" and case. */
  districts: readonly string[];
  transitLines: readonly TransitLineCode[];
}

export const PUBLIC_AREAS: readonly PublicAreaDefinition[] = [
  // Bangkok and nearby, in the order of Mos's list.
  {
    slug: 'ratchada-rama9',
    nameTh: 'รัชดาฯ – พระราม 9',
    region: 'bangkok',
    districts: ['ห้วยขวาง', 'ดินแดง', 'Huai Khwang', 'Huay Kwang', 'Huai Kwang', 'Din Daeng'],
    transitLines: ['mrt_blue'],
  },
  {
    slug: 'sukhumvit',
    nameTh: 'สุขุมวิท',
    region: 'bangkok',
    districts: ['วัฒนา', 'คลองเตย', 'พระโขนง', 'สวนหลวง', 'Watthana', 'Khlong Toei', 'Khlong Toei Nuea', 'Phra Khanong', 'Suan Luang'],
    transitLines: ['bts_sukhumvit', 'mrt_blue'],
  },
  {
    slug: 'ladprao-chatuchak',
    nameTh: 'ลาดพร้าว – จตุจักร',
    region: 'bangkok',
    districts: ['จตุจักร', 'ลาดพร้าว', 'Chatuchak', 'Chatuchak District', 'Lat Phrao', 'Ladprao', 'Lad Prao'],
    transitLines: ['bts_sukhumvit', 'mrt_blue'],
  },
  {
    slug: 'bangna-udomsuk',
    nameTh: 'บางนา – อุดมสุข',
    region: 'bangkok',
    districts: ['บางนา', 'ประเวศ', 'เมืองสมุทรปราการ', 'บางพลี', 'Bang Na', 'Prawet', 'Mueang Samut Prakan', 'Bang Phli'],
    transitLines: ['bts_sukhumvit', 'mrt_yellow'],
  },
  {
    slug: 'rangsit-khlongluang',
    nameTh: 'รังสิต – คลองหลวง',
    region: 'bangkok',
    districts: ['ธัญบุรี', 'คลองหลวง', 'Thanyaburi', 'Khlong Luang'],
    transitLines: [],
  },
  {
    slug: 'ari-phayathai',
    nameTh: 'อารีย์ – พญาไท',
    region: 'bangkok',
    districts: ['พญาไท', 'ราชเทวี', 'Phaya Thai', 'Phayathai', 'Ratchathewi', 'Rajthevee'],
    transitLines: ['bts_sukhumvit', 'arl'],
  },
  {
    slug: 'nonthaburi-chaengwattana',
    nameTh: 'นนทบุรี – แจ้งวัฒนะ',
    region: 'bangkok',
    districts: ['เมืองนนทบุรี', 'ปากเกร็ด', 'หลักสี่', 'Mueang Nonthaburi', 'Pak Kret', 'Lak Si'],
    transitLines: ['mrt_purple', 'mrt_pink'],
  },
  {
    slug: 'bangkhae-thapra',
    nameTh: 'บางแค – ท่าพระ',
    region: 'bangkok',
    districts: ['บางแค', 'ภาษีเจริญ', 'บางกอกใหญ่', 'Bang Khae', 'Phasi Charoen', 'Bangkok Yai'],
    transitLines: ['mrt_blue'],
  },
  {
    slug: 'silom-sathorn',
    nameTh: 'สามย่าน – สีลม – สาทร',
    region: 'bangkok',
    districts: ['ปทุมวัน', 'บางรัก', 'สาทร', 'Pathum Wan', 'Pathumwan', 'Bang Rak', 'Bangrak', 'Sathon', 'Sathorn'],
    transitLines: ['bts_silom', 'mrt_blue'],
  },
  {
    slug: 'ramkhamhaeng-bangkapi',
    nameTh: 'รามคำแหง – บางกะปิ',
    region: 'bangkok',
    districts: ['บางกะปิ', 'วังทองหลาง', 'Bang Kapi', 'Bangkapi', 'Wang Thonglang', 'Wang Thong Lang'],
    // The Orange Line is not running yet (review R6, 20 Nov 2026): add 'mrt_orange' when it opens.
    transitLines: ['mrt_yellow'],
  },
  // Province zones ("โซนต่างจังหวัด").
  {
    slug: 'chonburi',
    nameTh: 'ชลบุรี',
    region: 'province',
    districts: ['ศรีราชา', 'เมืองชลบุรี', 'บางละมุง', 'พานทอง', 'Si Racha', 'Sriracha', 'Mueang Chon Buri', 'Mueang Chonburi', 'Bang Lamung', 'Phan Thong'],
    transitLines: [],
  },
  {
    slug: 'chiangmai',
    nameTh: 'เชียงใหม่',
    region: 'province',
    districts: ['เมืองเชียงใหม่', 'หางดง', 'สันทราย', 'Mueang Chiang Mai', 'Hang Dong', 'San Sai'],
    transitLines: [],
  },
  {
    slug: 'phuket',
    nameTh: 'ภูเก็ต',
    region: 'province',
    districts: ['เมืองภูเก็ต', 'กะทู้', 'ถลาง', 'Mueang Phuket', 'Kathu', 'Thalang'],
    transitLines: [],
  },
  {
    slug: 'rayong',
    nameTh: 'ระยอง',
    region: 'province',
    districts: ['ปลวกแดง', 'เมืองระยอง', 'บ้านฉาง', 'Pluak Daeng', 'Mueang Rayong', 'Ban Chang'],
    transitLines: [],
  },
  {
    slug: 'khonkaen',
    nameTh: 'ขอนแก่น',
    region: 'province',
    districts: ['เมืองขอนแก่น', 'Mueang Khon Kaen'],
    transitLines: [],
  },
  {
    slug: 'korat',
    nameTh: 'นครราชสีมา',
    region: 'province',
    districts: ['เมืองนครราชสีมา', 'สูงเนิน', 'ปากช่อง', 'Mueang Nakhon Ratchasima', 'Sung Noen', 'Pak Chong'],
    transitLines: [],
  },
  {
    slug: 'ayutthaya',
    nameTh: 'พระนครศรีอยุธยา',
    region: 'province',
    districts: ['พระนครศรีอยุธยา', 'อุทัย', 'บางปะอิน', 'วังน้อย', 'Phra Nakhon Si Ayutthaya', 'Uthai', 'Bang Pa-in', 'Wang Noi'],
    transitLines: [],
  },
  {
    slug: 'hatyai',
    nameTh: 'หาดใหญ่',
    region: 'province',
    districts: ['หาดใหญ่', 'Hat Yai'],
    transitLines: [],
  },
  {
    slug: 'huahin',
    nameTh: 'หัวหิน',
    region: 'province',
    districts: ['หัวหิน', 'ปราณบุรี', 'Hua Hin', 'Pran Buri'],
    transitLines: [],
  },
  {
    slug: 'udonthani',
    nameTh: 'อุดรธานี',
    region: 'province',
    districts: ['เมืองอุดรธานี', 'Mueang Udon Thani'],
    transitLines: [],
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
