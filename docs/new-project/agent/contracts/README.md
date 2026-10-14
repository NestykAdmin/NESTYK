# Agent — สัญญาเช่า (contracts)

| ฟิลด์ | ค่า |
|-------|-----|
| สถานะ | API รายการ / รายละเอียด / ฉบับร่างพร้อมโค้ดใช้งาน · การลงนามยังเป็น blueprint |
| โหมด | Agent `/agent` |
| รายการ | `/agent/contracts` |
| สร้าง | `/agent/contracts/create` |
| Role | `agent` |

**Tenant** = ผู้เช่าที่ทำสัญญา (สร้างจาก [lead booked](../leads/README.md))  
สัญญาอ้าง **`room_tenancies`** + **`lease_contracts`**

**Prerequisite:** [roles](../../roles/README.md) · [create-room](../create-room/README.md) · **[leads](../leads/README.md)**

---

## Lead → Tenant → Contract

```
leads (10 คนดูห้อง)
  └─ 1 คน status = booked + tenant_id
         └─ tenants (ชื่อซ้ำจาก lead)
                └─ room_tenancies → lease_contracts
```

- **Lead ที่ทำสัญญา:** ยังอยู่ใน `leads` · `status = booked` · มีชื่อ contact
- **Tenant:** แถวใหม่ 1:1 กับ lead (`tenants.lead_id`)

---

## เอกสาร

| ไฟล์ | อ่านเมื่อ |
|------|-----------|
| [flow.md](./flow.md) | สร้างจาก lead/tenant, สถานะสัญญา |
| [api.md](./api.md) | endpoints |
| [database.md](./database.md) | tenants, room_tenancies, lease_contracts |
| [schema.sql](./schema.sql) | DDL (หลัง leads/schema.sql) |

---

## Bootstrap

```bash
psql "$DATABASE_URL" -f docs/new-project/roles/schema.sql
psql "$DATABASE_URL" -f docs/new-project/agent/create-room/schema.sql
psql "$DATABASE_URL" -f docs/new-project/agent/leads/schema.sql
psql "$DATABASE_URL" -f docs/new-project/agent/contracts/schema.sql
```

---

## คำศัพพ์

| คำ | ตาราง |
|----|--------|
| **Lead** | `leads` — ทุกคนที่มาดู (รวม booked) |
| **Tenant** | `tenants` — เฉพาะคนทำสัญญา |
| **Tenant (app role)** | `users` + role `tenant` — ผู้เช่าที่ claim แอป |

## Implementation: tenant-first workspace

The agent tab is now **ผู้เช่า / Clients**. It lists tenants promoted from leads,
including tenants with no contracts. Cards group contracts by tenant ID, support
search/status filters, and show active contracts ending within 30 days. Detail has
Overview and Contracts tabs. Payment data is not available and is not simulated.

Create tenant (booking a room): on the Clients tab select an eligible Lead → select a
managed room, or press "จองห้องนี้" on a Lead's matched-room page. Both open the same
confirmation sheet (`ReserveRoomSheet`): it shows the Lead and the room, asks for the
email and ID number the reservation letter needs, and keeps name, phone, nationality
and note (copied from the Lead) behind an edit link. Confirming creates the tenant and
links `leads.tenant_id`, `leads.rent_room_id`, and `leads.status = booked` atomically.
Original Lead contact fields are preserved. Duplicate promotions are rejected under
a Lead row lock, and a room another Lead has booked is rejected with 409
`ROOM_ALREADY_BOOKED` (checked in the transaction; the `uq_leads_one_booked_per_room`
index catches a race). This does not create a contract or activate occupancy. While
the tenant has no contract, the tenant page offers "ทำหนังสือจอง" as the next step,
which opens the reservation letter form directly.

Tenant API (agent-authenticated and scoped to the current agent):
- `GET /agent/tenants`: tenant cards and their contracts.
- `GET /agent/tenants/:id`: tenant detail.
- `GET /agent/tenants/leads?q=`: up to 30 searchable eligible leads; excludes lost
  leads and leads already linked to tenants.
