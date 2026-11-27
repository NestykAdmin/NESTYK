// Makes the QA contracts of the self owner (plans/2026-11-26-self-owner-contracts-api, Task 4) the way an agent would:
// qa-admin (guest + admin, never agent) stands in the agent's place, qa-self-owner is the landlord, qa-tenant the tenant.
// Rooms A, B and C are the first 3 self owner rooms of qa-self-owner (by id). What is made comes from the pure planner
// scripts/self-owner-contracts-plan.cjs (test/self-owner-contracts-seed.test.cjs); this file only reads and writes.
// Usage (from apps/api):
//   node scripts/db-self-owner-contracts.cjs [--env=.env.api] [--check] [--today=YYYY-MM-DD]
//   --check  read the DB, print the plan and what would be removed, write nothing (read-only transaction; no storage calls)
//   --today  plan relative to this Bangkok day (default: today in Bangkok); keep it close to today, the API checks
//            the broker appointment's age and the renewal window against the real date
// Needs in the env file: DATABASE_URL (local only: 127.0.0.1 / localhost), ALLOW_SELF_OWNER_CONTRACT_SEED=true (opt-in),
//   for a real run also SUPABASE_URL (local only) and SUPABASE_SERVICE_ROLE_KEY (storage, service role);
//   optional TEST_USER_EMAIL_DOMAIN (default nestyk.test), SUPABASE_BUCKET_CONTRACTS (default contract-documents).
// Run scripts/db-test-users.cjs first (qa-admin, qa-self-owner, qa-tenant) and give qa-self-owner 3 rooms in the app.
// Safe to re-run: first deletes the rows of its previous run (contracts with data.seed = "self-owner-contracts" and their
// child rows, then their tenancies, tenants, leads and property owner marked in `note`/`notes`), children before parents,
// in the same transaction as the new rows. Uploads (placeholder attachments, signature PNGs) happen before the commit
// and are removed if it fails; the files of the previous run are removed after the commit (best effort).
const path = require('node:path');
const zlib = require('node:zlib');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '../../..');
const envArg = process.argv.find((a) => a.startsWith('--env='));
require('dotenv').config({
  path: path.resolve(ROOT, envArg ? envArg.slice('--env='.length) : '.env.api'),
  quiet: true,
});
const check = process.argv.includes('--check');
const todayArg = process.argv.find((a) => a.startsWith('--today='))?.slice('--today='.length);

// Registers the .ts loader too (same options as the API tests).
const { planSelfOwnerContracts, assertCreator, assertLocalDatabase, SEED_MARK, ROOMS_NEEDED } = require('./self-owner-contracts-plan.cjs');

const FORM_KINDS = ['lease', 'renewal', 'broker_appointment', 'reservation'];
// SUPABASE_URL (storage, HTTP): the URL's own hostname is what the client connects to.
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

