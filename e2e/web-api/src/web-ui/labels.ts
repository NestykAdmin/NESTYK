/**
 * ข้อความบนหน้าเว็บ consumer-app ที่ชุดเทส UI ใช้หาชิ้นส่วนและเป็นค่าที่คาด
 *
 * ที่มา: packages/i18n/src/locales/ ที่ qa/e2e 648dd28 (merge pre/dev/review 9821d87) คอมเมนต์ท้ายบรรทัดคือ key กับเลขบรรทัด
 *   ค่าทั้งหมดตรวจด้วยการโหลดไฟล์ locale จริงแล้วเทียบค่าตาม key (ห้องทดลอง 4 พ.ย. 2026 และตรวจซ้ำที่ 648dd28 เมื่อ 6 พ.ย. 2026)
 * ชุดเทสเก็บข้อความเอง ไม่ import จากโค้ดของแอป แบบเดียวกับชุด e2e/mobile (src/labels/)
 *   เหตุผลของชุดนี้: ถ้าทีมแก้ข้อความ เทสต้องแดงให้เห็น ไม่ใช่เปลี่ยนตามเงียบ ๆ และ tsconfig ของชุดนี้ไม่รวมโค้ดนอก e2e/web-api
 *
 * ชุดเทสเปิดเว็บเป็นภาษาอังกฤษ: fixture ตั้ง localStorage '@nestyk/preferred_locale' = 'en' ก่อนโหลดหน้า
 *   (apps/consumer-app/lib/locale-storage.ts:4 และ AsyncStorage บนเว็บเก็บใน localStorage ด้วยชื่อเดียวกัน)
 */

export const EN = {
  // packages/i18n/src/locales/en.ts (mobile.auth.*)
  email: 'Email', // mobile.auth.email :365 (aria-label ของช่องอีเมลในหน้า login, register และ reset-password)
  password: 'Password', // mobile.auth.password :366
  confirmPassword: 'Confirm password', // mobile.auth.confirmPassword :322
  loginButton: 'Log in', // mobile.auth.loginButton :313
  registerButton: 'Create account', // mobile.auth.registerButton :323
  invalidEmail: 'Enter a valid email address.', // mobile.auth.invalidEmail :331
  passwordRules: 'Use at least 8 characters with a number, a lowercase letter and an uppercase letter.', // mobile.auth.passwordRules :333
  acceptTerms: 'I accept the terms of use and the privacy policy.', // mobile.auth.acceptTerms :335 (aria-label ของช่องติ๊กยินยอม)
  acceptTermsRequired: 'Accept the terms of use and the privacy policy.', // mobile.auth.acceptTermsRequired :336
  passwordMismatch: 'The passwords do not match.', // mobile.auth.passwordMismatch :342
  resetSend: 'Send link', // mobile.auth.resetSend :355 (บั๊กข้อ 6 แก้แล้ว เดิม "Send code")
  /** ลิงก์ที่ตรวจกับ Supabase ไม่ผ่าน ตอนกดบันทึกรหัสใหม่ (reset-password.tsx:124, :135) */
  resetLinkInvalid: 'This link has expired or was already used, so your password was not changed. Tap "Back to login", then "Forgot password?" to get a new link.', // mobile.auth.resetLinkInvalid :357
  /** ลิงก์ที่ถูกตัดหรือแก้ (ไม่มี token) หรือ ?code= ที่ล็อกอินไม่ได้ ตอนเปิดหน้า (reset-password.tsx:31, :65) */
  resetLinkBroken: 'This link does not work. Enter your email and tap "Send link" to get a new one.', // mobile.auth.resetLinkBroken :358
  resetNewTitle: 'Set a new password', // mobile.auth.resetNewTitle :359 (เป็นทั้งหัวเรื่องและข้อความบนปุ่มบันทึก)
  sessionExpired: 'Your session has expired. Please sign in again.', // mobile.auth.sessionExpired :371
  firstName: 'First Name', // mobile.account.firstName :235
  lastName: 'Last Name', // mobile.account.lastName :236
  phone: 'Phone Number', // mobile.account.phone :238 (aria-label ของช่องเบอร์ใน PhoneField.tsx:74)

  // บทบาทและ workspace
  signOut: 'Sign Out', // common.signOut :21 (ปุ่มในเมนูบัญชี AgentWorkspace.web.tsx:866-873)
  roleTenant: 'Tenant', // roles.tenant :29
  roleLandlord: 'Landlord', // roles.landlord :30
  roleAgent: 'Agent', // roles.agent :31
  account: 'Your account', // agent.dashboard.webWorkspace.account :2060 (aria-label ของ summary เมนูบัญชี)
  close: 'Close', // agent.dashboard.webWorkspace.close :2064 (ปุ่มปิดของ WebDialog.tsx:55)
  create: 'Create', // agent.dashboard.webWorkspace.create :2067 (aria-label ของปุ่มเปิดเมนู Create)
  comingSoon: 'Coming soon', // agent.dashboard.comingSoon :2215
  navDashboard: 'Dashboard', // mobile.tabs.dashboard :57 (เมนูข้างของนายหน้า menuLabel ใน AgentWorkspace.web.tsx:243-244)
  navLeads: 'Leads', // mobile.tabs.listingLead :61
  navCalendar: 'Calendar', // agent.dashboard.openCalendar :2203
  // การ์ดหน้าแรกของบทบาท (app/index.tsx:1135-1166 ใช้ร่วมกันทุกบทบาท) บั๊กข้อ 8 แก้แล้วที่ 648dd28: หัวข้อมาจาก i18n และไม่มีตัวเลขสมมติ
  adminHomeTitle: 'Admin home', // mobile.roleHome.adminTitle :49
  roleHomeComingSoon: 'Coming soon', // mobile.roleHome.comingSoon :50 (ข้อความในการ์ดของ admin: index.tsx:1141)

  // packages/i18n/src/locales/web-session/en.ts
  idleTitle: 'Are you still there?', // idleTitle :9
  idleSignOut: 'Sign out', // idleSignOut :12
  idleStay: 'Stay signed in', // idleStay :11
  signOutAll: 'Sign out of all devices', // signOutAll :4
  signOutAllTitle: 'Sign out of all devices?', // signOutAllTitle :5
} as const;

