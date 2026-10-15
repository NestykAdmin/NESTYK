import { Entity, Column, ManyToOne, JoinColumn, OneToOne, Index, Unique } from "typeorm";
import { SerialTimestampEntity } from './base.entity';
import { LeadEntity } from './lead.entity';
import { UserEntity } from './user.entity';

@Unique("tenants_lead_id_key", ["lead_id"])
@Index("idx_tenants_created_by_user_id", ["created_by_user_id"])
@Index("idx_tenants_lead_id", ["lead_id"])
@Index("idx_tenants_phone", ["phone"])
@Index("idx_tenants_user_id", ["user_id"])
@Entity({ name: 'tenants' })
export class TenantEntity extends SerialTimestampEntity {
  @Column({ type: 'int' })
  lead_id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  first_name: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  last_name: string;

  @Column({ type: 'varchar', length: 50 })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  identity_number: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  nationality: string | null;

  @Column({ type: 'int', nullable: true })
  user_id: number | null;

  @Column({ type: 'int' })
  created_by_user_id: number;

  @OneToOne(() => LeadEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: "lead_id", foreignKeyConstraintName: "tenants_lead_id_fkey" })
  lead: LeadEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: "user_id", foreignKeyConstraintName: "tenants_user_id_fkey" })
  user: UserEntity | null;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: "created_by_user_id", foreignKeyConstraintName: "tenants_created_by_user_id_fkey" })
  created_by: UserEntity;
}
