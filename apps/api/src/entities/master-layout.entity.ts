import { Entity, Column, Unique } from "typeorm";
import { SerialEntity } from './base.entity';

@Unique("master_layouts_code_key", ["code"])
@Entity({ name: 'master_layouts' })
export class MasterLayoutEntity extends SerialEntity {
  @Column({ type: 'varchar', length: 64 })
  code: string;
}
