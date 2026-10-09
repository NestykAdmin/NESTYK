import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from "typeorm";
import { SerialCreatedEntity } from './base.entity';
import { RentRoomEntity } from './rent-room.entity';
import { ContactEntity } from './contact.entity';

@Unique("rent_room_contacts_rent_room_id_contact_id_key", ["rent_room_id", "contact_id"])
@Index("idx_rent_room_contacts_contact_id", ["contact_id"])
@Index("uq_rent_room_contacts_one_primary", ["rent_room_id"], { unique: true, where: "(is_primary = true)" })
@Entity({ name: 'rent_room_contacts' })
export class RentRoomContactEntity extends SerialCreatedEntity {
  @Column({ type: 'int' })
  rent_room_id: number;

  @Column({ type: 'int' })
  contact_id: number;

  @Column({ type: 'boolean', default: true })
  is_primary: boolean;

  @Column({ type: 'varchar', length: 64, default: 'contact' })
  role_code: string;

  @ManyToOne(() => RentRoomEntity, (room) => room.room_contacts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: "rent_room_id", foreignKeyConstraintName: "rent_room_contacts_rent_room_id_fkey" })
  rent_room: RentRoomEntity;

  @ManyToOne(() => ContactEntity, (contact) => contact.room_links, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: "contact_id", foreignKeyConstraintName: "rent_room_contacts_contact_id_fkey" })
  contact: ContactEntity;
}
