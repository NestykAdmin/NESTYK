import { Entity, Column, OneToMany, Unique } from "typeorm";
import { SerialEntity } from './base.entity';
import { UserRoleEntity } from './user-role.entity';

/** DB role codes: guest | tenant | landlord | agent | admin | self_owner ('owner' is retired, see docs/ROLE-CHANGE-PLAN.md) */
export type MasterRoleName = 'guest' | 'tenant' | 'landlord' | 'agent' | 'admin' | 'self_owner';

/** Every role this code expects in master_roles (checked at startup by RoleCatalogCheck). */
// self_owner: round 2 (migration 20261118051846_self_owner_role). Run that migration before this code starts.
export const MASTER_ROLE_NAMES: readonly MasterRoleName[] = ['guest', 'tenant', 'landlord', 'agent', 'admin', 'self_owner'];

/** Role codes that must never exist again; an old code version would read them with another meaning. */
export const RETIRED_ROLE_NAMES: readonly string[] = ['owner'];

@Unique("master_roles_name_key", ["name"])
@Entity({ name: 'master_roles' })
export class MasterRoleEntity extends SerialEntity {
  @Column({ type: 'varchar', length: 100 })
  name: MasterRoleName;

  @Column({ type: 'varchar', length: 255, nullable: true })
  details: string | null;

  @OneToMany(() => UserRoleEntity, (ur) => ur.role)
  user_roles: UserRoleEntity[];
}
