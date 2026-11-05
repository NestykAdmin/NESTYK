/**
 * ข้อความของหน้าหลังล็อกอินที่ชุดเทส session ใช้ (หน้าของนายหน้า ลิ้นชักเมนู แผงตั้งค่าแอป และหน้าของผู้เยี่ยมชม)
 *
 * ที่มา: packages/i18n/src/locales/th.ts และ en.ts ที่ develop bc77a8b (qa/e2e f1bbdc9 ; เดิมอ้าง feefcf2 ; เลขบรรทัดของ 2 ไฟล์เท่ากัน) คอมเมนต์ท้ายบรรทัดคือ key กับเลขบรรทัด
 * แยกจาก th.ts กับ en.ts ของโฟลเดอร์นี้ เพราะชุดเทสหลัก 14 ข้อไม่ใช้ข้อความกลุ่มนี้ การเพิ่มที่นี่จึงไม่แตะชนิดข้อมูล Labels ของชุดหลัก
 * เหตุผลที่ชุดเทสเก็บข้อความเอง ไม่ดึงจากโค้ดของแอป: ดูหัวไฟล์ src/labels/index.ts
 *
 * ข้อความในไฟล์นี้เป็นข้อความต้นทางตาม th.ts กับ en.ts ถ้าแอปแสดงต่างออกไปด้วย style (เช่น ป้ายพื้นที่ทำงานเป็นตัวพิมพ์ใหญ่)
 *   ให้จัดการตอนเทียบในไฟล์หน้าจอ (ดู isWorkspaceLabel ใน src/screens/AgentHomeScreen.ts)
 * ผลรันบนเครื่องจริงของแต่ละภาษาอยู่ใน README.md หัวข้อ "ชุด session" ส่วนข้อจำกัดที่รู้
 */
import type { AppLanguage } from '../config/env';

/** key ของแท็บของนายหน้า (ชื่อเดียวกับในแอป) เรียงตามแถบแท็บ: packages/ui/src/config/mobileTabMatrix.ts บรรทัด 36 ถึง 42 */
export const AGENT_TABS = ['dashboard', 'listingRoom', 'listingLead', 'clients', 'more'] as const;
export type AgentTab = (typeof AGENT_TABS)[number];

/**
 * แท็บที่ชุดเทสตรวจว่าโหลดรายการจาก API สำเร็จตอนเปิด
 * แท็บเพิ่มเติมไม่เรียก API (AgentMoreToolsBody.tsx) ส่วนแท็บภาพรวม ตั้งแต่ develop f845ac6 เรียก GET /agent/dashboard
 * (useAgentDashboard ใน apps/consumer-app/app/index.tsx บรรทัด 811-818 ที่ 9644dd9 และ bc77a8b ส่วนก่อน f845ac6 หน้านี้ใช้ข้อมูลจำลอง) ชุด session ที่ล็อกอินเป็น agent จึงเรียกเส้นทางนี้จริง
 * ซึ่งอ่านอย่างเดียว (agent-dashboard.service.ts ที่ 9644dd9 และ bc77a8b ไม่มีคำสั่งเขียน) แต่ยังไม่อยู่ในรายการนี้
 * เพราะข้อความโหลดไม่สำเร็จของหน้าภาพรวม (agent.dashboard.webOverview.loadFailed) ยังไม่อยู่ใน labels: ภาษาไทยตรงกับ leads.loadError ที่เก็บไว้แล้ว
 * แต่ภาษาอังกฤษต่างกัน และแอปแสดงข้อความนี้แยกทีละส่วนของหน้า (packages/feature-listing/src/components/MobileAgentDashboardBody.tsx บรรทัด 199)
 * ส่วนตัวโหลดของหน้าภาพรวมใช้ common.loading ซึ่งเก็บไว้แล้ว (index.tsx บรรทัด 903 ถึง 908 และ MobileAgentDashboardBody.tsx บรรทัด 194)
 */
export const DATA_TABS = ['listingRoom', 'listingLead', 'clients'] as const;
export type DataTab = (typeof DATA_TABS)[number];

