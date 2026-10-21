import type { AgreementSignatureChannel, AgreementSignatureParty } from "@nestyk/types";
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { SerialEntity } from "./base.entity";
import { AgreementDocumentEntity } from "./agreement-document.entity";
import { AgreementSignInviteEntity } from "./agreement-sign-invite.entity";
import { LeaseContractEntity } from "./lease-contract.entity";
import { UserEntity } from "./user.entity";

/**
 * D17 + D9: one row per signature (who pressed, through which channel). Migration
 * supabase/migrations/20261021120000_agreement_signatures.sql. The old signature columns on
 * lease_contracts are still written too until the cleanup migration (S3 round 2).
 */
@Index("uq_agreement_signatures_live_party", ["agreement_id", "party"], { unique: true, where: "(voided_at IS NULL)" })
@Check("chk_agreement_signatures_party", "((party)::text = ANY ((ARRAY['owner'::character varying, 'tenant'::character varying, 'agent'::character varying, 'witness'::character varying])::text[]))")
@Check("chk_agreement_signatures_channel", "((channel)::text = ANY ((ARRAY['app'::character varying, 'link'::character varying, 'on_site'::character varying, 'uploaded_file'::character varying, 'legacy'::character varying])::text[]))")
@Check("chk_agreement_signatures_evidence", "(((channel)::text = 'legacy'::text) OR (((channel)::text = 'uploaded_file'::text) AND (signed_file_document_id IS NOT NULL)) OR (((channel)::text = ANY ((ARRAY['app'::character varying, 'link'::character varying, 'on_site'::character varying])::text[])) AND (signature_url IS NOT NULL)))")
@Check("chk_agreement_signatures_legacy", "(((channel)::text <> 'legacy'::text) OR ((party)::text = ANY ((ARRAY['owner'::character varying, 'tenant'::character varying, 'agent'::character varying])::text[])))")
@Check("chk_agreement_signatures_link", "(((channel)::text <> 'link'::text) OR (sign_invite_id IS NOT NULL))")
@Check("chk_agreement_signatures_witness_name", "(((party)::text <> 'witness'::text) OR (signed_by_user_id IS NOT NULL) OR (btrim((COALESCE(signer_name, ''::character varying))::text) <> ''::text))")
@Entity({ name: "agreement_signatures" })
export class AgreementSignatureEntity extends SerialEntity {
  @Column({ type: "int" }) agreement_id: number;
  @ManyToOne(() => LeaseContractEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "agreement_id", foreignKeyConstraintName: "agreement_signatures_agreement_id_fkey" })
  agreement: LeaseContractEntity;

  @Column({ type: "varchar", length: 16 }) party: AgreementSignatureParty;

  @Column({ type: "varchar", length: 16 }) channel: AgreementSignatureChannel;

  @Column({ type: "int", nullable: true }) signed_by_user_id: number | null;
  @ManyToOne(() => UserEntity, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "signed_by_user_id", foreignKeyConstraintName: "agreement_signatures_signed_by_user_id_fkey" })
  signed_by: UserEntity | null;

  @Column({ type: "varchar", length: 255, nullable: true }) signer_name: string | null;

  @Column({ type: "int", nullable: true }) sign_invite_id: number | null;
  @ManyToOne(() => AgreementSignInviteEntity, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "sign_invite_id", foreignKeyConstraintName: "agreement_signatures_sign_invite_id_fkey" })
  sign_invite: AgreementSignInviteEntity | null;

  @Column({ type: "text", nullable: true }) signature_url: string | null;

  @Column({ type: "int", nullable: true }) signed_file_document_id: number | null;
  @ManyToOne(() => AgreementDocumentEntity, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "signed_file_document_id", foreignKeyConstraintName: "agreement_signatures_signed_file_document_id_fkey" })
  signed_file_document: AgreementDocumentEntity | null;

  @Column({ type: "timestamptz", default: () => "now()" }) signed_at: Date;

  @Column({ type: "timestamptz", nullable: true }) voided_at: Date | null;
}
