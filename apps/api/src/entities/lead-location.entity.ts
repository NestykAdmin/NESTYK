import { Column, Entity, Index, JoinColumn, ManyToOne, Unique, Check } from "typeorm";
import { SerialCreatedEntity } from './base.entity';
import { LeadEntity } from './lead.entity';

/** Ranked map pin (1–3) for a lead; radius is shared on `leads.radius_km`. */
@Check("chk_lead_locations_lat", "((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision))")
@Check("chk_lead_locations_lng", "((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision))")
@Check("chk_lead_locations_rank", "((rank >= 1) AND (rank <= 3))")
@Entity({ name: 'lead_locations' })
@Unique('uq_lead_locations_rank', ['lead_id', 'rank'])
@Index('idx_lead_locations_lat_lng', ['latitude', 'longitude'])
export class LeadLocationEntity extends SerialCreatedEntity {
  @Column({ type: 'int' })
  lead_id: number;

  @ManyToOne(() => LeadEntity, (lead) => lead.pins, { onDelete: 'CASCADE' })
  @JoinColumn({ name: "lead_id", foreignKeyConstraintName: "lead_locations_lead_id_fkey" })
  lead: LeadEntity;

  @Column({ type: 'smallint' })
  rank: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  place_id: string | null;

  @Column({ type: 'varchar', length: 500 })
  name: string;

  @Column({ type: 'double precision' })
  latitude: number;

  @Column({ type: 'double precision' })
  longitude: number;

  @Column({ type: 'varchar', length: 120 })
  province: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  district: string | null;
}
