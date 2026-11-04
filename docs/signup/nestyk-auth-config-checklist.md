# Checklist ตั้งค่าระบบบัญชีผู้ใช้ก่อนขึ้น server (SIT)

> **สำหรับ:** คนที่ตั้งค่า Supabase และ Railway ตอนเอาขึ้น SIT (และใช้เป็นแม่แบบตอนขึ้นระบบจริง)
> **ครอบคลุม:** สมัครด้วยอีเมล, เปลี่ยนรหัสผ่าน, ลืมรหัสผ่าน, ลบบัญชี
> **ไม่ครอบคลุม:** Google / Facebook / Apple (ยังไม่เปิดใช้)
> **อัปเดตล่าสุด:** 4 พ.ย. 2026 — ค่าในไฟล์นี้แทนที่ข้อ 3 ของ `nestyk-signup-dev-guide.md`

ห้ามแปะค่าจริงของ key, รหัสผ่าน หรือ connection string ลงในไฟล์นี้ แชต หรือ ticket ใส่ใน Supabase / Railway โดยตรงเท่านั้น

---

## 0. ทำไมต้องตั้ง 3 ที่

| ที่ตั้งค่า | ใครอ่าน | หมายเหตุ |
|---|---|---|
| **Supabase dashboard** ของ project SIT | Supabase Auth เอง | ค่าเป็นของ project ใครต่อ project นี้ก็ได้ค่าเดียวกัน |
| **Railway → API service → Variables** (environment SIT) | API (NestJS) | แก้แล้วต้อง redeploy |
| **ที่ build เว็บ / แอปของ SIT** (`EXPO_PUBLIC_*`) | แอป Expo และเว็บ | ค่าถูกฝังตอน build แก้แล้วต้อง build ใหม่ |

`.env.api` / `.env` บนเครื่องของแต่ละคน**ไม่เกี่ยว**กับ server ตั้งบนเครื่องแล้วไม่ไปถึง Railway

---

## 1. Supabase dashboard (project NESTYK - SIT)

ถ้า project หยุดอยู่ (Project is paused) ให้ Restore ก่อน

### 1.1 Authentication → URL Configuration

| ตั้งค่า | ค่า | ใช้กับ | ถ้าผิดจะเห็น |
|---|---|---|---|
| **Site URL** | โดเมนเว็บของ SIT เช่น `https://sit.example.com` **ไม่มี path และไม่มี `/` ท้าย** | ลืมรหัสผ่าน (เทมเพลตใช้ `{{ .SiteURL }}`) | กดลิงก์ในอีเมลแล้วเจอ "Unmatched Route" (เช่นตั้งเป็น `…/login` จะได้ `…/login/reset-password`) หรือถูกพาไป localhost |
| Redirect URLs | ยังไม่ต้องใส่ | (ใช้ตอนเปิด Google ภายหลัง) | – |

### 1.2 Authentication → Sign In / Providers

ส่วน **User Signups**

| ตั้งค่า | ค่า | ใช้กับ | ถ้าผิดจะเห็น |
|---|---|---|---|
| Allow new users to sign up | **เปิด** | สมัคร | สมัครไม่ได้ |
| Confirm email | **เปิด** | สมัคร | สมัครแล้วเข้าได้เลยโดยไม่ยืนยันอีเมล (ช่องโหว่ ดู dev-guide D2) |

กด **Email** ในส่วน Auth Providers จะมีแผงเปิดทางขวา

