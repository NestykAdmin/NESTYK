/**
 * Rail lines and stations for the transit picker beside the keyword box (Mos 20 Nov 2026). Positions come from
 * Google Places (Claude outputs/stations/fetch-station-coords.mjs, run once by Mos) and were checked before they were
 * put here. Lines are in the picker's order; stations in their order along the line. A station on two lines appears
 * in both (Siam, Tao Poon, ...). Line names are in i18n (guest.transitLines) by code.
 */

export type RailSystem = 'BTS' | 'MRT' | 'ARL' | 'SRT';

export type RailLineCode =
  | 'bts_sukhumvit'
  | 'bts_silom'
  | 'bts_gold'
  | 'mrt_blue'
  | 'mrt_purple'
  | 'mrt_yellow'
  | 'mrt_pink'
  | 'arl'
  | 'srt_red_north'
  | 'srt_red_west';

export interface RailStation {
  /** Station code on its line (E4, BL22, ...). */
  code: string;
  th: string;
  en: string;
  latitude: number;
  longitude: number;
}

export interface RailLine {
  code: RailLineCode;
  system: RailSystem;
  stations: readonly RailStation[];
}

export const RAIL_LINES: readonly RailLine[] = [
  {
    code: 'bts_sukhumvit',
    system: 'BTS',
    stations: [
      { code: 'N24', th: 'คูคต', en: 'Khu Khot', latitude: 13.93227, longitude: 100.64567 },
      { code: 'N23', th: 'แยก คปอ.', en: 'Yaek Kor Por Aor', latitude: 13.92498, longitude: 100.62588 },
      { code: 'N22', th: 'พิพิธภัณฑ์กองทัพอากาศ', en: 'Royal Thai Air Force Museum', latitude: 13.91795, longitude: 100.62172 },
      { code: 'N21', th: 'โรงพยาบาลภูมิพลอดุลยเดช', en: 'Bhumibol Adulyadej Hospital', latitude: 13.91072, longitude: 100.61742 },
      { code: 'N20', th: 'สะพานใหม่', en: 'Saphan Mai', latitude: 13.8966, longitude: 100.60913 },
      { code: 'N19', th: 'สายหยุด', en: 'Sai Yud', latitude: 13.88844, longitude: 100.60429 },
      { code: 'N18', th: 'พหลโยธิน 59', en: 'Phahon Yothin 59', latitude: 13.88245, longitude: 100.60077 },
      { code: 'N17', th: 'วัดพระศรีมหาธาตุ', en: 'Wat Phra Sri Mahathat', latitude: 13.87529, longitude: 100.59681 },
      { code: 'N16', th: 'กรมทหารราบที่ 11', en: '11th Infantry Regiment', latitude: 13.86753, longitude: 100.59194 },
      { code: 'N15', th: 'บางบัว', en: 'Bang Bua', latitude: 13.85599, longitude: 100.58517 },
      { code: 'N14', th: 'กรมป่าไม้', en: 'Royal Forest Department', latitude: 13.85026, longitude: 100.58176 },
      { code: 'N13', th: 'มหาวิทยาลัยเกษตรศาสตร์', en: 'Kasetsart University', latitude: 13.8423, longitude: 100.57713 },
      { code: 'N12', th: 'เสนานิคม', en: 'Sena Nikhom', latitude: 13.83631, longitude: 100.57374 },
      { code: 'N11', th: 'รัชโยธิน', en: 'Ratchayothin', latitude: 13.83086, longitude: 100.57027 },
      { code: 'N10', th: 'พหลโยธิน 24', en: 'Phahon Yothin 24', latitude: 13.82403, longitude: 100.56646 },
      { code: 'N9', th: 'ห้าแยกลาดพร้าว', en: 'Ha Yaek Lat Phrao', latitude: 13.81655, longitude: 100.56201 },
      { code: 'N8', th: 'หมอชิต', en: 'Mo Chit', latitude: 13.80257, longitude: 100.55378 },
      { code: 'N7', th: 'สะพานควาย', en: 'Saphan Khwai', latitude: 13.79377, longitude: 100.54971 },
      { code: 'N5', th: 'อารีย์', en: 'Ari', latitude: 13.77969, longitude: 100.54465 },
      { code: 'N4', th: 'สนามเป้า', en: 'Sanam Pao', latitude: 13.77264, longitude: 100.5421 },
      { code: 'N3', th: 'อนุสาวรีย์ชัยสมรภูมิ', en: 'Victory Monument', latitude: 13.76279, longitude: 100.53708 },
      { code: 'N2', th: 'พญาไท', en: 'Phaya Thai', latitude: 13.75674, longitude: 100.53484 },
      { code: 'N1', th: 'ราชเทวี', en: 'Ratchathewi', latitude: 13.75199, longitude: 100.53158 },
      { code: 'CEN', th: 'สยาม', en: 'Siam', latitude: 13.74561, longitude: 100.53412 },
      { code: 'E1', th: 'ชิดลม', en: 'Chit Lom', latitude: 13.74409, longitude: 100.54306 },
      { code: 'E2', th: 'เพลินจิต', en: 'Phloen Chit', latitude: 13.74304, longitude: 100.54897 },
      { code: 'E3', th: 'นานา', en: 'Nana', latitude: 13.74052, longitude: 100.55543 },
      { code: 'E4', th: 'อโศก', en: 'Asok', latitude: 13.73706, longitude: 100.56031 },
      { code: 'E5', th: 'พร้อมพงษ์', en: 'Phrom Phong', latitude: 13.73042, longitude: 100.5697 },
      { code: 'E6', th: 'ทองหล่อ', en: 'Thong Lo', latitude: 13.72429, longitude: 100.57843 },
      { code: 'E7', th: 'เอกมัย', en: 'Ekkamai', latitude: 13.71952, longitude: 100.58511 },
      { code: 'E8', th: 'พระโขนง', en: 'Phra Khanong', latitude: 13.71517, longitude: 100.59126 },
      { code: 'E9', th: 'อ่อนนุช', en: 'On Nut', latitude: 13.70565, longitude: 100.601 },
      { code: 'E10', th: 'บางจาก', en: 'Bang Chak', latitude: 13.69674, longitude: 100.60532 },
      { code: 'E11', th: 'ปุณณวิถี', en: 'Punnawithi', latitude: 13.68927, longitude: 100.60899 },
      { code: 'E12', th: 'อุดมสุข', en: 'Udom Suk', latitude: 13.68008, longitude: 100.6097 },
      { code: 'E13', th: 'บางนา', en: 'Bang Na', latitude: 13.66815, longitude: 100.60467 },
      { code: 'E14', th: 'แบริ่ง', en: 'Bearing', latitude: 13.66126, longitude: 100.60181 },
      { code: 'E15', th: 'สำโรง', en: 'Samrong', latitude: 13.64619, longitude: 100.59565 },
      { code: 'E16', th: 'ปู่เจ้า', en: 'Pu Chao', latitude: 13.63728, longitude: 100.59201 },
      { code: 'E17', th: 'ช้างเอราวัณ', en: 'Chang Erawan', latitude: 13.62145, longitude: 100.59011 },
      { code: 'E18', th: 'โรงเรียนนายเรือ', en: 'Royal Thai Naval Academy', latitude: 13.60852, longitude: 100.59483 },
      { code: 'E19', th: 'ปากน้ำ', en: 'Pak Nam', latitude: 13.60209, longitude: 100.59711 },
      { code: 'E20', th: 'ศรีนครินทร์', en: 'Srinagarindra', latitude: 13.59208, longitude: 100.60891 },
      { code: 'E21', th: 'แพรกษา', en: 'Phraek Sa', latitude: 13.58432, longitude: 100.60803 },
      { code: 'E22', th: 'สายลวด', en: 'Sai Luat', latitude: 13.57769, longitude: 100.60536 },
      { code: 'E23', th: 'เคหะฯ', en: 'Kheha', latitude: 13.56765, longitude: 100.60768 },
    ],
  },
  {
    code: 'bts_silom',
    system: 'BTS',
    stations: [
      { code: 'W1', th: 'สนามกีฬาแห่งชาติ', en: 'National Stadium', latitude: 13.74647, longitude: 100.52907 },
      { code: 'CEN', th: 'สยาม', en: 'Siam', latitude: 13.74561, longitude: 100.53412 },
      { code: 'S1', th: 'ราชดำริ', en: 'Ratchadamri', latitude: 13.73945, longitude: 100.53944 },
      { code: 'S2', th: 'ศาลาแดง', en: 'Sala Daeng', latitude: 13.72848, longitude: 100.53411 },
      { code: 'S3', th: 'ช่องนนทรี', en: 'Chong Nonsi', latitude: 13.72373, longitude: 100.52943 },
      { code: 'S4', th: 'เซนต์หลุยส์', en: 'Saint Louis', latitude: 13.72091, longitude: 100.52692 },
      { code: 'S5', th: 'สุรศักดิ์', en: 'Surasak', latitude: 13.71923, longitude: 100.52153 },
      { code: 'S6', th: 'สะพานตากสิน', en: 'Saphan Taksin', latitude: 13.7188, longitude: 100.51409 },
      { code: 'S7', th: 'กรุงธนบุรี', en: 'Krung Thon Buri', latitude: 13.72085, longitude: 100.50272 },
      { code: 'S8', th: 'วงเวียนใหญ่', en: 'Wongwian Yai', latitude: 13.72079, longitude: 100.49362 },
      { code: 'S9', th: 'โพธิ์นิมิตร', en: 'Pho Nimit', latitude: 13.71916, longitude: 100.48584 },
      { code: 'S10', th: 'ตลาดพลู', en: 'Talat Phlu', latitude: 13.71459, longitude: 100.47745 },
      { code: 'S11', th: 'วุฒากาศ', en: 'Wutthakat', latitude: 13.71307, longitude: 100.46884 },
      { code: 'S12', th: 'บางหว้า', en: 'Bang Wa', latitude: 13.72038, longitude: 100.45718 },
    ],
  },
  {
    code: 'bts_gold',
    system: 'BTS',
    stations: [
      { code: 'G1', th: 'กรุงธนบุรี', en: 'Krung Thon Buri', latitude: 13.72085, longitude: 100.50272 },
      { code: 'G2', th: 'เจริญนคร', en: 'Charoen Nakhon', latitude: 13.72648, longitude: 100.50903 },
      { code: 'G3', th: 'คลองสาน', en: 'Khlong San', latitude: 13.73038, longitude: 100.50765 },
    ],
  },
  {
    code: 'mrt_blue',
    system: 'MRT',
    stations: [
      { code: 'BL01', th: 'ท่าพระ', en: 'Tha Phra', latitude: 13.72965, longitude: 100.47416 },
      { code: 'BL02', th: 'จรัญฯ 13', en: 'Charan 13', latitude: 13.73961, longitude: 100.47077 },
      { code: 'BL03', th: 'ไฟฉาย', en: 'Fai Chai', latitude: 13.75508, longitude: 100.46923 },
      { code: 'BL04', th: 'บางขุนนนท์', en: 'Bang Khun Non', latitude: 13.76319, longitude: 100.47321 },
      { code: 'BL05', th: 'บางยี่ขัน', en: 'Bang Yi Khan', latitude: 13.77744, longitude: 100.48524 },
      { code: 'BL06', th: 'สิรินธร', en: 'Sirindhorn', latitude: 13.78401, longitude: 100.49349 },
      { code: 'BL07', th: 'บางพลัด', en: 'Bang Phlat', latitude: 13.79243, longitude: 100.50503 },
      { code: 'BL08', th: 'บางอ้อ', en: 'Bang O', latitude: 13.7989, longitude: 100.50968 },
      { code: 'BL09', th: 'บางโพ', en: 'Bang Pho', latitude: 13.80639, longitude: 100.52104 },
      { code: 'BL10', th: 'เตาปูน', en: 'Tao Poon', latitude: 13.80613, longitude: 100.53076 },
      { code: 'BL11', th: 'บางซื่อ', en: 'Bang Sue', latitude: 13.80307, longitude: 100.53919 },
      { code: 'BL12', th: 'กำแพงเพชร', en: 'Kamphaeng Phet', latitude: 13.79806, longitude: 100.54759 },
      { code: 'BL13', th: 'สวนจตุจักร', en: 'Chatuchak Park', latitude: 13.80246, longitude: 100.55374 },
      { code: 'BL14', th: 'พหลโยธิน', en: 'Phahon Yothin', latitude: 13.81424, longitude: 100.56015 },
      { code: 'BL15', th: 'ลาดพร้าว', en: 'Lat Phrao', latitude: 13.8061, longitude: 100.57365 },
      { code: 'BL16', th: 'รัชดาภิเษก', en: 'Ratchadaphisek', latitude: 13.79915, longitude: 100.57461 },
      { code: 'BL17', th: 'สุทธิสาร', en: 'Sutthisan', latitude: 13.78985, longitude: 100.57418 },
      { code: 'BL18', th: 'ห้วยขวาง', en: 'Huai Khwang', latitude: 13.77851, longitude: 100.57365 },
      { code: 'BL19', th: 'ศูนย์วัฒนธรรมแห่งประเทศไทย', en: 'Thailand Cultural Centre', latitude: 13.7663, longitude: 100.57026 },
      { code: 'BL20', th: 'พระราม 9', en: 'Phra Ram 9', latitude: 13.75792, longitude: 100.56557 },
      { code: 'BL21', th: 'เพชรบุรี', en: 'Phetchaburi', latitude: 13.74915, longitude: 100.56339 },
      { code: 'BL22', th: 'สุขุมวิท', en: 'Sukhumvit', latitude: 13.73853, longitude: 100.56145 },
      { code: 'BL23', th: 'ศูนย์การประชุมแห่งชาติสิริกิติ์', en: 'Queen Sirikit National Convention Centre', latitude: 13.72315, longitude: 100.5601 },
      { code: 'BL24', th: 'คลองเตย', en: 'Khlong Toei', latitude: 13.7223, longitude: 100.55391 },
      { code: 'BL25', th: 'ลุมพินี', en: 'Lumphini', latitude: 13.7254, longitude: 100.54606 },
      { code: 'BL26', th: 'สีลม', en: 'Si Lom', latitude: 13.72936, longitude: 100.53788 },
      { code: 'BL27', th: 'สามย่าน', en: 'Sam Yan', latitude: 13.73235, longitude: 100.52999 },
      { code: 'BL28', th: 'หัวลำโพง', en: 'Hua Lamphong', latitude: 13.73785, longitude: 100.51717 },
      { code: 'BL29', th: 'วัดมังกร', en: 'Wat Mangkon', latitude: 13.74204, longitude: 100.51021 },
      { code: 'BL30', th: 'สามยอด', en: 'Sam Yot', latitude: 13.74709, longitude: 100.50171 },
      { code: 'BL31', th: 'สนามไชย', en: 'Sanam Chai', latitude: 13.74386, longitude: 100.49466 },
      { code: 'BL32', th: 'อิสรภาพ', en: 'Itsaraphap', latitude: 13.73832, longitude: 100.48529 },
      { code: 'BL33', th: 'บางไผ่', en: 'Bang Phai', latitude: 13.72461, longitude: 100.46521 },
      { code: 'BL34', th: 'บางหว้า', en: 'Bang Wa', latitude: 13.72038, longitude: 100.45718 },
      { code: 'BL35', th: 'เพชรเกษม 48', en: 'Phetkasem 48', latitude: 13.71552, longitude: 100.44561 },
      { code: 'BL36', th: 'ภาษีเจริญ', en: 'Phasi Charoen', latitude: 13.71288, longitude: 100.43418 },
      { code: 'BL37', th: 'บางแค', en: 'Bang Khae', latitude: 13.71194, longitude: 100.4224 },
      { code: 'BL38', th: 'หลักสอง', en: 'Lak Song', latitude: 13.71096, longitude: 100.41002 },
    ],
  },
  {
    code: 'mrt_purple',
    system: 'MRT',
    stations: [
      { code: 'PP01', th: 'คลองบางไผ่', en: 'Khlong Bang Phai', latitude: 13.89235, longitude: 100.40826 },
      { code: 'PP02', th: 'ตลาดบางใหญ่', en: 'Talad Bang Yai', latitude: 13.88098, longitude: 100.40922 },
      { code: 'PP03', th: 'สามแยกบางใหญ่', en: 'Sam Yaek Bang Yai', latitude: 13.87463, longitude: 100.41943 },
      { code: 'PP04', th: 'บางพลู', en: 'Bang Phlu', latitude: 13.87572, longitude: 100.43391 },
      { code: 'PP05', th: 'บางรักใหญ่', en: 'Bang Rak Yai', latitude: 13.87666, longitude: 100.44491 },
      { code: 'PP06', th: 'บางรักน้อยท่าอิฐ', en: 'Bang Rak Noi Tha It', latitude: 13.87467, longitude: 100.45621 },
      { code: 'PP07', th: 'ไทรม้า', en: 'Sai Ma', latitude: 13.87053, longitude: 100.46664 },
      { code: 'PP08', th: 'สะพานพระนั่งเกล้า', en: 'Phra Nang Klao Bridge', latitude: 13.87031, longitude: 100.48036 },
      { code: 'PP09', th: 'แยกนนทบุรี 1', en: 'Yaek Nonthaburi 1', latitude: 13.86592, longitude: 100.49425 },
      { code: 'PP10', th: 'บางกระสอ', en: 'Bang Krasor', latitude: 13.86169, longitude: 100.50443 },
      { code: 'PP11', th: 'ศูนย์ราชการนนทบุรี', en: 'Nonthaburi Civic Center', latitude: 13.86015, longitude: 100.51324 },
      { code: 'PP12', th: 'กระทรวงสาธารณสุข', en: 'Ministry of Public Health', latitude: 13.84869, longitude: 100.5147 },
      { code: 'PP13', th: 'แยกติวานนท์', en: 'Yaek Tiwanon', latitude: 13.83965, longitude: 100.51484 },
      { code: 'PP14', th: 'วงศ์สว่าง', en: 'Wong Sawang', latitude: 13.82986, longitude: 100.5265 },
      { code: 'PP15', th: 'บางซ่อน', en: 'Bang Son', latitude: 13.82204, longitude: 100.53421 },
      { code: 'PP16', th: 'เตาปูน', en: 'Tao Poon', latitude: 13.80613, longitude: 100.53076 },
    ],
  },
  {
    code: 'mrt_yellow',
    system: 'MRT',
    stations: [
      { code: 'YL01', th: 'ลาดพร้าว', en: 'Lat Phrao', latitude: 13.8061, longitude: 100.57365 },
      { code: 'YL02', th: 'ภาวนา', en: 'Phawana', latitude: 13.80012, longitude: 100.58424 },
      { code: 'YL03', th: 'โชคชัย 4', en: 'Chok Chai 4', latitude: 13.79444, longitude: 100.59436 },
      { code: 'YL04', th: 'ลาดพร้าว 71', en: 'Lat Phrao 71', latitude: 13.78731, longitude: 100.60712 },
      { code: 'YL05', th: 'ลาดพร้าว 83', en: 'Lat Phrao 83', latitude: 13.78366, longitude: 100.61371 },
      { code: 'YL06', th: 'มหาดไทย', en: 'Mahat Thai', latitude: 13.77833, longitude: 100.62321 },
      { code: 'YL07', th: 'ลาดพร้าว 101', en: 'Lat Phrao 101', latitude: 13.77461, longitude: 100.62991 },
      { code: 'YL08', th: 'บางกะปิ', en: 'Bang Kapi', latitude: 13.769, longitude: 100.63983 },
      { code: 'YL09', th: 'แยกลำสาลี', en: 'Yaek Lam Sali', latitude: 13.76167, longitude: 100.64553 },
      { code: 'YL10', th: 'ศรีกรีฑา', en: 'Si Kritha', latitude: 13.75075, longitude: 100.6449 },
      { code: 'YL11', th: 'หัวหมาก', en: 'Hua Mak', latitude: 13.73815, longitude: 100.64019 },
      { code: 'YL12', th: 'กลันตัน', en: 'Kalantan', latitude: 13.72562, longitude: 100.64175 },
      { code: 'YL13', th: 'ศรีนุช', en: 'Si Nut', latitude: 13.71108, longitude: 100.64416 },
      { code: 'YL14', th: 'ศรีนครินทร์ 38', en: 'Srinagarindra 38', latitude: 13.70061, longitude: 100.64658 },
      { code: 'YL15', th: 'สวนหลวง ร.9', en: 'Suan Luang Rama IX', latitude: 13.69073, longitude: 100.64709 },
      { code: 'YL16', th: 'ศรีอุดม', en: 'Si Udom', latitude: 13.67651, longitude: 100.64611 },
      { code: 'YL17', th: 'ศรีเอี่ยม', en: 'Si Iam', latitude: 13.66765, longitude: 100.64513 },
      { code: 'YL18', th: 'ศรีลาซาล', en: 'Si La Salle', latitude: 13.65499, longitude: 100.64209 },
      { code: 'YL19', th: 'ศรีแบริ่ง', en: 'Si Bearing', latitude: 13.64355, longitude: 100.63627 },
      { code: 'YL20', th: 'ศรีด่าน', en: 'Si Dan', latitude: 13.63321, longitude: 100.63006 },
      { code: 'YL21', th: 'ศรีเทพา', en: 'Si Thepha', latitude: 13.62995, longitude: 100.62265 },
      { code: 'YL22', th: 'ทิพวัล', en: 'Thipphawan', latitude: 13.63686, longitude: 100.60979 },
      { code: 'YL23', th: 'สำโรง', en: 'Samrong', latitude: 13.64619, longitude: 100.59565 },
    ],
  },
  {
    code: 'mrt_pink',
    system: 'MRT',
    stations: [
      { code: 'PK01', th: 'ศูนย์ราชการนนทบุรี', en: 'Nonthaburi Civic Center', latitude: 13.86015, longitude: 100.51324 },
      { code: 'PK02', th: 'แคราย', en: 'Khae Rai', latitude: 13.8625, longitude: 100.52077 },
      { code: 'PK03', th: 'สนามบินน้ำ', en: 'Sanambin Nam', latitude: 13.87418, longitude: 100.51632 },
      { code: 'PK04', th: 'สามัคคี', en: 'Samakkhi', latitude: 13.8892, longitude: 100.51065 },
      { code: 'PK05', th: 'กรมชลประทาน', en: 'Royal Irrigation Department', latitude: 13.89863, longitude: 100.50705 },
      { code: 'PK06', th: 'แยกปากเกร็ด', en: 'Yaek Pak Kret', latitude: 13.90644, longitude: 100.50539 },
      { code: 'PK07', th: 'เลี่ยงเมืองปากเกร็ด', en: 'Pak Kret Bypass', latitude: 13.90642, longitude: 100.51582 },
      { code: 'PK08', th: 'แจ้งวัฒนะ-ปากเกร็ด 28', en: 'Chaeng Watthana-Pak Kret 28', latitude: 13.9041, longitude: 100.52918 },
      { code: 'PK09', th: 'ศรีรัช', en: 'Si Rat', latitude: 13.90058, longitude: 100.53989 },
      { code: 'PK10', th: 'เมืองทองธานี', en: 'Muang Thong Thani', latitude: 13.89748, longitude: 100.54832 },
      { code: 'PK11', th: 'แจ้งวัฒนะ 14', en: 'Chaeng Watthana 14', latitude: 13.89316, longitude: 100.56037 },
      { code: 'PK12', th: 'ศูนย์ราชการเฉลิมพระเกียรติ', en: 'Government Complex', latitude: 13.89072, longitude: 100.56732 },
      { code: 'PK13', th: 'โทรคมนาคมแห่งชาติ', en: 'National Telecom', latitude: 13.88743, longitude: 100.57579 },
      { code: 'PK14', th: 'หลักสี่', en: 'Lak Si', latitude: 13.88623, longitude: 100.58186 },
      { code: 'PK15', th: 'ราชภัฏพระนคร', en: 'Rajabhat Phranakhon', latitude: 13.8798, longitude: 100.58952 },
      { code: 'PK16', th: 'วัดพระศรีมหาธาตุ', en: 'Wat Phra Sri Mahathat', latitude: 13.87448, longitude: 100.59724 },
      { code: 'PK17', th: 'รามอินทรา 3', en: 'Ram Inthra 3', latitude: 13.87082, longitude: 100.60286 },
      { code: 'PK18', th: 'ลาดปลาเค้า', en: 'Lat Pla Khao', latitude: 13.86278, longitude: 100.61778 },
      { code: 'PK19', th: 'รามอินทรา กม.4', en: 'Ram Inthra Kor Mor 4', latitude: 13.85829, longitude: 100.6261 },
      { code: 'PK20', th: 'มัยลาภ', en: 'Maiyalap', latitude: 13.85501, longitude: 100.6322 },
      { code: 'PK21', th: 'วัชรพล', en: 'Vatcharaphon', latitude: 13.84926, longitude: 100.64284 },
      { code: 'PK22', th: 'รามอินทรา กม.6', en: 'Ram Inthra Kor Mor 6', latitude: 13.8452, longitude: 100.65033 },
      { code: 'PK23', th: 'คู้บอน', en: 'Khu Bon', latitude: 13.84109, longitude: 100.65809 },
      { code: 'PK24', th: 'รามอินทรา กม.9', en: 'Ram Inthra Kor Mor 9', latitude: 13.83383, longitude: 100.66748 },
      { code: 'PK25', th: 'วงแหวนรามอินทรา', en: 'Outer Ring Road-Ram Inthra', latitude: 13.82464, longitude: 100.67704 },
      { code: 'PK26', th: 'นพรัตน์', en: 'Nopparat', latitude: 13.81657, longitude: 100.68555 },
      { code: 'PK27', th: 'บางชัน', en: 'Bang Chan', latitude: 13.81271, longitude: 100.70341 },
      { code: 'PK28', th: 'เศรษฐบุตรบำเพ็ญ', en: 'Setthabutbamphen', latitude: 13.8127, longitude: 100.71321 },
      { code: 'PK29', th: 'ตลาดมีนบุรี', en: 'Talat Min Buri', latitude: 13.81093, longitude: 100.729 },
      { code: 'PK30', th: 'มีนบุรี', en: 'Min Buri', latitude: 13.80842, longitude: 100.73259 },
      { code: 'MT01', th: 'อิมแพ็ค เมืองทองธานี', en: 'Impact Muang Thong Thani', latitude: 13.91041, longitude: 100.54427 },
      { code: 'MT02', th: 'ทะเลสาบเมืองทองธานี', en: 'Lake Muang Thong Thani', latitude: 13.91768, longitude: 100.54536 },
    ],
  },
  {
    code: 'arl',
    system: 'ARL',
    stations: [
      { code: 'A8', th: 'พญาไท', en: 'Phaya Thai', latitude: 13.75674, longitude: 100.53484 },
      { code: 'A7', th: 'ราชปรารภ', en: 'Ratchaprarop', latitude: 13.75502, longitude: 100.54212 },
      { code: 'A6', th: 'มักกะสัน', en: 'Makkasan', latitude: 13.75143, longitude: 100.56386 },
      { code: 'A5', th: 'รามคำแหง', en: 'Ramkhamhaeng', latitude: 13.74229, longitude: 100.60135 },
      { code: 'A4', th: 'หัวหมาก', en: 'Hua Mak', latitude: 13.7372, longitude: 100.64168 },
      { code: 'A3', th: 'บ้านทับช้าง', en: 'Ban Thap Chang', latitude: 13.73282, longitude: 100.6914 },
      { code: 'A2', th: 'ลาดกระบัง', en: 'Lat Krabang', latitude: 13.72768, longitude: 100.74859 },
      { code: 'A1', th: 'สุวรรณภูมิ', en: 'Suvarnabhumi', latitude: 13.69477, longitude: 100.75153 },
    ],
  },
  {
    code: 'srt_red_north',
    system: 'SRT',
    stations: [
      { code: 'RN01', th: 'กรุงเทพอภิวัฒน์', en: 'Krung Thep Aphiwat', latitude: 13.80369, longitude: 100.54227 },
      { code: 'RN02', th: 'จตุจักร', en: 'Chatuchak', latitude: 13.82652, longitude: 100.54941 },
      { code: 'RN03', th: 'วัดเสมียนนารี', en: 'Wat Samian Nari', latitude: 13.84166, longitude: 100.55753 },
      { code: 'RN04', th: 'บางเขน', en: 'Bang Khen', latitude: 13.84696, longitude: 100.56071 },
      { code: 'RN05', th: 'ทุ่งสองห้อง', en: 'Thung Song Hong', latitude: 13.86011, longitude: 100.56753 },
      { code: 'RN06', th: 'หลักสี่', en: 'Lak Si', latitude: 13.88623, longitude: 100.58186 },
      { code: 'RN07', th: 'การเคหะ', en: 'Kan Kheha', latitude: 13.8984, longitude: 100.58884 },
      { code: 'RN08', th: 'ดอนเมือง', en: 'Don Mueang', latitude: 13.91503, longitude: 100.59798 },
      { code: 'RN09', th: 'หลักหก', en: 'Lak Hok', latitude: 13.96584, longitude: 100.60533 },
      { code: 'RN10', th: 'รังสิต', en: 'Rangsit', latitude: 13.99052, longitude: 100.60226 },
    ],
  },
  {
    code: 'srt_red_west',
    system: 'SRT',
    stations: [
      { code: 'RW01', th: 'กรุงเทพอภิวัฒน์', en: 'Krung Thep Aphiwat', latitude: 13.80369, longitude: 100.54227 },
      { code: 'RW02', th: 'บางซ่อน', en: 'Bang Son', latitude: 13.82204, longitude: 100.53421 },
      { code: 'RW05', th: 'บางบำหรุ', en: 'Bang Bamru', latitude: 13.7917, longitude: 100.47766 },
      { code: 'RW06', th: 'ตลิ่งชัน', en: 'Taling Chan', latitude: 13.78933, longitude: 100.43996 },
    ],
  },
];

