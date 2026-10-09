import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { SerialCreatedEntity } from './base.entity';
import { LeadEntity } from './lead.entity';
import { LeadMatchResultEntity } from './lead-match-result.entity';

/** One manual "match rooms" press for a lead; results are ranked in `lead_match_results`. */
@Entity({ name: 'lead_match_runs' })
@Index('idx_lead_match_runs_lead_created', ['lead_id', 'created_at'])
export class LeadMatchRunEntity extends SerialCreatedEntity {
  @Column({ type: 'int' })
  lead_id: number;

  @ManyToOne(() => LeadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead: LeadEntity;

  @Column({ type: 'int' })
  run_by_user_id: number;

  /** Effective settings used for this run (after defaults). */
  @Column({ type: 'jsonb' })
  settings: Record<string, unknown>;

  /** Hash of the lead's matching inputs + settings; differs from the current hash when the run is stale. */
  @Column({ type: 'varchar', length: 64 })
  input_hash: string;

  @Column({ type: 'smallint' })
  scoring_version: number;

  @Column({ type: 'int' })
  candidate_count: number;

  @Column({ type: 'int' })
  result_count: number;

  @Column({ type: 'smallint', nullable: true })
  top_score: number | null;

  @OneToMany(() => LeadMatchResultEntity, (result) => result.run)
  results: LeadMatchResultEntity[];
}
