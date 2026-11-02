import type { FullConfig } from '@playwright/test';
import baseGlobalSetup from '../global-setup';
import { env } from '../config/env';
import { assertWriteEnvironment, makeRunId, RUN_ID_VARIABLE, TARGET_VARIABLE, TEAM_DB_WRITES_AGREED } from './write-guard';

/**
 * global-setup ของเทสที่เขียนข้อมูล (playwright.write.config.ts)
 *   ขั้นที่ 1: ตรวจตัวกัน (write-guard.ts) ก่อนส่งคำขอใด ๆ
 *   ขั้นที่ 2: ต้องรันด้วย worker เดียว ตัวเลือกบรรทัดคำสั่ง --workers หรือ --fully-parallel ทับค่าในไฟล์ค่าตั้งได้
 *     (ลองในห้องทดลอง 30 ต.ค. 2026: --workers=4 --fully-parallel ได้ 3 worker และ beforeAll ทำงานพร้อมกัน 4 ครั้ง)
 *     ถ้าหลาย worker เริ่มพร้อมกันในรอบแรก แต่ละตัวอาจสร้างลีดถาวรของตัวเอง
 *   ขั้นที่ 3: รัน global-setup เดิมของชุดเทส ซึ่งตรวจแบบอ่านอย่างเดียวว่า API พร้อม และยืนยันว่า E2E_QA_AGENT_UUID เป็นของ qa-agent
 *     ที่มีบทบาท guest + agent ตรงตาม migration (ถ้าไม่ผ่าน จะหยุดทั้งชุดที่ขั้นนี้)
 *   ขั้นที่ 4: ตั้งรหัสรอบไว้ใน process.env ให้ fixture อ่าน (Playwright ส่งตัวแปรที่ global-setup ตั้งต่อให้ worker)
 *     และพิมพ์สถานะข้อตกลง ("ทีมตกลงแล้ว" หรือสิ่งที่ผู้รันยืนยันเมื่อค่าคงที่เป็น false) กับที่อยู่ของ API ไว้ในผลรัน เพื่อตรวจย้อนหลังได้
 */
export default async function writeGlobalSetup(config: FullConfig): Promise<void> {
  assertWriteEnvironment();
  if (config.workers !== 1) {
    throw new Error(
      `หยุดก่อนเรียก API: เทสที่เขียนข้อมูลต้องรันด้วย worker เดียว แต่รอบนี้ตั้งไว้ ${config.workers} worker\n` +
        'อย่าใส่ --workers ที่ไม่ใช่ 1 ตอนรัน npm run test:write',
    );
  }
  await baseGlobalSetup();
  const runId = makeRunId();
  process.env[RUN_ID_VARIABLE] = runId;
  const target = TEAM_DB_WRITES_AGREED
    ? 'ทีมตกลงแล้ว'
    : `ผู้รันยืนยัน ${TARGET_VARIABLE}=${process.env[TARGET_VARIABLE]} | DATABASE_URL ใน .env.api ชี้เครื่องนี้`;
  console.log(`[เทสเขียนข้อมูล] รหัสรอบ ${runId} | ${target} | API ${env.apiBaseUrl}`);
}
