# Multi-App Architecture & Role Specification — NESTIQ (NESTYK)

> **สถานะ:** Architecture Blueprint & Modular Monolith Target  
> **เป้าหมาย:** สถาปัตยกรรม Cross-Platform Marketplace (Web + Mobile App), Universal Shell & Slot Architecture, Consumer Journey (Guest ➔ Tenant), Landlord & Pro Apps (Owner / Agent / Admin) ด้วย Config Injection, โทนสี Modern FinTech & PropTech, และระบบบริการส่วนกลาง (Services Hub)

---

## 1. ภาพรวมสถาปัตยกรรม (System Architecture Overview)

ระบบออกแบบตามหลักการ **Modular Monolith (พร้อมแยก App ได้ตลอดเวลา)** รองรับการทำงานแบบ **Cross-Platform Marketplace (มีทั้ง Web และ Mobile App)** เพื่อตอบโจทย์ SEO ความเร็ว และ Native Experience สูงสุด โดยเชื่อมต่อกับ **Unified Backend API**:

```


┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Unified Backend (apps/api)                                │
│                         NestJS + PostgreSQL (Supabase) + TypeORM                       │
│    [Auth Module]  │  [Listings Module]  │  [Services Module]  │  [Billing & Contracts] │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
         ┌──────────────────────────────────┼──────────────────────────────────┐
         │                                  │                                  │
         ▼                                  ▼                                  ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐ ┌──────────────────────────────┐
│ 1. Marketplace Web (Guest)   │ │ 2. Consumer Mobile App       │ │ 3. Landlord & Pro Apps       │
│    (Discovery & SEO Portal)  │ │    (Guest ➔ Tenant Hub)      │ │    (Owner / Agent / Admin)   │
├──────────────────────────────┤ ├──────────────────────────────┤ ├──────────────────────────────┤
│ 🌐 Stack: Next.js 15 (SSR)    │ │ 📱 Stack: Expo React Native  │ │ 💻 Stack: Web / Expo Mobile  │
│ 🎯 Domain: nestiq.com        │ │ 🎯 Target: iOS & Android     │ │ 🎯 Target: แยก App หรือ Portal│
│ 🎯 จุดเด่น:                  │ │ 🎯 จุดเด่น:                  │ │ 🎯 จุดเด่น:                  │
│ • SEO & Social Share สูงสุด  │ • GPS Native Map รอบตัว       │ • ลงประกาศห้อง + AI Copy/Photo │
│ • ค้นหาห้อง / ตัวกรองเร็ว    │ • ค้นหาห้อง + เซฟ Wishlist     │ • สต็อก Co-Broke สำหรับ Agent   │
│ • ส่งคำขอนัดดูห้อง           │ • ปลดล็อกโหมด Tenant เมื่อเช่า  │ • จัดการสัญญา / บิล / ตรวจห้อง │
│ • Smart Banner ลิงก์เข้า App │ • สัญญาดิจิทัล, บิล, แจ้งซ่อม  │ • ศูนย์รับ Ticket งานบริการ    │
└──────────────────────────────┘ └──────────────────────────────┘ └──────────────────────────────┘
                                            │
                                            ▼
                      ┌───────────────────────────────────────────┐
                      │           Shared Core Packages            │
                      ├───────────────────────────────────────────┤
                      │ • @nestiq/feature-listing (Config-Driven) │
                      │ • @nestiq/feature-search (Query/Filters)  │
                      │ • @nestiq/feature-services (Services Hub) │
                      │ • @nestiq/api-client (Typed API SDK)      │
                      │ • @nestiq/ui (Tokens & Shell Components)  │
                      │ • @nestiq/i18n (th, en, zh, ja)           │
                      └───────────────────────────────────────────┘
```

---

## 2. Universal Shell & Slot Architecture (Common Header/Footer + Swappable Body)

เพื่อรักษาความสม่ำเสมอของ UI ทุกแอป และลดการเขียนโค้ดซ้ำซ้อน ระบบใช้หลักการ **Shell & Slot Pattern**:
- **Outer Shell (Header, Footer, Bottom Tab Bar, Drawer Nav):** ใช้ Component กลางร่วมกัน เปลี่ยนแปลงเฉพาะสี Accent และเมนูตาม Role
- **Inner Slot (`children` / Body):** พัฒนาเป็น **Pure Body Component** เพื่อให้สลับนำไปเสียบใช้งานบน Mobile Shell (`ModePage`) หรือ Web Shell (`WebPageLayout`) ได้ทันที

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 APP CONTAINER / ROUTER                                 │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
         ┌──────────────────────────────────┴──────────────────────────────────┐
         ▼                                                                     ▼
