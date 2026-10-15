import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from "typeorm";
import { SerialTimestampEntity } from "./base.entity";
import { UserEntity } from "./user.entity";
import { TenantEntity } from "./tenant.entity";
import type { FinancialDocumentInput } from "@nestyk/types";

@Unique("uq_agent_invoices_document", ["created_by_user_id", "document_no"])
@Index("idx_agent_invoices_agent", ["created_by_user_id", "id"])
@Index("idx_agent_invoices_tenant", ["tenant_id", "id"])
@Index("uq_agent_invoices_document_no", ["document_no"], { unique: true })
@Index("uq_agent_invoices_receipt_document_no", ["receipt_document_no"], { unique: true, where: "(receipt_document_no IS NOT NULL)" })
@Index("uq_agent_invoices_receipt_no", ["created_by_user_id", "receipt_document_no"], { unique: true, where: "(receipt_document_no IS NOT NULL)" })
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
}
