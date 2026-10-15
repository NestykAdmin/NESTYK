import { Entity, Column, Unique } from "typeorm";
import { SerialEntity } from './base.entity';

@Unique("master_room_statuses_code_key", ["code"])
@Entity({ name: 'master_room_statuses' })
export class MasterRoomStatusEntity extends SerialEntity {
  @Column({ type: 'varchar', length: 32 })
  code: string;
}
