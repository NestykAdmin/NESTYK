const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true } }).outputText, filename);
const { ContractArchiveService, archiveOptions } = require('../src/agent/contracts/contract-archive.service.ts');
const { ContractArchiveController } = require('../src/agent/contracts/contract-archive.controller.ts');
const { AuthGuard } = require('../src/auth/guards/auth.guard.ts');
const { RolesGuard } = require('../src/auth/guards/roles.guard.ts');
const { AuthService } = require('../src/auth/auth.service.ts');
const { Module } = require('@nestjs/common'), { NestFactory } = require('@nestjs/core');
const types = ['reservation', 'lease', 'renewal', 'broker_appointment', 'booking_invoice', 'invoice', 'receipt', 'agent_commission'];
test('archive query validation rejects arrays, unknown types, invalid pagination and control characters', () => {
  assert.deepEqual(archiveOptions({ type: 'lease' }), { type: 'lease', q: '', page: 1, limit: 20 });
  for (const type of types) assert.equal(archiveOptions({ type }).type, type);
  for (const query of [{}, { type: ['lease', 'receipt'] }, { type: 'other' }, { type: 'lease', page: '0' }, { type: 'lease', page: '1.5' }, { type: 'lease', limit: '51' }, { type: 'lease', q: ['a', 'b'] }, { type: 'lease', q: '\0' }, { type: 'lease', other: 'x' }]) assert.throws(() => archiveOptions(query), { status: 400 });
});
test('contract detail reuses existing signature rules and signs no financial paths', async () => {
  const row = { id: 1, kind: 'contract', type: 'renewal', document_no: 'RN-1', person: 'Demo', issue_date: '2026-10-01', status: 'expired', amount: '15000' };
  const service = new ContractArchiveService({ query: async (_, args) => { assert.deepEqual(args, [7, 'contract', 1]); return [row]; } },
    { view: async (agent, id) => { assert.equal(agent, 7); assert.equal(id, 1); return { leaseDocumentUrl: null }; } }, { signPaths: () => assert.fail('Must reuse existing detail') });
  const result = await service.detail(7, 'contract', 1);
  assert.equal(result.documentUrl, null); assert.equal(result.amount, 15000); assert.equal(result.status, 'expired');
});
test('archive HTTP and PostgreSQL: categories, pagination, literal search, receipt identity, agent isolation', { skip: process.env.RUN_ARCHIVE_DB_TEST !== '1', timeout: 60000 }, async t => {
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env.api'), quiet: true });
  const { Client } = require('pg'), { DataSource } = require('typeorm');
  const scratch = `archive_test_${Date.now()}_${process.pid}`;
  const ssl = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false };
  const admin = new Client({ connectionString: process.env.DATABASE_URL, ssl });
  const db = new DataSource({ type: 'postgres', url: process.env.DATABASE_URL, ssl, schema: scratch, entities: [], extra: { options: `-c search_path=${scratch}`, statement_timeout: 10000 } });
  let app; const previous = process.env.ALLOW_DEV_AUTH;
  await admin.connect();
  try {
    await admin.query(`CREATE SCHEMA "${scratch}"`); await db.initialize();
    assert.equal((await db.query('SELECT current_schema() AS name'))[0].name, scratch);
    await db.query(`
      CREATE TABLE agreement_templates(id INT PRIMARY KEY, form_kind TEXT);
      CREATE TABLE master_agreement_types(code TEXT PRIMARY KEY, form_kind TEXT);
      CREATE TABLE properties(id INT PRIMARY KEY, name TEXT);
      CREATE TABLE rent_rooms(id INT PRIMARY KEY, properties_id INT, room_id TEXT, listing_title TEXT);
      CREATE TABLE tenants(id INT PRIMARY KEY, name TEXT);
      CREATE TABLE lease_contracts(id INT PRIMARY KEY, created_by_user_id INT, template_id INT, agreement_type_code TEXT, rent_room_id INT,
        tenant_id INT, contract_no TEXT, party_snapshot JSONB, data JSONB, start_date DATE, status TEXT, reservation_fee NUMERIC, monthly_rent NUMERIC, invoice_url TEXT, receipt_url TEXT);
      CREATE TABLE agent_invoices(id INT PRIMARY KEY, created_by_user_id INT, document_no TEXT, customer_name TEXT, issue_date DATE, data JSONB,
        pdf_path TEXT, receipt_document_no TEXT, receipt_issue_date DATE, receipt_data JSONB, receipt_pdf_path TEXT);
      CREATE TABLE agent_commission_confirmations(id INT PRIMARY KEY, created_by_user_id INT, document_no TEXT, landlord_name TEXT, issue_date DATE, data JSONB, pdf_path TEXT);
      INSERT INTO agreement_templates VALUES(1,'reservation'),(2,'lease'),(3,'renewal'),(4,'broker_appointment');
      INSERT INTO master_agreement_types VALUES('lease','lease');
      INSERT INTO properties VALUES(1,'Demo Condo'); INSERT INTO rent_rooms VALUES(1,1,'A101','Room'); INSERT INTO tenants VALUES(1,'Demo Tenant');
      INSERT INTO lease_contracts SELECT n,7,2,'lease',1,1,'LEASE-'||n,'{}','{}','2026-10-01',CASE WHEN n=45 THEN 'expired' ELSE 'active' END,NULL,15000,NULL,NULL FROM generate_series(1,45)n;
      INSERT INTO lease_contracts VALUES(101,7,1,'reservation',1,1,'BOOK-101','{}','{}','2026-10-01','active',5000,NULL,'7/booking-invoice.pdf','7/booking-receipt.pdf'),
        (102,7,3,'renewal',1,1,'RENEW-102','{}','{}','2026-10-01','expired',NULL,16000,NULL,NULL),
        (103,7,4,'broker_appointment',1,1,'BROKER-103','{}','{}','2026-10-01','draft',NULL,NULL,NULL,NULL),
        (999,8,2,'lease',1,1,'SECRET','{}','{}','2026-10-01','active',NULL,20000,NULL,NULL);
    `);
    const financial = { documentNo: 'INV-101', issueDate: '2026-10-01', items: [{ quantity: 1, unitPrice: 5000 }], discount: 100, vatRate: 7 };
    const receipt = { ...financial, documentNo: 'REC-BOOK', issueDate: '2026-10-03' };
    await db.query("UPDATE lease_contracts SET data=$1 WHERE id=101", [{ financialDocuments: { invoice: financial, receipt } }]);
    await db.query("INSERT INTO agent_invoices VALUES(101,7,'INV-101','Demo %_ Customer','2026-10-01',$1,'7/invoice.pdf','REC-OTHER','2026-10-05',$1,'7/receipt.pdf'),(999,8,'SECRET','Other','2026-10-01',$1,'8/private.pdf',NULL,NULL,NULL,NULL)", [financial]);
    await db.query("INSERT INTO agent_commission_confirmations VALUES(101,7,'COM-101','Demo Owner','2026-10-01',$1,'7/commission.pdf')", [{ tenantName: 'Demo Tenant', bankAccount: 'PRIVATE' }]);
    await db.query("UPDATE lease_contracts SET data=$1 WHERE id=103", [{ brokerAppointment: { landlordName: 'Demo Broker Owner', issueDate: '2026-10-12' } }]);
    const signed = [], views = [];
    const archive = new ContractArchiveService(db, { view: async (agent, id) => { views.push([agent, id]); return { leaseDocumentUrl: `https://example.invalid/${agent}/lease-${id}.pdf` }; } },
      { signPaths: async paths => { signed.push(...paths); return new Map(paths.map(p => [p, `https://example.invalid/${p}`])); } });
    const users = { agent: { id: 7, roleNames: ['agent'] }, other: { id: 8, roleNames: ['agent'] }, tenant: { id: 9, roleNames: ['tenant'] } };
    const auth = { findBySupabaseUserId: async key => users[key], loadUserWithRoles: async id => Object.values(users).find(u => u.id === id) };
    class ArchiveTestModule {}
    Module({ controllers: [ContractArchiveController], providers: [AuthGuard, RolesGuard, { provide: AuthService, useValue: auth }, { provide: ContractArchiveService, useValue: archive }] })(ArchiveTestModule);
    process.env.ALLOW_DEV_AUTH = 'true'; app = await NestFactory.create(ArchiveTestModule, { logger: false }); await app.listen(0, '127.0.0.1');
    const base = `http://127.0.0.1:${app.getHttpServer().address().port}/agent/contract-archive`;
    const request = async (url, actor = 'agent') => { const response = await fetch(base + url, { headers: actor ? { authorization: `Bearer dev|${actor}|fixture@example.invalid` } : {} }); return { status: response.status, body: await response.json() }; };
    await t.test('all categories load real sources without signing or exposing form data', async () => {
      for (const [type, total] of [['lease',45],['reservation',1],['renewal',1],['broker_appointment',1],['booking_invoice',1],['invoice',1],['receipt',2],['agent_commission',1]]) {
        const result = await request(`?type=${type}`); assert.equal(result.status,200); assert.equal(result.body.total,total);
        assert.ok(result.body.items.every(row => row.type===type)); assert.doesNotMatch(JSON.stringify(result.body),/PRIVATE|pdf_path|financial|https/);
      }
      const broker=(await request('?type=broker_appointment&q=Demo%20Broker%20Owner')).body;assert.equal(broker.total,1);assert.equal(broker.items[0].issueDate,'2026-10-12');
      assert.equal(signed.length,0); assert.equal(views.length,0);
    });
    await t.test('20 per page, stable order, count on empty page and search before pagination', async () => {
      for (const [page,count] of [[1,20],[2,20],[3,5],[4,0]]) { const {body}=await request(`?type=lease&page=${page}`); assert.equal(body.total,45); assert.equal(body.items.length,count); }
      const page2=(await request('?type=lease&page=2')).body;assert.equal(page2.items[0].id,25);
      assert.equal((await request('?type=lease&q=LEASE-1')).body.total,11);
      assert.equal((await request('?type=lease&q=A101')).body.total,45);
      assert.equal((await request('?type=invoice&q=%25_')).body.total,1);
      assert.equal((await request('?type=lease&q=%25')).body.total,0);
      assert.equal((await request('?type=lease&q=SECRET')).body.total,0);
      assert.equal((await request('?type=lease')).body.items[0].status,'expired');
    });
    await t.test('overlapping receipt IDs open their exact source with correct dates and financial totals', async () => {
      const {body}=await request('?type=receipt');assert.deepEqual(body.items.map(x=>x.key),['receipt:101','booking_receipt:101']);
      assert.equal(body.items[0].issueDate,'2026-10-05');assert.equal(body.items[1].issueDate,'2026-10-03');assert.equal(body.items[0].amount,5243);
      for(const [kind,path] of [['receipt','7/receipt.pdf'],['booking_receipt','7/booking-receipt.pdf'],['booking_invoice','7/booking-invoice.pdf'],['invoice','7/invoice.pdf'],['commission','7/commission.pdf']]) {
        const result=await request(`/${kind}/101`);assert.equal(result.status,200);assert.equal(result.body.documentUrl,`https://example.invalid/${path}`);assert.equal(signed.at(-1),path);
      }
      const contract=await request('/contract/45');assert.equal(contract.status,200);assert.deepEqual(views.at(-1),[7,45]);
    });
    await t.test('guards, agent scope and strict HTTP input protect all documents', async () => {
      for(const route of ['?type=lease','/invoice/101']) for(const [actor,status] of [[null,401],['tenant',403],['missing',401]]) assert.equal((await request(route,actor)).status,status);
      for(const route of ['/invoice/999','/contract/999','/receipt/999']) assert.equal((await request(route)).status,404);
      assert.equal((await request('/invoice/101','other')).status,404);
      for(const route of ['?type=lease&type=receipt','?type=lease&page=0','?type=lease&limit=51','?type=lease&q=a&q=b','?type=lease&q=%00','/invoice/0','/invoice/1.5','/unknown/101']) assert.equal((await request(route)).status,400,route);
    });
  } finally {
    if(app)await app.close(); if(previous===undefined)delete process.env.ALLOW_DEV_AUTH;else process.env.ALLOW_DEV_AUTH=previous;
    if(db.isInitialized)await db.destroy(); await admin.query(`DROP SCHEMA IF EXISTS "${scratch}" CASCADE`); await admin.end();
  }
});
