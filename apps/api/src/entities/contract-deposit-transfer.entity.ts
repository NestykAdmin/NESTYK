import { Column, Entity, JoinColumn, ManyToOne, Check, Index } from "typeorm";
import { SerialTimestampEntity } from "./base.entity";
import { LeaseContractEntity } from "./lease-contract.entity";
import { UserEntity } from "./user.entity";

export type DepositTransferStatus = "pending" | "completed" | "cancelled";

@Index("idx_deposit_transfer_destination", ["to_contract_id"])
@Index("uq_deposit_transfer_live_source", ["from_contract_id"], { unique: true, where: "((status)::text <> 'cancelled'::text)" })
@Check("chk_deposit_transfer_completion", "((((status)::text = 'completed'::text) AND (approved_by_user_id IS NOT NULL) AND (approved_at IS NOT NULL) AND (transferred_at IS NOT NULL)) OR (((status)::text <> 'completed'::text) AND (transferred_at IS NULL)))")
@Check("chk_deposit_transfer_distinct", "(from_contract_id <> to_contract_id)")
@Check("contract_deposit_transfers_amount_check", "((amount > (0)::numeric) AND (amount <> 'NaN'::numeric))")
@Check("contract_deposit_transfers_status_check", "((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[]))")
@Entity({ name: "contract_deposit_transfers" })
export class ContractDepositTransferEntity extends SerialTimestampEntity {
  @Column({ type: "int" }) from_contract_id: number;
  @ManyToOne(() => LeaseContractEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "from_contract_id", foreignKeyConstraintName: "contract_deposit_transfers_from_contract_id_fkey" }) from_contract: LeaseContractEntity;
  @Column({ type: "int" }) to_contract_id: number;
  @ManyToOne(() => LeaseContractEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "to_contract_id", foreignKeyConstraintName: "contract_deposit_transfers_to_contract_id_fkey" }) to_contract: LeaseContractEntity;
  @Column({ type: "decimal", precision: 12, scale: 2 }) amount: string;
  @Column({ type: "varchar", length: 16, default: "pending" }) status: DepositTransferStatus;
  @Column({ type: "int" }) created_by_user_id: number;
  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "created_by_user_id", foreignKeyConstraintName: "contract_deposit_transfers_created_by_user_id_fkey" }) created_by: UserEntity;
  @Column({ type: "int", nullable: true }) approved_by_user_id: number | null;
  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "approved_by_user_id", foreignKeyConstraintName: "contract_deposit_transfers_approved_by_user_id_fkey" }) approved_by: UserEntity | null;
  @Column({ type: "timestamptz", nullable: true }) approved_at: Date | null;
  @Column({ type: "timestamptz", nullable: true }) transferred_at: Date | null;
}
