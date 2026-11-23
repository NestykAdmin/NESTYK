import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SerialCreatedEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { ViewingRequestEntity, type ViewingRequestStatus } from './viewing-request.entity';

/** Who did what to a viewing request and when, plus admin's coordination notes (migration *_viewing_requests.sql). */
@Index('idx_viewing_request_events_request_created', ['request_id', 'created_at'])
@Entity({ name: 'viewing_request_events' })
export class ViewingRequestEventEntity extends SerialCreatedEntity {
  @Column({ type: 'int' })
  request_id: number;

  @ManyToOne(() => ViewingRequestEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id', foreignKeyConstraintName: 'viewing_request_events_request_id_fkey' })
  request: ViewingRequestEntity;

  @Index('idx_viewing_request_events_actor_user_id')
  @Column({ type: 'int', nullable: true })
  actor_user_id: number | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_user_id', foreignKeyConstraintName: 'viewing_request_events_actor_user_id_fkey' })
  actor: UserEntity | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  from_status: ViewingRequestStatus | null;

  @Column({ type: 'varchar', length: 20 })
  to_status: ViewingRequestStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;
}
