import type { AgentTenant, AgentTenantBill, AgentTenantBilling, AgentTenantPayment } from "@nestyk/types";
import { advanceMonths, dateKey, rentDueDay, tenantLease, tenantReservation } from "./tenant-detail";

/**
 * Sample rent billing for the tenant pages until `GET /bills/agent/tenants/:tenantId` exists.
 * Derived from the tenant's real lease (rent, move-in, due day, advance months) so the pages look right;
 * the reservation fee row is real. Every sample bill is paid: slips waiting for review are real
 * (`withLiveSlips`), so the work list and this page agree. Delete this file once the API is wired.
 */
export const TENANT_BILLING_DEMO = true;

const BILL_LEAD_DAYS = 5;

function monthDue(year: number, monthIndex: number, day: number): string {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return dateKey(new Date(year, monthIndex, Math.min(day, last)));
}

function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + days));
}

function reservationPayment(tenant: AgentTenant): AgentTenantPayment[] {
  const reservation = tenantReservation(tenant);
  const payment = reservation?.reservationPayment;
  if (!reservation || payment?.status !== "paid") return [];
  return [
    {
      id: `reservation-${reservation.id}`,
      kind: "reservation",
      period: null,
      amount: payment.total,
      paidAt: payment.submittedAt ?? reservation.bookingDate ?? reservation.startDate,
      hasSlip: !!payment.paymentSlipUrl,
      receiptIssued: !!payment.receiptDocumentNo,
    },
  ];
}

export function demoTenantBilling(tenant: AgentTenant, today = new Date()): AgentTenantBilling {
  const lease = tenantLease(tenant);
  const extra = reservationPayment(tenant);
  const rent = Number(lease?.monthlyRent ?? 0);
  if (!lease || lease.status !== "active" || !(rent > 0)) {
    return { bills: [], upcoming: null, advancePeriods: [], payments: extra };
  }

  const todayKey = dateKey(today);
  const anchor = lease.moveInDate ?? lease.startDate;
  const [year, month, anchorDay] = anchor.split("-").map(Number);
  const dueDay = rentDueDay(lease) ?? anchorDay;
  const advance = advanceMonths(lease) || 1;
  const leaseNo = String(lease.id).padStart(6, "0");

  const advancePeriods: string[] = [];
  const issued: AgentTenantBill[] = [];
  let upcoming: AgentTenantBilling["upcoming"] = null;
  for (let i = 0; i < 120; i++) {
    const dueDate = monthDue(year, month - 1 + i, dueDay);
    if (lease.endDate && dueDate > lease.endDate) break;
    const period = dueDate.slice(0, 7);
    if (i < advance) {
      advancePeriods.push(period);
      continue;
    }
    const issueDate = addDays(dueDate, -BILL_LEAD_DAYS);
    if (issueDate > todayKey) {
      upcoming = { period, issueDate, dueDate, amount: rent };
      break;
    }
    issued.push({
      id: -(i + 1),
      period,
      documentNo: `RB${period.replace("-", "")}${leaseNo}`,
      issueDate,
      dueDate,
      amount: rent,
      status: "paid",
      slipSubmittedAt: null,
      paidAt: `${addDays(dueDate, 1)}T10:00:00+07:00`,
    });
  }

  const bills = issued.reverse();
  const payments: AgentTenantPayment[] = [
    ...bills.map((b) => ({
      id: `bill-${b.id}`,
      kind: "rent" as const,
      period: b.period,
      amount: b.amount,
      paidAt: b.paidAt!,
      hasSlip: true,
      receiptIssued: false,
    })),
    ...extra,
  ];
  return { bills, upcoming, advancePeriods, payments };
}
