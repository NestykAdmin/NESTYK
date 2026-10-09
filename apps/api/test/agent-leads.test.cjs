const { test }=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');require('reflect-metadata');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(require('node:fs').readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true},fileName:filename}).outputText,filename);
const {AgentLeadsService,validateLead,normalizeLeadSort,phoneSearchDigits}=require('../src/agent/leads/agent-leads.service.ts');const {AgentLeadsController}=require('../src/agent/leads/agent-leads.controller.ts');const {AuthService}=require('../src/auth/auth.service.ts');const {Module}=require('@nestjs/common');const {NestFactory}=require('@nestjs/core');
// Fake transaction: pin writes land on the lead row returned by rowById.
const withTx=(repo,rowById)=>{const pinRepo={delete:async({lead_id})=>{const r=rowById(lead_id);if(r)r.pins=[];},insert:async list=>{const r=rowById(list[0].lead_id);if(r)r.pins=list.map(p=>({...p}));}};repo.manager={...(repo.manager||{}),getRepository:e=>e.name==='LeadViewingEntity'?viewingRepo(repo):repo,transaction:async fn=>fn({getRepository:e=>e.name==='LeadLocationEntity'?pinRepo:repo})};return repo;};
// Fake next-viewing query: rows come from repo.nextViewings (one viewing entity per lead), filtered to the requested ids.
const viewingRepo=repo=>({createQueryBuilder:()=>{let ids=[];const qb={leftJoinAndSelect:()=>qb,distinctOn:()=>qb,where:(_,p)=>{ids=p.ids;return qb;},andWhere:()=>qb,orderBy:()=>qb,addOrderBy:()=>qb,getMany:async()=>(repo.nextViewings||[]).filter(v=>ids.includes(v.lead_id))};return qb;}});
// Fake status-count query from qb.clone(); rows default to none.
const countsFake=(rows=[])=>()=>{const c={select:()=>c,addSelect:()=>c,groupBy:()=>c,getRawMany:async()=>rows};return c;};
const asok={rank:1,placeId:'test-place',name:'BTS Asok',latitude:13.737,longitude:100.56,province:'กรุงเทพมหานคร',district:'วัฒนา'};
const klongtoei={rank:2,placeId:null,name:'Klong Toei Market',latitude:13.722,longitude:100.557,province:'กรุงเทพมหานคร',district:'คลองเตย'};
test('lead validation requires name/phone and preserves unknown versus false',()=>{
 const value=validateLead({province:'กรุงเทพมหานคร',name:'  A  ',phone:' 123 ',hasPets:false});assert.equal(value.name,'A');assert.equal(value.hasPets,false);assert.equal(value.usesCar,null);
 for(const patch of [{province:'กรุงเทพมหานคร',name:''},{phone:5},{budgetMin:-1},{budgetMax:Infinity},{budgetMin:200,budgetMax:100},{budgetMax:0},{occupantCount:0},{leaseDurationMonths:1.5},{visaTypeId:0},{hasPets:'false'},{nationality:[]},{budgetMax:1.111},{notes:'x'.repeat(501)},{notes:5}])assert.throws(()=>validateLead({province:'กรุงเทพมหานคร',name:'A',phone:'123',...patch}));
 assert.equal(validateLead({province:'กรุงเทพมหานคร',name:'A',phone:'123',status:'booked'}).status,undefined);
});
test('lead HTTP API saves profile, rejects invalid catalogs and scopes reads to current agent',async(t)=>{
 process.env.ALLOW_DEV_AUTH='true';const saved=[];
 const repo={create:b=>({...b}),save:async b=>{if(b.id){const idx=saved.findIndex(row=>row.id===b.id);if(idx>=0){saved[idx]={...saved[idx],...b};return saved[idx];}}const row={...b,id:saved.length+1,created_at:new Date(),desired_room_type:b.desired_room_type_id?{code:'studio'}:null,visa_type:b.visa_type_id?{code:'tourist'}:null};saved.push(row);return row;},findOne:async({where})=>saved.find(row=>row.id===where.id&&row.created_by_user_id===where.created_by_user_id)||null};
 const catalog={findOne:async({where})=>where.id===1||where.term_months===12?{id:1,code:'tourist',term_months:12,is_active:true}:null,find:async()=>[{id:1,code:'tourist'}]};
 withTx(repo,id=>saved.find(row=>row.id===id));
 const service=new AgentLeadsService(repo,catalog,catalog,catalog);
 service.locationCatalog=async()=>[{name:'กรุงเทพมหานคร',nameEn:'Bangkok',locations:['วัฒนา','คลองเตย']}];
 class TestModule{};Module({controllers:[AgentLeadsController],providers:[{provide:AgentLeadsService,useValue:service},{provide:AuthService,useValue:{findBySupabaseUserId:async id=>({id:Number(id)}),loadUserWithRoles:async id=>({id,roleNames:id===8?['guest']:['agent']})}}]})(TestModule);
 const app=await NestFactory.create(TestModule,{logger:false});t.after(()=>app.close());app.setGlobalPrefix('api/v1');await app.listen(0,'127.0.0.1');const base=await app.getUrl();
 const headers=id=>({'Content-Type':'application/json',Authorization:`Bearer dev|${id}|test@example.invalid`});
 assert.equal((await fetch(base+'/api/v1/agent/leads')).status,401);
 assert.equal((await fetch(base+'/api/v1/agent/leads',{method:'POST',headers:headers(8),body:'{}'})).status,403);
 const post=body=>fetch(base+'/api/v1/agent/leads',{method:'POST',headers:headers(7),body:JSON.stringify(body)});
 assert.equal((await post({province:'กรุงเทพมหานคร',name:'A'})).status,400);
 assert.equal((await post({province:'กรุงเทพมหานคร',name:'A',phone:'123',desiredRoomTypeId:999})).status,400);
 assert.equal((await post({province:'กรุงเทพมหานคร',name:'A',phone:'123',visaTypeId:999})).status,400);
 assert.equal((await post({province:'กรุงเทพมหานคร',name:'A',phone:'123',leaseDurationMonths:4})).status,400);
 assert.equal((await post({province:'กรุงเทพมหานคร',name:'A',phone:'123',locations:['เมืองเชียงใหม่']})).status,400);
 const provinceOnly=await post({province:'เชียงใหม่',name:'Province only',phone:'123'});assert.equal(provinceOnly.status,201);assert.deepEqual((await provinceOnly.json()).locations,[]);saved.length=0;
 const visas=await fetch(base+'/api/v1/agent/leads/visa-types',{headers:headers(7)});assert.equal(visas.status,200);assert.equal((await visas.json())[0].code,'tourist');
 assert.equal((await fetch(base+'/api/v1/agent/leads/visa-types',{headers:headers(8)})).status,403);
 const input={pins:[asok,klongtoei],radiusKm:3,locations:['วัฒนา','คลองเตย'],province:'กรุงเทพมหานคร',name:'Test lead',phone:'TEST',nationality:'Test',budgetMin:10000,budgetMax:15000,preferredLocation:'Test location',moveInPlan:'Next month',hasPets:false,occupation:'Test occupation',visaTypeId:1,leaseDurationMonths:12,usesCar:true,occupantCount:2,isSmoker:false,desiredRoomTypeId:1,notes:'Call after 6pm'};
 const response=await post({...input,created_by_user_id:9,status:'booked'});assert.equal(response.status,201);const lead=await response.json();for(const [key,value]of Object.entries(input))assert.deepEqual(lead[key],value,key);assert.equal(lead.visaTypeCode,'tourist');assert.equal(lead.status,'new');assert.equal(saved[0].created_by_user_id,7);assert.equal(saved[0].rent_room_id,null);assert.equal(lead.tenantId,null);assert.equal(lead.rentRoomId,null);
 assert.equal((await fetch(base+'/api/v1/agent/leads/'+lead.id,{headers:headers(9)})).status,404);
 const firstView=await fetch(base+'/api/v1/agent/leads/'+lead.id,{headers:headers(7)});assert.equal(firstView.status,200);const opened=await firstView.json();assert.equal(opened.status,'new');assert.equal(saved[0].status,'new');assert.equal(opened.nextViewingAt,null);assert.equal(opened.nextViewingRoom,null);
 const nextAt=new Date(Date.now()+86400000);repo.nextViewings=[{lead_id:lead.id,scheduled_at:nextAt,rent_room_id:5,rent_room:{room_id:'1208',property:{name:'The Line'}}},{lead_id:999,scheduled_at:new Date(),rent_room_id:6,rent_room:null}];
 const withViewing=await (await fetch(base+'/api/v1/agent/leads/'+lead.id,{headers:headers(7)})).json();assert.equal(withViewing.nextViewingAt,nextAt.toISOString());assert.equal(withViewing.nextViewingRoom,'The Line · 1208');repo.nextViewings=[];
 const markProgress=await fetch(base+'/api/v1/agent/leads/'+lead.id+'/mark-inprogress',{method:'POST',headers:headers(7),body:'{}'});assert.equal(markProgress.status,201);const inProgress=await markProgress.json();assert.equal(inProgress.status,'inprogress');assert.equal(saved[0].status,'inprogress');
 const markLostBad=await fetch(base+'/api/v1/agent/leads/'+lead.id+'/mark-lost',{method:'POST',headers:headers(7),body:JSON.stringify({lostReason:'  '})});assert.equal(markLostBad.status,400);
 const markLost=await fetch(base+'/api/v1/agent/leads/'+lead.id+'/mark-lost',{method:'POST',headers:headers(7),body:JSON.stringify({lostReason:'Chose another place'})});assert.equal(markLost.status,201);const lost=await markLost.json();assert.equal(lost.status,'lost');assert.equal(lost.lostReason,'Chose another place');
 const reopen=await fetch(base+'/api/v1/agent/leads/'+lead.id+'/mark-inprogress',{method:'POST',headers:headers(7),body:'{}'});assert.equal(reopen.status,201);assert.equal((await reopen.json()).status,'inprogress');assert.equal(saved[0].lost_reason,null);
 saved[0].status='booked';saved[0].lost_reason=null;
 const bookedView=await fetch(base+'/api/v1/agent/leads/'+lead.id,{headers:headers(7)});assert.equal((await bookedView.json()).status,'booked');
 assert.equal((await fetch(base+'/api/v1/agent/leads/'+lead.id+'/mark-lost',{method:'POST',headers:headers(7),body:JSON.stringify({lostReason:'Nope'})})).status,409);
 assert.equal((await fetch(base+'/api/v1/agent/leads/'+lead.id+'/mark-inprogress',{method:'POST',headers:headers(7),body:'{}'})).status,409);
});

