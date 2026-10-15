import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import { MasterRoleEntity, MasterRoleName } from '../entities/master-role.entity';
import { UserRoleEntity } from '../entities/user-role.entity';
import { AuthRequestUser } from './decorators/current-user.decorator';
import { JwtIdentity } from './guards/auth.guard';

export type AuthUserResponse = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  profileCompleted: boolean;
  provisioned: boolean;
  roles: MasterRoleName[];
};

const DEV_GRANTABLE: MasterRoleName[] = ['owner', 'tenant', 'agent', 'admin'];

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(MasterRoleEntity)
    private readonly rolesRepo: Repository<MasterRoleEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRolesRepo: Repository<UserRoleEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findBySupabaseUserId(supabaseUserId: string): Promise<UserEntity | null> {
    return this.usersRepo.findOne({ where: { supabase_user_id: supabaseUserId } });
  }

  async loadUserWithRoles(userId: number): Promise<AuthRequestUser> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: { user_roles: { role: true } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const roleNames = (user.user_roles ?? [])
      .map((ur) => ur.role?.name)
      .filter((n): n is MasterRoleName => !!n);
    return Object.assign(user, { roleNames });
  }

  toResponse(user: UserEntity, provisioned: boolean): AuthUserResponse {
    const roles = (user.user_roles ?? [])
      .map((ur) => ur.role?.name)
      .filter((n): n is MasterRoleName => !!n);
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      profileCompleted: user.profile_completed,
      provisioned,
      roles,
    };
  }

  async sync(identity: JwtIdentity): Promise<AuthUserResponse> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        identity.supabaseUserId,
      ]);

      let user = await manager.findOne(UserEntity, {
        where: { supabase_user_id: identity.supabaseUserId },
        relations: { user_roles: { role: true } },
      });

      let provisioned = false;

      if (!user) {
        provisioned = true;
        user = manager.create(UserEntity, {
          supabase_user_id: identity.supabaseUserId,
          email: identity.email,
          first_name: identity.firstName ?? 'User',
          last_name: identity.lastName ?? '',
          avatar_url: identity.avatarUrl ?? null,
          profile_completed: false,
        });
        user = await manager.save(user);

        const guest = await manager.findOne(MasterRoleEntity, {
          where: { name: 'guest' },
        });
        if (!guest) {
          throw new BadRequestException('master_roles.guest is missing — run roles/schema.sql');
        }
        await manager.save(
          manager.create(UserRoleEntity, {
            user_id: user.id,
            role_id: guest.id,
          }),
        );
      }

      const loaded = await manager.findOne(UserEntity, {
        where: { id: user.id },
        relations: { user_roles: { role: true } },
      });
      if (!loaded) {
        throw new NotFoundException('User not found after sync');
      }
      return this.toResponse(loaded, provisioned);
    });
  }

  async updateProfile(
    userId: number,
    patch: { firstName?: string; lastName?: string; phone?: string | null },
  ): Promise<AuthUserResponse> {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new BadRequestException('Profile must be an object');
    for (const [key, max] of [['firstName', 255], ['lastName', 255], ['phone', 50]] as const) {
      const value = patch[key];
      if (value !== undefined && !(key === 'phone' && value === null) && (typeof value !== 'string' || value.length > max)) {
        throw new BadRequestException(`${key} must be text up to ${max} characters`);
      }
    }
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (patch.firstName !== undefined) user.first_name = patch.firstName;
    if (patch.lastName !== undefined) user.last_name = patch.lastName;
    if (patch.phone !== undefined) user.phone = patch.phone;
    user.profile_completed = Boolean(user.first_name?.trim() && user.phone?.trim());
    await this.usersRepo.save(user);
    const loaded = await this.loadUserWithRoles(userId);
    return this.toResponse(loaded, false);
  }

  async updateAvatar(userId: number, avatarUrl: string): Promise<AuthUserResponse> {
    if (typeof avatarUrl !== 'string' || !avatarUrl.trim() || avatarUrl.length > 512) throw new BadRequestException('avatarUrl must be text up to 512 characters');
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.avatar_url = avatarUrl;
    await this.usersRepo.save(user);
    const loaded = await this.loadUserWithRoles(userId);
    return this.toResponse(loaded, false);
  }

  assertHasRole(user: AuthRequestUser, role: MasterRoleName): void {
    if (!user.roleNames?.includes(role)) {
      throw new ForbiddenException(`${role} role required`);
    }
  }

  async grantDevRole(userId: number, roleName: string): Promise<AuthUserResponse> {
    this.assertDevGrantEnabled();
    if (!DEV_GRANTABLE.includes(roleName as MasterRoleName)) {
      throw new BadRequestException(
        `Role must be one of: ${DEV_GRANTABLE.join(', ')}`,
      );
    }
    const role = await this.rolesRepo.findOne({
      where: { name: roleName as MasterRoleName },
    });
    if (!role) {
      throw new BadRequestException(`Unknown role: ${roleName}`);
    }
    const existing = await this.userRolesRepo.findOne({
      where: { user_id: userId, role_id: role.id },
    });
    if (!existing) {
      await this.userRolesRepo.save(
        this.userRolesRepo.create({ user_id: userId, role_id: role.id }),
      );
    }
    const loaded = await this.loadUserWithRoles(userId);
    return this.toResponse(loaded, false);
  }

  async revokeDevRole(userId: number, roleName: string): Promise<AuthUserResponse> {
    this.assertDevGrantEnabled();
    if (roleName === 'guest') {
      throw new BadRequestException('Cannot revoke guest role');
    }
    if (!DEV_GRANTABLE.includes(roleName as MasterRoleName)) {
      throw new BadRequestException(
        `Role must be one of: ${DEV_GRANTABLE.join(', ')}`,
      );
    }
    const role = await this.rolesRepo.findOne({
      where: { name: roleName as MasterRoleName },
    });
    if (!role) {
      throw new BadRequestException(`Unknown role: ${roleName}`);
    }
    await this.userRolesRepo.delete({ user_id: userId, role_id: role.id });
    const loaded = await this.loadUserWithRoles(userId);
    return this.toResponse(loaded, false);
  }

  private assertDevGrantEnabled(): void {
    if (process.env.ALLOW_DEV_ROLE_GRANT !== 'true') {
      throw new ForbiddenException('Dev role grant is disabled');
    }
  }
}
