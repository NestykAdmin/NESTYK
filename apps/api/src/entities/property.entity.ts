import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { SerialTimestampEntity } from './base.entity';
import { MasterPropertyTypeEntity } from './master-property-type.entity';

@Index("idx_properties_name", ["name"])
@Index("idx_properties_property_type_id", ["property_type_id"])
@Entity({ name: 'properties' })
export class PropertyEntity extends SerialTimestampEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'int', nullable: true })
  property_type_id: number | null;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'varchar', length: 255, default: '-' })
  subdistrict: string;

  @Column({ type: 'varchar', length: 255 })
  district: string;

  @Column({ type: 'varchar', length: 255 })
  province: string;

  @Column({ type: 'varchar', length: 10, default: '-' })
  postal_code: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  @ManyToOne(() => MasterPropertyTypeEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: "property_type_id", foreignKeyConstraintName: "properties_property_type_id_fkey" })
  property_type: MasterPropertyTypeEntity | null;
}
