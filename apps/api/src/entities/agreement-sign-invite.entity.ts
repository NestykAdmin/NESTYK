import type { ContractParty } from "@nestyk/types";
import { Column, Entity, JoinColumn, ManyToOne, Check, Index, Unique } from "typeorm";
import { SerialCreatedEntity } from "./base.entity";
import { LeaseContractEntity } from "./lease-contract.entity";
import { UserEntity } from "./user.entity";

@Unique("uq_agreement_sign_invites_token_hash", ["token_hash"])
@Index("idx_agreement_sign_invites_agreement_party", ["agreement_id", "party"], { where: "((used_at IS NULL) AND (revoked_at IS NULL))" })
@Check("agreement_sign_invites_party_check", "((party)::text = ANY ((ARRAY['owner'::character varying, 'tenant'::character varying])::text[]))")
@Entity({ name: "agreement_sign_invites" })
export class AgreementSignInviteEntity extends SerialCreatedEntity {
  @Column({ type: "int" }) agreement_id: number;
  @ManyToOne(() => LeaseContractEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agreement_id", foreignKeyConstraintName: "agreement_sign_invites_agreement_id_fkey" })
  agreement: LeaseContractEntity;

  @Column({ type: "varchar", length: 16 }) party: ContractParty;

  @Column({ type: "char", length: 64 }) token_hash: string;

  @Column({ type: "timestamptz" }) expires_at: Date;

  @Column({ type: "timestamptz", nullable: true }) used_at: Date | null;

  @Column({ type: "timestamptz", nullable: true }) revoked_at: Date | null;

  @Column({ type: "int" }) created_by_user_id: number;
  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "created_by_user_id", foreignKeyConstraintName: "agreement_sign_invites_created_by_user_id_fkey" })
  created_by: UserEntity;
}