/**
 * ข้อความของหน้างาน (flow) ที่เทสอ่านอย่างเดียวใช้ (tests/web-ui/agent-*.spec.ts, party-pages.spec.ts)
 * ที่มาเดียวกับ EN: packages/i18n/src/locales/en.ts ที่ 648dd28 (เท่ากับ qa/e2e d6370ee) คอมเมนต์คือ key และเลขบรรทัด
 *   ตรวจค่าตาม key ด้วยการโหลดไฟล์ locale จริง และหาเลขบรรทัดจากโครงไฟล์ (ห้องทดลอง 6 พ.ย. 2026)
 * ข้อความที่มี {count} {from} ใช้กับ fill() ด้านล่าง
 */
export const FLOW = {
  // หน้าลีด (components/agent-web/AgentLeadsPage.web.tsx)
  leadsCount: '{count} leads', // agent.leads.count :896 (ตัวนับ aria-live ของแถบเครื่องมือ)
  leadsSearch: 'Search name, phone or location', // agent.leads.search :894 (aria-label ของช่องค้น)
  leadsSort: 'Sort by', // agent.leads.sortTitle :944 (aria-label ของตัวเลือกการเรียง)
  leadsStatusGroup: 'Filter by status', // agent.leads.statusFilter :936 (role=group ของชิปสถานะ)
  leadsStatusAll: 'All', // agent.leads.statusAll :934
  leadStatus: {
    new: 'Normal', // agent.leads.statuses.new :928
    inprogress: 'In care', // agent.leads.statuses.inprogress :929
    lost: 'Not proceeding', // agent.leads.statuses.lost :930
    booked: 'Booked', // agent.leads.statuses.booked :931
    viewing: 'Viewing booked', // agent.leads.statuses.viewing :932
  },
  back: 'Back', // agent.createRoom.back :1492 (ปุ่มกลับของหัวหน้าย่อย AgentSectionHeader.web.tsx:33 และ AgentRoomDetailModal.web.tsx:165)

  // ตัวแบ่งหน้า (ใช้ร่วมกันทั้งลีดและห้อง)
  pagerNav: 'Pages', // agent.listings.web.pages :1970
  pageRange: '{from}–{to} of {total}', // agent.listings.web.pageRange :1967
  nextPage: 'Next page', // agent.listings.web.nextPage :1969

  // หน้าห้อง (components/agent-web/AgentRoomsPage.web.tsx)
  roomsCount: '{count} rooms', // agent.listings.results :1987
  roomsSearch: 'Search rooms', // agent.listings.searchRooms :1984
  roomsAvailability: 'Availability', // agent.listings.filterAvailability :2039 (aria-label ของตัวเลือกสถานะห้อง)
  roomAvailable: 'Available', // agent.listings.available :1996 (ป้ายสถานะ available: roomStatusText ใน lib/agent-room-filters.ts:141-142)
  roomsTableLabel: 'Room listings', // agent.listings.web.tableLabel :1976 (aria-label ของตารางและรายการการ์ด)
  roomsViewTable: 'Table', // agent.listings.web.viewTable :1971
  roomsViewCards: 'Cards', // agent.listings.web.viewCards :1972
  sortBy: 'Sort by {column}', // agent.dashboard.webStates.sortBy :2107 (ปุ่มหัวคอลัมน์ WebTable.tsx:227)
  colPrice: 'Rent / month', // agent.listings.web.colPrice :1964
  roomDetails: 'Room details', // agent.listings.details :1990 (หัวเรื่อง h1 ของหน้าต่างรายละเอียดห้อง)

  // แดชบอร์ด (components/agent-web/AgentOverview.web.tsx:225-268)
  kpiAvailableListings: 'Available listings', // agent.dashboard.availableListings :2115
  kpiOpenLeads: 'Open leads', // agent.dashboard.openLeads :2117
  kpiCurrentTenants: 'Current tenants', // agent.dashboard.currentClients :2118
  kpiViewingsToday: 'Viewings today', // agent.dashboard.webOverview.viewingsToday :2083
  kpiLoadFailed: 'Unable to load data', // agent.dashboard.webOverview.loadFailed :2085
  unavailableSection: 'Coming soon', // agent.dashboard.unavailableSection :2162 (ข้อความใต้หัวเรื่องของหน้า Coming soon: index.tsx:1366-1367)

  // ผู้เช่าของนายหน้า (components/AgentTenantsScreen.tsx, agent-web/TenantDirectoryTable.web.tsx)
  tenantsTabWork: 'To do', // agent.tenants.list.tabWork :768
  tenantsTabAll: 'All tenants', // agent.tenants.list.tabAll :769
  tenantsShowing: 'Showing {shown} of {total}', // agent.tenants.list.showing :820
  tenantsSlipsLoadError: 'Could not load slips to review', // agent.tenants.list.slipsLoadError :824 (AgentTenantsScreen.tsx:176 เมื่อ GET /bills/agent/tenants/:id ล้ม)

  // ปฏิทิน (components/AgentCalendarScreen.tsx copy = t.agent.calendar)
  calendarLoadError: 'Unable to load appointments. Please try again.', // agent.calendar.loadError :493

  // บิล (components/TenantBillsScreen.tsx, TenantNextBillCard.tsx, OwnerConfirmedRent.tsx)
  tenantBillsEmpty: 'No bills yet', // tenant.bills.empty :441
  tenantBillsLoadFailed: 'Could not load bills', // tenant.bills.loadFailed :443
  tenantNoUpcomingBill: 'No upcoming bill', // tenant.bills.noUpcoming :421
  ownerIncomeEmpty: 'No rental income yet', // owner.bills.empty :478
  ownerLoadFailed: 'Could not load income', // owner.bills.loadFailed :480
  ownerConfirmedTitle: 'Confirmed rent', // owner.bills.confirmedTitle :483
  ownerConfirmedEmpty: 'Rent appears here after the agent confirms the slip.', // owner.bills.confirmedEmpty :484
  tenantHomeTitle: 'Tenant home', // mobile.roleHome.tenantTitle :46
  tenantNextBill: 'Next bill', // tenant.bills.next :417 (หัวการ์ดบิลถัดไปเมื่อมีบิล: TenantNextBillCard.tsx:64)
  rentFor: 'Rent {month}', // tenant.bills.rentFor :399 (owner.bills.rentFor :462 ค่าเดียวกัน) ชื่อของแต่ละบิล
  landlordHomeTitle: 'Landlord home', // mobile.roleHome.landlordTitle :47
} as const;

