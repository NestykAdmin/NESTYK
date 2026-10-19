export type { AgentDashboardTab, DashboardSectionStatus, AgentWorkItemKind, AgentAppointmentKind, AgentDashboardFilter, AgentDashboardDeepLink, AgentDashboardAppointment, AgentDashboardSnapshot } from '@nestyk/types';
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(`{${key}}`, String(value)),
    template,
  );
}

export function formatMoney(amount: number, _currency = 'THB'): string {
  return `฿${amount.toLocaleString('en-US')}`;
}

/** Add minutes without producing invalid clock hours. */
export function addMinutesIso(from: Date, minutes: number): string {
  return new Date(from.getTime() + minutes * 60_000).toISOString();
}

export function formatTimeLabel(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false });
}
