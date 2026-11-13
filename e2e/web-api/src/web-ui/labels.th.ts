import type { EN_EN, FLOW_EN, PARTY_COPY_EN } from './labels';

/**
 * ข้อความภาษาไทยของชุดเทส UI เว็บ สำหรับรันด้วย E2E_WEB_LOCALE=th (npm run test:web-ui:th)
 * สร้างจาก key เดียวกับ EN, FLOW และ PARTY_COPY ใน labels.ts (คอมเมนต์ท้ายบรรทัดคือ key กับเลขบรรทัดในไฟล์ภาษาไทย)
 *   EN, FLOW: packages/i18n/src/locales/th.ts ที่ qa/e2e 74b46f4 (แอป 648dd28)
 *   PARTY_COPY: apps/consumer-app/lib/tenant-workspace-copy.ts บล็อก th (:4-98)
 * ค่าทั้งหมดดึงจากไฟล์ locale จริงตาม key ด้วยสคริปต์ในห้องทดลอง (9 พ.ย. 2026) ไม่ได้แปลเอง
 * ถ้าเพิ่ม key ใน labels.ts ต้องเพิ่มที่นี่ด้วย (TypeScript จะเตือนเพราะชนิดผูกกับ EN_EN, FLOW_EN)
 */

export const EN_TH: Record<keyof typeof EN_EN, string> = {
  // packages/i18n/src/locales/th.ts (mobile.auth.*)
  email: 'อีเมล', // mobile.auth.email :365
  password: 'รหัสผ่าน', // mobile.auth.password :366
  confirmPassword: 'ยืนยันรหัสผ่าน', // mobile.auth.confirmPassword :322
  loginButton: "เข้าสู่ระบบ", // mobile.auth.loginButton :313
  registerButton: 'สร้างบัญชี', // mobile.auth.registerButton :323
  invalidEmail: 'กรอกอีเมลให้ถูกต้อง', // mobile.auth.invalidEmail :331
  passwordRules: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร มีตัวเลข ตัวพิมพ์เล็ก และตัวพิมพ์ใหญ่', // mobile.auth.passwordRules :333
  acceptTerms: 'ฉันยอมรับเงื่อนไขการใช้งาน', // mobile.auth.acceptTerms :338 (PDPA cba5045: ยอมรับแค่เงื่อนไข)
  acceptTermsRequired: 'กรุณายอมรับเงื่อนไขการใช้งาน', // mobile.auth.acceptTermsRequired :339
  passwordMismatch: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน', // mobile.auth.passwordMismatch :342
  resetSend: 'ส่งลิงก์', // mobile.auth.resetSend :355
  resetLinkInvalid: 'ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว รหัสผ่านยังไม่ถูกเปลี่ยน กด "กลับไปเข้าสู่ระบบ" แล้วกด "ลืมรหัสผ่าน?" เพื่อขอลิงก์ใหม่', // mobile.auth.resetLinkInvalid :357
  resetLinkBroken: 'ลิงก์นี้ใช้ไม่ได้ กรอกอีเมลแล้วกด "ส่งลิงก์" เพื่อขอลิงก์ใหม่', // mobile.auth.resetLinkBroken :358
  resetNewTitle: 'ตั้งรหัสผ่านใหม่', // mobile.auth.resetNewTitle :359
  sessionExpired: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง', // mobile.auth.sessionExpired :371
  invalidCredentials: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', // mobile.auth.invalidCredentials :374
  networkError: 'เชื่อมต่อระบบไม่ได้ในขณะนี้ กรุณาตรวจสอบอินเทอร์เน็ตหรือลองใหม่อีกครั้งในอีกสักครู่', // mobile.auth.networkError :375
  emailNotConfirmed: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ', // mobile.auth.emailNotConfirmed :376
  tooManyAttempts: 'ลองหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่', // mobile.auth.tooManyAttempts :377
  errorGeneric: 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง', // common.errorGeneric :23
  registrationFailed: 'สมัครสมาชิกไม่สำเร็จ กรุณาลองอีกครั้ง หากสร้างบัญชีแล้ว ให้กลับไปเข้าสู่ระบบ', // mobile.auth.registrationFailed :347
  otpCode: 'รหัส 6 หลัก', // mobile.auth.otpCode :341
  resendCode: 'ส่งรหัสใหม่', // mobile.auth.resendCode :343
  firstName: 'ชื่อ', // mobile.account.firstName :235
  lastName: 'นามสกุล', // mobile.account.lastName :236
  phone: 'เบอร์โทรศัพท์', // mobile.account.phone :238
  // บทบาทและ workspace
  signOut: 'ออกจากระบบ', // common.signOut :21
  roleTenant: 'ผู้เช่า', // roles.tenant :29
  roleLandlord: 'ผู้ให้เช่า', // roles.landlord :30
  roleAgent: 'นายหน้า', // roles.agent :31
  account: 'บัญชีผู้ใช้', // agent.dashboard.webWorkspace.account :2060
  close: 'ปิด', // agent.dashboard.webWorkspace.close :2064
  create: 'สร้าง', // agent.dashboard.webWorkspace.create :2067
  comingSoon: 'เร็ว ๆ นี้', // agent.dashboard.comingSoon :2215
  navDashboard: 'Dashboard', // mobile.tabs.dashboard :57
  navLeads: 'ลีด', // mobile.tabs.listingLead :61
  navCalendar: 'ปฏิทิน', // agent.dashboard.openCalendar :2203
  // การ์ดหน้าแรกของบทบาท (app/index.tsx:1135-1166 ใช้ร่วมกันทุกบทบาท) บั๊กข้อ 8 แก้แล้วที่ 648dd28: หัวข้อมาจาก i18n และไม่มีตัวเลขสมมติ
  adminHomeTitle: 'หน้าหลักผู้ดูแลระบบ', // mobile.roleHome.adminTitle :49
  roleHomeComingSoon: 'เร็ว ๆ นี้', // mobile.roleHome.comingSoon :50
  // packages/i18n/src/locales/web-session/th.ts
  idleTitle: 'ยังใช้งานอยู่ไหม', // idleTitle :8
  idleSignOut: 'ออกจากระบบ', // idleSignOut :11
  idleStay: 'ใช้งานต่อ', // idleStay :10
  signOutAll: 'ออกจากระบบทุกอุปกรณ์', // signOutAll :3
  signOutAllTitle: 'ออกจากระบบทุกอุปกรณ์?', // signOutAllTitle :4
};

