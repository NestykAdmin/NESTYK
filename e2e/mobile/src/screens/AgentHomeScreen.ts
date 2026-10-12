/**
 * หน้าของนายหน้าหลังล็อกอิน (Page Object): ส่วนหัว แถบแท็บล่าง 5 แท็บ และสถานะการโหลดของแท็บที่ดึงรายการจาก API
 *
 * คลาสนี้ไม่ตรวจผล (ไม่มี expect) การตรวจอยู่ในไฟล์เทส
 * ที่มาของหน้าจอ (commit feefcf2)
 *   - ส่วนหัวของแท็บภาพรวม: packages/ui/src/components/MobileWorkspaceHeader.tsx (ปุ่ม Menu บรรทัด 34 ถึง 42 ป้ายพื้นที่ทำงานบรรทัด 44 ถึง 58)
 *     แท็บอื่นใช้ส่วนหัว MobileSectionHeader.tsx ซึ่งมีปุ่ม Menu ชื่อเดียวกัน (บรรทัด 90) และแสดงป้ายใต้ชื่อหน้า (บรรทัด 105 ถึง 116)
 *     ป้ายนั้นเป็นป้ายพื้นที่ทำงาน ยกเว้นแท็บผู้เช่าที่แสดงคำอธิบายรายการแทน (apps/consumer-app/app/index.tsx บรรทัด 609 ถึง 619)
 *   - แถบแท็บ: packages/ui/src/components/MobileBottomTabBar.tsx บรรทัด 157 ถึง 165 (accessibilityRole="tab" และ accessibilityState={{ selected }})
 *   - ตัวโหลดของแท็บห้อง ลีด ผู้เช่า: MobileBrandLoader แสดงจนรายการโหลดเสร็จหรือโหลดไม่สำเร็จ
 *     (apps/consumer-app/components/AgentRoomsScreen.tsx บรรทัด 591 ถึง 600, AgentLeadsScreen.tsx บรรทัด 235 ถึง 241, AgentTenantsScreen.tsx บรรทัด 390 ถึง 399)
 *   - สิ่งที่แสดงเมื่อโหลดไม่สำเร็จ: ดูคอมเมนต์ของ loadErrors กับ retryButtons ใน src/labels/session.ts
 * สิ่งที่เห็นบนเครื่องจริง (ขั้นที่ 34 เมื่อ 9 ต.ค. 2026, ภาษาไทย)
 *   - ปุ่ม Menu เป็นชนิด Button ที่ y=66 แท็บทั้ง 5 เป็นชนิด Other อยู่แถวเดียวกันที่ y=781 และไม่มี traits Button
 *   - แท็บที่ถูกเลือกมี traits="Selected" ขึ้นหลังแตะ 0.5 ถึง 1.0 วินาที
 *   - คำว่า "ผู้เช่า" ชนิด StaticText ที่มองไม่เห็นอยู่ในเนื้อหาของหน้าภาพรวมด้วย (y=1522) แท็บจึงหาด้วยชนิด Other และแถวของแถบแท็บ
 *   - หน้าห้อง ลีด และผู้เช่า แสดง "กำลังโหลด…" ระหว่างโหลดรายการ ไม่มีวงหมุนของระบบ (XCUIElementTypeActivityIndicator)
 *   - ป้ายพื้นที่ทำงานเห็นบนหน้าภาพรวม ห้อง และเพิ่มเติม หน้าผู้เช่าเห็น "รายชื่อผู้เช่าทั้งหมด" แทน (หน้าลีดยังไม่ได้ตรวจในโครงสร้างหน้าจอ)
 *
 * การหาชิ้นส่วนทุกตัวผ่าน src/screens/locators.ts (testID ที่เสนอก่อน แล้วจึงข้อความ) testId ในไฟล์นี้คือชื่อที่เสนอให้ทีมเพิ่มในแอป ดู README
 */
