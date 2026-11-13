import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { SerialCreatedEntity } from './base.entity';
import { RentRoomEntity } from './rent-room.entity';
import { UserEntity } from './user.entity';

/** A room an account saved with the heart (AUTH-3, migration *_saved_rooms.sql). Any role may save (D5). */
@Unique('saved_rooms_user_room_key', ['user_id', 'rent_room_id'])
@Index('idx_saved_rooms_user_created', ['user_id', 'created_at'])
@Entity({ name: 'saved_rooms' })
export class SavedRoomEntity extends SerialCreatedEntity {
  @Column({ type: 'int' })
  user_id: number;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'saved_rooms_user_id_fkey' })
  user: UserEntity;

  @Index('idx_saved_rooms_rent_room_id')
  @Column({ type: 'int' })
  rent_room_id: number;

  @ManyToOne(() => RentRoomEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rent_room_id', foreignKeyConstraintName: 'saved_rooms_rent_room_id_fkey' })
  rent_room: RentRoomEntity;
}
