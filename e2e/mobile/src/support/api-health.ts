/**
 * ตรวจว่า API ของ NESTYK เปิดอยู่ ก่อนเริ่มชุด session
 *
 * ทำไมต้องตรวจก่อน: ชุด session ล็อกอินจริง ซึ่งต้องใช้ API 2 จุด
 *   - ปุ่มเข้าสู่ระบบของบัญชีนักพัฒนาเรียก POST /auth/sync ก่อนแอปจะไปหน้าของนายหน้า (apps/consumer-app/lib/auth/AuthContext.tsx บรรทัด 155 ถึง 173)
 *   - ตอนเปิดแอปใหม่ แอปเรียก /auth/sync อีกครั้ง ถ้าไม่สำเร็จด้วยเหตุใดก็ตาม แอปล้างการล็อกอินทิ้ง (AuthContext.tsx บรรทัด 95 ถึง 119)
 *   ถ้า API ปิดอยู่ เทสทุกข้อจะแดงที่ขั้นรอหน้าของนายหน้า ซึ่งอ่านสาเหตุยาก จึงตรวจก่อนเริ่ม แล้วบอกสาเหตุตรง ๆ
 *   ข้อ 6 ของชุด session เรียกซ้ำรอบการเปิดแอปใหม่ด้วย เพราะถ้า API ไม่ตอบตอนนั้น แอปก็ไปหน้า login เหมือนกัน
 *
 * ข้อความเมื่อไม่ผ่านบอกชื่อตัวแปร E2E_API_URL ไม่บอกค่า (ข้อตกลงของงานนี้: ค่าของตัวแปรแวดล้อมไม่ไปอยู่ในผลรัน)
 *
 * ข้อจำกัด: ตรวจได้แค่ว่ามี API ตอบที่ E2E_API_URL ไม่ได้ตรวจว่าแอปที่ build ไว้เรียกที่อยู่เดียวกัน
 *   (แอปอ่านที่อยู่ API จาก EXPO_PUBLIC_API_URL ซึ่งฝังอยู่ในแอปตอน build)
 */
import { env } from '../config/env';

/** เวลารอคำตอบของ /health (มิลลิวินาที) API ในเครื่องตอบภายในเสี้ยววินาที ค่านี้เผื่อไว้สำหรับเครื่องที่ช้า */
const HEALTH_TIMEOUT_MS = 5_000;

/** หยุดเทสพร้อมบอกสาเหตุ ถ้า GET <E2E_API_URL>/health ไม่ตอบด้วยรหัส 2xx */
export async function requireApi(): Promise<void> {
  let result: string;
  try {
    const response = await fetch(`${env.apiUrl}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    if (response.ok) return;
    result = `ตอบรหัส ${response.status}`;
  } catch (error) {
    // บอกแค่รหัสของสาเหตุ (เช่น ECONNREFUSED) หรือชนิดของ error (เช่น TimeoutError) ไม่ใช้ข้อความของ error
    //   เพราะ fetch ของ Node ใส่ที่อยู่เต็มไว้ในข้อความได้ เช่น เมื่อที่อยู่ผิดรูปแบบ
    const code = (error as { cause?: { code?: unknown } }).cause?.code;
    result = `ต่อไม่ได้ (${typeof code === 'string' ? code : (error as Error).name})`;
  }
  throw new Error(`API ของ NESTYK ไม่พร้อม: GET <E2E_API_URL>/health ${result} ชุด session ต้องเปิด API ก่อนรัน (ดู README หัวข้อ "ชุด session")`);
}
