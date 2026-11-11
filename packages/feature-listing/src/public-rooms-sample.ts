import type { PublicRoomDetail } from '@nestyk/types';

/**
 * Sample rooms for the guest pages while the real public API is not connected.
 * Development and demo only: `createPublicRoomsSource` refuses the sample source in production.
 * Fields are the public whitelist only — no owner, unit number or contact. No photos are bundled,
 * so `coverImageUrl` is null and the UI shows its placeholder.
 */
export const SAMPLE_PUBLIC_ROOMS: PublicRoomDetail[] = [
  {
    id: 'sample-asok-01', title: 'คอนโดใกล้ BTS อโศก ชั้นสูง วิวเมือง', propertyType: 'condo', projectName: 'Sample Residence Asok',
    district: 'อโศก', priceFrom: 24000, bedrooms: 1, bathrooms: 1, areaSqm: 35, coverImageUrl: null,
    latitude: 13.7368, longitude: 100.5602, nearestStation: { type: 'BTS', name: 'อโศก', distanceMeters: 250 },
    availableFrom: null, petFriendly: false, shortTermAvailable: true, isNew: false,
    description: 'ห้องตัวอย่างสำหรับทดสอบหน้าจอ ไม่ใช่ห้องจริง', imageUrls: [], amenityCodes: ['pool', 'gym', 'security'],
    priceOptions: [
      { durationMonths: 12, pricePerMonth: 24000, depositAmount: 48000 },
      { durationMonths: 6, pricePerMonth: 26000, depositAmount: 52000 },
      { durationMonths: 3, pricePerMonth: 28000, depositAmount: 56000 },
    ],
    floor: 24,
  },
  {
    id: 'sample-asok-02', title: 'สตูดิโอ เดินถึง MRT สุขุมวิท', propertyType: 'condo', projectName: 'Sample Studio Sukhumvit',
    district: 'อโศก', priceFrom: 15000, bedrooms: 0, bathrooms: 1, areaSqm: 26, coverImageUrl: null,
    latitude: 13.7380, longitude: 100.5605, nearestStation: { type: 'MRT', name: 'สุขุมวิท', distanceMeters: 400 },
    availableFrom: '2026-12-01', petFriendly: false, shortTermAvailable: false, isNew: false,
    description: 'ห้องตัวอย่างสำหรับทดสอบหน้าจอ ไม่ใช่ห้องจริง', imageUrls: [], amenityCodes: ['gym', 'laundry'],
    priceOptions: [{ durationMonths: 12, pricePerMonth: 15000, depositAmount: 30000 }],
    floor: 9,
  },
  {
    id: 'sample-ari-01', title: 'คอนโดอารีย์ สัตว์เลี้ยงได้', propertyType: 'condo', projectName: 'Sample Ari Garden',
    district: 'อารีย์', priceFrom: 18000, bedrooms: 1, bathrooms: 1, areaSqm: 32, coverImageUrl: null,
    latitude: 13.7794, longitude: 100.5446, nearestStation: { type: 'BTS', name: 'อารีย์', distanceMeters: 300 },
    availableFrom: null, petFriendly: true, shortTermAvailable: false, isNew: false,
    description: 'ห้องตัวอย่างสำหรับทดสอบหน้าจอ ไม่ใช่ห้องจริง', imageUrls: [], amenityCodes: ['pet', 'garden'],
    priceOptions: [{ durationMonths: 12, pricePerMonth: 18000, depositAmount: 36000 }],
    floor: 6,
  },
  {
    id: 'sample-ari-02', title: 'คอนโด 2 ห้องนอน ใกล้ BTS อารีย์', propertyType: 'condo', projectName: 'Sample Ari Twin',
    district: 'อารีย์', priceFrom: 32000, bedrooms: 2, bathrooms: 2, areaSqm: 62, coverImageUrl: null,
    latitude: 13.7805, longitude: 100.5440, nearestStation: { type: 'BTS', name: 'อารีย์', distanceMeters: 650 },
    availableFrom: '2026-11-25', petFriendly: true, shortTermAvailable: true, isNew: false,
    description: 'ห้องตัวอย่างสำหรับทดสอบหน้าจอ ไม่ใช่ห้องจริง', imageUrls: [], amenityCodes: ['pool', 'parking', 'pet'],
    priceOptions: [
      { durationMonths: 12, pricePerMonth: 32000, depositAmount: 64000 },
      { durationMonths: 6, pricePerMonth: 34000, depositAmount: 68000 },
    ],
    floor: 15,
  },
  {
    id: 'sample-latphrao-01', title: 'คอนโดลาดพร้าว ติด MRT', propertyType: 'condo', projectName: 'Sample Lat Phrao Place',
    district: 'ลาดพร้าว', priceFrom: 11000, bedrooms: 1, bathrooms: 1, areaSqm: 28, coverImageUrl: null,
    latitude: 13.8061, longitude: 100.5731, nearestStation: { type: 'MRT', name: 'ลาดพร้าว', distanceMeters: 150 },
    availableFrom: null, petFriendly: false, shortTermAvailable: true, isNew: false,
    description: 'ห้องตัวอย่างสำหรับทดสอบหน้าจอ ไม่ใช่ห้องจริง', imageUrls: [], amenityCodes: ['security', 'laundry'],
    priceOptions: [
      { durationMonths: 12, pricePerMonth: 11000, depositAmount: 22000 },
      { durationMonths: 3, pricePerMonth: 13000, depositAmount: 26000 },
    ],
    floor: 12,
  },
  {
    id: 'sample-latphrao-02', title: 'อพาร์ตเมนต์ลาดพร้าว 71 เดินทางสะดวก', propertyType: 'apartment', projectName: null,
    district: 'ลาดพร้าว', priceFrom: 7500, bedrooms: 0, bathrooms: 1, areaSqm: 22, coverImageUrl: null,
    latitude: 13.8000, longitude: 100.6000, nearestStation: null,
    availableFrom: null, petFriendly: false, shortTermAvailable: true, isNew: false,
    description: 'ห้องตัวอย่างสำหรับทดสอบหน้าจอ ไม่ใช่ห้องจริง', imageUrls: [], amenityCodes: ['security'],
    priceOptions: [{ durationMonths: 6, pricePerMonth: 7500, depositAmount: 15000 }],
    floor: 3,
  },
  {
    id: 'sample-thonglor-01', title: 'คอนโดทองหล่อ ห้องใหญ่ 2 ห้องนอน', propertyType: 'condo', projectName: 'Sample Thonglor Grand',
    district: 'ทองหล่อ', priceFrom: 55000, bedrooms: 2, bathrooms: 2, areaSqm: 80, coverImageUrl: null,
    latitude: 13.7311, longitude: 100.5810, nearestStation: { type: 'BTS', name: 'ทองหล่อ', distanceMeters: 500 },
    availableFrom: null, petFriendly: false, shortTermAvailable: false, isNew: false,
    description: 'ห้องตัวอย่างสำหรับทดสอบหน้าจอ ไม่ใช่ห้องจริง', imageUrls: [], amenityCodes: ['pool', 'gym', 'parking', 'security'],
    priceOptions: [{ durationMonths: 12, pricePerMonth: 55000, depositAmount: 110000 }],
    floor: 30,
  },
  {
    id: 'sample-onnut-01', title: 'ทาวน์โฮม อ่อนนุช สัตว์เลี้ยงได้', propertyType: 'townhome', projectName: null,
    district: 'อ่อนนุช', priceFrom: 28000, bedrooms: 3, bathrooms: 3, areaSqm: 140, coverImageUrl: null,
    latitude: 13.7056, longitude: 100.6012, nearestStation: { type: 'BTS', name: 'อ่อนนุช', distanceMeters: 1200 },
    availableFrom: '2027-01-05', petFriendly: true, shortTermAvailable: false, isNew: false,
    description: 'ห้องตัวอย่างสำหรับทดสอบหน้าจอ ไม่ใช่ห้องจริง', imageUrls: [], amenityCodes: ['parking', 'pet'],
    priceOptions: [{ durationMonths: 12, pricePerMonth: 28000, depositAmount: 56000 }],
    floor: null,
  },
  {
    id: 'sample-onnut-02', title: 'คอนโดอ่อนนุช ราคาเริ่มต้นประหยัด', propertyType: 'condo', projectName: 'Sample On Nut Stay',
    district: 'อ่อนนุช', priceFrom: 9000, bedrooms: 1, bathrooms: 1, areaSqm: 27, coverImageUrl: null,
    latitude: 13.7060, longitude: 100.6008, nearestStation: { type: 'BTS', name: 'อ่อนนุช', distanceMeters: 700 },
    availableFrom: null, petFriendly: false, shortTermAvailable: true, isNew: false,
    description: 'ห้องตัวอย่างสำหรับทดสอบหน้าจอ ไม่ใช่ห้องจริง', imageUrls: [], amenityCodes: ['gym', 'security'],
    priceOptions: [
      { durationMonths: 12, pricePerMonth: 9000, depositAmount: 18000 },
      { durationMonths: 1, pricePerMonth: 12000, depositAmount: 12000 },
    ],
    floor: 8,
  },
  {
    id: 'sample-bangna-01', title: 'บ้านเดี่ยว บางนา มีที่จอดรถ 2 คัน', propertyType: 'house', projectName: null,
    district: 'บางนา', priceFrom: 45000, bedrooms: 4, bathrooms: 3, areaSqm: 220, coverImageUrl: null,
    latitude: 13.6685, longitude: 100.6040, nearestStation: null,
    availableFrom: null, petFriendly: true, shortTermAvailable: false, isNew: false,
    description: 'ห้องตัวอย่างสำหรับทดสอบหน้าจอ ไม่ใช่ห้องจริง', imageUrls: [], amenityCodes: ['parking', 'garden', 'pet'],
    priceOptions: [{ durationMonths: 12, pricePerMonth: 45000, depositAmount: 90000 }],
    floor: null,
  },
];