function env(name) {
  return (process.env[name] ?? '').trim().replace(/^['"]|['"]$/g, '');
}

function fail(message) {
  console.error(`db:self-owner-contracts: ${message}`);
  process.exit(1);
}

function hostOf(url, name) {
  try {
    return new URL(url).hostname;
  } catch {
    fail(`${name} is not a URL`);
  }
}

function bangkokToday(at = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

const ident = (name) => `"${String(name).replace(/"/g, '""')}"`;

// ---- small files: a placeholder PDF for the required attachments, a signature PNG ----

async function placeholderPdf(label) {
  const { PDFDocument, StandardFonts } = require('pdf-lib');
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('NESTYK QA placeholder document', { x: 56, y: 760, size: 18, font });
  page.drawText(`${label} - made by scripts/db-self-owner-contracts.cjs, not a real document`, { x: 56, y: 730, size: 10, font });
  return Buffer.from(await doc.save());
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}
/** A 240x80 transparent PNG with a dark ink stroke (a signature-like wave, `seed` varies it). */
function signaturePng(seed) {
  const w = 240;
  const h = 80;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  const ink = (x, y) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const o = py * (w * 4 + 1) + 1 + px * 4;
        raw[o] = 20; raw[o + 1] = 30; raw[o + 2] = 80; raw[o + 3] = 255;
      }
  };
  for (let x = 16; x < w - 16; x++)
    ink(x, Math.round(h / 2 + Math.sin((x + seed * 17) / 11) * 18 * Math.cos((x - seed * 5) / 37)));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- reads ----

async function findUser(db, email) {
  const user = (await db.query(
    'SELECT id, email, first_name, last_name, phone, identity_number, nationality FROM public.users WHERE lower(email) = $1',
    [email],
  )).rows[0];
  if (!user) return null;
  const roles = (await db.query(
    'SELECT r.name FROM public.user_roles ur JOIN public.master_roles r ON r.id = ur.role_id WHERE ur.user_id = $1 ORDER BY r.id',
    [user.id],
  )).rows.map((r) => r.name);
  return { ...user, roles };
}

const personOf = (u) => ({
  firstName: u.first_name, lastName: u.last_name, phone: u.phone, email: u.email,
  identityNumber: u.identity_number, nationality: u.nationality,
});

async function selfOwnerRooms(db, ownerId) {
  return (await db.query(
    `SELECT r.id, r.owner_user_id, r.room_name, r.room_number, r.floor, r.size_sqm,
            p.name AS property, p.address, p.subdistrict, p.district, p.province, p.postal_code,
            price.price, price.advance_rent_months, price.deposit_months, price.term_months
       FROM public.self_owner_rooms r
       JOIN public.properties p ON p.id = r.properties_id
       LEFT JOIN LATERAL (
         SELECT sp.price, sp.advance_rent_months, sp.deposit_months, ct.term_months
           FROM public.self_owner_room_prices sp JOIN public.master_contract_types ct ON ct.id = sp.contract_type_id
          WHERE sp.room_id = r.id
          ORDER BY (ct.term_months = 12) DESC, ct.term_months, sp.id LIMIT 1) price ON true
      WHERE r.owner_user_id = $1
      ORDER BY r.id`,
    [ownerId],
  )).rows;
}

async function activeTemplates(db) {
  const out = {};
  for (const kind of FORM_KINDS) {
    const t = (await db.query(
      `SELECT t.id, t.agreement_type_code, t.form_kind, t.version, t.data_schema
         FROM public.agreement_templates t JOIN public.master_agreement_types a ON a.code = t.agreement_type_code
        WHERE t.is_active AND a.is_active AND t.form_kind = $1 AND a.form_kind = $1
        ORDER BY t.version DESC, t.id DESC LIMIT 1`,
      [kind],
    )).rows[0];
    if (!t) fail(`no active agreement template for form kind "${kind}" (load supabase/seed/masters.sql)`);
    const requirements = (await db.query(
      'SELECT group_key, subject, document_type_code FROM public.agreement_template_document_requirements WHERE template_id = $1 ORDER BY id',
      [t.id],
    )).rows;
    // One file per requirement group (any code of the group completes it); the group's first code.
    const groups = [];
    for (const r of requirements) if (!groups.some((g) => g.group_key === r.group_key)) groups.push(r);
    out[kind] = { ...t, groups };
  }
  return out;
}

/** Rows of the previous run, and every row that points at its contracts. */
async function previousRun(db, adminId) {
  const contracts = (await db.query(
    `SELECT c.id, c.created_by_user_id, c.agreement_kind, c.lead_id, c.tenant_id, c.room_tenancy_id, c.document_url,
            c.invoice_url, c.receipt_url, c.owner_signature_url, c.tenant_signature_url, c.agent_signature_url,
            COALESCE(t.form_kind, a.form_kind) AS form_kind
       FROM public.lease_contracts c
       LEFT JOIN public.agreement_templates t ON t.id = c.template_id
       LEFT JOIN public.master_agreement_types a ON a.code = c.agreement_type_code
      WHERE c.data->>'seed' = $1 ORDER BY c.id`,
    [SEED_MARK],
  )).rows;
  const foreign = contracts.filter((c) => c.created_by_user_id !== adminId);
  if (foreign.length)
    fail(`contracts ${foreign.map((c) => c.id).join(', ')} carry data.seed="${SEED_MARK}" but were not made by qa-admin; not touching them`);
  const ids = contracts.map((c) => c.id);
  const tenants = (await db.query(
    'SELECT id FROM public.tenants WHERE created_by_user_id = $1 AND (note = $2 OR id = ANY($3::int[])) ORDER BY id',
    [adminId, SEED_MARK, contracts.map((c) => c.tenant_id)],
  )).rows.map((r) => r.id);
  const leads = (await db.query(
    'SELECT id FROM public.leads WHERE created_by_user_id = $1 AND (notes = $2 OR id = ANY($3::int[])) ORDER BY id',
    [adminId, SEED_MARK, contracts.map((c) => c.lead_id)],
  )).rows.map((r) => r.id);
  const tenancies = (await db.query(
    'SELECT id FROM public.room_tenancies WHERE created_by_user_id = $1 AND (tenant_id = ANY($2::int[]) OR id = ANY($3::int[])) ORDER BY id',
    [adminId, tenants, contracts.map((c) => c.room_tenancy_id)],
  )).rows.map((r) => r.id);
  const owners = (await db.query(
    'SELECT id FROM public.property_owners WHERE created_by_user_id = $1 AND note = $2 ORDER BY id',
    [adminId, SEED_MARK],
  )).rows.map((r) => r.id);
  // Single-column foreign keys from other tables to lease_contracts (agreement_documents, agreement_signatures, ...).
  const childFks = (await db.query(
    `SELECT format('%I.%I', n.nspname, cl.relname) AS tbl, a.attname AS col, cl.oid AS relid
       FROM pg_constraint k
       JOIN pg_class cl ON cl.oid = k.conrelid JOIN pg_namespace n ON n.oid = cl.relnamespace
       JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
      WHERE k.contype = 'f' AND k.confrelid = 'public.lease_contracts'::regclass
        AND k.conrelid <> 'public.lease_contracts'::regclass AND array_length(k.conkey, 1) = 1
      ORDER BY 1, 2`,
  )).rows;
  const children = [];
  const paths = new Set();
  for (const fk of childFks) {
    if (!ids.length) break;
    const n = Number((await db.query(`SELECT count(*) AS n FROM ${fk.tbl} WHERE ${ident(fk.col)} = ANY($1::int[])`, [ids])).rows[0].n);
    if (n) children.push({ ...fk, rows: n });
  }
  // Storage files of the previous run, removed after the commit (party previews: storePartyPreview's fixed path).
  for (const c of contracts) {
    for (const p of [c.document_url, c.invoice_url, c.receipt_url, c.owner_signature_url, c.tenant_signature_url, c.agent_signature_url])
      if (p) paths.add(p);
    if (c.form_kind) paths.add(`${c.created_by_user_id}/${c.id}/party-preview/${c.form_kind}.pdf`);
  }
  if (ids.length) {
    for (const r of (await db.query('SELECT file_path FROM public.agreement_documents WHERE agreement_id = ANY($1::int[])', [ids])).rows)
      paths.add(r.file_path);
    for (const r of (await db.query('SELECT signature_url FROM public.agreement_signatures WHERE agreement_id = ANY($1::int[]) AND signature_url IS NOT NULL', [ids])).rows)
      paths.add(r.signature_url);
  }
  // Rows that point at those child rows without pointing at a contract would be left dangling by the delete below
  // (it runs with triggers off): refuse instead.
  const childTables = new Set(childFks.map((fk) => fk.relid));
  for (const child of children) {
    const refs = (await db.query(
      `SELECT format('%I.%I', n.nspname, cl.relname) AS tbl, a.attname AS col, cl.oid AS relid,
              (SELECT attname FROM pg_attribute WHERE attrelid = k.confrelid AND attnum = k.confkey[1]) AS refcol
         FROM pg_constraint k
         JOIN pg_class cl ON cl.oid = k.conrelid JOIN pg_namespace n ON n.oid = cl.relnamespace
         JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
        WHERE k.contype = 'f' AND k.confrelid = $1 AND array_length(k.conkey, 1) = 1`,
      [child.relid],
    )).rows.filter((r) => !childTables.has(r.relid) && r.relid !== child.relid);
    for (const ref of refs) {
      const n = Number((await db.query(
        `SELECT count(*) AS n FROM ${ref.tbl} WHERE ${ident(ref.col)} IN (SELECT ${ident(ref.refcol)} FROM ${child.tbl} WHERE ${ident(child.col)} = ANY($1::int[]))`,
        [ids],
      )).rows[0].n);
      if (n) fail(`${n} row(s) of ${ref.tbl} point at ${child.tbl} rows of the previous seed; remove them by hand first`);
    }
  }
  return { contracts, ids, tenants, leads, tenancies, owners, children, paths: [...paths] };
}

async function deletePrevious(db, prev) {
  const ids = prev.ids;
  if (ids.length) {
    // agreement_documents refuses any DELETE (history trigger), so the child rows go with triggers off. Their own
    // children were checked in previousRun; every parent below is deleted with triggers (and foreign keys) on.
    await db.query('SET LOCAL session_replication_role = replica');
    for (const child of prev.children)
      await db.query(`DELETE FROM ${child.tbl} WHERE ${ident(child.col)} = ANY($1::int[])`, [ids]);
    await db.query('SET LOCAL session_replication_role = origin');
    await db.query("UPDATE public.lease_contracts SET root_agreement_id = NULL WHERE id = ANY($1::int[]) AND agreement_kind = 'new'", [ids]);
    await db.query("DELETE FROM public.lease_contracts WHERE id = ANY($1::int[]) AND agreement_kind = 'renewal'", [ids]);
    await db.query('DELETE FROM public.lease_contracts WHERE id = ANY($1::int[])', [ids]);
  }
  if (prev.leads.length) await db.query('UPDATE public.leads SET tenant_id = NULL WHERE id = ANY($1::int[])', [prev.leads]);
  if (prev.tenancies.length) await db.query('DELETE FROM public.room_tenancies WHERE id = ANY($1::int[])', [prev.tenancies]);
  if (prev.tenants.length) await db.query('DELETE FROM public.tenants WHERE id = ANY($1::int[])', [prev.tenants]);
  if (prev.leads.length) await db.query('DELETE FROM public.leads WHERE id = ANY($1::int[])', [prev.leads]);
  if (prev.owners.length) await db.query('DELETE FROM public.property_owners WHERE id = ANY($1::int[])', [prev.owners]);
}

// ---- main ----

async function main() {
  const dbUrl = env('DATABASE_URL');
  if (env('ALLOW_SELF_OWNER_CONTRACT_SEED') !== 'true')
    fail('ALLOW_SELF_OWNER_CONTRACT_SEED=true is not set in the env file (local DB only, never set it for dev/prod)');
  if (!dbUrl) fail('DATABASE_URL is required');
  // What pg will connect to (its own parser: ?host= / ?hostaddr= / ?port= override the URL's host and port).
  let target;
  try {
    target = assertLocalDatabase(dbUrl);
  } catch (error) {
    fail(`${error.message}; this seed runs only against the local DB (127.0.0.1:54422)`);
  }
  const supaUrl = env('SUPABASE_URL');
  if (!check) {
    if (!supaUrl || !env('SUPABASE_SERVICE_ROLE_KEY')) fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (contract storage)');
    if (!LOCAL_HOSTS.has(hostOf(supaUrl, 'SUPABASE_URL')))
      fail(`SUPABASE_URL points at ${hostOf(supaUrl, 'SUPABASE_URL')}; uploads go only to the local Supabase`);
  }
  const today = todayArg ?? bangkokToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) fail('--today must be YYYY-MM-DD');
  const domain = (env('TEST_USER_EMAIL_DOMAIN') || 'nestyk.test').toLowerCase();

  console.log(`Target: ${target.host}:${target.port}${check ? ' (check only, read-only transaction)' : ''} · today ${today}`);
  // reflect-metadata before the services (their decorators read it). Agent helpers: contract numbers and contract terms.
  require('reflect-metadata');
  const { nextContractNo, formatContractNo, parseContractSeq, contractNoPrefix, validateContract } =
    require('../src/agent/contracts/agent-contracts.service.ts');

  const db = new Client({ connectionString: dbUrl, ssl: false });
  await db.connect();
  const uploaded = [];
  let storage = null;
  try {
    await db.query(check ? 'BEGIN READ ONLY' : 'BEGIN');
    await db.query("SET LOCAL lock_timeout = '10s'");
    await db.query("SET LOCAL statement_timeout = '120s'");

    const emails = { admin: `qa-admin@${domain}`, owner: `qa-self-owner@${domain}`, tenant: `qa-tenant@${domain}` };
    const admin = await findUser(db, emails.admin);
    const owner = await findUser(db, emails.owner);
    const tenant = await findUser(db, emails.tenant);
    const missing = Object.entries({ admin, owner, tenant }).filter(([, u]) => !u).map(([k]) => emails[k]);
    if (missing.length) fail(`not found: ${missing.join(', ')} (run: node scripts/db-test-users.cjs)`);
    try {
      assertCreator(admin.roles);
    } catch (error) {
      fail(`${emails.admin} (roles ${admin.roles.join(',') || '-'}): ${error.message}`);
    }
    if (!owner.roles.includes('self_owner'))
      console.warn(`Warning: ${emails.owner} has no self_owner role (roles ${owner.roles.join(',') || '-'}); /contracts/mine will refuse it`);
    if (!tenant.roles.includes('tenant'))
      console.warn(`Warning: ${emails.tenant} has no tenant role (roles ${tenant.roles.join(',') || '-'})`);
    console.log(`Creator ${emails.admin} id=${admin.id} [${admin.roles.join(',')}] · owner ${emails.owner} id=${owner.id} · tenant ${emails.tenant} id=${tenant.id}`);

    const roomRows = await selfOwnerRooms(db, owner.id);
    const labels = ['A', 'B', 'C'];
    if (roomRows.length < ROOMS_NEEDED) {
      console.table(roomRows.map((r, i) => ({ room: labels[i], id: r.id, name: r.room_name, number: r.room_number, property: r.property })));
      fail(`${emails.owner} has ${roomRows.length} self owner room(s); missing: ${labels.slice(roomRows.length, ROOMS_NEEDED).map((l) => `room ${l}`).join(', ')}. ` +
        `Add rooms in the app as qa-self-owner (ห้องของฉัน), then run again.`);
    }
    const chosen = roomRows.slice(0, ROOMS_NEEDED);
    const unpriced = chosen.filter((r) => r.price == null).map((r, i) => `room ${labels[roomRows.indexOf(r)]} (id ${r.id})`);
    if (unpriced.length) fail(`no rent price on ${unpriced.join(', ')}; set a price in the app first`);
    const rooms = chosen.map((r) => ({
      id: r.id,
      ownerUserId: r.owner_user_id,
      roomNumber: r.room_number,
      roomName: r.room_name,
      property: r.property,
      address: [r.address, r.subdistrict, r.district, r.province, r.postal_code].filter((part) => part && part !== '-').join(' '),
      floor: r.floor ?? '',
      area: r.size_sqm != null ? String(Number(r.size_sqm)) : '',
      monthlyRent: Number(r.price),
      advanceMonths: r.advance_rent_months,
      depositMonths: r.deposit_months,
    }));

    const templates = await activeTemplates(db);
    const endReason = (await db.query(
      "SELECT id FROM public.master_contract_end_reasons WHERE code = 'term_completed' AND applicable_status = 'expired' AND is_active",
    )).rows[0];
    if (!endReason) fail('master_contract_end_reasons has no active term_completed (load supabase/seed/masters.sql)');

    const prev = await previousRun(db, admin.id);
    // A room tenancy of someone else would break "one active tenancy per room" on insert: say so before writing.
    const busy = (await db.query(
      `SELECT self_owner_room_id, id FROM public.room_tenancies
        WHERE status = 'active' AND self_owner_room_id = ANY($1::int[]) AND NOT (id = ANY($2::int[]))`,
      [rooms.map((r) => r.id), prev.tenancies],
    )).rows;
    if (busy.length) fail(`self owner room(s) ${busy.map((b) => b.self_owner_room_id).join(', ')} already have an active tenancy (${busy.map((b) => b.id).join(', ')}) not made by this seed`);

    // property_owners is unique per (creator, phone): a row of qa-admin with the owner's phone not made by this seed.
    const ownerPhone = owner.phone || '0990000004';
    const clash = (await db.query(
      'SELECT id FROM public.property_owners WHERE created_by_user_id = $1 AND phone = $2 AND NOT (id = ANY($3::int[]))',
      [admin.id, ownerPhone, prev.owners],
    )).rows[0];
    if (clash) fail(`property_owners ${clash.id} of ${emails.admin} already has phone ${ownerPhone} (not made by this seed)`);

    const input = {
      adminId: admin.id,
      ownerUserId: owner.id,
      tenantUserId: tenant.id,
      rooms,
      today,
      people: { admin: personOf(admin), owner: personOf(owner), tenant: personOf(tenant) },
      schemas: Object.fromEntries(FORM_KINDS.map((k) => [k, templates[k].data_schema])),
    };
    // Contract numbers the way saveDraft takes them (nextContractNo, advisory lock held to the end of the transaction);
    // several of one prefix in one transaction count up from the first.
    const draft = planSelfOwnerContracts(input);
    const manager = { query: async (sql, params) => (await db.query(sql, params)).rows };
    const last = {};
    const contractNos = [];
    for (const c of draft.contracts) {
      const prefix = contractNoPrefix(c.formKind);
      const no = last[prefix] ? formatContractNo(prefix, Number(last[prefix].slice(2, 6)), parseContractSeq(last[prefix]) + 1) : await nextContractNo(manager, c.formKind);
      last[prefix] = no;
      contractNos.push(no);
    }
    const plan = planSelfOwnerContracts({ ...input, contractNos });
    // The agent's own check of the contract terms (saveDraft's validateContract), for every planned row.
    for (const c of plan.contracts)
      validateContract({
        leadId: 1, startDate: c.start_date,
        ...(c.formKind === 'reservation' ? { moveInDate: c.move_in_date, reservationFee: Number(c.reservation_fee) } : {}),
        ...(['lease', 'renewal'].includes(c.formKind) ? { endDate: c.end_date, monthlyRent: Number(c.monthly_rent), deposit: Number(c.deposit) } : {}),
      }, c.formKind);

    console.log(`Rooms: ${rooms.map((r, i) => `${labels[i]}=${r.id} (${r.property ?? r.roomName} ${r.roomNumber ?? ''}, ${r.monthlyRent})`).join(' · ')}`);
    console.log(`Previous run to remove: ${prev.ids.length} contract(s)${prev.children.length ? ` + ${prev.children.map((c) => `${c.tbl}=${c.rows}`).join(' ')}` : ''}, ` +
      `${prev.tenancies.length} tenancies, ${prev.tenants.length} tenants, ${prev.leads.length} leads, ${prev.owners.length} property owner(s), ${prev.paths.length} storage file(s)`);
    console.table(plan.contracts.map((c, i) => ({
      no: contractNos[i],
      demo: c.demo ?? '(extra)',
      kind: c.formKind,
      status: c.status,
      room: labels[c.roomIndex],
      tenant: plan.tenants[c.tenantIndex].name,
      start: c.start_date,
      end: c.end_date ?? c.move_in_date ?? '',
      signed: c.signatures.map((s) => s.party).join(',') || '-',
      documents: templates[c.formKind].groups.map((g) => `${g.subject}:${g.document_type_code}`).join(' ') || '-',
    })));
    console.log(`Also: 1 property owner, ${plan.leads.length} leads, ${plan.tenants.length} tenants, ${plan.tenancies.length} tenancies (${plan.tenancies.map((t) => `${labels[t.roomIndex]}:${t.status}`).join(' ')})`);

    if (check) {
      await db.query('ROLLBACK');
      console.log('Check only: nothing written, no storage calls.');
      return;
    }

    await deletePrevious(db, prev);

    const po = plan.propertyOwner;
    const propertyOwnerId = (await db.query(
      `INSERT INTO public.property_owners (name, phone, email, note, created_by_user_id, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [po.name, po.phone, po.email, po.note, po.created_by_user_id, po.user_id],
    )).rows[0].id;
    const leadIds = [];
    for (const l of plan.leads)
      leadIds.push((await db.query(
        `INSERT INTO public.leads (name, first_name, last_name, phone, email, nationality, status, notes, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [l.name, l.first_name, l.last_name, l.phone, l.email, l.nationality, l.status, l.notes, l.created_by_user_id],
      )).rows[0].id);
    const tenantIds = [];
    for (const t of plan.tenants)
      tenantIds.push((await db.query(
        `INSERT INTO public.tenants (lead_id, name, first_name, last_name, phone, email, note, identity_number, nationality, user_id, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [leadIds[t.leadIndex], t.name, t.first_name, t.last_name, t.phone, t.email, t.note, t.identity_number, t.nationality, t.user_id, t.created_by_user_id],
      )).rows[0].id);
    for (const [i, l] of plan.leads.entries())
      await db.query('UPDATE public.leads SET tenant_id = $2 WHERE id = $1', [leadIds[i], tenantIds[l.tenantIndex]]);
    const tenancyIds = [];
    for (const t of plan.tenancies)
      tenancyIds.push((await db.query(
        `INSERT INTO public.room_tenancies (rent_room_id, self_owner_room_id, tenant_id, status, move_in_date, move_out_date, created_by_user_id)
         VALUES (NULL, $1, $2, $3, $4, $5, $6) RETURNING id`,
        [t.self_owner_room_id, tenantIds[t.tenantIndex], t.status, t.move_in_date, t.move_out_date, t.created_by_user_id],
      )).rows[0].id);

    // Contracts go in unsigned (awaiting_signatures) so the required documents can be attached (the history trigger
    // takes attachments only while a contract is open), then take their signatures and final status in one update,
    // which passes the signing gate (require_agreement_documents_before_signing) because the documents are there.
    const contractIds = [];
    for (const [i, c] of plan.contracts.entries()) {
      const template = templates[c.formKind];
      const id = (await db.query(
        `INSERT INTO public.lease_contracts (contract_no, template_id, agreement_type_code, data, party_snapshot, agreement_kind,
           previous_agreement_id, root_agreement_id, lead_id, tenant_id, rent_room_id, self_owner_room_id, room_tenancy_id,
           property_owner_id, owner_user_id, owner_delivered_at, tenant_delivered_at, created_by_user_id, start_date, end_date,
           move_in_date, reservation_fee, monthly_rent, deposit, notes, status)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, NULL, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24,
           'awaiting_signatures') RETURNING id`,
        [contractNos[i], template.id, template.agreement_type_code, JSON.stringify(c.data), JSON.stringify(c.party_snapshot), c.agreement_kind,
          c.previousIndex == null ? null : contractIds[c.previousIndex], c.rootIndex == null ? null : contractIds[c.rootIndex],
          leadIds[c.leadIndex], tenantIds[c.tenantIndex], c.self_owner_room_id, tenancyIds[c.tenancyIndex], propertyOwnerId,
          c.owner_user_id, c.owner_delivered_at, c.tenant_delivered_at, c.created_by_user_id, c.start_date, c.end_date, c.move_in_date,
          c.reservation_fee, c.monthly_rent, c.deposit, c.notes],
      )).rows[0].id;
      if (c.rootIndex == null) await db.query('UPDATE public.lease_contracts SET root_agreement_id = id WHERE id = $1', [id]);
      contractIds.push(id);
    }

    // Storage the way the API stores it: ContractDocumentStorageService (bucket SUPABASE_BUCKET_CONTRACTS, paths
    // <adminId>/<contractId>/attachments/... and .../signatures/..., signatures normalised by validateSignaturePng).
    const { ContractDocumentStorageService } = require('../src/agent/contracts/contract-document-storage.service.ts');
    storage = new ContractDocumentStorageService();
    let documents = 0;
    let signatureCount = 0;
    for (const [i, c] of plan.contracts.entries()) {
      const id = contractIds[i];
      for (const g of templates[c.formKind].groups) {
        const pdf = await placeholderPdf(`${contractNos[i]} ${g.subject} ${g.document_type_code}`);
        const stored = await storage.uploadAttachment(admin.id, id, { buffer: pdf, size: pdf.length });
        uploaded.push(stored.path);
        await db.query(
          `INSERT INTO public.agreement_documents (agreement_id, document_type_code, subject, file_path, file_name, mime_type, byte_size,
             uploaded_by_user_id, review_status, reviewed_by_user_id, reviewed_at, review_note)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'accepted', $8, now(), $9)`,
          [id, g.document_type_code, g.subject, stored.path, `qa-${g.subject}-${g.document_type_code}.pdf`, stored.mimeType, stored.size,
            admin.id, 'QA placeholder (scripts/db-self-owner-contracts.cjs)'],
        );
        documents += 1;
      }
      const patch = { status: c.status };
      const signatureRows = [];
      for (const [k, s] of c.signatures.entries()) {
        const png = signaturePng(i * 7 + k);
        const stored = await storage.uploadSignature(admin.id, id, { buffer: png, size: png.length });
        uploaded.push(stored.path);
        patch[`${s.party}_signed_at`] = s.signedAt;
        patch[`${s.party}_signature_url`] = stored.path;
        signatureRows.push([id, s.party, s.channel, s.signedByUserId, stored.path, s.signedAt]);
      }
      if (c.end) {
        patch.end_reason_id = endReason.id;
        patch.effective_end_date = c.end.effectiveEndDate;
        patch.end_recorded_at = c.end.recordedAt;
      }
      const keys = Object.keys(patch);
      if (keys.length > 1 || c.status !== 'awaiting_signatures')
        await db.query(
          `UPDATE public.lease_contracts SET ${keys.map((k, n) => `${ident(k)} = $${n + 2}`).join(', ')}, updated_at = now() WHERE id = $1`,
          [id, ...keys.map((k) => patch[k])],
        );
      for (const r of signatureRows) {
        await db.query(
          `INSERT INTO public.agreement_signatures (agreement_id, party, channel, signed_by_user_id, signature_url, signed_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          r,
        );
        signatureCount += 1;
      }
    }
    await db.query('COMMIT');
    uploaded.length = 0;

    let removed = 0;
    for (const p of prev.paths) {
      if (await storage.remove(p).then(() => true, () => false)) removed += 1;
    }
    console.table(plan.contracts.map((c, i) => ({
      id: contractIds[i], no: contractNos[i], demo: c.demo ?? '(extra)', kind: c.formKind, status: c.status, room: labels[c.roomIndex],
    })));
    console.log(`Committed: ${contractIds.length} contracts, ${documents} attachments, ${signatureCount} signatures, ` +
      `${tenancyIds.length} tenancies, ${tenantIds.length} tenants, ${leadIds.length} leads, property owner ${propertyOwnerId}. ` +
      `Removed ${removed}/${prev.paths.length} file(s) of the previous run.`);
    console.log(`Count: SELECT count(*) FROM lease_contracts WHERE data->>'seed' = '${SEED_MARK}';  -> ${contractIds.length}`);
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    if (uploaded.length && storage) {
      for (const p of uploaded) await storage.remove(p).catch(() => undefined);
      console.error(`Rolled back; removed ${uploaded.length} uploaded file(s) (best effort).`);
    }
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error('db:self-owner-contracts failed:', error.code ? `${error.code} ${error.message}` : error.message);
  process.exitCode = 1;
});
