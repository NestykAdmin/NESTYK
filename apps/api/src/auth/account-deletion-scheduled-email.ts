import { resendMailer, type ReminderMailer } from '../agent/reminders/reminder-email';

export const ACCOUNT_DELETION_SCHEDULED_SUBJECT = 'บัญชี NESTYK ถูกนัดลบ / Your NESTYK account is scheduled for deletion';

/** The day shown in the app (Bangkok time, the same as the banner and the delete page). */
function bangkokDay(at: Date, tag: 'th-TH-u-ca-gregory' | 'en-GB'): string {
  return at.toLocaleDateString(tag, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });
}

export function accountDeletionScheduledMessage(effectiveAt: Date): { subject: string; text: string } {
  const text = [
    `บัญชี NESTYK ของคุณถูกนัดลบในวันที่ ${bangkokDay(effectiveAt, 'th-TH-u-ca-gregory')}`,
    'ก่อนถึงวันนั้นยังเข้าสู่ระบบได้ตามปกติ ถ้าเปลี่ยนใจ เข้าแอป ไปที่ตั้งค่า > บัญชี > ลบบัญชี แล้วกด "ยกเลิกการลบ"',
    'ถ้าคุณไม่ได้เป็นคนขอลบ ให้เข้าแอปเพื่อยกเลิกการลบ และเปลี่ยนรหัสผ่านทันที',
    '',
    `Your NESTYK account is scheduled for deletion on ${bangkokDay(effectiveAt, 'en-GB')}.`,
    'You can still sign in until then. To keep it, open the app, go to Settings > Account > Delete account and tap "Cancel deletion".',
    'If you did not ask for this, open the app to cancel the deletion and change your password now.',
  ].join('\n');
  return { subject: ACCOUNT_DELETION_SCHEDULED_SUBJECT, text };
}

/**
 * D (Jom, 3 Nov 2026): tell the owner as soon as a deletion is scheduled, so one scheduled by someone else (a stolen
 * session) can be cancelled in time. Best effort: a missing mailer or a failed send never undoes the schedule.
 */
export async function notifyAccountDeletionScheduled(
  email: string | null | undefined,
  effectiveAt: Date,
  mailer: ReminderMailer | null = resendMailer(),
): Promise<boolean> {
  if (!mailer || !email?.includes('@') || email.endsWith('@users.invalid')) return false;
  const { subject, text } = accountDeletionScheduledMessage(effectiveAt);
  try {
    await mailer(email, subject, text);
    return true;
  } catch {
    return false;
  }
}
