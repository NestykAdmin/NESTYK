import { Column, Entity, JoinColumn, ManyToOne, OneToOne, Check, Unique } from "typeorm";
import { SerialTimestampEntity } from "./base.entity";
import { LeaseContractEntity } from "./lease-contract.entity";
import { UserEntity } from "./user.entity";

export type DepositSettlementStatus = "draft" | "approved" | "completed";

@Unique("contract_deposit_settlements_lease_contract_id_key", ["lease_contract_id"])
@Check("chk_deposit_completion", "(((status)::text <> 'completed'::text) OR (refund_amount = (0)::numeric) OR (refunded_at IS NOT NULL))")
@Check("chk_deposit_refund_proof", "((refunded_at IS NULL) OR (((status)::text <> 'draft'::text) AND (refund_amount > (0)::numeric) AND (NULLIF(btrim(refund_reference), ''::text) IS NOT NULL)))")
@Check("chk_deposit_settlement_approval", "(((status)::text = 'draft'::text) OR ((approved_by_user_id IS NOT NULL) AND (approved_at IS NOT NULL) AND (NULLIF(btrim(decision_note), ''::text) IS NOT NULL)))")
@Check("chk_deposit_settlement_balance", "(((status)::text = 'draft'::text) OR (available_deposit_amount = ((deduction_total + carried_forward_total) + refund_amount)))")
@Check("contract_deposit_settlements_available_deposit_amount_check", "((available_deposit_amount >= (0)::numeric) AND (available_deposit_amount <> 'NaN'::numeric))")
@Check("contract_deposit_settlements_carried_forward_total_check", "((carried_forward_total >= (0)::numeric) AND (carried_forward_total <> 'NaN'::numeric))")
@Check("contract_deposit_settlements_deduction_total_check", "((deduction_total >= (0)::numeric) AND (deduction_total <> 'NaN'::numeric))")
@Check("contract_deposit_settlements_deposit_received_amount_check", "((deposit_received_amount >= (0)::numeric) AND (deposit_received_amount <> 'NaN'::numeric))")
@Check("contract_deposit_settlements_refund_amount_check", "((refund_amount >= (0)::numeric) AND (refund_amount <> 'NaN'::numeric))")
@Check("contract_deposit_settlements_status_check", "((status)::text = ANY ((ARRAY['draft'::character varying, 'approved'::character varying, 'completed'::character varying])::text[]))")
@Entity({ name: "contract_deposit_settlements" })
export class ContractDepositSettlementEntity extends SerialTimestampEntity {
  @Column({ type: "int" }) lease_contract_id: number;
  @OneToOne(() => LeaseContractEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "lease_contract_id", foreignKeyConstraintName: "contract_deposit_settlements_lease_contract_id_fkey" }) lease_contract: LeaseContractEntity;

  /** Actual cash received, never copied automatically from the contractual deposit. */
  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 }) deposit_received_amount: string;
  @Column({ type: "text", nullable: true }) deposit_received_reference: string | null;
  /** Cash received plus completed incoming transfers, before this settlement's allocation. */
  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 }) available_deposit_amount: string;
  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 }) deduction_total: string;
  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 }) carried_forward_total: string;
  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 }) refund_amount: string;
  @Column({ type: "varchar", length: 16, default: "draft" }) status: DepositSettlementStatus;
  @Column({ type: "text", nullable: true }) decision_note: string | null;
  @Column({ type: "int" }) created_by_user_id: number;
  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "created_by_user_id", foreignKeyConstraintName: "contract_deposit_settlements_created_by_user_id_fkey" }) created_by: UserEntity;
  @Column({ type: "int", nullable: true }) approved_by_user_id: number | null;
  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "approved_by_user_id", foreignKeyConstraintName: "contract_deposit_settlements_approved_by_user_id_fkey" }) approved_by: UserEntity | null;
  @Column({ type: "timestamptz", nullable: true }) approved_at: Date | null;
  @Column({ type: "timestamptz", nullable: true }) refunded_at: Date | null;
  @Column({ type: "text", nullable: true }) refund_reference: string | null;
}
