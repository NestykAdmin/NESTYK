/**
 * ข้อความของหน้าหลังล็อกอินที่ชุดเทส session ใช้ (หน้าของนายหน้า ลิ้นชักเมนู แผงตั้งค่าแอป และหน้าของผู้เยี่ยมชม)
 *
 * ที่มา: packages/i18n/src/locales/th.ts และ en.ts ที่ commit feefcf2 (เลขบรรทัดของ 2 ไฟล์เท่ากัน) คอมเมนต์ท้ายบรรทัดคือ key กับเลขบรรทัด
 * แยกจาก th.ts กับ en.ts ของโฟลเดอร์นี้ เพราะชุดเทสหลัก 14 ข้อไม่ใช้ข้อความกลุ่มนี้ การเพิ่มที่นี่จึงไม่แตะชนิดข้อมูล Labels ของชุดหลัก
 * เหตุผลที่ชุดเทสเก็บข้อความเอง ไม่ดึงจากโค้ดของแอป: ดูหัวไฟล์ src/labels/index.ts
 *
 * ข้อจำกัด: ข้อความภาษาอังกฤษใส่ไว้ครบตาม en.ts แต่ ณ 9 ต.ค. 2026 ชุด session ยังรันบนเครื่องจริงเฉพาะภาษาไทย
 */
import type { AppLanguage } from '../config/env';

/** key ของแท็บของนายหน้า (ชื่อเดียวกับในแอป) เรียงตามแถบแท็บ: packages/ui/src/config/mobileTabMatrix.ts บรรทัด 36 ถึง 42 */
export const AGENT_TABS = ['dashboard', 'listingRoom', 'listingLead', 'clients', 'more'] as const;
export type AgentTab = (typeof AGENT_TABS)[number];

/** แท็บที่โหลดรายการจาก API ตอนเปิด (ภาพรวมกับเพิ่มเติมไม่เรียก API: index.tsx บรรทัด 767 ถึง 783 และ AgentMoreToolsBody.tsx) */
export const DATA_TABS = ['listingRoom', 'listingLead', 'clients'] as const;
export type DataTab = (typeof DATA_TABS)[number];

/** แท็บที่มีปุ่มลองใหม่เมื่อโหลดไม่สำเร็จ (หน้าผู้เช่าไม่มีปุ่มนี้: AgentTenantsScreen.tsx บรรทัด 643 ถึง 646) */
export const RETRY_TABS = ['listingRoom', 'listingLead'] as const;
export type RetryTab = (typeof RETRY_TABS)[number];

export interface SessionLabels {
  /** ชื่อแท็บของนายหน้า (mobile.tabs.<key>) */
  agentTabs: Record<AgentTab, string>;
  /** แท็บแรกของผู้เยี่ยมชม */
  guestHomeTab: string;
  /**
   * ป้ายใต้ชื่อหน้าบนส่วนหัว: แท็บภาพรวม ห้อง ลีด และเพิ่มเติม แสดงป้ายนี้ ส่วนแท็บผู้เช่าแสดงคำอธิบายรายการแทน
   * (apps/consumer-app/app/index.tsx บรรทัด 571 ถึง 580 และ 609 ถึง 619 ขั้นที่ 34 เห็นป้ายนี้บนหน้าภาพรวม ห้อง และเพิ่มเติม ส่วนหน้าผู้เช่าเห็น "รายชื่อผู้เช่าทั้งหมด")
   */
  workspaceLabel: string;
  /** แถวในลิ้นชักที่เปิดแผงตั้งค่าแอป */
  appSettings: string;
  /** ปุ่มออกจากระบบในแผงตั้งค่าแอป และหัวเรื่องของหน้าต่างแจ้งหลังออกจากระบบ */
  signOut: string;
  /** ข้อความในหน้าต่างแจ้งหลังออกจากระบบ */
  signedOut: string;
  /** ข้อความใต้ตัวโหลดของหน้าที่กำลังโหลดรายการ */
  loading: string;
  /**
   * ข้อความตั้งต้นเมื่อโหลดรายการของแท็บไม่สำเร็จ
   * แอปแสดงข้อความ error ที่ได้รับแทนข้อความเหล่านี้ ถ้าข้อความนั้นเป็นภาษาเดียวกับแอป (packages/i18n/src/error-message.ts บรรทัด 26 ถึง 28)
   * หน้าลีดแสดงข้อความตั้งต้นเป็นหัวข้อทุกครั้งที่มี error (AgentLeadsScreen.tsx บรรทัด 343 ถึง 360)
   * หน้าห้องแสดงเป็นหัวข้อเมื่อยังไม่มีรายการ (packages/feature-listing/src/components/MobileAgentListingsBody.tsx บรรทัด 541 ถึง 553)
   * ส่วนหน้าผู้เช่าแสดงแค่ข้อความ error ข้อความเดียว (AgentTenantsScreen.tsx บรรทัด 643 ถึง 646) ผลต่อข้อ 3 ของชุด session ดู README หัวข้อ "ชุด session"
   */
  loadErrors: Record<DataTab, readonly string[]>;
  /** ชื่อปุ่มลองใหม่ที่แสดงคู่กับข้อความ error ของหน้าห้องและหน้าลีด ชื่อนี้ไม่เปลี่ยนตามข้อความของ error */
  retryButtons: Record<RetryTab, string>;
}

