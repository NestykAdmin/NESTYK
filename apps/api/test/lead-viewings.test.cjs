const { test }=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');require('reflect-metadata');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(require('node:fs').readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true},fileName:filename}).outputText,filename);
const V=require('../src/agent/leads/lead-viewings.service.ts');const {LeadViewingsController}=require('../src/agent/leads/lead-viewings.controller.ts');
const {AuthService}=require('../src/auth/auth.service.ts');const {Module}=require('@nestjs/common');const {NestFactory}=require('@nestjs/core');

const hour=3600e3;const at=ms=>new Date(Date.now()+ms).toISOString();

test('viewing input needs a room and a future time within a year; patches need a known field',()=>{
 const ok=V.validateViewingInput({rentRoomId:3,scheduledAt:at(hour),note:'  bring keys '});
 assert.equal(ok.rentRoomId,3);assert.equal(ok.note,'bring keys');assert.ok(ok.scheduledAt instanceof Date);
 assert.equal(V.validateViewingInput({rentRoomId:3,scheduledAt:at(hour),note:'   '}).note,null);
 for(const body of [null,[],{scheduledAt:at(hour)},{rentRoomId:0,scheduledAt:at(hour)},{rentRoomId:3},{rentRoomId:3,scheduledAt:'soon'},{rentRoomId:3,scheduledAt:at(-hour)},{rentRoomId:3,scheduledAt:at(400*24*hour)},{rentRoomId:3,scheduledAt:at(hour),note:'x'.repeat(501)}])
  assert.throws(()=>V.validateViewingInput(body),undefined,JSON.stringify(body));
 assert.deepEqual(V.validateViewingPatch({status:'done'}),{status:'done'});
 for(const body of [{},{status:'maybe'},{scheduledAt:at(-hour)}]) assert.throws(()=>V.validateViewingPatch(body),undefined,JSON.stringify(body));
});

/** Just enough of TypeORM's find operators for the service's queries. */
function matches(row,where){
 return Object.entries(where).every(([key,want])=>{
  const have=row[key];
  if(want&&typeof want==='object'&&'_type' in want){
   const v=want._value;
   if(want._type==='moreThan')return new Date(have)>new Date(v);
   if(want._type==='between')return new Date(have)>=new Date(v[0])&&new Date(have)<=new Date(v[1]);
   if(want._type==='not')return have!==v;
   throw new Error('operator '+want._type);
  }
  return have===want;
 });
}

function fakeService(){
 const leads=[{id:5,created_by_user_id:7,name:'May',status:'inprogress'},{id:6,created_by_user_id:7,name:'Non',status:'booked'},{id:9,created_by_user_id:8,name:'Other',status:'new'}];
 const rooms=[{id:11,created_by_user_id:7,listing_title:'Studio',room_id:'1208',property:{name:'The Line'}},{id:12,created_by_user_id:7,listing_title:'Loft',room_id:null,property:null},{id:13,created_by_user_id:99,listing_title:'Theirs',room_id:null,property:null}];
 const rows=[];let seq=0;
 const withRelations=r=>({...r,lead:leads.find(l=>l.id===r.lead_id),rent_room:rooms.find(x=>x.id===r.rent_room_id)});
 const viewingRepo={
  create:b=>({...b}),
  save:async b=>{const r={...b,id:++seq,created_at:new Date(),updated_at:new Date()};rows.push(r);return r;},
  find:async({where,order})=>rows.filter(r=>matches(r,where)).sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at)||a.id-b.id).map(withRelations),
  findOne:async({where})=>{const r=rows.find(x=>matches(x,where));return r?withRelations(r):null;},
  findOneBy:async where=>rows.find(x=>matches(x,where))??null,
  update:async(where,patch)=>{for(const r of rows)if(matches(r,where))Object.assign(r,patch);},
 };
 const leadWrites={update:async(where,patch)=>{for(const l of leads)if(matches(l,where))Object.assign(l,patch);}};
 const em={
  findOne:async(entity,{where})=>leads.find(l=>matches(l,where))??null,
  findOneBy:async(entity,where)=>(entity.name==='RentRoomEntity'?rooms:rows).find(x=>matches(x,where))??null,
  getRepository:entity=>(entity.name==='LeadEntity'?leadWrites:viewingRepo),
 };
 viewingRepo.manager={transaction:async fn=>fn(em)};
 const leadRepo={findOne:async({where})=>leads.find(l=>matches(l,where))??null,manager:{transaction:async fn=>fn(em)}};
 return {service:new V.LeadViewingsService(leadRepo,viewingRepo),rows,leads};
}

