/**
 * การรอค่าบนหน้าจอให้เป็นค่าที่คาด
 *
 * หน้าจอบางส่วนเปลี่ยนช้ากว่าคำสั่งที่เพิ่งทำ เช่น แผ่นเลือกภาษาที่กำลังเลื่อนขึ้น เทสจึงต้องให้เวลา แต่ห้ามรอแบบตายตัว
 * readUntil อ่านค่าซ้ำจนได้ค่าที่คาดหรือหมดเวลา แล้วคืนค่าล่าสุดที่อ่านได้ โดยไม่ตัดสินผล
 * การตัดสินผ่านหรือไม่ผ่านยังอยู่ที่ expect ในไฟล์เทส เมื่อไม่ผ่านจึงเห็นทั้งค่าที่ได้และค่าที่คาด
 *
 * วิธีใช้: expect(await readUntil(() => อ่านค่า(), ค่าที่คาด)).toEqual(ค่าที่คาด)
 */
import { isDeepStrictEqual } from 'node:util';
import { env } from '../config/env';

/** ข้อความภายในที่ใช้แยก "หมดเวลา" ออกจากข้อผิดพลาดอื่นของ browser.waitUntil */
const TIMED_OUT = 'readUntil: timed out';

/** ช่วงเวลาระหว่างการอ่านซ้ำ (มิลลิวินาที) ค่าเดียวกับการถามหน้าจอซ้ำใน src/screens/locators.ts (เหตุผลอยู่ที่นั่น) */
const POLL_INTERVAL_MS = 250;

/**
 * @param read ฟังก์ชันที่อ่านค่าปัจจุบันจากหน้าจอ
 * @param expected ค่าที่คาด (เทียบแบบลึก จึงใช้กับรายการได้)
 * @param timeoutMs เวลารอสูงสุด
 * @returns ค่าล่าสุดที่อ่านได้ (เท่ากับ expected ถ้าหน้าจอเปลี่ยนทันเวลา)
 */
export async function readUntil<T>(read: () => Promise<T>, expected: T, timeoutMs: number = env.waitMs): Promise<T> {
  // ช่องเดียวสำหรับค่าล่าสุด เป็นรายการเพราะค่าถูกใส่จากฟังก์ชันข้างใน (TypeScript ตามค่าของตัวแปรธรรมดาข้ามฟังก์ชันไม่ได้)
  const latest: T[] = [];
  try {
    await browser.waitUntil(
      async () => {
        latest[0] = await read();
        return isDeepStrictEqual(latest[0], expected);
      },
      { timeout: timeoutMs, interval: POLL_INTERVAL_MS, timeoutMsg: TIMED_OUT },
    );
  } catch (error) {
    // หมดเวลา: คืนค่าล่าสุด ให้ expect ในเทสรายงานว่าได้อะไร คาดอะไร   ข้อผิดพลาดแบบอื่น (เช่น อ่านค่าไม่ได้) โยนต่อ
    if (!(error instanceof Error) || error.message !== TIMED_OUT) throw error;
  }
  if (latest.length === 0) throw new Error('readUntil: อ่านค่าไม่ได้สักครั้งก่อนหมดเวลา');
  return latest[0];
}
