import type { TenantBill } from '@nestyk/types';
import { apiGet, apiPost } from './api';
import type { SelfOwnerIncomeBackend } from './self-owner-contracts';

/** The owner's bills (plan 2026-11-27-self-owner-bills-api): the landlord endpoints, open to the self owner role. */
export const selfOwnerIncomeApi: SelfOwnerIncomeBackend = {
  refresh: () => apiPost('/bills/received/refresh', {}),
  list: () => apiGet<TenantBill[]>('/bills/received'),
};
