import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SerialEntity } from './base.entity';
import { SelfOwnerRoomEntity } from './self-owner-room.entity';

/** Photo of a self owner room; one cover per room (migration *_self_owner_rooms.sql). */
@Index('idx_self_owner_room_medias_room_id', ['room_id', 'sort_order'])
@Index('uq_self_owner_room_medias_one_cover', ['room_id'], { unique: true, where: 'is_cover' })
@Entity({ name: 'self_owner_room_medias' })
export class SelfOwnerRoomMediaEntity extends SerialEntity {
  @Column({ type: 'int' })
  room_id: number;

  @ManyToOne(() => SelfOwnerRoomEntity, (room) => room.medias, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id', foreignKeyConstraintName: 'self_owner_room_medias_room_id_fkey' })
  room: SelfOwnerRoomEntity;

  @Column({ type: 'varchar', length: 500 })
  media_url: string;

  @Column({ type: 'boolean', default: false })
  is_cover: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order: number;
}
