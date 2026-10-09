import { Entity, Column, Unique } from "typeorm";
import { SerialEntity } from './base.entity';

@Unique("master_visa_types_code_key", ["code"])
@Entity({ name: "master_visa_types", comment: "Visa types for foreign room-seekers; display via i18n masters.visaTypes.<code>" })
export class MasterVisaTypeEntity extends SerialEntity {
  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;
}
