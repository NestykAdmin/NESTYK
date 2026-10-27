/**
 * D4 (Aof 26 Oct 2026, provider Resend): sends one reminder e-mail through Resend's HTTPS API (no extra package).
 * Needs RESEND_API_KEY and REMINDER_EMAIL_FROM (a sender on a domain verified in Resend), set in the API's
 * environment; without them nothing is sent and the reminders stay in the app only.
 */
export type ReminderMailer = (to: string, subject: string, text: string) => Promise<void>;

export function resendMailer(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): ReminderMailer | null {
  const key = env.RESEND_API_KEY?.trim();
  const from = env.REMINDER_EMAIL_FROM?.trim();
  if (!key || !from) return null;
  return async (to, subject, text) => {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}`);
  };
}
