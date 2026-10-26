import type { HandoverItemCondition, HandoverKind } from "@nestyk/types";
import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import { SerialEntity, SerialTimestampEntity } from "./base.entity";
import { LeaseContractEntity } from "./lease-contract.entity";
import { UserEntity } from "./user.entity";

/**
 * D6 (AC-6.1 to 6.4): handing the room over, after the deposit receipt. Migration
 * supabase/migrations/20261022120000_handover_records.sql. 1 record per lease and kind (move_in now, move_out for D16).
 * The landlord and the tenant sign it; their signatures are rows of agreement_signatures with handover_record_id set.
 * `revision` goes up on every change, so a signature is always for the content the signer saw.
 */
@Index("uq_handover_records_agreement_kind", ["agreement_id", "kind"], { unique: true })
@Check("chk_handover_records_kind", "((kind IS NOT NULL) AND ((kind)::text = ANY ((ARRAY['move_in'::character varying, 'move_out'::character varying])::text[])))")
@Check("chk_handover_records_revision", "(revision > 0)")
@Check("chk_handover_records_note", "((note IS NULL) OR (char_length(note) <= 1000))")
@Entity({ name: "handover_records" })
export class HandoverRecordEntity extends SerialTimestampEntity {
  @Column({ type: "int" }) agreement_id: number;
  @ManyToOne(() => LeaseContractEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "agreement_id", foreignKeyConstraintName: "handover_records_agreement_id_fkey" })
  agreement: LeaseContractEntity;

  @Column({ type: "varchar", length: 16 }) kind: HandoverKind;

  @Column({ type: "date", nullable: true }) handover_date: string | null;

  @Column({ type: "text", nullable: true }) note: string | null;

  @Column({ type: "int", default: 1 }) revision: number;

  /** Set when the last of the 2 parties signs; the record is locked from then on. */
  @Column({ type: "timestamptz", nullable: true }) completed_at: Date | null;

  @Column({ type: "int" }) created_by_user_id: number;
  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "created_by_user_id", foreignKeyConstraintName: "handover_records_created_by_user_id_fkey" })
  created_by: UserEntity;

  @OneToMany(() => HandoverItemEntity, (item) => item.record) items: HandoverItemEntity[];
  @OneToMany(() => HandoverPhotoEntity, (photo) => photo.record) photos: HandoverPhotoEntity[];
}

/** Annex 1: what is in the room. Something damaged or missing needs a note. */
@Index("idx_handover_items_record", ["handover_record_id", "sort_order"])
@Check("chk_handover_items_name", "(btrim((name)::text) <> ''::text)")
@Check("chk_handover_items_quantity", "((quantity >= 1) AND (quantity <= 999))")
@Check("chk_handover_items_condition", "((condition IS NOT NULL) AND ((condition)::text = ANY ((ARRAY['good'::character varying, 'damaged'::character varying, 'missing'::character varying])::text[])))")
@Check("chk_handover_items_note", "(((condition)::text = 'good'::text) OR (btrim((COALESCE(note, ''::character varying))::text) <> ''::text))")
@Entity({ name: "handover_items" })
export class HandoverItemEntity extends SerialEntity {
  @Column({ type: "int" }) handover_record_id: number;
  @ManyToOne(() => HandoverRecordEntity, (record) => record.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "handover_record_id", foreignKeyConstraintName: "handover_items_handover_record_id_fkey" })
  record: HandoverRecordEntity;

  @Column({ type: "int", default: 0 }) sort_order: number;

  @Column({ type: "varchar", length: 120 }) name: string;

  @Column({ type: "int", default: 1 }) quantity: number;

  @Column({ type: "varchar", length: 16 }) condition: HandoverItemCondition;

  @Column({ type: "varchar", length: 500, nullable: true }) note: string | null;

  /** move_out only (D16): the move_in item this row compares against. */
  @Column({ type: "int", nullable: true }) move_in_item_id: number | null;
  @ManyToOne(() => HandoverItemEntity, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "move_in_item_id", foreignKeyConstraintName: "handover_items_move_in_item_id_fkey" })
  move_in_item: HandoverItemEntity | null;
}

/** Annex 2: photos of the room, in the private contract-documents bucket. */
@Index("idx_handover_photos_record", ["handover_record_id", "id"])
@Entity({ name: "handover_photos" })
export class HandoverPhotoEntity extends SerialEntity {
  @Column({ type: "int" }) handover_record_id: number;
  @ManyToOne(() => HandoverRecordEntity, (record) => record.photos, { onDelete: "CASCADE" })
  @JoinColumn({ name: "handover_record_id", foreignKeyConstraintName: "handover_photos_handover_record_id_fkey" })
  record: HandoverRecordEntity;

  @Column({ type: "text" }) storage_path: string;

  @Column({ type: "varchar", length: 200, nullable: true }) caption: string | null;

  @Column({ type: "int", nullable: true }) uploaded_by_user_id: number | null;
  @ManyToOne(() => UserEntity, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "uploaded_by_user_id", foreignKeyConstraintName: "handover_photos_uploaded_by_user_id_fkey" })
  uploaded_by: UserEntity | null;

  @Column({ type: "timestamptz", default: () => "now()" }) created_at: Date;
}
