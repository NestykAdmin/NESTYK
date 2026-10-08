/**
 * การเขียนเทสกับบั๊กที่รู้แล้วและยังไม่ถูกแก้
 *
 * หลักเดียวกับชุดเทส API (e2e/web-api ใช้ test.fail ของ Playwright): เขียนสิ่งที่ "ถูกต้อง" ไว้ในเทส
 *   - ระหว่างที่บั๊กยังอยู่ การตรวจข้อนั้นจะไม่ผ่านตามที่คาด เทสจึงยังเขียว และพิมพ์บอกว่าบั๊กไหนยังอยู่
 *   - วันที่ทีมแก้บั๊ก การตรวจจะผ่าน แล้วเทสจะแดงพร้อมบอกให้ลบเครื่องหมายบั๊กออก
 * WebdriverIO (Mocha) ไม่มีคำสั่งแบบ test.fail จึงทำตัวช่วยนี้ และติดป้าย @known-bug ไว้ในชื่อเทส
 *
 * ครอบเฉพาะการตรวจข้อที่เป็นตัวบั๊ก ไม่ครอบขั้นเตรียมการ
 *   ถ้าขั้นเตรียมการพัง (เช่น หาชิ้นส่วนไม่เจอ) เทสต้องแดงตามปกติ ไม่ถูกนับว่าเป็น "บั๊กที่รู้แล้ว"
 */
import { AssertionError } from 'node:assert';

export interface KnownBug {
  /** รหัสอ้างอิงของบั๊กในบันทึกของ QA */
  id: string;
  /** อาการของบั๊กโดยย่อ */
  summary: string;
}

/**
 * @param bug บั๊กที่รู้แล้ว
 * @param correctBehaviour การตรวจพฤติกรรมที่ถูกต้อง เขียนด้วย assert ของ Node.js (node:assert) เท่านั้น
 */
export async function expectKnownBug(bug: KnownBug, correctBehaviour: () => void | Promise<void>): Promise<void> {
  try {
    await correctBehaviour();
  } catch (error) {
    if (error instanceof AssertionError) {
      // บั๊กยังอยู่: พิมพ์ไว้ในผลรัน เพื่อให้รู้ว่าเทสข้อนี้เขียวเพราะบั๊กที่รู้แล้ว ไม่ใช่เพราะระบบถูก
      console.log(`  [known-bug ${bug.id}] ยังพบอยู่: ${bug.summary}`);
      return;
    }
    // ข้อผิดพลาดแบบอื่นไม่ใช่อาการของบั๊กนี้ ให้เทสแดง
    throw error;
  }
  throw new Error(
    `[known-bug ${bug.id}] ไม่พบบั๊กนี้แล้ว (${bug.summary}) ถ้าทีมแก้แล้ว ให้ลบ expectKnownBug กับป้าย @known-bug ออกจากเทสข้อนี้`,
  );
}
