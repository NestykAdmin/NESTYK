import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Check, Index } from "typeorm";
import { SerialTimestampEntity } from './base.entity';
import { RentRoomEntity } from './rent-room.entity';
import { UserEntity } from './user.entity';
import { MasterRoomTypeEntity } from './master-room-type.entity';
import { MasterVisaTypeEntity } from './master-visa-type.entity';
import { TenantEntity } from './tenant.entity';
import { LeadLocationEntity } from './lead-location.entity';

export type LeadContactChannel = { channel: string; value: string };

export type LeadStatus = 'new' | 'inprogress' | 'lost' | 'booked';

@Index("idx_leads_agent_desired_room_type", ["created_by_user_id", "desired_room_type_id"])
@Index("idx_leads_agent_province", ["created_by_user_id", "province"])
@Index("idx_leads_created_by_user_id", ["created_by_user_id"])
@Index("idx_leads_locations", ["locations"])
@Index("idx_leads_phone", ["phone"])
@Index("idx_leads_rent_room_id", ["rent_room_id"])
@Index("idx_leads_status", ["status"])
@Index("uq_leads_one_booked_per_room", ["rent_room_id"], { unique: true, where: "((status)::text = 'booked'::text)" })
@Check("chk_leads_budget", "(((budget_min IS NULL) OR ((budget_min >= (0)::numeric) AND (budget_min <> 'NaN'::numeric))) AND ((budget_max IS NULL) OR ((budget_max > (0)::numeric) AND (budget_max <> 'NaN'::numeric))) AND ((budget_min IS NULL) OR (budget_max IS NULL) OR (budget_min <= budget_max)))")
@Check("chk_leads_lease_duration", "((lease_duration_months IS NULL) OR (lease_duration_months > 0))")
@Check("chk_leads_occupant_count", "((occupant_count IS NULL) OR (occupant_count > 0))")
@Check("chk_leads_other_contacts_array", "(jsonb_typeof(other_contacts) = 'array'::text)")
@Check("chk_leads_radius_km", "((radius_km IS NULL) OR (radius_km = ANY (ARRAY[1, 3, 5])))")
@Check("chk_leads_status", "((status)::text = ANY ((ARRAY['new'::character varying, 'inprogress'::character varying, 'lost'::character varying, 'booked'::character varying])::text[]))")
@Entity({ name: 'leads' })
export class LeadEntity extends SerialTimestampEntity {
  @Column({ type: 'int', nullable: true })
  rent_room_id: number | null;

  /** Release the room without erasing the lead's historical room/tenant link. */
  @Column({ type: 'timestamptz', nullable: true })
  booking_released_at: Date | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  first_name: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  last_name: string;

  @Column({ type: 'varchar', length: 50 })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'int', nullable: true, comment: "Desired room type; independent of a selected rental room" })
  desired_room_type_id: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  nationality: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location_place_id: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  location_name: string | null;

  /** Legacy single pin — superseded by `pins` (lead_locations); no longer written. */
  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  /** Search radius shared by every pin in `pins`. */
  @Column({ type: 'smallint', nullable: true, comment: "Requested straight-line radius in km around the map pin" })
  radius_km: number | null;

  @OneToMany(() => LeadLocationEntity, (pin) => pin.lead)
  pins: LeadLocationEntity[];

  @Column({ type: 'varchar', length: 120, nullable: true, comment: "Canonical Thai province; NULL for legacy leads" })
  province: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  locations: string[];

  @Column({ type: 'varchar', length: 500, nullable: true, comment: "Additional location details; legacy free-text location preserved" })
  preferred_location: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: "Free-text move-in plan, e.g. immediately, October 2026, or an exact date" })
  move_in_plan: string | null;

  @Column({ type: 'boolean', nullable: true, comment: "NULL = unknown; true = pets; false = no pets" })
  has_pets: boolean | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  occupation: string | null;

  @Column({ type: 'int', nullable: true, comment: "Optional FK to master_visa_types; NULL when unknown or not a foreign national" })
  visa_type_id: number | null;

  @Column({ type: 'smallint', nullable: true, comment: "Requested rental duration in whole months" })
  lease_duration_months: number | null;

  @Column({ type: 'boolean', nullable: true, comment: "NULL = unknown; true = uses a car; false = no car" })
  uses_car: boolean | null;

  @Column({ type: 'smallint', nullable: true })
  occupant_count: number | null;

  @Column({ type: 'boolean', nullable: true, comment: "NULL = unknown; true = smoker; false = non-smoker" })
  is_smoker: boolean | null;

  /** Monthly rent budget in THB. Decimal values are returned as strings. */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, comment: "Minimum monthly rent budget, THB" })
  budget_min: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, comment: "Maximum monthly rent budget, THB" })
  budget_max: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'", comment: "Array of {channel, value}, e.g. line, whatsapp, facebook" })
  other_contacts: LeadContactChannel[];

  @ManyToOne(() => MasterRoomTypeEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: "desired_room_type_id", foreignKeyConstraintName: "leads_desired_room_type_id_fkey" })
  desired_room_type: MasterRoomTypeEntity | null;

  @ManyToOne(() => MasterVisaTypeEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: "visa_type_id", foreignKeyConstraintName: "leads_visa_type_id_fkey" })
  visa_type: MasterVisaTypeEntity | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  source: string | null;

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: LeadStatus;

  @Column({ type: 'timestamptz', nullable: true })
  viewed_at: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  lost_reason: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Saved room-matching preferences; null = defaults. Shape: LeadMatchSettings in @nestyk/types. */
  @Column({ type: 'jsonb', nullable: true })
  match_settings: Record<string, unknown> | null;

  @Column({ type: 'int', nullable: true })
  tenant_id: number | null;

  @Column({ type: 'int' })
  created_by_user_id: number;

  @ManyToOne(() => RentRoomEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: "rent_room_id", foreignKeyConstraintName: "leads_rent_room_id_fkey" })
  rent_room: RentRoomEntity | null;

  @ManyToOne(() => TenantEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: "tenant_id", foreignKeyConstraintName: "fk_leads_tenant_id" })
  tenant: TenantEntity | null;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: "created_by_user_id", foreignKeyConstraintName: "leads_created_by_user_id_fkey" })
  created_by: UserEntity;
}
