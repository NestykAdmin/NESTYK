import type { DealOfferConfirmationChannel, DealOfferConfirmationMethod, DealOfferStatus } from "@nestyk/types";
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { SerialTimestampEntity } from "./base.entity";
import { LeadEntity } from "./lead.entity";
import { RentRoomEntity } from "./rent-room.entity";
import { UserEntity } from "./user.entity";

/**
 * D2 (AC-2.1 to 2.4, round 1): the terms agreed for a lead and a room, confirmed by the landlord before booking.
 * Migration supabase/migrations/20261022150000_deal_offers.sql. The reservation amount is 1 month of rent (AC-2.2),
 * so it is not stored. One open offer (draft, awaiting_landlord, confirmed) per lead and room.
 */
@Index("uq_deal_offers_one_open", ["lead_id", "rent_room_id"], { unique: true, where: "((status)::text = ANY ((ARRAY['draft'::character varying, 'awaiting_landlord'::character varying, 'confirmed'::character varying])::text[]))" })
@Index("idx_deal_offers_room_status", ["rent_room_id", "status"])
@Index("idx_deal_offers_agent", ["created_by_user_id", "id"])
@Check("chk_deal_offers_co_broke", "((co_broke AND (co_broke_agent_name IS NOT NULL) AND (btrim((co_broke_agent_name)::text) <> ''::text)) OR ((NOT co_broke) AND (co_broke_agent_name IS NULL)))")
@Check("chk_deal_offers_confirmation", "(((confirmed_at IS NULL) AND (confirmed_by_user_id IS NULL) AND (confirmation_channel IS NULL) AND (confirmation_method IS NULL) AND (confirmation_note IS NULL)) OR ((confirmed_at IS NOT NULL) AND (confirmed_by_user_id IS NOT NULL) AND ((((confirmation_channel)::text = 'app'::text) AND (confirmation_method IS NULL) AND (confirmation_note IS NULL)) OR (((confirmation_channel)::text = 'agent_recorded'::text) AND ((confirmation_method)::text = ANY ((ARRAY['phone'::character varying, 'line'::character varying, 'in_person'::character varying, 'other'::character varying])::text[])) AND (confirmation_note IS NOT NULL) AND (btrim(confirmation_note) <> ''::text) AND (char_length(confirmation_note) <= 500)))))")
@Check("chk_deal_offers_revision", "(revision > 0)")
@Check("chk_deal_offers_status", "((status)::text = ANY ((ARRAY['draft'::character varying, 'awaiting_landlord'::character varying, 'confirmed'::character varying, 'room_taken'::character varying, 'cancelled'::character varying])::text[]))")
@Check("chk_deal_offers_status_dates", "((((status)::text <> 'confirmed'::text) OR (confirmed_at IS NOT NULL)) AND (((status)::text <> ALL ((ARRAY['draft'::character varying, 'awaiting_landlord'::character varying])::text[])) OR (confirmed_at IS NULL)) AND (((status)::text <> 'awaiting_landlord'::text) OR (sent_at IS NOT NULL)) AND (((status)::text = ANY ((ARRAY['room_taken'::character varying, 'cancelled'::character varying])::text[])) = (closed_at IS NOT NULL)))")
@Check("chk_deal_offers_terms", "((monthly_rent > (0)::numeric) AND ((term_months >= 1) AND (term_months <= 120)) AND (deposit_amount >= (0)::numeric) AND (contract_date <= start_date) AND ((rent_due_day >= 1) AND (rent_due_day <= 31)) AND ((grace_day IS NULL) OR ((grace_day >= 1) AND (grace_day <= 31))) AND ((late_fee_per_day IS NULL) OR (late_fee_per_day >= (0)::numeric)) AND ((renewal_notice_days >= 1) AND (renewal_notice_days <= 365)))")
@Entity({ name: "deal_offers" })
export class DealOfferEntity extends SerialTimestampEntity {
  @Column({ type: "int" }) lead_id: number;
  @ManyToOne(() => LeadEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "lead_id", foreignKeyConstraintName: "deal_offers_lead_id_fkey" })
  lead: LeadEntity;

  @Column({ type: "int" }) rent_room_id: number;
  @ManyToOne(() => RentRoomEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "rent_room_id", foreignKeyConstraintName: "deal_offers_rent_room_id_fkey" })
  rent_room: RentRoomEntity;

  @Column({ type: "varchar", length: 24, default: "draft" }) status: DealOfferStatus;
  /** Goes up on every change, so a confirmation is always for the terms the landlord saw. */
  @Column({ type: "int", default: 1 }) revision: number;

  @Column({ type: "decimal", precision: 12, scale: 2 }) monthly_rent: string;
  @Column({ type: "int" }) term_months: number;
  @Column({ type: "date" }) start_date: string;
  @Column({ type: "decimal", precision: 12, scale: 2 }) deposit_amount: string;
  /** The day the lease is to be signed (วันทำสัญญา). */
  @Column({ type: "date" }) contract_date: string;
  @Column({ type: "smallint" }) rent_due_day: number;
  /** Grace deadline as a day of the month, like the lease form; blank keeps the billing default. */
  @Column({ type: "smallint", nullable: true }) grace_day: number | null;
  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true }) late_fee_per_day: string | null;
  @Column({ type: "int", default: 30 }) renewal_notice_days: number;
  @Column({ type: "boolean", default: false }) co_broke: boolean;
  @Column({ type: "varchar", length: 120, nullable: true }) co_broke_agent_name: string | null;

  @Column({ type: "timestamptz", nullable: true }) sent_at: Date | null;
  @Column({ type: "timestamptz", nullable: true }) confirmed_at: Date | null;
  @Column({ type: "int", nullable: true }) confirmed_by_user_id: number | null;
  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "confirmed_by_user_id", foreignKeyConstraintName: "deal_offers_confirmed_by_user_id_fkey" })
  confirmed_by: UserEntity | null;
  @Column({ type: "varchar", length: 16, nullable: true }) confirmation_channel: DealOfferConfirmationChannel | null;
  @Column({ type: "varchar", length: 16, nullable: true }) confirmation_method: DealOfferConfirmationMethod | null;
  @Column({ type: "text", nullable: true }) confirmation_note: string | null;
  @Column({ type: "timestamptz", nullable: true }) closed_at: Date | null;

  @Column({ type: "int" }) created_by_user_id: number;
  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "created_by_user_id", foreignKeyConstraintName: "deal_offers_created_by_user_id_fkey" })
  created_by: UserEntity;
}
