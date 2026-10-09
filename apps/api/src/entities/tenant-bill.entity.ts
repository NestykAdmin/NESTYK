import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { SerialTimestampEntity } from "./base.entity";
import { LeaseContractEntity } from "./lease-contract.entity";
import { TenantEntity } from "./tenant.entity";

/** `overdue` is derived from `grace_until` when read, never stored. */
export type TenantBillStoredStatus = "pending" | "paid";

@Entity({ name: "tenant_bills" })
export class TenantBillEntity extends SerialTimestampEntity {
  @Column({ type: "int" })
  lease_contract_id: number;

  @ManyToOne(() => LeaseContractEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "lease_contract_id" })
  lease_contract: LeaseContractEntity;

  @Column({ type: "int" })
  tenant_id: number;

  @ManyToOne(() => TenantEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "tenant_id" })
  tenant: TenantEntity;

  @Column({ type: "varchar", length: 7 })
  period: string;

  @Column({ type: "varchar", length: 40, unique: true })
  document_no: string;

  @Column({ type: "date" })
  issue_date: string;

  @Column({ type: "date" })
  due_date: string;

  @Column({ type: "date" })
  grace_until: string;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  amount: string;

  @Column({ type: "varchar", length: 16, default: "pending" })
  status: TenantBillStoredStatus;

  @Column({ type: "text", nullable: true })
  payment_slip_path: string | null;

  @Column({ type: "timestamptz", nullable: true })
  paid_at: Date | null;
}
