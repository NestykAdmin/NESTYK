import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { SerialEntity } from './base.entity';
import { SelfOwnerRoomEntity } from './self-owner-room.entity';
import { MasterFacilityEntity } from './master-facility.entity';

/** Facility of a self owner room (migration *_self_owner_rooms.sql). */
@Unique('self_owner_room_facilities_room_facility_key', ['room_id', 'facility_id'])
@Entity({ name: 'self_owner_room_facilities' })
export class SelfOwnerRoomFacilityEntity extends SerialEntity {
  @Column({ type: 'int' })
  room_id: number;

  @ManyToOne(() => SelfOwnerRoomEntity, (room) => room.facilities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id', foreignKeyConstraintName: 'self_owner_room_facilities_room_id_fkey' })
  room: SelfOwnerRoomEntity;

  @Column({ type: 'int' })
  facility_id: number;

  @ManyToOne(() => MasterFacilityEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'facility_id', foreignKeyConstraintName: 'self_owner_room_facilities_facility_id_fkey' })
  facility: MasterFacilityEntity;
}