| ตั้งค่า | ค่า | ใช้กับ | ถ้าผิดจะเห็น |
|---|---|---|---|
| Enable Email provider | **เปิด** | ทุกอย่าง | – |
| Minimum password length | **8** | สมัคร, เปลี่ยน/ลืมรหัส | – |
| Password requirements | **ไม่เลือก (เว้นว่าง)** | – | ⚠️ ถ้าบังคับตัวพิมพ์เล็ก/ใหญ่ การสร้างบัญชีผู้เช่าจากหนังสือจองจะพัง เพราะยังใช้เบอร์โทรเป็นรหัสผ่าน (`party-login.ts`, dev-guide D5) แอปตรวจกฎตัวอักษรเองอยู่แล้ว |
| Secure password change | **เปิด** (เหมือน project Dev) | เปลี่ยน/ลืมรหัส | ใช้ได้ เพราะแอป login ใหม่ด้วยรหัสเดิมก่อนเปลี่ยน และลิงก์ลืมรหัสให้ session ใหม่อยู่แล้ว |
| Require current password when updating | **ปิด** | ลืมรหัส, เปลี่ยนรหัส | 🔴 ถ้าเปิด **ลืมรหัสผ่านพัง** (ผู้ใช้ไม่รู้รหัสเดิม) และเปลี่ยนรหัสพัง (แอปไม่ได้ส่งรหัสเดิมไปกับคำขอเปลี่ยน) |
| **Email OTP expiration** | **900** วินาที (15 นาที) | รหัสสมัคร + ลิงก์ลืมรหัส (ใช้ค่าเดียวกัน แยกไม่ได้) | อีเมลบอก 15 นาที แต่ลิงก์ใช้ได้นานกว่า |
| **Email OTP length** | **6** | รหัสสมัคร | แอปรับแค่ 6 หลัก ตั้งค่าอื่นแล้วสมัครไม่ผ่าน |

### 1.3 Authentication → Emails → SMTP Settings (Custom SMTP)

ระบบส่งเมลของ Supabase เองส่งได้แค่ไม่กี่ฉบับต่อชั่วโมง ต้องต่อ SMTP ของ Resend

| ตั้งค่า | ค่า |
|---|---|
| Enable Custom SMTP | เปิด |
| Sender email | อีเมลบนโดเมนที่ยืนยันแล้วใน Resend (โดเมน `nestyk.com`) |
| Sender name | `NESTYK` |
| Host / Port | `smtp.resend.com` / `465` |
| Username | `resend` |
| Password | Resend API key (ขอจากทีม ห้ามแปะในแชต) |

**ถ้าผิดจะเห็น:** สมัครแล้วไม่ได้รหัส, ลืมรหัสแล้วไม่ได้ลิงก์ (ดูใน Resend → Emails ว่ามีฉบับออกไปไหม)

### 1.4 Authentication → Emails → Templates

แก้ 2 แบบ ลบของเดิมในช่อง Body ทั้งหมดแล้ววางของใหม่

**Confirm signup** — ต้องมี `{{ .Token }}` เพราะแอปให้กรอกรหัส 6 หลัก ไม่ใช้ลิงก์

Subject:
```
รหัสยืนยันการสมัคร NESTYK / Your NESTYK sign-up code
```
Body:
```html
<h2>ยืนยันอีเมลของคุณ / Confirm your email</h2>

<p>กรอกรหัสนี้ในแอป NESTYK เพื่อยืนยันการสมัคร</p>
<p>Enter this code in the NESTYK app to finish signing up.</p>

<p style="font-size:24px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>

<p>รหัสใช้ได้ภายใน 15 นาที ถ้าคุณไม่ได้สมัคร ไม่ต้องทำอะไร</p>
<p>This code works for 15 minutes. If you didn't sign up, you can ignore this email.</p>
```

**Reset Password** — ลิงก์แบบ `token_hash` เปิดจากเครื่องไหนก็ได้ (ห้ามใช้ `{{ .ConfirmationURL }}` เพราะใช้ได้แค่ในเบราว์เซอร์ที่กดขอ)