/**
 * ข้อความของหน้าผู้เช่าและผู้ให้เช่า ที่ไม่อยู่ใน packages/i18n: apps/consumer-app/lib/tenant-workspace-copy.ts (ภาษา en เริ่มที่ :99) ที่ 648dd28
 */
export const PARTY_COPY = {
  emptyContracts: 'No contracts delivered to this account yet', // emptyContracts :180
  emptyTenantHistory: 'No tenant history yet', // emptyTenantHistory :142
  paymentHistory: 'Payment history', // paymentHistory :150 (ปุ่มบนหัวหน้าบิล app/index.tsx:1887)
} as const;

/**
 * ข้อความที่เขียนตรงในโค้ด ไม่ผ่าน i18n (apps/consumer-app/app/index.tsx ที่ 648dd28) ใช้ตรวจว่าไม่ควรอยู่บนหน้า
 */
export const HARDCODED = {
  /** หน้า /tenant/home (แท็บ living) แสดงสัญญาเช่าตัวอย่างนี้ให้ทุกบัญชี: index.tsx:1215 */
  sampleLease: 'The Base Sukhumvit 77 (Room 1804)',
  /** ข้อความตัวอย่างของหน้า contact และ contracts ของนายหน้าก่อนขึ้น Coming soon: index.tsx:1378, :1390 */
  mockMarker: '(mock',
} as const;

