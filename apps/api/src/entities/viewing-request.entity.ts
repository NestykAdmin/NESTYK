import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SerialTimestampEntity } from './base.entity';
import { RentRoomEntity } from './rent-room.entity';
import { UserEntity } from './user.entity';

export type ViewingRequestStatus =
  | 'new'
  | 'awaiting_agent'
  | 'agent_handling'
  | 'admin_handling'
  | 'scheduled'
  | 'viewed'
  | 'cancelled'
  | 'closed';
export type ViewingRequestHandler = 'agent' | 'admin';
export type ViewingRequestCanceller = 'guest' | 'admin';

/** 08:00–20:00 Bangkok time on the hour or half hour (migration *_viewing_requests_preferred_at.sql). */
const PREFERRED_AT_CHECK =
  "date_part('second', preferred_at AT TIME ZONE 'Asia/Bangkok') = 0 AND date_part('minute', preferred_at AT TIME ZONE 'Asia/Bangkok') IN (0, 30) AND (preferred_at AT TIME ZONE 'Asia/Bangkok')::time BETWEEN '08:00' AND '20:00'";

/**
 * A request to view a public room, sent from the guest web and coordinated by NESTYK admin
 * (migration *_viewing_requests.sql, project-docs/nestyk-guest-viewing-request-plan-20261123.md).
 */
@Check('chk_viewing_requests_status', "status IN ('new', 'awaiting_agent', 'agent_handling', 'admin_handling', 'scheduled', 'viewed', 'cancelled', 'closed')")
@Check('chk_viewing_requests_preferred_at', PREFERRED_AT_CHECK)
@Check('chk_viewing_requests_handled_by', "handled_by IS NULL OR handled_by IN ('agent', 'admin')")
@Check('chk_viewing_requests_cancelled_by', "cancelled_by IS NULL OR cancelled_by IN ('guest', 'admin')")
@Check('chk_viewing_requests_handler_set', "status NOT IN ('agent_handling', 'admin_handling', 'scheduled', 'viewed') OR handled_by IS NOT NULL")
@Check('chk_viewing_requests_scheduled_at', "status NOT IN ('scheduled', 'viewed') OR scheduled_at IS NOT NULL")
@Check('chk_viewing_requests_close_reason', "status <> 'closed' OR close_reason IS NOT NULL")
@Index('idx_viewing_requests_requester_created', ['requester_user_id', 'created_at'])
@Index('idx_viewing_requests_status_created', ['status', 'created_at'])
@Index('idx_viewing_requests_agent_status', ['agent_user_id', 'status'])
@Index('uq_viewing_requests_open_per_room', ['requester_user_id', 'rent_room_id'], {
  unique: true,
  where: "status IN ('new', 'awaiting_agent', 'agent_handling', 'admin_handling', 'scheduled')",
})
@Entity({ name: 'viewing_requests' })
export class ViewingRequestEntity extends SerialTimestampEntity {
  @Index('idx_viewing_requests_rent_room_id')
  @Column({ type: 'int' })
  rent_room_id: number;

  @ManyToOne(() => RentRoomEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rent_room_id', foreignKeyConstraintName: 'viewing_requests_rent_room_id_fkey' })
  rent_room: RentRoomEntity;

  @Column({ type: 'int' })
  requester_user_id: number;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requester_user_id', foreignKeyConstraintName: 'viewing_requests_requester_user_id_fkey' })
  requester: UserEntity;

  /** The room's agent, set when admin forwards the request. */
  @Column({ type: 'int', nullable: true })
  agent_user_id: number | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'agent_user_id', foreignKeyConstraintName: 'viewing_requests_agent_user_id_fkey' })
  agent: UserEntity | null;

  @Column({ type: 'varchar', length: 255 })
  contact_name: string;

  @Column({ type: 'varchar', length: 50 })
  contact_phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contact_email: string | null;

  /** The day and time that suit the guest (one moment; the API keeps it from tomorrow up to 60 days ahead). */
  @Column({ type: 'timestamptz' })
  preferred_at: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: ViewingRequestStatus;

  /** Who books and finishes the viewing once someone takes it on. */
  @Column({ type: 'varchar', length: 10, nullable: true })
  handled_by: ViewingRequestHandler | null;

  @Column({ type: 'timestamptz', nullable: true })
  scheduled_at: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  close_reason: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  cancelled_by: ViewingRequestCanceller | null;

  /** For rooms an owner lists (later): when the owner was told. */
  @Column({ type: 'timestamptz', nullable: true })
  owner_notified_at: Date | null;
}