const th: SessionLabels = {
  agentTabs: {
    dashboard: 'ภาพรวม', // mobile.tabs.dashboard บรรทัด 45
    listingRoom: 'ห้อง', // mobile.tabs.listingRoom บรรทัด 47
    listingLead: 'ลีด', // mobile.tabs.listingLead บรรทัด 49
    clients: 'ผู้เช่า', // mobile.tabs.clients บรรทัด 54
    more: 'เพิ่มเติม', // mobile.tabs.more บรรทัด 55
  },
  guestHomeTab: 'หน้าแรก', // mobile.tabs.home บรรทัด 41
  workspaceLabel: 'พื้นที่ทำงานนายหน้า', // agent.dashboard.workspaceLabel บรรทัด 1736
  appSettings: 'ตั้งค่าแอป', // mobile.profile.accountSettings บรรทัด 145
  signOut: 'ออกจากระบบ', // common.signOut บรรทัด 19
  signedOut: 'ออกจากระบบแล้ว', // mobile.auth.signedOut บรรทัด 289
  loading: 'กำลังโหลด…', // common.loading บรรทัด 13
  loadErrors: {
    listingRoom: ['โหลดรายการห้องไม่สำเร็จ'], // agent.listings.loadError บรรทัด 1682
    listingLead: ['โหลดข้อมูลไม่สำเร็จ'], // agent.leads.loadError บรรทัด 831
    clients: [
      'โหลดผู้เช่าไม่สำเร็จ', // agent.tenants.list.loadError บรรทัด 612
      'โหลดสลิปรอตรวจไม่สำเร็จ', // agent.tenants.list.slipsLoadError บรรทัด 614 (แสดงเมื่อโหลดสลิปไม่สำเร็จ: AgentTenantsScreen.tsx บรรทัด 217 ถึง 222)
    ],
  },
  retryButtons: {
    listingRoom: 'ลองใหม่', // agent.listings.retry บรรทัด 1683
    listingLead: 'ลองใหม่', // agent.leads.retry บรรทัด 832
  },
};

const en: SessionLabels = {
  agentTabs: {
    dashboard: 'Overview', // mobile.tabs.dashboard บรรทัด 45
    listingRoom: 'Rooms', // mobile.tabs.listingRoom บรรทัด 47
    listingLead: 'Leads', // mobile.tabs.listingLead บรรทัด 49
    clients: 'Tenants', // mobile.tabs.clients บรรทัด 54
    more: 'More', // mobile.tabs.more บรรทัด 55
  },
  guestHomeTab: 'Home', // mobile.tabs.home บรรทัด 41
  workspaceLabel: 'Agent workspace', // agent.dashboard.workspaceLabel บรรทัด 1736
  appSettings: 'App Settings', // mobile.profile.accountSettings บรรทัด 145
  signOut: 'Sign Out', // common.signOut บรรทัด 19
  signedOut: 'You have been signed out.', // mobile.auth.signedOut บรรทัด 289
  loading: 'Loading…', // common.loading บรรทัด 13
  loadErrors: {
    listingRoom: ['Could not load your rooms'], // agent.listings.loadError บรรทัด 1682
    listingLead: ['Could not load data'], // agent.leads.loadError บรรทัด 831
    clients: [
      'Could not load tenants', // agent.tenants.list.loadError บรรทัด 612
      'Could not load slips to review', // agent.tenants.list.slipsLoadError บรรทัด 614
    ],
  },
  retryButtons: {
    listingRoom: 'Retry', // agent.listings.retry บรรทัด 1683
    listingLead: 'Retry', // agent.leads.retry บรรทัด 832
  },
};

const ALL: Record<AppLanguage, SessionLabels> = { th, en };

/**
 * ข้อความ error ภาษาไทยของ API ที่หน้าผู้เช่าแสดงตรง ๆ ในรอบภาษาไทย (เป็นข้อความของ API ไม่ใช่ของแอป จึงไม่อยู่ใน th.ts)
 * หน้าผู้เช่าไม่มีหัวข้อหรือปุ่มลองใหม่ให้จับแทน (AgentTenantsScreen.tsx บรรทัด 643 ถึง 646) ข้อ 3 จึงต้องรู้จักตัวข้อความ
 * ในรอบภาษาอังกฤษ แอปแสดงข้อความตั้งต้นของแอปแทนข้อความเหล่านี้ (packages/i18n/src/error-message.ts บรรทัด 26 ถึง 28)
 * ที่มา (apps/api/src ที่ commit feefcf2): หน้าผู้เช่าเรียก GET /agent/tenants ซึ่งขอ URL ของเอกสารสัญญาด้วยเมื่อมีสัญญาที่มีเอกสาร
 *   (agent/tenants/agent-tenants.service.ts บรรทัด 176 ถึง 182, agent/contracts/agent-contracts.service.ts บรรทัด 648 ถึง 653 และ 695 ถึง 699)
 *   ถ้าที่เก็บเอกสารใช้ไม่ได้ API ตอบข้อความในรายการนี้ (agent/contracts/contract-document-storage.service.ts บรรทัด 35, 40, 53, 68 และ 383)
 * ถ้า API เปลี่ยนหรือเพิ่มข้อความบนเส้นทางนี้ ต้องแก้รายการนี้ตาม ไม่อย่างนั้นข้อ 3 ของชุด session จะจับไม่ได้ (README หัวข้อ "ชุด session")
 */