┌─────────────────────────────────────────┐           ┌─────────────────────────────────────────┐
│     📱 Mobile Shell (ModePage)          │           │       🌐 Web Shell (WebPageLayout)      │
│  (iOS, Android, Mobile Web Screen)      │           │     (Desktop Browser, Tablet View)      │
├─────────────────────────────────────────┤           ├─────────────────────────────────────────┤
│ [Common Mode Hero Header]               │           │ [Common Web Header / Brand Nav]         │
│ - Mode Color Accent (🟡/🟣/🔵/🟢/🔷)    │           │ - Logo, Role Switcher, Profile Menu     │
│ - Side Menu / Back Button               │           ├─────────────────────────────────────────┤
├─────────────────────────────────────────┤           │ ┌───────────────┬─────────────────────┐ │
│                                         │           │ │ Sidebar Nav   │ [ BODY SLOT ]       │ │
│   [ BODY SLOT / children ]              │           │ │ (ตาม Role)    │                     │ │
│   ◀── ยืม Component Body ชุดเดียวกันมาวาง │           │ │               │ ยืม Component Body   │ │
│                                         │           │ │               │ ชุดเดียวกันมาวาง     │ │
├─────────────────────────────────────────┤           │ └───────────────┴─────────────────────┘ │
│ [Common Bottom Tab Bar / Sticky Footer] │           ├─────────────────────────────────────────┤
│ - แท็บเปลี่ยนตาม Role (Home/Services/..)│           │ [Common Web Footer]                     │
└─────────────────────────────────────────┘           └─────────────────────────────────────────┘
```

### 2.1 ตัวอย่าง: Pure Body Component ที่ใช้ร่วมกันข้ามแพลตฟอร์ม
* `ServiceCatalogBody` ➔ วางใน `ModePage` (Mobile) หรือ `WebPageLayout` (Web)
* `RoomDetailBody` ➔ วางในหน้ารายละเอียดห้องของทั้ง Web และ Mobile
* `CreateListingWizardBody` ➔ วางในหน้าสร้างประกาศของ Owner และ Agent

### 2.2 Persistent Shell & Content-Only Transition Animation (แอนิเมชันเปลี่ยนเฉพาะเนื้อหา)

เพื่อสร้างประสบการณ์ระดับ Native ที่ลื่นไหลและไร้รอยต่อ (Zero Layout Shift & No Shell Flicker):

```
┌────────────────────────────────────────────────────────┐
│  [ PERSISTENT HEADER ] (คงที่ 100% · ไม่กะพริบ · ไม่ Remount) │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │                                                  │  │
│  │   [ CONTENT BODY SLOT ]                          │  │
│  │   ✨ เปลี่ยนเฉพาะเนื้อหาตรงนี้ด้วยแอนิเมชัน              │  │
│  │   - FadeIn / Cross-Fade (150ms)                  │  │
│  │   - Subtle Slide-Up / Ease-out (200ms)           │  │
│  │                                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
├────────────────────────────────────────────────────────┤
│  [ PERSISTENT BOTTOM TAB BAR ] (คงที่ 100% · ไม่ขยับ)    │
└────────────────────────────────────────────────────────┘
```

1. **Persistent Outer Shell (Header, Navigation, Tab Bar, Footer):**
   * ถูก Render และ Mount อยู่ที่ Root Layout ของแต่ละ App/Role เสมอ
   * เมื่อผู้ใช้กดเปลี่ยนเมนู นำทางระหว่างหน้า หรือสลับแท็บ **โครง Header และ Footer จะต้องไม่ Remount หรือ Re-render ใหม่**
2. **Content-Only Micro-Transitions (เฉพาะ Body Slot):**
   * เมื่อ Route มีการเปลี่ยนแปลง ให้แสดง Animation เฉพาะภายใน Body Slot เท่านั้น
   * **Mobile (Expo React Native):** ใช้ `react-native-reanimated` (`FadeIn.duration(150)` หรือ `SlideInRight.duration(200)`)
   * **Web (Next.js 15):** ใช้ Layout Architecture (`layout.tsx`) คงสภาพ Header/Sidebar ไว้ แล้วทำ Transition บน `page.tsx` (`children`) ด้วย CSS / Framer Motion
3. **State & Scroll Preservation (คงสถานะเดิม):**
   * ระบบต้องบันทึก Scroll Position และ Form State เดิมของแต่ละแท็บไว้ ไม่โหลดข้อมูลใหม่ซ้ำซ้อนเมื่อผู้ใช้สลับเมนูไปมา

---

## 3. ระบบโทนสีประจำบทบาท (Brand Identity & Modern High-Vibrancy Palette)

การคุมโทนสีช่วยให้ผู้ใช้งานแยกแยะบริบทและบทบาทการทำงานได้อย่างชัดเจน โดยผสมผสานสีแบรนด์เดิม (`#F8B615`) ร่วมกับ 3 สีหลักใหม่ (`#00C68D`, `#0055DA`, `#FF0052`) และโทนควบคุมสำหรับ Admin (`#0F172A`):

### 3.1 ตารางสีประจำบทบาท (Role Color Matrix)

