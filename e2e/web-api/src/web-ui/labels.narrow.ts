/**
 * ข้อความบนหน้าเว็บจอแคบที่ชุด tests/web-ui-narrow ใช้หาชิ้นส่วนและเป็นค่าที่คาด (ภาษาอังกฤษอย่างเดียว)
 *
 * ที่มา: packages/i18n/src/locales/en.ts ที่ qa/e2e 74b46f4 คอมเมนต์ท้ายบรรทัดคือ key กับเลขบรรทัด (เปิดไฟล์ตรวจค่าตาม key ในห้องทดลอง 9 พ.ย. 2026)
 *   ข้อความที่แอปเขียนตรงในโค้ด (ไม่ผ่าน i18n) ระบุไฟล์และบรรทัดของโค้ดแทน
 * ชุดจอแคบรันเป็นภาษาอังกฤษเสมอ (playwright.web-ui-narrow.config.ts ใช้ค่าตั้งของชุด UI เว็บที่ตั้ง E2E_WEB_LOCALE=en)
 * ข้อความที่ชุดอื่นมีอยู่แล้วใช้จาก labels.ts (FLOW, PARTY_COPY) ไม่ซ้ำที่นี่
 */

/** ข้อความที่ใช้หลายที่ในไฟล์นี้ */
const LIVING = 'Living'; // mobile.tabs.living :55
const COMING_SOON = 'Coming soon'; // agent.dashboard.comingSoon :2215

/** ชื่อแท็บล่าง (aria-label = t.mobile.tabs[key]: packages/ui/src/components/MobileBottomTabBar.tsx:154, :164) */
export const TAB = {
  home: 'Home', // mobile.tabs.home :53
  search: 'Search', // mobile.tabs.search :54
  living: LIVING, // mobile.tabs.living :55
  /**
   * แท็บ Living ของผู้เช่าที่ปิดไว้ (comingSoon: mobileTabMatrix.ts ที่ pre/dev/review fc1a351)
   *   aria-label = "<ชื่อแท็บ>, <agent.dashboard.comingSoon>" (MobileBottomTabBar.tsx accessibilityLabel ที่ fc1a351) และกดไม่ได้
   */
  livingSoon: `${LIVING}, ${COMING_SOON}`,
  bills: 'Bills', // mobile.tabs.bills :56
  dashboard: 'Dashboard', // mobile.tabs.dashboard :57
  listingRoom: 'Listing', // mobile.tabs.listingRoom :59
  listingLead: 'Leads', // mobile.tabs.listingLead :61
  clients: 'Tenants', // mobile.tabs.clients :66
  more: 'More', // mobile.tabs.more :67
  income: 'Income', // mobile.tabs.income :71
  tickets: 'Tickets', // mobile.tabs.tickets :73
  services: 'Services', // mobile.tabs.services :74
  menu: 'More', // mobile.tabs.menu :75
} as const;

/** แท็บของแต่ละบทบาทตามลำดับ (packages/ui/src/config/mobileTabMatrix.ts:15-51 ที่ fc1a351) */
export const ROLE_TABS = {
  guest: [TAB.home, TAB.services, TAB.search, TAB.menu],
  tenant: [TAB.dashboard, TAB.livingSoon, TAB.services, TAB.bills, TAB.menu],
  landlord: [TAB.dashboard, TAB.services, TAB.income, TAB.menu],
  agent: [TAB.dashboard, TAB.listingRoom, TAB.listingLead, TAB.clients, TAB.more],
  admin: [TAB.dashboard, TAB.services, TAB.tickets, TAB.menu],
} as const;

export type NarrowRole = keyof typeof ROLE_TABS;

