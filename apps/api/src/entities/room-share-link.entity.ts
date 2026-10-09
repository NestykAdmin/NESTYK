import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from "typeorm";
import { SerialCreatedEntity } from './base.entity';
import { RentRoomEntity } from './rent-room.entity';
import { UserEntity } from './user.entity';
import { ContactEntity } from './contact.entity';

export type RoomShareSections = {
  photos: boolean;
  price: boolean;
  facilities: boolean;
  location: boolean;
  contact: boolean;
};

@Unique("uq_room_share_links_token_hash", ["token_hash"])
@Entity({ name: 'room_share_links' })
export class RoomShareLinkEntity extends SerialCreatedEntity {
  @Index('idx_room_share_links_rent_room')
  @Column({ type: 'int' })
  rent_room_id: number;

  @ManyToOne(() => RentRoomEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: "rent_room_id", foreignKeyConstraintName: "room_share_links_rent_room_id_fkey" })
  rent_room: RentRoomEntity;

  @Column({ type: 'int' })
  created_by_user_id: number;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: "created_by_user_id", foreignKeyConstraintName: "room_share_links_created_by_user_id_fkey" })
  created_by: UserEntity;

  @Column({ type: 'char', length: 64 })
  token_hash: string;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revoked_at: Date | null;

  @Column({ type: 'jsonb' })
  share_sections: RoomShareSections;

  @Column({ type: 'int', nullable: true })
  contact_id: number | null;

  @ManyToOne(() => ContactEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: "contact_id", foreignKeyConstraintName: "room_share_links_contact_id_fkey" })
  contact: ContactEntity | null;
}
