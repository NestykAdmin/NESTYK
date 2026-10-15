// Opt-in PostgreSQL integration: fresh schema and synthetic records only; no user tables/rows are copied.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
require('reflect-metadata');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}}).outputText,filename);
require('dotenv').config({path:path.resolve(__dirname,'../../../.env.api'),quiet:true});
const {Client}=require('pg');const {DataSource,EntitySchema}=require('typeorm');
const {closeLeaseContract}=require('../src/agent/contracts/contract-closure.ts');
const {TenantBillingService}=require('../src/billing/tenant-billing.service.ts');
const entity=name=>require(`../src/entities/${name[0]}.entity.ts`)[name[1]];
const C=entity(['lease-contract','LeaseContractEntity']),L=entity(['lead','LeadEntity']),R=entity(['rent-room','RentRoomEntity']),O=entity(['room-tenancy','RoomTenancyEntity']),T=entity(['agreement-template','AgreementTemplateEntity']),M=entity(['master-contract-end-reason','MasterContractEndReasonEntity']),D=entity(['contract-deposit-transfer','ContractDepositTransferEntity']),S=entity(['contract-deposit-settlement','ContractDepositSettlementEntity']),B=entity(['tenant-bill','TenantBillEntity']),I=entity(['agreement-sign-invite','AgreementSignInviteEntity']),N=entity(['tenant','TenantEntity']),A=entity(['master-agreement-type','MasterAgreementTypeEntity']);
const P=entity(['property','PropertyEntity']);
const id={type:Number,primary:true};const number={type:Number,nullable:true};const text={type:String,nullable:true};const day={type:'date',nullable:true};const date={type:'timestamptz',nullable:true};const json={type:'jsonb',nullable:true};const money={type:'decimal',precision:12,scale:2,nullable:true};
const relation=(target,column,referencedColumnName='id')=>({type:'many-to-one',target:target.name,joinColumn:{name:column,referencedColumnName},createForeignKeyConstraints:false});
const schemaFor=(target,tableName,columns,relations={},extra={})=>new EntitySchema({name:target.name,target,tableName,columns,relations,...extra});
function schemas(){return [
 schemaFor(C,'lease_contracts',{id,owner_user_id:number,contract_no:text,receipt_url:text,created_by_user_id:number,template_id:number,lead_id:number,tenant_id:number,rent_room_id:number,room_tenancy_id:number,status:text,start_date:day,end_date:day,move_in_date:day,monthly_rent:money,advance_rent:money,deposit:money,agreement_kind:text,agreement_type_code:text,previous_agreement_id:number,end_reason_id:number,end_reason_note:text,effective_end_date:day,end_recorded_at:date,end_recorded_by_user_id:number,terminated_at:date,data:json,document_url:text},{template:relation(T,'template_id'),tenant:relation(N,'tenant_id'),agreement_type:relation(A,'agreement_type_code','code'),rent_room:relation(R,'rent_room_id')}),
 schemaFor(L,'leads',{id,created_by_user_id:number,rent_room_id:number,tenant_id:number,status:text,booking_released_at:date}),
 schemaFor(R,'rent_rooms',{id,created_by_user_id:number,owner_id:number,properties_id:number,room_id:text},{property:relation(P,'properties_id')}),
 schemaFor(P,'properties',{id,name:text}),
 schemaFor(O,'room_tenancies',{id,created_by_user_id:number,rent_room_id:number,tenant_id:number,status:text,move_in_date:day,move_out_date:day}),
 schemaFor(T,'agreement_templates',{id,form_kind:text}),
 schemaFor(A,'master_agreement_types',{code:{type:String,primary:true},form_kind:text}),
 schemaFor(N,'tenants',{id,user_id:number,created_by_user_id:number,name:text,first_name:text,last_name:text}),
 schemaFor(M,'master_contract_end_reasons',{id,code:text,is_active:{type:Boolean},applicable_status:text,requires_note:{type:Boolean}}),
 schemaFor(D,'contract_deposit_transfers',{id,from_contract_id:number,to_contract_id:number,status:text}),
 schemaFor(S,'contract_deposit_settlements',{id,lease_contract_id:number,status:text}),
 schemaFor(B,'tenant_bills',{id:{...id,generated:true},lease_contract_id:number,tenant_id:number,period:text,document_no:text,issue_date:day,due_date:day,grace_until:day,amount:money,status:{type:String,default:'pending'},payment_slip_path:text,paid_at:date,slip_submitted_at:date,slip_return_note:text},{tenant:relation(N,'tenant_id'),lease_contract:relation(C,'lease_contract_id')}),
 schemaFor(I,'agreement_sign_invites',{id,agreement_id:number,used_at:date,revoked_at:date}),
];}
test('PostgreSQL: closure guards, historical bills, rebooking, rollback and concurrent billing issuance',
 {skip:process.env.RUN_CONTRACT_CLOSURE_DB_TEST!=='1',timeout:90000},async()=>{
 const scratch=`contract_closure_test_${Date.now()}_${process.pid}`,q=name=>'"'+name.replaceAll('"','""')+'"';
 const ssl=/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL||'')?false:{rejectUnauthorized:false};
 const admin=new Client({connectionString:process.env.DATABASE_URL,ssl,connectionTimeoutMillis:10000});
 const db=new DataSource({type:'postgres',url:process.env.DATABASE_URL,ssl,schema:scratch,entities:schemas(),synchronize:false,extra:{connectionTimeoutMillis:10000,statement_timeout:15000,max:4}});
 await admin.connect();
 try{
  await admin.query(`CREATE SCHEMA ${q(scratch)}`);await admin.query("SELECT set_config('search_path',$1,false)",[q(scratch)]);
  await db.initialize();assert.ok(db.entityMetadatas.every(m=>m.schema===scratch));await db.synchronize();
  // Use actual migrations for financial/end-reason tables instead of the reduced metadata used by the test.
  await admin.query('DROP TABLE tenant_bills, master_contract_end_reasons, contract_deposit_transfers, contract_deposit_settlements');
  await admin.query('CREATE TABLE users(id INTEGER PRIMARY KEY); INSERT INTO users VALUES(7)');
  for(const file of ['20261009-contract-end-deposits.sql','20261006-tenant-bills.sql','20261008-tenant-bill-slip-submit.sql','20261008-tenant-bill-slip-return.sql','20261014-contract-closure.sql','20261014-contract-closure.sql'])await admin.query(fs.readFileSync(path.resolve(__dirname,'../migrations',file),'utf8'));
  const now=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const {addDays}=require('../src/billing/rent-schedule.ts');
  const start=addDays(now,-30),end=addDays(now,90),effective=addDays(now,-1);
  await db.manager.save(T,{id:1,form_kind:'lease'});await db.manager.save(A,{code:'lease',form_kind:'lease'});await db.manager.save(N,{id:2,user_id:8});await db.manager.save(L,{id:1,created_by_user_id:7,rent_room_id:3,tenant_id:2,status:'booked'});await db.manager.save(R,{id:3,created_by_user_id:7});await db.manager.save(O,{id:4,created_by_user_id:7,rent_room_id:3,tenant_id:2,status:'active'});
  const contract={id:20,created_by_user_id:7,template_id:1,lead_id:1,tenant_id:2,rent_room_id:3,room_tenancy_id:4,status:'active',start_date:start,end_date:end,monthly_rent:'15000.00',deposit:'30000.00',agreement_kind:'new',agreement_type_code:'lease',data:{leaseAgreement:{advanceMonths:'0'}},document_url:'historical-signed.pdf'};
  await db.manager.save(C,contract);await admin.query("INSERT INTO tenant_bills(lease_contract_id,tenant_id,period,document_no,issue_date,due_date,grace_until,amount,status,payment_slip_path) VALUES(20,2,'2026-10','test-unpaid',$1,$1,$1,15000,'pending','unpaid.jpg'),(20,2,'2026-09','test-paid',$1,$1,$1,15000,'paid','paid.jpg')",[now]);
  const billsBefore=(await admin.query('SELECT * FROM tenant_bills ORDER BY id')).rows;
  const body={endReasonCode:'tenant_requested',effectiveEndDate:effective,note:'Synthetic move-out'};
  const summary=await closeLeaseContract(db,7,20,body);assert.equal(summary.unpaidAmount,'15000.00');assert.equal(summary.paidCount,1);assert.equal(summary.billsDueAfterEndCount,2);
  const closed=await db.manager.findOneBy(C,{id:20});assert.equal(closed.status,'terminated');assert.equal(closed.end_date,end);assert.equal(closed.document_url,contract.document_url);assert.deepEqual((await admin.query('SELECT * FROM tenant_bills ORDER BY id')).rows,billsBefore);
  assert.ok((await db.manager.findOneBy(L,{id:1})).booking_released_at);assert.equal((await db.manager.findOneBy(O,{id:4})).status,'moved_out');
  await closeLeaseContract(db,7,20,body);assert.equal((await db.manager.findOneBy(C,{id:20})).end_recorded_at.getTime(),closed.end_recorded_at.getTime());
  await assert.rejects(()=>closeLeaseContract(db,8,20,body),e=>e.getStatus()===404);
  await db.manager.save(L,{id:2,created_by_user_id:7,rent_room_id:3,status:'booked'});await assert.rejects(()=>db.manager.save(L,{id:3,created_by_user_id:7,rent_room_id:3,status:'booked'}),e=>e.code==='23505');
  await db.manager.save(C,{...contract,id:21,lead_id:2});
  await admin.query("CREATE FUNCTION fail_test_moveout() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$; CREATE TRIGGER fail_test_moveout BEFORE UPDATE ON room_tenancies FOR EACH ROW EXECUTE FUNCTION fail_test_moveout()");
  await assert.rejects(()=>closeLeaseContract(db,7,21,body),/synthetic failure/);assert.equal((await db.manager.findOneBy(C,{id:21})).status,'active');assert.equal((await db.manager.findOneBy(L,{id:2})).booking_released_at,null);await admin.query('DROP TRIGGER fail_test_moveout ON room_tenancies');
  const transaction=db.transaction.bind(db);let release,entered;const gate=new Promise(r=>release=r),locked=new Promise(r=>entered=r);
  db.transaction=fn=>transaction(async manager=>{const update=manager.update.bind(manager);manager.update=async(target,criteria,patch)=>{if(target===C&&criteria.id===21&&patch.status==='terminated'){entered();await gate;}return update(target,criteria,patch);};return fn(manager);});
  const closing=closeLeaseContract(db,7,21,body);await locked;
  const billing=new TenantBillingService(db);const active=billing.activeLeases.bind(billing);let read;const snapshotRead=new Promise(r=>read=r);billing.activeLeases=()=>{const qb=active(),get=qb.getMany.bind(qb);qb.getMany=async()=>{const rows=await get();read();return rows;};return qb;};
  const issuing=billing.ensureAllActive(now);await snapshotRead;release();await closing;assert.equal(await issuing,0);assert.equal(Number((await admin.query('SELECT COUNT(*) n FROM tenant_bills WHERE lease_contract_id=21')).rows[0].n),0);
  db.transaction=transaction;
  // Expiring a predecessor must not release a room occupied by its active renewal.
  await db.manager.update(L,{id:2},{booking_released_at:null,tenant_id:2});
  await db.manager.update(O,{id:4},{status:'active',move_out_date:null});
  await db.manager.save(T,{id:2,form_kind:'renewal'});
  await db.manager.save(C,{...contract,id:22,lead_id:2,end_date:effective});
  await db.manager.save(C,{...contract,id:23,template_id:2,lead_id:2,start_date:now,previous_agreement_id:22,agreement_kind:'renewal'});
  await closeLeaseContract(db,7,22,{endReasonCode:'term_completed',effectiveEndDate:effective});
  assert.equal((await db.manager.findOneBy(L,{id:2})).booking_released_at,null);
  assert.equal((await db.manager.findOneBy(O,{id:4})).status,'active');
  await admin.query("INSERT INTO contract_deposit_settlements(lease_contract_id,created_by_user_id,deposit_received_amount,deposit_received_reference,available_deposit_amount,carried_forward_total,decision_note) VALUES(22,7,10000,'synthetic receipt',10000,10000,'Synthetic carry')");
  await admin.query("INSERT INTO contract_deposit_transfers(from_contract_id,to_contract_id,amount,created_by_user_id) VALUES(22,23,10000,7)");
  await admin.query("UPDATE contract_deposit_settlements SET status='approved',approved_by_user_id=7,approved_at=NOW() WHERE lease_contract_id=22");
  await assert.rejects(()=>closeLeaseContract(db,7,23,{...body,effectiveEndDate:now}),e=>e.getStatus()===409);
  assert.equal((await db.manager.findOneBy(C,{id:23})).status,'active');
 }finally{if(db.isInitialized)await db.destroy();await admin.query(`DROP SCHEMA IF EXISTS ${q(scratch)} CASCADE`);await admin.end();}
});


