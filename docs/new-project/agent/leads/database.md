# Agent leads — Database

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| **`rent_room_id`** | int → **rent_rooms** | NULL ได้ — เก็บ Lead ก่อนเลือกห้อง และตั้ง NULL หากห้องถูกลบ |
| `name` | varchar(255) | |
| `phone` | varchar(50) | |
| `email` | varchar(255) NULL | |
| `source` | varchar(64) NULL | ที่มาของ Lead เช่น Facebook / walk-in |
| `desired_room_type_id` | int → master_room_types NULL | ประเภทห้องที่ต้องการ เช่น studio / one_bedroom |
| `budget_min` | decimal(12,2) NULL | งบต่ำสุด บาท/เดือน |
| `budget_max` | decimal(12,2) NULL | งบสูงสุด บาท/เดือน |
| `other_contacts` | jsonb default [] | ช่องทางอื่นหลายช่องทาง เช่น `[ {"channel":"line","value":"@example"} ]` |
| **`status`** | varchar(20) | `new` \| `inprogress` \| `lost` \| `booked` |
| `viewed_at` | timestamptz NULL | legacy (ไม่ bump อัตโนมัติตอนเปิด detail) |
| `lost_reason` | varchar(500) NULL | |
| `notes` | text NULL | |
| **`tenant_id`** | int → tenants NULL | เมื่อ booked |
| `created_by_user_id` | int → users | agent |

**Prerequisite:** [create-room/schema.sql](../create-room/schema.sql) — ตาราง `rent_rooms`

---

## Query

| ใครดู | เงื่อนไข |
|-------|----------|
| Lead ต่อห้อง | `WHERE rent_room_id = ?` |

Partial unique: `(rent_room_id) WHERE status = 'booked'`

---

ดู [README](./README.md) · [schema.sql](./schema.sql) · lead ↔ tenant ใน [flow.md](./flow.md)

## Room seekers (2026-09-08)

A lead can be created before selecting a room: `rent_room_id = NULL`. Name, phone
and the agent (`created_by_user_id`) remain required. Preference fields can be
filled as the requirements become known. A single budget can use `budget_max`;
a range uses both fields. Amounts are monthly THB. Negative amounts, a zero maximum,
NaN and a minimum greater than the maximum are rejected by the database.
`other_contacts` must be a JSON array. The API (`otherContacts`) accepts up to 5
entries; `channel` is one of `line`, `whatsapp`, `wechat`, `facebook`, `telegram`,
`other` and `value` is nonblank text up to 255 characters (trimmed; duplicate
channel + value pairs are dropped, case-insensitive). `email` is optional and must
look like an address. Both are preserved on partial `PATCH` updates; send `[]` /
`null` to clear.

Existing databases: apply [migration](./migrations/20260908-room-seeker-preferences.sql).
The standard Docker schema script includes it. The migration is repeatable and keeps
existing lead data. Removing a linked room no longer deletes the person's lead.
When booking, the future Leads API must require a selected room.

Create Lead, Listing Lead and read-only lead details are now available in the agent mobile Leads tab.


## Full profile (2026-09-08)

Only name and phone are mandatory. Existing budget fields and desired room type are reused.

| User field | Database column | Format |
|---|---|---|
| ชื่อ * / นามสกุล | first_name / last_name | given name required, surname optional (`20260930-lead-tenant-given-names.sql`). `name` is stored as "first last" for search and display; clients that send only `name` get it split on the first space |
| เบอร์ติดต่อ * | phone | required; app sends E.164 (`+66812345678`) from a country picker. API normalizes any "+" value to E.164 and rejects malformed ones; values without "+" are legacy text kept as typed |
| อีเมล | email | optional, valid address |
| ช่องทางติดต่ออื่น | other_contacts | up to 5 `{channel, value}` (LINE, WhatsApp, WeChat, Facebook, Telegram, อื่นๆ) |
| สัญชาติ | nationality | optional text |
| งบประมาณ | budget_min / budget_max | existing monthly THB range |
| โลเคชั่นที่สนใจ | preferred_location | optional free text, one or more areas |
| แพลนย้ายเข้า | move_in_plan | optional text: immediately, month or exact date |
| เลี้ยงสัตว์ | has_pets | nullable boolean |
| อาชีพ | occupation | optional text |
| ประเภทวีซ่า (เฉพาะต่างชาติ) | visa_type_id | optional FK → master_visa_types |
| ระยะเวลาเช่า | lease_duration_months | 3 / 6 / 12 months from master_contract_types |
| ใช้รถ | uses_car | nullable boolean |
| จำนวนผู้พักอาศัย | occupant_count | positive whole number |
| สูบบุหรี่ | is_smoker | nullable boolean |
| ประเภทห้อง | desired_room_type_id | existing room-type foreign key |