test('province and location validation rejects malformed inputs and canonicalizes province aliases', () => {
 const valid = {name:'A', phone:'123', province:'Bangkok'};
 assert.equal(validateLead(valid).province, 'กรุงเทพมหานคร');
 assert.deepEqual(validateLead(valid).locations, []);
 assert.deepEqual(validateLead({...valid, locations:['เขตวัฒนา', 'วัฒนา']}).locations, ['วัฒนา']);
 for (const patch of [{province:'not-a-province'}, {locations:'วัฒนา'}, {locations:[3]}, {locations:['']}, {locations:Array(51).fill('วัฒนา')}]) assert.throws(() => validateLead({...valid, ...patch}));
});
test('area filters are scoped by agent and province before pagination', async () => {
 const calls = [];
 const qb = {};
 for (const method of ['leftJoinAndSelect','where','andWhere','orderBy','addOrderBy','skip','take']) qb[method] = (...args) => {calls.push([method, ...args]); return qb;};
 qb.getManyAndCount = async () => [[], 42];
 qb.clone = countsFake();
 const service = new AgentLeadsService({createQueryBuilder:()=>qb}, {}, {}, {});
 const page = await service.list(7, {province:'Bangkok',locations:JSON.stringify(['วัฒนา','คลองเตย']),includeUnspecified:'true',page:'2'});
 assert.equal(page.total, 42);
 assert.ok(calls.some(([method,sql,args])=>method==='where' && args.agentId===7));
 assert.ok(calls.some(([method,sql,args])=>method==='andWhere' && args.province==='กรุงเทพมหานคร'));
 assert.ok(calls.some(([method,sql,args])=>method==='andWhere' && sql.includes('cardinality') && args.locations.length===2));
 assert.ok(calls.findIndex(([method])=>method==='andWhere') < calls.findIndex(([method])=>method==='skip'));
 assert.ok(calls.some(([method,n])=>method==='skip' && n===20));
 assert.ok(calls.some(([method,col,dir])=>method==='orderBy' && col==='lead.updated_at' && dir==='DESC'));
 calls.length=0;
 await service.list(7, {province:'Bangkok',locations:'["วัฒนา"]'});
 assert.ok(calls.some(([method,sql])=>method==='andWhere' && sql.includes('&&') && !sql.includes('cardinality')));
 await assert.rejects(()=>service.list(7,{locations:'["วัฒนา"]'}));
 await assert.rejects(()=>service.list(7,{province:'invalid'}));
 await assert.rejects(()=>service.list(7,{province:'Bangkok',locations:'{}'}));
});

