# NESTYK — Multi-App Monorepo Ecosystem

> Monorepo Architecture · Node `>= 22` · Turborepo + npm workspaces · Multi-App PropTech Ecosystem

---

## 🏛️ สถาปัตยกรรมระบบ (Monorepo Layout)

```
NESTYK/
├── apps/
│   ├── api/                  # [Unified Backend] NestJS + Supabase PostgreSQL + TypeORM (Port 4000)
│   ├── web/                  # [Marketplace & Gateway] Next.js 15 (Port 3000 -> Unified Path Gateway)
│   ├── consumer-app/         # [Consumer Mobile App] Expo React Native (Guest ➔ Tenant)
│   ├── owner/                # [Owner Portal] Next.js (Port 3001 -> /owner)
│   ├── agent/                # [Agent Portal] Next.js (Port 3002 -> /agent)
│   └── admin/                # [Admin Operations] Next.js (Port 3003 -> /admin)
│
├── packages/
│   ├── config/               # [Shared Config] Tailwind preset, Theme colors.json, TS base
│   ├── types/                # [Shared Types] Role, Listing, Services, Contract, API DTOs
│   ├── i18n/                 # [Shared Localization] th, en, zh, ja
│   ├── ui/                   # [Shared UI] Tokens, Elevation, ModePage, WebPageLayout, Base Wrappers
│   ├── feature-search/       # [Shared Feature] Search Query Builder & Filters
│   ├── feature-listing/      # [Shared Feature] Config-Driven Listing Wizard Engine
│   └── feature-services/     # [Shared Feature] Services Hub Catalog & Matrix
│
└── docs/                     # [Documentation] Architecture & Rules
```

---

## 🌐 App-First & Smart Deep Linking Architecture

ระบบใช้โมเดล **App-First Strategy** (Web Marketplace + Mobile Super App):

| URL / Scheme | ปลายทาง Application | หน้าที่และคำอธิบาย |
|---|---|---|
| `http://localhost:3000/` | `apps/web` (Port 3000) | **Marketplace Web** ค้นหาห้อง, SEO Google, Smart App Banner |
| `http://localhost:3000/api/*` | `apps/api` (Port 4000) | **Unified Backend API** (`/api/v1/*`) |
| `nestyk://*` | `apps/consumer-app` (Port 8081) | **Mobile Super App (Expo SDK 54)** รวม 5 Roles + Services Hub |

---

## 🚀 คำสั่งเริ่มต้นใช้งาน (Getting Started)

```bash
# 1. ติดตั้ง dependencies ทั้งหมดใน workspace
npm install

# 2. รัน Core Ecosystem (Web + API + Mobile) พร้อมกันทันที
npm run dev

# 3. บิลด์ทุก Packages และ Apps
npm run build

# 4. ตรวจสอบ Lint
npm run lint
```

### คำสั่งเสริม (Optional Scripts)

```bash
# รันทุกแอปพลิเคชันทั้งหมดใน Monorepo
npm run dev:all

# รันเฉพาะ Marketplace Web
npm run dev --filter=@nestyk/web

# รันเฉพาะ Backend API
npm run dev --filter=@nestyk/api

# รันเฉพาะ Mobile App (Expo)
npm run dev --filter=@nestyk/consumer-app
```

### ฐานข้อมูล Supabase (schema + seed)

`DATABASE_URL` ใน `.env.api` ของ Supabase จริงต้องเป็น Session pooler (`postgres.<project-ref>@aws-0-<region>.pooler.supabase.com:5432`) เพราะ host ตรง `db.<project-ref>.supabase.co` ใช้ได้เฉพาะ IPv6

```bash
# นำ migration ใน supabase/migrations ที่ยังไม่ได้รันขึ้นฐานข้อมูล (บันทึกใน supabase_migrations.schema_migrations)
npm run db:push -w @nestyk/api -- --check   # ลองรันแล้ว rollback
npm run db:push -w @nestyk/api

# ใส่ข้อมูลตั้งต้นใน schema ว่าง: masters = master catalog + แม่แบบสัญญา, demo = ข้อมูลทดสอบ (dev เท่านั้น)
npm run db:seed -w @nestyk/api -- masters demo

# ตรวจว่า entity ตรงกับฐานข้อมูล
npm run db:check -w @nestyk/api -- --check
```

* ทั้งสองสคริปต์ใช้ `.env.api` เป็นค่าเริ่มต้น ระบุไฟล์อื่นด้วย `--env=.env.api.docker`
* docker ที่มี schema อยู่แล้ว ใช้ `db:push -- --mark-applied` เพื่อบันทึกว่า baseline รันแล้วโดยไม่รันซ้ำ
* migration ใหม่ให้ตั้งชื่อ `supabase/migrations/<YYYYMMDDHHMMSS>_<ชื่อ>.sql`
* ผู้ใช้ใน `demo` ใช้ UUID สมมติ เข้าได้เฉพาะ dev token (`ALLOW_DEV_AUTH=true`) เช่น `dev|00000000-0000-4000-8000-000000000001|admin@jitsamrit.com`

---

## 🎨 Design Tokens & UI Architecture
* **Universal Shell & Slot Pattern:** โครง Shell (`ModePage` บน Mobile / `WebPageLayout` บน Web) คงที่ 100% ไม่กระพริบ และสลับเปลี่ยนเฉพาะ Body Slot (`children`)
* **Tokens Single Source of Truth:** รวมศูนย์ไว้ที่ `packages/ui/src/theme/tokens.ts` และ `packages/config/theme/colors.json`
* **Config-Driven Features:** หน้าลงประกาศห้องของ Owner และ Agent ใช้ Engine เดียวกันจาก `@nestyk/feature-listing`
