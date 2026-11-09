/// <reference lib="dom" />  // โค้ดใน evaluateAll ทำงานในเบราว์เซอร์ (tsconfig ของชุดนี้ใช้ lib ES2022 อย่างเดียว)
import type { Locator, Page } from '@playwright/test';
import { NARROW, ROLE_TABS, type NarrowRole } from '../labels.narrow';

/**
 * หน้าแบบมือถือบนเว็บจอแคบ (กว้างน้อยกว่า 768px) ใช้ร่วมกันทุกบทบาท
 *   app/index.tsx:766 Page = MobileModePage เมื่อไม่ใช่ desktop shell, :1928-1942 แท็บล่าง, :1972 เมนูด้านข้าง ที่ qa/e2e 74b46f4
 * ชิ้นส่วนเหล่านี้ไม่มี testid และ component ร่วมส่วนใหญ่ไม่รับ testID จึงหาด้วย role กับชื่อ (aria-label)
 *   react-native-web 0.21.2 (node_modules บนเครื่อง Aof): accessibilityRole header -> role heading,
 *   accessibilityLabel -> aria-label, testID -> data-testid, disabled ของ TouchableOpacity/Pressable -> aria-disabled
 *   แต่ accessibilityState.selected ไม่ถูกแปลงเป็น aria-selected (createDOMProps อ่านแค่ aria-selected/accessibilitySelected)
 *   เทสจึงยืนยันแท็บที่เปิดอยู่ด้วย URL และเนื้อหาของหน้า ไม่ใช่สถานะของแท็บ
 */
export class MobileShell {
  constructor(
    private readonly page: Page,
    private readonly role: NarrowRole,
  ) {}

  /**
   * แถบแท็บล่าง (role=tablist: MobileBottomTabBar.tsx:145)
   * หน้าผู้เช่าของนายหน้ามี tablist อีกชุด (แท็บ To do / All tenants: MobileSegmentedTabs.tsx:49)
   * จึงเลือก tablist ที่มีแท็บแรกของบทบาทนี้
   */
  get tabBar(): Locator {
    const first = ROLE_TABS[this.role][0];
    return this.page.getByRole('tablist').filter({ has: this.page.getByRole('tab', { name: first, exact: true }) });
  }

  /** แท็บล่างตามชื่อ */
  tab(name: string): Locator {
    return this.tabBar.getByRole('tab', { name, exact: true });
  }

  /** ชื่อของแท็บล่างทั้งหมดตามลำดับบนหน้า */
  async tabNames(): Promise<(string | null)[]> {
    return this.tabBar.getByRole('tab').evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')));
  }

  /** จำนวนแท็บล่างที่มี aria-selected (ใช้จดเป็นข้อสังเกตเรื่องการเข้าถึง ไม่ใช่ค่าที่คาด) */
  async tabsWithSelectedState(): Promise<number> {
    return this.tabBar.getByRole('tab').evaluateAll((elements) => elements.filter((element) => element.hasAttribute('aria-selected')).length);
  }

  /** รากของโครงหน้าเดสก์ท็อป (class aw-shell: agent-web/AgentWorkspace.web.tsx) ต้องไม่มีบนจอแคบ */
  get desktopShell(): Locator {
    return this.page.locator('.aw-shell');
  }

  /** ปุ่มเปิดเมนูด้านข้างบนหัวหน้า (MobileWorkspaceHeader.tsx:39 และ MobileSectionHeader.tsx:90 ชื่อ "Menu") */
  get menuButton(): Locator {
    return this.page.getByRole('button', { name: NARROW.menu, exact: true });
  }

  /**
   * ปุ่มกลับบนหัวหน้าย่อย (MobileSectionHeader.tsx:90 ชื่อ "Back")
   * ใช้ได้เฉพาะตอนเมนูด้านข้างปิด เพราะในเมนูด้านข้างมีปุ่มชื่อ "Back" อีก 2 ปุ่ม (MobileProfileDrawer.tsx:432, :572)
   */
  get backButton(): Locator {
    return this.page.getByRole('button', { name: NARROW.back, exact: true });
  }

  /** ช่องค้นของหน้าลีดแบบมือถือ (ไม่มี label หาด้วย placeholder: AgentLeadsScreen.tsx:260) ขึ้นหลังตัวโหลด MobileBrandLoader (:234-240) */
  get leadsSearch(): Locator {
    return this.page.getByPlaceholder(NARROW.leadsSearch, { exact: true });
  }

  /** ช่องค้นของหน้าห้องแบบมือถือ (placeholder: AgentRoomsScreen.tsx:614) */
  get roomsSearch(): Locator {
    return this.page.getByPlaceholder(NARROW.roomsSearch, { exact: true });
  }

  /** ปุ่ม Calendar ในแท็บ More ของนายหน้า (ชื่อ "<ชื่อ>, <คำอธิบาย>": AgentMoreToolsBody.tsx:27, :58) */
  get moreCalendarButton(): Locator {
    return this.page.getByRole('button', { name: `${NARROW.moreCalendar}, ${NARROW.moreCalendarDesc}`, exact: true });
  }

  /**
   * เมนูด้านข้าง: RN Modal (MobileProfileDrawer.tsx:391) ซึ่ง react-native-web แสดงเป็น role=dialog aria-modal=true ตอนเปิด
   *   (node_modules/react-native-web/dist/exports/Modal/ModalContent.js:42-44) และปิดด้วยปุ่ม Escape ได้ (:26-35 เรียก onRequestClose = onClose)
   * หาปุ่มในเมนูภายใน dialog นี้เท่านั้น เพราะหน้าข้างหลังอาจมีปุ่มชื่อเดียวกัน (เช่น "Calendar")
   */
  get drawer(): Locator {
    return this.page.getByRole('dialog');
  }

  /** รายการในเมนูด้านข้าง (TouchableOpacity role=button ชื่อ = t.mobile.drawerMenu[labelKey]: MobileProfileDrawer.tsx:343-355) */
  drawerItem(label: string): Locator {
    return this.drawer.getByRole('button', { name: label, exact: true });
  }

  /** รายการในเมนูด้านข้างที่ยังไม่เปิดใช้ (ชื่อ "<ชื่อ>, Coming soon" และ disabled: MobileProfileDrawer.tsx:349-354) */
  drawerSoonItem(label: string): Locator {
    return this.drawer.getByRole('button', { name: `${label}, ${NARROW.comingSoon}`, exact: true });
  }
}
