import { Entity, Column, ManyToOne, JoinColumn, Unique } from "typeorm";
import { SerialEntity } from './base.entity';
import { RentRoomEntity } from './rent-room.entity';
import { MasterFacilitiesGroupEntity } from './master-facilities-group.entity';
import { MasterFacilityEntity } from './master-facility.entity';

@Unique("room_facilities_rent_room_id_f_id_key", ["rent_room_id", "f_id"])
@Entity({ name: 'room_facilities' })
export class RoomFacilityEntity extends SerialEntity {
  @Column({ type: 'int' })
  rent_room_id: number;

  @Column({ type: 'int' })
  group_id: number;

  @Column({ type: 'int' })
  f_id: number;

  @ManyToOne(() => RentRoomEntity, (room) => room.facilities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: "rent_room_id", foreignKeyConstraintName: "room_facilities_rent_room_id_fkey" })
  rent_room: RentRoomEntity;

  @ManyToOne(() => MasterFacilitiesGroupEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: "group_id", foreignKeyConstraintName: "room_facilities_group_id_fkey" })
  group: MasterFacilitiesGroupEntity;

  @ManyToOne(() => MasterFacilityEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: "f_id", foreignKeyConstraintName: "room_facilities_f_id_fkey" })
  facility: MasterFacilityEntity;
}