import { env } from '../config/env';
import {
  AGENT_TABS,
  type AgentTab,
  DATA_TABS,
  type DataTab,
  FIXED_LABELS,
  RETRY_TABS,
  type RetryTab,
  sessionInEveryLanguage,
  TENANTS_API_ERRORS_EN,
  TENANTS_API_ERRORS_TH,
} from '../labels/session';
import { isSelected, readScreen, type ScreenNode } from '../support/page-source';
import { type ElementSpec, shownInSource, tap } from './locators';

/** ระยะ (จุดบนจอ) ที่ยังนับว่าอยู่แถวเดียวกับแถบแท็บ */
const TAB_ROW_TOLERANCE = 8;

/** ข้อความภายในที่ใช้แยก "หมดเวลา" ออกจากข้อผิดพลาดอื่นของ browser.waitUntil (วิธีเดียวกับ src/support/wait.ts) */
const WAIT_TIMED_OUT = 'AgentHomeScreen.waitUntilShown: timed out';

/** ชื่อแท็บแต่ละแท็บในทุกภาษาที่ชุดเทสรู้จัก */
const TAB_LABELS: Record<AgentTab, string[]> = Object.fromEntries(
  AGENT_TABS.map((tab) => [tab, sessionInEveryLanguage((labels) => labels.agentTabs[tab])]),
) as Record<AgentTab, string[]>;

/** ชื่อหน้าที่ใช้ในชื่อ testID ที่เสนอ (รูปแบบ หน้าจอ.ชิ้นส่วน) และในข้อความเมื่อเทสไม่ผ่าน */
const PAGE_ID: Record<DataTab, string> = { listingRoom: 'rooms', listingLead: 'leads', clients: 'tenants' };
const PAGE_NAME: Record<DataTab, string> = { listingRoom: 'ห้อง', listingLead: 'ลีด', clients: 'ผู้เช่า' };

const MENU_BUTTON: ElementSpec = {
  description: 'ปุ่ม Menu บนส่วนหัว',
  testId: 'header.menu',
  labels: [FIXED_LABELS.menu],
  // แท็บ "เมนู" ของผู้เยี่ยมชมในภาษาอังกฤษชื่อ "Menu" เหมือนกันแต่เป็นชนิด Other
  types: ['XCUIElementTypeButton'],
};

const WORKSPACE_LABEL: ElementSpec = {
  description: 'ป้ายพื้นที่ทำงานนายหน้าบนส่วนหัว',
  testId: 'header.workspaceLabel',
  labels: sessionInEveryLanguage((labels) => labels.workspaceLabel),
};

/**
 * เทียบข้อความของป้ายพื้นที่ทำงานโดยไม่สนตัวพิมพ์เล็กใหญ่ (ใช้เมื่อแอปยังไม่มี testID ของป้ายนี้)
 *   แอปแสดงป้ายนี้เป็นตัวพิมพ์ใหญ่ด้วย style textTransform: 'uppercase'
 *   (packages/ui/src/components/MobileWorkspaceHeader.tsx บรรทัด 115 และ MobileSectionHeader.tsx บรรทัด 243 ที่ commit f9b9bea)
 *   iOS จึงรายงานชื่อเป็น "AGENT WORKSPACE" ทั้งที่ข้อความใน en.ts คือ "Agent workspace"
 *   (เห็นบนเครื่องจริงในขั้นที่ 35 รอบภาษาอังกฤษ 12 ต.ค. 2026 10:41 น.) อักษรไทยไม่มีตัวพิมพ์ใหญ่เล็ก รอบภาษาไทยจึงเทียบเหมือนเดิม
 */
const WORKSPACE_LABEL_TEXTS = WORKSPACE_LABEL.labels.map((text) => text.toLowerCase());
const isWorkspaceLabel = (node: ScreenNode): boolean =>
  WORKSPACE_LABEL_TEXTS.includes(node.label.toLowerCase()) || WORKSPACE_LABEL_TEXTS.includes(node.name.toLowerCase());

