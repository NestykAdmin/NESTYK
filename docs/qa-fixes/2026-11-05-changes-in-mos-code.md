# โค้ดของ Mos ที่ Jom แก้ไป (จากผลเทสเว็บของ QA 4 พ.ย. 2026)

> **ถึง:** Mos
> **จาก:** Jom (แก้ร่วมกับ Claude)
> **branch:** `feature/register`
> **ที่มา:** ไฟล์ของ Aof `nestyk-web-test-results-for-dev-2026-11-04.md` (เทสที่ `qa/e2e` `efab8d0` ซึ่ง merge `8272aac` แล้ว)
> **อัปเดต:** 5 พ.ย. 2026

ไฟล์นี้บอกว่าแก้อะไรในโค้ดที่ Mos ทำไว้ (routing, session, WebMenu) จะได้ไม่แก้ทับกันหรือย้อนของกันโดยไม่รู้ตัว แต่ละข้อมีพฤติกรรมก่อนและหลังแก้ ไฟล์ที่แตะ และเทสต์ที่เพิ่ม

## สรุป

| ข้อ QA | เรื่อง | ไฟล์ของ Mos ที่แตะ | commit |
|---|---|---|---|
| 2 | เปิดหน้าของบทบาทที่บัญชีไม่มีได้ แค่พิมพ์ URL | `app/index.tsx`, `lib/app-routes.ts`, `lib/web-routes.ts`, `lib/web-routes.web.ts` | `d36e9b9` |
| 8 | หน้า `/admin` แสดงตัวเลขปลอม | `app/index.tsx` | `d36e9b9` |
| 3 | ปุ่มในกล่องเตือนก่อนหมดเวลากดไม่ได้ | `components/web-session/IdleSignOutGate.web.tsx` | `66b48e8` |
| 5 | แท็บที่โหลดหลังแท็บอื่นหมดเวลา ไม่บอกว่าหมดเวลา | `lib/auth/cross-tab-rules.ts`, `lib/auth/cross-tab.web.ts`, `lib/auth/cross-tab.ts`, `lib/auth/AuthContext.tsx` | ยังไม่ commit |
| 9 | `/Login`, `/Privacy` (ตัวพิมพ์ใหญ่) ขึ้นหน้าไม่พบ | `components/web-routes/CatchAllRoute.web.tsx`, `lib/app-routes.ts` | ยังไม่ commit |
| 10 | เมนู Create: Esc แล้วโฟกัสหลุด / คลิกนอกเมนูทะลุ | `components/agent-web/ui/WebMenu.tsx` | ยังไม่ commit |

path ทั้งหมดอยู่ใต้ `apps/consumer-app/` ข้อ 1, 4, 6, 7 เป็นโค้ดฝั่ง auth และลืมรหัสผ่านของ Jom ไม่ได้อยู่ในไฟล์นี้ ยกเว้นส่วนที่แตะ `AuthContext.tsx` (ดูท้ายไฟล์)

---

## ข้อ 2: ตรวจบทบาทตอนเปิดหน้าจาก URL (`d36e9b9`)

**ก่อนแก้:** `applyRoute` ใน `app/index.tsx` เรียก `setActiveRole(route.role)` ตาม URL ทันที บัญชีผู้เช่าพิมพ์ `/agent/rooms`, `/landlord/income`, `/admin` แล้วเห็นหน้านั้นได้ ส่วน `?next=` ตอน login ตรวจอยู่แล้วใน `postLoginPath`

**หลังแก้:** บัญชีที่ login แล้วจะถูกพาไปหน้าแรกของบทบาทตัวเอง**แบบเงียบ ๆ** (ไม่มีข้อความ) เมื่อเปิดหน้าของบทบาทที่ไม่มี

**ที่เปลี่ยน**
- `lib/app-routes.ts`
  - เพิ่ม `canOpenRole(role, roles)`: guest เปิดได้ทุกคน บทบาทอื่นต้องอยู่ใน `roles`
  - `postLoginPath` เปลี่ยนมาใช้ `canOpenRole` แทนเงื่อนไขเดิม (ผลเหมือนเดิม) กฎจะได้อยู่ที่เดียว
