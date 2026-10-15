import { Entity, Column, OneToMany, Index, Unique } from "typeorm";
import { SerialCreatedEntity } from './base.entity';
import { UserRoleEntity } from './user-role.entity';

@Unique("users_email_key", ["email"])
@Unique("users_supabase_user_id_key", ["supabase_user_id"])
@Index("idx_users_email", ["email"])
@Index("idx_users_supabase_user_id", ["supabase_user_id"])
@Entity({ name: 'users' })
export class UserEntity extends SerialCreatedEntity {
  @Column({ type: 'uuid', nullable: true })
  supabase_user_id: string | null;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string | null;

  @Column({ type: 'varchar', length: 255, default: 'User' })
  first_name: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  last_name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  identity_number: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  nationality: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  avatar_url: string | null;

  @Column({ type: 'boolean', default: false })
  profile_completed: boolean;

  @OneToMany(() => UserRoleEntity, (ur) => ur.user)
  user_roles: UserRoleEntity[];
}
