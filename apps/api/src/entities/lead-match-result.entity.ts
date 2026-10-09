import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { SerialEntity } from './base.entity';
import { LeadMatchRunEntity } from './lead-match-run.entity';
import { RentRoomEntity } from './rent-room.entity';

@Entity({ name: 'lead_match_results' })
@Unique('uq_lead_match_results_rank', ['run_id', 'rank'])
@Unique('uq_lead_match_results_room', ['run_id', 'rent_room_id'])
export class LeadMatchResultEntity extends SerialEntity {
  @Column({ type: 'int' })
  run_id: number;

  @ManyToOne(() => LeadMatchRunEntity, (run) => run.results, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run: LeadMatchRunEntity;

  @Column({ type: 'int' })
  rent_room_id: number;

  @ManyToOne(() => RentRoomEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rent_room_id' })
  rent_room: RentRoomEntity;

  @Column({ type: 'smallint' })
  rank: number;

  @Column({ type: 'smallint', nullable: true })
  score: number | null;

  @Column({ type: 'smallint' })
  location_score: number;

  /** Decimal values are returned as strings. */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: string;

  @Column({ type: 'smallint', nullable: true })
  term_months: number | null;

  @Column({ type: 'double precision' })
  distance_km: number;

  @Column({ type: 'smallint' })
  pin_rank: number;

  @Column({ type: 'jsonb' })
  comparison: Record<string, unknown>;
}
