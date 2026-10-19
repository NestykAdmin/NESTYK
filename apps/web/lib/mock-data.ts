import { UserRole } from '@nestyk/types';

export const MOCK_USER = {
  name: 'Jane Doe',
  initials: 'JD',
  email: 'jane.doe@email.com',
  roleLabel: 'ผู้ค้นหาห้อง',
};

export const MOCK_NAV_LINKS = [
  { label: 'ค้นหาห้อง', href: '/', active: true },
  { label: 'ศูนย์บริการ', href: '/services' },
  { label: 'สำหรับเจ้าของห้อง', href: '/owner' },
  { label: 'สำหรับนายหน้า', href: '/agent' },
] as const;

export interface MockListing {
  id: string;
  title: string;
  roomType: string;
  price: string;
  tag: string;
  role: UserRole;
  desc: string;
}

export const MOCK_LISTINGS: MockListing[] = [
  {
    id: '1',
    title: 'The Base Sukhumvit 77 (ใกล้ BTS อ่อนนุช)',
    roomType: '1 ห้องนอน • 32 ตร.ม. • ชั้น 18',
    price: '14,500',
    tag: 'พร้อมเข้าอยู่',
    role: 'guest',
    desc: 'เฟอร์นิเจอร์ครบ เครื่องใช้ไฟฟ้าพร้อม วิวสระว่ายน้ำ ทิศเหนือไม่ร้อน',
  },
  {
    id: '2',
    title: 'Ideo Mobi Sukhumvit Eastpoint (ติด BTS บางนา)',
    roomType: 'Studio Duplex • 29 ตร.ม. • ชั้น 12',
    price: '13,000',
    tag: 'Co-broke 3%',
    role: 'agent',
    desc: 'ห้องเพดานสูง 4.5 เมตร วิวพาโนรามา สวนลอยฟ้า สระว่ายน้ำ 2 ชั้น',
  },
  {
    id: '3',
    title: 'Ashton Asoke (ติด MRT สุขุมวิท / BTS อโศก)',
    roomType: '2 ห้องนอน • 65 ตร.ม. • ชั้น 35',
    price: '45,000',
    tag: 'วิวพาโนรามา',
    role: 'landlord',
    desc: 'คอนโดหรูระดับ Luxury ใจกลางอโศก สภาพใหม่มาก ไม่เคยปล่อยเช่า',
  },
  {
    id: '4',
    title: 'Whizdom Connect Sukhumvit (ใกล้ BTS ปุณณวิถี)',
    roomType: '1 ห้องนอน • 28 ตร.ม. • ชั้น 22',
    price: '12,000',
    tag: 'ราคาพิเศษ',
    role: 'guest',
    desc: 'ติดห้าง True Digital Park สะดวกสบาย ร้านอาหารและ Community Mall',
  },
];

export interface MockNotification {
  id: string;
  text: string;
  time: string;
  unread: boolean;
}

export const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: '1',
    text: 'สมชาย ใจดี ยืนยันนัดดูห้อง The Base Sukhumvit 77 แล้ว',
    time: '7 ก.ย. 11:20',
    unread: true,
  },
  {
    id: '2',
    text: 'บิลค่าเช่า ก.ย. 2569 ครบกำหนดชำระใน 3 วัน',
    time: '6 ก.ย. 18:45',
    unread: true,
  },
  {
    id: '3',
    text: 'ช่างอัปเดตสถานะงานแจ้งซ่อมแอร์เป็น กำลังดำเนินการ',
    time: 'เมื่อวาน 09:10',
    unread: true,
  },
  {
    id: '4',
    text: 'สัญญาเช่าห้อง 1804 ลงนามเรียบร้อยแล้ว',
    time: '5 ก.ย. 14:00',
    unread: false,
  },
];

export const MOCK_HERO = {
  badge: '✨ แพลตฟอร์มหาห้องเช่าและบริการที่พักครบวงจร',
  title: 'ค้นหาห้องเช่า คอนโดใกล้ BTS / MRT',
  subtitle:
    'ดูห้องจริง นัดชมล่วงหน้า และเปิดใช้งานในแอป NESTYK เพื่อติดตามสัญญาและบิลค่าเช่า',
  searchPlaceholder: 'พิมพ์ทำเล สถานี BTS/MRT หรือชื่อโครงการ...',
  searchButton: 'ค้นหา',
};

export const MOCK_FEATURED = {
  title: 'ห้องแนะนำ',
  subtitle: 'อัปเดตล่าสุด พร้อมนัดดูห้องจริง',
  viewAll: 'ดูทั้งหมด',
  scheduleViewing: 'นัดดูห้อง',
  viewDetails: 'ดูรายละเอียด',
};
