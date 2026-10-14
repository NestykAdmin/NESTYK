import { AgreementTemplateEntity } from "./agreement-template.entity";
import { MasterAgreementTypeEntity } from "./master-agreement-type.entity";
import { Entity, Column, ManyToOne, JoinColumn, Check, Index, Unique } from "typeorm";
import { SerialTimestampEntity } from "./base.entity";
import { RoomTenancyEntity } from "./room-tenancy.entity";
import { RentRoomEntity } from "./rent-room.entity";
import { TenantEntity } from "./tenant.entity";
import { LeadEntity } from "./lead.entity";
import { PropertyOwnerEntity } from "./property-owner.entity";
import { UserEntity } from "./user.entity";
import { MasterContractEndReasonEntity } from "./master-contract-end-reason.entity";

export type LeaseContractStatus =
  | "draft"
  | "awaiting_signatures"
  | "awaiting_agent_review"
  | "awaiting_payment"
  | "awaiting_payment_verification"
  | "active"
  | "cancelled"
  | "expired"
  | "terminated";

@Unique("lease_contracts_contract_no_key", ["contract_no"])
@Index("idx_agreement_one_renewal", ["previous_agreement_id"], { unique: true, where: "((previous_agreement_id IS NOT NULL) AND ((status)::text <> 'cancelled'::text))" })
@Index("idx_agreement_root", ["root_agreement_id"])
@Index("idx_lease_contracts_agreement_type", ["agreement_type_code"])
@Index("idx_lease_contracts_created_by_user_id", ["created_by_user_id"])
@Index("idx_lease_contracts_lead_id", ["lead_id"])
@Index("idx_lease_contracts_original_contract_id", ["original_contract_id"])
@Index("idx_lease_contracts_owner_user_id", ["owner_user_id"], { where: "(owner_user_id IS NOT NULL)" })
@Index("idx_lease_contracts_rent_room_id", ["rent_room_id"])
@Index("idx_lease_contracts_room_tenancy_id", ["room_tenancy_id"])
@Index("idx_lease_contracts_status_updated_at", ["status", "updated_at"])
@Index("idx_lease_contracts_tenant_id", ["tenant_id"])
@Check("chk_agreement_data", "((jsonb_typeof(data) = 'object'::text) AND (jsonb_typeof(party_snapshot) = 'object'::text))")
@Check("chk_agreement_lineage", "((((agreement_kind)::text = 'new'::text) AND (previous_agreement_id IS NULL)) OR (((agreement_kind)::text = 'renewal'::text) AND (previous_agreement_id IS NOT NULL) AND (root_agreement_id IS NOT NULL) AND (previous_agreement_id <> id) AND (root_agreement_id <> id)))")
@Check("chk_lease_contracts_status", "((status)::text = ANY ((ARRAY['draft'::character varying, 'awaiting_signatures'::character varying, 'awaiting_agent_review'::character varying, 'awaiting_payment'::character varying, 'awaiting_payment_verification'::character varying, 'active'::character varying, 'cancelled'::character varying, 'expired'::character varying, 'terminated'::character varying])::text[]))")
@Check("chk_reservation_fee_nonnegative", "(reservation_fee >= (0)::numeric)")
@Index("idx_contract_end_reason", ["end_reason_id"])
@Entity({ name: "lease_contracts" })
export class LeaseContractEntity extends SerialTimestampEntity {
  @Column({ type: "int" }) template_id: number;
  @ManyToOne(() => AgreementTemplateEntity, { onDelete: "RESTRICT" })
  /** Composite FK: the template must belong to the same agreement type as the contract. */
  @JoinColumn([
    { name: "template_id", referencedColumnName: "id", foreignKeyConstraintName: "fk_contract_template_type" },
    { name: "agreement_type_code", referencedColumnName: "agreement_type_code", foreignKeyConstraintName: "fk_contract_template_type" },
  ])
  template: AgreementTemplateEntity;
  @Column({ type: "jsonb", default: {} }) data: Record<string, unknown>;
  @Column({ type: "jsonb", default: {} }) party_snapshot: Record<
    string,
    unknown
  >;
  @Column({ type: "varchar", length: 16, default: "new" }) agreement_kind:
    "new" | "renewal";
  @Column({ type: "int", nullable: true }) previous_agreement_id: number | null;
  @Column({ type: "int", nullable: true }) root_agreement_id: number | null;
  @ManyToOne(() => LeaseContractEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "previous_agreement_id", foreignKeyConstraintName: "lease_contracts_previous_agreement_id_fkey" })
  previous_agreement: LeaseContractEntity | null;
  @ManyToOne(() => LeaseContractEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "root_agreement_id", foreignKeyConstraintName: "lease_contracts_root_agreement_id_fkey" })
  root_agreement: LeaseContractEntity | null;

  @Column({ type: "varchar", length: 64, default: "lease" })
  agreement_type_code: string;

  @ManyToOne(() => MasterAgreementTypeEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "agreement_type_code", referencedColumnName: "code", foreignKeyConstraintName: "fk_lease_agreement_type" })
  agreement_type: MasterAgreementTypeEntity;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  reservation_fee: string | null;

  @Column({ type: "varchar", length: 32, nullable: true })
  contract_no: string | null;

  @Column({ type: "int" })
  room_tenancy_id: number;

  @Column({ type: "int" })
  rent_room_id: number;

  @Column({ type: "int" })
  tenant_id: number;

  @Column({ type: "int" })
  lead_id: number;

  @Column({ type: "int", nullable: true })
  property_owner_id: number | null;

  @Column({ type: "int", nullable: true })
  owner_user_id: number | null;

  @Column({ type: "int" })
  created_by_user_id: number;

  /** @deprecated Legacy link, superseded by previous_agreement_id / root_agreement_id; not read or written by current code. */
  @Column({ type: "int", nullable: true })
  original_contract_id: number | null;

  /** @deprecated Legacy, superseded by agreement_type_code; not a foreign key and not read or written by current code. */
  @Column({ type: "varchar", length: 64, nullable: true })
  contract_type_code: string | null;

  @Column({ type: "date" })
  start_date: string;

  @Column({ type: "date", nullable: true })
  end_date: string | null;

  @Column({ type: "date", nullable: true })
  move_in_date: string | null;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  monthly_rent: string | null;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  deposit: string | null;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  advance_rent: string | null;

  @Column({ type: "varchar", length: 40, default: "draft" })
  status: LeaseContractStatus;

  @Column({ type: "text", nullable: true })
  document_url: string | null;

  @Column({ type: "text", nullable: true })
  invoice_url: string | null;

  @Column({ type: "text", nullable: true })
  receipt_url: string | null;

  @Column({ type: "timestamptz", nullable: true })
  owner_signed_at: Date | null;

  @Column({ type: "text", nullable: true })
  owner_signature_url: string | null;

  @Column({ type: "timestamptz", nullable: true })
  tenant_signed_at: Date | null;

  @Column({ type: "text", nullable: true })
  tenant_signature_url: string | null;

  @Column({ type: "timestamptz", nullable: true })
  agent_signed_at: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  owner_delivered_at: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  tenant_delivered_at: Date | null;

  @Column({ type: "text", nullable: true })
  agent_signature_url: string | null;

  @Column({ type: "int", nullable: true })
  reviewed_by_user_id: number | null;

  @Column({ type: "timestamptz", nullable: true })
  reviewed_at: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  payment_submitted_at: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  terminated_at: Date | null;

  @Column({ type: "int", nullable: true }) end_reason_id: number | null;
  @ManyToOne(() => MasterContractEndReasonEntity, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "end_reason_id", foreignKeyConstraintName: "lease_contracts_end_reason_id_fkey" }) end_reason: MasterContractEndReasonEntity | null;
  @Column({ type: "text", nullable: true }) end_reason_note: string | null;
  @Column({ type: "date", nullable: true }) effective_end_date: string | null;
  @Column({ type: "timestamptz", nullable: true }) end_recorded_at: Date | null;
  @Column({ type: "int", nullable: true }) end_recorded_by_user_id: number | null;
  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "end_recorded_by_user_id", foreignKeyConstraintName: "lease_contracts_end_recorded_by_user_id_fkey" }) end_recorded_by: UserEntity | null;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @ManyToOne(() => RoomTenancyEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "room_tenancy_id", foreignKeyConstraintName: "lease_contracts_room_tenancy_id_fkey" })
  room_tenancy: RoomTenancyEntity;

  @ManyToOne(() => RentRoomEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "rent_room_id", foreignKeyConstraintName: "lease_contracts_rent_room_id_fkey" })
  rent_room: RentRoomEntity;

  @ManyToOne(() => TenantEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "tenant_id", foreignKeyConstraintName: "lease_contracts_tenant_id_fkey" })
  tenant: TenantEntity;

  @ManyToOne(() => LeadEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "lead_id", foreignKeyConstraintName: "lease_contracts_lead_id_fkey" })
  lead: LeadEntity;

  @ManyToOne(() => PropertyOwnerEntity, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "property_owner_id", foreignKeyConstraintName: "lease_contracts_property_owner_id_fkey" })
  property_owner: PropertyOwnerEntity | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "owner_user_id", foreignKeyConstraintName: "lease_contracts_owner_user_id_fkey" })
  owner_user: UserEntity | null;

  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "created_by_user_id", foreignKeyConstraintName: "lease_contracts_created_by_user_id_fkey" })
  created_by: UserEntity;

  @ManyToOne(() => LeaseContractEntity, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "original_contract_id", foreignKeyConstraintName: "lease_contracts_original_contract_id_fkey" })
  original_contract: LeaseContractEntity | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "reviewed_by_user_id", foreignKeyConstraintName: "lease_contracts_reviewed_by_user_id_fkey" })
  reviewed_by: UserEntity | null;
}