- `GET /agent/tenants/rooms?q=&leadId=&roomId=`: up to 30 searchable rooms managed by
  this agent, each with `viewed` and `bookedBy` (name of the Lead that booked it, or
  null). `leadId` lists the rooms that Lead has a non-cancelled viewing for first;
  `roomId` includes that room even when it is not among the latest 30.
- `POST /agent/tenants`: `{leadId, rentRoomId, name, phone, email?, note?}`; 409
  `ROOM_ALREADY_BOOKED` when another Lead has already booked the room.

Contracts are created inside tenant detail using `GET /agent/contracts`,
`GET /agent/contracts/:id`, and `POST /agent/contracts`. The form uses the selected
tenant's Lead automatically. It requires start/end dates, positive monthly rent,
and non-negative deposit; notes are optional. Creation locks the Lead and room,
rejects overlapping non-closed contracts (including drafts), and writes a prospect
tenancy and draft contract in one transaction. Signing dates come from stored data.

The existing schema above supports this change; no schema migration is required.
The separate `/agent/leads/:id/book` blueprint endpoint remains unimplemented;
the tenant creation endpoint now handles promotion from this workspace.
Document generation, online signature submission/verification, payment transitions,
and draft editing remain future work.

Validation: `npm run test:agent-tenants --workspace=@nestyk/api` covers tenant and
contract validation, promotion/transaction behavior with test doubles, grouping,
access scoping, and HTTP authentication/role checks. It does not replace a full
PostgreSQL integration test. No sample rows are inserted into the live database.

## Agreement type master (2026-09-11)

`master_agreement_types` is the document-type catalog, separate from the existing
`master_contract_types` rental-duration catalog. Initial codes: `reservation`
(หนังสือจองห้อง) and `lease` (สัญญาเช่า). `GET /agent/contracts/types` returns active
rows ordered by `sort_order` then ID; the picker loads this API with loading/error
and retry states. `code` is a stable FK; labels, icons, sorting and activation may
change independently. New categories can reuse `form_kind` reservation/lease;
a genuinely new form needs matching UI/server validation and an extended constraint.

`lease_contracts.agreement_type_code` references the master and defaults existing
records to `lease`. The old duration `contract_type_code` remains unchanged.
Reservation drafts use `start_date`/`end_date` as booking date/expiry and store money
in `reservation_fee`; monthly rent and deposit stay null. The lease flow stores
rent/deposit. A person's reservation does not block that same person's subsequent
lease; conflicting agreements for other tenants remain blocked. A reservation
alone never makes the client status “ผู้เช่าแล้ว”. Agents can proxy-sign every
party from the contract detail sheet.

Migration: `node apps/api/scripts/apply-agreement-types.cjs` (repository root).
Agent signatory: `node apps/api/scripts/apply-agent-signed-at.cjs`.
Reservation documents: `node apps/api/scripts/apply-reservation-documents.cjs`.
Proxy signatures: `node apps/api/scripts/apply-contract-signatures.cjs`.
Contract numbers: `node apps/api/scripts/apply-contract-numbers.cjs`.
Use `--check` to execute then roll back; the migration is idempotent, transactional,
uses configured `DB_SCHEMA`, and has lock/statement timeouts. The master has RLS
and is accessed through the role-guarded server API, not direct client table reads.

Contract numbers are auto-assigned on create as `RSYYYY#####` (reservation) or
`LSYYYY#####` (lease), using the Bangkok calendar year and a per-prefix yearly
sequence under a transaction advisory lock. Renewals receive a new number. Existing
null rows are backfilled by the migration script above.

## Versioned templates and renewals (2026-09-15)

Contract ending reasons, deposit reconciliation and renewal carries are documented
in [contract-end-deposits.md](./contract-end-deposits.md), including the migration
and verification commands. This supplements the existing renewal chain below.

Current implementation supersedes the older blueprint descriptions above.

