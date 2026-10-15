import { Entity, Column, OneToMany, Unique } from "typeorm";
import { SerialEntity } from './base.entity';
import { MasterFacilityEntity } from './master-facility.entity';

@Unique("master_facilities_groups_code_key", ["code"])
@Entity({ name: 'master_facilities_groups' })
export class MasterFacilitiesGroupEntity extends SerialEntity {
  @Column({ type: 'int', default: 100 })
  sort_order: number;

  @Column({ type: 'varchar', length: 64 })
  code: string;

  @OneToMany(() => MasterFacilityEntity, (f) => f.group)
  facilities: MasterFacilityEntity[];
}
