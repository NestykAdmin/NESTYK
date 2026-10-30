import { Injectable, Logger } from "@nestjs/common";
import { DataSource, In, IsNull, MoreThanOrEqual, Not } from "typeorm";
import type { ContractReminder } from "@nestyk/types";
import { LeaseContractEntity } from "../../entities/lease-contract.entity";
import { TenantBillEntity } from "../../entities/tenant-bill.entity";
import { DealOfferEntity } from "../../entities/deal-offer.entity";
import { UserEntity } from "../../entities/user.entity";
import { ContractReminderEntity } from "../../entities/contract-reminder.entity";
import { ContractDepositSettlementEntity } from "../../entities/contract-deposit-settlement.entity";
import { DealCancellationEntity } from "../../entities/deal-cancellation.entity";
import { bangkokToday } from "../../billing/rent-schedule";
import { asIsoDate } from "../contracts/lease-term";
import { dueReminders, reminderEmail, type DueReminder, type ReminderContract, type ReminderRefund } from "./contract-reminders";
import { resendMailer, type ReminderMailer } from "./reminder-email";

// H2 (Aof 29 Oct 2026): an ended lease still owes its refunds and unpaid rent, so only a cancelled one is left out.
const CLOSED = ["cancelled"];
/** Reminders not e-mailed within this many days (no key set yet, or failing) are not sent any more. */
const EMAIL_WINDOW_DAYS = 3;
const strip = ({ recipients: _recipients, ...reminder }: DueReminder): ContractReminder => reminder;

/** D4 (AC-3.6, 4.6, 5.5, 7.4 to 7.6): reminders for agents and landlords, in the app and by e-mail. */
@Injectable()
export class ContractRemindersService {
  private readonly logger = new Logger(ContractRemindersService.name);
  /** Resend when RESEND_API_KEY and REMINDER_EMAIL_FROM are set, else none (tests set their own). */
  mailer: ReminderMailer | null = resendMailer();

  constructor(private readonly db: DataSource) {}

  /** What is due today for these agreements (all open ones when no filter is given). */
  async due(today: string, where: { agentId?: number; landlordUserId?: number } = {}): Promise<DueReminder[]> {
    // D5: refunds go to the agent only, so a landlord's view has none.
    const refunds = where.landlordUserId != null ? [] : await this.openRefunds(where.agentId);
    const rows = await this.db.getRepository(LeaseContractEntity).find({
      where: {
        status: Not(In(CLOSED)),
        ...(where.agentId != null ? { created_by_user_id: where.agentId } : {}),
        ...(where.landlordUserId != null ? { owner_user_id: where.landlordUserId } : {}),
      },
      relations: { template: true, agreement_type: true, tenant: true, rent_room: { property: true } },
      order: { id: "ASC" },
    });
    if (!rows.length) return dueReminders(today, [], [], refunds);
    const ids = rows.map((c) => c.id);
    const [bills, offers, settlements] = await Promise.all([
      this.db.getRepository(TenantBillEntity).find({ where: { lease_contract_id: In(ids), status: "pending" } }),
      this.db.getRepository(DealOfferEntity).find({
        where: { lead_id: In([...new Set(rows.map((c) => c.lead_id).filter((id) => id != null))]), status: "confirmed" },
      }),
      this.db.getRepository(ContractDepositSettlementEntity).find({ where: { lease_contract_id: In(ids) } }),
    ]);
    const notice = new Map(offers.map((o) => [`${o.lead_id}:${o.rent_room_id}`, o.renewal_notice_days]));
    const contracts: ReminderContract[] = rows.map((c) => ({
      id: c.id,
      status: c.status,
      formKind: c.template?.form_kind ?? c.agreement_type?.form_kind ?? null,
      createdAt: c.created_at ?? null,
      contractNo: c.contract_no || `EC-${c.id}`,
      tenantId: c.tenant_id ?? null,
      tenantName: String(c.party_snapshot?.tenantName || c.tenant?.name || ""),
      property: String(c.party_snapshot?.property || c.rent_room?.property?.name || c.rent_room?.listing_title || ""),
      room: (c.party_snapshot?.room as string) || c.rent_room?.room_id || null,
      startDate: asIsoDate(c.start_date) || null,
      endDate: asIsoDate(c.end_date) || null,
      effectiveEndDate: asIsoDate(c.effective_end_date) || null,
      previousAgreementId: c.previous_agreement_id ?? null,
      agentId: c.created_by_user_id,
      landlordUserId: c.owner_user_id ?? null,
      data: c.data ?? null,
      noticeDays: notice.get(`${c.lead_id}:${c.rent_room_id}`) ?? null,
      deposit: c.deposit == null ? null : Number(c.deposit),
    }));
    return dueReminders(today, contracts, bills.map((b) => ({
      id: b.id, leaseContractId: b.lease_contract_id, period: b.period, dueDate: asIsoDate(b.due_date),
      graceUntil: asIsoDate(b.grace_until), amount: Number(b.amount), status: b.status,
    })), refunds, settlements.map((row) => ({
      contractId: row.lease_contract_id, status: row.status, refundAmount: Number(row.refund_amount), refunded: row.refunded_at != null,
    })));
  }

