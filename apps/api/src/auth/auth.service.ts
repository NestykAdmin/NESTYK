import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import { MasterRoleEntity, MasterRoleName } from '../entities/master-role.entity';
import { UserRoleEntity } from '../entities/user-role.entity';
import { AuthRequestUser } from './decorators/current-user.decorator';
import { JwtIdentity } from './guards/auth.guard';
import { devRegistrationEnabled } from './guards/dev-registration.guard';
import { ProfileAvatarStorage } from './profile-avatar-storage.service';
import { anonymizedAccountEmail, deletionBlockers, deletionEffectiveAt, immediateDeletionEnabled, type AccountDeleteBlocker } from './account-deletion';
import { holdsAccount } from '../agent/contracts/agreement-hold';
import { bangkokToday } from '../billing/rent-schedule';
import { notifyAccountDeleted } from './account-deleted-email';
import { notifyAccountDeletionScheduled } from './account-deletion-scheduled-email';

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

const DEV_GRANTABLE: MasterRoleName[] = ['landlord', 'tenant', 'agent', 'admin'];
// R1 (Mos 2 Nov 2026): anyone can self-register, so a new self-registered profile is only a guest and an agent.
// Landlords and tenants get their accounts from the agent's documents; admin is never self-granted.
const SELF_REGISTRATION_ROLES: MasterRoleName[] = ['guest', 'agent'];

/** Advisory lock key of the scheduled deletion job (one API instance at a time). */
const ACCOUNT_DELETION_JOB_LOCK = 'nestyk:account-deletions';