test('viewings HTTP API books, lists by lead and by range, and moves or closes a viewing',async(t)=>{
 process.env.ALLOW_DEV_AUTH='true';
 const f=fakeService();
 class TestModule{};Module({controllers:[LeadViewingsController],providers:[{provide:V.LeadViewingsService,useValue:f.service},{provide:AuthService,useValue:{findBySupabaseUserId:async id=>({id:Number(id)}),loadUserWithRoles:async id=>({id,roleNames:id===8?['guest']:['agent']})}}]})(TestModule);
 const app=await NestFactory.create(TestModule,{logger:false});t.after(()=>app.close());app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');const base=(await app.getUrl())+'/api/v1/agent/';
 const headers=id=>({'Content-Type':'application/json',Authorization:`Bearer dev|${id}|test@example.invalid`});
 const call=(path,{method='GET',user=7,body}={})=>fetch(base+path,{method,headers:headers(user),body:body==null?undefined:JSON.stringify(body)});
 const when=at(2*hour);

 assert.equal((await fetch(base+'leads/5/viewings')).status,401);
 assert.equal((await call('leads/5/viewings',{method:'POST',user:8,body:{rentRoomId:11,scheduledAt:when}})).status,403);
 assert.equal((await call('leads/9/viewings',{method:'POST',body:{rentRoomId:11,scheduledAt:when}})).status,404);
 assert.equal((await call('leads/5/viewings',{method:'POST',body:{rentRoomId:13,scheduledAt:when}})).status,404);
 assert.equal((await call('leads/5/viewings',{method:'POST',body:{rentRoomId:11,scheduledAt:at(-hour)}})).status,400);
 const closed=await call('leads/6/viewings',{method:'POST',body:{rentRoomId:11,scheduledAt:when}});assert.equal(closed.status,409);assert.equal((await closed.json()).code,'LEAD_CLOSED');

 const may=f.leads[0];
 const touched=async(fn)=>{may.updated_at=null;await fn();assert.ok(may.updated_at instanceof Date,'lead updated_at moves');};
 let created;
 await touched(async()=>{created=await call('leads/5/viewings',{method:'POST',body:{rentRoomId:11,scheduledAt:when,note:'Lobby'}});});
 assert.equal(created.status,201);
 const v=await created.json();
 assert.deepEqual({...v,createdAt:undefined},{id:1,leadId:5,leadName:'May',rentRoomId:11,roomTitle:'The Line',roomNumber:'1208',scheduledAt:when,status:'scheduled',note:'Lobby',createdAt:undefined});
 const dup=await call('leads/5/viewings',{method:'POST',body:{rentRoomId:11,scheduledAt:at(3*hour)}});assert.equal(dup.status,409);assert.equal((await dup.json()).code,'VIEWING_EXISTS');
 const other=await (await call('leads/5/viewings',{method:'POST',body:{rentRoomId:12,scheduledAt:at(hour)}})).json();
 assert.equal(other.roomTitle,'Loft');assert.equal(other.roomNumber,null);

 assert.deepEqual((await (await call('leads/5/viewings')).json()).map(x=>x.id),[2,1]);
 assert.equal((await call('leads/9/viewings')).status,404);

 const from=at(-hour),to=at(5*hour);
 assert.deepEqual((await (await call(`viewings?from=${from}&to=${to}`)).json()).map(x=>x.id),[2,1]);
 assert.equal((await call(`viewings?from=${to}&to=${from}`)).status,400);
 assert.equal((await call(`viewings?from=${from}&to=${at(70*24*hour)}`)).status,400);
 assert.deepEqual(await (await call(`viewings?from=${from}&to=${to}`,{user:9})).json(),[]);

 const later=at(4*hour);
 let moved;
 await touched(async()=>{moved=await (await call('viewings/1',{method:'PATCH',body:{scheduledAt:later}})).json();});
 assert.equal(moved.scheduledAt,later);
 assert.equal((await call('viewings/1',{method:'PATCH',user:9,body:{status:'done'}})).status,404);
 assert.equal((await call('viewings/1',{method:'PATCH',body:{}})).status,400);
 let cancelled;
 await touched(async()=>{cancelled=await (await call('viewings/2',{method:'PATCH',body:{status:'cancelled'}})).json();});
 assert.equal(cancelled.status,'cancelled');
 assert.deepEqual((await (await call(`viewings?from=${from}&to=${to}`)).json()).map(x=>x.id),[1]);
 const reopen=await call('viewings/2',{method:'PATCH',body:{status:'scheduled'}});assert.equal(reopen.status,409);assert.equal((await reopen.json()).code,'VIEWING_CLOSED');
 await touched(async()=>{assert.equal((await call('viewings/2',{method:'PATCH',body:{note:'Changed mind'}})).status,200);});

 const again=await call('leads/5/viewings',{method:'POST',body:{rentRoomId:12,scheduledAt:at(hour)}});assert.equal(again.status,201);
});
