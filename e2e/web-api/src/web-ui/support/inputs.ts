/// <reference lib="dom" />  // โค้ดใน evaluate ทำงานในเบราว์เซอร์ (tsconfig ของชุดนี้ใช้ lib ES2022 อย่างเดียว)
import type { Locator } from '@playwright/test';

/**
 * ตั้งค่าในช่องกรอกโดยไม่ผ่าน fill: รายงาน HTML บันทึกค่าของ fill ไว้ในชื่อขั้น (เช่น Fill "<ค่า>")
 * ส่วน evaluate บันทึกแค่คำว่า Evaluate (ลองในห้องทดลอง 4 พ.ย. 2026 ที่ Playwright 1.63.0) ใช้กับรหัสผ่านจริง และคำค้นที่มาจากชื่อลูกค้าจริง (tests/web-ui/agent-leads.spec.ts)
 * ตั้งผ่าน setter ของ HTMLInputElement แล้วส่ง input event เพื่อให้ React รับค่า (react-native-web TextInput)
 */
export async function setInputValueHidden(field: Locator, value: string, timeout = 10_000): Promise<void> {
  await field.evaluate(
    (element, next) => {
      const input = element as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, next);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    value,
    { timeout },
  );
}
