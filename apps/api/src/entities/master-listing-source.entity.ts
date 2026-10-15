import { Entity, Column, Unique } from "typeorm";
import { SerialEntity } from './base.entity';

@Unique("master_listing_sources_code_key", ["code"])
@Entity({ name: 'master_listing_sources' })
export class MasterListingSourceEntity extends SerialEntity {
  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;
}
