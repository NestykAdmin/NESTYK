const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require('reflect-metadata');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}}).outputText,f);
const {dashboardQuery}=require('../src/agent/dashboard/dashboard-query.ts');
const {AgentDashboardService}=require('../src/agent/dashboard/agent-dashboard.service.ts');
const {AgentDashboardController}=require('../src/agent/dashboard/agent-dashboard.controller.ts');
const {AuthGuard}=require('../src/auth/guards/auth.guard.ts'),{RolesGuard}=require('../src/auth/guards/roles.guard.ts'),{AuthService}=require('../src/auth/auth.service.ts');
const {Module}=require('@nestjs/common'),{NestFactory}=require('@nestjs/core');
const clock=new Date('2026-10-16T03:00:00Z');
test('dashboard validates month, scalar query, supported work, pagination and literal search',()=>{
 assert.equal(dashboardQuery({},'2026-10-16').period,'2026-10');
 assert.equal(dashboardQuery({kind:'rent'},'2026-10-16',true).limit,20);
 for(const query of [{period:'2026-13'},{period:['2026-10','2026-11']},{agentId:'8'},{period:'0-01'},{period:'2026-1'}])assert.throws(()=>dashboardQuery(query,'2026-10-16'),{status:400});
 for(const query of [{kind:'lead_follow_up'},{kind:'commission'},{kind:'rent',page:'0'},{kind:'rent',limit:'51'},{kind:'rent',q:['x','y']},{kind:'rent',q:'\0'}])assert.throws(()=>dashboardQuery(query,'2026-10-16',true),{status:400});
});
test('database failures return 503 instead of a success response with invented zeroes',async()=>{
 const service=new AgentDashboardService({query:async()=>{throw new Error('connection unavailable')}});
 await assert.rejects(service.summary(7,{},clock),{status:503});
 await assert.rejects(service.workItems(7,{kind:'rent'},clock),{status:503});
});
test('dashboard real SQL and HTTP: scoped aggregates, work pagination, unsupported capabilities, read-only requests', {skip:process.env.RUN_DASHBOARD_DB_TEST!=='1',timeout:60000},async t=>{
 require('dotenv').config({path:path.resolve(__dirname,'../../../.env.api'),quiet:true});
 const {Client}=require('pg'),{DataSource}=require('typeorm');
 const scratch=`dashboard_test_${Date.now()}_${process.pid}`;
 const ssl=/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)?false:{rejectUnauthorized:false};
 const admin=new Client({connectionString:process.env.DATABASE_URL,ssl});
 const db=new DataSource({type:'postgres',url:process.env.DATABASE_URL,ssl,schema:scratch,entities:[],extra:{options:`-c search_path=${scratch}`,statement_timeout:10000}});
 let app;const previous=process.env.ALLOW_DEV_AUTH;
 await admin.connect();try{
 await admin.query(`CREATE SCHEMA "${scratch}"`);await db.initialize();assert.equal((await db.query('SELECT current_schema() AS name'))[0].name,scratch);
 await db.query(`
 CREATE TABLE properties(id INT PRIMARY KEY,name TEXT,district TEXT);
 CREATE TABLE master_room_statuses(id INT PRIMARY KEY,code TEXT);
 CREATE TABLE master_room_types(id INT PRIMARY KEY,bedroom_count INT);
 CREATE TABLE rent_rooms(id INT PRIMARY KEY,created_by_user_id INT,is_scout_room BOOLEAN,visibility TEXT,room_id TEXT,updated_at TIMESTAMPTZ,room_status_id INT,room_type_id INT,properties_id INT,listing_title TEXT,prices JSONB);
 CREATE TABLE rent_room_prices(id SERIAL PRIMARY KEY,rent_room_id INT,price NUMERIC);
 CREATE TABLE leads(id INT PRIMARY KEY,created_by_user_id INT,name TEXT,status TEXT,created_at TIMESTAMPTZ,tenant_id INT,rent_room_id INT,booking_released_at TIMESTAMPTZ);
 CREATE TABLE tenants(id INT PRIMARY KEY,created_by_user_id INT,name TEXT);
 CREATE TABLE agreement_templates(id INT PRIMARY KEY,form_kind TEXT);
 CREATE TABLE master_agreement_types(code TEXT PRIMARY KEY,form_kind TEXT);
 CREATE TABLE lease_contracts(id INT PRIMARY KEY,created_by_user_id INT,tenant_id INT,rent_room_id INT,status TEXT,start_date DATE,end_date DATE,move_in_date DATE,previous_agreement_id INT,
 owner_signed_at TIMESTAMPTZ,tenant_signed_at TIMESTAMPTZ,agent_signed_at TIMESTAMPTZ,owner_signature_url TEXT,tenant_signature_url TEXT,agent_signature_url TEXT,
 owner_delivered_at TIMESTAMPTZ,tenant_delivered_at TIMESTAMPTZ,monthly_rent NUMERIC,template_id INT,agreement_type_code TEXT,contract_no TEXT,party_snapshot JSONB);
 CREATE TABLE tenant_bills(id INT PRIMARY KEY,lease_contract_id INT,tenant_id INT,document_no TEXT,due_date DATE,grace_until DATE,amount NUMERIC,status TEXT,paid_at TIMESTAMPTZ,payment_slip_path TEXT,slip_submitted_at TIMESTAMPTZ);
 CREATE TABLE agent_calendar_events(id SERIAL PRIMARY KEY,created_by_user_id INT,title TEXT,location TEXT,starts_at TIMESTAMPTZ,kind TEXT,status TEXT DEFAULT 'scheduled',updated_at TIMESTAMPTZ DEFAULT now());
 CREATE TABLE lead_viewings(id INT PRIMARY KEY,created_by_user_id INT,lead_id INT,rent_room_id INT,status TEXT,scheduled_at TIMESTAMPTZ);
 INSERT INTO properties VALUES(1,'Demo Condo','Bangkok');INSERT INTO master_room_statuses VALUES(1,'available'),(2,'rented');INSERT INTO master_room_types VALUES(1,1);
 INSERT INTO rent_rooms VALUES(1,7,true,'published','A101','2026-10-16',1,1,1,NULL,NULL),(2,7,true,'private','A102','2026-10-15',2,1,1,NULL,'[{"price":"18000.50"}]'),
 (3,7,true,'private','A103','2026-10-14',1,1,1,NULL,NULL),(4,8,true,'published','SECRET','2026-10-16',1,1,1,NULL,NULL),(5,7,false,NULL,'owner-room','2026-10-16',1,1,1,NULL,NULL);
 INSERT INTO rent_room_prices(rent_room_id,price) VALUES(1,24000),(1,26000);
 INSERT INTO leads VALUES(1,7,'Demo Open','new','2026-10-16T02:00Z'),(2,7,'Demo Inprogress','inprogress','2026-10-15'),(3,7,'Booked','booked','2026-10-14'),(4,7,'Lost','lost','2026-10-13'),(99,8,'SECRET','new','2026-10-16');
 INSERT INTO tenants VALUES(10,7,'Demo Tenant'),(11,7,'Demo %_ Signing'),(12,7,'Former Tenant'),(13,7,'Future Tenant'),(14,7,'Renew Tenant'),(99,8,'SECRET');
 INSERT INTO agreement_templates VALUES(1,'lease'),(2,'renewal'),(3,'broker_appointment'),(4,'reservation');
 INSERT INTO master_agreement_types VALUES('lease','lease');
 INSERT INTO lease_contracts(id,created_by_user_id,tenant_id,rent_room_id,status,start_date,end_date,monthly_rent,template_id,contract_no,party_snapshot)
 VALUES(100,7,10,1,'active','2026-01-01','2026-10-20',10000,1,'LEASE-100','{}'),(101,7,11,2,'awaiting_signatures','2026-10-20','2027-10-19',12000,1,'SIGN-101','{}'),
 (102,7,11,2,'awaiting_signatures','2026-10-21','2027-10-20',12000,1,'SIGN-102','{}'),(103,7,12,2,'expired','2025-01-01','2026-09-30',10000,1,'ENDED','{}'),
 (104,7,13,3,'active','2026-11-01','2027-10-31',10000,1,'FUTURE','{}'),(105,7,14,3,'active','2026-01-01','2026-10-25',10000,1,'RENEW-105','{}'),
 (110,7,10,1,'draft','2026-10-21','2027-10-20',11000,2,'RN-110','{}'),(999,8,99,4,'active','2026-01-01','2026-10-25',99000,1,'SECRET','{}'),
 (998,7,99,4,'awaiting_signatures','2026-01-01','2026-10-25',99000,1,'CROSS-AGENT','{}');
 INSERT INTO lease_contracts(id,created_by_user_id,tenant_id,rent_room_id,status,start_date,end_date,monthly_rent,template_id,contract_no,party_snapshot)
 VALUES(106,7,12,2,'active','2025-01-01','2026-09-30',10000,1,'STALE-ACTIVE','{}'),(107,7,12,2,'active','2025-01-01',NULL,10000,4,'OLD-BOOKING','{}');
 UPDATE lease_contracts SET previous_agreement_id=100 WHERE id=110;
 INSERT INTO lease_contracts(id,created_by_user_id,tenant_id,rent_room_id,status,start_date,end_date,monthly_rent,template_id,contract_no,party_snapshot)
 SELECT n,7,11,2,'awaiting_signatures','2026-10-20','2027-10-19',12000,1,'SIGN-'||n,'{}' FROM generate_series(300,344)n;
 INSERT INTO tenant_bills VALUES(1,100,10,'B-1','2026-10-10','2026-10-15',10000,'paid','2026-10-16T01:00Z',NULL,NULL),
 (2,100,10,'B-2','2026-10-01','2026-10-06',2000,'pending',NULL,NULL,NULL),
 (3,105,14,'B-3','2026-10-20','2026-10-25',3000,'pending',NULL,NULL,NULL),
 (4,105,14,'B-4','2026-10-01','2026-10-06',4000,'pending',NULL,'PRIVATE-SLIP','2026-10-15'),
 (5,103,12,'B-5','2026-09-20','2026-09-25',500,'pending',NULL,NULL,NULL),
 (999,999,99,'SECRET','2026-10-01','2026-10-06',999999,'pending',NULL,NULL,NULL);
 UPDATE lease_contracts SET tenant_delivered_at='2026-10-16T01:30Z' WHERE id=101;
 INSERT INTO lead_viewings VALUES(1,7,1,1,'scheduled','2026-10-16T04:00Z'),(2,7,1,1,'scheduled','2026-10-16T05:00Z'),(3,7,1,1,'scheduled','2026-10-16T06:00Z'),
 (4,7,1,1,'scheduled','2026-10-16T07:00Z'),(5,7,1,1,'scheduled','2026-10-16T01:00Z'),(6,7,1,1,'cancelled','2026-10-16T04:00Z'),
 (7,7,1,1,'done','2026-10-16T04:00Z'),(8,7,1,1,'scheduled','2026-10-17T04:00Z'),(9,8,99,4,'scheduled','2026-10-16T04:00Z'),(10,7,3,1,'scheduled','2026-10-16T04:00Z');
 `);
 const queries=[];const service=new AgentDashboardService({query:async(sql,args)=>{queries.push(sql);return db.query(sql,args)}});
 const dashboard={summary:(id,q)=>service.summary(id,q,clock),workItems:(id,q)=>service.workItems(id,q,clock)};
 const users={agent:{id:7,roleNames:['agent']},other:{id:8,roleNames:['agent']},tenant:{id:9,roleNames:['tenant']}};
 const auth={findBySupabaseUserId:async key=>users[key],loadUserWithRoles:async id=>Object.values(users).find(u=>u.id===id)};
 class DashboardTestModule{};Module({controllers:[AgentDashboardController],providers:[AuthGuard,RolesGuard,{provide:AuthService,useValue:auth},{provide:AgentDashboardService,useValue:dashboard}]})(DashboardTestModule);
 process.env.ALLOW_DEV_AUTH='true';app=await NestFactory.create(DashboardTestModule,{logger:false});await app.listen(0,'127.0.0.1');
 const base=`http://127.0.0.1:${app.getHttpServer().address().port}/agent/dashboard`;
 const request=async(url='',actor='agent')=>{const r=await fetch(base+url,{headers:actor?{authorization:`Bearer dev|${actor}|fixture@example.invalid`}:{}});return{status:r.status,body:await r.json()}};
 await t.test('aggregates distinct current clients, inventory, real events and unavailable features',async()=>{
 const r=await request();assert.equal(r.status,200,JSON.stringify(r.body));const d=r.body;
 assert.deepEqual(d.business,{status:'available',availableListings:2,totalListings:3,openLeads:2,currentClients:4,tenantsCount:2,commissionPending:null,currency:'THB'});
 assert.equal(d.inventory.published,1);assert.equal(d.inventory.private,2);assert.equal(d.inventory.preview.length,2);assert.equal(d.inventory.preview[0].price,24000);assert.equal(d.inventory.preview[1].price,18000.5);
 assert.equal(d.clients.draft,1);assert.equal(d.clients.signing,1);assert.equal(d.clients.renewal.id,'105');assert.equal(d.clients.renewal.daysLeft,9);
 assert.equal(d.commission.status,'not_configured');assert.equal(d.commission.received,null);assert.equal(d.commission.pending,null);
 const follow=d.actionRequired.items.find(i=>i.kind==='lead_follow_up');assert.equal(follow.status,'not_configured');assert.equal(follow.count,null);
 assert.deepEqual(d.activity.items.map(i=>i.id),['lead:1','contract:101','payment:1']);assert.equal(d.activity.items[1].deepLink.contractId,101);
 assert.doesNotMatch(JSON.stringify(d),/SECRET|PRIVATE-SLIP|signature_url/);
 });
 await t.test('a just-booked client with no contract is preparing, while released bookings and history stay excluded',async()=>{
 await db.query("INSERT INTO tenants VALUES(15,7,'Just booked'),(16,7,'Released'); INSERT INTO leads VALUES(15,7,'Just booked','booked','2026-10-16',15,1,NULL),(16,7,'Released','booked','2026-10-16',16,1,'2026-10-16')");
 try { const d=(await request()).body;assert.equal(d.business.currentClients,5);assert.equal(d.clients.draft,2);assert.equal(d.business.tenantsCount,2); }
 finally { await db.query('DELETE FROM leads WHERE id IN (15,16); DELETE FROM tenants WHERE id IN (15,16)'); }
 });
 await t.test('rent is the same period cohort with pending separate from overdue; historic debt stays in the work queue',async()=>{
 const d=(await request()).body;assert.deepEqual([d.rent.totalDue,d.rent.received,d.rent.pending,d.rent.overdue,d.rent.unpaid],[19000,10000,3000,6000,9000]);
 const overdue=d.actionRequired.items.find(i=>i.kind==='overdue_payment');assert.equal(overdue.count,3);assert.equal(overdue.amount,6500);
 const work=(await request('/work-items?kind=overdue_payment')).body;assert.equal(work.total,3);assert.equal(work.items.find(i=>i.billId===4).awaitingReview,true);
 const rent=(await request('/work-items?kind=rent')).body;assert.equal(rent.total,4);assert.equal(rent.items.find(i=>i.billId===4).status,'awaiting_review');
 const prior=(await request('?period=2026-09')).body;assert.equal(prior.rent.totalDue,500);assert.equal(prior.rent.overdue,500);
 });
 await t.test('work counts equal server-paginated totals and literal search is before paging',async()=>{
 const d=(await request()).body;const count=d.actionRequired.items.find(i=>i.kind==='awaiting_signature').count;assert.equal(count,47);
 for(const [p,n]of [[1,20],[2,20],[3,7],[4,0]]){const r=await request(`/work-items?kind=awaiting_signature&page=${p}`);assert.equal(r.status,200);assert.equal(r.body.total,count);assert.equal(r.body.items.length,n);}
 assert.equal((await request('/work-items?kind=awaiting_signature&q=%25_')).body.total,47);
 assert.equal((await request('/work-items?kind=renewal')).body.total,1);
 });
 await t.test('today schedule includes past times, completed viewings and closed leads, without a three-item cap',async()=>{
 const d=(await request()).body;assert.equal(d.schedule.total,7);assert.deepEqual(d.schedule.items.map(i=>i.id),['5','1','10','7','2','3','4']);assert.equal(d.schedule.items.find(i=>i.id==='7').status,'done');assert.equal(d.schedule.items.length,d.schedule.total);assert.ok(!d.schedule.items.some(i=>['6','8','9'].includes(i.id)));
 const after=await service.summary(7,{},new Date('2026-10-16T16:59:59Z'));assert.equal(after.schedule.total,7);assert.deepEqual(after.schedule.items,d.schedule.items);
 const tomorrow=await service.summary(7,{},new Date('2026-10-16T17:00:00Z'));assert.equal(tomorrow.today,'2026-10-17');assert.equal(tomorrow.schedule.items[0].id,'8');
 });
 await t.test('saved calendar appointments appear on the dashboard with their title and Bangkok day boundaries',async()=>{
 const {AgentCalendarService}=require('../src/agent/calendar/agent-calendar.service.ts');
 const calendar=new AgentCalendarService(db);
 const saved=await calendar.create(7,{title:'Key handover',location:'Lobby',startsAt:'2026-10-16T10:30:00+07:00'});
 await calendar.create(7,{title:'Early appointment',startsAt:'2026-10-16T00:00:00+07:00'});
 await calendar.create(7,{title:'Yesterday',startsAt:'2026-10-15T23:59:59+07:00'});
 await calendar.create(8,{title:'SECRET',location:'SECRET',startsAt:'2026-10-16T10:15:00+07:00'});
 await calendar.create(7,{title:'Tomorrow',startsAt:'2026-10-17T00:00:00+07:00'});
 try {
 const d=(await request()).body;assert.equal(d.schedule.total,9);assert.equal(d.schedule.items.length,9);assert.ok(d.schedule.items.some(i=>i.title==='Early appointment'));const item=d.schedule.items.find(i=>i.id===saved.id);
 assert.ok(item);assert.equal(item.kind,'custom');assert.equal('kindLabel' in item,false);assert.equal(item.title,'Key handover');assert.doesNotMatch(JSON.stringify(d.schedule),/SECRET|Tomorrow|Yesterday/);
 const late=await service.summary(7,{},new Date('2026-10-16T16:59:59Z'));assert.equal(late.schedule.total,9);assert.deepEqual(late.schedule.items,d.schedule.items);
 await calendar.update(7,Number(saved.id.slice(6)),{status:'cancelled'});assert.equal((await request()).body.schedule.total,8);
 const tomorrow=await service.summary(7,{},new Date('2026-10-16T17:00:00Z'));assert.ok(tomorrow.schedule.items.some(i=>i.title==='Tomorrow'));assert.ok(!tomorrow.schedule.items.some(i=>i.title==='Early appointment'));
 } finally {await db.query('DELETE FROM agent_calendar_events');}
 });
 await t.test('authentication, scalar validation and isolation; no dashboard reads modify data',async()=>{
 for(const route of ['', '/work-items?kind=rent'])for(const [actor,status]of [[null,401],['missing',401],['tenant',403]])assert.equal((await request(route,actor)).status,status);
 for(const url of ['?period=2026-13','?period=2026-10&period=2026-11','?agentId=8','/work-items?kind=lead_follow_up','/work-items?kind=rent&page=0','/work-items?kind=rent&q=a&q=b'])assert.equal((await request(url)).status,400);
 const other=(await request('','other')).body;assert.equal(other.business.totalListings,1);assert.equal(other.business.currentClients,1);assert.equal(other.rent.totalDue,999999);
 assert.ok(queries.every(q=>q.startsWith('WITH ')));assert.ok(queries.every(q=>!/^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER)\b/im.test(q)));
 assert.equal((await db.query('SELECT count(*)::int AS count FROM tenant_bills'))[0].count,6);
 });
 }finally{if(app)await app.close();if(previous===undefined)delete process.env.ALLOW_DEV_AUTH;else process.env.ALLOW_DEV_AUTH=previous;if(db.isInitialized)await db.destroy();await admin.query(`DROP SCHEMA IF EXISTS "${scratch}" CASCADE`);await admin.end();}
});
