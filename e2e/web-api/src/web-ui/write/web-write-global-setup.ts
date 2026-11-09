import webUiGlobalSetup from '../web-ui-global-setup';
import { webUiEnv } from '../web-ui-env';
import { assertWebWriteAllowed, WEB_WRITE_RUN_ID } from './web-write-env';

/**
 * global-setup ของเทสเขียนข้อมูลบนเว็บ (playwright.web-ui-write.config.ts)
 *   1. ตรวจ E2E_ALLOW_WRITES=yes และข้อตกลงกับทีม (web-write-env.ts assertWebWriteAllowed) ก่อนเปิดเบราว์เซอร์
 *   2. ทำทุกขั้นของ global-setup ชุดอ่านอย่างเดียว (API ต้องเป็น staging ที่อนุญาต หรือ API บนเครื่องเมื่อตั้ง E2E_WEB_LOCAL_API=yes,
 *      เว็บเปิดอยู่, ตรวจรุ่นของ API เรื่องบิล)
 *   3. ตั้งรหัสรอบ (วันเวลาที่เริ่มรัน) ให้ทุกข้อใส่ในข้อมูลที่เขียน และพิมพ์ไว้ในผลรัน
 */
export default async function webWriteGlobalSetup(): Promise<void> {
  const runId = assertWebWriteAllowed();
  await webUiGlobalSetup();
  process.env[WEB_WRITE_RUN_ID] = runId;
  console.log(`[เทสเขียนบนเว็บ] รหัสรอบ ${runId} | เขียนผ่าน ${webUiEnv.apiOrigin} ด้วยบัญชี qa-agent เฉพาะข้อมูล E2E- | ทีมตกลงแล้ว (TEAM_DB_WRITES_AGREED)`);
}
