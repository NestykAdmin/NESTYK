import { Entity, Column, Unique } from "typeorm";
import { SerialEntity } from './base.entity';

@Unique("master_contract_types_code_key", ["code"])
@Entity({ name: 'master_contract_types' })
export class MasterContractTypeEntity extends SerialEntity {
  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'smallint' })
  term_months: number;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;
}