/** แท็บที่มีปุ่มลองใหม่เมื่อโหลดไม่สำเร็จ (หน้าผู้เช่าไม่มีปุ่มนี้: AgentTenantsScreen.tsx บรรทัด 792 ถึง 796 ที่ develop bc77a8b) */
export const RETRY_TABS = ['listingRoom', 'listingLead'] as const;
export type RetryTab = (typeof RETRY_TABS)[number];

export interface SessionLabels {
  /** ชื่อแท็บของนายหน้า (mobile.tabs.<key>) */
  agentTabs: Record<AgentTab, string>;
  /** แท็บแรกของผู้เยี่ยมชม */
  guestHomeTab: string;
  /**
   * ป้ายใต้ชื่อหน้าบนส่วนหัว: แท็บภาพรวม ห้อง ลีด และเพิ่มเติม แสดงป้ายนี้ ส่วนแท็บผู้เช่าแสดงคำอธิบายรายการแทน
   * (apps/consumer-app/app/index.tsx บรรทัด 590 ถึง 606 และ 636 ถึง 646 ที่ develop bc77a8b ขั้นที่ 34 เห็นป้ายนี้บนหน้าภาพรวม ห้อง และเพิ่มเติม ส่วนหน้าผู้เช่าเห็น "รายชื่อผู้เช่าทั้งหมด")
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
   * หน้าลีดแสดงข้อความตั้งต้นเป็นหัวข้อทุกครั้งที่มี error (AgentLeadsScreen.tsx บรรทัด 341 ถึง 360)
   * หน้าห้องแสดงเป็นหัวข้อเมื่อยังไม่มีรายการ (packages/feature-listing/src/components/MobileAgentListingsBody.tsx บรรทัด 553 ถึง 565)
   * ส่วนหน้าผู้เช่าแสดงแค่ข้อความ error ข้อความเดียว (AgentTenantsScreen.tsx บรรทัด 792 ถึง 796) ผลต่อข้อ 3 ของชุด session ดู README หัวข้อ "ชุด session"
   */
  loadErrors: Record<DataTab, readonly string[]>;
  /** ชื่อปุ่มลองใหม่ที่แสดงคู่กับข้อความ error ของหน้าห้องและหน้าลีด ชื่อนี้ไม่เปลี่ยนตามข้อความของ error */
  retryButtons: Record<RetryTab, string>;
  /**
   * คำว่า "เร็ว ๆ นี้" ที่แอปต่อท้ายชื่อกำกับของแถวและปุ่มที่ยังไม่เปิดใช้ (รูปแบบ "<ชื่อ>, <คำนี้>")
   * และเป็นข้อความของแผงแจ้งเตือนเมื่อไม่มีรายการ (agent.dashboard.comingSoon)
   */
  comingSoon: string;
  /** ชื่อแถวในลิ้นชักเมนูของนายหน้า (mobile.drawerMenu.<key>) ที่ชุดเทสตรวจ ดู DRAWER_ROWS */
  drawerRows: Record<DrawerRow, string>;
  /** ชื่อปุ่มลัดในแท็บเพิ่มเติมของนายหน้า (agent.dashboard.open*) ดู MORE_SHORTCUTS */
  moreShortcuts: Record<MoreShortcut, string>;
  /** คำอธิบายของปุ่มลัดปฏิทิน แอปต่อท้ายชื่อปุ่มที่เปิดใช้ได้ด้วยคำอธิบาย (รูปแบบ "<ชื่อ>, <คำอธิบาย>") */
  calendarDesc: string;
  /** หัวข้อของแผงแจ้งเตือน (mobile.notifications.title) */
  notificationsTitle: string;
}