- `master_agreement_types` remains the type catalog. `agreement_templates` stores
  immutable numbered versions with a JSON Schema (draft-07), frozen `form_kind`,
  display name and document renderer key. Only activation can change in place;
  changing the schema/name/renderer requires a new version.
- `lease_contracts` remains the shared physical table for API compatibility.
  Each new contract pins `template_id`, stores schema-validated `data` JSONB and
  a `party_snapshot` of the names/contact details available at creation. The
  existing date/money columns remain authoritative for overlap checks and billing;
  the server copies their validated values into JSON, overriding caller duplicates.
  Existing rows receive v1 and data backfill. Historical identity snapshots cannot
  be reconstructed, so legacy rows retain their existing live display fallback.
- New contracts set `agreement_kind = new` and `root_agreement_id = id`.
  Renewals set `agreement_kind = renewal`, `previous_agreement_id` to their direct
  predecessor, and `root_agreement_id` to the first contract. Legacy
  `original_contract_id` is preserved unchanged and is not guessed into either new
  relation. Review legacy links separately if historical renewal chains exist.
- Renewal is available for active/expired leases with a known end date. Tenant,
  lead and room must match. The new start must be strictly after the old end.
  It creates a new draft with new signatures, current identity snapshot and a
  selected active template version. It never changes the original contract.
  Lead/room/predecessor locks plus a partial unique index prevent duplicate
  successors; a cancelled successor permits a replacement draft.
- UI: contract detail → **ต่ออายุสัญญา**; prefill rent/deposit/notes, suggest the next
  start date, require a new end date, choose the template version, review and save.
  **ดูประวัติสัญญา** lists the scoped chain and opens each detail.
- Additional template fields are rendered from top-level JSON Schema properties
  using `title`, `type`, `enum`, and `required`. Current generic controls support
  strings, numbers, integers and booleans. Nested objects/arrays and new business
  workflows require additional UI work; adding a master row alone does not
  implement a new workflow. Backend validation uses Ajv and does not coerce types.
- Document generation remains the reservation `reservation/mock-v2` test renderer;
  unsupported renderer keys fail explicitly. This change does not introduce a
  production lease/renewal PDF or change the existing three-party signature model.

API additions (all under the existing agent authentication/ownership rules):
- `GET /agent/contracts/types/:code/templates`: active versions, newest first.
- `POST /agent/contracts`: accepts optional `templateId`, `data`,
  `previousAgreementId`. If no template is specified, selects latest active.
- `GET /agent/contracts/:id/history`: contracts sharing the same root, scoped to
  the requesting agent. Existing list/detail payloads include template and lineage.

Migration: `node apps/api/scripts/apply-agreement-templates.cjs`.
Run `--check` first for a transactional rollback check. Apply before deploying API
code; old writers must be upgraded because new rows require a pinned template.

Validation:
- `npm run test:agent-tenants --workspace=@nestyk/api`
- `RUN_AGREEMENT_DB_TEST=1 node --test apps/api/test/agreement-renewals.integration.cjs`
  clones local table structures into a disposable schema, copies no user rows,
  verifies migration/backfill, concurrent renewal creation, pinned versions,
  immutable templates, identity snapshot and history scoping, then drops the schema.

## Supporting documents (2026-09-15)

Physical tables:
- `master_document_types`: national ID, passport, ownership proof, power of
  attorney and other attachments.
- `agreement_template_document_requirements`: one row per allowed type in a
  requirement group, pinned to a template. Alternatives in a group use OR; every
  group must have a current, accepted document. Groups distinguish tenant, owner
  and property. Once a contract uses a template its requirements cannot change.
- `agreement_documents`: immutable file metadata, subject, uploader/time, source
  and replacement links, and a one-time review decision with reviewer/time/note.
  Each file is a separate row; multiple files per agreement are supported.

The attachment migration and `20260915-ownership-proof-reservation.sql` publish new active template versions:
- Lease: tenant identity and lessor identity (national ID OR passport for each).
- Room reservation letter: property ownership proof.

