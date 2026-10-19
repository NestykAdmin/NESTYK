import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MASTER_ROLE_NAMES, RETIRED_ROLE_NAMES } from '../entities/master-role.entity';

/** What is wrong between the role names this code uses and the rows in master_roles. */
export function roleCatalogProblems(dbNames: string[]) {
  const have = new Set(dbNames);
  return {
    missing: MASTER_ROLE_NAMES.filter((name) => !have.has(name)),
    retired: dbNames.filter((name) => RETIRED_ROLE_NAMES.includes(name)),
    unknown: dbNames.filter((name) => !MASTER_ROLE_NAMES.includes(name as never) && !RETIRED_ROLE_NAMES.includes(name)),
  };
}

/**
 * Stops the API when master_roles does not match the roles this code uses (docs/ROLE-CHANGE-PLAN.md, guard 3):
 * - a role the code needs is missing (e.g. the database has not run the landlord rename yet), or
 * - a retired role code such as 'owner' exists (an old version of the code would read it as a landlord).
 * Extra roles this code does not know (added by a newer release) only log a warning: no @Roles grants them anything.
 * Unlike SchemaDriftCheck this one is awaited and throws, so Nest fails to start.
 */
@Injectable()
export class RoleCatalogCheck implements OnApplicationBootstrap {
  private readonly logger = new Logger('RoleCatalog');

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    const schema = process.env.DB_SCHEMA || 'public';
    const rows: Array<{ name: string }> = await this.dataSource.query(
      `SELECT name FROM ${this.dataSource.driver.escape(schema)}.master_roles`,
    );
    const { missing, retired, unknown } = roleCatalogProblems(rows.map((row) => row.name));
    if (unknown.length) {
      this.logger.warn(`master_roles มี role ที่โค้ดรุ่นนี้ไม่รู้จัก: ${unknown.join(', ')} (ไม่ให้สิทธิ์อะไร)`);
    }
    if (missing.length || retired.length) {
      throw new Error(
        [
          'master_roles ไม่ตรงกับ role ที่โค้ดใช้ API หยุดทำงาน:',
          missing.length ? `  - ขาด: ${missing.join(', ')} → รัน npm run db:push -w @nestyk/api` : null,
          retired.length ? `  - มีรหัสที่เลิกใช้แล้ว: ${retired.join(', ')} → รัน migration rename_owner_role_to_landlord` : null,
          schema !== 'public' ? `  (migration ใน supabase/migrations แก้ schema public เท่านั้น แต่ DB_SCHEMA=${schema})` : null,
          '  ดู docs/ROLE-CHANGE-PLAN.md',
        ].filter(Boolean).join('\n'),
      );
    }
  }
}
