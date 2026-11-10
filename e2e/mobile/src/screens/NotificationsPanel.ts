/**
 * แผงแจ้งเตือน (Page Object) เปิดด้วย AgentHomeScreen.openNotifications() จากปุ่มระฆังบนส่วนหัวของแท็บภาพรวม
 *
 * คลาสนี้ไม่ตรวจผล การตรวจอยู่ในไฟล์เทส
 * ที่มา (qa/e2e f8be525)
 *   - รายการแจ้งเตือนเป็นอาร์เรย์ว่างที่เขียนไว้ในแอป ยังไม่เชื่อม API (apps/consumer-app/app/index.tsx บรรทัด 118 ถึง 119 และ 233 ถึง 234)
 *     การเปิดแผงมีแค่ setNotificationsOpen(true) ไม่เรียก API และไม่เขียนอะไร (บรรทัด 803 และ 925)
 *   - แผงเป็น Modal เต็มจอ (packages/ui/src/shells/MobileNotificationsPanel.tsx บรรทัด 55 ถึง 69 แสดงที่ index.tsx บรรทัด 1994 ถึง 2007)
 *   - หัวข้อ mobile.notifications.title และข้อความเมื่อไม่มีรายการคือ agent.dashboard.comingSoon (index.tsx บรรทัด 2001)
 *     ทั้ง 2 เป็น Text ที่ไม่มี role (packages/ui/src/components/MobileNotificationsBody.tsx บรรทัด 45 ถึง 47 และ 95 ถึง 96) จึงหาด้วยชนิด StaticText
 *     หัวข้อภาษาอังกฤษ "Notifications" ชื่อเดียวกับปุ่มระฆัง (ชนิด Button) การระบุชนิดจึงแยก 2 ชิ้นนี้ออกจากกัน
 *   - ปุ่มย้อนกลับในแผงไม่มีชื่อกำกับ (MobileNotificationsBody.tsx บรรทัด 42 ถึง 44) คลาสนี้จึงไม่มีเมธอดปิดแผง เทสถัดไปเปิดแอปใหม่เองอยู่แล้ว
 * ข้อจำกัด: นับเฉพาะชิ้นที่มองเห็น แต่ค่า visible ของ iOS ไม่ได้ดูว่ามีชิ้นอื่นบังอยู่ ถ้า iOS ยังรายงานเนื้อหาของหน้าข้างใต้ Modal ว่ามองเห็น
 *   และหน้านั้นมีคำว่า "เร็ว ๆ นี้" emptyLabelsShown จะนับชิ้นของหน้าข้างใต้ด้วย ซึ่งทำได้ทั้งให้เทสแดง (ได้มากกว่า 1 ชิ้น)
 *   และให้เทสผ่านทั้งที่แผงไม่แสดงข้อความ (แผงไม่แสดง แต่หน้าข้างใต้มี 1 ชิ้นพอดี รวมถึงชิ้นเดียวที่ถูกรายงานซ้อน 2 ชั้นซึ่งนับเป็น 1)
 *   สิ่งที่ลดความเสี่ยง: ในขั้นที่ 55 ปุ่มระฆังของหน้าข้างใต้แผงถูกรายงานว่า visible=false ทางแก้ถาวรคือ testID notifications.empty
 *   ที่ f8be525 แดชบอร์ดของนายหน้า (หน้าที่อยู่ข้างใต้แผงในเทส) ไม่มีข้อความนี้ (packages/feature-listing/src/components/MobileAgentDashboardBody.tsx
 *   ไม่ใช้ agent.dashboard.comingSoon) ความเสี่ยงนี้จึงเกิดเมื่อแดชบอร์ดเปลี่ยน
 * ผลรันจริง (ขั้นที่ 55, 5 พ.ย. 2026, แอปจาก qa/e2e 4474f94, iOS 27.0): iOS รายงานข้อความนี้ 2 ชิ้นที่กรอบเดียวกัน
 *   (x=16 y=206 370x86 ชั้นนอก accessible=false ซ้อนชั้นใน accessible=true)
 *   อนุมานว่าเป็นข้อความชิ้นเดียวที่ถูกรายงานซ้อน 2 ชั้น เพราะกรอบเท่ากันทั้งกรอบ ชั้นหนึ่งอยู่ในอีกชั้น โค้ดมี <Text> ชิ้นเดียว
 *   (MobileNotificationsBody.tsx บรรทัด 96) และไม่มีชิ้นอื่นบนจอที่มีคำนี้ (หัวข้อของแผงก็ถูกรายงานซ้อนแบบเดียวกัน)
 *   emptyLabelsShown จึงนับชิ้นที่ข้อความและกรอบ (x, y, กว้าง, สูง) ซ้ำกันเป็นชิ้นเดียว ชิ้นที่มีคำเดียวกันแต่กรอบต่างกันยังถูกนับแยก
 */
import { sessionInEveryLanguage } from '../labels/session';
import { readScreen } from '../support/page-source';
import { type ElementSpec, shownInSource, waitUntilShown } from './locators';

const TITLE: ElementSpec = {
  description: 'หัวข้อของแผงแจ้งเตือน',
  testId: 'notifications.title',
  labels: sessionInEveryLanguage((labels) => labels.notificationsTitle),
  types: ['XCUIElementTypeStaticText'],
};

const EMPTY_LABEL: ElementSpec = {
  description: 'ข้อความของแผงแจ้งเตือนเมื่อไม่มีรายการ',
  testId: 'notifications.empty',
  labels: sessionInEveryLanguage((labels) => labels.comingSoon),
  types: ['XCUIElementTypeStaticText'],
};

export class NotificationsPanel {
  /** รอจนผู้ใช้เห็นหัวข้อของแผง แล้วคืนข้อความของหัวข้อ */
  async waitUntilOpen(): Promise<string> {
    const element = await waitUntilShown(TITLE);
    return (await element.getAttribute('label')) ?? '';
  }

  /**
   * ข้อความเมื่อไม่มีรายการที่ผู้ใช้เห็นอยู่ (ไม่รอ เรียกหลัง waitUntilOpen) คืนรายการข้อความที่เห็น ว่าง = ไม่เห็น
   * ชิ้นที่ข้อความและกรอบ (x, y, กว้าง, สูง) ซ้ำกันนับเป็นชิ้นเดียว (iOS รายงานข้อความชิ้นเดียวซ้อน 2 ชั้น ดูหัวไฟล์)
   * ชิ้นที่ไม่มีค่าใดค่าหนึ่งของกรอบนับแยกทุกชิ้น
   */
  async emptyLabelsShown(): Promise<string[]> {
    const seen = new Set<string>();
    const shown: string[] = [];
    for (const [index, node] of shownInSource(await readScreen(), EMPTY_LABEL).entries()) {
      const text = node.label || node.name;
      const frame = [node.x, node.y, node.width, node.height];
      const key = frame.some(Number.isNaN) ? `node${index}` : `${text}@${frame.join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      shown.push(text);
    }
    return shown;
  }
}
