/**
 * หน้าต่างแจ้งของระบบ (Alert ของ iOS) ที่แอปเปิดด้วย Alert.alert ของ React Native
 * ตัวอย่าง: หลังออกจากระบบ แอปเปิดหน้าต่างหัวเรื่อง "ออกจากระบบ" ข้อความ "ออกจากระบบแล้ว" (apps/consumer-app/app/index.tsx บรรทัด 1281)
 *
 * ขั้นที่ 34 (9 ต.ค. 2026) ยืนยันบนเครื่องจริงแล้วว่า 3 อย่างนี้ใช้ได้กับหน้าต่างนั้น
 *   - ถามข้อความของหน้าต่าง (getAlertText) เพื่อรู้ว่าหน้าต่างขึ้นแล้ว ตัวขับตอบ "no such alert" เมื่อยังไม่มี
 *   - อ่านข้อความกับปุ่มจากโครงสร้างหน้าจอ ส่วน XCUIElementTypeAlert
 *   - ปิดหน้าต่างด้วยปุ่มหลักของหน้าต่าง (acceptAlert)
 */
import { parseNodes } from './page-source';

/** ข้อความ (ตามลำดับบนจอ หัวเรื่องก่อน) กับชื่อปุ่มของหน้าต่างแจ้ง */
export interface AlertContent {
  texts: string[];
  buttons: string[];
}

/** ช่วงเวลาระหว่างการถามซ้ำ (มิลลิวินาที) ค่าเดียวกับ src/screens/locators.ts */
const POLL_INTERVAL_MS = 250;

/** ข้อผิดพลาดที่ตัวขับตอบเมื่อยังไม่มีหน้าต่างแจ้ง (รหัส no such alert ของ WebDriver) */
function isNoAlertError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /no such alert|modal dialog when one was not open|no alert is open/i.test(text);
}

/** ข้อความกับปุ่มของหน้าต่างแจ้งในโครงสร้างหน้าจอ (ว่างทั้งคู่ถ้าไม่มีหน้าต่าง) */
export function alertContent(source: string): AlertContent {
  const block = /<XCUIElementType(Alert|Sheet)\b[\s\S]*?<\/XCUIElementType\1>/.exec(source)?.[0] ?? '';
  const nodes = parseNodes(block);
  // ข้อความชิ้นเดียวกันอาจอยู่ในโครงสร้างมากกว่า 1 ครั้ง จึงเก็บแค่ครั้งแรก (ลำดับเดิม)
  const unique = (items: string[]): string[] => [...new Set(items)];
  return {
    texts: unique(nodes.filter((node) => node.type === 'StaticText').map((node) => node.label || node.name)),
    buttons: unique(nodes.filter((node) => node.type === 'Button').map((node) => node.label || node.name)),
  };
}

/**
 * รอจนมีหน้าต่างแจ้ง แล้วคืนข้อความกับชื่อปุ่ม (ไม่ปิดหน้าต่าง)
 * ข้อผิดพลาดที่ไม่ใช่ "ยังไม่มีหน้าต่าง" (เช่น ต่อ Appium ไม่ได้) ไม่ถูกกลืน: WebdriverIO จะถามซ้ำจนหมดเวลา แล้วรายงานข้อผิดพลาดนั้น
 */
export async function waitForAlert(timeoutMs: number): Promise<AlertContent> {
  await browser.waitUntil(
    async () => {
      try {
        await browser.getAlertText();
        return true;
      } catch (error) {
        if (isNoAlertError(error)) return false;
        throw error;
      }
    },
    { timeout: timeoutMs, interval: POLL_INTERVAL_MS, timeoutMsg: `ไม่เห็นหน้าต่างแจ้งภายใน ${timeoutMs / 1000} วินาที` },
  );
  return alertContent(await browser.getPageSource());
}

/** ปิดหน้าต่างแจ้งด้วยปุ่มหลักของหน้าต่าง */
export async function acceptAlert(): Promise<void> {
  await browser.acceptAlert();
}