/**
 * แถวในลิ้นชักเมนูของนายหน้าที่ชุดเทสตรวจ: packages/ui/src/config/mobileDrawerMenuMatrix.ts บรรทัด 150 ถึง 219 (qa/e2e f8be525)
 *   - crm: กลุ่มที่กางในที่ มี contact กับ calendar อยู่ข้างใน (บรรทัด 190 ถึง 193)
 *   - contact กับ agentContracts: comingSoon ตาม isAgentComingSoonTab (บรรทัด 192 และ 201) ซึ่งรายการคือ contact, contracts, services
 *     (packages/ui/src/config/agentComingSoon.ts บรรทัด 9)
 *   - commission: comingSoon: true ตรง ๆ (บรรทัด 203 ถึง 210)
 *   - calendar กับ moreTools: ไม่ใช่ comingSoon ใช้เป็นตัวเทียบว่าแถวที่เปิดใช้ได้กดได้จริง (บรรทัด 193 และ 211 ถึง 216)
 */
export const DRAWER_ROWS = ['crm', 'contact', 'calendar', 'commission', 'agentContracts', 'moreTools'] as const;
export type DrawerRow = (typeof DRAWER_ROWS)[number];

/** ปุ่มลัดในแท็บเพิ่มเติม: apps/consumer-app/components/AgentMoreToolsBody.tsx บรรทัด 26 ถึง 31 ที่ qa/e2e f8be525 (calendar เปิดใช้ได้ อีก 3 ปุ่มเป็น comingSoon) */
export const MORE_SHORTCUTS = ['calendar', 'contacts', 'services', 'contracts'] as const;
export type MoreShortcut = (typeof MORE_SHORTCUTS)[number];

const th: SessionLabels = {
  agentTabs: {
    dashboard: 'Dashboard', // mobile.tabs.dashboard บรรทัด 45
    listingRoom: 'Listing', // mobile.tabs.listingRoom บรรทัด 47
    listingLead: 'ลีด', // mobile.tabs.listingLead บรรทัด 49
    clients: 'ผู้เช่า', // mobile.tabs.clients บรรทัด 54
    more: 'เพิ่มเติม', // mobile.tabs.more บรรทัด 55
  },
  guestHomeTab: 'หน้าแรก', // mobile.tabs.home บรรทัด 41
  workspaceLabel: 'พื้นที่ทำงานนายหน้า', // agent.dashboard.workspaceLabel บรรทัด 1943
  appSettings: 'ตั้งค่าแอป', // mobile.profile.accountSettings บรรทัด 153
  signOut: 'ออกจากระบบ', // common.signOut บรรทัด 19
  signedOut: 'ออกจากระบบแล้ว', // mobile.auth.signedOut บรรทัด 298
  loading: 'กำลังโหลด…', // common.loading บรรทัด 13
  loadErrors: {
    listingRoom: ['โหลดรายการห้องไม่สำเร็จ'], // agent.listings.loadError บรรทัด 1871
    listingLead: ['โหลดข้อมูลไม่สำเร็จ'], // agent.leads.loadError บรรทัด 942
    clients: [
      'โหลดผู้เช่าไม่สำเร็จ', // agent.tenants.list.loadError บรรทัด 723
      'โหลดสลิปรอตรวจไม่สำเร็จ', // agent.tenants.list.slipsLoadError บรรทัด 725 (แสดงเมื่อโหลดสลิปไม่สำเร็จ: AgentTenantsScreen.tsx บรรทัด 229 ถึง 236)
    ],
  },
  retryButtons: {
    listingRoom: 'ลองใหม่', // agent.listings.retry บรรทัด 1872
    listingLead: 'ลองใหม่', // agent.leads.retry บรรทัด 943
  },
  // ข้อความ 5 ช่องข้างล่างอ่านที่ qa/e2e f8be525 (ไม่ใช่ bc77a8b เหมือนช่องข้างบน)
  //   comingSoon ใช้ agent.dashboard.comingSoon ซึ่งเป็นคีย์ที่ลิ้นชัก แท็บเพิ่มเติม และแผงแจ้งเตือนใช้จริง ไม่ใช่ mobile.roleHome.comingSoon (บรรทัด 50 ค่าเดียวกัน)
  comingSoon: 'เร็ว ๆ นี้', // agent.dashboard.comingSoon บรรทัด 2143
  drawerRows: {
    crm: 'CRM', // mobile.drawerMenu.crm บรรทัด 189
    contact: 'ติดต่อ', // mobile.drawerMenu.contact บรรทัด 190
    calendar: 'ปฏิทิน', // mobile.drawerMenu.calendar บรรทัด 191
    commission: 'ค่าคอมมิชชั่น', // mobile.drawerMenu.commission บรรทัด 192
    agentContracts: 'สัญญา', // mobile.drawerMenu.agentContracts บรรทัด 193
    moreTools: 'เครื่องมือเพิ่มเติม', // mobile.drawerMenu.moreTools บรรทัด 195
  },
  moreShortcuts: {
    calendar: 'ปฏิทิน', // agent.dashboard.openCalendar บรรทัด 2131
    contacts: 'ผู้ติดต่อ', // agent.dashboard.openContacts บรรทัด 2132
    services: 'บริการ', // agent.dashboard.openServices บรรทัด 2130
    contracts: 'คลังสัญญา', // agent.dashboard.openContracts บรรทัด 2134
  },
  calendarDesc: 'นัดหมายและกำหนดการ', // agent.dashboard.calendarDesc บรรทัด 2138
  notificationsTitle: 'การแจ้งเตือน', // mobile.notifications.title บรรทัด 98
};

