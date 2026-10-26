import type { ContractReminder, ContractReminderKind } from "@nestyk/types";
import { asIsoDate, isIsoDate, shiftIsoDate } from "../contracts/lease-term";
import { bangkokDate } from "../contracts/reservation-letter";

/**
 * D4 (Aof 26 Oct 2026): when the agent (and for rent 15 days late, the landlord) is reminded. Days are Bangkok
 * calendar days; "after day X" means from the day after X (the team's rule of 9 Oct: the day after the start is
 * day 1). Each reminder is worked out from the current state, so what is done (signed, paid) is never reminded.
 *
 * - reservation_sign_late (AC-3.6): a letter not signed by everyone after the 3rd day from the day it was made.
 * - lease_sign_late (AC-4.6): a lease not signed by everyone after its signing date (the form's issue date).
 * - deposit_unpaid (AC-5.5): on and after the handover day (the lease start, or the day it was moved to) while the
 *   lease still waits for its deposit.
 * - rent_overdue (AC-7.4): a rent bill not confirmed after its grace day.
 * - rent_overdue_15 (AC-7.5): from the 16th day after the due day (15 days counted from it), agent and landlord.
 * - renewal_notice (AC-7.6): an active lease with as many days left as its renewal notice days, or fewer, and no
 *   renewal yet.
 * - refund_late (D5, AC-C.2, C.3): a cancelled deal's refund not recorded after its due day (told 15 Oct, due 22 Oct,
 *   reminded from 23 Oct: TC-C.05, C.07).
 */
export const RENEWAL_NOTICE_DEFAULT_DAYS = 30;
const OPEN_SIGNING = ["draft", "awaiting_signatures"];

export type ReminderContract = {
  id: number;
  status: string;
  formKind: string | null;
  createdAt: Date | string | null;
  contractNo: string;
  tenantId: number | null;
  tenantName: string;
  property: string;
  room: string | null;
  startDate: string | null;
  endDate: string | null;
  effectiveEndDate: string | null;
  previousAgreementId: number | null;
  agentId: number;
  landlordUserId: number | null;
  data: Record<string, unknown> | null;
  /** The renewal notice days of the deal's offer (null: none, so 30). */
  noticeDays: number | null;
};
/** D5: a cancelled deal whose refund is not recorded yet, with what the reminder shows. */
export type ReminderRefund = Pick<ReminderContract, "contractNo" | "tenantId" | "tenantName" | "property" | "room" | "agentId"> & {
  contractId: number;
  refundDueOn: string;
  amount: number;
};
export type ReminderBill = { id: number; leaseContractId: number; period: string; dueDate: string; graceUntil: string; amount: number; status: string };
/** A reminder that is due, with who gets it. */
export type DueReminder = ContractReminder & { recipients: number[] };

const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/** D5.5: the day the room is handed over, the lease start unless the agent moved it (with a reason). */
export function handoverDueDate(c: Pick<ReminderContract, "startDate" | "data">) {
  const moved = (c.data?.handoverDue as { date?: string } | undefined)?.date;
  return isIsoDate(moved) ? moved : asIsoDate(c.startDate);
}

export function dueReminders(today: string, contracts: ReminderContract[], bills: ReminderBill[], refunds: ReminderRefund[] = []): DueReminder[] {
  const out: DueReminder[] = [];
  const byId = new Map(contracts.map((c) => [c.id, c]));
  const base = (kind: ContractReminderKind, c: ReminderContract, dueDate: string, recipients: Array<number | null>) => ({
    kind, contractId: c.id, tenantId: c.tenantId, billId: null as number | null, billPeriod: null as string | null, amount: null as number | null,
    dueDate, contractNo: c.contractNo, tenantName: c.tenantName, property: c.property, room: c.room,
    recipients: [...new Set(recipients.filter((id): id is number => id != null))],
  });
  for (const c of contracts) {
    if (c.formKind === "reservation" && OPEN_SIGNING.includes(c.status) && c.createdAt) {
      const due = shiftIsoDate(bangkokDate(new Date(c.createdAt)), 3);
      if (today > due) out.push(base("reservation_sign_late", c, due, [c.agentId]));
    }
    if (c.formKind === "lease" && OPEN_SIGNING.includes(c.status)) {
      const signing = (c.data?.leaseAgreement as { issueDate?: string } | undefined)?.issueDate;
      if (isIsoDate(signing) && today > signing) out.push(base("lease_sign_late", c, signing, [c.agentId]));
    }
    if (c.formKind === "lease" && c.status === "awaiting_deposit") {
      const due = handoverDueDate(c);
      if (due && today >= due) out.push(base("deposit_unpaid", c, due, [c.agentId]));
    }
    const end = asIsoDate(c.endDate);
    const renewed = contracts.some((other) => other.previousAgreementId === c.id && other.status !== "cancelled");
    if ((c.formKind === "lease" || c.formKind === "renewal") && c.status === "active" && end && !c.effectiveEndDate && !renewed) {
      const left = daysBetween(today, end);
      if (left >= 0 && left <= (c.noticeDays ?? RENEWAL_NOTICE_DEFAULT_DAYS)) out.push(base("renewal_notice", c, end, [c.agentId]));
    }
  }
  for (const bill of bills) {
    const c = byId.get(bill.leaseContractId);
    if (!c || bill.status !== "pending" || c.status !== "active") continue;
    const withBill = (item: DueReminder) => ({ ...item, billId: bill.id, billPeriod: bill.period, amount: bill.amount });
    if (today >= shiftIsoDate(bill.dueDate, 16))
      out.push(withBill(base("rent_overdue_15", c, bill.dueDate, [c.agentId, c.landlordUserId])));
    else if (today > bill.graceUntil) out.push(withBill(base("rent_overdue", c, bill.graceUntil, [c.agentId])));
  }
  for (const r of refunds)
    if (today > r.refundDueOn)
      out.push({
        kind: "refund_late", contractId: r.contractId, tenantId: r.tenantId, billId: null, billPeriod: null, amount: r.amount,
        dueDate: r.refundDueOn, contractNo: r.contractNo, tenantName: r.tenantName, property: r.property, room: r.room,
        recipients: [r.agentId],
      });
  return out;
}

