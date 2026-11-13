# NESTYK เว็บ · env ต่อโดเมน (Vercel)

แบบง่าย (Mos 9 พ.ย. 2026): **1 โดเมน = 1 Vercel project** จาก repo เดียวกัน · URL ทำงานตามปกติ ต่างกันแค่ค่า env
ต้องแยก project เพราะ Expo ฝังค่า `EXPO_PUBLIC_*` ตอน build (project เดียวมีค่าต่างกันตามโดเมนไม่ได้)
ยกเว้น **nestyk.com** ซึ่งเป็นเว็บเดียวที่ประกอบจาก 2 project (ดูหัวข้อ "nestyk.com: เว็บ guest + หน้าบัญชีบนโดเมนเดียว")

| โดเมน | Vercel project | ไฟล์ env | สถานะ |
|---|---|---|---|
| nestyk.com | `nestyk-guest` (apps/web, Next) ถือโดเมน | `nestyk.com.guest-web.env.example` | หน้า guest (เว็บ Next) |
| (ไม่มีโดเมนของตัวเอง) | `nestyk-web` (consumer-app) เป็นต้นทางของหน้าบัญชีบน nestyk.com | `nestyk.com.env.example` | login, สมัคร, ตั้งรหัสใหม่, เอกสาร, หน้าบทบาท |
| agent.nestyk.com | `nestyk-web-agent` | `agent.nestyk.com.env.example` | เปิด 13 พ.ย. 2026 |
| tenant.nestyk.com | `nestyk-web-tenant` | `tenant.nestyk.com.env.example` | เตรียมไว้ |
| landlord.nestyk.com | `nestyk-web-landlord` | `landlord.nestyk.com.env.example` | เตรียมไว้ (landlord = ชื่อใหม่ของ owner เดิม) |
| admin.nestyk.com | `nestyk-web-admin` | `admin.nestyk.com.env.example` | เตรียมไว้ |
| owner.nestyk.com | `nestyk-web-owner` | `owner.nestyk.com.env.example` | เตรียมไว้ · **ห้าม deploy จนกว่าโค้ดรองรับ self_owner** (ดูด้านล่าง) |

ไฟล์ในโฟลเดอร์นี้เป็นตัวอย่าง (commit ได้) · ค่าจริง (`<...>`) ใส่ที่ Vercel เท่านั้น ห้ามใส่ใน repo

## ต่างกันแค่ส่วน 5) Portal

| | nestyk.com | เว็บบทบาท (agent / tenant / landlord / admin) |
|---|---|---|
| `EXPO_PUBLIC_WEB_PORTAL` | `all` | ชื่อบทบาท |
| `EXPO_PUBLIC_WEB_PORTAL_URLS` | ว่าง | `all=https://nestyk.com` (บัญชีหลายบทบาทกดสลับแล้วไปเปิดที่ nestyk.com) |
| `EXPO_PUBLIC_WEB_SIGN_OUT_TO` | ไม่ตั้ง → ออกแล้วไปหน้าแรก | `login` → ออกแล้วไปหน้าเข้าสู่ระบบ |

ส่วน 1)–4) และ 6) ใช้ค่าเดียวกันทุกโดเมน (API, Supabase, hCaptcha, Maps เป็นชุด production ชุดเดียว)

## ตั้งค่า Vercel project (ทุกโดเมนเหมือนกัน)

- Root Directory: `apps/consumer-app`
- Build Command: `EXPO_PUBLIC_BUILD_SHA=$VERCEL_GIT_COMMIT_SHA npx expo export -p web`
  (ช่อง Environment Variables ของ Vercel ไม่แปลง `$VAR` จึงต้องใส่ที่ Build Command)
- Output Directory: `dist`
- ต้องมี rewrite ให้ path ที่ไม่มีนามสกุลไฟล์ได้ `index.html` (refresh หน้า `/agent/leads` แล้วไม่ 404 · แบบเดียวกับ `scripts/serve-web-dist.cjs`) → ยังไม่มี `vercel.json` ใน repo (งาน Phase B ในแผนเปิดตัว)

## nestyk.com: เว็บ guest + หน้าบัญชีบนโดเมนเดียว

แผน `nestyk-guest-session-plan-20261112.md` (Mos D1 12 พ.ย. 2026, AUTH-1) · ทำให้ login แล้วเว็บ guest เห็น session เดียวกัน
(localStorage ชุดเดียว) โดยไม่เปลี่ยนวิธีเก็บ session ของ consumer-app

```
ผู้ใช้ → nestyk.com (project nestyk-guest, apps/web)
          ├─ /, /search, /saved, /profile, /en/... ...  หน้าเว็บ guest (Next)
          ├─ /api/...                                     → API (API_URL)
          └─ /login /register /reset-password /no-access /privacy /terms
             /agent… /tenant… /landlord… /admin… /_expo/… /assets/…
                                                          → ACCOUNT_WEB_UPSTREAM (project nestyk-web)
```

- **project `nestyk-guest`** (ถือโดเมน nestyk.com): Root Directory `apps/web` · Framework Next.js · env ตาม `nestyk.com.guest-web.env.example`
  - `ACCOUNT_WEB_UPSTREAM` = URL ของ project `nestyk-web` เช่น `https://nestyk-web.vercel.app` (ไม่ตั้ง = ไม่ส่งต่อ, ลิงก์ไป `NEXT_PUBLIC_ACCOUNT_WEB_ORIGIN` แบบเดิม)
  - รายการ path ที่ส่งต่ออยู่ที่ `apps/web/lib/account-routes.js` ที่เดียว (เทสคุมให้ตรงกับ consumer-app และ middleware)