| บทบาท (Role / Context) | สีหลัก (Solid Color) | รหัสสี (Hex) | Gradient ประจำโหมด | ความหมาย & ความรู้สึกใน UI |
|---|---|---|---|---|
| 🟡 **Marketplace / Guest** | **Warm Yellow** | `#F8B615` | Solid `#F8B615` / Ink Shadow | แบรนด์หลัก NESTIQ, ความสดใส, จุดเริ่มต้นการหาห้อง |
| 🟢 **Tenant (ผู้เช่า)** | **Neo Mint** | `#00C68D` | `#00C68D` ➔ `#0055DA` | ความสดชื่น น่าอยู่ ปลอดภัย สบายใจในการอยู่อาศัย |
| 🔵 **Owner (เจ้าของห้อง)** | **Electric Blue** | `#0055DA` | `#0055DA` ➔ `#00C68D` | ความมั่นคง การเงิน ทรัพย์สิน ความเป็นมืออาชีพ |
| 🔴 **Agent (นายหน้า)** | **Neon Rose** | `#FF0052` | `#FF0052` ➔ `#F8B615` | พลังขับเคลื่อน การเติบโต ยอดขาย และค่าคอมมิชชั่น |
| ⚫ **Assistant & Admin** | **Deep Slate** | `#0F172A` | `#0F172A` ➔ `#1E293B` | ศูนย์ควบคุม ความเป็นกลาง ความแม่นยำ สบายตา |
| 🔷 **Services Hub** | **Sky Blue** | `#0284C7` | `#00C68D` ➔ `#0055DA` | งานบริการ งานช่าง แม่บ้าน นัดหมายช่วยเหลือ |

### 3.2 สูตรการไล่สีในระบบ (Gradient Recipes)
1. **Fresh Living (Tenant):** `linear-gradient(135deg, #00C68D 0%, #0099E6 50%, #0055DA 100%)` — แถบสถานะห้องเช่า, ชำระบิลสำเร็จ
2. **Pro Management (Owner):** `linear-gradient(135deg, #0055DA 0%, #0099E6 50%, #00C68D 100%)` — แดชบอร์ดห้องพัก, ฟอร์มลงประกาศ, ป้าย AI
3. **High-Energy Sales (Agent):** `linear-gradient(135deg, #FF0052 0%, #FF5A36 50%, #F8B615 100%)` — สต็อก Co-Broke, ดีลพิเศษ, ค่าคอมมิชชั่น
4. **Operations Hub (Admin):** `linear-gradient(135deg, #0F172A 0%, #1E293B 100%)` — Backoffice Header, Control Drawer, Audit Logs

---

## 4. การทำงานของ Marketplace: Web vs Mobile App (Hybrid Marketplace Model)

Marketplace แบ่งบทบาทระหว่าง Next.js (SEO & Web) และ Expo (Native Performance) อย่างชัดเจน:

### 4.1 Comparison & Synergy Matrix

| มิติ | 🌐 Marketplace Web (`apps/web`) | 📱 Consumer Mobile App (`apps/consumer-app`) |
|---|---|---|
| **Core Engine** | **Next.js 15 (App Router / SSR / ISR)** | **Expo 54 (React Native 0.81 + New Architecture)** |
| **บทบาทหลัก** | **SEO, Google Search, Organic Acquisition** | **Native Performance, Retention, Living Hub** |
| **เทคนิคเด่น** | • Dynamic OpenGraph Image สำหรับแชร์โซเชียล<br>• Server Components ดึงข้อมูลห้องเสร็จก่อนส่ง HTML<br>• `sitemap.ts` สำหรับห้องนับพันยูนิตอัตโนมัติ | • 60/120fps Native UI Thread Animations<br>• GPS Real-Time Nearby Rooms Map<br>• Push Notifications แจ้งเตือนบิลและเคสนัด |
| **Customer Journey** | เข้าดูห้อง ➔ กดนัดดูห้อง หรือกดโหลดแอปผ่าน Smart Banner | ค้นหาห้อง (Guest Mode) ➔ ปลดล็อกเป็น Tenant เมื่อเริ่มสัญญาเช่า |

```
┌─────────────────────────────────────────────────────────┐
│              Marketplace Web (Next.js 15)               │
│                 Domain: nestiq.com                      │
├─────────────────────────────────────────────────────────┤
│ • โฟกัส: SEO Google Indexing, Social Sharing (OG Image) │
│ • Server-Side Rendering (SSR) โหลดหน้าแรกและห้องไวมาก    │
│ • ค้นหาตามทำเล, สถานี BTS/MRT, ช่วงราคา                 │
│ • มีปุ่ม "นัดดูห้อง (Schedule a Viewing)" เพื่อเก็บ Lead │
│ • แสดง Smart App Banner ชวนเปิดดูใน Native Mobile App   │
└────────────────────────────┬────────────────────────────┘
                             │ Universal Link / Deep Link
                             ▼
┌─────────────────────────────────────────────────────────┐
│           Consumer Mobile App (Expo Native)             │
│                 iOS & Android Application               │
├─────────────────────────────────────────────────────────┤
│ 🔍 [Phase 1: Guest Mode - ก่อนเช่าห้อง]                 │
│ • ค้นหาห้องบน Native Map (พิกัด GPS รอบตัวลื่นไหล)      │
│ • บันทึกห้องโปรด (Wishlist) & การแจ้งเตือนห้องมาใหม่    │
│ • ส่งคำขอนัดดูห้อง และติดตามสถานะเวลานัดหมาย            │
│                            │                            │
│                            │ เมื่อเซ็นสัญญาเช่าสำเร็จ   │
│                            ▼                            │
│ 🏠 [Phase 2: Tenant Mode - เมื่อเป็นผู้เช่าแล้ว]         │
│ • ปลดล็อกแท็บ "ห้องเช่าของฉัน (My Rental)" อัตโนมัติ     │
│ • ตรวจสอบสัญญาเช่าดิจิทัล และเซ็นสัญญาออนไลน์           │
│ • รับการแจ้งเตือนบิลค่าเช่า/ค่าน้ำไฟ และจ่ายเงินผ่าน QR │
│ • เรียกบริการ Services (แม่บ้าน, ช่างซ่อมแอร์/ประปา)     │
└─────────────────────────────────────────────────────────┘
```

