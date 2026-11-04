/** Web sign-in session: "sign out of all devices" and the 8-hour idle sign out (Mos 4 Nov 2026). */
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
};

export type WebSessionCopy = typeof webSessionTh;
