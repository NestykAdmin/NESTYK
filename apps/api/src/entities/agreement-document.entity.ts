import { Entity, Column, PrimaryColumn, Check, Index, Unique, ManyToOne, JoinColumn } from "typeorm";
import { SerialEntity, SerialCreatedEntity } from "./base.entity";
import { AgreementTemplateEntity } from "./agreement-template.entity";
import { LeaseContractEntity } from "./lease-contract.entity";
import { UserEntity } from "./user.entity";
@Entity({ name: "master_document_types" })
export class MasterDocumentTypeEntity {
  @PrimaryColumn({ type: "varchar", length: 64 }) code: string;
  @Column({ type: "varchar", length: 255 }) name_th: string;
  @Column({ type: "boolean", default: true }) is_active: boolean;
}
@Unique("agreement_template_document_r_template_id_group_key_documen_key", ["template_id", "group_key", "document_type_code"])
@Check("agreement_template_document_requirements_subject_check", "((subject)::text = ANY ((ARRAY['tenant'::character varying, 'owner'::character varying, 'property'::character varying, 'representative'::character varying])::text[]))")
@Entity({ name: "agreement_template_document_requirements" })
export class AgreementDocumentRequirementEntity extends SerialEntity {
  @Column({ type: "int" }) template_id: number;
  @Column({ type: "varchar", length: 64 }) group_key: string;
  @Column({ type: "varchar", length: 255 }) label: string;
  @Column({ type: "varchar", length: 32 }) subject: string;
  @Column({ type: "varchar", length: 64 }) document_type_code: string;
  @ManyToOne(() => AgreementTemplateEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "template_id", foreignKeyConstraintName: "agreement_template_document_requirements_template_id_fkey" })
  template: AgreementTemplateEntity;
  @ManyToOne(() => MasterDocumentTypeEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "document_type_code", referencedColumnName: "code", foreignKeyConstraintName: "agreement_template_document_requirement_document_type_code_fkey" })
  document_type: MasterDocumentTypeEntity;
}
@Unique("agreement_documents_file_path_key", ["file_path"])
@Unique("agreement_documents_supersedes_document_id_key", ["supersedes_document_id"])
@Index("idx_agreement_documents_contract", ["agreement_id"])
@Check("agreement_documents_byte_size_check", "((byte_size > 0) AND (byte_size <= 10485760))")
@Check("agreement_documents_check", "((((review_status)::text = 'pending'::text) AND (reviewed_by_user_id IS NULL) AND (reviewed_at IS NULL)) OR (((review_status)::text <> 'pending'::text) AND (reviewed_by_user_id IS NOT NULL) AND (reviewed_at IS NOT NULL)))")
@Check("agreement_documents_mime_type_check", "((mime_type)::text = ANY ((ARRAY['application/pdf'::character varying, 'image/jpeg'::character varying, 'image/png'::character varying])::text[]))")
@Check("agreement_documents_review_status_check", "((review_status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[]))")
@Check("agreement_documents_subject_check", "((subject)::text = ANY ((ARRAY['tenant'::character varying, 'owner'::character varying, 'property'::character varying, 'representative'::character varying])::text[]))")
@Entity({ name: "agreement_documents" })
export class AgreementDocumentEntity extends SerialCreatedEntity {
  @Column({ type: "timestamptz", nullable: true }) removed_at: Date | null;
  @Column({ type: "int" }) agreement_id: number;
  @Column({ type: "varchar", length: 64 }) document_type_code: string;
  @Column({ type: "varchar", length: 32 }) subject: string;
  @Column({ type: "text" }) file_path: string;
  @Column({ type: "varchar", length: 255 }) file_name: string;
  @Column({ type: "varchar", length: 64 }) mime_type: string;
  @Column({ type: "int" }) byte_size: number;
  @Column({ type: "int" }) uploaded_by_user_id: number;
  @Column({ type: "varchar", length: 16, default: "pending" }) review_status:
    "pending" | "accepted" | "rejected";
  @Column({ type: "int", nullable: true }) reviewed_by_user_id: number | null;
  @Column({ type: "timestamptz", nullable: true }) reviewed_at: Date | null;
  @Column({ type: "varchar", length: 1000, nullable: true }) review_note:
    string | null;
  @Column({ type: "int", nullable: true }) supersedes_document_id:
    number | null;
  @Column({ type: "int", nullable: true }) source_document_id: number | null;
  @ManyToOne(() => LeaseContractEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "agreement_id", foreignKeyConstraintName: "agreement_documents_agreement_id_fkey" })
  agreement: LeaseContractEntity;
  @ManyToOne(() => MasterDocumentTypeEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "document_type_code", referencedColumnName: "code", foreignKeyConstraintName: "agreement_documents_document_type_code_fkey" })
  document_type: MasterDocumentTypeEntity;
  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "uploaded_by_user_id", foreignKeyConstraintName: "agreement_documents_uploaded_by_user_id_fkey" })
  uploaded_by: UserEntity;
  @ManyToOne(() => UserEntity, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "reviewed_by_user_id", foreignKeyConstraintName: "agreement_documents_reviewed_by_user_id_fkey" })
  reviewed_by: UserEntity | null;
  @ManyToOne(() => AgreementDocumentEntity, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "supersedes_document_id", foreignKeyConstraintName: "agreement_documents_supersedes_document_id_fkey" })
  supersedes_document: AgreementDocumentEntity | null;
  @ManyToOne(() => AgreementDocumentEntity, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "source_document_id", foreignKeyConstraintName: "agreement_documents_source_document_id_fkey" })
  source_document: AgreementDocumentEntity | null;
}