- `lib/web-routes.web.ts`: เพิ่ม `landingRoleFor(roles)` = `pickLandingRole(roles, readLastRole())`
- `lib/web-routes.ts` (มือถือ): เพิ่ม `landingRoleFor(roles)` = `pickLandingRole(roles)`
- `app/index.tsx`
  - เพิ่ม `signedInRoles` (มีค่าเมื่อ `ready && isAuthenticated && session`) และ `signedInRolesRef`
  - **`applyRoute`:** ถ้า `signedInRolesRef.current` มีค่า และ `!canOpenRole(route.role, roles)` จะ `router.replace(roleHomePath(landingRoleFor(roles)))` แล้ว return เลย หน้านั้นไม่ถูกเปิดแม้แวบเดียว ใช้ `replace` จึงกด back แล้วไม่วนกลับ dependency ของ `useCallback` เปลี่ยนจาก `[]` เป็น `[router]`
  - **effect ใหม่ (ต่อจาก effect เช็ก login):** รองรับหน้าที่เปิดก่อน session โหลดเสร็จ และบทบาทเริ่มต้นของแอปมือถือ ถ้าบทบาทที่เปิดอยู่ไม่ผ่าน `canOpenRole` เว็บจะ `router.replace(...)` ส่วนมือถือจะ `setActiveRole` / `setActiveTab` เป็นบทบาทของตัวเอง
  - **`consumePendingRole`:** ตั้งบทบาทที่เลือกไว้ก่อน login เฉพาะเมื่อ `canOpenRole(pending, session?.roles)`
- `/owner/...` ไม่ได้แก้แยก เพราะถูก redirect ไป `/landlord/...` แล้วผ่านการตรวจเดียวกัน

**เทสต์:** `components/role-url-guard.test.cjs` (ดึง `applyRoute` และ effect จริงออกจาก `index.tsx` มารัน แบบเดียวกับ `sign-out-navigation.test.cjs`) และเคส `canOpenRole` ใน `lib/app-routes.test.cjs`

**ถ้า Mos แก้ routing ต่อ:** ทุกทางที่ตั้ง `activeRole` จาก URL หรือจากที่เก็บไว้ ควรผ่าน `canOpenRole` และถ้าเปลี่ยนชื่อหรือย้าย `applyRoute` ให้แก้ `role-url-guard.test.cjs` ด้วย เพราะเทสต์หาฟังก์ชันจากชื่อ

## ข้อ 8: การ์ดหน้าแรกของแต่ละบทบาท (`d36e9b9`)

**ก่อนแก้:** `summaries` ใน `app/index.tsx` เป็นข้อความภาษาอังกฤษที่เขียนในโค้ด มีตัวเลขปลอม (admin: "Pending tickets: 3 · Inspections today: 2", agent: "24 co-broke listings · 45,000 THB commission")

**หลังแก้**
- ลบตัวเลขปลอมออก
- หัวข้อย้ายไป i18n 4 ภาษาที่ `mobile.roleHome` (`guestTitle`, `guestDesc`, `tenantTitle`, `landlordTitle`, `agentTitle`, `adminTitle`, `comingSoon`)
- ป้ายใช้ `t.roles.*`
- admin แสดง "หน้าหลักผู้ดูแลระบบ · เร็ว ๆ นี้"

## ข้อ 3: กล่องเตือนก่อนหมดเวลา (`66b48e8`)

**ก่อนแก้:** ทุก `pointermove`, `keydown`, `wheel` และอื่น ๆ เรียก `touch()` ซึ่งทำ `setWarning(false)` กล่อง "Are you still there?" จึงหายตั้งแต่ขยับเมาส์ไปหาปุ่ม กด "Sign out" ไม่ทัน ผู้ใช้ยังล็อกอินค้าง และระบบนับ 8 ชม. ใหม่

**หลังแก้:** ใน `IdleSignOutGate.web.tsx` เพิ่ม `warningShown` (ref ที่ตามค่า `warning`) และ `onActivity` จะ return ทันทีระหว่างที่กล่องขึ้น กล่องจึงปิดได้ 2 ทางเท่านั้น
- "Stay signed in" → `touch(true)`
- "Sign out" → `expire()`