test('PostgreSQL: Agent reads real historical bills; a new room owner cannot read old contract bills/slips',
 {skip:process.env.RUN_CONTRACT_CLOSURE_DB_TEST!=='1',timeout:90000},async()=>{
 const scratch=`billing_scope_test_${Date.now()}_${process.pid}`,q=name=>'"'+name.replaceAll('"','""')+'"';
 const ssl=/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL||'')?false:{rejectUnauthorized:false};
 const admin=new Client({connectionString:process.env.DATABASE_URL,ssl,connectionTimeoutMillis:10000});
 const db=new DataSource({type:'postgres',url:process.env.DATABASE_URL,ssl,schema:scratch,entities:schemas(),synchronize:false});
 await admin.connect();
 try {
  await admin.query(`CREATE SCHEMA ${q(scratch)}`); await db.initialize(); assert.ok(db.entityMetadatas.every(m=>m.schema===scratch)); await db.synchronize();
  await db.manager.save(T,{id:1,form_kind:'lease'}); await db.manager.save(A,{code:'lease',form_kind:'lease'});
  await db.manager.save(N,{id:2,user_id:8,created_by_user_id:7,name:'Synthetic tenant'});
  await db.manager.save(P,{id:1,name:'Synthetic project'}); await db.manager.save(R,{id:3,owner_id:20,properties_id:1,created_by_user_id:7});
  await db.manager.save(C,{id:20,created_by_user_id:7,template_id:1,tenant_id:2,rent_room_id:3,status:'terminated',owner_user_id:10,start_date:'2026-01-01',end_date:'2026-12-31',data:{}});
  const receivedAt = new Date('2026-09-20T06:00:00Z');
  await db.manager.save(B,[{id:1,lease_contract_id:20,tenant_id:2,period:'2026-09',amount:'15000.00',status:'paid',paid_at:receivedAt,payment_slip_path:'historical-paid.png',due_date:'2026-09-15',grace_until:'2026-09-20'},
   {id:2,lease_contract_id:20,tenant_id:2,period:'2026-10',amount:'15500.00',status:'pending',payment_slip_path:'submitted.png',slip_submitted_at:new Date(),due_date:'2026-10-15',grace_until:'2026-10-20'},
   {id:3,lease_contract_id:20,tenant_id:2,period:'2026-08',amount:'14500.00',status:'pending',due_date:'2026-08-15',grace_until:'2026-08-20'}]);
  const service=new TenantBillingService(db,{signPaths:async paths=>new Map(paths.map(p=>[p,'https://synthetic.example/'+p]))});
  await assert.rejects(()=>service.receivedSlipUrl(20,1),e=>e.getStatus()===404);
  assert.equal((await service.listReceived(20)).length,0);
  assert.equal((await service.listReceived(10)).length,3);
  assert.match((await service.receivedSlipUrl(10,1)).url,/historical-paid/);
  const billing=await service.listForAgentTenant(7,2);
  assert.equal(billing.bills.length,3); assert.equal(billing.upcoming,null);
  assert.equal(billing.bills.find(b=>b.id===1).paidAt,receivedAt.toISOString());
  assert.equal(billing.bills.find(b=>b.id===2).status,'awaiting_review');
  assert.equal(billing.bills.find(b=>b.id===3).status,'overdue');
  assert.deepEqual(billing.payments.map(p=>[p.id,p.amount,p.paidAt]),[['bill-1',15000,receivedAt.toISOString()]]);
  await assert.rejects(()=>service.listForAgentTenant(9,2),e=>e.getStatus()===404);
  // Real database verifies that billing starts occupancy on the agreed date, not when a future lease is signed.
  const { bangkokToday, addDays } = require('../src/billing/rent-schedule.ts');
  const today = bangkokToday();
  await db.manager.save(O,[{id:9,created_by_user_id:7,rent_room_id:3,tenant_id:2,status:'prospect'}, {id:10,created_by_user_id:7,rent_room_id:3,tenant_id:2,status:'prospect'}]);
  const terms={created_by_user_id:7,template_id:1,agreement_type_code:'lease',tenant_id:2,rent_room_id:3,status:'active',monthly_rent:'15000.00',data:{leaseAgreement:{advanceMonths:'0'}}};
  await db.manager.save(C,[{...terms,id:21,room_tenancy_id:9,start_date:addDays(today,-1),end_date:today}, {...terms,id:22,room_tenancy_id:10,start_date:addDays(today,1),end_date:addDays(today,90)}]);
  await service.ensureAllActive(today);
  assert.equal((await db.manager.findOneBy(O,{id:9})).status,'active');
  assert.equal((await db.manager.findOneBy(O,{id:9})).move_in_date,addDays(today,-1));
  assert.equal((await db.manager.findOneBy(O,{id:10})).status,'prospect');
  await db.manager.update(C,{id:21},{status:'terminated'}); await db.manager.update(O,{id:9},{status:'moved_out'});
  await service.ensureAllActive(today); assert.equal((await db.manager.findOneBy(O,{id:9})).status,'moved_out');
  // Cancel a synthetic last draft using the actual service/transaction and release only its booking.
  await db.manager.save(L,{id:2,created_by_user_id:7,tenant_id:2,rent_room_id:4,status:'booked'});
  await db.manager.save(R,{id:4,created_by_user_id:7}); await db.manager.save(O,{id:11,created_by_user_id:7,rent_room_id:4,tenant_id:2,status:'prospect'});
  await db.manager.save(M,{id:77,code:'draft_cancelled',is_active:true,applicable_status:'cancelled',requires_note:true});
  await db.manager.save(T,{id:2,form_kind:'reservation'});
  await db.manager.save(C,{...terms,id:38,template_id:2,status:'active',lead_id:2,rent_room_id:4,start_date:addDays(today,-30),end_date:null});
  await db.manager.save(C,{...terms,id:39,status:'expired',lead_id:2,rent_room_id:4,start_date:addDays(today,-30),end_date:addDays(today,-1)});
  await db.manager.save(C,{...terms,id:40,template_id:null,status:'draft',lead_id:2,rent_room_id:4,room_tenancy_id:11,previous_agreement_id:39,start_date:today,end_date:addDays(today,90)});
  const { AgentContractsService }=require('../src/agent/contracts/agent-contracts.service.ts');
  const contracts=new AgentContractsService(db); contracts.view=async (_agent,id)=>db.manager.findOneBy(C,{id});
  await contracts.cancelDraft(7,40,{reason:'Synthetic booking cancellation'});
  assert.ok((await db.manager.findOneBy(L,{id:2})).booking_released_at);
  assert.equal((await db.manager.findOneBy(C,{id:40})).status,'cancelled');
  assert.equal((await db.manager.findOneBy(O,{id:11})).status,'moved_out');
  await db.manager.update(C,{id:20},{owner_user_id:null});
  assert.match((await service.receivedSlipUrl(20,1)).url,/historical-paid/); // Legacy contracts with no owner snapshot keep their existing fallback.
 } finally {if(db.isInitialized)await db.destroy();await admin.query(`DROP SCHEMA IF EXISTS ${q(scratch)} CASCADE`);await admin.end();}
});
