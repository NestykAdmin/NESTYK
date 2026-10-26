import { Entity, Column, ManyToOne, JoinColumn, Check, Index } from "typeorm";
import { SerialTimestampEntity } from "./base.entity";
import { LeaseContractEntity } from "./lease-contract.entity";
import { LeadEntity } from "./lead.entity";
import { RentRoomEntity } from "./rent-room.entity";
import { TenantEntity } from "./tenant.entity";
import { UserEntity } from "./user.entity";

export type DealCancellationParty = "tenant" | "landlord";

/**
 * D5 (AC-C.1 to C.4): a deal cancelled before the room was handed over (migration
 * 20261026140000_deal_cancellations.sql). Who caused it, why, the evidence, what was received with a receipt, and
 * what is forfeited or refunded; the refund is recorded once with its proof.
 */
@Index("uq_deal_cancellations_contract", ["lease_contract_id"], { unique: true })
@Index("idx_deal_cancellations_agent", ["agent_user_id"])
@Index("idx_deal_cancellations_refund_open", ["refund_due_on"], { where: "((refund_amount > (0)::numeric) AND (refunded_on IS NULL))" })
@Check("chk_deal_cancellations_at_fault", "((at_fault)::text = ANY ((ARRAY['tenant'::character varying, 'landlord'::character varying])::text[]))")
@Check("chk_deal_cancellations_reason", "(char_length(btrim((reason)::text)) > 0)")
@Check("chk_deal_cancellations_contracts", "((cardinality(contract_ids) >= 1) AND (lease_contract_id = ANY (contract_ids)))")
@Check("chk_deal_cancellations_evidence", "((jsonb_typeof(evidence_paths) = 'array'::text) AND (jsonb_array_length(evidence_paths) >= 1))")
@Check("chk_deal_cancellations_notified", "(((at_fault)::text <> 'landlord'::text) OR (notified_on IS NOT NULL))")
@Check("chk_deal_cancellations_amounts", "((booking_received >= (0)::numeric) AND (deposit_received >= (0)::numeric) AND (forfeited_amount >= (0)::numeric) AND (refund_amount >= (0)::numeric) AND ((forfeited_amount + refund_amount) = (booking_received + deposit_received)) AND (((at_fault)::text = 'tenant'::text) OR (forfeited_amount = (0)::numeric)) AND (((at_fault)::text = 'landlord'::text) OR (refund_amount = (0)::numeric)))")
@Check("chk_deal_cancellations_refund_due", "((refund_amount > (0)::numeric) = (refund_due_on IS NOT NULL))")
@Check("chk_deal_cancellations_refund", "(((refunded_on IS NULL) AND (refund_proof_path IS NULL) AND (refund_recorded_at IS NULL)) OR ((refund_amount > (0)::numeric) AND (refunded_on IS NOT NULL) AND (refund_proof_path IS NOT NULL) AND (refund_recorded_at IS NOT NULL)))")
@Check("chk_deal_cancellations_appointment", "((NOT appointment_ended) OR ((at_fault)::text = 'landlord'::text))")
@Entity({ name: "deal_cancellations" })
export class DealCancellationEntity extends SerialTimestampEntity {
  @Column({ type: "int" })
  agent_user_id: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: "agent_user_id", foreignKeyConstraintName: "deal_cancellations_agent_user_id_fkey" })
  agent: UserEntity;

  @Column({ type: "int" })
  lead_id: number;

  @ManyToOne(() => LeadEntity)
  @JoinColumn({ name: "lead_id", foreignKeyConstraintName: "deal_cancellations_lead_id_fkey" })
  lead: LeadEntity;

  @Column({ type: "int" })
  rent_room_id: number;

  @ManyToOne(() => RentRoomEntity)
  @JoinColumn({ name: "rent_room_id", foreignKeyConstraintName: "deal_cancellations_rent_room_id_fkey" })
  rent_room: RentRoomEntity;

  @Column({ type: "int", nullable: true })
  tenant_id: number | null;

  @ManyToOne(() => TenantEntity, { nullable: true })
  @JoinColumn({ name: "tenant_id", foreignKeyConstraintName: "deal_cancellations_tenant_id_fkey" })
  tenant: TenantEntity | null;

  /** The deal's latest agreement (the lease, else the booking letter). */
  @Column({ type: "int" })
  lease_contract_id: number;

  @ManyToOne(() => LeaseContractEntity)
  @JoinColumn({ name: "lease_contract_id", foreignKeyConstraintName: "deal_cancellations_lease_contract_id_fkey" })
  lease_contract: LeaseContractEntity;

  /** Every agreement this cancellation closed. */
  @Column({ type: "int", array: true })
  contract_ids: number[];

  @Column({ type: "varchar", length: 16 })
  at_fault: DealCancellationParty;

  @Column({ type: "varchar", length: 1000 })
  reason: string;

  /** Storage paths of the evidence files. */
  @Column({ type: "jsonb" })
  evidence_paths: string[];

  @Column({ type: "date", nullable: true })
  notified_on: string | null;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  booking_received: string;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  deposit_received: string;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  forfeited_amount: string;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  refund_amount: string;

  @Column({ type: "date", nullable: true })
  refund_due_on: string | null;

  @Column({ type: "date", nullable: true })
  refunded_on: string | null;

  @Column({ type: "text", nullable: true })
  refund_proof_path: string | null;

  @Column({ type: "timestamptz", nullable: true })
  refund_recorded_at: Date | null;

  @Column({ type: "int", nullable: true })
  refund_recorded_by_user_id: number | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: "refund_recorded_by_user_id", foreignKeyConstraintName: "deal_cancellations_refund_recorded_by_user_id_fkey" })
  refund_recorded_by: UserEntity | null;

  @Column({ type: "boolean", default: false })
  appointment_ended: boolean;
}
