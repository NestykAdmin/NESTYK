import type { AgentContract, AgentTenant, AgentTenantBill, AgentTenantBilling, TenantBill } from "@nestyk/types";

export type TenantSection = "profile" | "room" | "contracts" | "bills" | "payments" | "attachments";
export type TenantProfileField = "phone" | "email" | "identityNumber" | "nationality";

const DAY_MS = 86_400_000;

export function dateKey(at: Date): string {
  const month = String(at.getMonth() + 1).padStart(2, "0");
  const day = String(at.getDate()).padStart(2, "0");
  return `${at.getFullYear()}-${month}-${day}`;
}

function dayNumber(key: string): number {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

const newestFirst = (a: AgentContract, b: AgentContract) =>
  b.startDate.localeCompare(a.startDate) || b.id - a.id;

/** The lease that drives rent: the active one, else the newest that was not cancelled. */
export function tenantLease(tenant: AgentTenant): AgentContract | null {
  const leases = tenant.contracts
    .filter((c) => c.formKind === "lease" && c.status !== "cancelled")
    .sort(newestFirst);
  return leases.find((c) => c.status === "active") ?? leases[0] ?? null;
}

export function tenantReservation(tenant: AgentTenant): AgentContract | null {
  return (
    tenant.contracts
      .filter((c) => c.formKind === "reservation" && c.status !== "cancelled")
      .sort(newestFirst)[0] ?? null
  );
}

export function missingProfileFields(tenant: AgentTenant): TenantProfileField[] {
  const fields: TenantProfileField[] = ["phone", "email", "identityNumber", "nationality"];
  return fields.filter((field) => !tenant[field]?.trim());
}

function leaseForm(lease: AgentContract): Record<string, unknown> {
  const saved = lease.data?.leaseAgreement;
  return saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
}

/** Day of month rent is due, from the lease form; null when the lease leaves it blank. */
export function rentDueDay(lease: AgentContract): number | null {
  const raw = leaseForm(lease).rentDueDay;
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{1,2}$/.test(text)) return null;
  const day = Number(text);
  return day >= 1 && day <= 31 ? day : null;
}

/** Months paid in advance at signing (lease form `advanceMonths`); those periods never get a bill. */
export function advanceMonths(lease: AgentContract): number {
  const raw = leaseForm(lease).advanceMonths;
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  return /^\d{1,2}$/.test(text) ? Number(text) : 0;
}

export function leaseProgress(lease: AgentContract, today = new Date()) {
  if (!lease.endDate) return null;
  const start = dayNumber(lease.startDate);
  const end = dayNumber(lease.endDate);
  const now = dayNumber(dateKey(today));
  const total = Math.max(end - start, 1);
  return {
    start: lease.startDate,
    end: lease.endDate,
    daysLeft: Math.max(end - now, 0),
    ratio: Math.min(Math.max((now - start) / total, 0), 1),
  };
}

export function billingTotals(billing: AgentTenantBilling | null) {
  const bills = billing?.bills ?? [];
  const sum = (rows: AgentTenantBill[]) => rows.reduce((total, bill) => total + bill.amount, 0);
  const outstanding = bills.filter((b) => b.status === "pending" || b.status === "overdue");
  const awaiting = bills.filter((b) => b.status === "awaiting_review");
  const payments = billing?.payments ?? [];
  return {
    outstandingAmount: sum(outstanding),
    outstandingCount: outstanding.length,
    overdueCount: bills.filter((b) => b.status === "overdue").length,
    awaiting,
    awaitingAmount: sum(awaiting),
    paidCount: bills.filter((b) => b.status === "paid").length,
    receivedAmount: payments.reduce((total, p) => total + p.amount, 0),
    latestPayment: payments.reduce<string | null>(
      (latest, p) => (!latest || p.paidAt > latest ? p.paidAt : latest),
      null,
    ),
  };
}

export type TenantNextAction =
  | { kind: "review_slip"; bill: AgentTenantBill }
  | { kind: "reservation" }
  | { kind: "sign"; contract: AgentContract };

/** The one thing the agent should do next for this tenant, most urgent first. */
export function tenantNextAction(tenant: AgentTenant, billing: AgentTenantBilling | null): TenantNextAction | null {
  const slip = billing?.bills
    .filter((b) => b.status === "awaiting_review")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  if (slip) return { kind: "review_slip", bill: slip };
  if (!tenant.contracts.length) return { kind: "reservation" };
  const signing = tenant.contracts.find((c) => c.status === "awaiting_signatures");
  return signing ? { kind: "sign", contract: signing } : null;
}

/** This tenant's real slips waiting for review (`GET /bills/agent`), matched by lease contract. */
export function tenantSlips(tenant: AgentTenant, slips: TenantBill[]): TenantBill[] {
  const ids = new Set(tenant.contracts.map((c) => c.id));
  return slips.filter((bill) => ids.has(bill.leaseContractId));
}

/** Real slips replace whatever the billing had for the same period. */
export function withLiveSlips(billing: AgentTenantBilling | null, slips: TenantBill[]): AgentTenantBilling | null {
  if (!slips.length) return billing;
  const base = billing ?? { bills: [], upcoming: null, advancePeriods: [], payments: [] };
  const periods = new Set(slips.map((bill) => bill.period));
  const live: AgentTenantBill[] = slips.map((bill) => ({
    id: bill.id,
    period: bill.period,
    documentNo: bill.documentNo,
    issueDate: bill.issueDate,
    dueDate: bill.dueDate,
    amount: bill.amount,
    status: "awaiting_review",
    slipSubmittedAt: null,
    paidAt: null,
  }));
  return {
    ...base,
    bills: [...live, ...base.bills.filter((b) => !periods.has(b.period))].sort((a, b) =>
      b.period.localeCompare(a.period),
    ),
    payments: base.payments.filter((p) => !p.period || !periods.has(p.period)),
    upcoming: base.upcoming && periods.has(base.upcoming.period) ? null : base.upcoming,
  };
}

export function confirmBill(billing: AgentTenantBilling, id: number, at = new Date()): AgentTenantBilling {
  const bill = billing.bills.find((b) => b.id === id);
  if (!bill || bill.status === "paid") return billing;
  const paidAt = at.toISOString();
  return {
    ...billing,
    bills: billing.bills.map((b) => (b.id === id ? { ...b, status: "paid", paidAt } : b)),
    payments: [
      { id: `bill-${id}`, kind: "rent", period: bill.period, amount: bill.amount, paidAt, hasSlip: true, receiptIssued: false },
      ...billing.payments,
    ],
  };
}