const LOADER: ElementSpec = {
  description: 'ตัวโหลดของหน้า',
  testId: 'common.loader',
  labels: sessionInEveryLanguage((labels) => labels.loading),
};

/**
 * ข้อความโหลดไม่สำเร็จของแต่ละหน้า หน้าผู้เช่ารวมข้อความ error ของ API ที่หน้านั้นแสดงตรง ๆ ด้วย (TENANTS_API_ERRORS_TH กับ _EN)
 * testID ที่เสนออยู่กับข้อความ error ของรายการ ซึ่งจะหาเจอได้แม้แอปแสดงข้อความ error ที่ได้รับมาตรง ๆ
 */
const TENANTS_API_ERRORS = [...TENANTS_API_ERRORS_TH, ...TENANTS_API_ERRORS_EN];
const LOAD_ERRORS: ElementSpec[] = DATA_TABS.map((tab) => ({
  description: `ข้อความโหลดไม่สำเร็จของหน้า${PAGE_NAME[tab]}`,
  testId: `${PAGE_ID[tab]}.loadError`,
  labels: [...sessionInEveryLanguage((labels) => labels.loadErrors[tab]), ...(tab === 'clients' ? TENANTS_API_ERRORS : [])],
}));

/**
 * ปุ่มลองใหม่ของหน้าห้องและหน้าลีด (ไม่ระบุชนิด: ชื่อนี้ไม่มีในเนื้อหาของหน้าเหล่านี้ตอนโหลดสำเร็จ)
 * 2 หน้าใช้ชื่อปุ่มเดียวกัน จึงหาเฉพาะปุ่มของหน้าที่เปิดอยู่ เพื่อให้รายงาน [วิธีหาชิ้นส่วน] บอกปุ่มถูกตัว
 */
const RETRY_BUTTONS: Partial<Record<DataTab, ElementSpec>> = Object.fromEntries(
  RETRY_TABS.map((tab: RetryTab) => [
    tab,
    {
      description: `ปุ่มลองใหม่ของหน้า${PAGE_NAME[tab]}`,
      testId: `${PAGE_ID[tab]}.retry`,
      labels: sessionInEveryLanguage((labels) => labels.retryButtons[tab]),
    },
  ]),
);

function tabSpec(tab: AgentTab): ElementSpec {
  return {
    description: `แท็บ "${TAB_LABELS[tab][0]}" ของนายหน้า`,
    testId: `tab.${tab}`,
    labels: TAB_LABELS[tab],
    // ข้อความชื่อเดียวกับแท็บในเนื้อหาของหน้าเป็นชนิด StaticText (ขั้นที่ 34) จึงระบุชนิด
    types: ['XCUIElementTypeOther'],
  };
}

/**
 * ตำแหน่งแนวตั้ง (y) ของแถบแท็บ: ระดับที่มีแท็บต่างกันอย่างน้อย 4 แท็บอยู่ใกล้กัน (ถ้าเท่ากัน เลือกแถวที่ต่ำกว่า เพราะแถบแท็บอยู่ล่างจอ)
 * คืน undefined ถ้าหาไม่ได้ เช่น โครงสร้างหน้าจอไม่มีค่า y หรือเห็นแท็บน้อยกว่า 4 แท็บ
 */
function tabRowY(candidates: Record<AgentTab, ScreenNode[]>): number | undefined {
  const found = AGENT_TABS.flatMap((tab) => candidates[tab].filter((node) => !Number.isNaN(node.y)).map((node) => ({ tab, y: node.y })));
  let best: number | undefined;
  let bestCount = 0;
  for (const { y } of found) {
    const count = new Set(found.filter((other) => Math.abs(other.y - y) <= TAB_ROW_TOLERANCE).map((other) => other.tab)).size;
    if (count > bestCount || (count === bestCount && best !== undefined && y > best)) {
      best = y;
      bestCount = count;
    }
  }
  return bestCount >= 4 ? best : undefined;
}

