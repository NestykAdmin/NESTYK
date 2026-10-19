const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require('reflect-metadata');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:true}}).outputText,f);
const {LeadViewingsService}=require('../src/agent/leads/lead-viewings.service.ts');
test('real PostgreSQL locks serialize competing reschedules and prevent moving a concurrently cancelled viewing',{skip:process.env.RUN_CALENDAR_DB_TEST!=='1',timeout:30000},async()=>{
 require('dotenv').config({path:path.resolve(__dirname,'../../../.env.api'),quiet:true});
 const {DataSource}=require('typeorm');const scratch=`viewing_lock_test_${Date.now()}_${process.pid}`;
 const db=new DataSource({type:'postgres',url:process.env.DATABASE_URL,ssl:/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)?false:{rejectUnauthorized:false},entities:[],extra:{options:`-c search_path=${scratch}`,statement_timeout:10000}});
 await db.initialize();try{
 await db.query(`CREATE SCHEMA "${scratch}";CREATE TABLE leads(id INT PRIMARY KEY,created_by_user_id INT,status TEXT,updated_at TIMESTAMPTZ);INSERT INTO leads VALUES(5,7,'inprogress',now());CREATE TABLE lead_viewings(id INT PRIMARY KEY,lead_id INT,rent_room_id INT,created_by_user_id INT,scheduled_at TIMESTAMPTZ,status TEXT,note TEXT,created_at TIMESTAMPTZ DEFAULT now());INSERT INTO lead_viewings(id,lead_id,rent_room_id,created_by_user_id,scheduled_at,status) VALUES(1,5,11,7,now()-interval '2 hours','scheduled'),(2,5,11,7,now()-interval '1 hour','scheduled');`);
 // Adapt only the repository calls used by this service to real SQL. Locks and transactions execute in PostgreSQL.
 function whereSql(where){const args=[];const sql=Object.entries(where).map(([key,want])=>{let operator='=';if(want&&typeof want==='object'&&'_type'in want){operator=want._type==='not'?'<>':'>';want=want._value}args.push(want);return `${key} ${operator} $${args.length}`}).join(' AND ');return{sql,args}}
 function viewingRepo(executor){
  const find=async({where,lock})=>{const {sql,args}=whereSql(where);const rows=await executor.query(`SELECT * FROM lead_viewings WHERE ${sql} ORDER BY id LIMIT 1${lock?' FOR UPDATE':''}`,args);const row=rows[0];return row?{...row,lead:{name:'Fixture'},rent_room:{listing_title:'Fixture room',room_id:'A1'}}:null};
  return{findOne:find,findOneBy:where=>find({where}),update:async(where,patch)=>{const {sql,args}=whereSql(where);const set=Object.entries(patch).map(([key,value])=>{args.push(value);return `${key}=$${args.length}`}).join(',');await executor.query(`UPDATE lead_viewings SET ${set} WHERE ${sql}`,args)}};
 }
 const initial=viewingRepo(db);initial.manager={transaction:fn=>db.transaction(async real=>fn({
  findOne:async(_,{where,lock})=>{const {sql,args}=whereSql(where);return(await real.query(`SELECT * FROM leads WHERE ${sql}${lock?' FOR UPDATE':''}`,args))[0]},
  getRepository:entity=>entity.name==='LeadViewingEntity'?viewingRepo(real):{update:async()=>real.query('UPDATE leads SET updated_at=now() WHERE id=5')},
 }))};
 const service=new LeadViewingsService({},initial),future=new Date(Date.now()+7200000).toISOString();
 const results=await Promise.allSettled([service.update(7,1,{scheduledAt:future}),service.update(7,2,{scheduledAt:future})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 assert.equal((await db.query("SELECT count(*)::int AS total FROM lead_viewings WHERE status='scheduled' AND scheduled_at>now()"))[0].total,1);
 const id=results.find(r=>r.status==='fulfilled').value.id;
 let release;const locked=new Promise(resolve=>release=resolve);let cancelEntered;const entered=new Promise(resolve=>cancelEntered=resolve);
 const cancel=db.transaction(async em=>{await em.query('SELECT * FROM leads WHERE id=5 FOR UPDATE');await em.query("UPDATE lead_viewings SET status='cancelled' WHERE id=$1",[id]);cancelEntered();await locked});
 await entered;const move=service.update(7,id,{scheduledAt:new Date(Date.now()+10800000).toISOString()});release();await cancel;
 await assert.rejects(move,{status:409});assert.equal((await db.query('SELECT status FROM lead_viewings WHERE id=$1',[id]))[0].status,'cancelled');
 }finally{await db.query(`DROP SCHEMA IF EXISTS "${scratch}" CASCADE`);await db.destroy()}
});
