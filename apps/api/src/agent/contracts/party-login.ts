import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { DataSource } from "typeorm";
import { MasterRoleEntity, MasterRoleName } from "../../entities/master-role.entity";
import { UserEntity } from "../../entities/user.entity";
import { UserRoleEntity } from "../../entities/user-role.entity";

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

/** Create a login for this email, or attach the role when the email already exists. */
export async function ensurePartyLogin(
  db: DataSource,
  input: {
    email: string;
    phone: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    identityNumber?: string;
    nationality?: string;
    role: Extract<MasterRoleName, "landlord" | "tenant">;
    who: string;
  },
): Promise<number> {
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim().replace(/[\s-]/g, "");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new BadRequestException(`${input.who}ต้องมีอีเมลที่ถูกต้องเพื่อสร้างบัญชี`);
  if (phone.length < 6)
    throw new BadRequestException(`${input.who}ต้องมีเบอร์โทรอย่างน้อย 6 หลัก เพื่อใช้เป็นรหัสผ่าน`);

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
