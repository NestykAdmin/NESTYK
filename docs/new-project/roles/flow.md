# Roles — Flow (UX & routing)

Scope: ทุกโหมด · mobile/web app + API guard

---

## 1. โหมดแอป vs สิทธิ DB

```
┌─────────────────────────────────────────────────────────────┐
│  Auth session (JWT)                                           │
│       ↓ POST /auth/sync                                     │
│  public.users + user_roles → roles: ['guest','landlord',…]  │
└─────────────────────────────────────────────────────────────┘
       ↓                              ↓
  Guest routes (/)              Mode routes (/landlord|/tenant|/agent|/admin)
  login optional                RoleRouteGate → ต้องมี role ตรงโหมด
```

- **Guest** = UX สาธารณะ — ไม่มี route group ที่บังคับ role
- **`guest` ใน DB** = role default ของ user ใหม่ — ไม่ map 1:1 กับ Guest UX
- **Management roles** = `landlord` | `tenant` | `agent` | `admin` (`self_owner` เฟส 2 · `owner` เลิกใช้)

---

## 2. Login & post-login

| โหมด | Route login | หลัง login สำเร็จ |
|------|-------------|-------------------|
| Guest | `/login` | home — หรือ `/select-mode` ถ้ามี management role ≥1 |
| Landlord | `/landlord/login` | dashboard landlord |
| Tenant | `/tenant/login` | dashboard tenant |
| Agent | `/agent/login` | dashboard agent |
| Admin | `/admin/login` | dashboard admin |

กฎสำคัญ:

1. **Login จาก Guest** + มี `landlord|tenant|agent|admin` อย่างน้อย 1 → **`/select-mode`**
2. **Login จากหน้าโหมด** → dashboard โหมดนั้น · ไม่มี role → **Access Denied**
3. **ไม่มี session** แล้วเข้าโหมด → หน้า login โหมด (ไม่ redirect Guest เงียบ)
4. Guest features ที่ต้อง login → บังคับ session แต่ **ไม่** บังคับ management role

---

## 3. Mode picker (`/select-mode`)

| Query | พฤติกรรม |
|-------|----------|
| (none) | หลัง Guest login · แสดงเฉพาะ role ที่ user มี |
| `?source=switch` | จาก profile — มีปุ่มกลับ |

- กรองการ์ดตาม `roles[]` — **ไม่แสดง** role ที่ไม่มีสิทธิ
- ไม่มี management role → อยู่ Guest ต่อ
- Dev only: env `ALLOW_DEV_ROLE_GRANT` → ปุ่มเพิ่ม/ลบ role บนหน้า picker

---

## 4. RoleRouteGate (client)

ใส่ใน layout ของ `/tenant`, `/landlord`, `/agent`, `/admin`:

```
session? ─no─→ login โหมด
     │
     └─yes─→ roles มี requiredRole?
                  ├─ no  → /access-denied
                  └─ yes → render children
```

- **ไม่ redirect เงียบ** ไปโหมดอื่น
- รอ sync `/auth/sync` เสร็จก่อนตัดสิน

---

## 5. Access Denied

Route `/access-denied` — มี session แต่ `userHasAppRole(roles, requiredRole)` = false

---

## 6. สลับโหมด

1. Profile → `/select-mode?source=switch`
2. เลือกการ์ด → navigate prefix โหมด (`/landlord`, `/tenant`, `/agent`, `/admin`)
   - deep link เก่า `nestyk://owner` และ `EXPO_PUBLIC_DEFAULT_ROLE=owner` ยังพาเข้าโหมด landlord
3. แต่ละโหมดมี theme/nav แยก

---

## 7. Guest public

- `/`, `/search`, `/rooms/[id]` — browse ห้อง (Guest เท่านั้น)
- `/search` ไม่มี criteria → ไม่โหลด map/API

---

## 8. Dev: ทดลองเพิ่ม/ลบ role

```bash
ALLOW_DEV_ROLE_GRANT=true
```

Flow: select-mode → confirm → `POST|DELETE /auth/dev/roles`

- Grantable: `landlord`, `tenant`, `agent`, `admin` (ไม่แตะ `guest`)
- **ปิดใน production**
