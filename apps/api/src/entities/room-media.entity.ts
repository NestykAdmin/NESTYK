import { Entity, Column, ManyToOne, JoinColumn, Check, Index } from "typeorm";
import { SerialCreatedEntity } from './base.entity';
import { RentRoomEntity } from './rent-room.entity';

@Index("idx_room_medias_rent_id", ["rent_id", "sort_order"])
@Index("uq_room_medias_one_cover", ["rent_id"], { unique: true, where: "(is_cover = true)" })
@Check("chk_room_medias_category", "((category)::text = ANY ((ARRAY['room'::character varying, 'common'::character varying, 'floorplan'::character varying])::text[]))")
@Check("chk_room_medias_type", "((media_type)::text = ANY ((ARRAY['image'::character varying, 'video'::character varying])::text[]))")
@Entity({ name: 'room_medias' })
export class RoomMediaEntity extends SerialCreatedEntity {
  @Column({ type: 'int' })
  rent_id: number;

  @Column({ type: 'varchar', length: 500 })
  media_url: string;

  @Column({ type: 'varchar', length: 16, default: 'image' })
  media_type: 'image' | 'video';

  @Column({ type: 'varchar', length: 32, default: 'room' })
  category: 'room' | 'common' | 'floorplan';

  @Column({ type: 'boolean', default: false })
  is_cover: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @ManyToOne(() => RentRoomEntity, (room) => room.medias, { onDelete: 'CASCADE' })
  @JoinColumn({ name: "rent_id", foreignKeyConstraintName: "room_medias_rent_id_fkey" })
  rent_room: RentRoomEntity;
}
