import { Column, Entity, Check, Unique } from "typeorm";
import { SerialEntity } from "./base.entity";

export type ContractEndStatus = "expired" | "terminated" | "cancelled";
export type DepositPolicy = "refund_full" | "refund_after_deductions" | "manual_review";

@Unique("master_contract_end_reasons_code_key", ["code"])
@Check("master_contract_end_reasons_applicable_status_check", "((applicable_status)::text = ANY ((ARRAY['expired'::character varying, 'terminated'::character varying, 'cancelled'::character varying])::text[]))")
@Check("master_contract_end_reasons_default_deposit_policy_check", "((default_deposit_policy)::text = ANY ((ARRAY['refund_full'::character varying, 'refund_after_deductions'::character varying, 'manual_review'::character varying])::text[]))")
@Entity({ name: "master_contract_end_reasons" })
export class MasterContractEndReasonEntity extends SerialEntity {
  @Column({ type: "varchar", length: 64 }) code: string;
  @Column({ type: "varchar", length: 255 }) name_th: string;
  @Column({ type: "varchar", length: 255 }) name_en: string;
  @Column({ type: "varchar", length: 40 }) applicable_status: ContractEndStatus;
  @Column({ type: "varchar", length: 32, default: "manual_review" })
  default_deposit_policy: DepositPolicy;
  @Column({ type: "boolean", default: false }) requires_note: boolean;
  @Column({ type: "int", default: 0 }) sort_order: number;
  @Column({ type: "boolean", default: true }) is_active: boolean;
}