const en: SessionLabels = {
  agentTabs: {
    dashboard: 'Dashboard', // mobile.tabs.dashboard บรรทัด 45
    listingRoom: 'Listing', // mobile.tabs.listingRoom บรรทัด 47
    listingLead: 'Leads', // mobile.tabs.listingLead บรรทัด 49
    clients: 'Tenants', // mobile.tabs.clients บรรทัด 54
    more: 'More', // mobile.tabs.more บรรทัด 55
  },
  guestHomeTab: 'Home', // mobile.tabs.home บรรทัด 41
  workspaceLabel: 'Agent workspace', // agent.dashboard.workspaceLabel บรรทัด 1943
  appSettings: 'App Settings', // mobile.profile.accountSettings บรรทัด 153
  signOut: 'Sign Out', // common.signOut บรรทัด 19
  signedOut: 'You have been signed out.', // mobile.auth.signedOut บรรทัด 298
  loading: 'Loading…', // common.loading บรรทัด 13
  loadErrors: {
    listingRoom: ['Could not load your rooms'], // agent.listings.loadError บรรทัด 1871
    listingLead: ['Could not load data'], // agent.leads.loadError บรรทัด 942
    clients: [
      'Could not load tenants', // agent.tenants.list.loadError บรรทัด 723
      'Could not load slips to review', // agent.tenants.list.slipsLoadError บรรทัด 725
    ],
  },
  retryButtons: {
    listingRoom: 'Retry', // agent.listings.retry บรรทัด 1872
    listingLead: 'Retry', // agent.leads.retry บรรทัด 943
  },
  // ข้อความ 5 ช่องข้างล่างอ่านที่ qa/e2e f8be525 (เลขบรรทัดเท่ากับ th.ts)
  comingSoon: 'Coming soon', // agent.dashboard.comingSoon บรรทัด 2143
  drawerRows: {
    crm: 'CRM', // mobile.drawerMenu.crm บรรทัด 189
    contact: 'Contact', // mobile.drawerMenu.contact บรรทัด 190
    calendar: 'Calendar', // mobile.drawerMenu.calendar บรรทัด 191
    commission: 'Commission', // mobile.drawerMenu.commission บรรทัด 192
    agentContracts: 'Contracts', // mobile.drawerMenu.agentContracts บรรทัด 193
    moreTools: 'More tools', // mobile.drawerMenu.moreTools บรรทัด 195
  },
  moreShortcuts: {
    calendar: 'Calendar', // agent.dashboard.openCalendar บรรทัด 2131
    contacts: 'Contacts', // agent.dashboard.openContacts บรรทัด 2132
    services: 'Services', // agent.dashboard.openServices บรรทัด 2130
    contracts: 'Contracts archive', // agent.dashboard.openContracts บรรทัด 2134
  },
  calendarDesc: 'Appointments and schedule', // agent.dashboard.calendarDesc บรรทัด 2138
  notificationsTitle: 'Notifications', // mobile.notifications.title บรรทัด 98
};

