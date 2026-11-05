import { expect, type Page, type Request } from '@playwright/test';

/**
 * ตัวช่วยรอแบบมีเงื่อนไข (กฎกลาง ง.10 ห้ามรอแบบตายตัว)
 */

/**
 * เริ่มเฝ้าคำขอที่ตรงเงื่อนไข ได้ true ถ้าเห็นภายใน timeoutMs ไม่อย่างนั้นได้ false
 * ต้องเรียกก่อนสั่งการที่ทำให้เกิดคำขอ แล้ว await ทีหลัง
 * ใช้กับการตรวจว่า "ไม่มีคำขอ" ซึ่งต้องมีช่วงเฝ้าเสมอ: ถ้าแอปส่งคำขอ ผลจะออกทันที ถ้าไม่ส่ง จะรอจนครบเวลา
 * คำขอที่ตัวกันตัด (guard.ts) ยังขึ้นเป็นเหตุการณ์ request ก่อนถูกตัด
 */
export function watchForRequest(page: Page, matches: (request: Request) => boolean, timeoutMs: number): Promise<boolean> {
  return page.waitForRequest(matches, { timeout: timeoutMs }).then(
    () => true,
    () => false,
  );
}

/**
 * รอจนค่าที่อ่านได้ไม่เปลี่ยนอย่างน้อย quietMs แล้วคืนค่านั้น
 * ใช้เมื่อหน้าอาจแสดงสถานะชั่วคราวก่อนสถานะจริง เช่น ชื่อ workspace ของบทบาทที่จำไว้ ก่อนแอปเปลี่ยนตาม URL
 * (applyRoute ทำงานใน effect หลังวาดหน้าครั้งแรก: apps/consumer-app/app/index.tsx:648-670)
 * quietMs 2 วินาทีเป็นค่าที่เลือกเอง ไม่มีที่มาจากโค้ด: การเปลี่ยนบทบาทตาม URL เกิดใน effect ถัดจากการวาดครั้งแรก
 *   ซึ่งใช้เวลาไม่ถึง 1 วินาที ถ้าหน้าค้างค่าชั่วคราวนานกว่า 2 วินาที (เช่น รอคำตอบจาก staging) ค่าที่ได้อาจเป็นค่าชั่วคราว
 *   ข้อที่ใช้ตัวช่วยนี้เป็น known-bug ที่ตรวจว่า "ไม่ใช่" บทบาทหนึ่ง ถ้าได้ค่าชั่วคราว ผลจะแดงว่า "Expected to fail, but passed" ให้เห็น ไม่ใช่เขียวผิด
 */
export async function waitForStableValue(read: () => Promise<string>, quietMs = 2_000, timeoutMs = 20_000): Promise<string> {
  let last: string | null = null;
  let since = Date.now();
  await expect
    .poll(
      async () => {
        const now = await read().catch(() => '');
        if (now !== last) {
          last = now;
          since = Date.now();
        }
        return Date.now() - since >= quietMs;
      },
      { timeout: timeoutMs, intervals: [250] },
    )
    .toBe(true);
  return last ?? '';
}