NULL boolean values mean not yet specified, never an implicit No.
Apply [profile migration](./migrations/20260908-lead-profile.sql) after the preference migration.

Visa types are a master catalog (`master_visa_types`, codes only). Labels use
`masters.visaTypes.<code>`. Existing databases: apply
[visa-type migration](./migrations/20260908-master-visa-types.sql) after the
profile migration. Rental duration must match an active `master_contract_types.term_months`.

API (authenticated agent):
- GET /api/v1/agent/leads/visa-types: active visa catalog (`id`, `code`).
- POST /api/v1/agent/leads: create a lead; server assigns agent and status=new.
- GET /api/v1/agent/leads?q=&page=1&limit=20: own leads, searchable by name, phone or area. Phone queries ignore spaces/dashes and match Thai local and +66 forms both ways (`081…` ↔ `+6681…`).
- GET /api/v1/agent/leads/:id: own lead details; other agents receive 404.

Mobile: Leads tab → Listing Lead → Create Lead. After save the list refreshes;
tapping a card shows all profile fields. Email and other contact channels are edited
under the phone field; on the lead info page each channel opens its app (mailto, LINE
`line.me/R/ti/p/`, WhatsApp `wa.me/` with Thai `0…` numbers converted to `66…`,
Telegram `t.me/`, Facebook `m.me/` or the pasted profile URL). WeChat and other
channels have no public link, so tapping copies the value; long-press always copies.

### Province and areas
Apply [location migration](./migrations/20260910-lead-locations.sql) before deploying the updated API. Province is optional when no map pin or area is specified; map pins require a canonical Thai province. Existing leads keep a NULL province and their original `preferred_location` text (now additional location details); no province is guessed.

`GET /agent/leads/locations` returns 77 provinces and distinct districts from existing properties, normalizing province names and district prefixes. This is the initial area catalog, not a complete neighborhood catalog. Provinces without property districts remain selectable.

List filters: `province`, `locations` (JSON string array), `includeUnspecified=true`, and `status` (display status, including derived `viewing`; see [api.md](./api.md)). Multiple areas use OR matching; unspecified areas are included only within the selected province. All filters apply before pagination. Legacy leads without a province remain visible in the unfiltered list and text search.

### Ranked search pins (current)
Apply `apps/api/migrations/20260924-lead-locations.sql` (`node apps/api/scripts/apply-lead-locations.cjs --check`, then without `--check`) before deploying the API. It creates `lead_locations` and backfills each existing single pin as rank 1.

- A lead has 0–3 pins in `lead_locations` (`rank` 1–3, unique per lead). The API accepts `pins` as an ordered array; rank = array position. Each pin needs a name, valid coordinates and a Thai province; duplicate `placeId` or identical coordinates are rejected.
- `radius_km` on `leads` (1, 3 or 5) is shared by all pins and required when pins exist; it is NULL otherwise.
- With pins, `leads.province` = rank-1 pin province and `leads.locations` = the pins' districts, so the province/area list filters keep working. Without pins, the legacy `province`/`locations` values are kept as-is (the form shows them as "not pinned yet").
- Create/update write the lead row and replace its pins in one transaction. Responses return `pins` sorted by rank.
- The single-pin columns below (`location_place_id`, `location_name`, `latitude`, `longitude`) are no longer written; drop them after the backfill is verified.
- Matching readiness and distance scoring: see [matching.md](./matching.md) §2.1 / §3.1.

### Google Maps preference pin (legacy, superseded by ranked pins)
Apply [map migration](./migrations/20260910-lead-map.sql) after the province migration. Optional fields: `location_place_id`, `location_name`, `latitude`, `longitude`, `radius_km` (1, 3, or 5). A pin must have a name, both coordinates and radius; otherwise all map fields are NULL. Existing province and free-text data remain intact.

The form reuses Agent Places autocomplete/details. Map taps use the authenticated `/agent/places/reverse` endpoint (Google Geocoding API) to resolve the new province; failures preserve the previous pin. The Google backend key must enable Geocoding API as well as Places API; the existing frontend Maps key renders the interactive map. Radius is straight-line distance, not travel time. The automatically resolved district is saved in `locations` so existing area filters continue to work, and the catalog also includes the current agent's saved areas.

Reference: https://developers.google.com/maps/documentation/geocoding/guides-v3/requests-reverse-geocoding

The create form reserves map space before selection and overlays search results there. Province is read-only and comes from the selected place or reverse geocoding; removing the pin clears it. Leads without a pin can be saved with NULL province, using the existing nullable column.