### 4.2 มาตรฐาน Mobile Native Libraries เพื่อประสิทธิภาพสูงสุด

เพื่อรับประกันประสิทธิภาพระดับ Native บน iOS และ Android บังคับใช้ Libs มาตรฐานเหล่านี้ และใช้ `*.web.tsx` เป็น Fallback สำหรับ Web:

1. **รายการข้อมูลขนาดใหญ่ (High-Performance Lists):** `@shopify/flash-list` (แทน FlatList)
2. **แอนิเมชันและ Gesture:** `react-native-reanimated` + `react-native-gesture-handler` (UI Thread 100%)
3. **แผ่นสไลด์ล่าง (Bottom Sheet):** `@gorhom/bottom-sheet` (Gesture-driven)
4. **รูปภาพประสิทธิภาพสูง:** `expo-image` (Hardware decoding + Cache + Blurhash)
5. **การซูมดูภาพห้อง (Lightbox):** `react-native-zoom-toolkit` (Native Gesture Pinch-to-zoom)
6. **แผนที่ระบุพิกัด:** `react-native-maps` (Apple Maps / Google Maps Native) ➔ Web ใช้ `@vis.gl/react-google-maps`
7. **ปฏิทินและเลือกวัน:** `react-native-calendars` (`AppDateField`)
8. **แคชความเร็วสูง:** `react-native-mmkv` (C++ Engine) ➔ Web ใช้ `localStorage`

### 4.3 มาตรฐานการออกแบบรองรับทั้ง iOS และ Android (Dual-Platform Native Design Guidelines)

เพื่อให้ประสบการณ์การใช้งานบน **iOS (Human Interface Guidelines)** และ **Android (Material Design)** ลื่นไหลและเป็นธรรมชาติ:

| มิติการทำงาน | 🍎 iOS Standards | 🤖 Android Standards | โค้ดกลางที่รองรับ |
|---|---|---|---|
| **การย้อนกลับ (Navigation)** | Swipe-to-back จากขอบจอซ้าย | Hardware/Gesture Back Button | `expo-router` Stack + `BackHandler` สำหรับปิด Modal/Sheet |
| **เงาและมิติ (Card Shadows)** | `shadowColor`, `shadowOffset`, `shadowRadius` | `elevation: 2–6` | Helper `getCardElevation(level)` ใน `@nestiq/ui` |
| **สัมผัสปุ่ม (Touch Feedback)** | ลดความทึบแสง (`activeOpacity: 0.7`) | ลายน้ำกระจาย (`android_ripple`) | `AppButton`, `AppListRow` แยกตาม `Platform.OS` |
| **Safe Area & ขอบจอ** | Dynamic Island, Notch, Home Bar ล่าง | Status Bar, Punch-hole, 3-Button/Gesture Bar | บังคับ `useSafeAreaInsets` ใน `ModePage` Shell |
| **คีย์บอร์ดบังฟอร์ม** | `behavior="padding"` | `windowSoftInputMode="adjustResize"` | `KeyboardAwareScrollView` / `KeyboardController` |
| **การแสดงผลฟอนต์ภาษาไทย** | สุขุมวิท / Inter / San Francisco | Prompt / Roboto | ตั้งค่า `lineHeight` อย่างน้อย 1.45–1.5x กันสระลอย/ตกขอบ |

---

## 5. โมเดลการแชร์ UI: Config-Driven Architecture (สำหรับ Owner & Agent)

เนื่องจาก **Owner (เจ้าของห้อง)** และ **Agent (นายหน้า/ตัวแทน)** มี Workflow การทำงานหลักคล้ายกันมาก (ลงประกาศห้อง, AI Copywriting, แต่งภาพ AI, จัดการสต็อก, ดูแลสัญญา) แต่มีความจำเป็นต้อง **แยก App หรือแยกสิทธิ์เพื่อความปลอดภัยและ Business Segment**:

ระบบจึงใช้การสร้าง **Core Feature Package (`@nestiq/feature-listing`)** ที่แชร์ UI / Logic เดียวกัน แต่ให้แต่ละ App ส่ง **Config** เข้าไปกำหนดพฤติกรรม:

```
                          ┌──────────────────────────────────────┐
                          │     @nestiq/feature-listing          │
                          │   (Core Wizard + AI + UI Engine)     │
                          └──────────────────┬───────────────────┘
                                             │
                      Inject Config & Props  │
                     ┌───────────────────────┴───────────────────────┐
                     ▼                                               ▼
     ┌──────────────────────────────┐                ┌──────────────────────────────┐
     │       Owner Application      │                │       Agent Application      │
     │   (เจ้าของห้องปล่อยเช่าเอง)   │                │   (นายหน้ารับฝาก/Co-broker)  │
     ├──────────────────────────────┤                ├──────────────────────────────┤
     │ config = {                   │                │ config = {                   │
     │   actorRole: 'owner',        │                │   actorRole: 'agent',        │
     │   themeTone: 'owner',        │                │   themeTone: 'agent',        │
     │   features: {                │                │   features: {                │
     │     enableCommission: false, │                │     enableCommission: true,  │
     │     docType: 'title_deed',   │                │     docType: 'power_of_att', │
     │     aiPersona: 'direct_owner'│                │     aiPersona: 'broker_pro'  │
     │   }                          │                │   }                          │
     │ }                            │                │ }                            │
     └──────────────────────────────┘                └──────────────────────────────┘
```

---

## 6. บทบาทและหน้าที่ของผู้ใช้งานแต่ละกลุ่ม (Role & Permission Matrix)

ระบบแบ่งผู้ใช้ออกเป็น **5 บทบาทหลัก (5 Roles)**:

### 1. 🔍 Guest (ผู้ค้นหาห้องพัก / บุคคลทั่วไป)
* **แอปพลิเคชันหลัก:** `Marketplace Web (nestiq.com)` + `Consumer Mobile App`
* **เป้าหมาย:** ค้นหาห้องเช่า เปรียบเทียบราคา และส่งคำขอนัดดูห้อง
* **ฟังก์ชันการทำงาน:**
  1. ค้นหาห้องพักด้วยตัวกรองละเอียด (ทำเล, สถานี BTS/MRT, ช่วงราคา, ประเภทห้อง)
  2. ดูห้องบน Interactive Map และดูภาพ/วิดีโอ/สิ่งอำนวยความสะดวก
  3. บันทึกห้องที่ชอบลง Wishlist
  4. **กดปุ่ม "นัดดูห้อง (Schedule a Viewing)":** เลือกวัน-เวลาที่ต้องการเข้าชม เพื่อส่งคำขอเข้าสู่ระบบ Service

---

### 2. 🏠 Tenant (ผู้เช่า / คู่สัญญา)
* **แอปพลิเคชันหลัก:** `Consumer Mobile App (iOS / Android)`
* **เป้าหมาย:** จัดการทุกเรื่องเกี่ยวกับการอยู่อาศัยในห้องเช่าและสัญญา
* **ฟังก์ชันการทำงาน:**
  1. **สัญญาเช่าดิจิทัล (Digital Contract):** ตรวจสอบรายละเอียดสัญญาและลงนาม (Sign) ออนไลน์
  2. **การชำระเงิน (Payments & Billing):** รับการแจ้งเตือนบิลค่าเช่า, ค่าน้ำ, ค่าไฟ และชำระผ่าน QR PromptPay / บัตรเครดิต
  3. **ศูนย์บริการลูกบ้าน (Tenant Services):**
     * สั่งบริการทำความสะอาดห้องพัก (Cleaning Service)
     * แจ้งซ่อมบำรุงพร้อมแนบรูปภาพ/วิดีโอ (Maintenance: แอร์, ประปา, ไฟฟ้า)
     * นัดหมายตรวจสภาพห้องก่อนย้ายออก (Move-out Inspection)
  4. **การแจ้งเตือนและติดต่อ:** รับประกาศข่าวสารจากคอนโด/เจ้าของห้อง และส่ง Ticket แจ้งปัญหา

---

### 3. 🔑 Owner (เจ้าของห้อง / ผู้ปล่อยเช่า)
* **แอปพลิเคชันหลัก:** `Owner App / Portal`
* **เป้าหมาย:** บริหารจัดการทรัพย์สินของตนเอง, สร้างผลตอบแทน และดูแลสัญญาเช่า
* **ฟังก์ชันการทำงาน:**
  1. **สร้างและแก้ไขประกาศ (Listing Wizard - Owner Mode):**
     * ลงข้อมูลห้อง (ขนาด, ชั้น, ค่าเช่าตามระยะสัญญา)
     * **AI Copywriting (Gemini):** สำนวนเจ้าของปล่อยเช่าเอง (`direct_owner`)
     * **AI Photo Enhancement (Claid):** ปรับแสงและสีรูปภาพห้องอัตโนมัติ
  2. **จัดการสัญญาและผู้เช่า:** ตรวจสอบประวัติผู้เช่า, อนุมัติสัญญาเช่า, และดูสถานะการจ่ายเงิน
  3. **บริการสำหรับเจ้าของห้อง (Owner Services):**
     * สั่งบริการ Deep Clean ก่อนส่งมอบห้องให้ผู้เช่าใหม่
     * สั่งบริการช่างตรวจเช็กห้อง / รีโนเวทก่อนปล่อยเช่า
  4. **การเปิดรับ Co-Agent:** กำหนดส่วนแบ่งคอมมิชชั่นเพื่อให้นายหน้า (Agent) นำห้องไปช่วยโปรโมท

---