export const NARROW = {
  // ชื่อปุ่มที่เขียนตรงในโค้ดเป็นภาษาอังกฤษ (ไม่แปลตามภาษาที่เลือก)
  menu: 'Menu', // MobileWorkspaceHeader.tsx:39, MobileSectionHeader.tsx:90
  back: 'Back', // MobileSectionHeader.tsx:90 (หัวหน้าย่อย) และ MobileProfileDrawer.tsx:432, :572 (ในเมนูด้านข้าง 2 ปุ่ม)
  signInHeader: 'Sign in', // MobileHeaderActions.tsx:34 (ปุ่มรูปคนของ guest เปิดเมนูด้านข้าง: app/index.tsx:1896)

  /** ปุ่มเข้าสู่ระบบในเมนูด้านข้างของ guest (MobileButton ไม่มี role: MobileProfileDrawer.tsx:469-473) */
  signInDrawer: 'Sign In', // common.signIn :22
  comingSoon: COMING_SOON, // agent.dashboard.comingSoon :2215 (ต่อท้ายชื่อรายการ ", Coming soon": MobileProfileDrawer.tsx:353)

  // เมนูด้านข้างของนายหน้า (packages/ui/src/config/mobileDrawerMenuMatrix.ts:150-219, ชื่อ = t.mobile.drawerMenu[labelKey])
  drawerCrm: 'CRM', // mobile.drawerMenu.crm :189 (กดแล้วกางรายการย่อย)
  drawerContact: 'Contact', // mobile.drawerMenu.contact :190 (coming soon: agentComingSoon.ts:9)
  drawerCalendar: 'Calendar', // mobile.drawerMenu.calendar :191
  drawerCommission: 'Commission', // mobile.drawerMenu.commission :192 (coming soon เสมอ: mobileDrawerMenuMatrix.ts:209)
  drawerContracts: 'Contracts', // mobile.drawerMenu.agentContracts :193 (coming soon: agentComingSoon.ts:9)
  drawerMoreTools: 'More tools', // mobile.drawerMenu.moreTools :195

  // หน้าลีดแบบมือถือ (components/AgentLeadsScreen.tsx)
  leadsSearch: 'Search name, phone or location', // agent.leads.search :894 (placeholder ของช่องค้น: AgentLeadsScreen.tsx:260)
  leadDetails: 'Lead details', // agent.leads.details :923 (ชื่อแถว "<ค่านี้>: <ชื่อลีด>": AgentLeadsScreen.tsx:435)

  // หน้าห้องแบบมือถือ (components/AgentRoomsScreen.tsx, packages/feature-listing/src/components/MobileAgentListingsBody.tsx)
  roomsSearch: 'Search rooms', // agent.listings.searchRooms :1984 (placeholder: AgentRoomsScreen.tsx:614)
  viewRoom: 'View room', // agent.listings.viewRoom :1988 (ชื่อแถว "<ค่านี้>: <ชื่อประกาศ>": MobileAgentListingsBody.tsx:351, :443)

  // แท็บ More ของนายหน้า (components/AgentMoreToolsBody.tsx:26-31 ชื่อปุ่ม "<ชื่อ>, <คำอธิบาย>" หรือ "<ชื่อ>, Coming soon")
  moreCalendar: 'Calendar', // agent.dashboard.openCalendar :2203
  moreCalendarDesc: 'Appointments and schedule', // agent.dashboard.calendarDesc :2210
  moreContacts: 'Contacts', // agent.dashboard.openContacts :2204

  // ปฏิทิน (components/AgentCalendarScreen.tsx:116-119)
  nextMonth: 'Next month', // agent.calendar.nextMonth :497

  // หัวหน้าของผู้ให้เช่า (getScreenTitle: app/index.tsx:162-163)
  incomeTitle: 'Rental Income', // mobile.screens.income :92
} as const;

/**
 * ข้อมูลถาวรของชุดเขียนข้อมูลที่ชุดจอแคบใช้เป็นคำค้น (ไม่ใช่ข้อมูลของลูกค้าจริง)
 * ค่าเดียวกับ src/web-ui/write/web-write-env.ts และ src/write/qa-dataset.ts คัดลอกมา ไม่ import
 *   เพราะชุดอ่านอย่างเดียวไม่ควรโหลดโมดูลของชุดเขียนข้อมูล (web-write-env.ts โหลด write-guard.ts)
 */
export const QA_DATA = {
  leadName: 'E2E-QA-LEAD-1', // QA_LEAD_LABEL ชื่อของลีดถาวร
  roomTitle: 'E2E-QA-ROOM-1', // QA_ROOM_LABEL ชื่อประกาศของห้องถาวร
} as const;
