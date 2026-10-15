import { Entity, Column, ManyToOne, JoinColumn, Check, Index } from "typeorm";
import { SerialTimestampEntity } from './base.entity';
import { RentRoomEntity } from './rent-room.entity';
import { TenantEntity } from './tenant.entity';
import { UserEntity } from './user.entity';

export type RoomTenancyStatus = 'prospect' | 'active' | 'moved_out';

@Index("idx_room_tenancies_rent_room_id", ["rent_room_id"])
@Index("idx_room_tenancies_status", ["status"])
@Index("idx_room_tenancies_tenant_id", ["tenant_id"])
@Index("uq_room_tenancies_one_active_per_room", ["rent_room_id"], { unique: true, where: "((status)::text = 'active'::text)" })
@Check("chk_room_tenancies_status", "((status)::text = ANY ((ARRAY['prospect'::character varying, 'active'::character varying, 'moved_out'::character varying])::text[]))")
@Entity({ name: 'room_tenancies' })
export class RoomTenancyEntity extends SerialTimestampEntity {
  @Column({ type: 'int' })
  rent_room_id: number;

  @Column({ type: 'int' })
  tenant_id: number;

  @Column({ type: 'varchar', length: 20, default: 'prospect' })
  status: RoomTenancyStatus;

  @Column({ type: 'date', nullable: true })
  move_in_date: string | null;

  @Column({ type: 'date', nullable: true })
  move_out_date: string | null;

  @Column({ type: 'int' })
  created_by_user_id: number;

  @ManyToOne(() => RentRoomEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: "rent_room_id", foreignKeyConstraintName: "room_tenancies_rent_room_id_fkey" })
  rent_room: RentRoomEntity;

  @ManyToOne(() => TenantEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: "tenant_id", foreignKeyConstraintName: "room_tenancies_tenant_id_fkey" })
  tenant: TenantEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: "created_by_user_id", foreignKeyConstraintName: "room_tenancies_created_by_user_id_fkey" })
  created_by: UserEntity;
}
