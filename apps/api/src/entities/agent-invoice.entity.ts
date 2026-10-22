import { Entity, Column, ManyToOne, JoinColumn, Index, Unique, Check } from "typeorm";
import { SerialTimestampEntity } from "./base.entity";
import { UserEntity } from "./user.entity";
import { TenantEntity } from "./tenant.entity";
import { LeaseContractEntity } from "./lease-contract.entity";
import type { FinancialDocumentInput } from "@nestyk/types";

/** D10: general = issued by the agent from the invoice menu; deposit = the lease deposit, issued for the landlord. */
export type AgentInvoiceKind = "general" | "deposit";

@Unique("uq_agent_invoices_document", ["created_by_user_id", "document_no"])
@Index("idx_agent_invoices_agent", ["created_by_user_id", "id"])
@Index("idx_agent_invoices_tenant", ["tenant_id", "id"])
@Index("uq_agent_invoices_document_no", ["document_no"], { unique: true })
@Index("uq_agent_invoices_receipt_document_no", ["receipt_document_no"], { unique: true, where: "(receipt_document_no IS NOT NULL)" })
@Index("uq_agent_invoices_receipt_no", ["created_by_user_id", "receipt_document_no"], { unique: true, where: "(receipt_document_no IS NOT NULL)" })
@Index("uq_agent_invoices_one_deposit", ["lease_contract_id"], { unique: true, where: "((invoice_kind)::text = 'deposit'::text)" })
@Check("chk_agent_invoices_kind", "((invoice_kind)::text = ANY ((ARRAY['general'::character varying, 'deposit'::character varying])::text[]))")
@Check("chk_agent_invoices_issuer", "((issuer_party)::text = ANY ((ARRAY['landlord'::character varying, 'agent'::character varying])::text[]))")
@Check("chk_agent_invoices_deposit", "(((invoice_kind)::text <> 'deposit'::text) OR ((lease_contract_id IS NOT NULL) AND ((issuer_party)::text = 'landlord'::text) AND (amount IS NOT NULL) AND (amount > (0)::numeric) AND (due_date IS NOT NULL)))")
@Entity({ name: "agent_invoices" })
export class AgentInvoiceEntity extends SerialTimestampEntity {
  @Column({ type: "int" })
  created_by_user_id: number;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "created_by_user_id", foreignKeyConstraintName: "agent_invoices_created_by_user_id_fkey" })
  created_by: UserEntity;

  @Column({ type: "varchar", length: 40 })
  document_no: string;

  @Column({ type: "date" })
  issue_date: string;

  @Column({ type: "int", nullable: true })
  tenant_id: number | null;

  @ManyToOne(() => TenantEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "tenant_id", foreignKeyConstraintName: "agent_invoices_tenant_id_fkey" })
  tenant: TenantEntity | null;

  @Column({ type: "varchar", length: 120 })
  customer_name: string;

  @Column({ type: "jsonb" })
  data: FinancialDocumentInput;

  @Column({ type: "text" })
  pdf_path: string;

  @Column({ type: "varchar", length: 40, nullable: true })
  receipt_document_no: string | null;

  @Column({ type: "date", nullable: true })
  receipt_issue_date: string | null;

  @Column({ type: "jsonb", nullable: true })
  receipt_data: FinancialDocumentInput | null;

  @Column({ type: "text", nullable: true })
  receipt_pdf_path: string | null;

  @Column({ type: "text", nullable: true })
  payment_slip_path: string | null;

  /** D10, migration 20261021130000_deposit_invoices.sql */
  @Column({ type: "varchar", length: 24, default: "general" })
  invoice_kind: AgentInvoiceKind;

  @Column({ type: "int", nullable: true })
  lease_contract_id: number | null;

  @ManyToOne(() => LeaseContractEntity, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "lease_contract_id", foreignKeyConstraintName: "agent_invoices_lease_contract_id_fkey" })
  lease_contract: LeaseContractEntity | null;

  @Column({ type: "varchar", length: 16, default: "agent" })
  issuer_party: "landlord" | "agent";

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  amount: string | null;

  @Column({ type: "date", nullable: true })
  due_date: string | null;

  /** When the tenant sent the slip in the app (a slip the agent attaches with the receipt leaves this empty). */
  @Column({ type: "timestamptz", nullable: true })
  slip_submitted_at: Date | null;
}