  /** D5: cancelled deals with a refund not recorded yet (the agent's, or all for the daily job). */
  private async openRefunds(agentId?: number): Promise<ReminderRefund[]> {
    const rows = await this.db.getRepository(DealCancellationEntity).createQueryBuilder("dc")
      .leftJoinAndSelect("dc.lease_contract", "c")
      .leftJoinAndSelect("c.tenant", "tenant")
      .leftJoinAndSelect("c.rent_room", "room")
      .leftJoinAndSelect("room.property", "property")
      .where("dc.refund_amount > 0 AND dc.refunded_on IS NULL")
      .andWhere(agentId != null ? "dc.agent_user_id = :agentId" : "TRUE", { agentId })
      .orderBy("dc.id", "ASC")
      .getMany();
    return rows.map((dc) => {
      const c = dc.lease_contract;
      return {
        contractId: dc.lease_contract_id,
        agentId: dc.agent_user_id,
        refundDueOn: asIsoDate(dc.refund_due_on),
        amount: Number(dc.refund_amount),
        contractNo: c?.contract_no || `EC-${dc.lease_contract_id}`,
        tenantId: dc.tenant_id ?? null,
        tenantName: String(c?.party_snapshot?.tenantName || c?.tenant?.name || ""),
        property: String(c?.party_snapshot?.property || c?.rent_room?.property?.name || c?.rent_room?.listing_title || ""),
        room: (c?.party_snapshot?.room as string) || c?.rent_room?.room_id || null,
      };
    });
  }

  /** The agent's reminders now (`GET /agent/reminders`), most urgent (oldest due day) first. */
  async forAgent(agentId: number, today = bangkokToday()): Promise<ContractReminder[]> {
    return (await this.due(today, { agentId }))
      .filter((r) => r.recipients.includes(agentId))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.contractId - b.contractId)
      .map(strip);
  }

  /** The landlord's reminders now (`GET /contracts/mine/reminders`): rent 15 days late on their rooms. */
  async forLandlord(userId: number, today = bangkokToday()): Promise<ContractReminder[]> {
    return (await this.due(today, { landlordUserId: userId })).filter((r) => r.recipients.includes(userId)).map(strip);
  }

  /**
   * The daily job: records each due reminder once per person (a second run, or a second API instance, adds
   * nothing), then e-mails the ones not sent yet that are still due. An e-mail is claimed before it is sent, so two
   * instances never send the same one.
   */
  async run(today = bangkokToday()) {
    const due = await this.due(today);
    const rows = due.flatMap((r) => r.recipients.map((recipient) => ({
      kind: r.kind, lease_contract_id: r.contractId, tenant_bill_id: r.billId, due_date: r.dueDate, recipient_user_id: recipient,
    })));
    if (rows.length)
      await this.db.createQueryBuilder().insert().into(ContractReminderEntity).values(rows).orIgnore().execute();
    if (!this.mailer) return { due: due.length, recorded: rows.length, emailed: 0 };
    const key = (kind: string, contract: number, bill: number | null, date: string) => `${kind}:${contract}:${bill ?? 0}:${date}`;
    const current = new Map(due.map((r) => [key(r.kind, r.contractId, r.billId, r.dueDate), r]));
    const since = new Date(Date.now() - EMAIL_WINDOW_DAYS * 86_400_000);
    const unsent = await this.db.getRepository(ContractReminderEntity).find({
      where: { emailed_at: IsNull(), created_at: MoreThanOrEqual(since) },
      order: { id: "ASC" },
    });
    const users = new Map((await this.db.getRepository(UserEntity).find({
      where: { id: In([...new Set(unsent.map((r) => r.recipient_user_id))]) },
    })).map((u) => [u.id, u]));
    let emailed = 0;
    for (const row of unsent) {
      const reminder = current.get(key(row.kind, row.lease_contract_id, row.tenant_bill_id, asIsoDate(row.due_date)));
      const email = users.get(row.recipient_user_id)?.email?.trim();
      const claim = await this.db.getRepository(ContractReminderEntity).update(
        { id: row.id, emailed_at: IsNull() }, { emailed_at: new Date(), email_error: null });
      if (claim.affected !== 1) continue; // another instance has it
      // Done meanwhile (signed, paid) or no address: nothing to send, the row is closed with why.
      const skip = !reminder ? "resolved" : !email ? "no_email" : null;
      if (skip) {
        await this.db.getRepository(ContractReminderEntity).update({ id: row.id }, { email_error: skip });
        continue;
      }
      try {
        const message = reminderEmail(strip(reminder!));
        await this.mailer(email!, message.subject, message.text);
        emailed++;
      } catch (error) {
        // Released for the next run (until the window ends).
        await this.db.getRepository(ContractReminderEntity).update({ id: row.id }, {
          emailed_at: null, email_error: (error instanceof Error ? error.message : String(error)).slice(0, 200),
        });
        this.logger.warn(`Reminder ${row.id} e-mail failed`);
      }
    }
    return { due: due.length, recorded: rows.length, emailed };
  }
}