test('status filter uses the displayed status; counts are taken before it', async () => {
 const calls=[];const countCalls=[];const qb={};
 for (const method of ['leftJoinAndSelect','where','andWhere','orderBy','addOrderBy','skip','take']) qb[method]=(...args)=>{calls.push([method,...args]);return qb;};
 qb.getManyAndCount=async()=>[[],3];
 qb.clone=()=>{const c={getRawMany:async()=>[{status:'viewing',count:'3'},{status:'new',count:'2'},{status:'other',count:'9'}]};for(const method of ['select','addSelect','groupBy'])c[method]=(...args)=>{countCalls.push([method,...args]);return c;};return c;};
 const service=new AgentLeadsService({createQueryBuilder:()=>qb},{},{},{});
 const page=await service.list(7,{status:'viewing'});
 const filter=calls.find(([method,sql])=>method==='andWhere'&&String(sql).includes(':status'));
 assert.equal(filter[2].status,'viewing');assert.ok(filter[1].includes('lead_viewings')&&filter[1].includes("'viewing'"));
 assert.deepEqual(page.statusCounts,{new:2,inprogress:0,viewing:3,booked:0,lost:0});
 assert.ok(countCalls.some(([method,sql,alias])=>method==='select'&&alias==='status'&&sql.includes('lead_viewings')));
 calls.length=0;
 await service.list(7,{});
 assert.ok(!calls.some(([method,sql])=>method==='andWhere'&&String(sql).includes(':status')));
 await assert.rejects(()=>service.list(7,{status:'viewed'}));
});