Subject:
```
ตั้งรหัสผ่านใหม่ / Reset your NESTYK password
```
Body:
```html
<h2>ตั้งรหัสผ่านใหม่ / Reset your NESTYK password</h2>

<p>เราได้รับคำขอตั้งรหัสผ่านใหม่สำหรับบัญชี NESTYK ของคุณ กดลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่ เปิดจากเครื่องไหนก็ได้</p>
<p>We received a request to reset your NESTYK password. Use the link below to choose a new one. You can open it on any device.</p>

<p>
  <a href="{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery">ตั้งรหัสผ่านใหม่ / Set a new password</a>
</p>

<p>ลิงก์ใช้ได้ภายใน 15 นาที เปิดซ้ำได้จนกว่าจะตั้งรหัสผ่านใหม่สำเร็จ หลังจากนั้นลิงก์จะใช้ไม่ได้อีก ถ้าขอลิงก์ใหม่ ลิงก์นี้จะใช้ไม่ได้ทันที</p>
<p>This link works for 15 minutes. You can open it again until your new password is saved; after that it stops working. Asking for a new link cancels this one.</p>

<p>ถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ</p>
<p>If you didn't ask for this, you can ignore this email. Your current password still works.</p>
```

ถ้าเปลี่ยน Email OTP expiration ต้องแก้ "15 นาที" ในทั้ง 2 เทมเพลตตามด้วย

### 1.5 Authentication → Emails → Templates → Security → Password changed

อีเมลแจ้งว่ารหัสผ่านถูกเปลี่ยน **มาจาก Supabase ที่เดียว** (ทั้งตอนเปลี่ยนรหัสในหน้าตั้งค่าและตอนลืมรหัสผ่าน) API ไม่ได้ส่งเองแล้วตั้งแต่ 4 พ.ย. 2026 (เคยส่งซ้ำเป็น 2 ฉบับ)

| ตั้งค่า | ค่า | ถ้าผิดจะเห็น |
|---|---|---|
| Password changed (สวิตช์) | **เปิด** | เปลี่ยนหรือรีเซ็ตรหัสแล้ว**ไม่มีอีเมลแจ้งเลย** |
| Security อื่น ๆ (Email address changed, Phone number changed, Sign-in method linked/removed, MFA added/removed) | ปิดไว้ได้ (แอปยังไม่ใช้) | – |

Subject:
```
รหัสผ่าน NESTYK ถูกเปลี่ยน / Your NESTYK password was changed
```
Body:
```html
<h2>รหัสผ่านถูกเปลี่ยน / Your password was changed</h2>

<p>รหัสผ่านบัญชี NESTYK ของ {{ .Email }} ถูกเปลี่ยนแล้ว</p>
<p>The password for your NESTYK account {{ .Email }} was changed.</p>

<p>ถ้าคุณไม่ได้เป็นคนเปลี่ยน กรุณาใช้ "ลืมรหัสผ่าน" เพื่อตั้งรหัสใหม่ทันที</p>
<p>If this wasn't you, use "Forgot password" to set a new one right away.</p>
```

### 1.5 Authentication → Attack Protection (CAPTCHA)

เลือก **อย่างใดอย่างหนึ่ง** และต้องตรงกับฝั่งแอป (ข้อ 3)

| แบบ | Supabase | แอป (`EXPO_PUBLIC_HCAPTCHA_SITE_KEY`) |
|---|---|---|
| ปิด captcha | ปิด | **เว้นว่าง** |
| เปิด captcha | เปิด เลือก hCaptcha ใส่ Secret key | ใส่ **Site key** ของ hCaptcha ชุดเดียวกัน |

**ถ้าเปิดฝั่งเดียว:** สมัคร, login, ลืมรหัส, เปลี่ยนรหัส และยืนยันรหัสก่อนลบบัญชี **พังทั้งหมด** ("captcha verification process failed")

### 1.6 Authentication → Rate Limits

ดูช่อง **Rate limit for sending emails** ช่วง QA เทสหนักๆ ถ้าต่ำไปจะเจอ "email rate limit exceeded" ปรับขึ้นได้ระหว่างเทส

---

## 2. Railway → API service → Variables (environment SIT)

`railway.json` ตั้ง `NODE_ENV=production` ในคำสั่ง start ให้แล้ว ไม่ต้องตั้งเอง

### 2.1 ต้องมี

