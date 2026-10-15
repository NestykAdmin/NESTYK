// Explicit opt-in: clones table structures into a disposable schema, never copies user data.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
require('dotenv').config({path:path.resolve(__dirname,'../../../.env.api'), quiet:true});
const { Client } = require('pg');
const { DataSource } = require('typeorm');
const { ALL_ENTITIES } = require('../src/entities/index.ts');
const { AgreementAttachmentsService } = require('../src/agent/contracts/agreement-attachments.service.ts');
const { AgentContractsService } = require('../src/agent/contracts/agent-contracts.service.ts');
const q = name => '"' + name.replaceAll('"','""') + '"';

test('PostgreSQL: migration repeatability, backfill, version pinning, renewal chain and concurrent duplicate protection', {skip:process.env.RUN_AGREEMENT_DB_TEST !== '1'}, async () => {
  const schema = `agreement_test_${Date.now()}`;
  const source = process.env.DB_SCHEMA || 'public';
  const admin = new Client({connectionString:process.env.DATABASE_URL});
  const db = new DataSource({type:'postgres',url:process.env.DATABASE_URL,schema,entities:ALL_ENTITIES,synchronize:false});
  await admin.connect();
  try {
    await admin.query(`CREATE SCHEMA ${q(schema)}`);
    const tables = await admin.query("SELECT tablename FROM pg_tables WHERE schemaname=$1 AND tablename <> $2 AND tablename NOT IN ('agreement_documents','agreement_template_document_requirements','master_document_types')",[source,'agreement_templates']);
    for (const {tablename} of tables.rows) {
      await admin.query(`CREATE TABLE ${q(schema)}.${q(tablename)} (LIKE ${q(source)}.${q(tablename)} INCLUDING ALL)`);
      const serials = await admin.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_default LIKE 'nextval(%'",[source,tablename]);
      for (const {column_name} of serials.rows) {
        const seq = `${tablename}_${column_name}_test_seq`;
        await admin.query(`CREATE SEQUENCE ${q(schema)}.${q(seq)}`);
        await admin.query(`ALTER TABLE ${q(schema)}.${q(tablename)} ALTER COLUMN ${q(column_name)} SET DEFAULT nextval('${q(schema)}.${q(seq)}')`);
      }
    }
    await admin.query(`SET search_path TO ${q(schema)}`);
    await admin.query(`ALTER TABLE lease_contracts
      DROP COLUMN IF EXISTS template_id, DROP COLUMN IF EXISTS data,
      DROP COLUMN IF EXISTS party_snapshot, DROP COLUMN IF EXISTS agreement_kind,
      DROP COLUMN IF EXISTS previous_agreement_id, DROP COLUMN IF EXISTS root_agreement_id`);
    await admin.query("INSERT INTO master_agreement_types(code,name_th,name_en,form_kind) VALUES ('lease','สัญญาเช่า','Lease','lease'),('reservation','หนังสือจอง','Reservation','reservation')");
    // A pre-migration row exercises template and JSON backfill without copying personal data.
    await admin.query("INSERT INTO lease_contracts(id,room_tenancy_id,rent_room_id,tenant_id,lead_id,created_by_user_id,start_date,end_date,monthly_rent,deposit) VALUES (900,1,1,1,1,1,'2020-01-01','2020-12-31',100,200)");
    const migration = fs.readFileSync(path.resolve(__dirname,'../migrations/20260915-00-agreement-templates-renewals.sql'),'utf8');
    await admin.query(migration); await admin.query(migration);
    const legacy = (await admin.query('SELECT * FROM lease_contracts WHERE id=900')).rows[0];
    assert.equal(legacy.root_agreement_id,900); assert.equal(legacy.data.monthlyRent,100); assert.ok(legacy.template_id);
    await admin.query('DELETE FROM lease_contracts WHERE id=900');
    await admin.query("INSERT INTO users(id,email,first_name) VALUES (1,'agreement-test@example.invalid','Agent')");
    await admin.query("INSERT INTO properties(id,name,address,district,province) VALUES (1,'Test property','Test','Test','Test')");
    await admin.query("INSERT INTO rent_rooms(id,properties_id,room_status_id,created_by_user_id,owner_id,room_id) VALUES (1,1,1,1,1,'A1')");
    await admin.query("INSERT INTO leads(id,name,phone,status,tenant_id,rent_room_id,created_by_user_id) VALUES (1,'Tenant','000','booked',1,1,1)");
    await admin.query("INSERT INTO tenants(id,lead_id,name,phone,created_by_user_id) VALUES (1,1,'Tenant','000',1)");
    await db.initialize();
    const service = new AgentContractsService(db);
    const input = {leadId:1,startDate:'2026-01-01',endDate:'2026-12-31',monthlyRent:10000,deposit:20000};
    const reservation = await service.create(1, { leadId: 1, agreementTypeCode: 'reservation', startDate: '2025-12-01', moveInDate: '2026-01-01', reservationFee: 1000 });
    await admin.query("UPDATE lease_contracts SET status='active', document_url=$2 WHERE id=$1", [reservation.id, `1/${reservation.id}/generated/reservation_letter/letter-v1/booked.pdf`]);
    const first = await service.create(1,input);
    assert.equal(first.rootAgreementId,first.id); assert.equal(first.templateVersion,1);
    await admin.query("UPDATE lease_contracts SET status='active' WHERE id=$1",[first.id]);
    const attempts = await Promise.allSettled([1,2].map(() => service.create(1,{...input,startDate:'2027-01-01',endDate:'2027-12-31',previousAgreementId:first.id})));
    assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(attempts.find(r=>r.status==='rejected').reason.getStatus(),409);
    const second = attempts.find(r=>r.status==='fulfilled').value;
    assert.equal(second.previousAgreementId,first.id); assert.equal(second.rootAgreementId,first.id);
    await assert.rejects(()=>service.create(2,{...input,previousAgreementId:first.id}));
    await admin.query("UPDATE lease_contracts SET status='active' WHERE id=$1",[second.id]);
    await admin.query("INSERT INTO agreement_templates(agreement_type_code,version,name,form_kind,data_schema) SELECT agreement_type_code,2,'Lease v2',form_kind,data_schema FROM agreement_templates WHERE id=$1",[first.templateId]);
    const third = await service.create(1,{...input,startDate:'2028-01-01',endDate:'2028-12-31',previousAgreementId:second.id});
    assert.equal(third.templateVersion,2); assert.equal(third.rootAgreementId,first.id);
    assert.equal((await service.view(1,first.id)).templateVersion,1);
    assert.equal((await service.history(1,third.id)).length,3);
    await assert.rejects(()=>service.history(2,third.id),e=>e.getStatus()===404);
    await assert.rejects(()=>admin.query("UPDATE agreement_templates SET name='Changed' WHERE id=$1",[first.templateId]),/new template version/);
    await admin.query("UPDATE tenants SET name='Changed' WHERE id=1");
    assert.equal((await service.view(1,first.id)).tenant,'Tenant');
    const attachmentsMigration = fs.readFileSync(path.resolve(__dirname,'../migrations/20260915-agreement-attachments.sql'),'utf8');
    await admin.query(attachmentsMigration); await admin.query(attachmentsMigration);
    await admin.query(fs.readFileSync(path.resolve(__dirname,'../migrations/20260915-attachment-removal.sql'),'utf8'));
    await admin.query(fs.readFileSync(path.resolve(__dirname,'../migrations/20260915-attachments-without-review.sql'),'utf8'));
    await admin.query(fs.readFileSync(path.resolve(__dirname,'../migrations/20260917-optional-attachment-signing.sql'),'utf8'));
    await admin.query(fs.readFileSync(path.resolve(__dirname,'../migrations/20260917-restore-required-attachment-signing.sql'),'utf8'));
    await admin.query(fs.readFileSync(path.resolve(__dirname,'../migrations/20261002-party-own-documents-before-signing.sql'),'utf8'));
    assert.equal((await admin.query("SELECT count(*)::int n FROM agreement_template_document_requirements")).rows[0].n,5);
    const objects = new Map(); let fileSequence = 0;
    const storage = {
      uploadAttachment: async (agentId,id,file) => { const key=`${agentId}/${id}/attachments/${++fileSequence}.pdf`; objects.set(key,file.buffer);return {path:key,mimeType:'application/pdf',size:file.buffer.length}; },
      remove: async key => objects.delete(key), download: async key => objects.get(key),
      signPaths: async paths => new Map(paths.map(p=>[p,`https://signed.example/${p}`])),
    };
    const attachments = new AgreementAttachmentsService(db,storage);
    const file={buffer:Buffer.from('%PDF-1.4 test'),size:13,originalname:'identity.pdf'};
    // Existing contracts keep their pinned requirements, but can add optional documents.
    assert.equal((await attachments.list(1,third.id)).requirements.length,0);
    for (const [subject,documentTypeCode] of [['tenant','passport'],['owner','national_id'],['property','ownership_proof']]) {
      const uploaded = await attachments.upload(1,third.id,{subject,documentTypeCode},file);
      await attachments.review(1,third.id,uploaded.documents.at(-1).id,{status:'accepted'});
    }
    await admin.query("UPDATE lease_contracts SET owner_signed_at=NOW(), status='active' WHERE id=$1",[third.id]);
    await assert.rejects(()=>attachments.upload(1,third.id,{subject:'tenant',documentTypeCode:'passport'},file),e=>e.getStatus()===400);
    const fourth=await service.create(1,{...input,startDate:'2029-01-01',endDate:'2029-12-31',previousAgreementId:third.id});
    assert.equal(fourth.templateVersion,3);
    assert.equal((await attachments.list(1,fourth.id)).readyToSign,false);
    await assert.rejects(()=>admin.query("UPDATE lease_contracts SET tenant_signed_at=NOW() WHERE id=$1",[fourth.id]),e=>e.code==='23514');
    await assert.rejects(()=>attachments.list(2,fourth.id),e=>e.getStatus()===404);
    await assert.rejects(()=>admin.query("DELETE FROM agreement_template_document_requirements WHERE template_id=$1",[fourth.templateId]),/new template version/);
    const reusable=(await attachments.list(1,fourth.id)).reusableDocuments;
    assert.equal(reusable.length,3);
    await assert.rejects(()=>attachments.reuse(1,fourth.id,{sourceDocumentId:reusable[0].id}),e=>e.getStatus()===400);
    for (const source of reusable) await attachments.reuse(1,fourth.id,{sourceDocumentId:source.id,confirmedCurrent:true});
    let checklist=await attachments.list(1,fourth.id);
    assert.equal(checklist.readyToSign,true); assert.ok(checklist.documents.every(d=>d.reviewStatus==='pending'));
    await assert.rejects(()=>attachments.url(2,fourth.id,checklist.documents[0].id),e=>e.getStatus()===404);
    const originalDoc=checklist.documents[0];
    await attachments.review(1,fourth.id,originalDoc.id,{status:'rejected',note:'Please replace'});
    checklist=await attachments.upload(1,fourth.id,{subject:originalDoc.subject,documentTypeCode:originalDoc.documentTypeCode,supersedesDocumentId:originalDoc.id},file);
    assert.equal(checklist.documents.find(d=>d.id===originalDoc.id).isCurrent,false);
    const storedCount=objects.size;
    await assert.rejects(()=>attachments.upload(1,fourth.id,{subject:originalDoc.subject,documentTypeCode:originalDoc.documentTypeCode,supersedesDocumentId:originalDoc.id},file),e=>e.getStatus()===409);
    assert.equal(objects.size,storedCount,'failed replacement cleans up uploaded object');
    for(const d of checklist.documents.filter(d=>d.isCurrent)) await attachments.review(1,fourth.id,d.id,{status:'accepted'});
    checklist=await attachments.list(1,fourth.id);
    assert.equal(checklist.readyToSign,true,'passport OR national ID satisfies identity group');
    assert.match((await attachments.url(1,fourth.id,originalDoc.id)).url,/signed.example/,'old revisions remain accessible');
    await attachments.assertReady(await db.getRepository(require('../src/entities/lease-contract.entity.ts').LeaseContractEntity).findOneBy({id:fourth.id}));
    await admin.query("UPDATE lease_contracts SET tenant_signed_at=NOW() WHERE id=$1",[fourth.id]);
    assert.equal((await attachments.list(1,fourth.id)).editable,false);
    await assert.rejects(()=>admin.query("UPDATE agreement_documents SET review_note='changed' WHERE id=$1",[originalDoc.id]),e=>e.code==='23514');
    await assert.rejects(()=>admin.query("DELETE FROM agreement_documents WHERE id=$1",[originalDoc.id]),e=>e.code==='23514');

    const moveOwnership = fs.readFileSync(path.resolve(__dirname,'../migrations/20260915-ownership-proof-reservation.sql'),'utf8');
    await admin.query('BEGIN');
    await admin.query(moveOwnership);
    await admin.query('COMMIT');
    const versionCount = (await admin.query('SELECT count(*)::int n FROM agreement_templates')).rows[0].n;
    await admin.query('BEGIN');
    await admin.query(moveOwnership);
    await admin.query('COMMIT');
    assert.equal((await admin.query('SELECT count(*)::int n FROM agreement_templates')).rows[0].n,versionCount);
    const activeRequirements = (await admin.query(`SELECT t.form_kind,r.document_type_code FROM agreement_templates t
      JOIN agreement_template_document_requirements r ON r.template_id=t.id WHERE t.is_active`)).rows;
    assert.equal(activeRequirements.filter(r=>r.form_kind==='lease').length,4);
    assert.ok(!activeRequirements.some(r=>r.form_kind==='lease' && r.document_type_code==='ownership_proof'));
    assert.ok(activeRequirements.some(r=>r.form_kind==='reservation' && r.document_type_code==='ownership_proof'));
    assert.equal((await attachments.list(1,fourth.id)).readyToSign,true);
    assert.ok((await attachments.list(1,fourth.id)).requirements.some(r=>r.groupKey==='ownership'));

  } finally {
    if (db.isInitialized) await db.destroy();
    await admin.query(`DROP SCHEMA IF EXISTS ${q(schema)} CASCADE`);
    await admin.end();
  }
});