### 4. 🤝 Agent (นายหน้า / ตัวแทนอสังหาฯ)
* **แอปพลิเคชันหลัก:** `Agent App / Portal`
* **เป้าหมาย:** ค้นหาสต็อกห้อง Co-broke, นำเสนอลูกค้า, พาชมห้อง และปิดการเช่า
* **ฟังก์ชันการทำงาน:**
  1. **สร้างและจัดการประกาศ (Listing Wizard - Agent Mode):**
     * ใช้งาน Engine เดียวกับ Owner แต่เปิดช่องตั้งค่าคอมมิชชั่น และแนบหนังสือมอบอำนาจ
     * **AI Copywriting (Gemini):** สำนวนนายหน้ามืออาชีพ (`broker_pro`)
  2. **Co-Broke Listing Stock:** เข้าถึงแคตตาล็อกห้องเช่าของ Owner ที่เปิดรับตัวแทน
  3. **บริการพาลูกค้าเข้าชม (Viewing Dispatch):**
     * รับงานพาลูกค้าจากหน้า Marketplace ไปดูห้องจริง
     * ส่งคำขอเบิกกุญแจ / นัด Assistant ช่วยเปิดห้องให้
  4. **Commission Tracking:** ติดตามสถานะการปิดดีลและประวัติการรับค่าคอมมิชชั่น

---

### 5. 🛠️ Assistant & Admin (ทีมปฏิบัติการ / ผู้ดูแลระบบ)
* **แอปพลิเคชันหลัก:** `Admin & Operations Portal`
* **เป้าหมาย:** เป็นศูนย์กลางควบคุมคุณภาพ (Operations Hub) และประสานงานทุกฝ่าย
* **ฟังก์ชันการทำงาน:**
  1. **ศูนย์รับเรื่องบริการ (Service Desk & Dispatcher):**
     * จัดการคำขอนัดดูห้อง (Viewing Tickets) → จ่ายงานให้ Assistant หรือ Agent หน้างาน
     * จัดการคำขอแจ้งซ่อม/ทำความสะอาด → ประเมินราคา, ส่งช่าง, และออกบิล
  2. **งานนิติกรรมและสัญญา (Contract & Billing Control):**
     * ร่างสัญญาเช่า (Draft Contract) ตามเงื่อนไขที่ตกลงกัน
     * ออกบิลค่าเช่า/ค่าน้ำไฟประจำเดือน และตรวจหลักฐานการชำระเงิน
  3. **การตรวจสภาพห้อง (Inspection Report):** บันทึกรูปภาพและ Checklist สภาพห้องก่อนส่งมอบ/รับคืน

---

## 7. ฟังก์ชันบริการส่วนกลาง (NESTIQ Services Hub)

ฟีเจอร์ **Services** ทำหน้าที่เป็น On-Demand Operational Backbone เชื่อมโยงผู้ใช้ทุกคนเข้าหา Admin:

```
┌─────────────────────────────────┐
│        ผู้เรียกใช้บริการ        │
│   (Tenant, Owner, Agent)        │
└────────────────┬────────────────┘
                 │ 1. เลือกบริการ (ทำความสะอาด / ซ่อมแซม / นัดดูห้อง / ตรวจห้อง)
                 │ 2. ระบุวัน-เวลา + แนบรูปภาพปัญหา
                 ▼
┌─────────────────────────────────┐
│       ระบบจัดการส่วนกลาง        │
│      (Admin & Assistant)        │
└────────────────┬────────────────┘
                 │ 3. ประเมินราคา & ส่งช่าง/ทีมงานเข้าพื้นที่
                 │ 4. บันทึกผลการทำงาน + ผูกค่าใช้จ่ายเข้ากับบิลห้องเช่า
                 ▼
┌─────────────────────────────────┐
│         ผลลัพธ์การทำงาน         │
│      (Status Tracking & Pay)    │
└─────────────────────────────────┘
```

### แคตตาล็อกบริการและสิทธิ์การเรียกใช้ (Service Matrix)

| ประเภทบริการ (Service Types) | 👤 Tenant | 🏠 Owner | 🤝 Agent | ฝั่งจัดการ (Admin/Assistant) |
|---|:---:|:---:|:---:|---|
| **นัดหมายดูห้อง (Viewing)** | — | ✅ | ✅ | จัดสรรคิวงานและจ่ายงานหน้างาน |
| **ทำความสะอาด (Cleaning)** | ✅ (ประจำ) | ✅ (Deep Clean) | ✅ (เตรียมห้อง) | ประสานงานแม่บ้าน / ทีม Partner |
| **ซ่อมบำรุง (Maintenance)** | ✅ (แอร์/ท่อ/ไฟ) | ✅ (Renovate) | — | ประเมินราคา, ส่งช่าง, ออกใบเสนอราคา |
| **ตรวจรับสภาพห้อง (Inspection)** | ✅ (ย้ายออก) | ✅ (รับห้อง/เช็กสภาพ) | — | ส่ง Assistant ไปทำ Checklist พร้อมรูป |
| **แจ้งปัญหา (Support Ticket)** | ✅ (นิติ/เพื่อนบ้าน) | ✅ (การเงิน/บิล) | ✅ (Co-broke) | Admin รับเรื่องและตอบกลับ |

---

## 8. โครงสร้าง Monorepo เป้าหมาย (Monorepo Layout Target)

