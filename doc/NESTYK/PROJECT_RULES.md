# NESTIQ (NESTYK) — Core Project Rules & Engineering Guidelines

> Monorepo Architecture · Node `>= 22` · Turborepo + npm workspaces · Multi-App Ecosystem

---

## 0. Starter Kit Deployment & Path Placement Guide (การนำไปวางในโปรเจกต์ใหม่)

เมื่อเริ่มต้นโปรเจกต์ใหม่ในระบบนิเวศ NESTIQ / NESTYK ให้นำไฟล์จากโฟลเดอร์ `docs/NESTYK/` ไปจัดวางตาม Path ปลายทางใน Monorepo ดังนี้:

| ไฟล์ต้นทาง (Source) | Path ปลายทางใน Monorepo ใหม่ (Target Path) | หน้าที่และคำอธิบาย |
|---|---|---|
| `docs/NESTYK/PROJECT_RULES.md` | `.cursorrules` (ที่ Root โปรเจกต์)<br>`.cursor/rules/core-rules.mdc` | กฎเหล็ก AI Assistant, Coding Standards, Universal Shell & UI Rules |
| `docs/NESTYK/architecture-multi-app.md` | `docs/architecture-multi-app.md` | สถาปัตยกรรม 5 Apps, Role Permissions, Services Matrix, CI Specs |
| `docs/NESTYK/tokens.ts` | `packages/ui/src/theme/tokens.ts`<br>`apps/mobile/lib/theme/tokens.ts` | Design Tokens หลัก (Corporate, Semantic, Roles, Typography) |
| `docs/NESTYK/colors.json` | `packages/config/theme/colors.json`<br>`tailwind.config.js` (Import) | Color Palette แบบ JSON สำหรับ Tailwind CSS และ Config อื่นๆ |

---

## 1. AI Assistant Workflow (บังคับทุกครั้งที่แก้โค้ด)

### 1.1 Plan First & Wait for Approval (บังคับ 100%)
ก่อน **แก้ไข / สร้าง / ลบไฟล์** หรือรัน migration / seed ต้องทำตามลำดับนี้เสมอ:
1. อ่านกฎในไฟล์นี้ และ docs ที่เกี่ยวข้อง — ระบุ **Scope (App/Domain + Role)**
2. ส่ง **To-Do Checklist (`- [ ]`)** ในแชท — สรุปไฟล์ที่จะแตะ + ผลลัพธ์ที่คาดหวัง
3. **หยุดรอการอนุมัติ (Wait for Approval)** — ห้ามแตะต้องโค้ดหรือรันคำสั่งแก้ไขใดๆ จนกว่า User จะตอบรับ เช่น `ทำเลย`, `ok`, `approve`

**ข้อยกเว้น:**
* ตอบคำถาม/อธิบายโค้ดอย่างเดียว (Ask mode)
* แก้ Typo หรือ Bug บรรทัดเดียว
* User สั่งชัดเจนว่า `ทำเลยโดยไม่ต้อง plan` หรือ `skip plan`
* User อนุมัติ To-Do แล้วในเทิร์นก่อนหน้า ให้ทำต่อได้ทันที

### 1.2 Core Development Principles
1. **Prefer Libraries Over Custom UI (ห้าม Reinvent the Wheel):**
   * ฟีเจอร์ที่มี Lib มาตรฐานในระบบนิเวศ (Expo / React Native / Next.js / NestJS) ให้ **ใช้ Lib เสมอ** แม้โปรเจกต์ยังไม่ได้ติดตั้ง (ให้ระบุใน Plan เพื่อขอ Install)
   * ห้ามเขียน Custom Modal, Dropdown, Date Picker, Gesture Sheet, Charts หรือ Form Validation แปลกๆ ขึ้นมาเองถ้ามี Lib มาตรฐานที่เสถียรกว่ารองรับ
   * Custom Code ได้เฉพาะ: ไม่มี Lib ที่เหมาะสม, Lib หนักเกิน Scope หรือ User ระบุให้ทำเอง