const ALL: Record<AppLanguage, SessionLabels> = { th, en };

/**
 * ข้อความ error ภาษาไทยของ API ที่หน้าผู้เช่าแสดงตรง ๆ ในรอบภาษาไทย (เป็นข้อความของ API ไม่ใช่ของแอป จึงไม่อยู่ใน th.ts)
 * หน้าผู้เช่าไม่มีหัวข้อหรือปุ่มลองใหม่ให้จับแทน (AgentTenantsScreen.tsx บรรทัด 792 ถึง 796) ข้อ 3 จึงต้องรู้จักตัวข้อความ
 * ในรอบภาษาอังกฤษ แอปแสดงข้อความตั้งต้นของแอปแทนข้อความเหล่านี้ (packages/i18n/src/error-message.ts บรรทัด 26 ถึง 28)
 * ที่มา (apps/api/src ที่ develop bc77a8b ส่วนฉบับก่อนอ้าง feefcf2): หน้าผู้เช่าเรียก GET /agent/tenants ซึ่งขอ URL ของเอกสารสัญญาด้วยเมื่อมีสัญญาที่มีเอกสาร
 *   (agent/tenants/agent-tenants.service.ts บรรทัด 192 ถึง 198, agent/contracts/agent-contracts.service.ts บรรทัด 1118 ถึง 1122 และ 1043 ถึง 1061)
 *   ถ้าที่เก็บเอกสารใช้ไม่ได้ API ตอบข้อความในรายการนี้ (agent/contracts/contract-document-storage.service.ts บรรทัด 35, 40, 53, 68 และ 438)
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
 * ที่มา (develop bc77a8b ส่วนฉบับก่อนอ้าง feefcf2): GET /agent/tenants ผ่าน AuthGuard และ RolesGuard ที่ต้องการบทบาท agent (apps/api/src/agent/tenants/agent-tenants.controller.ts บรรทัด 27 ถึง 29)
 *   - apps/api/src/auth/guards/auth.guard.ts บรรทัด 39, 44 และ 87 กับ auth/guards/roles.guard.ts บรรทัด 29 และ 34
 *     (ไม่ใส่ข้อความของ auth.guard.ts บรรทัด 68 และ 80 ถึง 82 เพราะถ้าเกิด 2 กรณีนั้น การล็อกอินในขั้นเตรียมพังก่อน:
 *     แอปใช้ token เดียวกันเรียก /auth/sync ตอนล็อกอิน apps/consumer-app/lib/auth/AuthContext.tsx บรรทัด 52 ถึง 54, 183 และ 210)
 *   - apps/consumer-app/lib/api.ts บรรทัด 159: เมื่อคำตอบไม่มี message แอปใช้ "HTTP <รหัส>" (รายการนี้ใส่เฉพาะรหัส 500 ถึง 504)
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
 * แท็บ mobile.tabs.menu (บรรทัด 63) ของผู้เยี่ยมชมเปลี่ยนชื่อเป็น "More"/"เพิ่มเติม" แล้ว (ประชุม 2 พ.ย. 2026) จึงไม่ชนกับปุ่ม "Menu" อีก
 */
export const FIXED_LABELS = {
  menu: 'Menu',
  /** ปุ่มระฆังบนส่วนหัวของหน้าภาพรวม: packages/ui/src/components/MobileWorkspaceHeader.tsx บรรทัด 61 ถึง 67 ที่ qa/e2e f8be525 (ชื่อเดียวกับหัวข้อแผงแจ้งเตือนภาษาอังกฤษ จึงต้องระบุชนิด) */
  notifications: 'Notifications',
} as const;
