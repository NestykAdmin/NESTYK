import { Entity, Column, ManyToOne, JoinColumn, Unique } from "typeorm";
import { SerialEntity } from './base.entity';
import { RentRoomEntity } from './rent-room.entity';
import { MasterLayoutEntity } from './master-layout.entity';

@Unique("room_layout_values_rent_room_id_layout_id_key", ["rent_room_id", "layout_id"])
@Entity({ name: 'room_layout_values' })
export class RoomLayoutValueEntity extends SerialEntity {
  @Column({ type: 'int' })
  rent_room_id: number;

  @Column({ type: 'int' })
  layout_id: number;

  @Column({ type: 'varchar', length: 64 })
  value: string;

  @ManyToOne(() => RentRoomEntity, (room) => room.layout_values, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: "rent_room_id", foreignKeyConstraintName: "room_layout_values_rent_room_id_fkey" })
  rent_room: RentRoomEntity;

  @ManyToOne(() => MasterLayoutEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: "layout_id", foreignKeyConstraintName: "room_layout_values_layout_id_fkey" })
  layout: MasterLayoutEntity;
}