- **project `nestyk-web`** (consumer-app): ตั้งค่าเหมือนเดิมทุกอย่าง แต่**ถอดโดเมน nestyk.com ออก** และเพิ่ม `EXPO_PUBLIC_GUEST_WEB_URL=/`
  - หลัง login / สมัครที่เริ่มจากหน้า guest จะโหลดหน้า guest เดิมกลับมา (`?next=`) · บัญชีที่ลงหน้า guest ไปหน้าแรกของเว็บ guest
  - **ต้องมี SPA rewrite** (path ที่ไม่มีนามสกุลไฟล์ได้ `index.html`) ก่อน เพราะ `nestyk.com/login` จะดึง `/login` จาก project นี้ (งาน `vercel.json` ข้างบน)
  - URL `*.vercel.app` ของ project นี้ยังเปิดตรงได้ แต่ session แยกจาก nestyk.com · ไม่ต้องประกาศที่ไหน
- **เว็บบทบาท** (agent.nestyk.com ฯลฯ): ไม่เปลี่ยน · `EXPO_PUBLIC_WEB_PORTAL_URLS=all=https://nestyk.com` ยังใช้ได้ (nestyk.com/agent ส่งต่อให้ consumer-app)
- **นอก Vercel:** Supabase Redirect URLs, hCaptcha, Maps referrer ใช้ `nestyk.com` เดิม (ผู้ใช้เห็นทุกหน้าเป็น nestyk.com)

**ตอน dev บนเครื่อง (`npm run dev` คำสั่งเดียว):** ใส่ใน `.env` ที่ root
`ACCOUNT_WEB_UPSTREAM=http://127.0.0.1:8081` และ `EXPO_PUBLIC_GUEST_WEB_URL=http://localhost:3000` แล้วเปิด `http://localhost:3000`
- ตอน dev `apps/web` ส่งทุก path ที่ Next ไม่มีหน้าไป Expo dev server ด้วย (ไฟล์ bundle อยู่ใต้ `/node_modules/...`) · deploy ไม่มีข้อนี้
- เปลี่ยนค่า `EXPO_PUBLIC_*` แล้วต้องล้าง cache ของ Expo 1 ครั้ง (`cd apps/consumer-app && npx expo start -c`)
- hot reload ของ Expo ใช้ไม่ได้เมื่อเปิดผ่าน :3000 (กด refresh เอง) · อยากได้ hot reload เปิด :8081 ตรง (แต่ session ไม่ร่วมกับ :3000)
- ใช้ `localhost` อย่างเดียว: `localhost:3000` กับ `127.0.0.1:3000` เป็นคนละ origin (localStorage แยกกัน)

## นอก Vercel ที่ต้องตั้งให้ครบทุกโดเมนที่เปิด

- Supabase → Authentication → URL Configuration → Redirect URLs: เพิ่ม `https://<โดเมน>/**` (ลิงก์ตั้งรหัสผ่านใหม่)
- hCaptcha Dashboard → ไซต์ → Domains: เพิ่มโดเมน
- Google Cloud → คีย์ Maps ฝั่งเว็บ → HTTP referrers: เพิ่ม `https://<โดเมน>/*`
- API (Railway) CORS ถ้าจำกัด origin: เพิ่มโดเมน
- DNS (Z.com): ชี้แต่ละโดเมนไป Vercel project ของมัน

## ข้อควรรู้

- **owner.nestyk.com (self_owner):** โค้ดบน branch นี้ยังไม่มีบทบาท self_owner (ไม่มีใน `packages/types`, API และ `lib/route-access.ts`) · ค่า `EXPO_PUBLIC_WEB_PORTAL=self_owner` จึงถูกอ่านเป็น `all` · ก่อนเปิดต้อง (1) เพิ่ม self_owner ใน `ROLE_ACCESS` / `PORTAL_ROLES` / `ROLE_PATH` (2) ตัดสิน path: `/owner` (ต้องเลิกพาลิงก์เก่าไป `/landlord`) หรือ `/self-owner` · งาน self_owner ห้ามเข้า develop จนกว่า Mos สั่ง

- ระบบ login ยังแยกต่อโดเมน จนกว่าจะทำ SSO (cookie ร่วม `.nestyk.com` หลัง 13 พ.ย., AUTH-4) · ข้ามโดเมนต้อง login ใหม่ 1 ครั้ง · ภายใน nestyk.com (หน้า guest + หน้าบัญชี) ใช้ session เดียวกันแล้ว
- พิมพ์แค่ `agent.nestyk.com` ตอนนี้ได้หน้า guest (ยังไม่ได้แก้ให้เข้า `/agent` อัตโนมัติ)
- `EXPO_PUBLIC_WEB_PORTAL` สะกดผิด = `all` (เปิดทุกบทบาท) → ตรวจค่าก่อน deploy ทุกครั้ง
- ไม่ต้องตั้ง `EXPO_PUBLIC_WEB_API_PROXY` (ใช้ตอน dev บนเครื่องเท่านั้น) และ `EXPO_PUBLIC_DEFAULT_ROLE` (มือถือเท่านั้น)
- อธิบายทุกตัวแปรอยู่ใน `.env.example` ที่ root
