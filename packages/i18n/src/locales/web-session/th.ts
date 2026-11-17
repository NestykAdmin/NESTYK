/** Web sign-in session: "sign out of all devices", the 8-hour idle sign out (Mos 4 Nov 2026) and the "no access to this portal" page (5 Nov). */
export const webSessionTh = {
  signOutAll: 'ออกจากระบบทุกอุปกรณ์',
  signOutAllTitle: 'ออกจากระบบทุกอุปกรณ์?',
  signOutAllBody: 'บัญชีนี้จะออกจากระบบในทุกมือถือและทุกเบราว์เซอร์ รวมถึงเครื่องนี้ ต้องเข้าสู่ระบบใหม่ทุกเครื่อง',
  signOutAllConfirm: 'ออกจากระบบทุกอุปกรณ์',
  signOutAllFailed: 'ออกจากระบบทุกอุปกรณ์ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
  idleTitle: 'ยังใช้งานอยู่ไหม',
  idleBody: 'ไม่มีการใช้งานมาเกือบ 8 ชั่วโมง ระบบจะออกจากระบบในเครื่องนี้ใน {time}',
  idleStay: 'ใช้งานต่อ',
  idleSignOut: 'ออกจากระบบ',
  noAccessTitle: 'บัญชีนี้ยังเข้าเว็บนี้ไม่ได้',
  noAccessBody: '{email} ยังไม่มีสิทธิ์ใช้งานส่วนนี้ของ NESTYK',
  noAccessHint: 'เข้าสู่ระบบด้วยบัญชีอื่น หรือติดต่อทีมงานหากคิดว่าเป็นข้อผิดพลาด',
  noAccessSignOut: 'เข้าสู่ระบบด้วยบัญชีอื่น',
  noAccessSupport: 'ติดต่อทีมงาน',
  noAccessHome: 'กลับหน้าแรก',
  otherSite: 'เว็บอื่น',
  noAccessOpenRole: 'ไปที่หน้า{role}',
  /** Sign-in redesign (Mos 17 Nov 2026): the note under the sign-in button and its label while Turnstile checks. */
  captchaNote: 'ป้องกันบอตด้วย Cloudflare Turnstile',
  captchaChecking: 'กำลังตรวจสอบ…',
  /** The hidden check gave no token (blocked, error or too slow). */
  captchaFailed: 'ยืนยันว่าไม่ใช่บอตไม่สำเร็จ กรุณาลองอีกครั้ง',
};

export type WebSessionCopy = typeof webSessionTh;