```
nestiq/
├── apps/
│   ├── api/                  # NestJS API (แชร์ทุกแอป: Auth, Listings, Services, Billing)
│   ├── web/                  # [Marketplace Web] Next.js 15 (Guest ค้นหาห้อง, SEO, รายละเอียด)
│   ├── consumer-app/         # [Consumer Mobile App] Expo React Native (Guest หาห้อง ➔ Tenant ลูกบ้าน)
│   ├── owner/                # [Owner App/Portal] Next.js / Expo (เจ้าของห้องปล่อยเช่า)
│   ├── agent/                # [Agent App/Portal] Next.js / Expo (นายหน้า Co-broke)
│   └── admin/                # [Admin Portal] Backoffice สำหรับ Assistant และ Admin
│
├── packages/
│   ├── feature-listing/      # [Shared Core] Listing Wizard + AI Engine (Config-Driven)
│   ├── feature-search/       # [Shared Core] Search Query Builder & Filter State
│   ├── feature-services/     # [Shared Core] Service Request Modals & Status Trackers
│   ├── ui/                   # Shared UI Components & Shells (ModePage, WebPageLayout, Tokens)
│   ├── config/               # Shared Tailwind, SCSS, ESLint, TypeScript config
│   ├── types/                # Shared TypeScript DTOs, Feature Configs, Master types
│   └── i18n/                 # Shared Localization (th, en, zh, ja)
```

---

## 9. ระบบสีอัตลักษณ์, UI Components, Icons และ Typography (CI Brand Guide & Tokens)

### 9.1 Corporate Color Palette & Semantic Tokens (ระบบสีทางการ)

| หมวดหมู่ | Token | Hex Code | บทบาท / การใช้งาน |
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

### 9.2 Basic UI Component Styles & States (สไตล์ UI พื้นฐาน)

```
[ Primary Button ]
┌─────────────────────────┬─────────────────────────┬─────────────────────────┬─────────────────────────┐
│ Default: #F8B615 (ทึบ)  │ Hover: #FCD34D (สว่าง)  │ Pressed: #EAB308 (เข้ม) │ Disabled: #FEF3C7 (จาง) │
│ Text: #211E1E (Bold)    │ Text: #211E1E           │ Text: #211E1E           │ Text: #D1D5DB           │
└─────────────────────────┴─────────────────────────┴─────────────────────────┴─────────────────────────┘

[ Secondary Button (Outline) ]
┌─────────────────────────┬─────────────────────────┬─────────────────────────┬─────────────────────────┐
│ Default: Border #F8B615 │ Hover: Bg #FFFBEB       │ Pressed: Bg #FEF3C7     │ Disabled: Border #F3F4F6│
│ Bg: #FFFFFF             │ Border: #F8B615         │ Border: #EAB308         │ Text: #E5E7EB           │
└─────────────────────────┴─────────────────────────┴─────────────────────────┴─────────────────────────┘

[ Input Fields ]
• Default: Border #E5E7EB | Background #FFFFFF | Placeholder #94A3B8
• Focus:   Border #F8B615 (สีเหลืองแบรนด์)
• Error:   Border #DC2626 (สีแดง) + ข้อความกำกับล่าง "This field is required." (#DC2626)
```

### 9.3 Icon Style & Color Guidelines (รูปแบบและสีไอคอน)

* **Style:** สไตล์ Line / Outline ความหนาเส้นสม่ำเสมอ (~1.5px ถึง 2px)
* **Standard Icons:** `Home`, `Search`, `Filter`, `User`, `Download`, `Notification`, `Location`, `Setting`
* **Allowed Icon Colors:**
  1. `#211E1E` — ไอคอนบนพื้นสว่าง / สถานะ Active
  2. `#64748B` — ไอคอนสถานะรอง / Inactive
  3. `#F8B615` — ไอคอนไฮไลท์ / Selected Item
  4. `#CBD5E1` — ไอคอนสีจาง / Disabled
  5. `#FFFFFF` — ไอคอนบนพื้นหลังสีเข้ม (Dark Slate Containers)

### 9.4 Typography Stack (ชุดฟอนต์หลักของระบบ)

| บทบาทข้อความ | ภาษาไทย (TH) / ภาษาอื่น | ภาษาอังกฤษ (EN) | ฟอนต์ Package ที่โหลด |
|---|---|---|---|
| **Headlines (`ci.heading`)** | **Mitr** (`500Medium`) | **Baloo 2** (`400Regular`) | `@expo-google-fonts/mitr`<br>`@expo-google-fonts/baloo-2` |
| **Body (`ci.body`)** | **Noto Sans Thai** (`400Regular` / `700Bold`) | **Noto Sans Thai** (`400Regular` / `700Bold`) | `@expo-google-fonts/noto-sans-thai` |

* **Typography Safety Rule:** ภาษาไทยต้องกำหนด `lineHeight` ให้มีสัดส่วน 1.45–1.5 เท่าของ `fontSize` เสมอ เพื่อป้องกันปัญหาสระบน-ล่างลอยหรือถูกตัดขอบ

### 9.5 Multi-App & Role Color Palette (สีประจำแต่ละบทบาทและแอปพลิเคชัน)