export const TENANTS_API_ERRORS_TH: readonly string[] = [
  'ไม่สามารถตรวจสอบที่เก็บเอกสารสัญญาได้',
  'ที่เก็บเอกสารต้องเป็น private เท่านั้น',
  'ไม่สามารถเตรียมที่เก็บเอกสารสัญญาได้',
  'ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา',
  'ไม่สามารถเปิดเอกสารได้ กรุณาลองอีกครั้ง',
];

/**
 * ข้อความ error ภาษาอังกฤษที่หน้าผู้เช่าแสดงตรง ๆ ในรอบภาษาอังกฤษ (ในรอบภาษาไทย แอปแสดงข้อความตั้งต้นของแอปแทน)
 * ที่มา (commit feefcf2): GET /agent/tenants ผ่าน AuthGuard และ RolesGuard ที่ต้องการบทบาท agent (apps/api/src/agent/tenants/agent-tenants.controller.ts บรรทัด 26 ถึง 28)
 *   - apps/api/src/auth/guards/auth.guard.ts บรรทัด 39, 44 และ 87 กับ auth/guards/roles.guard.ts บรรทัด 29 และ 34
 *     (ไม่ใส่ข้อความของ auth.guard.ts บรรทัด 68 และ 80 ถึง 82 เพราะถ้าเกิด 2 กรณีนั้น การล็อกอินในขั้นเตรียมพังก่อน:
 *     แอปใช้ token เดียวกันเรียก /auth/sync ตอนล็อกอิน apps/consumer-app/lib/auth/AuthContext.tsx บรรทัด 160 ถึง 166)
 *   - apps/consumer-app/lib/api.ts บรรทัด 60: เมื่อคำตอบไม่มี message แอปใช้ "HTTP <รหัส>" (รายการนี้ใส่เฉพาะรหัส 500 ถึง 504)
 *   - ค่าเริ่มต้นของไลบรารี (ไม่อยู่ในโค้ดของทีม และยังไม่เคยเห็นบนเครื่องจริง): "Internal server error" ของ NestJS เมื่อเกิดข้อผิดพลาดที่ไม่ได้ดักไว้
 *     และ "Network request failed" ของ fetch ใน React Native เมื่อต่อ API ไม่ได้
 * ข้อความอังกฤษอื่น เช่น ของ POST /auth/sync ที่หน้าผู้เช่าเรียกก่อน (apps/consumer-app/lib/agent-session.ts บรรทัด 11 ถึง 17) ยังจับไม่ได้
 */
export const TENANTS_API_ERRORS_EN: readonly string[] = [
  'Missing Bearer token',
  'Invalid or expired token',
  'Call POST /auth/sync first',
  'Required role: agent',
  'HTTP 500',
  'HTTP 502',
  'HTTP 503',
  'HTTP 504',
  'Internal server error',
  'Network request failed',
];

/** ข้อความในภาษาที่ระบุ ใช้เป็นค่าที่คาดในเทส */
export function sessionLabelsFor(language: AppLanguage): SessionLabels {
  return ALL[language];
}

/** ข้อความเดียวกันในทุกภาษาที่ชุดเทสรู้จัก ใช้หาชิ้นส่วน (เหตุผลเดียวกับ inEveryLanguage ใน src/labels/index.ts) */
export function sessionInEveryLanguage(pick: (labels: SessionLabels) => string | readonly string[]): string[] {
  return [...new Set(Object.values(ALL).flatMap(pick))];
}

/**
 * ชื่อกำกับที่แอปเขียนเป็นภาษาอังกฤษตายตัว จึงเหมือนกันทุกภาษา
 * ปุ่มเปิดลิ้นชักบนส่วนหัว: MobileWorkspaceHeader.tsx บรรทัด 39 (หน้าภาพรวม) และ MobileSectionHeader.tsx บรรทัด 90 (แท็บอื่น)
 * ระวัง: แท็บ "เมนู" ของผู้เยี่ยมชมในภาษาอังกฤษชื่อ "Menu" เหมือนกัน (mobile.tabs.menu บรรทัด 63) แต่เป็นชนิด Other ไม่ใช่ Button
 */
export const FIXED_LABELS = {
  menu: 'Menu',
} as const;