test('lead list sort accepts known keys and rejects invalid values', async () => {
 assert.equal(normalizeLeadSort(), 'updated_desc');
 assert.equal(normalizeLeadSort('created_desc'), 'created_desc');
 assert.equal(normalizeLeadSort('budget_asc'), 'budget_asc');
 assert.throws(() => normalizeLeadSort('nope'));
 const calls = [];
 const qb = {};
 for (const method of ['leftJoinAndSelect','where','andWhere','addSelect','orderBy','addOrderBy','skip','take']) qb[method] = (...args) => {calls.push([method, ...args]); return qb;};
 qb.getManyAndCount = async () => [[], 0];
 qb.clone = countsFake();
 const service = new AgentLeadsService({createQueryBuilder:()=>qb}, {}, {}, {});
 await service.list(7, {sort:'status_asc'});
 assert.ok(calls.some(([method,sql,alias])=>method==='addSelect' && String(sql).includes('CASE lead.status') && alias==='sort_status_rank'));
 assert.ok(calls.some(([method,col,dir])=>method==='orderBy' && col==='sort_status_rank' && dir==='ASC'));
 calls.length=0;
 await service.list(7, {sort:'budget_desc'});
 assert.ok(calls.some(([method,sql,alias])=>method==='addSelect' && String(sql).includes('COALESCE') && alias==='sort_budget'));
 assert.ok(calls.some(([method,col,dir,nulls])=>method==='orderBy' && col==='sort_budget' && dir==='DESC' && nulls==='NULLS LAST'));
 await assert.rejects(()=>service.list(7,{sort:'price_asc'}));
});

