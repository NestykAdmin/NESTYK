import { useEffect, useState } from 'react';
import type { AgentDashboardData, AgentDashboardSnapshot, DashboardSectionStatus } from '@nestyk/types';
import { apiGet } from './api';

type DashboardInput = {
  enabled: boolean;
  accountId: string | null;
  refreshToken: number;
  greetingName: string;
  locale: string;
  onSettled?: (token: number) => void;
};

function emptyData(status: DashboardSectionStatus): AgentDashboardData {
  const generatedAt = new Date().toISOString();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date(generatedAt));
  const year = Number(parts.find(part => part.type === 'year')!.value);
  const month = Number(parts.find(part => part.type === 'month')!.value);
  return {
    generatedAt,
    business: { status, availableListings: 0, totalListings: 0, openLeads: 0, currentClients: 0, tenantsCount: 0, commissionPending: 0, currency: 'THB' },
    actionRequired: { status, items: [] },
    schedule: { status, items: [] },
    inventory: { status, available: 0, unavailable: 0, published: 0, private: 0, preview: [] },
    clients: { status, draft: 0, signing: 0, tenants: 0, renewal: null },
    rent: { status, periodYear: year, periodMonth: month, totalDue: 0, received: 0, overdue: 0, currency: 'THB' },
    commission: { status: 'not_configured', periodYear: year, periodMonth: month, total: 0, received: 0, pending: 0, currency: 'THB' },
    activity: { status, items: [] },
  };
}

/** One live snapshot for web and native; a response may only settle its own account and refresh. */
export function useAgentDashboard({ enabled, accountId, refreshToken, greetingName, locale, onSettled }: DashboardInput): AgentDashboardSnapshot {
  const [result, setResult] = useState<{
    accountId: string | null;
    refreshToken: number;
    data: AgentDashboardData;
  } | null>(null);

  useEffect(() => {
    if (!enabled || !accountId) {
      setResult(null);
      return;
    }
    let cancelled = false;
    apiGet<AgentDashboardData>('/agent/dashboard').then(data => {
      if (!cancelled) setResult({ accountId, refreshToken, data });
    }).catch(() => {
      if (!cancelled) setResult({ accountId, refreshToken, data: emptyData('error') });
    }).finally(() => {
      if (!cancelled) onSettled?.(refreshToken);
    });
    return () => { cancelled = true; };
  }, [enabled, accountId, refreshToken, onSettled]);

  const data = enabled && accountId && result?.accountId === accountId && result.refreshToken === refreshToken
    ? result.data
    : emptyData('loading');
  return {
    ...data,
    isDemoPreview: false,
    greetingName,
    localDateLabel: new Date(data.generatedAt).toLocaleDateString(
      ({ th: 'th-TH', zh: 'zh-CN', ja: 'ja-JP' } as Record<string, string>)[locale] || 'en-GB',
      { timeZone: 'Asia/Bangkok', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    ),
  };
}
