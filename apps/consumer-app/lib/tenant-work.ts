import type { AgentContract, AgentTenant, TenantBill } from "@nestyk/types";
import { dateKey, tenantLease, tenantSlips } from "./tenant-detail";

/** Most urgent first; also the order of the summary tiles. */
export const TENANT_WORK_KINDS = ["slip", "overdue", "signing", "renewal"] as const;
export type TenantWorkKind = (typeof TENANT_WORK_KINDS)[number];

export const RENEWAL_WINDOW_DAYS = 30;

export type TenantWorkItem =
  | { kind: "slip"; tenant: AgentTenant; bill: TenantBill }
  | { kind: "overdue"; tenant: AgentTenant; daysLate: number }
  | { kind: "signing"; tenant: AgentTenant; contract: AgentContract; signed: number; required: number }
  | { kind: "renewal"; tenant: AgentTenant; contract: AgentContract; daysLeft: number };

const DAY_MS = 86_400_000;
const dayNumber = (key: string) => {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
};

/** Signatures a document needs, matching the contracts screen: a lease has no agent, an appointment no tenant. */
export function contractSignatures(contract: AgentContract): { signed: number; required: number } {
  const parties =
    contract.formKind === "broker_appointment"
      ? [contract.ownerSignedAt, contract.agentSignedAt]
      : contract.formKind === "lease"
        ? [contract.ownerSignedAt, contract.tenantSignedAt]
        : [contract.ownerSignedAt, contract.tenantSignedAt, contract.agentSignedAt];
  return { signed: parties.filter(Boolean).length, required: parties.length };
}

/** Days until the active lease ends, or null when there is no active lease with an end date. */
export function leaseDaysLeft(tenant: AgentTenant, today = new Date()): number | null {
  const lease = tenantLease(tenant);
  if (!lease || lease.status !== "active" || !lease.endDate) return null;
  return dayNumber(lease.endDate) - dayNumber(dateKey(today));
}

/**
 * Open work across the agent's tenants, most urgent first.
 * `slips` are the bills with a slip waiting for review (`GET /bills/agent`), matched by lease contract.
 * Overdue rent has no agent-side source yet, so it never appears here.
 */
export function tenantWorkItems(tenants: AgentTenant[], slips: TenantBill[], today = new Date()): TenantWorkItem[] {
  const items: TenantWorkItem[] = [];
  for (const tenant of tenants) {
    for (const bill of tenantSlips(tenant, slips)) items.push({ kind: "slip", tenant, bill });
    for (const contract of tenant.contracts) {
      if (contract.status === "awaiting_signatures") {
        items.push({ kind: "signing", tenant, contract, ...contractSignatures(contract) });
      }
    }
    const daysLeft = leaseDaysLeft(tenant, today);
    const lease = tenantLease(tenant);
    if (lease && daysLeft != null && daysLeft >= 0 && daysLeft <= RENEWAL_WINDOW_DAYS) {
      items.push({ kind: "renewal", tenant, contract: lease, daysLeft });
    }
  }
  const rank = (item: TenantWorkItem) => TENANT_WORK_KINDS.indexOf(item.kind);
  const urgency = (item: TenantWorkItem) =>
    item.kind === "slip"
      ? item.bill.dueDate
      : item.kind === "renewal"
        ? String(item.daysLeft).padStart(4, "0")
        : item.kind === "signing"
          ? item.contract.startDate
          : "";
  return items.sort((a, b) => rank(a) - rank(b) || urgency(a).localeCompare(urgency(b)));
}

export function workCounts(items: TenantWorkItem[]): Record<TenantWorkKind, number> {
  const counts = { slip: 0, overdue: 0, signing: 0, renewal: 0 };
  for (const item of items) counts[item.kind] += 1;
  return counts;
}

export type TenantListStatus = "slip" | "signing" | "renewal" | "active" | "none";

/** One status per tenant for the directory row: its most urgent work, else whether a lease is active. */
export function tenantListStatus(tenant: AgentTenant, items: TenantWorkItem[]): TenantListStatus {
  const own = items.find((item) => item.tenant.id === tenant.id && item.kind !== "overdue");
  if (own) return own.kind as Exclude<TenantListStatus, "active" | "none">;
  return tenantLease(tenant)?.status === "active" ? "active" : "none";
}

/** Tenants grouped by project name, groups and members in name order. */
export function groupByProperty(tenants: AgentTenant[], locale?: string) {
  const groups = new Map<string, AgentTenant[]>();
  for (const tenant of tenants) {
    const key = tenant.property.trim();
    groups.set(key, [...(groups.get(key) ?? []), tenant]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, locale))
    .map(([property, members]) => ({
      property,
      tenants: members.sort((a, b) => a.name.localeCompare(b.name, locale)),
    }));
}
