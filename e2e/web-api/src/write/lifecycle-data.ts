import type { UploadPart } from '../api/lifecycle-write.api';
import { E2E_PREFIX } from './qa-dataset';

/**
 * ข้อมูลคงที่และตัวช่วยของเทสวงจรเช่าห้อง (tests/write/rental-lifecycle.write.spec.ts)
 * ค่าทุกค่าในไฟล์นี้ไม่ใช่ข้อมูลของคนจริง และทุกข้อความที่เทสเขียนลงระบบขึ้นต้นด้วยป้ายของรอบ
 */

/** ป้ายของรอบ เช่น E2E-LC-20261102-101500 ใส่ในชื่อห้อง ลีด ผู้เช่า และหมายเหตุทุกช่องที่เทสเขียน */
export function lifecycleLabel(runId: string): string {
  return `${E2E_PREFIX}LC-${runId}`;
}

/** เขตเวลาที่ API ใช้ตัดวัน (bangkokToday ใน apps/api/src/billing/rent-schedule.ts บรรทัด 30-37 ที่ develop bc77a8b) */
const ZONE = 'Asia/Bangkok';

/** วันที่แบบ YYYY-MM-DD ตามเวลากรุงเทพ ของวันนี้บวก offsetDays วัน */
export function bangkokDate(offsetDays = 0, now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + offsetDays * 86_400_000);
  // en-CA จัดรูปแบบวันที่เป็น YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(shifted);
}

/**
 * ช่วงเวลากรุงเทพที่ไม่ควรเริ่มรัน: 23:50 ถึง 00:10
 *   เทสอ่านวันนี้ครั้งเดียวตอนเริ่ม ถ้ารันคร่อมเที่ยงคืน ขั้นแจ้งย้ายออกจะส่งวันของเมื่อวาน API รับวันในอดีตและปิดสัญญาทันที
 *   (setEarlyEnd ใน agent-contracts.service.ts บรรทัด 2216-2226) และงานตั้งเวลา 00:05 (tenant-billing.scheduler.ts) อาจปิดสัญญาระหว่างรัน
 * คืนข้อความเหตุผลเมื่ออยู่ในช่วงนี้ ไม่อยู่ = null
 */
export function nearMidnightReason(now: Date = new Date()): string | null {
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  return clock >= '23:50' || clock < '00:10' ? `เวลากรุงเทพ ${clock} อยู่ในช่วง 23:50 ถึง 00:10 ที่วันเปลี่ยนระหว่างรัน ให้รันใหม่หลัง 00:10` : null;
}

/**
 * วันเริ่มสัญญาย้อนหลัง 1 เดือน เพื่อให้บิลค่าเช่าของเดือนนี้ถึงรอบตอนรัน
 *   วันที่ของเดือนก่อนตัดที่ 28 (ทุกเดือนมีวันที่ 28) และวันครบกำหนดชำระ (rentDueDay) = วันเดียวกัน
 *   ถ้าวันนี้คือวันที่ 29 ถึง 31 วันเริ่มจะเป็นวันที่ 28 ของเดือนก่อน บิลของเดือนนี้จึงเลยกำหนดไปแล้ว 1 ถึง 3 วัน
 */
export function oneMonthBack(now: Date = new Date()): { startDate: string; rentDueDay: number } {
  const [year, month, day] = bangkokDate(0, now).split('-').map(Number);
  const dueDay = Math.min(day, 28);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const two = (value: number) => String(value).padStart(2, '0');
  return { startDate: `${previousYear}-${two(previousMonth)}-${two(dueDay)}`, rentDueDay: dueDay };
}

/**
 * เลขบัตรประชาชนของผู้เช่าในเทส: ผ่านการตรวจหลักสุดท้าย (API ตรวจเมื่อสัญชาติไทย: identityNumberProblem ใน
 * apps/api/src/common/identity-number.ts บรรทัด 32-38) และไม่ใช่ของคนจริงที่รู้จัก
 * ใช้เลขเดิมทุกรอบ เพื่อไม่สร้างเลขใหม่ไปเรื่อย ๆ
 */
export const TEST_THAI_ID = '1101700203450';

/** ตรวจหลักสุดท้ายของเลขบัตรประชาชน 13 หลัก (ผลรวมถ่วงน้ำหนัก 13 ถึง 2 แล้ว (11 - ผลรวม mod 11) mod 10) */
export function isValidThaiId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  const digits = id.split('').map(Number);
  const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (13 - index), 0);
  return (11 - (sum % 11)) % 10 === digits[12];
}

/**
 * เบอร์โทรของข้อมูลเทส: ไม่ใช่เบอร์ของคนจริง
 * ตั้งใจไม่ใช้ 0000000000 ของลีดถาวร (qa-dataset.ts) เพราะ findOrCreateQaLead หยุดแทนการสร้างลีดถาวร
 * เมื่อเจอลีดอื่นที่ใช้เบอร์นั้น ถ้าเทสนี้รันก่อนบนฐานข้อมูลใหม่ เทสลีดจะหยุดทุกรอบ
 */
export const TEST_PHONE = '0000000001';

/** ค่าเงินของดีล: ค่าเช่า 15,000 บาท สัญญา 12 เดือน มัดจำ 2 เดือน */
export const DEAL = { monthlyRent: 15_000, termMonths: 12, depositAmount: 30_000 } as const;

/** ค่าหักมัดจำของเทส: 1,000 บาท คืนผู้เช่า 29,000 บาท */
export const DEDUCTION = 1_000;

/** PNG ขนาด 1x1 จุดที่ถอดรหัสได้จริง (ใช้เป็นสลิป รูปห้อง และลายเซ็น) */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** ลายเซ็นแบบที่แอปส่ง: PNG เป็น data URL */
export const SIGNATURE = `data:image/png;base64,${PNG.toString('base64')}`;

/** PDF 1 หน้าที่เล็กที่สุดที่ถูกรูปแบบ (ใช้เป็นเอกสารแนบ) */
export const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj ' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

/** ไฟล์รูปสำหรับอัปโหลด ชื่อไฟล์ขึ้นต้นด้วยป้ายของรอบ */
export function png(label: string, name: string): UploadPart {
  return { name: `${label}-${name}.png`, mimeType: 'image/png', buffer: PNG };
}

/** ไฟล์ PDF สำหรับอัปโหลด ชื่อไฟล์ขึ้นต้นด้วยป้ายของรอบ */
export function pdf(label: string, name: string): UploadPart {
  return { name: `${label}-${name}.pdf`, mimeType: 'application/pdf', buffer: PDF };
}