test('location catalog normalizes property provinces and deduplicates districts', async () => {
 const qb={select(){return this;},addSelect(){return this;},distinct(){return this;},async getRawMany(){return [{province:'Bangkok',district:'เขตวัฒนา'},{province:'กรุงเทพมหานคร',district:'วัฒนา'},{province:'จังหวัดเชียงใหม่',district:'อำเภอเมืองเชียงใหม่'},{province:'Bangkok',district:'-'},{province:'unknown',district:'area'}];}};
 const service=new AgentLeadsService({manager:{getRepository:()=>({createQueryBuilder:()=>qb})}}, {}, {}, {});
 const catalog=await service.locationCatalog();
 assert.equal(catalog.length,77);
 assert.deepEqual(catalog.find(p=>p.name==='กรุงเทพมหานคร').locations,['วัฒนา']);
 assert.deepEqual(catalog.find(p=>p.name==='เชียงใหม่').locations,['เมืองเชียงใหม่']);
 assert.deepEqual(catalog.find(p=>p.name==='ภูเก็ต').locations,[]);
});

test('ranked pins derive province/areas, need a shared radius and must be distinct valid locations',()=>{
 const base={name:'A',phone:'123'};
 assert.deepEqual(validateLead(base).pins,[]);
 assert.equal(validateLead({...base,radiusKm:3}).radiusKm,null);
 const pinned=validateLead({...base,province:'เชียงใหม่',locations:['ignored'],radiusKm:5,pins:[{...klongtoei,rank:9,province:'Bangkok',district:'เขตคลองเตย'},asok]});
 assert.deepEqual(pinned.pins.map(p=>p.rank),[1,2]);
 assert.equal(pinned.pins[0].province,'กรุงเทพมหานคร');
 assert.equal(pinned.province,'กรุงเทพมหานคร');
 assert.deepEqual(pinned.locations,['คลองเตย','วัฒนา']);
 assert.equal(pinned.radiusKm,5);
 const pin={name:'P',latitude:13.7,longitude:100.5,province:'Bangkok'};
 for(const patch of [{pins:[pin]},{pins:[pin],radiusKm:2},{pins:'x',radiusKm:3},{pins:[pin,{...pin,latitude:13.8},{...pin,latitude:13.9},{...pin,latitude:14}],radiusKm:3},{pins:[{...pin,latitude:91}],radiusKm:3},{pins:[{...pin,longitude:NaN}],radiusKm:3},{pins:[{...pin,name:' '}],radiusKm:3},{pins:[{...pin,province:'Tokyo'}],radiusKm:3},{pins:[pin,{...pin}],radiusKm:3},{pins:[{...pin,placeId:'a'},{...pin,latitude:13.8,placeId:'a'}],radiusKm:3},{radiusKm:4}]) assert.throws(()=>validateLead({...base,...patch}),undefined,JSON.stringify(patch));
});

test('editing lead updates allowed fields, preserves booking links, and rejects cross-agent writes', async () => {
  const row = {id: 41, created_by_user_id: 7, name: 'Before', phone: '0812345678', status: 'booked', tenant_id: 12, rent_room_id: 15, has_pets: false, province: null, locations: [], created_at: new Date()};
  let writes = 0;
  const repository = {
    findOne: async ({where}) => where.id === row.id && where.created_by_user_id === row.created_by_user_id ? {...row} : null,
    update: async (where, patch) => { assert.deepEqual(where, {id: 41, created_by_user_id: 7}); assert.equal(patch.status, undefined); assert.equal(patch.tenant_id, undefined); assert.equal(patch.created_by_user_id, undefined); Object.assign(row, patch); writes++; },
  };
  const service = new AgentLeadsService(withTx(repository, () => row), {}, {}, {});
  const updated = await service.update(7, 41, {name: 'After', budgetMin: 0, notes: '  Prefers LINE  ', status: 'new', tenant_id: null, created_by_user_id: 99});
  assert.equal(updated.notes, 'Prefers LINE'); assert.equal(row.notes, 'Prefers LINE');
  assert.equal(updated.name, 'After'); assert.equal(updated.phone, '0812345678'); assert.equal(updated.hasPets, false); assert.equal(updated.budgetMin, 0);
  assert.equal(row.status, 'booked'); assert.equal(row.tenant_id, 12); assert.equal(row.rent_room_id, 15);
  await assert.rejects(() => service.update(8, 41, {name:'Other'}), e => e.getStatus() === 404);
  await assert.rejects(() => service.update(7, 41, {name:''}), e => e.getStatus() === 400);
  await assert.rejects(() => service.update(7, 41, []), e => e.getStatus() === 400);
  assert.equal(writes, 1);
});

