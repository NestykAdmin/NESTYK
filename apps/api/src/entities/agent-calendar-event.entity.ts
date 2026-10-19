import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SerialTimestampEntity } from './base.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'agent_calendar_events' })
@Index('idx_agent_calendar_events_agent_starts', ['created_by_user_id', 'starts_at'])
@Check('chk_agent_calendar_events_status', "status IN ('pending', 'confirmed', 'scheduled', 'done', 'cancelled')")
export class AgentCalendarEventEntity extends SerialTimestampEntity {
  @Column({ type: 'int' }) created_by_user_id: number;
  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id', foreignKeyConstraintName: 'agent_calendar_events_created_by_user_id_fkey' }) created_by: UserEntity;
  @Column({ type: 'varchar', length: 160 }) title: string;
  @Column({ type: 'varchar', length: 160, default: '' }) location: string;
  @Column({ type: 'timestamptz' }) starts_at: Date;
  @Column({ type: 'varchar', length: 80 }) kind: string;
  @Column({ type: 'varchar', length: 20, default: 'scheduled' }) status: 'pending' | 'confirmed' | 'scheduled' | 'done' | 'cancelled';
}
