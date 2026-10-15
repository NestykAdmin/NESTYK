import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Check, Index } from "typeorm";
import { SerialTimestampEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { PropertyEntity } from './property.entity';
import { PropertyOwnerEntity } from './property-owner.entity';
import { MasterRoomStatusEntity } from './master-room-status.entity';
import { MasterRoomTypeEntity } from './master-room-type.entity';
import { MasterListingSourceEntity } from './master-listing-source.entity';
import { RoomMediaEntity } from './room-media.entity';
import { RentRoomDocumentEntity } from './rent-room-document.entity';
import { RoomLayoutValueEntity } from './room-layout-value.entity';
import { RoomFacilityEntity } from './room-facility.entity';
import { RentRoomContactEntity } from './rent-room-contact.entity';
import { RentRoomPriceEntity } from './rent-room-price.entity';

export type RentRoomVisibility = 'private' | 'published';

@Index("idx_rent_rooms_created_by_user_id", ["created_by_user_id"])
@Index("idx_rent_rooms_is_scout_room", ["is_scout_room"])
@Index("idx_rent_rooms_listing_source_id", ["listing_source_id"])
@Index("idx_rent_rooms_owner_id", ["owner_id"])
@Index("idx_rent_rooms_properties_id", ["properties_id"])
@Index("idx_rent_rooms_property_owner_id", ["property_owner_id"])
@Index("idx_rent_rooms_public_scout_listing", ["visibility", "room_status_id"], { where: "((is_scout_room = true) AND ((visibility)::text = 'published'::text))" })
@Index("idx_rent_rooms_room_type_id", ["room_type_id"])
@Check("chk_rent_rooms_advance_rent_months", "((advance_rent_months >= 0) AND (advance_rent_months <= 12))")
@Check("chk_rent_rooms_deposit_months", "((deposit_months >= 0) AND (deposit_months <= 12))")
@Check("chk_rent_rooms_owner_invariant", "(is_scout_room OR ((owner_id IS NOT NULL) AND (property_owner_id IS NULL) AND (visibility IS NULL)))")
@Check("chk_rent_rooms_scout_invariant", "((NOT is_scout_room) OR ((created_by_user_id IS NOT NULL) AND (owner_id IS NULL) AND ((visibility)::text = ANY ((ARRAY['private'::character varying, 'published'::character varying])::text[]))))")
@Check("chk_rent_rooms_visibility", "((visibility IS NULL) OR ((visibility)::text = ANY ((ARRAY['private'::character varying, 'published'::character varying])::text[])))")
@Entity({ name: 'rent_rooms' })
export class RentRoomEntity extends SerialTimestampEntity {
  @Column({ type: 'varchar', length: 100, nullable: true })
  room_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: "Agent-only internal listing name" })
  listing_title: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: "Public listing headline for share / marketplace" })
  promo_title: string | null;

  @Column({ type: 'text', nullable: true })
  listing_description: string | null;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  available_from_date: string;

  @Column({ type: 'jsonb', nullable: true })
  prices: Record<string, unknown>[] | null;

  @Column({ type: 'jsonb', default: [] })
  custom_facilities: string[];

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  nearby_other: string | null;

  @Column({ type: 'jsonb', default: [] })
  nearby_places: unknown[];

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  water_rate_per_unit: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  electric_rate_per_unit: string | null;

  @Column({ type: 'smallint', default: 1 })
  advance_rent_months: number;

  @Column({ type: 'smallint', default: 2 })
  deposit_months: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  owner_identity_number: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  owner_bank_name: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  owner_bank_account: string | null;

  @Column({ type: 'boolean', default: false })
  is_scout_room: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  visibility: RentRoomVisibility | null;

  @Column({ type: 'int', nullable: true })
  created_by_user_id: number | null;

  @Column({ type: 'int', nullable: true })
  property_owner_id: number | null;

  @Column({ type: 'int', nullable: true })
  owner_id: number | null;

  @Column({ type: 'int' })
  properties_id: number;

  @Column({ type: 'int', nullable: true })
  room_type_id: number | null;

  @Column({ type: 'int', nullable: true })
  listing_source_id: number | null;

  @Column({ type: 'int' })
  room_status_id: number;

  @Column({ type: 'int', default: 0 })
  view_count: number;

  @Column({ type: 'timestamptz', nullable: true })
  last_viewed_at: Date | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: "created_by_user_id", foreignKeyConstraintName: "rent_rooms_created_by_user_id_fkey" })
  created_by: UserEntity | null;

  @ManyToOne(() => PropertyOwnerEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: "property_owner_id", foreignKeyConstraintName: "rent_rooms_property_owner_id_fkey" })
  property_owner: PropertyOwnerEntity | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: "owner_id", foreignKeyConstraintName: "rent_rooms_owner_id_fkey" })
  owner: UserEntity | null;

  @ManyToOne(() => PropertyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: "properties_id", foreignKeyConstraintName: "rent_rooms_properties_id_fkey" })
  property: PropertyEntity;

  @ManyToOne(() => MasterRoomTypeEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: "room_type_id", foreignKeyConstraintName: "rent_rooms_room_type_id_fkey" })
  room_type: MasterRoomTypeEntity | null;

  @ManyToOne(() => MasterListingSourceEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: "listing_source_id", foreignKeyConstraintName: "rent_rooms_listing_source_id_fkey" })
  listing_source: MasterListingSourceEntity | null;

  @ManyToOne(() => MasterRoomStatusEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: "room_status_id", foreignKeyConstraintName: "rent_rooms_room_status_id_fkey" })
  room_status: MasterRoomStatusEntity;

  @OneToMany(() => RoomMediaEntity, (m) => m.rent_room)
  medias: RoomMediaEntity[];

  @OneToMany(() => RentRoomDocumentEntity, (d) => d.rent_room)
  documents: RentRoomDocumentEntity[];

  @OneToMany(() => RoomLayoutValueEntity, (v) => v.rent_room)
  layout_values: RoomLayoutValueEntity[];

  @OneToMany(() => RoomFacilityEntity, (f) => f.rent_room)
  facilities: RoomFacilityEntity[];

  @OneToMany(() => RentRoomContactEntity, (c) => c.rent_room)
  room_contacts: RentRoomContactEntity[];

  @OneToMany(() => RentRoomPriceEntity, (p) => p.rent_room)
  price_rows: RentRoomPriceEntity[];
}
