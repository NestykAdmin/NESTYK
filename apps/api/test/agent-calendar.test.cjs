const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require('reflect-metadata');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}}).outputText,f);
const {calendarInput,calendarPatch,calendarRange,AgentCalendarService}=require('../src/agent/calendar/agent-calendar.service.ts');
const {AgentCalendarController}=require('../src/agent/calendar/agent-calendar.controller.ts');
const {AuthService}=require('../src/auth/auth.service.ts');
const valid={title:' รับกุญแจ ',location:' Condo A ',startsAt:'2026-10-16T15:30:00+07:00'};
test('calendar saves with only title, location and time; validates input and supports older clients',()=>{
 assert.deepEqual(calendarInput(valid),{title:'รับกุญแจ',location:'Condo A',kind:'',startsAt:'2026-10-16T08:30:00.000Z'});
 assert.equal(calendarInput({...valid,kind:' รับกุญแจ '}).kind,'รับกุญแจ');
 for(const patch of [{kind:'x'.repeat(81)},{kind:3},{title:''},{title:'x'.repeat(161)},{location:'x'.repeat(161)},{location:[]},{title:'\0'},{startsAt:'2026-02-30T12:00:00Z'},{startsAt:'2026-10-16T15:30'},{startsAt:'2026-13-16T15:30Z'},{created_by_user_id:8},{status:'confirmed'}])assert.throws(()=>calendarInput({...valid,...patch}),{status:400});
 for(const value of [null,[],3])assert.throws(()=>calendarInput(value),{status:400});
 const from='2026-10-01T00:00:00Z',to='2026-11-01T00:00:00Z';assert.ok(calendarRange(from,to).start instanceof Date);
 for(const pair of [[to,from],[from,from],[from,'2027-01-01T00:00:00Z'],[[from,from],to],['soon',to]])assert.throws(()=>calendarRange(...pair),{status:400});
});
test('calendar real database and HTTP persists across fresh service instances and isolates agents', {skip:process.env.RUN_CALENDAR_DB_TEST!=='1',timeout:60000},async t=>{
 require('dotenv').config({path:path.resolve(__dirname,'../../../.env.api'),quiet:true});
 const {DataSource}=require('typeorm'),{Module}=require('@nestjs/common'),{NestFactory}=require('@nestjs/core');
 const scratch=`calendar_test_${Date.now()}_${process.pid}`;
 const ssl=/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)?false:{rejectUnauthorized:false};
 const db=new DataSource({type:'postgres',url:process.env.DATABASE_URL,ssl,entities:[],extra:{options:`-c search_path=${scratch}`,statement_timeout:10000}});
 let app;const previous=process.env.ALLOW_DEV_AUTH;
 await db.initialize();try{
 await db.query(`CREATE SCHEMA "${scratch}"; CREATE TABLE "${scratch}".users(id INT PRIMARY KEY); INSERT INTO "${scratch}".users VALUES(7),(8)`);
 const migration=fs.readFileSync(path.resolve(__dirname,'../../../supabase/migrations/20261016082206_agent_calendar_events.sql'),'utf8').replaceAll('public.',`"${scratch}".`);
 await db.query(migration);
 await db.query(fs.readFileSync(path.resolve(__dirname,'../../../supabase/migrations/20261016085246_calendar_management.sql'),'utf8').replaceAll('public.',`"${scratch}".`));
 assert.equal((await db.query("SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname='agent_calendar_events'",[scratch]))[0].relrowsecurity,true);
 const service=new AgentCalendarService(db);
 class CalendarTestModule{};Module({controllers:[AgentCalendarController],providers:[{provide:AgentCalendarService,useValue:service},{provide:AuthService,useValue:{findBySupabaseUserId:async id=>['7','8','9'].includes(id)?{id:Number(id)}:null,loadUserWithRoles:async id=>({id,roleNames:id===9?['tenant']:['agent']})}}]})(CalendarTestModule);
 process.env.ALLOW_DEV_AUTH='true';app=await NestFactory.create(CalendarTestModule,{logger:false});await app.listen(0,'127.0.0.1');
 const base=(await app.getUrl())+'/agent/calendar/events';
 const call=(query='',{user=7,body,method}={})=>fetch(base+query,{method:method??(body===undefined?'GET':'POST'),headers:{'Content-Type':'application/json',...(user?{authorization:`Bearer dev|${user}|fixture@example.invalid`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const range='?from=2026-10-16T00:00:00%2B07:00&to=2026-10-17T00:00:00%2B07:00';
 for(const user of [null,9]){assert.equal((await call(range,{user})).status,user?403:401);assert.equal((await call('',{user,body:valid})).status,user?403:401)}
 assert.equal((await call('',{body:{...valid,title:' '}})).status,400);
 assert.equal((await call(range+'&from=2026-10-15T00:00:00Z')).status,400);
 const created=await call('',{body:valid});assert.equal(created.status,201);const saved=await created.json();assert.match(saved.id,/^event-\d+$/);assert.equal(saved.kind,'');assert.equal(saved.title,'รับกุญแจ');
 assert.deepEqual(await (await call(range)).json(),[saved]);
 assert.deepEqual(await (await call(range,{user:8})).json(),[]);
 const fresh=new AgentCalendarService(db);assert.deepEqual(await fresh.list(7,'2026-10-16T00:00:00+07:00','2026-10-17T00:00:00+07:00'),[saved]);
 await fresh.create(7,{...valid,startsAt:'2026-10-17T00:00:00+07:00'});
 await fresh.create(8,valid);
 assert.deepEqual(await fresh.list(7,'2026-10-16T00:00:00+07:00','2026-10-17T00:00:00+07:00'),[saved]);
 assert.equal((await db.query('SELECT count(*)::int AS count FROM agent_calendar_events'))[0].count,3);
 assert.equal(saved.status,'scheduled');
 const suffix='/'+saved.id.slice(6);
 for(const user of [null,9,8])assert.equal((await call(suffix,{user,method:'PATCH',body:{title:'Forbidden'}})).status,user===null?401:user===9?403:404);
 for(const body of [{},{title:''},{status:'unknown'},{created_by_user_id:8}])assert.equal((await call(suffix,{method:'PATCH',body})).status,400);
 let response=await call(suffix,{method:'PATCH',body:{title:'Updated appointment',location:'New lobby',startsAt:'2026-10-16T16:00:00+07:00'}});
 assert.equal(response.status,200);assert.equal((await response.json()).title,'Updated appointment');
 response=await call(suffix,{method:'PATCH',body:{status:'done'}});assert.equal((await response.json()).status,'done');
 assert.equal((await (await call(range)).json())[0].status,'done');
 response=await call(suffix,{method:'PATCH',body:{status:'scheduled'}});assert.equal((await response.json()).status,'scheduled');
 await Promise.all([fresh.update(7,Number(saved.id.slice(6)),{title:'Concurrent title'}),fresh.update(7,Number(saved.id.slice(6)),{location:'Concurrent location'})]);
 const changed=(await fresh.list(7,'2026-10-16T00:00:00+07:00','2026-10-17T00:00:00+07:00'))[0];assert.equal(changed.title,'Concurrent title');assert.equal(changed.location,'Concurrent location');
 response=await call(suffix,{method:'PATCH',body:{status:'cancelled'}});assert.equal((await response.json()).status,'cancelled');
 assert.deepEqual(await (await call(range)).json(),[]);
 assert.equal((await db.query('SELECT status FROM agent_calendar_events WHERE id=$1',[saved.id.slice(6)]))[0].status,'cancelled');
 assert.equal((await call(suffix,{method:'PATCH',body:{status:'scheduled'}})).status,409);
 await db.query("UPDATE agent_calendar_events SET status='pending' WHERE created_by_user_id=8");
 assert.equal((await fresh.list(8,'2026-10-16T00:00:00+07:00','2026-10-17T00:00:00+07:00'))[0].status,'scheduled');


 }finally{if(app)await app.close();if(previous===undefined)delete process.env.ALLOW_DEV_AUTH;else process.env.ALLOW_DEV_AUTH=previous;await db.query(`DROP SCHEMA IF EXISTS "${scratch}" CASCADE`);await db.destroy();}
});

test('calendar patches validate only supplied fields and disallow ownership or unsupported statuses',()=>{
 assert.deepEqual(calendarPatch({title:' Updated ',location:''}),{title:'Updated',location:''});
 assert.deepEqual(calendarPatch({status:'cancelled'}),{status:'cancelled'});
 for(const body of [{},{title:' '},{startsAt:'bad'},{status:'confirmed'},{created_by_user_id:8}])assert.throws(()=>calendarPatch(body),{status:400});
});