/** Name shown for a picked station: "BTS อโศก" in Thai, "BTS Asok" in the other languages (Mos 20 Nov 2026). */
export function railStationName(line: Pick<RailLine, 'system'>, station: Pick<RailStation, 'th' | 'en'>, locale: string): string {
  return `${line.system} ${locale === 'th' ? station.th : station.en}`;
}

/** Stations shown while typing in the location box (Mos 20 Nov 2026). */
export const RAIL_MATCH_LIMIT = 3;
/** Stations of two lines this close together are one interchange ("ต่อ MRT สุขุมวิท"). */
export const INTERCHANGE_METERS = 350;

export interface RailHit {
  line: RailLine;
  station: RailStation;
}

/** Lower case without spaces and punctuation, so "Thong Lo" finds "thong lo" and "พระราม9" finds "พระราม 9". */
function fold(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/[\s\-–—·.,ฯ()'’]/g, '');
}

/** "BTS อโศก", "สถานีอโศก", "MRT station Asok" → the name part. */
function bareQuery(query: string): string {
  return fold(query.replace(/\b(BTS|MRT|ARL|SRT|station)\b/gi, '').replace(/สถานี|รถไฟฟ้า/g, ''));
}

/** Stations whose Thai or English name matches; a name that starts with the text first; a shared station once. */
export function matchRailStations(query: string, limit: number = RAIL_MATCH_LIMIT): RailHit[] {
  const needle = bareQuery(query);
  if (needle.length < 2) return [];
  const ranked: { hit: RailHit; rank: number; order: number }[] = [];
  let order = 0;
  for (const line of RAIL_LINES) {
    for (const station of line.stations) {
      const names = [fold(station.th), fold(station.en)];
      const rank = names.some((name) => name === needle) ? 0 : names.some((name) => name.startsWith(needle)) ? 1 : names.some((name) => name.includes(needle)) ? 2 : -1;
      if (rank >= 0) ranked.push({ hit: { line, station }, rank, order: order++ });
    }
  }
  ranked.sort((a, b) => a.rank - b.rank || a.order - b.order);
  const seen = new Set<string>();
  const out: RailHit[] = [];
  for (const { hit } of ranked) {
    const key = `${hit.line.system}:${hit.station.th}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}

function meters(a: Pick<RailStation, 'latitude' | 'longitude'>, b: Pick<RailStation, 'latitude' | 'longitude'>): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** Stations of other lines next to this one (an interchange), nearest first. */
export function railInterchanges(line: Pick<RailLine, 'code'>, station: RailStation): RailHit[] {
  const out: { hit: RailHit; distance: number }[] = [];
  for (const other of RAIL_LINES) {
    if (other.code === line.code) continue;
    let best: { station: RailStation; distance: number } | null = null;
    for (const candidate of other.stations) {
      const distance = meters(station, candidate);
      if (distance <= INTERCHANGE_METERS && (!best || distance < best.distance)) best = { station: candidate, distance };
    }
    if (best) out.push({ hit: { line: other, station: best.station }, distance: best.distance });
  }
  return out.sort((a, b) => a.distance - b.distance).map((item) => item.hit);
}

/** Colour of each line on its own maps. */
const LINE_COLORS: Record<RailLineCode, string> = {
  bts_sukhumvit: '#7ab51d',
  bts_silom: '#00665e',
  bts_gold: '#c9a227',
  mrt_blue: '#1e4a9e',
  mrt_purple: '#6a3d9a',
  mrt_yellow: '#f2c500',
  mrt_pink: '#e5568d',
  arl: '#8b1e2d',
  srt_red_north: '#a3161c',
  // A shade deeper than the map's light red, so white text on the badge reads (4.5:1).
  srt_red_west: '#d12e35',
};
const INK = '#211e1e';
const WHITE = '#ffffff';

function rgb(hex: string): [number, number, number] {
  const value = parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function mix(a: string, b: string, weight: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return toHex([0, 1, 2].map((i) => x[i] * (1 - weight) + y[i] * weight) as [number, number, number]);
}

export interface RailLinePalette {
  /** The line colour (station code badge). */
  color: string;
  /** Text on the badge: ink or white, whichever reads better. */
  ink: string;
  /** Soft tile behind a station icon. */
  tint: string;
  /** Icon on the tint. */
  deep: string;
}

/** Colours of a line for the station badge and icon tile (Mos 20 Nov 2026). */
export function railLinePalette(code: RailLineCode): RailLinePalette {
  const color = LINE_COLORS[code];
  const ink = contrastRatio(INK, color) >= contrastRatio(WHITE, color) ? INK : WHITE;
  const tint = mix(color, WHITE, 0.86);
  // Darken until the icon reads on the tint.
  let deep = mix(color, INK, 0.3);
  for (let step = 0.4; contrastRatio(deep, tint) < 3 && step <= 0.9; step += 0.1) deep = mix(color, INK, step);
  return { color, ink, tint, deep };
}
