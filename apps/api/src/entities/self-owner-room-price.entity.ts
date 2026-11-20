import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { SerialEntity } from './base.entity';
import { SelfOwnerRoomEntity } from './self-owner-room.entity';
import { MasterContractTypeEntity } from './master-contract-type.entity';

/** Rent of a self owner room for one lease length (migration *_self_owner_rooms.sql). */
@Unique('self_owner_room_prices_room_contract_key', ['room_id', 'contract_type_id'])
@Entity({ name: 'self_owner_room_prices' })
export class SelfOwnerRoomPriceEntity extends SerialEntity {
  @Column({ type: 'int' })
  room_id: number;

  @ManyToOne(() => SelfOwnerRoomEntity, (room) => room.prices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id', foreignKeyConstraintName: 'self_owner_room_prices_room_id_fkey' })
  room: SelfOwnerRoomEntity;

  @Column({ type: 'int' })
  contract_type_id: number;

  @ManyToOne(() => MasterContractTypeEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'contract_type_id', foreignKeyConstraintName: 'self_owner_room_prices_contract_type_id_fkey' })
  contract_type: MasterContractTypeEntity;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: string;

  @Column({ type: 'smallint', default: 1 })
  advance_rent_months: number;

  @Column({ type: 'smallint', default: 2 })
  deposit_months: number;
}