| ตัวแปร | ค่า | ใช้กับ | ถ้าไม่มี / ผิดจะเห็น |
|---|---|---|---|
| `DATABASE_URL` | connection string ของ DB ใน project **SIT** | ทุกอย่าง + migration ตอน deploy | ชี้ผิด project = migration ไปรันกับ DB อื่น |
| `SUPABASE_URL` | URL ของ project **SIT** | ทุกอย่าง | 401 ทุก request |
| `SUPABASE_ANON_KEY` | anon key ของ project SIT | ตรวจ token ผู้ใช้ | 401 ทุก request |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key ของ project SIT | **ลบบัญชี** (ลบ login ใน Supabase), อัปรูปโปรไฟล์ | ลบบัญชีได้ 503 `ACCOUNT_DELETE_FAILED` |
| `RESEND_API_KEY` | Resend API key | อีเมลนัดลบบัญชี, ลบบัญชีแล้ว, เปลี่ยนรหัสผ่านแล้ว, แจ้งเตือนสัญญา | **ไม่มี error ให้เห็น** แต่อีเมลพวกนี้ไม่ออกเลย (อีเมลสมัคร/ลืมรหัสยังออก เพราะ Supabase ส่งเองผ่านข้อ 1.3) |
| `REMINDER_EMAIL_FROM` | ผู้ส่งบนโดเมนที่ยืนยันใน Resend เช่น `NESTYK <ชื่อ@nestyk.com>` | เหมือนบรรทัดบน | เหมือนบรรทัดบน |
| `SUPABASE_BUCKET_AVATARS` | ไม่ใส่ก็ได้ (ค่าเริ่มต้น `profile-avatars` API สร้าง bucket เอง) | รูปโปรไฟล์ | – |

### 2.2 ต้องเป็น `false` หรือไม่ตั้งเลย บน server

| ตัวแปร | ถ้าเผลอเป็น `true` |
|---|---|
| `ALLOW_DEV_AUTH` | 🔴 ใครก็ปลอม token เข้าเป็นใครก็ได้ |
| `ALLOW_DEV_ROLE_GRANT` | 🔴 **ทุกคนที่ login ได้สิทธิ์ admin** (แอปขอสิทธิ์ให้เองทุกครั้งที่ login) |
| `ALLOW_DEV_REGISTRATION` | ไม่มีผล (ต้องเป็น development และยิงจาก localhost เท่านั้น) แต่ไม่ควรตั้ง |
| `ALLOW_TEST_USERS` | ใช้กับสคริปต์ `db:test-users` บนเครื่องเท่านั้น ไม่ต้องตั้งใน Railway |
| `DISABLE_SCHEDULED_JOBS` | job ทั้งหมดหยุด: ลบบัญชีที่ครบ 30 วัน (00:10 น.), ออกบิล (00:05 น.), แจ้งเตือนสัญญา (08:00 น.) |

### 2.3 เฉพาะ SIT / QA

| ตัวแปร | SIT | ระบบจริง |
|---|---|---|
| `ALLOW_IMMEDIATE_ACCOUNT_DELETION` | `true` ถ้า QA ต้องเทสปุ่ม "ลบทันที" | **`false` หรือไม่ตั้ง** (ผู้ใช้ลบได้แบบนัด 30 วันเท่านั้น) |

---

## 3. ที่ build เว็บ / แอปของ SIT (`EXPO_PUBLIC_*`)

| ตัวแปร | ค่า | ถ้าผิดจะเห็น |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | URL ของ API SIT ลงท้าย `/api/v1` | แอปเรียก API ผิดที่ |
| `EXPO_PUBLIC_SUPABASE_URL` | URL ของ project **SIT** (ต้องเป็น project เดียวกับข้อ 2) | login ได้แต่ API ตอบ 401 |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | anon key ของ project SIT | เหมือนบรรทัดบน |
| `EXPO_PUBLIC_HCAPTCHA_SITE_KEY` | ตามข้อ 1.5 | ข้อ 1.5 |
| `EXPO_PUBLIC_USE_DEV_AUTH` | `false` | – |
| `EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT` | `false` | แอปพยายามขอสิทธิ์ admin ทุกครั้งที่ login |