@Injectable()
export class AuthService {
  private registrationAdminClient: SupabaseClient | null = null;

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(MasterRoleEntity)
    private readonly rolesRepo: Repository<MasterRoleEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRolesRepo: Repository<UserRoleEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly avatars?: ProfileAvatarStorage,
  ) {}

  async registerForTesting(body: unknown): Promise<{ created: true }> {
    if (!devRegistrationEnabled()) {
      throw new NotFoundException({ code: 'TEST_REGISTRATION_UNAVAILABLE', message: 'Test registration is unavailable' });
    }
    const input = body as Record<string, unknown> | null;
    if (!input || Array.isArray(input) ||
        typeof input.email !== 'string' || input.email.trim().length > 255 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) ||
        typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 1024 ||
        typeof input.firstName !== 'string' || !input.firstName.trim() || input.firstName.trim().length > 255 ||
        typeof input.lastName !== 'string' || !input.lastName.trim() || input.lastName.trim().length > 255) {
      throw new BadRequestException({ code: 'REGISTRATION_INVALID_INPUT', message: 'Invalid registration input' });
    }
    if (!this.registrationAdminClient) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        throw new ServiceUnavailableException({ code: 'TEST_REGISTRATION_UNAVAILABLE', message: 'Test registration is unavailable' });
      }
      this.registrationAdminClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const { data, error } = await this.registrationAdminClient.auth.admin.createUser({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName, last_name: lastName,
        full_name: `${firstName} ${lastName}`, registration_source: 'self_service',
      },
    });
    if (error?.code === 'email_exists' || error?.code === 'user_already_exists') {
      throw new ConflictException({ code: 'email_exists', message: 'Email already registered' });
    }
    if (error || !data.user) {
      throw new BadRequestException({ code: 'REGISTRATION_FAILED', message: 'Registration failed' });
    }
    return { created: true };
  }

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

        if (identity.selfRegistered) {
          const roles = await manager.find(MasterRoleEntity, { where: { name: In(SELF_REGISTRATION_ROLES) } });
          const missing = SELF_REGISTRATION_ROLES.filter(name => !roles.some(role => role.name === name));
          if (missing.length) {
            throw new BadRequestException(`Missing registration roles: ${missing.join(', ')}`);
          }
          const userId = user.id;
          await manager.save(roles.map(role => manager.create(UserRoleEntity, { user_id: userId, role_id: role.id })));
        } else {
          const guest = await manager.findOne(MasterRoleEntity, {
            where: { name: 'guest' },
          });
          if (!guest) {
            throw new BadRequestException('master_roles.guest is missing — run npm run db:push and db:seed masters');
          }
          await manager.save(
            manager.create(UserRoleEntity, {
              user_id: user.id,
              role_id: guest.id,
            }),
          );
        }
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
    return this.storeAvatar(userId, avatarUrl.trim());
  }

  async uploadAvatar(userId: number, file: { buffer: Buffer; size: number } | undefined): Promise<AuthUserResponse> {
    if (!this.avatars) throw new ServiceUnavailableException('Profile photo storage is not configured');
    const avatarUrl = await this.avatars.upload(userId, file);
    return this.storeAvatar(userId, avatarUrl);
  }

  async clearAvatar(userId: number): Promise<AuthUserResponse> {
    return this.storeAvatar(userId, null);
  }

  private async storeAvatar(userId: number, avatarUrl: string | null): Promise<AuthUserResponse> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const previous = user.avatar_url;
    user.avatar_url = avatarUrl;
    await this.usersRepo.save(user);
    // R5: the old photo leaves the public bucket once the new address is saved.
    if (previous && previous !== avatarUrl && this.avatars) await this.avatars.removeOwned(userId, previous);
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

  async deletionPreview(userId: number): Promise<{
    blocked: boolean;
    reasons: AccountDeleteBlocker[];
    scheduledFor: string | null;
    /** Whether this API offers "delete now" (QA only, ALLOW_IMMEDIATE_ACCOUNT_DELETION). */
    deleteNowAvailable: boolean;
  }> {
    const reasons = deletionBlockers(await this.deletionCounts(userId));
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    return {
      blocked: reasons.length > 0,
      reasons,
      scheduledFor: user?.deletion_effective_at ? user.deletion_effective_at.toISOString() : null,
      deleteNowAvailable: immediateDeletionEnabled(),
    };
  }

  async scheduleAccountDeletion(userId: number): Promise<{ scheduledFor: string }> {
    const reasons = deletionBlockers(await this.deletionCounts(userId));
    if (reasons.length) throw new ConflictException({ code: 'ACCOUNT_DELETE_BLOCKED', reasons });
    const requestedAt = new Date();
    const effectiveAt = deletionEffectiveAt(requestedAt);
    await this.usersRepo.update(userId, { deletion_requested_at: requestedAt, deletion_effective_at: effectiveAt });
    // D: tell the owner once the schedule is saved (a failed send is swallowed and never undoes it).
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    await notifyAccountDeletionScheduled(user?.email, effectiveAt).catch(() => false);
    return { scheduledFor: effectiveAt.toISOString() };
  }

  async cancelAccountDeletion(userId: number): Promise<{ cancelled: true }> {
    await this.usersRepo.update(userId, { deletion_requested_at: null, deletion_effective_at: null });
    return { cancelled: true };
  }

  async deleteDueAccounts(now = new Date()): Promise<number> {
    // With more than one API instance, only the one that takes this lock runs the job (the others skip it).
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      const [lock] = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [ACCOUNT_DELETION_JOB_LOCK]);
      if (!lock?.locked) return 0;
      try {
        const due = await this.usersRepo
          .createQueryBuilder('user')
          .where('user.deletion_effective_at IS NOT NULL')
          .andWhere('user.deletion_effective_at <= :now', { now })
          .andWhere("user.email NOT LIKE 'deleted+%@users.invalid'")
          .getMany();
        let deleted = 0;
        for (const user of due) {
          try {
            await this.deleteAccount(user.id);
            deleted += 1;
          } catch {
            // A contract or bill appeared after the request. Leave the schedule and try again next day.
          }
        }
        return deleted;
      } finally {
        await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [ACCOUNT_DELETION_JOB_LOCK]);
      }
    } finally {
      await runner.release();
    }
  }

  /** DELETE /auth/account: "delete now", for QA only. The scheduled job calls deleteAccount itself. */
  async deleteAccountNow(userId: number): Promise<{ deleted: true }> {
    if (!immediateDeletionEnabled()) {
      throw new NotFoundException({ code: 'IMMEDIATE_DELETION_UNAVAILABLE', message: 'Deleting an account at once is unavailable' });
    }
    return this.deleteAccount(userId);
  }

  async deleteAccount(userId: number): Promise<{ deleted: true }> {
    // QA A9: one deletion at a time per account. The row lock makes a second request (a double tap, or the job)
    // wait, and the blockers are read inside the same transaction.
    const done = await this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(UserEntity).findOne({ where: { id: userId }, lock: { mode: 'pessimistic_write' } });
      if (!user) throw new NotFoundException('User not found');
      // The other request won: nothing to delete, nothing to send.
      if (user.email === anonymizedAccountEmail(userId)) return null;
      const reasons = deletionBlockers(await this.deletionCounts(userId, manager));
      if (reasons.length) {
        throw new ConflictException({ code: 'ACCOUNT_DELETE_BLOCKED', reasons });
      }
      if (user.supabase_user_id) {
        const admin = this.adminClient();
        const { error } = await admin.auth.admin.deleteUser(user.supabase_user_id);
        if (error && !/not found/i.test(error.message)) {
          throw new ServiceUnavailableException({ code: 'ACCOUNT_DELETE_FAILED', message: 'Could not delete the login' });
        }
      }
      await manager.getRepository(UserRoleEntity).delete({ user_id: userId });
      await manager.getRepository(UserEntity).update(userId, {
        email: anonymizedAccountEmail(userId),
        supabase_user_id: null,
        first_name: 'Deleted',
        last_name: '',
        phone: null,
        identity_number: null,
        nationality: null,
        avatar_url: null,
        profile_completed: false,
        password: null,
        deletion_requested_at: null,
        deletion_effective_at: null,
      });
      return { email: user.email, avatarUrl: user.avatar_url };
    });
    if (done) {
      // QA A2/D3: tell the user only once the login and the profile are gone. A failure above sends nothing, so a
      // scheduled deletion that is retried the next day does not email again.
      await notifyAccountDeleted(done.email);
      // QA A8: the photo sits in a public bucket; it goes once the account is gone (a failed removal is only logged).
      if (done.avatarUrl && this.avatars) await this.avatars.removeOwned(userId, done.avatarUrl);
    }
    return { deleted: true };
  }

  /** `runner`: the deletion transaction (QA A9), or the data source for the preview and the schedule. */
  private async deletionCounts(userId: number, runner: { query: DataSource['query'] } = this.dataSource): Promise<{
    openContracts: number; openAgentContracts: number; unpaidBills: number; billsAwaitingReview: number; unrefundedDeposits: number;
  }> {
    const [agreements, bills, unrefundedDeposits] = await Promise.all([
      // Every agreement the user is in (tenant, landlord or the deal's agent); agreement-hold.ts decides which hold.
      runner.query(
        `SELECT c.id, COALESCE(ct.form_kind, cat.form_kind) AS form_kind, c.status,
                to_char(c.start_date, 'YYYY-MM-DD') AS start_date, c.data,
                (c.created_by_user_id = $1) AS as_agent,
                (c.owner_user_id = $1 OR t.user_id IS NOT DISTINCT FROM $1) AS as_party,
                EXISTS (
                  SELECT 1 FROM lease_contracts l
                  LEFT JOIN agreement_templates lt ON lt.id = l.template_id
                  LEFT JOIN master_agreement_types la ON la.code = l.agreement_type_code
                  WHERE l.lead_id = c.lead_id AND l.rent_room_id = c.rent_room_id AND l.tenant_id = c.tenant_id
                    AND COALESCE(lt.form_kind, la.form_kind) = 'lease' AND l.agreement_kind = 'new'
                    AND l.status IN ('active', 'expired', 'terminated')
                ) AS lease_started
         FROM lease_contracts c
         LEFT JOIN agreement_templates ct ON ct.id = c.template_id
         LEFT JOIN master_agreement_types cat ON cat.code = c.agreement_type_code
         LEFT JOIN tenants t ON t.id = c.tenant_id
         WHERE c.status <> 'cancelled'
           AND (c.created_by_user_id = $1 OR c.owner_user_id = $1 OR t.user_id = $1)`,
        [userId],
      ) as Promise<Array<{
        form_kind: string | null; status: string; start_date: string | null; data: unknown;
        as_agent: boolean; as_party: boolean; lease_started: boolean;
      }>>,
      // A pending bill with a sent slip waits for the agent; without one the tenant still has to pay.
      runner.query(
        `SELECT COUNT(*) FILTER (WHERE NOT (b.payment_slip_path IS NOT NULL AND b.slip_submitted_at IS NOT NULL))::int AS unpaid,
                COUNT(*) FILTER (WHERE b.payment_slip_path IS NOT NULL AND b.slip_submitted_at IS NOT NULL)::int AS review
         FROM tenant_bills b
         JOIN tenants t ON t.id = b.tenant_id
         WHERE t.user_id = $1 AND b.status = 'pending'`,
        [userId],
      ),
      runner.query(
        `SELECT COUNT(*)::int AS n FROM contract_deposit_settlements s
         JOIN lease_contracts c ON c.id = s.lease_contract_id
         LEFT JOIN tenants t ON t.id = c.tenant_id
         WHERE (c.owner_user_id = $1 OR t.user_id = $1)
           AND s.refund_amount > 0 AND s.refunded_at IS NULL AND s.status <> 'completed'`,
        [userId],
      ),
    ]);
    const today = bangkokToday();
    const holding = agreements.filter((row) => holdsAccount({
      formKind: row.form_kind, status: row.status, startDate: row.start_date, data: row.data, leaseStarted: row.lease_started,
    }, today));
    return {
      openContracts: holding.filter((row) => row.as_party).length,
      openAgentContracts: holding.filter((row) => row.as_agent).length,
      unpaidBills: Number(bills[0]?.unpaid ?? 0),
      billsAwaitingReview: Number(bills[0]?.review ?? 0),
      unrefundedDeposits: Number(unrefundedDeposits[0]?.n ?? 0),
    };
  }

  private adminClient(): SupabaseClient {
    if (!this.registrationAdminClient) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        throw new ServiceUnavailableException({ code: 'ACCOUNT_DELETE_FAILED', message: 'Account deletion is unavailable' });
      }
      this.registrationAdminClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return this.registrationAdminClient;
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

  /** Local development only: Railway starts the API with NODE_ENV=production, so a stray ALLOW_DEV_ROLE_GRANT=true there
   * still grants nothing (QA web role URL bug, 4 Nov 2026). */
  private assertDevGrantEnabled(): void {
    if (process.env.NODE_ENV !== 'development' || process.env.ALLOW_DEV_ROLE_GRANT !== 'true') {
      throw new ForbiddenException('Dev role grant is disabled');
    }
  }
}
