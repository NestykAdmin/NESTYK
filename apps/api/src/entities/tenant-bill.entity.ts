import { Entity, Column, ManyToOne, JoinColumn, Check, Index, Unique } from "typeorm";
import { SerialTimestampEntity } from "./base.entity";
import { LeaseContractEntity } from "./lease-contract.entity";
import { TenantEntity } from "./tenant.entity";

/** `overdue` is derived from `grace_until` when read, never stored. */
export type TenantBillStoredStatus = "pending" | "paid";

@Unique("tenant_bills_document_no_key", ["document_no"])
@Unique("uq_tenant_bills_period", ["lease_contract_id", "period"])
@Index("idx_tenant_bills_tenant", ["tenant_id", "due_date"])
@Check("chk_tenant_bills_period_format", "((period)::text ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text)")
@Check("chk_tenant_bills_status", "((status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying])::text[]))")
@Entity({ name: "tenant_bills" })
export class TenantBillEntity extends SerialTimestampEntity {
  @Column({ type: "int" })
  lease_contract_id: number;

  @ManyToOne(() => LeaseContractEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "lease_contract_id", foreignKeyConstraintName: "tenant_bills_lease_contract_id_fkey" })
  lease_contract: LeaseContractEntity;

  @Column({ type: "int" })
  tenant_id: number;

  @ManyToOne(() => TenantEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "tenant_id", foreignKeyConstraintName: "tenant_bills_tenant_id_fkey" })
  tenant: TenantEntity;

  @Column({ type: "varchar", length: 7 })
  period: string;

  @Column({ type: "varchar", length: 40 })
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

  /** Storage path of the bill PDF; column exists since 20261006-tenant-bill-invoice.sql, not written by current code. */
  @Column({ type: "text", nullable: true })
  invoice_path: string | null;

  @Column({ type: "timestamptz", nullable: true })
  paid_at: Date | null;
}
