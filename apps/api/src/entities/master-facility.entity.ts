import { Entity, Column, ManyToOne, JoinColumn, Unique } from "typeorm";
import { SerialEntity } from './base.entity';
import { MasterFacilitiesGroupEntity } from './master-facilities-group.entity';

@Unique("master_facilities_group_id_code_key", ["group_id", "code"])
@Entity({ name: 'master_facilities' })
export class MasterFacilityEntity extends SerialEntity {
  @Column({ type: 'int', default: 100 })
  sort_order: number;

  @Column({ type: 'boolean', default: false })
  is_extra_charge: boolean;

  @Column({ type: 'int' })
  group_id: number;

  @Column({ type: 'varchar', length: 64 })
  code: string;

  @ManyToOne(() => MasterFacilitiesGroupEntity, (g) => g.facilities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: "group_id", foreignKeyConstraintName: "master_facilities_group_id_fkey" })
  group: MasterFacilitiesGroupEntity;
}