2. **Minimal Diff & Read Before Writing:**
   * ตรวจสอบ Entity, Locale Keys, Shared Types และ Pattern เดิมก่อนเริ่มเขียน
   * ไม่ Refactor โค้ดที่ไม่เกี่ยวข้องกับงาน ไม่สร้าง Boilerplate เกินจำเป็น
3. **No Unrequested Commits/PRs:** ห้ามสร้าง Git commit หรือ PR เองเด็ดขาด เว้นแต่ได้รับคำสั่งโดยตรง

---

## 2. Architecture & Domain Isolation (Multi-App & Shared Packages)

### 2.1 Multi-App Ecosystem & Roles
ระบบแบ่งแยกการทำงานและสิทธิ์ความปลอดภัยออกเป็น Apps และ 5 Roles หลัก:

| Application | Target Users / Roles | Stack | ขอบเขตหน้าที่ |
|---|---|---|---|
| **Marketplace Web** | `Guest` (คนหาห้อง) | Next.js 15 (SSR) | ค้นหาห้อง, แผนที่, หน้ารายละเอียด, นัดดูห้อง (SEO & Share) |
| **Consumer Mobile App** | `Guest` ➔ `Tenant` | Expo React Native | ค้นหาห้อง (GPS Native Map) ➔ สู่โหมดผู้เช่า (สัญญา/บิล/แจ้งซ่อม) |
| **Owner App / Portal** | `Owner` (เจ้าของห้อง) | Next.js / Expo | ลงประกาศห้อง (AI), ดูแลสัญญา, ติดตามค่าเช่า |
| **Agent App / Portal** | `Agent` (นายหน้า) | Next.js / Expo | สต็อก Co-broke, พาลูกค้าดูห้อง, ปิดดีลค่าคอมฯ |
| **Admin Operations** | `Assistant`, `Admin` | Web Backoffice | รับ Service Tickets, ตรวจห้อง, จัดการสัญญาและบิล |

*คำศัพท์บังคับ:* ใช้คำว่า **`Tenant`** แทน Resident ในทุกระดับ (API, DB, UI, Routes, i18n)

### 2.2 Modular Monolith & Cross-Domain Isolation
* **ห้าม Import ข้าม Domain โดยตรง:** โค้ดใน `owner` ห้าม import จาก `tenant` หรือ `agent`
* **การแชร์โค้ด:** ต้องแชร์ผ่าน `packages/*` (`@nestiq/*`) หรือ `components/shared/` เท่านั้น

### 2.3 Universal Shell & Slot Architecture (Common Header/Footer + Swappable Body)
* **Shell Components:** โครง Header, Footer, Bottom Tab Bar, และ Drawer Menu ต้องใช้โครงสร้างร่วมกัน (`ModePage` บน Mobile / `WebPageLayout` บน Web)
* **Pure Body Components:** พัฒนา Feature Content (เช่น Service Catalog, Room Details, Listing Form) ให้เป็น Body Component ที่ปราศจาก Header/Footer ภายใน เพื่อนำไปเสียบใช้งานใน Slot ของ Shell ใดก็ได้
* **Persistent Outer Shell (โครงคงที่ ห้าม Remount):**
  * โครงสร้าง Header, Footer, Bottom Tab Bar, และ Menu ด้านข้างต้อง **Static & Persistent อยู่ที่ระดับ Layout เสมอ**
  * เมื่อผู้ใช้กดเปลี่ยนเมนู/แท็บ **ห้าม Reload หรือ Remount โครงสร้าง Header/Footer เด็ดขาด** เพื่อป้องกันอาการจอกระพริบ (Zero Shell Flicker / No Layout Shift)
* **Content-Only Transitions & Smooth Animations (แอนิเมชันเปลี่ยนเฉพาะเนื้อหา):**
  * เมื่อมีการเปลี่ยนหน้า/เปลี่ยนเมนู **ให้เปลี่ยนแอนิเมชันเฉพาะตัว Body Component ภายใน Slot เท่านั้น**
  * บังคับใช้ Micro-transitions ที่ลื่นไหลระดับ 60/120fps:
    * **Mobile (Expo):** ใช้ `react-native-reanimated` (`FadeIn.duration(150)` หรือ `SlideInRight.duration(200)`)
    * **Web (Next.js):** ใช้ CSS Transitions / Framer Motion บน `children` ในขณะที่ `layout.tsx` (Header/Footer) คงสภาพนิ่ง 100%
  * **State & Scroll Preservation:** ต้องรักษาตำแหน่งการ Scroll และสถานะฟอร์มเดิมของแต่ละแท็บไว้เมื่อผู้ใช้กดสลับเมนูไปมา

