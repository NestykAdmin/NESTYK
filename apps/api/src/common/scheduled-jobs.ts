/**
 * dev-issues 9 (QA Aof, 3 Nov 2026): DISABLE_SCHEDULED_JOBS=true (exactly) stops the scheduled jobs: rent bills at
 * 00:05, account deletions at 00:10 and reminders at 08:00. For an API run by QA or a developer against a shared
 * database. Production leaves it unset or false. The bill refresh POSTs the app calls before reading bills
 * (POST /bills/mine/refresh, /bills/received/refresh) still issue due bills.
 */
export function scheduledJobsDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DISABLE_SCHEDULED_JOBS === 'true';
}