/**
 * ชิ้นส่วนของแต่ละแท็บ: ชิ้นที่มองเห็นตาม tabSpec ถ้ารู้แถวของแถบแท็บ ต้องอยู่ในแถวนั้น
 * แท็บที่หาได้ 0 ชิ้น หรือมากกว่า 1 ชิ้น จะไม่อยู่ในผล (ถือว่าเห็นแท็บนั้นไม่ชัด)
 */
function pickTabs(nodes: readonly ScreenNode[]): Partial<Record<AgentTab, ScreenNode>> {
  const candidates = Object.fromEntries(AGENT_TABS.map((tab) => [tab, shownInSource(nodes, tabSpec(tab))])) as Record<AgentTab, ScreenNode[]>;
  const rowY = tabRowY(candidates);
  const picked: Partial<Record<AgentTab, ScreenNode>> = {};
  for (const tab of AGENT_TABS) {
    const inRow = rowY === undefined ? candidates[tab] : candidates[tab].filter((node) => Math.abs(node.y - rowY) <= TAB_ROW_TOLERANCE);
    if (inRow.length === 1) picked[tab] = inRow[0];
  }
  return picked;
}

export class AgentHomeScreen {
  // ---------- สถานะของหน้า (อ่านจากโครงสร้างหน้าจอ) ----------

  /**
   * รอจนผู้ใช้เห็นหน้าของนายหน้า: ปุ่ม Menu และแท็บครบ 5 แท็บ (ทุกแท็บของนายหน้ามี 2 อย่างนี้)
   * ถ้าหมดเวลา ข้อความบอกว่าขาดอะไร
   */
  async waitUntilShown(timeoutMs: number = env.waitMs): Promise<void> {
    // รายการที่ยังไม่เห็นจากการอ่านครั้งล่าสุด ใช้บอกในข้อความเมื่อหมดเวลา
    let missing: string[] = [];
    try {
      await browser.waitUntil(
        async () => {
          const nodes = await readScreen();
          const tabs = pickTabs(nodes);
          missing = [
            ...(shownInSource(nodes, MENU_BUTTON).length > 0 ? [] : ['ปุ่ม Menu']),
            ...AGENT_TABS.filter((tab) => tabs[tab] === undefined).map((tab) => `แท็บ "${TAB_LABELS[tab][0]}"`),
          ];
          return missing.length === 0;
        },
        { timeout: timeoutMs, interval: 250, timeoutMsg: WAIT_TIMED_OUT },
      );
    } catch (error) {
      // หมดเวลา: บอกว่าขาดอะไร (ข้อความหมดเวลาของ waitUntil ถูกสร้างก่อนเริ่มรอ จึงใส่รายการที่ขาดไว้ในนั้นไม่ได้)
      if (error instanceof Error && error.message === WAIT_TIMED_OUT) {
        throw new Error(`ไม่เห็นหน้าของนายหน้า ภายใน ${timeoutMs / 1000} วินาที (ขาด: ${missing.join(', ')})`);
      }
      throw error;
    }
  }

  /** ตอนนี้ผู้ใช้เห็นส่วนใดส่วนหนึ่งของหน้าของนายหน้าอยู่หรือไม่ (ปุ่ม Menu หรือแท็บของนายหน้าแท็บใดก็ได้) ใช้ตรวจว่าออกจากหน้านี้แล้ว */
  async isShown(): Promise<boolean> {
    const nodes = await readScreen();
    return shownInSource(nodes, MENU_BUTTON).length > 0 || AGENT_TABS.some((tab) => shownInSource(nodes, tabSpec(tab)).length > 0);
  }

