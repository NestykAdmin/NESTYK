import { Entity, ManyToOne, JoinColumn, PrimaryColumn, Index } from "typeorm";
import { UserEntity } from './user.entity';
import { MasterRoleEntity } from './master-role.entity';

@Index("idx_user_roles_role_id", ["role_id"])
@Entity({ name: 'user_roles' })
export class UserRoleEntity {
  @PrimaryColumn({ type: 'int' })
  user_id: number;

  @PrimaryColumn({ type: 'int' })
  role_id: number;

  @ManyToOne(() => UserEntity, (user) => user.user_roles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: "user_id", foreignKeyConstraintName: "user_roles_user_id_fkey" })
  user: UserEntity;

  @ManyToOne(() => MasterRoleEntity, (role) => role.user_roles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: "role_id", foreignKeyConstraintName: "user_roles_role_id_fkey" })
  role: MasterRoleEntity;
}
