/// <reference lib="dom" />  // โค้ดใน evaluate ทำงานในเบราว์เซอร์ (tsconfig ของชุดนี้ใช้ lib ES2022 อย่างเดียว)
import type { Locator, Page } from '@playwright/test';
import { EN } from '../labels';

/**
 * โครงหน้าแบบเดสก์ท็อป (AgentWorkspace) ที่ใช้ร่วมกันทั้ง agent, tenant และ landlord บนจอกว้างตั้งแต่ 768px
 *   apps/consumer-app/components/agent-web/AgentWorkspace.web.tsx และ app/index.tsx:176, 709-713, 1668-1673
 * admin และ guest ไม่มีโครงหน้านี้ (แสดงหน้าแบบมือถือ)
 */
export class AgentShell {
  constructor(private readonly page: Page) {}

  /** รากของโครงหน้า ไม่มี testid ใช้ class aw-shell (AgentWorkspace.web.tsx:480-493) */
  get root(): Locator {
    return this.page.locator('.aw-shell');
  }

  /** ตัวห่อเมนูสลับ workspace (testid shell.workspace ที่ :593) */
  get workspaceSwitch(): Locator {
    return this.page.getByTestId('shell.workspace');
  }

  /** ชื่อบทบาทของ workspace ที่แสดงอยู่ (<strong> ในปุ่มสลับ :603 ค่า roles.<บทบาท>) */
  get workspaceRole(): Locator {
    return this.workspaceSwitch.locator('.aw-switch-copy strong');
  }

  /** ตัวห่อเมนู Create มีเฉพาะ workspace ของนายหน้า (index.tsx:1679 ส่ง onCreate เมื่อ isAgentWeb) */
  get createMenu(): Locator {
    return this.page.getByTestId('shell.create');
  }

  /** ปุ่มเปิดเมนู Create (WebMenu.tsx:71-80 aria-label = agent.dashboard.webWorkspace.create) */
  get createButton(): Locator {
    return this.createMenu.getByRole('button', { name: EN.create, exact: true });
  }

  /** รายการเมนูที่เปิดอยู่ของ Create (WebMenu.tsx:100-107 role=menu) */
  get createList(): Locator {
    return this.createMenu.getByRole('menu');
  }

  /** รายการแรกในเมนู Create ที่กดได้ (ตอนเปิดเมนู โฟกัสย้ายมาที่นี่: WebMenu.tsx:64) */
  get createFirstItem(): Locator {
    return this.createList.locator('button:not(:disabled)').first();
  }

  /** ปุ่มเปิดเมนูธีม (ตัวห่อ shell.theme ที่ :564-576 ปุ่มเปิดของ WebMenu.tsx:71-80) */
  get themeButton(): Locator {
    return this.page.getByTestId('shell.theme').getByRole('button').first();
  }

  /** รายการในเมนูธีม (testID shell.theme.<light|dark|system> ที่ :573) */
  themeOption(key: 'light' | 'dark' | 'system'): Locator {
    return this.page.getByTestId(`shell.theme.${key}`);
  }

  /** ชื่อหน้าบนแถบบน (<h1 class="aw-title"> :526) ไม่ใช่ปุ่ม ใช้เป็นที่คลิก "ข้างนอกเมนู" ที่ไม่มีผลอื่น */
  get topbarTitle(): Locator {
    return this.page.locator('h1.aw-title');
  }

  /** การ์ดตัวเลขใบแรกบนแดชบอร์ดของนายหน้า (AgentOverview.web.tsx:376-384 เป็นปุ่มเมื่อการ์ดมีปลายทาง) อยู่ซ้ายสุด ห่างจากเมนู Create ที่เปิดทางขวา */
  get firstDashboardCard(): Locator {
    return this.page.getByTestId('agent-desktop-overview').locator('section.aov-kpis button.aov-kpi').first();
  }

  /** ปุ่มในเมนูข้าง (aside aria-label = mobile.profile.navigation) ตามชื่อที่แสดง */
  navItem(name: string): Locator {
    return this.page.locator('aside.aw-sidebar').getByRole('button', { name, exact: true });
  }

  /** รายการเมนูข้างที่ยังไม่เปิดใช้ (soonItem และ navItem ที่ :361-372, :443-455 ใช้ title "<ชื่อ> · Coming soon") */
  get comingSoonItems(): Locator {
    return this.page.locator(`aside.aw-sidebar button[title$="· ${EN.comingSoon}"]`);
  }

  /** เปิดเมนูบัญชี (<details class="aw-account"> ที่ :673-674 summary aria-label "Your account") */
  async openAccountMenu(): Promise<void> {
    const details = this.page.locator('details.aw-account');
    if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) {
      await details.getByLabel(EN.account, { exact: true }).click();
    }
  }

  /** ออกจากระบบด้วยปุ่ม Sign Out ในเมนูบัญชี (:866-873 เรียก signOut แบบ scope local: AuthContext.tsx:344) */
  async signOut(): Promise<void> {
    await this.openAccountMenu();
    await this.page.locator('details.aw-account button.aw-signout:not(.aw-signout-all)').click();
  }

  /** ปุ่มเปิดกล่อง "ออกจากทุกอุปกรณ์" (:879) ห้ามกดปุ่มยืนยันในกล่อง (account.signOutAllConfirm) */
  get signOutAllButton(): Locator {
    return this.page.getByTestId('account.signOutAll');
  }

  /** กล่อง "ออกจากทุกอุปกรณ์" (<dialog> ของ WebDialog.tsx testid account.signOutAllDialog) */
  get signOutAllDialog(): Locator {
    return this.page.getByTestId('account.signOutAllDialog');
  }

  /** หัวข้อของกล่อง (<h2> ใน WebDialog.tsx:49) */
  get signOutAllTitle(): Locator {
    return this.signOutAllDialog.getByRole('heading', { level: 2 });
  }

  /** ปุ่มปิดมุมกล่อง (WebDialog.tsx:51-56 aria-label = agent.dashboard.webWorkspace.close) */
  get signOutAllClose(): Locator {
    return this.signOutAllDialog.getByRole('button', { name: EN.close, exact: true });
  }
}