  /** ป้ายพื้นที่ทำงานนายหน้าแสดงอยู่หรือไม่ (แสดงบนแท็บภาพรวม ห้อง ลีด และเพิ่มเติม ไม่แสดงบนแท็บผู้เช่า) */
  async workspaceLabelShown(): Promise<boolean> {
    return shownInSource(await readScreen(), WORKSPACE_LABEL, isWorkspaceLabel).length > 0;
  }

  /** แท็บที่ผู้ใช้เห็นชัด (มองเห็นและหาได้ชิ้นเดียว) เรียงตามแถบแท็บ */
  async visibleTabs(): Promise<AgentTab[]> {
    const tabs = pickTabs(await readScreen());
    return AGENT_TABS.filter((tab) => tabs[tab] !== undefined);
  }

  /** แท็บที่ traits บอกว่าถูกเลือก เรียงตามแถบแท็บ (ปกติมี 1 แท็บ) */
  async selectedTabs(): Promise<AgentTab[]> {
    const tabs = pickTabs(await readScreen());
    return AGENT_TABS.filter((tab) => {
      const node = tabs[tab];
      return node !== undefined && isSelected(node);
    });
  }

  /**
   * สิ่งที่บอกว่าโหลดรายการไม่สำเร็จ ที่แสดงอยู่ตอนนี้ (ว่าง = ไม่มี): ข้อความโหลดไม่สำเร็จของหน้าห้อง ลีด ผู้เช่า (ดูทุกหน้า)
   * และปุ่มลองใหม่ของหน้าที่เปิดอยู่ (tab) คืนข้อความที่เห็นบนจอ (ถ้าหาเจอด้วย testID คือข้อความ error ที่แอปแสดงจริง) ไม่ซ้ำกัน
   * ขึ้นต้นด้วยชื่อหน้าที่เปิดอยู่ เช่น "ห้อง: ลองใหม่" เพราะบางข้อความใช้ซ้ำหลายหน้า (ปุ่มลองใหม่ของหน้าห้องกับหน้าลีดชื่อเดียวกัน)
   */
  async loadFailuresShown(tab: DataTab): Promise<string[]> {
    const nodes = await readScreen();
    const retry = RETRY_BUTTONS[tab];
    const specs = retry === undefined ? LOAD_ERRORS : [...LOAD_ERRORS, retry];
    const texts = specs.flatMap((spec) => shownInSource(nodes, spec).map((node) => node.label || node.name));
    return [...new Set(texts)].map((text) => `${PAGE_NAME[tab]}: ${text}`);
  }

  /**
   * รอจนตัวโหลด ("กำลังโหลด…") ไม่แสดงแล้ว ใช้หลังแตะแท็บที่โหลดรายการจาก API
   * ตัวโหลดหายเมื่อโหลดเสร็จ หรือเมื่อโหลดไม่สำเร็จ ไฟล์เทสจึงต้องตรวจต่อเองว่าไม่มีสิ่งที่บอกว่าโหลดไม่สำเร็จ (loadFailuresShown)
   */
  async waitUntilLoaded(timeoutMs: number): Promise<void> {
    await browser.waitUntil(async () => shownInSource(await readScreen(), LOADER).length === 0, {
      timeout: timeoutMs,
      interval: 250,
      timeoutMsg: `ตัวโหลด ("${LOADER.labels.join('" หรือ "')}") ยังแสดงอยู่หลังรอ ${timeoutMs / 1000} วินาที`,
    });
  }

  // ---------- การสั่งงาน ----------

  /** แตะแท็บของนายหน้า (รอให้แท็บหยุดเคลื่อนที่ก่อน: แถบแท็บเลื่อนหายเมื่อเลื่อนจอ MobileModePage.tsx บรรทัด 79 ถึง 118) */
  async tapTab(tab: AgentTab): Promise<void> {
    await tap(tabSpec(tab));
  }

  /** แตะปุ่ม Menu เพื่อเปิดลิ้นชักเมนู (ดู ProfileDrawer) */
  async openMenu(): Promise<void> {
    await tap(MENU_BUTTON);
  }
}
