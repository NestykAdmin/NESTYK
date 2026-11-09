import { UI_LOCALE } from './labels';

/**
 * ข้อความของหน้าเว็บที่เพิ่มใน pre/dev/review fc1a351 ถึง 7a9bf48 (รวมใน qa/e2e 4633c54) ที่ชุด tests/web-ui ใช้
 *   ปฏิทินเว็บ (calendar.*), แผงความพร้อมของฟอร์มลีด (leadForm.readiness.*), ปุ่ม social ที่ยังไม่เปิด, เมนู Living ของผู้เช่า
 *
 * ที่มา: packages/i18n/src/locales/en.ts และ th.ts ที่ 7a9bf48 คอมเมนต์ท้ายบรรทัดคือ key กับเลขบรรทัด (ตรวจในห้องทดลอง 9 พ.ย. 2026)
 * แยกไฟล์จาก labels.ts เพราะ labels.ts กับ labels.th.ts ใช้ชนิดร่วมกันหลายชุด ไฟล์นี้มีทั้งสองภาษาในที่เดียว
 * ค่าที่ใช้เลือกตาม UI_LOCALE เหมือน EN และ FLOW ใน labels.ts
 */
const AGENT_WEB_EN = {
  // ปฏิทินเว็บ: agent.calendar.* และ agent.calendar.web.*
  calendarToday: 'Today', // agent.calendar.today :498
  calendarPreviousMonth: 'Previous month', // agent.calendar.previousMonth :499
  calendarNextMonth: 'Next month', // agent.calendar.nextMonth :500
  calendarEventCount: '{count} events', // agent.calendar.eventCount :501 (หัวการ์ดวันและ aria-label ของช่องวัน)
  calendarStateScheduled: 'Scheduled', // agent.calendar.web.stateScheduled :527
  calendarStateDone: 'Viewed', // agent.calendar.web.stateDone :528
  calendarStateOverdue: 'Past due', // agent.calendar.web.stateOverdue :529
  calendarMonthCount: '{count} viewings', // agent.calendar.web.monthCount :531
  calendarWeekSoon: 'Week · coming soon', // agent.calendar.web.viewWeekSoon :538 (title ของปุ่มมุมมองสัปดาห์)
  calendarMoreCount: '+{count} more', // agent.calendar.web.moreCount :540
  calendarClearFilters: 'Clear filters', // agent.tenants.clearFilters :562 (ปุ่มในกล่อง noMatch: AgentCalendarPage.web.tsx:299-301)
  retry: 'Try again', // agent.dashboard.webStates.retry :2148 (ปุ่มของ WebState kind error: ui/WebState.tsx:72-74)

  // แผงความพร้อมของฟอร์มลีด: agent.leads.webForm.*
  readinessFirstName: 'First name', // :867
  readinessPhone: 'Phone', // :868
  readinessBudgetMax: 'Max budget', // :869
  readinessPins: 'Pinned location', // :870
  readinessDone: 'done', // :871
  readinessMissing: 'missing', // :872
  readinessNeedContact: 'Add a first name and phone to save the lead.', // noteNeedContact :873
  readinessSaveFirst: 'You can save now. Add a max budget and a pin later to start matching.', // noteSaveFirst :874
  readinessMatchMissing: 'Needs a max budget and a pinned location', // matchMissing :866
  readinessNewTag: 'New', // newTag :877
  invalidPhone: 'Not a valid number for the selected country', // agent.leads.invalidPhone :1018

  // ปุ่ม social: mobile.auth.*
  socialLogin: 'Continue with {provider}', // mobile.auth.socialLogin :353 (aria-label ของปุ่มในหน้า login: login.tsx:421-424)
  registerWithApple: 'Sign up with Apple', // mobile.auth.registerWithApple :327
  socialComingSoon: 'Coming soon', // mobile.auth.socialComingSoon :329
  socialUnavailable: 'This sign-in option is not available yet. Please use email and password.', // mobile.auth.unavailable :354

  // เมนู Living ของผู้เช่า
  living: 'Living', // mobile.tabs.living :55 (ชื่อเมนูข้าง: tenantWebLabel ใน components/tenant-web/navigation.ts)
  comingSoon: 'Coming soon', // agent.dashboard.comingSoon :2267 (title "<ชื่อ> · Coming soon": app/index.tsx:1744)
} as const;

const AGENT_WEB_TH: Record<keyof typeof AGENT_WEB_EN, string> = {
  calendarToday: 'วันนี้', // :498
  calendarPreviousMonth: 'เดือนก่อนหน้า', // :499
  calendarNextMonth: 'เดือนถัดไป', // :500
  calendarEventCount: '{count} รายการ', // :501
  calendarStateScheduled: 'นัดแล้ว', // :527
  calendarStateDone: 'ดูห้องแล้ว', // :528
  calendarStateOverdue: 'เลยเวลานัด', // :529
  calendarMonthCount: '{count} นัด', // :531
  calendarWeekSoon: 'สัปดาห์ · เร็ว ๆ นี้', // :538
  calendarMoreCount: '+{count} นัด', // :540
  calendarClearFilters: 'ล้างตัวกรอง', // :562
  retry: 'ลองอีกครั้ง', // :2148
  readinessFirstName: 'ชื่อ', // :867
  readinessPhone: 'เบอร์ติดต่อ', // :868
  readinessBudgetMax: 'งบสูงสุด', // :869
  readinessPins: 'ตำแหน่งที่ปักหมุด', // :870
  readinessDone: 'ครบแล้ว', // :871
  readinessMissing: 'ยังไม่กรอก', // :872
  readinessNeedContact: 'กรอกชื่อและเบอร์ติดต่อเพื่อบันทึกลีด', // :873
  readinessSaveFirst: 'บันทึกลีดได้เลย กรอกงบสูงสุดกับปักหมุดทีหลังเพื่อเริ่มจับคู่', // :874
  readinessMatchMissing: 'ยังขาดงบสูงสุดหรือตำแหน่งที่ปักหมุด', // :866
  readinessNewTag: 'ใหม่', // :877
  invalidPhone: 'เบอร์ไม่ถูกต้องสำหรับประเทศที่เลือก', // :1018
  socialLogin: 'เข้าสู่ระบบด้วย {provider}', // :353
  registerWithApple: 'สมัครด้วย Apple', // :327
  socialComingSoon: 'เร็ว ๆ นี้', // :329
  socialUnavailable: 'ยังไม่เปิดให้เข้าสู่ระบบด้วยช่องทางนี้ กรุณาใช้อีเมลและรหัสผ่าน', // :354
  living: 'อยู่อาศัย', // :55
  comingSoon: 'เร็ว ๆ นี้', // :2267
};

export const AGENT_WEB: Record<keyof typeof AGENT_WEB_EN, string> = UI_LOCALE === 'th' ? AGENT_WEB_TH : AGENT_WEB_EN;

/** แทน {count} หรือ {provider} ในข้อความ (ใช้ตัวเดียวกับ labels.ts) */
export { fill } from './labels';
