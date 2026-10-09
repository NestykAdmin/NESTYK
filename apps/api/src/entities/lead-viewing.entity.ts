import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SerialTimestampEntity } from './base.entity';
import { LeadEntity } from './lead.entity';
import { RentRoomEntity } from './rent-room.entity';

export type LeadViewingStatus = 'scheduled' | 'done' | 'cancelled';

/** A room viewing booked for a lead; the agent calendar reads these by `scheduled_at`. */
@Entity({ name: 'lead_viewings' })
@Index('idx_lead_viewings_agent_scheduled', ['created_by_user_id', 'scheduled_at'])
@Index('idx_lead_viewings_lead_scheduled', ['lead_id', 'scheduled_at'])
export class LeadViewingEntity extends SerialTimestampEntity {
  @Column({ type: 'int' })
  lead_id: number;

  @ManyToOne(() => LeadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead: LeadEntity;

  @Column({ type: 'int' })
  rent_room_id: number;

  @ManyToOne(() => RentRoomEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rent_room_id' })
  rent_room: RentRoomEntity;

  @Column({ type: 'int' })
  created_by_user_id: number;

  @Column({ type: 'timestamptz' })
  scheduled_at: Date;

  @Column({ type: 'varchar', length: 20, default: 'scheduled' })
  status: LeadViewingStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;
}