### 2.4 Config-Driven UI Pattern (Owner & Agent Core Engine)
เนื่องจาก Owner และ Agent มี Workflow ลงประกาศและการจัดการคล้ายกัน:
* พัฒนา Core Engine รวมไว้ที่ `@nestiq/feature-listing`
* แต่ละ App เรียกใช้โดยการ **Inject Config** (เช่น สิทธิ์คอมมิชชั่น, ประเภทเอกสารสิทธิ์, AI Persona) เพื่อแยกพฤติกรรมตาม Role โดยไม่ต้องเขียนโค้ดซ้ำ

### 2.5 Search & Marketplace Logic Sharing (Web Next.js + Mobile Expo)
* **Web Marketplace (`apps/web`):** ต้องใช้ Next.js 15 (Server Components, SSR/ISR, Dynamic OG Images, `sitemap.ts`) เพื่อเป้าหมาย **SEO ติดหน้าแรก Google สูงสุด**
* **Consumer Mobile (`apps/consumer-app`):** ใช้ Expo 54 เพื่อ **Native Performance & Retention** รองรับพิกัด GPS สด, แผนที่ลื่นไหล, และ Push Notifications
* **Shared Logic:** พัฒนา Logic การค้นหาและการคำนวณที่ `@nestiq/feature-search` เพื่อให้ Web และ Mobile App ใช้ Query Builder และ Filters ชุดเดียวกัน 100%

### 2.6 Native-First Libraries Stack (Mobile Performance Rule)
บังคับใช้ Native Libraries เพื่อประสิทธิภาพระดับ 60/120fps บน iOS/Android โดยใช้ `*.web.tsx` เป็น Fallback สำหรับ Web:
* Lists: `@shopify/flash-list`
* Animation/Gestures: `react-native-reanimated` + `react-native-gesture-handler`
* Bottom Sheet: `@gorhom/bottom-sheet`
* Images/Caching: `expo-image`
* Lightbox Zoom: `react-native-zoom-toolkit`
* Maps: `react-native-maps` (Web ใช้ `@vis.gl/react-google-maps`)
* Fast Storage: `react-native-mmkv`
* Calendars: `react-native-calendars` (`AppDateField`)

---

## 3. UI & Styling Standards (Modern FinTech & PropTech)

### 3.1 Native-First UI & Dual-Platform Support (iOS + Android)
* **iOS & Android First:** ออกแบบและทดสอบ Layout ให้แสดงผลถูกต้องและสวยงามบนทั้ง **iOS (HIG) และ Android (Material)** ก่อนเสมอ โดย Expo Web เป็น Secondary
* **Cross-Platform Shadows:** ห้ามใช้ `boxShadow` โดยตรง ให้ใช้ `getCardElevation()` (iOS: `shadowOffset/Radius/Color`, Android: `elevation`)
* **Safe Area & Hardware Insets:** บังคับใช้ `useSafeAreaInsets` ในทุก Shell/Screen ป้องกันการชน Dynamic Island, Notch, หรือ Android Gesture/Status Bar
* **Android Back Handling:** ทุก Modal, Actionsheet, และ Bottom Sheet ต้องดัก `BackHandler` ของ Android เพื่อให้กด Back บนเครื่องแล้วปิด Overlay ได้อย่างถูกต้อง
* **Touch Feedback:** ปุ่มกดต้องรองรับ `android_ripple` สำหรับ Android และ `activeOpacity` สำหรับ iOS
* **Layout Constraints:** ห้ามใช้ Web-only CSS properties เช่น `cursor`, `boxShadow` นอก `*.web.tsx` และห้ามใช้ `width: '%'` ร่วมกับ `flexWrap` บน Native
* **Thai Typography Safety:** ฟอนต์ภาษาไทยต้องกำหนด `lineHeight` ให้สูงกว่า `fontSize` อย่างน้อย 1.45–1.5 เท่าเสมอ เพื่อป้องกันสระบน-ล่างลอยหรือถูกตัดขอบบนอุปกรณ์จริง