export const FLOW_TH: { [K in keyof typeof FLOW_EN]: (typeof FLOW_EN)[K] extends string ? string : Record<keyof (typeof FLOW_EN)[K], string> } = {
  // หน้าลีด (components/agent-web/AgentLeadsPage.web.tsx)
  leadsCount: '{count} ลีด', // agent.leads.count :896
  leadsSearch: 'ค้นหาชื่อ เบอร์โทร หรือพื้นที่ เช่น เชียงใหม่ อโศก', // agent.leads.search :894
  leadsSort: 'เรียงตาม', // agent.leads.sortTitle :944
  leadsStatusGroup: 'กรองตามสถานะ', // agent.leads.statusFilter :936
  leadsStatusAll: 'ทั้งหมด', // agent.leads.statusAll :934
  leadStatus: {
    new: 'ปกติ', // agent.leads.statuses.new :928
    inprogress: 'กำลังดูแล', // agent.leads.statuses.inprogress :929
    lost: 'ไม่ไปต่อ', // agent.leads.statuses.lost :930
    booked: 'จองแล้ว', // agent.leads.statuses.booked :931
    viewing: 'นัดดูห้อง', // agent.leads.statuses.viewing :932
  },
  back: 'ย้อนกลับ', // agent.createRoom.back :1492
  // ตัวแบ่งหน้า (ใช้ร่วมกันทั้งลีดและห้อง)
  pagerNav: 'หน้า', // agent.listings.web.pages :1970
  pageRange: '{from}–{to} จาก {total}', // agent.listings.web.pageRange :1967
  nextPage: 'หน้าถัดไป', // agent.listings.web.nextPage :1969
  // หน้าห้อง (components/agent-web/AgentRoomsPage.web.tsx)
  roomsCount: '{count} ห้อง', // agent.listings.results :1987
  roomsSearch: 'ค้นหาห้อง', // agent.listings.searchRooms :1984
  roomsAvailability: 'สถานะห้อง', // agent.listings.filterAvailability :2039
  roomAvailable: 'พร้อมให้เช่า', // agent.listings.available :1996
  roomsTableLabel: 'รายการห้อง', // agent.listings.web.tableLabel :1976
  roomsViewTable: 'ตาราง', // agent.listings.web.viewTable :1971
  roomsViewCards: 'การ์ด', // agent.listings.web.viewCards :1972
  sortBy: 'เรียงตาม{column}', // agent.dashboard.webStates.sortBy :2107
  colPrice: 'ค่าเช่า / เดือน', // agent.listings.web.colPrice :1964
  roomDetails: 'รายละเอียดห้อง', // agent.listings.details :1990
  // แดชบอร์ด (components/agent-web/AgentOverview.web.tsx:225-268)
  kpiAvailableListings: 'ห้องพร้อมเสนอ', // agent.dashboard.availableListings :2115
  kpiOpenLeads: 'ลีดที่เปิดอยู่', // agent.dashboard.openLeads :2117
  kpiCurrentTenants: 'ผู้เช่าปัจจุบัน', // agent.dashboard.currentClients :2118
  kpiViewingsToday: 'นัดดูห้องวันนี้', // agent.dashboard.webOverview.viewingsToday :2083
  kpiLoadFailed: 'โหลดข้อมูลไม่สำเร็จ', // agent.dashboard.webOverview.loadFailed :2085
  unavailableSection: 'เร็ว ๆ นี้', // agent.dashboard.unavailableSection :2162
  // ผู้เช่าของนายหน้า (components/AgentTenantsScreen.tsx, agent-web/TenantDirectoryTable.web.tsx, TenantWorkTable.web.tsx)
  //   เลขบรรทัดของกลุ่มนี้เป็นของ th.ts ที่ qa/e2e ac7f3d8 (เลขเดียวกับ en.ts)
  tenantsTabWork: 'งานค้าง', // agent.tenants.list.tabWork :801
  tenantsTabAll: 'ผู้เช่าทั้งหมด', // agent.tenants.list.tabAll :802
  tenantsShowing: 'แสดง {shown} จาก {total} คน', // agent.tenants.list.showing :853
  tenantsSlipsLoadError: 'โหลดสลิปรอตรวจไม่สำเร็จ', // agent.tenants.list.slipsLoadError :857
  tenantsFilterGroup: 'สถานะ', // agent.tenants.list.web.colStatus :811
  tenantsFilterAll: 'ทั้งหมด', // agent.tenants.list.filterAll :850
  tenantsFilterSigning: 'กำลังทำสัญญา', // agent.tenants.list.filterSigning :851
  tenantsFilterActive: 'ผู้เช่าแล้ว', // agent.tenants.list.filterActive :852
  tenantsGroupToggle: '{property}, {count} คน', // agent.tenants.list.groupToggle :848
  tenantsNoProject: 'ไม่ระบุโครงการ', // agent.tenants.list.noProject :849
  tenantsWorkGroup: 'งานที่ต้องจัดการ', // agent.tenants.list.web.tableWork :812
  tenantsTileSlip: 'รอตรวจสลิป', // agent.tenants.list.tileSlip :815
  tenantsTileOverdue: 'ค้างชำระ', // agent.tenants.list.tileOverdue :817
  tenantsTileSigning: 'รอลงนาม', // agent.tenants.list.tileSigning :819
  tenantsTileRenewal: 'ใกล้ครบสัญญา', // agent.tenants.list.tileRenewal :821
  tenantsWorkFiltered: 'กำลังดู: {label}', // agent.tenants.list.workFiltered :826
  tenantsShowAllWork: 'ดูงานทั้งหมด', // agent.tenants.list.showAllWork :827
  tenantsWorkEmpty: 'ไม่มีงานค้างตอนนี้', // agent.tenants.list.workEmpty :845
  tenantsEdit: 'แก้ไขข้อมูลผู้เช่า', // agent.tenants.edit :563
  tenantsSave: 'บันทึก', // agent.tenants.save :564
  tenantsCancel: 'ยกเลิก', // agent.tenants.cancel :565
  tenantsFieldFirstName: 'ชื่อ', // agent.tenants.fieldFirstName :597
  tenantsFieldEmail: 'อีเมล', // agent.tenants.detail.fieldEmail :668
  tenantsEmailLocked: 'อีเมลนี้ใช้เข้าแอปของผู้เช่าแล้ว จึงเปลี่ยนไม่ได้', // agent.tenants.detail.emailLocked :669
  tenantsRequiredNamePhone: 'กรุณากรอกชื่อและเบอร์โทร', // agent.tenants.detail.requiredNamePhone :677
  webClearFilters: 'ล้างตัวกรอง', // agent.dashboard.webStates.clearFilters :2149
  // ปฏิทิน (components/AgentCalendarScreen.tsx copy = t.agent.calendar)
  calendarLoadError: 'โหลดนัดหมายไม่สำเร็จ กรุณาลองใหม่', // agent.calendar.loadError :493
  // บิล (components/TenantBillsScreen.tsx, TenantNextBillCard.tsx, OwnerConfirmedRent.tsx)
  tenantBillsEmpty: 'ยังไม่มีบิล', // tenant.bills.empty :441
  tenantBillsLoadFailed: 'โหลดบิลไม่สำเร็จ', // tenant.bills.loadFailed :443
  tenantNoUpcomingBill: 'ยังไม่มีรอบบิลถัดไป', // tenant.bills.noUpcoming :421
  ownerIncomeEmpty: 'ยังไม่มีรายรับ', // owner.bills.empty :478
  ownerLoadFailed: 'โหลดรายรับไม่สำเร็จ', // owner.bills.loadFailed :480
  ownerConfirmedTitle: 'รายรับที่ยืนยันแล้ว', // owner.bills.confirmedTitle :483
  ownerConfirmedEmpty: 'เมื่อเอเจนต์ยืนยันสลิป ค่าห้องจะแสดงที่นี่', // owner.bills.confirmedEmpty :484
  tenantHomeTitle: 'หน้าหลักผู้เช่า', // mobile.roleHome.tenantTitle :46
  tenantNextBill: 'รอบบิลถัดไป', // tenant.bills.next :417
  rentFor: 'ค่าห้อง {month}', // tenant.bills.rentFor :399
  landlordHomeTitle: 'หน้าหลักผู้ให้เช่า', // mobile.roleHome.landlordTitle :47
};

export const PARTY_COPY_TH: Record<keyof typeof PARTY_COPY_EN, string> = {
  emptyContracts: "ยังไม่มีสัญญาที่ส่งเข้าบัญชีนี้", // emptyContracts :84
  emptyTenantHistory: "ยังไม่มีประวัติผู้เช่า", // emptyTenantHistory :47
  paymentHistory: "ประวัติการจ่าย", // paymentHistory :55
};