const TITLE: Record<ContractReminderKind, { th: string; en: string }> = {
  reservation_sign_late: { th: "หนังสือจองเลยกำหนดลงนาม ตามให้ทุกฝ่ายลงนามให้ครบ", en: "Booking letter past its signing date: follow up so everyone signs" },
  lease_sign_late: { th: "สัญญาเช่าเลยวันทำสัญญาแล้ว แต่ยังลงนามไม่ครบ", en: "Lease past its signing date and not signed by everyone" },
  deposit_unpaid: { th: "ถึงวันส่งมอบห้องแล้ว ยังไม่ได้รับเงินประกัน", en: "Handover day reached, deposit not received" },
  rent_overdue: { th: "ค่าเช่าเลยวันผ่อนผันแล้ว ยังไม่ได้ยืนยันการชำระ", en: "Rent past its grace period, payment not confirmed" },
  rent_overdue_15: { th: "ค่าเช่าค้างชำระครบ 15 วัน", en: "Rent 15 days overdue" },
  renewal_notice: { th: "สัญญาเช่าใกล้สิ้นสุด ถามผู้ให้เช่าและผู้เช่าเรื่องต่อสัญญา", en: "Lease ending soon: ask the landlord and the tenant about renewing" },
  refund_late: { th: "เลยกำหนดคืนเงินให้ผู้เช่าแล้ว ยังไม่ได้บันทึกการคืน", en: "Refund to the tenant overdue and not recorded" },
};
const DUE_LABEL: Record<"end" | "handover" | "due", { th: string; en: string }> = {
  end: { th: "สัญญาสิ้นสุด", en: "Lease ends" },
  handover: { th: "วันส่งมอบ", en: "Handover day" },
  due: { th: "ครบกำหนด", en: "Due" },
};
const thaiDate = (iso: string) => (isIsoDate(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso);

/** The e-mail of a reminder, in Thai then English (Aof 26 Oct 2026), plain text. */
export function reminderEmail(r: ContractReminder) {
  const due = DUE_LABEL[r.kind === "renewal_notice" ? "end" : r.kind === "deposit_unpaid" ? "handover" : "due"];
  const room = [r.property, r.room].filter(Boolean);
  const amount = r.amount != null ? r.amount.toLocaleString("en-US") : null;
  const th = [
    TITLE[r.kind].th,
    `เลขที่เอกสาร: ${r.contractNo}`,
    `ผู้เช่า: ${r.tenantName}`,
    `ห้อง: ${room.join(" ห้อง ")}`,
    r.billPeriod ? `บิลรอบ: ${r.billPeriod}${amount ? ` ยอด ${amount} บาท` : ""}` : null,
    r.kind === "refund_late" && amount ? `ยอดที่ต้องคืน: ${amount} บาท` : null,
    `${due.th}: ${thaiDate(r.dueDate)}`,
    "เปิดแอป NESTYK เพื่อดูรายละเอียด",
  ];
  const en = [
    TITLE[r.kind].en,
    `Document no.: ${r.contractNo}`,
    `Tenant: ${r.tenantName}`,
    `Room: ${room.join(" room ")}`,
    r.billPeriod ? `Bill: ${r.billPeriod}${amount ? `, ${amount} THB` : ""}` : null,
    r.kind === "refund_late" && amount ? `To refund: ${amount} THB` : null,
    `${due.en}: ${thaiDate(r.dueDate)}`,
    "Open the NESTYK app for the details.",
  ];
  const keep = (lines: Array<string | null>) => lines.filter((line): line is string => line != null);
  return {
    subject: `[NESTYK] ${TITLE[r.kind].th} / ${TITLE[r.kind].en}`,
    text: [...keep(th), "", "— English —", "", ...keep(en)].join("\n"),
  };
}
