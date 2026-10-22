import { BadRequestException, ConflictException, ServiceUnavailableException } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { DataSource } from "typeorm";
import { MasterRoleEntity, MasterRoleName } from "../../entities/master-role.entity";
import { UserEntity } from "../../entities/user.entity";
import { UserRoleEntity } from "../../entities/user-role.entity";
import { TenantEntity } from "../../entities/tenant.entity";
import { normalizeIdentityNumber } from "../../common/identity-number";

function envValue(name: string) {
  return (process.env[name] ?? "").trim().replace(/^"|"$/g, "");
}

function adminClient(): SupabaseClient {
  const url = envValue("SUPABASE_URL");
  const key = envValue("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key)
    throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าบัญชีล็อกอิน");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: "User", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

async function findSupabaseUserId(email: string): Promise<string | null> {
  const url = new URL("/auth/v1/admin/users", envValue("SUPABASE_URL"));
  url.searchParams.set("filter", email);
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "50");
  const key = envValue("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { users?: Array<{ id?: string; email?: string }> };
  const match = body.users?.find(
    (user) => user.email?.trim().toLowerCase() === email && user.id,
  );
  return match?.id ?? null;
}

async function ensureSupabaseUser(email: string, password: string, name: string) {
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (data.user?.id) return data.user.id;
  const message = error?.message?.toLowerCase() ?? "";
  if (
    message.includes("already") ||
    message.includes("registered") ||
    message.includes("exists")
  ) {
    const existing = await findSupabaseUserId(email);
    if (existing) return existing;
  }
  throw new BadRequestException("สร้างบัญชีล็อกอินไม่สำเร็จ");
}

type PersonFields = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  identityNumber?: string | null;
};

// Titles agents often type in front of a name; they do not tell two people apart.
// Thai titles are often typed straight onto the name; English ones need a dot or a space after them.
const TITLES = /^(?:(?:นางสาว|นาง|นาย|น\.ส\.|ด\.ช\.|ด\.ญ\.)\s*|(?:mrs|mr|ms|miss)(?:\.\s*|\s+))/i;
const cleanName = (value: string) =>
  value
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u0E4D\u0E32/g, "\u0E33")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(TITLES, "");
/** Every way the record spells the person: the stored full name and the given name + surname. */
const personNames = (p: PersonFields) =>
  [p.name ?? "", [p.firstName, p.lastName].filter((part) => part?.trim()).join(" ")]
    .map(cleanName)
    .filter(Boolean);
/**
 * C3, decided by Aof on 22 Oct 2026: two tenant records are the same person when their ID numbers (Thai ID or
 * passport, ignoring spaces, dashes and case) match, and two different people otherwise. Names are not compared.
 * Only a record saved before the number was required (no number at all) falls back to the name: it matches when
 * any spelling of the name matches (after dropping titles, spaces and invisible characters).
 */
export function sameTenantPerson(a: PersonFields, b: PersonFields): boolean {
  const idA = normalizeIdentityNumber(a.identityNumber);
  const idB = normalizeIdentityNumber(b.identityNumber);
  if (idA && idB) return idA === idB;
  // A side without a number is an old record: fall back to the name.
  const names = new Set(personNames(a));
  return personNames(b).some((name) => names.has(name));
}

export const TENANT_EMAIL_IN_USE =
  "อีเมลนี้เป็นบัญชีของผู้เช่าคนอื่นอยู่แล้ว กรุณาแก้อีเมลในข้อมูลผู้เช่า แล้วบันทึกหนังสือจองอีกครั้ง";

/**
 * C3: refuse an email whose account already belongs to a different person's tenant record (another
 * lead). Otherwise both people would share one account and the first person's name would be
 * overwritten. The same person renting again keeps the account. The message never names the other
 * tenant, who may belong to another agent. Runs inside ensurePartyLogin before any account is touched.
 */
export async function assertTenantEmailNotShared(
  db: DataSource,
  input: PersonFields & { email: string; leadId: number },
): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email) return;
  const user = await db
    .getRepository(UserEntity)
    .createQueryBuilder("u")
    .where("LOWER(u.email) = :email", { email })
    .getOne();
  if (!user) return;
  const linked = await db.getRepository(TenantEntity).find({ where: { user_id: user.id } });
  const other = linked.find(
    (row) =>
      row.lead_id !== input.leadId &&
      !sameTenantPerson(
        // An old tenant record without a number uses the number the account keeps, when it has one.
        { name: row.name, firstName: row.first_name, lastName: row.last_name, identityNumber: row.identity_number || user.identity_number },
        input,
      ),
  );
  if (other) throw new ConflictException({ code: "TENANT_EMAIL_IN_USE", message: TENANT_EMAIL_IN_USE });
}

/** Create a login for this email, or attach the role when the email already exists. */
type PartyLoginInput = {
  email: string;
  phone: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  identityNumber?: string;
  nationality?: string;
  who: string;
} & (
  /** A tenant login always names the lead whose tenant record it is for (checked by assertTenantEmailNotShared). */
  | { role: Extract<MasterRoleName, "tenant">; tenantLeadId: number }
  | { role: Extract<MasterRoleName, "landlord">; tenantLeadId?: never }
);

export async function ensurePartyLogin(db: DataSource, input: PartyLoginInput): Promise<number> {
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim().replace(/[\s-]/g, "");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new BadRequestException(`${input.who}ต้องมีอีเมลที่ถูกต้องเพื่อสร้างบัญชี`);
  if (phone.length < 6)
    throw new BadRequestException(`${input.who}ต้องมีเบอร์โทรอย่างน้อย 6 หลัก เพื่อใช้เป็นรหัสผ่าน`);
  if (input.role === "tenant")
    await assertTenantEmailNotShared(db, { ...input, email, leadId: input.tenantLeadId });

  const named = input.firstName?.trim()
    ? { first: input.firstName.trim(), last: input.lastName?.trim() ?? "" }
    : splitName(input.name ?? "");
  const identity = input.identityNumber?.trim() || null;
  const nationality = input.nationality?.trim() || null;
  const current = await db.getRepository(UserEntity).findOneBy({ email });
  const supabaseId =
    current?.supabase_user_id ??
    (await ensureSupabaseUser(email, phone, [named.first, named.last].filter(Boolean).join(" ")));
  const { first, last } = named;

  return db.transaction(async (manager) => {
    let user =
      (await manager.findOne(UserEntity, { where: { email } })) ??
      (await manager.findOne(UserEntity, { where: { supabase_user_id: supabaseId } }));
    if (!user) {
      user = await manager.save(
        manager.create(UserEntity, {
          email,
          supabase_user_id: supabaseId,
          first_name: first,
          last_name: last,
          phone,
          identity_number: identity,
          nationality,
          password: null,
          profile_completed: Boolean(first && phone),
        }),
      );
    } else {
      if (!user.supabase_user_id) user.supabase_user_id = supabaseId;
      if (!user.phone) user.phone = phone;
      if (first) {
        user.first_name = first;
        user.last_name = last;
      }
      if (identity) user.identity_number = identity;
      if (nationality) user.nationality = nationality;
      await manager.save(user);
    }
    const role = await manager.findOneBy(MasterRoleEntity, { name: input.role });
    if (!role) throw new BadRequestException("ไม่พบสิทธิ์ผู้ใช้ในระบบ");
    const linked = await manager.findOne(UserRoleEntity, {
      where: { user_id: user.id, role_id: role.id },
    });
    if (!linked) {
      await manager.save(
        manager.create(UserRoleEntity, { user_id: user.id, role_id: role.id }),
      );
    }
    return user.id;
  });
}
