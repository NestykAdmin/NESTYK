import { resendMailer, type ReminderMailer } from '../agent/reminders/reminder-email';

export const ACCOUNT_DELETED_SUBJECT = 'บัญชี NESTYK ถูกลบแล้ว / Your NESTYK account was deleted';

export const ACCOUNT_DELETED_TEXT = [
  'บัญชี NESTYK ของคุณถูกลบแล้ว',
  'สัญญาที่ลงนามแล้ว ใบแจ้งหนี้ และใบเสร็จยังถูกเก็บตามกฎหมาย',
  '',
  'Your NESTYK account was deleted.',
  'Signed contracts, invoices, and receipts are kept as required by law.',
].join('\n');

export async function notifyAccountDeleted(
  email: string | null | undefined,
  mailer: ReminderMailer | null = resendMailer(),
): Promise<boolean> {
  if (!mailer || !email?.includes('@') || email.endsWith('@users.invalid')) return false;
  try {
    await mailer(email, ACCOUNT_DELETED_SUBJECT, ACCOUNT_DELETED_TEXT);
    return true;
  } catch {
    return false;
  }
}
