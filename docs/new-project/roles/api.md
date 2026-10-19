# Roles — API

Base: API URL ของ project (เช่น `http://localhost:4000/api/v1`)  
Auth header: `Authorization: Bearer <access_token>`

---

## 1. Identity sync (ทุก login)

### `POST /auth/sync`

สร้าง/เชื่อม `public.users` จาก JWT · รับประกัน role `guest` ถ้ายังไม่มี role

**Request**

```http
POST /auth/sync
Authorization: Bearer eyJ…
```

**Response**

```json
{
  "id": 42,
  "email": "user@example.com",
  "firstName": "Som",
  "lastName": "chai",
  "phone": null,
  "avatarUrl": null,
  "profileCompleted": false,
  "provisioned": true,
  "roles": ["guest", "landlord"]
}
```

| Field | ความหมาย |
|-------|----------|
| `roles` | array จาก `user_roles` → `master_roles.name` |
| `profileCompleted` | false → onboarding ก่อนฟีเจอร์บางอย่าง |

**Side effects**

- User ใหม่: insert `users` + junction `guest`
- ใช้ advisory lock ต่อ auth subject id — กัน race

---

## 2. Profile (authenticated)

| Method | Path |
|--------|------|
| `PATCH` | `/auth/profile` |
| `POST` | `/auth/profile/avatar` |

Response shape เหมือน `/auth/sync`

---

## 3. Dev role grant (local / SIT only)

เปิดเมื่อ `ALLOW_DEV_ROLE_GRANT=true`

### `POST /auth/dev/roles`

```json
{ "role": "agent" }
```

Allowed: `landlord` | `tenant` | `agent` | `admin` (`owner` ถูกปฏิเสธ 400)

### `DELETE /auth/dev/roles`

```json
{ "role": "landlord" }
```

Idempotent · ไม่ลบ `guest`

---

## 4. การตรวจสิทธิใน service

Pattern แนะนำ — แต่ละ module assert เอง:

```typescript
private assertAgent(user: UserEntity) {
  if (!user.user_roles?.some((ur) => ur.role?.name === 'agent')) {
    throw new ForbiddenException('Agent role required');
  }
}
```

**Guard chain**

1. Auth guard → resolve JWT → load `User` + `roles`
2. Controller ส่ง user เข้า service
3. Service `assert*` ก่อน business logic

Guest/public endpoints: ไม่ assert management role

---

## 5. Route prefix ↔ API

| App mode | ตัวอย่าง API prefix | Role |
|----------|---------------------|------|
| Landlord | `/bills/received*` · `/contracts/mine*` (ร่วมกับ tenant) | `landlord` |
| Tenant | `/tenant/*` | `tenant` |
| Agent | `/agent/*` | `agent` |
| Admin | `/admin/*` | `admin` |
| Guest/public | `/properties/public` | ไม่บังคับ |

---

## 6. Client usage

```typescript
await apiFetch('/auth/sync', { method: 'POST', token });

await apiFetch('/auth/dev/roles', {
  method: 'POST',
  token,
  body: JSON.stringify({ role: 'agent' }),
});
```

Client gate อ่าน `roles[]` จาก sync response

Assert ใน service: `assertAgent(user)` — ตรวจ `roles` มี `name === 'agent'`
