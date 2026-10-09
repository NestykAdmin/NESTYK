import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from "typeorm";
import { SerialCreatedEntity } from './base.entity';
import { UserEntity } from './user.entity';

@Unique("uq_property_owners_agent_phone", ["created_by_user_id", "phone"])
@Index("idx_property_owners_created_by_user_id", ["created_by_user_id"])
@Entity({ name: 'property_owners' })
export class PropertyOwnerEntity extends SerialCreatedEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'int' })
  created_by_user_id: number;

  @Column({ type: 'int', nullable: true })
  user_id: number | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: "created_by_user_id", foreignKeyConstraintName: "property_owners_created_by_user_id_fkey" })
  created_by: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: "user_id", foreignKeyConstraintName: "property_owners_user_id_fkey" })
  user: UserEntity | null;
}
