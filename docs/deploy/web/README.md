# NESTYK เว็บ · env ต่อโดเมน (Vercel)

แบบง่าย (Mos 9 พ.ย. 2026): **1 โดเมน = 1 Vercel project** จาก repo เดียวกัน · URL ทำงานตามปกติ ต่างกันแค่ค่า env
ต้องแยก project เพราะ Expo ฝังค่า `EXPO_PUBLIC_*` ตอน build (project เดียวมีค่าต่างกันตามโดเมนไม่ได้)

| โดเมน | Vercel project | ไฟล์ env | สถานะ |
|---|---|---|---|
| nestyk.com | `nestyk-web` | `nestyk.com.env.example` | หน้า guest |
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

## นอก Vercel ที่ต้องตั้งให้ครบทุกโดเมนที่เปิด

- Supabase → Authentication → URL Configuration → Redirect URLs: เพิ่ม `https://<โดเมน>/**` (ลิงก์ตั้งรหัสผ่านใหม่)
- hCaptcha Dashboard → ไซต์ → Domains: เพิ่มโดเมน
- Google Cloud → คีย์ Maps ฝั่งเว็บ → HTTP referrers: เพิ่ม `https://<โดเมน>/*`
- API (Railway) CORS ถ้าจำกัด origin: เพิ่มโดเมน
- DNS (Z.com): ชี้แต่ละโดเมนไป Vercel project ของมัน

## ข้อควรรู้

- **owner.nestyk.com (self_owner):** โค้ดบน branch นี้ยังไม่มีบทบาท self_owner (ไม่มีใน `packages/types`, API และ `lib/route-access.ts`) · ค่า `EXPO_PUBLIC_WEB_PORTAL=self_owner` จึงถูกอ่านเป็น `all` · ก่อนเปิดต้อง (1) เพิ่ม self_owner ใน `ROLE_ACCESS` / `PORTAL_ROLES` / `ROLE_PATH` (2) ตัดสิน path: `/owner` (ต้องเลิกพาลิงก์เก่าไป `/landlord`) หรือ `/self-owner` · งาน self_owner ห้ามเข้า develop จนกว่า Mos สั่ง

- ระบบ login ยังแยกต่อโดเมน จนกว่าจะทำ SSO (cookie ร่วม `.nestyk.com` หลัง 13 พ.ย.) · ข้ามโดเมนต้อง login ใหม่ 1 ครั้ง
- พิมพ์แค่ `agent.nestyk.com` ตอนนี้ได้หน้า guest (ยังไม่ได้แก้ให้เข้า `/agent` อัตโนมัติ)
- `EXPO_PUBLIC_WEB_PORTAL` สะกดผิด = `all` (เปิดทุกบทบาท) → ตรวจค่าก่อน deploy ทุกครั้ง
- ไม่ต้องตั้ง `EXPO_PUBLIC_WEB_API_PROXY` (ใช้ตอน dev บนเครื่องเท่านั้น) และ `EXPO_PUBLIC_DEFAULT_ROLE` (มือถือเท่านั้น)
- อธิบายทุกตัวแปรอยู่ใน `.env.example` ที่ root