test('editing keeps pins on partial updates, reorders them, and can clear them', async () => {
  const row = {id: 1, created_by_user_id: 7, name:'Lead',phone:'0812345678',status:'inprogress',province:'กรุงเทพมหานคร',locations:['วัฒนา','คลองเตย'],radius_km:3,has_pets:true,created_at:new Date(),
    pins:[{lead_id:1,rank:2,place_id:null,name:klongtoei.name,latitude:klongtoei.latitude,longitude:klongtoei.longitude,province:klongtoei.province,district:klongtoei.district},{lead_id:1,rank:1,place_id:'test-place',name:asok.name,latitude:asok.latitude,longitude:asok.longitude,province:asok.province,district:asok.district}]};
  const service = new AgentLeadsService(withTx({findOne:async()=>({...row}),update:async(_,patch)=>Object.assign(row,patch)}, () => row), {}, {}, {});
  const kept = await service.update(7,1,{name:'Renamed'});
  assert.deepEqual(kept.pins.map(p=>p.name),['BTS Asok','Klong Toei Market']);
  const reordered = await service.update(7,1,{pins:[klongtoei,asok]});
  assert.deepEqual(reordered.pins.map(p=>[p.rank,p.name]),[[1,'Klong Toei Market'],[2,'BTS Asok']]);
  assert.deepEqual(row.locations,['คลองเตย','วัฒนา']);
  await service.update(7,1,{pins:[],province:null,locations:[],radiusKm:null,hasPets:null});
  assert.deepEqual(row.pins,[]); assert.equal(row.radius_km,null); assert.equal(row.province,null); assert.deepEqual(row.locations,[]); assert.equal(row.has_pets,null);
});

test('email and other contact channels are validated, trimmed and deduplicated',()=>{
  const base={name:'A',phone:'123'};
  assert.equal(validateLead(base).email,null);
  assert.deepEqual(validateLead(base).otherContacts,[]);
  assert.equal(validateLead({...base,email:'  '}).email,null);
  const value=validateLead({...base,email:' a@b.co ',otherContacts:[{channel:'line',value:' @lead '},{channel:'line',value:'@LEAD'},{channel:'whatsapp',value:'+66 81 234 5678'}]});
  assert.equal(value.email,'a@b.co');
  assert.deepEqual(value.otherContacts,[{channel:'line',value:'@lead'},{channel:'whatsapp',value:'+66 81 234 5678'}]);
  const contact={channel:'line',value:'@x'};
  for(const patch of [{email:'no-at'},{email:5},{email:`${'a'.repeat(250)}@b.com`},{otherContacts:'line'},{otherContacts:[{channel:'kakao',value:'x'}]},{otherContacts:[{channel:'line',value:' '}]},{otherContacts:[{channel:'line',value:'x'.repeat(256)}]},{otherContacts:[null]},{otherContacts:Array.from({length:6},(_,i)=>({...contact,value:`@x${i}`}))}]) assert.throws(()=>validateLead({...base,...patch}),undefined,JSON.stringify(patch).slice(0,80));
});

test('international phone numbers are normalized to E.164 while legacy local text is kept',()=>{
  const base={name:'A'};
  assert.equal(validateLead({...base,phone:'+66 81-234 5678'}).phone,'+66812345678');
  assert.equal(validateLead({...base,phone:'0812345678'}).phone,'0812345678');
  assert.equal(validateLead({...base,phone:'TEST'}).phone,'TEST');
  for(const phone of ['+0812345678','+66','+66abc12345','+1234567890123456']) assert.throws(()=>validateLead({...base,phone}),undefined,phone);
});

