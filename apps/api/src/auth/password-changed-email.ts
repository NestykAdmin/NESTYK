import { resendMailer, type ReminderMailer } from '../agent/reminders/reminder-email';

export const PASSWORD_CHANGED_SUBJECT = 'รหัสผ่าน NESTYK ถูกเปลี่ยน / Your NESTYK password was changed';

export const PASSWORD_CHANGED_TEXT = [
  'รหัสผ่านบัญชี NESTYK ของคุณถูกเปลี่ยนแล้ว',
  'ถ้าคุณไม่ได้เป็นคนเปลี่ยน กรุณาใช้ลืมรหัสผ่านเพื่อตั้งรหัสใหม่',
  '',
  'Your NESTYK password was changed.',
  'If this was not you, use Forgot password to set a new one.',
].join('\n');

/** Best-effort notice. A missing mailer or a send failure does not undo the password change. */
export async function notifyPasswordChanged(
  email: string | null | undefined,
  mailer: ReminderMailer | null = resendMailer(),
): Promise<boolean> {
  if (!mailer || !email?.includes('@')) return false;
  try {
    await mailer(email, PASSWORD_CHANGED_SUBJECT, PASSWORD_CHANGED_TEXT);
    return true;
  } catch {
    return false;
  }
}
