import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { SerialTimestampEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { PropertyEntity } from './property.entity';
import { MasterRoomTypeEntity } from './master-room-type.entity';
import { MasterRoomStatusEntity } from './master-room-status.entity';
import type { NearbyPlace } from '@nestyk/types';
import type { SelfOwnerRoomPriceEntity } from './self-owner-room-price.entity';
import type { SelfOwnerRoomMediaEntity } from './self-owner-room-media.entity';
import type { SelfOwnerRoomFacilityEntity } from './self-owner-room-facility.entity';

/**
 * A room an owner lists without an agent (migration *_self_owner_rooms.sql, D4 decided 20 Nov 2026: own tables, apart
 * from the agent rooms in rent_rooms). Only its owner reads or changes it (/self-owner/rooms).
 */
@Index('idx_self_owner_rooms_owner_updated', ['owner_user_id', 'updated_at'])
@Index('idx_self_owner_rooms_properties_id', ['properties_id'])
@Check('chk_self_owner_rooms_visibility', "visibility IN ('private', 'published')")
@Entity({ name: 'self_owner_rooms' })
export class SelfOwnerRoomEntity extends SerialTimestampEntity {
  @Column({ type: 'int' })
  owner_user_id: number;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_user_id', foreignKeyConstraintName: 'self_owner_rooms_owner_user_id_fkey' })
  owner: UserEntity;

  @Column({ type: 'int' })
  properties_id: number;

  @ManyToOne(() => PropertyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'properties_id', foreignKeyConstraintName: 'self_owner_rooms_properties_id_fkey' })
  property: PropertyEntity;

  @Column({ type: 'int', nullable: true })
  room_type_id: number | null;

  @ManyToOne(() => MasterRoomTypeEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'room_type_id', foreignKeyConstraintName: 'self_owner_rooms_room_type_id_fkey' })
  room_type: MasterRoomTypeEntity | null;

  @Column({ type: 'int' })
  room_status_id: number;

  @ManyToOne(() => MasterRoomStatusEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'room_status_id', foreignKeyConstraintName: 'self_owner_rooms_room_status_id_fkey' })
  room_status: MasterRoomStatusEntity;

  @Column({ type: 'varchar', length: 20, default: 'private' })
  visibility: 'private' | 'published';

  @Column({ type: 'varchar', length: 255 })
  room_name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  room_number: string | null;

  @Column({ type: 'smallint' })
  bedrooms: number;

  @Column({ type: 'smallint' })
  bathrooms: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  size_sqm: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  floor: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  building: string | null;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  available_from_date: string;

  @Column({ type: 'smallint', default: 1 })
  advance_rent_months: number;

  @Column({ type: 'smallint', default: 2 })
  deposit_months: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  water_rate_per_unit: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  electric_rate_per_unit: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  custom_facilities: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  nearby_places: NearbyPlace[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  promo_title: string | null;

  @Column({ type: 'text', nullable: true })
  listing_description: string | null;

  @Column({ type: 'varchar', length: 255 })
  contact_name: string;

  @Column({ type: 'varchar', length: 50 })
  contact_phone: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  contact_line_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contact_facebook: string | null;

  @OneToMany('SelfOwnerRoomPriceEntity', 'room')
  prices: SelfOwnerRoomPriceEntity[];

  @OneToMany('SelfOwnerRoomMediaEntity', 'room')
  medias: SelfOwnerRoomMediaEntity[];

  @OneToMany('SelfOwnerRoomFacilityEntity', 'room')
  facilities: SelfOwnerRoomFacilityEntity[];
}
