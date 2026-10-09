import { Entity, Column, ManyToOne, JoinColumn, Check, Index } from "typeorm";
import { SerialCreatedEntity } from './base.entity';
import { RentRoomEntity } from './rent-room.entity';

@Index("idx_rent_room_documents_rent_id", ["rent_id"])
@Check("chk_rent_room_documents_kind", "((kind)::text = ANY ((ARRAY['id_passport'::character varying, 'bookbank'::character varying, 'ownership'::character varying, 'other'::character varying])::text[]))")
@Entity({ name: 'rent_room_documents' })
export class RentRoomDocumentEntity extends SerialCreatedEntity {
  @Column({ type: 'int' })
  rent_id: number;

  @Column({ type: 'varchar', length: 32 })
  kind: 'id_passport' | 'bookbank' | 'ownership' | 'other';

  @Column({ type: 'varchar', length: 500 })
  media_url: string;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @ManyToOne(() => RentRoomEntity, (room) => room.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: "rent_id", foreignKeyConstraintName: "rent_room_documents_rent_id_fkey" })
  rent_room: RentRoomEntity;
}
