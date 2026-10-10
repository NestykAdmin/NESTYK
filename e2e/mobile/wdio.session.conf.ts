/**
 * ค่าตั้งของ WebdriverIO สำหรับชุด session (ล็อกอินสำเร็จ หน้าของนายหน้า และการออกจากระบบ) รันด้วย npm run test:session
 *
 * ใช้ค่าทุกอย่างของ wdio.conf.ts (Appium, เครื่องจำลอง, การเก็บหลักฐาน, รายงานวิธีหาชิ้นส่วน) ต่างกัน 2 อย่าง
 *   - ไฟล์เทสที่รัน
 *   - ท้ายรายงานวิธีหาชิ้นส่วน มีอีก 1 บรรทัดเมื่อมีชิ้นส่วนที่หาด้วยข้อความแล้วไม่เคยเจอ (neverFoundByLabel ใน src/screens/locators.ts)
 * แยกเป็นชุดของตัวเองเพราะต้องเปิด API ขณะที่ชุดหลัก (npm test) ควรรันตอนปิด API
 *   เหตุผลของชุดหลักอยู่ในหัวไฟล์ tests/login-form.spec.ts: ถ้าการแตะพลาดไปโดนปุ่มเข้าสู่ระบบตอน API เปิด แอปจะล็อกอินจริง
 */
import { neverFoundByLabel } from './src/screens/locators';
import { config as mainConfig } from './wdio.conf';

export const config: WebdriverIO.Config = {
  ...mainConfig,
  // วงเล็บเหลี่ยมซ้อน 2 ชั้น = รันทุกไฟล์ใน session เดียว (เหตุผลเดียวกับ wdio.conf.ts)
  specs: [['./tests-session/**/*.spec.ts']],

  /** รายงานของชุดหลัก แล้วต่อด้วยชิ้นส่วนที่รอบนี้หาด้วยข้อความแล้วไม่เคยเจอ (ส่วนใหญ่คือชิ้นส่วนที่เทสตรวจว่า "ไม่แสดง") */
  after: async (...args) => {
    // hook ของ WebdriverIO เป็นฟังก์ชันเดียวหรือรายการของฟังก์ชันก็ได้
    const mainAfter = mainConfig.after;
    for (const hook of Array.isArray(mainAfter) ? mainAfter : [mainAfter]) {
      if (typeof hook === 'function') await hook(...args);
    }
    const notSeen = neverFoundByLabel();
    if (notSeen.length > 0) {
      console.log(`[วิธีหาชิ้นส่วน] หาด้วยข้อความแล้วรอบนี้ไม่เคยเจอ จึงยังไม่รู้ว่าแอปมี testID หรือไม่: ${notSeen.join(', ')}`);
    }
  },
};
