import { Entity, Column, Unique } from "typeorm";
import { SerialEntity } from './base.entity';

@Unique("master_property_types_code_key", ["code"])
@Entity({ name: 'master_property_types' })
export class MasterPropertyTypeEntity extends SerialEntity {
  @Column({ type: 'varchar', length: 64 })
  code: string;
}
