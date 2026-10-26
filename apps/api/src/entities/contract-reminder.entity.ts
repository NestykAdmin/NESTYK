import { Entity, Column, ManyToOne, JoinColumn, Check, Index } from "typeorm";
import { SerialTimestampEntity } from "./base.entity";
import { LeaseContractEntity } from "./lease-contract.entity";
import { TenantBillEntity } from "./tenant-bill.entity";
import { UserEntity } from "./user.entity";

/** D4 (AC-3.6, 4.6, 5.5, 7.4 to 7.6): what a reminder is about. */
export const CONTRACT_REMINDER_KINDS = [
  "reservation_sign_late", // a reservation letter not signed by everyone by the end of its 3rd day
  "lease_sign_late", // a lease not signed by everyone after its signing date
  "deposit_unpaid", // the handover day came and the deposit is not paid
  "rent_overdue", // rent not confirmed after its grace day
  "rent_overdue_15", // rent 15 days late (the landlord is told too)
  "renewal_notice", // as many days left as the renewal notice days
  "refund_late", // D5 (AC-C.2, C.3): a cancelled deal's refund not recorded after its due day
] as const;
export type ContractReminderKind = (typeof CONTRACT_REMINDER_KINDS)[number];

/**
 * D4: one reminder sent to one person, kept so the daily job sends it once (migration
 * 20261026130000_contract_reminders.sql, refund_late added by 20261026140000_deal_cancellations.sql; unique on kind, contract, bill, due day and recipient).
 */
@Index("idx_contract_reminders_unsent", ["created_at"], { where: "(emailed_at IS NULL)" })
@Check("chk_contract_reminders_kind", "((kind)::text = ANY ((ARRAY['reservation_sign_late'::character varying, 'lease_sign_late'::character varying, 'deposit_unpaid'::character varying, 'rent_overdue'::character varying, 'rent_overdue_15'::character varying, 'renewal_notice'::character varying, 'refund_late'::character varying])::text[]))")
@Check("chk_contract_reminders_bill", "(((kind)::text ~~ 'rent_%'::text) = (tenant_bill_id IS NOT NULL))")
@Entity({ name: "contract_reminders" })
export class ContractReminderEntity extends SerialTimestampEntity {
  @Column({ type: "varchar", length: 32 })
  kind: ContractReminderKind;

  @Column({ type: "int" })
  lease_contract_id: number;

  @ManyToOne(() => LeaseContractEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "lease_contract_id", foreignKeyConstraintName: "contract_reminders_lease_contract_id_fkey" })
  lease_contract: LeaseContractEntity;

  @Column({ type: "int", nullable: true })
  tenant_bill_id: number | null;

  @ManyToOne(() => TenantBillEntity, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "tenant_bill_id", foreignKeyConstraintName: "contract_reminders_tenant_bill_id_fkey" })
  tenant_bill: TenantBillEntity | null;

  @Column({ type: "date" })
  due_date: string;

  @Column({ type: "int" })
  recipient_user_id: number;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "recipient_user_id", foreignKeyConstraintName: "contract_reminders_recipient_user_id_fkey" })
  recipient: UserEntity;

  @Column({ type: "timestamptz", nullable: true })
  emailed_at: Date | null;

  @Column({ type: "varchar", length: 200, nullable: true })
  email_error: string | null;
}
