import { Entity, Column, Unique } from "typeorm";
import { SerialEntity } from './base.entity';

@Unique("master_room_types_code_key", ["code"])
@Entity({ name: 'master_room_types' })
export class MasterRoomTypeEntity extends SerialEntity {
  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'smallint', nullable: true })
  bedroom_count: number | null;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;
}