| บทบาท / แอปพลิเคชัน | สีประจำตัว (Primary Color) | แถบสี Gradient (Hero & Header) | ความหมายทางจิตวิทยาและการใช้งาน |
|---|---|---|---|
| **🟡 Marketplace (Guest)** | `#F8B615` (Warm Yellow) | `#F8B615` ➔ `#FF8A00` | อบอุ่น เป็นมิตร สดใส ดึงดูดผู้ค้นหาห้อง |
| **🟢 Tenant (ผู้เช่า)** | `#00C68D` (Neo Mint) | `#00C68D` ➔ `#0055DA` | สดชื่น ปลอดภัย ทันสมัย สร้างความสบายใจในการอยู่อาศัย |
| **🔵 Owner (เจ้าของห้อง)** | `#0055DA` (Electric Blue) | `#0055DA` ➔ `#00C68D` | มั่นคง น่าเชื่อถือ มืออาชีพ ให้ความรู้สึกเรื่องการเงินที่มั่นคง |
| **🔴 Agent (นายหน้า)** | `#FF0052` (Neon Rose) | `#FF0052` ➔ `#F8B615` | กระตือรือร้น มีพลัง ปิดการขายรวดเร็ว โดดเด่น |
| **⚫ Admin & Operations** | `#0F172A` (Deep Slate) | `#0F172A` ➔ `#1E293B` | สุขุม ชัดเจน มุ่งเน้นการจัดการและประสิทธิภาพหลังบ้าน |
| **🔷 Services Hub** | `#0284C7` (Sky Blue) | `#00C68D` ➔ `#0055DA` | ความสะอาด บริการรวดเร็ว โปร่งใส ตรวจสอบได้ |

---

## 10. ระบบคลาวด์และฐานข้อมูล (Supabase Cloud Infrastructure & Services)

ระบบใช้ **Supabase** เป็น Core Infrastructure หลักในการขับเคลื่อน Data, Auth, Files และ Realtime ทั้งหมดของระบบ Multi-App:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 SUPABASE CLOUD PLATFORM                                │
├──────────────────────────┬──────────────────────────┬──────────────────────────────────┤
│ 🔐 Supabase Auth (SSO)   │ 🗄️ PostgreSQL + Pooler  │ 📦 Supabase Storage & CDN        │
│ - JWT Session Sharing    │ - Connection Pooling     │ - Public: รูปห้อง, Banner        │
│ - Google OAuth / OTP     │ - TypeORM Entities       │ - Private: สัญญาเช่า, โฉนด      │
│ - Role Guard Integration │ - PostGIS Coordinates    │ ⚡ Supabase Realtime (WebSockets) │
└──────────────────────────┴──────────────────────────┴──────────────────────────────────┘
```

1. **Supabase Auth & Single Sign-On (SSO):**
   * บัญชีผู้ใช้เป็น Universal ID เดียวกันทั้งระบบ
   * สลับโหมดการใช้งาน (Tenant ➔ Owner ➔ Agent) ได้อย่างราบรื่นผ่าน Cookie Domain Sharing / Session Token เดียวกัน
2. **PostgreSQL Database & Connection Pooler:**
   * เชื่อมต่อผ่าน Transaction/Session Pooler ของ Supabase เพื่อรองรับ Concurrent Connection จำนวนมากจากทั้ง 5 Apps
3. **Supabase Storage:**
   * จัดการไฟล์สื่อทั้งหมด (Bucket: `property-images`, `contracts`, `service-attachments`)
4. **Supabase Realtime:**
   * แจ้งเตือนคิวงานช่าง/แม่บ้าน และอัปเดตสถานะนัดดูห้องแบบทันทีทันใด (Live Status Tracking)

---

## 11. Starter Kit Deployment & Path Placement Guide (การนำไปวางในโปรเจกต์ใหม่)

เมื่อเริ่มต้นโปรเจกต์ใหม่ในระบบนิเวศ NESTIQ / NESTYK ให้นำไฟล์จากโฟลเดอร์ `docs/NESTYK/` ไปจัดวางตาม Path ปลายทางใน Monorepo ดังนี้:

| ไฟล์ต้นทาง (Source) | Path ปลายทางใน Monorepo ใหม่ (Target Path) | หน้าที่และคำอธิบาย |
|---|---|---|
| `docs/NESTYK/PROJECT_RULES.md` | `.cursorrules` (ที่ Root โปรเจกต์)<br>`.cursor/rules/core-rules.mdc` | กฎเหล็ก AI Assistant, Coding Standards, Universal Shell & UI Rules |
| `docs/NESTYK/architecture-multi-app.md` | `docs/architecture-multi-app.md` | สถาปัตยกรรม 5 Apps, Role Permissions, Services Matrix, CI Specs |
| `docs/NESTYK/tokens.ts` | `packages/ui/src/theme/tokens.ts`<br>`apps/mobile/lib/theme/tokens.ts` | Design Tokens หลัก (Corporate, Semantic, Roles, Typography) |
| `docs/NESTYK/colors.json` | `packages/config/theme/colors.json`<br>`tailwind.config.js` (Import) | Color Palette แบบ JSON สำหรับ Tailwind CSS และ Config อื่นๆ |



