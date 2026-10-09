# Lead — กดจับคู่ห้องเอง + ตั้งค่ารายลีด

| ฟิลด์ | ค่า |
|-------|-----|
| สถานะ | ระยะ 1–2 `implemented` (2026-10-02) · ระยะ 3–4 `blueprint` |
| โหมด | Agent — หน้ารายละเอียดลีด (`leadDetail`) และรายการลีด (`listingLead`) |
| Role | `agent` |
| ต่อจาก | [matching.md](./matching.md) — กติกาคัดห้องและคะแนน |
| สิทธิ์/โควตา | [billing pack](../../billing/README.md) — รหัส `agent.match.*` ใน [features.md](../../billing/features.md#31-agent--จับคู่ห้องกับลีด) |

---

## 1. เป้าหมาย

1. **ไม่จับคู่อัตโนมัติ** — นายหน้ากดปุ่ม "จับคู่ห้อง" เอง ผลถูกบันทึกไว้ เปิดดูซ้ำได้โดยไม่คำนวณใหม่
2. **ตั้งค่าได้รายลีด** — คะแนนขั้นต่ำ จำนวนห้อง ความยืดหยุ่นของงบ/ระยะ เกณฑ์ที่ต้องตรง ฯลฯ
3. **รองรับการขายแบบ subscription** — จำนวนครั้งที่กดและตัวเลือกขั้นสูงล็อกตามแพ็กเกจได้ โดยไม่ต้องปล่อยแอปใหม่
4. **รองรับห้องจำนวนมาก** — ย้ายการคำนวณไป server แก้ข้อจำกัด 200 ห้องของผลเบื้องต้นฝั่ง client

---

## 2. สภาพก่อนปรับ (ก่อนระยะ 1–2 — เก็บไว้อ้างอิง)

| เรื่อง | ก่อนปรับ | ที่อยู่ในโค้ด (เดิม) |
|--------|-------|---------------|
| จังหวะจับคู่ | อัตโนมัติเมื่อเปิดหน้ารายละเอียดลีด | `useEffect` ที่เรียก `loadMatchRoomPool` ใน `apps/consumer-app/components/AgentLeadDetailBody.tsx` |
| รายการลีด | คำนวณผลของทุกลีดเองทุกครั้งที่วาดหน้าจอ | `summarizeLeadMatch` ใน `apps/consumer-app/components/AgentLeadsScreen.tsx` |
| ห้องที่นำมาคิด | ห้อง `available` ของนายหน้า เรียงราคาถูก→แพง สูงสุด 4 หน้า × 50 = **200 ห้อง** — ห้องที่เกินถูกตัดเงียบๆ | `loadMatchRoomPool` ใน `apps/consumer-app/lib/lead-match-preview.ts` |
| ระยะไกลสุด | 2 เท่าของรัศมี (ตายตัว) | `matchLeadRooms` |
| งบ | ห้ามเกินแม้บาทเดียว (ตายตัว) | `matchLeadRooms` |
| น้ำหนักเกณฑ์ | เท่ากันทุกข้อ | `overallScore` ใน `apps/consumer-app/lib/lead-room-compare.ts` |
| คะแนนขั้นต่ำ | ไม่มี | — |
| จำนวนที่แสดง | ทีละ 10 กด "ดูเพิ่ม" จนครบ | `MATCH_PAGE_SIZE` |
| สิทธิ์/โควตา | ไม่มี | — |

### 2.1 สิ่งที่ทำแล้ว (ระยะ 1–2)

| ส่วน | ที่อยู่ในโค้ด |
|------|---------------|
| สูตรคะแนน (ย้ายจากแอปมาไว้ที่เดียว) | `apps/api/src/agent/leads/lead-matching.ts` — `SCORING_VERSION`, `matchLeadRooms`, `compareLeadRoom`, `overallScore`, `applyMatchSettings`, `matchInputHash`, `pinSearchBoxes` |
| endpoint + เก็บผล | `apps/api/src/agent/leads/lead-matching.service.ts` + `lead-matching.controller.ts` |
| คัดห้องด้วย SQL + การ์ดห้อง | `AgentListingsService.matchCandidates` / `cardsByIds` ใน `apps/api/src/agent/listings/agent-listings.service.ts` |
| `lastMatch` ในรายการลีด | `loadLastMatches` เรียกจาก `AgentLeadsService.list` |
| migration | `apps/api/migrations/20261002-lead-match-runs.sql` · รันด้วย `node apps/api/scripts/apply-lead-match-runs.cjs` (`--check` = ลองแล้ว rollback) |
| แอป | `AgentLeadDetailBody.tsx` (ปุ่มจับคู่ + แผ่นตั้งค่า) · `AgentLeadsScreen.tsx` (ใช้ `lastMatch`) · `LeadMatchedRoomBody.tsx` (ใช้ `comparison` จาก server) |
| test | `apps/api/test/lead-matching.test.cjs` (อยู่ใน `npm run test:agent-leads`) |

ต่างจากร่างเดิมในหัวข้อ 5–6:

- ตรวจ "ผลเก่าแล้ว" ด้วย `input_hash` = SHA-256 ของช่องที่มีผลต่อการจับคู่ (งบสูงสุด, หมุด, รัศมี, ระยะสัญญา, ประเภทห้อง, วันย้ายเข้า) + ค่าตั้งค่า + `SCORING_VERSION` แทน `lead_updated_at` / `settings_hash` — เปลี่ยนสถานะลีดหรือแก้โน้ตจึงไม่ทำให้ผลขึ้นว่าเก่า
- **ยังไม่ทำ "กดซ้ำค่าเดิมภายใน 10 นาทีคืนผลเดิม"** และ `Idempotency-Key` — มีไว้กันโควตาถูกตัดซ้ำ จะทำพร้อมโควตาในระยะ 3 (ถ้าทำตอนนี้ กดจับคู่ใหม่หลังเพิ่มห้องจะได้ผลเก่ากลับมา)
- เก็บ run ล่าสุด **5 ครั้งต่อลีด** (`KEPT_RUNS_PER_LEAD`) ลบที่เก่ากว่าในทรานแซกชันเดียวกับการบันทึก
- `candidate_count` = ห้องที่ผ่านงบ + ระยะ · `result_count` = ห้องที่เก็บจริง (หลังกรองคะแนนและตัดตาม `maxResults`)
- `items[]` ไม่มี `pin` / `withinRadius` / `distanceScore` / `pinWeight` แยก เพราะอยู่ใน `comparison.location` แล้ว
- ห้องที่ไม่ว่างแล้วหลังจับคู่ยังแสดงอยู่ (การ์ดมี `roomStatusCode` ให้แอปติดป้ายได้) · ห้องที่ถูกลบหลุดออกเอง

---

## 3. หน้าจอ

### 3.1 หน้ารายละเอียดลีด — การ์ด "ห้องที่จับคู่"

| สถานะ | แสดง |
|-------|------|
| ลีดข้อมูลไม่พอ (`leadMatchReady = false`) | ข้อความบอกช่องที่ขาด + ปุ่มไปแก้ไขลีด (เหมือนเดิม) |
| ยังไม่เคยจับคู่ | ปุ่ม **"จับคู่ห้อง"** (`MobileAiQuotaAction` + ป้าย "เหลือ 7/10") · ปุ่มไอคอน "ตั้งค่า" ข้างกัน |
| กำลังจับคู่ | ปุ่มแสดง loading · ปุ่มตั้งค่าปิดชั่วคราว |
| มีผลแล้ว | รายการห้องเหมือนเดิม + บรรทัด "จับคู่ล่าสุด 10:05 · คะแนนขั้นต่ำ 60% · 12 ห้อง" + ปุ่ม **"จับคู่ใหม่"** |
| ผลเก่าแล้ว (ลีดถูกแก้หลังจับคู่ หรือเปลี่ยนการตั้งค่า) | แถบเตือน "ข้อมูลลีดเปลี่ยนแล้ว กดจับคู่ใหม่เพื่ออัปเดต" · ยังแสดงผลเดิมไว้ |
| โควตาหมด | กดปุ่มแล้วเปิดแผ่นอัปเกรด ([billing/client-ui.md §3](../../billing/client-ui.md#3-แผ่นอัปเกรด-upgradesheet)) |
| ลีด `booked` | ไม่แสดงการ์ดนี้ (เหมือนเดิม) |

### 3.2 แผ่นตั้งค่า (`MobileBottomSheet`)

- หัวข้อ "ตั้งค่าการจับคู่" + คำอธิบายสั้นว่าค่าใช้กับลีดคนนี้เท่านั้น
- แต่ละค่าตาม §4 · ตัวเลือกที่แพ็กเกจไม่เปิดแสดง **ไอคอนกุญแจ** กดแล้วเปิดแผ่นอัปเกรด (ไม่ซ่อน)
- ปุ่มล่าง: "คืนค่าเริ่มต้น" (รอง) · "บันทึก" (หลัก) — บันทึกแล้ว **ยังไม่จับคู่ให้** แต่ผลเดิมจะขึ้นแถบ "ผลเก่าแล้ว"
- ปิดด้วยปุ่ม Back ของ Android

### 3.3 รายการลีด

- เลิกคำนวณผลเอง ใช้ `lastMatch` จาก `GET /agent/leads` (§6.4)
- มีผล: "ตรง 12 ห้อง · สูงสุด 86%" · ยังไม่เคยจับคู่: ป้าย "ยังไม่ได้จับคู่" · ข้อมูลไม่พอ: ป้ายเดิม
- ไม่ต้องโหลดห้องในหน้ารายการอีก

---

## 4. ค่าตั้งค่ารายลีด

| ค่า | คีย์ใน `match_settings` | ค่าเริ่มต้น | ตัวเลือก | สิทธิ์ที่ต้องมีเพื่อเปลี่ยน |
|-----|------------------------|------------|----------|-----------------------------|
| ช่วงคะแนน (ต่ำสุด) | `minScore` | `50` | 0–100 ทีละ 5 (แถบเลื่อน 2 หัวจับ `RangeSlider` จาก `@react-native-assets/slider`) | `agent.match.min_score` |
| ช่วงคะแนน (สูงสุด) | `maxScore` | `100` | 0–100 ทีละ 5 · มากกว่า `minScore` อย่างน้อย 5 | `agent.match.min_score` |
| จำนวนห้องสูงสุด | `maxResults` | `10` | 10 · 20 · 50 · 100 | ไม่เกิน `agent.match.max_results` |
| ยอมเกินงบ | `budgetTolerancePct` | `0` | 0 · 5 · 10 | `agent.match.budget_tolerance` |
| ระยะค้นหา (เท่าของรัศมี) | `radiusMultiplier` | `2` | 1 · 1.5 · 2 · 3 | `agent.match.radius_multiplier` |
| เกณฑ์ที่ต้องตรงเท่านั้น | `required` | `[]` | `roomType` · `lease` · `moveIn` | `agent.match.required_criteria` |
| น้ำหนักเกณฑ์ | `weights` | `null` (เท่ากัน) | ต่อเกณฑ์ 0–3 | `agent.match.weights` |
| รวมห้องที่จะว่างภายใน (วัน) | `includeAvailableWithinDays` | `30` | 0 · 30 · 60 | ไม่ล็อก |
| ขอบเขตห้อง | `scope` | `own` | `own` · `cobroke` | `agent.match.scope_cobroke` (อนาคต) |
| แจ้งเตือนห้องใหม่ที่ตรง | `autoNotify` | `false` | เปิด/ปิด | `agent.match.auto_notify` (อนาคต) |

ความหมายของคะแนนขั้นต่ำ (ต้องอธิบายในแผ่นตั้งค่า):

- แผ่นตั้งค่าแสดงหัวข้อ "ช่วงคะแนน" เป็นแถบเลื่อน 2 หัวจับ (ซ้าย = `minScore`, ขวา = `maxScore`): ช่วงระหว่างหัวจับเป็นสีเหลืองแบรนด์ `#F8B615` นอกช่วงเป็นสีเทา · หัวจับข้ามกันไม่ได้และห่างกันอย่างน้อย 5 · ด้านขวาแสดงช่วงตัวใหญ่ เช่น "50–80%" · ปลายแถบ "ผ่อนปรน · 0%" / "เข้มงวด · 100%" · ใต้แถบ "แสดงเฉพาะห้องที่ได้คะแนน {min}–{max}%"
- กรองห้องเป็น `minScore ≤ คะแนนรวม ≤ maxScore` · บรรทัดผลล่าสุดแสดง "{min}–{max}%" · ไม่มีห้องผ่าน: "{count} ห้องคะแนนไม่อยู่ในช่วง {min}–{max}%"
- ช่วงค่าอยู่ที่ `LEAD_MATCH_MIN_SCORE` (`@nestyk/types`) และ `MATCH_MIN_SCORE_RANGE` (API) — ต้องตรงกัน · `PATCH` ตรวจช่วงหลังรวมกับค่าที่บันทึกไว้ (`assertScoreRange`) · ค่าที่บันทึกไว้นอกช่วงหรือช่วงแคบเกินกลับเป็นค่าเริ่มต้น · ข้อมูลเก่าที่ไม่มี `maxScore` ถือเป็น 100
- `matchInputHash` ใส่ `maxScore` เฉพาะเมื่อไม่ใช่ 100 — ผลจับคู่ที่บันทึกก่อนมี `maxScore` จึงไม่ขึ้น "ต้องจับคู่ใหม่"

- **งบและทำเลเป็นเงื่อนไขบังคับอยู่แล้ว** — ห้องที่เกินงบ (หลังบวกความยืดหยุ่น) หรือไกลเกินระยะค้นหา ไม่เข้ารายการเลย
- คะแนนขั้นต่ำกรองจาก **คะแนนรวม** ([matching.md §5.1 คะแนนรวม](./matching.md#คะแนนรวม)) ของห้องที่ผ่านเงื่อนไขบังคับแล้ว
- `required` ทำให้เกณฑ์นั้นกลายเป็นเงื่อนไขบังคับ — ห้องที่ข้อนั้นไม่ตรงจะไม่เข้ารายการแม้คะแนนรวมสูง (ข้อที่ห้องไม่มีข้อมูล `unknown` ไม่ถูกตัด แต่ติดป้าย "ต้องสอบถาม")

### 4.1 รูปแบบ JSON

```json
{
  "version": 1,
  "minScore": 60,
  "maxResults": 20,
  "budgetTolerancePct": 5,
  "radiusMultiplier": 2,
  "required": ["roomType"],
  "weights": null,
  "includeAvailableWithinDays": 30,
  "scope": "own",
  "autoNotify": false
}
```

- `leads.match_settings = NULL` = ใช้ค่าเริ่มต้นทั้งหมด
- เก็บเฉพาะคีย์ที่ต่างจากค่าเริ่มต้นก็ได้ — server รวมกับค่าเริ่มต้นตอนอ่าน
- `version` ใช้ย้ายรูปแบบในอนาคต

### 4.2 เมื่อสิทธิ์ไม่พอ

- **บันทึกค่า:** ค่าที่ล็อก → `403 FEATURE_LOCKED` (แอปควรกันไว้ก่อนด้วยไอคอนกุญแจ) · `maxResults` เกินสิทธิ์ → `403 PLAN_LIMIT`
- **ตอนจับคู่:** ค่าที่บันทึกไว้ก่อนสิทธิ์ลดลงจะถูก **clamp** เป็นค่าเริ่มต้น/ค่าสูงสุดที่ใช้ได้ และตอบ `clamped` บอกว่าข้อไหนถูกปรับ ([billing/flow.md §3](../../billing/flow.md#3-ข้อมูลเดิมเมื่อสิทธิ์ลดลง))

---

## 5. ฐานข้อมูล (ร่าง)

```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS match_settings JSONB NULL;
ALTER TABLE leads ADD CONSTRAINT chk_leads_match_settings_object
  CHECK (match_settings IS NULL OR jsonb_typeof(match_settings) = 'object');

CREATE TABLE IF NOT EXISTS lead_match_runs (
  id                   SERIAL PRIMARY KEY,
  lead_id              INT          NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  run_by_user_id       INT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  settings             JSONB        NOT NULL,  -- ค่าที่ใช้จริงหลัง clamp
  settings_hash        VARCHAR(64)  NOT NULL,  -- ใช้ตรวจ "กดซ้ำค่าเดิม"
  lead_updated_at      TIMESTAMPTZ  NOT NULL,  -- ใช้ตรวจ "ผลเก่าแล้ว"
  scoring_version      SMALLINT     NOT NULL DEFAULT 1,
  candidate_count      INT          NOT NULL,  -- ห้องที่ผ่านเงื่อนไขบังคับ
  result_count         INT          NOT NULL,  -- ห้องที่ผ่านคะแนนขั้นต่ำ (ก่อนตัดตาม maxResults)
  top_score            SMALLINT     NULL,
  clamped              TEXT[]       NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_match_runs_lead_created
  ON lead_match_runs (lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lead_match_results (
  run_id        INT          NOT NULL REFERENCES lead_match_runs(id) ON DELETE CASCADE,
  rent_room_id  INT          NOT NULL REFERENCES rent_rooms(id) ON DELETE CASCADE,
  rank          SMALLINT     NOT NULL,
  score         SMALLINT     NOT NULL,
  location_score SMALLINT    NOT NULL,
  price         DECIMAL(12, 2) NOT NULL,
  term_months   SMALLINT     NULL,
  distance_km   DECIMAL(6, 2) NOT NULL,
  pin_rank      SMALLINT     NOT NULL,
  comparison    JSONB        NOT NULL,  -- รูปเดียวกับ LeadRoomComparison
  PRIMARY KEY (run_id, rent_room_id)
);
```

- เก็บเฉพาะห้องที่ติด `maxResults` อันดับแรก
- เก็บประวัติทุกครั้ง (ใช้ดูว่าเคยเสนอห้องไหนไปแล้ว) · ลบ run เก่ากว่า 90 วันได้ด้วย job ภายหลัง
- ห้องที่ถูกลบ/ไม่ว่างแล้วหลังจับคู่: ตอนอ่านผลให้ติดป้าย "ไม่ว่างแล้ว" แทนการซ่อน

---

## 6. API (ร่าง)

### 6.1 `GET /agent/leads/:id/match-settings`

```json
{
  "saved": { "minScore": 80 },
  "effective": { "version": 1, "minScore": 50, "maxResults": 10, "budgetTolerancePct": 0, "radiusMultiplier": 2, "required": [], "weights": null, "includeAvailableWithinDays": 30, "scope": "own", "autoNotify": false },
  "locked": ["minScore", "budgetTolerancePct", "radiusMultiplier", "required", "weights", "scope", "autoNotify"],
  "limits": { "maxResults": 10 }
}
```

### 6.2 `PATCH /agent/leads/:id/match-settings`

Body = บางคีย์ของ §4.1 · `null` ต่อคีย์ = กลับเป็นค่าเริ่มต้น · ตอบรูปเดียวกับ 6.1 · ตรวจสิทธิ์ตาม §4.2

### 6.3 `POST /agent/leads/:id/match-runs`

Header: `Idempotency-Key` · Body: ว่าง (ใช้ค่าที่บันทึกไว้)

ขั้นตอน server:

1. โหลดลีด — ไม่ใช่ของนายหน้าคนนี้ → 404 · ข้อมูลไม่พอ → 422 `LEAD_NOT_READY` · `booked` → 409
2. รวมค่าตั้งค่า + clamp ตามสิทธิ์
3. **กดซ้ำค่าเดิม:** มี run ล่าสุดที่ `settings_hash` เท่ากัน, `lead_updated_at` เท่ากัน และอายุไม่เกิน 10 นาที → คืน run นั้น `reused: true` **ไม่ตัดโควตา**
4. ใน `DataSource.transaction`:
   - ตัดโควตา `agent.match.run` ([billing/api.md §3](../../billing/api.md#3-การตรวจสิทธิ์ฝั่ง-server)) — เกิน → 403 `PLAN_LIMIT`
   - คัดห้องด้วย SQL: `is_scout_room`, `created_by_user_id`, สถานะว่าง (หรือว่างภายใน `includeAvailableWithinDays`), ราคา ≤ งบ × (1 + tolerance), กรอบพิกัดรอบหมุดกว้าง `radiusMultiplier × radius_km` ([matching.md §3.1](./matching.md#31-ระยะทางและคะแนนทำเล))
   - คำนวณระยะจริง + คะแนนรายเกณฑ์ (ย้าย logic จาก `lead-match-preview.ts` / `lead-room-compare.ts` มาเป็นโมดูลที่ API ใช้) + น้ำหนัก + `required`
   - กรอง `minScore` · เรียง · ตัด `maxResults` · insert `lead_match_runs` + `lead_match_results`
5. ตอบผล

```json
{
  "run": {
    "id": 321,
    "createdAt": "2026-10-02T10:05:00+07:00",
    "settings": { "minScore": 50, "maxResults": 10 },
    "clamped": ["minScore"],
    "candidateCount": 48,
    "resultCount": 12,
    "topScore": 86,
    "reused": false,
    "stale": false
  },
  "items": [
    { "room": { "id": 55, "title": "…" }, "score": 86, "locationScore": 100, "price": 12000, "termMonths": 12,
      "pin": { "name": "BTS อโศก", "rank": 1 }, "distanceKm": 0.8, "withinRadius": true, "comparison": { } }
  ],
  "quota": { "feature": "agent.match.run", "limit": 10, "used": 4, "remaining": 6 }
}
```

`items[]` คงรูปใกล้ `LeadRoomMatch` เดิม เพื่อสลับ UI จากผลฝั่ง client มาใช้ผล server ได้โดยแก้น้อยที่สุด

### 6.4 `GET /agent/leads/:id/match-runs/latest`

ผลครั้งล่าสุด รูปเดียวกับ 6.3 (ไม่มี `quota`) · `stale: true` เมื่อ `leads.updated_at` หรือ `match_settings` เปลี่ยนหลัง run · ไม่เคยจับคู่ → `{ "run": null, "items": [] }`

### 6.4.1 `DELETE /agent/leads/:id/match-runs`

ล้างผลจับคู่ทั้งหมดของลีด (`lead_match_results` ถูกลบตาม FK cascade) · ค่า `match_settings` ยังอยู่ · ตอบ `204` · ลีดของคนอื่น → `404`

### 6.5 `GET /agent/leads` (เพิ่มฟิลด์)

แต่ละลีดมี `lastMatch: { "runId": 321, "resultCount": 12, "topScore": 86, "createdAt": "…", "stale": false } | null`

---

## 7. แผนงาน

ระยะ 1 กับ 2 ทำรวมกันเป็นงานเดียว (ข้ามขั้น "บันทึกผ่าน `PATCH /agent/leads/:id` ชั่วคราว" และ "คำนวณฝั่งแอปพร้อมค่าตั้งค่า" เพราะจะถูกแทนที่ทันทีในระยะ 2)

### ระยะที่ 1 — กดเอง + ตั้งค่า (เสร็จ)

- [x] เอาการโหลดอัตโนมัติออกจาก `AgentLeadDetailBody.tsx` → ปุ่ม "จับคู่ห้อง" / "จับคู่ใหม่" (`MobileAiQuotaAction` ซ่อนป้ายโควตาไว้ก่อน) + เวลาจับคู่ล่าสุด + ป้าย "ข้อมูลลีดเปลี่ยน"
- [x] แผ่นตั้งค่า (§3.2) — ค่า `minScore`, `maxResults` · บันทึกลง `leads.match_settings` ผ่าน `PATCH /agent/leads/:id/match-settings` (บันทึกเฉพาะเมื่อค่าเปลี่ยน)
- [x] ทุกการจับคู่เริ่มจากแผ่นตั้งค่า: ยังไม่เคยจับคู่ → ปุ่ม "จับคู่ห้อง" เปิดแผ่น · จับคู่แล้ว → ไอคอนปรับเกณฑ์ (`sliders`) ข้างหัวข้อเปิดแผ่น มีปุ่ม "จับคู่ใหม่" และลิงก์ "ล้างผลจับคู่" (ยืนยันในแผ่นเดียวกัน → §6.4.1)
- [x] หน้ารายการลีดเลิกโหลด room pool → ใช้ `lastMatch` · ยังไม่เคยจับคู่แสดง "ยังไม่จับคู่"
- [x] i18n `agent.leads.matchRun*`, `matchSettings.*` ครบ 4 ภาษา + `types.ts`

### ระยะที่ 2 — จับคู่ที่ server + เก็บผล (เสร็จ)

- [x] migration: `leads.match_settings`, `lead_match_runs`, `lead_match_results`
- [x] ย้าย logic คะแนนไป API — ตรวจกับข้อมูลจริงใน DB local แล้ว ผลตรงกับสูตรเดิมของแอปทุกลีด (14 ลีด)
- [x] endpoint §6.1–6.5 (ยังไม่มี `locked` / `limits` / `quota` / `clamped` / `reused` — เป็นของระยะ 3)
- [x] แอปใช้ผลจาก server · ลบ `loadMatchRoomPool`, `matchLeadRooms`, `summarizeLeadMatch` และสูตรคะแนนฝั่งแอป

### ระยะที่ 3 — ต่อสิทธิ์และโควตา

- [ ] ทำ billing pack ระยะ A ([billing/flow.md §6](../../billing/flow.md#6-ระยะการเปิดใช้)) — ทุกคน `free` แบบสิทธิ์กว้าง
- [ ] ตรวจสิทธิ์ใน §6.2–6.3 · ป้ายโควตาบนปุ่ม · ไอคอนกุญแจในแผ่นตั้งค่า · แผ่นอัปเกรด
- [ ] กดซ้ำค่าเดิมภายใน 10 นาทีคืนผลเดิม (`reused`) + `Idempotency-Key` — นับ `input_hash` และจำนวนห้องที่เปลี่ยนด้วย เพื่อไม่ให้ได้ผลเก่าหลังเพิ่มห้อง
- [ ] เปิดตัวเลือกขั้นสูง: `budgetTolerancePct`, `radiusMultiplier`, `required`
- เสร็จเมื่อ: แก้ตัวเลขในแถว `plans` แล้วแอปล็อก/ปลดล็อกตามทันทีโดยไม่ปล่อยแอปใหม่

### ระยะที่ 4 — ขั้นสูง (หลังเปิดขาย)

- [ ] `weights` · `scope = cobroke` · `autoNotify` (job ตรวจห้องใหม่ที่ตรงกับลีด + push notification)
- [ ] ประวัติการจับคู่และห้องที่เคยเสนอแล้ว