---

## 4. ฐานข้อมูล

- **migration รันเองตอน deploy** (`railway.json` → `preDeployCommand` = `db-push.cjs`) ไปที่ `DATABASE_URL` ของ SIT
  - `20261103110000_reservation_fulfilled.sql` จะเพิ่มเหตุผล "ใช้แล้ว: ทำสัญญาเช่าแล้ว" และ**ปิดหนังสือจองเก่าที่เริ่มเช่าไปแล้วใน DB นั้นทันที**
  - ถ้า migration ล้ม การ deploy ล้มทั้งรอบ ลองรัน `npm run db:push -w @nestyk/api -- --check` กับ DB ของ SIT ก่อน
- **ต้องมี master data** โดยเฉพาะ `master_roles` (`guest`, `agent`) ไม่อย่างนั้นสมัครแล้ว sync ไม่ผ่าน ("Missing registration roles") ถ้า DB ใหม่ให้รัน `npm run db:seed -w @nestyk/api -- masters`

---

## 5. ลำดับการขึ้น SIT

1. Restore project NESTYK - SIT (ถ้าหยุดอยู่)
2. ตั้ง Supabase ข้อ 1.2, 1.3, 1.5, 1.6
3. ตั้ง Railway ข้อ 2 แล้ว deploy API (migration รันเอง)
4. ตั้งค่า build ข้อ 3 แล้ว build / deploy เว็บ
5. **หลังเว็บขึ้นแล้ว** ค่อยตั้ง Site URL (ข้อ 1.1) และเทมเพลต Reset Password (ข้อ 1.4) ไม่อย่างนั้นลิงก์ในอีเมลจะพาไปหน้าที่ยังไม่มี
6. ทดสอบตามข้อ 6

---

## 6. ทดสอบหลังตั้งค่า (smoke test)

| # | ทำ | ต้องได้ | ถ้าไม่ได้ ดูข้อ |
|---|---|---|---|
| 1 | สมัครด้วยอีเมลใหม่ | ได้อีเมลรหัส 6 หลัก กรอกแล้วเข้าแอป | 1.2, 1.3, 1.4, 1.5 |
| 2 | ออกจากระบบ แล้ว login | เข้าได้ | 1.5, 2.1 |
| 3 | เปลี่ยนรหัสผ่าน (ตั้งค่า → บัญชี) | เปลี่ยนได้ ได้อีเมล "เปลี่ยนรหัสผ่านแล้ว" | 1.2, 2.1 (`RESEND_*`) |
| 4 | ลืมรหัสผ่าน ขอจาก**แอปมือถือ** แล้วกดลิงก์บน**มือถือ** | เปิดหน้าเว็บตั้งรหัสใหม่ได้ ตั้งเสร็จแล้ว login ในแอปด้วยรหัสใหม่ได้ | 1.1, 1.4 |
| 5 | กดลิงก์ลืมรหัสเดิมซ้ำหลังตั้งรหัสเสร็จ | "ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว" | 1.2 |
| 6 | ลบบัญชี → ลบภายใน 30 วัน → กรอกรหัส | ขึ้นวันที่นัดลบ และได้อีเมล "บัญชี NESTYK ถูกนัดลบ" | 2.1 (`RESEND_*`) |
| 7 | ยกเลิกการลบ | แถบรอลบหายไป | – |
| 8 | (ถ้าเปิดข้อ 2.3) ลบทันทีกับบัญชีทดสอบ | ไปหน้าแรกแบบผู้เยี่ยมชม login ด้วยบัญชีนั้นไม่ได้อีก สมัครใหม่ด้วยอีเมลเดิมได้ | 2.1 (`SUPABASE_SERVICE_ROLE_KEY`), 2.3 |
| 9 | login ด้วยบัญชีทั่วไป แล้วดูเมนู | **ต้องไม่มี**เมนู admin | 2.2 (`ALLOW_DEV_ROLE_GRANT`) |