The apply script runs both migrations. Re-running does not create extra versions.

Earlier lease template versions become inactive for new creation. Existing
contracts retain their pinned version and checklist; historical signatures are
not retroactively invalidated. They may attach optional supporting documents
while still unsigned. Power of attorney/representative files are optional; this
catalog is a product checklist, not a determination of legal sufficiency.
When publishing future versions, explicitly copy or define their requirements.

Detail now contains **เอกสารประกอบสัญญา** with a completeness checklist, subject/type
selection, upload, preview, accepted/rejected review with notes, replacement upload,
and historical revisions. PDF/JPEG/PNG files are limited to 10 MB each. The server
checks content signatures, assigns unique object paths, rejects public storage
buckets, and issues fresh signed URLs only after checking agent ownership. Lists
never include storage paths or permanent public links. Agent review is a recorded
manual check; it does not authenticate government documents automatically.

Lease contracts also support a temporary **เอกสารสัญญาเช่า** upload (`lease_agreement`)
stored on `document_url` until system-generated lease PDFs exist. Reservation
contracts keep using the same column for the reservation letter mock/generated PDF.
Invoice and receipt uploads remain reservation-only.

A rejected file must be replaced with a new revision before it can be accepted;
review decisions cannot be overwritten. Replacement preserves all previous files.
Once any party signs, attachments and reviews freeze. SQL triggers lock the parent
contract during document mutations, enforce history preservation, and block the
first signature if required groups are incomplete. The API also checks before
uploading a signature to give a readable error. Closed contracts cannot be changed.

For renewal, the agent can select an accepted current document from the direct
predecessor and explicitly confirm that it is still current. The server checks
ownership and matching tenant/room, copies the file to a new private object, and
records `source_document_id`. The new copy starts pending and needs a fresh review.
Nothing is reused automatically. No delete endpoint or public document API is added.

API (all agent-authenticated, scoped to the contract creator):
- `GET /agent/contracts/:id/attachments`: checklist, revisions, available types,
  reusable predecessor documents and editability.
- `POST /agent/contracts/:id/attachments`: multipart `file`, `subject`,
  `documentTypeCode`, optional `supersedesDocumentId`.
- `GET /agent/contracts/:id/attachments/:documentId/url`: temporary private URL.
- `POST /agent/contracts/:id/attachments/:documentId/review`: `{status, note?}`,
  status is `accepted` or `rejected`.
- `POST /agent/contracts/:id/attachments/reuse`: `{sourceDocumentId, confirmedCurrent:true}`.

Apply: `node apps/api/scripts/apply-agreement-attachments.cjs --check`, then run
without `--check`. Prerequisite: agreement templates/renewals migration.

Verified with the agent/contract suite (including `agreement-attachments.test.cjs`),
API build, consumer TypeScript check, and the disposable PostgreSQL integration
suite extended to cover document alternatives, scoped URLs, reviewed replacements,
cleanup on failed saves, renewal copying, immutable requirements and signing locks.

### Agent-operated signing and attachments

The agent uploads supporting files and signs on behalf of the tenant, owner and
agent. Each party retains separate signature fields. Inviting other users to sign
is a future workflow, not part of the current implementation.

Required groups are complete once a current, non-removed file matches the subject
and an allowed document type. Legacy review metadata does not gate signing or
reuse. `20260915-attachments-without-review.sql` runs after attachment removal in
the apply script and applies the same rule in PostgreSQL. Authorization, required
file checks, supersession history and the first-signature editing lock remain.

The app shows View and Upload again for required files. Additional files display
only their names and an accessible remove button while the agreement is editable.
Multiple additional uploads are independent. The old-version viewer is hidden.

`DELETE /agent/contracts/:id/attachments/:documentId` marks one current optional
file as removed after checking agent ownership and locking the agreement. Required
checklist files use replacement instead. Removed files cannot be opened, reused,
reviewed or used to satisfy a checklist, and removing a replacement never revives
its older file. Revision records remain stored internally.
