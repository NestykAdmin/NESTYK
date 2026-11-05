/**
 * แท็บเพิ่มเติมของนายหน้า (Page Object): ปุ่มลัดไปเครื่องมือรอง 4 ปุ่ม เปิดด้วย AgentHomeScreen.tapTab('more')
 *
 * คลาสนี้ไม่ตรวจผล การตรวจอยู่ในไฟล์เทส
 * ที่มา (qa/e2e f8be525): apps/consumer-app/components/AgentMoreToolsBody.tsx
 *   - ปุ่มลัด calendar, contact, services, contracts (บรรทัด 26 ถึง 31) เป็น Pressable ที่มี accessibilityRole="button" (บรรทัด 53 ถึง 59)
 *   - ปุ่มที่ isAgentComingSoonTab เป็นจริง (contact, contracts, services: packages/ui/src/config/agentComingSoon.ts บรรทัด 9)
 *     ตั้ง disabled กับ accessibilityState disabled และชื่อกำกับเป็น "<ชื่อ>, <เร็ว ๆ นี้>" ส่วนปุ่มอื่นเป็น "<ชื่อ>, <คำอธิบาย>" (บรรทัด 51 ถึง 59)
 *   - แท็บนี้ไม่เรียก API (ไม่มีการโหลดรายการ)
 * ไม่ครอบคลุมแถว "ค่าคอม" ในส่วนการเงิน (บรรทัด 90 ถึง 107): เป็น View ที่ไม่ใช่ปุ่ม ยังไม่รู้ว่า iOS รายงานเป็นชิ้นเดียวหรือแยกเป็นข้อความย่อย
 * ยังไม่เคยรันบนเครื่องจริง: ถ้าเทสแดงที่การหาปุ่ม ให้ดู XML ใน test-results/ ว่าปุ่มมีชื่อกำกับและชนิดอะไร
 */
import { type MoreShortcut, sessionInEveryLanguage } from '../labels/session';
import type { RowState } from './ProfileDrawer';
import { type ElementSpec, waitUntilPlaced } from './locators';

/** ชื่อ tool ของแอปที่ใช้ในชื่อ testID ที่เสนอ (AgentMoreToolsBody.tsx บรรทัด 27 ถึง 30) */
const TOOL_ID: Record<MoreShortcut, string> = { calendar: 'calendar', contacts: 'contact', services: 'services', contracts: 'contracts' };

/**
 * ปุ่มลัด หาได้ทั้งแบบเร็ว ๆ นี้ และแบบเปิดใช้ (ชื่อ, คำอธิบาย) ในทุกภาษา
 * คำอธิบายเก็บไว้เฉพาะของปฏิทิน (ปุ่มเดียวที่เปิดใช้ได้ตอนนี้) ถ้าทีมเปิดปุ่มอื่นเมื่อไหร่ ปุ่มนั้นจะหาไม่เจอและเทสหมดเวลาพร้อมบอกว่าหาด้วยอะไร
 */
function shortcutSpec(shortcut: MoreShortcut): ElementSpec {
  const soon = sessionInEveryLanguage((labels) => `${labels.moreShortcuts[shortcut]}, ${labels.comingSoon}`);
  const open = shortcut === 'calendar' ? sessionInEveryLanguage((labels) => `${labels.moreShortcuts.calendar}, ${labels.calendarDesc}`) : [];
  return {
    description: `ปุ่มลัด "${sessionInEveryLanguage((labels) => labels.moreShortcuts[shortcut])[0]}" ในแท็บเพิ่มเติม`,
    testId: `more.${TOOL_ID[shortcut]}`,
    labels: [...soon, ...open],
    types: ['XCUIElementTypeButton'],
  };
}

export class AgentMoreTab {
  /** ชื่อกำกับและสถานะกดได้ของปุ่มลัด อ่านโดยไม่แตะ (รอให้ปุ่มอยู่นิ่งในโครงสร้างหน้าจอ) */
  async shortcutState(shortcut: MoreShortcut): Promise<RowState> {
    const element = await waitUntilPlaced(shortcutSpec(shortcut));
    return { label: (await element.getAttribute('label')) ?? '', enabled: await element.isEnabled() };
  }
}
