import { Column, Entity, JoinColumn, ManyToOne, Check, Index } from "typeorm";
import { SerialTimestampEntity } from "./base.entity";
import { ContractDepositSettlementEntity } from "./contract-deposit-settlement.entity";

export type DepositDeductionType = "rent" | "utilities" | "damage" | "other";

@Index("idx_deposit_deduction_settlement", ["settlement_id"])
@Check("deposit_deduction_items_amount_check", "((amount > (0)::numeric) AND (amount <> 'NaN'::numeric))")
@Check("deposit_deduction_items_deduction_type_check", "((deduction_type)::text = ANY ((ARRAY['rent'::character varying, 'utilities'::character varying, 'damage'::character varying, 'other'::character varying])::text[]))")
@Check("deposit_deduction_items_description_check", "(btrim(description) <> ''::text)")
@Check("deposit_deduction_items_evidence_reference_check", "(btrim(evidence_reference) <> ''::text)")
@Entity({ name: "deposit_deduction_items" })
export class DepositDeductionItemEntity extends SerialTimestampEntity {
  @Column({ type: "int" }) settlement_id: number;
  @ManyToOne(() => ContractDepositSettlementEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "settlement_id", foreignKeyConstraintName: "deposit_deduction_items_settlement_id_fkey" }) settlement: ContractDepositSettlementEntity;
  @Column({ type: "varchar", length: 32 }) deduction_type: DepositDeductionType;
  @Column({ type: "text" }) description: string;
  @Column({ type: "decimal", precision: 12, scale: 2 }) amount: string;
  @Column({ type: "text" }) evidence_reference: string;
}