ถ้ามีการใช้งานในแท็บอื่น (storage event แล้ว `check()`) กล่องในแท็บนี้ยังหายเองเหมือนเดิม

**เทสต์:** `components/idle-signout-gate.test.cjs` (3 เคส รันกับโค้ดเดิมแล้วแดง)

## ข้อ 5: แท็บที่โหลดหลังแท็บอื่นหมดเวลา (ยังไม่ commit)

**ก่อนแก้:** แท็บ A หมดเวลา → ล้าง session ที่ใช้ร่วมกัน → แท็บ B ที่ถูก**รีโหลด**ทีหลังไม่เจอ session จึงได้ `restoreSession` เป็น `none` ไปหน้า login แบบไม่มีข้อความ "Your session has expired"

**หลังแก้:** จดเวลาที่หมดอายุไว้ แท็บที่โหลดโดยไม่มี session จะขึ้นข้อความหมดเวลา**ครั้งเดียว** ถ้าเพิ่งหมดอายุไม่เกิน 24 ชม.

**ที่เปลี่ยน**
- `lib/auth/cross-tab-rules.ts`: เพิ่ม `EXPIRED_AT_KEY = 'nestyk.web.expiredAt'`, `EXPIRY_NOTICE_MS` (24 ชม.) และ `recentExpiry(raw, now)`
- `lib/auth/cross-tab.web.ts`
  - `markAuthEvent('expired')` จดเวลาลง `EXPIRED_AT_KEY` ส่วน `markAuthEvent('signedOut')` ลบทิ้ง
  - เพิ่ม `takeExpiryNotice()`: อ่านแล้วลบทันที จึงขึ้นครั้งเดียว
  - เพิ่ม `clearExpiryNotice()`
- `lib/auth/cross-tab.ts` (มือถือ): `takeExpiryNotice()` คืน `false` และ `clearExpiryNotice()` ไม่ทำอะไร
- `lib/auth/AuthContext.tsx`
  - `applySession` เรียก `clearExpiryNotice()` หลัง `saveAuthSession` (login ใหม่แล้ว ข้อความเก่าไม่ใช่เรื่องใหม่)
  - ใน restore: `else if (!stored && takeExpiryNotice()) setSessionExpired(true);`

**เทสต์:** เพิ่ม 3 เคสใน `lib/auth/cross-tab.test.cjs` และเพิ่ม `takeExpiryNotice` / `clearExpiryNotice` ใน mock `./cross-tab` ของ `registration.test.cjs`

## ข้อ 9: ตัวพิมพ์ใหญ่ใน URL (ยังไม่ commit)

**ก่อนแก้:** `/AGENT/...` ใช้ได้ (เพราะ `parseAppPath` ทำเป็นตัวพิมพ์เล็ก) แต่ `/Login`, `/Privacy` ไม่ตรงไฟล์ route ซึ่ง expo-router จับแบบตรงตัวพิมพ์ จึงตกไปที่ catch-all แล้ว `CatchAllRoute.web.tsx` แสดง `<Unmatched />` เพราะ `kind` เป็น `auth` / `legal`

**หลังแก้**
- `lib/app-routes.ts`: เพิ่ม `ownScreenPath(pathname)` ถ้า path ตรงกับหน้า auth/legal เมื่อแปลงเป็นตัวพิมพ์เล็ก (มี `/` ท้ายก็ได้) จะคืน path ตัวพิมพ์เล็ก ถ้าไม่ตรงคืน `null`
- `components/web-routes/CatchAllRoute.web.tsx`: ถ้า `ownScreenPath` มีค่า จะ `router.replace(lowercasePath + window.location.search)` และ return `null` จึงเก็บ `?next=` และ `?token_hash=` ไว้ด้วย path อื่นทำงานเหมือนเดิม

**เทสต์:** `components/catch-all-route.test.cjs` (3 เคส) และเคส `ownScreenPath` ใน `lib/app-routes.test.cjs`

