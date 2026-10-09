import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from "typeorm";
import { SerialEntity } from './base.entity';
import { RentRoomEntity } from './rent-room.entity';
import { MasterContractTypeEntity } from './master-contract-type.entity';

@Unique("rent_room_prices_rent_room_id_contract_type_id_key", ["rent_room_id", "contract_type_id"])
@Index("idx_rent_room_prices_rent_room_id", ["rent_room_id"])
@Entity({ name: 'rent_room_prices' })
export class RentRoomPriceEntity extends SerialEntity {
  @Column({ type: 'int' })
  rent_room_id: number;

  @Column({ type: 'int' })
  contract_type_id: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: string;

  @ManyToOne(() => RentRoomEntity, (room) => room.price_rows, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: "rent_room_id", foreignKeyConstraintName: "rent_room_prices_rent_room_id_fkey" })
  rent_room: RentRoomEntity;

  @ManyToOne(() => MasterContractTypeEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: "contract_type_id", foreignKeyConstraintName: "rent_room_prices_contract_type_id_fkey" })
  contract_type: MasterContractTypeEntity;
}