### 3.2 Corporate Color Palette & UI Tokens (CI Brand System)

ระบบสีอัตลักษณ์ของแบรนด์ (Corporate Identity) และสถานะการทำงาน (Semantic Tokens):

| หมวดหมู่ | Token | Hex Code | คำอธิบาย / การนำไปใช้ |
|---|---|---|---|
| **Primary (สีหลักอัตลักษณ์)** | `primaryDark` / `ink` | **`#211E1E`** | สีดำเอกลักษณ์หลัก / ตัวหนังสือบนปุ่มแบรนด์ / Contrast สำคัญ |
| | `primaryBrand` | **`#F8B615`** | สีเหลืองหลักของแบรนด์ (CTA / Hero Banner / Highlight) |
| | `primaryWhite` | **`#FFFFFF`** | สีขาวพื้นหลังการ์ด / พื้นผิวส่วนหน้า |
| **Secondary & Surfaces** | `background` | **`#F8FAFC`** | Background พื้นหลังหน้าจอของทุกแอป |
| | `cardBorder` / `border` | **`#E5E7EB`** | ขอบการ์ด / ขอบกล่อง Input ทั่วไป |
| | `divider` | **`#CBD5E1`** | เส้นคั่นแบ่งสัดส่วนเนื้อหา (Divider) |
| | `secondaryText` | **`#64748B`** | ข้อความรอง / รายละเอียดย่อย / Subtitle |
| | `headingText` | **`#334155`** | หัวข้อหลัก (Heading) / Title สำคัญ |
| **Accent & Semantic** | `accent` / `info` | **`#2563EB`** | ข้อมูลแนะนำ / ลิงก์ระบบ / Primary Accent |
| | `error` / `danger` | **`#DC2626`** | ข้อผิดพลาด / บิลค้างชำระ / แจ้งเตือนสีแดง |
| | `warning` | **`#F59E0B`** | รอตรวจสอบ / สัญญากำลังหมดอายุ / แจ้งเตือนสีส้ม |
| | `success` | **`#22C55E`** | ทำรายการสำเร็จ / ชำระเงินแล้ว / อนุมัติ |

### 3.3 Basic UI Component Styles & States

1. **Primary Button (ปุ่มหลักพื้นทึบ):**
   * `Default`: Background `#F8B615` | Text `#211E1E` (Bold)
   * `Hover`: Background `#FCD34D` (โปร่ง/สว่างขึ้น 80%)
   * `Pressed`: Background `#EAB308` (เหลืองเข้มเพื่อตอบสนองการกด)
   * `Disabled`: Background `#FEF3C7` (เหลืองจาง) | Text `#D1D5DB`
2. **Secondary Button (ปุ่มรองแบบ Outline):**
   * `Default`: Background `#FFFFFF` | Border `#F8B615` | Text `#211E1E`
   * `Hover`: Background `#FFFBEB` | Border `#F8B615`
   * `Pressed`: Background `#FEF3C7` | Border `#EAB308`
   * `Disabled`: Background `#FFFFFF` | Border `#F3F4F6` | Text `#E5E7EB`
3. **Input Field (กล่องกรอกข้อความ):**
   * `Default`: Border `#E5E7EB` | Background `#FFFFFF` | Placeholder `#94A3B8`
   * `Focus`: Border `#F8B615` (สีเหลืองแบรนด์)
   * `Error`: Border `#DC2626` (สีแดง) พร้อมข้อความแจ้งเตือนสีแดง `#DC2626` ("This field is required.")

### 3.4 Icon Style & Color Guidelines

