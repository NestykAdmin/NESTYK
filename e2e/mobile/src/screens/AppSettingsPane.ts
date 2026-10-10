/**
 * แผงตั้งค่าแอปในลิ้นชักเมนู (Page Object) เปิดจากแถว "ตั้งค่าแอป"
 *
 * คลาสนี้ไม่ตรวจผล การตรวจอยู่ในไฟล์เทส
 * ที่มา (commit feefcf2)
 *   - packages/ui/src/shells/MobileAccountSettingsBody.tsx: อีเมลของบัญชีอยู่ส่วนบนของแผง (บรรทัด 235)
 *     ปุ่มออกจากระบบอยู่ท้ายแผง (บรรทัด 324 ถึง 334) เป็น TouchableOpacity ที่ไม่มี accessibilityRole ไม่มีชื่อกำกับ และไม่มี testID
 *     iOS จึงตั้งชื่อของปุ่มจากข้อความข้างใน
 *   - packages/ui/src/shells/MobileProfileDrawer.tsx: แผงนี้วางข้างเนื้อหาของลิ้นชัก และเลื่อนเข้ามาแทนที่ใน 220 มิลลิวินาที (บรรทัด 153 ถึง 154)
 *     เนื้อหาของแผงถูกสร้างเมื่อเปิดแผงนี้เท่านั้น (บรรทัด 554 ถึง 555) และเนื้อหาหลักของลิ้นชักไม่แสดงอีเมล (ใช้อีเมลแค่ในแผงย่อย บรรทัด 549 กับ 560)
 * บนเครื่องจริง (ขั้นที่ 34): ปุ่มออกจากระบบเป็นชนิด Other อยู่ที่ y=1018 นอกจอ (จอสูง 874 จุด) ต้องเลื่อนจอก่อนแตะ
 *   อีเมลมองเห็นได้โดยไม่ต้องเลื่อน (y=252) ก่อนแตะ "ตั้งค่าแอป" ไม่มีปุ่มออกจากระบบในโครงสร้างหน้าจอ
 *   และเมื่อแผงเปิดแล้ว แถวของลิ้นชักเลื่อนไปอยู่นอกจอ (x=-310 มองไม่เห็น)
 */
import { sessionInEveryLanguage } from '../labels/session';
import { readScreen, type ScreenNode } from '../support/page-source';
import { type ElementSpec, nodesInSource, scrollIntoView, shownInSource, waitUntilPlaced } from './locators';

const SIGN_OUT_BUTTON: ElementSpec = {
  description: 'ปุ่มออกจากระบบในแผงตั้งค่าแอป',
  testId: 'settings.signOut',
  labels: sessionInEveryLanguage((labels) => labels.signOut),
  // ตอนนี้เป็นชนิด Other (ไม่มี role) ถ้าทีมเพิ่ม accessibilityRole="button" จะกลายเป็น Button จึงรับทั้ง 2 ชนิด
  //   ชื่อเดียวกันยังเป็นหัวเรื่องของหน้าต่างแจ้งหลังออกจากระบบ แต่ส่วนนั้นเป็นชนิด StaticText กับ Alert
  types: ['XCUIElementTypeOther', 'XCUIElementTypeButton'],
};

/** อีเมลของบัญชีในแผง ค่าที่หาคืออีเมลที่ไฟล์เทสส่งมา จึงไม่มีข้อความกำกับคงที่ (ดู showsEmail) */
const EMAIL_TEXT: ElementSpec = {
  description: 'อีเมลของบัญชีในแผงตั้งค่าแอป',
  testId: 'settings.email',
  labels: [],
  types: ['XCUIElementTypeStaticText'],
};

export class AppSettingsPane {
  /**
   * รอจนแผงเปิดและหยุดเลื่อน: ปุ่มออกจากระบบ (ซึ่งมีเฉพาะตอนแผงเปิด) อยู่ในโครงสร้างหน้าจอในตำแหน่งที่นิ่ง
   * ปุ่มนี้อยู่นอกจอได้ จึงไม่รอให้มองเห็น
   */
  async waitUntilOpen(): Promise<void> {
    await waitUntilPlaced(SIGN_OUT_BUTTON);
  }

  /**
   * แผงนี้แสดงอีเมลนี้อยู่หรือไม่ (เทียบโดยไม่สนตัวพิมพ์เล็กใหญ่ อ่านจากโครงสร้างหน้าจอ)
   * นับเฉพาะเมื่อโครงสร้างหน้าจอเดียวกันมีปุ่มออกจากระบบ (แผงเปิดอยู่) อีเมลที่แสดงที่อื่นของแอปจึงไม่ถูกนับ
   *   ส่วนช่วงที่แผงกำลังเลื่อนเข้า ไฟล์เทสต้องรอ waitUntilOpen ก่อน
   * ไฟล์เทสตรวจผลเป็นจริงหรือเท็จ ข้อความของเทสที่ไม่ผ่านจึงไม่มีค่าอีเมล
   */
  async showsEmail(email: string): Promise<boolean> {
    const wanted = email.trim().toLowerCase();
    const same = (text: string): boolean => text.trim().toLowerCase() === wanted;
    const nodes = await readScreen();
    if (nodesInSource(nodes, SIGN_OUT_BUTTON).length === 0) return false;
    // ถ้าแอปมี testID ของอีเมลแล้ว ค่า name คือ testID และ label คืออีเมล จึงเทียบ label เสมอ (ถ้าหาด้วยข้อความ เทียบทั้ง label และ name)
    const emailNodes = shownInSource(nodes, EMAIL_TEXT, (node: ScreenNode) => same(node.label) || same(node.name));
    return emailNodes.some((node) => same(node.label) || same(node.name));
  }

  /** เลื่อนจอจนเห็นปุ่มออกจากระบบ แล้วแตะ (แอปจะเปิดหน้าต่างแจ้ง ดู src/support/alert.ts) */
  async signOut(): Promise<void> {
    await (await scrollIntoView(SIGN_OUT_BUTTON)).click();
  }
}