/** แทนค่า {ชื่อ} ในข้อความ เช่น fill(FLOW.leadsCount, { count: '12' }) */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

/**
 * ข้อความของการ์ดแอดมินก่อนแก้บั๊กข้อ 8 (เขียนไว้ในโค้ด app/index.tsx:1092 ที่ efab8d0 ไม่ผ่าน i18n) ใช้ตรวจว่าไม่กลับมา
 * ที่ 648dd28 ตัวเลข "Pending tickets: 3" เหลือแค่ในคอมเมนต์ index.tsx:1134 ส่วน "Operations Dashboard" ไม่อยู่ใน index.tsx แล้ว
 */
export const RETIRED_ADMIN = {
  title: 'Operations Dashboard',
  summary: 'Pending tickets: 3 · Inspections today: 2',
} as const;

/** ข้อความดิบจาก API และ Supabase ที่ไม่ควรถึงผู้ใช้ (บั๊กข้อ 7) ข้อความมาจาก API/ไลบรารี ไม่อยู่ใน locales */
export const RAW_ERRORS = {
  /** API: RolesGuard ตอบ 403 (ผลเทสด้วยมือ 4 พ.ย. 2026 หน้า /landlord/income ด้วย qa-tenant) */
  requiredRoleLandlord: 'Required role: landlord',
  /** supabase-js เมื่อ updateUser โดยไม่มี session (ผลเทสด้วยมือ 4 พ.ย. 2026 หน้า reset-password ข้อ 4) */
  authSessionMissing: 'Auth session missing!',
} as const;

/** ข้อความที่ต่างกันตามภาษา สำหรับเทสสลับภาษาบนหน้า privacy (LegalPage.web.tsx) */
export type Locale = 'th' | 'en' | 'ja' | 'zh';
export const LOCALES: readonly Locale[] = ['th', 'en', 'ja', 'zh'];

export const LEGAL: Record<Locale, { draftBadge: string; privacyTitle: string; footerPrivacy: string }> = {
  // packages/i18n/src/locales/legal/<ภาษา>.ts : page.draftBadge / privacy.title / footer.privacy
  en: { draftBadge: 'Draft · under review', privacyTitle: 'Privacy Policy', footerPrivacy: 'Privacy Policy' }, // en.ts :29 / :40 / :7
  th: { draftBadge: 'ร่าง · รอตรวจ', privacyTitle: 'นโยบายความเป็นส่วนตัว', footerPrivacy: 'นโยบายความเป็นส่วนตัว' }, // th.ts :33 / :44 / :10
  ja: { draftBadge: '草案・確認中', privacyTitle: 'プライバシーポリシー', footerPrivacy: 'プライバシーポリシー' }, // ja.ts :29 / :40 / :7
  zh: { draftBadge: '草稿 · 待审核', privacyTitle: '隐私政策', footerPrivacy: '隐私政策' }, // zh.ts :29 / :39 / :7
};

/** จำนวนหัวข้อของเอกสาร (ทั้ง 4 ภาษาเท่ากัน นับ { id: ... } ใน packages/i18n/src/locales/legal/*.ts) */
export const LEGAL_SECTION_COUNT = { privacy: 8, terms: 10 } as const;

/** ปุ่มขั้นอีเมลของหน้าลืมรหัสผ่านภาษาไทย: packages/i18n/src/locales/th.ts:355 mobile.auth.resetSend ที่ qa/e2e 648dd28 */
export const TH_RESET_SEND = 'ส่งลิงก์';
/** ข้อความเดิมของปุ่มขั้นอีเมลก่อนแก้บั๊กข้อ 6 (ระบบส่งลิงก์ ไม่ได้ส่งรหัส) ใช้ตรวจว่าไม่กลับมา */
export const RETIRED_RESET_SEND = { en: 'Send code', th: 'ส่งรหัส' } as const;
/** aria-label ของช่องอีเมลภาษาไทย: packages/i18n/src/locales/th.ts:365 mobile.auth.email */
export const TH_EMAIL = 'อีเมล';

/** ข้อความของหน้าไม่พบของ expo-router 6.0.24 (node_modules/expo-router/build/views/Unmatched.js:55) */
export const UNMATCHED_ROUTE = 'Unmatched Route';