* **รูปแบบไอคอน (Iconography):** สไตล์ Line / Outline สม่ำเสมอ (Stroke ~1.5px ถึง 2px)
* **ชุดไอคอนมาตรฐาน:** `Home`, `Search`, `Filter`, `User`, `Download`, `Notification`, `Location`, `Setting`
* **ชุดสีไอคอนที่อนุญาต (Icon Colors):**
  1. `#211E1E` — ไอคอนบนพื้นสว่าง / สถานะ Active
  2. `#64748B` — ไอคอนสถานะรอง / Inactive
  3. `#F8B615` — ไอคอนไฮไลท์ / Selected Item
  4. `#CBD5E1` — ไอคอนสีจาง / Disabled
  5. `#FFFFFF` — ไอคอนบนพื้นหลังสีเข้ม (Dark Containers)

### 3.5 Typography Stack (CI Font Guidelines)

โปรเจกต์โหลดฟอนต์ผ่าน `@expo-google-fonts/*` ใน Mobile และ Next.js Google Fonts ใน Web:

| บทบาทข้อความ | ภาษาไทย (TH) / ภาษาอื่น | ภาษาอังกฤษ (EN) | ฟอนต์ Weight |
|---|---|---|---|
| **Headlines / Titles (`ci.heading`)** | **Mitr** | **Baloo 2** | Medium (`500Medium`) / Regular (`400Regular`) |
| **Body / Captions (`ci.body`)** | **Noto Sans Thai** | **Noto Sans Thai** | Regular (`400Regular`) / Bold (`700Bold`) |

* **Typography Safety:** ภาษาไทยต้องกำหนด `lineHeight` ให้มีสัดส่วน 1.45–1.5 เท่าของ `fontSize` เสมอ เพื่อป้องกันปัญหาสระบน-ล่างลอยหรือถูกตัดขอบ

### 3.6 Multi-App Role Palettes (โทนสีประจำแอปและบทบาท)
* UI มาตรฐานให้ใช้ **gluestack-ui** หรือ Wrapper กลาง (`AppButton`, `AppInput`, `AppSelect`, `AppDateField`, `AppListRow`, `AppChipTabs`)
* คุมโทนสีประจำ Role & Services อย่างเคร่งครัด (Colour system v1.1 ตาม CI, 12 พ.ย. 2026 · ที่มาของค่า: `tokens.colors.roles` / `tokens.colors.rolesOnDark` ใน `packages/ui/src/theme/tokens.ts` และ `packages/config/theme/colors.json` · ไม่ใช้ gradient):
  | Role | สีหลัก (พื้นทึบ / light mode) | สีตัวอักษร-ไอคอนใน dark mode |
  |---|---|---|
  | 🟡 Guest / Marketplace | Brand Yellow `#F8B615` (ตัวอักษรบนพื้นนี้ใช้ ink `#211E1E`) | `#F8B615` |
  | ⚫ Agent (นายหน้า) | Brand Ink `#211E1E` คู่กับเหลือง `#F8B615` | `#F8B615` |
  | 🟢 Tenant (ผู้เช่า) | Success 800 `#166534` | `#4ADE80` |
  | 🔵 Landlord (เจ้าของห้อง) | Info 800 `#1E3A8A` | `#93C5FD` |
  | 🟤 Self Owner | Warning 800 `#92400E` | `#FDBA74` |
  | ⚫ Admin | Slate 700 `#334155` | `#CBD5E1` |
  | ⚫ Services Hub | Slate 600 `#475569` | `#94A3B8` |
  * พื้นทึบสี role (hero card, badge solid) ใช้สีหลักกับตัวอักษรขาว (guest ใช้ตัวอักษร ink) ทั้ง light และ dark mode
  * ตัวอักษร ไอคอน spinner และเส้นขอบที่แสดงสถานะเลือก ในสี role ต้องผ่าน `roleOnDark(color, isDark)` เสมอ ห้ามใช้ `tokens.colors.roles.*` ตรง ๆ (เทสกันไว้ใน `apps/consumer-app/components/role-colors-dark.test.cjs`)
  * สวิตช์เปิด/ปิด: ink `#211E1E` เมื่อเปิด (dark mode ใช้เหลือง `#F8B615`) ไม่ใช้สีของ role
  * ไม่มี role `owner` แล้ว ใช้ `landlord` หรือ `self_owner`
  * รูปโปรไฟล์ตัวย่อของคนอื่น (lead, ผู้เช่า, เจ้าของ) ใช้สีเดียวกันทุกคน `tokens.colors.avatar` (สว่าง `#E2E8F0` / `#334155` · มืด `#4A4545` / `#E7E5E4`) ห้ามใช้สีตาม status, role หรือแบรนด์ · รูปของผู้ใช้ที่ login อยู่ใช้ดำ ตัวเหลือง (มืด `#4A4545`) (เทส `apps/consumer-app/components/lead-avatar-tone.test.cjs`)
  * ป้าย "Coming soon" ในแอปใช้ `MobileComingSoonTag` (พื้นจางตามโหมด ตัวปกติ 11px) ไม่ใช้ `MobileStatusPill`
  * v1.2 (12 พ.ย. 2026): ป้ายสถานะพื้นขั้น 100 ไม่มีขอบ โหมดมืดผ่าน `pillToneFor` · เมนูที่เลือก กล่องโหมด กรอบไอคอนการ์ด และรูปของผู้ใช้เป็นดำกับเหลือง (มืด `#4A4545`) · รายละเอียดใน `.cursorrules` §3.2.1