## ข้อ 10: `WebMenu` (ยังไม่ commit)

**ก่อนแก้**
- กด Esc แล้ว `setOpen(false)` อย่างเดียว ปุ่มในเมนูที่มีโฟกัสหายไป โฟกัสจึงตกไปที่ `BODY`
- คลิกนอกเมนู เมนูปิดตอน `mousedown` แต่คลิกนั้นไปกดของข้างใต้ด้วย (กดพื้นที่บนแดชบอร์ดแล้วไป `/agent/leads`)

**หลังแก้** (`components/agent-web/ui/WebMenu.tsx`)
- **Esc:** เพิ่ม `triggerRef` บนปุ่มที่เปิดเมนู กด Esc แล้ว `triggerRef.current?.focus()`
- **คลิกนอกเมนู:** ตอน `mousedown` นอกเมนู จะเพิ่มตัวดัก `click` แบบ capture และ once ไว้กลืนคลิกนั้นคลิกเดียว (`preventDefault` + `stopPropagation`) แล้วตั้ง `mouseup` แบบ once ให้ถอดตัวดักใน `setTimeout(0)` ถ้ากดค้างแล้วลากออก (ไม่เกิดคลิก) ก็จะไม่ไปกินคลิกครั้งหลัง
- มีผลกับทุกเมนูที่ใช้ `WebMenu`: Create, ภาษา, เมนูแถว, เมนูบัญชี

**เทสต์:** `components/web-menu-close.test.cjs` (4 เคส รันกับโค้ดเดิมแล้วแดง 2 เคส)

---

## ส่วนอื่นที่แตะไฟล์เดียวกับของ Mos

- **`lib/auth/AuthContext.tsx`**
  - `ensureAdminRole` ทำงานเฉพาะ `__DEV__ && EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT === 'true'` (เดิมทำงาน เว้นแต่ตั้งเป็น `'false'`) ข้อ 1 ของ QA, `d36e9b9`
  - เพิ่ม `hasResetSession()` ให้หน้า `reset-password` ใช้เช็กลิงก์ `?code=` แบบเก่า (ข้อ 4, ยังไม่ commit)
- **`lib/agent-session.ts`:** ไม่ยิง `POST /auth/dev/roles` แล้ว ถ้าบัญชีไม่มี agent จะโยน error code `AGENT_ROLE_REQUIRED` ยกเว้น build dev ที่ตั้ง `EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT=true` (ข้อ 1, `d36e9b9`)
- **API `auth.service.ts`:** `/auth/dev/roles` ใช้ได้เฉพาะ `NODE_ENV=development` **และ** `ALLOW_DEV_ROLE_GRANT=true` (ข้อ 1, `d36e9b9`)
- **`packages/i18n/src/error-message.ts`:** `localizedError` คืน fallback เสมอสำหรับ 403 ภาษาอังกฤษ, `AGENT_ROLE_REQUIRED` และ `HTTP nnn` เปล่า ๆ (ข้อ 7, `d36e9b9`)
- **`app/index.tsx`:** เลิกเรียก `POST /auth/password-changed` หลังเปลี่ยนรหัส เพราะ Supabase ส่งอีเมลแจ้งเองแล้ว (`d36e9b9`)

## ยังไม่ได้แก้ (โค้ดของ Mos)

**`nestyk.web.lastActivity` ไม่ถูกล้างตอนออกจากระบบ** (คำถามข้อ 5 ของ QA)
- **ปัญหา:** login ด้วย Google/Facebook บนเว็บจะโหลดหน้าใหม่ แล้ว `IdleSignOutGate` มองเป็น session ที่กู้คืนมา ใช้เวลาเก่าที่ค้างอยู่ ถ้าเกิน 8 ชม. จะเด้งออกทันทีหลัง login
- **เสนอ:** login สำเร็จทุกทางให้เขียน `lastActivity` เป็นตอนนี้ และออกจากระบบทุกทางให้ล้างทิ้ง
- ยังไม่ได้ทำ ตอนนี้ยังไม่เปิด Google/Facebook ถ้า Mos จะทำเอง บอก Jom ด้วย