test('phone search matches Thai local and +66 forms',async()=>{
  assert.deepEqual(phoneSearchDigits('081-234'),['081234','6681234']);
  assert.deepEqual(phoneSearchDigits('+66 81 234'),['6681234','081234']);
  assert.deepEqual(phoneSearchDigits('Somchai'),[]);
  assert.deepEqual(phoneSearchDigits('12'),[]);
  const calls=[];const qb={};
  for(const method of ['leftJoinAndSelect','where','andWhere','orderBy','addOrderBy','skip','take']) qb[method]=(...args)=>{calls.push([method,...args]);return qb;};
  qb.getManyAndCount=async()=>[[],0];
  qb.clone=countsFake();
  const service=new AgentLeadsService({createQueryBuilder:()=>qb},{},{},{});
  await service.list(7,{q:'0812'});
  const search=calls.find(([method,sql])=>method==='andWhere'&&sql.includes('ILIKE :q'));
  assert.ok(search[1].includes('LIKE ANY')); assert.deepEqual(search[2].phoneDigits,['%0812%','%66812%']);
  calls.length=0;
  await service.list(7,{q:'Somchai'});
  assert.ok(!calls.find(([method,sql])=>method==='andWhere'&&sql.includes('ILIKE :q'))[1].includes('LIKE ANY'));
});

test('editing keeps contacts on partial updates and can clear them', async () => {
  const row = {id: 2, created_by_user_id: 7, name:'Lead',phone:'0812345678',status:'new',province:null,locations:[],email:'old@mail.com',other_contacts:[{channel:'line',value:'@old'}],created_at:new Date(),pins:[]};
  const service = new AgentLeadsService(withTx({findOne:async()=>({...row}),update:async(_,patch)=>Object.assign(row,patch)}, () => row), {}, {}, {});
  const kept = await service.update(7,2,{name:'Renamed'});
  assert.equal(kept.email,'old@mail.com'); assert.deepEqual(kept.otherContacts,[{channel:'line',value:'@old'}]);
  const changed = await service.update(7,2,{otherContacts:[{channel:'wechat',value:'wx_lead'}]});
  assert.deepEqual(changed.otherContacts,[{channel:'wechat',value:'wx_lead'}]); assert.deepEqual(row.other_contacts,[{channel:'wechat',value:'wx_lead'}]);
  await service.update(7,2,{email:null,otherContacts:[]});
  assert.equal(row.email,null); assert.deepEqual(row.other_contacts,[]);
});

test('given name and surname build the display name, and name-only clients are split',async()=>{
  const split=validateLead({name:' Somchai  Jai Dee ',phone:'123'});
  assert.equal(split.firstName,'Somchai'); assert.equal(split.lastName,'Jai Dee'); assert.equal(split.name,'Somchai Jai Dee');
  const given=validateLead({name:'ignored',firstName:' Taro ',lastName:'',phone:'123'});
  assert.equal(given.name,'Taro'); assert.equal(given.lastName,'');
  for(const patch of [{name:'',firstName:''},{firstName:'x'.repeat(256)},{firstName:'x'.repeat(200),lastName:'y'.repeat(60)}]) assert.throws(()=>validateLead({name:'A',phone:'123',...patch}),undefined,JSON.stringify(patch).slice(0,60));
  const row={id:3,created_by_user_id:7,name:'Somchai Jaidee',first_name:'Somchai',last_name:'Jaidee',phone:'0812345678',status:'new',province:null,locations:[],created_at:new Date(),pins:[]};
  const service=new AgentLeadsService(withTx({findOne:async()=>({...row}),update:async(_,patch)=>Object.assign(row,patch)},()=>row),{},{},{});
  const renamed=await service.update(7,3,{name:'Malee Suksan'});
  assert.equal(renamed.firstName,'Malee'); assert.equal(row.last_name,'Suksan'); assert.equal(row.name,'Malee Suksan');
  const surname=await service.update(7,3,{lastName:'Rakdee'});
  assert.equal(surname.name,'Malee Rakdee'); assert.equal(row.first_name,'Malee');
});