---

## 4. Backend & Cloud Infrastructure Standards (Supabase + NestJS)

ระบบใช้ **Supabase** เป็น Core Cloud Backend & Database Infrastructure หลักของทุกแอปพลิเคชัน:

### 4.1 Supabase Core Infrastructure (บังคับ 100%)
* **Database (PostgreSQL via Supabase Pooler):**
  * เชื่อมต่อผ่าน Supabase Connection Pooler (`DATABASE_URL` ใน `apps/api`)
  * จัดการ Schema ด้วย TypeORM Entities + Migrations (ห้าม `DB_SYNC=true` บน Production)
* **Authentication & Single Sign-On (SSO):**
  * ใช้ **Supabase Auth** จัดการผู้ใช้ทั้งหมด (Email/Password, Google OAuth, OTP)
  * Sync ข้อมูลเข้าตาราง `users` (`supabase_user_id`) ผ่าน NestJS `SupabaseAuthGuard`
  * รองรับ SSO ข้ามแอปด้วย Supabase Session / Cookie Domain Sharing
* **Storage (Supabase S3 Buckets):**
  * เก็บรูปภาพห้องพัก, โฉนด, เอกสารสัญญาเช่าดิจิทัล, และรูปหลักฐานการซ่อม/ตรวจห้อง
  * ทำ Public CDN สำหรับรูปภาพประกาศห้อง และ Private Signed URL สำหรับเอกสารสัญญา
* **Realtime Engine (Supabase Realtime):**
  * ใช้แจ้งเตือนสถานะ Service Tickets (ช่าง/แม่บ้าน), การตอบรับนัดดูห้อง, และแจ้งเตือนบิลค่าเช่าทันที

### 4.2 Backend Architecture (`apps/api`)
* **Pattern:** Controller ➔ Service ➔ Repository / TypeORM
* **Access Control:** ตรวจสอบสิทธิ์และบทบาทผ่านตาราง `user_roles` (`guest`, `tenant`, `owner`, `agent`, `assistant`, `admin`)
* **Master Catalog Localization (ห้ามเพิ่ม Column ภาษา):**
  * Master Catalog แบบค่าคงที่เก็บเฉพาะ `code` ใน DB (ห้ามมี `name_th`, `name_en` ในตาราง)
  * Client ดึงข้อความแสดงผลผ่าน i18n key: `masters.<domain>.<code>`
* **Transactions:** งานที่กระทบหลายตาราง (เช่น ลงประกาศห้อง + รูป + สิ่งอำนวยความสะดวก) บังคับใช้ `DataSource.transaction`

---

## 5. i18n Localization Standards

* เพิ่ม Translation Key ให้ครบทุกภาษาเสมอ: `th.ts`, `en.ts`, `zh.ts`, `ja.ts` และ `types.ts`
* แยก Prefix ตาม Domain/Role ให้ชัดเจน เช่น `tenant.*`, `owner.*`, `agent.*`, `services.*`
